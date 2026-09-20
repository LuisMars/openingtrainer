#!/usr/bin/env node
// Engine regressions for wave 1, lane B. Runs against docs/ (build first), the
// same way test/verify.mjs does, so what is tested is what ships.
//
// Covers, in order: the castling check/mate suffix, quiescence at a node where
// the side to move is in check, promotion valuation, position identity
// (en passant and castling rights), and the "this move is not in the table"
// path that grading must treat as neutral rather than bad.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "docs/index.html"), "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const bundle = js.slice(0, js.indexOf("/* ================= state ================= */"));
const ctx = {};
new Function("ctx", bundle + "\nObject.assign(ctx,{LINES,START,startPos,fenPos,findMove,make,san,legal,uciOf,inCheck,fenOf,matBal,matGain,matQuiesce,matVerdict,posKey,candidateEval,EVL});")(ctx);
const { LINES, START, startPos, fenPos, findMove, make, san, legal, uciOf, inCheck,
  fenOf, matGain, matQuiesce, matVerdict, posKey, candidateEval, EVL } = ctx;

let fail = 0;
const bad = (m) => { console.error("  ✗ " + m); fail++; };
const eq = (got, want, what) => { if (got !== want) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };
const sanOf = (fen, uci) => { const p = fenPos(fen); const m = findMove(p, uci); return m ? san(p, m) : "ILLEGAL"; };

// 1. Castling notation carries the check and mate suffix like any other move.
eq(sanOf("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", "e1g1"), "O-O", "quiet kingside castling");
eq(sanOf("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", "e1c1"), "O-O-O", "quiet queenside castling");
eq(sanOf("5k2/8/8/8/8/8/8/4K2R w K - 0 1", "e1g1"), "O-O+", "kingside castling with check");
eq(sanOf("2rkr3/R7/8/2N1N3/8/8/8/R3K3 w Q - 0 1", "e1c1"), "O-O-O#", "queenside castling with mate");
// Black castles too, and the rook, not the king, is what gives the check.
eq(sanOf("r3k3/8/8/8/8/3K4/8/8 b q - 0 1", "e8c8"), "O-O-O+", "black queenside castling with check");
// Nothing shipped in LINES or PZ castles into check, so this changes no stored
// notation; if a future line does, test/verify.mjs will say so.
if (!fail) console.log("✓ castling notation takes the check and mate suffix");

// 2. Quiescence at a node where the side to move is in check.
//    Black is in check from the knight on f7 and every evasion is a quiet king
//    move, so the old captures-only quiescence saw nothing and returned stand-pat
//    (+1). Searching the evasions finds Nxd8 and the real -8.
{
  const p = fenPos("3q3k/5N2/8/8/8/8/8/5RK1 b - - 0 1");
  if (!inCheck(p)) bad("test position should have Black in check");
  if (legal(p).some((m) => p.b[m.t])) bad("test position should have no capture evasions");
  eq(matQuiesce(p, -1000, 1000, 0, 0, -1), -8, "quiescence sees quiet check evasions");
}
//    And a node in check must not cut on stand-pat: here stand-pat is -1, so the
//    old code returned it against beta -500 as if it were a bound it could claim.
//    The captures-resolved truth is +4 (Qxa8), which is what the bound must rest on.
{
  const p = fenPos("R6k/1R6/8/8/8/8/q7/6K1 b - - 0 1");
  if (!inCheck(p)) bad("test position should have Black in check");
  eq(matQuiesce(p, -1000, 1000, 0, 0, -1), 4, "quiescence resolves the capture in check");
  const s = matQuiesce(p, -1000, -500, 0, 0, -1);
  if (s < -500) bad(`in-check fail-high should rest on a searched score, got ${s}`);
}
if (!fail) console.log("✓ quiescence searches check evasions instead of standing pat");

// 3. Promotions are valued as the promoted piece, not as the victim alone.
{
  const p = fenPos("2k5/8/8/8/8/8/7p/K3R1R1 b - - 0 1");
  const gains = {};
  for (const m of legal(p)) if (m.p) gains[uciOf(m)] = matGain(p, m);
  eq(gains["h2h1q"], 8, "quiet queen promotion is worth a queen less the pawn");
  eq(gains["h2h1n"], 2, "quiet knight promotion is worth a knight less the pawn");
  eq(gains["h2g1q"], 13, "capture-promotion counts victim and promotion");
  // A quiet promotion used to be invisible to quiescence (victim 0 meant "skip").
  const q = fenPos("8/P7/8/8/8/8/7k/K7 w - - 0 1");
  eq(matQuiesce(q, -1000, 1000, 0, 0, -1), 9, "quiescence plays out a quiet promotion");
}
if (!fail) console.log("✓ promotions are valued as the promoted piece");

