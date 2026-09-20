<!-- W0-D · 2026-09-20 · audited against commit 598a374 -->
<!-- Frequency data unavailable: explorer.lichess.ovh returns HTTP 401 in this environment. -->

# W0-D — Hippopotamus (Black) content inventory

Source: `/home/luismars/openingtrainer/src/data/lines.js` (52 lines total, 24 with `you:"b"`), `/home/luismars/openingtrainer/src/core.js` (HIPPO_T), `/home/luismars/openingtrainer/src/app.js`. Nothing modified. Data extracted by evaluating `core.js + lines.js` in Node, not by eye.

`HIPPO_T` (core.js:25) = `[["a6","p"],["b6","p"],["d6","p"],["e6","p"],["g6","p"],["h6","p"],["b7","b"],["g7","b"],["d7","n"],["e7","n"]]`.

## 1. Line table (all 24 Black lines)

| id | KIND | SRC | plies | targets | teaches |
|---|---|---|---|---|---|
| hip-e4 | model | Wikipedia Hippopotamus_Defence | 21 | HIPPO_T | the reference wall vs 1.e4 Bc4/Nf3/O-O, castling delayed |
| hip66 | game | chessgames gid=1106728 | 26 | HIPPO_T | Petrosian–Spassky g12; d5 answered by ...e5 then ...f5 |
| hip-e5 | model | Wikipedia Hippopotamus_Defence | 20 | HIPPO_T | e5 met by ...d5 lock then ...c5 at the base |
| hip-f4 | theory | Wikipedia Hippopotamus_Defence | 12 | `[]` | the exit: vs d4+e4+f4 play ...Nf6, become a Pirc |
| hip-g16 | game | chessgames gid=1106734 | 26 | HIPPO_T | Petrosian–Spassky g16; vs slow c3, castle and prepare ...e5 |
| hip-150 | theory | Wikipedia Hippopotamus_Defence | 14 | HIPPO_T | the Be3/Qd2/f3/g4 storm tabiya and its three counters |
| eco-mong3 | eco | lichess-org/chess-openings | 6 | `[]` | skeleton vs Nc3 |
| eco-mong | eco | same | 6 | `[]` | skeleton vs Nf3 |
| eco-bish | eco | same | 5 | `[]` | Bc4 answered by ...e6 |
| eco-paus | eco | same | 7 | `[]` | Pseudo-Austrian trigger recognition |
| eco-averb | eco | same | 7 | `[]` | Averbakh c4 centre = Petrosian's 1966 setup |
| eco-austrian | eco | same | 10 | `[]` | full Austrian: hand over to Pirc |
| eco-pircclass | eco | same | 8 | `[]` | quiet Pirc the transposition heads for |
| eco-std | eco | same | 6 | `[]` | the plain Modern order |
| eco-3pawn | eco | same | 5 | `[]` | Three Pawns trigger |
| eco-psam | eco | same | 9 | `[]` | Pseudo-Sämisch storm recognition from the c4 order |
| eco-rat | eco | same | 4 | `[]` | Rat cousin without the fianchetto |
| syn-hipc5 | synthetic | none | 24 | `[]` | d5 closes → ...e5 then ...f5 drill |
| syn-hiph5 | synthetic | none | 20 | `[]` | ...h5 vs the storm, ...Rxh5 on the half-open file |
| syn-english | synthetic | none | 20 | `[]` | wall vs 1.c4/g3; ...e6 not ...d5, ...Ne7 covering d5 |
| syn-london | synthetic | none | 22 | `[]` | wall vs London; ...Nd7, ...h6, castling safe |
| syn-e5punish | synthetic | none | 22 | `[]` | over-extension: ...c5, ...dxe6, ...Nd7 |
| syn-hipdown | synthetic | none | 25 | `[]` | the losing picture (deliberate mistake line) |
| syn-h4 | synthetic | none | 20 | `[]` | ...h5 stops h4-h5, then ...a6/...b5 vs O-O-O |

Note: **only 6 of 24 Black lines carry `HIPPO_T`** — all 7 synthetic Hippo models have `targets:[]`, so the setup-move acceptance in `setupMove()` never fires on them. Only `syn-hipdown` needs that (invariant 7); the other six look like an oversight, not a policy.

## 2. Move-order exceptions

