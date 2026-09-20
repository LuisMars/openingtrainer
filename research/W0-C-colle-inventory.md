<!-- W0-C · 2026-09-20 · audited against commit 598a374 -->
<!-- No frequency data: explorer.lichess.ovh returns HTTP 401 in this environment. -->

# W0-C — Colle (White) content inventory

Source of truth read: `/home/luismars/openingtrainer/src/data/lines.js` (52 lines total, **28 with `you:"w"`**), `KIND`/`SRC` at lines 260–282, plus `/home/luismars/openingtrainer/src/app.js` (PLAN table ~L1201–1244, `clueLeaks`/`moveClue` ~L1245+). ECO spot-checks against `/home/luismars/openingtrainer/data-src/eco_*.tsv`. CONTENT-REVIEW.md deliberately not used as evidence. **No files modified.**

## 1. Line table (28 White lines; ply = half-moves stored)

| id | KIND | SRC | ply | targets | Teaches |
|---|---|---|---|---|---|
| ck | theory | wikipedia Colle_System | 19 | COLLE_T | Koltanowski main line, the e3-e4 break with Nbd2/Qe2 escorts |
| kolt | game | irlchess.com blog post | 25 | COLLE_T | e4-e5 as a clamp, Nd2-b3 reroute, Bc1-f4 |
| ohanlon | game | 365chess gid=2652130 | 39 | COLLE_T | Greek gift Bxh7+ model attack, full game to resignation |
| cz | theory | wikipedia Colle_System | 21 | ZUK_T | Zukertort b3/Bb2/Ne5/f4 + Pillsbury Rf1-f3-h3 lift |
| anti | theory | wikipedia Colle_System | 19 | **[] ** | 3...Bf5 answered by 4.c4, leaving the system |
| trap | theory | chessdoctrine.com | 18 | **[] deliberate-mistake** | 4.c3 vs ...Bf5: bishops trade, attack evaporates |
| cz-tab | theory | matthewsadler.me.uk | 23 | ZUK_T | Modern Zukertort tabiya, a3 prophylaxis, c-file race |
| colle-kid | model | wikipedia Colle_System | 19 | **[]** | vs ...g6: abandon Bd3, switch to b3/Bb2 |
| anti-bg4 | theory | chessdoctrine.com | 15 | **[]** | 3...Bg4 hunted with h3/g4/Ne5 |
| rudel | book | chess.com article | 23 | ZUK_T | Early Ne5 Zukertort; Rf3!? conceding the d3 bishop |
| soltis | book | chess.com **forum thread** | 11 | **[]** | 3...Bf5: recapture 5.cxd3 not 5.Qxd3 |
| soltis-trap | book | chess.com **forum thread** | 12 | **[] deliberate-mistake** | 5.Bxf5 exf5 and why it misfires |
| eco-gru | eco | lichess chess-openings | 8 | [] | D04 signpost: ...g6 vs Colle |
| eco-kid | eco | " | 8 | [] | A48 signpost: KID shell |
| eco-trad | eco | " | 9 | [] | D05 c3-before-Nbd2 move order |
| eco-ptero | eco | " | 8 | [] | A40 ...Qa5+ check trick |
| eco-rham | eco | " | 8 | [] | A04 same trick from a Reti order |
| eco-torre | eco | " | 12 | [] | D03 Torre sister system |
| eco-london | eco | " | 11 | [] | D02 London cousin |
| syn-qid | synthetic | none | 23 | [] | Zukertort vs QID; when *not* to take on e4 |
| syn-greek | synthetic | none | 27 | [] | Greek-gift pattern drill with conditions |
| syn-slav | synthetic | none | 23 | [] | Colle vs ...c6 Slav wall, positional version |
| syn-qf3 | synthetic | none | 23 | [] | Zukertort with Qf3-h3 instead of the rook lift |
| syn-ne4 | synthetic | none | 25 | [] | Answering ...Ne4 by taking at once |
| syn-clamp | synthetic | none | 25 | [] | ...c4 clamp dissolved by Bc2 then b3 |
| syn-e5colle | synthetic | none | 27 | [] | When ...e5 lands on time: honest queenless game |
| syn-dutch | synthetic | none | 23 | [] | vs Leningrad Dutch: b3/Bb2, Nc3-d5, cxd5 |
| syn-benoni | synthetic | none | 21 | [] | vs 1...c5: 2.e3, half-open e-file, Qb3 at b7 |

Only `ck, kolt, ohanlon, cz, cz-tab, rudel` carry a non-empty `targets`; all 22 others are `targets:[]`. Per CLAUDE.md invariant 7 the deliberate-mistake lines here are **`trap`** and **`soltis-trap`** (both must keep `targets:[]`).

## 2. Unsupported claims (exhaustive; exact quotes)

