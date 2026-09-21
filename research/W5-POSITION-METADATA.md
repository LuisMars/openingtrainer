# Position records: what the plan asks for, what exists, what is missing

Scope: REPERTOIRE-PLAN.md §5, items 2 and 3 ("store accepted candidates,
concessions, common mistakes, representative strong replies, and resulting
positions" and "attach lesson goals, opponent threats, plans, sources,
confidence, and practical-frequency metadata to each position"). Audited
2026-09-21 against the shipped data and `src/app.js`.

## Item 2: alternatives stored per position

| Field | Status | Where it lives |
|---|---|---|
| Accepted candidates | exists | `EVL[key].m` (ranked five) and `.x` (scored outside the five); `gradeMove()` accepts `best`/`equal` (research/GRADING.md). Book alternatives from other lines through `ALT`. |
| Concessions | exists | `gradeMove()` verdict `concession` (30 to 70 cp), priced in `offBook()`. |
| Common mistakes | **was missing** | Nothing recorded what players of the trained colour choose. `research/freq-*.json` counts only the opponent's replies (`tools/count-replies.mjs` drops a game at the move that leaves the repertoire without recording it). The per-user miss log `w` is the user's own history, not a population. **Shipped now**, see below. |
| Representative strong replies | exists, partial | `replyAfter()`: the next row's first move, else `pv[1]` when the played move is the pv's first. Null when neither covers the move; never invented. |
| Resulting positions | **closed** | `EVL[key].p` (aligned with `m`) and `.xp` (aligned with `x`): a 6-ply SAN line for every stored move, from the same MultiPV / `searchmoves` search that scored it — no new search. See "Gaps closed" below. |

## Item 3: metadata per position

| Field | Status | Source it can be derived from |
|---|---|---|
| Lesson goal | **closed** (by decision, no new prose) | Composed from three sources that already exist, each labelled as what it is: the threat (a stored search), the line's `plan` (per line) and the line's note on the drilled move (per move). See below. |
| Opponent threat | **closed** | `EVL[key].t`, a build-time null-move search. See below. |
| Plans | exists | Line `plan`, move notes; `PLAN` generic prose is labelled "In general". |
| Sources | exists (per line) | `KIND` / `SRC`. A position reached by several lines has several; the panel names the line in hand and counts the others (`ALT`). |
| Confidence | derivable | `EVL` depth (20 everywhere, pinned by test/verify.mjs) and the gap between the first and second stored moves. Deeper re-checks (`research/deep-checks.tsv`) are another lane's and not shipped. |
| Practical frequency | exists | `FRQ` bucket per rating band; now also the exact count of games reaching the position per band (`CHO`, below). |

## What shipped

**Counted choices** — `tools/count-choices.mjs` walks the lichess 2014-01 dump
(the same file and band split as research/METHOD.md) and, at every drilled
position, records the move players of our colour chose, including the move that
left the repertoire. Raw counts: `research/choices-player.json`. The choices that
clear the floor (at least 30 games reaching the position in a band, at least 10
games and 5% share for the move) and have no score in the ranked five were given
their own fixed-depth searches through `research/named-moves.tsv`
(`--tsv` section) and `tools/build-evals.mjs --force`; they land in `EVL[key].x`.
`--emit` writes `src/data/choices.js` (`CHO`).

A **common mistake** is a counted choice over the floor, in the selected band,
that `gradeMove()` grades `concession`, `inferior` or `losing`, and that is
neither the line's move nor another line's move there. Frequency picks which
ones to mention; it never grades.

**Where it appears**

- After a wrong move that is itself a counted choice: how often players chose it.
- After a correct answer in Shuffle: the most common mistake there, with count and score.
- The "Position details" panel (all modes but Tactics). While a question is live
  it shows only fields that cannot contain the answer — occurrence, sample size,
  depth and the first-to-second gap — and each is run through `refuteLeaks()`
  against the expected move. Once the position is answered (and in Study, for the
  position whose move was just shown) it adds the line's goal, source, the table's
  first choice and expected reply, and the common mistakes with their counts and
  prices.

## Numbers

- Dump: `lichess_db_standard_rated_2014-01.pgn.zst`, 697,600 games; by band
  202,238 / 438,016 / 57,235 (under 1500 / 1500–1899 / 1900 and over), `--maxPly 30`.
  123 drilled positions reached; 63 have at least one choice over the floor;
  285 choices ship.
- Forced searches added: 68 moves at 31 positions (depth 20, the table's
  settings). Every drilled move's score and every existing `x` entry is
  byte-identical to the previous table; only new `x` entries were added.
- 25 shipped choices stay **unscored**: their positions already carry a forced
  search for drilled or hand-named moves, and `build-evals` searches all forced
  moves at a position in one `searchmoves` job, so adding moves there moved the
  drilled moves' own scores by up to 10 cp in a trial run (14 entries changed).
  They are skipped on purpose (`lockedKeys` in the tool); the app names none of
  them and says how many it cannot price. Fixing it means one job per forced
  move in `tools/build-evals.mjs`, which would itself re-derive every existing
  `x` score.
- Priced as a concession or worse: 35 choices over the whole table; in the
  selected band 21 (under 1500), 24 (1500–1899), 10 (1900 and over). Of the 24
  at the default band, 22 are concessions (31 to 55 cp) and 2 inferior (`h-3e5`
  ply 5: ...e6, 81 cp, 25% of 662 games; ...b6, 106 cp, 10%).
- Side effect on grading, none on drilled moves: all 516 drilled verdicts are
  unchanged. Two formation moves at Hippo plies that were unanalysed now carry a
  score inside the band, so the setup gate credits them (wall-move tally in
  test/w2b-grading.mjs: in-band 72 to 74, unanalysed 37 to 35).

## Gaps closed (2026-09-21)

All three gaps above are closed. Every number below was produced by
`tools/build-evals.mjs` with the table's engine and settings; nothing is written
by hand.

### 1. Resulting positions for every candidate

The raw cache already held a UCI pv for every MultiPV line and every
`searchmoves` job, so `build-evals` now emits `p` (aligned with `m`) and `xp`
(aligned with `x`), each a SAN line of up to 6 plies starting with its move.
`p[0]` equals `pv`, which is kept for compatibility. Regenerating from cache
left every existing field byte-identical (checked by stripping `p`, `xp`, `t`
and comparing against the previous `evals.js`; the regeneration before any
change was byte-identical to the committed file). 1,672 lines ship.

In the app, `lineOf(row, san)` finds the stored line of the move actually
played; `replyAfter()` and the "Its line from here" sentence now use it, so a
sound non-first move gets its own continuation and reply instead of none.

### 2. Opponent threats

**Search.** For each of the 304 drilled positions whose mover is not in check
(301; 3 are in check), the same board with the move handed to the opponent,
castling rights kept, en passant cleared, searched with the same worker: depth
20, one thread, hash cleared, MultiPV 5. Cached in `data-src/local-eval/sf167-d20/`
like every other job (302 searches including the probe, about 5.5 minutes on 8
workers). Stored as `t: [uci, san, cp, mate, [san pv]]`, scored from the
**threatening side's** view. `EVL_TPROBE` pins that sign: after 1.e4 e5 2.Bc4
Nc6 3.Qh5 (Black to move) the flipped search must return Qxf7 mate +1; the tool
aborts and `test/verify.mjs` fails otherwise.

**What counts as a threat worth showing.** gain = t (threatener's view) + the
row's first choice (mover's view): what the free move is worth to the opponent
over the position as it stands. A tempo alone is worth something in every
opening position, so the gain is never zero. On the 299 rows with centipawn
scores on both sides:

| | cp |
|---|---|
| 10th / 25th / 50th / 75th percentile | 22 / 30 / 44 / 66 |
| 90th / 95th percentile | 332 / 503 |

Histogram (50 cp bins): 0–49: 182, 50–99: 64, 100–149: 10, 150–199: 5,
200–299: 4, 300 and over: 34. The distribution is bimodal: a tempo cluster
(82% under 100 cp, median 44) and a tail of concrete material and mating
threats. **Threshold `THREAT_CP = 150`** (src/app.js): a pawn and a half, more
than twice the tempo cluster's upper quartile. The 100–149 band is mostly
pawn exchanges that are not threats (…cxd4 at 113, …dxe3 at 133 and 143);
150 keeps the Greek-gift threat Bxh7+ at 156 (the Colle's own theme), which a
200 cut would lose. Mate threats (one row, Qh7+ mate in 4) are always shown; no
threat is shown where the mover's first choice is itself a mate score, since no
centipawn gain is defined there.

Result: 43 positions by gain plus 1 mate threat = 44 rows; across the 516 drill
plies, **44 show a threat once answered, 13 while the question is live**.

**Leaks.** Before answering, the threat row is hidden when its text fails
`refuteLeaks()` against the answer, or when the threat move starts or lands on
a square the answer starts or lands on (the answer parries it by capturing the
threatening piece, blocking, or moving the target). 31 of the 44 are held back
until the position is answered. The UI test checks every drill ply.

**Label.** "If it were Black's move: …Ndxe5, +1.5 for Black, 220 centipawns
more than the position gives Black as it stands (Stockfish 16, depth 20,
searched with the move handed over). Its line: …". Below the threshold, once
answered: "Nothing concrete: handed the move, Black gains less than 150
centipawns…". The old "Not a threat analysis" placeholder is gone.

### 3. Per-position goals

Decision: **no per-position prose is written.** The goal shown for a position
is composed of three sources that already exist, each labelled as its source:

- **Threat** (per position, a stored search) — before and after answering,
  under the leak rule above.
- **Plan** — the line's own `plan`, first sentence, "This line's aim: …".
  Now also shown before answering in Drill when it passes `refuteLeaks()` plus
  the piece-name and castling checks `moveClue()` uses; never before answering
  in Shuffle, where it would identify the line.
- **Move note** — after answering only, the line's own note on the drilled
  move, "The line's note on Nb3: …" (183 drill plies have one).

## Tests

- `test/verify.mjs` 6a: every `p`/`xp` line aligned, starting with its move and
  replaying with matching SAN; `p[0] === pv`; every `t` legal with the move
  flipped, SAN matching, exactly one of cp/mate, pv replaying; a threat row for
  every drilled position not in check and none for one in check; `EVL_TPROBE`
  is Qxf7 mate +1 at the right position. The same checks run inside
  `tools/build-evals.mjs` before it writes.
- `test/ui.mjs`: the threat row appears exactly where `threatAt()` says, prints
  the stored move, gain and mate count, never shows a live threat that names or
  shares a square with the answer, the move note appears after answering and
  never before, and the placeholder text is gone. The existing all-positions
  leak scan (1,032 live panels) still passes with the plan and threat rows in.
