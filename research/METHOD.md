# How the frequency numbers here were counted

The lichess opening explorer API is unreachable from this environment
(`explorer.lichess.ovh` → HTTP 401 through the proxy; confirmed sandboxed,
unsandboxed and via the fetch tool). Every frequency in `research/freq-*.json`
was therefore counted locally by `tools/count-replies.mjs` from a named dump.
No figure in this repository comes from anywhere else.

## The tool

`tools/count-replies.mjs` replays games with the project's own engine
(`src/engine.js`, loaded out of the built bundle exactly as `test/verify.mjs`
does), so a counted position is the same position the trainer will key on.

It walks a **probe tree**, not the whole game tree: at our own nodes the game
must play a move the repertoire actually plays there, or the game is dropped; at
opponent nodes every move is counted. That is why "games read" is far larger
than "games in tree". Positions are keyed by `keyFen()` identity, so
transpositions merge.

```
node tools/count-replies.mjs --side w --pool player \
  --in data-src/games/lichess_db_standard_rated_2014-01.pgn.zst \
  --minElo 1500 --maxPly 20 --minGames 20 --out research/freq-colle-player.json
```

`--side w` walks the Colle tree, `--side b` the Hippo tree. Every output file
records its own `filters`, `retrieved`, `games_read`, `games_in_tree`, and a
`parent_games` count per position, so a share can always be read back against
its sample size.

## The pools, and what each one can and cannot support

**`player` — lichess monthly dump** (`database.lichess.org`, CC0).
Rating and time control come from the PGN headers, so the filters are exact.
This is the only pool here that is *not* selected by opening, so it is the only
one that can speak to how often a reply is actually met. Its weakness is the
obvious one: these are online games at a stated rating band, not master play.

**`master-pgnmentor` — curated opening collections** (`pgnmentor.com`).
These are strong-player games **already selected by opening classification**.
The bias is visible and must not be edited out: in `Colle.pgn`, Black answers
1.d4 with 1...d5 73.3% and 1...Nf6 26.7% and *nothing else*, and after
2.Nf3 d5 the reply is 100% Nf6 — because a game where Black played something
else is not in the collection. Shares from this pool are therefore
**conditional on the game being classified as that opening**, and they
systematically understate every reply that leaves the classification.
Use it for *which continuations strong players choose once the opening is
reached*, never for how likely the opening is reached.

**`master-twic` — The Week in Chess weekly archives** (`theweekinchess.com`).
General master-game coverage, not selected by opening, so it is the master pool
that can be read the way the player pool is. Its limitation is date range: it is
a sample of recent play, and the issues used are named in the output's filters.

The two master pools are kept in separate files and are never added together.
Player and master figures are never merged or compared move-for-move.

## Rules these numbers do not break

- A share computed from fewer than 30 parent games is reported with its count
  and read as an observation, not an estimate.
- Frequency is not quality. Nothing in this directory infers that a move is
  good because it is common, or bad because it is rare. Rare forcing counters
  stay in scope regardless of share.
- Conditional reply share (`games / parent_games`) is not the probability of
  reaching the position. Both numbers are kept.

## The probe tree's blind spot

`tools/count-replies.mjs` drops a game the moment our side leaves the
repertoire. Where an opponent reply has no repertoire answer, no child node is
ever created — so for **every gap this research identifies we know how often the
move is played and nothing at all about what follows it**. Verified: the Colle
player file contains no position after `1...e6`, `1...e5`, `4...Be7`, `4...Bd6`,
`3...Bb4+`, `2...Nc6`, or the King's Indian `4...O-O`.

This caps what the stopping criteria can be calibrated against, and it means a
gap's continuation has to come from analysis rather than from this data. It is
recorded as a limitation, not worked around. Closing it would mean a second
counting pass seeded with candidate answers once those answers exist.

## Coverage is credited per trained side

