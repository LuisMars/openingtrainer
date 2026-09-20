#!/usr/bin/env node
// Lists positions where the user has to move, ranked by how often the player
// pool actually reaches them, with what the repertoire and the stored
// evaluations already have. Input for pilot selection (W2-E1); it proposes,
// it does not choose.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "docs/index.html"), "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const ctx = {};
new Function("ctx", js.slice(0, js.indexOf("/* ================= state ================= */")) +
  "\nObject.assign(ctx,{LINES,KIND,startPos,fenPos,make,san,legal,uciOf,fenOf,EVL});")(ctx);
const { LINES, KIND, startPos, fenPos, make, san, legal, uciOf, fenOf, EVL } = ctx;
const keyFen = (p) => p.ep < 0 || legal(p).some((m) => m.ep)
  ? fenOf(p) : fenOf({ b: p.b, w: p.w, cr: p.cr, ep: -1 });

// Split by trained side: a position drilled only in a Hippopotamus line is not
// a drilled position for the Colle repertoire.
const SEEN = { w: new Map(), b: new Map() };
for (const l of LINES) {
  const into = SEEN[l.you];
  let p = startPos();
  for (const [uci] of l.moves) {
    const k = keyFen(p);
    (into.get(k) || into.set(k, new Map()).get(k)).set(uci, l.id);
    p = make(p, legal(p).find((x) => uciOf(x) === uci));
  }
}

const rows = [];
for (const [side, file] of [["w", "research/freq-colle-player.json"], ["b", "research/freq-hippo-player.json"]]) {
  if (!existsSync(join(root, file))) continue;
  const doc = JSON.parse(readFileSync(join(root, file), "utf8"));
  for (const pos of doc.positions) {
    for (const r of pos.replies) {
      if (r.games < 30) continue;
      const base = fenPos(pos.fen);
      const mv = legal(base).find((x) => uciOf(x) === r.uci);
      if (!mv) continue;
      const after = make(base, mv);
      const key = keyFen(after);
      rows.push({
        side, key, fen: fenOf(after),
        via: `${pos.fen} ${r.san}`,
        reached: r.games,                       // games that reached the decision
        share: r.share,                          // share of replies at the parent
        drilled: SEEN[side].has(key),                  // does any line ask the user to move here
        answeredBy: SEEN[side].has(key) ? [...SEEN[side].get(key).values()].join(", ") : "",
        evaluated: !!(EVL && EVL[key]),
        candidates: EVL && EVL[key] ? EVL[key].m.length : 0,
      });
    }
  }
}
rows.sort((a, b) => b.reached - a.reached);
const seen = new Set();
const uniq = rows.filter((r) => !seen.has(r.key) && seen.add(r.key));
writeFileSync(join(root, "research/pilot-candidates.json"), JSON.stringify(uniq, null, 1));
const n = (p) => uniq.filter(p).length;
console.log(`${uniq.length} distinct user-to-move positions reached >=30 times`);
console.log(`  drilled by a line: ${n((r) => r.drilled)}   not drilled: ${n((r) => !r.drilled)}`);
console.log(`  already evaluated: ${n((r) => r.evaluated)}   not evaluated: ${n((r) => !r.evaluated)}`);
console.log(`  white ${n((r) => r.side === "w")}  black ${n((r) => r.side === "b")}`);
for (const r of uniq.slice(0, 25))
  console.log(`  ${String(r.reached).padStart(6)}  ${r.side}  ${r.drilled ? "drilled" : "-------"} ` +
    `${r.evaluated ? "eval" : "----"}  ${r.via}`);
