<!-- W1-D · 2026-09-20 · repertoire audited against commit 598a374 -->
<!-- Every number below was produced by running node against research/freq-hippo-*.json
     or against the built bundle (docs/index.html). Nothing is quoted from memory,
     from the lichess explorer (HTTP 401 here) or from any other source. -->

# W1-D — Hippopotamus (Black): priority White setups, confirmed gaps, stopping criteria

Read [METHOD.md](METHOD.md) and [CONTRACTS.md](CONTRACTS.md) first. This file tests
the ten gaps hypothesised in [W0-D-hippo-inventory.md](W0-D-hippo-inventory.md)
against counted data, and reads the **Hippopotamus as Black** half of
[COVERAGE-MATRIX.md](COVERAGE-MATRIX.md).

## 0. What is counted here, and what is not

| pool | file | what it is | size | filters |
|---|---|---|---|---|
| `player` | `research/freq-hippo-player.json` | lichess monthly dump, CC0 | 495,101 games read, 495,101 entered the tree, 29 positions at or above the 20-game floor | `side:b`, `minElo:1500` (average of the two Elos), `maxElo:null`, no speed filter, `maxPly:20`, input `data-src/games/lichess_db_standard_rated_2014-01.pgn.zst`, retrieved 2026-09-20 |
| `master-twic` | `research/freq-hippo-master-twic.json` | The Week in Chess weekly archives, **not** selected by opening | 532,215 games read, 531,936 entered the tree, 30 positions | `side:b`, `minElo:null` (**no rating filter at all**), `maxPly:20`, inputs `data-src/twic/twic1540.pgn` … `twic1600.pgn` (61 issues), retrieved 2026-09-20 |
| `master-pgnmentor` | `research/freq-hippo-master-pgnmentor.json` | — | **absent.** The file did not exist when this was written. | — |

One extra run was made for this file and is **not** a repository artefact: the same
tool, same dump, same rating floor, pushed deeper to test whether the counted tree
could reach the plans §2 calls untestable.

```
node tools/count-replies.mjs --side b --pool player \
  --in data-src/games/lichess_db_standard_rated_2014-01.pgn.zst \
  --minElo 1500 --maxPly 30 --minGames 2 --out <scratch>/deep.json
```

Raising the ply cap from 20 to 30 and dropping the sample floor from 20 games to 2
grew the tree from **29 positions to 37**. Eight new positions, of which five have
under 20 parent games and three have 2, 3 and 4. Referred to below as **the deep
run**; every share taken from it is an observation by construction.

Three things follow and are not negotiable in how the tables below are read.

1. **The two pools are never merged, added or compared move-for-move.** They are
   reported in separate columns. Where they disagree sharply (3.e5 below) that
   disagreement is the finding, not an error to be averaged away.
2. **`master-twic` has no rating filter and no opening selection.** METHOD.md says
   this is the master pool that can be read the way the player pool is; its
   limitation is date range, and the range is named above. It is *not* a
   strong-player filter — it is "whatever appeared in TWIC issues 1540–1600".
3. **`master-pgnmentor` is missing, so no opening-classified master share appears
   anywhere in this file.** When it lands, every share from it will be conditional
   on the game having been classified Modern/Pirc, and will systematically
   understate every White try that leaves that classification. Nothing here has
   been written to be back-filled with it.

Two more rules held throughout: **conditional reply share (`games / parent_games`)
is kept separate from the probability of reaching the position** (`parent_games /
games_read`), and **any share from under 30 parent games is labelled an
observation**, not an estimate.

### The single largest structural limit

The probe tree was asked for `maxPly:20` but **died at ply 8–10** — not because of
the ply cap but because positions fell below the 20-game floor. Minimum ply at
which each counted position first appears in the repertoire, against its sample:

| ply | positions counted | smallest sample at that ply |
|---|---|---|
| 0 | 1 | 495,101 |
| 2 | 6 | 575 |
| 4 | 7 | 82 |
| 6 | 10 | 25 |
| 8 | 4 | 20 |
| 10 | 1 | 48 |

So the player pool, at this rating floor and this one month, supports **four to
five Black moves of counted evidence and no more**. Everything past that is chess
judgement, and this file labels it as such rather than dressing it in a share.

**The deep run confirms this is a shortage of games, not of plies.** With the ply
cap raised to 30 and the floor dropped to 2 games, the deepest node on the storm
path is ply 10 with **2 parent games** (`rn1qk1nr/pbp1ppbp/1p1p2p1/8/3PP3/2N1B3/
PPPQ1PPP/R3KBNR w KQkq - 0 1`, after 1.e4 g6 2.d4 Bg7 3.Nc3 b6 4.Be3 Bb7 5.Qd2 d6:
O-O-O 1, f3 1). Lifting the cap buys nothing; the branch simply runs out of games.

---

## 1. Priority White setups against the ...g6/...d6 crouch

