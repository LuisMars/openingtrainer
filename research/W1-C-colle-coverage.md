<!-- W1-C · 2026-09-20 · lane C · Colle as White -->
<!-- Every number below was recomputed from research/freq-*.json with node; none is quoted from COVERAGE-MATRIX.md without re-deriving it. -->

# W1-C — Colle (White): priority branches, gaps and stopping criteria

Read [METHOD.md](METHOD.md) before any share here. Three pools, never merged:

| pool | file | what it read | what it can support |
|---|---|---|---|
| `player` | `freq-colle-player.json` | lichess `2014-01` dump, avg Elo ≥1500, 495,101 games read, 137,678 in tree | the only pool not selected by opening: how often a reply is actually met |
| `master-pgnmentor` | `freq-colle-master-pgnmentor.json` | `data-src/master/Colle.pgn`, 18,747 read, 18,649 in tree | which continuations strong players choose **once the game is already classified Colle**. Selection is total at the root: 12,047 `d5` + 4,388 `Nf6` = 16,435 = every game. Every other first move reads 0 **because it was excluded, not because it is unplayed.** |
| `master-twic` | `freq-colle-master-twic.json` | TWIC issues 1540–1600, 532,215 read, 224,263 in tree, **no Elo filter** | general master play, readable the way the player pool is; "master" here means TWIC's inclusion standard, not a rating band |

Two conventions used throughout, per CONTRACTS.md:

- **Conditional reply share** = `games / parent_games` at that node. **Reach probability** = the product of Black's conditional shares along the path. They are printed separately and never conflated.
- A share from **fewer than 30 parent games is an observation, not an estimate**, and is tagged `[obs]`.

One structural caveat that colours everything below: `parent_games` counts games in which **both** sides happened to play the tree's moves, so it shrinks partly because random dump Whites played 2.c4 rather than 2.Nf3. It is not "how often a Colle player reaches this". The chained conditional shares are the right figure for our user, and those are what the reach-probability column gives.

**Frequency is not quality.** Nothing below says a move is good because it is common, or bad because it is rare.

---

## 0. Two corrections to the coverage matrix, found while checking it

**(a) Two `covered` cells in the Colle-as-White section are credited only to Hippopotamus lines, where the user plays Black.** They give the White repertoire nothing.

| position | reply | player | credited to | `you` |
|---|---|---|---|---|
| `rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1` | `e6` | 14.4% (18,128 / 125,718) | `eco-rat` | **b** |
| `rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 0 1` | `g6` | 4.8% (578 / 11,962) | `hip66` | **b** |

A third cell is mixed: `1...g6` after 1.d4 is credited to `hip-g16`, `eco-averb`, `eco-psam`, `syn-london` (all `you:"b"`) plus exactly one White line, `eco-ptero`, which is 8 plies long.

Recommendation for lane E: `tools/coverage-matrix.mjs` should filter the Colle section to `you === "w"` lines. Treat `1...e6` as **missing** in every count below.

**(b) The probe tree cannot see past an uncovered reply.** `tools/count-replies.mjs` drops a game the moment White leaves the repertoire, and there is no repertoire move after an unanswered Black reply — so no child node is ever created. Verified: the player file contains **no** position after `1...e6`, `1...e5`, `4...Be7`, `4...Bd6`, `3...Bb4+`, `2...Nc6` or `4...O-O` in the KID structure. Consequence: **for every gap in this document we know how often the move is played and nothing whatsoever about what follows it.** That is recorded as a research gap (§6), not worked around.

---

## 1. Priority branches

Ranked by three factors stated separately for every row. There is no composite score.

- **F — observed frequency.** Conditional share and raw count, per pool, with sample size.
- **C — chess criticality.** Whether the reply is forcing, tactical, or dissolves the structure every covered line assumes. A judgement, no engine behind it (CLAUDE.md rule 3).
- **P — popular-opening connection.** Whether the reply is the front door to an opening the user will recognise by name.

Ordering rule, applied openly: a branch outranks another when it scores higher on **two of the three** factors; ties break towards the branch with no transpositional rescue. `T` in the coverage column means the repertoire rejoins the same `keyFen` after the stated continuation (verified by replaying against `src/engine.js`, §4), so the gap is a drill gap rather than a content gap.

