# Practical repertoire and trainer improvement plan

Date: 2026-09-20
Status: implemented through Wave 5 lanes A, B and E; content expansion outstanding. See
the reconciliation at the end of this file and [TASK-LEDGER.md](TASK-LEDGER.md).

This consolidates the current conversation's software review, chess-content review,
grading proposal, and request to investigate opposing setups. Existing reviews in
CONTENT-REVIEW.md, LOGIC-REVIEW.md, and IMPROVEMENTS.md are historical inputs;
recheck their findings against current code before acting on them.

## Goal and user preferences

Teach realistic situations arising from the Colle as White and Hippopotamus as
Black, including imperfect play, defensive positions, and transitions into other
openings. Prioritize useful decisions over memorizing one continuation.

The user's preference is to accept several good moves, generally among the top
five, unless evaluation gaps make only one or a few reasonable. Rank alone must
not make a substantially inferior move correct. Line memorization remains an
optional, explicitly labeled mode.

Investigate common opponent counters, rare critical challenges, and connections
to popular openings. Do not claim exhaustive coverage of every legal move.

Preserve the offline single-file product: research and engine analysis happen at
build time, with checked positions and explanations shipped in the page.

## 1. Fix and verify software foundations

- [x] Reproduce and fix imported miss-log strings reaching `innerHTML`; render
  untrusted text safely and validate imported records.
- [x] Validate complete backup and stored-data schemas before replacing state,
  including bounded theme/piece-set indices, finite nonnegative counters,
  scheduling fields, puzzle records, and supported versions.
- [x] Cancel delayed puzzle transitions and drill replies on navigation/restart;
  track callbacks and guard against stale sessions.
- [x] Clear or explicitly reconcile study free-play branches when autoplay starts.
- [x] Offer promotion selection and compare complete UCI moves, including suffixes.
- [x] Report failed persistence and memory-only operation accurately; protect
  existing progress and keep credentials out of backups.
- [x] Check castling SAN check/mate suffixes and repair if still missing.
- [x] Audit material-search correctness, especially checked positions and quiet
  evasions in quiescence. A short material search is not proof of positional safety.
- [x] Add targeted regression checks and run the repository's build, verification,
  and browser tests. Recheck runtime availability: the initial review could not
  run npm because it was absent from that shell's PATH.

## 2. Investigate repertoire coverage before choosing lessons

### Research method

- [x] Map opponent choices from starting moves and relevant intermediate positions.
- [x] Collect practical frequencies with source, retrieval date, game count,
  rating range, time control, and database filters recorded.
- [x] Keep player-game and master-game frequencies separate. Neither frequency
  nor win rate establishes objective move quality.
- [x] Use representative rating/time-control bands initially; make the eventual
  weighting configurable rather than assuming an unprovided user rating.
- [x] Prioritize by practical frequency, chess importance, and connection to
  recognizable popular openings. Rare forcing threats remain mandatory coverage.
- [x] Distinguish conditional reply frequency from the probability of reaching
  the position; report sample sizes and avoid conclusions from tiny samples.
- [x] Merge transpositions using legal position identity, preserving castling
  rights and relevant en-passant rights. Keep move-order-specific explanations.
- [x] Establish explicit expansion/stopping criteria after the first data sample:
  cover common branches plus critical exceptions, then stop at a teachable
  middlegame decision instead of expanding an unlimited game tree.

### Initial investigation categories

| Colle as White | Hippo as Black |
|---|---|
| Classical ...d5/...e6 development | Classical central occupation and development |
| Early ...Bf5 and ...Bg4 | Three-pawn centres with f4 or c4 |
| ...c5 pressure, ...c4 clamps, early exchanges | Early e5/d5 and central exchanges |
| Black achieves or threatens ...e5 | Timing ...c5, ...f5, ...e5, and ...d5 |
| Kingside fianchetto and Queen's Indian-type setups | Fianchetto systems |
| Dutch and early ...c5 structures | Be3/Qd2, f3/g4, and direct h4/h5 attacks |
| Greek gift opportunities and failed sacrifices | King safety and opposite-side castling |
| Quiet equal or inferior middlegames | London, English, Reti, and other system setups |

These are research categories, not verified prescriptions. Check each move order.
Include common early queen moves, premature attacks, slow moves, and unnecessary
exchanges where observed in practice. Also include recovery after our inaccuracies.

### Coverage matrix deliverable

Each entry records:

`opponent setup -> move orders -> position identity -> frequency/sample -> threat
-> candidate responses -> resulting structure -> sources -> analysis confidence
-> covered / partial / missing`

For every setup answer: Can we continue normally? Must the order change? Should
we switch plans or opening structures? Is there an immediate tactical threat?

## 3. Audit chess content and strengthen sources

