#!/usr/bin/env node
// Generates `synthetic` lines for the replies research/COVERAGE-MATRIX.md lists as
// `missing`, in the order research/W6-content-batch.md §1 ranks them, and records
// every decision (built, or skipped with its reason) in research/gap-lines.json.
//
//   node tools/gen-gap-lines.mjs --plan 50   decide the next 50 undecided gaps
//   node tools/gen-gap-lines.mjs --write     render research/gap-lines.json into
//                                            src/data/lines.js (+ KIND), and the
//                                            positions its prose cites into
//                                            research/pilot-positions.txt and
//                                            research/named-moves.tsv; print the report
//
// Run --plan on a fresh build (node build.mjs). After --write, run the pipeline
// (research/W6-content-batch.md §10), then --write again: the second pass takes
// every number in the prose from the shipped src/data/evals.js, and must print
// "notes unchanged" once the table is settled.
//
// The rules, per gap (one missing reply at one counted position):
//   path     the reply's position is reached by the repertoire's own move order:
//            the learner's moves from lines that are not `eco` (as §1 ranks), the
//            opponent's counted replies. A gap only an eco line's move order
//            reaches (1.Nf3, Bf4, Bg5: sister systems) is skipped.
//   learner  the system's moves at the board: a piece onto a formation square
//            (isSetupMove from src/engine.js against HIPPO_T, or COLLE_T and ZUK_T
//            for the Colle), castling, and for the Colle the recapture on d4. Of
//            those, the best-scoring one in a depth-20 search (the build's own
//            worker, cache and settings: tools/build-evals.mjs --worker); moves
//            outside the top five are searched alone, as build-evals searches a
//            drilled move. It is played only if gradeRow() grades it best or equal.
//            Otherwise the line stops (or the gap is skipped if nothing was played).
//   opponent the commonest move in the 1500-1899 band at that position (keyFen,
//            so transpositions inside the subtree merge) when at least MIN_NODE
//            counted games continue from it; otherwise the table's first choice.
//   stop     transposition into a position a line of the same side reaches, no
//            system move in the band, no system move at all, or MAX_OWN moves.
// Frequency is not quality: a count only chooses the opponent's move, and no
// grade is ever read from it.
import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream, openSync, readSync, closeSync, statSync } from "node:fs";
import { PassThrough } from "node:stream";
import { createInterface } from "node:readline";
import { createZstdDecompress } from "node:zlib";
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "docs/index.html"), "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const ctx = {};
new Function("ctx", js.slice(0, js.indexOf("/* ================= state ================= */")) +
  "\nObject.assign(ctx,{LINES,KIND,START,startPos,fenPos,make,san,legal,uciOf,fenOf,findMove," +
  "isSetupMove,gradeRow,cmpScore,COLLE_T,ZUK_T,HIPPO_T,EVL,ix,sq});")(ctx);
const { LINES, KIND, START, startPos, fenPos, make, san, legal, uciOf, fenOf, findMove,
  isSetupMove, gradeRow, cmpScore, COLLE_T, ZUK_T, HIPPO_T, EVL, ix } = ctx;
const keyFen = (p) => p.ep < 0 || legal(p).some((m) => m.ep)
  ? fenOf(p) : fenOf({ b: p.b, w: p.w, cr: p.cr, ep: -1 });

const PLAN = join(root, "research/gap-lines.json");
const COUNTS = join(root, "data-src/gap-counts.json");
const DUMP = join(root, "data-src/games/lichess_db_standard_rated_2014-01.pgn.zst");
const CH = { w: "Colle as White", b: "Hippopotamus as Black" };
const SYS = { w: "Colle", b: "Hippopotamus" };
const OPP = { w: "Black", b: "White" };
const BAND = 1;              // 1500-1899, the default band (research/METHOD.md)
const MIN_SHARE = 0.02;      // the matrix's own floor (tools/coverage-matrix.mjs)
const MIN_NODE = 10;         // counted games in the band before a count chooses a move
const MAX_OWN = 6;           // learner moves after the gap
const COUNT_PLY = 32;        // how deep the counting pass follows a game

const arg = (n) => { const i = process.argv.indexOf("--" + n); return i < 0 ? null : (process.argv[i + 1] || ""); };