Claims of order-independence (exact quotes):
- `hip-e4` ply2 `g6`: **"Move one of ten. Order barely matters, which is why this defence costs almost nothing to learn."**
- `hip-g16` ply16 `a6`: **"The wall completes itself in whatever order White allows."**
- `hip-g16` ply20 `O-O`: **"This time Spassky castles. The Hippo is a formation, not a dogma."**
- `src/app.js:1150` (comment): **"one fixed move order marks correct chess wrong - the Hippo's wall goes up in almost any order, and the user rightly complained when the trainer punished that."**
- `src/app.js` `setupGood()`: **"The wall is a formation, not a move order: "+t+" fills one of its squares..."**

Order-*dependent* lines (a specific White move demands an immediate specific reply; the wall cannot be built at leisure):
- `hip-f4` / `eco-paus` / `eco-3pawn` — f4 abreast must be met by ...Nf6 at once.
- `hip-150` ply6 `b6`: "Both fianchettoes early, because against this setup Black cannot afford slow moves."
- `syn-hiph5` ply14 `h5` and `syn-h4` ply8 `h5` — must precede White's h5.
- `eco-psam` ply9 `f3`: "...c5 or ...c6 with ...b5 must come fast."
- `syn-hipdown` ply12 `e6`: "Playable, but the clock is running: with f4 in, White gets a free hand."

These two sets are in tension and nothing in the UI distinguishes them: the `setupMove()` credit is purely `targets`-based, so on a HIPPO_T line the grader will accept a slow wall move even in `hip-150`, the one line whose own note says slow play loses the race. The only brake is the four-ply `v.swing<1` material check, which will not see a pawn-storm tempo loss.

## 3. Unsupported claims (exhaustive, exact quotes)

No engine check exists behind any of these. None asserts a mate. The pattern is absolute/structural assertion rather than eval claims.

| line (KIND) | where | quote |
|---|---|---|
| hip-e4 (model) | ply1 `e4` | "White takes the whole center." |
| hip-e4 | ply6 `d6` | "Third rank, not fourth. **Nothing here can be attacked profitably.**" |
| hip-e4 | ply13 `a4` | "note White is spending moves reacting to a position with **no weaknesses**." |
| hip-e4 | ply21 `Be3` | "Black controls **every square on the fifth rank**, so White **cannot** make progress without pushing a pawn into the swamp." |
| hip-e4 | plan | "The knights stay low because between them they cover **every** break" |
| hip-e4 | plan | "anything White pushes past rank four meets a capture or a lever" |
| hip66 (game) | plan | "every White piece on a good square and **nothing to attack**" |
| hip66 | ply9 `e4` | "Four pawns abreast, and **nothing in Black's camp for them to bite on**." |
| hip66 | ply19 `Rad1` | "**Every white piece stands well.** That is the problem: good squares with no targets." |
| hip66 | ply21 `d5` | "**Wikipedia's rule holds:** against d5 Black answers ...e5 and the game becomes a King's Indian." |
| hip66 | ply26 `f5!` | "**Drawn by repetition after mutual chances**" — a result claim about moves not stored in the line |
| hip-e5 (model) | ply18 `d5!` | "Lock it. The structure is **now a French Defence chain**" |
| hip-e5 | ply20 `c5` | "**Remember the pair: White e5 means Black ...d5 then ...c5; White d5 means Black ...e5 then ...f5.**" (stated as a rule, no source for the pairing beyond the Wikipedia plan) |
| hip-f4 (theory) | plan | "Against d4, e4 and f4 abreast **the crouch has no answer**" |
| hip-f4 | ply7 `f4` | "Three abreast on d4, e4, f4 is **the one structure the Hippo has no answer to**." |
| hip-g16 (game) | plan | "The target is a state, not a square: **no weaknesses**, both central breaks alive, White's space buying nothing." |
| hip-g16 | plan | "a bad one commits to the break the structure does not support, **the only way** the wall manufactures targets" |
| hip-g16 | ply9 `c3` | "Against the Hippo that is **the mature approach**: no pawn beyond the fourth rank until there is a reason." |
| hip-g16 | ply26 `Kh8` | "**Drawn in 49 moves.** Two Hippos, two draws" — length/result not in the stored 13 moves |
| hip-150 (theory) | ply11 `f3` | "the bishops on b7 and g7 are **now biting on e4 and d4 granite**" |
| hip-150 | ply14 `Ne7` | "the Hippo tolerates slow play from White, **never** from Black" |
| eco-paus (eco) | plan | "**the one structure the crouch cannot meet**" |
| eco-3pawn (eco) | ply5 `f4` | "**The wall has no answer to this**, so hit the centre instead." |
| eco-bish (eco) | plan | "The bishop spends the middlegame staring at the e6 pawn" |
| eco-psam (eco) | ply9 `f3` | "...c5 or ...c6 with ...b5 **must** come fast." |
| syn-english (syn) | ply20 `a6` | "White has more space and **no target**, which is the whole bet." |
| syn-london (syn) | plan | "castling is safe **because nothing is coming at the king**" |
| syn-london (syn) | ply18 `h6` | "Take g5 away: it was the f4 bishop's **one forward square not already covered**." |
| syn-hiph5 (syn) | ply20 `Ne7` | "Black is uncastled by choice and **has counterplay** on the file White opened for him." |
| syn-h4 (syn) | plan | "White's h-pawn is fixed on a square it **cannot** leave" |
| syn-h4 (syn) | ply14 `Nbd7` | "f6 stays covered three times, so **the pin has nothing to lean on**" |
| syn-h4 (syn) | ply20 `Bb7` | "Both sides now attack where the enemy king lives, but your attack needed no pawn moves in front of your own." |
| syn-e5punish (syn) | ply22 `Nd7` | "the e5 one **now needs defending**, which is what over-extension against the crouch looks like" |
| syn-hipdown (syn) | ply18 `d5` | "**Forced** by their space grab, and now the g7 bishop is biting on granite **for the rest of the game**" |
| syn-hipc5 (syn) | plan | "the King's Indian break with **every piece already on its square**" |
| app.js `PLAN` b-side | `"d6"`/`"e6"` | "Third rank, not fourth. **Nothing there can be attacked profitably.**" (generic, shown on any Black line) |
| app.js `PLAN` b-side | `"a6"`/`"h6"` | "Take b5 away from their pieces **for good**." / "Take g5 away from their pieces **for good**." |