Ranked **by observed exposure** (raw player-pool games — the ordering used for the
table), with **chess criticality** and **system recognisability** reported as two
separate, independent columns. They are never combined into a score. A row that is
rare but critical is found in §3, not by a hidden weighting here.

Column meanings:

- **reach** — `parent_games / 495,101`: how often the player pool arrives at this
  position at all. Not a quality claim, not the reply share.
- **player** — conditional share at that position, player pool, with raw count.
- **twic** — the same reply's conditional share in `master-twic`, with raw count.
  Different pool, different population, **not comparable move-for-move**.
- **crit** — chess criticality, a judgement (see §3 for the basis), one of
  `storm` (a pawn advance aimed at the black king), `space` (a central pawn past
  the fourth rank), `structural` (changes what the wall can do), `quiet`.
- **system** — whether the move names a system the learner will meet under that
  name.
- **cov** — coverage status read off `research/COVERAGE-MATRIX.md`.

### 1A. The counted backbone, by exposure

| # | position (FEN) | White | reach | player | twic | crit | system | cov |
|---|---|---|---|---|---|---|---|---|
| 1 | `rnbqkbnr/pppp1ppp/4p3/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1` (1.d4 e6) | c4 | 3.65% | **44.5%** (8,037) | 53.8% (3,405) | structural | Queen's Gambit / English hybrid | **missing** |
| 2 | `rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1` (1.e4 d6) | d4 | 2.49% | 42.8% (5,281) | 90.1% (7,884) | structural | Pirc/Modern main | covered |
| 3 | `rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1` (1.e4 g6) | d4 | 2.05% | 42.2% (4,284) | 88.9% (5,979) | structural | Modern main | covered |
| 4 | `rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1` (1.e4 d6) | Nf3 | 2.49% | **26.3%** (3,251) | 3.2% (280) | quiet | KIA / flexible | **missing** |
| 5 | `rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1` (1.d4 g6) | c4 | 1.26% | 42.9% (2,675) | 38.9% (1,669) | structural | Averbakh / KID centre | covered |
| 6 | `rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1` (1.e4 g6) | Nf3 | 2.05% | **24.0%** (2,433) | 2.9% (193) | quiet | KIA / delayed d4 | **missing** |
| 7 | `rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1` (1.e4 g6 2.d4 Bg7) | Nf3 | 0.91% | 26.0% (1,177) | 24.7% (1,622) | quiet | classical Modern | covered |
| 8 | `rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1` (…2.d4 Nf6) | Bd3 | 0.34% | **19.8%** (334) | 6.6% (432) | quiet | "Classical/Two Knights"-ish | **missing** |
| 9 | `rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1` (1.e4 d6) | f4 | 2.49% | **8.3%** (1,030) | 0.7% (61) | storm | Austrian precursor | **missing** |
| 10 | `rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1` (1.e4 g6) | Bc4 | 2.05% | **8.9%** (906) | 0.3% (18) | quiet | Bishop's Opening vs Modern | **missing** |
| 11 | `rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1` (1.d4 g6) | e4 | 1.26% | 14.9% (927) | 31.8% (1,364) | structural | Modern by transposition | covered |
| 12 | `rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1` (1.d4 g6) | Nf3 | 1.26% | 14.1% (876) | 16.5% (708) | quiet | Réti/London family | covered *(only by `eco-ptero`, a Pterodactyl skeleton with 2…Bg7 3.e3 c5 — not a Hippo answer)* |
| 13 | `rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1` (1.e4 g6) | f4 | 2.05% | **8.1%** (819) | 0.3% (20) | storm | three-pawn / Austrian | **missing** |
| 14 | `rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1` (…2.d4 Bg7) | **e5** | 0.91% | **15.2%** (689) | 0.0% (1) | **space** | space grab | **missing** |
| 15 | `rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1` | Nc3 | 0.91% | 13.8% (623) | 60.9% (4,002) | structural | Modern main | covered |
| 16 | `rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1` (1.d4 g6) | e3 | 1.26% | **8.3%** (517) | 0.6% (27) | quiet | Colle/London-ish setup | **missing** |
| 17 | `rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1` | c3 | 0.91% | **11.3%** (513) | 3.3% (219) | quiet | slow centre | **missing** |
| 18 | `rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1` (1.e4 g6) | Nc3 | 2.05% | **4.9%** (495) | 3.0% (201) | quiet | Modern by transposition | **missing** |
| 19 | `rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1` | c4 | 0.91% | 10.1% (457) | 4.9% (319) | structural | Averbakh | transposes |
| 20 | `rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1` (1.e4 g6) | d3 | 2.05% | **4.6%** (469) | 0.4% (25) | quiet | **King's Indian Attack** | **missing** |
| 21 | `rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1` | f4 | 0.91% | 9.4% (425) | 1.5% (101) | storm | three-pawn centre | covered |
| 22 | `rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1` | **Be3** | 0.91% | **9.3%** (420) | 2.3% (150) | structural | 150-Attack move order | **missing** |
| 23 | `rnbqk1nr/ppp1ppbp/3p2p1/8/2PPP3/8/PP3PPP/RNBQKBNR w KQkq - 0 1` (1.d4 g6 2.c4 Bg7 3.e4 d6) | Nc3 | 0.06% | 62.8% (196) | 85.1% (418) | structural | Averbakh main | **matrix says missing — see §6, the matrix is wrong here** |
| 24 | `rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 1` (Pirc with …Nf6) | **Bg5** | 0.14% | **17.1%** (118) | 8.7% (147) | structural | Byrne / Bg5 Pirc | **missing** |
| 25 | `rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 1` (…3.Nf3 d6) | Bc4 | 0.10% | **22.1%** (113) | 25.8% (281) | quiet | classical Modern | **missing** |
| 26 | `rnbqk1nr/1pp1ppbp/p2p2p1/8/3PP3/2N1B3/PPP2PPP/R2QKBNR w KQkq - 0 1` (…3.Nc3 d6 4.Be3 a6) | **h4** | not in player pool ≥20 | — | **14.0%** (95) | **storm** | 150 Attack / h-storm | **missing** |
| 27 | same position | **g4** | — | — | **9.3%** (63) | **storm** | Pseudo-Sämisch storm | **missing** |
| 28 | same position | Qd2 | — | — | 42.3% (286) | structural | 150 Attack | covered (`syn-hipdown`) |

