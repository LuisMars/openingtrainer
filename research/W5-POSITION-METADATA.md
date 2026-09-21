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
| Resulting positions | partial, **gap** | A 6-ply SAN pv for the best move only. Other candidates have a score and, through `replyAfter`, at most one reply. No continuation is stored for them; storing one means one more pv per candidate in `tools/build-evals.mjs`. Not done. |

## Item 3: metadata per position

| Field | Status | Source it can be derived from |
|---|---|---|
| Lesson goal | **gap** (per position) | Lines carry one `plan` for the whole line and a note per move. No per-position goal exists and none is written here: inventing 280 of them is exactly the prose drift CLAUDE.md warns about. The panel shows the line's own plan, first sentence, labelled as the line's. |
| Opponent threat | **gap** (as a threat) | A threat needs a null-move search (what they play if we pass). None is stored. What is stored is the table's answer after its own first choice (`pv[1]`) and after the move played (`replyAfter`). The panel shows the first, labelled "the reply the table expects after its first choice", never "threat". |
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
