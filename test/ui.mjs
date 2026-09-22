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
// Changed with the system rule: this used to expect e4, c4 and g3 to be accepted
// here too. They are sound, but they are not the Colle, so they are now answered
// neutrally ("not a Colle move") and the question stays live; Nf3 is still book.
const many = await probe("ck", 0, ["Nf3", "e4", "c4", "g3"]);
check("several sound first moves cost nothing, and only the Colle's are credited",
  many.every((r) => !refused(r) && r.ply === 0 && free(r)) &&
    many.filter((r) => r.san !== "Nf3").every((r) => /^\w+ is sound, but it is not a Colle move here\. Try again\./.test(r.msg)),
  many.map((r) => r.san + ": " + r.msg.slice(0, 46)).join(" | "));
check("book too names a line from the same chapter and side",
  /Nf3 is book too — Colle System: Rhamphorhynchus/.test(many.find((r) => r.san === "Nf3").msg),
  many.find((r) => r.san === "Nf3").msg);
// 1...d5 after 1.d4 is the Colle chapter's defence line (def-kolt), not a Hippo move:
// a Hippopotamus drill must not call it book or name that line.
const hipD5 = (await probe("syn-london", 1, ["d5"]))[0];
check("a defence line from another chapter is not book in a Hippo drill",
  !/book too|Koltanowski/i.test(hipD5.msg) && hipD5.ply === 1, hipD5.msg);

// The defence lines are drilled only from their drill ply. Before it the game's
// opening plays itself, and Shuffle never serves those boards: the board after
// 1.d4 belongs to the Hippo chapter, where ...g6 is credited.
const defs = await page.evaluate(() => {
  const saved = JSON.stringify(stats), sv = { book: S.bookOnly };
  const rnd = Math.random;
  let seed = 4242;
  Math.random = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  const out = { early: [], plies: {}, d4: null };
  const d4fen = fenOf(posAt(LINES.find((l) => l.id === "h-d4nf3"), 1));
  try {
    stats.pos = {}; S.bookOnly = false; S.mode = "shuffle"; S.lastKey = null;
    for (let i = 0; i < 1500; i++) {
      shuffle(true); clearTimeout(S.pending); S.pending = 0;
      const l = L();
      if (l.drill && S.ply < l.drill) out.early.push(l.id + ":" + S.ply);
      if (!out.d4 && S.ply === 1 && fenOf(nowPos()) === d4fen) {
        const pos = nowPos(), m = legal(pos).find((x) => san(pos, x) === "g6");
        out.d4 = { id: l.id, ch: l.ch, label: el("nSrc").textContent };
        playMove(pos, sq(m.t), m);
        out.d4.msg = el("nMsg").textContent;
        clearTimeout(S.pending); S.pending = 0; clearFree();
      }
    }
  } finally { Math.random = rnd; }
  for (const l of LINES) if (l.drill) out.plies[l.id] = [l.drill, drillPlies(l)[0]];
  // Line mode: the opening before the drill ply plays itself.
  S.mode = "line"; S.li = LINES.findIndex((l) => l.id === "def-kolt"); startLine();
  autoReply();
  out.linePly = S.ply;
  // Labels: a Black-to-play board in the Colle chapter is not "Colle as White".
  S.mode = "shuffle"; S.ply = 19; S.pending = 0; render(false);
  out.defLabel = el("nSrc").textContent;
  S.li = LINES.findIndex((l) => l.id === "ck"); S.ply = 2; render(false);
  out.colleLabel = el("nSrc").textContent;
  stats = JSON.parse(saved); S.bookOnly = sv.book; S.mode = "study"; S.li = 0; S.ply = 0; S.lastKey = null;
  clearFree(); render(false);
  return out;
});
check("defence lines are drilled only from their drill ply",
  defs.plies["def-kolt"][0] === 19 && defs.plies["def-kolt"][1] === 19 &&
    defs.plies["def-ohanlon"][0] === 15 && defs.plies["def-ohanlon"][1] === 15 && defs.linePly === 19,
  JSON.stringify({ plies: defs.plies, linePly: defs.linePly }));
check("Shuffle serves no defence-line board before its drill ply",
  defs.early.length === 0, defs.early.slice(0, 5).join(", "));
check("Shuffle after 1.d4 is a Hippo board, and ...g6 is credited",
  !!defs.d4 && defs.d4.ch === "Hippopotamus as Black" && /Correct/.test(defs.d4.msg) && !/is legal, but|not a/.test(defs.d4.msg),
  JSON.stringify(defs.d4));
check("a Black-to-play board in the Colle chapter is not labelled Colle as White",
  defs.defLabel === "Colle chapter · defending as Black" && defs.colleLabel === "Colle as White",
  defs.defLabel + " | " + defs.colleLabel);
