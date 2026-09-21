# Implementation waves and lanes

Status: Waves 0-5 complete with their gates met, and every item in
REPERTOIRE-PLAN.md ticked (2026-09-21). Content gaps that remain are recorded,
not closed: the coverage matrix lists 235 replies with no line, among them rare
forcing ones such as 3...Bb4+ (see research/METHOD.md). Per-task status, artifacts and validation
evidence are in [TASK-LEDGER.md](TASK-LEDGER.md); the original plan's checklist
is reconciled at the end of [REPERTOIRE-PLAN.md](REPERTOIRE-PLAN.md).
Scope: [REPERTOIRE-PLAN.md](REPERTOIRE-PLAN.md).

Waves are integration milestones. Lanes are workstreams that can run in parallel
where dependencies permit; they do not require simultaneous agents or a fixed
team size. Complete a task's prerequisites before starting dependent work.

## Lane ownership

| Lane | Responsibility | Primary ownership |
|---|---|---|
| A — Application | Storage, navigation, input, training experience | `src/app.js`, HTML, CSS, browser regressions |
| B — Chess analysis | Position identity, legal moves, evaluation generation, grading policy | `src/engine.js`, analysis tools, grading fixtures |
| C — Colle research | Counter coverage, sources, candidate moves, explanations | Colle research and lesson records |
| D — Hippo research | Counter coverage, sources, candidate moves, explanations | Hippo research and lesson records |
| E — Integration and validation | Shared schemas, migrations, combined data, release gates | Contracts, build wiring, assembled data, acceptance checks |

File ownership is a coordination rule, not a restriction on who can contribute.
App grading integration belongs to A; its pure policy and fixtures belong to B.
E integrates changes to shared data files and `test/verify.mjs` to avoid competing
edits. C and D prepare separate records instead of concurrently editing `lines.js`.
Only E regenerates `docs/index.html` at integration points; never edit it manually.

Every task handoff includes changed files, evidence or sources, validation run,
unresolved questions, and dependencies for the next task. Research findings must
distinguish observed frequency, engine assessment, and instructional judgment.

## Wave 0 — Establish the baseline and contracts

Purpose: reproduce current problems and agree on what later lanes exchange.

| Task | Lane | Work and deliverable | Depends on |
|---|---|---|---|
| W0-A | A | Reproduce import, timer, autoplay, promotion, and persistence issues; record actual behavior | None |
| W0-B | B | Inspect engine/evaluation format; check score perspective, SAN, identity, and material-search limitations | None |
| W0-C | C | Inventory Colle lessons, missing sources, unsupported claims, and suspected coverage gaps | None |
| W0-D | D | Equivalent Hippo inventory, including move-order exceptions and popular-system transitions | None |
| W0-E | E | Locate runtime; run baseline checks; define versioned research/position/analysis contracts and task ledger | None; incorporate A–D findings |

The initial contract specifies stable lesson IDs; FEN/position identity; full UCI;
source/claim references; frequency filters and sample counts; evaluation perspective
and mate encoding; analysis status; and coverage status. It may evolve through a
versioned change, but downstream lanes must not silently invent incompatible fields.

Gate: baseline results are recorded, failures are classified as existing or new,
and research/analysis records can be exchanged without ambiguity. A missing data
source is recorded as a limitation, never replaced with invented popularity numbers.

## Wave 1 — Repair foundations and map opponent counters

These tracks can proceed independently after their Wave 0 prerequisites.

| Task | Lane | Work and deliverable | Depends on |
|---|---|---|---|
| W1-A | A | Safe import rendering; complete import/load validation; cancel stale callbacks; repair autoplay; promotion chooser/full UCI; honest persistence feedback | W0-A, W0-E |
| W1-B | B | Correct confirmed SAN/search defects; implement reusable identity and candidate-analysis checks; retain offline behavior | W0-B, W0-E |
| W1-C | C | Collect Colle reply frequencies and sources; map common, critical, and popular-opening branches | W0-C, W0-E |
| W1-D | D | Equivalent Hippo research, including pawn storms, broad centres, and system opponents | W0-D, W0-E |
| W1-E | E | Integrate fixes and focused regression tests; merge research into the coverage matrix | W1-A–D handoffs |

Research rules:

- Record retrieval dates, game counts, rating/time-control filters, and access limits.
- Keep masters and player databases separate; distinguish conditional reply
  frequency from encounter probability along a path.
- Include common imperfect moves and recovery after our mistakes.
- Preserve rare forcing counters regardless of popularity.
- Mark transpositions and opening connections without assuming identical plans.
- Propose evidence-based branch cutoffs and stopping positions after sampling.

Gate: reproduced foundation defects are fixed and checked; both openings have a
traceable coverage matrix. Every priority branch has either supporting data or an
explicit research gap. Critical tactical claims have not been inferred from frequency.

## Wave 2 — Select the pilot and build analysis-backed grading

Purpose: choose approximately 20 useful positions from research, then prove the
grading model before implementing the full training interface.

| Task | Lane | Work and deliverable | Depends on |
|---|---|---|---|
| W2-E1 | E with C/D | Select pilot positions from coverage matrix; lock versioned lesson/branch schema | W1-C, W1-D, W0-E |
| W2-B | B | Generate candidate scores and strong replies; implement pure grading policy with edge-case fixtures | W1-B, W2-E1 |
| W2-C | C | Draft Colle pilot explanations, common mistakes, paired examples, and claim-level citations | W2-E1; finalize after W2-B |
| W2-D | D | Equivalent Hippo pilot records and conditional plans | W2-E1; finalize after W2-B |
| W2-A | A | Design mode/state transitions and feedback using contract fixtures; design progress migration | W1-A, W2-E1 |
| W2-E2 | E | Validate assembled pilot records, compare classifications with explanations, and resolve contradictions | W2-A–D |

