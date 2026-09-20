# Working on this repo

Read this before changing anything. The rules below exist because each one was
learned by breaking something.

## Build model

There is no bundler and no framework. `build.mjs` concatenates `src/*` in a fixed
order into `docs/index.html`, which is the entire product: one file,
no dependencies at runtime.

```
npm run build     # src/ -> docs/index.html
npm run verify    # build + data and engine checks (fast, no browser)
npm test          # build + verify + browser smoke test (needs playwright)
```

**Never edit `docs/index.html` by hand.** It is generated. Edit `src/` and rebuild.

Concatenation order is defined in `build.mjs` and matters. HTML partials
(`src/html/menu.html`, `src/html/lines.html`, `src/html/board.html`,
`src/html/progress.html`) are assembled between the shared chrome in
`src/html/head.html` and `src/html/tail.html`; the JS bundle is spliced into
`src/html/tail.html` at the `<script>` seam, in this order:

| File | Provides | Depends on |
|---|---|---|
| `src/core.js` | `F`, `START`, `ix`, `sq`, `fenBoard`, `apply`, piece SVGs, `VAL`, `NAME` | — |
| `src/data/lines.js` | `LINES`, `KIND`, `SRC` | `core` |
| `src/engine.js` | move generation, `make`, `legal`, `san`, `perft`, `fenPos`, `fenOf` | `core` |
| `src/data/pieces-cburnett.js` | `CB` | — |
| `src/data/eco.js` | `ECO` | — |
| `src/data/puzzles.js` | `PZ` | — |
| `src/data/evals.js` | `EVL`, `EVL_PROBE` | — |
| `src/app.js` | state, rendering, input, scheduling | everything above |

Nothing is a module; everything shares one scope. Adding a `const` with a name
already used anywhere else is a silent build break that only shows at runtime.

## Non-negotiable invariants

1. **Every move in `LINES` and `PZ` must be legal**, and the `san` string stored
   next to it must equal what `src/engine.js` produces for that move. `npm run verify`
   enforces this; it also runs perft against the four standard positions.
2. **Every line needs a provenance tag in `KIND`.** The tag is a claim to the user:
   - `game` — a real game score, with a source in `SRC`. Do not add one you cannot
     trace to a published score. Rating pairs and event names you cannot verify are
     worse than no line at all.
   - `book` — a published recommendation, named in the note.
   - `eco` — copied verbatim from the CC0 opening data set; must match it move for move.
   - `theory` — documented theory assembled here.
   - `model` / `synthetic` — written for this trainer. Legal and thematic; nobody
     played them. Never let one drift into being described as theory.
3. **Never claim a mate, a win or an evaluation you have not checked.** There is no
   engine in this project. A "and White is winning" in a note is unverifiable and does
   not belong. If you need to claim mate, write a forced-mate search against
   `src/engine.js` and confirm it, or cut the line before the claim.
4. **Hints must never contain the answer.** `moveClue()` rejects any clue containing
   the move's notation, its origin or destination square, or the piece name. If you add
   clue sources, keep that filter.
5. **Storage keys are versioned** (`colle-hippo:v5`). If the shape of `stats` changes,
   bump the key and migrate, or users silently lose progress. The v3 to v4 bump was a
   deliberate clean reset: positions are keyed by position identity now, not `line:ply`,
   and no remapping was written. The v4 to v5 bump was the opposite — adoption, not reset.
   Records gained an optional `w` (a bounded SAN-to-count map of the wrong moves actually
   played) and the keys did not change, so `load()` reads a v4 blob verbatim and rewrites
   it as v5. `validateImport()` still accepts v4 and unstamped-v4-shaped backups.
   The lichess token lives under its own key, deliberately outside this blob: it is not
   progress, so it must never travel in an export and must survive a Reset.
6. **Persistence order is `window.storage`, then `localStorage`, then memory.** An
   artifact host provides `window.storage` and may forbid `localStorage`; GitHub Pages
   provides neither `window.storage` nor an excuse for losing progress on refresh. Try
   them in that order and degrade to memory-only when both are absent. This relaxes an
   earlier rule that banned `localStorage` outright, which was correct while the only
   target was an artifact host and wrong once the trainer shipped as a hosted page —
   memory-only persistence makes spaced repetition pointless. Never assume either exists;
   the guard stays.
7. **Deliberate-mistake lines must keep `targets:[]`.** The three lines that exist to
   show the user losing (`trap`, `soltis-trap`, `syn-hipdown`) are safe from the
   `targets`-based setup acceptance only because their `targets` array is empty. Give
   `syn-hipdown` a `HIPPO_T` and the app would start crediting setup moves inside a line
   whose entire purpose is to show the setup failing.

## Drift

This codebase has a history of acquiring code nobody wrote: functions referenced but
never defined (`mergeCustom`, `puzzleCount`, `verdict`), UI for features that do not
exist (a PGN import screen, an engine-analysis drawer), and line entries with invented
game attributions. Two defences are in place and both must stay working:

- `test/verify.mjs` fails the build on any call with no definition anywhere in the bundle.
- The app self-checks in the browser: open **Progress** and it replays every line, every
  puzzle and a perft run, reporting pass or fail on screen. A red row there means the
  file you are holding is not the file that was tested.

If you find a feature in the source that is not described in `README.md`, do not assume
it works. Check whether its functions exist, then either finish it or remove it.

The annotation marks stored inside SAN strings (`e4!`, `Nf6!`, `Rf3!?`) are quality
verdicts no engine checked: `test/verify.mjs` strips them before comparing against the
engine's output, so they are presentation only. They are kept deliberately as repertoire
signposts — a policy choice, not an oversight. Do not add a new mark to a move unless
the line's own source uses it.

