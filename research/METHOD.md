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