Rows 26–28 exist only in the master pool: the player tree never reaches that
position with 20 games, and `master-twic` reaches it with 677. They are a master
observation of what happens after the repertoire's own `syn-hipdown` move order
(1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Be3 a6), and **the pool is not rating-filtered**.

### 1B. The same evidence, ranked by criticality instead

Independent of frequency. This ordering is a chess judgement and is argued in §3.

1. **e5 space grab at move 3** (row 14) — the only `space` row in the top twenty
   by exposure, 689 player games, and the repertoire's answer to e5 (`hip-e5`)
   only exists nine moves later in a different structure.
2. **h4 / g4 from the Be3 tabiya** (rows 26–27) — 158 of 677 master games at that
   node, combined, are an immediate wing pawn.
3. **f4 at move 2** (rows 9, 13) — 1,849 player games across the two orders, and
   the repertoire's own notes say the three-pawn centre is the structure the
   crouch must abandon.
4. **Bg5 against the …Nf6 version** (row 24) — pins the knight that `hip-f4` says
   is the exit from the f4 structure.
5. **Be3 before Nc3** (row 22) — reaches the storm tabiya by an order no line
   drills, so a learner who knows `hip-150` may not recognise it.

### 1C. The same evidence, ranked by system recognisability

Independent again: does the learner meet this under a name?

1. Austrian Attack (f4) — named, covered in two orders.
2. 150 Attack (Be3/Qd2/f3/g4) — named, covered only from the Nc3-first order.
3. Averbakh (c4/e4/Nc3) — named, covered.
4. **King's Indian Attack (e4/d3/Nd2/Ngf3/g3/Bg2)** — named, **absent**; the d3
   entry point is 4.6% / 469 player games at 1.e4 g6.
5. **Byrne/Bg5 Pirc** — named, **absent**.
6. **London and Torre against …g6** — London covered (`syn-london`); Torre/Bg5 at
   1.d4 g6 is 2.1% / 132 player games, **absent**.

---

## 2. The ten hypothesised gaps, tested

Verdicts: **supported** (the counted data shows the setup occurs and no line
answers it), **not supported** (the data shows it is rarer than claimed, or that
something does answer it), **untestable** (the counted tree does not reach the
position — no number is invented in its place).

### Gap 1 — Qd2 + Bh6, trading the g7 bishop. **Partly testable; the immediate move is measurable and rare, the plan is not.**

This was the top hypothesis, so it gets the fullest answer available.

`Bh6` appears in the counted data **three times in total**, and every occurrence is
an *immediate* Bc1–h6, not the Qd2-first plan:

| pool | position | Bh6 | parent | share |
|---|---|---|---|---|
| player | `rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1` (1.d4 g6) | 15 | 6,232 | 0.24% |
| player | `rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1` (1.e4 g6 2.d4 Bg7) | 7 | 4,526 | 0.15% |
| master-twic | `rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1` (1.d4 g6) | 1 | 4,296 | 0.02% |

So **as a second or third move, Bh6 is measurably rare in both pools.** The
inventory's claim that it is "the standard club plan" is not supported for the
immediate version.

**The Qd2-then-Bh6 plan cannot be measured, and the deep run was made specifically
to check that rather than assume it.** At `maxPly:30` and a 2-game floor, `Bh6`
still appears at **exactly the same two nodes and with exactly the same counts** —
15 and 7 — and nowhere else in 37 positions. The two nodes where a Qd2-first Bh6
could land are both in the deep run and both far below any usable sample:

