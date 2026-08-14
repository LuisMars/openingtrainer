#!/usr/bin/env node
// Regenerates src/data/evals.js: Stockfish evaluations for every position the
// trainer asks the user to move in, computed at build time by a local engine so
// the shipped page needs no engine and no network.
//
// Engine: sf16-7 from the `lila-stockfish-web` npm devDependency — lichess's
// own in-browser build of Stockfish 16 (linrock's small-net branch), a 433 KB
// wasm plus one 6.5 MB NNUE network that tools/fetch-assets.sh downloads into
// data-src/nnue/ with its checksum verified. The build targets browsers, so
// driving it headless needs three shims: the `web-worker` package for the
// pthread Workers it spawns, tools/sf-worker-boot.mjs to give those workers
// the self.location global they read, and a fetch() that serves file:// URLs
// for the wasm. Nothing from any of this ships in the page. Analysis is
// single-threaded per position with the hash cleared first, at a fixed depth,
// so a re-run with the same package version, the same network file and the
// same DEPTH reproduces the same table. Parallelism comes from sharding
// positions across worker processes, which does not affect the result. Raw
// engine output is cached under data-src/local-eval/ (gitignored) keyed by
// engine+depth, so an interrupted run resumes for free.
//
// The previous source was the lichess cloud-eval API; its 100 raw responses
// remain in data-src/cloud-eval/ (gitignored) as a cross-check. tools/ has no
// fetch step for evals any more.
//
// Sign convention: UCI scores are from the SIDE TO MOVE's point of view
// (positive = good for the player to move) and are stored as-is. The
// convention is not taken on trust: three probe positions with undisputed
// assessments are analysed first and the run aborts on any disagreement.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { createInterface } from "node:readline";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEPTH = 20;      // fixed search depth; part of the reproducibility contract
const ENGINE_TAG = "sf167"; // lila-stockfish-web sf16-7: Stockfish 16, small NNUE net
const MULTIPV = 5;
const NNUE = join(root, "data-src/nnue/nn-ecb35f70ff2a.nnue");
const NNUE_SHA256 = "ecb35f70ff2aa4492caec6b552a1628e24319fbe1cc2aaf95eaebabdd92a1e37";

// --- headless engine driver ---------------------------------------------------
async function startEngine() {
  if (!existsSync(NNUE))
    throw new Error(`NNUE network missing: ${NNUE}\nrun tools/fetch-assets.sh first`);
  const net = readFileSync(NNUE);
  if (createHash("sha256").update(net).digest("hex") !== NNUE_SHA256)
    throw new Error(`NNUE network fails its checksum: ${NNUE}\nre-run tools/fetch-assets.sh`);
  // Browser shims: the web build spawns pthread Workers pointed at its own
  // module and loads its wasm over fetch(); reroute both to Node equivalents.
  const { default: WebWorker } = await import("web-worker");
  const bootUrl = pathToFileURL(join(root, "tools/sf-worker-boot.mjs"));
  globalThis.Worker = class extends WebWorker {
    constructor(url, opts) { super(String(url).endsWith("sf16-7.js") ? bootUrl : url, opts); }
  };
  if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url instanceof Request ? url.url : url);
    if (u.startsWith("file://")) {
      return new Response(readFileSync(fileURLToPath(u)), {
        headers: { "content-type": u.endsWith(".wasm") ? "application/wasm" : "application/octet-stream" },
      });
    }
    return realFetch(url, opts);
  };
  const { default: Sf167Web } = await import("lila-stockfish-web/sf16-7.js");
  const engine = await Sf167Web();
  engine.onError = (e) => { console.error("engine error:", e); process.exit(1); };
  let handler = null;
  engine.listen = (l) => handler && handler(String(l));
  const send = (c) => engine.uci(c);
  const until = (pred) => new Promise((res) => {
    handler = (l) => { const r = pred(l); if (r !== undefined) { handler = null; res(r); } };
  });
  send("uci"); await until((l) => l === "uciok" ? true : undefined);
  engine.setNnueBuffer(new Uint8Array(net));
  send("setoption name Use NNUE value true"); // the build defaults to classical eval
  send("setoption name Threads value 1"); // determinism: never search multi-threaded
  send("setoption name Hash value 64");
  send("setoption name MultiPV value " + MULTIPV);
  async function analyse(fen) {
    send("ucinewgame");
    send("isready"); await until((l) => l === "readyok" ? true : undefined);
    send("position fen " + fen);
    const pvs = {};
    send("go depth " + DEPTH);
    await until((l) => {
      if (l.startsWith("info ") && l.includes(" multipv ") && l.includes(" pv ") &&
          !l.includes("lowerbound") && !l.includes("upperbound")) {
        const mp = +l.match(/ multipv (\d+)/)[1];
        const mate = l.match(/ score mate (-?\d+)/), cp = l.match(/ score cp (-?\d+)/);
        pvs[mp] = { depth: +l.match(/^info depth (\d+)/)[1],
          cp: cp ? +cp[1] : null, mate: mate ? +mate[1] : null,
          moves: l.split(" pv ")[1].split(" ") };
      }
      if (l.startsWith("bestmove")) return true;
    });
    const out = [];
    for (let i = 1; i <= MULTIPV && pvs[i]; i++) out.push(pvs[i]);
    if (!out.length) throw new Error("engine returned no pv for " + fen);
    return out; // stm-relative, best first
  }
  return { analyse };
}

