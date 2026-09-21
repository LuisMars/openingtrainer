#!/usr/bin/env node
// Grading-policy fixtures for wave 2, lane B. Runs against docs/ (build first),
// the same way test/verify.mjs does, so what is tested is what ships.
//
// One block per row of research/W2-E1-pilot.md §5, in that order. Real positions
// are replayed through the engine and graded against their shipped EVL row; the
// three cases the pilot has no position for (promotion, forced mate, a genuinely
// lost position) use constructed rows, and every mate a constructed row claims is
// confirmed here by a forced-mate search before the row is used. The numbers in
// a constructed row are inputs that exercise a branch, not evaluations.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "docs/index.html"), "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const bundle = js.slice(0, js.indexOf("/* ================= state ================= */"));
const ctx = {};
new Function("ctx", bundle + "\nObject.assign(ctx,{LINES,START,HIPPO_T,startPos,fenPos,findMove,make,san,legal,uciOf,inCheck,fenOf,posKey,candidateEval,gradeMove,gradeRow,setupGate,isSetupMove,cmpScore,scoreState,GRADE,EVL,DEEP});")(ctx);
const { LINES, START, HIPPO_T, startPos, fenPos, findMove, make, san, legal, uciOf, inCheck,
  fenOf, posKey, candidateEval, gradeMove, gradeRow, setupGate, isSetupMove, cmpScore, GRADE, EVL, DEEP } = ctx;

let fail = 0;
const bad = (m) => { console.error("  ✗ " + m); fail++; };
const eq = (got, want, what) => { if (got !== want) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };
const ok = (msg) => { if (!fail) console.log("✓ " + msg); };

