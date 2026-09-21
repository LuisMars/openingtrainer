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
// tools/deep-check.mjs reuses the worker below at a deeper fixed depth. The
// override is honoured in --worker mode only, so the table this file writes is
// always the depth-20 one its header describes.
const WORKER_DEPTH = process.argv[2] === "--worker" && process.env.SF_DEPTH ? +process.env.SF_DEPTH : DEPTH;
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
  async function analyse(fen, searchmoves) {
    // searchmoves restricts the search to named moves, which is the only way to
    // get a number for a move outside the top five. 76 of the 442 stored
    // repertoire drill moves are in exactly that position, and re-running the
    // ordinary search at any depth will never produce them.
    const n = searchmoves && searchmoves.length ? searchmoves.length : MULTIPV;
    send("ucinewgame");
    send("setoption name MultiPV value " + n);
    send("isready"); await until((l) => l === "readyok" ? true : undefined);
    send("position fen " + fen);
    const pvs = {};
    send("go depth " + WORKER_DEPTH + (searchmoves && searchmoves.length ? " searchmoves " + searchmoves.join(" ") : ""));
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
    for (let i = 1; i <= n && pvs[i]; i++) out.push(pvs[i]);
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
      const job = queue.shift();
      const [fen, sm] = job.split("\t");
      const searchmoves = sm ? sm.split(" ") : null;
      process.stdout.write(JSON.stringify({ job, pvs: await eng.analyse(fen, searchmoves) }) + "\n");
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
  "\nObject.assign(ctx,{LINES,START,startPos,fenPos,findMove,make,san,legal,fenOf,inCheck});")(ctx);
const { LINES, START, startPos, fenPos, findMove, make, san, legal, fenOf, inCheck } = ctx;

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
const drilled = new Map(); // keyFen -> Set(uci the repertoire actually plays there)
let transposition = null; // proof that keyFen folds transpositions
for (const l of LINES) for (const p of drillPlies(l)) {
  const f = keyFen(posAt(l, p));
  if (!drilled.has(f)) drilled.set(f, new Set());
  drilled.get(f).add(l.moves[p][0]);
  const seen = wanted.get(f);
  if (!seen) wanted.set(f, { line: l.id, ply: p });
  else if (!transposition && seen.line !== l.id &&
    LINES.find((x) => x.id === seen.line).moves.slice(0, seen.ply).map((m) => m[0]).join() !==
    l.moves.slice(0, p).map((m) => m[0]).join())
    transposition = { a: seen, b: { line: l.id, ply: p }, fen: f };
}
console.log(`${wanted.size} unique trained positions across ${LINES.length} lines`);

// --extra <file>: one keyFen per line, blank lines and # comments ignored. The
// pilot needs positions no line reaches yet, and they must be scored with the
// same engine, depth and cache as everything else or they are not comparable.
{
  const i = process.argv.indexOf("--extra");
  if (i > 0 && process.argv[i + 1]) {
    let added = 0;
    for (const raw of readFileSync(process.argv[i + 1], "utf8").split("\n")) {
      const f = raw.trim();
      if (!f || f.startsWith("#")) continue;
      const re = keyFen(fenPos(f));        // normalise, and fail loudly on a bad fen
      if (re !== f) throw new Error(`--extra line is not keyFen output:\n  got  ${f}\n  want ${re}`);
      if (!wanted.has(f)) { wanted.set(f, { line: "(extra)", ply: -1 }); added++; }
    }
    console.log(`--extra: ${added} further positions from ${process.argv[i + 1]}`);
  }
}
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
// Threat probe: 1.e4 e5 2.Bc4 Nc6 3.Qh5 — BLACK to move and not in check, and
// White threatens Qxf7#. Searched with the side to move flipped, the stored
// threat must be mate +1 for the THREATENING side, which pins the threat
// table's convention (score from the threatener's point of view) the way
// EVL_PROBE pins the main one.
const TPROBE = keyFen(replay(["e4", "e5", "Bc4", "Nc6", "Qh5"]));

