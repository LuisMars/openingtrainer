#!/usr/bin/env node
// Deeper re-search of the drilled positions where the trainer teaches a narrow
// decision, to check that the depth-20 table's gap still separates the answer
// from the alternatives before anything calls it the only move.
//
//   node tools/deep-check.mjs [--depth 28]   -> research/deep-checks.tsv
//                                               src/data/deep.js (shipped)
//
// Same engine, same settings as tools/build-evals.mjs (it spawns that file's
// --worker mode with SF_DEPTH set): sf16-7 from lila-stockfish-web, small NNUE
// net, one thread, 64 MB hash cleared with ucinewgame per position, MultiPV 5,
// fixed depth. Reproducible for the same reasons the shipped table is. Raw
// output is cached in data-src/local-eval/sf167-d<depth>/ with the same file
// naming, so an interrupted run resumes. The depth-20 side of every comparison
// is the shipped src/data/evals.js, read as-is: this tool never writes it.
//
// Selection, per unique drilled position (keyFen, as build-evals collects them):
//   narrow     only one move within GRADE.equal of the best (waysAt() === 1 in
//              src/app.js): the grader accepts exactly one answer here
//   demanding  a line with setup targets, and no move tied with the row's best
//              is a formation move (setupGate reason "demanding")
//   tactical   the row's best is a mate, a capture or a check
// Verdicts per position:
//   only_move  holds when the deep search keeps one accepted move and it is the
//              same move the depth-20 row accepts; fails otherwise (n/a unless narrow)
//   demanding  holds when the deep best, and anything tied with it, is still not
//              a formation move (n/a unless demanding)
//   drilled verdicts: gradeRow() on the depth-20 row and on the deep row, so a
//              repertoire move whose grade changes with depth is visible
// The deep rows themselves ship as src/data/deep.js (DEEP, same row shape as EVL
// minus pv), which src/engine.js reads so that at a deep-checked position a move
// either depth accepts is accepted; see gradeMove there.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { createInterface } from "node:readline";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const DEPTH = +arg("--depth", 28);
if (!Number.isInteger(DEPTH) || DEPTH <= 20) throw new Error("--depth must be an integer above 20");
const ENGINE_TAG = "sf167";
const NNUE_SHA256 = "ecb35f70ff2aa4492caec6b552a1628e24319fbe1cc2aaf95eaebabdd92a1e37";
const OUT = join(root, "research/deep-checks.tsv");
const OUT_JS = join(root, "src/data/deep.js");

// --- repo engine, lines and the shipped depth-20 table -----------------------
const ctx = {};
const src = ["src/core.js", "src/data/lines.js", "src/engine.js", "src/data/evals.js"]
  .map((f) => readFileSync(join(root, f), "utf8")).join("\n");
new Function("ctx", src + "\nObject.assign(ctx,{LINES,START,startPos,fenPos,findMove,make,san,legal," +
  "posKey,EVL,GRADE,gradeRow,isSetupMove,cmpScore});")(ctx);
const { LINES, START, startPos, fenPos, findMove, make, san, posKey, EVL, GRADE,
  gradeRow, isSetupMove, cmpScore } = ctx;

// --- drilled positions (same walk as build-evals: plies where `you` moves) ---
const P = new Map(); // key -> {pos, drill:Set(uci), lines:[], targets:[targets…]}
for (const l of LINES) {
  let p = l.start === START ? startPos() : fenPos(l.start.indexOf(" ") > 0 ? l.start : l.start + " w - -");
  for (let i = 0; i < l.moves.length; i++) {
    const u = l.moves[i][0];
    if ((i % 2 === 0 ? "w" : "b") === l.you) {
      const k = posKey(p);
      const e = P.get(k) || { pos: p, drill: new Set(), lines: [], targets: [] };
      e.drill.add(u); e.lines.push(l.id + ":" + i);
      if (l.targets && l.targets.length) e.targets.push(l.targets);
      P.set(k, e);
    }
    const m = findMove(p, u); if (!m) break; p = make(p, m);
  }
}

// waysAt() from src/app.js, verbatim in logic: moves inside GRADE.equal of a
// centipawn best, or mating exactly as fast as a mating best.
const ways = (m) => {
  const b = m[0]; let n = 0;
  for (const e of m) {
    if (b[3] != null) { if (e[3] === b[3]) n++; }
    else if (e[3] == null && e[2] != null && b[2] - e[2] <= GRADE.equal) n++;
  }
  return n;
};
// The formation half of setupGate: does anything tied with the best build?
const demandingRow = (m, pos, targetsList) => {
  const top = m.filter((e) => cmpScore(e, m[0]) === 0).map((e) => findMove(pos, e[0]));
  return targetsList.some((t) => !top.some((bm) => bm && isSetupMove(t, pos, bm)));
};

