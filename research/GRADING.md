<!-- W2-B · 2026-09-20 · lane B. Every number below was produced by node against the built bundle (src/engine.js + src/data/evals.js as shipped); the fixture test/w2b-grading.mjs re-derives the ones that matter on every run. Nothing is quoted from memory. -->

# Grading policy

Status: **v1**, active. The constants live in `GRADE` in `src/engine.js`; the
fixture fails if they drift from what this file documents. Bump the version here
and there together, never one without the other.

Implements the move-grading record of [CONTRACTS.md](CONTRACTS.md) for the
positions and edge cases of [W2-E1-pilot.md](W2-E1-pilot.md) §5.

## 1. Where it lives

`src/engine.js`, appended after `candidateEval`:

| Function | Purpose |
|---|---|
| `GRADE` | the policy constants: `version`, the bands, `decisive`, and the `accept` / `reject` verdict classes |
| `cmpScore(a, b)` | orders two `EVL` entries from the mover's view; mates are ordered outside the centipawn scale |
| `scoreState(e)` | `mating` / `won` / `level` / `lost` / `mated` for one entry |
| `gradeMove(row, pos, mv)` | the record: `{key, uci, san, cp, mate, rank, reason, analysis, lossCp, verdict, situation, after, why, reply}` |
| `isSetupMove(targets, pos, m)` | the structural half of setup credit, lifted from `setupMove` in `src/app.js` |
| `setupGate(row, pos, mv, targets)` | whether "builds the setup too" may be said here (§6) |

All pure. `gradeMove` takes exactly three arguments, none of which can carry a
game count, so the frequency record cannot reach a verdict by construction; the
fixture grades `c-bogo-check` (7 player games) and `h-after-1e4` (291,474) with
decoy `games` fields on the row and gets byte-identical records.

## 2. The record

- `verdict`: `best` | `equal` | `concession` | `inferior` | `losing` | `unknown`.
- `analysis`: `checked` when the engine searched the move (listed in the ranked
  five, or scored on its own in `row.x`), else `unknown`. `provisional` is
  reserved and unused.
- `reason`: `candidateEval`'s word, `listed` / `scored` / `unanalysed` / `no-row`.
- `rank`: place in the ranked five, **0 for a scored move**. It identifies a
  candidate and decides nothing.
- `lossCp`: centipawns behind the row's best entry, mover's view, floored at 0;
  `null` whenever either side is a mate.
- `situation`: the state of the position before the move, read off the row's best
  entry. `after`: the state the move leaves, read off the move's entry. Both use
  `scoreState`. `after` is `null` for an unanalysed move.
- `why`: structured input to the explanation, never prose: `{kind, best, move, depth}`.
- `reply`: `null`; the caller that knows what was shown fills it.

`GRADE.accept = ["best", "equal"]`, `GRADE.reject = ["inferior", "losing"]`.
`concession` is in neither: the caller decides what to do with it and must state
the number. `unknown` is neutral and must never cost or earn anything.

### Precedence

Mates, lost positions and thrown wins are handled before the bands see anything:

| order | condition | verdict | `why.kind` |
|---|---|---|---|
| 1 | move gets the mover mated; best does not | `losing` | `allows-mate` |
| 1 | move gets the mover mated; best is mated too | `best` if same distance, else `inferior` | `already-lost` |
| 2 | move mates | `best` (shortest) / `equal` (slower than best) | `mates` / `slower-mate` |
| 3 | best mates, move does not | `inferior` | `missed-mate` |
| 4 | rank 1, or loss 0 | `best` | `best` |
| 5 | loss ≤ `equal` | `equal` | `within-noise` |
| 6 | move ≤ −`decisive`, best above it | `losing` | `now-lost` |
| 7 | best ≥ `decisive`, move below it | `inferior` | `threw-win` |
| 8 | loss ≤ `concession` | `concession` | `concession` |
| 9 | otherwise | `inferior` | `inferior` |