## Regenerating data

`tools/fetch-assets.sh` downloads the third-party sources into `data-src/` (gitignored,
about 300 MB for the puzzle dump). Then:

```
node tools/build-eco.mjs       # -> src/data/eco.js
node tools/build-puzzles.mjs   # -> src/data/puzzles.js
node tools/build-evals.mjs     # -> src/data/evals.js (local engine; see below)
npm run verify
```

`tools/build-puzzles.mjs` replays its output through `src/engine.js` before writing, so a
corrupt download fails loudly rather than shipping. `tools/build-eco.mjs` does **not** load
the engine — it string-matches SAN against the TSV, so a truncated download yields fewer
opening names silently rather than failing. Check the reported count before committing.

Regenerating puzzles is **not reproducible**. The lichess dump is a live snapshot and
`data-src/` is gitignored, so a fresh fetch filters to a different 82 puzzles. The set in
`src/data/puzzles.js` is the artefact; do not rebuild it expecting the same rows back.

### Evaluations (`src/data/evals.js`)

`node tools/build-evals.mjs` computes Stockfish evaluations for every position the
trainer asks the user to move in — one row per unique `keyFen` position, top moves
with SAN, score and depth, a short SAN principal variation for the best move — with a
**local engine**: `sf16-7` from the `lila-stockfish-web` npm devDependency (lichess's
in-browser build of Stockfish 16, linrock's small-net branch; pinned to an exact
version), a 433 KB wasm plus one 6.5 MB NNUE network that `tools/fetch-assets.sh`
downloads into `data-src/nnue/` and checksum-verifies. The build targets browsers;
`tools/build-evals.mjs` drives it headless under Node with three shims (the
`web-worker` package for its pthread Workers, `tools/sf-worker-boot.mjs` for the
`self.location` global those workers read, and a `fetch()` that serves `file://`
URLs for the wasm) and must switch NNUE on explicitly — the build defaults to
classical evaluation. Stockfish and the network are GPL-3.0, the lila build is
AGPL-3.0; all of it is a build-time tool here, like a compiler — nothing from it
ships in the page, only numbers it produced, so the page's own licence is
unaffected. Credit it anyway.

Rules that are not negotiable here:

- Unlike the puzzle dump, this step **is reproducible**: each position is searched
  single-threaded to a fixed depth (currently 20) with the hash cleared first, so the
  same package version at the same depth yields the same table. Worker-process
  sharding only parallelises across positions and does not affect the result. Raw
  engine output is cached under `data-src/local-eval/` (gitignored, keyed by
  engine + depth) so an interrupted run resumes for free.
- Coverage is **complete** — a local engine has no cache misses. If a position is
  missing from the table, that is a bug in the tool, not an absence upstream.
- The previous source was the **lichess cloud-eval API**; its raw responses are kept
  in `data-src/cloud-eval/` (gitignored) as a cross-check. Do not delete them and do
  not reintroduce the network fetch — the endpoint rate-limits too hard to finish.
- **Sign convention**: every stored score is from the **side to move's** point of view
  (positive = good for the player to move; `mate > 0` = the player to move mates).
  UCI scores are already side-to-move relative, but that is asserted, not assumed:
  three probe positions with undisputed assessments (a lost-for-the-mover position
  and two mates-in-one) are analysed first and the run aborts on any disagreement.
  `EVL_PROBE` (the lost-for-the-mover position with its stored negative score) ships
  in the file so a flipped convention fails an assertion instead of shipping. The
  tool self-checks its whole output — SAN against the engine, declared score kinds,
  PV replay, the probe sign — before writing; that block is marked for lifting into
  `test/verify.mjs`.
- Mates are stored as a distinct kind (`"mate"`), never as centipawns; the UI must
  never print one as a pawn count.
- Regenerating requires `npm install` (the engine is a devDependency); building and
  testing the app itself does not touch it.

Piece graphics: `tools/fetch-assets.sh` pulls the Cburnett set; converting them into
`src/data/pieces-cburnett.js` means stripping the outer `<svg>` wrapper and storing the
inner markup keyed by FEN letter (`K`, `q`, …), viewBox `0 0 45 45`.

## Adding a line

Write the moves as SAN, convert with the engine rather than by hand:

```js
// scratch script; see tools/build-eco.mjs for the pattern
let p = startPos();
for (const tok of pgn.split(/\s+/)) {
  const m = legal(p).find(x => san(p, x).replace(/[+#]/g, "") === tok.replace(/[+#!?]/g, ""));
  if (!m) throw new Error("illegal " + tok);
  out.push([uciOf(m), san(p, m), notes[san(p, m)] || ""]);
  p = make(p, m);
}
```

Notes are keyed to the move, not the ply index. Keying by move number and applying by
ply is a bug that has already happened once: annotations land six moves early and look
plausible.

Then add the id to `KIND` (and `SRC` if it has a source), rerun `node tools/build-eco.mjs`
so the line gets its opening name, and `npm test`.

## Style

- Plain ES2020, no build step, no TypeScript, no framework.
- Two-space indent, double quotes in `app.js`, semicolons.
- CSS lives in `src/styles.css`. Rule order matters: `.pc.drag` must come after
  `.pc`, or dragged pieces lose `position: fixed` and pile up at the bottom of the page.
- User-facing prose is British-flavoured, direct, no exclamation marks, and never
  promises more than the code does.

## What is deliberately absent

No engine, no PGN import, no user-added lines, no service worker. Each is a real piece
of work, not a switch — see the end of `README.md`. If you add the engine, the honest
version fetches Stockfish-WASM from a CDN, which ends the offline guarantee; say so in
the UI rather than quietly requiring a network.