| node | parents | replies counted | Bh6 |
|---|---|---|---|
| 1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Be3 a6 (`rnbqk1nr/1pp1ppbp/p2p2p1/8/3PP3/2N1B3/PPP2PPP/R2QKBNR w KQkq - 0 1`) | **14** | Qd2 7, f3 2, Bc4 2, h4 1, Nf3 1, f4 1 | **0** |
| 1.e4 g6 2.d4 Bg7 3.Nc3 b6 4.Be3 Bb7 5.Qd2 d6 (`rn1qk1nr/pbp1ppbp/1p1p2p1/8/3PP3/2N1B3/PPPQ1PPP/R3KBNR w KQkq - 0 1`) | **2** | O-O-O 1, f3 1 | **0** |

The second of those is the end of a chain that shows the collapse plainly: the
`hip-150` tabiya `rn1qk1nr/pbppppbp/1p4p1/8/3PP3/2N1B3/PPP2PPP/R2QKBNR w KQkq - 0 1`
has **20** parent games (Qd2 10, Bd3 4, f3 3, Nf3 1, Qf3 1, f4 1 — an observation,
under 30); one Black reply later it is down to **2**.

Fourteen games and two games. Neither supports a share, and an absence in a
2-game sample is not evidence of absence. The honest statement is:

> How often White follows Qd2 with Bh6 in these structures is **unmeasured here**,
> and the deep run establishes that this dump cannot measure it: the branch carries
> 2–14 games by the time Bh6 becomes available. The *immediate* Bh6 is measured and
> is 0.24% / 0.15% in the player pool and 0.02% in master-twic. Nothing in this
> repository supports a number for the plan, and none is offered.

Coverage is nonetheless **still missing**: no line in `LINES` contains `Bh6` at all
(verified against the built bundle), so if the plan does occur the repertoire has
no drill for it. The gap stands; the *priority* claimed for it in W0-D does not.

### Gap 2 — a line where White's h-pawn actually lands on h5. **Supported, and the master pool raises its priority.**

The player pool shows h4 as a rare-but-present try at every node (0.07% at move 1,
0.51% at 1.e4 g6, 0.80% at 1.d4 g6, 2.43% at 1.Nf3 g6). `master-twic` shows it far
more: **2.5% (165/6,723) at 1.e4 g6**, 1.7% (72/4,296) at 1.d4 g6, 2.4% (49/2,071)
at 1.e4 g6 2.d4 Bg7 3.Nc3 d6, and **14.0% (95/677)** from the Be3 tabiya.

`master-twic` also contains the position `syn-h4` teaches — after 4.h4 h5 —
with 21 parent games: Nf3 7, Nh3 6, Be3 6, Bg5 2. **Under 30 parents: an
observation, not an estimate.** `syn-h4` plays the Nf3 branch. Nothing covers Nh3
or Bg5 there, and **nothing anywhere covers the position after White's h-pawn
reaches h5**, because both storm lines stop it with …h5 first.

### Gap 3 — four pawns c4+d4+e4+f4 (Averbakh order with f4). **Supported.**

At `rnbqk1nr/ppp1ppbp/3p2p1/8/2PPP3/8/PP3PPP/RNBQKBNR w KQkq - 0 1` (1.d4 g6 2.c4
Bg7 3.e4 d6, 312 player parents / 491 master parents), White plays **f4 15.1%
(47)** in the player pool and 0.6% (3) in master-twic. Missing in the matrix and
genuinely absent from `LINES`. Priority is modest by exposure (312 parents is
0.06% reach) but the criticality flag is `storm`.

### Gap 4 — King's Indian Attack. **Supported at its entry point; the full setup is untestable.**

The entry move d3 is counted: **4.6% (469)** at 1.e4 g6 and **4.6% (567)** at
1.e4 d6 in the player pool; 0.4% (25) and 0.5% (43) in master-twic. Whether those
games go on to the full e4/d3/Nd2/Ngf3/g3/Bg2/O-O/Re1/e5 setup is **not counted** —
the tree stops long before. Coverage: missing, and 1.e4 g6 2.Nf3 (24.0%, 2,433 —
the other common KIA entry) is also missing, which makes this a bigger hole by
exposure than the KIA label alone suggests.

### Gap 5 — Réti / 1.Nf3 with g3 and no early d4. **Supported, strongly in the master pool.**

At `rnbqkbnr/pppppp1p/6p1/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1` (1.Nf3 g6):
player **g3 25.6% (147)**, master-twic **g3 33.0% (721)** — the single most common
master reply there, ahead of d4. Missing. `hip66` starts 1.Nf3 but its next move
in the line is 2.c4, so the g3 branch is never drilled.

