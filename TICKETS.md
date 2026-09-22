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

None open.

---

## Bugs

**VERIFY — Check the in-system rule on a phone.** The rule shipped in
`5858f8a`; a person must look at it on a phone:
- Colle move 1 answered: arrows for d4 and Nf3, none for e4.
- 1.e4 refused as "not a Colle move here".
- The Rhamphorhynchus 1.Nf3 order credited.
- An out-of-order Hippo wall move credited.
- The `h-nf3bc4` castling arrow over the e8 king.
- Shuffle after 1.d4: a Hippo move is credited, and no Black-to-play board
  is labelled "Colle as White".
Files: none unless a check fails. Done when each check passes on a phone.

---

## Features

**FEAT — The rest of the coverage gaps.** 210 replies in
`research/COVERAGE-MATRIX.md` have no line. Take them in the order the
matrix ranks them, in batches. Done per batch as above.

