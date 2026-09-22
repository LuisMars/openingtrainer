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
| 14 | 1.e4 d6 2.Nc3 | 3.14% | 3.02% | 2.74% | **built** `h-d6nc3` as a stated concession (§9); no Hippopotamus move is in the band (§7) |
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
matrix and is filed in TICKETS.md under "Needs a decision". The owner chose
the concession; §9 builds it.

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

## 9. The coverage batch: 1...d6 2.Nc3 as a concession, and the next rows

Two parts. First, the owner's answer to §7's open row: build 1.e4 d6 2.Nc3 and
drill ...g6 as a stated concession. Second, the next rows of the §2 ranking,
recomputed by the §1 method against the current `LINES` (1500–1899 reach, with
u1500 / 1900+ beside it). Rows 1–25 are §2's; the rows below continue it. Same
rules as §7 and §8: every drilled move of the learner is in the system (a
`COLLE_T`, `ZUK_T` or `HIPPO_T` square, castling, the recapture on d4, or a move
another line of the same system plays from the same board) and grades best or
equal, or the line stops, or the reply is skipped with its reason. The one
exception is `h-d6nc3`'s ...g6, which the owner chose.

| # | gap | reach | u1500 | 1900+ | disposition |
|---|---|---|---|---|---|
| 14 | 1.e4 d6 2.Nc3 | 3.14% | 3.02% | 2.74% | **built** `h-d6nc3` (stated concession) |
| 26 | 1.d4 e6 2.Nf3 c5 | 1.99% | 1.84% | 0.71% | **built** `c-e6c5` |
| 27 | 1.d4 d5 2.Nf3 Nc6 3.e3 Nf6 | 1.93% | 4.11% | 0.50% | **built** `c-nc6nf6` |
| 28 | 1.e4 g6 2.d4 Bg7 3.e5 d6 4.f4 | 1.79% | 2.33% | — | not built: ...dxe5 is the only move in the band, and it is no Hippopotamus move |
| 29 | 1.d4 e6 2.Nf3 d5 3.e3 c5 | 1.70% | 1.07% | 1.67% | not built: the board of §2 row 19 by the 1...e6 order; 4.Bd3 Nf6 rejoins `ck` |
| 30 | 1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Bd3 | 1.59% | 0.40% | 1.59% | **built** `h-pircbd3` |
| 31 | 1.e4 g6 2.Nf3 Bg7 3.Nc3 | 1.55% | 1.74% | 1.01% | **built** `h-nf3nc3` |
| 32 | 1.d4 d5 2.Nf3 Nf6 3.e3 Nc6 | 1.37% | 2.09% | 0.71% | the board of row 27; now `transposes` |
| 33 | 1.d4 e6 2.Nf3 b6 | 1.33% | 0.86% | 0.71% | **built** `c-e6b6` |
| 34 | 1.e4 g6 2.d4 Bg7 3.Nf3 d6 4.Bc4 | 1.30% | 0.87% | 0.95% | **built** `h-4bc4` |
| 35 | 1.d4 d5 2.Nf3 Nc6 3.e3 Bf5 | 1.25% | 1.99% | 0.12% | **built** `c-nc6bf5` |
| 36 | 1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Be3 | 1.18% | 0.80% | 3.55% | **built** `h-pircbe3` |
| 37 | 1.d4 e6 2.Nf3 d6 | 1.07% | 1.36% | 0.33% | **built** `c-e6d6` |
| 38 | 1.e4 d6 2.d4 Nf6 3.e5 | 1.05% | 2.74% | 0.75% | not built: ...dxe5 is the only move in the band, and it is no Hippopotamus move |
| — | *cut-off* | | | | |
| 39 | 1.d4 Nf6 2.Nf3 g6 3.e3 Bg7 4.c4 d5 | 1.00% | — | — | next |
| 40 | 1.e4 g6 2.Nf3 Bg7 3.c3 | 0.98% | 0.94% | 0.24% | next |

Rows 26–29, 31, 33, 35 and 37 are not in the coverage matrix: the matrix reads
the pooled 1500+ player files, which have no position before any of them (none
after 1.d4 e6 2.Nf3, for one). They are ranked from the band files, as §2
ranked rows 26 and 27.

