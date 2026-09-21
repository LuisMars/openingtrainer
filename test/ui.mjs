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
// Playwright's 30s default is the wall-clock budget for loading a 390 KB
// single-file app and for every click. On a machine under real load that is not
// enough, and the suite failed three times on page.goto and on a menu click
// while every assertion in it was sound. Waiting longer changes nothing about
// what is checked - it only stops a busy machine being reported as a defect.
page.setDefaultTimeout(120000);
page.setDefaultNavigationTimeout(120000);
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
// The app promises to work offline. That promise is conditional, and the
// condition matters: the Masters database panel (src/html/board.html #libBox,
// loadLib/paintLib in src/app.js) still exists and still fetches from
// explorer.lichess.org - but only when the user has stored a lichess token AND
// opened that panel on the Study screen. With no token, nothing reaches the
// network, which is what the zero-fetch check below asserts and all it asserts.
// An earlier version of this comment said the panel had been removed. It had
// not; the claim was wrong and is corrected here rather than left to mislead
// the next reader into thinking the fetch path is gone.
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

// good() picks armWait() over armNext() whenever the move just played carries a
// note or followed a miss; both phrase the prompt as "Tap to continue." Either is
// a pass, so the checks below stay agnostic to which one fired.
// Play the move and read the result in ONE evaluate, so no timer can run in
// between. A clean answer with no note takes armNext(850), whose timer advances
// to a fresh position and hides the plan again; anything that costs a round trip
// between playing and reading races it. Reading both fields together was not
// enough - it made the check honest but still time-dependent, and it failed the
// moment the machine was loaded. Doing the move in-page removes the race
// entirely rather than widening the tolerance.
{
  const shuf = await page.evaluate(() => {
    const before = el("planBox").style.display;
    const pos = posAt(L(), S.ply), m = findMove(pos, L().moves[S.ply][0]);
    playMove(pos, sq(m.t), m);
    const out = { before, display: el("planBox").style.display, pending: !!S.pending,
      msg: el("nMsg").textContent.toLowerCase() };
    if (S.pending && S.pending !== 1) { clearTimeout(S.pending); S.pending = 0; }
    return out;
  });
  check("plan panel is hidden before a shuffle answer and shown during the post-answer window",
    shuf.before === "none" && shuf.pending && shuf.display === "",
    JSON.stringify({ before: shuf.before, display: shuf.display, pending: shuf.pending }));
  check("correct answer is graded", shuf.msg.includes("tap to continue"), shuf.msg.slice(0, 60));
}

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
const u = await page.evaluate(() => L().moves[S.ply][0]);
// Pick a move that is guaranteed to be refused: not the wanted move, not a book
// alternative (the ALT branch in tap() credits those), not landing the right piece
// on a setup target square (the setup branch may credit those too), and not one the
// stored table puts first or inside its noise band, which playMove now accepts on
// its own account. What is left is a move nothing in the app has a reason to credit.
const alt = await page.evaluate((want) => {
  const pos = nowPos(), row = evalFor(pos);
  const other = legal(pos).filter((m) => {
    const uu = sq(m.f) + sq(m.t);
    if (uu === want.slice(0, 4)) return false;
    if (altAt(pos, uu)) return false;
    const pc = pos.b[m.f];
    if (L().targets.some((x) => x[0] === sq(m.t) && x[1] === pc)) return false;
    return GRADE.accept.indexOf(gradeMove(row, pos, m).verdict) < 0;
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
// 0.9 was too loose to notice a real regression: rewording a shared PLAN string
// to "no pawn can hit it yet" put a piece name in it, clueLeaks() rejected the
// clue, and about 28 Hippopotamus wall positions silently lost their first-tier
// hint - 436/442 down to 387/421, still comfortably over 0.9. The floor is now
// close to the real figure so the next such slip fails instead of passing.
check("hints have content", clues.real / clues.total > 0.97, `${clues.real}/${clues.total}`);
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

// ---- grading (W2/W3): the stored table decides, not a four-ply search ----
// One prober for all of it: put the drill on a known line and ply, play a legal
// move through playMove() exactly as a tap would, and report what the page did -
// the message, whether the ply moved, and whether the record and the streak were
// touched. Progress is wiped before each move and restored to empty after.
const probe = (id, ply, sans, mode = "line") =>
  page.evaluate(({ id, ply, sans, mode }) => {
    const li = LINES.findIndex((l) => l.id === id);
    const out = [];
    for (const s of sans) {
      S.mode = mode; S.li = li; S.ply = ply; S.sel = null; S.tries = 0; S.hint = 0;
      S.passKeys = new Set(); clearFree(); stats.pos = {}; S.run = 3; render(false);
      const pos = posAt(LINES[li], ply);
      const m = legal(pos).find((x) => san(pos, x).replace(/[+#]/g, "") === s.replace(/[+#!?]/g, ""));
      if (!m) { out.push({ san: s, err: "illegal" }); continue; }
      const k = key(LINES[li], ply);
      const gate = setupGate(evalFor(pos), pos, m, LINES[li].targets);
      playMove(pos, sq(m.t), m);
      out.push({ san: s, reason: gate.reason, credit: gate.credit, ply: S.ply,
        msg: el("nMsg").textContent, text: el("nText").textContent,
        rec: stats.pos[k] || null, run: S.run, tries: S.tries, hint: S.hint });
      if (S.pending) { clearTimeout(S.pending); S.pending = 0; }
      clearFree();
    }
    stats.pos = {}; S.run = 0; S.mode = "study"; S.li = 0; S.ply = 0;
    S.tries = 0; S.hint = 0; S.sel = null; clearFree(); render(false);
    return out;
  }, { id, ply, sans, mode });
const refused = (r) => r.msg.includes("is legal, but");
const free = (r) => !r.rec && r.run === 3 && r.tries === 0 && r.hint === 0;

// Five comparable first moves: the whole top five is inside 9 cp, so every one of
// them is chess. None may be marked wrong, and none may cost the record anything.
const many = await probe("ck", 0, ["Nf3", "e4", "c4", "g3"]);
check("several good moves are all accepted at one position",
  many.every((r) => !refused(r) && r.ply === 0 && free(r)),
  many.map((r) => r.san + ": " + r.msg.slice(0, 46)).join(" | "));
check("the fifth-ranked move is accepted on its number, never on its rank",
  !/rank|fifth|sixth|worst/i.test(many.find((r) => r.san === "g3").msg),
  many.find((r) => r.san === "g3").msg);

// Where the wall genuinely goes up in any order the gate stays open, and the row's
// own stored continuation is what the page shows for the plan that follows.
const wall = await probe("hip-e4", 5, ["a6", "c6"]);
check("a free move order credits the wall move and names the stored line",
  wall[0].credit && wall[0].msg.includes("builds the setup") &&
    wall[0].msg.includes("Its line from here") &&
    wall.every((r) => !refused(r) && r.ply === 5 && free(r)),
  wall.map((r) => r.san + ": " + r.msg.slice(0, 40)).join(" | "));

// A position that wants something concrete stays demanding: the wall move is not
// credited for being a wall move, whatever it scores.
const demand = await probe("hip66", 21, ["a6", "a5"]);
check("an only-move position stays demanding",
  demand[0].reason === "demanding" && !demand[0].msg.includes("builds the setup") &&
    demand[0].msg.includes("asks for something concrete") && !refused(demand[1]),
  demand[0].msg);

// The hip-150 storm tabiya, the defect research/GRADING.md §6 settles: the engine
// wants ...h5, so no wall move gets the move-order sentence here. ...h6 is not in
// the table at all and must therefore cost nothing.
const storm = await probe("hip-150", 13, ["Nd7", "a6", "h6", "h5"]);
const stormH5 = await page.evaluate(() => {
  const li = LINES.findIndex((l) => l.id === "hip-150");
  const pos = posAt(LINES[li], 13), row = evalFor(pos);
  const m = legal(pos).find((x) => san(pos, x) === "h5");
  return gradeMove(row, pos, m).verdict;
});
check("the storm tabiya refuses the wall moves and accepts ...h5",
  storm.slice(0, 3).every((r) => r.reason === "demanding" && !r.msg.includes("builds the setup")) &&
    !refused(storm[3]) && stormH5 === "best",
  storm.map((r) => r.san + ": " + r.reason).join(" | ") + " · h5 grades " + stormH5);
check("an unanalysed move is said to be unanalysed and costs nothing",
  storm[2].msg.includes("has not searched this move") && free(storm[2]) && storm[2].ply === 13,
  storm[2].msg);

// 4.c3 against 3...Bf5 is the autopilot move: scored, 36 cp behind 4.c4, playable
// and priced. The number must be on screen and the drill must carry on.
const conc = await probe("anti", 6, ["c3"]);
check("a concession carries on with its cost stated in centipawns",
  conc[0].msg.includes("36 centipawns") && conc[0].msg.includes("Playable") &&
    conc[0].ply === 6 && !!conc[0].rec && conc[0].rec.no === 1,
  conc[0].msg);
// 4.c3 is scored rather than ranked, so its rank is 0. Nothing may present that as
// a place in a list, here or anywhere else.
check("a scored move's rank of 0 is never shown as a place",
  !/rank|sixth|worst|last of/i.test(conc[0].msg), conc[0].msg);

// Shuffle credits an accepted alternative the same way it credits a setup move:
// the board shows the move the user actually played, and the record gets the tick.
const shufGood = await probe("ck", 0, ["c4"], "shuffle");
check("shuffle credits a good alternative and shows the move played",
  shufGood[0].msg.includes("Correct") && shufGood[0].text.includes("sound here") &&
    !!shufGood[0].rec && shufGood[0].rec.ok === 1,
  shufGood[0].text.slice(0, 120));

// A lost position: the best defence may be named, and nothing may read as a rescue.
// The W4 audit deleted syn-greek, which used to supply this case, and no drilled
// position is lost any longer - which is the point of that audit, but it leaves
// the UI with no real lost position to show. Build one: a temporary line and a
// stored row for it, both constructed here and torn down afterwards. The cp
// values are inputs to the check, not evaluations of anything.
const lostSetup = await page.evaluate(() => {
  const fen = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1";   // Black a rook down
  const pos = fenPos(fen);
  const uci = (s) => { const m = legal(pos).find((x) => san(pos, x).replace(/[+#]/g, "") === s); return uciOf(m); };
  const kh8 = uci("Kh8"), g6 = uci("g6");
  LINES.push({ id: "tmp-lost", ch: "Colle as White", you: "b", name: "Constructed: a lost position",
    src: "constructed", plan: "", start: fen, targets: [],
    // two plies, so playing the first one grades rather than completing the line
    moves: [[kh8, "Kh8", ""], [(() => {
      const q = make(pos, legal(pos).find((x) => uciOf(x) === kh8));
      const r = legal(q).find((x) => san(q, x).replace(/[+#]/g, "") === "Rd8");
      return uciOf(r); })(), "Rd8+", ""]] });
  EVL[posKey(pos)] = { d: 20, m: [[kh8, "Kh8", -650, null], [g6, "g6", -720, null]], pv: ["Kh8"] };
  return { li: LINES.length - 1, fen };
});
// Probe a move other than the line's own, so the grading path runs rather than
// the "correct" path: ...g6 is the row's second entry and 70cp behind.
const lost = await probe("tmp-lost", 0, ["g6"]);
const lostBest = await page.evaluate(({ fen }) => {
  const pos = fenPos(fen), row = evalFor(pos);
  const best = legal(pos).find((m) => uciOf(m) === row.m[0][0]);
  const g = gradeMove(row, pos, best);
  g.reply = replyAfter(pos, best, row, g);
  return { line: gradeLine(g), verdict: g.verdict, situation: g.situation, after: g.after };
}, lostSetup);
check("the best move in a lost position grades best and stays lost",
  lostBest.verdict === "best" && lostBest.situation === "lost" &&
    lostBest.line.includes("stays lost") && !/saved|rescued|winning|equal footing/i.test(lostBest.line),
  lostBest.line);
check("a defence in a lost position is named without claiming a rescue",
  lost[0].msg.includes("stays lost") && lost[0].msg.includes("not a rescue") &&
    !/saved|rescued|winning/i.test(lost[0].msg),
  lost[0].msg);
await page.evaluate(({ fen }) => { LINES.pop(); delete EVL[posKey(fenPos(fen))]; }, lostSetup);

// The end of an analysed branch: the line's own aim, and the two things the page
// can actually offer next. No live analysis is promised anywhere in it.
const ended = await page.evaluate(() => {
  const li = LINES.findIndex((l) => l.id === "eco-mong3");
  const ply = LINES[li].moves.length - 1;
  S.mode = "line"; S.li = li; S.ply = ply; S.sel = null; S.tries = 0; S.hint = 0;
  S.passKeys = new Set(); clearFree(); stats.pos = {}; render(false);
  const pos = posAt(LINES[li], ply), m = findMove(pos, LINES[li].moves[ply][0]);
  playMove(pos, sq(m.t), m);
  const msg = el("nMsg").textContent;
  if (S.pending) { clearTimeout(S.pending); S.pending = 0; }
  stats.pos = {}; S.run = 0; S.mode = "study"; S.li = 0; S.ply = 0; clearFree(); render(false);
  return msg;
});
check("a finished line states the plan and offers another line or free exploration",
  ended.includes("Line complete") && ended.includes("Study") && ended.includes("nothing is graded") &&
    !/analys(e|i)s of your|engine will|we will look/i.test(ended),
  ended);

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

// ---------- foundation regressions (W1-A) ----------

// A deferred callback armed in one session must not act in the next. Navigating
// away cancels it outright; the epoch check below is the belt to that braces, for
// a callback that escaped cancellation and fired anyway.
const timers = await page.evaluate(async () => {
  startPuzzle(0);
  armPz(120);
  const armed = !!S.pending;
  go("menu");
  const cleared = S.pending;
  await new Promise((r) => setTimeout(r, 320));
  let fired = 0;
  later(() => { fired++; }, 60);
  S.epoch++;
  await new Promise((r) => setTimeout(r, 220));
  return { armed, cleared, screen: S.screen, swallowsTap: skipNext(), fired };
});
check("leaving a screen cancels the pending auto-advance and frees the next tap",
  timers.armed && timers.cleared === 0 && timers.screen === "menu" && timers.swallowsTap === false,
  JSON.stringify(timers));
check("a callback that outlived its session does not run", timers.fired === 0, JSON.stringify(timers));

// Autoplay is the one control that used to step S.ply without clearing the free
// branch, so nowPos() kept returning the off-book position while the notes and the
// progress bar marched on.
const play = await page.evaluate(() => {
  go("board");
  S.mode = "study"; S.li = 0; S.ply = 0; clearFree(); stop(); render(false);
  const m = legal(nowPos()).find((x) => uciOf(x) === "g1f3");
  S.sel = "g1"; tap("f3");
  const off = S.free.length;
  toggleplay();
  const out = { off, free: S.free.length, playing: !!S.timer,
    matches: nowPos().b.join("") === posAt(L(), S.ply).b.join("") };
  stop(); clearFree(); S.sel = null; go("menu");
  void m;
  return out;
});
check("autoplay clears the free branch instead of leaving the board stale",
  play.off === 1 && play.free === 0 && play.playing && play.matches, JSON.stringify(play));

// Import is a trust boundary. Out-of-range theme/set indices are clamped (they are
// used to index THEMES[]/SETS[] unchecked), counters are bounded, and a miss-log key
// that is not a plausible SAN is dropped rather than stored and later printed.
const guard = await page.evaluate(() => {
  const k = "8/8/8/8/8/8/8/8 w - - 0 1:e2e4";
  const saved = JSON.stringify(stats);
  el("pData").value = JSON.stringify({ v: 5, theme: 99, set: 42, today: -5, bookOnly: true,
    pz: { 1: { ok: "yes", no: 1, ms: 5 } },
    pos: { [k]: { ok: 2, no: 3, streak: 1.7, last: 1, ms: 900,
      w: { "<img src=x>": 9, Bd3: 4 } } } });
  el("pImport").click();
  const r = stats.pos[k];
  const out = { theme: stats.theme, set: stats.set, today: stats.today,
    streak: r.streak, w: Object.keys(r.w), pzOk: stats.pz["1"].ok, sTheme: S.theme, sSet: S.set };
  el("pData").value = JSON.stringify({ v: 5, pos: { [k]: { ok: -1, no: 0 } } });
  el("pImport").click();
  out.rejected = el("pData").value.startsWith("That is not a valid backup");
  stats = JSON.parse(saved);
  return out;
});
check("import clamps theme/set indices and bounds every counter",
  guard.theme === 0 && guard.set === 0 && guard.today === 0 && guard.streak === 1 &&
  guard.pzOk === 0 && guard.sTheme === 0 && guard.sSet === 0, JSON.stringify(guard));
check("import drops a miss-log key that is not a plausible move",
  guard.w.length === 1 && guard.w[0] === "Bd3", JSON.stringify(guard.w));
check("import refuses a record with a negative counter", guard.rejected === true);

// The Progress screen prints the wrong move a record names. It is built with
// textContent, so a key that arrived as markup stays text.
const xss = await page.evaluate(() => {
  const k = key(LINES[0], 0), saved = JSON.stringify(stats.pos);
  stats.pos = {};
  stats.pos[k] = { ok: 0, no: 3, streak: 0, last: Date.now(), ms: 1000,
    w: { "<img src=x onerror='window.__xss=1'>": 3 } };
  renderWeak();
  const out = { imgs: el("pWeak").querySelectorAll("img").length,
    asText: el("pWeak").textContent.includes("<img"), flag: !!window.__xss };
  stats.pos = JSON.parse(saved);
  return out;
});
check("a miss-log key cannot inject markup into the weak-spots list",
  xss.imgs === 0 && xss.asText && !xss.flag, JSON.stringify(xss));

// The crash bar prints an error message, and an error message can carry anything.
const crashSafe = await page.evaluate(() => {
  crash("<img src=x onerror='window.__c=1'>");
  const out = { imgs: el("crash").querySelectorAll("img").length,
    asText: el("crash").textContent.includes("<img"),
    says: el("crash").textContent.includes("reloading is safe") || el("crash").textContent.includes("not storing") };
  el("crash").classList.remove("on"); el("crash").innerHTML = "";
  return out;
});
check("the crash bar prints an error message as text, not markup",
  crashSafe.imgs === 0 && crashSafe.asText && crashSafe.says, JSON.stringify(crashSafe));

// Promotion: the chooser offers four pieces and plays the one picked, rather than
// queening silently. The shipped data asks for no promotion, so this is the only
// place the branch is exercised.
const promo = await page.evaluate(() => {
  go("board");
  S.mode = "study"; S.li = 0; S.ply = 0; S.flip = false; S.sel = null;
  S.free = [{ uci: "h2h4", san: "h4" }];
  S.fpos = fenPos("4k3/P7/8/8/8/8/8/4K3 w - -");
  render(false);
  S.sel = "a7"; tap("a8");
  const box = el("promo"), btns = [...box.querySelectorAll("button")];
  const out = { open: box.classList.contains("on"), n: btns.length,
    labels: btns.map((b) => b.getAttribute("aria-label")) };
  btns[3].click();
  const last = S.free[S.free.length - 1];
  out.uci = last.uci; out.san = last.san; out.stillOpen = box.classList.contains("on");
  clearFree(); S.sel = null; go("menu");
  return out;
});
check("a promotion asks which piece and plays the one chosen",
  promo.open && promo.n === 4 && promo.uci === "a7a8n" && promo.san === "a8=N" && !promo.stillOpen,
  JSON.stringify(promo));

// ...and the answer is compared on the full uci, suffix included: queening when the
// line wants a knight is a wrong move, not a right one.
const promoGrade = await page.evaluate(() => {
  const savedLine = PZLINE, savedMode = S.mode, savedStats = JSON.stringify(stats.pos);
  // Hand-built because no user move in the shipped set promotes.
  PZLINE = { id: "pz:w1a", ch: "Tactics", you: "w", name: "test",
    pz: { id: "w1a", r: 1500, t: "test" }, src: "test",
    start: "4k3/P7/8/8/8/8/8/4K3 w - -", targets: [],
    moves: [["a7a8n", "a8=N", ""]] };
  S.mode = "puzzle"; S.ply = 0; S.sel = null; S.tries = 0; S.hint = 0; S.flip = false;
  clearFree(); render(false);
  const pos = nowPos();
  playMove(pos, "a8", legal(pos).find((x) => uciOf(x) === "a7a8q"));
  const wrong = { ply: S.ply, msg: el("nMsg").textContent };
  S.sel = null; S.tries = 0;
  playMove(nowPos(), "a8", legal(nowPos()).find((x) => uciOf(x) === "a7a8n"));
  const right = { ply: S.ply, msg: el("nMsg").textContent };
  stopAll(); PZLINE = savedLine; S.mode = savedMode; stats.pos = JSON.parse(savedStats);
  S.ply = 0; S.sel = null; clearFree(); go("menu");
  return { wrong, right };
});
check("queening when a knight was wanted is not accepted",
  promoGrade.wrong.ply === 0 && promoGrade.wrong.msg.includes("is legal") &&
  promoGrade.right.ply === 1 && promoGrade.right.msg.includes("Solved"),
  JSON.stringify(promoGrade));

// The masters panel paints remote JSON. Strings go through esc(); the numbers have
// to be coerced, because a string where a count belongs concatenates instead of
// adding and lands in innerHTML verbatim. Also: lichess writes a promotion uci in
// full ("e7e8q"), so the "ours" test compares the full uci now.
const lib = await page.evaluate(() => {
  const box = el("lib");
  paintLib({
    white: "<img src=x onerror='window.__lib=1'>", draws: "", black: "",
    opening: { eco: "A00", name: "<b>x</b>" },
    moves: [{ uci: "e2e4", san: "e4", white: "<b onmouseover='window.__lib=1'>", draws: "", black: "" }],
  });
  const dirty = { imgs: box.querySelectorAll("img").length, bolds: box.querySelectorAll("b[onmouseover]").length,
    flag: !!window.__lib, text: box.textContent };
  paintLib({ white: 10, draws: 2, black: 8, opening: null,
    moves: [{ uci: "e2e4", san: "e4", white: 6, draws: 1, black: 3 }] });
  const clean = { games: box.textContent.includes("20 master games"), row: box.textContent.includes("e4") };
  box.innerHTML = "";
  return { dirty, clean };
});
check("the masters panel cannot be made to inject markup through its numbers",
  lib.dirty.imgs === 0 && lib.dirty.bolds === 0 && !lib.dirty.flag &&
  lib.clean.games && lib.clean.row, JSON.stringify(lib));

// A failed write is a write that did not happen, whichever tier took it. save()
// used to swallow the error, so the menu and the crash bar went on claiming the
// progress was kept.
const writeFail = await page.evaluate(async () => {
  const real = STORE.set, wasMem = MEMONLY;
  MEMONLY = false;
  STORE.set = () => Promise.reject(new Error("QuotaExceededError"));
  await save();
  const flagged = MEMONLY;
  STORE.set = real;
  go("menu");
  const shown = el("mStore").textContent;
  crash("test");
  const says = el("crash").textContent;
  el("crash").classList.remove("on"); el("crash").innerHTML = "";
  MEMONLY = wasMem; go("menu");
  return { flagged, shown, safe: says.includes("reloading is safe") };
});
check("a rejected write marks the session memory-only and the UI says so",
  writeFail.flagged && writeFail.shown.includes("not letting the trainer store anything") && !writeFail.safe,
  JSON.stringify(writeFail));

// The promotion chooser closes over the position it was opened on. Stepping the
// ply behind its back used to leave it live, and it then played from a board that
// is no longer on screen.
const stale = await page.evaluate(() => {
  go("board");
  S.mode = "study"; S.li = 0; S.ply = 0; S.flip = false; S.sel = null;
  S.free = [{ uci: "h2h4", san: "h4" }];
  S.fpos = fenPos("k7/4P3/8/8/8/8/8/4K3 w - -");
  render(false);
  S.sel = "e7"; tap("e8");
  const opened = el("promo").classList.contains("on");
  S.ply = 1; clearFree(); render(true);        // what ArrowRight does
  const out = { opened, stillOpen: el("promo").classList.contains("on"), ply: S.ply, free: S.free.length };
  S.ply = 0; clearFree(); S.sel = null; go("menu");
  return out;
});
check("a ply change closes the promotion chooser instead of leaving it live",
  stale.opened && !stale.stillOpen && stale.free === 0, JSON.stringify(stale));

// Untrusted keys must not reach a prototype: pos["__proto__"] in a parsed backup
// used to set the prototype of the map rather than store a record.
const proto = await page.evaluate(() => {
  const saved = JSON.stringify(stats);
  const clean = cleanStats(JSON.parse('{"pos":{"__proto__":{"ok":1,"no":0},"a/b:e2e4":{"ok":2,"no":0}},' +
    '"pz":{"__proto__":{"ok":1,"no":0,"ms":5}}}'));
  const out = { keys: Object.keys(clean.pos).sort(), pzKeys: Object.keys(clean.pz),
    polluted: ({}).ok !== undefined, protoIsNull: Object.getPrototypeOf(clean.pos) === null };
  stats = JSON.parse(saved);
  return out;
});
check("a __proto__ key in a backup is stored as a key, not a prototype",
  proto.keys.length === 2 && proto.keys.includes("__proto__") && proto.pzKeys.length === 1 &&
  !proto.polluted && proto.protoIsNull, JSON.stringify(proto));

// Reset rebuilds `stats` from scratch; leaving bookOnly out of it wiped the setting
// from storage while the options sheet still showed it on.
const reset = await page.evaluate(() => {
  S.bookOnly = true; stats.bookOnly = true;
  el("pReset").click(); el("pReset").click();
  const out = { stored: stats.bookOnly, live: S.bookOnly };
  S.bookOnly = false; stats.bookOnly = false; save();
  return out;
});
check("resetting progress keeps the book-lines-only setting",
  reset.stored === true && reset.live === true, JSON.stringify(reset));

// Item 43: exercises are weighted by how often the position is actually reached,
// with a floor for the rare forcing ones, and with due reviews still first.
const fq = await page.evaluate(() => {
  const fenOf = (k) => k.slice(0, k.lastIndexOf(":"));
  const bucket = (k) => FRQB[fhash(fenOf(k))];
  const keys = Object.values(KEYCACHE), byBucket = {};
  for (const k of keys) { const b = bucket(k); if (b !== undefined && !byBucket[b]) byBucket[b] = k; }
  const have = Object.keys(byBucket).map(Number).sort((a, b) => a - b);
  const sharp = keys.find((k) => FRQS.has(fhash(fenOf(k))) && bucket(k) < 3);
  return {
    counted: keys.filter((k) => bucket(k) !== undefined).length,
    spread: have,
    top: freqFactor(byBucket[have[have.length - 1]]),
    bottom: freqFactor(byBucket[have[0]]),
    uncounted: freqFactor(keys.find((k) => bucket(k) === undefined)),
    offTable: freqFactor("8/8/8/8/8/8/8/8 w - - 0 1:e2e4"),
    puzzle: freqFactor("pz:0000a:3"),
    sharp: sharp ? freqFactor(sharp) : null,
    sharpBucket: sharp ? bucket(sharp) : null,
  };
});
check("a position that is reached often is weighted above one that is not",
  fq.counted > 40 && fq.spread.length > 2 && fq.top > 1 && fq.bottom < 1 && fq.top > fq.bottom,
  JSON.stringify(fq));
check("a position with no frequency data is not penalised",
  fq.uncounted === 1 && fq.offTable === 1 && fq.puzzle === 1, JSON.stringify(fq));
check("a rare but forcing position keeps its floor at neutral",
  fq.sharp === 1 && fq.sharpBucket < 3, JSON.stringify(fq));

const fqOpt = await page.evaluate(() => {
  el("oFreq").click();
  const off = { live: S.freqW, stored: stats.freqW, label: el("oFreqS").textContent };
  el("oFreq").click();
  return { off, on: S.freqW };
});
check("occurrence weighting is a toggle in the options sheet",
  fqOpt.off.live === false && fqOpt.off.stored === false && fqOpt.off.label === "off" && fqOpt.on === true,
  JSON.stringify(fqOpt));

// Due first, with the weighting pulling the other way as hard as the table allows:
// the due key is the rarest one Shuffle will serve, the key it competes with is the
// most common one, and that one is also slow and has missed three times.
const duefirst = await page.evaluate(() => {
  const fenOf = (k) => k.slice(0, k.lastIndexOf(":"));
  const bucket = (k) => FRQB[fhash(fenOf(k))];
  stats.pos = {}; S.freqW = true; S.recog = true; S.mode = "shuffle";
  const seen = new Map();
  for (let i = 0; i < 60; i++) { shuffle(true); const b = bucket(S.lastKey); if (b !== undefined) seen.set(S.lastKey, b); }
  const sorted = [...seen.entries()].sort((a, b) => a[1] - b[1]);
  if (sorted.length < 2) return { skipped: true };
  const rare = sorted[0][0], common = sorted[sorted.length - 1][0];
  stats.pos[rare] = { ok: 1, no: 0, streak: 1, last: 0, ms: 500 };            // due
  // streak 1, just answered: LADDER[0] is 0 hours, so a streak-0 record is due the
  // moment it is written and would not be the not-due competitor this check needs.
  stats.pos[common] = { ok: 1, no: 3, streak: 1, last: Date.now(), ms: 9000 }; // hot, slow, common
  const counts = {};
  for (let i = 0; i < 220; i++) { shuffle(true); counts[S.lastKey] = (counts[S.lastKey] || 0) + 1; }
  return { rare: counts[rare] || 0, common: counts[common] || 0,
    rareBucket: bucket(rare), commonBucket: bucket(common),
    state: state(rare), commonState: state(common), factor: freqFactor(rare) };
});
check("a due review outranks a commoner position that is not due",
  duefirst.skipped || (duefirst.state === "due" && duefirst.commonState !== "due" &&
    duefirst.factor < 1 && duefirst.rare > duefirst.common),
  JSON.stringify(duefirst));

// Rare counters still come up: weighting reorders, it never silences. Seeded draws
// over a fresh record set, so the count is repeatable rather than a coin flip.
const rareSeen = await page.evaluate(() => {
  const fenOf = (k) => k.slice(0, k.lastIndexOf(":"));
  const bucket = (k) => FRQB[fhash(fenOf(k))];
  stats.pos = {}; S.freqW = true; S.recog = true; S.mode = "shuffle"; S.lastKey = null;
  const rnd = Math.random; let seed = 12345;
  Math.random = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  let rare = 0, n = 600;
  try { for (let i = 0; i < n; i++) { shuffle(true); if (bucket(S.lastKey) === 0) rare++; } }
  finally { Math.random = rnd; }
  return { rare, n, minWeight: Math.min(...FRQW) };
});
check("rare positions are still served with occurrence weighting on",
  rareSeen.rare > 0 && rareSeen.minWeight > 0, JSON.stringify(rareSeen));

// Item 44: where the table accepts more than one move, one answer is not mastery.
const ways = await page.evaluate(() => {
  const fenOf = (k) => k.slice(0, k.lastIndexOf(":"));
  const keys = Object.values(KEYCACHE);
  const many = keys.find((k) => waysAt(fenOf(k)) >= 2), one = keys.find((k) => waysAt(fenOf(k)) === 1);
  const base = () => ({ ok: 2, no: 0, streak: 2, last: Date.now(), ms: 500 });
  const at = (k, a) => { stats.pos[k] = a ? Object.assign(base(), { a: a }) : base(); return state(k); };
  stats.pos = {}; S.recog = true;
  const out = { ways: [waysAt(fenOf(many)), waysAt(fenOf(one))] };
  out.noLog = at(many, null);
  out.oneWay = at(many, ["Nf3"]);
  out.twoWays = at(many, ["Nf3", "c4"]);
  out.single = at(one, ["Nf3"]);
  S.recog = false; out.off = at(many, ["Nf3"]); S.recog = true;
  return out;
});
check("one answer is not mastery where the table accepts more than one",
  ways.oneWay === "learning" && ways.twoWays === "solid" && ways.single === "solid",
  JSON.stringify(ways));
check("a record with no answer log keeps the status it earned",
  ways.noLog === "solid" && ways.off === "solid", JSON.stringify(ways));

await page.evaluate(() => { stats.pos = {}; S.recog = true; go("menu"); });
await page.click("#cShuffle");
await page.waitForTimeout(400);
const pre = await page.evaluate(() => ({ k: key(L(), S.ply), u: L().moves[S.ply][0], san: L().moves[S.ply][1] }));
await drag(pre.u.slice(0, 2), pre.u.slice(2, 4));
await page.waitForTimeout(350);
const logged = await page.evaluate((k) => (stats.pos[k] || {}).a || null, pre.k);
check("a correct answer records which accepted move was found",
  Array.isArray(logged) && logged.length === 1 && logged[0] === pre.san,
  JSON.stringify({ logged, expected: pre.san }));
await page.evaluate(() => { stats.pos = {}; save(); go("menu"); });

// v4/v5 -> v6 storage: an older blob is adopted verbatim (a v4 record is a valid
// v6 record without the "w" miss log and the "a" answer log, a v5 record is one
// without "a") and rewritten under the v6 key. Skipped when this Chromium denies
// localStorage on file:// - the in-page STORE then runs memory-only and there is
// nothing to migrate.
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
    localStorage.removeItem("colle-hippo:v6");
  });
  await page.reload();
  await page.waitForTimeout(700);
  const mig = await page.evaluate(() => ({
    rec: stats.pos["8/8/8/8/8/8/8/8 w - - 0 1:e2e4"],
    v6: !!localStorage.getItem("colle-hippo:v6"),
    theme: S.theme, freqW: S.freqW, recog: S.recog,
  }));
  check("v4 progress is adopted verbatim and rewritten as v6",
    !!mig.rec && mig.rec.ok === 2 && mig.rec.no === 1 && mig.v6 && mig.theme === 1 &&
    mig.freqW === true && mig.recog === true,
    JSON.stringify(mig));
  await page.evaluate(() => { localStorage.removeItem("colle-hippo:v4"); localStorage.removeItem("colle-hippo:v6"); });

  // The same for a v5 blob, whose records may carry a "w" miss log but no answer
  // log. Both old keys are read in turn, so neither generation is stranded.
  await page.evaluate(() => {
    localStorage.setItem("colle-hippo:v5", JSON.stringify({
      v: 5, pos: { "8/8/8/8/8/8/8/8 w - - 0 1:e2e4": { ok: 3, no: 1, streak: 2, last: 1, ms: 900, w: { Bd3: 2 } } },
      pz: {}, day: "", today: 0, theme: 0,
    }));
    localStorage.removeItem("colle-hippo:v6");
  });
  await page.reload();
  await page.waitForTimeout(700);
  const mig5 = await page.evaluate(() => ({
    rec: stats.pos["8/8/8/8/8/8/8/8 w - - 0 1:e2e4"],
    v6: !!localStorage.getItem("colle-hippo:v6"),
  }));
  check("v5 progress keeps its miss log and is rewritten as v6",
    !!mig5.rec && mig5.rec.ok === 3 && mig5.rec.w && mig5.rec.w.Bd3 === 2 &&
    mig5.rec.a === undefined && mig5.v6, JSON.stringify(mig5));
  await page.evaluate(() => { localStorage.removeItem("colle-hippo:v5"); localStorage.removeItem("colle-hippo:v6"); });

  // load() used to assign straight from JSON.parse, and applyTheme() ran outside its
  // try/catch: a stored theme index from a newer build threw before go("menu") and
  // left a blank page with no way back. Startup must reach the menu regardless.
  await page.evaluate(() => {
    localStorage.setItem("colle-hippo:v6", JSON.stringify({
      pos: { "8/8/8/8/8/8/8/8 w - - 0 1:e2e4": { ok: 1, no: 0, streak: 1, last: 1, ms: 500 } },
      pz: {}, day: "", today: 0, theme: 99, set: 42, bookOnly: true,
    }));
  });
  await page.reload();
  await page.waitForTimeout(700);
  const boot = await page.evaluate(() => ({
    menu: el("scMenu").classList.contains("on"), screen: S.screen,
    theme: S.theme, set: S.set, book: S.bookOnly,
    kept: !!stats.pos["8/8/8/8/8/8/8/8 w - - 0 1:e2e4"],
  }));
  check("an out-of-range stored theme does not brick startup",
    boot.menu && boot.screen === "menu" && boot.theme === 0 && boot.set === 0 && boot.book === true && boot.kept,
    JSON.stringify(boot));
  await page.evaluate(() => localStorage.removeItem("colle-hippo:v6"));

  // Loading must be lenient per record. A single bad field (a negative ms, which a
  // backwards clock step between armClock() and the answer really does produce) used
  // to make load() reject the whole blob and start empty — and the next save() then
  // wrote that empty set straight over the user's progress, permanently.
  const goodKey = "8/8/8/8/8/8/8/8 w - - 0 1:e2e4";
  const badKey = "8/8/8/8/8/8/8/8 b - - 0 1:e7e5";
  await page.evaluate(([g, b]) => {
    localStorage.setItem("colle-hippo:v6", JSON.stringify({
      pos: { [g]: { ok: 4, no: 1, streak: 2, last: 1, ms: 900 },
        [b]: { ok: 1, no: 0, streak: 1, last: 1, ms: -40 },
        broken: "not a record" },
      pz: {}, day: "", today: 0, theme: 1,
    }));
  }, [goodKey, badKey]);
  await page.reload();
  await page.waitForTimeout(700);
  const kept = await page.evaluate(async ([g, b]) => {
    const before = { n: Object.keys(stats.pos).length, good: stats.pos[g], bad: stats.pos[b], theme: S.theme };
    bumpToday();
    await new Promise((r) => setTimeout(r, 120));
    const stored = JSON.parse(localStorage.getItem("colle-hippo:v6"));
    return { before, storedKeys: Object.keys(stored.pos).length, storedGood: stored.pos[g] };
  }, [goodKey, badKey]);
  check("one bad record does not cost the user the rest of a stored blob",
    kept.before.n === 2 && kept.before.good.ok === 4 && kept.before.bad && kept.before.bad.ms === 0 &&
    kept.before.theme === 1 && kept.storedKeys === 2 && kept.storedGood.ok === 4,
    JSON.stringify(kept));

  // An unreadable blob is the one thing refused outright, and then nothing is
  // written over it: overwriting is the only irreversible thing here.
  await page.evaluate(() => localStorage.setItem("colle-hippo:v6", "{ not json"));
  await page.reload();
  await page.waitForTimeout(700);
  const held = await page.evaluate(async () => {
    const out = { held: SAVE_HELD, note: el("mStore").textContent };
    bumpToday();
    await new Promise((r) => setTimeout(r, 120));
    out.untouched = localStorage.getItem("colle-hippo:v6") === "{ not json";
    el("pReset").click(); el("pReset").click();     // Reset is explicit consent to write
    await new Promise((r) => setTimeout(r, 120));
    out.afterReset = SAVE_HELD;
    out.written = localStorage.getItem("colle-hippo:v6") !== "{ not json";
    return out;
  });
  check("an unreadable stored blob is left alone until the user says otherwise",
    held.held && held.note.includes("could not be read") && held.untouched &&
    held.afterReset === false && held.written, JSON.stringify(held));
  await page.evaluate(() => localStorage.removeItem("colle-hippo:v6"));
} else {
  console.log("- v4/v5 -> v6 migration and startup-resilience not checkable here (localStorage denied on file://)");
}

// Enforce the offline promise: nothing in the whole run above may have called fetch,
// and no request of any kind (fonts, images, stylesheets) may have left the page.
const fetches = await page.evaluate(() => window.__fetchCalls);
// A backup has to survive the round trip, and it has to leave the token behind.
// The Wave 3 gate asks for progress surviving export/import; nothing tested the
// export side, only import of a hand-written blob.
{
  const r = await page.evaluate(async () => {
    localStorage.setItem("colle-hippo:lichess-token", "lip_thisIsNotARealToken00");
    const key = Object.keys(KEYCACHE)[0] || Object.keys(EVL)[0];
    stats.pos[key] = { ok: 3, no: 1, streak: 2, last: 1700000000000, ms: 1234, w: { Bd3: 2 }, a: ["Nf3", "c4"] };
    stats.theme = 1; stats.set = 1; stats.bookOnly = true; stats.today = 4; stats.day = "2026-09-20";
    await save();
    go("progress"); el("pExport").onclick();
    const blob = el("pData").value;
    // wipe everything the backup should restore, then import it back
    stats = { pos: {}, pz: {}, day: "", today: 0, theme: 0, set: 0, bookOnly: false };
    S.theme = 0; S.set = 0; S.bookOnly = false; await save();
    el("pData").value = blob; el("pImport").onclick();
    const back = stats.pos[key];
    return {
      hasToken: /lip_|lio_/.test(blob),
      said: el("pData").value,
      rec: back, theme: stats.theme, set: stats.set, bookOnly: stats.bookOnly,
      today: stats.today, day: stats.day,
      tokenKept: localStorage.getItem("colle-hippo:lichess-token"),
    };
  });
  check("a backup round-trips without carrying the lichess token",
    r.hasToken === false && r.said === "Imported." &&
    r.rec && r.rec.ok === 3 && r.rec.no === 1 && r.rec.streak === 2 && r.rec.ms === 1234 &&
    r.rec.w && r.rec.w.Bd3 === 2 && r.rec.a && r.rec.a.join() === "Nf3,c4" &&
    r.theme === 1 && r.set === 1 && r.bookOnly === true && r.today === 4 &&
    r.tokenKept === "lip_thisIsNotARealToken00",
    JSON.stringify({ token: r.hasToken, rec: r.rec, theme: r.theme, bookOnly: r.bookOnly, tokenSurvived: !!r.tokenKept }));
}

// W5-A: interaction and accessible feedback. The grading rewrite changed what
// the app says after a move, so check that the saying is actually reachable:
// the verdict must land in a live region, the promotion dialog must be operable
// from the keyboard, and Escape must get out of it.
{
  const a11y = await page.evaluate(() => {
    const at = (id) => { const e = document.getElementById(id); return e && { role: e.getAttribute("role"), live: e.getAttribute("aria-live") }; };
    const li = LINES.findIndex((l) => l.id === "ck");
    S.mode = "line"; S.li = li; S.ply = 0; S.sel = null; S.tries = 0; S.hint = 0;
    S.passKeys = new Set(); clearFree(); stats.pos = {}; render(false);
    const pos = posAt(LINES[li], 0);
    const m = legal(pos).find((x) => san(pos, x).replace(/[+#]/g, "") === "Nf3");
    playMove(pos, sq(m.t), m);
    return { nMsg: at("nMsg"), promo: at("promo"),
      verdictInLive: el("nMsg").textContent.trim().length > 40,
      sample: el("nMsg").textContent.trim().slice(0, 80) };
  });
  check("the verdict after a move lands in a live region",
    a11y.nMsg && a11y.nMsg.role === "status" && a11y.nMsg.live === "polite" && a11y.verdictInLive,
    JSON.stringify(a11y));

  // The promotion chooser, driven entirely by the keyboard.
  const promoKb = await page.evaluate(async () => {
    const fen = "k7/4P3/8/8/8/8/8/4K3 w - - 0 1";
    go("board"); S.screen = "board"; S.mode = "study"; S.li = 0; S.ply = 0; clearFree();
    S.fpos = fenPos(fen); S.free = ["x"]; render(false);
    const pos = nowPos();
    askPromotion(pos, "e8", legal(pos).filter((m) => m.f === ix("e7") && m.t === ix("e8")));
    const box = el("promo");
    const btns = [...box.querySelectorAll("button")];
    // the app should have moved focus into the dialog itself, without help
    const focusedFirst = document.activeElement === btns[0];
    const labels = btns.map((b) => b.getAttribute("aria-label"));
    // activate the knight with the keyboard rather than a tap
    const knight = btns.find((b) => /knight/.test(b.getAttribute("aria-label")));
    knight.focus();
    knight.click();                       // Enter/Space on a focused button is a click
    const played = S.free[S.free.length - 1];
    return { role: box.getAttribute("role"), label: box.getAttribute("aria-label"),
      n: btns.length, labels, focusedFirst, closed: box.style.display === "none" || !box.childElementCount,
      played };
  });
  check("the promotion chooser is a labelled dialog whose buttons work from the keyboard",
    promoKb.role === "dialog" && /promotion/i.test(promoKb.label || "") && promoKb.n === 4 &&
      promoKb.focusedFirst && promoKb.labels.every((l) => /^Promote to /.test(l || "")) &&
      promoKb.closed && promoKb.played && /n$/.test(promoKb.played.uci || ""),
    JSON.stringify(promoKb));

  // Escape must close it rather than leaving a modal dialog stranded on screen.
  const esc = await page.evaluate(() => {
    const fen = "k7/4P3/8/8/8/8/8/4K3 w - - 0 1";
    go("board"); S.screen = "board"; S.mode = "study"; S.li = 0; S.ply = 0; clearFree();
    S.fpos = fenPos(fen); S.free = ["x"]; render(false);
    const pos = nowPos();
    askPromotion(pos, "e8", legal(pos).filter((m) => m.f === ix("e7") && m.t === ix("e8")));
    const open = !!el("promo").childElementCount;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return { open, stillOpen: !!el("promo").childElementCount };
  });
  check("Escape closes the promotion chooser", esc.open && !esc.stillOpen, JSON.stringify(esc));
}

// A deliberate-mistake line now asks to be repaired rather than reproduced.
// Playing its own move at the repair ply is refused with its price; a move the
// grader accepts is credited and the line then plays its habit move anyway, so
// the lesson still arrives.
{
  const rep = await page.evaluate(() => {
    const out = {};
    for (const id of ["trap", "syn-hipdown"]) {
      const li = LINES.findIndex((l) => l.id === id), l = LINES[li], ply = l.repair.ply;
      const run = (pick) => {
        S.screen = "board"; S.mode = "line"; S.li = li; S.ply = ply; S.sel = null;
        S.tries = 0; S.hint = 0; S.passKeys = new Set(); clearFree(); stats.pos = {}; render(false);
        const pos = posAt(l, ply);
        const m = pick === "own" ? findMove(pos, l.moves[ply][0])
          : legal(pos).find((x) => uciOf(x) === evalFor(pos).m[0][0]);
        playMove(pos, sq(m.t), m);
        const r = { msg: el("nMsg").textContent, text: el("nText").textContent, ply: S.ply };
        if (S.pending && S.pending !== 1) { clearTimeout(S.pending); S.pending = 0; }
        return r;
      };
      out[id] = { own: run("own"), better: run("best"), ply };
    }
    return out;
  });
  const ok = (r) => /that is the move the line is about/i.test(r.own.msg) &&
    /centipawns behind/i.test(r.own.msg) &&
    /repaired/i.test(r.better.msg) && /habit/i.test(r.better.text);
  check("a deliberate-mistake line asks to be repaired, not reproduced",
    ok(rep.trap) && ok(rep["syn-hipdown"]),
    JSON.stringify({ trapOwn: rep.trap.own.msg.slice(0, 70), trapBetter: rep.trap.better.msg.slice(0, 70) }));
}

check("app never calls fetch", fetches.length === 0, fetches.join(" | "));
check("no request leaves the page origin", external.length === 0, external.join(" | "));

check("no console or page errors", errors.length === 0, errors.join(" | "));
await browser.close();
if (fail) { console.error(`\n${fail} failure(s).`); process.exit(1); }
console.log("\nUI smoke test passed.");