### Factually wrong as written
| id | ply | quote | problem |
|---|---|---|---|
| ck | 19 | `"e5 evicts the f6 knight, sole guardian of h7."` | Black is castled (`r1bq1rk1`); **Kg8 also guards h7**. "sole" is false. |
| kolt | 21 | `"Now the f6 knight must move and h7 loses its defender"` | same — h7 keeps the king as defender; also the knight has ...Ne4/...Nd5/...Ng4, so "must move" is loose. |
| kolt | 22 | `"Forced retreat."` | Nd7 is not forced. |
| kolt | 8 | `"Same position as the main line, reached by a different order. Systems do not care."` | Verified by FEN: `ck@8 ≠ kolt@8` (ck has Bd3, kolt has c3). They converge at ply 9 (`ck@9 == kolt@9`, confirmed). Claim is one ply premature. |
| syn-e5colle | 16 | `"O'Hanlon preferred 8...Re8 and never got another chance"` | O'Hanlon appears again in `kolt` (1937), so "never got another chance" reads false against this repo's own content. |

### Absolutes ("always/never/every/must/guaranteed/sole")
| id | ply/plan | quote |
|---|---|---|
| ck | 1 | `"d4, then e3 and c3, and the center never cracks."` |
| ck | 5 | `"Paid in exchange for a guaranteed e4 break."` |
| ck | 13 | `"Castle first. Always."` |
| ck | 17 | `"Every move since move three existed to make this one good."` |
| cz | 17 | `"Every Zukertort game is a referendum on this knight."` |
| cz | 21 | `"the f6 knight is the last real defender"` (also in `cz` plan and `cz-tab`) |
| anti | 7 | `"With the bishop outside the chain, e4 will never come with force"` (also in `anti` plan) |
| anti | 13 | `"The e5 outpost survives every version of this opening."` |
| cz-tab | 20 | `"Black's counterplay is the c-file, always. Meet it with Rac1 or c3, never with panic."` (echoed in plan: `"His counterplay is the c-file, always"`) |
| rudel | 19 | `"Every Zukertort game runs through this pawn."` |
| rudel | 23 | `"Black must find defensive moves while White simply follows a plan"` |
| ohanlon | 26 | `"After 13...Kg8 14.Qh5 Black must hold f7 and h7 at once"` (unverified sideline) |
| ohanlon | 27 | `"another attacker joins with tempo and the king has no shelter"` |
| syn-dutch | 16 | `"the Leningrad lives or dies by ...e5"` |
| syn-dutch | 23 | `"the c6 knight is hit and must move again"` |
| syn-clamp | 11 | `"Keep the bishop on the diagonal it lives for"` / 25 `"the bishop returns to the b1-h7 diagonal it never really left"` |
| colle-kid | plan | `"Against ...g6 the h7 plan is dead"` |

### Positional verdicts with no engine behind them (effectively "White is better")
| id | ply | quote |
|---|---|---|
| anti | 19 | `"White has space, the e5 outpost and a plan; Black has traded his good bishop for a piece White was happy to give."` |
| anti-bg4 | 15 | `"White has the bishop pair and space; Black has a half-open h-file pointed at a king that has not committed."` |
| trap | 7 | `"The move that makes the system a system now makes it a corpse."` |
| trap | 10 | `"The attacking bishop is gone, and with it the whole point of the opening."` |
| trap | 18 | `"Black has traded off his problem bishop and faces no attack"` |
| trap | plan | `"White's system built around an attack that cannot happen."` |
| ohanlon | 20 | `"Everything after this is arithmetic."` |
| ohanlon | 22 | `"Greedy, and the practical turning point."` |
| eco-kid | 8 | `"White has a solid position and no attack"` (an evaluative note on an **`eco`**-tagged line) |
| ck | 6 | `"Black entombs his own bishop. This is the Colle's dream position."` |
| soltis | 9 | `"taking with the c-pawn half-opens the c-file and kills that plan"` |
| syn-slav | 23 | `"Now the extra space is real."` |
| syn-benoni | 21 | `"the defence costs Black a move, ...Rb8 or ...Na5"` |