| id | answers | drilled moves | grades |
|---|---|---|---|
| `h-d6nc3` | 2.Nc3 g6 3.d4 Bg7 | 3 | 1 best, 1 equal, 1 concession |
| `c-e6c5` | 2...c5 3.e3 cxd4 4.exd4 Nc6 5.Bd3 | 5 | 3 best, 2 equal |
| `c-nc6nf6` | 3...Nf6 4.Nbd2 | 4 | 2 best, 2 equal |
| `h-pircbd3` | 4.Bd3 Bg7 5.Be3 Nbd7 | 5 | 1 best, 4 equal |
| `h-nf3nc3` | 3.Nc3 d6 | 3 | 0 best, 3 equal |
| `c-e6b6` | 2...b6 3.Nbd2 | 3 | 2 best, 1 equal |
| `h-4bc4` | 4.Bc4 e6 5.O-O Ne7 6.a4 b6 | 6 | 3 best, 3 equal |
| `c-nc6bf5` | 3...Bf5 4.Bd3 | 4 | 1 best, 3 equal |
| `h-pircbe3` | 4.Be3 Bg7 5.f3 a6 6.Qd2 Nbd7 | 6 | 0 best, 6 equal |
| `c-e6d6` | 2...d6 3.e3 Be7 4.Bd3 Nd7 5.O-O | 5 | 3 best, 2 equal |

Per move, depth-20 table (loss to the row's best). Counts are
`tools/count-prefix.mjs`, 1500–1899, literal move orders (floors).

- `h-d6nc3`: ...c5 -17 first; ...g6 -52, 35 behind, a concession. The other
  wall moves: ...Nd7 -55, ...a6 -56, ...h6 -58, ...e6 -62, ...b6 -79 (the four
  outside the top five searched alone, `research/named-moves.tsv`). 113 of 539
  players chose ...g6, the commonest move. 3.d4 and 3.d3 tie at 30 of 109; the
  line takes 3.d4, after which ...Bg7 is first (-46) and the board is the
  model setup's 1.e4 g6 2.d4 Bg7 3.Nc3 d6. The trainer credits ...g6 as the
  line's own move in Drill and in Shuffle, and the note on the move states the
  cost; `test/w2b-grading.mjs` and `test/ui.mjs` pin both.
- `c-e6c5`: 3.e3 20, 15 behind Nc3 35; c3 (66 of 315 players) 3. 4.exd4 32,
  17 ahead of Nxd4; depth 28 keeps it first (25, 11 ahead). 5.Bd3 25, 1 behind
  Bf4. After 5.Bd3 too few games in the band reach the board to count.
- `c-nc6nf6`: 4.Nbd2 36 first; Bd3 10 (26 behind). After 4.Nbd2 only 7 games
  in the band continue, too few to choose Black's reply, so the line stops. (After
  ...Bf5, 4 of the 7, Bd3 would be 51 behind Bb5 and c3 exactly 30 behind; worker,
  not stored.)
- `h-pircbd3`: ...Bg7 -29 first; after 5.Be3 (19 of 40), ...Nbd7 -24, 16 behind
  ...e5. After 6.f4, the table's first choice for White, ...e5 is -19 and the
  nearest wall move, ...e6, -68 (worker, not stored): the line stops at ...Nbd7.
- `h-nf3nc3`: ...d6 -48, 28 behind ...c5; ...e6 (67 of 197, the commonest) -75.
  4.d4 (30 of 53) reaches the model setup's 1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Nf3.
- `c-e6b6`: 3.Nbd2 44, 24 behind e4 68; e3 (36 of 210) 19, 49 behind. After
  ...Bb7 (8 games) e3 is 7, 49 behind e4 56 (an `--extra` row): the line stops.
- `h-4bc4`: ...e6 -56, 14 behind ...Nf6; ...Nd7 (5 of 75) -342, the table's line
  Bxf7+. 5.O-O (9 of 18); ...Ne7 -46, level with ...d5. 6.a4 is the table's first
  choice for White (an `--extra` row); ...b6 -46, 1 behind ...d5.
- `c-nc6bf5`: 4.Bd3 30, 12 behind Bb5. After ...Bxd3 (6 of 9 games) the
  recaptures are Qxd3 and cxd3, neither a system move: the line stops at 4.Bd3.
