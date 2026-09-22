# The Triangle & the Swamp — implemented features

This file lists what the trainer does today. Every line points at code that exists
in `src/` or in `test/`. See `CLAUDE.md` for the rule that governs this file, and
`TICKETS.md` for the work that is still open. `README.md` gives the counts of lines,
positions and puzzles; this file gives none. Every line was checked against the
code on 2026-09-22.

**Words used in this file.** A *line* is one stored sequence of moves with a
provenance tag. A *position* is one board with the side to move; two lines that
reach the same board share one position. A *drill ply* is a move in a line that the
learner must play. *The table* is the stored engine analysis (`src/data/evals.js`,
Stockfish 16 at depth 20); *the deep table* is the second search at depth 28
(`src/data/deep.js`). A move is *in the system* when it is the line's move, a move
that another line of the same chapter and side plays from that board, or a
formation move that the setup rule credits. A position is *solid* when the learner
answers it well enough to leave it alone for a long time. A position is *due* when
its review interval is over. A *level* is a group of positions by move number.
*Study*, *Drill*, *Shuffle* and *Tactics* are the four board modes. The two
*chapters* are "Colle as White" and "Hippopotamus as Black". The text is ASD-STE100.

## Choose what to train

- The menu has five cards: Shuffle drill, Study a line, Drill a line, Tactics and Progress.
- The menu shows four counts: untouched positions, solid positions, due positions and answers today.
- The menu shows the learner's level, its move range and how many of its positions are solid.
- The line list puts the lines in groups by chapter.
- Each row in the line list shows the line name, a bar of solid positions, a count and the provenance tag.
- The menu footer tells what each provenance tag (`game`, `book`, `eco`, `theory`, `model`, `synthetic`) claims.
- The board turns so that the learner's side is at the bottom. The learner can turn it back in the options.

## Move the pieces

- The learner drags a piece or taps the start and end squares.
- A selected piece shows dots on its legal squares. The board marks the last move.
- The board is keyboard-operable. The arrow keys move a cursor, Enter or Space selects and plays, and H asks for a hint.
- A pawn that reaches the last rank opens a chooser for the four pieces. The trainer compares the full move, with the promotion piece.
- A tray under the board shows the captured pieces and the material difference.

## Study

- The learner steps through a line with buttons: start, back, play, forward and end.
- The play button steps through the line automatically. The arrow keys also step when the board does not have focus.
- The note panel shows the note of the last move, the source, the provenance tag and the opening name.
- The Notation panel lists the moves. A tap on a move goes to that move.
- The Middlegame plan panel shows the plan of the line.
- The learner can play any legal move off the line. An "Off book" bar shows those moves and has a Take back button.
- Study grades nothing and draws no answer arrows.

## Drill a line

- The learner plays one line from the first move, from memory. The trainer plays the opponent's replies.
- The note on the learner's move stays on screen after the reply, with the name of its move.
- The two Black defence lines in the Colle chapter have a first drill ply (`drill` in `src/data/lines.js`). The trainer plays the moves before it (`yourTurn` in `src/app.js`).
- The Notation panel hides the moves that the learner did not reach.
- The Middlegame plan panel shows only when the line is complete.
- The controls are Back one, Hint, Restart and, at the end, Next line.
- A position counts once for each pass through the line. Back one and Restart do not grade it again.
- A complete line shows the first sentence of its plan and offers another line or Study.

## Shuffle

- Shuffle serves one position from any line. It picks the position by weight, not in order.
- Shuffle does not serve the same position two times in a row.
- Before an answer, the note shows only the chapter, the side to move and the opponent's last move.
- Shuffle does not serve a defence-line position before its first drill ply (`drillPlies` in `src/app.js`). The Hippopotamus lines own the Black positions of the opening.
- A Black-to-play position from the Colle chapter shows the label "Colle chapter · defending as Black" (`chapterLabel` in `src/app.js`).
- Shuffle shows the line name after a wrong try or a hint.
- After an answer, Shuffle shows the line, its source, its tag, the last moves, the move note and the opponent's reply.
- A move with no note gets a generic "In general" sentence. The trainer labels it so it cannot look like the line's own note.
- After a clean answer with no note, Shuffle goes to the next position after 850 ms. A tap goes on at once.
- After a miss or a note, Shuffle waits for a tap. An open panel also stops the automatic advance.
- A Skip button serves a different position with no grade.

## Tactics

