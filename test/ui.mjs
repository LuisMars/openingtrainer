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
// The app promises to work offline and makes no script-initiated network calls
// (the masters-database panel was removed when lichess closed anonymous access
// to the opening explorer, April 2026). Stub fetch before any page script runs
// and count every call; the check at the end of this file asserts zero.
await page.addInitScript(() => {
  window.__fetchCalls = [];
  window.fetch = (...a) => {
    window.__fetchCalls.push(String(a[0]));
    return Promise.reject(new Error("fetch is forbidden: this app is offline-only"));
  };
});
// The fetch stub above only sees script-initiated calls; a <link>, @font-face or
// <img> fetch bypasses it entirely (the Google Fonts <link> tags shipped for months
// while the stub reported a clean run). Intercept at the network layer instead:
// the page is file://, so any request to another scheme is an external resource.
// Abort it so the run behaves like a truly offline machine, and record it to fail.
const external = [];
await page.route("**/*", (route) => {
  const u = route.request().url();
  if (u.startsWith("file://")) return route.continue();
  external.push(u);
  return route.abort();
});
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
// The plan panel names concrete moves, so in Shuffle it may exist only inside the
// post-answer window - shown before the answer it is an answer sheet.
const planBefore = await page.evaluate(() => el("planBox").style.display);
let u = await page.evaluate(() => L().moves[S.ply][0]);
await drag(u.slice(0, 2), u.slice(2, 4));
// good() picks armWait() over armNext() whenever the move just played carries a note
// or followed a miss (src/app.js); both phrase the prompt as "Tap to continue." Either
// is a pass; only the wait mode is data-dependent on which line the shuffle happened to
// pick, so the check below stays agnostic to which one fired.
check("correct answer is graded", (await page.innerText("#nMsg")).toLowerCase().includes("tap to continue"));
check("plan panel is hidden before a shuffle answer and shown after",
  planBefore === "none" && (await page.evaluate(() => el("planBox").style.display)) === "",
  planBefore);