- `h-pircbe3`: ...Bg7 -57, 5 behind ...a6 (34 of 37 players chose it); 5.f3
  (18 of 32); ...a6 -52, 3 behind ...c6; 6.Qd2 the table's first choice (an
  `--extra` row); ...Nbd7 -62, 21 behind ...b5. The line stops there.
- `c-e6d6`: 3.e3 44, exactly 30 behind e4 74 (searched in the drilled-move job,
  outside the top five): equal, at the edge. ...Be7 (11 of 33); 4.Bd3 45, 6
  behind e4; ...Nd7 (3 games, the only reply counted); 5.O-O 46, first.

Skipped rows, depth-20 worker searches, not stored:

- Row 28, 3.e5 d6 4.f4: ...dxe5 67, ...c5 36, ...Nh6 31; the wall moves ...a6 7
  and ...Nd7 -1. `h-3e5` takes on e5 after 4.Nf3, not on this board.
- Row 38, 3.e5 against the Pirc: ...dxe5 117; the knight retreats ...Nfd7 -50,
  ...Nd5 -57.

**Rows added to the table.** 20 drilled positions and three `--extra` rows in
`research/pilot-positions.txt`: the White-to-move boards before 6.a4 and 6.Qd2,
and the board after 3.Nbd2 Bb7 where `c-e6b6` stops. Four moves named `alone`
at 1.e4 d6 2.Nc3. The common-choice section of `named-moves.tsv` changed on the
second `--tsv` pass (the new drilled positions have rows only after the first
evaluation run) and came out identical on the third.

**Numbers after the batch.**

- Grading: 666 drilled moves (was 622): best 304, equal 336, concession 24,
  inferior 2. Best+equal 597 -> 640; 43 of the 44 new drilled moves are
  accepted, and the 44th is `h-d6nc3`'s ...g6.
- Evaluation table: 407 -> 430 rows. All 407 existing rows are unchanged, field
  for field.
- Depth 28: 129 -> 130 positions (4.exd4 in `c-e6c5`, tactical, holds); the 129
  existing `src/data/deep.js` rows unchanged. Only-move and demanding tallies
  unchanged.
- Common choices: 502 moves at 112 positions (was 443 at 100). 96 of the 100
  existing positions are unchanged. Four changed only in their counts, because
  the new lines keep more games in the tree: 1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Nf3
  (283 -> 322 games in the middle band), 1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Be3
  (47 -> 61; ...a6 now crosses the floor), 1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.f4 Bg7
  5.Nf3 (40 -> 41), and
  1.d4 Nf6 2.Nf3 e6 3.e3 c5 (40 -> 47; Bd3 now crosses the floor). Every choice
  that crosses the floor there already had a stored score, so no row changed.
- Occurrence buckets: 111 / 149 / 110 of 430 positions per band (was 101 / 136 /
  100 of 407); no existing position changed bucket. `FRQ_SHARP` unchanged at 12:
  no new line answers a forcing reply.
- Coverage matrix: covered 106 -> 110, transposes 16 -> 17, missing 215 -> 210.

## 10. Generated lines: the first 50 of the remaining 210 gaps

`tools/gen-gap-lines.mjs` (new) takes the rows the coverage matrix lists as
`missing`, ranks them, and builds or skips them in rank order, 50 per run. Every
decision, with the numbers behind it, is in `research/gap-lines.json`; the lines
are rendered from that file into `src/data/lines.js` (ids `gc-…` for the Colle,
`gh-…` for the Hippopotamus), all tagged `synthetic`.

**Ranking.** The §1 method: reach in the 1500–1899 band file, the product of the
opponent's shares along the path, the learner's own moves (from lines that are not
`eco`) at probability 1; the pooled 1500+ file breaks ties and orders rows the band
file does not reach. One change from §1 and §9: the walk also continues through a
`transposes` reply, not only a `covered` one. 128 of the 210 rows have a path;
the other 82 are reached only through an `eco` line's move order (1.Nf3, Bf4, Bg5)
and will be skipped when their turn comes. `node tools/gen-gap-lines.mjs --rank`
prints the list.

