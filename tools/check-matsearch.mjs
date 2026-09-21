#!/usr/bin/env node
// Measures the app's material search against an independent reference, which is
// the one claim in TASK-LEDGER.md that was carried as "not established".
//
// The reference is deliberately dumb: negamax on material to the same horizon,
// with a quiescence that searches every capture and promotion, every legal move
// when in check, and none of the shortcuts whose soundness is in question - no
// delta pruning, no captures-only-in-check, no node budget, no standing pat out
// of check. It is far too slow to ship and that is the point.
//
// It does use alpha-beta, and it does try captures first. Neither changes the
// answer: alpha-beta with a full window at the root returns the identical value
// to full-width negamax and ordering only decides which branches are visited
// first. That is the difference between a run that finishes and a run that does
// not - the full-width version managed 16 comparisons in 25 minutes. Run
//
//   node tools/check-matsearch.mjs --selftest
//
// to see the two agree position by position before trusting the measurement.
//
//   node tools/check-matsearch.mjs [--positions N] [--moves M]
//                                  [--shard I,N] [--json FILE] [--selftest [K]]
//
// The dangerous direction is OVERCLAIM: matVerdict asserting a refutation the
// reference denies, because that blames a user for a sound move. Underclaim
// (staying silent where a refutation exists) is the search being conservative,
// which is what it is supposed to be.
//
// A swing is `before - after`, so each overclaim row also prints both halves for
// both searches: that is what tells a wrong `before` (the app thinking the mover
// could have won material, so every wrong move at that position looks a pawn
// worse) from a wrong `after`. The first full run (485 positions x 8 moves) gave
// 13 overclaims, all `app 1.0 / reference 0.0`, in five positions, and every one
// traced to the same rule in matQuiesce: after the first quiescence ply only
// recaptures on the square just captured on are tried, so a capture elsewhere
// that wins the material back - or a queen left hanging - is invisible and the
// app stands pat a pawn out. The reference was not at fault.
//
// With that rule removed, the same run gives 3,855 compared, 0 overclaims,
// 2 underclaims (cz:16 e4 and cz-tab:16 e4, app 0 / reference 1) and 25 budget
// misses, up from 1, in four positions: hip-f4:11 and syn-e5punish:11 (the same
// position), syn-london:21 and ohanlon:28. Mean nodes per verdict rose from
// 14,390 to 16,377 (p99 38,374 to 47,582). The budget was left alone on purpose:
// with it lifted, ohanlon:28 g4 claims a swing of 1 against the reference's 0.
// That one was delta pruning in matQuiesce, which skipped a capture that cannot
// reach alpha on the victim alone and so missed a capture that gives check, where
// the opponent has no stand-pat to fall back on.
//
// Checking captures are now exempt from delta pruning and MAT_CAP went from
// 60,000 to 110,000. Full run, 516 positions x 8 moves = 4,110 verdicts, before ->
// after: compared 4,069 -> 4,094; OVERCLAIM 0 -> 0; underclaim 3 -> 2 (cz:16 e4
// and cz-tab:16 e4 remain; def-ohanlon:27 dxc3, a mate the app missed, is found);
// budget misses 41 -> 16 (syn-hipc5:25 and ohanlon:28, 8 each; ohanlon:28 g4 needs
// 219,450 nodes and, with the budget lifted, returns 0, as the reference does).
// The swing in pawns also agrees more often: the app gave a larger swing than the
// reference on 5 rows (ohanlon:32 x3 6 v 5, ohanlon:34 Qf3 2 v 1, syn-clamp:24
// Ra2 6 v 3) and now on none; exact agreement 4,043 -> 4,082 rows. Mean nodes per
// verdict 16,698 -> 18,063 (p95 35,721 -> 38,012). A budget miss is silence.
//
// The page now runs the search in a Web Worker where it can, with MAT_CAP_BG
// (250,000) instead of MAT_CAP; the main-thread fallback keeps MAT_CAP. This tool
// measures MAT_CAP_BG by default (--main for the fallback) and also counts the
// verdicts that would be silent on the fallback. Full run, 516 positions x 8 moves
// = 4,110 verdicts, before -> after: compared 4,094 -> 4,110; OVERCLAIM 0 -> 0;
// budget misses 16 -> 0 (silent on the fallback: 16, the same two positions). The
// 16 new rows all equal the reference exactly (syn-hipc5:25 Bc6 and Ng3 3, the
// other six 0; ohanlon:28 Re3 4, Nxf7 and Kh1 2, Nh3 and b3 1, g4, Qc2+ and Qxd4
// 0), and none of the other 4,094 app swings moved. Largest verdict 219,450 nodes
// (ohanlon:28 g4); mean 18,325, p95 38,012, p99 72,477.
//
// The last two underclaims, cz:16 e4 and cz-tab:16 e4, were this tool's own
// horizon, not the app's: QCAP was 8, and after 9...dxe4 the exchanges on e4 run
// past eight quiescence plies, so the reference stood pat mid-sequence a pawn up
// for Black and called 9.e4 a pawn lost. The app's quiescence has no ply limit
// and saw the sequence out: 0. At QCAP 9, 10, 11, 12, 14 and 20 the reference
// says 0 as well, so QCAP is now 12. Same full run at QCAP 12: agree 4,108 ->
// 4,110, underclaim 2 -> 0, exact swing agreement 4,098 -> 4,104 rows, app larger
// than the reference on 0 rows; wall time unchanged (about 7 minutes in 10 shards).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "docs/index.html"), "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const ctx = {};
new Function("ctx", js.slice(0, js.indexOf("/* ================= state ================= */")) +
  "\nObject.assign(ctx,{LINES,startPos,make,legal,uciOf,san,matVerdict,VAL,inCheck,fenOf,matSearch,MAT_CAP,MAT_CAP_BG,matUsed:()=>matNodes,matReset:()=>{matNodes=0;matCap=MAT_CAP_BG;}});")(ctx);