Highest-risk of these: the four "no answer / cannot meet" absolutes about f4 (hip-f4, eco-paus, eco-3pawn) and "no weaknesses / cannot make progress" (hip-e4 ply13, ply21, hip-g16 plan). They are category claims about a whole structure, and `syn-e5punish` in the same repertoire contradicts them — it plays `4.f4` and then shows Black *doing well* against it.

## 4. Provenance problems

- **`game` (2 Hippo lines)** — `hip66` and `hip-g16` both have real chessgames.com URLs and README rows. No invented ratings or event names anywhere; event/round claims ("Moscow 1966, g12/g16") are checkable. The unverifiable part is the *result prose* inside notes ("Drawn by repetition after mutual chances", "Drawn in 49 moves"), which describes moves not stored in the line. Nothing in `verify.mjs` covers it.
- **`eco` spot-check** — I checked **all 11**, not 3, against `data-src/eco_*.tsv`, matching the full PGN string: **all 11 match verbatim** (`eco-mong3`, `eco-mong`, `eco-bish`, `eco-paus`, `eco-averb`, `eco-austrian`, `eco-pircclass`, `eco-std`, `eco-3pawn`, `eco-psam`, `eco-rat`). Trainer display names are shortened ("Modern:" for "Modern Defense:", "Pirc:" for "Pirc Defense:") — cosmetic, but the names are no longer verbatim from the dataset.
- **`theory` (2)** — `hip-f4` and `hip-150` both point at the single Wikipedia article. `hip-150` calls itself "the critical modern try" and reproduces a 150-Attack-style tabiya; the Wikipedia article is a tertiary source, so this is second-hand attribution for a `theory` tag. `hip-150`'s three prescribed counters (...h5 / ...c5 / ...d5) are not attributed at all.
- **`model` (2)** — `hip-e4` and `hip-e5` are tagged `model` but carry a Wikipedia SRC and `src:"model line, Wikipedia plan"`. The tag is honest; the risk is `hip-e5`'s "Remember the pair" rule reading as theory in the UI.
- **No Hippo line carries `book`.** The whole Black half of the repertoire has zero published-book backing; the White half has three `book` lines. Worth naming as an asymmetry.
- Drift: `src/html/menu.html:5` says "Forty-seven lines" and `src/html/head.html:9` says "47 lines"; `LINES.length` is 52 and README says 52.

## 5. Suspected coverage gaps — **hypothesis only, no frequency data** (lichess explorer API is blocked here, so nothing below is weighted by how often it actually occurs)

