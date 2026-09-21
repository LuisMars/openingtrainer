#!/usr/bin/env node
// Counts what players of OUR colour actually choose at the positions the trainer
// asks the user to move in. tools/count-replies.mjs counts the opponent's replies
// and drops a game the moment our side leaves the repertoire, so it never records
// the move that left it; this tool records exactly that move, then drops the game
// the same way. The result is the raw material for "a common mistake here": a
// counted choice that the stored engine table grades poorly. Frequency never
// grades anything here - the grade comes from src/data/evals.js in the app.
//
//   node tools/count-choices.mjs \
//     --in data-src/games/lichess_db_standard_rated_2014-01.pgn.zst \
//     --maxPly 30 --out research/choices-player.json
//
// One pass, three rating bands, split exactly as research/METHOD.md "Rating bands"
// splits them (average of WhiteElo and BlackElo: under 1500 is <= 1499.5, the
// middle band 1500 to 1899.5, the top band 1900 and over). A game missing either
// Elo is read but counted in no band. Both trees are walked for every game: the
// Colle tree at White-to-move nodes, the Hippo tree at Black-to-move nodes, so no
// position can be counted twice.
//
//   --tsv  prints, instead of counting, the research/named-moves.tsv section for
//          the counted choices the stored table has no score for (reads --out).
//   --emit writes src/data/choices.js from --out and the built page's EVL.
// Order: count; build; --tsv replaces the last section of named-moves.tsv;
// tools/build-evals.mjs --extra research/pilot-positions.txt --force
// research/named-moves.tsv; build; --emit; build.
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
  "\nObject.assign(ctx,{LINES,START,startPos,make,san,legal,uciOf,fenOf,fenPos,EVL});")(ctx);
const { LINES, START, startPos, make, san, legal, uciOf, fenOf, fenPos, EVL } = ctx;
const keyFen = (p) => p.ep < 0 || legal(p).some((m) => m.ep)
  ? fenOf(p) : fenOf({ b: p.b, w: p.w, cr: p.cr, ep: -1 });

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i < 0 ? d : process.argv[i + 1]; };
const out = arg("out", "research/choices-player.json");