const { LINES, startPos, make, legal, uciOf, san, matVerdict, VAL, inCheck, matSearch, matReset,
  MAT_CAP, MAT_CAP_BG, matUsed } = ctx;
// The budget measured is the one the page uses where it can: MAT_CAP_BG, in a Web
// Worker. --main measures the fallback instead (MAT_CAP, on the page's thread).
// Either way the run also counts the verdicts the fallback leaves silent.
const CAP = process.argv.includes("--main") ? MAT_CAP : MAT_CAP_BG;
// The app's own `before`, for the breakdown on an overclaim row. matVerdict
// resets the node budget itself; a bare matSearch does not, hence matReset.
const appBefore = (pos) => { matReset(); try { return matSearch(pos, 4, -MATE, MATE, 0); } catch (e) { return NaN; } };

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i < 0 ? d : process.argv[i + 1]; };
const has = (n) => process.argv.includes("--" + n);
const NPOS = +arg("positions", 60), NMOV = +arg("moves", 3);
const [SHARD, SHARDS] = (arg("shard", "0,1") + "").split(",").map(Number);
const JSONOUT = arg("json", null);

// --- the reference -----------------------------------------------------------
const bal = (b) => {           // material from White's point of view, in pawns
  let s = 0;
  for (const c of b) if (c) s += (c === c.toUpperCase() ? 1 : -1) * VAL[c.toLowerCase()];
  return s;
};
const MATE = 1000, INF = MATE + 1;
const noisy = (p, m) => p.b[m.t] || m.p || m.ep;   // capture, promotion, en passant
// QCAP bounds the quiescence. Expanding every legal move out of check with no
// limit lets a checking sequence recurse until it is no longer a measurement,
// which is what the first run of this tool did. Left at 8: generous enough that
// the captures dry up long before it is reached in these positions. Overridable
// with MATSEARCH_QCAP so the choice can be shown not to matter rather than
// asserted. It did matter once: 8 was too short at cz:16 e4 (see the header), so
// it is 12, and on the full run 12 changes nothing else.
const QCAP = +(process.env.MATSEARCH_QCAP || 12);
// Captures and promotions first, biggest victim first. Ordering visits the same
// tree in a different order; it cannot change the value a full-window root
// search returns. --selftest is what proves that rather than asserting it.
const order = (p, ms) => ms.slice().sort((a, b) => gain(p, b) - gain(p, a));
const gain = (p, m) => (m.ep ? 1 : (p.b[m.t] ? VAL[p.b[m.t].toLowerCase()] : 0)) + (m.p ? VAL[m.p] - 1 : 0);