// ---- what the repertoire already plays, by side ------------------------------
const SEEN = { w: new Map(), b: new Map() };   // key -> Map(uci -> Set(id))
const REACH = { w: new Map(), b: new Map() };  // key -> first id that reaches it
const OWN = { w: new Map(), b: new Map() };    // key -> Set(uci), learner moves of non-eco lines
for (const l of LINES) {
  let p = startPos();
  l.moves.forEach(([uci], i) => {
    const k = keyFen(p);
    if (!SEEN[l.you].has(k)) SEEN[l.you].set(k, new Map());
    const at = SEEN[l.you].get(k);
    if (!at.has(uci)) at.set(uci, new Set());
    at.get(uci).add(l.id);
    if (!REACH[l.you].has(k)) REACH[l.you].set(k, l.id);
    if ((i % 2 === 0 ? "w" : "b") === l.you && KIND[l.id] !== "eco") {
      if (!OWN[l.you].has(k)) OWN[l.you].set(k, new Set());
      OWN[l.you].get(k).add(uci);
    }
    p = make(p, findMove(p, uci));
  });
  const end = keyFen(p);
  if (!SEEN[l.you].has(end)) SEEN[l.you].set(end, new Map());
  if (!REACH[l.you].has(end)) REACH[l.you].set(end, l.id);
}

// ---- the gaps: tools/coverage-matrix.mjs's `missing` rows --------------------
const loadJ = (f) => JSON.parse(readFileSync(join(root, f), "utf8"));
const FILES = { w: "colle", b: "hippo" };
function gapRows() {
  const rows = [];
  for (const side of ["w", "b"]) {
    for (const pos of loadJ(`research/freq-${FILES[side]}-player.json`).positions) {
      const at = SEEN[side].get(pos.key);
      for (const r of pos.replies) {
        if (r.share < MIN_SHARE || (at && at.has(r.uci))) continue;
        const base = fenPos(pos.fen), mv = findMove(base, r.uci);
        const child = keyFen(make(base, mv));
        if (SEEN[side].has(child)) continue; // transposes
        rows.push({ id: pos.key + "|" + r.uci, side, parent: pos.key, uci: r.uci, san: r.san, child,
          pool: { games: r.games, parent: pos.parent_games } });
      }
    }
  }
  return rows;
}

// ---- reach (§1): product of the opponent's shares, learner's moves at 1 ------
function reachIn(file, side, ids) {
  const T = new Map(loadJ(file).positions.map((p) => [p.key, p]));
  const best = new Map(), seen = new Map();
  const walk = (p, r, path, d) => {
    const k = keyFen(p), node = T.get(k);
    if (!node || d > 40 || (seen.get(k) ?? -1) >= r) return;
    seen.set(k, r);
    for (const rep of node.replies) {
      const mv = findMove(p, rep.uci);
      if (!mv) continue;
      const sn = san(p, mv), c = make(p, mv), rr = r * rep.share, gid = k + "|" + rep.uci;
      if (ids.has(gid)) {
        const e = best.get(gid);
        if (!e || e.reach < rr) best.set(gid, { reach: rr, path: [...path, sn] });
        continue;
      }
      for (const u of OWN[side].get(keyFen(c)) || []) {
        const m2 = findMove(c, u);
        walk(make(c, m2), rr, [...path, sn, san(c, m2)], d + 1);
      }
    }
  };
  const s = startPos();
  if (side === "b") walk(s, 1, [], 0);
  else for (const u of OWN.w.get(keyFen(s)) || []) { const m = findMove(s, u); walk(make(s, m), 1, [san(s, m)], 0); }
  return best;
}
function ranked() {
  const rows = gapRows(), ids = new Set(rows.map((r) => r.id));
  for (const side of ["w", "b"]) {
    const src = { pool: `research/freq-${FILES[side]}-player.json` };
    for (const b of ["u1500", "1500-1899", "1900"]) src[b] = `research/freq-${FILES[side]}-player-${b}.json`;
    for (const [name, f] of Object.entries(src)) {
      for (const [gid, e] of reachIn(f, side, ids)) {
        const r = rows.find((x) => x.id === gid);
        if (r.side !== side) continue;
        (r.reach ||= {})[name] = e.reach;
        (r.paths ||= {})[name] = e.path;
      }
    }
  }
  for (const r of rows) {
    r.reach ||= {};
    const p = r.paths || {};
    r.path = p["1500-1899"] || p.pool || p.u1500 || p["1900"] || null;
    delete r.paths;
  }
  const k = (r) => [r.reach["1500-1899"] || 0, r.reach.pool || 0];
  rows.sort((a, b) => { const x = k(a), y = k(b); return y[0] - x[0] || y[1] - x[1] || (a.id < b.id ? -1 : 1); });
  return rows;
}

