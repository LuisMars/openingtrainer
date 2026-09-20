# Exchange contracts, v1

Status: active. Version this file (v2, v3…) rather than silently changing a field.
Scope: [REPERTOIRE-PLAN.md](../REPERTOIRE-PLAN.md), [IMPLEMENTATION-WAVES.md](../IMPLEMENTATION-WAVES.md).

These are the record shapes lanes A–E exchange. They describe *research and
analysis artefacts under `research/`*, not the shipped `src/data/lines.js` shape,
which stays as it is until a wave explicitly migrates it.

## Shared primitives

| Field | Rule |
|---|---|
| `id` | Stable, kebab-case, unique for the lifetime of the record. Never reused after deletion. Existing `LINES[].id` values are already stable IDs; new ones take a lane prefix (`c-` Colle, `h-` Hippo). |
| `fen` | Full FEN as `fenOf(pos)` in `src/engine.js` produces it. |
| `key` | Position identity: exactly what `keyFen()` in `src/app.js` produces — `fenOf` with the en-passant field blanked unless an en-passant capture is actually legal. Castling rights are preserved. Transpositions share one `key`. |
| `uci` | Full UCI including promotion suffix (`e7e8q`). Never a 4-character truncation of a promotion. |
| `san` | Exactly what `san()` in `src/engine.js` produces, with no annotation mark. Marks (`!`, `?`, `!?`) live in a separate `mark` field, never inside `san`. |
| `ply` | 0-based index into a line's `moves` array. |

## Evaluation

Reuses the shipped `EVL` shape and is bound by its documented convention:

- `{d: depth, m: [[uci, san, cp, mate], …≤5 best-first], pv: [san, …]}`
- Exactly one of `cp` / `mate` is non-null per entry.
- **Sign: side-to-move relative.** Positive `cp` favours the player to move;
  `mate > 0` means the player to move mates. `EVL_PROBE` guards this.
- A mate is never expressed as centipawns and never printed as a pawn count.

Analysis records add:

| Field | Meaning |
|---|---|
| `engine` | e.g. `sf16-7 (lila-stockfish-web 0.0.11)` |
| `depth` | fixed search depth used |
| `analysis` | `checked` \| `provisional` \| `unknown`. `unknown` is the default for any move not analysed; it carries no penalty. |

## Move grading record

```
{ key, uci, san, cp|mate, lossCp, verdict, why, reply }
```

- `lossCp` — centipawn loss relative to the best analysed move, same perspective.
- `verdict` — `best` | `equal` | `concession` | `inferior` | `losing` | `unknown`.
  `unknown` when `analysis === "unknown"`. Thresholds are **provisional**
  (0.5 / 1.0 pawns) and recorded per policy version in `research/GRADING.md`;
  they are calibrated in Wave 2, not assumed here.
- Rank in the top five identifies a *candidate*; it never by itself makes a move
  acceptable. A move that allows forced mate or throws a decisive advantage is
  rejected at any rank.
- `reply` — full UCI of the opposing answer actually shown, or `null` at a
  branch endpoint.

## Source / claim reference

```
{ src: "<url or citation>", retrieved: "YYYY-MM-DD", claim: "<the exact thing it supports>", confidence: "primary" | "secondary" | "unverified" }
```

`secondary` covers second-hand attribution (e.g. Soltis quoted by another author)
and is never upgraded to `primary` without inspecting the original. An ECO entry
supports an **opening name only**; a game score supports **moves played only**,
never a recommendation.

## Frequency record

```
{ key, reply_uci, reply_san, games, share, parent_games, pool, filters, retrieved }
```

- `pool` — `player` | `master`. The two are **never merged or compared directly**.
- `filters` — the exact filter set applied (rating band, time control, date range,
  source file). Recorded verbatim, not summarised.
- `parent_games` — games reaching the position, so conditional reply share
  (`games / parent_games`) stays distinguishable from probability of reaching it.
- A share computed from fewer than 30 parent games is reported with its count and
  treated as an observation, not a frequency estimate.
- **Neither frequency nor win rate establishes move quality.** A tactical claim is
  never inferred from a frequency record.

## Coverage matrix row

```
{ setup, move_orders[], key, freq_ref, threat, candidates[], structure, sources[], confidence, coverage }
```

`coverage` — `covered` | `partial` | `missing`. `confidence` — `checked` |
`provisional` | `gap`. A missing data source is recorded as `gap`; it is never
replaced with an invented number.

## Data-source limitations (recorded, not worked around)

- The **lichess opening explorer API** (`explorer.lichess.ovh`) returns HTTP 401
  through this environment's proxy. It is unavailable. Frequencies are therefore
  counted locally from the sources below, and any figure states which.
- **Player pool**: monthly dumps from `database.lichess.org` (CC0). Rating and
  time control come from the PGN headers, so filters are exact and recordable.
- **Master pool**: curated opening collections from `pgnmentor.com`. These are a
  *curated selection of strong-player games*, not a complete database; a share
  from this pool is "share within this collection" and must say so.
