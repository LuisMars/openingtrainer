<!-- W4-C · 2026-09-20 · lane C · audited against commit 598a374 plus the uncommitted src/data/evals.js and src/engine.js in the working tree -->
<!-- Every number here came from node runs against src/core.js + src/data/lines.js + src/engine.js + src/data/evals.js loaded the way test/verify.mjs loads the bundle, graded with gradeMove. Nothing is quoted from GRADING.md without re-running it. -->

# W4-C — Colle (White): dispositions

**Ply convention.** `ply N` = `moves[N-1]` (1-based, as W0-C used). GRADING.md and the lane brief use the 0-based index; so brief's `syn-greek:22` is ply 23 here. Every edit below names the array index too. Scores are centipawns from the side to move, depth 20.

Whole-chapter run: 273 drilled White moves, **best 97, equal 156, concession 17, inferior 2, losing 1**. The two inferior are `ohanlon` ply 33 `Rxd6` (346 behind `Qd3` 943, own score 597, `after: won` — a real game move in a won position, no edit needed) and `syn-ne4` ply 23 (§1b). The one losing is `syn-greek` ply 23. `syn-hipdown` ply 18 `d5` (inferior, 94) is lane D's and is the deliberate mistake doing its job; confirmed, not touched.

## 1. `syn-greek` and `syn-ne4`

### 1a. `syn-greek` — disposition: **delete**

Ply by ply from the fork (all earlier White moves grade best or equal, loss ≤ 16):

| ply | move | row best | own score | verdict |
|---|---|---|---|---|
| 15 | dxc5 | dxc5 9 | 9 | best |
| 17 | e4 | b4 2 | −4 | equal (6) |
| 19 | Qe2 | exd5 −6 | −7 | equal (1) |
| 21 | e5 | **e5 80** | 80 | best; row PV `e5 Nd7 Nb3 Bb6 Bf4 a6` |
| 23 | Bxh7+ | **Nb3 73** (Re1 72, b4 70, Ng5 −50, Bb5 −95) | **−269** (`x`, searched alone) | **losing**, 342 behind, `after: lost` |
| 25 | Ng5+ | Ng5+ −264 | −264 | best, `situation: lost` |
| 27 | Qh5 | Qh5 −263 | −263 | best; PV `Qh5 Ncxe5 Qh7+ Kf8 Qh8+ Ke7` |

What is wrong: nothing before the sacrifice. The line reaches a good position (+73 with White to move) and the sacrifice itself is the error in that exact position. The plan's stated conditions ("knight gone from f6, g5 vacant, the queen's route to h5 clear; miss any one and the sacrifice is a bishop spent on a pawn") are all met and the sacrifice is still a bishop spent on a pawn, so the conditions are wrong, not the move order: the f6 knight was displaced to d7, not removed; the c6 knight and the c7 queen both hit e5; ...Re8 has emptied f8, which is Black's flight square in the table's PV, not a weakness. Compare `ohanlon`, where the f6 knight was exchanged (plies 18–20) before Bxh7+ and the sacrifice grades 0 against +41.

