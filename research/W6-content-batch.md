# W6 — the next content batch: ranking, cut-off, and what was built

The coverage matrix listed 235 counted opponent replies with no line (88 covered,
14 transposing). This note ranks them, states where the batch stopped and why,
and records the fifteen lines built. After the batch the matrix reads
**covered 102, transposes 16, missing 219**.

Frequency is not quality. Nothing here says a common move is good or a rare one
bad; the three factors are kept apart as METHOD.md requires and never combined
into a score.

## 1. How the ranking was computed

**Reach, not conditional share.** For every `missing` reply in the three
rating-band files (`research/freq-{colle,hippo}-player-{u1500,1500-1899,1900}.json`)
the probability of meeting it was taken as the product of the opponent's
conditional shares along the path from the start, with the learner's own moves
passed through at probability 1. For the Colle that is "per game in which the
learner opens 1.d4"; for the Hippopotamus "per game the learner plays Black".
The default band is 1500–1899; the other two are printed beside it.

**Whose move order.** The learner's own moves were taken only from lines that are
not `eco`. Without that filter the top of the list is `1.Nf3 d5` (35% reach),
`1.Nf3 e6` and the Bf4/Bg5 orders, which exist only because `eco-rham`,
`eco-london` and `eco-torre` are recognition lines for sister systems. A player
who opens 1.d4 does not meet them. They are excluded, not hidden: 1.Nf3 d5 still
reads `missing` in the matrix.

**What follows a gap.** The probe tree has no data past an unanswered reply
(METHOD.md, "blind spot"). The opponent's continuations in the new lines were
chosen from a literal move-order count of the same dump, same bands:
`tools/count-prefix.mjs` (new). It matches SAN text, not positions, so its
counts are floors for the position. Every such count quoted in a note says
"games in the band" and is from this tool.

## 2. The ranking (1500–1899 reach; u1500 / 1900+ beside it)

| # | gap | reach | u1500 | 1900+ | disposition |
|---|---|---|---|---|---|
| 1 | 1.e4 d6 2.Nf3 | 16.84% (2,907/10,411) | 16.37% | 8.49% | **built** `h-d6nf3` (conditional on the learner choosing 1...d6) |
| 2 | 1.e4 g6 2.Bc4 | 5.89% (876/8,962) | 9.37% | 1.21% | **built** `h-bc4`, with 3.Qf3 (220 of 736 at the next node) |
| 3 | 1.e4 d6 2.f4 | 5.25% | 2.16% | 3.03% | **built** `h-d6f4` (§7) |
| 4 | 1.e4 d6 2.Bc4 | 5.16% | 8.47% | 0.94% | **built** `h-d6bc4` (§7) |
| 5 | 1.e4 g6 2.f4 | 4.90% (728/8,962) | 2.15% | 3.68% | **built** `h-f4` |
| 6 | 1.e4 d6 2.d4 Nf6 3.Bd3 | 4.50% | 2.27% | 6.36% | **built** `h-d6bd3` (§7) |
| 7 | 1.d4 d5 2.Nf3 c6 | 4.40% (830/8,159) | 2.57% | 6.08% | **built** `c-2c6` |
| 8 | 1.d4 d6 | 4.39% (4,830/109,938) | 3.93% | 6.86% | **built** `c-1d6` |
| 9 | 1.e4 g6 2.Nf3 Bg7 3.Bc4 | 3.85% (505/2,000) | 4.24% | 1.05% | **built** `h-nf3bc4` |
| 10 | 1.d4 b6 | 3.72% (4,093/109,938) | 2.63% | 3.71% | **built** `c-1b6` |
| 11 | 1.d4 d5 2.Nf3 Bf5 | 3.44% (649/8,159) | 3.68% | 1.29% | **built** `c-2bf5` |
| 12 | 1.d4 c6 | 3.38% (3,721/109,938) | 2.21% | 3.85% | **built** `c-1c6` |
| 13 | 1.d4 g6 2.Nf3 | 3.37% (728/5,419) | 2.32% | 5.02% | **built** `h-d4nf3` |
| 14 | 1.e4 d6 2.Nc3 | 3.14% | 3.02% | 2.74% | not built: no Hippopotamus move in the band (§7) |
| 15 | 1.e4 d6 2.d3 | 3.05% | 2.64% | 1.01% | **built** `h-d6d3` (§7) |
| 16 | 1.e4 g6 2.d3 | 2.83% | 2.90% | 1.98% | not built: folds into `h-2nf3`'s shape |
| 17 | 1.e4 g6 2.Nc3 | 2.82% | 2.88% | 3.07% | not built: 2...Bg7 3.d4 is the main line |
| 18 | 1.e4 g6 2.d4 Bg7 3.c3 | 2.73% | 1.76% | 3.25% | not built: no decision, the wall goes up |
| 19 | 1.d4 d5 2.Nf3 e6 3.e3 c5 | 2.57% | 2.41% | 1.67% | not built: 4.Bd3 Nf6 rejoins `ck` |
| 20 | 1.d4 e5 | 2.40% (2,640/109,938) | 3.15% | 2.57% | **built** `c-englund` (also critical, §4) |
| 21 | 1.e3 | 2.40% | 4.65% | 1.67% | not built: folded into `h-g3` in batch 3 |
| 22 | 1.d4 d5 2.Nf3 c5 | 2.27% (428/8,159) | 2.29% | 1.11% | **built** `c-2c5` (also critical, §4) |
| 23 | 1.e4 g6 2.d4 Bg7 3.Be3 | 2.25% | 0.83% | 2.52% | not built: joins the Be3 tabiya after Nc3 |
| 24 | 1.d4 g6 2.e3 | 2.24% | 3.35% | 1.15% | not built: same shape as `h-d4nf3` |
| 25 | 1.d4 d5 2.Nf3 Bg4 | 2.20% (415/8,159) | 3.80% | 0.44% | **built** `c-2bg4` |
| — | *cut-off* | | | | |
| 26 | 1.d4 e6 2.Nf3 c5 | 1.99% | 1.84% | 0.71% | next |
| 27 | 1.d4 d5 2.Nf3 Nc6 3.e3 Nf6 | 1.93% | 4.11% | 0.50% | next |

