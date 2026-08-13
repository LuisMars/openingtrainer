# The Triangle & the Swamp

A single-file opening trainer for two systems: the **Colle** as White and the **Hippopotamus** as Black.
Open `docs/index.html` in any browser. No install, no build step, no server. Everything except
one optional online panel works offline.

**52 lines · 442 trainable positions · 80 tactics puzzles.**

---

## What it does

| Mode | What happens |
|---|---|
| **Study a line** | Step through with a note on every move, the ECO name, an optional masters-database panel, and free play: make any legal move to explore, then take it back |
| **Drill a line** | Play one line from move one from memory; the opponent answers automatically |
| **Shuffle drill** | A weighted-random position from any line. How fast you answer is recorded and changes when the position comes back |
| **Tactics** | 80 real positions from real games in these structures, from the lichess puzzle database |
| **Progress** | Solid / seen / accuracy, per-line bars, your five weakest positions, and JSON export and import |

Moves can be **dragged or tapped**. Selecting a piece shows its legal destinations.

Options (⋮ menu): flip board, target-square ghosts, board colours (Brown, Blue, Green, Slate),
piece set (Cburnett standard, or a custom engraved set), and **drill book lines only**.

---

## The 52 lines and where each came from

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
| Zukertort: Rudel's early Ne5 | 8.Ne5 cxd4 9.exd4 Qc7 10.f4 Nb4 11.Rf3!?, from David Rudel's *Zuke 'Em* quick-start material |
| 3...Bf5: recapture with the c-pawn | Soltis: 5.cxd3, not 5.Qxd3, which invites ...Ne4 and ...f5 |
| 3...Bf5: the tempting trade | Soltis: 5.Bxf5 exf5 6.Qd3 Qc8! and Black is fine |

Rudel's line cites his own published quick-start material. The two Soltis recommendations
are reported second-hand: the source on file is a chess.com forum discussion that names
Soltis, not the book or column itself.

### `eco` — named variations, quoted verbatim (18)

Taken unchanged from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0):
Colle System Grünfeld Formation · Traditional Colle · Colle System King's Indian Variation ·
Pterodactyl and Rhamphorhynchus (the ...Qa5+ tricks) · Modern Defense Mongredien with Nc3 and with Nf3 ·
Bishop Attack · Pseudo-Austrian Attack · Averbakh System · Pirc Austrian Attack · Pirc Classical ·
Modern Standard Defense · Three Pawns Attack · Averbakh Pseudo-Sämisch · Rat Defense Small Center ·
Torre Attack · London System. Each was matched against the data set move for move at build time.

### `theory` — documented theory, assembled here (8)