/* ---- --tsv: the forced-search section for unscored counted choices ---- */
// A choice is worth a number when it was made in at least MIN_SHARE of the games
// reaching the position in some band with at least MIN_PARENT games there (the
// contract's 30-game floor), and at least MIN_GAMES times. Below that it can never
// be shown, so searching it would only grow the table.
const MIN_PARENT = 30, MIN_SHARE = 0.05, MIN_GAMES = 10;
// build-evals searches the forced moves at one position in ONE shared searchmoves
// job, and the scores depend on the set searched together. A position that already
// has such a job - a drilled move outside the five, or a hand-named move - is
// "locked": widening its shared job would shift the drilled moves' own scores by a
// few centipawns and change grading under the repertoire. Choices there are listed
// with the third column "alone", which build-evals searches one move per job and
// appends to x, leaving the shared job and every number it produced untouched.
const TSV_MARK = "# Counted player choices";
// keyFen -> Set(uci in the locked position's shared job)
function lockedKeys() {
  const locked = new Map();
  const add = (k, u) => { if (!locked.has(k)) locked.set(k, new Set()); locked.get(k).add(u); };
  const drilled = new Map();
  for (const l of LINES) {
    let p = l.start === START ? startPos() : fenPos(l.start.indexOf(" ") > 0 ? l.start : l.start + " w - -");
    l.moves.forEach(([uci], i) => {
      if ((i % 2 === 0 ? "w" : "b") === l.you) {
        const k = keyFen(p);
        if (!drilled.has(k)) drilled.set(k, new Set());
        drilled.get(k).add(uci);
      }
      p = make(p, legal(p).find((x) => uciOf(x) === uci));
    });
  }
  for (const [k, us] of drilled) {
    const row = EVL[k];
    if (row) for (const u of us) if (!row.m.some((e) => e[0] === u)) add(k, u);
  }
  const named = readFileSync(join(root, "research/named-moves.tsv"), "utf8");
  const hand = named.includes(TSV_MARK) ? named.slice(0, named.indexOf(TSV_MARK)) : named;
  for (const raw of hand.split("\n")) {
    const t = raw.trim();
    if (!t || t.startsWith("#")) continue;
    const [k, list] = t.split("\t");
    for (const u of list.split(" ")) add(k, u);
  }
  return locked;
}
if (process.argv.includes("--tsv")) {
  const doc = JSON.parse(readFileSync(join(root, out), "utf8"));
  const locked = lockedKeys();
  const lines = [];
  let n = 0, nPos = 0, na = 0, naPos = 0;
  for (const p of doc.positions) {
    const row = EVL[p.key];
    if (!row) continue;
    const scored = new Set(row.m.map((e) => e[0]));
    const shared = locked.get(p.key);
    const want = p.moves.filter((mv) => !scored.has(mv.uci) && !(shared && shared.has(mv.uci)) &&
      mv.games.some((g, b) => p.parent[b] >= MIN_PARENT && g >= MIN_GAMES && g / p.parent[b] >= MIN_SHARE))
      .map((mv) => mv.uci);
    if (!want.length) continue;
    if (shared) { lines.push(p.key + "\t" + want.join(" ") + "\talone"); na += want.length; naPos++; }
    else { lines.push(p.key + "\t" + want.join(" ")); n += want.length; nPos++; }
  }
  console.log(TSV_MARK + " the ranked five do not contain (tools/count-choices.mjs");
  console.log(`# --tsv, from ${out}). Each was chosen in at least ${MIN_SHARE * 100}% of at least ${MIN_PARENT}`);
  console.log(`# games reaching the position in one rating band, and at least ${MIN_GAMES} times, so`);
  console.log("# the app may name it as a common choice; it needs a score before it may be");
  console.log(`# priced. ${n} moves at ${nPos} positions share one search per position. ${na} more, at`);
  console.log(`# ${naPos} positions whose shared search is fixed by drilled or hand-named moves, are`);
  console.log("# marked alone: each gets a search of its own, so no stored score moves.");
  console.log("# Keep this section last. Regenerate it, do not edit it.");
  for (const l of lines) console.log(l);
  process.exit(0);
}