`tools/coverage-matrix.mjs` originally credited any line that played a reply,
regardless of which side that line trains. That marked `1...e6` "covered" in the
Colle-as-White section on the strength of `eco-rat`, a Hippopotamus line where
the user plays Black — which gives the White repertoire nothing. Coverage is now
split by `you`, and the three affected cells read `missing`.

## Rating bands (what the trainer's occurrence weighting reads)

The plan asks for representative rating bands rather than an assumed user
rating. The one player dump on hand, `data-src/games/lichess_db_standard_rated_2014-01.pgn.zst`
(697,600 games; Event headers: 260,781 blitz, 245,985 classical, 172,843 bullet,
2,214 correspondence, the rest tournament-tagged), was split by the **average of
`WhiteElo` and `BlackElo`** — lichess's 2014 Glicko-2 scale, which is not today's —
and counted once per band with nothing else changed (`--maxPly 20 --minGames 20`,
no speed filter, retrieved 2026-09-21):

| band | filter | games read | Colle tree | Hippo tree | files |
|---|---|---|---|---|---|
| under 1500 | `--maxElo 1499.5` | 202,157 | 49,063 | 202,157 | `freq-{colle,hippo}-player-u1500.json` |
| 1500–1899 | `--minElo 1500 --maxElo 1899.5` | 437,890 | 119,433 | 437,890 | `freq-{colle,hippo}-player-1500-1899.json` |
| 1900 and over | `--minElo 1900` | 57,211 | 18,243 | 57,211 | `freq-{colle,hippo}-player-1900.json` |

The average moves in half points, so `1899.5` closes the middle band exactly.
The three bands sum to 697,258; the other 342 games have a missing Elo or no
parsable moves. `tools/build-freq.mjs` turns each pair into one table in
`src/data/freq.js`; of 285 drilled positions, 71 / 93 / 73 are reached in the
three bands, and the rest are neutral in each.

The **default is 1500–1899** because 63% of the dump's games are in it, not
because it is anyone's rating. The options sheet says so ("most games") and lets
the user cycle bands; the choice is a stored setting (`stats.band`, optional,
absent or invalid reads as the default, no storage-key bump).

Not done, and why: **time-control bands** are countable from the same headers
(`--speeds`) but are not shipped — one axis of choice is enough until someone
asks for the other. **1900 and over** is the thinnest sample (18,243 games in
the Colle tree), so more of its positions fall below the 20-game floor and ship
neutral; that is the honest outcome, not something to pad. The older
`freq-*-player.json` files (average ≥1500, one pool) stay as the record the W1
research and the coverage matrix were written against.

## Prioritisation: three factors, never one score

The plan's rule — prioritise by practical frequency, chess importance and
connection to recognisable openings, with rare forcing threats mandatory — is
already recorded, factor by factor, and nowhere combined into a composite:

- **Research.** `W1-C-colle-coverage.md` §1 gives every branch separate **F**
  (frequency), **C** (criticality) and **P** (popular-opening connection)
  columns and states its two-of-three ordering rule openly.
  `W1-D-hippo-coverage.md` §1 ranks by exposure (§1A), then re-ranks the same
  evidence by criticality (§1B) and by recognisability (§1C). Both files' §3 lists
  rare-but-forcing entries as a chess judgement, with counts printed only so they
  are not mistaken for popular. `W2-E1-pilot.md` requires at least three
  rare-but-forcing positions in the pilot and forbids frequency entering a grade.
- **Code.** Only frequency is a weight (`FRQ`, per band). Chess importance
  enters as a floor, not a weight: `FRQ_SHARP` (from the §3 lists, the entries the
  trainer drills) holds those positions at neutral whatever their band says, so
  rarity never demotes them. Recognisability is deliberately **not** a weight: it
  is served by opening names (`src/data/eco.js`) on the lines, and turning it into
  a multiplier would be inventing a number for a judgement.
- **Gap, recorded.** §3 entries the trainer does not drill (for example
  `3...Bb4+`, `...Bxf3` after `anti-bg4`) have no floor because there is no
  position to put it on; they remain content gaps in W1-C/W1-D §2, not weighting
  gaps.