**Rules per gap**, stated in the tool's header:

- The learner's move is the best-scoring system move at the board: a piece onto a
  formation square (`isSetupMove` against `HIPPO_T`, or `COLLE_T` and `ZUK_T`),
  castling, or the Colle's recapture on d4. It is searched at depth 20 with the
  build's own worker and cache (`tools/build-evals.mjs --worker`), and moves outside
  the top five are searched alone, the same job build-evals runs for a drilled
  move, so the number chosen on is the number that ships. It is played only if
  `gradeRow()` grades it best or equal.
- The opponent's move is the commonest in the 1500–1899 band at that board when at
  least 10 counted games continue from it, otherwise the table's first choice. The
  counts come from one pass over the same dump (cached in `data-src/gap-counts.json`,
  gitignored). It counts by position (keyFen), from each gap's parent (next move only)
  and through every game that enters a gap's position, to ply 32. Positions reached
  only from outside those subtrees are not counted, so every count is a floor.
- A line stops when the board is one a line of the same side reaches (after the
  opponent's move, the move is kept so the learner sees the rejoin), when no system
  move is in the band, or after six moves of its own. A line built earlier in the
  batch counts as an existing line for every later one.
- Notes and plans are rendered from the shipped `src/data/evals.js` by
  `--write`. The second `--write` after the pipeline printed "notes unchanged". Where
  a line stops for lack of an in-band move, the stop board is an `--extra` row
  (`research/pilot-positions.txt`) and the nearest system move, if the top five
  leave it out, is named `alone` (`research/named-moves.tsv`). Every board where the
  table chose the opponent's move is an `--extra` row too.

**The batch: ranks 1–50.** 44 built, 6 skipped.

- Built lines end by transposition into another line (13), because the next
  system move is outside the band (14), or at the six-move limit (17).
- Skipped, no system move in the band at the gap's own board (depth-20 worker,
  not stored): rank 7, 1.e4 d6 2.d4 Nf6 3.e5 (...dxe5 117, ...Nfd7 -50); rank 29,
  the same push after 3.Nc3 g6 (...dxe5 37, ...Nfd7 -45); rank 32, 1.d4 c5 2.e3 cxd4
  3.exd4 Nc6 (d5 64, c3 20); rank 41, 1.c4 g6 2.Nc3 Bg7 3.Nf3 (...c5 -8, ...d6 -49);
  rank 48, 1.d4 g6 2.Bf4 Bg7 3.Be5 (...Nf6 35, ...h6 -549).
- Skipped, covered by a line built earlier in the batch: rank 17, 1.e4 g6 2.Nf3
  Bg7 3.d4 d6 4.c3 (`gh-e4g6d4bg7c3` reaches it).
- Ranks 1–6 include §2's fold-ins (rows 16–18, 21, 23, 24). They are built now:
  a line that drills the first move at the gap's board and ends where the board
  rejoins is the smallest line that closes the gap.

**Checks.** An independent audit script (not shipped) replayed every generated
line against the built page. Every move is legal. Every learner move after the gap
is a system move that grades best or equal on the shipped row. Every number in a
note matches the shipped row. Every count matches the counting pass, and every
"table's first choice" is the row's first move. Ten lines were also read by hand:
`gh-e4g6nc3`, `gh-e3`, `gc-nf6nf3d6`, `gh-d4g6c3`, `gc-c5e3e6`,
`gh-e4g6nf3bg7d4d6be3`, `gc-f5nf3nf6e3e6`, `gh-nf3g6g3`, `gc-c5e3cxd4exd4nf6` and
`gh-c4g6e3`. Two wording faults were fixed in the tool: "0 behind" for a move tied
with the first choice now reads "level with", and notes carry the move number so
that no note repeats inside a line (`test/verify.mjs`). What the rules produce
and a person may question: the formation rule credits a retreat onto a formation
square (Ne5-f3 is the stop move in `gc-d5nf3e6e3nf6bd3bd6`) and a capture onto one
(...cxb6 in `gh-e4g6nf3bg7d4d6bd3`). Most opponent moves late in a line are the
table's choice, because few counted games get that far.

**Numbers after the batch.**

