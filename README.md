# The Triangle & the Swamp

A single-file opening trainer for two systems: the **Colle** as White and the **Hippopotamus** as Black.
Open `docs/index.html` in any browser. No install, no build step, no server. Fonts, piece graphics and
engine evaluations are baked into the page, so training itself never touches the network. There is one
exception and it is opt-in: paste a lichess API token under **Masters database** on the menu and the Study
screen gains a masters statistics panel. Save sends one test request to `explorer.lichess.org` and stores
the token only if lichess accepts it; after that the panel asks lichess once per position and keeps the
answer until the tab closes. Without a stored token, nothing leaves the page.

**210 lines · 80 tactics puzzles.**

---

## What it does

| Mode | What happens |
|---|---|
| **Study a line** | Step through with a note on every move, the ECO name, the line's middlegame plan, an optional masters-database panel, and free play: make any legal move to explore, then take it back |
| **Drill a line** | Play one line from move one from memory; the opponent answers automatically, and the note on the move you just played stays up through their reply instead of flashing away |
| **Shuffle drill** | A weighted-random position from any line. How fast you answer is recorded and changes when the position comes back |
| **Tactics** | Real positions from real games in these structures, from the lichess puzzle database |
| **Progress** | Solid / seen / accuracy, per-line bars, your five weakest positions, and JSON export and import |

Moves can be **dragged or tapped**. Selecting a piece shows its legal destinations.

Options (⋮ menu on the board screen): flip board, show target squares, board colours (Brown, Blue,
Green, Slate), piece set (Cburnett standard, or a custom engraved set), **drill book lines only**,
*favour positions that come up*, *counted at ratings*, *solid needs a second good move*, *favour your
current level*, and **arrows on the board**. Every option except flip board and show target squares
is stored.

**Arrows on the board** (on by default, in the same menu) draw on the board what the note says in
words. Once a position is answered: the first choice within your system (solid; labelled the table's
first choice when it is one), up to two other moves the system plays that the table accepts (thinner), your missed move in red, and the reply the note names (dashed). While a question is live the only arrows are your refused move and, when the
note names one, the reply that punishes it; nothing that points at the answer. Study draws none.

---

## The 210 lines and where each came from

Every line carries a visible tag. The tag is the claim being made.

### `game` — real game scores (4)