### Concrete material/tactical claims asserted but not engine-checked
| id | ply | quote |
|---|---|---|
| syn-ne4 | 17 | `"With no ...Bb7 to guard the recapture, the pawn on e4 will simply hang."` |
| syn-ne4 | 25 | `"The ledger after the trades: White a pawn up with bishop and knight, Black holding the two bishops."` |
| syn-ne4 | plan | `"Nxe4 dxe4 Bxe4 simply wins a pawn"` … `"White stands a pawn up"` |
| syn-qf3 | 23 | `"the exchanges on e4 end with Qxe4 and a pawn in hand"` |
| syn-qid | plan | `"the companion lines take at once only because there the capture wins the pawn outright"` |
| anti-bg4 | 11 | `"Threatening Nxg6 and h4-h5, winning the bishop pair with a pawn storm attached."` |
| syn-dutch | 21 | `"The knight arrives with a concrete threat: Nxc7 forks queen and rook."` |
| cz-tab | 23 | `"after ...cxd4 the immediate ...Rxc2 would just run into Bxc2"` |
| soltis-trap | plan | `"d5 was never loose, the f6 knight covers it."` |
| syn-e5colle | 17 | `"Left alone, ...e4 would come with tempo on both the bishop and the knight."` |
| syn-benoni | 5 | `"Qxd4 instead would meet ...Nc6 with tempo"` |
| ck | 15 | `"it wins a tempo on the bishop"` |
| eco-ptero | 8 | `"the queen's rank stops at Black's own c5 pawn, so d4 is not attacked"` |
| ohanlon | 17 | `"Threatening e5, forking bishop and knight."` |

### Already well-hedged (keep as the model for rewrites)
`syn-greek` ply23 `"Engines dispute several of these positions; treat it as a pattern to calculate, not a rule to trust."`; ply27 `"it is a threat rather than a verdict"`; `ohanlon` ply39 `"the sacrifice's soundness is still argued, its practical force is not."`; `syn-qid` ply23 `"Nothing here is forced"`; `syn-e5colle` ply27 `"The Colle's promise was never a forced attack, only a familiar position."`; `colle-kid` ply19 `"This is the honest price of a system repertoire."`

`src/app.js` carries no per-line Colle claims: the `PLAN` table is generic one-liners (`"Bd3":"Point something at h7."`, `"e4":"The break the opening exists for."`) already flagged in a comment as unsourced, and the off-book message scopes itself honestly (`"a four-ply material check finds no punishment for it here"`).

## 3. Provenance problems

- **`kolt` (game)** — SRC is `irlchess.com/2025/08/14/koltanowski-simuls-and-match-v-ohanlon-1937/`, a blog article, not a game score database. The line name asserts "Dublin 1937" and ply25 asserts `"Black played 13...f6 here"`. Neither the venue nor the 13...f6 continuation is verifiable from this repo; both need checking against that page. No rating pairs are claimed anywhere (good).
- **`ohanlon` (game)** — SRC is a 365chess `gid`. The 20-move score stored matches the well-known Colle–O'Hanlon, Nice 1930 (…12.Bxh7+ Kxh7 13.Ng5+ Kg6 14.h4 … 20.Qb3 1-0). Only risk is the gid pointing elsewhere; not checkable offline.
- **`soltis` / `soltis-trap` (book)** — SRC for both is the *same chess.com forum thread* (`.../colle-system3?page=3`). This is Soltis **second-hand**: a forum poster relaying a book recommendation. The `src` display strings (`"Soltis: 5.cxd3, not 5.Qxd3"`, `"Soltis: why 5.Bxf5 misfires"`) present it as Soltis's own text. Also `soltis-trap` ply8 attributes a *Black* recommendation to Soltis (`"Soltis's recommendation for Black: keep the bishop"`).
- **`rudel` (book)** — named `"Zuke 'Em quick-start line"` but SRC is a chess.com *article*, not the book. Second-hand the same way unless that article is Rudel's own.
- **`cz-tab` (theory)** — ply22 `"Sadler flags this as the critical move"` is a direct attribution to the linked blog; needs a read of that post to confirm it says so.
- **`ck`, `cz`, `anti`, `colle-kid`** all point at the single Wikipedia `Colle_System` page as SRC while carrying detailed move-by-move plans that page does not plausibly contain. `colle-kid` is at least honestly tagged `model` with `src:"model setup, not theory"`.
- **`eco` spot-check (7 White eco lines checked, not 3):** all match the TSV **move for move** — `eco-gru` (D04), `eco-trad` (D05), `eco-ptero` (A40), `eco-rham` (A04), `eco-kid` (A48), `eco-torre` (D03: `1.d4 d5 2.Nf3 Nf6 3.Bg5 e6 4.e3 c5 5.c3 Nbd7 6.Nbd2 Bd6`), `eco-london` (D02: `…5.Nbd2 e6 6.c3`). One deviation, in names only: four drop the upstream `"Queen's Pawn Game: "` prefix (`eco-gru`, `eco-trad`, `eco-torre`, `eco-london`). Moves are verbatim; the verbatim rule is met.
- Note: `eco`-tagged lines carry authored evaluative notes (see `eco-kid` ply8 above, `eco-gru` ply8 `"which is why the repertoire switches to the b3/Bb2 build here"`). The tag covers the moves, not the prose — worth making explicit.

## 4. Suspected coverage gaps — **hypothesis only, no frequency data** (lichess explorer API blocked here)