- Lines 96 -> 140 (`synthetic` 59 -> 103).
- Grading: 940 drilled moves (was 666): best 408, equal 501, concession 29,
  inferior 2. The 274 new drilled moves are 164 after the gap (65 best, 99 equal
  at depth 20) and 110 on the way to it (105 best or equal). The other five are the
  repertoire's own 2.e3 after 1.d4 c5, 37 behind, which `syn-benoni` drills and
  five generated lines pass through.
- Evaluation table: 430 -> 717 rows. 427 existing rows unchanged, field for
  field. One gained its threat `t` (1.Nf3 g6 2.g3, now drilled). Two gained one
  appended `x`/`xp` entry each and kept every existing entry: a counted choice that
  now crosses the floor, searched alone (...b6 after 1.Nf3 g6 2.g3 Bg7 3.Bg2,
  ...c5 after 1.d4 g6 2.Nf3 Bg7 3.e3). No `m`, `pv` or `p` of an existing row moved.
- Depth 28: 130 -> 139 positions; the 130 existing `src/data/deep.js` rows
  unchanged. Narrow claims 45 hold, 11 fail (was 44, 10). Three generated
  moves grade lower at depth 28: `gh-e4g6nf3bg7d4d6nc3a6bd3` ...h6 (best to equal),
  and `gh-e4g6nf3bg7d4d6nc3a6be3` ...Ne7 and `gh-e4d6d4nf6nc3g6h3` ...a6 (equal to
  concession). The page accepts a move either depth accepts.
- Common choices: 607 moves at 148 positions (was 502 at 112). 100 of the 112
  existing positions unchanged; 12 changed counts, because more games stay in the
  tree. At three of them a move now crosses the floor. At 1.e4 g6 2.Nf3 Bg7 3.Nc3,
  ...Nc6 fell below it. `--tsv`: the second pass changed the section, the third
  was identical.
- Occurrence buckets: 149 / 205 / 154 of 717 positions; no existing position
  changed bucket; `FRQ_SHARP` 12.
- Coverage matrix: covered 110 -> 156, transposes 17 -> 24, missing 210 -> 157.

**Pipeline, in order** (as run for this batch): `node build.mjs`;
`node tools/gen-gap-lines.mjs --plan 50`; `--write`; build; `tools/count-choices.mjs
--in <dump> --maxPly 30`; build and `--tsv` into `named-moves.tsv`;
`tools/build-evals.mjs --extra research/pilot-positions.txt --force
research/named-moves.tsv`; build; `count-choices --emit`; repeat `--tsv`,
build-evals and `--emit` until `--tsv` is identical; `tools/deep-check.mjs`;
`tools/build-freq.mjs`; `tools/build-eco.mjs`; `tools/coverage-matrix.mjs` (a build
before each); `gen-gap-lines --write` again, which must print "notes unchanged";
update the pins in `test/w2b-grading.mjs` and the counts in README and `src/html/`;
`npm test`.

## 11. Generated lines: every remaining gap

The same tool, rules and pipeline as §10, run once over every undecided row:
`node tools/gen-gap-lines.mjs --plan 151`, then `--plan 1` for the last row the
first call left out. At the start 157 rows were `missing`, and 152 of them were
undecided (the §10 skip at rank 17 is now covered, so 5 old skips were still in
the list, not 6). Ranks in this section are the ranks of that run's list.

**The batch: 152 rows.** 59 built, 93 skipped.

- Built lines end by transposition into another line (15), because the next
  system move is outside the band (24), or at the six-move limit (20).
- Skipped, reached only through an `eco` line's move order (1.Nf3, Bf4, Bg5): 76.
  The tool records no path for them.