Koltanowski main plan · Zukertort Pillsbury lift · Zukertort modern tabiya (after
[Matthew Sadler](https://matthewsadler.me.uk/attack/a-typical-colle-zukertort-position-part-1/)) ·
Anti-Colle 3...Bf5 met by 4.c4 · the autopilot punished · Anti-Colle 3...Bg4 met by 4.h3 and 5.g4 ·
Hippo against the Be3/Qd2/f3/g4 storm · when not to crouch (4.f4).

### `model` and `synthetic` — written for this trainer (3 + 16)

The Hippo model setup vs 1.e4 · White plays e5, the French answer · against the fianchetto (...g6) ·
Zukertort against a Queen's Indian · locking the centre then ...f5 · ...h5 against the pawn storm ·
the e5 clamp and the h7 target · the Colle against a Slav shape · Zukertort with Qf3 and Qh3 ·
answering ...Ne4 · the Hippo against 1.c4 · the Hippo against a London setup · punishing an early e5 ·
how the Hippo loses · meeting the h4 lunge against the Modern · the ...c4 clamp on the Colle bishop ·
when Black's ...e5 equaliser lands · against the Dutch (a Leningrad shape) · against 1...c5.

Nobody played these and no book prints them. They are legal, thematic sequences built to teach a
structural rule, and they are tagged so you can exclude them: **drill book lines only** drops `game`,
`model` and `synthetic` lines from Shuffle.

### Two structural rules worth more than the move lists

- White plays **e5** → Black answers **...d5**, the structure becomes a French, the break is **...c5**.
- White plays **d5** → Black answers **...e5**, the structure becomes a King's Indian, the break is **...f5**.

Black's pawns control every square on the fifth rank, so White cannot make progress without pushing a pawn
into the swamp — which is what finally gives Black something to hit.

---

## Data and licences

| What | Where | Licence |
|---|---|---|
| Piece graphics (standard set) | Colin M. L. Burnett, via the [lichess repository](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Opening names (ECO) | [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) | CC0 |
| Tactics puzzles | [lichess open database](https://database.lichess.org/) | CC0 |
| Masters statistics | [lichess opening explorer API](https://lichess.org/api#tag/Opening-Explorer) | live, optional, the only online part |
| Board colours | lichess and chess.com defaults | — |

The puzzle set came from streaming the 304 MB compressed dump, filtering to the opening tags matching these
structures (75,664 rows), replaying every candidate through the move generator, and keeping 82. Two of those
had matched a tag only as a substring of a longer variation name — a Scotch and a King's Gambit, nothing to
do with these structures — so they were removed by hand and the filter now matches whole tag names. The 80
that remain: ratings 803 to 2116, 48 with White to play and 32 with Black, including 14 where the solution
starts with a bishop landing on h7. Opening names were resolved against the lines at build time, so a few kilobytes ship instead
of the full data set.

---

## How the trainer decides what to show you

Each drillable position keeps `{correct, wrong, streak, lastSeen, rollingTime}`.

- **Ladder** of review intervals in hours: `0, 4, 24, 72, 168, 336`, indexed by streak.
- **Speed counts.** Answer in under 7 seconds and the position banks the full interval and can become
  *solid*. Answer correctly but slowly and the interval shrinks to 40%, and it never counts as solid.
- **Shuffle weights**: due 3.0, new 2.2, learning 1.6, solid 0.2, plus 0.8 if you have been slow there.
  The position you just saw is excluded.
- **Hint cost**: the first two tiers are neutral (no streak gain, no accuracy hit); "Show me" counts as a miss.
- **Illegal moves cost nothing.** A legal but non-repertoire move counts as a miss and is named back to you.

### Hints, in three tiers

The first tap gives a real clue, or the button says **Which piece** instead — there is no filler tier. Clues
come from the line's own annotation (rejected if it contains the move, its squares or the piece name), from
facts the generator reads off the position (*recapture on d4*, *there is a capture, and it arrives with
check*, *the move gives check*), or from the plan behind that move in this system (*point something at h7*,
*take b5 away from their pieces for good*). Of the 442 trainable positions, 436 produce a real clue and none
leak the answer.

---

## Correctness

The board is not a picture. A full legal move generator was written for this app and verified against the
standard [perft](https://www.chessprogramming.org/Perft_Results) positions, in Node and inside the shipped
file in a browser:

| Position | Depth | Nodes | Result |
|---|---|---|---|
| Start | 4 | 197,281 | exact |
| Kiwipete | 3 | 97,862 | exact |
| Position 3 | 4 | 43,238 | exact |
| Position 4 | 3 | 9,467 | exact |

All **870 moves** across the 52 lines were then replayed through that generator: every one legal, and the
algebraic notation shown in the app matches the notation the generator produced independently. The 80 puzzle
solutions were validated the same way.

---

## Limits

- **There is no engine.** The generator knows what is legal, never what is good. Only the recorded moves are
  accepted as repertoire answers; a rival plan cannot be graded, only recognised as legal.
- Progress lives in this browser's storage. Export from the Progress screen after any serious session.
- The masters panel needs a connection; everything else works on a plane.
- If *objectively best* is your only criterion, neither opening survives contact: the Colle is equal at best
  and the Hippo concedes something real. They are chosen for practical reasons — one plan against almost
  everything, very little theory, opponents out of book early. That is a different argument from correctness.

---

## Repo layout and build

```
build.mjs                  concatenates src/* into docs/index.html (no bundler, no framework)
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
test/verify.mjs            engine + data gate, no browser needed
test/ui.mjs                browser smoke test (playwright)
tools/fetch-assets.sh      downloads the CC0 sources into data-src/
tools/build-eco.mjs        regenerates src/data/eco.js
tools/build-puzzles.mjs    regenerates src/data/puzzles.js
docs/index.html            the product
```

```
npm run build     # src/ -> docs/index.html
npm run verify    # build, then perft + every line + every puzzle  (~1 s)
npm test          # the above plus a browser smoke test
npm run serve     # http://localhost:8080
```

`npm run verify` is the gate. It fails on an illegal move, a mislabelled move, a line
with no provenance tag, or a function called but never defined. The same checks also run
inside the app: open **Progress** and it verifies itself in your browser and says so.

The trainer is published straight from `docs/` on the default branch via GitHub Pages,
so `docs/index.html` is committed rather than gitignored.

Contributors, human or agent, should run `npm run verify` before sending anything. It is the
same gate described above — illegal moves, mislabelled moves, missing provenance tags, calls
to undefined functions — and every one of those checks exists because this project got that
thing wrong at least once already.

---

## Not in this build

No engine analysis, no PGN import, no user-added lines. Either is real work rather than a switch: an
evaluation panel needs Stockfish-WASM fetched from a CDN, which ends the offline property, and import needs
a PGN parser plus storage for user lines alongside the built-in ones.