// --- worker mode: analyse fens fed on stdin, one JSON line out per fen --------
if (process.argv[2] === "--worker") {
  const eng = await startEngine();
  const rl = createInterface({ input: process.stdin });
  const queue = []; let closed = false, running = false;
  const pump = async () => {
    if (running) return; running = true;
    while (queue.length) {
      const fen = queue.shift();
      process.stdout.write(JSON.stringify({ fen, pvs: await eng.analyse(fen) }) + "\n");
    }
    running = false;
    if (closed) process.exit(0);
  };
  rl.on("line", (l) => { if (l.trim()) { queue.push(l.trim()); pump(); } });
  rl.on("close", () => { closed = true; if (!running && !queue.length) process.exit(0); });
  await new Promise(() => {}); // stay alive for stdin
}

// --- load the repo engine (SAN, legality) ------------------------------------
const ctx = {};
const core = readFileSync(join(root, "src/core.js"), "utf8");
const lines = readFileSync(join(root, "src/data/lines.js"), "utf8");
const engineSrc = readFileSync(join(root, "src/engine.js"), "utf8");
new Function("ctx", core + lines + engineSrc +
  "\nObject.assign(ctx,{LINES,START,startPos,fenPos,findMove,make,san,legal,fenOf});")(ctx);
const { LINES, START, startPos, fenPos, findMove, make, san, legal, fenOf } = ctx;

// --- replicas of src/app.js position identity (keep in sync by hand) --------
// drillPlies: the plies where the trained side is to move. All lines start
// from the initial position, so even plies are White's.
const drillPlies = (l) => {
  const a = [];
  for (let p = 0; p < l.moves.length; p++) if ((p % 2 === 0 ? "w" : "b") === l.you) a.push(p);
  return a;
};
const posAt = (l, n) => {
  let p = l.start === START ? startPos() : fenPos(l.start.indexOf(" ") > 0 ? l.start : l.start + " w - -");
  for (let i = 0; i < n; i++) { const m = findMove(p, l.moves[i][0]); if (!m) break; p = make(p, m); }
  return p;
};
// keyFen: fenOf, with a phantom ep square blanked unless an en-passant capture
// is actually legal — the same fold src/app.js applies before keying stats.
const keyFen = (pos) => {
  if (pos.ep < 0) return fenOf(pos);
  return legal(pos).some((m) => m.ep) ? fenOf(pos) : fenOf({ b: pos.b, w: pos.w, cr: pos.cr, ep: -1 });
};