- Skipped, no system move in the band at the gap's own board (depth-20 worker,
  not stored; first choice, then the nearest system move and its loss): rank 6,
  1.c4 g6 2.Nc3 Bg7 3.e4 (...c5 21, ...d6 64 behind); rank 7, 1.Nf3 g6 2.Nc3
  (...d5 3, ...Bg7 39 behind); rank 9, 1.d4 g6 2.Bf4 Bg7 3.Nc3 (...d5 -2, ...d6 43
  behind); rank 27, 1.d4 c5 2.e3 Nc6 (d5 73, Nf3 58 behind); rank 39, 1.d4 d5 2.Nf3
  Nf6 3.e3 Bf5 4.c4 Na6 (cxd5 133, Ne5 64 behind); rank 40, 1.e4 g6 2.d4 Bg7 3.Nc3
  d6 4.f4 Nf6 5.Nf3 O-O 6.Bc4 (...Nxe4 -21, ...Nfd7 48 behind); rank 41, the same
  with 6.Be2 (...c5 -21, ...a6 42 behind); rank 45, 1.d4 c5 2.e3 cxd4 3.exd4 e5
  (dxe5 114, Bd3 75 behind); rank 49, 1.Nf3 g6 2.c4 Bg7 3.Nc3 (...c5 -8, ...d6 41
  behind); rank 50, 1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Bc4 (...Nf6 -22, ...e6 33 behind);
  rank 52, 1.d4 g6 2.Bf4 Bg7 3.e4 (...c5 3, ...d6 47 behind); rank 64, 1.e4 g6 2.d4
  Bg7 3.Nc3 d6 4.f4 Nf6 5.Nf3 O-O 6.e5 (...dxe5 -14, ...Nfd7 48 behind); rank 65,
  1.Nf3 g6 2.c4 Bg7 3.d4 d6 4.Bf4 (...c5 14, ...Nd7 31 behind); rank 67, 1.Nf3 g6
  2.c4 Bg7 3.d3 (...Nf6 7, ...e6 33 behind).
- Skipped, reached by a line built earlier in the same run: rank 57, 1.c4 g6
  2.Nc3 Bg7 3.b3 (`gh-c4g6b3`); rank 62, 1.Nf3 g6 2.c4 Bg7 3.d4 d6 4.g3
  (`gh-nf3g6c4bg7g3`); rank 81, 1.d4 Nf6 2.Nf3 e6 3.e3 b6 4.Bd3 d5
  (`gc-d5nf3e6e3nf6bd3b6`).

Every row of the matrix is now decided. The 95 rows it still lists as `missing`
are the 76 `eco`-only rows and the 19 rows with no system move in the band (5
from §10, 14 here); each has its reason in `research/gap-lines.json`.

**One change to the tool.** A gap's first note cited "0 of N counted games" where
the counting pass found the position but no band game playing the reply (six new
lines). Such a note now cites the player pool's count for the reply, as it already
did where fewer than ten band games reach the position. No line from §10 changed.

**Checks.** The audit script (not shipped) replayed all 103 generated lines
against the built page: every move is legal and matches its stored SAN; every
learner move after the gap is a system move that grades best or equal on the
shipped row (390: best 138, equal 252); every number in a note or plan matches the
shipped row, `research/gap-lines.json` or the counting pass; every opponent move
is the band's commonest (at least ten games) or the row's first move; every
transposition stop is a board the named line reaches; at every band stop no
system move grades best or equal. Thirteen new lines were read by hand:
`gc-f5nf3d5`, `gh-e4g6d4bg7nc3b6bg5`, `gc-d5nf3nf6e3bf5bd3bg4`,
`gc-c5e3cxd4exd4d6`, `gh-nf3g6h4`, `gh-e4g6nf3bg7d4d6nc3a6d5`,
`gh-d4g6bf4bg7e3d6h3`, `gc-nf6nf3g6e3c5`, `gh-c4g6d3`,
`gc-c5e3cxd4exd4d5nf3e5`, `gh-e4g6d4bg7nc3d6f4nf6nf3oobe3`,
`gc-d5nf3nf6e3c6bd3h6` and `gh-nf3g6c4bg7d4d6b3`. The "0 of N" note above came
from this reading. What the rules produce and a person may question, as in §10:
the formation rule credits captures onto a formation square (5.Nxe5 in
`gc-c5e3cxd4exd4d5nf3e5`, after the pawn offer 4...e5), and a band stop can come
where the natural reply is a recapture outside the system (the same line stops
before ...Nxe5, because dxe5 is not a Colle move). Nearly every opponent move
after the gap is the table's choice: few counted games get that far.

**Numbers after the batch.**