/* ---- --emit: the shipped table, src/data/choices.js ---- */
// Every drilled position with at least one choice over the floor in some band.
// All such choices ship, good and bad alike: which of them is a mistake is the
// grader's call in the app, read from EVL, never this file's. Every one must have
// a score by now (the --tsv section, through build-evals --force); anything else
// fails here rather than ship a choice the app could name and not price.
if (process.argv.includes("--emit")) {
  const doc = JSON.parse(readFileSync(join(root, out), "utf8"));
  const CHO = {};
  let nMoves = 0, unscored = [];
  for (const p of doc.positions) {
    const row = EVL[p.key];
    if (!row) continue;
    const keep = p.moves.filter((mv) => mv.games.some((g, b) =>
      p.parent[b] >= MIN_PARENT && g >= MIN_GAMES && g / p.parent[b] >= MIN_SHARE));
    if (!keep.length) continue;
    const pos = fenPos(p.key);
    const scored = new Set([...row.m, ...(row.x || [])].map((e) => e[0]));
    for (const mv of keep) {
      const m = legal(pos).find((x) => uciOf(x) === mv.uci);
      if (!m || san(pos, m) !== mv.san) throw new Error(`${mv.uci} (${mv.san}) does not replay at ${p.key}`);
      if (!scored.has(mv.uci)) unscored.push(p.key + "\t" + mv.uci);
    }
    CHO[p.key] = [p.parent, ...keep.map((mv) => [mv.uci, mv.san, ...mv.games])];
    nMoves += keep.length;
  }
  if (unscored.length) throw new Error(`${unscored.length} counted choices have no score; ` +
    "replace the section of research/named-moves.tsv from `node tools/count-choices.mjs --tsv` " +
    "and rerun tools/build-evals.mjs --force research/named-moves.tsv first:\n  " + unscored.join("\n  "));
  const f = doc.filters;
  const body = `// Generated by tools/count-choices.mjs --emit - do not edit. What players of the
// trained colour actually chose at the positions the trainer drills, counted, never
// estimated. SOURCE: ${f.inputs.join(", ")} (lichess, CC0),
// counted ${doc.retrieved}: ${doc.games_read} games read; by band ${doc.games_in_band.join(" / ")};
// ${doc.games_in_tree.join(" / ")} reached a drilled position. Bands: average of WhiteElo and
// BlackElo, split as research/METHOD.md "Rating bands", in FRQ_BANDS order. Games are
// followed while they stay in the repertoire, up to ply ${f.maxPly}; the move that leaves it
// is counted, then the game is dropped.
// SHAPE: CHO[keyFen] = [[games reaching the position, per band], [uci, san, games per
// band...], ...]. A move ships when, in at least one band, ${MIN_PARENT}+ games reached the
// position and it was chosen ${MIN_GAMES}+ times and in ${MIN_SHARE * 100}%+ of them. Every
// shipped move has a score in EVL (m or x). Frequency is not quality: nothing here
// says a move is good or bad; the app asks gradeMove().
// ${Object.keys(CHO).length} positions, ${nMoves} moves.
const CHO_BANDS=${JSON.stringify(f.bands.map((b) => b.label))};
const CHO_FLOOR=${JSON.stringify({ parent: MIN_PARENT, games: MIN_GAMES, share: MIN_SHARE })};
const CHO_SRC="lichess rated games, January 2014";
const CHO=${JSON.stringify(CHO)};
`;
  writeFileSync(join(root, "src/data/choices.js"), body);
  console.log(`wrote src/data/choices.js: ${Object.keys(CHO).length} positions, ${nMoves} moves, ` +
    `${(body.length / 1024).toFixed(1)} KB`);
  process.exit(0);
}

const ins = process.argv.filter((a, i) => process.argv[i - 1] === "--in");
const maxPly = +arg("maxPly", 30);
if (!ins.length) { console.error("need --in <pgn|pgn.zst>"); process.exit(1); }

/* ---- repertoire moves per side, by position identity ---- */
const OURS = { w: new Map(), b: new Map() };
for (const l of LINES) {
  if (l.start !== START) continue; // set positions are not reached by counting from move one
  let p = startPos();
  for (const [uci] of l.moves) {
    if ((p.w ? "w" : "b") === l.you) {
      const k = keyFen(p);
      if (!OURS[l.you].has(k)) OURS[l.you].set(k, new Set());
      OURS[l.you].get(k).add(uci);
    }
    const m = legal(p).find((x) => uciOf(x) === uci);
    if (!m) throw new Error(`line ${l.id}: illegal ${uci}`);
    p = make(p, m);
  }
}

const BANDS = [["under 1500", -Infinity, 1499.5], ["1500–1899", 1500, 1899.5], ["1900 and over", 1900, Infinity]];
const bandOf = (h) => {
  const we = +h.WhiteElo, be = +h.BlackElo;
  if (!Number.isFinite(we) || !Number.isFinite(be)) return -1;
  const a = (we + be) / 2;
  return BANDS.findIndex(([, lo, hi]) => a >= lo && a <= hi);
};

const tally = new Map(); // key -> {fen, side, parent:[3], moves: Map(uci -> {san, games:[3]})}
const read = [0, 0, 0], inTree = [0, 0, 0];
let games = 0;