check("the fifth-ranked move is priced on its number, never on its rank",
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

// The hip-150 storm tabiya, research/GRADING.md §6. Depth 20 puts ...h5 first
// with ...Nd7 11 cp behind; depth 28 puts ...Nd7 -61 first with ...h5 -62. The
// gate calls a position demanding only where both depths do, so here the wall
// moves the table scores are credited, and ...h5 is accepted as well.
const storm = await probe("hip-150", 13, ["Nd7", "a6", "h5"]);
const stormH5 = await page.evaluate(() => {
  const li = LINES.findIndex((l) => l.id === "hip-150");
  const pos = posAt(LINES[li], 13), row = evalFor(pos);
  const m = legal(pos).find((x) => san(pos, x) === "h5");
  return gradeMove(row, pos, m).verdict;
});
check("the storm tabiya credits the scored wall moves and accepts ...h5",
  storm.slice(0, 2).every((r) => r.reason === "in-band" && r.msg.includes("builds the setup")) &&
    !refused(storm[2]) && stormH5 === "best",
  storm.map((r) => r.san + ": " + r.reason).join(" | ") + " · h5 grades " + stormH5);
// A wall move neither depth searched, at a position both depths call demanding
// (1.e4: first choice ...c5 at depth 20, ...c6 at depth 28, neither a wall move):
// unanalysed, so it must cost nothing.
const unan = await probe("hip-e4", 1, ["h6"]);
check("an unanalysed move is said to be unanalysed and costs nothing",
  unan[0].reason === "demanding" && unan[0].msg.includes("has not searched this move") &&
    free(unan[0]) && unan[0].ply === 1,
  unan[0].msg);
// Where the two depths disagree on accepting a move, it is sound and the page
// says the searches disagree, with both stored numbers: kolt ply 24 Re1 is 45 cp
// behind at depth 20 and 26 at depth 28. Changed with the system rule: no Colle
// line plays Re1 from this board and it is no formation move, so it is no longer
// credited - it is answered as sound but outside the system, free, and the
// disagreement is still stated.
const split = await probe("kolt", 24, ["Re1"]);
check("a move only one depth accepts is sound and the disagreement is stated",
  !refused(split[0]) && free(split[0]) && split[0].ply === 24 && split[0].msg.includes("not a Colle move") &&
    split[0].msg.includes("two searches disagree") &&
    split[0].msg.includes("depth 20") && split[0].msg.includes("45 behind") && split[0].msg.includes("26 behind"),
  split[0].msg);

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

// Changed with the system rule: this used to expect Shuffle to credit 1.c4 at the
// start of a Colle line. 1.c4 is sound and is not the Colle, so Shuffle now answers
// it neutrally and keeps the question live, exactly as Drill does. Shuffle's credit
// for an in-system alternative that shows the move played is covered by the
// out-of-order setup check above (hip-e4, ...Nd7).
const shufGood = await probe("ck", 0, ["c4"], "shuffle");
check("shuffle answers a sound move from another opening neutrally and stays live",
  /^c4 is sound, but it is not a Colle move here\. Try again\./.test(shufGood[0].msg) &&
    !shufGood[0].msg.includes("Correct") && free(shufGood[0]) && shufGood[0].ply === 0,
  shufGood[0].msg.slice(0, 120));

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

// The material search runs in a Web Worker built from the page's own script where
// one can be made, and deferred on the main thread where not. Either way a wrong
// move the table does not cover must paint its message BEFORE the search runs here,
// and grade when the answer arrives. Checked by order, not by the clock: matNodes is
// set to -1 and must still be -1 when playMove returns. Then the result must never
// land on a later position - neither after another move nor after leaving the
// session - on either path. For the worker path the stale checks wait until the
// worker has actually answered (matWSeen), so a dropped result is proved dropped
// rather than merely late.
const deferred = await page.evaluate(async () => {
  const savedLine = PZLINE, savedMode = S.mode, savedStats = JSON.stringify(stats.pos);
  const until = async (f) => { for (let i = 0; i < 3000 && !f(); i++) await new Promise((r) => setTimeout(r, 20)); };
  const settle = () => until(() => !/Checking what it costs/.test(el("nMsg").textContent));
  const wait = () => new Promise((r) => setTimeout(r, MAT_DEFER * 4));
  const setup = () => {
    PZLINE = { id: "pz:w1b", ch: "Tactics", you: "w", name: "test",
      pz: { id: "w1b", r: 1500, t: "test" }, src: "test",
      start: "4k3/P7/8/8/8/8/8/4K3 w - -", targets: [],
      moves: [["a7a8n", "a8=N", ""]] };
    S.mode = "puzzle"; S.ply = 0; S.sel = null; S.tries = 0; S.hint = 0;
    clearFree(); render(false);
  };
  const play = (u) => { const pos = nowPos(); playMove(pos, "a8", legal(pos).find((x) => uciOf(x) === u)); };
  const round = async (worker) => {
    const out = {};
    setup(); matNodes = -1; matVia = ""; play("a7a8q");
    out.now = { msg: el("nMsg").textContent, nodes: matNodes, tries: S.tries };
    await settle();
    out.done = { msg: el("nMsg").textContent, nodes: matNodes, tries: S.tries, via: matVia };
    // superseded by another move before the answer came back
    let seen = matWSeen;
    setup(); matNodes = -1; matVia = ""; play("a7a8q"); play("a7a8n");
    const solved = el("nMsg").textContent;
    if (worker) await until(() => matWSeen > seen); else await wait();
    out.superseded = { nodes: matNodes, same: el("nMsg").textContent === solved, tries: S.tries, via: matVia,
      answered: matWSeen > seen };
    // abandoned by leaving the session
    seen = matWSeen;
    setup(); matNodes = -1; matVia = ""; play("a7a8q"); stopAll();
    if (worker) await until(() => matWSeen > seen); else await wait();
    out.left = { nodes: matNodes, tries: S.tries, via: matVia, answered: matWSeen > seen };
    stopAll();
    return out;
  };
  const res = {};
  res.worker = await round(true);
  res.workerAlive = !!matW && matWReady && !matWDead;
  // The worker dies with a search in flight: what it owed is answered here.
  setup(); matNodes = -1; matVia = ""; play("a7a8q");
  matW.onerror(new Event("error"));
  await settle();
  res.died = { msg: el("nMsg").textContent, tries: S.tries, via: matVia, dead: matWDead, w: matW };
  stopAll();
  // No worker at all: the old main-thread path, same guards.
  res.main = await round(false);
  // Budget: ohanlon:28 g4 needs 219,450 nodes. On the fallback it is silent; the
  // worker's MAT_CAP_BG finishes it, and it claims nothing, as the reference says.
  const q = fenPos("r1bq3r/pp1n1pp1/3bp1k1/6N1/3p3P/2P5/PP3PP1/R1BQR1K1 w - - 0 1");
  const g4 = findMove(q, "g2g4");
  res.mainBudget = matVerdict(q, g4);
  matWDead = false; matW = null; matWReady = false;
  let got;
  matAsk(q, g4, () => true, (v) => { got = { v, via: matVia, nodes: matNodes }; });
  await until(() => got);
  res.bgBudget = got || null;
  stopAll(); PZLINE = savedLine; S.mode = savedMode; stats.pos = JSON.parse(savedStats);
  S.ply = 0; S.sel = null; S.tries = 0; clearFree(); go("menu");
  return res;
});
for (const [path, r] of [["worker", deferred.worker], ["main thread", deferred.main]]) {
  check(`an uncovered wrong move says so before the material search runs, and grades after (${path})`,
    /a8=Q\+ is legal/.test(r.now.msg) && /Checking what it costs/.test(r.now.msg) &&
      r.now.nodes === -1 && r.now.tries === 0 &&
      r.done.nodes > 0 && r.done.tries === 1 && !/Checking/.test(r.done.msg) &&
      r.done.via === (path === "worker" ? "worker" : "main"),
    JSON.stringify(r.now) + " " + JSON.stringify(r.done));
  check(`a pending material search never lands on a later move or a left session (${path})`,
    r.superseded.nodes === -1 && r.superseded.same && r.superseded.tries === 0 && r.superseded.via === "" &&
      r.left.nodes === -1 && r.left.tries === 0 && r.left.via === "" &&
      (path !== "worker" || (r.superseded.answered && r.left.answered)),
    JSON.stringify({ superseded: r.superseded, left: r.left }));
}
check("the material search runs in a worker here, and a worker that dies is answered on the main thread",
  deferred.workerAlive && deferred.died.tries === 1 && deferred.died.via === "main" &&
    deferred.died.dead && !/Checking/.test(deferred.died.msg),
  JSON.stringify({ alive: deferred.workerAlive, died: deferred.died }));
check("ohanlon:28 g4 is silent at the main-thread budget and finishes, claiming nothing, in the worker",
  deferred.mainBudget === null && deferred.bgBudget && deferred.bgBudget.v && deferred.bgBudget.v.swing < 1 &&
    deferred.bgBudget.via === "worker" && deferred.bgBudget.nodes === 219450,
  JSON.stringify({ main: deferred.mainBudget, worker: deferred.bgBudget }));

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

// Rating bands: one table per band, the middle one by default and labelled as the
// default, never band 0 assumed. Cycling the button swaps the table, persists the
// choice, and a Reset keeps it (it is a setting, not progress).
const band = await page.evaluate(() => {
  const out = { n: FRQ.length, names: FRQ_BANDS.length, def: FRQ_DEF, start: S.band,
    startLabel: el("oBandS").textContent, same: FRQB === FRQBS[FRQ_DEF] };
  const counted = FRQBS.map((m) => Object.keys(m).length);
  const differ = FRQBS.some((m, i) => i && Object.keys(m).some((h) => m[h] !== FRQBS[0][h]));
  el("oBand").click();
  out.next = { live: S.band, stored: stats.band, label: el("oBandS").textContent, swapped: FRQB === FRQBS[S.band] };
  el("pReset").click(); el("pReset").click();
  out.afterReset = stats.band;
  for (let i = 0; i < FRQBS.length; i++) if (S.band !== FRQ_DEF) el("oBand").click();
  out.back = { live: S.band, label: el("oBandS").textContent };
  return Object.assign(out, { counted, differ });
});
check("occurrence is counted per rating band, the middle band by default",
  band.n === band.names && band.n >= 3 && band.def > 0 && band.start === band.def && band.same &&
    /most games/.test(band.startLabel) && band.counted.every((c) => c > 0) && band.differ,
  JSON.stringify(band));
check("the rating band is a setting that persists and survives a reset",
  band.next.live === (band.def + 1) % band.n && band.next.stored === band.next.live && band.next.swapped &&
    !/most games/.test(band.next.label) && band.afterReset === band.next.live &&
    band.back.live === band.def && /most games/.test(band.back.label),
  JSON.stringify(band));

// A backup with no band (every backup made before bands existed) or a band this
// build does not ship gets the default band, not band 0; a valid one is kept.
const bandImport = await page.evaluate(() => {
  const saved = JSON.stringify(stats), out = {};
  for (const [name, b] of [["absent", undefined], ["bogus", 99], ["text", "1"], ["zero", 0]]) {
    const d = { v: 6, pos: {}, pz: {} };
    if (b !== undefined) d.band = b;
    el("pData").value = JSON.stringify(d);
    el("pImport").click();
    out[name] = { live: S.band, stored: stats.band, table: FRQB === FRQBS[S.band] };
  }
  el("pData").value = saved; el("pImport").click();
  return out;
});
check("an imported backup without a valid band falls back to the default band",
  bandImport.absent.live === band.def && bandImport.bogus.live === band.def && bandImport.text.live === band.def &&
    bandImport.zero.live === 0 && bandImport.zero.stored === 0 && bandImport.zero.table && bandImport.absent.table,
  JSON.stringify(bandImport));

// Due first, with the weighting pulling the other way as hard as the table allows:
// the due key is the rarest one Shuffle will serve, the key it competes with is the
// most common one, and that one is also slow and has missed three times.
const duefirst = await page.evaluate(() => {
  const fenOf = (k) => k.slice(0, k.lastIndexOf(":"));
  const bucket = (k) => FRQB[fhash(fenOf(k))];
  stats.pos = {}; S.freqW = true; S.recog = true; S.mode = "shuffle";
  // Seeded, like the other scheduling checks: the pass condition compares two draw
  // counts, and with level weighting on the expected margin is about 2:1, so an
  // unseeded run could lose it by chance without anything being wrong.
  const rnd = Math.random; let seed = 4242;
  Math.random = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  const seen = new Map();
  for (let i = 0; i < 60; i++) { shuffle(true); const b = bucket(S.lastKey); if (b !== undefined) seen.set(S.lastKey, b); }
  const sorted = [...seen.entries()].sort((a, b) => a[1] - b[1]);
  if (sorted.length < 2) { Math.random = rnd; return { skipped: true }; }
  const rare = sorted[0][0], common = sorted[sorted.length - 1][0];
  stats.pos[rare] = { ok: 1, no: 0, streak: 1, last: 0, ms: 500 };            // due
  // streak 1, just answered: LADDER[0] is 0 hours, so a streak-0 record is due the
  // moment it is written and would not be the not-due competitor this check needs.
  stats.pos[common] = { ok: 1, no: 3, streak: 1, last: Date.now(), ms: 9000 }; // hot, slow, common
  const counts = {};
  for (let i = 0; i < 220; i++) { shuffle(true); counts[S.lastKey] = (counts[S.lastKey] || 0) + 1; }
  Math.random = rnd;
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

// Levels by depth. Every expectation is derived from LINES, so lines added later move
// the counts without breaking the checks.
const lvA = await page.evaluate(() => {
  const all = {}, out = { mismatch: [], transposed: null, levelled: 0, pzLevel: levelOf("pz:0000a:3") };
  for (const l of LINES) for (const p of drillPlies(l)) {
    const k = key(l, p);
    (all[k] = all[k] || []).push(Math.floor(p / 2) + 1);
  }
  for (const k in all) {
    const lo = Math.min(...all[k]);
    if (DEPTH[k] !== lo) out.mismatch.push(k);
    const lv = levelOf(k), e = LEVELS[lv];
    if (!(lo >= e[0] && lo <= e[1])) out.mismatch.push("band " + k);
    out.levelled++;
    if (!out.transposed && Math.max(...all[k]) > lo)
      out.transposed = { depths: [...new Set(all[k])], depth: DEPTH[k], level: lv };
  }
  out.counts = levels().rows.map((r) => r.n);
  // No shipped line may transpose across move numbers, so build two that do: the
  // knights go out and back, and 3.d4 is answered on the same board as 1.d4.
  const a = { id: "tst-a", you: "w", start: START, moves: [["g1f3"], ["g8f6"], ["f3g1"], ["f6g8"], ["d2d4"]] };
  const b = { id: "tst-b", you: "w", start: START, moves: [["d2d4"]] };
  const onlyA = depthsOf([a]), both = depthsOf([a, b]), both2 = depthsOf([b, a]);
  const k = keyFen(posAt(a, 4)) + ":d2d4";
  out.synthetic = { same: k === keyFen(posAt(b, 0)) + ":d2d4", onlyA: onlyA[k], both: both[k], both2: both2[k] };
  return out;
});
check("levels: each position takes the shallowest move number it is answered at",
  lvA.mismatch.length === 0 && lvA.pzLevel === -1 && lvA.counts.every((n) => n > 0) &&
    lvA.synthetic.same && lvA.synthetic.onlyA === 3 && lvA.synthetic.both === 1 && lvA.synthetic.both2 === 1 &&
    (!lvA.transposed || lvA.transposed.depth === Math.min(...lvA.transposed.depths)),
  JSON.stringify({ mismatch: lvA.mismatch.slice(0, 3), synthetic: lvA.synthetic, transposed: lvA.transposed, counts: lvA.counts }));
console.log("  level sizes (Shuffle-served positions): " + lvA.counts.join(", "));

// The clear threshold at its edge: one short of it is not cleared, reaching it is.
const lvB = await page.evaluate(() => {
  const saved = JSON.stringify(stats), sv = { book: S.bookOnly, lvW: S.lvW };
  S.bookOnly = false; S.lvW = true;
  const keys = [], seen = new Set();
  for (const l of LINES) {
    if (NO_SHUFFLE.has(l.id)) continue;
    for (const p of drillPlies(l)) { const k = key(l, p); if (!seen.has(k) && levelOf(k) === 0) { seen.add(k); keys.push(k); } }
  }
  const solid = () => ({ ok: 2, no: 0, streak: 2, last: Date.now(), ms: 1000 });
  const need = Math.ceil(LV_CLEAR * keys.length - 1e-9);
  stats.pos = {};
  for (const k of keys.slice(0, need - 1)) stats.pos[k] = solid();
  const below = levels();
  stats.pos[keys[need - 1]] = solid();
  const at = levels();
  renderMenu();
  const menuAt = el("mLevelT").textContent;
  // Every level cleared: the menu says so rather than naming a level.
  for (const l of LINES) if (!NO_SHUFFLE.has(l.id)) for (const p of drillPlies(l)) stats.pos[key(l, p)] = solid();
  const allClear = levels().cur;
  renderMenu();
  const menuAll = el("mLevelT").textContent;
  stats = JSON.parse(saved); S.bookOnly = sv.book; S.lvW = sv.lvW;
  return { n: keys.length, need, belowCur: below.cur, belowSolid: below.rows[0].solid, atCur: at.cur,
    atCleared: at.rows[0].cleared, menuAt, allClear, menuAll };
});
check("levels: a level is cleared at 80% solid and not one position before",
  lvB.belowCur === 0 && lvB.belowSolid === lvB.need - 1 && lvB.atCur === 1 && lvB.atCleared && lvB.allClear === -1,
  JSON.stringify(lvB));
check("menu names the level, its moves and how much of it is solid",
  /^Level 2 · moves 4–5 · 0 of \d+ solid$/.test(lvB.menuAt) && /^Every level cleared · (\d+) of \1 solid$/.test(lvB.menuAll),
  JSON.stringify({ at: lvB.menuAt, all: lvB.menuAll }));

// Weighting, seeded: the current level is drawn more than a deeper one and more than
// with the setting off, the deepest level is still drawn, and a due review in the
// deepest level still outranks a hot, slow key in the current one.
const lvC = await page.evaluate(() => {
  const saved = JSON.stringify(stats), sv = { lvW: S.lvW, freqW: S.freqW };
  const rnd = Math.random;
  const draw = (on, n) => {
    S.lvW = on; S.lastKey = null;
    let seed = 777;
    Math.random = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
    const c = LEVELS.map(() => 0);
    try { for (let i = 0; i < n; i++) { shuffle(true); c[levelOf(S.lastKey)]++; } } finally { Math.random = rnd; }
    return c;
  };
  stats.pos = {}; S.freqW = true; S.recog = true; S.mode = "shuffle"; S.bookOnly = false;
  const on = draw(true, 600), off = draw(false, 600);
  const pick = (lv) => { for (const l of LINES) if (!NO_SHUFFLE.has(l.id)) for (const p of drillPlies(l)) { const k = key(l, p); if (levelOf(k) === lv) return k; } };
  const deep = pick(LEVELS.length - 1), hot = pick(0);
  stats.pos[deep] = { ok: 1, no: 0, streak: 1, last: 0, ms: 500 };            // due
  stats.pos[hot] = { ok: 1, no: 3, streak: 1, last: Date.now(), ms: 9000 };   // current level, slow, missed
  S.lvW = true;
  const counts = {};
  for (let i = 0; i < 220; i++) { shuffle(true); counts[S.lastKey] = (counts[S.lastKey] || 0) + 1; }
  const res = { on, off, deepDue: counts[deep] || 0, hot: counts[hot] || 0, deepState: state(deep), cur: levels().cur };
  stats = JSON.parse(saved); S.lvW = sv.lvW; S.freqW = sv.freqW; S.lastKey = null;
  return res;
});
check("Shuffle favours the current level and still serves the deepest one",
  lvC.on[0] > lvC.on[2] && lvC.on[0] > lvC.off[0] && lvC.on[lvC.on.length - 1] > 0,
  JSON.stringify({ on: lvC.on, off: lvC.off }));
check("a due review in a deep level outranks the current level",
  lvC.deepState === "due" && lvC.cur === 0 && lvC.deepDue > lvC.hot, JSON.stringify(lvC));
console.log("  fresh-profile draws by level, 600 seeded: on " + lvC.on.join("/") + ", off " + lvC.off.join("/"));

// The setting: a toggle, stored, kept by a reset, and defaulted on for backups that
// predate it.
const lvD = await page.evaluate(() => {
  const saved = JSON.stringify(stats);
  el("oLevel").click();
  const off = { live: S.lvW, stored: stats.lvW, label: el("oLevelS").textContent, pressed: el("oLevel").getAttribute("aria-pressed") };
  el("pReset").click(); el("pReset").click();
  const afterReset = { live: S.lvW, stored: stats.lvW };
  el("pExport").click();
  const exported = JSON.parse(el("pData").value).lvW;
  el("pData").value = JSON.stringify({ v: 6, pos: {}, pz: {} }); el("pImport").click();
  const absent = { live: S.lvW, stored: stats.lvW, label: el("oLevelS").textContent };
  el("pData").value = JSON.stringify({ v: 6, pos: {}, pz: {}, lvW: false }); el("pImport").click();
  const explicit = S.lvW;
  el("pData").value = saved; el("pImport").click();
  S.lvW = true; stats.lvW = true; save(); syncOpts();
  return { off, afterReset, exported, absent, explicit };
});
check("favour-your-level is a setting that persists, survives a reset and travels in an export",
  lvD.off.live === false && lvD.off.stored === false && lvD.off.label === "off" && lvD.off.pressed === "false" &&
    lvD.afterReset.live === false && lvD.afterReset.stored === false && lvD.exported === false,
  JSON.stringify(lvD));
check("a backup without the level setting imports with it on",
  lvD.absent.live === true && lvD.absent.stored === true && lvD.absent.label === "on" && lvD.explicit === false,
  JSON.stringify(lvD));

// Item 44: where the table accepts more than one move, one answer is not mastery.
const ways = await page.evaluate(() => {
  // waysAt takes the stats key now: which moves count depends on the system of
  // the lines that train it, not on the board alone.
  const keys = Object.values(KEYCACHE);
  const many = keys.find((k) => waysAt(k) >= 2), one = keys.find((k) => waysAt(k) === 1);
  const base = () => ({ ok: 2, no: 0, streak: 2, last: Date.now(), ms: 500 });
  const at = (k, a) => { stats.pos[k] = a ? Object.assign(base(), { a: a }) : base(); return state(k); };
  stats.pos = {}; S.recog = true;
  const out = { ways: [waysAt(many), waysAt(one)] };
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
    theme: S.theme, freqW: S.freqW, recog: S.recog, band: S.band, def: FRQ_DEF,
  }));
  check("v4 progress is adopted verbatim and rewritten as v6",
    !!mig.rec && mig.rec.ok === 2 && mig.rec.no === 1 && mig.v6 && mig.theme === 1 &&
    mig.freqW === true && mig.recog === true && mig.band === mig.def,
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
      pz: {}, day: "", today: 0, theme: 99, set: 42, bookOnly: true, band: 99,
    }));
  });
  await page.reload();
  await page.waitForTimeout(700);
  const boot = await page.evaluate(() => ({
    menu: el("scMenu").classList.contains("on"), screen: S.screen,
    theme: S.theme, set: S.set, book: S.bookOnly, band: S.band, def: FRQ_DEF,
    kept: !!stats.pos["8/8/8/8/8/8/8/8 w - - 0 1:e2e4"],
  }));
  check("an out-of-range stored theme does not brick startup",
    boot.menu && boot.screen === "menu" && boot.theme === 0 && boot.set === 0 && boot.book === true && boot.kept &&
      boot.band === boot.def,
    JSON.stringify(boot));
  await page.evaluate(() => localStorage.removeItem("colle-hippo:v6"));

  // A chosen band is read back on the next visit, table and all.
  await page.evaluate(() => {
    localStorage.setItem("colle-hippo:v6", JSON.stringify({ pos: {}, pz: {}, band: FRQ_BANDS.length - 1 }));
  });
  await page.reload();
  await page.waitForTimeout(700);
  const bandBack = await page.evaluate(() => ({ band: S.band, want: FRQ_BANDS.length - 1,
    table: FRQB === FRQBS[S.band], label: el("oBandS").textContent, last: FRQ_BANDS[FRQ_BANDS.length - 1] }));
  check("a stored rating band is restored on load",
    bandBack.band === bandBack.want && bandBack.table && bandBack.label === bandBack.last,
    JSON.stringify(bandBack));
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
    for (const id of ["trap", "syn-hipdown", "def-ohanlon"]) {
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
  // def-ohanlon's repair ply is a real game's concession, not a habit on show: the
  // words must say "game" and never call the move a habit or a repair.
  const oh = rep["def-ohanlon"];
  check("a defence line's repair ply asks for a better move than the game's",
    /that is the game move/i.test(oh.own.msg) && /centipawns behind/i.test(oh.own.msg) &&
      /accepted/i.test(oh.better.msg) && /the game went Re8/i.test(oh.better.text) &&
      !/habit|repaired|the line is about/i.test(oh.own.msg + oh.better.msg + oh.better.text),
    JSON.stringify({ own: oh.own.msg.slice(0, 80), better: oh.better.msg.slice(0, 60), text: oh.better.text.slice(0, 60) }));
}