- Lines 140 -> 199 (`synthetic` 103 -> 162).
- Grading: 1349 drilled moves (was 940): best 550, equal 759, concession 38,
  inferior 2. The 409 new drilled moves are 226 after the gap (73 best, 153 equal
  at depth 20) and 183 on the way to it (174 best or equal). The other nine are
  repertoire moves already drilled as concessions: 2.e3 after 1.d4 c5
  (`syn-benoni`) on eight paths, and 2...Bg7 after 1.c4 g6 2.Nc3 (`syn-english`)
  on one.
- Evaluation table: 717 -> 1155 rows. All 717 existing rows unchanged, field for
  field; none gained a field.
- Depth 28: 139 -> 149 positions; the 139 existing `src/data/deep.js` rows
  unchanged. Narrow claims 46 hold, 11 fail (was 45, 11). No generated move grades
  lower than equal at depth 28.
- Common choices: 615 moves at 151 positions (was 607 at 148). 145 of the 148
  existing positions unchanged; 3 changed counts, because more games stay in the
  tree. At 1.c4 g6 2.d4 Bg7 3.e4, ...e5 now crosses the floor. `--tsv`: the second
  pass added one line (e3 and Nc3 after 1.d4 d5 2.Nf3 f5), the third was identical.
- Occurrence buckets: 166 / 256 / 178 of 1155 positions; no existing position
  changed bucket; `FRQ_SHARP` 12.
- Coverage matrix: covered 156 -> 215, transposes 24 -> 27, missing 157 -> 95.

The pipeline is §10's, in the same order; the second `--write` printed "notes
unchanged".

## 12. The semi-Hippo pass: the Hippopotamus gaps the band ended

The owner's decision: for the learner playing the Hippopotamus, ...Nf6 (either
knight), ...c5, ...c6 and ...d5 are in the system where the table grades the move
best or equal, and nowhere else. They are not formation moves. The app reads the
rule in `semiHippo` (`src/app.js`), and the structural half is `isSemiHippoMove`
(`src/engine.js`), which `tools/gen-gap-lines.mjs` reads too, so the page and the
tool test one rule.

**The tool change.** At each board the formation moves (and castling) are tried
first, exactly as in §10 and §11; only where none is inside the band are the
semi-Hippo moves tried, the same way (top five, else each searched alone, played
only if `gradeRow()` grades it best or equal). So a line that had an in-band wall
move plays the same move as before. A band stop now names the better of the two
nearest moves. `--semi` reruns the Hippopotamus gaps that §10 and §11 ended for want
of an in-band move, in decision order: built lines that stopped at the band
continue from their stop with their moves kept, and gaps skipped at their own board
are explored afresh. A line built or extended earlier in the pass is an existing
line for every later one, and a line never transposes into itself. Each entry in
`research/gap-lines.json` records what the pass did in `semi`.

**The pass: 32 gaps** (17 stopped lines, 15 skips).

- Extended, 7: `gh-d4g6c3`, `gh-e4g6d4bg7nc3b6bg5`, `gh-c4g6d3`,
  `gh-e4g6d4bg7nc3b6be2`, `gh-e4g6d4bg7nc3d6f4nf6e5`,
  `gh-e4g6nf3bg7d4d6nc3a6d5`, `gh-nf3g6h4`.
- Built, 11: `gh-c4g6nc3bg7nf3`, `gh-d4g6bf4bg7be5`, `gh-c4g6nc3bg7e4`,
  `gh-nf3g6nc3`, `gh-d4g6bf4bg7nc3`, `gh-e4g6d4bg7nc3d6f4nf6nf3oobc4`,
  `gh-e4g6d4bg7nc3d6f4nf6nf3oobe2`, `gh-e4g6d4bg7nc3d6bc4`, `gh-d4g6bf4bg7e4`,
  `gh-nf3g6c4bg7d4d6bf4`, `gh-nf3g6c4bg7d3`.
- Skipped, reached by a line of this pass: 1.Nf3 g6 2.c4 Bg7 3.Nc3 is the board of
  1.c4 g6 2.Nc3 Bg7 3.Nf3 (`gh-c4g6nc3bg7nf3`).
- Unchanged, 10 lines: the semi-Hippo move is outside the band at the stop board
  too. Their stop sentence now names the nearest Hippopotamus or semi-Hippo move;
  at `gh-nf3g6b3` that is ...c5, 33 behind ...e5.