- Tactics serves puzzles from the lichess puzzle database, each linked to its lichess page with its rating.
- The puzzle starts after the opponent's first move, and the note names that move.
- The next puzzle is a missed one first, then an unseen one, then a solved one.
- A wrong legal move in a puzzle counts as a miss.
- A solved puzzle goes to the next one after 1.5 s.
- Tactics shows no table numbers, no plan and no position details.

## How a move is graded

- An illegal move costs nothing.
- The table judges a move by its distance from the table's first choice, never by its rank.
- Up to 30 centipawns behind is equal. Up to 70 is a concession. More is inferior. The trainer accepts only best and equal moves.
- A sound move is credited only when it is also in the system.
- A sound move from another opening gets "sound, but it is not a Colle move here" (or a Hippopotamus move). It costs nothing and the question stays open.
- A move that another line of the same chapter and side plays from this board is book, not a miss. Drill names that line, and the learner tries again. Shuffle changes to that line and credits the answer.
- A sound formation move gets "builds the setup too". Drill asks for the line's move. Shuffle credits it and shows the learner's own move.
- The setup rule refuses a formation move where the first choice in the table is not a formation move. At a deep-checked position, both depths must agree before it refuses.
- A concession is refused, and the message gives its price.
- A move that the table did not search is unanalysed. Unless the material search blames it, it costs nothing: no miss, no broken streak and no spent hint. The message says so.
- At a deep-checked position a move gets the better of its two verdicts. When the depths disagree, the message gives both numbers.
- Mates come before the centipawn bands. A move that allows mate is losing. A move that misses a mate is inferior.
- A move that throws away a won position is inferior. A move that makes the position lost, when the first choice does not, is losing.
- In a lost position the best defence is not called a rescue. A mate always shows as a mate, never as a pawn count.
- Three lines have a repair ply: `trap`, `syn-hipdown` and `def-ohanlon`. There the trainer refuses the line's move. An accepted move gets "Repaired" ("Accepted" in `def-ohanlon`), and then the line plays its own move.
- The deliberate-mistake lines (`trap`, `soltis-trap`, `syn-hipdown`) and `def-ohanlon` stay out of Shuffle, out of the book check and out of the setup credit.
- A sound move off a deliberate-mistake line gets no credit, so the lesson of the line stays.

## Feedback and hints

- Hint has three steps: a clue, the piece and its square ("Move the knight on g1."), and Show me.
- When no clue exists, the first step is "Which piece".
- A clue comes from the move's note, from a fact of the position (capture, check, recapture, castling, promotion) or from a generic plan sentence.
- The trainer refuses a clue that contains the move, its start square, its end square, the piece name or castling.
- The first two hint steps give no streak gain and no miss. Show me counts as a miss and draws the move as an arrow.
- A wrong move that counts as a miss gets the same clue as the first hint step, and that step is then spent.
- For a move that the table did not search, a material search looks four plies deep.
- The material search blames the move only when at least one pawn of material does not come back, or when it finds a forced mate.
- A refutation names only the opponent's reply. The trainer hides a refutation that names the wanted move or its squares.
- The material search runs in a Web Worker that the page builds from its own script. The page fetches nothing for it.
- When a worker is not ready after 8 s, the search runs on the page's own thread with a smaller node budget.
- A worker that starts slowly stays alive. When it is ready, the material search runs in it again (`matLate` in `src/app.js`).
- After a miss, the correct answer shows the table's first choice, the score of the line's move and the table's line.
- A common mistake is a move that players at the selected rating band often chose, that no line plays, and that the table grades a concession or worse.
- A refused common mistake shows how often players chose it.
- After an answer in Shuffle, the trainer names the most common mistake at that position, with its count and its cost.
- The Position details panel shows how often the position occurs, the table depth, the gap between the top two moves and the number of accepted moves.
- After the answer the panel also shows the plan, the move note, the table's first choice with its expected reply, and the common mistakes.
- In Shuffle the panel shows the source of the line only after the answer.
- The panel shows a threat when a free move for the opponent gains at least 150 centipawns, or mates.
- Before the answer, the panel hides every row that names the move, its squares or its piece. It hides a threat that touches the squares of the answer.
- Arrows on the board repeat what the note says. A key under the board names each arrow type.
- While the question is open, the only arrows are the refused move and the reply that punishes it.
- Answer arrows show in Shuffle, at a repair ply and at the end of a Drill line.
- After the answer, the arrows show the first choice in the system, up to two other accepted moves, the refused move and the expected reply.
- Except at a repair ply, the trainer never draws an arrow for a sound move that is outside the system.
- Arrows that start on one square and go in one direction are drawn side by side (`drawArrows` in `src/app.js`).

