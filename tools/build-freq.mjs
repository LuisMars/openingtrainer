#!/usr/bin/env node
/* Builds src/data/freq.js: how often each drilled position is actually reached,
   bucketed, plus the short list of rare-but-forcing positions that carry a
   weight floor. Run after a build:

     node build.mjs && node tools/build-freq.mjs && node build.mjs

   Every number comes from research/freq-*.json and nothing is invented here.
   The occurrence of a position we must move in is the count of games that
   played the opponent reply leading into it, divided by that pool's
   games_in_tree; contributions from different parents (transpositions) are
   summed within a pool, and the larger of the two pools is kept. Positions the
   probe tree never reached ship no entry at all and are neutral in the app -
   an unmeasured position is not a rare one.

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

const POOLS = ["freq-colle-player.json", "freq-hippo-player.json"];
const best = new Map(), meta = [];
for (const file of POOLS) {
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
  meta.push(`${file}: ${j.games_in_tree} of ${j.games_read} games, minElo ` +
    `${f.minElo === null ? "none" : f.minElo}, maxPly ${f.maxPly}, speeds ` +
    `${f.speeds === null ? "all" : f.speeds}, ${j.retrieved}`);
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

const rows = [...best.entries()].sort((a, b) => b[1] - a[1]);
const groups = [0, 1, 2, 3, 4, 5].map(() => []);
for (const [k, s] of rows) groups[bucket(s)].push(fhash(k));
const body = groups.map((g) => g.join("")).join(",");
const out = `// Generated by tools/build-freq.mjs - do not edit. How often a drilled position is
// reached in real games, as a bucket, never as a claimed probability.
// SOURCE: the player pool only - lichess monthly dumps counted into
// research/freq-*.json by tools/count-replies.mjs. It is the one pool not selected
// by opening, so the only one that can say how often a reply is met (METHOD.md).
${meta.map((m) => "//   " + m).join("\n")}
// SHAPE: six comma-separated groups, bucket 0 first; each is the low 5 base-36
// digits of the FNV-1a hash of keyFen, run together. Bucket 5 is a share of ${EDGES[0]}
// or more of that pool's probe tree, then ${EDGES.slice(1).join(", ")}. ${rows.length} of
// ${drill.length} positions were reached; the rest ship nothing and are neutral, never rare.
// FRQ_SHARP: a weight floor, from W1-C/W1-D-coverage.md section 3 - a chess
// judgement, not a data result.
const FRQ="${groups.map((g) => g.join("")).reverse().reverse().join(",")}";
const FRQ_SHARP="${sharp.join("")}";
`;
writeFileSync(join(root, "src/data/freq.js"), out);
console.log(`wrote src/data/freq.js: ${rows.length}/${drill.length} positions, ` +
  `${sharp.length} sharp, ${(out.length / 1024).toFixed(1)} KB`);