// Position details and common mistakes. Invariant 4 over the whole repertoire:
// while a question is live, the details panel shows nothing that names the move,
// its squares or its piece's squares, in Drill and in Shuffle; Shuffle also hides
// the line's name. Once answered, a common mistake is a counted choice the grader
// prices as a concession or worse, printed with its stored count and score.
{
  const info = await page.evaluate(() => {
    const out = { live: 0, leaks: [], shuffleName: [], hidden: [], answered: 0, sample: null, offbook: null, shuffleCtx: null, notMistake: [], arrows: [], planted: 0 };
    const drawn = () => [...document.querySelectorAll("#arrows g.ar")].map((g) => ({ u: g.dataset.u, c: g.dataset.c }));
    const reset = (mode, li, ply) => {
      S.screen = "board"; S.mode = mode; S.li = li; S.ply = ply; S.sel = null; S.tries = 0; S.hint = 0; S.ans = null; S.missAt = null; S.arrow = null;
      S.passKeys = new Set(); clearFree(); if (S.pending && S.pending !== 1) clearTimeout(S.pending); S.pending = 0;
    };
    LINES.forEach((l, li) => {
      for (const p of drillPlies(l)) {
        const want = l.moves[p];
        for (const mode of ["line", "shuffle"]) {
          reset(mode, li, p); render(false);
          const txt = el("infoTxt").textContent;
          if (el("infoBox").style.display === "none") { out.hidden.push(l.id + ":" + p + ":" + mode); continue; }
          out.live++;
          if (refuteLeaks(txt, want[0], want[1])) out.leaks.push(l.id + ":" + p + ":" + mode + " " + txt.slice(0, 80));
          // Board arrows: none at all on a live question. Then plant the full answer
          // set for this very position (first choice, accepted moves, reply, a
          // refused move) both as an answered set and as a live one: the answered
          // set must not draw while the question is live, and a live set may draw
          // only the refused move and its refutation, never the answer.
          if (drawn().length) out.arrows.push(l.id + ":" + p + ":" + mode + " unprompted " + JSON.stringify(drawn()));
          const pos0 = posAt(l, p), wrong = legal(pos0).map(uciOf).find((u) => u !== want[0]);
          S.missAt = { k: keyFen(pos0), u: wrong };
          const full = answerArrows(pos0, want[0], want[0]);
          for (const flag of [false, true]) {
            setArrows(full, flag);
            for (const a of drawn()) {
              out.planted++;
              if (a.c !== "bad") out.arrows.push(l.id + ":" + p + ":" + mode + " planted " + a.c + " " + a.u);
            }
          }
          S.ans = null; S.missAt = null; drawArrows();
          if (mode === "shuffle" && l.name && txt.indexOf(l.name) >= 0) out.shuffleName.push(l.id + ":" + p);
        }
        // every priced mistake is priced, counted and never a move some line plays here
        const pos = posAt(l, p);
        for (const c of commonMistakes(pos)) {
          if (["concession", "inferior", "losing"].indexOf(c.grade.verdict) < 0 || c.g < CHO_FLOOR.games ||
            c.n < CHO_FLOOR.parent || c.g / c.n < CHO_FLOOR.share || (BOOKAT[keyFen(pos)] || new Set()).has(c.uci))
            out.notMistake.push(l.id + ":" + p + " " + c.san);
        }
        if (!out.sample && !NO_SHUFFLE.has(l.id) && commonMistakes(pos).length) out.sample = { li, p, id: l.id };
      }
    });
    if (out.sample) {
      const { li, p } = out.sample, l = LINES[li], pos = posAt(l, p), c = commonMistakes(pos)[0];
      out.sample.mistake = c.san; out.sample.count = c.g + " of " + c.n;
      // answered, in Drill: the panel describes the board just answered
      reset("line", li, p + 1); render(false);
      out.sample.panel = el("infoTxt").textContent; out.answered = el("infoBox").style.display !== "none";
      // the mistake itself played in Drill: refused, priced, and its count named
      reset("line", li, p); render(false);
      const m = legal(pos).find((x) => uciOf(x) === c.uci);
      playMove(pos, sq(m.t), m);
      out.offbook = el("nMsg").textContent;
      // the right move in Shuffle: the context block carries the common mistake
      reset("shuffle", li, p); render(false);
      const w = findMove(pos, l.moves[p][0]);
      playMove(pos, sq(w.t), w);
      out.shuffleCtx = el("nText").textContent;
      if (S.pending && S.pending !== 1) clearTimeout(S.pending);
      reset("line", li, 0);
    }
    stats.pos = {};
    return out;
  });
  check("no answer arrow is ever drawn on a live question (Drill and Shuffle, every drill ply)",
    info.live > 0 && info.arrows.length === 0 && info.planted > 0,
    JSON.stringify({ live: info.live, planted: info.planted, bad: info.arrows.slice(0, 3) }));
  check("details panel never leaks the live answer (Drill and Shuffle, every drill ply)",
    info.live > 0 && info.leaks.length === 0 && info.shuffleName.length === 0 && info.hidden.length === 0,
    JSON.stringify({ live: info.live, leaks: info.leaks.slice(0, 3), shuffleName: info.shuffleName.slice(0, 3), hidden: info.hidden.slice(0, 3) }));
  check("every common mistake is counted over the floor, priced as a mistake, and no line's move",
    info.notMistake.length === 0, info.notMistake.slice(0, 3).join(" | "));
  const s = info.sample || {};
  check("answered position shows its common mistake with the stored count",
    !!info.sample && info.answered && s.panel.indexOf(s.mistake) >= 0 && s.panel.indexOf(s.count + " counted games") >= 0 &&
      /Stockfish 16, depth \d+/.test(s.panel), JSON.stringify(s).slice(0, 300));
  check("playing a common mistake is priced and says how often players chose it",
    !!info.offbook && /centipawns? behind/.test(info.offbook) && info.offbook.indexOf("chose it here in " + s.count) >= 0,
    (info.offbook || "").slice(0, 200));
  check("Shuffle's answer names the common mistake",
    !!info.shuffleCtx && /A common (mistake|concession) here/.test(info.shuffleCtx) && info.shuffleCtx.indexOf(s.mistake) >= 0,
    (info.shuffleCtx || "").slice(-200));
  // The unconditional check near the top depends on which board Shuffle serves;
  // this one is at a board with a counted mistake, so the note is always present.
  check("a common-mistake note after a clean answer carries no engine readout",
    !!info.shuffleCtx && info.shuffleCtx.indexOf("Stockfish") < 0, (info.shuffleCtx || "").slice(-120));
}

