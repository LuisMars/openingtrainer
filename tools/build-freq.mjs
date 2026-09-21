#!/usr/bin/env node
/* Builds src/data/freq.js: how often each drilled position is actually reached,
   bucketed, plus the short list of rare-but-forcing positions that carry a
   weight floor. Run after a build:

     node build.mjs && node tools/build-freq.mjs && node build.mjs

   Every number comes from research/freq-*.json and research/choices-player.json,
   and nothing is invented here. The occurrence of a position we must move in is
   the count of games that played the opponent reply leading into it, divided by
   that pool's games_in_tree; contributions from different parents (transpositions)
   are summed within a pool, and the larger of the two pools is kept. This is done
   once per rating band, each band from its own pair of files.

   Those two files are built by tools/count-replies.mjs, one run per trained side
   (--side w for the Colle repertoire, --side b for every line where the learner
   plays Black - the Hippopotamus lines and, since they were added, the two lines
   that defend against the Colle). A line's `you` decides which run should have
   found it; a run built before a line existed cannot find it. research/choices-player.json
   (tools/count-choices.mjs) walks both sides together, straight from the same
   dump, and needs no separate run per line added - so where a drilled position has
   no bucket from its own pool file but choices-player.json shows real games
   reaching it, that count fills the gap: the reply count divided by the matching
   pool's games_in_tree (the same denominator the pool file would have used), kept
   only above the same 20-game floor `--minGames 20` applies to the pool files. This
   is a gap fill, not a second source of truth: a position the pool file already
   covers keeps that file's number. Positions neither file reached ship no entry at
   all and are neutral in the app - an unmeasured position is not a rare one.

   The sharp list is a chess judgement, not a data result: it is the entries of
   research/W1-C-colle-coverage.md section 3 and research/W1-D-hippo-coverage.md
   section 3 that the repertoire already drills. Each is named by the line and
   the opponent move that creates the position, and the tool fails loudly if
   that move is not where it says it is. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "docs/index.html"), "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const ctx = {};
new Function("ctx", js.slice(0, js.indexOf("/* ================= state ================= */")) +
  "\nObject.assign(ctx,{LINES,START,fenPos,startPos,make,legal,san,uciOf,EVL,posKey});")(ctx);
const { fenPos, startPos, make, legal, san, uciOf, EVL, posKey } = ctx;

// Same hash the app uses (FNV-1a, 32-bit, base 36). Keeping the shipped table
// keyed by a hash rather than by the FEN is what makes it fit the page budget:
// 64-character keys for 88 positions would be 5.5 KB on their own.
const fhash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).padStart(7, "0").slice(-5);
};

const drill = Object.keys(EVL);
{ // a collision would silently give one position another's frequency
  const seen = new Map();
  for (const k of drill) {
    const h = fhash(k);
    if (seen.has(h)) throw new Error("hash collision: " + seen.get(h) + " / " + k);
    seen.set(h, k);
  }
}
const drillSet = new Set(drill);

// The gap-fill source: every drilled position any line reaches, whichever side
// plays it, counted once from the same dump (tools/count-choices.mjs). Keyed by
// the drilled position itself - no parent-plus-reply indirection needed, since
// that tool already tallies at the position we move in. Loaded once; the floor
// (MIN_GAMES_FLOOR) matches --minGames 20, the floor the pool files were built
// with (METHOD.md, "Rating bands").
const CHO = JSON.parse(readFileSync(join(root, "research/choices-player.json"), "utf8"));
const choByKey = new Map(CHO.positions.map((p) => [p.key, p]));
const MIN_GAMES_FLOOR = 20;