Move orders actually covered after 1.d4 in the White chapter:
- `1...d5 2.Nf3 Nf6 3.e3` then **...e6** (ck, cz, rudel, syn-qf3, syn-ne4, syn-clamp, syn-greek), **...c5** (kolt, ohanlon, syn-e5colle), **...Bf5** (anti, trap, soltis, soltis-trap), **...Bg4** (anti-bg4), **...g6** (eco-gru), **...c6** (syn-slav); plus 3.Bg5 (eco-torre) and 3.Bf4 (eco-london) sidesteps.
- `1...Nf6 2.Nf3` then **...g6** (colle-kid, eco-kid), **...e6 3.e3 c5** (cz-tab, eco-trad), **...e6 3.e3 b6** (syn-qid).
- `1...g6` (eco-ptero), `1...c5` (syn-benoni), `1...f5` Leningrad (syn-dutch), `1.Nf3 c5` Reti order (eco-rham).

Not covered anywhere (the gap hypothesis):
1. **Early ...Qb6** hitting b2/d4 — the single most common club reply to b3/Bb2 Zukertort; nothing in LINES answers it.
2. **...Bb4+** (`1.d4 Nf6 2.Nf3 e6 3.e3 Bb4+`) — `eco-trad`'s note advertises keeping it out of the move order, but no line shows what to do if it comes.
3. **...Be7 setups** instead of ...Bd6 — every mainline Colle here assumes ...Bd6.
4. **Dutch other than Leningrad**: no Stonewall (...e6/...d5/...f5), no Classical Dutch.
5. **Grünfeld proper** (...d5 + ...g6 + ...c5 with a real ...dxc4/central strike) — `eco-gru` is an 8-ply signpost only.
6. **King's Indian proper** with ...d6/...e5/...Nbd7 — `eco-kid` is 8 plies, `colle-kid` is a model ...g6 line.
7. **Benoni-style ...c5 met by d5** — explicitly declined by `syn-benoni` ply3 rather than covered.
8. **...Nc6 systems**: Chigorin-ish `1.d4 d5 2.Nf3 Nc6`, Black Knights Tango `1.d4 Nf6 2.Nf3 Nc6`.
9. **1...e6** move order (French/Nimzo-hybrid players) and **1...d6 / 1...b6 (Owen's) / 1...Nf6 2.Nf3 b6 without ...e6**.
10. **Early ...cxd4 exchanges** by Black before White is set up, and **...c4 clamp outside the Koltanowski** (syn-clamp covers only the c3 version).
11. **...Ne4 in the Koltanowski** (syn-ne4 is Zukertort-only).
12. **Queen sorties other than ...Qa5+**: ...Qd6, ...Qb6 (above), ...Qa5 without check.
13. **Early ...Bf5/...Bg4 answered quietly** — `anti` (4.c4) and `anti-bg4` (h3/g4 hunt) are both committal; no calm Be2/Qb3/Nbd2 alternative is offered.
14. **Black delaying or forgoing castling / queenside castling** — every Colle line assumes ...O-O into the crosshairs.

## 5. Annotation marks on Colle lines (8 total)

| id | KIND | ply | SAN | Does the line's own source use the mark? |
|---|---|---|---|---|
| ck | theory | 17 | `e4!` | **No evidence** — SRC is the Wikipedia Colle System page. |
| kolt | game | 21 | `e5!` | **Unverified** — SRC is a blog post; game scores there are unlikely to carry it. |
| ohanlon | game | 23 | `Bxh7+!` | **Unverified** — SRC is a 365chess game page (unannotated). The line's own ply39 note says the sacrifice's `"soundness is still argued"`, which sits awkwardly with a bare `!`. |
| anti | theory | 7 | `c4!` | **No evidence** — mark also baked into the display field `src:"4.c4! leave the system"`. |
| colle-kid | **model** | 7 | `b3!` | **Cannot have a source** — `model` means written for this trainer; a quality mark on it is this repo's own verdict. Strongest flag. |
| anti-bg4 | theory | 7 | `h3!` | **Unverified** — chessdoctrine.com. |
| rudel | book | 21 | `Rf3!?` | **Plausible but second-hand** — attributed in-note to "the book's bet" while SRC is a chess.com article, not *Zuke 'Em*. |
| soltis | book | 9 | `cxd3!` | **Second-hand** — SRC is a chess.com forum thread; mark also baked into `src:"Soltis: 5.cxd3, not 5.Qxd3"`. |

Per CLAUDE.md these marks are presentation-only (stripped by `test/verify.mjs`), and the policy is "do not add a new mark unless the line's own source uses it". By that standard `colle-kid`'s `b3!` is the clearest violation, with `ck`'s `e4!` and `anti`'s `c4!` next.