### Gap 6 — Nge2 setups (Be3/Qd2/Nge2/g4 without Nf3). **Untestable.**

`Nge2` occurs in the counted data at four nodes only: **2 games and 1 game** in the
player pool, **20 games (1.0% of 2,071)** and **10 games (0.6% of 1,686)** in
master-twic. All four are far below any threshold that would support a share, and the characteristic Nge2 setup arises deeper than either
tree reaches. **No verdict.** The move is not in the repertoire from those
positions, so the coverage gap is real; its frequency is unknown.

### Gap 7 — Torre / Bg5 against the Modern. **Supported, and it is the largest single missing reply by conditional share.**

| position | player Bg5 | master-twic Bg5 |
|---|---|---|
| Pirc with …Nf6 (`rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 1`) | **17.1% (118/690)** | 8.7% (147/1,686) |
| 1.e4 g6 2.d4 Bg7 3.Nc3 d6 (`…/3PP3/2N5/…`) | 7.1% (18/254) | 3.2% (67/2,071) |
| 1.d4 g6 | 2.1% (132/6,232) | 0.4% (15/4,296) |
| 1.d4 g6 2.c4 Bg7 3.Nc3 d6 | 3.7% (16/428) | 0.8% (4/523) |

All four are `missing`. `Bg5` appears once in the whole Black half of the
repertoire, as a quiet move in `hip-e4` at ply 16, and once in `syn-h4` at ply 12 —
never as a position the learner is asked to answer.

### Gap 8 — 1.b3, 1.f4, 1.g3, 1.b4 and the other non-central first moves. **Supported, and quantified.**

The four first moves the repertoire covers (e4, d4, c4, Nf3) account for
**444,781 of 495,101 player games = 89.84%**. The remaining **50,320 games
(10.16%)** open with a move no Black line in `LINES` answers. By count:

g3 11,511 (2.32%) · e3 11,454 (2.31%) · f4 6,824 (1.38%) · b3 6,632 (1.34%) ·
d3 4,934 (1.00%) · b4 3,106 (0.63%) · Nc3 1,460 (0.29%) · c3 1,410 (0.28%) ·
f3 789 (0.16%) · g4 562 (0.11%) · a3 598 (0.12%) · a4 346 (0.07%) ·
h4 338 (0.07%) · h3 256 (0.05%) · Nh3 84 · Na3 16.

In master-twic the same four cover 512,074 of 532,105 = **96.2%**; the uncovered
remainder is 3.8%, led by b3 1.2% and g3 0.5%. The gap is real in both pools and
about three times larger in the player pool.

Note that a single Hippo line answering a quiet first move would cover much of
this by transposition; the number above is "no line contains this move order", not
"no answer exists".

### Gap 9 — White castles short and attacks anyway (f4-f5, Nf3-h4-f5). **Partly testable, and the testable part turns up something the inventory missed.**

No position in `research/freq-hippo-player.json` has White castled — that pool's
tree ends before it. But `master-twic` reaches two, both in the Austrian structure
the repertoire already drills, and the deep run reaches the same two with 8 and 5
games:

| position | pool | parents | replies |
|---|---|---|---|
| `r1bq1rk1/ppp1ppbp/n2p1np1/8/3PPP2/2NB1N2/PPP3PP/R1BQK2R w KQ - 0 1` — the **final position of `hip-f4`** | master-twic | 38 | **O-O 71.0% (27)**, **e5 23.7% (9)**, Be3 1, a3 1 |
| same | deep run (player) | 8 | O-O 6, a3 2 |
| `r1bq1rk1/pp2ppbp/n2p1np1/2p5/3PPP2/2NB1N2/PPP3PP/R1BQ1RK1 w - c6 0 1` — after `syn-e5punish`'s 7.O-O c5 | master-twic | 25 (**observation**) | d5 84.0% (21), e5 12.0% (3), Bxa6 1 |
| same | deep run (player) | 5 (**observation**) | d5 3, dxc5 1, e5 1 |

Two things follow. First, **White does castle short in this structure and it is by
far the main move** (71.0% of 38 master games). `syn-e5punish` plays exactly that
branch, so the repertoire is not blind to short castling — the inventory's claim
that "every attack in the Black half comes from a long-castled White" is right
about the *attacking* lines but wrong as a statement about castling coverage.

Second, **the uncovered reply at `hip-f4`'s own last position is e5, at 23.7% of
38 master games.** `hip-f4` simply stops there. That is a concrete, sample-backed
coverage gap at the end of a line whose note calls the f4 structure the one the
crouch has no answer to.

What remains untestable is the specific plan the hypothesis named: **f4–f5 or
Nf3–h4–f5 by a short-castled White**. No counted node reaches it in either pool, so
no share is offered. The chess case for covering it is in §3.

### Gap 10 — Black castling long, and the choice of where to castle. **Not testable in principle, by this method.**