// The answer above was clean (no tries, no hint), so the stored-eval block must
// not appear: correct play is not relitigated with numbers (commit b40bcaa).
check("no engine block on a clean correct answer",
  !(await page.innerText("#nText")).includes("Stockfish") &&
  !(await page.innerText("#nMsg")).includes("Stockfish"));
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
// Pick a move that is guaranteed to be refused: not the wanted move, not a book
// alternative (the ALT branch in tap() credits those), and not landing the right
// piece on a setup target square (the setup branch may credit those too - the
// target check alone over-excludes a little, which is fine for picking a certain
// refusal without running the material search on every candidate).
const alt = await page.evaluate((want) => {
  const pos = nowPos();
  const other = legal(pos).filter((m) => {
    const uu = sq(m.f) + sq(m.t);
    if (uu === want.slice(0, 4)) return false;
    if (altAt(pos, uu)) return false;
    const pc = pos.b[m.f];
    if (L().targets.some((x) => x[0] === sq(m.t) && x[1] === pc)) return false;
    return true;
  });
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

// a setup line accepts any safe move onto its target squares (the Hippo move-order
// bug): drill acknowledges without grading or advancing, shuffle credits and grades.
// hip-e4 ply 7 wants one wall move; Nd7 (b8d7) is a different one, safe, on target.
const setup = await page.evaluate(() => {
  const li = LINES.findIndex((l) => l.id === "hip-e4");
  const out = {};
  S.mode = "line"; S.li = li; S.ply = 7; S.sel = null; S.tries = 0; S.hint = 0;
  S.passKeys = new Set(); clearFree(); stats.pos = {}; render(false);
  const k = key(LINES[li], 7);
  S.sel = "b8"; tap("d7");
  out.drillMsg = el("nMsg").textContent;
  out.drillPly = S.ply;
  out.drillGraded = !!stats.pos[k];
  S.mode = "shuffle"; S.sel = null; S.tries = 0; S.hint = 0; S.lastKey = k; render(false);
  S.sel = "b8"; tap("d7");
  out.shufMsg = el("nMsg").textContent;
  out.shufText = el("nText").textContent;
  out.shufGraded = !!(stats.pos[k] && stats.pos[k].ok === 1 && stats.pos[k].streak === 1);
  out.pending = S.pending;
  clearTimeout(S.pending); S.pending = 0; clearFree(); stats.pos = {}; S.run = 0;
  return out;
});
check("drill acknowledges an out-of-order setup move without grading or advancing",
  setup.drillMsg.includes("builds the setup") && setup.drillPly === 7 && !setup.drillGraded,
  setup.drillMsg);
check("shuffle credits an out-of-order setup move and grades it correct",
  setup.shufMsg.includes("Correct") && setup.shufText.includes("formation") && setup.shufGraded && setup.pending === 1,
  setup.shufMsg);

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
check("plan panel never shows in tactics", (await page.evaluate(() => el("planBox").style.display)) === "none");

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

// The miss log on a stats record is bounded on write: at most 5 distinct wrong
// SANs, lowest count evicted when a 6th arrives, counts capped at 99. The key is
// fen-shaped (grade() skips "pz:" keys).
const missLog = await page.evaluate(() => {
  stats.pos = {};
  const k = "8/8/8/8/8/8/8/8 w - - 0 1:e2e4";
  grade(k, false, 0, "Bd3"); grade(k, false, 0, "Bd3");
  for (const s of ["Nc3", "a3", "h3", "Qe2", "Re1"]) grade(k, false, 0, s);
  const w = stats.pos[k].w;
  const afterSix = { n: Object.keys(w).length, bd3: w.Bd3 };
  for (let i = 0; i < 150; i++) grade(k, false, 0, "h3");
  const cap = stats.pos[k].w.h3;
  stats.pos = {};
  return { afterSix, cap };
});
check("miss log: 6 distinct wrong moves keep 5, the repeated one keeps its count, cap 99",
  missLog.afterSix.n === 5 && missLog.afterSix.bd3 === 2 && missLog.cap === 99,
  JSON.stringify(missLog));

// v4 -> v5 storage: a v4 blob is adopted verbatim (its records are valid v5
// records without the "w" miss log) and rewritten under the v5 key. Skipped when
// this Chromium denies localStorage on file:// - the in-page STORE then runs
// memory-only and there is nothing to migrate.
const canStore = await page.evaluate(() => {
  try { localStorage.setItem("t", "1"); localStorage.removeItem("t"); return true; } catch { return false; }
});
if (canStore) {
  await page.evaluate(() => {
    localStorage.setItem("colle-hippo:v4", JSON.stringify({
      pos: { "8/8/8/8/8/8/8/8 w - - 0 1:e2e4": { ok: 2, no: 1, streak: 1, last: 1, ms: 900 } },
      pz: {}, day: "", today: 0, theme: 1,
    }));
    localStorage.removeItem("colle-hippo:v5");
  });
  await page.reload();
  await page.waitForTimeout(700);
  const mig = await page.evaluate(() => ({
    rec: stats.pos["8/8/8/8/8/8/8/8 w - - 0 1:e2e4"],
    v5: !!localStorage.getItem("colle-hippo:v5"),
    theme: S.theme,
  }));
  check("v4 progress is adopted verbatim and rewritten as v5",
    !!mig.rec && mig.rec.ok === 2 && mig.rec.no === 1 && mig.v5 && mig.theme === 1,
    JSON.stringify(mig));
  await page.evaluate(() => { localStorage.removeItem("colle-hippo:v4"); localStorage.removeItem("colle-hippo:v5"); });
} else {
  console.log("- v4 -> v5 migration not checkable here (localStorage denied on file://)");
}

// Enforce the offline promise: nothing in the whole run above may have called fetch,
// and no request of any kind (fonts, images, stylesheets) may have left the page.
const fetches = await page.evaluate(() => window.__fetchCalls);
check("app never calls fetch", fetches.length === 0, fetches.join(" | "));
check("no request leaves the page origin", external.length === 0, external.join(" | "));

check("no console or page errors", errors.length === 0, errors.join(" | "));
await browser.close();
if (fail) { console.error(`\n${fail} failure(s).`); process.exit(1); }
console.log("\nUI smoke test passed.");