## 3. The cut-off, and the rows above it that were not built

The batch stops at 2.20% (row 25). The next row is 1.99% (1...e6 2.Nf3 c5), and below it every gap is under 2%
in the default band, most of them Colle move orders that rejoin a line within
two moves or Hippopotamus orders in which the wall simply goes up. Stopping there, rather than
at a round number, is the plan's rule: stop where the next gap is marginal.

Twelve rows above the line were not built, for two stated reasons:

- **The 1...d6 order (rows 3, 4, 6, 14, 15).** Their reach assumes a learner
  who always answers 1.e4 with 1...d6. Before this batch only `h-bg5` (synthetic) and two `eco`
  lines taught that order; the repertoire's answer to 1.e4 is 1...g6 in every
  other Black line. Of that fan, only 2.Nf3 was built, because it is the largest
  (28% of White's replies to 1...d6) and because it funnels straight back into
  the crouch. The next batch built four of the five and recorded why the
  fifth was not built (§7).
- **Fold-ins (rows 16–19, 21, 23, 24).** The reply is missing from the matrix
  only because no line plays that exact order; one or two system moves later the
  position is one the repertoire already drills. A line would teach nothing the
  existing ones do not.

## 4. Criticality: rare forcing replies, taken regardless of frequency

From W1-C §3 and W1-D §3. Frequencies are printed only so nobody mistakes them
for popular.

| W1 ref | reply | reach (1500–1899) | disposition |
|---|---|---|---|
| C 3.1 | 1...e5, Englund Gambit | 2.40% | **built** `c-englund` |
| C 3.2 | 3...Bb4+ (1.d4 Nf6 2.Nf3 e6 3.e3) | 0.21% (7/146 at the node) | **built** `c-bb4`; METHOD.md named it as undrilled |
| C 3.4 | ...Qa5+ from another order | no data past the gap | **built** inside `c-2c5` (5.Bb5 Qa5+) |
| C 3.5 | ...Bxf3 after 3...Bg4 4.h3 | below the 20-game floor | **built** `c-bxf3` |
| C 3.6 | early ...cxd4 before c3/b3 | 33 of 109 at the node | **built** inside `c-2c5` |
| C 3.3 | ...Qb6 against the b3 window | not measurable | **built** `c-qb6` (§8) |
| C 3.7 | ...Ne4 in the c3 structure | 1/989 pgnmentor | **built** `c-ne4c3` (§8) |
| (new) | 2.Bc4 and 3.Qf3, two pieces on f7 | 220 of 736 after 2...Bg7 | **built** in `h-bc4` |
| — | ...Bb4+ in other orders (1.d4 e6 2.Nf3 Bb4+) | 34 of 2,394 at the node | **built** `c-e6bb4` (§8) |

The five new positions of this kind that the trainer now drills are added to `FRQ_SHARP`
(`tools/build-freq.mjs`), so rarity never demotes them: 3...Bb4+, ...Qa5+, the
...Bxf3 recapture, early ...cxd4, and the f7 double attack.

What the table says about them is the reason they matter:

- **Englund.** After 4...Qb4+ only Bd2 (112) and Nc3 (35) keep a plus; Nbd2,
  Qd2 and c3 are all below -300. After 5...Qxb2 (every one of the 33 games in
  the band) Nc3 is 169 and the next move -202. Bc3, chosen by 18 of 32 players,
  is not among the five the table keeps; the fifth is -343. After 6...Nb4, Nd4
  is 210 and Rc1 38. All three narrow claims hold at depth 28.
- **...Qa5+ in `c-2c5`.** Nc3 is -1; every other block is below -370, because
  each leaves the b5 bishop unguarded. Holds at depth 28.
- **...Bxf3.** It is Black's first choice after 4.h3 (-25, level with ...Bf5);
  the ...Bh5 that `anti-bg4` assumes is 27 behind. Then Qxf3 is 45 ahead of
  gxf3 (50 at depth 28).
- **f7.** After 3.Qf3, ...e6 is 72 ahead of the next move (74 at depth 28).
- **2.f4.** Not rare (row 5), but the finding is: ...Bg7, played by 598 of 726,
  is 46 behind ...c5 in the table. The line drills ...c5.

## 5. The lines

All fifteen are tagged `synthetic`: built from the stored analysis, nobody's
game, no book. `tools/build-eco.mjs` gives them opening names; none matches the
CC0 data set move for move beyond its named prefix, so none is `eco`.
SAN was produced by the engine; notes are keyed to the move (ply and SAN
asserted together).

| id | answers | drilled moves | grades |
|---|---|---|---|
| `c-englund` | 1...e5 2.dxe5 Nc6 3.Nf3 Qe7 4.Bf4 Qb4+ | 7 | 6 best, 1 equal |
| `c-bb4` | 3...Bb4+ in the Nf6/e6 order | 6 | 3 best, 3 equal |
| `c-2c6` | 2...c6 3.e3 Bg4 | 7 | 2 best, 5 equal |
| `c-1c6` | 1...c6 2.Nf3 d5 3.e3 Bf5 | 6 | 3 best, 3 equal |
| `c-1d6` | 1...d6, into the King's Indian shell | 6 | 5 best, 1 equal |
| `c-1b6` | 1...b6 | 6 | 2 best, 4 equal |
| `c-2bf5` | 2...Bf5, Nh4 takes the bishop | 7 | 4 best, 3 equal |
| `c-2c5` | 2...c5 3.e3 cxd4, ...Qa5+ | 7 | 4 best, 3 equal |
| `c-2bg4` | 2...Bg4, 3.Ne5 | 6 | 5 best, 1 equal |
| `c-bxf3` | 3...Bg4 4.h3 Bxf3 | 8 | 4 best, 4 equal |
| `h-bc4` | 2.Bc4 and 3.Qf3 | 5 | 2 best, 3 equal |
| `h-f4` | 2.f4, ...c5 before ...Bg7 | 5 | 4 best, 1 equal |
| `h-nf3bc4` | 2.Nf3 Bg7 3.Bc4 | 5 | 0 best, 5 equal |
| `h-d6nf3` | 1...d6 2.Nf3, back to Petrosian–Spassky g16 | 3 | 1 best, 2 equal |
| `h-d4nf3` | 1.d4 g6 2.Nf3 and 3.e3 | 5 | 1 best, 4 equal |

Every drilled move grades `best` or `equal` on the depth-20 table. Three were
changed before any prose was written because their first draft did not:
3.e3 against 2...Bg4 (46 behind 3.Ne5, so the line plays Ne5), 6.Nd2 in
`c-bxf3` (36 behind c4), and 4...Ne7 in `h-bc4` (19 behind ...Nc6; the line
plays ...c6, 4 behind, so that ...d5 follows). `h-f4` was drafted with the
crouch's 2...Bg7 and graded a 46 concession; the line now drills ...c5.

Where the system move itself sits near the edge of the band the note says so
with the number: 2.Nf3 against 1...b6 is 26 behind 2.e4, 3.e3 against 2...c5 is
25 behind 3.c4.

**Opponent moves priced in notes.** A note that states what the table thinks of
the opponent's move needs a row for the position before it, and no line drills
those positions. Seventeen were added to `research/pilot-positions.txt` (the
`--extra` list) and five moves outside the ranked five were added to
`research/named-moves.tsv`, each searched alone at a position no earlier line
reaches. The price of 2...Bg4 (-58, 34 behind ...e6) was already in the existing
row after 2.Nf3 and is quoted from there rather than searched again.

## 6. Numbers after the batch

- **Grading**, 605 drilled moves (was 516): best 282, equal 298, concession 23,
  inferior 2, losing 0, unknown 0. Best+equal 491 -> 580; the 89 new drilled
  moves are all accepted. `test/w2b-grading.mjs` pins recomputed.
- **Evaluation table**: 310 -> 384 rows. Rerunning
  `tools/build-evals.mjs --extra research/pilot-positions.txt --force research/named-moves.tsv`
  reproduced 306 of the 310 existing rows byte for byte. The four that changed
  changed only in fields the batch was meant to touch: after 1.d4 e5, now
  drilled, the row gained its threat `t` and three counted common choices;
  at two Hippopotamus positions (1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Nf3, and
  1.Nf3 g6 2.c4 Bg7 3.d4) the recount of player choices changed which choices
  cross the floor, because the new lines let more games transpose into them,
  so their shared common-choice search (`x`) was redone; at 1.Nf3 g6 2.c4 Bg7
  3.d4 d6 4.Nc3 one choice was added and searched alone. No `m`, `pv` or `p`
  field of any existing row moved.
- **Depth 28**: 116 -> 128 positions checked. New narrow claims: 8 hold, 2 fail
  (at 4.Nf3 in `c-englund` and 5.cxd5 in `c-2bg4`, depth 28 accepts a second
  move; no note there claims the only move).
- **Common choices** (`tools/count-choices.mjs`, regenerated in its documented
  order): 419 moves at 94 positions (was 285 at 63).
- **Occurrence buckets**: 88 / 112 / 90 of 384 positions per band; 9 sharp
  floors (was 4).
- **Coverage matrix**: covered 88 -> 102, transposes 14 -> 16, missing 235 -> 219.

## 7. The 1...d6 batch: rows 3, 4, 6, 14 and 15

Four `synthetic` lines, built the same way as §5, with one more rule: every
drilled Black move is a Hippopotamus move (a `HIPPO_T` square, or a move another
Hippopotamus line plays from the same board, as ...Nf6 in `h-bg5`) and grades
best or equal. Where the commonest White reply left no such move in the band,
the line stops before it rather than drilling a concession or a non-system move.
Counts are `tools/count-prefix.mjs`, 1500–1899 band, literal move orders
(floors). Players' choices are `src/data/choices.js`.

| id | answers | drilled moves | grades |
|---|---|---|---|
| `h-d6f4` | 2.f4 e6 | 2 (...d6, ...e6) | 0 best, 2 equal |
| `h-d6bc4` | 2.Bc4 e6 | 2 (...d6, ...e6) | 0 best, 2 equal |
| `h-d6bd3` | 2.d4 Nf6 3.Bd3 g6 4.Nf3 Bg7 5.O-O Nbd7 | 5 | 3 best, 2 equal |
| `h-d6d3` | 2.d3 e6 3.Nc3 a6 4.d4 Nd7 5.Nf3 Ne7 | 5 | 0 best, 5 equal |

Per move, depth-20 table (loss to the row's best):

- `h-d6f4`: ...e6 -21, 14 behind ...c5. ...g6, which 173 of 904 players chose,
  is 40 behind. After 3.Nf3 (107 of 146 games) the best is ...d5 at -18; the
  six wall moves, each searched alone, are ...Ne7 -52, ...a6 -55, ...h6 -57,
  ...g6 -60, ...Nd7 -66, ...b6 -68. The nearest is 34 behind, so the line stops
  at ...e6.
- `h-d6bc4`: ...e6 -14, 9 behind ...Nf6. ...g6 (160 of 889) is 36 behind. After
  3.Nf3 (42 of 150) the best is ...d5 and ...Nf6 at 0; the wall moves are
  ...a6 -39, ...Nd7 -49, ...g6, ...h6 and ...Ne7 -53, ...b6 -60. The line stops
  at ...e6.
- `h-d6bd3`: ...Nf6 2 behind ...e5; ...g6, ...Bg7 and ...Nbd7 are each the
  table's first choice. 4.f4 (21 of 118 games) was one game more common than
  4.Nf3 (20). It was not taken: after 4.f4 Bg7 5.Nf3 the first two choices in a
  depth-20 search are ...c5 and castling, ...Nbd7 is not in the top five, and
  searched with five other named moves it is 30 behind, the edge of the band (the build's worker,
  not stored).
- `h-d6d3`: ...e6 24 behind ...c5 (101 of 525 players, as many as ...g6);
  ...a6 17 behind ...c5 after 3.Nc3 (37 of 97); ...Nd7 18 behind ...b5 after
  4.d4; ...Ne7 10 behind ...b5 after 5.Nf3. Too few games reach 3...a6 to count
  White's reply, so 4.d4 is the table's first choice for White and 5.Nf3 its
  second, 2 behind 5.a4. 2...g6 was not used: its
  commonest reply, 3.c4 (33 of 93), leaves ...Bg7 37 behind ...c5 in a
  depth-20 search (worker, not stored).
- ...d6 itself is 22 behind ...c5 at 1.e4, as already stored.

**Not built: 2.Nc3 (row 14).** At 1.e4 d6 2.Nc3 the table's first choice is
...c5 at -17. Every Hippopotamus move is outside the band: ...g6 -52 (35
behind; 113 of 539 games in the band chose it), ...h6 -56, ...a6, ...Nd7 and
...e6 -58, ...b6 -76 (the build's worker at depth 20, not stored). A line would
have to drill a concession or leave the system. It stays `missing` in the
matrix and is filed in TICKETS.md under "Needs a decision".

**Rows added to the table.** Eight drilled positions, and four more through
`research/pilot-positions.txt`: the two positions after 3.Nf3 where `h-d6f4`
and `h-d6bc4` stop (their six wall moves named `alone` in
`research/named-moves.tsv`), and the two White-to-move positions in `h-d6d3`
whose notes name the table's move for White. The common-choice section of
`named-moves.tsv` was regenerated by `count-choices --tsv`: three new shared
searches at new positions, one at 1.e4 d6 2.f4 (already a row, now drilled).

**Numbers after the batch.**

- Grading: 603 drilled moves (was 589): best 277, equal 301, concession 23,
  inferior 2. Best+equal 564 -> 578; the 14 new drilled moves are all accepted.
- Evaluation table: 384 -> 396 rows. 383 of the 384 existing rows are byte for
  byte identical. The one that changed, 1.e4 d6 2.f4, was an `--extra` row and
  is now drilled: it gained its threat `t` and its common choices `x`/`xp`
  (...Nc6 -34, ...c6 -39, ...g6 -47). Its `m`, `pv` and `p` did not move.
- Depth 28: no new position qualifies (none is narrow, demanding or
  tactical at depth 20); `src/data/deep.js` rows unchanged, 128 checked.
- Common choices: 442 moves at 99 positions (was 419 at 94); the 94 existing
  positions are unchanged.
- Occurrence buckets: 99 / 134 / 99 of 396 positions per band (was 96 / 129 /
  96 of 384); no existing position changed bucket; sharp list unchanged.
- Coverage matrix: covered 102 -> 106, transposes 16, missing 219 -> 215.

## 8. The forcing replies: 2...Bb4+, ...Qb6 and ...Ne4

The three rows of §4 left open. Three `synthetic` Colle lines, built as §5 and
§7: every drilled White move is a Colle or Zukertort move (a `COLLE_T` or
`ZUK_T` square, castling, or the recapture on d4) and grades best or equal on the
depth-20 table. Black's moves are the table's first choice where a row exists,
otherwise the commonest in `tools/count-prefix.mjs` (1500–1899), otherwise the
engine's line. None of the three nodes is reached often enough to rank, so the
coverage matrix does not change; they are taken for what they threaten.

| id | answers | drilled moves | grades |
|---|---|---|---|
| `c-e6bb4` | 1.d4 e6 2.Nf3 Bb4+ 3.c3 Ba5 4.Nbd2 | 4 | 3 best, 1 equal |
| `c-qb6` | ...c5 5.b3 Qb6 6.Bb2 cxd4 7.exd4 Nc6 8.Nbd2 | 8 | 5 best, 3 equal |
| `c-ne4c3` | ...c5 5.c3 Ne4 6.Nbd2 f5 7.O-O | 7 | 3 best, 4 equal |

Per move, depth-20 table (loss to the row's best):

- `c-e6bb4`: 2...Bb4+ is 34 games in the band (26 / 34 / 0 by band) and, for
  Black, -89, 60 behind ...d5 (searched alone). 3.c3 85 is the first choice,
  ahead of Nbd2 59 and Bd2 40; 26 of the 34 games chose it. Then ...Ba5 and
  ...Bd6, 12 games each in the band. 4.Nbd2 96 is 7 behind e4. After 4.Nbd2 the
  table's first choice for Black is ...c6 (-91, 23 ahead), and after it the
  Colle's e3 (searched alone) is 47, 39 behind e4 86: the line stops at 4.Nbd2.
- `c-qb6`: ...Qb6 is -29 for Black, 22 behind ...Be7 (searched alone); 1 of 225
  twic games and none of 1,081 pgnmentor games at the node; fewer than 3
  games in the band reach it. At 6, castling 32, Nbd2 31, dxc5 30, Bb2 28: the line plays Bb2. At 7,
  exd4 38, Bxd4 24, Nxd4 -68; depth 28 keeps exd4 first (35, 19 ahead of Bxd4),
  the one new depth-28 position. At 8, Nbd2 36, castling 35.
- `c-ne4c3`: ...Ne4 is 1 of 989 pgnmentor games at the node, and not in the
  stored five for Black there (fifth ...Nc6, 10 behind ...b6). It was not
  searched alone: that row already carries an `x` list, and appending to it would
  change a stored row. 6.Nbd2 32 is first, 7 ahead of castling. After ...f5, c4
  38, Ne5 34, castling 33; the two captures, each searched alone, are Bxe4 -35
  and Nxe4 -66. The line castles.

Exploration searches at depth 20 with the build's worker, not stored, decided
where each line stops; the notes quote only stored rows.

**Rows added to the table.** Seven drilled positions and four `--extra` rows in
`research/pilot-positions.txt`: the two positions before 2...Bb4+ and 5...Qb6
(the price of each move for Black), and the two positions where `c-e6bb4` stops.
Five moves are named `alone` in `research/named-moves.tsv`. The common-choice
section of that file came out identical on both `--tsv` passes.

**Numbers after the batch.**

- Grading: 622 drilled moves (was 603): best 288, equal 309, concession 23,
  inferior 2. Best+equal 578 -> 597; the 19 new drilled moves are all accepted.
- Evaluation table: 396 -> 407 rows. All 396 existing rows are unchanged, field
  for field.
- Depth 28: 128 -> 129 positions (7.exd4 in `c-qb6`, tactical, holds); the 128
  existing `src/data/deep.js` rows unchanged.
- Common choices: 443 moves at 100 positions (was 442 at 99): 3.c3 at the new
  position after 2...Bb4+ (26 of 34 games). The 99 existing positions unchanged.
- Occurrence buckets: 101 / 136 / 100 of 407 positions per band (was 99 / 134 /
  99 of 396); no existing position changed bucket. The three new forcing
  positions are added to `FRQ_SHARP` (`tools/build-freq.mjs`): 9 -> 12.
- Coverage matrix: covered 106, transposes 16, missing 215, unchanged.