This is a Black decision. `tools/count-replies.mjs` only counts *opponent* moves;
at our own nodes the game must follow a repertoire move or it is dropped. No
amount of data from this tool can speak to it. It remains a genuine content gap
(no line teaches the choice) with no frequency dimension at all.

### Summary of the ten

| # | hypothesis | verdict |
|---|---|---|
| 1 | Qd2 + Bh6 | immediate Bh6 measured and **rare** (≤0.24% player, 0.02% master); the **plan is unmeasured**; coverage gap real, priority downgraded |
| 2 | h-pawn reaching h5 | **supported**, and master-twic raises it (14.0% of 677 from the Be3 tabiya) |
| 3 | c4+d4+e4+f4 | **supported** (f4 15.1% of 312, player) |
| 4 | King's Indian Attack | entry point **supported** (d3 4.6%); the full setup untestable |
| 5 | Réti 1.Nf3 + g3 | **supported**, master-twic 33.0% of 2,184 |
| 6 | Nge2 setups | **untestable** (≤10 games anywhere) |
| 7 | Torre / Bg5 | **supported**, 17.1% of 690 at the …Nf6 node |
| 8 | non-central first moves | **supported**, 10.16% of all player games |
| 9 | short-castled White attacking | **partly supported** — master-twic reaches two short-castled positions (38 and 25 parents); `hip-f4`'s terminal position leaves **e5 (23.7%)** uncovered. The f4–f5 plan itself stays untestable |
| 10 | Black's castling choice | **not testable by this method at all** |

---

## 3. Rare but forcing — a chess judgement, not a data result

**This section is explicitly not a frequency finding.** Nothing below is justified
by how often it occurs, and rarity is not taken as safety. It is included because
CONTRACTS.md and METHOD.md both require that rare forcing counters stay in scope
regardless of share. No evaluation is claimed for any of it: the repository has no
engine at the line level, and "White is better" sentences are exactly what
CLAUDE.md forbids.

The judgement, in one sentence each, with the counted exposure stated separately
so the two are never confused:

1. **Early h4–h5 before Black has played …h5.** Exposure: h4 is 0.4–2.5% across
   the crouch nodes in the player pool and 1.2–14.0% in master-twic. The reason to
   cover it anyway is that it is the only White idea in this repertoire whose
   answer is *timing-bound*: both storm lines (`syn-h4`, `syn-hiph5`) work by
   playing …h5 first, so the whole prepared answer is unavailable one move later.
2. **g4 from the Be3 tabiya without f3 first.** Exposure: 9.3% (63/677) in
   master-twic, absent from the player tree. `hip-150` and `eco-psam` both reach
   g4 only after f3; the immediate push is a different position.
3. **f4–f5 with a short-castled White.** Exposure: the *push* is **unmeasured**
   (gap 9), but the structure it comes from is measured — White castles short in
   71.0% of 38 master games at `hip-f4`'s last position. The reason to cover it is
   that the learner is told the f4 structure has "no answer", which is a category
   claim the repertoire's own `syn-e5punish` contradicts, and `hip-f4` stops before
   White commits either wing.
4. **e4–e5 out of the Austrian structure.** Exposure: **23.7% (9/38)** master at
   `hip-f4`'s terminal position and 12.0% (3/25) one move later — both under or
   near the 30-game line, so observations. Listed here because it is the first
   uncovered reply in a line the repertoire treats as closed.
5. **e5 space grabs.** Exposure: this one is *not* rare in the player pool —
   **15.2% (689/4,526)** at move 3 — yet it is `missing`, which puts it in both
   this section and §1. In master-twic the same move is 1 game in 6,574. That
   divergence is itself worth teaching: it is common below master level and
   essentially absent above it, in these two samples.
6. **d5 closing the centre.** Exposure: 0.4% (20/4,526) player, 0.0% (1) master at
   move 3; 2.6% (8/312) at the Averbakh node. Covered by `hip66` and `syn-hipc5`
   deeper in, so this is listed for completeness, not as a gap.

---

## 4. Move-order dependence — turning the tension into a testable statement