Pilot selection must represent both openings and include broad-choice, narrow-choice,
quiet, tactical, inferior/defensive, transposed, and opening-transition situations.
Do not choose all positions merely because existing analysis makes them convenient.

Grading requirements:

- Top five is a candidate set, not five automatically correct moves.
- Start with the plan's provisional 0.5/1.0-pawn loss boundaries; calibrate on
  pilot examples and record the policy/version actually selected.
- Analyze common human alternatives and stored repertoire moves explicitly,
  including candidates outside the first five.
- Handle forced mate, already-lost positions, and lost winning chances separately.
- Return an explicit unknown classification for unanalysed moves, without penalties.
- Deepen unstable or only-move cases; omit unsupported verdicts pending review.
- Eliminate positional approval based solely on a short material search.

Gate: every graded pilot answer has checked analysis, consistent score perspective,
an explanation, and a legal continuation or explicit branch endpoint. Fixtures cover
five comparable moves, only one/two good moves, promotion, unknown moves, mate,
and best defence in a lost position. Migration design preserves existing exports.

## Wave 3 — Deliver the complete pilot experience

| Task | Lane | Work and deliverable | Depends on |
|---|---|---|---|
| W3-A | A | Integrate position training, line rehearsal, and calculation; show actual selected moves, replies, tradeoffs, and unknown feedback | Wave 2 gate |
| W3-B | B | Support integration cases; verify branching legality, candidate lookup, and analysis consistency | Wave 2 gate |
| W3-C | C | Play through Colle pilot paths; check explanations, hints, and opponent resistance | W3-A build available |
| W3-D | D | Equivalent Hippo walkthrough, emphasizing when normal setup moves fail | W3-A build available |
| W3-E | E | Integrate migration and progress checks; run offline and browser acceptance scenarios; document pilot limitations | W3-A–D |

Define mastery by demonstrated decisions in a situation, not one memorized move.
Maintain distinct line-rehearsal records where needed. Unknown answers neither
damage mastery nor create false success. At an offline branch endpoint, explain
the resulting plan and offer another exercise or clearly ungraded exploration.

Gate: all pilot cases work end to end; the actual played move remains on the board;
several good moves receive fair credit; only-move cases remain demanding; hints do
not leak answers; progress survives export/import and migration; no unintended
network requests occur. Existing modes continue to pass their checks.

## Wave 4 — Expand coverage and finish the content audit

Expansion is driven by missing situations, not a target line count.

| Task | Lane | Work and deliverable | Depends on |
|---|---|---|---|
| W4-C | C | Audit remaining Colle content; add highest-priority missing situations and defensive alternatives | Wave 3 gate |
| W4-D | D | Audit remaining Hippo content; add counters, popular-opening transitions, and recovery positions | Wave 3 gate |
| W4-B | B | Analyze each content batch; deepen unstable decisions and verify accepted alternatives | W4-C/D candidate handoffs |
| W4-A | A | Add situation-level progress and calibrated frequency weighting, preserving due-review priority and rare-counter exposure | Wave 3 gate; W1 frequency data |
| W4-E | E | Integrate small validated batches, track coverage and artifact size, and reconcile every original-plan checkbox | W4-A–D handoffs |

For each batch, prioritize observed frequency, criticality, and opening connection
separately rather than hiding them in an unexplained score. Pair attack lessons with
defensive resources. Reclassify illustrative losing lines as situations to solve.
Retain unresolved source claims as explicit gaps or remove the unsupported wording.

Gate: all existing annotations have a recorded disposition; priority coverage
targets established in Wave 1 are met or explicitly deferred with reasons; every
new graded position passes the same analysis and explanation checks as the pilot.

## Wave 5 — Release verification and documentation

| Task | Lane | Work and deliverable | Depends on |
|---|---|---|---|
| W5-A | A | Final navigation, keyboard/touch, promotion, persistence, and accessible-feedback checks | Wave 4 gate |
| W5-B | B | Final legal-data, score-sign, mate, grading-boundary, and analysis-metadata checks | Wave 4 gate |
| W5-C | C | Final Colle source and coverage reconciliation | Wave 4 gate |
| W5-D | D | Final Hippo source and coverage reconciliation | Wave 4 gate |
| W5-E | E | Run build/verify/browser suite; regenerate artifact; update README counts, modes, limitations, and migration notes | W5-A–D |

Gate: checks pass on the assembled product, the offline artifact matches source,
documentation matches implemented behavior, and outstanding research gaps are
visible. Produce a reviewable release change; deployment is a separate action.

## Dependency and execution rules

Critical path: baseline/contracts -> coverage matrix -> pilot selection/contracts
-> checked analysis/grading -> integrated pilot -> expansion -> release checks.

Foundation repairs run alongside coverage research. Colle and Hippo research run
independently under the same contract. UI preparation can use fixtures while engine
analysis runs, but production grading cannot ship on placeholder scores.

Do not start broad content expansion before the pilot gate: discoveries about
grading or schemas should affect 20 lessons, not hundreds. A blocked source or
engine run need not stop unrelated lanes; record the blocker and continue tasks
whose inputs are available. Never treat waiting as validation or approval.

Use a task ledger with: task ID, status (not started / active / blocked / done),
owner, dependency, changed artifacts, validation evidence, and next handoff.
All tasks above start as not started. Mark completion only when the deliverable
and its checks exist, not when a plan or draft has been written.