// --- threats: the same position with the side to move flipped ---------------
// What the opponent would play if it were their move: a null-move search. The
// flipped FEN keeps the board and castling rights, hands the move to the other
// side and clears en passant (a capture onto that square belonged to the real
// mover). Only positions where the real mover is not in check qualify: flipped,
// the other side could take the king, and no engine answer to that is a threat.
// Both kings are checked anyway so a malformed position can never be sent.
function flipFen(fen) {
  const pos = fenPos(fen);
  if (inCheck(pos)) return null;
  const flipped = { b: pos.b, w: !pos.w, cr: pos.cr, ep: -1 };
  if (inCheck({ ...flipped, w: pos.w })) return null; // the real mover's king attacked: illegal
  if (!legal(flipped).length) return null;             // no move for the threatening side
  return fenOf(flipped);
}

// --- analyse everything through a pool of worker processes -------------------
const cacheDir = join(root, "data-src/local-eval", `${ENGINE_TAG}-d${DEPTH}`);
mkdirSync(cacheDir, { recursive: true });
const cacheFile = (fen) => join(cacheDir, encodeURIComponent(fen) + ".json");
const results = new Map(); // job ("fen" or "fen\tuci…") -> pvs

// Analyse every job not already cached, sharded across worker processes. The
// sharding is parallelism only: each position is searched single-threaded to a
// fixed depth with the hash cleared, so the table does not depend on it.
async function runJobs(jobs, label) {
  const todo = [];
  for (const j of jobs) {
    if (results.has(j)) continue;
    if (existsSync(cacheFile(j))) results.set(j, JSON.parse(readFileSync(cacheFile(j), "utf8")));
    else { results.set(j, null); todo.push(j); }
  }
  console.log(`${label}: ${jobs.length} to evaluate, ${todo.length} not yet cached`);
  if (!todo.length) return;
  const nWorkers = Math.min(availableParallelism(), 8, todo.length);
  const self = fileURLToPath(import.meta.url);
  let done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: nWorkers }, (_, w) => new Promise((resolve, reject) => {
    const shard = todo.filter((_, i) => i % nWorkers === w);
    if (!shard.length) return resolve();
    const child = spawn(process.execPath, [self, "--worker"], { stdio: ["pipe", "pipe", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`worker ${w} exited ${code}`)));
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (l) => {
      if (!l.startsWith("{")) return; // engine banner prints before the listener attaches
      const { job, pvs } = JSON.parse(l);
      results.set(job, pvs);
      writeFileSync(cacheFile(job), JSON.stringify(pvs));
      if (++done % 25 === 0 || done === todo.length)
        console.log(`  ${done}/${todo.length} analysed (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    });
    child.stdin.write(shard.join("\n") + "\n");
    child.stdin.end();
  })));
}

await runJobs([...Object.values(PROBES), ...wanted.keys()], "positions");

// Threat jobs: every drilled position the flip makes sense for, plus the probe.
// Same worker, same settings (depth 20, one thread, hash cleared, MultiPV 5),
// same cache directory: the flipped FEN is simply another job string.
const threatOf = new Map(); // drilled keyFen -> flipped fen
for (const f of [...drilled.keys(), TPROBE]) { const t = flipFen(f); if (t) threatOf.set(f, t); }
if (!threatOf.has(TPROBE)) throw new Error("threat probe position does not flip; flipFen is broken");
await runJobs([...new Set(threatOf.values())], "threats (side to move flipped)");

// --- second pass: the repertoire moves the first pass could not score --------
// A move outside the stored five gets no number however often the position is
// re-searched, because only five are kept. Those moves are not bad — 76 of the
// 442 drill moves are in that position, including the Hippopotamus's own 1...g6
// — so each one is searched again on its own with `searchmoves`. Without this
// the grader can only call them unanalysed.
const forcedJobs = new Map(); // job -> [uci…] in the order asked

// --force <file>: "<keyFen><TAB><uci> <uci>…" per line. Some moves matter to a
// lesson without the repertoire ever playing them - a line's note may name a
// counter as the answer to a threat. Those need a number too, or the note is
// asserting something the shipped table cannot support.
const named = new Map();
{
  const i = process.argv.indexOf("--force");
  if (i > 0 && process.argv[i + 1]) {
    for (const raw of readFileSync(process.argv[i + 1], "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const [f, list] = line.split("\t");
      if (!list) throw new Error(`--force line has no move list: ${line}`);
      const re = keyFen(fenPos(f));
      if (re !== f) throw new Error(`--force key is not keyFen output:\n  got  ${f}\n  want ${re}`);
      if (!wanted.has(f)) throw new Error(`--force key is not an analysed position: ${f}`);
      const pos = fenPos(f);
      for (const u of list.split(" ")) if (!findMove(pos, u))
        throw new Error(`--force move ${u} is not legal in ${f}`);
      named.set(f, (named.get(f) || []).concat(list.split(" ")));
    }
    console.log(`--force: named moves at ${named.size} positions from ${process.argv[i + 1]}`);
  }
}

for (const [fen, ucis] of drilled) {
  const pvs = results.get(fen);
  if (!pvs) continue;
  const inTop = new Set(pvs.map((pv) => pv.moves[0]));
  const missing = [...ucis].filter((u) => !inTop.has(u));
  if (missing.length) forcedJobs.set(fen + "\t" + missing.join(" "), missing);
}
for (const [fen, ucis] of named) {
  const pvs = results.get(fen);
  if (!pvs) continue;
  const inTop = new Set(pvs.map((pv) => pv.moves[0]));
  const already = new Set([...(drilled.get(fen) || [])]);
  const missing = [...new Set(ucis)].filter((u) => !inTop.has(u) && !already.has(u));
  if (!missing.length) continue;
  // merge with any drilled job already queued for this position
  const prior = [...forcedJobs.keys()].find((j) => j.startsWith(fen + "\t"));
  const all = prior ? forcedJobs.get(prior).concat(missing) : missing;
  if (prior) forcedJobs.delete(prior);
  forcedJobs.set(fen + "\t" + all.join(" "), all);
}
await runJobs([...forcedJobs.keys()], "repertoire moves outside the top five");

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
  const t = best(threatOf.get(TPROBE));
  if (t.mate !== 1 || t.moves[0] !== "h5f7")
    throw new Error(`threat probe scored ${t.moves[0]} cp:${t.cp} mate:${t.mate}; expected Qxf7 mate 1 for the threatening side`);
  console.log("sign probes pass: engine scores are side-to-move relative, threats threatener-relative");
}

// --- build the table ---------------------------------------------------------
const PV_PLIES = 6;
// A SAN line from pos along the engine's uci pv, replayed for legality.
function sanLine(pos, moves, plies, fen) {
  let p = pos; const sans = [];
  for (const u of moves.slice(0, plies)) {
    const mm = findMove(p, u);
    if (!mm) throw new Error(`engine pv ${moves.join(" ")} goes illegal at ${u} from ${fen}`);
    sans.push(san(p, mm)); p = make(p, mm);
  }
  return sans;
}
function buildRow(fen, pvs, pvPlies, maxMoves) {
  const pos = fenPos(fen);
  const out = { d: pvs[0].depth, m: [] };
  const lines = [];
  for (const pv of pvs.slice(0, maxMoves)) {
    const m = findMove(pos, pv.moves[0]);
    if (!m) throw new Error(`engine pv move ${pv.moves[0]} is not legal in ${fen}`);
    if ((pv.cp === null) === (pv.mate === null) || pv.mate === 0)
      throw new Error(`bad score ${JSON.stringify(pv)} for ${fen}`);
    // exactly one of cp/mate is non-null per entry; scores are stm already
    out.m.push([pv.moves[0], san(pos, m), pv.cp, pv.mate]);
    // principal variation, as SAN: `pv` for the best move (the original field),
    // and one line per entry in `lines`, which the caller stores as p / xp.
    if (pvPlies > 0) lines.push(sanLine(pos, pv.moves, pvPlies, fen));
    if (out.m.length === 1 && pvPlies > 0) out.pv = lines[0];
  }
  return { row: out, lines };
}

// --- self-check --------------------------------------------------------------
// Runs on the exact object about to be shipped, in a FRESH engine context, so a
// bug above cannot vouch for itself.
function checkEvals(EVL, EVL_PROBE, EVL_TPROBE) {
  const c2 = {};
  new Function("ctx", core + engineSrc + "\nObject.assign(ctx,{fenPos,findMove,make,san,legal,inCheck,fenOf});")(c2);
  const replays = (from, sans) => {
    let p = from;
    for (const tok of sans) {
      const mm = c2.legal(p).find((x) => c2.san(p, x) === tok);
      if (!mm) return false;
      p = c2.make(p, mm);
    }
    return true;
  };
  const bad = [];
  for (const [fen, row] of Object.entries(EVL)) {
    let pos;
    try { pos = c2.fenPos(fen); } catch { bad.push(`unreadable fen ${fen}`); continue; }
    if (!Number.isInteger(row.d) || row.d < 1) bad.push(`bad depth for ${fen}`);
    if (!Array.isArray(row.m) || row.m.length < 1 || row.m.length > 5) bad.push(`bad move list for ${fen}`);
    if (row.x !== undefined) {
      if (!Array.isArray(row.x) || !row.x.length) bad.push(`bad x list for ${fen}`);
      // x must not duplicate the ranked list: a move belongs in one or the other.
      const ranked = new Set(row.m.map((e) => e[0]));
      for (const e of row.x || []) if (ranked.has(e[0]))
        bad.push(`${fen}: ${e[0]} appears in both m and x`);
    }
    for (const [uci, s, cp, mate] of [...row.m, ...(row.x || [])]) {
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
    // p / xp: one SAN line per stored move, aligned, each starting with its move
    for (const [lk, mk] of [["p", "m"], ["xp", "x"]]) {
      if (row[lk] === undefined) continue;
      if (!Array.isArray(row[lk]) || row[lk].length !== (row[mk] || []).length)
        { bad.push(`${fen}: ${lk} is not aligned with ${mk}`); continue; }
      row[lk].forEach((ln, i) => {
        if (!Array.isArray(ln) || ln[0] !== row[mk][i][1]) bad.push(`${fen}: ${lk}[${i}] does not start with ${row[mk][i][1]}`);
        else if (!replays(pos, ln)) bad.push(`${fen}: ${lk}[${i}] does not replay`);
      });
    }
    if (row.p && row.pv && row.p[0].join(" ") !== row.pv.join(" ")) bad.push(`${fen}: p[0] differs from pv`);
    // t: threat row, legal from the flipped position, only where the mover is not in check
    if (row.t !== undefined) {
      if (c2.inCheck(pos)) { bad.push(`${fen}: threat stored for a position in check`); }
      else {
        const fp = { b: pos.b, w: !pos.w, cr: pos.cr, ep: -1 };
        const [u, s, cp, mate, tpv] = row.t;
        const m = c2.findMove(fp, u);
        if (!m) bad.push(`${fen}: threat ${u} is not legal with the move flipped`);
        else if (c2.san(fp, m) !== s) bad.push(`${fen}: threat ${u} labelled ${s}, engine says ${c2.san(fp, m)}`);
        if ((cp === null) === (mate === null) || mate === 0) bad.push(`${fen}: threat needs exactly one of cp/mate`);
        if (!Array.isArray(tpv) || tpv[0] !== s || !replays(fp, tpv)) bad.push(`${fen}: threat pv does not replay from ${s}`);
      }
    }
  }
  // Threat sign: 1.e4 e5 2.Bc4 Nc6 3.Qh5, Black to move; flipped, White mates
  // at once, so the stored threat must be Qxf7 with mate +1 for the threatener.
  if (EVL_TPROBE.pov !== "threatener" || EVL_TPROBE.uci !== "h5f7" || EVL_TPROBE.mate !== 1 || EVL_TPROBE.cp !== null)
    bad.push(`threat probe is ${JSON.stringify(EVL_TPROBE)}; expected Qxf7 mate +1 for the threatening side`);
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
const tBest = best(threatOf.get(TPROBE));
const EVL_TPROBE = { pov: "threatener", fen: TPROBE, uci: tBest.moves[0], cp: tBest.cp, mate: tBest.mate };

// Size budget: one file that a browser loads once and then works offline.
// The number defends load time, not a round figure - GitHub Pages serves the
// page gzipped, and the raw ceiling here is roughly three times the transfer
// size (the build prints both). Raised from 400 KB when the Wave 4 content
// expansion crossed it: degrading the engine data, which is the product, to
// defend a byte count that costs the user nothing is the wrong trade. Trim the
// PVs first, then drop to the top three moves, before giving up the PV entirely.
const evalsPath = join(root, "src/data/evals.js");
const pageNow = (existsSync(join(root, "docs/index.html"))
  ? readFileSync(join(root, "docs/index.html"), "utf8").length : 0)
  - (existsSync(evalsPath) ? readFileSync(evalsPath, "utf8").length : 0); // page size without a previous evals build
// ponytail: no ceiling. Page size is not a constraint for this project, and the
// ladder below exists only to degrade the table when a ceiling is hit; with none
// it always ships the full variant. Set a number here to bring the trimming back.
const BUDGET = Infinity;
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
  "// the best move only. An optional x:[[uci,san,cp,mate],...] carries scores for\n" +
  "// repertoire moves that fall OUTSIDE the top list - searched one at a time with\n" +
  "// searchmoves. x is not a ranking and not a sixth-best claim; it exists because\n" +
  "// 76 of the 442 stored drill moves are outside the five, the Hippopotamus's own\n" +
  "// 1...g6 among them, and an unranked move must not be read as a bad one.\n" +
  "// p:[[san,...],...] is aligned with m and xp with x: a short SAN line for every\n" +
  "// stored move from the search that scored it (p[0] equals pv), so each candidate\n" +
  "// has its own resulting position. t:[uci,san,cp,mate,[san,...]] is the THREAT:\n" +
  "// the opponent's best move on the same board with the move handed to them (en\n" +
  "// passant cleared), same engine, depth and settings, scored from the THREATENING\n" +
  "// side's view; absent where the mover is in check. EVL_TPROBE pins its sign.\n" +
  "// SIGN: every other score is from the SIDE TO MOVE's point of\n" +
  "// view - positive cp favours the player to move, mate>0 means the player to\n" +
  "// move mates in n, mate<0 they get mated in n. Never White-relative.\n" +
  "// EVL_PROBE pins the convention: a position where the side to move is\n" +
  "// decisively lost, stored score negative.\n";
let fileStr, plan, first = null;
for (const [pvPlies, maxMoves] of [[PV_PLIES, 5], [4, 5], [2, 5], [6, 3], [4, 3], [2, 3], [0, 3]]) {
  const EVL = {};
  for (const fen of wanted.keys()) {
    const main = buildRow(fen, results.get(fen), pvPlies, maxMoves);
    EVL[fen] = main.row;
    // p: a short SAN line for EVERY ranked move, aligned with m (p[i] starts
    // with m[i]; p[0] is pv). The resulting position of each candidate, from
    // the same MultiPV search that scored it - no new search.
    if (pvPlies > 0) EVL[fen].p = main.lines;
    // x: repertoire moves this position's top list does not contain, each with a
    // score of its own. Not ranked, not a sixth-best claim - just a number for a
    // move the ordinary search never reports.
    const job = [...forcedJobs.keys()].find((j) => j.startsWith(fen + "\t"));
    if (job && results.get(job)) {
      // x keeps no pv of its own in the original shape; xp (aligned with x)
      // carries the same short SAN line for these moves.
      const xr = buildRow(fen, results.get(job), PV_PLIES, forcedJobs.get(job).length);
      if (xr.row.m.length) { EVL[fen].x = xr.row.m; EVL[fen].xp = xr.lines; }
    }
    // t: the threat - the opponent's best move were it their turn, from the
    // flipped search: [uci, san, cp, mate, [san pv…]], scores from the
    // THREATENING side's point of view. Stored for every drilled position the
    // flip applies to; whether it is worth showing is the app's call
    // (THREAT_CP in src/app.js), so the raw number stays inspectable.
    if (threatOf.has(fen)) {
      const tf = threatOf.get(fen), tr = buildRow(tf, results.get(tf), PV_PLIES, 1);
      const [u, sn, cp, mate] = tr.row.m[0];
      EVL[fen].t = [u, sn, cp, mate, tr.lines[0]];
    }
  }
  fileStr = header + "const EVL=" + JSON.stringify(EVL) +
    ";\nconst EVL_PROBE=" + JSON.stringify(EVL_PROBE) +
    ";\nconst EVL_TPROBE=" + JSON.stringify(EVL_TPROBE) + ";\n";
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
checkEvals(plan.EVL, EVL_PROBE, EVL_TPROBE);
writeFileSync(evalsPath, fileStr);
console.log(`wrote src/data/evals.js: ${Object.keys(plan.EVL).length}/${wanted.size} positions, ` +
  `top ${plan.maxMoves} moves, ${plan.pvPlies}-ply pv, ${(fileStr.length / 1024).toFixed(1)} KB ` +
  `(page projection ${((pageNow + fileStr.length) / 1024).toFixed(0)} KB)`);
