#!/usr/bin/env node
// Browser smoke test. Requires: npm i -D playwright && npx playwright install chromium
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = "file://" + join(root, "docs/index.html");
const errors = [];
let fail = 0;
const check = (label, ok, extra = "") => {
  console.log((ok ? "✓ " : "✗ ") + label + (extra ? "  " + extra : ""));
  if (!ok) fail++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 880 } });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url);
await page.waitForTimeout(700);

const centre = (sq) =>
  page.evaluate((s) => {
    const r = document.querySelector(`[data-sq="${s}"]`).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, sq);
const drag = async (from, to) => {
  const [x1, y1] = await centre(from);
  const [x2, y2] = await centre(to);
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(180);
};

// menu
check("menu renders five cards", (await page.$$eval(".card h3", (e) => e.length)) === 5);

// in-app self test
await page.click("#cProgress");
await page.waitForTimeout(1500);
const verify = await page.innerText("#verifyRow");
check("in-app self check passes", (await page.getAttribute("#verifyRow", "class")).includes("ok"), verify.replace(/\n/g, " "));

// study: drag the book move
await page.click("#navBack");
await page.click("#cStudy");
await page.waitForTimeout(250);
await page.locator(".lbtn").nth(0).click();
await page.waitForTimeout(250);
await drag("d2", "d4");
check("drag plays the book move in study", (await page.evaluate(() => S.ply)) === 1);
check("no drag ghosts left behind", (await page.$$eval(".pc.drag", (e) => e.length)) === 0);

// shuffle: correct, then legal-but-wrong
await page.click("#navBack");
await page.click("#navBack");
await page.click("#cShuffle");
await page.waitForTimeout(500);
let u = await page.evaluate(() => L().moves[S.ply][0]);
await drag(u.slice(0, 2), u.slice(2, 4));
// good() picks armWait() over armNext() whenever the move just played carries a note
// or followed a miss (src/app.js); both phrase the prompt as "Tap to continue." Either
// is a pass; only the wait mode is data-dependent on which line the shuffle happened to
// pick, so the check below stays agnostic to which one fired.
check("correct answer is graded", (await page.innerText("#nMsg")).toLowerCase().includes("tap to continue"));
// armWait() sets S.pending without a timer, so nothing auto-advances until a tap; a
// fixed sleep here would sometimes race a question that never arrives on its own, and
// would leave S.ply pointing past the end of L().moves when that question was the last
// ply of its line. Do exactly what a tap does (skipNext(), see src/app.js) instead of
// waiting: it is instant whether armWait or armNext armed S.pending.
await page.evaluate(() => {
  clearTimeout(S.pending);
  S.pending = 0;
  shuffle(false);
});
u = await page.evaluate(() => L().moves[S.ply][0]);
const alt = await page.evaluate((want) => {
  const pos = nowPos();
  const other = legal(pos).filter((m) => sq(m.f) + sq(m.t) !== want.slice(0, 4));
  return sq(other[0].f) + sq(other[0].t);
}, u);
await drag(alt.slice(0, 2), alt.slice(2, 4));
check("legal non-repertoire move is named back", (await page.innerText("#nMsg")).includes("is legal"));

// hints never leak the answer and always have content
const clues = await page.evaluate(() => {
  let total = 0, real = 0, leaks = 0;
  S.mode = "line";
  for (let i = 0; i < LINES.length; i++) {
    S.li = i;
    for (let k = 0; k < LINES[i].moves.length; k++) {
      if ((k % 2 === 0 ? "w" : "b") !== LINES[i].you) continue;
      S.ply = k; S.hint = 0; total++;
      const c = moveClue();
      if (c) { real++; if (c.includes(LINES[i].moves[k][1].replace(/[+#!?]/g, ""))) leaks++; }
    }
  }
  S.mode = "study"; S.li = 0; S.ply = 0;
  return { total, real, leaks };
});
check("hints have content", clues.real / clues.total > 0.9, `${clues.real}/${clues.total}`);
check("hints never leak the move", clues.leaks === 0);

// tactics
await page.evaluate(() => go("menu"));
await page.waitForSelector("#cPuzzle", { state: "visible" });
await page.click("#cPuzzle");
await page.waitForTimeout(600);
const n = await page.evaluate(() => L().moves.length);
for (let i = 0; i < n; i++) {
  if (await page.evaluate(() => S.ply >= L().moves.length)) break;
  const mv = await page.evaluate(() => L().moves[S.ply][0]);
  await drag(mv.slice(0, 2), mv.slice(2, 4));
  await page.waitForTimeout(320);
}
check("a puzzle can be solved", (await page.innerText("#nMsg")).startsWith("Solved"));

// Solving arms armPz(1500), which sets S.pending. A tap during that window goes through
// skipNext(); it used to call shuffle(false) unconditionally, which picked a line/ply out
// of LINES while L() still returned PZLINE — S.ply then indexed another line's ply into
// the puzzle's move list. A tap here must advance to the next puzzle, nothing else.
const before = await page.evaluate(() => S.pz);
const [tx, ty] = await centre("e4");
await page.mouse.move(tx, ty);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(250);
const after = await page.evaluate(() => ({ mode: S.mode, id: L().id, ply: S.ply, pz: S.pz, n: PZ.length }));
check(
  "tapping after a solve advances to the next puzzle",
  after.mode === "puzzle" && after.id.startsWith("pz:") && after.ply === 0 && after.pz === (before + 1) % after.n,
  JSON.stringify(after),
);

// Shuffle must serve due reviews first, not merely let them compete: with 5 due keys
// against 60 learning ones carrying the full miss+slow bonus stack, the due five used
// to take about 5% of draws, so a "5 due now" menu meant ~200 prompts to clear them.
const dueShare = await page.evaluate(() => {
  const keys = [], seen = new Set();
  for (const l of LINES) {
    if (NO_SHUFFLE.has(l.id)) continue;
    for (const p of drillPlies(l)) { const k = key(l, p); if (!seen.has(k)) { seen.add(k); keys.push(k); } }
  }
  const now = Date.now();
  stats.pos = {};
  for (let i = 0; i < 5; i++) stats.pos[keys[i * 7 + 3]] = { ok: 3, no: 0, streak: 3, last: now - 100 * 36e5, ms: 3000 };
  let c = 0;
  for (const k of keys) {
    if (stats.pos[k] || c >= 60) continue;
    stats.pos[k] = { ok: 1, no: c % 2 ? 0 : 4, streak: 1, last: now, ms: c % 2 ? 3000 : 9000 };
    c++;
  }
  S.mode = "shuffle"; S.lastKey = null;
  let due = 0;
  const N = 600;
  for (let i = 0; i < N; i++) { shuffle(true); if (state(S.lastKey) === "due") due++; }
  clearTimeout(S.pending); S.pending = 0;
  stats.pos = {};
  return due / N;
});
check("shuffle serves due reviews ahead of the rest", dueShare > 0.2, dueShare.toFixed(3));

check("no console or page errors", errors.length === 0, errors.join(" | "));
await browser.close();
if (fail) { console.error(`\n${fail} failure(s).`); process.exit(1); }
console.log("\nUI smoke test passed.");