| Line | Source | Confidence |
|---|---|---|
| Colle–O'Hanlon, Nice 1930 | [Wikipedia](https://en.wikipedia.org/wiki/Colle_System), [365Chess](https://www.365chess.com/game.php?gid=2652130), owlapps, IRLchess | four renderings agree move for move |
| Petrosian–Spassky, Moscow 1966, game 12 | [Wikipedia](https://en.wikipedia.org/wiki/Hippopotamus_Defence), [chessgames.com](https://www.chessgames.com/perl/chessgame?gid=1106728) | full score published, event confirmed |
| Koltanowski–O'Hanlon, Dublin 1937 | [IRLchess archive](https://www.irlchess.com/2025/08/14/koltanowski-simuls-and-match-v-ohanlon-1937/) quoting the Irish Independent | single source |
| Petrosian–Spassky, Moscow 1966, game 16 | [Wikipedia](https://en.wikipedia.org/wiki/Hippopotamus_Defence), [chessgames.com](https://www.chessgames.com/perl/chessgame?gid=1106734) | full score printed on Wikipedia; checked move for move against the stored line |

A game score is a historical fact, not a recommendation. Colle's 12.Bxh7+ against O'Hanlon has been argued
about for ninety years, and Black's 13...f6 against Koltanowski is a losing move, shown on purpose.

### `book` — published recommendations (3)

| Line | Recommendation |
|---|---|
| Zukertort: the early Ne5 and Rf3 | 8.Ne5 cxd4 9.exd4 Qc7 10.f4 Nb4 11.Rf3!?, from a chess.com quick-start article bylined "Zukertort" |
| 3...Bf5: recapture with the c-pawn | Soltis: 5.cxd3, not 5.Qxd3, which invites ...Ne4 and ...f5 |
| 3...Bf5: the tempting trade | Soltis: 5.Bxf5 exf5 6.Qd3 Qc8! and Black is fine |

The Zukertort line's source is a chess.com quick-start article, written in the first person under
the member byline "Zukertort". The article was fetched and read during a provenance audit: it names
neither David Rudel nor *Zuke 'Em*, and whether that member is Rudel is unknown, so the line claims
only what the article shows. The two Soltis recommendations are second-hand by their own labels —
"attributed to Soltis in a chess.com thread" and "after a thread citing Soltis". The source on file
is the forum discussion, not the book or column it names.

A handful of moves in the repertoire carry an annotation mark (`e4!`, `Rf3!?` and a few others). No engine
checked them and the build strips them before comparing notation against the generator, so they are
repertoire signposts rather than verdicts. A mark is kept only where the line's own source carries one,
which is why five were removed during the audit: a `model` line has no source that could have written
one, and the others' sources do not.

### `eco` — named variations, quoted verbatim (18)

Taken unchanged from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0):
Colle System Grünfeld Formation · Traditional Colle · Colle System King's Indian Variation ·
Pterodactyl and Rhamphorhynchus (the ...Qa5+ tricks) · Modern Defense Mongredien with Nc3 and with Nf3 ·
Bishop Attack · Pseudo-Austrian Attack · Averbakh System · Pirc Austrian Attack · Pirc Classical ·
Modern Standard Defense · Three Pawns Attack · Averbakh Pseudo-Sämisch · Rat Defense Small Center ·
Torre Attack · London System. Each was matched against the data set move for move at build time.

### `theory` — documented theory, assembled here (9)

Koltanowski main plan · Zukertort Pillsbury lift · Zukertort modern tabiya (after
[Matthew Sadler](https://matthewsadler.me.uk/attack/a-typical-colle-zukertort-position-part-1/)) ·
Anti-Colle 3...Bf5 met by 4.c4 · the autopilot punished · Anti-Colle 3...Bg4 met by 4.h3 and 5.g4 ·
Hippo against the Be3/Qd2/f3/g4 storm · when not to crouch (4.f4) ·
1...e6, the move order that waits (added after the coverage count showed it was
the commonest answer to 1.d4 with no line against it).

### `model` and `synthetic` — written for this trainer (3 + 173)

The Hippo model setup vs 1.e4 · White plays e5, the French answer · against the fianchetto (...g6) ·
Zukertort against a Queen's Indian · d5 without c4, taking on d5 · ...h5 against the pawn storm ·
the Colle against a Slav shape · Zukertort with Qf3 and Qh3 ·
answering ...Ne4 · the Hippo against 1.c4 · the Hippo against a London setup · punishing an early e5 ·
how the Hippo loses · meeting the h4 lunge against the Modern · the ...c4 clamp on the Colle bishop ·
when Black's ...e5 lands, and e4 beats the capture · against the Dutch (a Leningrad shape) · against 1...c5 ·
defending the Greek gift in Colle–O'Hanlon (13...Kg8) · ...h6 against the Koltanowski clamp ·
4...Be7, where there is no bishop to shoot at · 2...Nc6, the knight in front of the c-pawn ·
the King's Indian shell completed · 3.e5 before it is prepared · 4.Bg5 against the
...Nf6 order · 2.Nf3 and the King's Indian Attack · flank openings · h4 and g4 straight out of the
Be3 tabiya · 1...e5, the Englund Gambit · 3...Bb4+ · 2...c6 and 3...Bg4 · 1...c6 and 3...Bf5 ·
1...d6 · 1...b6 · 2...Bf5, hunt the bishop · 2...c5 and an early ...cxd4 · 2...Bg4, Ne5 at once ·
3...Bg4 4.h3 Bxf3 · 2.Bc4 and 3.Qf3 against f7 · 2.f4, strike before the bishop · 2.Nf3 and 3.Bc4 ·
1...d6 2.Nf3 back into the crouch · 1.d4 g6 2.Nf3 and 3.e3 · 1...d6 2.f4, ...e6 not ...g6 ·
1...d6 2.Bc4, close the diagonal · 1...d6 2.d4 Nf6 3.Bd3 · 1...d6 2.d3, the knights behind the pawns ·
1...e6 2.Nf3 Bb4+, block with the c-pawn · 5...Qb6 in the b3 window · 5...Ne4 in the c3 structure ·
1...d6 2.Nc3, ...g6 as a stated concession · 1...e6 2.Nf3 c5, take back with the pawn ·
2...Nc6 3.e3 Nf6, the knight to d2 first · 4.Bd3 against the Pirc · 1...g6 2.Nf3 Bg7 3.Nc3, ...d6 not ...e6 ·
1...e6 2.Nf3 b6, the knight before the e-pawn · 4.Bc4 against the Modern, close the diagonal ·
2...Nc6 3.e3 Bf5, the bishop to d3 · 4.Be3 against the Pirc · 1...e6 2.Nf3 d6, e3 at the edge of the band.
A further 114 (ids `gc-…` for the Colle, `gh-…` for the Hippopotamus) were generated by
`tools/gen-gap-lines.mjs` from every remaining row of the coverage count (`research/W6-content-batch.md` §10 to §12).
Each starts at a reply the repertoire had no line for. Every learner move in them is the best-scoring
Colle or Hippopotamus move that the depth-20 table puts inside its 30-centipawn band; in a Hippopotamus
line where no such move is in the band, it is a semi-Hippo move (...Nf6, ...c5, ...c6 or ...d5) inside
the band, and the note on the move says so (§12). Every opponent
move is the commonest in the 1500 to 1899 band, or the table's first choice where fewer than ten
counted games continue. Each line stops at a transposition into another line, where no system move
is in the band, or after six moves of its own, and its plan says which. Of the 202 rows decided, 88 were
not built, each with its reason in `research/gap-lines.json`: 76 are reached only through an `eco` line's
move order, 7 have no Colle or Hippopotamus move (semi-Hippo included) inside the band, and 5 are reached
by a line built in the same run.
The ten before them were built from the next rows of the coverage count (§9).
One of them drills a move the table grades a concession, on purpose: after 1.e4 d6 2.Nc3 no
Hippopotamus move is inside the band, and ...g6, the cheapest, is 35 centipawns behind ...c5. The
line says so on the move.
The three before them answer forcing replies too rare to count, chosen for what they threaten (§8).
The twenty-eight before those
were built from the coverage count (`research/W6-content-batch.md` ranks the latest nineteen): each answers a reply the repertoire measurably
met and had no line for, and every move in them was graded before a word was
written about it. One more, the queenside answer to g4 out of the same
tabiya, was built from the stored analysis itself: against g4 the engine
prefers ...b5, which it rates a clear concession against h4, so the two
storms are drilled side by side. Two more take the attacking model games from the defender's side:
the moves are the game's until the defender's decision, then the line follows the stored analysis.
Every Black move in them grades best or equal except O'Hanlon's own 8...Re8, 37 centipawns behind,
which the line asks you to improve on before it plays the game move.

Nobody played these and no book prints them. They are legal, thematic sequences built to teach a
structural idea, and they are tagged so you can exclude them: **drill book lines only** drops `game`,
`model` and `synthetic` lines from Shuffle.

### Two structural responses, and when they change

- White plays **e5** → Black usually answers **...d5**, the structure becomes a French, the break is **...c5**.
  In the model line this is the table's choice, 18 centipawns ahead of the next move and 26 ahead of the
  capture ...dxe5. Against the storm setup, with Be3, Qd2 and f4 already in, the capture ...Bxf3 is 94 ahead
  of the lock instead.
- White plays **d5** → Black often answers **...e5**, the structure becomes a King's Indian, the break is
  **...f5**. In Petrosian–Spassky, with c4 ready to recapture, ...e5 is joint first and the capture ...exd5
  29 behind; in the model without c4 the capture is 38 ahead of the lock.

The Colle has the same kind of decision. e5 straight after ...Qc7 is -1.21 by the stored analysis and +0.80
two moves later with Qe2 in; and when Black gets ...e5 in first, the counter-break e4 beats the capture dxe5
by 44. The responses are candidates to check against the position, not rules.

Black's pawns control every square on the fifth rank, so White cannot make progress without pushing a pawn
into the swamp — which is what finally gives Black something to hit.

---

## Data and licences

| What | Where | Licence |
|---|---|---|
| Piece graphics (standard set) | Colin M. L. Burnett, via the [lichess repository](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Opening names (ECO) | [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) | CC0 |
| Tactics puzzles | [lichess open database](https://database.lichess.org/) | CC0 |
| Occurrence and player-choice counts | [lichess open database](https://database.lichess.org/), January 2014 rated games, counted locally | CC0 |
| Stockfish evaluations | computed at build time by [Stockfish 16](https://stockfishchess.org/) (lichess's [`lila-stockfish-web`](https://www.npmjs.com/package/lila-stockfish-web) small-net WASM build, a dev dependency) | engine GPL-3.0, lila build AGPL-3.0; build-time tools, not shipped in the page |
| Masters statistics | [lichess opening explorer API](https://lichess.org/api#tag/Opening-Explorer) | live, optional, the only online part |
| Board colours | lichess and chess.com defaults | — |

The puzzle set came from streaming the 304 MB compressed dump, filtering to the opening tags matching these
structures (75,664 rows), replaying every candidate through the move generator, and keeping 82. Two of those
had matched a tag only as a substring of a longer variation name — a Scotch and a King's Gambit, nothing to
do with these structures — so they were removed by hand and the filter now matches whole tag names. The 80
that remain: ratings 803 to 2116, 48 with White to play and 32 with Black, including 14 where the solution
starts with a bishop landing on h7. Opening names were resolved against the lines at build time, so a few kilobytes ship instead
of the full data set.

The evaluations in `src/data/evals.js` are Stockfish 16 scores computed once at build time
(`tools/build-evals.mjs`) by a local engine — lichess's `lila-stockfish-web` sf16-7 build (a 433 KB WASM
plus one 6.5 MB NNUE network, package version and network checksum both pinned) — so the page itself never
runs an engine and never touches the network. The table holds every distinct board you are asked to move
in, plus a few more searched while the grading bands were being calibrated or because a line's note prices
the opponent's move there; `npm run verify` fails if a drilled position has no row. Each was searched
single-threaded to depth 20 with a cleared hash, which makes this step reproducible, unlike the puzzle
set: the same engine version and network at the same depth regenerates the same table. Stockfish and its
network are GPL-3.0 and the lila build AGPL-3.0; they are used here as build tools, the way a compiler
is — the page ships only the numbers they produced, none of their code. The table was originally fetched
from the lichess cloud-eval API; those responses were kept and the local engine's output was validated
against them before the switch (best-move agreement on the cached positions, with the handful of
divergences all near-equal alternatives). All scores are stored from the side to move's point of view,
with forced mates kept distinct from centipawn scores. The tool takes `--extra` (further positions to
search) and `--force` (named moves searched one at a time through UCI `searchmoves`), which is why every
drilled repertoire move has a score of its own even when it falls outside the ranked five; none is
unanalysed, and the build checks that. The same `--force` pass also scores the moves that real players
commonly chose at drilled positions (next paragraph), so that a common choice can be priced rather than
guessed at.

A second search backs the positions where the trainer makes a narrow claim. `tools/deep-check.mjs`
re-searches a subset of the drilled positions at depth 28 with the same engine and settings: those with one accepted
move, those the setup gate calls demanding, and those whose best move is a mate, capture or check. It
writes them to `src/data/deep.js`. At those positions a move gets the more generous of its two verdicts,
so nothing either depth accepts is marked wrong. Where the two depths disagree about a move, the feedback
says so and gives both numbers. A position counts as demanding only when both depths agree. Everywhere
else the depth-20 table alone decides.

What players actually choose at each drilled position is counted, not estimated, by
`tools/count-choices.mjs` from the same lichess January 2014 dump and the same three rating bands the
occurrence weighting uses: the move of the trained colour is recorded at every drilled position a game
reaches while it follows the repertoire, including the move that leaves it. `src/data/choices.js` keeps
a choice when, in some band, at least 30 games reached the position and at least 10 and 5% of them chose
it. Frequency never grades anything: which of those choices is a mistake is decided by the stored engine
table alone. Where a position's forced search is already fixed by drilled moves (adding more would shift
those moves' own scores), a common choice is searched on its own, so no stored score moves.

---

## How the trainer decides what to show you

Each drillable position keeps `{correct, wrong, streak, lastSeen, rollingTime}`.

- **Ladder** of review intervals in hours: `0, 4, 24, 72, 168, 336, 720, 1440` (out to 30 and 60
  days), indexed by streak, so material that is genuinely solid stops coming back every fortnight.
- **Speed counts.** Answer in under 7 seconds and the position banks the full interval and can become
  *solid*. Answer correctly but slowly and the interval shrinks to 40%, and it never counts as solid.
- **Shuffle weights**: due 3.0, new 2.2, learning 1.6, solid 0.2, plus 0.8 if you have been slow there.
  A new position other than the next untouched one in its line is cut to 0.15 of that, and while anything
  is due new ones are cut to a quarter; neither cut takes a new position below 0.3, so new outranks solid
  before the occurrence and level factors below are applied. The position you just saw is
  excluded. While anything is due, everything that is not due is cut to a tenth, so a backlog is worked
  off rather than merely competing for draws — it still interleaves.
- **Levels by depth** (*Favour your current level*, on by default). Every drilled position belongs to a
  level by the move number you answer at: moves 1–3, 4–5, 6–7, 8–10, and 11 onwards. A board that two
  lines reach at different depths takes the shallower one; puzzles have no level. A level is *cleared*
  once 80% of its positions that Shuffle can serve are solid (with *Drill book lines only* on, only book
  positions count), and your level is the first one not cleared. Shuffle multiplies positions in your
  level by 2, leaves easier levels at 1, and cuts deeper ones to 0.6, 0.4, 0.3 and 0.2 by distance — less
  often, never not at all. Due reviews are not reweighted. Measured over 600 seeded draws: a fresh profile
  gets about 72% of its draws from level 1 (35% with the setting off); a profile with levels 1 and 2
  solid gets about 82% from level 3 (61% off). The menu shows your level and how much of it is solid;
  Progress lists every level. Nothing new is stored beyond the setting itself: levels are worked out from
  the same records as everything else, and the level counts shift as lines are added.
- **Positions that come up more often come up more often** (*Favour positions that come up*,
  on by default). Each position's weight is multiplied by 0.55 to 1.5 according to how often it
  was reached in the counted player games (see `research/METHOD.md`). Due reviews are never
  reweighted, so they still come first. A position the count never reached is left at 1, not
  treated as rare, and a handful of rare but forcing counters are held at 1 as well.
- **Rating band for those counts** (*Counted at ratings*). The counts exist three times over — games
  whose two players average under 1500, 1500–1899, and 1900 and over, all from lichess rated games of
  January 2014 — and the button cycles between them. The trainer does not know your rating and does not
  guess it: it starts on 1500–1899, marked *most games*, because that is where most of the counted games
  fall. The choice is stored with your other settings and travels in an export. Ratings are lichess's
  2014 scale, which is not today's.
- **Solid needs a second good move** (on by default). Where your system has two or more moves that
  the table accepts within 30 centipawns of the best, a position counts as *solid* only once you have
  found two different ones there. Where the system has one, one answer is enough.
- **Hint cost**: the first two tiers are neutral (no streak gain, no accuracy hit); "Show me" counts as a miss.
- **Illegal moves cost nothing.** A legal but non-repertoire move is named back to you and comes with
  the same clue Hint's first tap would give — never the move itself — so a second wrong try is not told
  exactly what the first one was. Taking it spends that first hint tier. Whether it counts as a miss
  depends on the grading below.
- **Book elsewhere is not a miss.** If the move you played is the book move for a different line
  trained from this exact board, in the same chapter and for the same side, it is not graded wrong: Drill names
  that line and lets you retry with no miss and no streak change, Shuffle switches to that line and credits the
  answer. Book is not a quality claim: where the stored table prices the move as a concession or worse, the
  message states the cost (Stockfish 16, the depth, and the centipawns behind its first choice, or the mate), and a
  move the table never searched is said to be unsearched. It is still credited. Either way the move is kept as a good move found there, which counts towards *Solid needs a second
  good move*. Puzzles and the
  deliberate-mistake lines are excluded, so they can never be waved through this way.

### How a played move is graded

Every position you are asked to move in has a row in the precomputed table: the five best moves with their
scores, plus a score searched on its own for any repertoire move that falls outside those five. A move is
judged on how far it sits behind the row's best move, never on its place in the list — rank 5 is five
centipawns behind in one position and far more in another, and a separately scored move has no rank at all.

- **The bands**: within **30 centipawns** is equal and accepted, out to **70** is a concession, and **200**
  marks a decisive swing. The three numbers were calibrated against this repertoire's own positions rather
  than assumed — in these two openings several moves inside a pawn is the normal case, not the exception.
  The policy, its version and the histogram behind the bands are in `research/GRADING.md`.
- **A move must be sound and in your system.** The table accepting a move is not enough: it is credited
  only when it is also the line's move, a move another line of the same chapter and side plays from this
  board, or a formation move the setup rule credits. As Black in the Hippopotamus there is one more kind,
  the **semi-Hippo**: ...Nf6 (either knight), ...c5, ...c6 and ...d5 count as your system where the table
  grades that move best or equal, and nowhere else. They are not formation moves — the setup rule never
  credits them — and the lines that show a mistake, and repair lines, never accept them. Shuffle credits
  one as "c5, a semi-Hippo move: the table grades it inside the band here."; out of the band it is graded
  like any other move. 1.e4 is as sound as 1.d4, and it is not the Colle:
  a sound move from another opening is answered "e4 is sound, but it is not a Colle move here. Try
  again.", with its number, and costs nothing — no miss, no credit, no streak change — while the question
  stays live. Repairing a deliberate mistake is the exception: there any sound move counts. Each move is
  judged on its own gap; nothing in the app names a rank.
- **A move outside the stored five is unanalysed, not bad.** It costs nothing: no miss, no broken streak,
  no spent hint, and the app says so rather than implying a verdict. The material search still runs there,
  so a move that demonstrably drops material is still blamed.
- **A concession is refused with its price named** — the drill continues and the message states the cost.
- **Common mistakes are counted, then priced.** A move players at the selected band chose often
  here (the floor above) that the table grades a concession or worse, and that no line plays from this
  board, is a common mistake. Play one and the refusal adds how often players chose it; answer the
  position and Shuffle names the most common one, with its count and its score. Most are concessions of
  well under a pawn; a few are inferior.
- **Position details** (a panel under the board) gathers what the data can say about the position:
  how often it is reached, how many games reached it, the table's depth and how far its first choice
  stands clear of the second, the line it comes from, and the opponent's threat where there is one: the
  same board searched at build time with the move handed to the opponent, shown only when that free move
  gains at least 150 centipawns over the position as it stands, or mates. While the
  question is live nothing there can name the answer — every row is checked against the move, a threat
  that touches the answer's squares waits until it is answered, and Shuffle hides the line and its plan.
  Once answered it adds the line's plan, the line's own note on the move, the table's first choice with
  the reply it expects, and the common mistakes. No per-position prose is written; the goal is those
  three sources, each labelled. `research/W5-POSITION-METADATA.md` has the calibration.
- **Mates and lost positions are settled before the centipawn bands.** A move that allows mate is losing
  whatever its rank; a position that was already lost stays lost, so naming the best defence never implies
  a rescue; a move that throws away a winning position is called that instead of being priced in pawns.

### Hints, in three tiers

The first tap gives a real clue, or the button says **Which piece** instead — there is no filler tier. Clues
come from the line's own annotation (rejected if it contains the move, its squares or the piece name), from
facts the generator reads off the position (*recapture on d4*, *there is a capture, and it arrives with
check*, *the move gives check*), or from the plan behind that move in this system (*fianchetto, and aim
through the centre*, *take b5 away from their pieces*). Most positions produce a real clue; a clue that
names the answer is rejected, and the rest fall back to **Which piece**.

---

## Correctness

The board is not a picture. A full legal move generator was written for this app and verified against the
standard [perft](https://www.chessprogramming.org/Perft_Results) positions by `npm run verify`, in Node:

| Position | Depth | Nodes | Result |
|---|---|---|---|
| Start | 4 | 197,281 | exact |
| Kiwipete | 3 | 97,862 | exact |
| Position 3 | 4 | 43,238 | exact |
| Position 4 | 3 | 9,467 | exact |

Every move of every line is replayed through that generator on each build: every one legal, and the
algebraic notation shown in the app matches the notation the generator produces independently. The puzzle
solutions are validated the same way. Inside the shipped page, the **Progress** screen repeats a smaller
check in your browser: perft from the start position to depth 3, and a replay of every line and puzzle.

---

## Limits

- **There is no engine in the page.** The generator knows what is legal, never what is good; what the page
  knows about quality is the precomputed table in `src/data/evals.js`, which covers the trained positions
  and nothing else. A rival plan off the table cannot be graded live — it is reported as unanalysed, which
  is not the same as sound.
- **The engine's verdict on your move appears only after you get one wrong.** Miss a move and the feedback
  names the engine's first choice, its score against yours and the line it plays; answer correctly and it
  says nothing about your move, because relitigating a book move you already found teaches nothing. Other
  numbers are not held back: the Position details panel shows the gap between the table's top two moves
  and any threat while the question is live, and a common mistake is shown with its score. Never in
  Tactics.
- **Progress names your habits, not just your percentages.** A weak position records which wrong move
  you actually played, so the Progress screen can say "usually Bd3 (4×)" rather than a bare miss rate.
  Five distinct wrong moves are kept per position; rarer ones are evicted.
- Progress lives in this browser's storage. Export from the Progress screen after any serious session.
  Updating the page keeps it: progress saved by earlier versions (v4 and v5) is read and rewritten
  in the current format on load, and backups exported from them still import.
- **The offline promise is conditional, not absolute.** Everything except one panel works on a plane. The
  masters panel on the Study screen is the only online feature: it fetches from `explorer.lichess.org`, it
  needs a lichess token you supply yourself on the menu, and it does not appear until you store one — lichess made the
  opening explorer login-only in April 2026. Whether that endpoint still answers was not confirmed while
  this was written: it was unreachable from the environment the checks were run in.
- If *objectively best* is your only criterion, neither opening survives contact: the Colle is equal at best
  and the Hippo concedes something real. They are chosen for practical reasons — one plan against almost
  everything, very little theory, opponents out of book early. That is a different argument from correctness.

---

## Repo layout and build

```
build.mjs                  concatenates src/* into docs/index.html (no bundler, no framework)
FEATURES.md, TICKETS.md    what the trainer does today; the open work
research/                  coverage matrix, counted frequency data, contracts, grading policy, audit lists
src/
  styles.css               all CSS, inlined whole into the shipped <style> block
  html/
    head.html              <head>, meta, opening <body> and shared chrome
    menu.html               the menu screen
    lines.html               the line-list screen
    board.html               the shared board screen (study, drill, shuffle
                             and tactics all render into this one #scBoard)
    progress.html            the progress screen
    tail.html                closing chrome, folds in the old index.tail.html
  core.js                  board helpers, piece SVGs, shared constants
  engine.js                legal move generation, SAN, perft
  app.js                   state, rendering, input, scheduling
  data/lines.js            LINES, KIND (provenance tags), SRC (sources)
  data/eco.js              opening names, generated
  data/puzzles.js          tactics, generated
  data/pieces-cburnett.js  standard piece set
  data/evals.js            precomputed Stockfish scores, generated
  data/deep.js             depth-28 re-search of the narrow drilled positions, generated
  data/freq.js             how often each position is reached, per rating band, generated
  data/choices.js          what players chose at each position, per rating band, generated
test/verify.mjs            engine + data gate, no browser needed
test/w1b-engine.mjs        move generator and material-search checks
test/w2b-grading.mjs       the grading policy and its fixtures
test/ui.mjs                browser smoke test (playwright)
tools/fetch-assets.sh      downloads the CC0 sources into data-src/
tools/build-eco.mjs        regenerates src/data/eco.js
tools/build-puzzles.mjs    regenerates src/data/puzzles.js
tools/build-evals.mjs      regenerates src/data/evals.js with a local Stockfish
tools/deep-check.mjs       re-searches narrow positions at depth 28 -> src/data/deep.js
tools/count-replies.mjs    counts reply frequencies from a named game dump
tools/count-choices.mjs    counts our colour's choices at drilled positions; --tsv, --emit
docs/index.html            the product
```

```
npm run build     # src/ -> docs/index.html
npm run verify    # build, then perft + every line + every puzzle  (~1 s)
npm test          # the above plus a browser smoke test
node test/w1b-engine.mjs && node test/w2b-grading.mjs    # engine and grading checks
npm run serve     # http://localhost:8080
```

`npm run verify` is the gate. It fails on an illegal move, a mislabelled move, a line
with no provenance tag, a function called but never defined, or a line, puzzle or tag count
in this file that the data does not match. A smaller set runs inside the app: open **Progress**
and it verifies itself in your browser and says so.

The trainer is published straight from `docs/` on the default branch via GitHub Pages,
so `docs/index.html` is committed rather than gitignored.

Contributors, human or agent, should run `npm run verify` before sending anything. It is the
same gate described above — illegal moves, mislabelled moves, missing provenance tags, calls
to undefined functions — and every one of those checks exists because this project got that
thing wrong at least once already.

---

## Where the research lives

`research/` holds the working notes behind the repertoire: the coverage matrix for both openings, the
counted reply frequencies with their pools, filters and sample sizes, the data contracts, the grading
policy, and the audit change-lists that produced the current line set.

The lichess **opening explorer API was unavailable** while this work was done — HTTP 401 through this
environment's proxy, confirmed several ways — so no frequency here comes from it. Every figure was counted
locally by `tools/count-replies.mjs` from named dumps: a player pool from the lichess monthly database and
master pools from curated archives, kept in separate files and never added together. The opening-selected
master pool is biased by construction, because a game that left the classification is not in the
collection, and `research/METHOD.md` states that rather than editing it out.

---

## Not in this build

No live engine analysis, no PGN import, no user-added lines, no service worker. Either is real work rather than a switch:
evaluations for the trained positions are precomputed at build time, but analysing an arbitrary position
needs Stockfish-WASM fetched from a CDN, which ends the offline property, and import needs
a PGN parser plus storage for user lines alongside the built-in ones.