// --- collect the unique positions -------------------------------------------
const wanted = new Map(); // keyFen -> one example {lineId, ply}
let transposition = null; // proof that keyFen folds transpositions
for (const l of LINES) for (const p of drillPlies(l)) {
  const f = keyFen(posAt(l, p));
  const seen = wanted.get(f);
  if (!seen) wanted.set(f, { line: l.id, ply: p });
  else if (!transposition && seen.line !== l.id &&
    LINES.find((x) => x.id === seen.line).moves.slice(0, seen.ply).map((m) => m[0]).join() !==
    l.moves.slice(0, p).map((m) => m[0]).join())
    transposition = { a: seen, b: { line: l.id, ply: p }, fen: f };
}
console.log(`${wanted.size} unique trained positions across ${LINES.length} lines`);
// The table is keyed by keyFen precisely so that lines transposing into the same
// position by different move orders share one row. Prove that at least one such
// pair exists and folds to the same key, or the normalisation is broken.
if (!transposition)
  throw new Error("no transposition folded to a shared key; keyFen normalisation looks broken");
console.log(`transposition check: ${transposition.a.line}:${transposition.a.ply} and ` +
  `${transposition.b.line}:${transposition.b.ply} reach the same key by different move orders`);

// --- probe positions: verify the sign convention -----------------------------
// Three positions whose assessment is not in doubt, each reached by replaying
// SAN through the shipped engine (never a hand-written FEN):
//   damiano    1.e4 e5 2.Nf3 f6 3.Nxe5 fxe5 4.Qh5+ — BLACK to move, White is
//              winning by force. Under stm the stored score must be decisively
//              NEGATIVE (the mover is lost).
//   scholars   1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? — WHITE to move, mate in 1 (Qxf7#):
//              stm score must be mate +1.
//   shilling   Blackburne–Shilling trap after 7.Be2 — BLACK to move, mate in 1
//              (...Nf3#): stm score must be mate +1.
function replay(sans) {
  let p = startPos();
  for (const tok of sans) {
    const m = legal(p).find((x) => san(p, x) === tok);
    if (!m) throw new Error("probe replay failed at " + tok);
    p = make(p, m);
  }
  return p;
}
const PROBES = {
  damiano: keyFen(replay(["e4", "e5", "Nf3", "f6", "Nxe5", "fxe5", "Qh5+"])),
  scholars: keyFen(replay(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"])),
  shilling: keyFen(replay(["e4", "e5", "Nf3", "Nc6", "Bc4", "Nd4", "Nxe5", "Qg5",
    "Nxf7", "Qxg2", "Rf1", "Qxe4+", "Be2"])),
};

// --- analyse everything through a pool of worker processes -------------------
const cacheDir = join(root, "data-src/local-eval", `${ENGINE_TAG}-d${DEPTH}`);
mkdirSync(cacheDir, { recursive: true });
const cacheFile = (fen) => join(cacheDir, encodeURIComponent(fen) + ".json");
const results = new Map(); // fen -> pvs
const todo = [];
for (const fen of [...Object.values(PROBES), ...wanted.keys()]) {
  if (results.has(fen)) continue;
  if (existsSync(cacheFile(fen))) results.set(fen, JSON.parse(readFileSync(cacheFile(fen), "utf8")));
  else { results.set(fen, null); todo.push(fen); }
}
console.log(`${results.size} positions to evaluate, ${todo.length} not yet cached`);

if (todo.length) {
  const nWorkers = Math.min(availableParallelism(), 8, todo.length);
  const self = fileURLToPath(import.meta.url);
  let done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: nWorkers }, (_, w) => new Promise((resolve, reject) => {
    const shard = todo.filter((_, i) => i % nWorkers === w);
    const child = spawn(process.execPath, [self, "--worker"], { stdio: ["pipe", "pipe", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`worker ${w} exited ${code}`)));
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (l) => {
      if (!l.startsWith("{")) return; // engine banner prints before the listener attaches
      const { fen, pvs } = JSON.parse(l);
      results.set(fen, pvs);
      writeFileSync(cacheFile(fen), JSON.stringify(pvs));
      if (++done % 25 === 0 || done === todo.length)
        console.log(`  ${done}/${todo.length} analysed (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    });
    child.stdin.write(shard.join("\n") + "\n");
    child.stdin.end();
  })));
}

// --- check the probes --------------------------------------------------------
const best = (fen) => results.get(fen)[0];
{
  const d = best(PROBES.damiano);
  if (!(d.mate !== null ? d.mate < 0 : d.cp <= -200))
    throw new Error(`damiano probe scored cp:${d.cp} mate:${d.mate}; expected decisively negative for the side to move — engine scores are not stm-relative, refusing to write`);
  for (const name of ["scholars", "shilling"]) {
    const g = best(PROBES[name]);
    if (g.mate !== 1)
      throw new Error(`${name} probe scored cp:${g.cp} mate:${g.mate}; expected mate 1 for the side to move`);
  }
  console.log("sign probes pass: engine scores are side-to-move relative");
}

// --- build the table ---------------------------------------------------------
const PV_PLIES = 6;
function buildRow(fen, pvs, pvPlies, maxMoves) {
  const pos = fenPos(fen);
  const out = { d: pvs[0].depth, m: [] };
  for (const pv of pvs.slice(0, maxMoves)) {
    const m = findMove(pos, pv.moves[0]);
    if (!m) throw new Error(`engine pv move ${pv.moves[0]} is not legal in ${fen}`);
    if ((pv.cp === null) === (pv.mate === null) || pv.mate === 0)
      throw new Error(`bad score ${JSON.stringify(pv)} for ${fen}`);
    // exactly one of cp/mate is non-null per entry; scores are stm already
    out.m.push([pv.moves[0], san(pos, m), pv.cp, pv.mate]);
    if (out.m.length === 1 && pvPlies > 0) {
      // principal variation for the best move only, as SAN, replayed for legality
      let p = pos; const sans = [];
      for (const u of pv.moves.slice(0, pvPlies)) {
        const mm = findMove(p, u);
        if (!mm) throw new Error(`engine pv ${pv.moves.join(" ")} goes illegal at ${u} from ${fen}`);
        sans.push(san(p, mm)); p = make(p, mm);
      }
      out.pv = sans;
    }
  }
  return out;
}

// --- self-check --------------------------------------------------------------
// Runs on the exact object about to be shipped, in a FRESH engine context, so a
// bug above cannot vouch for itself.
function checkEvals(EVL, EVL_PROBE) {
  const c2 = {};
  new Function("ctx", core + engineSrc + "\nObject.assign(ctx,{fenPos,findMove,make,san,legal});")(c2);
  const bad = [];
  for (const [fen, row] of Object.entries(EVL)) {
    let pos;
    try { pos = c2.fenPos(fen); } catch { bad.push(`unreadable fen ${fen}`); continue; }
    if (!Number.isInteger(row.d) || row.d < 1) bad.push(`bad depth for ${fen}`);
    if (!Array.isArray(row.m) || row.m.length < 1 || row.m.length > 5) bad.push(`bad move list for ${fen}`);
    for (const [uci, s, cp, mate] of row.m) {
      const m = c2.findMove(pos, uci);
      if (!m) { bad.push(`${fen}: ${uci} is not legal`); continue; }
      if (c2.san(pos, m) !== s) { bad.push(`${fen}: ${uci} labelled ${s}, engine says ${c2.san(pos, m)}`); continue; }
      if ((cp === null) === (mate === null)) bad.push(`${fen}: ${uci} must have exactly one of cp/mate`);
      const score = cp !== null ? cp : mate;
      if (!Number.isInteger(score) || (mate !== null && mate === 0)) bad.push(`${fen}: bad score for ${uci}`);
    }
    if (row.pv !== undefined) {
      if (!Array.isArray(row.pv) || row.pv[0] !== row.m[0][1])
        bad.push(`${fen}: pv does not start with the best move`);
      let p = pos;
      for (const tok of row.pv) {
        const mm = c2.legal(p).find((x) => c2.san(p, x) === tok);
        if (!mm) { bad.push(`${fen}: pv token ${tok} does not replay`); break; }
        p = c2.make(p, mm);
      }
    }
  }
  // Sign-convention assertion. EVL_PROBE is the Damiano position (1.e4 e5
  // 2.Nf3 f6 3.Nxe5 fxe5 4.Qh5+): Black to move and lost, so under the
  // side-to-move convention its stored score MUST be decisively negative. If a
  // regeneration ever flips the convention this number flips sign and fails.
  if (EVL_PROBE.pov !== "stm") bad.push(`probe pov is "${EVL_PROBE.pov}", expected "stm"`);
  if (EVL_PROBE.fen.split(" ")[1] !== "b") bad.push("probe position is not Black to move");
  if ((EVL_PROBE.cp === null) === (EVL_PROBE.mate === null)) bad.push("probe must have exactly one of cp/mate");
  if (!(EVL_PROBE.mate !== null ? EVL_PROBE.mate < 0 : EVL_PROBE.cp <= -200))
    bad.push(`probe score cp:${EVL_PROBE.cp} mate:${EVL_PROBE.mate} is not decisively negative: sign convention has flipped`);
  if (bad.length) throw new Error("evals self-check failed:\n  " + bad.join("\n  "));
}

// --- main --------------------------------------------------------------------
const dBest = best(PROBES.damiano);
const EVL_PROBE = { pov: "stm", fen: PROBES.damiano, cp: dBest.cp, mate: dBest.mate };

// Size budget: the whole page should stay under ~230 KB. Trim the PVs first,
// then drop to the top three moves, before giving up the PV entirely.
const evalsPath = join(root, "src/data/evals.js");
const pageNow = (existsSync(join(root, "docs/index.html"))
  ? readFileSync(join(root, "docs/index.html"), "utf8").length : 0)
  - (existsSync(evalsPath) ? readFileSync(evalsPath, "utf8").length : 0); // page size without a previous evals build
const BUDGET = 400 * 1024;
const header =
  "// Generated by tools/build-evals.mjs - do not edit. Stockfish 16 evaluations\n" +
  "// (lila-stockfish-web sf16-7, small NNUE net) computed locally at build time,\n" +
  `// single-threaded, fixed depth ${DEPTH}; the shipped page needs no engine and\n` +
  "// no network. KEYS: the exact string keyFen() in app.js produces - fenOf\n" +
  "// output with the en-passant field blanked unless an en-passant capture is\n" +
  "// actually legal - so transposing lines share one row. Look up with\n" +
  "// EVL[keyFen(pos)] only.\n" +
  "// SHAPE: EVL[key]={d:depth,m:[[uci,san,cp,mate],...up to 5, best first],pv:[san,...]}\n" +
  "// with exactly one of cp/mate non-null per entry; pv is a short SAN line for\n" +
  "// the best move only. SIGN: every score is from the SIDE TO MOVE's point of\n" +
  "// view - positive cp favours the player to move, mate>0 means the player to\n" +
  "// move mates in n, mate<0 they get mated in n. Never White-relative.\n" +
  "// EVL_PROBE pins the convention: a position where the side to move is\n" +
  "// decisively lost, stored score negative.\n";
let fileStr, plan, first = null;
for (const [pvPlies, maxMoves] of [[PV_PLIES, 5], [4, 5], [2, 5], [6, 3], [4, 3], [2, 3], [0, 3]]) {
  const EVL = {};
  for (const fen of wanted.keys()) EVL[fen] = buildRow(fen, results.get(fen), pvPlies, maxMoves);
  fileStr = header + "const EVL=" + JSON.stringify(EVL) +
    ";\nconst EVL_PROBE=" + JSON.stringify(EVL_PROBE) + ";\n";
  plan = { pvPlies, maxMoves, EVL, fileStr };
  first ??= plan;
  if (pageNow + fileStr.length <= BUDGET) break;
}
if (pageNow + fileStr.length > BUDGET) {
  // Even the barest variant does not fit: the rest of the page alone exceeds
  // the budget, so degrading the evals buys nothing. Ship the richest variant
  // and say so, rather than silently gutting the data to chase an unreachable
  // number.
  console.warn(`WARNING: page without evals is ${(pageNow / 1024).toFixed(0)} KB, ` +
    `over the ${(BUDGET / 1024).toFixed(0)} KB budget before evals are added; ` +
    `trimming evals cannot fix that, keeping the full table`);
  plan = first; fileStr = first.fileStr;
}
checkEvals(plan.EVL, EVL_PROBE);
writeFileSync(evalsPath, fileStr);
console.log(`wrote src/data/evals.js: ${Object.keys(plan.EVL).length}/${wanted.size} positions, ` +
  `top ${plan.maxMoves} moves, ${plan.pvPlies}-ply pv, ${(fileStr.length / 1024).toFixed(1)} KB ` +
  `(page projection ${((pageNow + fileStr.length) / 1024).toFixed(0)} KB)`);