// One table per rating band, each counted from the same dump with only the
// rating filter changed (METHOD.md, "Rating bands"). The app never assumes the
// user's rating: it ships the middle band as the default, because that is where
// most of the dump's games fall, and lets the user pick another.
const BANDS = [
  ["under 1500", "u1500"],
  ["1500–1899", "1500-1899"],
  ["1900 and over", "1900"],
];
const DEFAULT_BAND = 1;
const meta = [];
function countBand([label, tag], bandIdx) {
  const best = new Map();
  for (const file of [`freq-colle-player-${tag}.json`, `freq-hippo-player-${tag}.json`]) {
    const j = JSON.parse(readFileSync(join(root, "research", file), "utf8"));
    const sum = new Map();
    for (const node of j.positions) {
      const p = fenPos(node.fen);
      for (const r of node.replies) {
        const m = legal(p).find((x) => uciOf(x) === r.uci);
        if (!m) throw new Error("illegal reply " + r.uci + " at " + node.fen);
        const k = posKey(make(p, m));
        if (!drillSet.has(k)) continue;
        sum.set(k, (sum.get(k) || 0) + r.games);
      }
    }
    for (const [k, g] of sum) {
      const share = g / j.games_in_tree;
      if (!best.has(k) || share > best.get(k)) best.set(k, share);
    }
    const f = j.filters;
    meta.push(`[${label}] ${file}: ${j.games_in_tree} of ${j.games_read} games, avg Elo ` +
      `${f.minElo === null ? "any" : f.minElo} to ${f.maxElo === null ? "any" : f.maxElo}, maxPly ${f.maxPly}, ` +
      `speeds ${f.speeds === null ? "all" : f.speeds}, ${j.retrieved}`);
  }
  let filled = 0;
  for (const k of drill) {
    if (best.has(k)) continue;
    const entry = choByKey.get(k);
    if (!entry) continue;
    const g = entry.parent[bandIdx];
    if (g < MIN_GAMES_FLOOR) continue;
    // CHO's own games_in_tree is the right denominator, not either pool file's: it is
    // built by the same tool from the same walk as the numerator, so numerator <=
    // denominator always holds. It happens to equal the hippo (b-side) pool's own
    // games_in_tree exactly, since a Black-to-move node is touched on nearly every
    // game regardless of repertoire (confirmed for all three bands); for a White-to-move
    // gap - the repertoire's first move, the only kind of position the pool file can
    // structurally never record a parent for - the colle pool's games_in_tree is too
    // small a base (it already presumes the first move matched), so CHO's is used there too.
    best.set(k, g / CHO.games_in_tree[bandIdx]);
    filled++;
  }
  if (filled) meta.push(`[${label}] research/choices-player.json gap fill: ${filled} position` +
    `${filled === 1 ? "" : "s"} their own pool file missed, parent games >= ${MIN_GAMES_FLOOR}, ${CHO.retrieved}`);
  return best;
}

// Six buckets on a log scale. The edges are round numbers chosen once; the app
// turns a bucket into a multiplier and never sees a share, so no reader can
// mistake a bucket for a measured probability.
const EDGES = [0.1, 0.03, 0.01, 0.003, 0.001];
const bucket = (s) => { for (let i = 0; i < EDGES.length; i++) if (s >= EDGES[i]) return 5 - i; return 0; };

