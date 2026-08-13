#!/usr/bin/env node
// Regenerates src/data/puzzles.js from data-src/puzzles-filtered.csv (see tools/fetch-assets.sh).
// Every candidate is replayed through the shipped move generator before it is kept.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = {};
const core = readFileSync(join(root, "src/core.js"), "utf8");
const engine = readFileSync(join(root, "src/engine.js"), "utf8");
new Function("ctx", core + engine + "\nObject.assign(ctx,{fenPos,findMove,make,san,sq,legal,startPos});")(ctx);
const { fenPos, findMove, make, san, sq } = ctx;

const rows = readFileSync(join(root, "data-src/puzzles-filtered.csv"), "utf8").split("\n").slice(1);
const pool = [];
for (const r of rows) {
  const c = r.split(",");
  if (c.length < 10) continue;
  const [id, fen, moves, rating, , pop, plays, , , tags] = c;
  const rt = +rating, pp = +pop, np = +plays;
  if (!(rt >= 800 && rt <= 2200 && pp >= 85 && np >= 200)) continue;
  const mv = moves.split(" ");
  if (mv.length < 3 || mv.length > 9) continue;
  let p;
  try { p = fenPos(fen); } catch { continue; }
  const sans = [];
  let ok = true;
  for (const u of mv) {
    const m = findMove(p, u);
    if (!m) { ok = false; break; }
    sans.push(san(p, m));
    p = make(p, m);
  }
  if (!ok) continue;
  pool.push({ id, fen, mv, sans, rt, pp, tags, solver: fenPos(fen).w ? "b" : "w" });
}

// Token-prefix match: a tag counts only if it is the named opening or a variation of it
// (the name followed by "_"). The old substring test let Scotch_Game_Modern_Defense and
// Kings_Gambit_Accepted_Modern_Defense through as "Modern_Defense".
const has = (x, s) => x.tags.split(" ").some((t) => t === s || t.startsWith(s + "_"));
const colle = pool.filter((x) => x.solver === "w" && (has(x, "Colle_System") || has(x, "Queens_Pawn_Game_Zukertort_Variation")));
const gift = colle.filter((x) => {
  const p0 = fenPos(x.fen), p1 = make(p0, findMove(p0, x.mv[0]));
  const m = findMove(p1, x.mv[1]);
  return m && p1.b[ctx.sq ? 0 : 0] !== undefined && p1.b[m.f].toLowerCase() === "b" && sq(m.t) === "h7" && p1.b[m.t];
});
const modern = pool.filter((x) => x.solver === "b" && (has(x, "Modern_Defense") || has(x, "Pirc_Defense")));
const band = (a, lo, hi, n) => a.filter((x) => x.rt >= lo && x.rt < hi).sort((x, y) => y.pp - x.pp).slice(0, n);
const rest = colle.filter((x) => !gift.includes(x));
const chosen = [
  ...gift.sort((a, b) => b.pp - a.pp).slice(0, 14),
  ...band(rest, 800, 1300, 12), ...band(rest, 1300, 1700, 12), ...band(rest, 1700, 2200, 10),
  ...band(modern, 800, 1300, 12), ...band(modern, 1300, 1700, 12), ...band(modern, 1700, 2200, 10),
];
const seen = new Set(), out = [];
for (const x of chosen) if (!seen.has(x.id)) { seen.add(x.id); out.push(x); }

writeFileSync(join(root, "src/data/puzzles.js"),
  "const PZ=" + JSON.stringify(out.map((x) => ({
    id: x.id, f: x.fen, m: x.mv, s: x.sans, r: x.rt,
    t: x.tags.replace(/_/g, " ").split(" ").slice(0, 3).join(" "), side: x.solver,
  }))) + ";\n");
console.log(`wrote ${out.length} puzzles (${out.filter(x=>x.solver==="w").length} white, ${out.filter(x=>x.solver==="b").length} black)`);
