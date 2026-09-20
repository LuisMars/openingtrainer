<!-- W4-D · 2026-09-20 · lane D. Every score below was read from the built bundle (docs/index.html, rebuilt from src/ first) through gradeMove / setupGate exactly as test/verify.mjs loads it; every frequency from research/freq-hippo-*.json. Nothing is quoted from memory. Scores are centipawns, depth 20, from Black's (the mover's) view: -50 means White is half a pawn better. "loss" is centipawns behind the row's best entry. -->

# W4-D — Hippopotamus (Black): dispositions

Change-list for lane E. Nothing here has been applied. Files touched by the edits: `src/data/lines.js` only, except §3's last two rows (`src/app.js`, lane A) and one README row (§1).

**The Black half as graded today** — 169 drilled Black moves: best 55, equal 96, concession 13, inferior 3, losing 2. The 18 outside `accept`, so lane E sees them in one place:

| line | ply | move | loss | verdict | row's first choice |
|---|---|---|---|---|---|
| syn-h4 | 14 | Nbd7 | 256 | **losing** (-353, `after:lost`) | Qd7 -97 |
| syn-h4 | 16 | a6 | 186 | **losing** (-324, lost) | c5 -138 |
| syn-h4 | 12 | e6 | 84 | inferior | O-O -25 |
| syn-h4 | 20 | Bb7 | 111 | inferior | b4 +19 |
| syn-hipdown | 18 | d5 | 94 | inferior (the deliberate mistake, correctly) | Bxf3 -13 |
| syn-hiph5 | 20 | Ne7 | 60 | concession | Bh6 -48 |
| syn-london | 14 | b6 | 52 | concession | e5 +31 |
| syn-london | 10 | e6 | 45 | concession | e5 0 |
| eco-rat | 4 | d6 | 42 | concession | d5 -24 |
| syn-english | 10 | b6 | 41 | concession | d5 -34 |
| syn-hipdown | 10 | b6 | 40 | concession | Nd7 -50 |
| hip-e5 | 16 | Nd7 | 39 | concession | Ne7 -56 |
| hip-e5 | 14 | Bb7 | 38 | concession | Ne7 -61 |
| syn-hiph5 | 16 | Rxh5 | 38 | concession | Qh4+ -14 |
| syn-hipc5 | 22 | e5 | 38 | concession | exd5 -25 |
| hip-g16 | 8 | e6 | 37 | concession (game move; the tag supports it) | Nf6 -36 |
| syn-english | 4 | Bg7 | 37 | concession | c5 -20 |
| hip-g16 | 22 | Qe8 | 31 | concession (game move) | d5 -34 |

`hip-150`'s `Ne7` (ply 14) is **equal**, 18 behind `h5`, as GRADING.md's addendum says; it is not in this table.

## 1. `syn-h4` — disposition: cut to ten plies, reframe, and stop calling the rest a model

Ply-by-ply, Black's turns (all depth 20):

| ply | move | score | loss | verdict | first choice | what the table says |
|---|---|---|---|---|---|---|
| 8 | h5 | -54 | 13 | equal | Nf6 -41 | ...h5 is a fair answer, not the required one; the engine meets h4 with pieces |
| 10 | Nf6 | -37 | 0 | best | — | fine |
| 12 | e6 | -109 | 84 | inferior | O-O -25 | **this is where it goes wrong**: ...e6 walks into the Bg5 pin with the queen behind it; castling was the move |
| 14 | Nbd7 | -353 | 256 | losing | Qd7 -97 | the position was already -97 after 7.Bg5; ...Nbd7 turns it into a lost one |
| 16 | a6 | -324 | 186 | losing | c5 -138 | White's stored 8.Qd2 gave back 215 cp (Black's best went from -353 to -138); ...a6 throws it away again |
| 18 | b5 | -82 | 0 | best | — | White's stored 9.O-O-O gave back another 242 cp (-324 to -82) |
| 20 | Bb7 | -92 | 111 | inferior | b4 +19 | after 10.Bb3 Black is **better** with ...b4; the line plays the slow move instead |