function walk(tokens, band) {
  let touched = false;
  for (const side of ["w", "b"]) {
    let p = startPos();
    for (let i = 0; i < tokens.length && i < maxPly; i++) {
      const want = tokens[i].replace(/[+#!?]/g, "");
      const m = legal(p).find((x) => san(p, x).replace(/[+#!?]/g, "") === want);
      if (!m) break;                                  // unparsable / corrupt game
      if ((p.w ? "w" : "b") === side) {
        const k = keyFen(p), mine = OURS[side].get(k);
        if (!mine) break;                              // not a position we drill
        let row = tally.get(k);
        if (!row) tally.set(k, row = { fen: fenOf(p), side, parent: [0, 0, 0], moves: new Map() });
        row.parent[band]++;
        const u = uciOf(m);
        let e = row.moves.get(u);
        if (!e) row.moves.set(u, e = { san: san(p, m), games: [0, 0, 0] });
        e.games[band]++;
        touched = true;
        if (!mine.has(u)) break;                       // left the repertoire: counted, then dropped
      }
      p = make(p, m);
    }
  }
  if (touched) inTree[band]++;
}

/* ---- PGN streaming (same frame walker as tools/count-replies.mjs) ---- */
const MOVETOKEN = /[a-zA-Z][a-zA-Z0-9=+#!?-]*/;
function zstdStream(file) {
  const o = new PassThrough();
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
        dec.on("error", (e) => { if (!done) o.destroy(e); });
        const resume = () => dec.resume();
        dec.on("data", (c) => { if (!o.write(c)) dec.pause(); });
        o.on("drain", resume);
        src.pipe(dec);
        await new Promise((res) => dec.once("end", res));
        done = true;
        off += dec.bytesWritten;
        o.off("drain", resume);
        src.destroy(); dec.destroy();
      }
    } finally { closeSync(fd); o.end(); }
  })().catch((e) => o.destroy(e));
  return o;
}
async function readPgn(file) {
  const stream = file.endsWith(".zst") ? zstdStream(file) : createReadStream(file);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let h = {}, body = "";
  const flush = () => {
    if (body.trim()) {
      games++;
      const band = bandOf(h);
      if (band >= 0) {
        read[band]++;
        const clean = body.replace(/\{[^}]*\}/g, " ").replace(/\$\d+/g, " ")
          .replace(/\d+\.(\.\.)?/g, " ").replace(/[()]/g, " ");
        const toks = clean.split(/\s+/).filter((t) => MOVETOKEN.test(t) && !/^(1-0|0-1|1\/2|\*)/.test(t));
        if (toks.length > 1) walk(toks, band);
      }
      if (games % 100000 === 0) process.stderr.write(`  ${games} games\n`);
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

/* ---- emit: every counted move, nothing filtered but single occurrences ---- */
const positions = [...tally.entries()]
  .map(([key, r]) => ({ key, fen: r.fen, side: r.side, drilled: !!EVL[key], parent: r.parent,
    moves: [...r.moves.entries()]
      .map(([uci, e]) => ({ uci, san: e.san, games: e.games }))
      .filter((e) => e.games.reduce((a, b) => a + b, 0) >= 2)
      .sort((a, b) => b.games.reduce((x, y) => x + y, 0) - a.games.reduce((x, y) => x + y, 0)) }))
  .sort((a, b) => b.parent.reduce((x, y) => x + y, 0) - a.parent.reduce((x, y) => x + y, 0));
const doc = {
  pool: "player",
  filters: { inputs: ins, maxPly, eloBasis: "average of WhiteElo and BlackElo",
    bands: BANDS.map(([label, lo, hi]) => ({ label, minElo: Number.isFinite(lo) ? lo : null, maxElo: Number.isFinite(hi) ? hi : null })),
    counted: "our colour's move at every drilled position reached by following the repertoire; single occurrences omitted" },
  retrieved: new Date().toISOString().slice(0, 10),
  games_read: games, games_in_band: read, games_in_tree: inTree, positions,
};
writeFileSync(join(root, out), JSON.stringify(doc));
process.stderr.write(`read ${games} games (${read.join("/")} by band), ${inTree.join("/")} entered a tree, ` +
  `${positions.length} positions (${positions.filter((p) => p.drilled).length} drilled)\n`);