Covered White setups: classical e4/d4/Nc3/Nf3/Bc4 (hip-e4, hip-e5, eco-bish); **e4/d4/c4** three-pawn centre (hip66, eco-averb — so this is *not* a gap); **e4/d4/f4** three-pawn centre (hip-f4, eco-paus, eco-3pawn, eco-austrian, syn-e5punish, syn-hipdown — also *not* a gap); **Be3+Qd2+f3+g4 storm with O-O-O** (hip-150, syn-hiph5, eco-psam — *not* a gap); **direct h4-h5** (syn-h4 — *not* a gap); **d5 space grab** (hip66, syn-hipc5); **e5 space grab** (hip-e5, syn-e5punish); slow c3/Be2 build (hip-g16); **English 1.c4 with g3** (syn-english); **London** (syn-london); Pirc transpositions (eco-pircclass, eco-austrian); Rat (eco-rat). Opposite-side castling is present in `syn-hiph5` and `syn-h4`.

Genuinely missing, in rough order of how likely I'd expect them to matter:
1. **Qd2 + Bh6 trading the g7 bishop.** Completely absent. This is the standard club plan against any ...g6 setup and the Hippo's dark-square wall depends on that bishop. Not one line contains `Bh6`.
2. **A line where White's h-pawn actually lands on h5.** Both storm lines stop it; the "bad version" exists only as prose in `hip-150`'s and `syn-hiph5`'s plans. Nothing drills the defence after the file opens.
3. **Four pawns: c4+d4+e4+f4** (Averbakh order with f4). `eco-averb` stops before it; `hip-f4` only covers the e4/d4/f4 version.
4. **King's Indian Attack** (e4, d3, Nd2, Ngf3, g3, Bg2, O-O, Re1, e5) — named in the brief and genuinely absent.
5. **Réti / pure 1.Nf3 with g3 and no early d4.** `hip66` starts 1.Nf3 but transposes to a d4/c4 centre by move 3.
6. **Nge2 setups** (Be3/Qd2/Nge2/g4 without Nf3) — `syn-hiph5` plays `Nge2` on ply 19, but only after the position is already resolved.
7. **Torre/Bg5 against the Modern**, and the `1.d4 g6 2.Nc3` / `2.e4 d6 3.Nc3 Bg7 4.Bg5` pin lines. `Bg5` appears only as one quiet move in `hip-e4` (ply17).
8. **1.b3, 1.f4, 1.g3, 1.b4** — no line covers any non-central first move at all.
9. **White castling short and attacking anyway** with f4-f5 or Nf3-h4-f5. Every attack in the Black half comes from a long-castled White.
10. **Black castling long**, or the decision of where to castle when White has not committed. `hip-e4` delays castling forever; `hip66`/`hip-g16` castle short; two synthetic lines stay uncastled "by choice". No line teaches the choice.

## 6. Deliberate-mistake lines

All three still carry `targets:[]` (verified programmatically, identity-compared against `HIPPO_T`):

| id | you | KIND | targets | asks the learner to repair? |
|---|---|---|---|---|
| `trap` | w | theory | `[]` | **No.** Ends "Learn this line so you never reach it." Pure demonstration of a dead structure. |
| `soltis-trap` | w | book | `[]` | **Partly.** It is a misfire, not a loss: the last move is Black's resource `...Qc8` with the note "The move to know this line for: ...Qc8 defends f5...". The learner (playing White) walks into it but is never asked to fix it. |
| `syn-hipdown` | b | synthetic | `[]` | **No.** The learner plays Black's own losing moves to the end: ply24 `c5` — "The break arrives late: White is developed, castled and unchallenged in the centre... Knowing this picture is worth more than another win to admire." No repair, no alternative branch. |

`syn-hipdown` is the only Black deliberate-mistake line and it is the only one where the user is grading as "correct" the very moves the line calls a mistake.

## 7. Annotation marks on Hippo lines

Exhaustive — only three across all 24 Black lines, all on Black moves:

| line | KIND | ply | SAN |
|---|---|---|---|
| hip66 | game | 26 | `f5!` |
| hip-e5 | model | 18 | `d5!` |
| hip-f4 | theory | 8 | `Nf6!` |

Against the CLAUDE.md rule ("Do not add a new mark to a move unless the line's own source uses it"): `hip66`'s `f5!` is plausibly sourced to the annotated game; **`hip-e5` is tagged `model`** — a line written for this trainer — so its `d5!` has no source that could have used it. `hip-f4`'s `Nf6!` is `theory` sourced only to the Wikipedia article. Both are candidates for removal.