So the trouble starts at ply 12, not 13, and the line only "works" because White's synthetic moves 8.Qd2, 9.O-O-O and 10.Bb3 each hand back what Black gave. Four of the six drilled moves after ...Nf6 are rejected, two of them losing, and the finish it is built to show (the queenside attack against O-O-O) is reached through a position that was lost. The plan's absolutes ("a pawn on h4 it cannot leave", "the pin has nothing to lean on") are the prose of that same fiction: the pin has everything to lean on, by 256 cp.

**Can a `synthetic` "model" with rejected moves stay a model?** No. `Model:` in the name is a claim that the moves are the ones to copy; a line whose own drilled moves grade `losing` against the shipped table is teaching the user the mistake. Either every drilled move in a line called a model grades `accept`, or the word comes off.

**Recommendation: cut before the claim** (option 3). Keep plies 1–10, where every drilled move grades `best` or `equal`, and rewrite the prose so it promises only what those ten plies show. Repairing (12...O-O and onward) would need fresh `--extra` rows for every Black turn after ply 11 and a fresh choice of White moves; it is a new line, not an edit, and is listed as a follow-up in §6.4. Deleting loses the one drill for a timing-bound idea W1-D §3.1 says to keep.

Exact replacement for the whole `syn-h4` entry in `src/data/lines.js` (`KIND` stays `synthetic`, `targets:[]` stays):

```
{id:"syn-h4", ch:"Hippopotamus as Black", you:"b", name:"Model: meeting the h4 lunge", src:"constructed model", plan:"The early lunge asks a question before the wall is up, and this line drills one answer: ...h5 at once, keeping the h-file shut at the price of a pawn on h5 that will want minding later. The knight then takes f6 and the rest of the setup waits on what White does. The line does not claim ...h5 is forced; the engine's first choice is ...Nf6, meeting h5 with pieces. It drills ...h5 because it keeps the position quiet and the plan familiar. A good version has the file closed and normal development; a bad one builds the wall as if h4 had not been played and finds out what the h-pawn was for.", start:START, targets:[], moves:[
 ["e2e4","e4",""],["g7g6","g6",""],["d2d4","d4",""],["f8g7","Bg7",""],["b1c3","Nc3",""],["d7d6","d6",""],
 ["h2h4","h4","The lunge. White wants h5 before you are organised, and the full crouch waits until that question is answered."],
 ["h7h5","h5","One answer, and the one this line drills: the file stays shut. The engine rates ...Nf6 a shade higher, so this is a choice, not a rule; the pawn now fixed on h5 will need looking after."],
 ["g1f3","Nf3",""],
 ["g8f6","Nf6","With the h-file settled the knight takes its natural square, covering g4 and watching e4. What comes next depends on White; the wall does not resume on autopilot, and castling short is often the right next move."]
]},
```

`master-twic` has the position after 4.h4 h5 with 21 parent games (an observation, under 30): Nf3 7, Nh3 6, Be3 6, Bg5 2. The stored 5.Nf3 is the joint-most-common reply in that sample; nothing covers 5.Nh3 or 5.Be3 (§6.4). README's row for `syn-h4` under "The 52 lines" should be checked for the O-O-O / ...b5 description and shortened to match.

## 2. `hip-150` — the note that calls three counters equals

Row at the tabiya (`rn1qk1nr/pbp2pbp/1p1pp1p1/8/3PP1P1/2N1BP2/PPPQ3P/R3KBNR b KQkq - 0 1`): **h5 -68**, Nc6 -75, Nd7 -79, a6 -84, Qh4+ -84; scored on their own: Ne7 -86, **d5 -93, c5 -120**. So ...d5 is 25 behind ...h5 (equal), ...c5 is **52 behind** (concession), and the drilled ...Ne7 is 18 behind (equal). The wall moves ...Nd7 (11) and ...a6 (16) are also equal: nothing here is lost, the false claim was that the three counters are interchangeable and that slow play is fatal. `setupGate` refuses formation credit (`demanding`) because the first choice is not a wall move, which is right.

Yes, ...h5 should carry the emphasis. Four exact edits:

- **plan** → `"Against Be3, Qd2, f3 and g4 the middlegame is a race, and the plan is making sure Black is running in it. The counters are not equals: ...h5, hitting the g4 spearhead, is the engine's first choice; ...d5 is close behind it; ...c5 costs about half a pawn more than ...h5 here. Both fianchettoes come early. A good version opens the h-file or the centre before White's pawn reaches h5; the bad version is a completed wall with the storm already through it."`
- **ply 6 note** (`b6`) → `"Both fianchettoes early. The wall moves are still the engine's first choices at this point; the order starts to matter once g4 lands."` (row: a6 -52, d6 -55 are the top two; at ply 12 c5 and Nd7 tie at -78.)
- **ply 11 note** (`f3`) → `"Propping e4 and preparing g4. For now the bishops on b7 and g7 are biting on e4 and d4 granite; ...c5 and ...d5 exist to change that."`
- **ply 14 note** (`Ne7`) → `"The tabiya of the dangerous version. The first choice is ...h5 against the g4 spearhead; ...d5 is a fair second; ...c5 is the costliest of the three, about half a pawn behind ...h5. ...Ne7 and the other wall moves sit within the engine's margin of ...h5, so completing the setup is not wrong here. What changes is that the order is no longer free: the position has a move it wants, and it is not a wall move."`

## 3. Every unsupported claim from W0-D §3, with a disposition

`supported` keeps the text; `contradicted` and `unverifiable` give the replacement; `remove` deletes the sentence. Numbers are the stored row at the nearest Black turn.

