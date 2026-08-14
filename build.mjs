#!/usr/bin/env node
// Concatenates src/* into a single self-contained HTML file.
// Order matters: core defines helpers used by data and app; engine before app.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

// Markup partials, one per screen, assembled between the shared opening
// chrome (src/html/head.html) and the shared closing chrome (src/html/tail.html).
// The app has four board-bearing sections, not five: study, drill, shuffle
// and tactics all render into the same #scBoard element at runtime rather
// than owning separate markup, so board.html is not split further — there
// is no real seam there to cut along.
const HTML_ORDER = [
  "src/html/menu.html",
  "src/html/lines.html",
  "src/html/board.html",
  "src/html/progress.html",
];

// JS bundle order. core defines helpers used by data and app; engine before
// app. Nothing here is a module — everything shares one scope — so this
// order is load-bearing: get it wrong and something upstream is undefined
// when a later file runs.
const ORDER = [
  "src/core.js",
  "src/data/lines.js",
  "src/engine.js",
  "src/data/pieces-cburnett.js",
  "src/data/eco.js",
  "src/data/puzzles.js",
  "src/data/evals.js",
  "src/app.js",
];

// styles.css is inlined whole into the <style> block in src/html/head.html,
// at the /*__STYLES__*/ placeholder. It is deliberately never split per
// screen: `.pc.drag` (position:fixed, the piece under the pointer while
// dragging) MUST come after the plain `.pc` rule (position:relative) in
// cascade order, or a dragged piece loses position:fixed and piles up at
// the bottom of the page — a bug that has happened before. Keeping all CSS
// in one unsplit file, read in one piece, removes any chance of a future
// change to HTML_ORDER (or a per-screen CSS split) reordering those two
// rules relative to each other. NOTE: styles.css itself carries no inline
// comment marking this — styles.css is inlined byte-for-byte into the
// shipped <style> block, so adding one would grow every visitor's download
// and (more immediately) break the requirement that docs/index.html stays
// byte-identical to the pre-refactor build. This comment is the record of
// the invariant instead; `.pc` and `.pc.drag` are already adjacent in
// styles.css (search for "pc.drag") and must stay that way.
const head = read("src/html/head.html").replace(
  "/*__STYLES__*/\n",
  read("src/styles.css"),
);

const htmlBody = HTML_ORDER.map(read).join("");

// tail.html holds the closing chrome (scrim, options sheet, the <script>
// open tag) followed by the old index.tail.html content (</script></body>
// </html>), with the JS bundle spliced in between at the "<script>\n" seam.
const tailRaw = read("src/html/tail.html");
const SCRIPT_OPEN = "<script>\n";
const splitAt = tailRaw.indexOf(SCRIPT_OPEN) + SCRIPT_OPEN.length;

const html =
  head +
  htmlBody +
  tailRaw.slice(0, splitAt) +
  ORDER.map(read).join("") +
  tailRaw.slice(splitAt);

mkdirSync(join(root, "docs"), { recursive: true });
const out = join(root, "docs/index.html");
writeFileSync(out, html);
console.log(`built ${out}  ${(html.length / 1024).toFixed(0)} KB`);