| # | position (FEN) | reply | player share (n / parent) | reach prob. | pgnmentor (selected pool) | twic | coverage | F | C | P |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1` | `e6` | 14.4% (18,128 / 125,718) | 14.4% | 0 / 16,435 — **excluded by classification, says nothing** | 3.7% (6,327 / 170,662) | **missing** (matrix says covered; credit is a Black line, §0a) | **high** — 3rd commonest answer to 1.d4 in the only unselected pool | medium — not forcing, but White must choose 2.Nf3 vs 2.c4/2.e4 with no line to follow, and the French player is waiting | **high** — French, Nimzo-Indian, QGD, Stonewall all open this door |
| 2 | `rnbqkb1r/ppp2ppp/4pn2/3p4/3P4/3BPN2/PPP2PPP/RNBQK2R b KQkq - 0 1` | `Be7` | 17.5% (18 / 103) | 0.54% | **16.6% (666 / 4,013)** | 16.4% (110 / 669) | **missing**, no rejoin in 14 plies | medium — 3rd commonest at the node; player figure rests on 18 raw games, the 666-game pgnmentor figure is the solid one and carries that pool's bias | **high** — removes the ...Bd6 that every Colle line here assumes, so the whole h7 mechanism is off the board | **high** — the standard QGD/Meran-flavoured treatment |
| 3 | `rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 0 1` | `Nc6` | 15.8% (1,472 / 9,305) | 6.57% | 0 / 11,638 — excluded (100% `Nf6`) | 2.3% (251 / 10,811) | **missing**, no rejoin | **high** in the player pool; pgnmentor is silent by construction and twic disagrees sharply (2.3%) | medium-high — ...Bg4 and ...e5 both follow, and Bd3 blocks nothing Black cares about | medium-high — Chigorin family, and the club player's default developing move |
| 4 | `rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 0 1` | `e6` | 21.9% (2,039 / 9,305) | 9.11% | 0 / 11,638 — excluded | 12.9% (1,397 / 10,811) | **missing**, but `T` — 3.e3 Nf6 reaches `ck@6` exactly | **very high** — 2nd commonest reply | **low** — pure move order once Black commits to ...Nf6 | high — same door as row 1 |
| 5 | `rnbqk2r/ppppppbp/5np1/8/3P4/3BPN2/PPP2PPP/RNBQK2R b KQkq - 0 1` | `O-O` | 57.3% (67 / 117) | 3.18% | absent from pool | 56.5% (35 / 62) | **missing** — `eco-kid` answers 4...d6 and then **ends** | **high conditionally** (the single commonest reply at the node), on a thin 117-game parent | medium — nothing forcing, but it is where the KID actually begins and the repertoire has no move | **high** — King's Indian |
| 6 | `rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1` | `d6` | 4.7% (5,913 / 125,718) | 4.70% | 0 / 16,435 — excluded | 2.5% (4,325 / 170,662) | **missing**; the only rejoin is `eco-kid`'s **terminal** position | medium-high — 5th commonest answer to 1.d4 | medium — slow, but it is the Pirc/KID/Hippo trunk and White's 2nd/3rd moves matter | high — Pirc, Old Indian, KID, Hippo |
| 7 | `rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 0 1` | `Bf5` | 7.5% (699 / 9,305) | 3.12% | 0 / 11,638 — excluded | 2.2% (239 / 10,811) | **missing** at move 2, but `T` — 3.e3 Nf6 reaches the `anti`/`trap`/`soltis` node | medium | **high** — this is the reply the repertoire already treats as critical (four lines, one a deliberate mistake); only the move order is unhandled | high — London/Slav-flavoured, and the classic anti-Colle |
| 8 | `rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1` | `c6` | 3.4% (4,328 / 125,718) | 3.44% | 0 / 16,435 — excluded | 0.4% (752 / 170,662) | **missing**, but `T` — 2.Nf3 d5 3.e3 Nf6 reaches `syn-slav@6` | medium in the player pool, near-absent in twic | medium — the Slav wall is a real structural choice and `syn-slav` only answers ...Bg4 | high — Slav / Caro structures |
| 9 | `rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1` | `b6` | 3.7% (4,679 / 125,718) | 3.72% | 0 / 16,435 — excluded | 0.3% (567 / 170,662) | **missing**, but `T` — 2.Nf3 Bb7 3.e3 e6 4.Bd3 Nf6 reaches `syn-qid@8` | medium (player), negligible (twic) | low-medium | medium — Owen's / English Defence / QID |
| 10 | `rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R b KQkq - 0 1` | `Nc6` | 11.3% (82 / 727) | 1.26% | **0.7% (114 / 15,866)** | 0.2% (3 / 1,804) | **missing**, no rejoin | medium; the pools disagree by a factor of ~16, which is itself the finding | medium — ...Nc6 before ...e6 keeps ...Bg4 and ...e5 alive and the covered lines all assume ...e6 first | medium |
| 11 | `rnbqkbnr/pp1ppppp/8/2p5/3P4/4P3/PPP2PPP/RNBQKBNR b KQkq - 0 1` | `e6` | 20.1% (144 / 718) | 0.89% | absent | 10.7% (15 / 140) | **missing**, but `T` — 3.Nf3 Nf6 4.Bd3 d5 5.c3 reaches `ck@9` | medium | low — declines `syn-benoni`'s premise (`2...cxd4`, 64.5%) and heads back to the Colle | medium — Benoni/Sicilian-hybrid intentions |
| 12 | `rnbqkb1r/ppp2ppp/4pn2/3p4/3P4/3BPN2/PPP2PPP/RNBQK2R b KQkq - 0 1` | `Bd6` | 23.3% (24 / 103) | 0.72% | 15.7% (628 / 4,013) | 18.5% (124 / 669) | **missing**, but `T` — 5.c3 c5 reaches `ohanlon@10` / `syn-e5colle@10` exactly | medium-high (2nd at the node) | low — the repertoire's own tabiya arrives two plies later | high — it *is* the mainline Colle bishop |
| 13 | `rnbqkb1r/pppp1ppp/4pn2/8/3P4/4PN2/PPP2PPP/RNBQKB1R b KQkq - 0 1` | `Bb4+` | 4.5% (7 / 154) `[obs-ish: 154 parent, 7 raw]` | 0.20% | node absent from the pool | 0 / 1,070 | **missing**, no rejoin | **low** | **high** — a check: White must pick Bd2 / Nbd2 / c3 immediately, and `eco-trad`'s own note advertises dodging it without showing the answer | medium-high — Bogo-Indian |