W0-D found the repertoire claiming order-independence ("the wall goes up in almost
any order", `src/app.js:1150`) while several lines' own notes say Black cannot
afford slow play. This section resolves that into positions, and the resolution is
**checked against the shipped code**, not argued.

### How the credit actually works

`setupMove()` (`src/app.js:1303`) credits a move when three things hold: the line
has non-empty `targets`; the move puts the right piece type on one of the
`HIPPO_T` squares; the piece did not come from another target square; and
`matVerdict()` returns a material swing under one pawn inside four plies.

Five Black lines carry `HIPPO_T` (verified against the bundle): `hip-e4`, `hip66`,
`hip-e5`, `hip-g16`, `hip-150`. The other nineteen have `targets:[]`, so the
credit never fires on them.

### What the credit actually accepts

I replayed all five lines and, at every Black turn, asked `setupMove()`'s own test
which alternative moves it would credit. The result:

**Order-free positions — the claim holds.** In `hip-e4` (plies 1–19), `hip-g16`
(plies 1–25) and `hip66` (plies 1–19), White never advances a pawn past the fourth
rank and never creates a threat the four-ply search sees. Every credited
alternative at those turns is another `HIPPO_T` square. The wall genuinely can be
built in any order there, and the credit is doing exactly the job the comment
claims.

**Time-critical positions — the claim fails, and the credit fires anyway.** Three
concrete cases, each reproducible from the bundle:

| line · ply | position | line's move | also credited, swing 0 | why that is wrong |
|---|---|---|---|---|
| `hip-150` ply 13 | `rn1qk1nr/pbp2pbp/1p1pp1p1/8/3PP1P1/2N1BP2/PPPQ3P/R3KBNR b KQkq g3 0 1` | Ne7 | **Nd7, a6, h6** | White has played Be3, Qd2, f3, **g4**, with the line's own note declaring the plan is to castle long and throw the h-pawn. The line's three stated counters — …h5, …c5, …d5 — get **no credit at all**, because none of them lands on a `HIPPO_T` square. The trainer credits the slow moves and ignores the fast ones. |
| `hip-150` ply 11 | `rn1qk1nr/pbp1ppbp/1p1p2p1/8/3PP3/2N1BP2/PPPQ2PP/R3KBNR b KQkq - 0 1` | e6 | **Nd7, a6, h6** | f3 is in, g4 is one move away, and the line's ply-5 note already says "against this setup Black cannot afford slow moves". |
| `hip66` ply 21 | after 11.d5 | e5 | **a6** | The line's own note says the rule against d5 is …e5; `targets` credits …a6 as if the position were still quiet. At ply 25, where the line plays the thematic …f5, …a6 is credited again. |

`hip-e5` ply 19 is a milder case of the same thing: after 9.e5 d5 10.Bd3 the line
plays the French break …c5, and `Ne7` and `h6` are also credited.

### The concrete, testable statement

> **The `targets`-based setup credit is safe exactly when White has no pawn beyond
> the fourth rank on the kingside or in the centre and no move that the four-ply
> material search can see.** It is unsafe from the moment White commits a storm
> pawn (g4, h4, f4-and-f5) or closes the centre (d5, e5), because from that moment
> the position asks for a specific reply which is usually *not* a `HIPPO_T` square,
> while the slow wall moves remain materially free and therefore credited.

That statement is falsifiable from the bundle: for each of the five `HIPPO_T`
lines and each Black turn, compute White's pawns on f4/f5/g4/g5/h4/h5/e5/d5 and
the credited alternative set. Where the first set is non-empty, the second set
should be empty if the credit were safe. Today it is not: three positions above
have both non-empty.

### What I conclude for the credit

1. **`HIPPO_T` on `hip-150` is the one clear defect.** Invariant 7 in CLAUDE.md
   already protects the deliberate-mistake lines by keeping `targets:[]`. The same
   reasoning applies in reverse here: a line whose lesson is *that slow play loses
   the race* must not hand out credit for slow play. `hip-150` should either lose
   `HIPPO_T` or gain a per-ply gate.
2. **The W0-D suggestion that the other synthetic Hippo lines "look like an
   oversight" for having `targets:[]` should not be acted on blindly.**
   `syn-hiph5`, `syn-h4` and `syn-hipc5` are exactly the storm and closed-centre
   lines where §4 says the credit is unsafe. Giving them `HIPPO_T` would
   multiply the defect, not fix an oversight.
3. **A safe generalisation exists**: gate `setupMove()` on the position, not the
   line — refuse the credit when White has a pawn on g4/g5/h4/h5/f5/e5/d5. That
   keeps the user's original complaint answered (the quiet lines stay order-free)
   without crediting drift in the sharp ones. This is a Wave-2 change, recorded
   here, not made here.

---

## 5. Proposed stopping criteria, justified by the samples actually seen

The evidence for these is §0's depth table and the cumulative-share table below.
They are proposals for the plan, not rules already in force.

### The observed shape of the reply distribution

Cumulative conditional share, player pool, walking replies in descending order:

| position | parents | replies needed for 80% | for 90% | for 95% |
|---|---|---|---|---|
| 1.e4 g6 | 10,147 | 4 (83.2%) | 6 (92.7%) | 8 (95.3%) |
| 1.e4 g6 2.d4 Bg7 | 4,526 | 6 (85.8%) | 7 (95.1%) | 7 (95.1%) |
| 1.d4 g6 | 6,232 | 4 (80.2%) | 7 (91.2%) | 9 (95.1%) |
| Pirc with …Nf6 | 690 | 6 (80.9%) | 9 (91.0%) | 11 (95.2%) |
| 1.e4 g6 2.d4 Bg7 3.Nc3 d6 | 254 | 4 (81.9%) | 6 (90.2%) | 8 (96.1%) |

The tail is long and flat. A per-move share threshold (say "cover everything over
10%") stops at 66–76% of the position; a cumulative target is the honest control.

### Proposed criteria

**C1 — breadth, by parent sample.** At a position with **≥1,000 parent games**,
cover replies down to a cumulative **90%**. At **100–999**, cover to **80%**. At
**30–99**, cover the top reply plus anything flagged `storm` in §3. Below 30, cover
nothing on frequency grounds — those shares are observations.

Justification: 90% at 1.e4 g6 costs six lines and is achievable; 90% at the Pirc
node (690 parents) would cost nine and each of the last three rests on 20–45 games.

**C2 — depth, by sample floor.** Stop extending a drilled line at the last
position on its path with **≥100 parent games** in the player pool. Past that the
line continues for chess reasons only, and its provenance tag must be `model`,
`synthetic` or `theory` — never justified in a note by "this is what White plays",
because at that depth this repository cannot show that.

Justification: §0. Of the 29 counted player positions, **21 have ≥100 parents and
every one of them sits at ply ≤ 8**; the three positions under 30 parents (26, 25
and 20 games) are the tree's last gasp, not a window into deeper play.

**C3 — the 30-game line is a hard label, not a soft one.** Any share this project
publishes from under 30 parent games carries its raw count in the same sentence
and the word "observation". Three counted player positions (26, 25, 20 parents) and
four master-twic positions (25, 25, 21, 21) are below it today.

**C4 — a reply that is `storm` under §3 is covered regardless of C1.** Frequency
is not quality and rarity is not safety; h4 at 0.4% is in scope and 3.c3 at 11.3%
may not be.

**C5 — no depth is bought with the pgnmentor pool.** When
`freq-hippo-master-pgnmentor.json` lands it will be opening-classified, so a deep
node in it means "deep within games already labelled Modern/Pirc". It may be used
to choose between continuations inside the opening; it must never be used to
justify a stopping depth or a probability of reaching a position.

---

## 6. Research gaps, recorded honestly

1. **The lichess opening explorer API is unavailable here** (`explorer.lichess.ovh`
   → HTTP 401 through the proxy). Every figure in this file was counted locally.
   No figure has been substituted with a guess.
2. **`research/freq-hippo-master-pgnmentor.json` did not exist when this was
   written.** There is therefore **no opening-classified master column anywhere in
   this file**, and none of the tables has a placeholder waiting to be filled with
   one. If it lands, §1's twic column must not be merged with it.
3. **`master-twic` has no rating filter** (`minElo: null`). It is "games in TWIC
   issues 1540–1600", which is a date-bounded sample of published play, not a
   strong-player filter. Every twic share in this file inherits that.
4. **The player pool is one month (2014-01) at one rating floor (≥1500 average).**
   Opening fashion moves; nothing here is a claim about 2026 play.
5. **The Qd2→Bh6 plan is unmeasured** (gap 1). So is any White plan that needs
   more than about five Black moves: castling, f4–f5, the full KIA setup, Nge2
   systems. These are listed as untestable rather than assigned a number.
6. **Win/draw/loss counts exist in both files and were deliberately not used.**
   CONTRACTS.md: neither frequency nor win rate establishes move quality. No
   result percentage appears in this file.
7. **`research/COVERAGE-MATRIX.md` has one wrong row, and I could not fix it
   without editing a file outside my scope.** At
   `rnbqk1nr/ppp1ppbp/3p2p1/8/2PPP3/8/PP3PPP/RNBQKBNR w KQkq - 0 1`, the reply
   **Nc3 (62.8%, 196 player games)** is reported `missing`. It is not: the position
   it leads to is the **final** position of `eco-averb` (1.d4 g6 2.c4 Bg7 3.Nc3 d6
   4.e4), so it should read `transposes`. The cause is in
   `tools/coverage-matrix.mjs`: `SEEN` is built by walking each line's moves and
   recording the position *before* each one, so a line's terminal position is never
   indexed. I checked every Hippo row for this and **exactly one is affected**, so
   the matrix's totals for the Hippo half are off by one (`missing` 242 → 241,
   `transposes` 11 → 12). Lane B owns that tool.
8. **No evaluation claim is made in this file.** `EVL` coverage was read only as
   the matrix's yes/no column; no centipawn figure, mate claim or "better for"
   sentence appears above, in line with CLAUDE.md invariant 3.

---

## Reproducing the numbers

Every player and master figure comes from the two JSON files named in §0 and can
be reproduced with `node -e` against them. The repertoire-side figures (which lines
carry `HIPPO_T`, which alternatives `setupMove()` credits, the coverage-matrix
defect) come from evaluating the built bundle `docs/index.html` in a bare sandbox
exactly as `test/verify.mjs` does, up to the `state` marker. Nothing in this file
was produced by reading source by eye.