// 4. Position identity: en passant only when it is real, castling rights kept.
const replay = (sans) => {
  let p = startPos();
  for (const t of sans) {
    const m = legal(p).find((x) => san(p, x).replace(/[+#]/g, "") === t);
    if (!m) throw new Error("illegal " + t);
    p = make(p, m);
  }
  return p;
};
{
  const afterE4 = replay(["e4"]);
  if (fenOf(afterE4).indexOf(" e3 ") < 0) bad("fenOf should record the double-push square");
  if (posKey(afterE4).indexOf(" e3 ") >= 0) bad("posKey should drop an ep square no pawn can use");
  // Same board, two move orders: one arrives via a double push, one does not.
  eq(posKey(replay(["e4", "Nf6", "Nf3", "Ng8", "Ng1", "Nf6"])),
     posKey(replay(["Nf3", "Nf6", "Ng1", "Ng8", "e4", "Nf6"])),
     "transposed positions share one key");
  // A genuinely available en-passant capture stays in the key.
  const epLive = replay(["e4", "d5", "e5", "f5"]);
  if (!legal(epLive).some((m) => m.ep)) bad("test position should allow an en-passant capture");
  if (posKey(epLive).indexOf(" f6 ") < 0) bad("posKey should keep a usable ep square");
  // Castling rights are identity and are never handed back.
  const rightsGone = replay(["e4", "e5", "Ke2", "Ke7", "Ke1", "Ke8"]);
  const rightsIntact = replay(["e4", "e5", "Nf3", "Nf6", "Ng1", "Ng8"]);
  if (posKey(rightsGone) === posKey(rightsIntact)) bad("lost castling rights must change the key");
  if (posKey(rightsGone).indexOf("KQkq") >= 0) bad("castling rights were re-granted");
  // posKey must be what EVL was built on: every trained position has a row.
  let missing = 0, seen = 0;
  for (const l of LINES) {
    let p = l.start === START ? startPos() : fenPos(l.start);
    l.moves.forEach((mv, i) => {
      const m = findMove(p, mv[0]);
      if (!m) return;
      if ((i % 2 === 0 ? "w" : "b") === l.you) { seen++; if (!EVL[posKey(p)]) missing++; }
      p = make(p, m);
    });
  }
  if (missing) bad(`${missing}/${seen} trained positions have no EVL row under posKey`);
  if (!fail) console.log(`✓ position identity holds (ep, castling, ${seen} trained positions key into EVL)`);
}

// 5. candidateEval: "not in the table" is an answer, not a penalty.
{
  const p = startPos();
  const row = EVL[posKey(p)];
  if (!row) bad("the start position should have a stored row");
  const best = candidateEval(row, p, findMove(p, "g1f3"));
  eq(best.known, true, "engine first choice is known");
  eq(best.rank, 1, "engine first choice ranks first");
  eq(best.reason, "listed", "engine first choice reason");
  const other = candidateEval(row, p, "e2e4");
  eq(other.known, true, "a listed move given as uci is known");
  if (other.rank < 2) bad("e4 should not rank first in the stored start-position row");
  const off = candidateEval(row, p, findMove(p, "a2a3"));
  eq(off.known, false, "a move outside the five is not known");
  eq(off.reason, "unanalysed", "a move outside the five reads as unanalysed");
  eq(off.entry, null, "an unanalysed move carries no entry to misread as a score");
  if (off.best !== row.m[0]) bad("an unanalysed move should still report the row's best");
  eq(off.depth, row.d, "an unanalysed move still reports the row depth");
  const none = candidateEval(null, p, "a2a3");
  eq(none.known, false, "no row means not known");
  eq(none.reason, "no-row", "no row is distinguished from unanalysed");
  eq(none.best, null, "no row has no best move");
  // The real reason this matters: repertoire moves that sit outside their row's
  // ranked five. tools/build-evals.mjs now searches each of those on its own and
  // stores it in row.x, so they must come back "scored" - known, with an entry,
  // and with rank 0, because having a number is not the same as having a rank.
  // Nothing may read rank 0 as "worst"; it means "not ranked".
  let scored = 0, unanalysed = 0;
  for (const l of LINES) {
    let p2 = l.start === START ? startPos() : fenPos(l.start);
    l.moves.forEach((mv, i) => {
      const m = findMove(p2, mv[0]);
      if (!m) return;
      if ((i % 2 === 0 ? "w" : "b") === l.you) {
        const c = candidateEval(EVL[posKey(p2)], p2, m);
        if (c.reason === "scored") {
          scored++;
          if (!c.known || !c.entry || c.rank !== 0) bad(`${l.id}:${i} bad scored shape`);
        } else if (!c.known) {
          unanalysed++;
          if (c.reason !== "unanalysed" || c.entry !== null) bad(`${l.id}:${i} bad unanalysed shape`);
        }
      }
      p2 = make(p2, m);
    });
  }
  const outside = scored + unanalysed;
  if (!outside) bad("expected some repertoire moves to sit outside their row's five");
  if (unanalysed) bad(`${unanalysed} repertoire drill moves still have no score; build-evals should have searched each one`);
  if (!fail) console.log(`✓ candidateEval scores all ${outside} repertoire moves outside the ranked five, never marks them bad`);
}

// 6. The material search still does its job: refute a real blunder, stay quiet
//    on a sound move. Depths are now 4 plies on both sides of the comparison.
{
  const p = replay(["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"]);
  const blunder = matVerdict(p, findMove(p, "f3e5"));   // Nxe5?? Nxe5
  if (!blunder) bad("Nxe5 verdict ran out of budget");
  else if (blunder.swing < 1) bad(`Nxe5 should cost material, swing ${blunder.swing}`);
  const sound = matVerdict(p, findMove(p, "d2d3"));      // a quiet book move
  if (sound && sound.swing >= 1) bad(`d3 should not be refuted, swing ${sound.swing}`);
  if (!fail) console.log("✓ material search refutes a blunder and stays silent on a sound move");
}

console.log(fail ? `\n${fail} check(s) failed.` : "\nAll w1b engine checks passed.");
process.exit(fail ? 1 : 0);