- Still skipped, 3: 1.e4 d6 2.d4 Nf6 3.e5, the same push after 3.Nc3 g6, and 1.e4
  g6 2.d4 Bg7 3.Nc3 d6 4.f4 Nf6 5.Nf3 O-O 6.e5. The knight is already on f6 there.
- The 18 lines that grew end by transposition (1), at the band (8) or at the six-move
  limit (9). They play 24 semi-Hippo moves; each one's note says "A semi-Hippo move,
  not a wall move", and each such line's plan states the rule.

**Checks.** The audit script (not shipped) replayed the 28 new or changed lines
against the built page: every move legal and matching its SAN; every learner move
after the gap a formation move, castling or a semi-Hippo move, best or equal on the
shipped row (112: best 57, equal 55); no semi-Hippo move where a formation move in
the shipped row is inside the band; the semi-Hippo sentence on exactly those moves
and the rule in exactly those plans; every note number and count matching its
source; every transposition stop a board the named line reaches; at every band
stop, no formation or semi-Hippo move in the band. No problem. Ten lines were read
by hand: `gh-c4g6nc3bg7nf3`, `gh-d4g6bf4bg7be5`, `gh-nf3g6nc3`,
`gh-e4g6d4bg7nc3d6f4nf6e5`, `gh-nf3g6h4`, `gh-e4g6d4bg7nc3d6bc4`,
`gh-nf3g6c4bg7d3`, `gh-d4g6c3`, `gh-c4g6d3` and `gh-e4g6d4bg7nc3b6be2`. What a
person may question: ...Nf6 counts from d7 as well as g8 (`gh-e4g6d4bg7nc3d6f4nf6e5`
takes the knight back to f6 after ...Nfd7); a line can play two semi-Hippo moves
in a row (...c5 then ...d5 in `gh-nf3g6h4`), which is less a Hippopotamus than the
name says; and the formation rule still credits captures onto a wall square
(7...fxg6 in `gh-c4g6d3`, ...exd6 in `gh-e4g6d4bg7nc3d6f4nf6e5`).

**Numbers after the pass.**

- Lines 199 -> 210 (`synthetic` 162 -> 173). Gap decisions: 114 built, 88 skipped
  (76 `eco`-only, 7 with no move in the band, 5 reached by a line of the same run).
- Grading: 1439 drilled moves (was 1349): best 592, equal 805, concession 40,
  inferior 2. The 90 new drilled moves are 61 after the gap (34 best, 27 equal at
  depth 20) and 29 on the way to it (27 best or equal; the other two are 2...Bg7
  after 1.c4 g6 2.Nc3, the concession `syn-english` drills).
- Evaluation table: 1155 -> 1267 rows. All 1155 existing rows unchanged field for
  field; seven gained a field (six the threat `t`, now drilled; one `x`, `xp` and `t`,
  a counted choice searched in a new shared job). Three boards where a line used to
  stop kept their named move searched alone (a new hand section in
  `research/named-moves.tsv`), because the generated section no longer lists them
  and dropping the job would have dropped a stored `x` entry.
- Depth 28: 149 -> 159 positions; the 149 existing `src/data/deep.js` rows
  unchanged. Narrow claims 48 hold, 15 fail (was 46, 11). One generated move grades
  lower at depth 28: `gh-e4g6d4bg7nc3d6f4nf6nf3oobc4` ...c5 (equal to concession).
  The page accepts a move either depth accepts.
- Common choices: 622 moves at 154 positions (was 615 at 151). 150 of the 151
  existing positions unchanged. One changed counts because more games stay in the
  tree: after 1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Bc4 Nf6 5.Nf3, 45 band games (was 42),
  29 of them ...O-O (was 26). `--tsv`: the first two passes each changed the
  section, the third was identical.
- Occurrence buckets: 172 / 268 / 185 of 1267 positions; no existing position
  changed bucket; `FRQ_SHARP` 12. `eco.js`: the 199 existing entries unchanged.
- Coverage matrix: covered 215 -> 226, transposes 27 -> 28, missing 95 -> 83.

The pipeline is §10's, in the same order, with `--semi` in place of `--plan`; the
second `--write` printed "notes unchanged".