Rows 1–3 are the three that score high on two or more factors with no transpositional rescue. Rows 4, 7, 8, 9, 11 and 12 are frequency-driven but each has a verified rejoin, so they are cheaper: a move-order drill, not new theory. Row 13 is here on criticality alone and its frequency figure must not be used to argue it up or down.

---

## 2. Confirmed gaps

Marked `missing` in the matrix **and** shown by the data to matter, with no rejoin found. Numbers recomputed from the JSON.

### 2.1 The two you flagged — verified, with one correction

**`...Be7` after 1.d4 d5 2.Nf3 Nf6 3.e3 e6 4.Bd3**
FEN `rnbqkb1r/ppp2ppp/4pn2/3p4/3P4/3BPN2/PPP2PPP/RNBQK2R b KQkq - 0 1`

| | games / parent | share |
|---|---|---|
| player | 18 / 103 | **17.5%** |
| pgnmentor | 666 / 4,013 | **16.6%** |
| twic | 110 / 669 | 16.4% |

Your 17.5% / 16.6% reproduce exactly. **The "ahead of the covered ...Bd6" part does not.** Two things are off:

1. `...Bd6` is **not covered** at this position either — the matrix marks it `missing`. What it has is a rejoin: `4...Bd6 5.c3 c5` produces the identical `keyFen` as `ohanlon@10` and `syn-e5colle@10` (verified by replay). `...Be7` has no such rescue: I replayed `4...Be7 5.c3 c5 6.Nbd2 Nc6 7.O-O O-O` and **none** of those seven positions appears in any White line.
2. `...Be7` leads `...Bd6` **only in the pgnmentor pool** (16.6% vs 15.7%). In the player pool `...Bd6` is ahead, 23.3% (24) vs 17.5% (18); in twic it is ahead too, 18.5% (124) vs 16.4% (110).

So the honest statement is: *`...Be7` is the most frequent reply at this node for which the repertoire has neither a line nor a transposition.* That is a stronger claim than the one being corrected, and it is the reason this is gap #1 at the node.

Caveat on the player figure: 103 parent games clears the 30-game floor, but 18 raw games is thin. The 666-game pgnmentor figure is the load-bearing one and carries that pool's classification bias (it is conditional on the game having been catalogued as a Colle, which a ...Be7 game still is).