const sel = [];
for (const [k, e] of P) {
  const row = EVL[k];
  if (!row) throw new Error("drilled position missing from src/data/evals.js: " + k);
  const b = row.m[0];
  const f = {
    narrow: ways(row.m) === 1,
    demanding: e.targets.length > 0 && demandingRow(row.m, e.pos, e.targets),
    tactical: b[3] != null || /[x+#]/.test(b[1]),
  };
  if (f.narrow || f.demanding || f.tactical) sel.push({ k, e, row, f });
}
console.log(`${P.size} drilled positions; ${sel.length} selected ` +
  `(narrow ${sel.filter((s) => s.f.narrow).length}, demanding ${sel.filter((s) => s.f.demanding).length}, ` +
  `tactical ${sel.filter((s) => s.f.tactical).length}); depth ${DEPTH}`);

// --- sign probe at the deep depth (Damiano: Black to move and lost) -----------
let probe = startPos();
for (const t of ["e4", "e5", "Nf3", "f6", "Nxe5", "fxe5", "Qh5+"]) {
  const m = ctx.legal(probe).find((x) => san(probe, x) === t); probe = make(probe, m);
}
const PROBE = posKey(probe);

// --- run jobs through build-evals workers at SF_DEPTH -------------------------
const nnue = readFileSync(join(root, "data-src/nnue/nn-ecb35f70ff2a.nnue"));
if (createHash("sha256").update(nnue).digest("hex") !== NNUE_SHA256) throw new Error("NNUE checksum mismatch");
const cacheDir = join(root, "data-src/local-eval", `${ENGINE_TAG}-d${DEPTH}`);
mkdirSync(cacheDir, { recursive: true });
const cacheFile = (j) => join(cacheDir, encodeURIComponent(j) + ".json");
const results = new Map();
async function runJobs(jobs, label) {
  const todo = [];
  for (const j of jobs) {
    if (results.has(j)) continue;
    if (existsSync(cacheFile(j))) results.set(j, JSON.parse(readFileSync(cacheFile(j), "utf8")));
    else { results.set(j, null); todo.push(j); }
  }
  console.log(`${label}: ${jobs.length} jobs, ${todo.length} not yet cached`);
  if (!todo.length) return;
  const nW = Math.min(Math.max(1, availableParallelism() - 2), 10, todo.length);
  const worker = join(root, "tools/build-evals.mjs");
  let done = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: nW }, (_, w) => new Promise((resolve, reject) => {
    const shard = todo.filter((_, i) => i % nW === w);
    const child = spawn(process.execPath, [worker, "--worker"],
      { stdio: ["pipe", "pipe", "inherit"], env: { ...process.env, SF_DEPTH: String(DEPTH) } });
    child.on("error", reject);
    child.on("exit", (c) => c === 0 ? resolve() : reject(new Error(`worker ${w} exited ${c}`)));
    createInterface({ input: child.stdout }).on("line", (l) => {
      if (!l.startsWith("{")) return;
      const { job, pvs } = JSON.parse(l);
      results.set(job, pvs); writeFileSync(cacheFile(job), JSON.stringify(pvs));
      console.log(`  ${++done}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    });
    child.stdin.write(shard.join("\n") + "\n"); child.stdin.end();
  })));
}
await runJobs([PROBE, ...sel.map((s) => s.k)], "positions");
{
  const d = results.get(PROBE)[0];
  if (!(d.mate !== null ? d.mate < 0 : d.cp <= -200))
    throw new Error(`sign probe at depth ${DEPTH} scored cp:${d.cp} mate:${d.mate}; refusing to write`);
}
// Drilled moves the deep top five does not list get a number of their own.
const extra = new Map();
for (const s of sel) {
  const top = new Set(results.get(s.k).map((pv) => pv.moves[0]));
  const miss = [...s.e.drill].filter((u) => !top.has(u));
  if (miss.length) extra.set(s.k, s.k + "\t" + miss.join(" "));
}
await runJobs([...extra.values()], "drilled moves outside the deep top five");

// --- compare ------------------------------------------------------------------
const toRow = (k, pvs) => {
  const pos = fenPos(k);
  return pvs.map((pv) => {
    const m = findMove(pos, pv.moves[0]);
    if (!m) throw new Error(`engine move ${pv.moves[0]} illegal in ${k}`);
    return [pv.moves[0], san(pos, m), pv.cp, pv.mate];
  });
};
const sc = (e) => e ? (e[3] != null ? "#" + e[3] : String(e[2])) : "";
const gap = (m) => m.length < 2 ? "" : (m[0][3] != null || m[1][3] != null
  ? (cmpScore(m[0], m[1]) === 0 ? "0" : "mate") : String(m[0][2] - m[1][2]));
const cols = ["key", "lines", "flags", "d20_best", "d20_second", "d20_gap", "d20_ways",
  `d${DEPTH}_best`, `d${DEPTH}_second`, `d${DEPTH}_gap`, `d${DEPTH}_ways`, "only_move", "demanding",
  "drilled", "drilled_d20", `drilled_d${DEPTH}`, "reached_depth"];
const rows = [];
const DEEP = {};
const tally = { onlyHold: 0, onlyFail: 0, demHold: 0, demFail: 0, drillChanged: 0 };
for (const s of sel) {
  const pvs = results.get(s.k);
  const deep = { d: pvs[0].depth, m: toRow(s.k, pvs) };
  if (extra.has(s.k)) deep.x = toRow(s.k, results.get(extra.get(s.k)));
  const pos = fenPos(s.k);
  const w20 = ways(s.row.m), wD = ways(deep.m);
  let only = "n/a";
  if (s.f.narrow) {
    only = wD === 1 && deep.m[0][0] === s.row.m[0][0] ? "holds" : "fails";
    tally[only === "holds" ? "onlyHold" : "onlyFail"]++;
  }
  let dem = "n/a";
  if (s.f.demanding) {
    dem = demandingRow(deep.m, pos, s.e.targets) ? "holds" : "fails";
    tally[dem === "holds" ? "demHold" : "demFail"]++;
  }
  const dr = [...s.e.drill];
  DEEP[s.k] = deep;
  const v20 = dr.map((u) => gradeRow(s.row, pos, u).verdict);
  const vD = dr.map((u) => gradeRow(deep, pos, u).verdict);
  const acc = (v) => GRADE.accept.includes(v);
  if (dr.some((_, i) => acc(v20[i]) !== acc(vD[i]))) tally.drillChanged++;
  const f = Object.keys(s.f).filter((x) => s.f[x]).join(",");
  const pair = (e) => e ? `${e[1]} ${sc(e)}` : "";
  rows.push([s.k, s.e.lines.slice(0, 3).join(" ") + (s.e.lines.length > 3 ? " …" : ""), f,
    pair(s.row.m[0]), pair(s.row.m[1]), gap(s.row.m), w20,
    pair(deep.m[0]), pair(deep.m[1]), gap(deep.m), wD, only, dem,
    dr.map((u) => san(pos, findMove(pos, u))).join(" "), v20.join(" "), vD.join(" "), deep.d]);
}
const pkg = JSON.parse(readFileSync(join(root, "node_modules/lila-stockfish-web/package.json"), "utf8"));
const meta = [
  `# Generated by tools/deep-check.mjs - do not edit.`,
  `# engine: lila-stockfish-web ${pkg.version} sf16-7 (Stockfish 16, small NNUE net nn-ecb35f70ff2a, sha256 ${NNUE_SHA256})`,
  `# settings: Threads 1, Hash 64 MB, ucinewgame before each position, MultiPV 5, go depth ${DEPTH}; drilled moves outside the top five searched with searchmoves`,
  `# baseline: src/data/evals.js (depth 20, same engine and settings); scores side-to-move centipawns, #n = mate in n`,
  `# selection: ${sel.length} of ${P.size} drilled positions (narrow = one move within ${GRADE.equal} cp of best; demanding = setupGate "demanding"; tactical = best is mate, capture or check)`,
  `# only_move: narrow claim ${tally.onlyHold} hold, ${tally.onlyFail} fail; demanding: ${tally.demHold} hold, ${tally.demFail} fail; drilled-move accept/reject changed at depth: ${tally.drillChanged}`,
];
writeFileSync(OUT, meta.join("\n") + "\n" + cols.join("\t") + "\n" + rows.map((r) => r.join("\t")).join("\n") + "\n");
console.log(meta.slice(-1)[0].slice(2));
console.log("wrote " + OUT);
writeFileSync(OUT_JS,
  "// Generated by tools/deep-check.mjs - do not edit. A second, deeper search of\n" +
  `// ${sel.length} of the ${P.size} drilled positions: the ones where the depth-20 table\n` +
  "// (src/data/evals.js) teaches a narrow decision - one accepted move, a setupGate\n" +
  "// \"demanding\" refusal, or a best move that is a mate, capture or check.\n" +
  `// ENGINE: lila-stockfish-web ${pkg.version} sf16-7 (Stockfish 16, small NNUE net\n` +
  "// nn-ecb35f70ff2a), the same build and settings as evals.js: Threads 1, Hash 64 MB,\n" +
  `// ucinewgame before each position, MultiPV 5, fixed depth ${DEPTH}.\n` +
  "// KEYS: posKey(pos), the same strings as EVL, and every key here is also in EVL.\n" +
  "// SHAPE: DEEP[key]={d:depth,m:[[uci,san,cp,mate],...up to 5, best first]} with an\n" +
  "// optional x of drilled moves outside the five, searched alone - exactly EVL's\n" +
  "// row shape without pv. SIGN: side-to-move relative, as in EVL; mates are mates.\n" +
  "// USE: never on its own. gradeMove takes the more generous of the two depths'\n" +
  "// verdicts, setupGate calls a position demanding only when both depths do, and\n" +
  "// waysAt counts a move accepted at either depth.\n" +
  "const DEEP=" + JSON.stringify(DEEP) + ";\n");
console.log("wrote " + OUT_JS);
