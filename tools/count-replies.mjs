#!/usr/bin/env node
// Counts what opponents actually play against this repertoire.
//
// The lichess opening explorer API is unreachable from this environment
// (HTTP 401 through the proxy), so frequencies are counted here from game
// dumps instead. Output follows the frequency record in research/CONTRACTS.md:
// every row carries its pool, its exact filters, and its sample size.
//
//   node tools/count-replies.mjs --side w --pool player \
//     --in data-src/games/lichess_db_standard_rated_2014-01.pgn.zst \
//     --minElo 1600 --maxPly 24 --out research/freq-colle-player.json
//
// --side w walks the Colle tree (we are White), --side b the Hippo tree.
// --minElo/--maxElo bound the average of the two ratings, both inclusive. The
// average moves in half points, so a band that stops below 1900 is --maxElo 1899.5
// (the shipped bands are listed in research/METHOD.md).
// At our own nodes the game must follow a repertoire move or it is dropped;
// at opponent nodes every move is counted. That keeps the tree the size of
// the repertoire rather than the size of chess.
import { readFileSync, writeFileSync, createReadStream, openSync, readSync, closeSync, statSync } from "node:fs";
import { PassThrough } from "node:stream";
import { createInterface } from "node:readline";
import { createZstdDecompress } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---- load the shipped engine, exactly as test/verify.mjs does ---- */
const html = readFileSync(join(root, "docs/index.html"), "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const ctx = {};
new Function("ctx", js.slice(0, js.indexOf("/* ================= state ================= */")) +
  "\nObject.assign(ctx,{LINES,startPos,make,san,legal,uciOf,fenOf});")(ctx);
const { LINES, startPos, make, san, legal, uciOf, fenOf } = ctx;

// keyFen() from src/app.js, kept byte-identical in behaviour so the keys match.
const keyFen = (p) => p.ep < 0 || legal(p).some((m) => m.ep)
  ? fenOf(p) : fenOf({ b: p.b, w: p.w, cr: p.cr, ep: -1 });

/* ---- args ---- */
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i < 0 ? d : process.argv[i + 1]; };
const side = arg("side", "w");
const pool = arg("pool", "player");
const ins = process.argv.filter((a, i) => process.argv[i - 1] === "--in");
const minElo = +arg("minElo", 0), maxElo = +arg("maxElo", 9999);
const maxPly = +arg("maxPly", 24), minGames = +arg("minGames", 1);
const speeds = arg("speeds", "").split(",").filter(Boolean).map((s) => s.toLowerCase());
const out = arg("out", null);
if (!ins.length) { console.error("need --in <pgn|pgn.zst>"); process.exit(1); }

/* ---- our repertoire moves, by position identity ---- */
// Union over every line of the moves OUR side plays there. A game that leaves
// this set is dropped: we only care what opponents do against what we play.
const OURS = new Map();
for (const l of LINES) {
  if (l.you !== side) continue;
  let p = startPos();
  for (const [uci] of l.moves) {
    if ((p.w ? "w" : "b") === side) {
      const k = keyFen(p);
      if (!OURS.has(k)) OURS.set(k, new Set());
      OURS.get(k).add(uci);
    }
    const m = legal(p).find((x) => uciOf(x) === uci);
    if (!m) throw new Error(`line ${l.id}: illegal ${uci}`);
    p = make(p, m);
  }
}

/* ---- counting ---- */
const tally = new Map();   // key -> {parent, fen, moves: Map(san -> {uci, games, w, d, b})}
let games = 0, kept = 0;

function record(p, m, result) {
  const k = keyFen(p);
  let row = tally.get(k);
  if (!row) tally.set(k, row = { parent: 0, fen: fenOf(p), moves: new Map() });
  row.parent++;
  const s = san(p, m);
  let e = row.moves.get(s);
  if (!e) row.moves.set(s, e = { uci: uciOf(m), games: 0, w: 0, d: 0, b: 0 });
  e.games++;
  if (result === "1-0") e.w++; else if (result === "0-1") e.b++; else if (result === "1/2-1/2") e.d++;
}