| line · where | claim | disposition | number | replacement |
|---|---|---|---|---|
| hip-e4 ply 1 | "White takes the whole center" | unverifiable (hyperbole after one move) | — | "White takes the centre. The Hippo lets him, and asks what he plans to do with it." |
| hip-e4 ply 6 | "Nothing here can be attacked profitably" | unverifiable | d6 -55, equal | "Third rank, not fourth: no pawn can hit it yet." |
| hip-e4 ply 13 | "a position with no weaknesses" | **contradicted** | after 7.a4 first choice Ne7 -49; White is half a pawn up in the engine's view | "Stopping ...b5, and note White is spending moves on a position with no fixed target. The space is still his; that is the rent the crouch pays everywhere." |
| hip-e4 ply 21 | "controls every square on the fifth rank, so White cannot make progress without pushing a pawn into the swamp" | unverifiable (no row at the line's end; ply 20 h6 -37 best) | — | "Complete: six pawns on the sixth, both bishops fianchettoed, knights on d7 and e7, castling deliberately delayed. Every fifth-rank square is covered by a pawn, so a push into the swamp meets a capture or a lever; what White does instead is the middlegame the other lines show." |
| hip-e4 plan | "cover every break", "anything pushed past rank four meets a capture or a lever" | supported (geometry: a5–h5 each attacked by a wall pawn once the wall is complete) | — | keep |
| hip66 plan | "nothing to attack" | **contradicted** | ply 20 O-O -78 best; the engine has White clearly better | "every White piece on a good square and no fixed target. The space is White's to prove something with." |
| hip66 ply 9 | "nothing in Black's camp for them to bite on" | **contradicted** | ply 10 first choice e5 -62, drilled e6 -82 | "Four pawns abreast, and no fixed target in Black's camp yet." |
| hip66 ply 19 | "Every white piece stands well. That is the problem: good squares with no targets." | unverifiable | ply 20 O-O -78 | "Every white piece stands well, and the engine agrees White has the better of it. The question is what he does with it, and Petrosian's answer was d5." |
| hip66 ply 21 | "Wikipedia's rule holds: against d5 Black answers ...e5" | supported | ply 22 e5 -77, joint first with a5 -77 | "The rule holds here: against d5 Black answers ...e5 and the game becomes a King's Indian." |
| hip66 ply 26 | "Drawn by repetition after mutual chances" | unverifiable offline (result detail, moves not stored) | f5 -15, best by 24 | "There it is. The crouch was loading, not passivity. The game was later drawn, and the commentators had their name for the animal." Lane E may restore "by repetition" only after checking the SRC score. |
| hip-e5 ply 18 | "now a French Defence chain" | supported (structure; d5 -81 best by 18) | — | keep |
| hip-e5 ply 20 | "Remember the pair: e5 means ...d5 then ...c5; d5 means ...e5 then ...f5" | **contradicted** as a rule | true here (d5 best) and in hip66 (e5 joint best); false in syn-hipc5 ply 22 (e5 38 behind exd5) | "Remember the pair as a habit, not a law: White e5 usually asks for ...d5 then ...c5, White d5 for ...e5 then ...f5. Check the exchange on d5 first; sometimes the capture is better than the lock." |
| hip-f4 plan | "the crouch has no answer" | **contradicted** | at 4.f4: a6 -46 first, Nf6 -50 (4), e6 -63 (17), Nd7 -66 (20); after 5.Nf3 the best Black move is -54; syn-e5punish reaches 0 / -2 | "No middlegame of its own; the plan is knowing when to leave. Against d4, e4 and f4 abreast the wall is the slowest choice and this repertoire does not build it: ...Nf6 turns the game into a Pirc, castling comes early because f4 promises the e5 and f5 levers, and the a6 knight routes to c5. Expect to be a little worse and to be defending; a good version is a normal Pirc, a bad one insists on ...Ne7 and ...b6 while the f-pawn rolls." |
| hip-f4 ply 7 | "the one structure the Hippo has no answer to" | **contradicted** | same row | "The Austrian pawn mass. Three abreast on d4, e4, f4 is the structure this repertoire does not crouch against: the engine's own first choice is still ...a6, but the wall's slower moves already trail, and nothing here shows it holding once f5 comes." |
| hip-g16 plan | "no weaknesses ... White's space buying nothing" | **contradicted** | ply 20 O-O -49, ply 26 Kh8 -57 | "The target is a state, not a square: no fixed target, both central breaks alive, and White's space still to be turned into something." |
| hip-g16 plan | "the only way the wall manufactures targets" | unverifiable | — | "the usual way the wall manufactures targets" |
| hip-g16 ply 9 | "the mature approach" | unverifiable (opinion) | — | "Against the Hippo that is one sensible approach: no pawn beyond the fourth rank until there is a reason." |
| hip-g16 ply 26 | "Drawn in 49 moves" | unverifiable offline | Kh8 -57 best | "The game was drawn. Two Hippos, two draws, ..." Lane E may restore the move count after checking the SRC score. |
| hip-150 ply 11, 14 | "granite", "never from Black" | contradicted (ply 14 Nd7 11, a6 16: equal) | see §2 | §2 |
| eco-paus plan, ply 7 | "the one structure the crouch cannot meet", "no answer" | **contradicted** (identical position to hip-f4 ply 7) | a6 -46, Nf6 -50 | plan: "The trigger position from the Modern order: d4, e4 and f4 abreast, the structure this repertoire does not crouch against. The plan is the exit, ...Nf6 and a Pirc middlegame; this entry exists so the trigger is recognised a move earlier." ply 7: "d4, e4 and f4 again: the structure the wall is not built against. Transpose with ...Nf6 rather than insisting." |
| eco-3pawn ply 5 | "The wall has no answer to this" | unverifiable (no row after 3.f4; the line ends on White's move) | — | "Three abreast again. This repertoire does not build the wall behind it; the 4.f4 line shows the exit." |
| eco-bish plan | "spends the middlegame staring at the e6 pawn" | unverifiable | — | "The bishop is left staring at the e6 pawn unless White finds a way to open the centre." |
| eco-psam ply 9 | "...c5 or ...c6 with ...b5 must come fast" | unverifiable (no row after 5.f3) | ply 8 first choice e5 -31, Nf6 -41 | "f3 and Be3: they intend Qd2 and a storm. The plan is ...c5, or ...c6 with ...b5, before the g-pawn arrives." |
| syn-english plan, ply 20 | "no ...d5", "no target, which is the whole bet" | **contradicted** | ply 10 first choice d5 -34 (drilled b6 41 behind); ply 20 a6 -104 | plan: replace "no ...d5 to block the b7 bishop's diagonal" with "...d5 held back so the b7 bishop keeps its diagonal, although the engine is happy to play it early"; ply 20: "The wall is complete against the English too. White has more space and no fixed target; the space is real, and that is the bet." |
| syn-london plan | "castling is safe because nothing is coming at the king"; "a bad one plays [...e5] a move early and feeds the e5 pawn to the bishop" | first unverifiable, second **contradicted** | O-O -43 equal; ...e5 is the first choice at plies 10 (0), 12 (-15), 14 (+31), 16 (-4), 18 (-8) | "castling is safe enough, since nothing in a London setup is aimed at the king. The aimed-at middlegame is slow manoeuvring where ...e5 arrives supported; the engine would play it earlier than this line does, so the drill teaches the support, not the delay." |
| syn-london ply 18 | "the f4 bishop's one forward square not already covered" | unverifiable (h6 is the other) | h6 -27 equal | "Take g5 away from the f4 bishop." |
| syn-hiph5 ply 20 | "has counterplay on the file White opened for him" | **contradicted** | Ne7 -108, 60 behind Bh6 -48; ply 16 Rxh5 -52 is 38 behind Qh4+ -14 | ply 16: "The rook joins on the half-open file, bearing on h2. The engine prefers ...Qh4+ first and the rook after; this line drills the rook because the file is the point." ply 20: "Black is uncastled by choice and has the open file to work with; the engine would rather have the bishop on h6 first." Also swap ply 20 `Ne7` for `Bh6`? Only with a fresh row for the continuation (§6.4). |
| syn-e5punish ply 22, plan | "now needs defending", "over-extension against the crouch" | first supported (Nd7 -2 best; pv Nd7 Be4 Nb4 Bf4 has White spending Bf4 on e5); plan unverifiable as a general claim | Black's best was -84 before the stored 10.e5 and 0 after it: the model punishes a premature push, not the structure | plan: replace "three white pawns cross into the swamp and the model shows them becoming the targets" with "White pushes e5 before it is prepared, as this model has him do, and the pawns that crossed into the swamp become the targets". |
| syn-hipdown ply 18 | "Forced by their space grab ... for the rest of the game" | **contradicted** | d5 -107 is inferior, 94 behind Bxf3 -13 | "Not forced: the engine prefers the exchange on f3. This is the habit move, and from here the g7 bishop bites on the e5 wedge for a long time." (The line is the deliberate mistake; the note should say the move is one.) |
| syn-hipc5 plan, ply 22 | "every piece already on its square"; the d5 → ...e5 rule | plan unverifiable; rule **contradicted** here | e5 -63, 38 behind exd5 -25 | ply 22: "They closed the centre, so the game moves to the wings. The engine's first choice here is the exchange on d5; this line drills the lock because it is the plan the pieces were placed for, and the reflex is worth knowing before it becomes one." |
| app.js `PLAN` b-side `d6`/`e6` | "Nothing there can be attacked profitably" | unverifiable (generic, lane A's file) | — | "Third rank, not fourth: no pawn can hit it yet." |
| app.js `PLAN` b-side `a6`/`h6` | "for good" | unverifiable (lane A's file) | — | drop "for good": "Take b5 away from their pieces." / "Take g5 away from their pieces." |

Counts over the 33 rows: supported 4, contradicted 14, unverifiable 15, remove 0 (the three mixed rows are counted under their stronger finding). Nothing is deleted outright; every absolute becomes a condition, as CLAUDE.md asks.

## 4. Annotation marks on Black moves

| line · ply | mark | KIND | score | policy | disposition |
|---|---|---|---|---|---|
| hip66 · 26 | `f5!` | game | -15, **best by 24** | a game score can carry a mark; whether chessgames' score for gid=1106728 does cannot be checked offline | keep only if lane E confirms the source annotates it; otherwise `["f7f5","f5",...]` |
| hip-e5 · 18 | `d5!` | model | -81, best by 18 | a `model` line has no source that could have used it | **remove**: `["d6d5","d5","Lock it. ..."]` (note text unchanged) |
| hip-f4 · 8 | `Nf6!` | theory (Wikipedia) | -50, **second choice, 4 behind a6** | the source is an encyclopaedia article, not an annotated line; and the table's first choice is the wall move the note tells the user to abandon | **remove**: `["g8f6","Nf6","Abandon the setup. ..."]` |

None of the three is embarrassed by its number (all `best` or `equal`); two have no source that could have written the mark. `test/verify.mjs` strips marks before comparing SAN, so removing them changes no check.

## 5. `targets`: no data change

`setupGate` does per position what W1-D §4 asked for per line: credit only where the row's first choice (or a tie with it) is itself a formation move and the move played is `best`/`equal`. Checked today across the five `HIPPO_T` lines: `hip-150` ply 14 refuses (`demanding`, first choice h5), ply 12 credits (c5/Nd7 tie); `hip66` plies 21 and 25 refuse; `hip-e5` plies 14 and 16 refuse as `out-of-band` (the two concessions above); `hip-e4` credits at every wall ply where the first choice is a wall move. **Keep `targets` exactly as it is.** Removing `HIPPO_T` from `hip-150` would lose the ply-12 credit the table itself licenses; adding it to the six synthetic Hippo lines is not needed for correctness and `syn-english`'s formation (knight on e7 covering d5, no ...d5) is not `HIPPO_T` anyway. Invariant 7 holds: `trap`, `soltis-trap`, `syn-hipdown` keep `targets:[]` and short-circuit the gate at `no-targets`.

## 6. Coverage gaps from W1-D, as proposals (no lines written)

Rows already in `EVL` are named; every other Black turn in a proposed line needs `--extra`, and moves a note will name that may fall outside the five need `--force` (append to `research/named-moves.tsv`). Depth follows W1-D C2: the counted tree dies at ply 8–10, so everything past the last ≥100-parent node is chess-only and must be tagged `synthetic`.

1. **3.e5 after 1.e4 g6 2.d4 Bg7** — 689 / 4,526 = 15.2% player; 1 / 6,574 twic. Row exists (`h-3e5-space-grab`): **d6 +35, c5 +28**, Nh6 +3, a6 0, Nc6 -29; pv `d6 Nf3 dxe5 Nxe5 Nd7 Nf3`. Teach: the wall is not built behind an e5 pawn; hit it now, and the two hits are 7 cp apart. Proposed `syn-3e5`, `synthetic`, 8–10 plies along the pv (3...d6 4.Nf3 dxe5 5.Nxe5 Nd7 6.Nf3 and one or two more), note stating Black is already comfortable. Needs `--extra` for the positions after 4.Nf3, 5.Nxe5, 6.Nf3 (keys computed by `keyFen`), and `--force c7c5` at the 3.e5 key is unnecessary (already ranked). White's 4th-move alternatives are uncounted (tree dies); one branch only.
2. **2.Nf3 setups** — 1.e4 g6 2.Nf3: 2,433 / 10,147 = 24.0%; 1.e4 d6 2.Nf3: 3,251 / 12,351 = 26.3% (twic 2.9% and 3.2%). Row at 1.e4 g6 2.Nf3: c5 -25, **Bg7 -44 (19, equal)**, d6 -44, d5 -58, a6 -58. No row at 1.e4 d6 2.Nf3. Teach: ...Bg7 keeps every transposition open; d4 next returns to covered lines, d3/g3 is the King's Indian Attack (d3 4.6% at both 1.e4 g6 and 1.e4 d6). Proposed one `synthetic` line 1.e4 g6 2.Nf3 Bg7 3.d3 d6 4.g3 ... to ply 10–12 with `--extra` at every Black turn from ply 4, plus `--force g7g6` at the 1.e4 d6 2.Nf3 key so the Hippo's move there has a number.
3. **Bg5 against the ...Nf6 version** — 118 / 690 = 17.1% player, 147 / 1,686 = 8.7% twic at 1.e4 d6 2.d4 Nf6 3.Nc3 g6. Row exists (`h-bg5-pirc`): **Bg7 -50**, Nc6 -50, h6 -55, Nbd7 -58, c6 -58; pv `Bg7 Qd2 h6 Bf4 Nbd7 O-O-O`. Teach: the pin is met by ignoring it, ...h6 asked only once Qd2 is in, then a Pirc. Proposed `syn-bg5`, `synthetic`, 10 plies following the pv from the eco-austrian/eco-pircclass order; `--extra` after 5.Qd2, 6.Bf4, 7.O-O-O. Note must say the position is about half a pawn worse for Black, like the whole f4/Bg5 family.
4. **h4 and g4 from the Be3 tabiya** (1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Be3 a6) — twic 95 / 677 = 14.0% and 63 / 677 = 9.3%, no rating filter; player pool reaches the node with 14 games (deep run). No row for either. Teach: the timing-bound ...h5 (against h4) and the g4 hit (against g4) without f3 in, which `hip-150` does not cover. Two short `synthetic` lines, 12 plies each, `--extra` at every Black turn from ply 10, `--force h7h5 b7b5 g8f6 c7c5` at both keys (`.../3PP2P/2N1B3/PPP2PP1/R2QKBNR b` and `.../3PP1P1/2N1B3/PPP2P1P/R2QKBNR b`) so the note's counter has a number whatever the five say. C4 applies: rare in the player pool, `storm`, in scope. The same run can supply rows for 5.Nh3 and 5.Be3 after 4.h4 h5 (§1) and for a repaired `syn-h4` (12...O-O -25 is already ranked; its continuation is not).
5. **First moves no Black line answers** — 50,320 / 495,101 = 10.16% player (g3 2.32%, e3 2.31%, f4 1.38%, b3 1.34%, d3 1.00%, b4 0.63%); twic 3.8%. Under C1 the start node needs 90% cumulative: the four covered moves give 89.84%, so **one line answering 1.g3 reaches 92.2% and a second for 1.e3 reaches 94.5%**; b3 and f4 only under C4 and neither is a storm. Row exists at 1.Nf3 g6 2.g3 (`h-reti-g3`): c5 -7, d5 -17, **Bg7 -18 (11, equal)**, c6 -19, Nf6 -19 — the same shape 1.g3 reaches. Proposed `syn-g3` (1.g3 g6 2.Bg2 Bg7 3.Nf3 d6 ... 8 plies) and `syn-e3` (1.e3 g6 2.d4 Bg7, joining `syn-london`'s shape), both `synthetic`, `--extra` at every Black turn and `--force g7g6` at the six first-move keys (`rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPP1P/RNBQKBNR b KQkq - 0 1` and the e3, f4, b3, d3, b4 analogues) so the wall's move is graded rather than `unknown` against a flank opening. Teach: the wall goes up unchanged; the number, if any, is the rent.
6. **Réti 1.Nf3 g6 2.g3** — 147 / 575 = 25.6% player, 721 / 2,184 = 33.0% twic, the most common master reply there; `hip66` plays 2.c4. Same row as 6.5. Fold into `syn-g3` rather than a separate line: 1.Nf3 g6 2.g3 Bg7 3.Bg2 reaches it and the g3 line's positions from ply 4 are shared.

Not proposed: Qd2+Bh6 (W1-D: the immediate move is ≤0.24% and the plan is unmeasured; no priority), Nge2 systems (untestable), Black's castling choice (not testable by this method).

## 7. Not settled here

- The two `game` result details ("by repetition", "in 49 moves") need the chessgames scores, which are unreachable offline; §3 gives the wording to use until then.
- Whether the `hip66` `f5!` is in the source's own annotation: same limitation.
- `hip-e5` plies 14 and 16 are concessions (38, 39) in a `model` line whose alternatives (`Ne7` at both) are ranked. The moves are legal and equal-ish; changing them means new rows for everything after. Recorded, not decided.
- README's "The 52 lines" summary names `hip-f4` as "when not to crouch (4.f4)" and `syn-h4` as "meeting the h4 lunge"; both still fit after these edits, but the README row text for `syn-h4` should be checked against the ten-ply version. Not lane D's file.