The position before ply 23 is **the same key as `kolt` ply 23** (verified `posKey` equal), where Koltanowski played 12.Nb3 — the row's best. `syn-greek` is therefore `kolt`'s first 22 plies with the losing move bolted on: a repaired line (Nb3 Bb6 Bf4, rows +73 and +77, both already stored because they are `kolt`'s) is `kolt`. Cutting before the claim leaves a 21-ply duplicate of `kolt`. Reframing as a "gift refused" line needs `NO_SHUFFLE` in `src/app.js` (lane A) and a fourth entry in CLAUDE.md invariant 7, and still duplicates `kolt` for 22 plies.

The hedge is not enough. (a) "Engines dispute" is false: the table does not dispute, it rejects, by 342 cp with `after: lost`. (b) `ALT` in `src/app.js` (line 136) is keyed by position and excludes only `NO_SHUFFLE`, so a user drilling **`kolt`** who plays 12.Bxh7+ is told "Bxh7+ is book too — Model: the e5 clamp and the h7 target plays it here", uncredited and ungraded, in a `game` line. (c) The app shows the stored score only after a miss (`good()`), so a user who plays the line's own Bxh7+ never sees the −269.

**Edits for lane E**

1. `src/data/lines.js` line 236: delete the whole `{id:"syn-greek", …}` object. Remove `"syn-greek":"synthetic"` from `KIND` (line 263). No `SRC` entry exists.
2. `src/data/lines.js` line 23 (`kolt`), `moves[22]` (`Nb3`): replace the note `"Tempo on the bishop; the freed c1 bishop comes to f4 next."` with `"Tempo on the bishop; the freed c1 bishop comes to f4 next. Not 12.Bxh7+: the stored analysis puts the sacrifice at -2.69 against +0.73 for Nb3. The knight went to d7, not off the board, the queen and the c6 knight both hit e5, and ...Re8 has left f8 as a flight square. The gift needs the defender gone, not displaced; compare Colle-O'Hanlon, where it had been exchanged."`
3. `research/named-moves.tsv`: append `r1b1r1k1/ppqn1ppp/2n1p3/2bpP3/8/2PB1N2/PP1NQPPP/R1B2RK1 w - - 0 1	d3h7` so the −269 survives a regeneration once Bxh7+ is no longer a repertoire move (it sits in that row's `x` today only because `syn-greek` drilled it).
4. Fixtures that pin the old counts: `test/w2b-grading.mjs` lines 454–460 (`n` 442, losing 3, best+equal 404, concession 30, inferior 5) and `test/ui.mjs` line 296 (`probe("syn-greek", 24, …)` as its lost-position sample; re-point at a constructed lost FEN as `w2b-grading` already does, or at a `syn-h4` position, lane D's). With §1a and §1b applied together the whole-repertoire counts become **n 426, losing 2, best+equal 391, concession 29, inferior 4** (syn-greek removes 4 best, 9 equal, 1 losing; syn-ne4 removes 1 concession, 1 inferior, 1 equal and adds 1 best).
5. `research/COVERAGE-MATRIX.md` lists `syn-greek` in four coverage cells (lines 104, 235, 341 and the two roots); each cell keeps `ck`/`kolt`, so nothing becomes uncovered.

Fallback only if a "gift refused" drill is wanted after all: keep the id, rename `"Model: when the Greek gift fails"`, plan and ply-23 note rewritten around the numbers above, `NO_SHUFFLE` += `"syn-greek"`, CLAUDE.md invariant 7 += `syn-greek`. Not recommended: the lesson is one sentence and now lives in `kolt`.

### 1b. `syn-ne4` — disposition: **repair ply 21, cut 22–25**

| ply | move | row best | own | verdict |
|---|---|---|---|---|
| 17 | Nxe4 | Nxe4 198 | 198 | best; PV `Nxe4 dxe4 Bxe4 cxd4 exd4 Ne7` |
| 19 | Bxe4 | Bxe4 189 | 189 | best |
| 21 | Bxd4 | Qd3 184 = **exd4 184** | 130 | concession (54) |
| 23 | Nxd4 | exd4 118 | 4 | **inferior (114)** |
| 25 | Nf3 | g3 104 | 78 | equal (26) |

The pawn is won at ply 17 as the note says (material after Bxe4: P8 v p7, +1.89). The line then gives most of it back: Bxd4 costs 54 and Nxd4 costs 114, ending at +4. `exd4` at ply 21 grades **best** (loss 0, rank 2, tied with Qd3) — verified with `gradeMove(row, pos, "e3d4")`.

Edits, line 247: replace `moves[20]` `["b2d4","Bxd4",""]` with `["e3d4","exd4","Recapture with the pawn. The b2 bishop keeps its diagonal and d4 is propped again; the stored analysis has White a clean pawn up at +1.84, and its own line from ...Ne4 continues ...Ne7. Nothing from here is forced."]`; delete `moves[21..24]` (`Nxd4`, `Nxd4`, `Qg5`, `Nf3`). Plan: replace `"With no ...Bb7 behind it, Nxe4 dxe4 Bxe4 simply wins a pawn, and the model plays the trades out to the end, where the b2 bishop too has come off and White stands a pawn up with bishop and knight against the two bishops."` with `"With no ...Bb7 behind it, Nxe4 dxe4 Bxe4 wins a pawn, +1.89 by the stored analysis, and the model stops once the pawn is banked with exd4."` Optional extension (`...Ne7` and one more White move) needs `--extra` for the key after 11.exd4 Ne7; not proposed now.

## 2. Inventory claims

Dispositions: **S** supported, **C** contradicted, **U** unverifiable (conditional wording given), **R** remove. Replacement text is the exact new string unless marked "append".

| ref | quote (abridged) | disp | evidence | replacement |
|---|---|---|---|---|
| ck:19 | "sole guardian of h7" | C | board after Qe2: Kg8 and Nf6 both cover h7 | `"E-pawn backed and e5 looming; the c1 bishop still waits at home. e5 evicts the f6 knight and leaves h7 to the king alone."` |
| kolt:21 | "must move and h7 loses its defender" | C | after e5 the knight has Nd7/Ne4/Ng4/Nh5; king still guards h7 | `"The clamp. The f6 knight has to go somewhere and h7 is left to the king; this, not the pawn grab, is the point of e4."` |
| kolt:22 | "Forced retreat." | C | Nd7, Ne4, Ng4, Nh5 all legal; no row (Black to move) | `"The retreat O'Hanlon chose; ...Ne4 and ...Ng4 exist and are not checked here. Black's kingside is suddenly a building site."` |
| kolt:8 | "Same position as the main line" | C | `ck@10 == kolt@10`, `ck@9 != kolt@9`: they meet after 5.Bd3, one ply later | move the note from `moves[7]` to `moves[8]` (Bd3, currently `""`); text unchanged |
| kolt name / :25 | "Dublin 1937", "Black played 13...f6" | S | irlchess page fetched: Dublin, 11 March 1937, match round 3, score matches all 25 plies, `13.Bf4 f6?` | keep; optionally name `"Koltanowski–O'Hanlon, Dublin (match) 1937"` |
| syn-e5colle:16 | "O'Hanlon ... never got another chance" | C | `kolt` is Koltanowski–O'Hanlon 1937 | `"The move the Colle's reputation hangs on, played on time and fully supported. O'Hanlon preferred 8...Re8 at Nice in 1930; a prepared opponent plays this."` |
| syn-e5colle:17 | "Trade at once. Left alone, ...e4 would come with tempo" | C/S | dxe5 −13 is a 44 concession; row best `e4` 31; geometry of ...e4 hitting Bd3 and Nf3 holds | `"Trade at once, or play e4 first, which the stored analysis prefers by 44 centipawns. Left alone, ...e4 would come with tempo on both the bishop and the knight."` |
| ck:1 | "the center never cracks" | U | | `"d4, then e3 and c3: a centre built to hold."` |
| ck:5 | "guaranteed e4 break" | U | | `"Paid in exchange for an e4 break White can usually prepare."` |
| ck:13 | "Castle first. Always." | C | row best `e4` 10, O-O 6 (equal, 4) | `"Castle first; the table has e4 at once level with it."` |
| ck:17 | "Every move since move three existed to make this one good." | U | equal, 6 behind b4 | `"The pivot. The table has b4 and e4 level here; the plan has been e4 since move three."` |
| ck:6 | "the Colle's dream position" | U | row after ...e6: b3 12, Nbd2 11, Bd3 10, all level | `"Black closes in his own bishop. This is the position the Colle is built for."` |
| ck:15 | "wins a tempo on the bishop" | S | dxc5 hits Bd6; best +9 | keep |
| cz:17 | "Every Zukertort game is a referendum on this knight." | U | Ne5 −3, equal (20) | `"The outpost. Whether it holds is the question every Zukertort middlegame turns on."` |
| cz:21, cz plan, cz-tab | "the f6 knight is the last real defender" | U | Rf3 best −4 | `"...the f6 knight is the defender that matters most"` (all three places) |
| anti:7, plan | "e4 will never come with force" | U | c4 best +25 | `"With the bishop outside the chain e4 loses most of its point; take the centre instead."` |
| anti:13 | "e5 outpost survives every version" | C | Ne5 −47, 30 behind Qa4 (edge of noise) | `"The e5 outpost, at the table's edge of the noise band: Qa4 is its choice."` |
| anti:19 | "White has space, the e5 outpost and a plan; Black has traded his good bishop..." | C | row before Qxd3: best Qxd3 **−52**; c5 (ply 11) and f4 (ply 17) were concessions of 32 and 49 | `"White has space and the e5 outpost; the stored analysis has Black half a pawn better, most of it conceded by c5 and f4. The point of the line is the fourth move: 4.c4 is the table's best, and the system move 4.c3 is not."` |
| anti-bg4:11 | "Threatening Nxg6 and h4-h5, winning the bishop pair" | S | Ne5 best 46, PV `Ne5 Nfd7 Nxg6 hxg6` | keep |
| anti-bg4:15 | "bishop pair and space ... king that has not committed" | S | Bg2 best 48; material B2 v b1 n2 | keep; append `" The table has it at about half a pawn for White."` |
| trap:7 | "makes it a corpse" | C | c3 −11, 36 behind c4 (concession, not lost) | `"Autopilot. Not a blunder, a 36-centipawn concession by the stored analysis, and the end of the h7 plan."` |
| trap:10 | "with it the whole point of the opening" | U | no row (Black to move) | `"The attacking bishop is gone, and with it the h7 plan the opening was built around."` |
| trap:18, plan | "faces no attack", "an attack that cannot happen" | U | no row at the end | `"Black has traded off his problem bishop and White has no h7 target left; the position is playable and plain."` / plan: `"...White's system built around an attack the trade took away."` |
| cz-tab:20, plan | "the c-file, always ... never with panic" | U | | `"Black's counterplay runs down the c-file. Meet it with Rac1 or c3."` (plan: `"His counterplay is the c-file"`) |
| cz-tab:22 | "Sadler flags this as the critical move" | U | blog not fetched | `"The linked post treats this as the critical move: ..."` |
| cz-tab:23 | "...Rxc2 would just run into Bxc2" | S | geometry: c-file clear after ...cxd4, Bd3 guards c2 | keep |
| rudel:19 | "Every Zukertort game runs through this pawn." | C | f4 −43, 41 behind Nxc6 (concession) | `"Cement, then attack. The table prefers Nxc6 by 41 centipawns; f4 is the article's plan."` |
| rudel:23 | "Black must find defensive moves while White simply follows a plan" | C | Qxd3 best **−67**: White is worse | `"Queen recaptures onto the h7 diagonal; Rh3 adds a second attacker, and Ng4 comes for the f6 knight. The stored analysis has Black two-thirds of a pawn ahead here, so the plan is a practical bet, not an advantage."` |
| ohanlon:17 | "Threatening e5, forking bishop and knight." | S | e4 best 30; e5 would hit Bd6 and Nf6 | keep |
| ohanlon:20 | "Everything after this is arithmetic." | C | Bxh7+ grades 0 v Bc2 41 two plies later | `"The h7 defender leaves the board voluntarily. The sacrifice is now on."` |
| ohanlon:22 | "Greedy, and the practical turning point." | U | no row (Black to move) | `"Black grabs a pawn while White's three attackers converge; the game turns here."` |
| ohanlon:23 | "The Greek gift." | S/C | 0 v Bc2 41, rank 5 | append `" The stored analysis calls it level, 41 centipawns behind Bc2; the game shows what it does to a defender."` |
| ohanlon:26 | "After 13...Kg8 14.Qh5 Black must hold f7 and h7 at once" | U | no row after 13...Kg8; Qh5+Ng5 do hit both f7 and h7 | `"Refusing to go back. After 13...Kg8 14.Qh5 both f7 and h7 are attacked twice, and whether Black holds is not something this trainer has checked; O'Hanlon ran forward instead."` |
| ohanlon:27 | "the king has no shelter" | S | h4 best **312**, `after: won` | keep |
| eco-kid:8 | "solid position and no attack; play c4 or b3" | C | Bd3 (ply 7) −10, 35 behind c4 25; no row at the end | `"A King's Indian shell against the Colle. The table already preferred c4 to Bd3 a move ago; play c4 or b3 and treat it as a normal game."` |
| eco-gru/eco-ptero:7 | (eco moves, no note) | S | Bd3 concessions 53 and 33; `eco` moves are verbatim, unchangeable | eco-gru ply 8 note: append `" The table puts c4 53 centipawns ahead of Bd3 here."` |
| eco-ptero:8 | "queen's rank stops at Black's own c5 pawn" | S | geometry | keep |
| soltis:9 | "half-opens the c-file and kills that plan" | C | cxd3 6 v Qxd3 **17**: the disparaged move scores higher (equal, 11) | see §3/§4 text |
| soltis-trap plan | "d5 was never loose, the f6 knight covers it" | S | geometry after 6.Qd3; Qd3 best 17 | keep |
| syn-slav:23 | "Now the extra space is real." | U | c4 −3, equal (5) | `"Space, at a level score. Against Slav structures the Colle turns positional rather than sacrificial."` |
| syn-benoni:3 | (2.e3) | S | concession 37 v d5; note already justifies | append `"; the table prefers 2.d5 by 37 centipawns"` |
| syn-benoni:5 | "Qxd4 would meet ...Nc6 with tempo" | S | Qxd4 −7 v exd4 25 (32 behind) | keep |
| syn-benoni:21 | "the defence costs Black a move" | C | Qb3 **−58**, 32 behind Nf1 (scored) | `"What the active bishop left behind: b7. The queen hits it and d5 at once; the table prefers the quieter Nf1 by 32 centipawns, so this is a practical try, not a win of tempo."` |
| syn-ne4:17, :25, plan | "the pawn will simply hang", "a pawn up" | S | +198, material P8 v p7 | plan/notes per §1b |
| syn-qf3:23 | "the exchanges on e4 end with Qxe4 and a pawn in hand" | U | no row after 12.Qf3 Ne4 or after Nxe4 dxe4; material P8 v p7 only if Black recaptures each time | `"If Black jumps a knight into e4 now, take it at once: with the queen on f3 as a third attacker the exchanges can end with Qxe4 and a pawn, if Black takes back each time. The companion line on ...Ne4 has that structure checked; this one does not."` |
| syn-qid:21, plan | "the companion lines take at once only because there the capture wins the pawn outright" | S | syn-ne4 Nxe4 198; here Nxe4 17 v Qe2 12 (equal) | keep; append to ply 21 `" The table has Nxe4 and Qe2 level here."` |
| syn-qid:23 | (Rf3) | C | Rf3 −31, 45 behind Nxd7 | append `" The table prefers Nxd7 by 45 centipawns."` |
| syn-dutch:16, :23 | "lives or dies by ...e5", "must move again" | U/S | Nd5 best 41, cxd5 best 145 | `"...the Leningrad's whole plan is ...e5."`; ply 23 keep (Nc6 is attacked by the d5 pawn) |
| syn-dutch:21 | "Nxc7 forks queen and rook" | S | Qe8, Ra8, knight on c7 hits both; Nd5 best 41 | keep |
| syn-clamp:11, :25 | "the diagonal it lives for", "never really left" | S | Bc2 0 v Be2 8; Bxe4 best 44 | keep |
| colle-kid plan | "the h7 plan is dead" | U | | `"Against ...g6 the h7 plan has no target"` |
| colle-kid:15 | (Nc3, not in inventory) | C | Nc3 −27, **61** behind dxe5 34 | append to the ply-14 note `" The table wants dxe5 at once, 61 centipawns ahead of Nc3."` |

Counts over the 51 rows: **S 16, C 16, U 16, R 0**, plus three mixed rows (syn-e5colle:17 C/S, ohanlon:23 S/C, syn-dutch:16/:23 U/S). Nothing is removed outright; every absolute becomes a condition or a number.

## 3. Annotation marks (8)

| ref | mark | source uses it? | number | disposition |
|---|---|---|---|---|
| ck:17 | `e4!` | unverified (Wikipedia) | equal, −4 v b4 2 (6) | keep as signpost; not embarrassed |
| kolt:21 | `e5!` | irlchess page fetched: no mark on 11.e5 | best, 80 | keep as signpost; supported by the table |
| ohanlon:23 | `Bxh7+!` | 365chess, unannotated | concession, 0 v Bc2 41, rank 5 | **drop**: `["e4h7","Bxh7+", …]`; the ply-39 note already says soundness is argued and §2 adds the number |
| anti:7 | `c4!` | unverified | best, 25 | keep; `src:"4.c4! leave the system"` keep |
| colle-kid:7 | `b3!` | `model`, no source possible | concession, −10 v c4 25 (**35**, verified) | **drop**: `["b2b3","b3", …]` |
| anti-bg4:7 | `h3!` | unverified | equal, 18 v c4 29 (11) | keep |
| rudel:21 | `Rf3!?` | article fetched: `11.Rf3!??!` | equal, −60 v c4 −48 (12) | keep `!?`; the only mark here with its source's mark behind it |
| soltis:9 | `cxd3!` | forum relay, unreachable | equal, 6 v Qxd3 17 (11) | **drop** from SAN and from `src`; the note now states the number (§4) |

## 4. Provenance

- **`soltis`** (line 205). `src` → `"5.cxd3, attributed to Soltis in a chess.com thread"`. `SRC.soltis` unchanged: the forum URL is the source actually consulted, and the honest entry. Ply-9 note → `"The recapture a chess.com forum thread attributes to Soltis; the book was not consulted here. Qxd3 invites ...Ne4 and ...f5; taking with the c-pawn half-opens the c-file. The table puts Qxd3 11 centipawns ahead, inside the noise band, so this is a structural preference, not a refutation."` Plan: `"Soltis's recapture"` → `"The recapture attributed to Soltis"`. `KIND` stays `book` (a named published recommendation, reached second-hand and now labelled so).
- **`soltis-trap`** (line 214). `src` → `"why 5.Bxf5 misfires, after a thread citing Soltis"`. Ply-8 note → `"The reply the same thread attributes to Soltis for Black: keep the bishop, decline the trade."` `SRC` unchanged.
- **`rudel`** (line 191). The cited chess.com article was fetched: byline is the member **"Zukertort"**, first person (`"I originally suggested 8.Ne5 here … 10.f4 Nb4 11.Rf3!??!"`), and it names neither David Rudel nor *Zuke 'Em*. The page may or may not be Rudel's; it does not say. `name` → `"Zukertort: the early Ne5 and Rf3"`; `src` → `"chess.com quick-start article, byline 'Zukertort'"`; ply 15 `"Rudel's sharp option"` → `"The article's sharp option"`; ply 21 `"Rudel lets the bishop go: the book's bet is"` → `"The article lets the bishop go: its bet is"`; plan `"Rudel's order"` → `"The article's order"` and `"the book's bet"` → `"the article's bet"`. Keep id `rudel`, `KIND` `book`, `SRC` unchanged.
- **`kolt`** — now verified first-hand against the cited page (§2 row); no change.
- **`ohanlon`** — 365chess not reachable; score is the well-known game. Unverifiable, no change.

## 5. Coverage gaps (W1-C §1–2), proposals

Stopping criteria from W1-C §5: breadth to ply 8, stop where two pools drop under 30 parent games (ply 11 on the main line), end at a decision, transposition gets a pointer not a line, no new depth without a row.

| gap | proposal | teaches | depth | stored rows today | analysis needed |
|---|---|---|---|---|---|
| **1...e6** (14.4% player) | new `theory` line `c-1e6`: 1.d4 e6 2.Nf3 d5 3.e3 Nf6 4.Bd3 (rejoins `ck@6`), with the ply-2 note doing the work: after 2.Nf3 Black can still play ...c5 (→`ck@8`), ...b6 (→`syn-qid`), ...f5 or ...Bb4+ | what White does before Black declares; 2.Nf3 is the row's joint best (31 with e4) | 7 plies, then a pointer to `ck` | after 1...e6: yes | `--extra` for the keys after 1.d4 e6 2.Nf3 c5, 2...b6, 2...f5, 2...Bb4+ so the note can name them |
| **4...Be7** (16.6% pgnmentor) | new `theory` line `c-be7`: 1.d4 d5 2.Nf3 Nf6 3.e3 e6 4.Bd3 Be7 5.O-O O-O 6.Nbd2 Nbd7 7.b3 b6 (the row's PV) | with no ...Bd6 there is no h7 mechanism and no ...Bxh2 threat either; the row's own preference is the Zukertort build, not c3/e4 | 13 plies, end at the b3/c3 fork | after 4...Be7: yes (O-O 8, Nbd2 7, Qe2 7, b3 6) | `--extra` for every White-to-move key after ply 8 |
| **2...Nc6** (15.8% player) | new `theory` line `c-2nc6`: 1.d4 d5 2.Nf3 Nc6 3.e3 (row: c4 45, e3 43, equal) Bg4 4.Be2 or 4.c4 — the choice is the line | ...Nc6 blocks ...c5, so the Colle's c3/e4 plan changes; ...Bg4 and ...e5 are the threats | ~9 plies, end at White's 4th-move fork | after 2...Nc6: yes; after 3...Bg4: no | `--extra` for keys after 3.e3 Bg4 and 3.e3 Nf6; also the door 3...Nc6 (`rnbqkb1r/…/2n2n2` key, no row) |
| **KID 4...O-O** (57% at node) | extend `eco-kid` cannot (eco is verbatim); new `model` line `c-kid-oo`: 1.d4 Nf6 2.Nf3 g6 3.e3 Bg7 4.Bd3 O-O 5.O-O d6 6.c4 or 6.b3 | the repertoire's actual answer to a completed KID shell; Bd3 was a 35 concession at ply 7, so the line must say c4/b3 is the plan | 11 plies to the c4/b3 decision | after 4...O-O: **no row** | `--extra` for all six White-to-move keys |
| **1...d6** (4.7%) | one-line pointer, not a line: note on `eco-kid` ply 8 naming `1...d6 2.Nf3 Nf6 3.e3 g6 4.Bd3 Bg7` as the same terminal position; real coverage comes from `c-kid-oo` above | | 0 new plies | after 1...d6: no row | none until `c-kid-oo` exists |

Also cheap and already scored: **3...Bb4+** (row: Nbd2 40, c3 35, Bd2 23) — a two-ply pointer note on `eco-trad` ply 9 can now say Nbd2 is the table's answer; **1...e5** (dxe5 105) — a note, not a line, until a forced search backs any refutation claim.