function walk(tokens, result) {
  games++;
  let p = startPos(), touched = false;
  for (let i = 0; i < tokens.length && i < maxPly; i++) {
    const want = tokens[i].replace(/[+#!?]/g, "");
    const ms = legal(p);
    const m = ms.find((x) => san(p, x).replace(/[+#!?]/g, "") === want);
    if (!m) return;                                   // unparsable / corrupt game
    if ((p.w ? "w" : "b") === side) {
      const mine = OURS.get(keyFen(p));
      if (!mine || !mine.has(uciOf(m))) break;        // left our repertoire
    } else {
      record(p, m, result); touched = true;
    }
    p = make(p, m);
  }
  if (touched) kept++;
}

/* ---- PGN streaming ---- */
const MOVETOKEN = /[a-zA-Z][a-zA-Z0-9=+#!?-]*/;
function eligible(h) {
  const we = +h.WhiteElo, be = +h.BlackElo;
  if (minElo || maxElo < 9999) {
    if (!Number.isFinite(we) || !Number.isFinite(be)) return false;
    const avg = (we + be) / 2;
    if (avg < minElo || avg > maxElo) return false;
  }
  if (speeds.length) {
    const ev = (h.Event || "").toLowerCase();
    if (!speeds.some((s) => ev.includes(s))) return false;
  }
  return true;
}

// The lichess dumps are a sequence of independent zstd frames separated by
// skippable frames, and node's decompressor stops (then errors) at each frame
// boundary. Walk the frames by hand: bytesWritten tells us exactly how much
// input a finished frame consumed.
function zstdStream(file) {
  const out = new PassThrough();
  (async () => {
    const size = statSync(file).size, head = Buffer.alloc(8);
    let off = 0;
    const fd = openSync(file, "r");
    try {
      while (off < size - 8) {
        readSync(fd, head, 0, 8, off);
        const magic = head.readUInt32LE(0);
        if (magic >= 0x184d2a50 && magic <= 0x184d2a5f) { off += 8 + head.readUInt32LE(4); continue; }
        const dec = createZstdDecompress(), src = createReadStream(file, { start: off });
        let done = false;
        dec.on("error", (e) => { if (!done) out.destroy(e); });   // past the frame end it is just the next frame
        const resume = () => dec.resume();
        dec.on("data", (c) => { if (!out.write(c)) dec.pause(); });
        out.on("drain", resume);
        src.pipe(dec);
        await new Promise((res) => dec.once("end", res));
        done = true;
        off += dec.bytesWritten;
        out.off("drain", resume);
        src.destroy(); dec.destroy();
      }
    } finally { closeSync(fd); out.end(); }
  })().catch((e) => out.destroy(e));
  return out;
}

async function readPgn(file) {
  const stream = file.endsWith(".zst") ? zstdStream(file) : createReadStream(file);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let h = {}, body = "";
  const flush = () => {
    if (body.trim() && eligible(h)) {
      const clean = body.replace(/\{[^}]*\}/g, " ").replace(/\$\d+/g, " ")
        .replace(/\d+\.(\.\.)?/g, " ").replace(/[()]/g, " ");
      const toks = clean.split(/\s+/).filter((t) => MOVETOKEN.test(t) && !/^(1-0|0-1|1\/2|\*)/.test(t));
      if (toks.length > 1) walk(toks, h.Result);
    }
    h = {}; body = "";
  };
  for await (const line of rl) {
    if (line.startsWith("[")) {
      if (body.trim()) flush();
      const m = line.match(/^\[(\w+)\s+"(.*)"\]$/);
      if (m) h[m[1]] = m[2];
    } else body += " " + line;
  }
  flush();
}

for (const f of ins) { process.stderr.write(`reading ${f}\n`); await readPgn(f); }

/* ---- emit ---- */
const filters = {
  side, pool, inputs: ins, maxPly,
  minElo: minElo || null, maxElo: maxElo < 9999 ? maxElo : null,
  speeds: speeds.length ? speeds : null,
  eloBasis: minElo || maxElo < 9999 ? "average of WhiteElo and BlackElo" : null,
};
const positions = [...tally.entries()]
  .filter(([, r]) => r.parent >= minGames)
  .sort((a, b) => b[1].parent - a[1].parent)
  .map(([key, r]) => ({
    key, fen: r.fen, parent_games: r.parent,
    replies: [...r.moves.entries()].sort((a, b) => b[1].games - a[1].games)
      .map(([sanTxt, e]) => ({
        san: sanTxt, uci: e.uci, games: e.games,
        share: +(e.games / r.parent).toFixed(4),
        white: e.w, draws: e.d, black: e.b,
      })),
  }));
const doc = { pool, filters, retrieved: new Date().toISOString().slice(0, 10), games_read: games, games_in_tree: kept, positions };
if (out) writeFileSync(join(root, out), JSON.stringify(doc, null, 1));
process.stderr.write(`read ${games} games, ${kept} entered the tree, ${positions.length} positions\n`);
if (!out) console.log(JSON.stringify(doc, null, 1));