## Scheduling and progress

- Each position keeps a record of right answers, misses, streak, last time and answer time.
- The review intervals are 0, 4, 24, 72, 168, 336, 720 and 1440 hours, by streak.
- The record keeps a rolling average of the answer time. An average under 7 s is quick.
- A slow position gets 40% of the interval and cannot be solid.
- A position is solid when its streak is two or more, its time is quick and it is not due.
- With "Solid needs a second good move" on, a position with two or more accepted moves in the system needs two different correct answers.
- The record keeps up to three different correct answers and up to five different wrong moves.
- Shuffle weights: due 3, new 2.2, learning 1.6, solid 0.2.
- Shuffle adds weight for a slow answer, for each miss (up to four) and for a structural break position in a Black line.
- A new position that is not the next untouched one in its line gets less weight. Before the occurrence and level factors, a new position keeps more weight than a solid one.
- When a position is due, every position that is not due gets a tenth of its weight.
- With "Favour positions that come up" on, the weight of a position changes by 0.55 to 1.5 with how often players reach it. A position with no count stays at 1.
- The occurrence counts come from lichess rated games of January 2014, in three rating bands.
- The occurrence weight and the level weight never change a due position.
- A level is one of five move ranges: 1–3, 4–5, 6–7, 8–10 and 11 onwards. A position takes the lowest move number at which a line reaches it.
- A level is cleared when 80% of its Shuffle positions are solid. The learner's level is the first level that is not cleared.
- With "Favour your current level" on, Shuffle doubles the weight of the current level and cuts deeper levels to 0.6, 0.4, 0.3 and 0.2.
- The Progress screen shows solid, seen and accuracy counts.
- The Progress screen shows each level with its bar, and each line with its bar.
- The Progress screen lists the five weakest positions. A tap opens that position in Study.
- A weak position names the wrong move the learner played most often, when the learner played it two times or more.
- The Progress screen runs a self-check: perft to depth 3 from the start, a replay of every line and puzzle, and a check of every move label.
- A failed self-check shows a red row and the error bar.

## Options

The options sheet opens from the ⋮ button on the board screen.

- Flip board.
- Show target squares: the formation of the line shows as faint pieces on empty squares.
- Board colours: Brown, Blue, Green or Slate.
- Piece set: Standard (Cburnett) or Engraved.
- Drill book lines only: Shuffle and the levels skip `game`, `model` and `synthetic` lines.
- Favour positions that come up.
- Counted at ratings: under 1500, 1500–1899 or 1900 and over. The default is 1500–1899, where most counted games are.
- Solid needs a second good move.
- Favour your current level.
- Arrows on the board.
- The trainer stores every option except Flip board and Show target squares.

## Storage and privacy

- The trainer stores progress in `window.storage`, then in `localStorage`, then in memory.
- In memory only, or after a failed write, the menu says that progress stops when the tab closes.
- The storage key is `colle-hippo:v6`. The trainer reads a v5 or v4 record without change and writes it again under v6.
- When storage holds data that the trainer cannot read, the trainer writes nothing. The menu says so, and Import or Reset releases the hold.
- Export writes the progress and the options as JSON into a text box.
- Import checks the whole backup before it changes anything. It refuses a bad shape and every counter that is not a non-negative number.
- Import accepts v4, v5 and v6 backups. It refuses a v3 backup with a message.
- Import removes wrong-move and answer entries that are not moves.
- Reset needs two taps. It keeps the options.
- The lichess token has its own storage key. Export does not include it, and Reset does not remove it.
- The error bar says whether progress is saved.

## Network

- The trainer makes no network request without a lichess token.
- The learner pastes a token on the menu. Save sends one test request to `explorer.lichess.org` and stores the token only when lichess accepts it.
- With a stored token, Study shows a Masters database panel for lines that start from the start position.
- The open panel sends one request for each new position. It keeps each answer for the rest of the session.
- The token goes only in the request header, never in the URL.
- The panel escapes all text from lichess and converts all counts to numbers.

## Offline single file

- The trainer is one HTML file, `docs/index.html`, built from `src/`.
- The file holds the fonts, the piece graphics, the lines, the puzzles and the engine tables.
- The page runs no chess engine. Move quality comes only from the stored tables. The material search counts material only.
- The page respects the reduced-motion setting of the system.