**`...Nc6` after 1.d4 d5 2.Nf3**
FEN `rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 0 1`

player **15.8% (1,472 / 9,305)** — reproduces exactly. twic 2.3% (251 / 10,811). pgnmentor cannot speak: that node is 100% `Nf6` (11,638 / 11,638) by selection.

No rejoin: `2...Nc6 3.e3 Nf6 4.Bd3 e6 5.c3` misses every line position, and so does `3...Bg4`. The related `3...Nc6` one ply later (`rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R`, 11.3% / 82 of 727) is also missing with no rejoin. Treat them as one gap with two doors.

### 2.2 The rest, found here

| gap | position | player | master | why it is a real gap |
|---|---|---|---|---|
| **`1...e6`** | after 1.d4 | 14.4% (18,128) | twic 3.7% (6,327); pgnmentor excluded | Matrix says `covered`; the credit is `eco-rat`, a Black line (§0a). No White line starts 1.d4 e6. A rejoin exists (2.Nf3 d5 3.e3 Nf6 = `ck@6`) but nothing drills the two plies where Black can instead play ...c5, ...b6, ...f5 or ...Bb4+. |
| **`4...O-O` in the g6 structure** | `rnbqk2r/ppppppbp/5np1/8/3P4/3BPN2/PPP2PPP/RNBQK2R b KQkq - 0 1` | 57.3% (67 / 117) | twic 56.5% (35 / 62) | The commonest reply at the node. `eco-kid` answers only `4...d6` (27.4%, 32) and terminates there; `colle-kid` branches one ply earlier with 4.b3 and never sees this position. |
| **`1...d6`** | after 1.d4 | 4.7% (5,913) | twic 2.5% (4,325) | No White line. Its only contact with the repertoire is `1...d6 2.Nf3 Nf6 3.e3 g6 4.Bd3 Bg7`, which lands exactly on `eco-kid`'s **final** position — coverage that teaches one move and stops. |
| **`...Bf5` in the Slav structure** | `rnbqkb1r/pp2pppp/2p2n2/3p4/3P4/3BPN2/PPP2PPP/RNBQK2R b KQkq - 0 1` | node parent 22 `[obs]`: `Bg4` 12, `g6` 4, `e6` 3, `h6` 1, `Qc7` 1, `Nbd7` 1 — **no `Bf5` observed** | pgnmentor 907: `Bg4` 671, `e6` 111, `g6` 68, `Nbd7` 48 — **no `Bf5`**; twic 79: likewise none | `syn-slav` answers `...Bg4` and that matches all three pools. Recorded here as a *checked non-gap*: the Caro-style `...Bf5` I expected does not appear in any pool at this node. Do not add a line for it on the strength of intuition. |
| **`3...Nc6`** | `rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R b KQkq - 0 1` | 11.3% (82 / 727) | pgnmentor 0.7% (114 / 15,866); twic 0.2% (3 / 1,804) | Missing, no rejoin, and the pool disagreement (11.3% vs 0.2%) is exactly the club-versus-master split this trainer exists to serve. |
| **`3...Bb4+`** | `rnbqkb1r/pppp1ppp/4pn2/8/3P4/4PN2/PPP2PPP/RNBQKB1R b KQkq - 0 1` | 4.5% (7 / 154) | pgnmentor: node absent; twic 0 / 1,070 | Forcing. See §3 — it belongs there as much as here. |
| **`1...e5`** | after 1.d4 | 2.4% (3,045) | twic 0.3% (546) | Nothing in the repertoire plays 2.dxe5 or anything else. See §3. |
| **`1...c5 2.e3 e6`** | `rnbqkbnr/pp1ppppp/8/2p5/3P4/4P3/PPP2PPP/RNBQKBNR b KQkq - 0 1` | 20.1% (144 / 718) | twic 10.7% (15 / 140) `[obs]` | `syn-benoni` assumes `2...cxd4` (64.5%, 463). The second commonest reply declines it. Rejoin exists (3.Nf3 Nf6 4.Bd3 d5 5.c3 = `ck@9`), undrilled. |
| **`1...g6 2.Nf3 Bg7 3.e3 d6`** | `rnbqk1nr/ppppppbp/6p1/8/3P4/4PN2/PPP2PPP/RNBQKB1R b KQkq - 0 1` | 24.2% (40 / 165) | twic **56.4%** (22 / 39) `[obs]` | `eco-ptero` answers only `3...c5` (9.1%, 15) — the ...Qa5+ trick — and `3...e6` (29.7%, 49) and `3...d6` are both unanswered. Note the pools invert here. |