// ---- SAN reading for the counting pass ---------------------------------------
function sanMove(p, tok) {
  tok = tok.replace(/[+#!?]+$/, "");
  const ms = legal(p);
  if (tok === "O-O" || tok === "O-O-O") return ms.find((m) => m.c === (tok === "O-O" ? "k" : "q"));
  let promo;
  const eq = tok.indexOf("=");
  if (eq > 0) { promo = tok[eq + 1].toLowerCase(); tok = tok.slice(0, eq); }
  if (!/^[a-h][1-8]$/.test(tok.slice(-2))) return null;
  const dest = ix(tok.slice(-2)), pc = /^[KQRBN]/.test(tok) ? tok[0] : "P";
  const c = ms.filter((m) => m.t === dest && p.b[m.f].toUpperCase() === pc && (m.p || undefined) === promo);
  if (c.length <= 1) return c[0] || null;
  return c.find((m) => san(p, m).replace(/[+#]/g, "") === tok) || null;
}

// ---- the counting pass: next moves by position, three bands ------------------
// Counts start at a gap's parent (its next move only) and follow every game that
// enters a gap's position to COUNT_PLY. Positions are keyFen, so games that
// reach a board by another order inside the subtree merge. A position reached
// only from outside every gap's subtree is not counted: the numbers are floors.
async function counts(rows) {
  const want = rows.map((r) => r.child).sort();
  if (existsSync(COUNTS)) {
    const c = JSON.parse(readFileSync(COUNTS, "utf8"));
    if (want.every((k) => c.children.includes(k))) return c.counts;
  }
  const X = new Set(want), P = new Set(rows.map((r) => r.parent));
  const T = new Map();
  const add = (k, u, b) => { let m = T.get(k); if (!m) T.set(k, m = {}); (m[u] ||= [0, 0, 0])[b]++; };
  let we, be, n = 0;
  const t0 = Date.now();
  const rl = createInterface({ input: zstdStream(DUMP), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.startsWith("[WhiteElo ")) we = +line.split('"')[1];
    else if (line.startsWith("[BlackElo ")) be = +line.split('"')[1];
    else if (line.startsWith("1.")) {
      if (++n % 50000 === 0) console.log(`  ${n} games read (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      if (!(we > 0 && be > 0)) continue;
      const a = (we + be) / 2, b = a <= 1499.5 ? 0 : a <= 1899.5 ? 1 : 2;
      const toks = line.replace(/\{[^}]*\}/g, "").split(/\s+/)
        .filter((t) => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
        .map((t) => t.replace(/^\d+\.+/, ""));
      let p = startPos(), inside = false;
      for (let i = 0; i < Math.min(COUNT_PLY, toks.length); i++) {
        const k = keyFen(p);
        if (!inside && X.has(k)) inside = true;
        if (!inside && i >= 20) break; // the counted trees stop at twenty plies
        const m = sanMove(p, toks[i]);
        if (!m) break;
        if (inside || P.has(k)) add(k, uciOf(m), b);
        p = make(p, m);
      }
      we = be = undefined;
    }
  }
  const out = {};
  for (const [k, m] of T) {
    const e = Object.entries(m).filter(([, c]) => c[0] + c[1] + c[2] >= 3);
    if (e.length) out[k] = Object.fromEntries(e);
  }
  mkdirSync(dirname(COUNTS), { recursive: true });
  writeFileSync(COUNTS, JSON.stringify({ games: n, children: want, counts: out }));
  console.log(`counted ${n} games, ${Object.keys(out).length} positions -> ${COUNTS}`);
  return out;
}
function zstdStream(file) { // multi-frame reader, as tools/count-prefix.mjs
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

// ---- the engine: tools/build-evals.mjs's worker and cache ---------------------
const CACHE = join(root, "data-src/local-eval/sf167-d20");
const cacheFile = (job) => join(CACHE, encodeURIComponent(job) + ".json");
const pool = (() => {
  let workers = null;
  const waiting = new Map();
  const start = () => {
    mkdirSync(CACHE, { recursive: true });
    workers = Array.from({ length: Math.min(availableParallelism(), 10) }, () => {
      const ch = spawn(process.execPath, [join(root, "tools/build-evals.mjs"), "--worker"], { stdio: ["pipe", "pipe", "inherit"] });
      const w = { ch, load: 0 };
      ch.on("exit", (code) => { if (code) { console.error(`engine worker exited ${code}`); process.exit(1); } });
      createInterface({ input: ch.stdout }).on("line", (l) => {
        if (!l.startsWith("{")) return;
        const { job, pvs } = JSON.parse(l);
        writeFileSync(cacheFile(job), JSON.stringify(pvs));
        w.load--;
        for (const r of waiting.get(job) || []) r(pvs);
        waiting.delete(job);
      });
      return w;
    });
  };
  return {
    run(job) {
      if (existsSync(cacheFile(job))) return Promise.resolve(JSON.parse(readFileSync(cacheFile(job), "utf8")));
      if (waiting.has(job)) return new Promise((r) => waiting.get(job).push(r));
      if (!workers) start();
      return new Promise((r) => {
        waiting.set(job, [r]);
        const w = workers.reduce((a, b) => (a.load <= b.load ? a : b));
        w.load++;
        w.ch.stdin.write(job + "\n");
      });
    },
    cached: (job) => existsSync(cacheFile(job)) ? JSON.parse(readFileSync(cacheFile(job), "utf8")) : null,
    close() { if (workers) for (const w of workers) w.ch.stdin.end(); },
  };
})();
const entry = (pos, pv) => [pv.moves[0], san(pos, findMove(pos, pv.moves[0])), pv.cp, pv.mate];

// ---- the learner's system -----------------------------------------------------
function sysMoves(side, pos, prev) {
  const T = side === "w" ? [COLLE_T, ZUK_T] : [HIPPO_T];
  const d4 = ix("d4");
  return legal(pos).filter((m) => T.some((t) => isSetupMove(t, pos, m)) || m.c ||
    (side === "w" && prev && prev.t === d4 && prev.cap && m.t === d4));
}
// The depth-20 row the choice is made on: the position's own top five, plus
// every system move outside them searched alone (the job build-evals runs for a
// drilled move outside the five, so the number is the one that ships).
async function ownChoice(side, pos, prev, cached) {
  const key = keyFen(pos), cands = sysMoves(side, pos, prev);
  if (!cands.length) return { stop: "none", key };
  const run = cached ? (j) => pool.cached(j) : (j) => pool.run(j);
  const top = await run(key);
  if (!top) return { stop: "unsearched", key };
  const row = { d: top[0].depth, m: top.map((pv) => entry(pos, pv)) };
  const cu = cands.map(uciOf);
  let pick = row.m.find((e) => cu.includes(e[0]));
  if (!pick) {
    const alone = await Promise.all(cu.map((u) => run(key + "\t" + u)));
    if (alone.some((a) => !a)) return { stop: "unsearched", key };
    row.x = alone.map((pvs) => entry(pos, pvs[0]));
    pick = [...row.x].sort((a, b) => -cmpScore(a, b))[0];
  }
  const g = gradeRow(row, pos, pick[0]);
  const out = { key, row, pick, grade: g.verdict, loss: g.lossCp };
  if (row.m[0][3] !== null || pick[3] !== null) out.stop = "mate";
  else if (g.verdict !== "best" && g.verdict !== "equal") out.stop = "band";
  return out;
}
function counted(C, key, uci) {
  const at = C[key] || {};
  const M = Object.values(at).reduce((s, c) => s + c[BAND], 0);
  return { n: uci && at[uci] ? at[uci][BAND] : 0, M };
}
async function oppChoice(C, pos) {
  if (!legal(pos).length) return null;
  const key = keyFen(pos), at = C[key] || {};
  const e = Object.entries(at).sort((a, b) => b[1][BAND] - a[1][BAND] ||
    (b[1][0] + b[1][1] + b[1][2]) - (a[1][0] + a[1][1] + a[1][2]) || (a[0] < b[0] ? -1 : 1));
  const M = e.reduce((s, [, c]) => s + c[BAND], 0);
  if (M >= MIN_NODE && e.length) {
    const [u, c] = e[0];
    const tie = e.filter(([u2, c2]) => u2 !== u && c2[BAND] === c[BAND]).map(([u2]) => u2);
    return { uci: u, src: "count", n: c[BAND], M, tie, key };
  }
  const top = await pool.run(key);
  return { uci: top[0].moves[0], src: "table", M, key };
}
const sameSide = (side, key) => REACH[side].get(key) || null;

// ---- one gap -------------------------------------------------------------------
async function explore(g, C) {
  let pos = startPos(), prev = null;
  const path = [];
  for (const tok of g.path) {
    const m = legal(pos).find((x) => san(pos, x) === tok);
    const cap = !!pos.b[m.t] || !!m.ep;
    path.push(uciOf(m)); prev = { t: m.t, cap }; pos = make(pos, m);
  }
  if (keyFen(pos) !== g.child) return { skip: "path", why: "the ranked move order does not reach the counted position" };
  const steps = [];
  let own = 0, stop = null, pending = null;
  for (;;) {
    const c = await ownChoice(g.side, pos, prev);
    if (c.stop) { stop = { kind: c.stop, key: c.key, best: c.row?.m[0], nearest: c.pick, loss: c.loss, after: pending }; break; }
    if (pending) steps.push(pending), pending = null;
    const m = findMove(pos, c.pick[0]);
    const human = counted(C, c.key, c.pick[0]);
    steps.push({ uci: c.pick[0], who: "own", grade: c.grade, loss: c.loss, n: human.n, M: human.M });
    pos = make(pos, m); own++;
    const t1 = sameSide(g.side, keyFen(pos));
    if (t1) { stop = { kind: "transposes", id: t1, after: null }; break; }
    if (own >= MAX_OWN) { stop = { kind: "length" }; break; }
    const o = await oppChoice(C, pos);
    if (!o) { stop = { kind: "end" }; break; }
    const om = findMove(pos, o.uci);
    const cap = !!pos.b[om.t] || !!om.ep;
    const next = make(pos, om);
    const opp = { uci: o.uci, who: "opp", src: o.src, n: o.n, M: o.M, tie: o.tie };
    const t2 = sameSide(g.side, keyFen(next));
    if (t2) { steps.push(opp); stop = { kind: "transposes", id: t2, after: null }; break; }
    pending = opp; prev = { t: om.t, cap }; pos = next;
  }
  if (!own) return { skip: stop.kind, stop };
  return { path, steps, stop };
}

// ---- --plan ----------------------------------------------------------------------
async function plan(n) {
  const doc = existsSync(PLAN) ? JSON.parse(readFileSync(PLAN, "utf8")) : { rules: {}, gaps: [] };
  doc.rules = { band: "1500-1899", minNode: MIN_NODE, maxOwn: MAX_OWN, equal: 30, depth: 20,
    engine: "lila-stockfish-web 0.0.11 sf16-7, tools/build-evals.mjs --worker" };
  const done = new Set(doc.gaps.map((x) => x.id));
  const rows = ranked();
  const C = await counts(rows);
  const todo = rows.filter((r) => !done.has(r.id)).slice(0, n);
  console.log(`${rows.length} gaps in the matrix, ${done.size} already decided, deciding ${todo.length}`);
  const res = await Promise.all(todo.map(async (g) => {
    if (!g.path) return { g, r: { skip: "eco-only" } };
    return { g, r: await explore(g, C) };
  }));
  pool.close();
  // Sequential pass in rank order: a line built earlier in this batch is an
  // existing line for every later one.
  const NEW = new Map(); // side:key -> id
  const reg = (side, id, ucis) => {
    let p = startPos();
    for (const u of ucis) { NEW.set(side + ":" + keyFen(p), id); p = make(p, findMove(p, u)); }
    NEW.set(side + ":" + keyFen(p), id);
  };
  const played = new Map(); // side:parent|uci -> id
  const ids = new Set(LINES.map((l) => l.id).concat(doc.gaps.filter((x) => x.line).map((x) => x.line.id)));
  for (const { g, r } of res) {
    const base = { id: g.id, rank: rows.indexOf(g) + 1, side: g.side, reply: g.san, path: g.path,
      reach: g.reach, pool: g.pool, parentCount: counted(C, g.parent, g.uci) };
    if (r.skip) { doc.gaps.push({ ...base, skip: r.skip, stop: r.stop ? slimStop(r.stop) : undefined }); continue; }
    const by = played.get(g.side + ":" + g.id) || NEW.get(g.side + ":" + g.child);
    if (by) { doc.gaps.push({ ...base, skip: "new-line", by }); continue; }
    // truncate at the first position an earlier line of this batch reaches
    let p = startPos();
    for (const u of r.path) p = make(p, findMove(p, u));
    for (let i = 0; i < r.steps.length; i++) {
      p = make(p, findMove(p, r.steps[i].uci));
      const hit = NEW.get(g.side + ":" + keyFen(p));
      if (hit) { r.steps = r.steps.slice(0, i + 1); r.stop = { kind: "transposes", id: hit, after: null }; break; }
    }
    let id = (g.side === "w" ? "gc-" : "gh-") + g.path.slice(g.side === "w" ? 1 : 0)
      .map((s) => s.replace(/[^A-Za-z0-9]/g, "")).join("").toLowerCase();
    while (ids.has(id)) id += "x";
    ids.add(id);
    const ucis = r.path.concat(r.steps.map((s) => s.uci));
    reg(g.side, id, ucis);
    { let q = startPos(); for (const u of ucis) { played.set(g.side + ":" + keyFen(q) + "|" + u, id); q = make(q, findMove(q, u)); } }
    doc.gaps.push({ ...base, line: { id, moves: ucis, steps: r.steps, stop: slimStop(r.stop) } });
  }
  writeFileSync(PLAN, JSON.stringify(doc, null, 1) + "\n");
  const t = tally(doc.gaps.slice(-todo.length));
  console.log(`decided ${todo.length}: ${JSON.stringify(t)} -> research/gap-lines.json`);
}
function slimStop(s) {
  const o = { kind: s.kind };
  if (s.id) o.id = s.id;
  if (s.key) o.key = s.key;
  if (s.nearest) o.nearest = s.nearest[0];
  if (s.after) o.after = { uci: s.after.uci, src: s.after.src, n: s.after.n, M: s.after.M, tie: s.after.tie };
  return o;
}
function tally(gs) {
  const t = { built: 0 };
  for (const x of gs) {
    if (x.line) { t.built++; const k = "stop:" + x.line.stop.kind; t[k] = (t[k] || 0) + 1; }
    else { const k = "skip:" + x.skip; t[k] = (t[k] || 0) + 1; }
  }
  return t;
}

// ---- --write: prose from the shipped table ----------------------------------------
const disp = (pos, s) => (pos.w ? "" : "...") + s;
const cpTxt = (e) => String(e[2]);
function moveText(ucis, from = 0, to = ucis.length) {
  let p = startPos(), out = [];
  ucis.forEach((u, i) => {
    const m = findMove(p, u), s = san(p, m);
    if (i >= from && i < to) out.push(i % 2 === 0 ? `${i / 2 + 1}.${s}` : (i === from ? `${(i + 1) / 2}...${s}` : s));
    p = make(p, m);
  });
  return out.join(" ");
}
const games = (n, M) => `${n.toLocaleString("en-GB")} of ${M.toLocaleString("en-GB")}`;
function shippedRow(pos, key, extraUci) {
  // The shipped row when there is one; otherwise the same searches from the
  // cache (a first --write, before build-evals has run). Returns {row, shipped}.
  const r = EVL[key];
  if (r) return { row: r, shipped: true };
  const top = pool.cached(key);
  if (!top) return { row: null, shipped: false };
  const row = { d: top[0].depth, m: top.map((pv) => entry(pos, pv)) };
  for (const u of extraUci || []) {
    if (row.m.some((e) => e[0] === u)) continue;
    const a = pool.cached(key + "\t" + u);
    if (a) (row.x ||= []).push(entry(pos, a[0]));
  }
  return { row, shipped: false };
}
const scoreOf = (row, u) => row && [...row.m, ...(row.x || [])].find((e) => e[0] === u);
function write() {
  const doc = JSON.parse(readFileSync(PLAN, "utf8"));
  const lines = [], extras = [], alone = [], problems = [];
  let unshipped = 0;
  const grades = { best: 0, equal: 0 };
  for (const gp of doc.gaps.filter((x) => x.line)) {
    const L = gp.line, side = gp.side, nPath = gp.path.length;
    let p = startPos();
    const rows = [];
    const notes = [];
    let lastOwn = null, firstOwn = null;
    L.moves.forEach((u, i) => {
      const m = findMove(p, u), s = san(p, m), key = keyFen(p);
      const label = i % 2 === 0 ? `${i / 2 + 1}.${s}` : `${(i + 1) / 2}...${s}`; // unique per ply
      let note = "";
      if (i === nPath - 1) {
        const pc = gp.parentCount;
        note = pc.M >= MIN_NODE && pc.n > 0 // a reply no band game chose is cited from the pool
          ? `${games(pc.n, pc.M)} counted games at this position in the 1500 to 1899 band.`
          : `${games(gp.pool.games, gp.pool.parent)} games at this position in the player pool (average rating 1500 and over).`;
      } else if (i >= nPath) {
        const st = L.steps[i - nPath];
        if (st.who === "own") {
          const { row, shipped } = shippedRow(p, key, [u]);
          if (!shipped) unshipped++;
          const e = scoreOf(row, u);
          if (!e) { problems.push(`${L.id} ply ${i}: no score for ${s}`); }
          else {
            const g = gradeRow(row, p, u);
            if (g.verdict !== "best" && g.verdict !== "equal") problems.push(`${L.id} ply ${i}: ${s} grades ${g.verdict}`);
            else grades[g.verdict]++;
            note = row.m[0][0] === u ? `${label} is the table's first choice, at ${cpTxt(e)}.`
              : g.lossCp === 0 ? `${cpTxt(e)}, level with ${disp(p, row.m[0][1])} at the top of the table.`
              : `${cpTxt(e)}, ${g.lossCp} behind ${disp(p, row.m[0][1])}: inside the band.`;
          }
          if (st.M >= MIN_NODE) note += st.n ? ` ${games(st.n, st.M)} counted games in the band chose it.`
            : ` None of the ${st.M.toLocaleString("en-GB")} counted games in the band chose it.`;
          if (!firstOwn) firstOwn = disp(p, s);
          lastOwn = { i, s: disp(p, s) };
        } else if (st.src === "count") {
          note = `${games(st.n, st.M)} counted games in the band, ` +
            (st.tie && st.tie.length ? `as many as ${st.tie.map((t) => disp(p, san(p, findMove(p, t)))).join(" and ")}.` : "the commonest reply.");
        } else {
          extras.push(key);
          note = `${label} is the table's first choice for ${OPP[side]}. ` + (st.M ? `Only ${st.M} counted game${st.M > 1 ? "s" : ""} in the band continue from here.` : "No counted game in the band continues from here.");
        }
      }
      rows.push([u, s, note]);
      p = make(p, m);
    });
    // the stop, stated from stored numbers
    const st = L.stop;
    let stopTxt = "";
    if (st.kind === "transposes") stopTxt = `The line ends where the board is one \`${st.id}\` reaches.`;
    else if (st.kind === "length") stopTxt = `The line stops after ${MAX_OWN} moves of its own.`;
    else if (st.kind === "end") stopTxt = "The game is over.";
    else {
      let q = p, why = "";
      if (st.after) {
        const om = findMove(p, st.after.uci);
        const oSan = disp(p, san(p, om));
        if (st.after.src === "table") { extras.push(keyFen(p)); why = `${oSan}, the table's first choice for ${OPP[side]}`; }
        else why = `${oSan}, the commonest reply (${games(st.after.n, st.after.M)} counted games in the band)`;
        q = make(p, om);
      }
      const k = keyFen(q);
      if (st.kind === "none") stopTxt = `After ${why}, no move puts a piece on a ${SYS[side]} square, so the line stops.`;
      else {
        extras.push(k);
        const { row, shipped } = shippedRow(q, k, st.nearest ? [st.nearest] : []);
        if (!shipped) unshipped++;
        if (st.nearest && row && !row.m.some((e) => e[0] === st.nearest)) alone.push([k, st.nearest]);
        const e = scoreOf(row, st.nearest);
        if (!row || !e) problems.push(`${L.id}: stop position not scored yet`);
        else if (st.kind === "mate") stopTxt = `After ${why}, the table's first choice is a forced mate, so the line stops.`;
        else {
          const g = gradeRow(row, q, st.nearest);
          const nm = disp(q, e[1]);
          stopTxt = `After ${why}, the nearest ${SYS[side]} move, ${nm}, is ${g.lossCp} behind ${disp(q, row.m[0][1])}, outside the band, so the line stops.`;
          if (g.verdict === "best" || g.verdict === "equal") problems.push(`${L.id}: stop move ${nm} grades ${g.verdict} in the shipped row`);
        }
      }
    }
    const replyTxt = moveText(L.moves, 0, nPath);
    const plan = `Built from the stored analysis and the counted games, not from a book. ` +
      `Every ${SYS[side]} move is the best-scoring ${SYS[side]} move the depth-20 table puts inside its 30-centipawn band; ` +
      `every ${OPP[side]} move is the commonest in the 1500 to 1899 band, or the table's first choice where fewer than ${MIN_NODE} counted games continue. ` +
      stopTxt;
    lines.push({ id: L.id, ch: CH[side], you: side, name: `${replyTxt}: ${firstOwn}`, plan, rows });
  }
  // lines.js: replace the generated block and the generated KIND entries
  const lf = join(root, "src/data/lines.js");
  let src = readFileSync(lf, "utf8");
  const B = "\n// gen-gap-lines: begin\n", E = "// gen-gap-lines: end\n";
  const s0 = src.indexOf("\n]}," + B);
  if (s0 >= 0) src = src.slice(0, s0) + "\n]}\n" + src.slice(src.indexOf(E) + E.length);
  src = src.replace(/"g[ch]-[^"]+":"synthetic",/g, "");
  const q = JSON.stringify;
  const block = lines.map((l) => `{id:${q(l.id)}, ch:${q(l.ch)}, you:${q(l.you)}, name:${q(l.name)}, ` +
    `src:"generated from the stored analysis", plan:${q(l.plan)}, start:START, targets:[], moves:[\n ` +
    l.rows.map((r) => `[${q(r[0])},${q(r[1])},${q(r[2])}]`).join(",") + "\n]}").join(",\n");
  const end = src.indexOf("\n]}\n];");
  if (end < 0) throw new Error("lines.js: cannot find the end of LINES");
  if (lines.length) src = src.slice(0, end) + "\n]}," + B + block + "\n" + E + "];" + src.slice(end + "\n]}\n];".length);
  const kk = "const KIND={";
  src = src.replace(kk, kk + lines.map((l) => `${q(l.id)}:"synthetic",`).join(""));
  const before = readFileSync(lf, "utf8");
  writeFileSync(lf, src);
  // the positions the prose cites
  const ex = [...new Set(extras)];
  sectionReplace(join(root, "research/pilot-positions.txt"), "# Generated by tools/gen-gap-lines.mjs", null,
    ["# Generated by tools/gen-gap-lines.mjs (research/W6-content-batch.md, section 10): the",
      "# positions the generated lines' notes and plans cite that no line drills (the",
      "# opponent's move chosen by the table, and the board where a line stops).", ...ex]);
  const al = new Map();
  for (const [k, u] of alone) al.set(k, [...new Set([...(al.get(k) || []), u])]);
  sectionReplace(join(root, "research/named-moves.tsv"), "# Generated by tools/gen-gap-lines.mjs", "# Counted player choices",
    ["# Generated by tools/gen-gap-lines.mjs (research/W6-content-batch.md, section 10): the",
      "# nearest system move where a generated line stops, when the top five leave it",
      "# out. Each searched alone, so the stop is stated from a stored number.",
      ...[...al].map(([k, us]) => `${k}\t${us.join(" ")}\talone`), ""]);
  // report
  const all = doc.gaps, t = tally(all);
  console.log(`lines.js: ${lines.length} generated lines ${before === src ? "(notes unchanged)" : "(rewritten)"}`);
  console.log(`decided ${all.length} gaps: ${JSON.stringify(t)}`);
  console.log(`generated learner moves: best ${grades.best}, equal ${grades.equal}; ${unshipped} numbers not yet in the shipped table`);
  console.log(`cited positions: ${ex.length} extra, ${alone.length} moves alone`);
  for (const x of problems) console.log("PROBLEM " + x);
  if (problems.length) process.exitCode = 1;
}
function sectionReplace(file, marker, beforeMarker, body) {
  let s = readFileSync(file, "utf8");
  const i = s.indexOf(marker);
  if (i >= 0) {
    const j = beforeMarker ? s.indexOf(beforeMarker, i) : s.length;
    s = s.slice(0, i) + s.slice(j);
  }
  const text = body.join("\n") + "\n";
  if (beforeMarker) { const j = s.indexOf(beforeMarker); s = s.slice(0, j) + text + (text.endsWith("\n\n") ? "" : "\n") + s.slice(j); }
  else s = s.replace(/\n*$/, "\n\n") + text;
  writeFileSync(file, s);
}

// ---- main ------------------------------------------------------------------------
if (arg("plan") !== null) await plan(+arg("plan") || 50);
else if (arg("write") !== null) { write(); pool.close(); }
else if (arg("rank") !== null) {
  const rows = ranked();
  const pc = (x) => (x === undefined ? "—" : (x * 100).toFixed(2) + "%");
  rows.forEach((r, i) => console.log(`${i + 1}\t${r.side}\t${r.path ? r.path.join(" ") : "(" + r.san + ")"}\t${pc(r.reach["1500-1899"])}\t${pc(r.reach.u1500)}\t${pc(r.reach["1900"])}\t${pc(r.reach.pool)}`));
} else console.log("usage: node tools/gen-gap-lines.mjs --rank | --plan <n> | --write");
