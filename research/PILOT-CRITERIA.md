# Pilot selection criteria (W2-E1)

Status: criteria fixed before the coverage write-ups land, so the selection
cannot be quietly reshaped to fit whatever is convenient. The selection itself
is made once `research/W1-C-colle-coverage.md` and
`research/W1-D-hippo-coverage.md` exist.

Target: **about 20 positions**, where a position is a `keyFen` identity at which
the user has to move.

## Hard requirements

1. **Both openings.** Between 8 and 12 from each side; no side under 8.
2. **Every situation type present**, at least one each:

   | Type | What it proves |
   |---|---|
   | broad choice | several moves within the acceptance band get comparable credit |
   | narrow choice | one or two moves only; the grader stays demanding |
   | quiet | no tactics; the decision is structural |
   | tactical | a concrete threat decides it |
   | inferior / defensive | the user is worse and must find the best defence, without the app implying the position is saved |
   | transposed | reached by more than one move order under one identity |
   | opening transition | the position belongs to a recognisable other opening |

3. **Not chosen for convenience.** At most half may come from the 50 positions
   that already have a stored `EVL` row. `research/pilot-candidates.json` records
   `evaluated` per position so this is checkable, not a promise.
4. **Frequency-informed, not frequency-ruled.** At least 12 positions must be
   reached ≥ 200 times in the player pool; at least 3 must be rare-but-forcing
   counters chosen on chess grounds with their low counts stated.
5. **Coverage mix.** At least 6 positions the repertoire already drills (so the
   grading change can be compared against current behaviour) and at least 6 the
   matrix marks `missing` (so the pilot tests new coverage, not just regrading).

## What disqualifies a candidate

- Any position whose acceptance would rest on the four-ply material search alone.
- Any position where the intended explanation depends on a claim nobody checked.
  If the explanation needs "White is winning", either the analysis exists or the
  position is not in the pilot.
- Deliberate-mistake lines (`trap`, `soltis-trap`, `syn-hipdown`) as *graded*
  positions. They may appear as positions to repair, which is a different record.

## Recorded per selected position

Per `research/CONTRACTS.md`: `id`, `key`, `fen`, situation type, how it is
reached, player and master counts with pools named, current coverage status,
whether it already has an `EVL` row, the lesson goal, and the open question the
analysis must settle. Sources attach at claim level, not position level.

## Why ~20 and not more

The wave gate exists so that a discovery about grading or schema costs twenty
lessons to redo, not hundreds. Expansion happens after the pilot gate holds,
and is driven by missing situations rather than a target line count.