---

## 3. Rare but forcing

**This section is a chess judgement, not a data result.** The entries were chosen by what the move threatens, and their frequencies are printed only so nobody later mistakes them for popular. Frequency must not be used to drop any of them. Equally, per CLAUDE.md rule 3, **none of the tactical claims below has been checked against an engine** — each is a reason to look, not a verdict to ship. Any note written from this section must be engine-verified first, or cut before the claim.

1. **`1...e5`, the Englund Gambit.** 2.4% (3,045) player, 0.3% (546) twic. It is a pawn offered on move one and the follow-up `2.dxe5 Nc6 3.Nf3 Qe7` aims a queen at b2 and b4 with a well-known trap attached. A Colle player who has never seen it has to solve it over the board on move two. Cover it. What the refutation actually is must be established with the engine, not asserted.
2. **`3...Bb4+` (1.d4 Nf6 2.Nf3 e6 3.e3 Bb4+).** 4.5% (7 of 154) player, **zero** in 1,070 twic games at that node. A check is a check: White cannot play a system move and must choose between Bd2, Nbd2 and c3, each with a different structure behind it. `eco-trad`'s existing note already advertises avoiding it, which makes the silence worse rather than better.
3. **Early `...Qb6` against the Zukertort b3/Bb2 build.** Barely visible in the data (pgnmentor records one game in 989 at the 5.c3 node; the player node there has 23 parent games `[obs]` and no `...Qb6` at all). It is here because the b2 pawn is genuinely loose in the window between `b3` and `Bb2`, and every Zukertort line in the repertoire (`cz`, `cz-tab`, `rudel`, `syn-qf3`, `syn-ne4`) passes through that window. A gap that costs a pawn on move six does not need a frequency to justify itself.
4. **`...Qa5+` from move orders other than `eco-ptero`'s.** `eco-ptero` covers exactly one: 1.d4 g6 2.Nf3 Bg7 3.e3 c5 4.Bd3 Qa5+. The same check exists in the `1...d6` and `1...c5` move orders that §2 lists as gaps, and `eco-rham` shows it again from the Reti order. Once a gap is filled, the check has to be answered in it.
5. **`...Bxf3` immediately (after 2...Bg4 or 3...Bg4).** `anti-bg4` assumes `...Bh5` after 4.h3 and drills the hunt. The alternative — Black just takes — hands White doubled f-pawns and the bishop pair and changes the game completely. There is **no data at all** for it: the probe tree stops at `anti-bg4`'s own moves, so the file has no node after `...Bxf3`.
6. **`...cxd4` early, before White has chosen c3 or b3.** The repertoire has no line in which Black takes on d4 before White commits, yet the recapture choice (`exd4` versus `cxd4`) is the whole structural fork of the opening. pgnmentor records `cxd4` 12 / 989 at the 5.c3 node; that number is not the argument, the fork is.
7. **`...Ne4` in the Koltanowski (c3) structure.** `syn-ne4` answers it only in the Zukertort (b3/Bb2) structure, where the whole point is that a different pawn takes back. pgnmentor: `Ne4` 1 / 989 at 5.c3, 6 / 15,866 at 3.e3. Rare, and the move that most often surprises a system player into an unsound capture.

---

## 4. Transposition notes

All identities below were confirmed by replaying the move order against `src/engine.js` and comparing `keyFen()` output — not by eye.

### 4.1 Confirmed identities (same `keyFen`, so the trainer already answers the position)