// Threats and goals in the details panel (research/W5-POSITION-METADATA.md). A
// threat is shown only where the stored null-move search gains THREAT_CP or mates,
// with the stored numbers; while a question is live it never names the answer's
// move or squares and the threat move never touches the answer's squares; once
// answered it is always shown, with the line's own note on the move.
{
  const th = await page.evaluate(() => {
    const out = { plies: 0, live: 0, answered: 0, liveHidden: 0, bad: [], sampleLive: null, sampleAns: null, notes: 0, noteMissing: [], placeholder: 0 };
    const reset = (li, ply) => {
      S.screen = "board"; S.mode = "line"; S.li = li; S.ply = ply; S.sel = null; S.tries = 0; S.hint = 0;
      S.passKeys = new Set(); clearFree(); if (S.pending && S.pending !== 1) clearTimeout(S.pending); S.pending = 0;
    };
    const rowOf = (txt, label) => { const r = txt.find((x) => x[0] === label); return r ? r[1] : null; };
    LINES.forEach((l, li) => {
      for (const p of drillPlies(l)) {
        out.plies++;
        const pos = posAt(l, p), row = evalFor(pos), want = l.moves[p], t = threatAt(row);
        reset(li, p); render(false);
        const live = infoRows(l, p, false), ans = infoRows(l, p, true);
        const lt = rowOf(live, "Threat"), at = rowOf(ans, "Threat");
        if (live.concat(ans).some((r) => /Not a threat analysis/.test(r[1]))) out.placeholder++;
        if (t) {
          // the numbers printed are the stored ones
          const gain = t.gain === null ? null : row.t[2] + row.m[0][2];
          if (!at || at.indexOf(row.t[1]) < 0 || (gain !== null && at.indexOf(gain + " centipawns") < 0) ||
              (row.t[3] !== null && at.indexOf("mates in " + row.t[3]) < 0))
            out.bad.push(l.id + ":" + p + " answered threat row wrong: " + at);
          out.answered++;
          if (lt) {
            out.live++;
            if (refuteLeaks(lt, want[0], want[1]) || [row.t[0].slice(0, 2), row.t[0].slice(2, 4)].some((q) => want[0].indexOf(q) >= 0))
              out.bad.push(l.id + ":" + p + " live threat points at the answer: " + lt);
            if (!out.sampleLive) out.sampleLive = { id: l.id, ply: p, live: lt };
          } else out.liveHidden++;
          if (!out.sampleAns && lt) out.sampleAns = { id: l.id, ply: p, ans: ans.map((r) => r[0] + ": " + r[1]).join(" | ") };
        } else if (lt || (at && !/^Nothing concrete/.test(at))) out.bad.push(l.id + ":" + p + " threat shown under the threshold");
        const note = (want[2] || "").trim(), mn = rowOf(ans, "Move note");
        if (note) { if (mn && mn.indexOf(note) >= 0) out.notes++; else out.noteMissing.push(l.id + ":" + p); }
        if (rowOf(live, "Move note")) out.bad.push(l.id + ":" + p + " move note shown before answering");
      }
    });
    reset(0, 0); render(false);
    return out;
  });
  check("threats: shown only over the threshold, with the stored numbers, never pointing at a live answer",
    th.answered > 0 && th.live > 0 && th.bad.length === 0 && th.placeholder === 0,
    JSON.stringify({ answered: th.answered, live: th.live, bad: th.bad.slice(0, 3), placeholder: th.placeholder }));
  check("goals: the line's own note on the drilled move appears once answered, never before",
    th.notes > 0 && th.noteMissing.length === 0, JSON.stringify({ notes: th.notes, missing: th.noteMissing.slice(0, 3) }));
  console.log("  threat panel: " + th.answered + " of " + th.plies + " drill plies show a threat once answered, " +
    th.live + " while live (" + th.liveHidden + " held back until answered); " + th.notes + " move notes");
  console.log("  sample live: " + JSON.stringify(th.sampleLive));
  console.log("  sample answered: " + JSON.stringify(th.sampleAns).slice(0, 1200));
}