Rows 6 and 7 come after row 5 on purpose: a move inside the noise band of the
best cannot be called losing or a thrown win however close the best sits to a
threshold. A move played from a position that was already lost (best ≤
−`decisive`) is graded on the bands with `situation: "lost"`, so the best
defence is `best` and never "saved", and a bad defence is `inferior`, never a
second "losing".

## 3. The bands, and why they moved

```
GRADE = { equal: 30, concession: 70, decisive: 200 }     (centipawns)
```

The plan's provisional 0.5 / 1.0 pawns became **0.3 / 0.7**. Both boundaries
moved, and the evidence is the shipped table itself.

**Loss-to-best of the 441 drilled moves with centipawn scores on both sides**
(the 442nd is `ohanlon` ply 38, the table's one mate), in 5 cp bins:

```
 0-4: 249   5-9: 31   10-14: 32   15-19: 30   20-24: 22   25-29: 34
30-34: 9   35-39: 12   40-44: 6   45-49: 3   50-54: 3   60-64: 2
80-84: 1   90-94: 1   110-114: 2   120+: 4
```

Row statistics over the 266 centipawn-only rows: best-to-second gap median 7,
p90 39; best-to-fifth spread median 24, p90 190; 206 rows have all five within
50 cp and 223 within 100.

**Why 30, not 50.** Every "five comparable moves" row in the pilot has all five
inside 27 cp (`h-after-1e4` 11, `c-e6-node-transposed` 5, `c-c5-fork-c3-b3`
16, `h-modern-2d4-transposed` 20, `h-3nc3-b6-unranked` 15, `h-austrian-5nf3`
27, `c-1e6-hidden-hand` 14, `c-2nc6-chigorin` 16, `c-4be7-no-target` 8,
`h-bg5-pirc` 8, `h-reti-g3` 12, `h-1d4e6-2c4` 17, `h-2h4-storm` 24). The
concessions the pilot wants said out loud sit at 32 (`Qxd4`), 37 (`2.e3` after
1.d4 c5) and 38 (`hip-150`'s `Ne7`). There is a real step in the drilled-move
histogram between the 25-29 bin (34 moves) and the 30-34 bin (9). A boundary at
50 hides all three concessions inside `equal`; at 25 it turns the Zukertort's
`Nbd2` (27), the London's `Bf4` (26) and the Hippo's `...b6` (30) into
concessions, which is calling the repertoire a concession at gaps inside the
median row spread. 30 is the step.

**Why 70, not 100.** The one narrow pilot row, `c-benoni-recapture`, prices a
clean pawn: `c4` 84, `Nf3` 87, `Be2` 88 behind `exd4`. Declining the Englund
pawn costs 78-101 (`Nc3` 78, `e3` 81, `c3` 98, `e4` 101). §5 asks that the
three non-recaptures land in `inferior`; at 100 they are `concession`. The
drilled-move histogram has nothing between 64 and 84, so 70 sits in a gap.

**Why 200 for decisive.** Row-best scores run from −264 to +943 with p10 −66 and
median 0. Only eight rows lie beyond ±200: six in `ohanlon`'s winning attack
(312 to 943) and the two `syn-greek` rows (−264, −263) the ledger already calls
a content problem. `h-austrian-5nf3` at −54 stays `level`, which is what "worse,
not lost" needs. `syn-ne4` ply 18 (best 189) is `level` by 11 cp; that is a
threshold and it is stated as one.

**What the bands do to the repertoire.** All 442 drilled moves, graded against
their own row: **best 152, equal 252, concession 30, inferior 5, losing 3,
unknown 0.** The 31 concessions include 18 in non-synthetic lines, among them
`ohanlon` ply 22 `Bxh7+!` (41), `colle-kid` ply 6 `b3!` (35), `hip-150` ply 13
`Ne7` (38), `rudel` ply 14 `Ne5` (39), `eco-rat` ply 3 `d6` (42). The five
inferior are `ohanlon` ply 32 `Rxd6` (346 behind `Qd3`, still +597, `after:
"won"`), `syn-ne4` ply 22 `Nxd4` (114), `syn-hipdown` ply 17 `d5` (94, the
deliberate mistake, correctly), `syn-h4` ply 11 `e6` (84) and ply 19 `Bb7`
(111). The three losing are `syn-greek` ply 22 `Bxh7+` (+73 to −269), `syn-h4`
ply 13 `Nbd7` (−97 to −353) and ply 15 `a6` (−138 to −324): all synthetic, all
already flagged, and the grader reports them rather than hiding them.

## 4. Decisions §5 asked for

**Loss, not rank, decides `equal` vs `concession`.** `c-1c5-benoni-door`: `2.e3`
is rank 4 of five within 42 cp and 37 cp behind `2.d5`; it is `concession`.
Rank measures nothing: in `c-e6-node-transposed` rank 5 is 5 cp behind, in
`c-englund-1e5` rank 2 is 78 behind. Rank is kept in the record because it says
where the engine's list put the move, which the UI may state; it never enters
the verdict.

**Ties are ties.** `1.d4 e6`: `Nf3` 31 and `e4` 31 both grade `best` (`e4`
keeps `rank: 2`). `best` is a fact about the table's top entry, not a stronger
grade than `equal`: the accept class holds both, and `why.kind` is `best` or
`within-noise`, neither of which asserts a preference.

**"Why" attaches to the key.** The record is a function of `(row, pos, mv)` and
`row` is keyed on `posKey`; `c-e6-node-transposed` and `h-modern-2d4-transposed`
return byte-identical records from both doors (fixture 8). The arrival-order
prose ("you came here through 1...Nf6") is a property of the `(line, ply)` and
belongs to the line's own note text, which lane A already displays. Nothing in
the grader knows which line is being drilled, and nothing should.

**A key shared with a deliberate-mistake line.** `trap`'s `4.c3` at the
`c-3bf5-anti-colle` key is now **scored** (`x: c3 −11` against `c4` 25): loss
36, `concession`. Not a blunder, not repertoire credit. Two mechanisms, both
already present and both left alone: line ownership is `NO_SHUFFLE` in
`src/app.js`, which keeps the three mistake lines out of `ALT` so their moves
are never "book too"; the grade is the number, the same one anyone who plays
`4.c3` here gets. `soltis`'s and `soltis-trap`'s shared `4.Bd3` is `equal` (12
cp) and needs no special case: the trap's mistake is `5.Bxf5` one ply later, at
its own key. The line's lesson ("the autopilot punished") stays structural, and
the record gives the UI no way to upgrade it into "refuted".

**The `!` on `colle-kid`'s `b3`.** Scored at −10 against `c4` 25: loss 35,
`concession`. The mark is not backed by the table. Removing it is a data change
(`src/data/lines.js`, lane C); recorded here, not done here.

**Frequency.** Section 1; fixture 11.

**`keyFen` vs `fen`.** The eight pilot keys with an en-passant field in their
`fen` have a row only under `posKey`; a lookup by raw `fenOf` misses all eight
(fixture 10). The record's `key` is `posKey(pos)`.

## 5. Fixtures (`node test/w2b-grading.mjs`)

| §5 row | driven by | result |
|---|---|---|
| five comparable | `h-after-1e4`, `c-e6-node-transposed`, `c-c5-fork-c3-b3`, `c-1e6-hidden-hand` (tie) | all five accepted in each; `c3`/`b3` 4 cp apart both accepted; no `why.kind` outside `best` / `within-noise` |
| one or two good moves | `c-benoni-recapture`, `c-englund-1e5`, `h-3e5-space-grab` | `Qxd4` concession (32); `c4`/`Nf3`/`Be2` inferior (84-88); declining the Englund pawn inferior, `after: "level"`; `3.e5 d6` best, `c5` equal (7), `Nh6` (32) and `Nc6` (64) concession |
| promotion | **constructed**: `k7/4P3/8/8/8/8/8/4K3 w`, row `e8=Q+` 900, `e8=R+` 850, `e8=N` 0, `e8=B` 0 | `e7e8q` best, `e7e8n` inferior (`threw-win`), different records; the string `e7e8` grades `unknown` |
| unanalysed | `h-after-1e4` (`...a6`; `...g6`, `...d6` scored), `c-kid-bg7-unranked`, `h-3nc3-b6-unranked`, no row | `...a6` unknown, `lossCp` null, `after` null; `...g6` scored rank 0 equal (25); `b3`/`Bd3` concession (35); `...b6` equal (25); the ranked fifth `a3` (37) loses more than the scored `b3` |
| forced mate | **constructed**, mates confirmed by search: 1.f3 e5 2.g4 (`Qh4#`), and 1.f3 e5 with `g4` listed fifth and, separately, scored | `Qh4#` best, `cp` null, `lossCp` null, `after: "mating"`; `d5` at +350 inferior `missed-mate`; `g4` losing `allows-mate` at rank 5 and at rank 0; `cmpScore` ordering of mates |
| lost position | `h-austrian-5nf3` (worse); **constructed** K v K+R (`4k3/8/8/8/8/8/8/R3K3 b`, −650 to −720); **constructed** `6k1/8/5K2/8/8/8/8/2Q5 b` with mate distances confirmed by search (`Kf8` mated in 1, `Kh8`/`Kh7` in 2); real `syn-ne4` ply 18, `ohanlon` plies 26, 30, 32 | `O-O` equal with `situation: "level"`; `Kd7` best with `situation` and `after` both `lost`; `Kf8` concession, never `losing`; `Kh7` best `already-lost`, `Kf8` inferior; `b4` losing `now-lost`; `g4` inferior `threw-win`; `Re1` losing; `Rxd6` inferior with `after: "won"` |
| drilled but a concession | `c-1c5-benoni-door`, `hip-150` ply 13 | `2.e3` rank 4, loss 37, concession; `Ne7` scored, loss 38, concession |
| one key, two histories | `c-e6-node-transposed`, `h-modern-2d4-transposed` | identical JSON from both orders |
| mistake-line key | `c-3bf5-anti-colle` | `c3` scored, 36, concession, not in `reject`; `c4` best; `Bd3` equal |
| `keyFen` vs `fen` | the eight keys | key ≠ fen, row under key only |
| rare / thin sample | `c-bogo-check`, `h-2h4-storm`, `h-after-1e4` | records identical with decoy counts; `Nbd2` best, `c3` equal (5), `Bd2` equal (17), `Nc3` concession (40); `2.h4 c5` best, `2.h4 h5` unknown |
| `hip-150` gate | §6 | see §6 |

Plus a whole-repertoire count that pins the §3 totals.

## 6. The `hip-150` setup-credit defect: settled

Position `rn1qk1nr/pbp2pbp/1p1pp1p1/8/3PP1P1/2N1BP2/PPPQ3P/R3KBNR b KQkq - 0 1`,
now with a stored row: **`h5` −68, `Nc6` −75, `Nd7` −79, `a6` −84, `Qh4+` −84;
`x: Ne7` −86, `d5` −93, `c5` −120** (the `x` entries searched one at a time; see
the first addendum). The depth-28 row (`src/data/deep.js`, second addendum) is
**`Nd7` −61, `h5` −62, `Nc6` −71, `Qh4+` −82, `a6` −89; `x: Ne7` −114**, with
`d5` and `c5` not searched.

The structural half (`isSetupMove`) reproduces the defect exactly as the ledger
tabulated it: `Nd7`, `a6`, `h6` qualify; `h5`, `c5`, `d5` do not. The four-ply
material search then let all three through with swing 0. The gate replaces that
search with the stored analysis:

> Setup credit is licensed only where the row's first choice (or an entry tied
> with it to the centipawn) is itself a formation move, **and** the move played
> grades `best` or `equal` against it.

On the depth-20 row alone the first choice is `h5`, so every wall move is refused
with reason `demanding` and handed to the grader instead: `Nd7` equal (11), `a6`
equal (16), `h6` unknown. At depth 28 the wall move `Nd7` is first and `h5` one
centipawn behind it. The gate now calls a position demanding only where both
depths do (second addendum), so **the tabiya is not demanding**: `Nd7` is
credited `in-band` on its depth-28 number (best), `a6` `in-band` (16 behind at
depth 20, 28 at depth 28), and `h6`, searched at neither depth, is `unanalysed`
and falls to the material brake. `h5` is `best` (depth 20; equal at depth 28,
1 behind). `d5` is equal (25) and `c5` a concession (52), both on depth-20
numbers only. The line's own `Ne7` is equal at depth 20 (18) and a concession at
depth 28 (53); the more generous verdict stands, and the page says the two
searches disagree. What both depths show is a tie between `...Nd7` and `...h5`,
not a position that wants `...h5`.

Where the wall genuinely goes up in any order the gate stays open: at `hip-e4`
ply 5 (1.e4 g6 2.d4 Bg7 3.Nc3, first choice `a6`) `a6`, `d6` and the scored
`b6` are credited `in-band`, `h6` is `unanalysed`, `Nf6` is `not-target`.
`hip66` plies 21 and 25 (first choices `a5`, `f5`) are `demanding`, which is
the ledger's second reproduction. `hip-150` ply 11 is **not**: the table has
`c5` −78 and `Nd7` −78 tied, so a wall move is a joint first choice, `Nd7` and
`a6` (7 cp) are credited and the ledger's "same failure at ply 11" is not what
the stored numbers say.

Across the five `HIPPO_T` lines: 53 Black drill plies. On the depth-20 rows
alone, 26 of them are `demanding`, and of 201 legal wall moves the gate says
`in-band` 74, `demanding` 88, `unanalysed` 35, `out-of-band` 4; the 88 refused
as demanding grade equal 48, unknown 34, concession 4, inferior 2. With both
depths (the shipped behaviour), 21 plies are `demanding`: `in-band` 84,
`demanding` 70, `unanalysed` 42, `out-of-band` 5 (`hip-e5` ply 17 `h6` is the
new one); the 70 grade equal 39, unknown 26, concession 3, inferior 2. Either
way the usual effect of the gate is not a refusal but the loss of the "order
does not matter" sentence, replaced by the engine's actual figure.

Invariant 7 is untouched: `targets: []` on `trap`, `soltis-trap`, `syn-hipdown`
short-circuits the gate at `no-targets`, and the six synthetic Hippo lines keep
`targets: []` as W1-D established.

### Handover to lane A (`src/app.js`)

1. In the wrong-move path (`app.js` around line 1079), call
   `setupGate(evalFor(pos), pos, m, L().targets)` **before** `matVerdict`. On
   `credit: true` take the existing setup branch. On `demanding`, `out-of-band`
   or `not-target` go straight to `offBook` with `r.grade` (no material search:
   the row is strictly better information, and the ledger's ~1.1 s per verdict
   is spent for nothing on positions that have a row). Only on `unanalysed` and
   `no-row` run `matVerdict` and apply the old `swing < 1` brake; those are the
   only outcomes where the four-ply search is still the best available evidence.
2. Replace the body of `setupMove` with `isSetupMove(l.targets, pos, m)` plus
   the gate; the two rules must not drift apart.
3. Read the verdict, not the rank, for acceptance: `GRADE.accept` accepts,
   `GRADE.reject` refuses, `concession` is refused with the number stated, and
   `unknown` is neutral (no streak change, no miss recorded, the user retries).
   `after` and `situation` are what the sentence about the position may claim;
   `mate` is printed through `fmtScore` and never as a pawn count.
4. `reply` is yours to fill with the move actually shown.

## 7. What this file does not claim

- No number here comes from anywhere but the shipped `EVL` table or a fixture
  whose row is printed in `test/w2b-grading.mjs`. Constructed rows are inputs;
  the only chess claims made about them (the mates, the promotion SAN) are
  checked by the engine or the fixture's own search each run.
- The bands are calibrated to depth-20 `sf16-7` scores in these two openings.
  A different engine, depth or opening is a new calibration and a new version.
- Nothing here says a `concession` is wrong to play. It says the table has a
  better-scoring move by more than the noise band, and the user should hear the
  number.


## Addendum: why the distribution moved after this policy was written

This document was first written against a table in which `hip-150`'s prescribed
counters `...c5` and `...d5` had no entry. They were then given searches of
their own through `tools/build-evals.mjs --force`
(`research/named-moves.tsv`), which also changed the tabiya row. The one
*drilled* move affected is `hip-150`'s `...Ne7`: against the row's best
(`h5 -68`) it is 18 cp behind, not 38, so it grades `equal` rather than
`concession`. The whole-repertoire distribution is therefore
**best 152, equal 252, concession 30, inferior 5, losing 3, unknown 0**, and the
numbers above have been corrected to match. `src/data/lines.js` was not edited;
only the analysis grew.


## Addendum: deeper checks on narrow decisions (`research/deep-checks.tsv`)

Before the trainer treats a position as having one right answer, the gap behind
that answer should survive a deeper search. `node tools/deep-check.mjs --depth 28`
re-searches the drilled positions where the table makes a narrow claim, and writes
one row per position to `research/deep-checks.tsv`, with the engine and settings in
its header.

**Method.** The engine and settings are the same as the shipped table: `sf16-7` from
`lila-stockfish-web` 0.0.11, the small NNUE net (sha256 pinned), one thread,
64 MB hash cleared with `ucinewgame` per position, MultiPV 5. The only change is a
fixed depth of 28 instead of 20. The tool runs `tools/build-evals.mjs --worker`
with `SF_DEPTH` set, so there is no second engine driver. That override only works
in worker mode, so the shipped table stays at depth 20. Drilled moves outside the
deep top five get their own `searchmoves` search, as they do in the shipped table.
The Damiano sign probe is re-run at depth 28 and must still come out negative.
Raw output is cached in `data-src/local-eval/sf167-d28/`. The depth-20 side of every
comparison comes from the shipped `src/data/evals.js`, which the tool only reads.
Depth 28 costs about two minutes per position on one thread, against nine seconds at
depth 20.

**Selection.** 116 of the 304 drilled positions are checked. A position is selected
if any of these is true:

- `narrow` (44 positions): only one move is within `GRADE.equal` of the best.
  This is `waysAt() === 1`: the grader accepts one answer and prices every other move.
- `demanding` (68): `setupGate` would return `demanding`.
- `tactical` (51): the best move is a mate, capture or check.

A position can have more than one of these flags.

**Results at depth 28.** Every selected position reached depth 28.

- **Narrow claims: 36 hold and 8 fail.** In all 8 failures the depth-20 best is
  still the deep best. What changes is the runner-up: it closes to within 30 cp,
  so a second move would be accepted.

  | line:ply | best (d20 → d28) | runner-up (d20 → d28) | gap d20 → d28 |
  |---|---|---|---|
  | kolt:24 | Bf4 77 → 71 | Re1 32 → 45 | 45 → 26 |
  | ohanlon:34 | Qf3 729 → 902 | Nxf7+ 695 → 893 | 34 → 9 |
  | hip-e4:17 | ...Ne7 -21 → -37 | ...Qc8 -53 → -56 | 32 → 19 (3 moves in band) |
  | h-3e5:7 | ...dxe5 26 → 23 | ...a6 -5 → 6 | 31 → 17 |
  | syn-hipc5:21 | ...exd5 -25 → -39 | ...e5 -63 → -60 | 38 → 21 |
  | syn-hiph5:15 | ...Qh4+ -14 → -25 | ...Rxh5 -52 → -40 | 38 → 15 |
  | syn-clamp:20 | e4 58 → 48 | h3 25 → 27 | 33 → 21 (4 moves in band) |
  | syn-e5colle:22 | cxd4 31 → 22 | Ncxe5 0 → Bf1 3 | 31 → 19 |

  Most failures had a depth-20 gap only just over the 30 cp band (31 to 38).
  kolt:24 is the exception at 45. Two of these rows drill the runner-up, not the
  best. ohanlon:34 drills Nxf7+, which moves from concession to equal.
  syn-hiph5:15 drills ...Rxh5, which also moves from concession to equal.

- **Demanding: 58 hold and 10 fail.** The `demanding` test uses exact ties, so it
  flips whenever the top few moves are within a few centipawns of each other. That
  covers 1.d4 vs 1.Nf3, ck:6, ck:10, hip66:1, hip-g16:5, hip-g16:23, c-be7:8 and
  c-be7:10, where the gaps are 0 to 5 cp at both depths. The failure that matters is
  **hip-150:13 / syn-hiph5:13**, the storm tabiya in §6. At depth 28, ...Nd7 (-61)
  is first and ...h5 (-62) second. The fixture's premise, that the first choice is
  not a formation move, does not hold at depth 28. hip-e5:17 also fails:
  ...Ne7 -101 overtakes ...d5 -119.

- **Drilled-move grades:** 9 positions change between accepted and rejected.
  - Accepted at depth 20, rejected at depth 28: ck:4 Bg5, ...g6 after 1.d4 (def-ohanlon:1 and
    others), hip-g16:5 ...b6 and hip-150:13 ...Ne7 (equal → concession).
  - Rejected at depth 20, accepted at depth 28: cz:14 Ne5, anti:10 c5,
    ohanlon:34 Nxf7+, hip-g16:21 ...Qe8 and syn-hiph5:15 ...Rxh5
    (concession → equal).

**What this does not change.** `src/data/evals.js` and the depth-20 bands are not
edited. The results show that a gap of 30 to 45 cp at depth 20 does not reliably
separate the moves. The depth-20 score does not reliably tell which of two formation
moves the engine prefers when they are a few centipawns apart.

**How the app uses it.** The tool also writes the 116 depth-28 rows to
`src/data/deep.js` (`DEEP`, EVL's row shape without `pv`, keyed by `posKey`; every
key is an EVL key, checked by `test/verify.mjs`). The policy is one rule: the page
never penalises a move that either depth accepts.

- `gradeMove` grades the move on both rows (`gradeRow` is the one-row grader) and
  returns the more generous verdict, in the order best, equal, concession,
  inferior, losing. A depth that did not search the move gives way to one that
  did; on equal verdicts the depth-20 record stands. The deeper row applies only
  when the row passed in *is* the shipped `EVL` row, so constructed fixture rows
  grade on themselves. Where one depth accepts and the other does not, the
  record's `split` carries both depths' numbers and the feedback says "the
  table's two searches disagree about this move" with both.
- `setupGate` says `demanding` only where both depths say it.
- `waysAt` counts a move accepted at either depth.
- Positions without a depth-28 row behave exactly as before.

Consequences, all at the 116 checked positions: five drilled moves go from
concession to accepted (cz:14 Ne5, anti:10 c5, ohanlon:34 Nxf7+, hip-g16:21
...Qe8, syn-hiph5:15 ...Rxh5), so the repertoire count is best+equal 491 (was
486) and concession 23 (was 28); the four drilled moves depth 28 would reject
(ck:4 Bg5, ...g6 after 1.d4, hip-g16:5 ...b6, hip-150:13 ...Ne7) stay accepted
on their depth-20 numbers, and the page says the two searches disagree.
`waysAt` rises at 43 positions, from 1 to 2 or more at the eight whose narrow
claim failed above. The ten positions whose demanding claim failed stop being
demanding, the storm tabiya (§6) among them.

After the W6 content batch (`W6-content-batch.md`): 605 drilled moves, best
282, equal 298, concession 23, inferior 2 (best+equal 580); every one of the
89 new drilled moves is accepted, and 128 positions are checked at depth 28.

After the defence lines stopped drilling their 16 opening plies: 589 drilled
moves, best+equal 564. After the 1...d6 batch (`W6-content-batch.md` §7): 603
drilled moves, best 277, equal 301, concession 23, inferior 2 (best+equal
578); all 14 new drilled moves are accepted, and no new position qualifies for
the depth-28 check.