| move order | rejoins | at |
|---|---|---|
| 1.d4 **e6** 2.Nf3 d5 3.e3 Nf6 | `ck@6`, `cz@6`, `rudel@6`, `syn-greek/qf3/ne4/clamp@6` | ply 6 |
| 1.d4 e6 2.Nf3 **Nf6** 3.e3 d5 4.Bd3 | same node | ply 6 |
| 1.d4 e6 2.Nf3 **c5** 3.e3 Nf6 4.Bd3 d5 | `ck@8` family | ply 8 |
| 1.d4 **c5** 2.e3 e6 3.Nf3 Nf6 4.Bd3 d5 5.c3 | `ck@9` / `eco-trad@end` | ply 9 |
| 1.d4 d5 2.Nf3 **e6** 3.e3 c5 4.Bd3 Nf6 5.c3 | `ck@9` | ply 9 |
| 1.d4 d5 2.Nf3 **c6** 3.e3 Nf6 4.Bd3 | `syn-slav@6` | ply 6 |
| 1.d4 **c6** 2.Nf3 d5 3.e3 Nf6 4.Bd3 | `syn-slav@6` | ply 6 |
| 1.d4 **b6** 2.Nf3 Bb7 3.e3 e6 4.Bd3 Nf6 | `syn-qid@8` | ply 8 |
| 1.d4 d5 2.Nf3 **Bg4** 3.e3 Nf6 | `anti-bg4@6` | ply 6 |
| 1.d4 d5 2.Nf3 **Bf5** 3.e3 Nf6 | `anti@6`, `trap@6`, `soltis@6`, `soltis-trap@6` | ply 6 |
| 1.d4 d5 2.Nf3 **c5** 3.e3 Nf6 4.Bd3 Nc6 5.c3 e6 | `ck@10`, `kolt@10`, `syn-greek@10` | ply 10 |
| 1.**Nf3** d5 2.d4 Nf6 3.e3 e6 4.Bd3 | `ck@7` | ply 7 |
| 1.d4 Nf6 2.Nf3 **d5** 3.e3 e6 4.Bd3 c5 5.c3 | `ck@9` | ply 9 |
| 4...**Bd6** 5.c3 c5 | `ohanlon@10`, `syn-e5colle@10` | ply 10 |
| 4...**c5** 5.c3 Nc6 6.Nbd2 Bd6 | `ck@12` and `kolt@12` — two stored lines, one key | ply 12 |
| 1.d4 **d6** 2.Nf3 Nf6 3.e3 g6 4.Bd3 Bg7 | `eco-kid`'s **final** position | ply 8 |

### 4.2 Where the position matches but the explanation must not

- **`ck` vs `kolt`.** They converge at ply 9, not ply 8 — `ck@8` has Bd3 played, `kolt@8` has c3. `kolt`'s ply-8 note ("Same position as the main line, reached by a different order") is one ply early; W0-C already flagged it and the replay confirms it.
- **1...e6 orders.** The position after 3.e3 Nf6 is identical to `ck@6`, but the player who opened 1...e6 is usually a French or Nimzo player who has not yet committed to ...d5. The lesson at ply 2 is "what White does when Black hides his intentions", which `ck` never teaches because in `ck` Black declared on move one.
- **4...Bd6 before ...c5 vs after.** Same key at ply 10, different option set on the way: after 4...Bd6 Black can still choose ...Nbd7 and ...O-O without ever playing ...c5, and the trainer's "why" has to acknowledge that rather than assert the Koltanowski tabiya was forced.
- **1.Nf3 first.** Reaches `ck@7` and dodges 1...e5 and the early ...Bf5/...Bg4 sorties entirely, at the cost of allowing 1...c5 Reti lines (`eco-rham`). The position is the same; the reason the user arrived there is not, and an explanation that ignores that is teaching a coincidence.
- **`1...d6` / `1...Nf6 2.Nf3 d6` into `eco-kid`'s end.** The key matches but the line stops, so a user routed here is handed a position and no plan. Matching a terminal position is not coverage.
- **`syn-qid`'s `...Be7`.** The repertoire does contain `...Be7` (`syn-qid@11`) — in a b3/Bb2 QID structure with Black's bishop on b7. It is not an answer to §2.1's gap, where White has played c3 and Black has a pawn on d5. Same SAN, different problem; do not let one credit the other.

---

## 5. Proposed stopping criteria

The evidence for these is how fast the samples thin. Along the trainer's own main line, the player pool collapses by an order of magnitude every two plies:

| ply | position | player `parent_games` | pgnmentor | twic |
|---|---|---|---|---|
| 1 | after 1.d4 | 125,718 | 16,435 (selected) | 170,662 |
| 3 | after 1.d4 d5 2.Nf3 | 9,305 | 11,638 | 10,811 |
| 5 | after 3.e3 | 727 | 15,866 | 1,804 |
| 7 | after 4.Bd3 | **103** | 4,013 | 669 |
| 9 | after 5.c3 | **23** `[obs]` | 989 | 136 |
| 11 | after 6.Nbd2 | **absent** (below the tool's `--minGames 20`) | — | — |

Of the 27 player-pool positions, 11 have fewer than 100 parent games and 5 have fewer than 30. The shipped lines run 19 to 39 plies. **Beyond about ply 9 the player pool has nothing left to say**, and past ply 11 it has no nodes at all.

Proposed criteria, in order of application:

1. **Breadth before depth, to ply 8.** At any node with ≥100 player parent games, every reply at ≥2% player share gets an explicit answer or a named transposition. That rule alone generates rows 1–12 of §1 and costs nothing in new theory for the seven of them that transpose.
2. **Depth cutoff: stop where two of three pools fall below 30 parent games.** On the main line that is ply 11. A branch may go deeper only for a *stated non-frequency reason*, and the reason is written into the line: a named tabiya, a forced sequence, or a `game`-tagged score being followed to its end (`ohanlon` at 39 plies is legitimate on that ground; a 27-ply `synthetic` is not).
3. **End a branch at a decision, not at a ply count.** A branch ends at the first position where White's plan genuinely forks — the e4 break versus the Ne5 clamp versus dxc5 — or where a concrete tactic must be calculated. That position is the teachable unit; everything after it is one of several answers and should be a separate line if it is worth having.
4. **Any share quoted from under 30 parent games is labelled in the line's own note**, or not quoted. Five nodes in this chapter are in that state today.
5. **A reply that transposes gets a one-line pointer, not a line.** Rows 4, 7, 8, 9, 11 and 12 of §1 are drill gaps: the cheapest correct fix is a note naming the rejoining line, not a new 20-ply entry that duplicates `ck`.
6. **New depth needs an eval row.** Every `missing` reply in the matrix also has `eval: no`. A new branch that goes past the fork in criterion 3 without a stored `EVL` row is a branch nobody has checked, and CLAUDE.md rule 3 then forbids the note that would make it worth drilling.

---

## 6. Research gaps

Recorded, not filled. None of these was substituted with a guess.

1. **The lichess opening explorer API is unavailable here** — `explorer.lichess.ovh` returns HTTP 401 through this environment's proxy. Every figure in this document is a local count from a named dump. No explorer figure is quoted, approximated or reconstructed.
2. **No data exists downstream of any gap.** The probe tree prunes a game the moment White leaves the repertoire, so an unanswered Black reply has no children. Verified absent: every position after `1...e6`, `1...e5`, `4...Be7`, `4...Bd6`, `3...Bb4+`, `2...Nc6`, `4...O-O` (g6 structure) and `...Bxf3`. **We know how often these are played and nothing about what follows.** Filling any of them requires a fresh `count-replies` run with the candidate reply added to the probe tree.
3. **The pgnmentor pool cannot speak at the root or at move 2.** Its root is 100% `d5`+`Nf6` and its 2.Nf3 node is 100% `Nf6`. For rows 1, 3, 4, 6, 8 and 9 of §1 it contributes nothing, and a "0" there means *excluded*, never *unplayed*.
4. **No time-control filter was applied** to the player pool (`speeds: null`), so the blitz/bullet/classical composition of those 137,678 games is unknown and unrecorded. Reply shares may be time-control sensitive; this is untested.
5. **One month, one year.** The player pool is `2014-01` only. Nothing here supports a claim about current club practice, and no trend can be computed. TWIC covers issues 1540–1600 only, with no Elo filter, so "master" is TWIC's editorial standard.
6. **The rating band is `avg(WhiteElo, BlackElo) ≥ 1500`, unstratified.** A 1500-and-1900 pairing counts identically to two 1700s, and no per-band breakdown exists.
7. **No engine evaluation anywhere in this chapter's gaps.** The matrix reports `eval: no` for every `missing` reply, and I ran no engine. Every tactical statement in §3 is flagged as a reason to look, not a result. `tools/build-evals.mjs` would have to be rerun after any new line lands.
8. **Win/draw/loss counts are present in the player JSON and deliberately unused.** They do not establish quality (CONTRACTS.md), and no scoring argument appears above.
9. **The Englund refutation is unverified here** and must not be written into a note until a forced search against `src/engine.js` confirms it.
10. **`pgnmentor` parent counts differ slightly from the matrix's rounding** in places (e.g. `...Bd6` 628/4,013 = 15.65%, matrix prints 15.7%). Immaterial, but recorded so a later reader does not read a discrepancy as an error.
