# TICKETS

The single list of open work for the trainer. Bugs and features together.

## How this file works

* This file holds every open ticket. There is no other tracker.
* A ticket exists once. Before you add one, search this file. Do not add a
  second ticket for the same defect under a different name.
* When work ships, **delete the ticket**. Do not tick it, do not strike it
  through, do not move it to a "done" section. Git history is the record.
  What shipped is described in `FEATURES.md`, written in the same change.
* A ticket names the files it touches, says how it is verified, and states
  what "done" means.
* A ticket that needs the owner's decision goes under "Needs a decision"
  and stays there until they answer. Do not guess the answer.
* The evidence behind past work (measurements, counts, sources) is in
  `TASK-LEDGER.md` and `research/`, not here.

Prefix key: **BUG** a defect · **FEAT** new behaviour · **CHORE** upkeep ·
**DEBT** design debt · **VERIFY** something a person must look at.

---

## Needs a decision

**CHORE — Book moves are credited without grading.** 21 moves that another
line plays from the same board are concessions or worse by the table (for
example `ohanlon:22`, `anti:16`, `colle-kid:6`). The in-system rule credits
them because they are repertoire moves; a strict "sound and in the system"
rule would mark them as misses. Files: `src/app.js` (`altAt`, the book
branch in `playMove`). Verified by a UI check at one of those boards. Done
when the owner has chosen, and the code and README match the choice.

---

## Bugs

**BUG — Stay inside the learner's system: Colle as White, Hippo as Black.**
The owner's rule (2026-09-22): "We're playing the Colle system and the
Hippo, not all should be accepted." The in-system rule shipped in `5858f8a`,
but it is not complete:
- **Defence lines take over Hippo boards.** Owner report with a phone
  screenshot: Shuffle showed "Black to play · Colle as White · Defending the
  Koltanowski clamp" after 1.d4, and "none of the basic hippo moves are
  valid". `def-kolt` and `def-ohanlon` are Black lines in the Colle chapter,
  so their opening boards are served in Shuffle and only the game's ...d5 is
  in the system there. Their lesson is the defence (10...h6, the Greek-gift
  defence), not O'Hanlon's opening. Proposed: drill a defence line only
  from the ply where the defence starts, let earlier plies play themselves,
  and never label a Black-to-play board "Colle as White".
- **Still to check on a phone:** Colle move 1 answered (arrows for d4 and
  Nf3, none for e4); 1.e4 refused as "not a Colle move here"; the
  Rhamphorhynchus 1.Nf3 order credited; an out-of-order Hippo wall move
  credited; the `h-nf3bc4` castling arrow over the e8 king.
Files: `src/data/lines.js` (a first-drill-ply field on the defence lines),
`src/app.js` (`drillPlies`, `inSystem`, the chapter label), `test/ui.mjs`.
Verified by a UI check that Shuffle serves no `def-*` board before its first
drill ply, that ...g6 after 1.d4 is credited in Shuffle, and by the phone
checks above. Done when a Hippo player never has a Hippo move refused
because another chapter's line owns the board, and the phone checks pass.

**BUG — Two accepted moves from one square draw overlapping arrows.** For
example ...d6 and ...d5 from d7: the shorter arrow sits inside the longer.
Files: `src/app.js` (`drawArrows`), `src/styles.css`. Verified by a UI check
that no two drawn arrows share a start square and a direction without an
offset, and a phone-width screenshot. Done when both arrowheads and shafts
are distinct.

**BUG — README states things the code does not do.** Found while writing
`FEATURES.md` against the code:
- Stale counts the build does not check: "All 829 moves across the 51 lines"
  (79 lines now), "Of the 425 trainable positions, 420…" (605 drill plies),
  `data/deep.js` "116 narrow drilled positions" (128).
- It says perft runs "inside the shipped file in a browser" on four
  positions; the in-browser self-check (`selfTest`) runs only perft(start, 3).
- Limits says engine numbers appear only after a wrong answer; the Position
  details panel and the common-mistake note show centipawns without one.
- The masters panel: the token field is on the menu under "Masters database",
  not "in Settings"; answers are cached for the session (`libCache`), not
  fetched each time; Save sends the token to lichess once before storing it.
- "Book elsewhere … nothing recorded": Drill logs the move in the answer log
  (`noteWay`), which counts toward "Solid needs a second good move".
- The options paragraph names 5 of the 10 options.
Files: `README.md`, possibly `test/verify.mjs` (to check the counts).
Verified by comparing each claim with `FEATURES.md` and the code. Done when
every claim above is true, and the counts are either checked by the build or
removed.

**BUG — The material worker can miss its start-up window under load.** At a
load average above 20 the worker misses its 8 s start-up and the app falls
back to the main thread. That is safe, but 16 verdicts stay silent, and the
UI check "ohanlon:28 g4 … in the worker" can fail. Files: `src/app.js`
(`matWorker`, `matAsk`), `test/ui.mjs`. Verified by the UI suite on a loaded
machine. Done when a slow start-up no longer loses the worker, or the check
waits for it without a wall-clock limit.

---

## Features

**FEAT — Lines for the 1...d6 move orders against 1.e4.** Ranked in
`research/W6-content-batch.md`: 2.f4 5.25%, 2.Bc4 5.16%, 3.Bd3 4.50% and
the rest listed there (reach at 1500–1899). They matter to a learner who
answers 1.e4 with 1...d6. Files: `src/data/lines.js`, regenerated
`src/data/*.js`, stated counts. Verified by `npm test` and the coverage
matrix. Done when each listed order has a line whose drilled moves grade
best or equal and are in the system.

**FEAT — Forcing replies still not drilled.** ...Qb6 in the b3 window,
...Ne4 in the c3 structure, 2...Bb4+ after 1.d4 e6 2.Nf3 (W1-C §3). Files
and checks as above. Done when each has a line or a recorded reason why not.

**FEAT — The rest of the coverage gaps.** 219 replies in
`research/COVERAGE-MATRIX.md` have no line. Take them in the order the
matrix ranks them, in batches. Done per batch as above.

---

## Debt

**DEBT — Two depth-28 disagreements in the new lines.** `c-englund` 4.Nf3
and `c-2bg4` 5.cxd5 are not one-move positions at depth 28. No note claims
they are. Files: `src/data/lines.js`. Verified against
`research/deep-checks.tsv`. Done when `test/verify.mjs` rejects an "only
move" note at a board the depth-28 check contradicts, or when this ticket is
judged not worth a check and deleted.