const replay = (sans) => {
  let p = startPos();
  for (const t of sans.split(/\s+/).filter(Boolean)) {
    const m = legal(p).find((x) => san(p, x).replace(/[+#]/g, "") === t.replace(/[+#!?]/g, ""));
    if (!m) throw new Error("illegal " + t);
    p = make(p, m);
  }
  return p;
};
// Grade a SAN move at a real position against its shipped row.
const at = (sans) => { const p = replay(sans); return { p, row: EVL[posKey(p)] }; };
const g = (ctxPos, sanTxt) => {
  const m = legal(ctxPos.p).find((x) => san(ctxPos.p, x).replace(/[+#]/g, "") === sanTxt.replace(/[+#!?]/g, ""));
  if (!m) throw new Error("illegal " + sanTxt);
  return gradeMove(ctxPos.row, ctxPos.p, m);
};
// The same, against the depth-20 row alone: the band policy on one search. At a
// position src/data/deep.js also covers, g() can differ (block 14).
const gr = (ctxPos, sanTxt) => {
  const m = legal(ctxPos.p).find((x) => san(ctxPos.p, x).replace(/[+#]/g, "") === sanTxt.replace(/[+#!?]/g, ""));
  if (!m) throw new Error("illegal " + sanTxt);
  return gradeRow(ctxPos.row, ctxPos.p, m);
};
// Position a line stands in before its drill move at ply i.
const lineAt = (id, ply) => {
  const l = LINES.find((x) => x.id === id);
  let p = l.start === START ? startPos() : fenPos(l.start);
  for (let i = 0; i < ply; i++) p = make(p, findMove(p, l.moves[i][0]));
  return { p, row: EVL[posKey(p)], line: l, mv: l.moves[ply] };
};
// Forced-mate search in the MATE-minus-ply scheme matSearch uses. Returns the
// number of plies to a forced mate for the side to move (positive), the number
// of plies until it is mated against best defence (negative), or 0 for neither
// within the horizon. Full width, no pruning: the fixture positions are tiny.
const MATE = 1000;
function mateSearch(p, depth, ply) {
  const ms = legal(p);
  if (!ms.length) return inCheck(p) ? -(MATE - ply) : 0;
  if (!depth) return 0;
  let best = -Infinity;
  for (const m of ms) { const s = -mateSearch(make(p, m), depth - 1, ply + 1); if (s > best) best = s; }
  return best;
}
const matePlies = (p, depth) => { const v = mateSearch(p, depth, 0); return v === 0 ? 0 : Math.sign(v) * (MATE - Math.abs(v)); };
const bandsOK = GRADE.version === "v1" && GRADE.equal === 30 && GRADE.concession === 70 && GRADE.decisive === 200;
if (!bandsOK) bad("policy constants are not the v1 values research/GRADING.md documents: " + JSON.stringify(GRADE));

// 1. Five comparable moves.
{
  const e4 = at("e4");                       // h-after-1e4, spread 11 cp
  for (const s of ["c5", "e5", "c6", "Nc6", "e6"]) {
    const r = g(e4, s);
    if (!GRADE.accept.includes(r.verdict)) bad(`1.e4 ${s}: ${r.verdict}, expected an accepted verdict`);
    if (r.why.kind !== "best" && r.why.kind !== "within-noise") bad(`1.e4 ${s}: why ${r.why.kind} asserts a preference the numbers do not hold`);
  }
  eq(g(e4, "c5").verdict, "best", "1.e4 c5 is the row's top entry");
  eq(g(e4, "e6").lossCp, 11, "1.e4 e6 loss");
  const node = at("d4 d5 Nf3 Nf6 e3 e6");   // c-e6-node-transposed, spread 5 cp
  for (const s of ["b3", "Nbd2", "Bd3", "c4", "Be2"]) if (!GRADE.accept.includes(g(node, s).verdict)) bad(`c-e6-node ${s} not accepted`);
  eq(gr(node, "Bd3").lossCp, 2, "drilled 4.Bd3 loss at depth 20");
  eq(g(node, "Bd3").verdict, "best", "4.Bd3 is depth 28's first choice, so it grades best");
  const fork = at("d4 d5 Nf3 Nf6 e3 e6 Bd3 c5"); // c-c5-fork-c3-b3: c3 and b3 both drilled
  const b3 = g(fork, "b3"), c3 = g(fork, "c3");
  if (!GRADE.accept.includes(b3.verdict) || !GRADE.accept.includes(c3.verdict)) bad("c3 and b3 must both be accepted");
  eq(c3.lossCp, 4, "5.c3 sits 4 cp behind 5.b3");
  eq(g(fork, "Be2").verdict, "equal", "Be2 at 16 cp is inside the noise band");
  // A tie at the top is two best moves, not a preference: 1.d4 e6 Nf3 31 / e4 31.
  const e6 = at("d4 e6");
  eq(g(e6, "Nf3").verdict, "best", "1.d4 e6 2.Nf3 best");
  eq(g(e6, "e4").verdict, "best", "1.d4 e6 2.e4 ties for best");
  eq(g(e6, "e4").rank, 2, "the tie is still rank 2 in the table");
  ok("five comparable moves: all accepted, no invented preference, ties are ties");
}

// 2. Only one or two good moves: the narrow row and the Englund gambit.
{
  const ben = at("d4 c5 e3 cxd4");           // exd4 25, Qxd4 -7, then -59/-62/-63
  eq(g(ben, "exd4").verdict, "best", "exd4");
  const q = g(ben, "Qxd4");
  eq(q.verdict, "concession", "Qxd4 at 32 cp");
  eq(q.lossCp, 32, "Qxd4 loss");
  for (const s of ["c4", "Nf3", "Be2"]) {
    const r = gr(ben, s);
    eq(r.verdict, "inferior", `${s} drops the pawn (rank ${r.rank}, loss ${r.lossCp})`);
    if (r.lossCp < 80) bad(`${s} loss ${r.lossCp} should be a clean pawn`);
  }
  // Depth 28 has c4 and Nf3 at 66 and 65 behind, so the verdict the page gives
  // is the more generous concession, on the depth-28 number. Neither depth
  // accepts either move, so there is no disagreement to report.
  for (const [s, loss] of [["c4", 66], ["Nf3", 65]]) {
    const r = g(ben, s);
    eq(r.verdict, "concession", `${s} graded on both depths`);
    eq(r.why.depth, 28, `${s} record comes from depth 28`);
    eq(r.lossCp, loss, `${s} loss at depth 28`);
    eq(r.split, null, `${s}: neither depth accepts it, no split`);
  }
  const eng = at("d4 e5");                   // dxe5 105, Nc3 27, e3 24, c3 7, e4 4
  eq(g(eng, "dxe5").verdict, "best", "2.dxe5 takes the pawn");
  for (const s of ["Nc3", "e3", "c3", "e4"]) eq(g(eng, s).verdict, "inferior", `declining with ${s}`);
  eq(g(eng, "e4").after, "level", "declining is inferior, not losing: the position stays level");
  const e5 = at("e4 g6 d4 Bg7 e5");          // h-3e5-space-grab: d6 35, c5 28, Nh6 3, a6 0, Nc6 -29
  eq(g(e5, "d6").verdict, "best", "3.e5 d6");
  eq(g(e5, "c5").verdict, "equal", "3.e5 c5 at 7 cp");
  eq(g(e5, "Nh6").verdict, "concession", "3.e5 Nh6 at 32 cp");
  eq(g(e5, "Nc6").verdict, "concession", "3.e5 Nc6 at 64 cp");
  ok("narrow rows: the playable second move is a concession, dropping a pawn is inferior");
}

// 3. Promotion: a queen and a knight promotion from one square are two moves.
//    Constructed row on K+P v K. The numbers encode nothing beyond "queening
//    wins, a knight promotion leaves K+N v K", which is material, not a search.
{
  const p = fenPos("k7/4P3/8/8/8/8/8/4K3 w - - 0 1");
  const row = { d: 20, m: [["e7e8q", "e8=Q+", 900, null], ["e7e8r", "e8=R+", 850, null], ["e7e8n", "e8=N", 0, null], ["e7e8b", "e8=B", 0, null]], pv: ["e8=Q"] };
  for (const e of row.m) eq(san(p, findMove(p, e[0])), e[1], "constructed SAN matches the engine for " + e[0]);
  const q = gradeMove(row, p, findMove(p, "e7e8q")), n = gradeMove(row, p, findMove(p, "e7e8n"));
  eq(q.uci, "e7e8q", "queen promotion carries its suffix");
  eq(n.uci, "e7e8n", "knight promotion carries its suffix");
  eq(q.verdict, "best", "e8=Q");
  eq(n.verdict, "inferior", "e8=N throws the win");
  eq(n.why.kind, "threw-win", "e8=N reason");
  if (q.san === n.san || q.lossCp === n.lossCp) bad("the two promotions graded as one move");
  const trunc = gradeMove(row, p, "e7e8");
  eq(trunc.verdict, "unknown", "a four-character promotion uci matches no entry and grades nothing");
  eq(trunc.reason, "unanalysed", "truncated uci reason");
  ok("promotion: e7e8q and e7e8n are different records, a truncated uci grades nothing");
}

// 4. Unanalysed move: no penalty, no praise.
{
  const e4 = at("e4");
  const a6 = g(e4, "a6");                    // in neither the five nor row.x
  eq(a6.verdict, "unknown", "1.e4 a6 verdict");
  eq(a6.analysis, "unknown", "1.e4 a6 analysis");
  eq(a6.lossCp, null, "1.e4 a6 carries no loss");
  eq(a6.cp, null, "1.e4 a6 carries no score");
  eq(a6.after, null, "1.e4 a6 claims nothing about the position after it");
  eq(a6.situation, "level", "the position before the move is still described");
  const none = gradeMove(null, e4.p, "a7a6");
  eq(none.verdict, "unknown", "no row");
  eq(none.reason, "no-row", "no row reason");
  // The forced-move run gave the repertoire's unranked moves a number: they are
  // "scored", rank 0, and graded on the gap like anything else.
  const g6 = g(e4, "g6"), d6 = g(e4, "d6");
  eq(g6.reason, "scored", "1...g6 is scored, not ranked");
  eq(g6.rank, 0, "1...g6 has no rank");
  eq(g6.verdict, "equal", "1...g6 at 25 cp behind c5");
  eq(d6.verdict, "equal", "1...d6 at 22 cp behind c5");
  const kid = at("d4 Nf6 Nf3 g6 e3 Bg7");   // c-kid-bg7-unranked: b3 and Bd3 both scored at -10 vs c4 25
  const b3 = g(kid, "b3"), bd3 = g(kid, "Bd3");
  eq(b3.reason, "scored", "colle-kid's b3 is scored");
  eq(b3.verdict, "concession", "b3 at 35 cp is a concession, so its ! mark has no number behind it");
  eq(bd3.verdict, "concession", "eco-kid's Bd3 at 35 cp");
  eq(g(at("e4 g6 d4 Bg7 Nc3"), "b6").verdict, "equal", "hip-150's 3...b6 at 25 cp");
  // Rank 0 on a scored move must never read as "worst": a scored move can grade
  // above a listed one.
  const listedWorst = g(kid, "a3");
  if (listedWorst.rank !== 5 || listedWorst.lossCp <= b3.lossCp) bad("expected the ranked fifth (a3, 37 cp) to lose more than the scored b3 (35 cp)");
  ok("unanalysed moves are unknown and cost nothing; scored moves grade on their gap, rank 0 is not a rank");
}

// 5. Forced mate, both signs, never as centipawns, rejected at any rank.
{
  // Mover mates: 1.f3 e5 2.g4, Black to move. Qh4# confirmed by search.
  const fool = replay("f3 e5 g4");
  eq(matePlies(fool, 1), 1, "Black mates in one after 1.f3 e5 2.g4");
  const row = { d: 20, m: [["d8h4", "Qh4#", null, 1], ["d7d5", "d5", 350, null], ["b8c6", "Nc6", 300, null]], pv: ["Qh4#"] };
  for (const e of row.m) eq(san(fool, findMove(fool, e[0])), e[1], "constructed SAN for " + e[0]);
  const mate = gradeMove(row, fool, "d8h4");
  eq(mate.verdict, "best", "Qh4#");
  eq(mate.why.kind, "mates", "Qh4# reason");
  eq(mate.mate, 1, "Qh4# mate field");
  eq(mate.cp, null, "a mate has no centipawn value");
  eq(mate.lossCp, null, "no loss is computed across a mate");
  eq(mate.after, "mating", "state after Qh4#");
  const miss = gradeMove(row, fool, "d7d5");
  eq(miss.verdict, "inferior", "missing a mate in one is rejected");
  eq(miss.why.kind, "missed-mate", "missed mate reason");
  eq(miss.lossCp, null, "the missed mate is never priced in centipawns");
  // Mover gets mated: 1.f3 e5, White to move; 2.g4 allows Qh4#. Confirmed by search.
  const pre = replay("f3 e5");
  const afterG4 = make(pre, findMove(pre, "g2g4"));
  eq(matePlies(afterG4, 1), 1, "after 2.g4 Black has mate in one");
  eq(matePlies(make(pre, findMove(pre, "e2e4")), 3), 0, "2.e4 allows no mate inside three plies");
  const listed = { d: 20, m: [["e2e4", "e4", 0, null], ["d2d4", "d4", -5, null], ["b1c3", "Nc3", -10, null], ["g1h3", "Nh3", -40, null], ["g2g4", "g4", null, -1]], pv: ["e4"] };
  const r5 = gradeMove(listed, pre, "g2g4");
  eq(r5.rank, 5, "g4 listed fifth");
  eq(r5.verdict, "losing", "g4 rejected at rank 5");
  eq(r5.why.kind, "allows-mate", "g4 reason");
  eq(r5.after, "mated", "state after g4");
  eq(r5.lossCp, null, "being mated is not a centipawn loss");
  const scored = { d: 20, m: listed.m.slice(0, 4), pv: ["e4"], x: [["g2g4", "g4", null, -1]] };
  const r0 = gradeMove(scored, pre, "g2g4");
  eq(r0.rank, 0, "g4 scored, rank 0");
  eq(r0.verdict, "losing", "g4 rejected when scored outside the five");
  // Ordering of mates: shorter beats longer, any mate beats any score, mated is
  // worse than any score.
  if (cmpScore([, , null, 1], [, , null, 3]) <= 0) bad("mate in 1 should beat mate in 3");
  if (cmpScore([, , null, 9], [, , 900, null]) <= 0) bad("any mate should beat +9.00");
  if (cmpScore([, , -900, null], [, , null, -1]) <= 0) bad("-9.00 should beat being mated");
  if (cmpScore([, , null, -5], [, , null, -2]) <= 0) bad("mated in 5 should beat mated in 2");
  ok("forced mate: both signs handled, never priced as pawns, rejected at rank 5 and at rank 0");
}

// 6. Best defence in a lost position; and the "worse, not lost" pilot row.
{
  const aus = at("e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3"); // h-austrian-5nf3: c5 -54, O-O -61
  const oo = g(aus, "O-O");
  eq(oo.verdict, "equal", "5.Nf3 O-O at 7 cp");
  eq(oo.situation, "level", "-54 is worse, not lost");
  eq(g(aus, "c5").verdict, "best", "5.Nf3 c5");
  // Genuinely lost, no mate in sight: K v K+R, Black to move. Constructed row; the
  // numbers say only "a rook down", which is the material on the board.
  const lost = fenPos("4k3/8/8/8/8/8/8/R3K3 b - - 0 1");
  const lrow = { d: 20, m: [["e8d7", "Kd7", -650, null], ["e8e7", "Ke7", -660, null], ["e8f7", "Kf7", -670, null], ["e8d8", "Kd8", -700, null], ["e8f8", "Kf8", -720, null]], pv: ["Kd7"] };
  for (const e of lrow.m) eq(san(lost, findMove(lost, e[0])), e[1], "constructed SAN for " + e[0]);
  const def = gradeMove(lrow, lost, "e8d7");
  eq(def.verdict, "best", "the best defence is best");
  eq(def.situation, "lost", "the position was lost before the move");
  eq(def.after, "lost", "and is lost after it: nothing says saved");
  const worse = gradeMove(lrow, lost, "e8f8");
  eq(worse.verdict, "concession", "Kf8 at 70 cp in a lost position");
  if (worse.verdict === "losing") bad("a move in an already-lost position must not be called losing again");
  eq(worse.after, "lost", "state after Kf8");
  // Already being mated: 6k1/8/5K2/8/8/8/8/2Q5, Black to move. Search confirms
  // Kf8 is mated next move and Kh8 / Kh7 hold out one move longer.
  const mated = fenPos("6k1/8/5K2/8/8/8/8/2Q5 b - - 0 1");
  const inMoves = (uci) => { const v = matePlies(make(mated, findMove(mated, uci)), 5); return v > 0 ? (v + 1) / 2 : 0; };
  eq(inMoves("g8f8"), 1, "after Kf8 White mates in one");
  eq(inMoves("g8h8"), 2, "after Kh8 White mates in two");
  eq(inMoves("g8h7"), 2, "after Kh7 White mates in two");
  const mrow = { d: 20, m: [["g8h8", "Kh8", null, -2], ["g8h7", "Kh7", null, -2], ["g8f8", "Kf8", null, -1]], pv: ["Kh8"] };
  const hold = gradeMove(mrow, mated, "g8h7");
  eq(hold.verdict, "best", "the longest defence ties for best");
  eq(hold.why.kind, "already-lost", "reason says the position was already lost");
  eq(hold.situation, "mated", "state before");
  eq(hold.after, "mated", "state after: not saved");
  const fast = gradeMove(mrow, mated, "g8f8");
  eq(fast.verdict, "inferior", "walking into the quicker mate");
  if (fast.verdict === "losing") bad("already mated must not become losing");
  eq(fast.lossCp, null, "no centipawn loss between two mates");
  // Real rows for the two decisive-margin overrides.
  const ne4 = lineAt("syn-ne4", 18);        // Bxe4 189, dxc5 74, b4 -269
  const b4 = gradeMove(ne4.row, ne4.p, "b3b4");
  eq(b4.verdict, "losing", "syn-ne4 ply 18 b4");
  eq(b4.why.kind, "now-lost", "b4 crosses into lost");
  eq(b4.situation, "level", "before b4 the position was not lost");
  const oh26 = lineAt("ohanlon", 26);       // h4 312, g4 50, Re4 -62, h3 -160
  eq(gradeMove(oh26.row, oh26.p, "g2g4").verdict, "inferior", "ohanlon ply 26 g4");
  eq(gradeMove(oh26.row, oh26.p, "g2g4").why.kind, "threw-win", "g4 throws a decisive advantage");
  eq(gradeMove(oh26.row, oh26.p, "h2h3").after, "level", "h3 throws the win without losing");
  const oh30 = lineAt("ohanlon", 30);       // h5+ 587, Qd3+ 580, ..., Re1 -348
  eq(gradeMove(oh30.row, oh30.p, "d1d3").verdict, "equal", "ohanlon ply 30 Qd3+ inside the band");
  eq(gradeMove(oh30.row, oh30.p, "d1d3").situation, "won", "and the position is won");
  eq(gradeMove(oh30.row, oh30.p, "e6e1").verdict, "losing", "Re1 from +587 to -348");
  const oh32 = lineAt("ohanlon", 32);       // Qd3 943, Rxd6 597: still winning, 346 cp worse
  const rx = gradeMove(oh32.row, oh32.p, oh32.mv[0]);
  eq(rx.verdict, "inferior", "the game's Rxd6 against the engine's Qd3");
  eq(rx.after, "won", "and still winning after it");
  ok("lost positions: best defence is best and never saved; decisive margins override the bands");
}

// 7. Drilled move in band but a measured concession: loss decides, not rank.
{
  const door = at("d4 c5");                  // d5 54, e4 21, dxc5 17, e3 17, c3 12
  const e3 = g(door, "e3");
  eq(e3.rank, 4, "2.e3 is ranked fourth");
  eq(e3.lossCp, 37, "2.e3 is 37 cp behind 2.d5");
  eq(e3.verdict, "concession", "2.e3 is a concession by loss, not equal by rank");
  eq(g(door, "e4").verdict, "concession", "2.e4 at 33 cp");
  // The line's own tabiya move: hip-150 ply 13 Ne7, scored 18 cp behind h5
  // (best h5 -68, Ne7 -86). It is inside the equal band, so the line's own move
  // is not a concession - what the gate refuses is the formation *credit*, not
  // the move.
  const tab = lineAt("hip-150", 13);
  const ne7 = gradeMove(tab.row, tab.p, tab.mv[0]);
  eq(ne7.reason, "scored", "hip-150 Ne7 scored");
  eq(ne7.lossCp, 18, "Ne7 loss");
  eq(ne7.verdict, "equal", "Ne7 is inside the equal band");
  ok("a drilled move 37 cp behind is a concession whatever its rank");
}

// 8. One key, two histories: the record attaches to the key.
{
  const a = at("d4 d5 Nf3 Nf6 e3 e6"), b = at("d4 Nf6 Nf3 e6 e3 d5");
  eq(posKey(a.p), posKey(b.p), "both orders share the key");
  eq(JSON.stringify(g(a, "Bd3")), JSON.stringify(g(b, "Bd3")), "identical record from both doors");
  const c = at("e4 g6 d4"), d = at("d4 g6 e4");
  eq(JSON.stringify(g(c, "d6")), JSON.stringify(g(d, "d6")), "h-modern-2d4: identical record from both doors");
  eq(g(c, "d6").verdict, "equal", "...d6 at 7 cp behind Bg7");
  ok("one key, two histories: the grade is a function of the key alone");
}

// 9. A key shared with a deliberate-mistake line: trap's 4.c3 has a number now.
{
  const bf5 = at("d4 d5 Nf3 Nf6 e3 Bf5"); // c4 25, Bd3 13, Be2 13, Bd2 3, b3 2; x: c3 -11
  const c3 = g(bf5, "c3");
  eq(c3.reason, "scored", "4.c3 was searched on its own");
  eq(c3.lossCp, 36, "4.c3 loss");
  eq(c3.verdict, "concession", "4.c3 is a concession: not repertoire credit, not a blunder");
  if (GRADE.reject.includes(c3.verdict)) bad("4.c3 must not be called a blunder");
  eq(g(bf5, "c4").verdict, "best", "anti's 4.c4");
  eq(g(bf5, "Bd3").verdict, "equal", "soltis's 4.Bd3, the move soltis-trap also plays here");
  ok("mistake-line key: 4.c3 grades on its own number, and nothing here knows which line played it");
}

// 10. keyFen vs fen: eight pilot keys differ in the en-passant field.
{
  const eight = ["d4 e5", "d4 d5 Nf3 Nf6 e3 e6 Bd3 c5", "d4 c5", "e4", "d4 e6 c4", "e4 g6 d4", "e4 g6 h4", "e4 d6 f4"];
  for (const s of eight) {
    const p = replay(s), k = posKey(p);
    if (k === fenOf(p)) bad(`${s}: expected the key to drop the ep square`);
    if (!EVL[k]) bad(`${s}: no row under posKey`);
    if (EVL[fenOf(p)]) bad(`${s}: a row exists under the raw fen, so keying on fen would silently work here`);
    eq(gradeMove(EVL[k], p, legal(p)[0]).key, k, `${s}: record keyed on posKey`);
  }
  ok("eight pilot keys differ from their fen and are found only under posKey");
}

// 11. Nothing from the frequency record can enter a verdict.
{
  eq(gradeMove.length, 3, "gradeMove takes row, pos, move and nothing else");
  const rare = at("d4 Nf6 Nf3 e6 e3 Bb4+"), common = at("e4");
  const decoy = (row, n) => Object.assign(JSON.parse(JSON.stringify(row)), { games: n, share: 0.5, parent_games: n });
  eq(JSON.stringify(gradeMove(decoy(rare.row, 7), rare.p, "b1d2")), JSON.stringify(g(rare, "Nbd2")), "c-bogo-check graded the same with a 7-game decoy on the row");
  eq(JSON.stringify(gradeMove(decoy(common.row, 291474), common.p, "c7c5")), JSON.stringify(g(common, "c5")), "h-after-1e4 graded the same with a 291,474-game decoy");
  eq(g(rare, "Nbd2").verdict, "best", "4.Nbd2");
  eq(g(rare, "c3").verdict, "equal", "4.c3 at 5 cp");
  eq(g(rare, "Bd2").verdict, "equal", "4.Bd2 at 17 cp");
  eq(g(rare, "Nc3").verdict, "concession", "4.Nc3 at 40 cp");
  const storm = at("e4 g6 h4");
  eq(g(storm, "c5").verdict, "best", "2.h4 c5");
  eq(g(storm, "h5").verdict, "unknown", "2.h4 h5 is not in the stored five: unknown, not wrong");
  ok("frequency cannot reach the verdict");
}

// 12. The hip-150 setup-credit defect: the gate fires where a position is
//     demanding and stays open where the wall really can go up in any order.
//     The storm tabiya is demanding at depth 20 only. There ...h5 is first and
//     ...Nd7 11 cp behind; at depth 28 (src/data/deep.js) ...Nd7 -61 and ...h5
//     -62 are one centipawn apart with the wall move first. The gate refuses only
//     where both depths say demanding, so it is open at the tabiya. The depth-20
//     refusal is still pinned on a copy of the row, which the deeper search does
//     not apply to (it attaches to the shipped row object only).
{
  const tab = lineAt("hip-150", 13);
  eq(posKey(tab.p), "rn1qk1nr/pbp2pbp/1p1pp1p1/8/3PP1P1/2N1BP2/PPPQ3P/R3KBNR b KQkq - 0 1", "the tabiya key");
  eq(tab.row.m[0][1], "h5", "depth 20: the row's first choice is ...h5");
  const deep = DEEP[posKey(tab.p)];
  eq(deep.d, 28, "the tabiya has a depth-28 row");
  eq(deep.m[0][1] + " " + deep.m[0][2], "Nd7 -61", "depth 28: first choice ...Nd7 -61");
  eq(deep.m[1][1] + " " + deep.m[1][2], "h5 -62", "depth 28: ...h5 -62 second");
  const mv = (s) => legal(tab.p).find((x) => san(tab.p, x) === s);
  // The structural half alone reproduces the defect: three wall moves qualify,
  // the three prescribed counters do not.
  for (const s of ["Nd7", "a6", "h6"]) if (!isSetupMove(HIPPO_T, tab.p, mv(s))) bad(`${s} should be a formation move`);
  for (const s of ["h5", "c5", "d5"]) if (isSetupMove(HIPPO_T, tab.p, mv(s))) bad(`${s} should not be a formation move`);
  // Depth 20 alone refuses all three wall moves because the position is demanding.
  const d20 = JSON.parse(JSON.stringify(tab.row));
  for (const s of ["Nd7", "a6", "h6"]) {
    const r = setupGate(d20, tab.p, mv(s), HIPPO_T);
    eq(r.credit, false, `depth 20 alone: tabiya ${s} credit`);
    eq(r.reason, "demanding", `depth 20 alone: tabiya ${s} reason`);
    if (!r.grade) bad(`tabiya ${s} should carry its grade`);
  }
  eq(setupGate(d20, tab.p, mv("Nd7"), HIPPO_T).grade.verdict, "equal", "depth 20 alone: ...Nd7 grades equal (11 cp)");
  // Both depths: depth 28 has a wall move first, so the gate is open.
  const nd7 = setupGate(tab.row, tab.p, mv("Nd7"), HIPPO_T);
  eq(nd7.reason, "in-band", "...Nd7 credited: first choice at depth 28");
  eq(nd7.grade.verdict + " " + nd7.grade.why.depth, "best 28", "...Nd7 graded best on its depth-28 number");
  eq(setupGate(tab.row, tab.p, mv("a6"), HIPPO_T).reason, "in-band", "...a6 credited: 16 cp behind at depth 20, 28 at depth 28");
  eq(setupGate(tab.row, tab.p, mv("h6"), HIPPO_T).reason, "unanalysed", "...h6 is searched at neither depth");
  eq(setupGate(tab.row, tab.p, mv("h6"), HIPPO_T).grade.verdict, "unknown", "...h6 is unanalysed here");
  eq(gradeMove(tab.row, tab.p, mv("h5")).verdict, "best", "...h5 is best at depth 20 (1 cp behind at depth 28)");
  eq(setupGate(tab.row, tab.p, mv("h5"), HIPPO_T).reason, "not-target", "...h5 is graded, not setup-credited");
  // The note's other two prescribed counters were unknown until they were given
  // searches of their own through --force (research/named-moves.tsv). They now
  // grade on their numbers: d5 -93 is 25 behind, c5 -120 is 52 behind. So the
  // note lists three counters as equals when one of them costs half a pawn.
  eq(gradeMove(tab.row, tab.p, mv("d5")).verdict, "equal", "...d5 is equal");
  eq(gradeMove(tab.row, tab.p, mv("d5")).lossCp, 25, "...d5 loss");
  eq(gradeMove(tab.row, tab.p, mv("c5")).verdict, "concession", "...c5 is a concession");
  eq(gradeMove(tab.row, tab.p, mv("c5")).lossCp, 52, "...c5 loss");
  // hip66 plies 21 and 25 (best ...a5, ...f5) are demanding in the same way.
  for (const [id, ply, s] of [["hip66", 21, "a6"], ["hip66", 25, "a6"]]) {
    const x = lineAt(id, ply);
    const m = legal(x.p).find((y) => san(x.p, y) === s);
    if (!m) { bad(`${id}:${ply} ${s} illegal`); continue; }
    eq(setupGate(x.row, x.p, m, HIPPO_T).reason, "demanding", `${id}:${ply} ...${s}`);
  }
  // hip-150 ply 11 is different: the table has c5 -78 and Nd7 -78 tied, so a wall
  // move is a joint first choice and the gate stays open. The ledger's "same
  // failure at ply 11" is not what the stored numbers say.
  const p11 = lineAt("hip-150", 11);
  const m11 = (s) => legal(p11.p).find((x) => san(p11.p, x) === s);
  eq(p11.row.m[0][1], "c5", "ply 11 first entry");
  eq(p11.row.m[1][2], p11.row.m[0][2], "ply 11 Nd7 ties c5 to the centipawn");
  eq(setupGate(p11.row, p11.p, m11("Nd7"), HIPPO_T).reason, "in-band", "ply 11 ...Nd7 credited as a joint first choice");
  eq(setupGate(p11.row, p11.p, m11("a6"), HIPPO_T).reason, "in-band", "ply 11 ...a6 at 7 cp credited");
  eq(setupGate(p11.row, p11.p, m11("h6"), HIPPO_T).reason, "unanalysed", "ply 11 ...h6 unanalysed");
  // Where the wall can go up in any order: hip-e4 ply 5 (1.e4 g6 2.d4 Bg7 3.Nc3),
  // whose first choice is the wall move ...a6.
  const open = lineAt("hip-e4", 5);
  eq(open.row.m[0][1], "a6", "3.Nc3 row's first choice is a wall move");
  const om = (s) => legal(open.p).find((x) => san(open.p, x) === s);
  eq(setupGate(open.row, open.p, om("a6"), HIPPO_T).reason, "in-band", "3...a6 credited");
  eq(setupGate(open.row, open.p, om("d6"), HIPPO_T).reason, "in-band", "3...d6 credited");
  eq(setupGate(open.row, open.p, om("b6"), HIPPO_T).reason, "in-band", "3...b6 credited on its scored number");
  eq(setupGate(open.row, open.p, om("h6"), HIPPO_T).reason, "unanalysed", "3...h6 falls to the caller's material brake");
  eq(setupGate(open.row, open.p, om("Nf6"), HIPPO_T).reason, "not-target", "3...Nf6 is not a wall move");
  eq(setupGate(open.row, open.p, om("a6"), []).reason, "no-targets", "a line without targets credits nothing");
  eq(setupGate(null, open.p, om("a6"), HIPPO_T).reason, "no-row", "no row: nothing to gate on");
  // Over every drill ply of every HIPPO_T line, count what the gate does to each
  // legal wall move, so the balance is visible and never a surprise.
  const tally = {};
  let credited = 0, refusedDemanding = 0, plies = 0, demandingPlies = 0;
  for (const l of LINES.filter((x) => x.targets === HIPPO_T)) {
    let p = startPos();
    l.moves.forEach((m0, i) => {
      if (i % 2 === 1) {
        plies++;
        let dem = false;
        for (const m of legal(p)) {
          if (!isSetupMove(HIPPO_T, p, m)) continue;
          const r = setupGate(EVL[posKey(p)], p, m, HIPPO_T);
          tally[r.reason] = (tally[r.reason] || 0) + 1;
          if (r.credit) credited++;
          if (r.reason === "demanding") { refusedDemanding++; dem = true; }
        }
        if (dem) demandingPlies++;
      }
      p = make(p, findMove(p, m0[0]));
    });
  }
  if (!credited) bad("the gate should still credit wall moves somewhere");
  if (!refusedDemanding) bad("the gate should refuse wall moves somewhere");
  ok(`hip-150 gate: demanding only where both depths say so, open where order is free (${plies} Hippo drill plies, ${demandingPlies} demanding; wall moves ${JSON.stringify(tally)})`);
}

// 13. Every drilled move in the repertoire has a verdict, and the counts are the
//     ones research/GRADING.md quotes.
{
  const counts = {};
  let n = 0;
  for (const l of LINES) {
    let p = l.start === START ? startPos() : fenPos(l.start);
    l.moves.forEach((mv, i) => {
      const m = findMove(p, mv[0]);
      if (!m) return;
      if ((i % 2 === 0 ? "w" : "b") === l.you) {
        n++;
        const r = gradeMove(EVL[posKey(p)], p, m);
        counts[r.verdict] = (counts[r.verdict] || 0) + 1;
        if (r.analysis !== "checked") bad(`${l.id}:${i} ${mv[1]} has no analysis`);
      }
      p = make(p, m);
    });
  }
  eq(n, 605, "drilled moves");
  eq(counts.unknown || 0, 0, "unknown drilled moves");
  // No drilled move reaches the lost region any more. The W4 content audit
  // deleted syn-greek (its Bxh7+ was -269 in a position kolt reaches and
  // answers with the best move) and cut syn-h4 to the ten plies the table
  // accepts, so nothing the trainer asks the user to play is a move the
  // shipped analysis calls lost.
  eq(counts.losing || 0, 0, "losing drilled moves");
  // 486 and 28 on the depth-20 table alone. Five drilled moves that depth 20
  // prices as concessions are accepted at depth 28 (cz:14 Ne5, anti:10 c5,
  // ohanlon:34 Nxf7+, hip-g16:21 ...Qe8, syn-hiph5:15 ...Rxh5), and a move either
  // depth accepts is accepted: 491 and 23. The W6 content batch added 89 drilled
  // moves, every one best or equal (research/W6-content-batch.md): 580 and 23.
  eq(counts.best + counts.equal, 580, "best+equal drilled moves");
  eq(counts.concession, 23, "concession drilled moves");
  // The only two left outside accept are meant to be: ohanlon's Rxd6 is a real
  // game move in a position the table still scores as won, and syn-hipdown is
  // the deliberate-mistake line doing its job.
  eq(counts.inferior, 2, "inferior drilled moves");
  ok(`all ${n} drilled moves graded: ${JSON.stringify(counts)}`);
}

// 14. The deeper search (src/data/deep.js): at a deep-checked position a move
//     gets the more generous of its two verdicts, and where the depths disagree
//     on accepting it the record says so with both stored numbers.
{
  for (const k of Object.keys(DEEP)) if (!EVL[k]) bad(`DEEP row without an EVL row: ${k}`);
  // syn-hiph5 ply 15: ...Qh4+ -14 / ...Rxh5 -52 at depth 20, -25 / -40 at depth 28.
  const r15 = lineAt("syn-hiph5", 15);
  const rx = gradeMove(r15.row, r15.p, r15.mv[0]);
  eq(rx.verdict + " " + rx.why.depth + " " + rx.lossCp, "equal 28 15", "...Rxh5: equal on the depth-28 number");
  eq(JSON.stringify(rx.split), JSON.stringify([
    { d: 20, verdict: "concession", cp: -52, mate: null, lossCp: 38 },
    { d: 28, verdict: "equal", cp: -40, mate: null, lossCp: 15 }]), "...Rxh5: both depths carried");
  eq(gradeRow(r15.row, r15.p, r15.mv[0]).verdict, "concession", "...Rxh5 on depth 20 alone");
  // hip-150 ply 13: the line's own ...Ne7 is 18 behind at depth 20 and 53 at
  // depth 28. Depth 20 accepts it, so it stays accepted, on the depth-20 record.
  const tab = lineAt("hip-150", 13);
  const ne7 = gradeMove(tab.row, tab.p, tab.mv[0]);
  eq(ne7.verdict + " " + ne7.why.depth + " " + ne7.lossCp, "equal 20 18", "...Ne7 keeps its depth-20 equal");
  eq(ne7.split && ne7.split[1].verdict, "concession", "...Ne7: depth 28 disagrees and the record says so");
  // Outside the deep set nothing changes: 1.d4 e6 has no depth-28 row.
  const plain = at("d4 e6");
  if (DEEP[posKey(plain.p)]) bad("1.d4 e6 was expected to be outside the deep set");
  for (const s of ["Nf3", "e4", "c4"])
    eq(JSON.stringify(g(plain, s)), JSON.stringify(gr(plain, s)), `outside the deep set gradeMove is gradeRow (${s})`);
  // A copy of a shipped row is a different row: the deeper search attaches to
  // the shipped object only, so constructed and copied rows grade on themselves.
  eq(gradeMove(JSON.parse(JSON.stringify(r15.row)), r15.p, r15.mv[0]).verdict, "concession", "a copied row is graded alone");
  ok("deep rows: more generous verdict, disagreement carried, nothing changes outside the set");
}

console.log(fail ? `\n${fail} check(s) failed.` : "\nAll w2b grading checks passed.");
process.exit(fail ? 1 : 0);

// W5-B: the calibrated band edges, pinned. GRADING.md documents equal <= 30,
// concession <= 70 and decisive 200, all inclusive. An off-by-one here would
// silently reclassify moves at the boundary, which is exactly where the
// calibration put the interesting ones (32, 37, 38 cp).
{
  const p = fenPos("rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1");
  const pick = (t) => { const m = legal(p).find((x) => san(p, x).replace(/[+#]/g, "") === t); return [uciOf(m), t, m]; };
  const [bu, bs] = pick("d5"), [tu, ts, tm] = pick("Nf6");
  const at = (loss) => gradeMove({ d: 20, m: [[bu, bs, 0, null], [tu, ts, -loss, null]], pv: [bs] }, p, tm).verdict;
  for (const [loss, want] of [[0, "best"], [29, "equal"], [30, "equal"], [31, "concession"],
                              [69, "concession"], [70, "concession"], [71, "inferior"],
                              [199, "inferior"], [200, "losing"], [400, "losing"]])
    eq(at(loss), want, `loss ${loss} grades ${want}`);
  eq(GRADE.equal, 30, "equal band"); eq(GRADE.concession, 70, "concession band");
  eq(GRADE.decisive, 200, "decisive margin");
  ok("band edges: 30 and 70 inclusive, 200 decisive, no off-by-one");
}