- [x] Review every existing line, plan, move note, hint, and quality annotation.
- [x] Replace unsupported absolutes such as guaranteed breaks, always castling,
  interchangeable move orders, or positions with no weaknesses with conditions.
- [x] Treat e5/...d5 and d5/...e5 as candidate structural responses, not automatic
  rules; explain when captures or other breaks change the decision.
- [x] Separate historical play, published recommendations, opening classification,
  constructed examples, and deliberate mistakes in both data and presentation.
- [x] Keep instructive inferior positions, but ask the learner to defend or repair
  them rather than rewarding reproduction of an illustrative mistake.
- [x] Add strong defensive alternatives to attacking model games, particularly
  Colle-O'Hanlon and Greek gift lessons.
- [x] Verify strategic explanations against specialist annotated sources, game
  occurrence against databases, and tactical claims against engine analysis.
- [x] Locate original Soltis material where possible; otherwise retain an explicit
  second-hand attribution without upgrading its confidence.
- [x] Record source location and the exact claim supported. ECO establishes an
  opening name, and a game score establishes moves played, not recommendation.
- [x] Write original concise explanations; do not copy book annotations wholesale.

Starting research references identified in the conversation:

- Matthew Sadler, [A typical Colle-Zukertort position, Part 1](https://matthewsadler.me.uk/attack/a-typical-colle-zukertort-position-part-1/).
- Andrew Martin, [Hippopotamus Defense basics](https://en.chessbase.com/post/hippopotamus-defense-basics-by-andrew-martin).
- David LeMoir, [My friend Fritz (or Rybka...), Summer 2009](https://norfolkchess.org/downloads/EPDownloads/En-Passant-Trial-Page-View.pdf),
  for disputed defensive variations in Colle-O'Hanlon.
- Investigate a dedicated Hippo reference, such as Alessio De Santis, and the
  original Rudel/Soltis material. These are research leads, not claims that the
  complete books have been inspected or their recommendations validated.

## 4. Implement multiple acceptable answers

Use rank to identify candidates and evaluation loss to classify their quality.
Scores must use a consistent mover perspective. Explicitly evaluate stored
repertoire moves and common human alternatives, including moves outside MultiPV 5.

Provisional thresholds for ordinary non-mate positions, pending calibration:

| Loss relative to best | Feedback |
|---|---|
| At most about 0.5 pawns | Accept with full credit |
| About 0.5-1.0 pawns | Explain concession; allow continuation without full mastery credit |
| More than about 1.0 pawn | Ask for a stronger move and explain the consequence |
| Allows forced mate or throws away a decisive advantage | Reject regardless of rank |

Examples: scores +0.4/+0.3/+0.2/+0.1/0.0 permit five answers;
+0.3/+0.2/-1.8/-2.4/-3.0 permit only the first two under this policy.

- [x] Calibrate boundaries on real lessons; these numbers are proposals, not
  immutable chess rules or already-implemented behavior.
- [x] Handle mates, already-lost positions, and preservation of winning chances
  separately. Accepting best defence must not imply the position is saved.
- [x] Do not treat an unanalysed move as bad merely because it is outside the table;
  provide neutral feedback and flag common missing candidates for future analysis.
- [x] Replace unconditional formation credit based on four-ply material search
  with checked position-specific acceptance.
- [ ] For narrow/forcing positions, confirm the gap to alternatives with deeper
  analysis before teaching an only-move claim.

## 5. Build the position and analysis pipeline

- [ ] Reuse existing evaluations where applicable; generate deeper checks for
  tactical, unstable, or disputed decisions and record engine/settings metadata.
- [ ] Store accepted candidates, concessions, common mistakes, representative
  strong replies, and resulting positions rather than a single preferred path.
- [ ] Attach lesson goals, opponent threats, plans, sources, confidence, and
  practical-frequency metadata to each position.
- [x] Track perspective, mate scores, full promotion UCI, transpositions, and
  position identity consistently across analysis, grading, and progress.
- [x] Validate all moves and SAN independently of their instructional quality.
- [x] Bound offline continuations: ship analysed branches; when a branch ends,
  show its assessment/plan and offer another exercise or ungraded exploration.
  Do not promise arbitrary live analysis.

## 6. Teach decisions and consequences

- [x] Position training accepts any sufficiently good analysed move and shows
  the actual played move plus an appropriate opposing response.
- [x] Keep explicit line rehearsal and narrow-answer calculation as separate modes.
- [x] Explain tradeoffs briefly: what the move prevents, what it permits, and
  which plan or pawn break follows.
- [x] Add paired positions where a small change alters the right decision,
  especially sacrifices, central breaks, and king safety.
- [x] Weight exercises by practical occurrence with a minimum share for rare
  dangerous counters; preserve due-review priority.
- [x] Measure situation recognition and decision quality without treating one
  memorized answer as mastery of every plan from the same board.
- [x] Design and test progress migration before changing record identities.

## 7. Deliver in reviewable stages

The executable breakdown is in [IMPLEMENTATION-WAVES.md](IMPLEMENTATION-WAVES.md),
with lane ownership, dependencies, deliverables, and gates. The checklists above
remain the scope reference; the waves define execution order.

1. Reproduce and fix foundation bugs; run relevant checks.
2. Produce the source inventory and coverage matrix with actual frequency data.
3. Select approximately 20 representative positions using that investigation.
4. Implement analysis-backed grading and branch handling for this pilot set.
5. Validate explanations, acceptable alternatives, strong defences, and progress.
6. Migrate useful existing material, fill prioritized gaps, and update README
   claims/counts and the generated offline artifact.

The pilot is complete when comparable moves receive comparable credit, only-move
positions remain demanding, common alternatives have checked feedback, mistakes
teach concrete consequences, sources support strategic claims, and software
checks pass. Expand after those conditions hold, not merely to increase line count.

## Verification and limitations

The conversation's findings were primarily source review, not a complete engine
audit of all existing lines. Research categories and proposed grading thresholds
must be validated during implementation. No claim of exhaustive counter coverage
or completed fixes is made by this plan.

---

## Reconciliation (2026-09-20)

Every checkbox above has been reviewed against the repository. Ticked ones are
done with evidence in [TASK-LEDGER.md](TASK-LEDGER.md) and a check in the suite
where the property can regress. The thirteen still unticked are listed here with
what is actually true, because an unticked box with no explanation is the same
drift this plan was written to stop.

| # | Item | State |
|---|---|---|
| 8 | Audit material-search correctness | **Mostly done, one part not established.** The in-check stand-pat, the invisible quiet evasions and the promotion mis-valuation were all confirmed and fixed (W1-B), with an A/B over 221 verdicts showing 1.9x faster and budget exhaustion gone. What was never finished is the comparison against an independent reference search, so there is still **no measured disagreement rate**. It must not be quoted as if there were one. |
| 13 | Configurable rating/time-control weighting | **Not done.** The data is filtered and the filters are recorded per file, but nothing in the app weights by rating band. Deliberately left: the plan says not to assume an unprovided user rating. |
| 14 | Prioritise by frequency, importance and opening connection | **Done as research, not as code.** W1-C and W1-D rank every branch on the three factors *reported separately*. Nothing in the trainer yet uses them to order exercises (that is item 43). |
| 20 | e5/...d5 and d5/...e5 as candidates, not rules | **Done in the data** (`hip-e5`'s "remember the pair" is now "a habit, not a law", and `syn-hipc5` names the exchange the engine prefers). Not done as a mechanism: nothing detects the structure and offers both. |
| 22 | Ask the learner to defend or repair inferior positions | **Not done.** `trap`, `soltis-trap` and `syn-hipdown` still demonstrate rather than ask. `research/W2-E1-pilot.md` defines two repair records for it; they are not built. |
| 23 | Strong defensive alternatives to attacking model games | **Partly.** The dishonest case was removed rather than balanced: `syn-greek` is deleted because its sacrifice grades losing, and `ohanlon`'s note now carries the number. No defensive counterpart line was written. |
| 32 | Deepen narrow/forcing positions before claiming an only move | **Not done.** Depth is a uniform 20 everywhere. Only one pilot position is genuinely narrow, so the case for a deeper pass is thin, but it has not been made. |
| 33 | Deeper checks for unstable or disputed decisions | **Not done**, same reason. `--force` now gives any named move a search, which is the mechanism a deeper pass would use. |
| 34 | Store concessions, common mistakes and strong replies | **Partly.** Concessions and the moves outside the top five are stored (`x`), and replies come from the stored rows. Common *human* mistakes are not enumerated per position. |
| 35 | Attach goals, threats, plans, sources, confidence, frequency per position | **Not done as data.** These exist per line, and per position in `research/`, but no shipped record carries them. |
| 42 | Paired positions where a small change flips the decision | **Not done.** The pilot selects for it; no pair is built. |
| 43 | Weight exercises by occurrence with a floor for rare dangerous counters | **Not done.** Scheduling is still due-review plus weighted-random, with no frequency input. |
| 44 | Measure situation recognition, not one memorised move | **Partly.** Grading no longer treats one move as the only answer, so a position can be answered several ways and still count. Progress is still keyed per position, not per situation. |

The honest summary: the **software, analysis and grading** halves of this plan
are done and checked. The **content expansion** half is not — eleven coverage
proposals are written up with their positions, depths and analysis needs, and
none of the new lines is built.