// --- the reference, with alpha-beta ------------------------------------------
function quiesce(p, alpha, beta, ply) {
  const ms = legal(p);
  if (!ms.length) return inCheck(p) ? -MATE : 0;
  const stand = (p.w ? 1 : -1) * bal(p.b);
  if (ply >= QCAP) return stand;
  if (inCheck(p)) {                           // no standing pat out of check
    let best = -INF;
    for (const m of order(p, ms)) {
      const s = -quiesce(make(p, m), -beta, -alpha, ply + 1);
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = stand;
  if (best >= beta) return best;
  if (best > alpha) alpha = best;
  for (const m of order(p, ms)) {
    if (!noisy(p, m)) continue;
    const s = -quiesce(make(p, m), -beta, -alpha, ply + 1);
    if (s > best) best = s;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function search(p, d, alpha = -INF, beta = INF) {
  if (d === 0) return quiesce(p, alpha, beta, 0);
  const ms = legal(p);
  if (!ms.length) return inCheck(p) ? -MATE : 0;
  let best = -INF;
  for (const m of order(p, ms)) {
    const s = -search(make(p, m), d - 1, -beta, -alpha);
    if (s > best) best = s;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// --- the same reference, full width, kept only to prove the above is exact ----
function fwQuiesce(p, ply) {
  const ms = legal(p);
  if (!ms.length) return inCheck(p) ? -MATE : 0;
  const stand = (p.w ? 1 : -1) * bal(p.b);
  if (ply >= QCAP) return stand;
  if (inCheck(p)) {
    let best = -INF;
    for (const m of ms) best = Math.max(best, -fwQuiesce(make(p, m), ply + 1));
    return best;
  }
  let best = stand;
  for (const m of ms) if (noisy(p, m)) best = Math.max(best, -fwQuiesce(make(p, m), ply + 1));
  return best;
}
function fwSearch(p, d) {
  if (d === 0) return fwQuiesce(p, 0);
  const ms = legal(p);
  if (!ms.length) return inCheck(p) ? -MATE : 0;
  let best = -INF;
  for (const m of ms) best = Math.max(best, -fwSearch(make(p, m), d - 1));
  return best;
}

// The same shape matVerdict reports: how much the mover's own best outcome drops
// because of this move, four plies from the position. `before` is a property of
// the position, so it is passed in and computed once per position rather than
// once per wrong move.
function refSwing(pos, m, before) {
  const after = make(pos, m);
  if (!legal(after).length) return 0;
  const bestReply = -search(after, 3);          // mover's value after best reply
  if (before > MATE - 64 && bestReply < MATE - 64) return 0;   // slipped mate, not material
  return before - bestReply;
}

// --- sample drill positions ---------------------------------------------------
const seen = new Set(), spots = [];
for (const l of LINES) {
  let p = startPos();
  for (let i = 0; i < l.moves.length; i++) {
    if ((p.w ? "w" : "b") === l.you) {
      const k = l.id + ":" + i;
      if (!seen.has(k)) { seen.add(k); spots.push({ pos: p, want: l.moves[i][0], id: k }); }
    }
    p = make(p, legal(p).find((x) => uciOf(x) === l.moves[i][0]));
  }
}
const step = Math.max(1, Math.floor(spots.length / NPOS));
const sample = spots.filter((_, i) => i % step === 0).slice(0, NPOS)
  .filter((_, i) => i % SHARDS === SHARD);

// --- selftest: alpha-beta against full width, value for value ------------------
if (has("selftest")) {
  const K = +arg("selftest", 6) || 6, D = +arg("depth", 4);
  let bad = 0, checks = 0;
  for (const s of spots.filter((_, i) => i % Math.max(1, Math.floor(spots.length / K)) === 0).slice(0, K)) {
    const a = search(s.pos, D), b = fwSearch(s.pos, D);
    const wrong = legal(s.pos).filter((x) => uciOf(x) !== s.want);
    const picks = [wrong[0], wrong[Math.floor(wrong.length / 2)], wrong[wrong.length - 1]].filter(Boolean);
    const rows = picks.map((m) => {
      const af = make(s.pos, m);
      return [san(s.pos, m), -search(af, D - 1), -fwSearch(af, D - 1)];
    });
    const ok = a === b && rows.every((r) => r[1] === r[2]);
    if (!ok) bad++;
    checks += 1 + rows.length;
    console.log(`${ok ? "ok  " : "FAIL"} ${s.id.padEnd(22)} depth ${D} root ab ${a} fw ${b}   ` +
      rows.map((r) => `${r[0]} ab ${r[1]} fw ${r[2]}`).join("  "));
  }
  console.log(bad ? `${bad} positions disagree - the alpha-beta is wrong` :
    `alpha-beta and full width return identical values on all ${checks} searches above`);
  process.exit(bad ? 1 : 0);
}

// Wrong moves are sampled evenly across the legal list rather than taken from
// one end: the list comes out of the generator in piece order, so the first N
// would all be king and queen moves of the same few pieces.
function picksOf(pos, want, n) {
  const wrong = legal(pos).filter((m) => uciOf(m) !== want);
  if (wrong.length <= n) return wrong;
  const out = [];
  for (let i = 0; i < n; i++) out.push(wrong[Math.round((i * (wrong.length - 1)) / (n - 1))]);
  return out;
}

let compared = 0, agree = 0, overclaim = [], underclaim = [], nulls = 0, rows = [];
const nodes = [], fallbackSilent = [];
const t0 = Date.now();
for (const s of sample) {
  const picks = picksOf(s.pos, s.want, NMOV);
  let before = null;
  for (const m of picks) {
    const v = matVerdict(s.pos, m, CAP);
    const used = matUsed();
    nodes.push(used);
    if (used > MAT_CAP) fallbackSilent.push(`${s.id} ${san(s.pos, m)} ${used}`);
    if (!v) { nulls++; continue; }
    if (before === null) before = search(s.pos, 4);
    const r = refSwing(s.pos, m, before);
    compared++;
    const appClaims = v.swing >= 1, refClaims = r >= 1;
    let row = `${s.id} ${san(s.pos, m)}: app ${v.swing.toFixed(1)}, reference ${r.toFixed(1)}`;
    rows.push([s.id, san(s.pos, m), +v.swing.toFixed(2), +r.toFixed(2)]);
    if (appClaims === refClaims) agree++;
    else if (appClaims && !refClaims) {
      const ab = appBefore(s.pos);
      row += ` [before app ${ab} / ref ${before}; after app ${ab - v.swing} / ref ${before - r}; reply ${v.san}]`;
      overclaim.push(row);
    } else underclaim.push(row);
  }
  if (process.env.MATSEARCH_PROGRESS)
    process.stderr.write(`[${SHARD}] ${s.id} done, ${compared} compared, ${((Date.now() - t0) / 1000) | 0}s\n`);
}
const out = { positions: sample.length, of: spots.length, compared, agree,
  overclaim, underclaim: underclaim.length, underclaimRows: underclaim, nulls, rows,
  cap: CAP, nodes, fallbackSilent,
  seconds: (Date.now() - t0) / 1000 };
if (JSONOUT) writeFileSync(JSONOUT, JSON.stringify(out, null, 1));
console.log(`sampled ${sample.length} of ${spots.length} drill positions, ${compared} wrong moves compared in ${out.seconds.toFixed(0)}s`);
console.log(`  agree: ${agree}`);
console.log(`  app claims a refutation the reference denies (OVERCLAIM): ${overclaim.length}`);
console.log(`  app stays silent where the reference refutes (underclaim, conservative): ${underclaim.length}`);
console.log(`  no verdict (node budget ${CAP}): ${nulls}`);
console.log(`  silent on the main-thread fallback (over ${MAT_CAP} nodes): ${fallbackSilent.length}`);
const sorted = nodes.slice().sort((a, b) => a - b), pc = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
if (sorted.length) console.log(`  nodes per verdict: mean ${(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(0)}, p95 ${pc(0.95)}, p99 ${pc(0.99)}, max ${sorted[sorted.length - 1]}`);
for (const u of underclaim.slice(0, 20)) console.log("    under: " + u);
for (const o of overclaim.slice(0, 20)) console.log("    " + o);
process.exit(overclaim.length ? 1 : 0);