// Named by the moves that create the position, not by a line id, so a change
// in src/data/lines.js cannot silently repoint one of them. Each is an entry of
// research/W1-C-colle-coverage.md section 3 or research/W1-D-hippo-coverage.md
// section 3; a position the trainer does not drill is reported and dropped
// rather than shipped as a claim about a position nobody meets.
const SHARP = [
  ["d4 e5", "W1-C 3.1 Englund Gambit: a pawn offered on move one"],
  ["e4 g6 d4 Bg7 Nc3 d6 h4", "W1-D 3.1 the h4 lunge: the answer is timing-bound"],
  ["e4 g6 d4 Bg7 Nc3 d6 Be3 a6 h4", "W1-D 3.1 the same lunge from the Be3 tabiya"],
  ["e4 g6 d4 Bg7 e5", "W1-D 3.5 an early e5 space grab: common below master level"],
  ["d4 Nf6 Nf3 e6 e3 Bb4", "W1-C 3.2 3...Bb4+: a check where the system move is illegal"],
  ["d4 d5 Nf3 c5 e3 cxd4 exd4 Nc6 Bb5 Qa5", "W1-C 3.4 ...Qa5+ from another order: one block keeps the bishop"],
  ["d4 d5 Nf3 Nf6 e3 Bg4 h3 Bxf3", "W1-C 3.5 ...Bxf3 at once: the recapture decides the structure"],
  ["d4 d5 Nf3 c5 e3 cxd4", "W1-C 3.6 ...cxd4 before c3 or b3: the recapture fork"],
  ["e4 g6 Bc4 Bg7 Qf3", "W6 two pieces on f7 before a knight has moved"],
];
const sharp = [];
for (const [pgn, why] of SHARP) {
  let p = startPos();
  for (const tok of pgn.split(" ")) {
    const m = legal(p).find((x) => san(p, x).replace(/[+#!?]/g, "") === tok);
    if (!m) throw new Error("illegal " + tok + " in " + pgn);
    p = make(p, m);
  }
  const k = posKey(p);
  if (!drillSet.has(k)) { console.log("  not drilled, dropped: " + pgn + " - " + why); continue; }
  const h = fhash(k);
  if (!sharp.includes(h)) sharp.push(h);
  console.log("  sharp: " + pgn + " - " + why);
}

const tables = BANDS.map((b, i) => {
  const rows = [...countBand(b, i).entries()].sort((x, y) => y[1] - x[1]);
  const groups = [0, 1, 2, 3, 4, 5].map(() => []);
  for (const [k, s] of rows) groups[bucket(s)].push(fhash(k));
  return { n: rows.length, body: groups.map((g) => g.join("")).join(",") };
});
const out = `// Generated by tools/build-freq.mjs - do not edit. How often a drilled position is
// reached in real games, as a bucket, never as a claimed probability.
// SOURCE: the player pool only - the lichess 2014-01 dump counted into
// research/freq-*-player-<band>.json by tools/count-replies.mjs, once per rating
// band (average of the two players' ratings, lichess 2014 scale), gaps filled
// from research/choices-player.json (tools/count-choices.mjs, same dump, same
// bands) where a pool file predates a line and so never counted it. It is the
// one pool not selected by opening, so the only one that can say how often a
// reply is met (METHOD.md).
${meta.map((m) => "//   " + m).join("\n")}
// SHAPE: FRQ holds one string per band, in FRQ_BANDS order. Each is six
// comma-separated groups, bucket 0 first; each group is the low 5 base-36 digits of
// the FNV-1a hash of keyFen, run together. Bucket 5 is a share of ${EDGES[0]} or more
// of that band's probe tree, then ${EDGES.slice(1).join(", ")}. Of ${drill.length} drilled
// positions, ${tables.map((t, i) => BANDS[i][0] + ": " + t.n).join(", ")} were reached;
// the rest ship nothing and are neutral, never rare.
// FRQ_DEF is the band used until the user picks one: the middle band, where most
// of the dump's games are. It is not a guess at the user's rating.
// FRQ_SHARP: a weight floor, from W1-C/W1-D-coverage.md section 3 - a chess
// judgement, not a data result, and the same in every band.
const FRQ_BANDS=${JSON.stringify(BANDS.map((b) => b[0]))};
const FRQ_DEF=${DEFAULT_BAND};
const FRQ=${JSON.stringify(tables.map((t) => t.body))};
const FRQ_SHARP="${sharp.join("")}";
`;
writeFileSync(join(root, "src/data/freq.js"), out);
console.log(`wrote src/data/freq.js: ${tables.map((t) => t.n).join("/")} of ${drill.length} positions, ` +
  `${sharp.length} sharp, ${(out.length / 1024).toFixed(1)} KB`);