// Arrows on the board. After an answer: the table's first choice, the other
// accepted moves (capped), the refused move and the expected reply. While live:
// the refused move and the refutation the note names, and nothing else.
{
  const ar = await page.evaluate(() => {
    const drawn = () => [...document.querySelectorAll("#arrows g.ar")].map((g) => ({ u: g.dataset.u, c: g.dataset.c }));
    const put = (id, ply, mode) => {
      S.mode = mode; S.li = LINES.findIndex((l) => l.id === id); S.ply = ply; S.sel = null; S.tries = 0; S.hint = 0;
      S.passKeys = new Set(); clearFree(); S.missAt = null; S.flip = L().you === "b"; go("board");
      return posAt(L(), ply);
    };
    const play = (pos, s) => {
      const m = legal(pos).find((x) => san(pos, x).replace(/[+#]/g, "") === s);
      playMove(pos, sq(m.t), m); return uciOf(m);
    };
    const settle = () => { if (S.pending && S.pending !== 1) clearTimeout(S.pending); stopAll(); };
    // Changed with the system rule: accepted now means sound AND in the system, so a
    // sound move from another opening (1.e4 at move 1 of the Colle) is not counted
    // and must not be drawn.
    const accepted = (pos, w) => {
      const row = evalFor(pos), deep = DEEP[keyFen(pos)];
      const all = new Set([row, deep].filter(Boolean).flatMap((r) => [...r.m, ...(r.x || [])].map((e) => e[0])));
      return [...all].filter((u) => GRADE.accept.indexOf(gradeMove(row, pos, u).verdict) >= 0 && inSystem(L(), pos, u, w, row)).length;
    };
    const out = {};
    stats.pos = {};
    // correct answer in Shuffle, at a board with several sound moves
    let pos = put("ck", 0, "shuffle");
    const want = L().moves[0];
    play(pos, want[1].replace(/[+#!?]/g, ""));
    const a1 = drawn();
    out.right = { arrows: a1, first: evalFor(pos).m[0][0], ok: accepted(pos, want[0]), reply: L().moves[1][0].slice(0, 4),
      key: el("akey").textContent, pending: !!S.pending };
    skipNext(); settle();
    out.afterSkip = drawn().length;
    // a priced wrong move, live: only the red arrow, on the played move's squares
    pos = put("anti", 6, "shuffle");
    const wrongU = play(pos, "c3");
    out.wrong = { arrows: drawn(), u: wrongU.slice(0, 4), tries: S.tries, want: L().moves[6][0] };
    playMove(pos, "a1", null);
    out.afterRetry = drawn().length;
    play(pos, "c3");
    out.again = drawn().length;
    hint();
    out.afterHint = drawn().length;
    // then the right move: the missed move stays red beside the answer arrows
    play(pos, L().moves[6][1].replace(/[+#!?]/g, ""));
    out.wrongThenRight = drawn();
    settle(); go("menu");
    out.afterMenu = !!S.ans;
    // flipped board, Black to move: arrow ends sit on the named squares' centres
    pos = put("hip-e4", 5, "shuffle");
    out.flip = S.flip;
    play(pos, L().moves[5][1].replace(/[+#!?]/g, ""));
    const br = el("board").getBoundingClientRect(), geo = [];
    for (const g of document.querySelectorAll("#arrows g.ar")) {
      const ln = g.querySelector("line.body"), tip = g.querySelector("polygon").getAttribute("points").split(" ")[0].split(",").map(Number);
      const at = (s, x, y) => {
        const r = document.querySelector('[data-sq="' + s + '"]').getBoundingClientRect();
        return Math.abs(br.left + x / 8 * br.width - (r.left + r.width / 2)) < 1.5 && Math.abs(br.top + y / 8 * br.height - (r.top + r.height / 2)) < 1.5;
      };
      geo.push({ u: g.dataset.u, from: at(g.dataset.u.slice(0, 2), +ln.getAttribute("x1"), +ln.getAttribute("y1")), to: at(g.dataset.u.slice(2, 4), tip[0], tip[1]) });
    }
    out.geo = geo;
    const w = parseFloat(getComputedStyle(document.querySelector("#arrows g.ar.best line.body") || document.body).strokeWidth);
    out.scale = { svg: el("arrows").getBoundingClientRect().width, board: br.width, w };
    settle(); skipNext(); settle();
    stats.pos = {};
    return out;
  });
  const r = ar.right, alts = r.arrows.filter((a) => a.c === "alt");
  check("after a correct answer: one first-choice arrow, the in-system accepted moves (capped), the expected reply, and no 1.e4",
    r.arrows.filter((a) => a.c === "best").length === 1 && r.arrows.find((a) => a.c === "best").u === r.first.slice(0, 4) &&
      alts.length === Math.min(2, r.ok - 1) && alts.every((a) => a.u !== r.first.slice(0, 4)) &&
      r.arrows.some((a) => a.c === "reply" && a.u === r.reply) && r.pending && /first choice/.test(r.key) &&
      !r.arrows.some((a) => a.u === "e2e4"),
    JSON.stringify(r));
  check("arrows clear when the drill moves on", ar.afterSkip === 0 && ar.afterMenu === false, JSON.stringify({ skip: ar.afterSkip, menu: ar.afterMenu }));
  check("a wrong move draws one red arrow on its own squares while the question is live",
    ar.wrong.arrows.length === 1 && ar.wrong.arrows[0].c === "bad" && ar.wrong.arrows[0].u === ar.wrong.u && ar.wrong.tries === 1,
    JSON.stringify(ar.wrong));
  check("the refused move's arrow goes on the next attempt and on a hint",
    ar.afterRetry === 0 && ar.again === 1 && ar.afterHint === 0, JSON.stringify({ retry: ar.afterRetry, again: ar.again, hint: ar.afterHint }));
  check("after a miss, the answered board keeps the missed move red beside the table's choice",
    ar.wrongThenRight.some((a) => a.c === "bad" && a.u === ar.wrong.u) && ar.wrongThenRight.some((a) => a.c === "best"),
    JSON.stringify(ar.wrongThenRight));
  check("flipped board: every arrow runs from its origin square's centre to its destination's",
    ar.flip === true && ar.geo.length > 1 && ar.geo.every((g) => g.from && g.to), JSON.stringify(ar.geo));
  check("arrows are drawn in board units, so they scale with the board",
    Math.abs(ar.scale.svg - ar.scale.board) < 1 && ar.scale.w > 0 && ar.scale.w < 1, JSON.stringify(ar.scale));

  // A refutation arrow, on the real (deferred) search path: nothing while the search
  // runs, then the red arrow and the reply the note names when the verdict lands, and
  // never on a board the learner has left.
  const refPath = await page.evaluate(async () => {
    const drawn = () => [...document.querySelectorAll("#arrows g.ar")].map((g) => ({ u: g.dataset.u, c: g.dataset.c }));
    const put = () => {
      S.mode = "shuffle"; S.li = LINES.findIndex((l) => l.id === "ck"); S.ply = 2; S.sel = null; S.tries = 0; S.hint = 0;
      S.passKeys = new Set(); clearFree(); S.missAt = null; S.flip = false; go("board");
      return posAt(L(), 2);
    };
    const wait = async (fn) => { for (let i = 0; i < 200 && !fn(); i++) await new Promise((r) => setTimeout(r, 50)); };
    stats.pos = {};
    let pos = put();
    let m = legal(pos).find((x) => san(pos, x) === "Bh6");
    playMove(pos, sq(m.t), m);
    const before = drawn();
    await wait(() => !/Checking/.test(el("nMsg").textContent));
    const out = { before, after: drawn(), msg: el("nMsg").textContent, via: matVia, want: L().moves[2][0] };
    // stale: skip before the verdict arrives
    pos = put();
    playMove(pos, sq(m.t), m);
    S.li = LINES.findIndex((l) => l.id === "ck"); shuffle(false);
    await new Promise((r) => setTimeout(r, 1500));
    out.stale = drawn();
    stopAll(); stats.pos = {};
    return out;
  });
  const ref = refPath.after.find((a) => a.c === "ref");
  check("a refuted wrong move gets the red arrow and the named reply's arrow once the search answers (" + refPath.via + ")",
    refPath.before.length === 0 && refPath.after.some((a) => a.c === "bad" && a.u === "c1h6") && !!ref && ref.u === "g8h6" && /Nxh6/.test(refPath.msg) &&
      ![refPath.want.slice(0, 2), refPath.want.slice(2, 4)].some((s) => ref.u.indexOf(s) >= 0),
    JSON.stringify(refPath));
  check("a verdict for a board already left draws nothing", refPath.stale.length === 0, JSON.stringify(refPath.stale));

  // Every refutation the note names, over the repertoire: its arrow touches neither
  // of the answer's squares, and it is drawn only where the words name it.
  const refScan = await page.evaluate(() => {
    const out = { cases: 0, drawn: 0, bad: [] }, t0 = Date.now();
    for (let li = 0; li < LINES.length && Date.now() - t0 < 20000; li++) {
      const l = LINES[li];
      for (const p of drillPlies(l)) {
        const pos = posAt(l, p), row = evalFor(pos), want = l.moves[p][0];
        const m = legal(pos).find((x) => uciOf(x) !== want && gradeMove(row, pos, x).analysis !== "checked" && "nbq".indexOf(pos.b[x.f].toLowerCase()) >= 0);
        if (!m) continue;
        const v = matVerdict(pos, m);
        if (!v || v.swing < 1) continue;
        S.screen = "board"; S.mode = "shuffle"; S.li = li; S.ply = p; S.tries = 0; S.hint = 0; S.sel = null; clearFree(); S.pending = 0; S.ans = null;
        S.flip = l.you === "b"; render(false);
        offBook(sq(m.t), san(pos, m), v, gradeMove(row, pos, m), null, uciOf(m));
        out.cases++;
        const got = [...document.querySelectorAll("#arrows g.ar")].map((g) => ({ u: g.dataset.u, c: g.dataset.c }));
        const r = got.find((a) => a.c === "ref"), named = el("nMsg").textContent.indexOf(v.san.replace(/[+#]/g, "")) >= 0;
        if (got.some((a) => a.c !== "bad" && a.c !== "ref")) out.bad.push(l.id + ":" + p + " " + JSON.stringify(got));
        if (r) {
          out.drawn++;
          if (!named || r.u !== v.uci.slice(0, 4)) out.bad.push(l.id + ":" + p + " unnamed " + r.u);
          if (r.u.indexOf(want.slice(0, 2)) >= 0 || r.u.indexOf(want.slice(2, 4)) >= 0) out.bad.push(l.id + ":" + p + " touches the answer " + r.u + " " + want);
        }
        if (!got.some((a) => a.c === "bad" && a.u === uciOf(m).slice(0, 4))) out.bad.push(l.id + ":" + p + " no red arrow");
      }
    }
    S.ans = null; S.tries = 0; stats.pos = {}; S.run = 0;
    return out;
  });
  check("a refutation arrow is drawn only where the note names it and never touches the answer's squares",
    refScan.cases > 20 && refScan.drawn > 0 && refScan.bad.length === 0, JSON.stringify({ cases: refScan.cases, drawn: refScan.drawn, bad: refScan.bad.slice(0, 3) }));

  // The setting: on by default, off hides the arrows, stored, kept by a reset,
  // exported, and a backup without it imports with it on.
  const arOpt = await page.evaluate(() => {
    const saved = JSON.stringify(stats);
    const put = () => {
      S.mode = "shuffle"; S.li = LINES.findIndex((l) => l.id === "ck"); S.ply = 0; S.sel = null; S.tries = 0; S.hint = 0;
      S.passKeys = new Set(); clearFree(); go("board");
      const pos = posAt(L(), 0), m = findMove(pos, L().moves[0][0]); playMove(pos, sq(m.t), m);
    };
    const n = () => document.querySelectorAll("#arrows g.ar").length;
    const def = S.arrowsOn;
    el("oArrows").click();
    const off = { live: S.arrowsOn, stored: stats.arrows, label: el("oArrowsS").textContent, pressed: el("oArrows").getAttribute("aria-pressed") };
    put(); off.drawn = n(); off.key = el("akey").textContent;
    if (S.pending && S.pending !== 1) clearTimeout(S.pending); stopAll(); S.pending = 0;
    el("pReset").click(); el("pReset").click();
    const afterReset = { live: S.arrowsOn, stored: stats.arrows };
    el("pExport").click();
    const exported = JSON.parse(el("pData").value).arrows;
    el("pData").value = JSON.stringify({ v: 6, pos: {}, pz: {} }); el("pImport").click();
    const absent = { live: S.arrowsOn, stored: stats.arrows, label: el("oArrowsS").textContent };
    el("pData").value = JSON.stringify({ v: 6, pos: {}, pz: {}, arrows: false }); el("pImport").click();
    const explicit = S.arrowsOn;
    el("pData").value = saved; el("pImport").click();
    S.arrowsOn = true; stats.arrows = true; save(); syncOpts();
    put(); const on = n();
    if (S.pending && S.pending !== 1) clearTimeout(S.pending); stopAll(); S.pending = 0; go("menu");
    stats.pos = {};
    return { def, off, afterReset, exported, absent, explicit, on };
  });
  check("arrows on the board is a setting, on by default, that hides them when off",
    arOpt.def === true && arOpt.off.live === false && arOpt.off.stored === false && arOpt.off.label === "off" &&
      arOpt.off.pressed === "false" && arOpt.off.drawn === 0 && arOpt.off.key === "" && arOpt.on > 0, JSON.stringify(arOpt));
  check("the arrows setting survives a reset, travels in an export, and defaults on for older backups",
    arOpt.afterReset.live === false && arOpt.afterReset.stored === false && arOpt.exported === false &&
      arOpt.absent.live === true && arOpt.absent.stored === true && arOpt.absent.label === "on" && arOpt.explicit === false,
    JSON.stringify(arOpt));
}

check("app never calls fetch", fetches.length === 0, fetches.join(" | "));
check("no request leaves the page origin", external.length === 0, external.join(" | "));

// The system rule: a move is credited only when the grader accepts it AND it is in
// the learner's system (the line's move, another same-chapter same-side line's move
// from this board, or a credited formation move). Move 1 of a Colle line: the grader
// accepts 1.e4, 1.c4 and 1.g3, and none of them is the Colle.
{
  const sys = await page.evaluate(() => {
    const li = LINES.findIndex((l) => l.id === "ck"), l = LINES[li], pos = posAt(l, 0), row = evalFor(pos);
    const k = key(l, 0), sanOf = (u) => san(pos, findMove(pos, u));
    const inSys = legal(pos).map(uciOf).filter((u) => GRADE.accept.indexOf(gradeMove(row, pos, u).verdict) >= 0 && inSystem(l, pos, u, l.moves[0][0], row));
    const sound = legal(pos).map(uciOf).filter((u) => GRADE.accept.indexOf(gradeMove(row, pos, u).verdict) >= 0);
    S.mode = "shuffle"; S.li = li; S.ply = 0; S.flip = false; clearFree();
    const conf = infoRows(l, 0, true).find((r) => r[0] === "Confidence")[1];
    // Shuffle, 1.e4: neutral, nothing recorded, the question stays live and no arrow.
    S.sel = null; S.tries = 0; S.hint = 0; S.missAt = null; S.ans = null; stats.pos = {}; S.run = 3; go("board");
    const e4 = legal(pos).find((m) => san(pos, m) === "e4");
    playMove(pos, "e4", e4);
    const refuse = { msg: el("nMsg").textContent, rec: !!stats.pos[k], run: S.run, tries: S.tries, hint: S.hint, ply: S.ply,
      live: liveQ(), arrows: document.querySelectorAll("#arrows g.ar").length, pending: !!S.pending };
    // then 1.d4, the line's move: credited
    const d4 = legal(pos).find((m) => san(pos, m) === "d4");
    playMove(pos, "d4", d4);
    const credit = { msg: el("nMsg").textContent, ok: (stats.pos[k] || {}).ok,
      arrows: [...document.querySelectorAll("#arrows g.ar")].map((g) => g.dataset.u) };
    if (S.pending && S.pending !== 1) clearTimeout(S.pending); stopAll(); stats.pos = {}; S.run = 0; clearFree();
    return { inSys: inSys.map(sanOf).sort(), sound: sound.length, ways: waysAt(k), need: needWays(k), conf, refuse, credit };
  });
  check("move 1 of the Colle: the system holds d4 and Nf3, and needWays counts only those",
    sys.inSys.join(",") === "Nf3,d4" && sys.sound > 2 && sys.ways === 2 && sys.need === 2, JSON.stringify(sys));
  check("position details count the system's accepted moves apart from the rest",
    sys.conf.includes(" 2 stored moves are accepted here; ") && sys.conf.includes("sound but leave the system"), sys.conf);
  check("1.e4 in a Colle Shuffle is refused neutrally: no miss, no credit, still live, and the Colle is named",
    /^e4 is sound, but it is not a Colle move here\. Try again\./.test(sys.refuse.msg) && !sys.refuse.rec &&
      sys.refuse.run === 3 && sys.refuse.tries === 0 && sys.refuse.hint === 0 && sys.refuse.ply === 0 &&
      sys.refuse.live && !sys.refuse.pending && sys.refuse.arrows === 0,
    JSON.stringify(sys.refuse));
  check("1.d4 is then credited, and no arrow shows 1.e4",
    sys.credit.msg.includes("Correct") && sys.credit.ok === 1 && !sys.credit.arrows.includes("e2e4") && sys.credit.arrows.includes("g1f3"),
    JSON.stringify(sys.credit));
}
// A Hippo position where the system has one move: one answer suffices there.
{
  const one = await page.evaluate(() => {
    const ks = Object.keys(KEYLINES).filter((k) => LINES[KEYLINES[k][0]].ch === "Hippopotamus as Black");
    const k = ks.find((k) => { const f = k.slice(0, k.lastIndexOf(":")), row = EVL[f]; if (!row) return false;
      const p = fenPos(f); return row.m.filter((e) => GRADE.accept.indexOf(gradeMove(row, p, e[0]).verdict) >= 0).length >= 2 && waysAt(k) === 1; });
    S.recog = true;
    return { k: k || null, need: k ? needWays(k) : null };
  });
  check("where the engine accepts several moves and the system plays one, one answer is enough",
    !!one.k && one.need === 1, JSON.stringify(one));
}
// Arrows are drawn above every piece. The castling case from a phone report: h-nf3bc4,
// Black's O-O ply, ...d6 credited in Shuffle, board flipped - the O-O arrow starts on
// the king and the ...d6 arrow ends on the pawn. At points along every shaft and head
// the topmost element must belong to the arrow layer, never a piece. The overlay is
// pointer-events:none, so it is switched on for the probe only.
{
  const layer = await page.evaluate(async () => {
    const out = [], probe = () => {
      const svg = el("arrows"), R = svg.getBoundingClientRect();
      svg.style.pointerEvents = "auto";
      svg.querySelectorAll("*").forEach((n) => (n.style.pointerEvents = "visiblePainted"));
      for (const g of svg.querySelectorAll("g.ar")) {
        const ln = g.querySelector("line.body"), tip = g.querySelector("polygon").getAttribute("points").split(" ")[0].split(",").map(Number);
        const x1 = +ln.getAttribute("x1"), y1 = +ln.getAttribute("y1"), x2 = +ln.getAttribute("x2"), y2 = +ln.getAttribute("y2");
        const pts = [0.05, 0.25, 0.5, 0.75, 0.95].map((t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
        pts.push([(x2 + tip[0]) / 2, (y2 + tip[1]) / 2]);
        for (const [x, y] of pts) {
          const e = document.elementFromPoint(R.left + x / 8 * R.width, R.top + y / 8 * R.height);
          out.push({ u: g.dataset.u, ok: !!(e && e.closest("svg.arrows")), top: e ? (e.closest(".pc") ? "piece" : e.tagName) : null });
        }
      }
      svg.style.pointerEvents = "";
      svg.querySelectorAll("*").forEach((n) => (n.style.pointerEvents = ""));
    };
    const put = (id, ply) => {
      const li = LINES.findIndex((l) => l.id === id);
      S.mode = "shuffle"; S.li = li; S.ply = ply; S.sel = null; S.tries = 0; S.hint = 0; S.missAt = null; S.ans = null;
      clearFree(); S.flip = LINES[li].you === "b"; stats.pos = {}; go("board");
      return posAt(LINES[li], ply);
    };
    const l = LINES.find((x) => x.id === "h-nf3bc4"), oo = l.moves.findIndex((m, i) => i % 2 === 1 && m[1].startsWith("O-O"));
    let pos = put("h-nf3bc4", oo);
    const d6 = legal(pos).find((m) => san(pos, m) === "d6");
    setupGood(pos, d6, "d6", "", null);
    await new Promise((r) => setTimeout(r, 400));
    probe();
    stopAll(); clearFree();
    // two ordinary answered positions
    for (const [id, p] of [["ck", 0], ["hip-e4", 5]]) {
      pos = put(id, p);
      const w = LINES[S.li].moves[p][0], m = findMove(pos, w);
      playMove(pos, sq(m.t), m);
      await new Promise((r) => setTimeout(r, 400));
      probe();
      if (S.pending && S.pending !== 1) clearTimeout(S.pending); stopAll(); clearFree();
    }
    stats.pos = {}; S.run = 0; go("menu");
    return out;
  });
  check("every arrow is drawn above every piece along its shaft and head, the castling king included",
    layer.length >= 12 && layer.some((x) => x.u === "e8g8") && layer.every((x) => x.ok),
    JSON.stringify(layer.filter((x) => !x.ok)) + " of " + layer.length);
}
// A Hippo line written without its own targets still treats the wall as the system:
// 31 Hippo lines have none, and without the chapter fallback an out-of-order wall
// move was told it is "not a Hippopotamus move", which is false. With it, the gate
// either credits the wall move or, where the table's first choice is not a wall move,
// calls the position demanding - never "no-targets".
{
  const fb = await page.evaluate(() => {
    const l = LINES.find(x => x.id === "h-nf3bc4");
    const ply = l.moves.findIndex((m, i) => i % 2 === 1 && m[1].startsWith("O-O"));
    let pos = startPos(); for (let i = 0; i < ply; i++) pos = make(pos, findMove(pos, l.moves[i][0]));
    const d6 = legal(pos).find(x => san(pos, x) === "d6");
    const reason = setupGate(evalFor(pos), pos, d6, tgtOf(l)).reason;
    let credited = 0;
    for (const x of LINES) {
      if (x.ch !== CHAPTERS[1] || (x.targets && x.targets.length) || NO_SHUFFLE.has(x.id)) continue;
      let p = startPos();
      x.moves.forEach((mv, i) => {
        if (i % 2 === 1) for (const m of legal(p)) {
          const g = setupGate(evalFor(p), p, m, tgtOf(x));
          if (g.credit) credited++;
        }
        p = make(p, findMove(p, mv[0]));
      });
    }
    const bad = LINES.filter(x => NO_SHUFFLE.has(x.id)).filter(x => tgtOf(x).length > 0).map(x => x.id);
    return { own: (l.targets || []).length, fallback: tgtOf(l) === HIPPO_T, reason, credited, bad };
  });
  check("a Hippo line without its own targets falls back to the Hippo formation, never for mistake lines",
    fb.own === 0 && fb.fallback && fb.reason !== "no-targets" && fb.credited > 0 && fb.bad.length === 0, JSON.stringify(fb));
}
check("no console or page errors", errors.length === 0, errors.join(" | "));
await browser.close();
if (fail) { console.error(`\n${fail} failure(s).`); process.exit(1); }
console.log("\nUI smoke test passed.");
