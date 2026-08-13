#!/usr/bin/env node
// Regenerates src/data/eco.js: for each line, the deepest opening name the CC0
// data set recognises at each ply. Requires data-src/eco_[a-e].tsv.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const book = new Map();
for (const f of "abcde") {
  for (const line of readFileSync(join(root, `data-src/eco_${f}.tsv`), "utf8").split("\n")) {
    const c = line.split("\t");
    if (c.length < 3 || c[0] === "eco") continue;
    book.set(c[2].split(/\s+/).filter((t) => !/^\d+\.$/.test(t)).join(" "), [c[0], c[1]]);
  }
}
// A size floor, not a checksum. The TSV has ~3000 rows; anything close to
// empty means a truncated or moved download, which would otherwise just drop names
// silently. Raise to a real integrity check only if the upstream format starts moving.
if (book.size < 2000) throw new Error(`eco TSV looks truncated: ${book.size} rows`);

const ctx = {};
new Function("ctx",
  readFileSync(join(root, "src/core.js"), "utf8") +
  readFileSync(join(root, "src/data/lines.js"), "utf8") +
  "\nObject.assign(ctx,{LINES});")(ctx);

const out = {};
for (const l of ctx.LINES) {
  const sans = l.moves.map((m) => m[1].replace(/[!?]/g, ""));
  const rows = [];
  let last = null;
  for (let i = 1; i <= sans.length; i++) {
    const hit = book.get(sans.slice(0, i).join(" ")) || last;
    if (hit !== last) rows.push([i, hit[0], hit[1]]);
    last = hit;
  }
  out[l.id] = rows;
}
const unnamed = Object.entries(out).filter(([, rows]) => !rows.length).map(([id]) => id);
if (unnamed.length) throw new Error(`no opening name matched for: ${unnamed.join(", ")}`);

writeFileSync(join(root, "src/data/eco.js"), "const ECO=" + JSON.stringify(out) + ";\n");
console.log(`wrote names for ${Object.keys(out).length} lines from ${book.size} TSV rows`);
