/* ================= state ================= */
const S={screen:"menu",mode:"study",li:0,ply:0,flip:false,ghost:false,
  sel:null,timer:null,tries:0,hint:0,lastKey:null,theme:0,
  run:0,today:0,t0:0,lastMs:0,set:0,bookOnly:false,freqW:true,band:FRQ_DEF,recog:true,lvW:true,free:[],fpos:null,pending:0,drag:null,tapDown:null,pz:0,cursor:null,
  arrow:null,passKeys:null,evNote:null,infoAt:null,epoch:0,arrowsOn:true,ans:null,missAt:null};
let stats={pos:{},pz:{},day:"",today:0,theme:0};
// True when neither window.storage nor localStorage would take a write, so the
// session lives in memory only. Declared here rather than beside STORE so crash()
// can read it even if the script died before the storage block ran.
let MEMONLY=false;
// True when storage holds something load() could not read. Writing over it is the
// one irreversible thing here, so save() stands down until Import or Reset says to.
let SAVE_HELD=false;
const THEMES=[
  ["Brown","#f0d9b5","#b58863","#f6f1e6","#12161b","#12161b","#ded5bd"],
  ["Blue","#dee3e6","#8ca2ad","#f8f6f0","#14181d","#14181d","#dfe4e8"],
  ["Green","#ebecd0","#779556","#f7f6ec","#12161b","#12161b","#e3e6cd"],
  ["Slate","#e4dabc","#48645f","#f6f1e6","#12161b","#12161b","#ded5bd"]
];
const SETS=[["Standard","0 0 45 45",()=>CB,false],["Engraved","0 0 100 100",()=>PIECE,true]];
function pieceEl2(ch,cls){
  const set=SETS[S.set]||SETS[0],svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox",set[1]);
  svg.setAttribute("class",cls+(set[3]?" custom":""));
  const map=set[2]();
  svg.innerHTML=set[3]?map[ch.toLowerCase()]:map[ch];
  return svg;
}
const el=id=>document.getElementById(id);
// Remote text - the masters database is the only thing on this page that is not
// local data - goes through here before it can reach innerHTML.
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
/* Every deferred callback is armed through later(): the id is tracked so stopAll()
   can cancel it, and the session it was armed in is recorded so one that outlived a
   navigation does nothing even if it fires anyway. Nothing but flash()'s own mark
   removal uses a bare setTimeout - that one must run whatever else happened, or the
   mark stays on the board for good. Before this, leaving a solved puzzle inside its
   1500ms window dragged the user back to it, and a stale S.pending swallowed the
   first tap of the next session and ran the shuffle advance in the wrong mode. */
const TIMERS=new Set();
function later(fn,ms){
  const ep=S.epoch;
  // fn.call, not fn(): test/verify.mjs fails the build on any bare lower-case call
  // with no definition in the bundle, and a parameter is not a definition.
  const id=setTimeout(()=>{TIMERS.delete(id);if(ep===S.epoch)fn.call(null);},ms);
  TIMERS.add(id);
  return id;
}
function stopAll(){
  stop();closePromotion();
  S.epoch++;
  for(const id of TIMERS)clearTimeout(id);
  TIMERS.clear();
  S.pending=0;
}
let PZLINE=null;
function makePz(i){
  const p=PZ[i],p0=fenPos(p.f),m0=findMove(p0,p.m[0]);
  const s0=m0?san(p0,m0):"",p1=m0?make(p0,m0):p0;
  PZLINE={id:"pz:"+p.id,ch:"Tactics",you:p.side,name:"Puzzle "+p.id,pz:p,
    src:p.t,start:fenOf(p1),targets:[],
    moves:p.m.slice(1).map((u,k)=>[u,p.s[k+1],k===0?("They have just played "+s0+"."):""])};
  return PZLINE;
}
function startPuzzle(i){
  stopAll();
  S.mode="puzzle";S.pz=((i%PZ.length)+PZ.length)%PZ.length;makePz(S.pz);
  S.ply=0;S.sel=null;S.tries=0;S.hint=0;S.arrow=null;S.ans=null;S.missAt=null;clearFree();
  S.flip=PZLINE.you==="b";syncOpts();
  el("nMsg").textContent="";go("board");armClock();
}
function armPz(ms){
  stopAll();
  const bar=el("progBar");
  bar.style.transition="none";bar.style.width="100%";void bar.offsetWidth;
  bar.style.transition="width "+ms+"ms linear";bar.style.width="0%";
  S.pending=later(()=>{S.pending=0;startPuzzle(S.pz+1);},ms);
}
const L=()=>(S.mode==="puzzle"&&PZLINE)?PZLINE:LINES[S.li];
// A line with a drill field (the defence lines) is drilled only from that ply: the
// plies before it are the game's opening, and they play themselves.
const yourTurn=()=>(nowPos().w?"w":"b")===L().you&&(S.free.length>0||S.ply>=(L().drill||0));
// Review intervals in hours, indexed by streak (state() clamps the index to the last
// entry, so a longer streak just sits on the ceiling). The old ceiling was 336h (14d):
// with 442 positions that is a permanent floor of ~30 reviews a day once everything is
// learned, so the ladder runs on to 30d and 60d. "Solid" is decided by streak, not by
// ladder position, so this does not change what counts as mastered.
const HOUR=36e5, LADDER=[0,4,24,72,168,336,720,1440];
const CHAPTERS=["Colle as White","Hippopotamus as Black"];
// A board label names the side the user plays. The Colle chapter holds two Black
// defence lines, and "Colle as White" over a Black-to-play board is false.
function chapterLabel(l){return l.ch===CHAPTERS[0]&&l.you==="b"?"Colle chapter \u00b7 defending as Black":l.ch;}
LINES.sort((a,b)=>CHAPTERS.indexOf(a.ch)-CHAPTERS.indexOf(b.ch));

function boardAt(l,n){let b=fenBoard(l.start);for(let i=0;i<n;i++)b=apply(b,l.moves[i][0]);return b;}
function posAt(l,n){
  let p=l.start===START?startPos():fenPos(l.start.indexOf(" ")>0?l.start:l.start+" w - -");
  for(let i=0;i<n;i++){const m=findMove(p,l.moves[i][0]);if(!m)break;p=make(p,m);}
  return p;
}
function nowPos(){return S.free.length?S.fpos:posAt(L(),S.ply);}
function clearFree(){S.free=[];S.fpos=null;const o=el("offbook");if(o)o.classList.remove("on");}
function drillPlies(l){const a=[];for(let p=l.drill||0;p<l.moves.length;p++)if((p%2===0?"w":"b")===l.you)a.push(p);return a;}
/* Position identity: two lines can transpose into the same board, and fenOf always
   appends a fixed "0 1" so its output needs no trimming to compare across lines. When
   two lines land on the same board and want the same reply, they should share one
   stats record instead of one each - key() below folds line+ply down to fen+expected-
   move for that reason. Puzzle "lines" (id "pz:<id>", built at runtime by makePz) keep
   the old l.id+":"+p shape unchanged; grade() relies on that "pz:" prefix to skip them,
   so it must not become a fen key. */
// Lines that teach a mistake on purpose. Shuffle gives no context for why a losing
// move would be "correct", so they are kept out of it and out of ALT below. Ids
// checked against src/data/lines.js. Study and Drill still offer them in full.
// def-ohanlon is here for its repair ply: it must reach the game's ...Re8, a
// concession, and only line mode refuses that move before playing it.
const NO_SHUFFLE=new Set(["trap","soltis-trap","syn-hipdown","def-ohanlon"]);
/* ALT maps a board to every line and ply that trains it. Where two lines transpose
   and want different replies, Shuffle accepts any of them: the position is asked on
   its own there, so there is no continuation to keep consistent. Study and Drill are
   unaffected and still grade against the line you picked. */
/* fenOf writes an ep square whenever the last move was a double pawn push, whether or
   not any capture is actually possible - so two lines reaching the same board by
   different move orders (one via a double push, one not) get different fenOf strings
   even though they are the same position. Blank that field HERE, at the KEYCACHE/ALT
   boundary, rather than in fenOf itself: makePz (above) still needs fenOf's raw,
   ep-preserving output for PZLINE.start, because that string is re-parsed by fenPos
   and replayed move-by-move, and a puzzle whose next move is genuinely an en-passant
   capture would silently stop being legal if the flag were stripped there. Nothing
   else calls fenOf. */
function keyFen(pos){
  if(pos.ep<0)return fenOf(pos);
  return legal(pos).some(m=>m.ep)?fenOf(pos):fenOf({b:pos.b,w:pos.w,cr:pos.cr,ep:-1});
}
function bookExcluded(l){return S.bookOnly&&(KIND[l.id]==="game"||KIND[l.id]==="model"||KIND[l.id]==="synthetic");}
/* ---------- practical occurrence (src/data/freq.js) ---------- */
/* FRQ buckets how often a position is reached in the counted player pool; keys are
   hashed because 88 full fens do not fit the page budget. No entry means neutral,
   never demoted: the counting stops at twenty ply, so "not counted" and "rare" are
   different things and only one is known. FRQS floors the rare forcing positions at
   neutral - a chess judgement recorded in research/, not a number. The spread is
   narrow on purpose: this reorders Shuffle, it silences nothing.
   One table per rating band (FRQ_BANDS); FRQB is the one in use. The trainer never
   knows the user's rating, so it starts on FRQ_DEF - the band most counted games
   fall in - and says so in the options sheet rather than pretending to fit. */
const FRQBS=[],FRQS=new Set(),FRQW=[.55,.7,.85,1,1.2,1.5];
(function(){
  for(const t of FRQ){
    const m=Object.create(null),g=t.split(",");
    for(let b=0;b<g.length;b++)for(let i=0;i<g[b].length;i+=5)m[g[b].slice(i,i+5)]=b;
    FRQBS.push(m);
  }
  for(let i=0;i<FRQ_SHARP.length;i+=5)FRQS.add(FRQ_SHARP.slice(i,i+5));
})();
let FRQB=FRQBS[FRQ_DEF];
function setBand(i){S.band=i;FRQB=FRQBS[i];}
// A stored band is kept only if this build ships it; anything else is the default,
// never band 0, which would quietly assume the user is a beginner.
function bandIdx(v){return (typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<FRQBS.length)?v:FRQ_DEF;}
function fhash(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(36).padStart(7,"0").slice(-5);
}
// k is a stats key, fen+":"+expected uci; a puzzle key hashes to nothing and comes
// back neutral, which is right.
function freqFactor(k){
  const i=k.lastIndexOf(":");
  if(i<0)return 1;
  const h=fhash(k.slice(0,i)),b=FRQB[h],w=b===undefined?1:FRQW[b];
  return FRQS.has(h)?Math.max(w,1):w;
}
// KEYLINES: stats key -> indices of the lines that train it, for waysAt's system test.
const KEYCACHE={},ALT={},KEYLINES={};
(function(){
  LINES.forEach((l,li)=>{
    for(const p of drillPlies(l)){
      const f=keyFen(posAt(l,p));
      KEYCACHE[l.id+":"+p]=f+":"+l.moves[p][0];
      (KEYLINES[f+":"+l.moves[p][0]]=KEYLINES[f+":"+l.moves[p][0]]||[]).push(li);
      // Full uci, promotion suffix included: a four-character key would make a
      // knight promotion look like the queen promotion another line trains.
      if(!NO_SHUFFLE.has(l.id))(ALT[f]=ALT[f]||[]).push([li,p,l.moves[p][0]]);
    }
  });
})();
// A move counts as book only for a line that trains the same side in the same
// chapter as the one being played: 1...d5 is def-kolt's move after 1.d4, but it is
// no Hippopotamus move, and naming the Colle defence inside a Hippo drill is noise.
function altAt(pos,uci,cur){
  const a=ALT[keyFen(pos)];
  return a?a.find(x=>x[2]===uci&&(!cur||(LINES[x[0]].ch===cur.ch&&LINES[x[0]].you===cur.you))):null;
}
/* ---------- the learner's system ----------
   The grader says whether a move is sound; it does not say whether it is the
   learner's opening. 1.e4 is as good as 1.d4 and it is not the Colle, so crediting it
   would drill the learner out of the system they came to learn. A move is in the
   system at a board when it is the line's own move there, a move another line of the
   same chapter and side plays from this board (altAt), or a formation move setupGate
   credits against the line's targets. Credit needs both: the grader accepts the move
   and it is in the system. The repair plies are outside this rule: repairing a
   mistake is about finding a sound move, whatever it is. */
// The formation a line credits. A line with its own targets uses them; one without
// falls back to its chapter's formation, so an out-of-order wall move is still a
// Hippopotamus move in the 31 Hippo lines written without targets. The lines that
// exist to show a mistake (NO_SHUFFLE) and repair lines never fall back: invariant 7
// keeps their targets empty on purpose.
function tgtOf(l){
  if(l.targets&&l.targets.length)return l.targets;
  if(NO_SHUFFLE.has(l.id)||l.repair)return [];
  if(l.ch===CHAPTERS[1]&&l.you==="b")return HIPPO_T;
  if(l.ch===CHAPTERS[0]&&l.you==="w")return COLLE_T;
  return [];
}
function inSystem(l,pos,u,want,row){
  if(u===want||altAt(pos,u,l))return true;
  const t=tgtOf(l);
  return !!(t.length&&setupGate(row||evalFor(pos),pos,u,t).credit);
}
// "a Colle move", "a Hippopotamus move": what offSystem says the move is not.
function sysName(l){
  if(l.ch===CHAPTERS[1])return "a Hippopotamus move";
  if(l.ch===CHAPTERS[0])return l.you==="w"?"a Colle move":"a move of the defence this chapter trains";
  return "a move of this repertoire";
}
function key(l,p){return l.id.indexOf("pz:")===0?l.id+":"+p:(KEYCACHE[l.id+":"+p]||l.id+":"+p);}
/* ---------- levels by depth ---------- */
/* Every drilled position sits in a level by the full-move number the learner answers
   at, counted from the line's own start. A board two lines reach at different depths
   takes the shallowest one: it is met there first. Puzzles have no level. The band
   edges are fixed and were chosen from the distribution of drill positions so that no
   level is a handful; the counts inside them are computed from LINES, never stored.
   A level is cleared when LV_CLEAR of the positions Shuffle can serve in it are solid,
   and the learner's level is the first one not cleared. Everything here is derived
   from stats; nothing new is stored but the on/off setting. */
const LEVELS=[[1,3],[4,5],[6,7],[8,10],[11,Infinity]];
// 80%: high enough that a level is really known before the next one is favoured, low
// enough that a few stubborn boards, or solid ones that have just come due again, do
// not hold the learner back for good.
const LV_CLEAR=.8;
// Shuffle multipliers for keys that are not due: the current level, then one, two,
// three and four levels deeper. Easier levels stay at 1. Never zero: deep positions
// still come up, only less often.
const LV_CUR=2,LV_DEEP=[.6,.4,.3,.2];
// Takes a line list so the transposition rule can be checked on lines built for the
// test; for LINES the keys come out of KEYCACHE, for anything else they are computed
// the same way KEYCACHE computes them.
function depthsOf(lines){
  const D={};
  for(const l of lines)for(const p of drillPlies(l)){
    const k=KEYCACHE[l.id+":"+p]||keyFen(posAt(l,p))+":"+l.moves[p][0],d=Math.floor(p/2)+1;
    if(!(D[k]<=d))D[k]=d;
  }
  return D;
}
const DEPTH=depthsOf(LINES);
function levelOf(k){
  const d=DEPTH[k];
  if(d===undefined)return -1;
  for(let i=0;i<LEVELS.length;i++)if(d<=LEVELS[i][1])return i;
  return LEVELS.length-1;
}
function levelSpan(i){const e=LEVELS[i];return e[1]===Infinity?"moves "+e[0]+" and later":"moves "+e[0]+"–"+e[1];}
// Per-level counts over the positions Shuffle can serve (the same filter as shuffle(),
// so "drill book lines only" narrows the levels too), each key counted once. cur is the
// first level not cleared, or -1 when every level is. An empty level counts as cleared.
function levels(){
  const rows=LEVELS.map(()=>({n:0,solid:0})),done=new Set();
  for(const l of LINES){
    if(NO_SHUFFLE.has(l.id)||bookExcluded(l))continue;
    for(const p of drillPlies(l)){
      const k=key(l,p);
      if(done.has(k))continue;
      done.add(k);
      const r=rows[levelOf(k)];r.n++;if(state(k)==="solid")r.solid++;
    }
  }
  let cur=-1;
  rows.forEach((r,i)=>{r.need=Math.ceil(LV_CLEAR*r.n-1e-9);r.cleared=r.solid>=r.need;if(cur<0&&!r.cleared)cur=i;});
  return {rows:rows,cur:cur};
}
// The Shuffle multiplier for one key given the current level; 1 when levels are off,
// all cleared, or the key has no level.
function levelFactor(k,cur){
  if(!S.lvW||cur<0)return 1;
  const lv=levelOf(k);
  if(lv<0||lv<cur)return 1;
  if(lv===cur)return LV_CUR;
  return LV_DEEP[Math.min(lv-cur,LV_DEEP.length)-1];
}
function rec(k){return stats.pos[k];}
const SLOW=7000;
function quick(r){return r&&r.ms&&r.ms<SLOW;}
/* ---------- one answer is not the whole position ---------- */
/* The grader accepts several moves, so answering a board once says the user found
   one of them, not that they read the board. waysAt counts the moves here that are
   both accepted by the grader (gradeMove: inside GRADE.equal of the best, or a mate
   as fast as the best, at either stored depth) and in the learner's system (inSystem,
   for any line that trains this key). Where that is two or more, a record carries
   two distinct accepted answers before it reads as solid. Where the system has one
   move here, one answer is the whole story, however many others the engine likes.
   A record with no "a" predates the field and is left alone. */
const WAYS={};
function waysAt(k){
  if(WAYS[k]!==undefined)return WAYS[k];
  const i=k.lastIndexOf(":"),fen=k.slice(0,i),want=k.slice(i+1),row=EVL[fen],ls=KEYLINES[k];
  if(!ls||!row||!row.m||!row.m.length)return WAYS[k]=0;
  const pos=fenPos(fen),deep=typeof DEEP!=="undefined"?DEEP[fen]:null,ok=new Set();
  for(const u of new Set([row,deep].filter(Boolean).flatMap(r=>r.m.map(e=>e[0])))){
    if(GRADE.accept.indexOf(gradeMove(row,pos,u).verdict)<0)continue;
    if(ls.some(li=>inSystem(LINES[li],pos,u,want,row)))ok.add(u);
  }
  return WAYS[k]=ok.size;
}
// Two at most: the point is deciding twice, not reciting a list.
function needWays(k){
  if(!S.recog)return 1;
  return waysAt(k)>=2?2:1;
}
function waysOk(k,r){return r.a===undefined||r.a.length>=needWays(k);}
function state(k){
  const r=rec(k);
  if(!r||r.ok+r.no===0)return "new";
  const step=Math.min(r.streak,LADDER.length-1);
  const hrs=LADDER[step]*(quick(r)?1:.4);
  if(Date.now()>=r.last+hrs*HOUR)return "due";
  return (r.streak>=2&&quick(r)&&waysOk(k,r))?"solid":"learning";
}
function lineScore(l){
  const ps=drillPlies(l);
  let solid=0;for(const p of ps)if(state(key(l,p))==="solid")solid++;
  return{n:ps.length,solid:solid};
}
function totals(){
  // Keys are shared across lines now (see the KEYCACHE/ALT comment above), so a naive
  // line*ply walk counts one board-plus-reply record once per line that transposes
  // into it - the start position alone is ~22 line-views for one record. Dedupe by
  // key: each distinct record is counted exactly once, in the line/ply it is first
  // met (LINES order), same rule weakest() and shuffle() use.
  let fresh=0,due=0,learn=0,solid=0,seen=0,ok=0,tot=0,all=0;
  const done=new Set();
  for(const l of LINES){for(const p of drillPlies(l)){
    const k=key(l,p);
    if(done.has(k))continue;
    done.add(k);
    all++;const st=state(k),r=rec(k);
    if(st==="new")fresh++;else if(st==="due")due++;else if(st==="learning")learn++;else solid++;
    if(r){seen++;ok+=r.ok;tot+=r.ok+r.no;}
  }}
  return{fresh:fresh,due:due,learn:learn,solid:solid,seen:seen,all:all,acc:tot?Math.round(ok/tot*100):0};
}

/* ================= navigation ================= */
function go(scr){
  // stopAll, not stop: leaving a screen must cancel the auto-advance and the
  // auto-reply too, not only the study autoplay interval.
  S.screen=scr;stopAll();S.ans=null;
  for(const id of ["scMenu","scLines","scBoard","scProgress"])el(id).classList.remove("on");
  el({menu:"scMenu",lines:"scLines",board:"scBoard",progress:"scProgress"}[scr]).classList.add("on");
  el("navBack").style.visibility=scr==="menu"?"hidden":"visible";
  el("navMore").style.visibility=scr==="board"?"visible":"hidden";
  const T=el("barTitle"),U=el("barSub");
  if(scr==="menu"){T.textContent="Colle & Hippo";U.textContent="";renderMenu();}
  if(scr==="lines"){T.textContent=S.mode==="study"?"Study a line":"Drill a line";U.textContent="";renderLines();}
  if(scr==="progress"){T.textContent="Progress";U.textContent="";renderProgress();}
  if(scr==="board"){
    T.textContent=S.mode==="shuffle"?"Shuffle drill":(S.mode==="puzzle"?"Tactics":L().name);
    U.textContent=S.mode==="shuffle"?"":(L().you==="w"?"WHITE":"BLACK");
    render(false);
  }
  scrollTo(0,0);
}
el("navBack").onclick=()=>{
  if(S.screen==="board")go(S.mode==="shuffle"||S.mode==="puzzle"?"menu":"lines");
  else go("menu");
};
el("cShuffle").onclick=()=>{S.mode="shuffle";S.arrow=null;S.ans=null;shuffle(true);go("board");};
el("cStudy").onclick=()=>{S.mode="study";go("lines");};
el("cDrill").onclick=()=>{S.mode="line";go("lines");};
el("cProgress").onclick=()=>go("progress");
el("cPuzzle").onclick=()=>{
  let next=0,best=-1;
  for(let i=0;i<PZ.length;i++){
    const r=(stats.pz||{})[PZ[i].id];
    const sc=r?(r.ok?-1:2):1;
    if(sc>best){best=sc;next=i;}
  }
  startPuzzle(next);
};

/* ================= menu / lists ================= */
function renderMenu(){
  const t=totals();
  el("kDue").textContent=t.fresh;el("kSolid").textContent=t.solid;el("kAcc").textContent=t.due;
  el("bDue").textContent=t.due?t.due+" due now":(t.fresh?t.fresh+" new":"all solid");
  let solvedPz=0;for(const q of PZ)if(((stats.pz||{})[q.id]||{}).ok)solvedPz++;
  el("bPz").textContent=solvedPz+"/"+PZ.length+" solved";
  el("kToday").textContent=stats.today||0;
  const lv=levels(),lt=el("mLevelT"),lb=el("mLevelB");
  if(lv.cur<0){
    let s=0,n=0;for(const r of lv.rows){s+=r.solid;n+=r.n;}
    lt.textContent="Every level cleared · "+s+" of "+n+" solid";lb.style.width="100%";
  }else{
    const r=lv.rows[lv.cur];
    lt.textContent="Level "+(lv.cur+1)+" · "+levelSpan(lv.cur)+" · "+r.solid+" of "+r.n+" solid";
    lb.style.width=(r.n?r.solid/r.n*100:0)+"%";
  }
  // Say it plainly when nothing is being written: spaced repetition that forgets
  // everything on refresh is worth knowing about before an hour is spent on it.
  const st=el("mStore"),note=storeNote();
  st.textContent=note;
  st.style.display=note?"":"none";
}
// The one line the user needs about storage, or nothing at all. Both cases promise
// exactly what the code does: no write is happening, and the export is the way out.
function storeNote(){
  if(SAVE_HELD)return "Something is stored here that could not be read, so nothing is being written over it and nothing new is being saved. Import a backup or reset all progress to start saving again.";
  if(MEMONLY)return "This browser is not letting the trainer store anything, so progress lasts only until this tab closes. Export from Progress to keep it.";
  return "";
}
function renderLines(){
  const c=el("lineList");c.innerHTML="";let ch=null;
  LINES.forEach((l,i)=>{
    if(l.ch!==ch){ch=l.ch;const h=document.createElement("div");h.className="chapter";h.textContent=ch;c.appendChild(h);}
    const s=lineScore(l),pct=s.n?s.solid/s.n*100:0;
    const b=document.createElement("button");
    b.className="lbtn"+(pct===100?" done":"");
    b.innerHTML='<span class="nm">'+l.name+'</span><span class="meta">'+
      '<span class="pbar"><i style="width:'+pct+'%"></i></span>'+
      "<span>"+s.solid+"/"+s.n+" solid</span><span class='kind "+KIND[l.id]+"' style='margin-left:auto'>"+KIND[l.id]+"</span></span>";
    b.onclick=()=>{S.li=i;startLine();};
    c.appendChild(b);
  });
}
function startLine(){
  S.ans=null;S.missAt=null;S.ply=0;S.sel=null;S.tries=0;S.hint=0;S.arrow=null;S.ans=null;S.passKeys=new Set();S.evNote=null;clearFree();
  S.flip=L().you==="b";syncOpts();
  el("nMsg").textContent="";go("board");armClock();
  if(S.mode==="line"&&!yourTurn())later(autoReply,300);
}

/* ---------- production guards ---------- */
function crash(msg){
  const c=el("crash");if(!c)return;
  c.classList.add("on");
  c.innerHTML="";
  // textContent, not innerHTML: an error message can carry anything, including
  // markup. And the reload advice must match what storage actually did - with no
  // store available there is nothing saved to come back to.
  const s=document.createElement("span");
  s.textContent="Something went wrong: "+String(msg).slice(0,140)+". "+
    ((MEMONLY||SAVE_HELD)?"Nothing is being written to this browser's storage, so this session will not come back."
      :"Your progress is saved; reloading is safe.");
  c.appendChild(s);
  const b=document.createElement("button");b.textContent="Reload";
  b.onclick=()=>location.reload();c.appendChild(b);
}
addEventListener("error",e=>crash(e.message||"script error"));
addEventListener("unhandledrejection",e=>crash((e.reason&&e.reason.message)||e.reason||"promise rejection"));

function selfTest(){
  const t0=Date.now(),errs=[];
  try{
    if(perft(startPos(),3)!==8902)errs.push("move generator failed perft(3)");
  }catch(e){errs.push("move generator threw: "+e.message);}
  let moves=0;
  for(const l of LINES){
    let p=l.start===START?startPos():fenPos(l.start);
    l.moves.forEach((mv,i)=>{
      const m=findMove(p,mv[0]);
      if(!m){errs.push(l.id+" move "+(i+1)+" ("+mv[1]+") is not legal");return;}
      if(san(p,m).replace(/[+#]/g,"")!==mv[1].replace(/[+#!?]/g,""))
        errs.push(l.id+" move "+(i+1)+" is labelled "+mv[1]);
      moves++;p=make(p,m);
    });
  }
  let pzOk=0;
  for(const z of PZ){
    let p,fine=true;
    try{p=fenPos(z.f);}catch(e){fine=false;}
    if(fine)for(const u of z.m){const m=findMove(p,u);if(!m){fine=false;break;}p=make(p,m);}
    if(fine)pzOk++;else errs.push("puzzle "+z.id+" does not replay");
  }
  return {ms:Date.now()-t0,lines:LINES.length,moves:moves,puzzles:pzOk,errors:errs};
}
let VERIFIED=null;
function runSelfTest(){
  if(VERIFIED)return VERIFIED;
  VERIFIED=selfTest();
  const row=el("verifyRow"),dot=el("verifyDot"),txt=el("verifyTxt");
  if(row){
    row.className="verify "+(VERIFIED.errors.length?"bad":"ok");
    dot.textContent=VERIFIED.errors.length?"failed":"verified";
    txt.textContent=VERIFIED.errors.length
      ? VERIFIED.errors.length+" problem(s): "+VERIFIED.errors[0]
      : LINES.length+" lines, "+VERIFIED.moves+" moves and "+VERIFIED.puzzles+
        " puzzles replay legally; generator matches perft ("+VERIFIED.ms+" ms).";
  }
  if(VERIFIED.errors.length)crash(VERIFIED.errors[0]);
  return VERIFIED;
}
function renderProgress(){
  runSelfTest();
  const t=totals();
  el("pSolid").textContent=t.solid;el("pSeen").textContent=t.seen+"/"+t.all;el("pAcc").textContent=t.acc+"%";
  renderWeak();
  const lv=levels(),pl=el("pLevels");pl.innerHTML="";
  lv.rows.forEach((r,i)=>{
    const d=document.createElement("div");d.className="prow";
    const nm=document.createElement("span");
    nm.textContent="Level "+(i+1)+" · "+levelSpan(i)+
      (i===lv.cur?" · your level, "+r.need+" solid clears it":(r.cleared?" · cleared":""));
    const bar=document.createElement("span");bar.className="pbar";bar.setAttribute("aria-hidden","true");
    const fill=document.createElement("i");fill.style.width=(r.n?r.solid/r.n*100:0)+"%";bar.appendChild(fill);
    const em=document.createElement("em");em.textContent=r.solid+"/"+r.n;
    d.appendChild(nm);d.appendChild(bar);d.appendChild(em);pl.appendChild(d);
  });
  const c=el("pRows");c.innerHTML="";let ch=null;
  for(const l of LINES){
    if(l.ch!==ch){ch=l.ch;const h=document.createElement("div");h.className="chapter";h.textContent=ch;c.appendChild(h);}
    const s=lineScore(l),pct=s.n?s.solid/s.n*100:0;
    const r=document.createElement("div");r.className="prow";
    r.innerHTML="<span>"+l.name+'</span><span class="pbar"><i style="width:'+pct+'%"></i></span><em>'+s.solid+"/"+s.n+"</em>";
    c.appendChild(r);
  }
}
function weakest(n){
  // Same dedupe as totals(): a shared record must not appear once per line that
  // trains it, or the weak list can show one board wearing several line names.
  const out=[],seen=new Set();
  for(let i=0;i<LINES.length;i++){
    const l=LINES[i];
    for(const p of drillPlies(l)){
      const k=key(l,p);
      if(seen.has(k))continue;
      seen.add(k);
      const r=rec(k);if(!r||r.ok+r.no===0)continue;
      const score=r.no*3+(r.ms>SLOW?1.5:0)-r.streak;
      if(score>0)out.push({li:i,ply:p,r:r,score:score,name:l.name,san:l.moves[p][1]});
    }
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,n);
}
function renderWeak(){
  const c=el("pWeak");c.innerHTML="";
  const w=weakest(5);
  if(!w.length){const d=document.createElement("div");d.className="prow";
    d.innerHTML="<span>Nothing has gone wrong yet. Drill a while and this fills itself.</span>";
    c.appendChild(d);return;}
  for(const x of w){
    const b=document.createElement("button");b.className="weak";
    // The miss log turns a percentage into a habit: name the wrong move the user
    // keeps reaching for, once it has been played at least twice.
    let habit="";
    if(x.r.w){
      let top=null;
      for(const s in x.r.w)if(top===null||x.r.w[s]>x.r.w[top])top=s;
      if(top!==null&&x.r.w[top]>=2)habit=" \u00b7 usually "+top+" ("+x.r.w[top]+"\u00d7)";
    }
    // Built with textContent: the habit text comes from a stats record, and a
    // record can arrive from an imported backup, so its move names are not the
    // app's own strings. sanW() filters them on the way in; this is the other half.
    const nm=document.createElement("span");
    nm.textContent=x.name+" \u00b7 move "+(Math.floor(x.ply/2)+1);
    const meta=document.createElement("em");
    meta.textContent=x.r.no+" miss"+(x.r.no>1?"es":"")+(x.r.ms?" \u00b7 "+fmtMs(x.r.ms):"")+habit;
    b.appendChild(nm);b.appendChild(meta);
    b.onclick=()=>{S.mode="study";S.li=x.li;S.ply=x.ply;S.sel=null;S.hint=0;
      S.flip=LINES[x.li].you==="b";syncOpts();go("board");};
    c.appendChild(b);
  }
}
el("pExport").onclick=()=>{
  // v:6 stamps the payload with the stats shape it was written in. v5 is v4 plus an
  // optional per-record "w" miss log, v6 is v5 plus an optional per-record "a" answer
  // log; keys kept their fen shape through both, so validateImport() below accepts a
  // v4 or v5 backup unchanged, and backups made before the stamp existed carry no "v"
  // but are still v4-shaped (fen-keyed) data, so those import too rather than
  // rejecting every backup a user already has.
  el("pData").value=JSON.stringify(Object.assign({v:6},stats));
  el("pData").select();
};
// A v4 key is either "pz:<id>:<ply>" or a fenOf()-derived string, which always
// contains "/" (the FEN board-row separator). A v3 key was "<line id>:<ply>"
// (e.g. "cz:5") and never contains either. Used to tell an unstamped-but-genuine
// v4 backup (exported before the "v" marker existed) apart from a real v3 backup:
// no code to remap v3 keys to v4 was ever written for that format bump, so this
// shape check is what stands in for a real migration.
function looksV4Key(k){return k.indexOf("pz:")===0||k.indexOf("/")>=0;}
// A stored counter is a finite, non-negative number. `opt` allows the field to be
// absent, which a v4 record's "w" and an older build's records need.
function okNum(v,opt){
  if(v===undefined)return !!opt;
  return typeof v==="number"&&Number.isFinite(v)&&v>=0;
}
// Import is a trust boundary: validate the whole shape before anything touches
// `stats`, and never partially assign it. Returns null when valid, else a short
// reason string used to pick the message shown to the user.
function validateImport(d){
  if(!d||typeof d!=="object"||Array.isArray(d)||!d.pos||typeof d.pos!=="object"||Array.isArray(d.pos))return "shape";
  const keys=Object.keys(d.pos);
  if(d.v!==undefined&&d.v!==4&&d.v!==5&&d.v!==6)return "version";
  if(d.v===undefined&&keys.length&&!keys.every(looksV4Key))return "version";
  for(const k of keys){
    const r=d.pos[k];
    // Every counter the app reads back must be a real number before it is trusted:
    // state() does arithmetic on streak and last, and weakest() sorts on no and ms.
    // A NaN, a negative or a string there does not corrupt storage, it corrupts the
    // schedule, silently and for good.
    if(!r||typeof r!=="object"||!okNum(r.ok)||!okNum(r.no)||
      !okNum(r.streak,1)||!okNum(r.last,1)||!okNum(r.ms,1))return "shape";
  }
  if(d.pz!==undefined&&(!d.pz||typeof d.pz!=="object"||Array.isArray(d.pz)))return "shape";
  return null;
}
// Clamp a stored index to something THEMES[]/SETS[] actually has: applyTheme() and
// syncOpts() index straight into those, so a 7 from a hand-edited backup or a newer
// build used to throw on the very first paint.
function idx(v,n){return (typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<n)?Math.floor(v):0;}
function num(v,max){return okNum(v)?Math.min(Math.floor(v),max):0;}
const DAY=864e5;
// One record, bounded: whole non-negative counters, a plausible timestamp, and a
// filtered miss log. Same shape out as touch()/grade() write, so nothing here is a
// storage-format change and the key stays at v5.
function sanRec(r){
  if(!r||typeof r!=="object")return null;
  const out={ok:num(r.ok,1e6),no:num(r.no,1e6),streak:num(r.streak,1e4),
    last:num(r.last,Date.now()+DAY),ms:num(r.ms,DAY)};
  const w=sanW(r.w);
  if(w)out.w=w;
  const a=sanA(r.a);
  if(a)out.a=a;
  return out;
}
function sanPz(o){
  if(!o||typeof o!=="object")return {};
  // Null prototype: these keys came out of a backup, and pz["__proto__"] would set
  // the prototype of the map instead of storing a record.
  const out=Object.create(null);
  for(const k of Object.keys(o).slice(0,5000)){
    const r=o[k];
    if(!r||typeof r!=="object")continue;
    out[k]={ok:num(r.ok,1e6),no:num(r.no,1e6),ms:num(r.ms,DAY)};
  }
  return out;
}
// One normaliser for both trust boundaries - an imported backup and whatever was
// found in storage. Validate first, clean second: validateImport() decides whether
// to accept the blob at all, this decides what the accepted blob becomes.
function cleanStats(d){
  const pos=Object.create(null); // same reason as sanPz(): the keys are not ours
  for(const k of Object.keys(d.pos||{})){const r=sanRec(d.pos[k]);if(r)pos[k]=r;}
  return {pos:pos,pz:sanPz(d.pz),
    day:typeof d.day==="string"?d.day.slice(0,40):"",
    today:num(d.today,1e6),
    theme:idx(d.theme,THEMES.length),
    set:idx(d.set,SETS.length),
    bookOnly:!!d.bookOnly,
    // On when absent: a v4/v5 backup and a first run both look like that, and a
    // setting nobody has an opinion about is not "off".
    freqW:d.freqW===undefined?true:!!d.freqW,
    // Absent in every backup made before bands existed: the default band, the
    // same table those users were already weighted by the nearest equivalent of.
    band:bandIdx(d.band),
    recog:d.recog===undefined?true:!!d.recog,
    // Same rule: a backup made before levels existed favours the current level.
    lvW:d.lvW===undefined?true:!!d.lvW,
    // Arrows on the board: a display setting, on unless a backup says otherwise.
    arrows:d.arrows===undefined?true:!!d.arrows};
}
// Sanitise a record's miss log at the import trust boundary: keep only string->
// positive-number entries, re-bound to the same limits grade() enforces on write
// (5 distinct SANs, highest counts kept, capped at 99). Returns null when nothing
// valid remains, in which case the caller drops just this field - a mangled miss
// log must not cost the user the rest of the backup.
// A plausible SAN and nothing else: a castle, or an optional piece letter and
// disambiguator, an optional capture, a destination square, an optional promotion,
// and the marks the app stores. A key that is not a move is a key nobody played, so
// it is dropped rather than cleaned - and it is a key the Progress screen prints.
const SAN_RE=/^(?:O-O(?:-O)?|(?:[KQRBN][a-h]?[1-8]?|[a-h])?x?[a-h][1-8](?:=[QRBN])?)[+#]?[!?]{0,2}$/;
function sanW(w){
  if(!w||typeof w!=="object")return null;
  // slice bounds the work a hostile blob can ask for; the output is capped at 5.
  const pairs=Object.keys(w).slice(0,64).filter(s=>SAN_RE.test(s)&&
    typeof w[s]==="number"&&Number.isFinite(w[s])&&w[s]>0);
  if(!pairs.length)return null;
  pairs.sort((a,b)=>w[b]-w[a]);
  const out={};
  for(const s of pairs.slice(0,5))out[s]=Math.min(99,Math.round(w[s]));
  return out;
}
// The answer log at the import boundary, same rules as sanW: plausible SANs only,
// deduped, bounded to the three grade() keeps. Null when nothing valid is left, and
// the caller drops just this field - a mangled log must not cost the record, and
// losing it costs only the second-way credit, re-earned by answering again.
function sanA(a){
  if(!Array.isArray(a))return null;
  const out=[];
  for(const s of a.slice(0,16))if(typeof s==="string"&&SAN_RE.test(s)&&out.indexOf(s)<0)out.push(s);
  return out.length?out.slice(0,3):null;
}
el("pImport").onclick=()=>{
  let d=null;
  try{d=JSON.parse(el("pData").value);}catch(e){d=null;}
  const problem=validateImport(d);
  if(problem==="version"){
    el("pData").value="This backup is from an older version: its positions are keyed by "+
      "line and move number, not by board, so nothing here would match and progress would "+
      "look wiped. Nothing was changed — export a fresh backup from an updated copy of the trainer instead.";
    return;
  }
  if(problem){
    el("pData").value="That is not a valid backup. Export from another device and paste the whole line.";
    return;
  }
  stats=cleanStats(d);
  S.theme=stats.theme;S.set=stats.set;S.bookOnly=stats.bookOnly;S.freqW=stats.freqW;setBand(stats.band);S.recog=stats.recog;S.lvW=stats.lvW;S.arrowsOn=stats.arrows;
  SAVE_HELD=false; // the user has chosen what to keep; writing is theirs to allow again
  applyTheme();syncOpts(); // apply immediately; do not make the user reload to see it
  save();renderProgress();el("pData").value="Imported.";
};
let resetArmed=false;
el("pReset").onclick=function(){
  if(!resetArmed){resetArmed=true;this.textContent="Tap again to erase everything";return;}
  // bookOnly is a setting, not progress: leaving it out of the rebuilt object wiped
  // it from storage while S.bookOnly still showed it on in the options sheet.
  stats={pos:{},pz:{},day:"",today:0,theme:S.theme,set:S.set,bookOnly:S.bookOnly,
    freqW:S.freqW,band:S.band,recog:S.recog,lvW:S.lvW,arrows:S.arrowsOn};S.run=0;
  SAVE_HELD=false; // "erase everything" is explicit consent to write over whatever is there
  save();resetArmed=false;this.textContent="Reset all progress";renderProgress();
};

/* ================= board rendering ================= */
function render(anim){
  // Any repaint means the board is not the board the chooser was opened over, so
  // the chooser goes. askPromotion() is the only caller that must not be followed
  // by a render in the same turn, and it is not.
  closePromotion();
  const l=L(),pos=nowPos(),b=pos.b;
  const last=S.free.length?S.free[S.free.length-1].uci:(S.ply>0?l.moves[S.ply-1][0]:null);
  const dests=S.sel?legal(pos).filter(m=>sq(m.f)===S.sel):[];
  const bd=el("board");bd.innerHTML="";
  const order=[...Array(64).keys()];if(S.flip)order.reverse();
  for(const i of order){
    const name=sq(i),dark=((i%8)+Math.floor(i/8))%2===1;
    const d=document.createElement("div");
    d.className="sq "+(dark?"d":"l");d.dataset.sq=name;
    if(last){
      if(name===last.slice(0,2))d.appendChild(mark("from"));
      if(name===last.slice(2,4))d.appendChild(mark("to"));
    }
    if(S.sel===name)d.appendChild(mark("sel"));
    if(S.cursor===name)d.classList.add("cursor");
    if(S.drag&&S.drag.from===name)d.classList.add("lift");
    if(S.drag&&S.drag.over===name&&S.drag.over!==S.drag.from)d.appendChild(mark("over"));
    const dm=dests.find(m=>sq(m.t)===name);
    if(dm){const dt=document.createElement("span");
      dt.className="dot"+(b[ix(name)]||dm.ep?" cap":"");d.appendChild(dt);}
    const p=b[i];
    if(p){
      const s=pieceEl2(p,"pc "+(p===p.toUpperCase()?"w":"b"));
      if(anim&&last&&name===last.slice(2,4))s.dataset.anim=last;
      d.appendChild(s);
    }else if(S.ghost&&l.targets.length&&!S.free.length){
      const t=l.targets.find(x=>x[0]===name);
      if(t)d.appendChild(pieceEl2(t[1],"ghost "+(t[1]===t[1].toUpperCase()?"wg":"")));
    }
    if(S.hint>=2&&yourTurn()&&S.ply<l.moves.length&&name===l.moves[S.ply][0].slice(0,2))
      d.appendChild(mark("hint"));
    if(S.flip?i%8===7:i%8===0){const c=document.createElement("span");c.className="coord r";c.textContent=8-Math.floor(i/8);d.appendChild(c);}
    if(S.flip?Math.floor(i/8)===0:Math.floor(i/8)===7){const c=document.createElement("span");c.className="coord f";c.textContent=F[i%8];d.appendChild(c);}
    const pc2=b[i];
    if(pc2&&isW(pc2)===pos.w&&(S.mode==="study"||(yourTurn()&&S.ply<l.moves.length)))d.classList.add("grab");
    if(!("PointerEvent" in window))d.onclick=()=>tap(name);
    bd.appendChild(d);
  }
  if(anim&&last)slide(last);
  drawArrows();
  renderTray(b,l);
  renderOff();
  renderCtl();
  renderNote();
  renderPlan();
  renderInfo();
  renderSheet();
  renderSess();
  const bar=el("progBar");
  if(!S.pending){bar.style.transition="width .25s";bar.style.width=(S.ply/l.moves.length*100)+"%";}
}
function renderOff(){
  const o=el("offbook");
  // A free entry marked ok:1 is setupGood()'s credited setup move, shown through
  // this plumbing only so the board reflects what the user played; it is not off
  // book and gets no banner or take-back.
  if(!S.free.length||S.free[0].ok){o.classList.remove("on");o.innerHTML="";return;}
  o.classList.add("on");
  o.innerHTML="<span>Off book: "+S.free.map(x=>x.san).join(" ")+"</span>";
  const b=document.createElement("button");
  b.textContent="Take back";
  b.style.cssText="background:none;border:1px solid rgba(224,161,60,.5);color:var(--amber);padding:4px 9px;font:inherit";
  b.onclick=()=>{S.free.pop();S.fpos=S.free.length?posFromFree():null;S.sel=null;render(false);};
  o.appendChild(b);
}
function posFromFree(){
  let p=posAt(L(),S.ply);
  for(const f of S.free){const m=findMove(p,f.uci);if(!m)break;p=make(p,m);}
  return p;
}

/* ---------- keyboard play ---------- */
function moveCursor(df,dr){
  const cur=S.cursor||(S.flip?"e7":"e2");
  let f=F.indexOf(cur[0]),r=parseInt(cur[1],10);
  f=Math.max(0,Math.min(7,f+(S.flip?-df:df)));
  r=Math.max(1,Math.min(8,r+(S.flip?-dr:dr)));
  S.cursor=F[f]+r;render(false);
  const sqEl=document.querySelector('[data-sq="'+S.cursor+'"]');
  const pc=nowPos().b[ix(S.cursor)];
  el("board").setAttribute("aria-label",S.cursor+(pc?", "+(isW(pc)?"white ":"black ")+NAME[pc.toLowerCase()]:", empty"));
  void sqEl;
}
addEventListener("keydown",e=>{
  if(S.screen!=="board")return;
  // The promotion chooser takes focus, so the board-focus guard below would
  // swallow Escape for the one element that most needs it: a role="dialog" the
  // keyboard cannot dismiss. Handle it first, before that guard.
  if(e.key==="Escape"&&el("promo").classList.contains("on")){
    e.preventDefault();closePromotion();S.sel=null;render(false);
    const b=el("board");if(b)b.focus();
    return;
  }
  if(document.activeElement!==el("board"))return;
  const k=e.key;
  if(k==="ArrowRight"){e.preventDefault();moveCursor(1,0);}
  else if(k==="ArrowLeft"){e.preventDefault();moveCursor(-1,0);}
  else if(k==="ArrowUp"){e.preventDefault();moveCursor(0,1);}
  else if(k==="ArrowDown"){e.preventDefault();moveCursor(0,-1);}
  else if(k==="Enter"||k===" "){e.preventDefault();if(S.cursor)tap(S.cursor);}
  else if(k==="h"||k==="H"){e.preventDefault();if(S.mode!=="study")hint();}
  else if(k==="Escape"){S.sel=null;render(false);}
});
function renderSess(){
  const s=el("sess");
  if(S.mode==="study"){s.textContent="";return;}
  const t=totals();
  s.innerHTML="<span>streak <b>"+S.run+"</b>"+(S.lastMs?" \u00b7 last <b>"+fmtMs(S.lastMs)+"</b>":"")+
    "</span><span>today <b>"+(stats.today||0)+"</b> \u00b7 solid <b>"+t.solid+"/"+t.all+"</b></span>";
}
function sqFromPoint(x,y){
  const r=el("board").getBoundingClientRect();
  if(x<r.left||x>r.right||y<r.top||y>r.bottom)return null;
  let f=Math.floor((x-r.left)/(r.width/8)),k=Math.floor((y-r.top)/(r.height/8));
  f=Math.max(0,Math.min(7,f));k=Math.max(0,Math.min(7,k));
  if(S.flip){f=7-f;k=7-k;}
  return F[f]+(8-k);
}
function killGhosts(){document.querySelectorAll(".pc.drag,.drag").forEach(n=>n.remove());}
function startDrag(e,name,pc){
  killGhosts();
  const r=el("board").getBoundingClientRect(),cell=r.width/8;
  const g=pieceEl2(pc,"pc drag"+((SETS[S.set]||SETS[0])[3]?" "+(isW(pc)?"w":"b"):""));
  g.style.width=g.style.height=cell*.86+"px";
  g.style.left=e.clientX+"px";g.style.top=e.clientY+"px";
  document.body.appendChild(g);
  S.drag={from:name,ghost:g,over:name,moved:false,x:e.clientX,y:e.clientY};
}
function moveDrag(e){
  const d=S.drag;if(!d)return;
  d.ghost.style.left=e.clientX+"px";d.ghost.style.top=e.clientY+"px";
  if(Math.abs(e.clientX-d.x)+Math.abs(e.clientY-d.y)>6)d.moved=true;
  const over=sqFromPoint(e.clientX,e.clientY);
  if(over!==d.over){d.over=over;render(false);}
}
function endDrag(){
  const d=S.drag;
  killGhosts();
  S.drag=null;
  return d||null;
}
function bindPointer(){
  if(!("PointerEvent" in window))return;
  const bd=el("board");
  bd.addEventListener("dragstart",e=>e.preventDefault());
  bd.addEventListener("pointerdown",e=>{
    if(e.button&&e.button!==0)return;
    if(skipNext())return;
    const name=sqFromPoint(e.clientX,e.clientY);
    if(!name)return;
    const pos=nowPos(),pc=pos.b[ix(name)];
    const movable=pc&&isW(pc)===pos.w&&(S.mode==="study"||(yourTurn()&&S.ply<L().moves.length));
    if(movable){
      e.preventDefault();
      try{bd.setPointerCapture(e.pointerId);}catch(err){}
      S.sel=name;startDrag(e,name,pc);render(false);
    }else{
      S.tapDown=name;
    }
  });
  bd.addEventListener("pointermove",e=>{if(S.drag){e.preventDefault();moveDrag(e);}});
  const finish=e=>{
    const drop=sqFromPoint(e.clientX,e.clientY),d=endDrag();
    if(d){
      render(false);
      if(drop&&drop!==d.from){S.sel=d.from;tap(drop);}
      else if(d.moved){S.sel=null;render(false);}
      return;
    }
    if(S.tapDown&&S.tapDown===drop)tap(drop);
    S.tapDown=null;
  };
  bd.addEventListener("pointerup",finish);
  addEventListener("pointerup",e=>{if(S.drag)finish(e);},true);
  addEventListener("pointercancel",()=>{if(S.drag){endDrag();S.sel=null;render(false);}});
  addEventListener("blur",()=>{if(S.drag){endDrag();S.sel=null;render(false);}});
  bd.addEventListener("pointercancel",()=>{endDrag();S.tapDown=null;render(false);});
}
function flash(name,cls){
  const cell=document.querySelector('[data-sq="'+name+'"]');
  if(!cell)return;
  const m=mark(cls);cell.appendChild(m);setTimeout(()=>m.remove(),620);
}
function armNext(ms){
  stopAll();
  const bar=el("progBar");
  bar.style.transition="none";bar.style.width="100%";
  void bar.offsetWidth;
  bar.style.transition="width "+ms+"ms linear";bar.style.width="0%";
  S.pending=later(()=>{S.pending=0;S.arrow=null;S.ans=null;shuffle(false);},ms);
  // good() calls render(true) BEFORE arming the wait, so renderCtl() built the
  // Hint/Skip buttons while S.pending was still falsy - refresh them now that it
  // is set, or they stay live (targeting the opponent's ply) for the whole wait
  // (finding 6). renderPlan() has the same dependence on S.pending: the plan
  // panel only exists in Shuffle's post-answer window, which starts here.
  if(S.mode==="shuffle"){renderCtl();renderPlan();renderInfo();}
  drawArrows();
}
// shuffle(false) is the Shuffle-mode advance and picks a fresh line/ply out of LINES.
// In puzzle mode S.pending is armed by armPz() and L() still returns PZLINE, so doing
// that here left S.ply indexing another line's ply into the puzzle's move list. Advance
// the way armPz's own timeout and the "Next puzzle" button do instead; startPuzzle wraps
// past the last puzzle, so S.pz+1 is safe at the end of the set.
function skipNext(){
  if(!S.pending)return false;
  stopAll();S.arrow=null;S.ans=null;
  if(S.mode==="puzzle")startPuzzle(S.pz+1);else shuffle(false);
  return true;
}
// No timer here on purpose — armWait just marks S.pending so a tap
// (via skipNext) advances immediately; the position stays on screen until read.
function armWait(){
  stopAll();
  // Honest bar: armWait has no countdown, so pinning the bar at 100% (as the
  // timed armNext does, to show time running out) would read as "complete"
  // for as long as the user takes to read the note. Show real ply progress
  // instead, same formula render() uses once S.pending clears.
  const l=L(),bar=el("progBar");
  bar.style.transition="width .25s";
  bar.style.width=(S.ply/l.moves.length*100)+"%";
  S.pending=1;
  // Same stale-controls problem as armNext() above: this runs after good()'s
  // render(true), so the Hint/Skip pair rendered for the ply just answered is
  // still on screen unless rebuilt here. renderPlan() likewise: the plan panel's
  // Shuffle visibility is S.pending, which was still falsy during that render.
  if(S.mode==="shuffle"){renderCtl();renderPlan();renderInfo();}
  drawArrows();
}
function mark(c){const m=document.createElement("span");m.className="mk "+c;return m;}
function slide(u){
  const cell=el("board").clientWidth/8,p=document.querySelector('[data-anim="'+u+'"]');
  if(!p)return;
  let dx=(F.indexOf(u[0])-F.indexOf(u[2]))*cell,dy=((8-+u[1])-(8-+u[3]))*cell;
  if(S.flip){dx=-dx;dy=-dy;}
  p.style.transform="translate("+dx+"px,"+dy+"px)";
  requestAnimationFrame(()=>{p.classList.add("slide");p.style.transform="";});
}
/* ---------- arrows on the board ----------
   Two kinds of arrow share the #arrows overlay. The Show me hint (S.arrow) is a
   reveal the learner asked for. The rest (S.ans) say on the board what the note
   already says in words, so the overlay is aria-hidden and the text carries the
   meaning. While a question is live only the learner's own refused move ("bad")
   and the reply the note names against it ("ref") may be drawn: never the answer,
   an accepted move, the table's first choice or the threat. Once the position is
   answered: the first choice, up to AR_ALT other accepted moves, the refused move
   of that position if there was one, and the reply the note names. S.ans remembers the line, ply, mode, puzzle and
   free-move count it was drawn for, so any change of position hides it without a
   lifecycle hook having to remember to clear it. Study draws none: nothing there
   is a question, and the line's own next move is one tap away. */
const AR_ALT=2;
const AR_ORDER=["alt","best","top","reply","ref","bad","hint"];
const AR_W={best:.22,top:.22,alt:.12,bad:.17,reply:.13,ref:.14,hint:.15};
const AR_KEY={best:"table's first choice",top:"first choice within the system",alt:"also accepted",bad:"your move, not accepted",
  reply:"expected reply",ref:"the reply that punishes it"};
function liveQ(){
  if(S.mode==="study"||S.pending||S.free.length)return false;
  return S.ply<L().moves.length&&yourTurn();
}
function ansHere(){
  const a=S.ans;
  return !!a&&a.li===S.li&&a.ply===S.ply&&a.mode===S.mode&&a.fl===S.free.length&&a.pz===S.pz;
}
function setArrows(list,live){
  S.ans={li:S.li,ply:S.ply,mode:S.mode,fl:S.free.length,pz:S.pz,live:!!live,list:list.filter(x=>x&&x.u)};
  drawArrows();
}
// The arrows for an answered position: pos is the position answered, played the
// move credited there, reply the opponent's answer the note names (uci or null),
// want the line's own move there - or null at a repair ply, where any sound move is
// the point and the system rule does not apply. Only moves that are both accepted
// and in the learner's system (inSystem) are drawn: the first of them in the table's
// order thick, as "best" when it is the table's own first choice and as "top" when
// the table's first choice is another opening's move, which is not drawn at all. The
// note may still name it with its number; the board shows the system.
function answerArrows(pos,played,reply,want){
  const row=evalFor(pos),k=keyFen(pos),out=[],l=L();
  if(S.missAt&&S.missAt.k===k&&S.missAt.u!==played)out.push({u:S.missAt.u,c:"bad"});
  if(row&&row.m&&row.m.length){
    const first=row.m[0][0],deep=typeof DEEP!=="undefined"?DEEP[k]:null,seen=new Set(),ok=[];
    const mine=u=>want===null||u===played||inSystem(l,pos,u,want,row);
    // Stored order decides which accepted move is drawn thick; the move played then
    // leads the rest, so a sound alternative the learner found is drawn first.
    const cands=[row,deep].filter(Boolean).flatMap(r=>[...r.m,...(r.x||[])].map(e=>e[0])).concat([played]);
    for(const u of cands){
      if(seen.has(u))continue;seen.add(u);
      if(GRADE.accept.indexOf(gradeMove(row,pos,u).verdict)>=0&&mine(u))ok.push(u);
    }
    if(ok.length){
      out.push({u:ok[0],c:ok[0]===first?"best":"top"});
      const rest=ok.slice(1).sort((p,q)=>(q===played)-(p===played));
      for(const u of rest.slice(0,AR_ALT))out.push({u:u,c:"alt"});
    }
  }
  if(reply)out.push({u:reply,c:"reply"});
  return out;
}
// A SAN reply in the position after the move, as uci; null when it is not legal there.
function uciIn(pos,sanTxt){
  if(!sanTxt)return null;
  const bare=sanTxt.replace(/[+#!?]/g,""),m=legal(pos).find(x=>san(pos,x).replace(/[+#]/g,"")===bare);
  return m?uciOf(m):null;
}
// off: a sideways shift in board units, so arrows that leave one square in one
// direction (...d6 and ...d5 from d7) run side by side instead of nesting.
function arrowEl(u,c,off){
  const NS="http://www.w3.org/2000/svg";
  const pt=s=>{let f=F.indexOf(s[0]),r=8-parseInt(s[1],10);if(S.flip){f=7-f;r=7-r;}return[f+.5,r+.5];};
  const a=pt(u.slice(0,2)),b=pt(u.slice(2,4)),w=AR_W[c]||.14;
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  off=off||0;a[0]-=uy*off;a[1]+=ux*off;b[0]-=uy*off;b[1]+=ux*off;
  const hl=Math.min(len*.5,.2+w*1.3),hw=.12+w*.85,bx=b[0]-ux*hl,by=b[1]-uy*hl;
  const g=document.createElementNS(NS,"g");
  g.setAttribute("class","ar "+c);g.dataset.u=u.slice(0,4);g.dataset.c=c;g.dataset.off=off;
  const r3=n=>Math.round(n*1000)/1000;
  for(const part of ["halo","body"]){
    const ln=document.createElementNS(NS,"line");
    ln.setAttribute("class",part);
    ln.setAttribute("x1",r3(a[0]));ln.setAttribute("y1",r3(a[1]));
    ln.setAttribute("x2",r3(b[0]-ux*hl*.7));ln.setAttribute("y2",r3(b[1]-uy*hl*.7));
    ln.setAttribute("stroke-width",r3(part==="halo"?w+.07:w));
    g.appendChild(ln);
  }
  const hd=document.createElementNS(NS,"polygon");
  hd.setAttribute("points",[[b[0],b[1]],[bx-uy*hw,by+ux*hw],[bx+uy*hw,by-ux*hw]].map(p=>r3(p[0])+","+r3(p[1])).join(" "));
  g.appendChild(hd);
  return g;
}
function drawArrows(){
  const svg=el("arrows");if(!svg)return;
  [...svg.querySelectorAll("g.ar")].forEach(n=>n.remove());
  const list=[];
  if(S.arrow)list.push({u:S.arrow,c:"hint"});
  const a=S.ans,live=liveQ();
  if(S.arrowsOn&&S.screen==="board"&&ansHere()&&a.live===live)for(const x of a.list){
    if(live&&x.c!=="bad"&&x.c!=="ref")continue;
    list.push(x);
  }
  list.sort((p,q)=>AR_ORDER.indexOf(p.c)-AR_ORDER.indexOf(q.c));
  // Arrows sharing a start square and a direction get distinct offsets.
  const ray=u=>{const dx=u.charCodeAt(2)-u.charCodeAt(0),dy=u.charCodeAt(3)-u.charCodeAt(1),g=Math.max(Math.abs(dx),Math.abs(dy));
    return u.slice(0,2)+(dx%g||dy%g?dx+","+dy:dx/g+","+dy/g);};
  const grp={};for(const x of list)(grp[ray(x.u)]=grp[ray(x.u)]||[]).push(x);
  for(const x of list){const g=grp[ray(x.u)],n=g.length,i=g.indexOf(x);
    svg.appendChild(arrowEl(x.u,x.c,n>1?Math.round((i-(n-1)/2)*.26*1000)/1000:0));}
  const k=el("akey"),kinds=AR_ORDER.filter(c=>AR_KEY[c]&&list.some(x=>x.c===c));
  if(k)k.innerHTML=kinds.map(c=>'<span class="ak '+c+'"><i></i>'+AR_KEY[c]+"</span>").join("");
}
function renderTray(b,l){
  const st=fenBoard(l.start),cnt={};
  for(const p of st)if(p)cnt[p]=(cnt[p]||0)+1;
  for(const p of b)if(p)cnt[p]=(cnt[p]||0)-1;
  const t=el("tray");t.children[0].innerHTML="";t.children[1].innerHTML="";
  let dw=0,db=0;
  for(const p in cnt)for(let i=0;i<cnt[p];i++){
    const black=p!==p.toUpperCase();
    t.children[black?0:1].appendChild(pieceEl2(p,black?"b":"w"));
    if(black)dw+=VAL[p];else db+=VAL[p.toLowerCase()];
  }
  const diff=db-dw;
  if(diff){const tag=document.createElement("span");tag.textContent=" +"+Math.abs(diff);
    t.children[diff<0?0:1].appendChild(tag);}
  el("tray").classList.toggle("empty",!dw&&!db);
}
function renderCtl(){
  const c=el("ctl");c.innerHTML="";
  const add=(label,fn,cls,dis)=>{
    const b=document.createElement("button");
    b.innerHTML=label;b.className=cls||"";b.disabled=!!dis;b.onclick=fn;c.appendChild(b);return b;
  };
  if(S.mode==="study"){
    add("&#124;&#9664;",()=>{S.ply=0;clearFree();stop();render(false);},"",S.ply===0);
    add("&#9664;",()=>{if(S.ply>0)S.ply--;clearFree();stop();render(false);},"",S.ply===0);
    // VS15 on the pause glyph: no embedded font carries U+23F8, so Android
    // otherwise renders it as a colour emoji next to monochrome siblings.
    const pl=add(S.timer?"&#9208;&#xfe0e;":"&#9654;&#9654;",toggleplay);
    add("&#9654;",()=>{if(S.ply<L().moves.length)S.ply++;clearFree();render(true);},"",S.ply>=L().moves.length);
    add("&#9654;&#124;",()=>{S.ply=L().moves.length;clearFree();stop();render(false);},"",S.ply>=L().moves.length);
    void pl;
  }else if(S.mode==="line"||S.mode==="puzzle"){
    const done=S.ply>=L().moves.length;
    // Back one intentionally does NOT reset S.passKeys: replaying forward from here
    // through positions already graded this pass must fall back to touch() (finding 12),
    // not grade again. S.arrow is cleared because the position on screen is changing.
    add("Back one",()=>{S.ply=Math.max(0,S.ply-2);S.sel=null;S.tries=0;S.hint=0;S.arrow=null;S.ans=null;render(false);},"wide",S.ply===0);
    if(done&&S.mode==="line")add("Next line &#8594;",()=>{S.li=(S.li+1)%LINES.length;startLine();},"wide");
    else if(!done)add(hintLabel(),hint,"wide",false);
    add("Restart",()=>{stopAll();S.ply=0;S.sel=null;S.tries=0;S.hint=0;S.arrow=null;S.ans=null;S.passKeys=new Set();render(false);if(!yourTurn())later(autoReply,250);},"wide");
    if(done&&S.mode==="puzzle")add("Next puzzle &#8594;",()=>startPuzzle(S.pz+1),"wide");
  }else if(S.pending){
    // Waiting for a tap after a correct answer: S.ply already points past your
    // move, at the opponent's reply, so Hint/Skip must not be live here — Hint
    // would target and reveal the opponent's move instead of yours (finding 6).
    add("Continue",()=>{skipNext();},"wide");
  }else{
    add(hintLabel(),hint,"wide",false);
    add("Skip &#8594;",()=>{S.arrow=null;S.ans=null;shuffle(false);},"wide");
  }
}
function toggleplay(){
  if(S.timer){stop();render(false);return;}
  // Every sibling control in renderCtl() clears the free branch before touching
  // S.ply, and so does the keyboard stepper. Without it here, nowPos() went on
  // returning S.fpos while the ply, the notes and the progress bar marched on.
  clearFree();
  if(S.ply>=L().moves.length)S.ply=0;
  S.timer=setInterval(()=>{
    if(S.ply>=L().moves.length){stop();render(false);return;}
    S.ply++;render(true);
  },1150);
  render(false);
}
function stop(){if(S.timer){clearInterval(S.timer);S.timer=null;}}
function renderNote(){
  const l=L(),m=l.moves;
  if(S.mode==="puzzle"){
    const p=l.pz,done=S.ply>=m.length;
    el("nSrc").innerHTML='<a href="https://lichess.org/training/'+p.id+
      '" target="_blank" rel="noopener">lichess puzzle</a><br><span class="kind">rating '+p.r+"</span>";
    el("nMove").textContent=done?"Solved":((l.you==="w"?"White":"Black")+" to play");
    el("nText").textContent=done?m.map(x=>x[1]).join(" ")+"  \u00b7  "+p.t
      :(S.ply===0?m[0][2]:"Keep going.");
    return;
  }
  if(S.mode==="shuffle"){
    // After an answer good() paints a context block into nText; keep it on
    // screen until Continue clears S.pending rather than overwriting it here.
    if(S.pending)return;
    el("nSrc").textContent=chapterLabel(l);
    el("nMove").textContent=(l.you==="w"?"White":"Black")+" to play";
    const played=S.ply>0?"They just played "+m[S.ply-1][1]+". ":"";
    el("nText").textContent=played+((S.tries||S.hint)?l.name+" \u00b7 "+l.src:"Find the repertoire move.");
    return;
  }
  el("nSrc").innerHTML=(SRC[l.id]?'<a href="'+SRC[l.id]+'" target="_blank" rel="noopener">'+l.src+"</a>":l.src)+
    (KIND[l.id]?'<br><span class="kind '+KIND[l.id]+'">'+KIND[l.id]+"</span>":"")+
    (ecoNow()?'<br><span class="eco">'+ecoNow()+"</span>":"");
  if(S.ply===0){
    el("nMove").textContent=S.mode==="line"?"Your move":"Start";
    el("nText").textContent=S.mode==="line"
      ?"Play this line from memory as "+(l.you==="w"?"White":"Black")+"."
      :"Step with the controls, or open Notation below.";
  }else{
    const p=m[S.ply-1];
    el("nMove").textContent=Math.ceil(S.ply/2)+(S.ply%2?". ":"... ")+p[1];
    el("nText").textContent=p[2]||"";
  }
}
/* ================= masters database (token-gated) ================= */
/* Lichess closed the opening explorer to anonymous requests in April 2026, so the
   panel only exists when the user has stored a personal API token (menu screen)
   and every request carries it as a Bearer header - never in the URL, and never
   to any host but lichess's explorer. With no token stored the panel is hidden
   and the app makes no network requests at all; the offline promise holds. */
let libToken=null;
const LIB_URL="https://explorer.lichess.org/masters?moves=5&topGames=0&play=";
const libCache={};
let libInFlight=null; // {moves, promise} - dedupes a repeat request for the same position
function currentMoves(){return L().moves.slice(0,S.ply).map(m=>m[0]).join(",");}
async function loadLib(){
  const l=L(),moves=currentMoves();
  const box=el("lib");
  if(!libToken)return; // panel is hidden without a token; belt and braces
  if(l.start!==START){box.innerHTML="This position is a diagram, not a game score, so the database cannot look it up.";return;}
  if(libCache[moves]){paintLib(libCache[moves]);return;}
  box.innerHTML="Asking the masters database...";
  // This is the app's only online part, and the only fetch on the page - a step
  // forward/back while a request is still in flight must not let a slow reply for
  // the old position paint over the position now on screen (finding 11). Reuse
  // one in-flight promise per moves-key rather than firing a duplicate request,
  // and re-check the current position after the await before painting anything.
  const inflight=(libInFlight&&libInFlight.moves===moves)?libInFlight.promise:null;
  const p=inflight||fetch(LIB_URL+moves,{headers:{Authorization:"Bearer "+libToken}})
    .then(r=>{if(!r.ok)throw {status:r.status};return r.json();});
  if(!inflight)libInFlight={moves:moves,promise:p};
  try{
    const d=await p;
    libCache[moves]=d;
    if(currentMoves()===moves&&L().start===START)paintLib(d);
  }catch(e){
    if(currentMoves()===moves&&L().start===START)
      box.innerHTML=(e&&(e.status===401||e.status===403))
        ?"lichess rejected the token. Check it in the settings on the menu screen; everything else here works offline."
        :(e&&e.status)
          ?"The database answered with status "+e.status+"."
          :"Database unreachable. It needs a connection to lichess; everything else here works offline.";
  }finally{
    if(libInFlight&&libInFlight.moves===moves)libInFlight=null;
  }
}
/* Everything in `d` came off the network. The strings go through esc(); the numbers
   go through int() for the same reason, because a string where a count belongs does
   not add, it concatenates - "<img src=x>"+""+"" is a perfectly good tot, and
   tot.toLocaleString() would hand it straight back to innerHTML. Coerce first, and
   nothing below can be anything but a number. */
function paintLib(d){
  const box=el("lib");
  const int=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const wdl=o=>int(o&&o.white)+int(o&&o.draws)+int(o&&o.black);
  const tot=wdl(d);
  if(!tot){box.innerHTML="No master games have reached this position. You are already off the map, which is not always bad.";return;}
  const next=S.ply<L().moves.length?L().moves[S.ply][0]:null;
  const pc=n=>Math.round(n/tot*100);
  let h='<div class="hd"><span>'+tot.toLocaleString()+" master games</span><span>"+
    (d.opening?esc(d.opening.eco+" "+d.opening.name):"")+'</span></div><div class="wdl">'+
    '<i style="width:'+pc(int(d.white))+'%;background:#e8e2d2"></i>'+
    '<i style="width:'+pc(int(d.draws))+'%;background:#6b7c8c"></i>'+
    '<i style="width:'+pc(int(d.black))+'%;background:#1b232d"></i></div>';
  const rows=Array.isArray(d.moves)?d.moves:[];
  const max=Math.max(...rows.map(wdl),1);
  for(const m of rows){
    // Full uci both sides: lichess writes a promotion as "e7e8q", and so do we.
    const n=wdl(m),ours=next&&m.uci===next;
    h+='<div class="lrow'+(ours?" ours":"")+'"><b>'+esc(m.san)+'</b><span class="bar"><i style="width:'+
      Math.round(n/max*100)+'%"></i></span><em>'+(n>=1000?Math.round(n/1000)+"k":n)+"</em></div>";
  }
  if(next&&!rows.some(m=>m.uci===next))
    h+='<div class="lrow ours"><b>'+L().moves[S.ply][1]+"</b><span>rare or unplayed at master level</span></div>";
  box.innerHTML=h;
}
el("libBox").addEventListener("toggle",function(){if(this.open)loadLib();});
/* ---------- the middlegame plan ---------- */
/* Each line's plan: prose describes the middlegame it aims at, and it names
   concrete moves - shown before the user has answered, it is an answer sheet.
   So: Study shows it whenever the line has one; Drill only once the line is
   complete; Shuffle only inside the post-answer window (S.pending set); puzzles
   never (PZLINE carries no plan). Collapsed by default, and the open state is
   reset when the line changes so a plan left open cannot bleed into the next
   position. Rendered with textContent - the strings carry no markup. */
let planFor=null;
function renderPlan(){
  const box=el("planBox"),l=L();
  if(planFor!==l.id){box.open=false;planFor=l.id;}
  let show=false;
  if(l.plan&&S.mode!=="puzzle"){
    if(S.mode==="study")show=true;
    else if(S.mode==="line")show=S.ply>=l.moves.length;
    else if(S.mode==="shuffle")show=!!S.pending;
  }
  box.style.display=show?"":"none";
  el("planTxt").textContent=show?l.plan:"";
}
/* Opening a reading panel during Shuffle's 850ms auto-advance would let the
   position swap under the reader's finger. If S.pending is a real timer (not
   armWait's 1 sentinel), cancel it and switch to armWait semantics: the board
   now waits for a tap, and armWait itself rebuilds the controls. */
function holdForReading(){
  if(this.open&&S.mode==="shuffle"&&S.pending&&S.pending!==1)armWait();
}
el("planBox").addEventListener("toggle",holdForReading);
el("libBox").addEventListener("toggle",holdForReading);
el("infoBox").addEventListener("toggle",holdForReading);
function ecoNow(){
  const e=(typeof ECO!=="undefined")&&ECO[L().id];
  if(!e)return "";
  let cur="";
  for(const x of e)if(x[0]<=Math.max(S.ply,1)&&x[1])cur=x[1]+" "+x[2];
  return cur;
}
function renderSheet(){
  const l=L(),m=l.moves;
  el("sheetBox").style.display=(S.mode==="shuffle"||S.mode==="puzzle")?"none":"";
  const lb=el("libBox");
  lb.style.display=(libToken&&S.mode==="study"&&L().start===START)?"":"none";
  if(lb.open&&libToken&&S.mode==="study"&&L().start===START)loadLib();
  if(S.mode==="shuffle"||S.mode==="puzzle")return;
  const rows=el("rows");rows.innerHTML="";
  for(let i=0;i<m.length;i+=2){
    const r=document.createElement("div");r.className="row";
    const n=document.createElement("span");n.className="num";n.textContent=(i/2+1)+".";r.appendChild(n);
    for(const k of [i,i+1]){
      const c=document.createElement("span");
      if(k<m.length){
        c.className="ply "+(k+1===S.ply?"cur":(k+1<S.ply?"past":"future"));
        c.textContent=(S.mode==="line"&&k+1>S.ply)?"\u00b7\u00b7\u00b7":m[k][1];
        if(S.mode==="study"){c.style.cursor="pointer";c.onclick=()=>{S.ply=k+1;clearFree();stop();render(false);};}
      }
      r.appendChild(c);
    }
    rows.appendChild(r);
  }
}

/* ================= drilling ================= */
/* A pawn reaching the last rank is four different moves, and which one was meant is
   the user's to say. Auto-queening answered for them and then compared only the
   first four characters of the uci, so a knight promotion counted as the queen one.
   The chooser stacks the four pieces over the square the pawn is landing on, in the
   board's own idiom, and everything below compares the FULL uci, suffix included. */
function askPromotion(pos,name,ms){
  const box=el("promo");
  box.innerHTML="";
  const f=F.indexOf(name[0]),r=8-parseInt(name[1],10);
  const col=S.flip?7-f:f,row=S.flip?7-r:r;
  box.style.left=(col*12.5)+"%";
  box.style.top=row<4?"0":"";
  box.style.bottom=row<4?"":"0";
  for(const q of "qrbn"){
    const m=ms.find(x=>x.p===q);
    if(!m)continue;
    const b=document.createElement("button");
    b.setAttribute("aria-label","Promote to "+NAME[q]);
    b.appendChild(pieceEl2(pos.w?q.toUpperCase():q,"pc "+(pos.w?"w":"b")));
    const u=uciOf(m);
    // render() closes the chooser when the position changes, but do not trust that
    // alone: re-find the move on the board as it is now, and drop it if it is gone.
    b.onclick=e=>{e.stopPropagation();closePromotion();
      const now=nowPos(),live=legal(now).find(x=>uciOf(x)===u);
      if(live)playMove(now,name,live);else render(false);};
    box.appendChild(b);
  }
  box.classList.add("on");
  // Move focus into the dialog. Without this a keyboard user has the board's
  // focus while a modal chooser is on screen, and a screen reader never hears
  // that it opened.
  // Read a layout property first: .on has only just flipped display from none,
  // and focus() on a still-hidden element is silently dropped.
  void box.offsetWidth;
  const first=box.querySelector("button");
  if(first)first.focus();
}
function closePromotion(){const b=el("promo");if(b){b.classList.remove("on");b.innerHTML="";}}
function tap(name){
  // A tap anywhere else while the chooser is open cancels it: the pawn has not
  // moved yet, so there is nothing to undo.
  if(el("promo").classList.contains("on")){closePromotion();S.sel=null;render(false);return;}
  if(skipNext())return;
  const pos=nowPos(),study=S.mode==="study";
  if(!study&&(!yourTurn()||S.ply>=L().moves.length))return;
  const pc=pos.b[ix(name)],mine=pc&&(isW(pc)===pos.w);
  if(!S.sel){if(mine){S.sel=name;render(false);}return;}
  if(S.sel===name){S.sel=null;render(false);return;}
  if(mine){S.sel=name;render(false);return;}
  const ms=legal(pos).filter(x=>sq(x.f)===S.sel&&sq(x.t)===name);
  if(ms.length>1&&ms[0].p){askPromotion(pos,name,ms);return;}
  playMove(pos,name,ms[0]||null);
}
/* matTok counts move attempts, so a material search still waiting to run (see the
   end of playMove) can tell that the user has since played something else. */
let matTok=0;
const MAT_DEFER=40; // ms: long enough for the "checking" line to be painted first
/* ===== material search off the main thread =====
   matVerdict can need a quarter of a million nodes, most of a second on a desktop
   and several on a phone, and on the page's own thread that is a frozen board. So
   matAsk runs it in a Web Worker built from this page's own script text - everything
   before the app state, which is the rules, the engine and the data, and touches no
   DOM - through a Blob URL: nothing is fetched and the page stays one offline file.
   There it gets MAT_CAP_BG. Where a Worker cannot be made (no Worker, no Blob URL,
   a host policy that forbids either, a script text that cannot be read) or dies,
   the search runs here as before: deferred with later() and held to MAT_CAP, so
   the fallback stalls no longer than it used to and a few more verdicts are
   silent there. The same move can therefore get a verdict in one browser and
   silence in another; never two different verdicts, since both run the same code.
   Staleness is the caller's (matTok, line, ply, mode) plus the session epoch,
   checked when the answer arrives: a result for a left session is dropped here. */
const MAT_MARK="/* ================= state ================= */";
const MAT_SRC=(()=>{
  try{
    const t=document.currentScript.textContent,i=t.indexOf(MAT_MARK);
    return i>0?t.slice(0,i):"";
  }catch(e){return "";}
})();
const MAT_BOOT=8000; // ms for the worker to parse the script and say it is ready
let matW=null,matWDead=false,matWReady=false,matWLate=false,matWSeq=0,matWSeen=0,matVia="";
const matWQ=new Map();
function matWorker(){
  if(matW||matWDead)return matW;
  try{
    if(typeof Worker!=="function"||!MAT_SRC)throw 0;
    const src=MAT_SRC+"\nself.onmessage=function(e){var d=e.data;"+
      "var v=matVerdict(d.pos,d.m,MAT_CAP_BG);self.postMessage({id:d.id,v:v,n:matNodes});};"+
      "self.postMessage({ready:1});";
    matW=new Worker(URL.createObjectURL(new Blob([src],{type:"text/javascript"})));
    matW.onmessage=matHear;
    matW.onerror=e=>{if(e&&e.preventDefault)e.preventDefault();matFail();};
    // A worker that never starts (a policy can block it without an error event)
    // must not leave the "checking" line up for good. Bare setTimeout, like
    // flash(): this has to run whatever session is open by then.
    // A slow start (a loaded machine) is not a failure: past MAT_BOOT the
    // requests answer here until the worker says it is ready, then it takes over.
    const w=matW;matWLate=false;
    setTimeout(()=>{if(matW===w)matLate();},MAT_BOOT);
  }catch(e){matWDead=true;matW=null;}
  return matW;
}
function matHear(e){
  const d=e.data;
  if(d.ready){matWReady=true;return;}
  matWSeen++;
  const r=matWQ.get(d.id);
  if(!r)return;
  matWQ.delete(d.id);
  if(r.ep!==S.epoch||!r.live.call(null))return;
  matNodes=d.n;matVia="worker"; // mirrored for the tests; the search ran over there
  r.cb.call(null,d.v);
}
// The worker failed: retire it and answer whatever it still owed on this thread.
function matFail(){
  if(matWDead)return;
  matWDead=true;
  try{if(matW)matW.terminate();}catch(e){}
  matW=null;
  matOwed();
}
// The worker is still not ready at MAT_BOOT: keep it, answer what it owes here.
function matLate(){
  if(matWReady||matWDead)return;
  matWLate=true;
  matOwed();
}
function matOwed(){
  const owed=[...matWQ.values()];
  matWQ.clear();
  for(const r of owed)if(r.ep===S.epoch)matMain(r.pos,r.m,r.live,r.cb);
}
// live is checked before the search starts, so a stale one costs nothing here.
function matMain(pos,m,live,cb){
  later(()=>{
    if(!live.call(null))return;
    const v=matVerdict(pos,m);matVia="main";cb.call(null,v);
  },MAT_DEFER);
}
// cb receives matVerdict's result (null when out of budget), and only while
// live() still holds and the session it was asked in is still open.
function matAsk(pos,m,live,cb){
  const w=matWorker();
  if(!w||matWLate&&!matWReady){matMain(pos,m,live,cb);return;}
  const id=++matWSeq;
  matWQ.set(id,{pos:pos,m:m,live:live,cb:cb,ep:S.epoch});
  w.postMessage({id:id,pos:pos,m:m});
}
function playMove(pos,name,m){
  matTok++;
  S.ans=null; // a new attempt: the last attempt's arrows are answered by this one
  const study=S.mode==="study";
  const wanted=S.ply<L().moves.length?L().moves[S.ply][0]:null;
  if(!m){
    S.sel=null;render(false);
    el("nMsg").innerHTML='<span class="neutral">Not a legal move; nothing counted.</span>';
    return;
  }
  const played=uciOf(m);
  if(study){
    if(!S.free.length&&wanted===played){S.sel=null;S.ply++;render(true);return;}
    const t=san(pos,m);
    S.free.push({uci:played,san:t});S.fpos=make(pos,m);S.sel=null;render(true);
    el("nMsg").innerHTML='<span class="neutral">'+t+". Off the line.</span>";
    return;
  }
  /* A deliberate-mistake line asks the user to repair it, not to reproduce it.
     At the repair ply the line's own move is the mistake, so playing it is refused
     with its price; any move the grader accepts is credited, and the line then
     plays its habit move so the lesson still arrives. Invariant 7 is untouched:
     these lines keep targets:[] and stay out of Shuffle.
     repair.kind "game" is the other use: a defence line that follows a real game
     past a concession. The move is the game's, not a habit on show, so the words
     say that instead. */
  const rep=S.mode==="line"?L().repair:null;
  if(rep&&S.ply===rep.ply){
    const row=evalFor(pos),g=gradeMove(row,pos,m),game=rep.kind==="game";
    g.reply=replyAfter(pos,m,row,g);
    if(played===wanted){
      if(S.tries===0)S.missAt={k:keyFen(pos),u:played};
      S.sel=null;S.tries++;render(false);flash(name,"bad");
      setArrows([{u:played,c:"bad"}],true);
      el("nMsg").innerHTML='<span class="no">'+(game?"That is the game move; find a better one first.":"That is the move the line is about.")+
        '</span> <span class="neutral">'+esc(gradeLine(g))+"</span>";
      el("nText").textContent=rep.why;
      return;
    }
    if(GRADE.accept.includes(g.verdict)){
      S.sel=null;render(false);flash(name,"good");
      const t=san(pos,m),own=L().moves[S.ply][1];
      el("nMsg").innerHTML='<span class="ok hit">\u2713 '+(game?"Accepted":"Repaired")+'</span> <span class="ok">\u2014 '+esc(t)+".</span> "+
        '<span class="neutral">'+esc(gradeLine(g))+"</span>";
      el("nText").textContent=game
        ?"The game went "+own+" instead, and the line follows it so the defence that comes later can be drilled. Tap to see it."
        :"The line plays "+own+" instead, which is the habit it exists to show. Tap to see it.";
      // Drawn on the board as it stands, before the move: no reply arrow, since the
      // move it would answer is not on the board.
      setArrows(answerArrows(pos,played,null,null),false);
      armWait();
      return;
    }
    // anything else falls through to the ordinary refusal, which already prices it
  }
  if(played===wanted){good();return;}
  // A move some other line trains from this very board is book, not a mistake. Shuffle
  // switches to that line and credits it; drill stays on this line and says so without
  // grading, so the user retries instead of being told a repertoire move was wrong.
  // ALT excludes NO_SHUFFLE ids, so the deliberate-mistake lines never count as book.
  const alt=S.mode==="puzzle"?null:altAt(pos,played,L());
  // bookExcluded mirrors shuffle()'s own candidate filter (app.js, S.bookOnly check):
  // an alt from a line drill-book-only mode was told to exclude must not be credited,
  // or S.li ends up pointing at exactly the kind of line the mode hides.
  if(alt&&!bookExcluded(LINES[alt[0]])){
    if(S.mode==="shuffle"){
      S.li=alt[0];S.ply=alt[1];
      // The board just answered must not be served straight back: shuffle() only
      // zeroed S.lastKey's own exact key, but the alt reply is graded under a
      // different key (same board, different expected move) - update it here too.
      S.lastKey=key(LINES[alt[0]],alt[1]);
      good();return;
    }
    const t=san(pos,m);
    noteWay(key(L(),S.ply),t); // another line's move here is another way to read this board
    S.sel=null;render(false);
    el("nMsg").innerHTML='<span class="neutral">'+t+" is book too — "+LINES[alt[0]].name+
      " plays it here. This line wants "+L().moves[S.ply][1]+".</span>";
    return;
  }
  // The stored analysis answers first. EVL holds a row for every position the user
  // is asked to move in, so the table already knows what the four-ply search was
  // being asked - and knows it for free, where the search costs around a tenth of a
  // second per wrong move on a desktop, and several times that at its worst. setupGate decides whether "builds the setup too" may be said
  // here and hands back the grade it computed, so nothing is graded twice;
  // matVerdict now runs only where the table is silent about the move played.
  const t=san(pos,m);
  const pz=S.mode==="puzzle";
  const row=pz?null:evalFor(pos);
  const gate=pz?{credit:false,reason:"no-targets",grade:null}:setupGate(row,pos,m,tgtOf(L()));
  const g=pz?null:(gate.grade||gradeMove(row,pos,m));
  if(g)g.reply=replyAfter(pos,m,row,g);
  if(gate.credit){
    if(S.mode==="shuffle"){setupGood(pos,m,t,setupLead(t,g,row),g);return;}
    // Drill: mirror the book-alternative branch above exactly - acknowledge, grade
    // nothing either way, leave the streak alone, and do not advance, because the
    // stored continuation would diverge from the board. The user retries.
    noteWay(key(L(),S.ply),t);
    S.sel=null;render(false);
    el("nMsg").innerHTML='<span class="neutral">'+t+" builds the setup too — the formation matters more than the order it goes up in. "+
      gradeLine(g)+pvTxt(g,row)+" This line's order plays "+L().moves[S.ply][1]+" here.</span>";
    return;
  }
  // Several moves can be right. A move the table puts first, or inside the noise
  // band of its first choice, is chess and not a mistake, whatever this line plays.
  // Read the verdict and never the rank: rank 5 is 5 cp behind in one row and 78 in
  // another, and a scored move carries rank 0, which is not a place at all.
  // Two exclusions. A formation move the gate refused (demanding, out-of-band) is
  // never credited here however it grades - where both depths put a non-formation
  // move first, "the order does not matter" is simply false. And the three lines that
  // exist to show the user losing (NO_SHUFFLE) keep their lesson: a sound move there
  // is still not the move the line is about to punish, and crediting it would hand
  // the drill a way round the point.
  // Sound is not enough on its own: the move must be in the learner's system too
  // (inSystem). The line's own move, other lines' book moves and credited formation
  // moves were all handled above, so what reaches here is either an alternative from
  // a line "book lines only" hides (still the learner's system) or a move from some
  // other opening, which is answered neutrally and leaves the question live.
  if(g&&g.analysis==="checked"&&GRADE.accept.indexOf(g.verdict)>=0&&
     (gate.reason==="not-target"||gate.reason==="no-targets")&&!NO_SHUFFLE.has(L().id)){
    if(!altAt(pos,played,L())){offSystem(name,t,g);return;}
    if(S.mode==="shuffle"){setupGood(pos,m,t,goodLead(t,g,row),g);return;}
    noteWay(key(L(),S.ply),t);
    S.sel=null;render(false);
    el("nMsg").innerHTML='<span class="neutral">'+goodLead(t,g,row)+" This line plays "+L().moves[S.ply][1]+" here.</span>";
    return;
  }
  // Refused, or not covered. Either way the row is better evidence than a search,
  // so skip it whenever the row has an answer - including "demanding", where the
  // gate has ruled and a material brake must not reopen what it shut.
  if(g&&(g.analysis==="checked"||gate.reason==="demanding")){
    offBook(name,t,null,g,gate.reason==="demanding"?demandLead():null,played);
    return;
  }
  // Only here is the search still the best evidence available: the table does not
  // cover this move (or, defensively, there is no row at all).
  // The search can take most of a second, several on a slow device (off this
  // thread where a Worker exists, see matAsk), and its answer decides the grade -
  // so say what is happening first and grade when it returns. matAsk drops it if
  // the session changed meanwhile; matTok drops it if another move was played, and
  // the line/ply check drops it if Skip or anything else moved the drill on.
  S.sel=null;render(false);
  el("nMsg").innerHTML='<span class="neutral">'+t+" is legal. Checking what it costs in material…</span>";
  const tok=matTok,li=L(),ply=S.ply,mode=S.mode;
  matAsk(pos,m,()=>tok===matTok&&L()===li&&S.ply===ply&&S.mode===mode,v=>{
    if(!pz&&setupMove(pos,m,v,gate)){
      if(S.mode==="shuffle"){setupGood(pos,m,t,setupLead(t,null,null));return;}
      noteWay(key(L(),S.ply),t);
      S.sel=null;render(false);
      el("nMsg").innerHTML='<span class="neutral">'+t+" builds the setup too — the formation matters more than the order it goes up in. This line's order plays "+L().moves[S.ply][1]+" here.</span>";
      return;
    }
    offBook(name,t,v,g,null,played);
  });
}
function touch(k,ms){
  if(k.indexOf("pz:")===0)return;
  const r=stats.pos[k]||{ok:0,no:0,streak:0,last:0,ms:0};
  if(ms)r.ms=r.ms?Math.round(r.ms*.6+ms*.4):ms;
  stats.pos[k]=r;save();
}
function bumpToday(){
  const d=new Date().toDateString();
  if(stats.day!==d){stats.day=d;stats.today=0;}
  stats.today++;save();renderSess();
}
function pzRec(){const p=L().pz;if(!p)return null;stats.pz=stats.pz||{};
  return stats.pz[p.id]=stats.pz[p.id]||{ok:0,no:0,ms:0};}
/* The answer log: accepted moves the user has produced here, at most three, oldest
   dropped; waysOk reads it. Written on a credited answer and on an accepted
   alternative in Drill - which still earns no streak, because the line wants its own
   move - so a user who never opens Shuffle can still show a second way. */
function addWay(r,s){
  if(!s)return;
  const a=r.a=r.a||[];
  if(a.indexOf(s)>=0)return;
  a.push(s);
  if(a.length>3)a.shift();
}
function noteWay(k,s){
  if(k.indexOf("pz:")===0)return;
  const r=stats.pos[k];
  if(!r)return; // no record yet: nothing has been answered here, so nothing to add to
  addWay(r,s);save();
}
function grade(k,right,ms,wrongSan,rightSan){
  if(k.indexOf("pz:")===0)return;
  const r=stats.pos[k]||{ok:0,no:0,streak:0,last:0,ms:0};
  if(right){r.ok++;r.streak++;addWay(r,rightSan);}else{r.no++;r.streak=0;}
  // The miss log: which wrong move was actually played, so Progress can name a
  // habit instead of only a percentage. Bounded on write - at most 5 distinct
  // SANs per record, counts capped at 99, lowest count evicted when a 6th
  // arrives - so a record can never grow without limit. Hint tier 3 passes no
  // SAN (nothing was played) and records nothing here.
  if(!right&&wrongSan){
    const w=r.w=r.w||{};
    if(w[wrongSan])w[wrongSan]=Math.min(99,w[wrongSan]+1);
    else{
      const ks=Object.keys(w);
      if(ks.length>=5){let low=ks[0];for(const s of ks)if(w[s]<w[low])low=s;delete w[low];}
      w[wrongSan]=1;
    }
  }
  if(ms)r.ms=r.ms?Math.round(r.ms*.6+ms*.4):ms;
  r.last=Date.now();stats.pos[k]=r;save();
}
// Drill's Back one/Restart replay positions already graded this pass. A second
// grade() for the same key lets streak/"solid" be farmed and pushes r.last to
// now, postponing the shared record's next review across every other line that
// keys onto it. S.passKeys tracks what has already been graded since the line
// was (re)started; a repeat within the same pass falls back to touch(), which
// still keeps the timing average honest without moving streak/last.
function gradeOncePerPass(k,right,ms,wrongSan,rightSan){
  if(S.mode==="line"){
    S.passKeys=S.passKeys||new Set();
    if(S.passKeys.has(k)){touch(k,ms);return;}
    S.passKeys.add(k);
  }
  grade(k,right,ms,wrongSan,rightSan);
}
function elapsed(){return S.t0?Date.now()-S.t0:0;}
function armClock(){S.t0=Date.now();}
function fmtMs(m){return m>=10000?Math.round(m/1000)+"s":(m/1000).toFixed(1)+"s";}
function good(){
  const clean=S.hint===0&&S.tries===0,hadMiss=S.tries>0;
  const ms=elapsed();S.lastMs=ms;
  S.arrow=null;S.ans=null; // the position is being answered now, so any reveal arrow is done
  // The stored eval is keyed by the position the move was played FROM, so read it
  // before S.ply moves on. Shown only after a miss: a clean book answer is not
  // relitigated with numbers (commit b40bcaa exists for that reason).
  const ev=(S.mode!=="puzzle"&&hadMiss)?evalFor(nowPos()):null;
  const gk=key(L(),S.ply);
  if(clean)gradeOncePerPass(gk,true,ms,null,L().moves[S.ply][1]);
  else if(S.hint<3)touch(gk,ms);
  // Said only where the stored table really does accept another move here.
  const short=clean&&S.mode!=="study"&&S.recog&&needWays(gk)>1&&
    (rec(gk)||{}).a&&rec(gk).a.length<2;
  if(S.mode!=="study"){
    if(clean)S.run++;else S.run=0;
    bumpToday();
  }
  const san=L().moves[S.ply][1];
  const played=L().moves[S.ply][0],to=played.slice(2,4);
  const evTxt=ev?evalNote(ev,san):null;
  // The position just answered, for the details panel and the common-mistake line.
  const asked=nowPos();S.infoAt={id:L().id,ply:S.ply};
  S.sel=null;S.ply++;S.tries=0;S.hint=0;
  render(true);flash(to,"good");
  // Arrows where the answer stays on screen: Shuffle's post-answer window and a
  // finished drill line. Mid-line the reply lands in 260ms and the next question is live.
  if(S.mode==="shuffle"||(S.mode==="line"&&S.ply>=L().moves.length))
    setArrows(answerArrows(asked,played,S.mode==="shuffle"&&S.ply<L().moves.length?L().moves[S.ply][0]:null,played),false);
  el("nMsg").innerHTML='<span class="ok hit">✓ Correct</span> <span class="ok">— '+san+(clean?"":" (with help)")+(ms?",":".")+"</span>"+
    (ms?' <span class="neutral">'+fmtMs(ms)+(clean&&ms>SLOW?", slow: it will come back sooner":"")+".</span>":"")+
    (short?' <span class="neutral">Your system has another sound move here too; find it and this board counts as solid.</span>':"");
  if(S.mode==="line"||S.mode==="puzzle"){
    if(S.ply>=L().moves.length){
      if(S.mode==="puzzle"){
        const r=pzRec();if(r){r.ok++;if(ms)r.ms=ms;save();}
        armPz(1500);
        el("nMsg").innerHTML='<span class="ok">Solved'+(clean?", clean":"")+". "+fmtMs(ms)+"</span>";}
      else{
        el("nMsg").innerHTML='<span class="ok">Line complete.</span> <span class="neutral">'+endNote()+"</span>";
        // No auto-reply is coming to carry it, so the engine block for a missed
        // final move lands on the note directly.
        if(evTxt)el("nText").textContent=(el("nText").textContent+" "+evTxt).trim();
      }
      return;}
    // Drill: the reply lands in 260ms and repaints the note, so hand the engine
    // block to autoReply the same way it already carries the answered move's own
    // annotation across that repaint.
    S.evNote=evTxt;
    later(autoReply,260);
  }else{
    // Shuffle serves a bare position, so the answer is the one moment to say
    // where it came from and what the opponent does next (the reply's note is
    // never seen otherwise - Continue jumps to a fresh position).
    const l=L(),note=l.moves[S.ply-1][2],next=l.moves[S.ply];
    let ctx='<span class="neutral">'+[l.name,l.src].filter(Boolean).join(" \u00b7 ")+
      (KIND[l.id]?' <span class="kind '+KIND[l.id]+'">'+KIND[l.id]+"</span>":"")+"</span>";
    if(l.start!==START){
      ctx+="<br>From a set position.";
    }else{
      const from=S.ply>12?S.ply-10:0,toks=[];
      for(let i=from;i<S.ply;i++){
        let t=(i%2===0?(i/2+1)+".":(i===from?Math.ceil(i/2)+"...":""))+l.moves[i][1];
        if(i===S.ply-1)t="<b>"+t+"</b>";
        toks.push(t);
      }
      ctx+="<br>"+(from?"\u2026 ":"")+toks.join(" ");
    }
    if(note)ctx+="<br>"+note;
    else{
      // No authored annotation for this move: fall back to PLAN's generic prose,
      // labelled as such - it must never read as this line's own annotation.
      const g=PLAN[l.you][l.moves[S.ply-1][1].replace(/[+#!?]/g,"")];
      if(g)ctx+='<br><span class="neutral">In general: '+g+"</span>";
    }
    if(next){
      const who=l.start===START?(S.ply%2?"Black":"White"):(l.you==="w"?"Black":"White");
      const nn=l.start===START?(S.ply%2?Math.ceil(S.ply/2)+"...":(S.ply/2+1)+"."):"";
      ctx+="<br>"+who+" replies "+nn+next[1]+".";
      if(next[2])ctx+=" "+next[2];
      else{
        // The reply is the other colour's move, so its PLAN lives in the other table.
        const g=PLAN[l.you==="w"?"b":"w"][next[1].replace(/[+#!?]/g,"")];
        if(g)ctx+=' <span class="neutral">In general: '+g+"</span>";
      }
    }else{
      ctx+="<br>The line ends here.";
    }
    if(evTxt)ctx+='<br><span class="neutral">'+evTxt+"</span>";
    const cm=commonMistakes(asked);
    if(cm.length)ctx+='<br><span class="neutral">'+esc(mistakeLead(cm[0]))+"</span>";
    if(ecoNow())ctx+='<br><span class="eco">'+ecoNow()+"</span>";
    el("nText").innerHTML=ctx;
    if(hadMiss||note){
      // A miss or an annotation is something to read; wait for a
      // tap instead of racing the auto-advance past it.
      armWait();
      el("nMsg").innerHTML+=' <span class="neutral wait">Tap to continue.</span>';
    }else{
      armNext(850);
      el("nMsg").innerHTML+=' <span class="neutral">Tap to continue.</span>';
    }
  }
}
/* ---------- stored engine evaluations ---------- */
/* EVL (src/data/evals.js) is keyed by exactly what keyFen() produces, one row per
   trained position: top moves as [uci,san,cp,mate] with a short SAN pv for the
   best move. Every score is SIDE-TO-MOVE relative - positive favours whoever is
   to move in that position - so nothing here flips by colour, ever. All display
   goes through fmtScore(), the one formatting choke point, so a stored mate can
   never be printed as a pawn count. Never shown in puzzle mode. */
function evalFor(pos){return (typeof EVL!=="undefined"&&EVL[keyFen(pos)])||null;}
// Kept free of nested braces on purpose: test/verify.mjs extracts this function's
// source by regex to unit-test it outside the browser.
function fmtScore(e){
  if(e.mate!==null&&e.mate!==undefined)return e.mate>0?"mate in "+e.mate:"gets mated in "+(-e.mate);
  return (e.cp<0?"-":"+")+(Math.abs(e.cp)/100).toFixed(1);
}
/* The post-answer engine block, shown by good() only after a miss: the answer is
   known, so the engine's first choice may be named. When the repertoire move is
   also in the stored top five, both numbers stand side by side - that is the
   honest statement, and the repertoire move is never called best when it is not. */
function evalNote(ev,repSan){
  const sc=r=>fmtScore({cp:r[2],mate:r[3]});
  const best=ev.m[0],bare=repSan.replace(/[+#!?]/g,"");
  const rep=ev.m.find(r=>r[1].replace(/[+#]/g,"")===bare);
  let s="Engine (Stockfish 16, depth "+ev.d+"): ";
  if(rep===best)s+=repSan+" is also its first choice, "+sc(best)+".";
  else if(rep)s+="first choice "+best[1]+" "+sc(best)+" \u00b7 this move "+repSan+" "+sc(rep)+".";
  else s+="first choice "+best[1]+" "+sc(best)+"; "+repSan+" is outside its best five.";
  if(ev.pv&&ev.pv.length)s+=" Its line: "+ev.pv.join(" ")+".";
  return s;
}
/* ---------- what the graded move did ----------
   Everything below turns a gradeMove record (src/engine.js, research/GRADING.md)
   into prose. One rule holds over all of it: no clause without a stored number
   behind it. A mate goes through fmtScore and is never a pawn count, "winning"
   and "lost" come from scoreState and nowhere else, and a best defence in a lost
   position is named as a defence - the record carries situation and after side by
   side for exactly that sentence. */
/* The end of an analysed branch. The plan is the line's own authored aim, its
   first sentence, and not an evaluation; the offer is the two things this page can
   actually do next - another position from the repertoire, or Study, where the
   pieces move freely and nothing is graded. Nothing is promised beyond that: there
   is no engine here, and the table stops where the line stops. */
function endNote(){
  const p=(L().plan||"").split(". ")[0].replace(/\.$/,"");
  return (p?p+". ":"")+"Another line, or open it in Study, where the pieces move freely and nothing is graded.";
}
/* The opposing reply the page may actually show, with no search anywhere: the
   table's row for the position the move LEAVES, whose first entry is the
   opponent's best answer there, and failing that the stored pv of the row we are
   standing in, whose second move is that same answer when the move played is the
   pv's own first move. Null when neither covers it - an invented reply is worse
   than none. */
function replyAfter(pos,m,row,g){
  const aft=evalFor(make(pos,m));
  if(aft&&aft.m&&aft.m.length)return aft.m[0][1];
  const ln=g&&g.san?lineOf(row,g.san):null;
  return ln&&ln.length>1?ln[1]:null;
}
/* The stored SAN line that starts with this move: p is aligned with the ranked
   moves and xp with the separately searched ones, each from the same search that
   scored the move (tools/build-evals.mjs), so every stored candidate has its own
   resulting position. pv, the best move's line, is the fallback for a table built
   before p existed. Null when the move has no stored line. */
function lineOf(row,sanTxt){
  if(!row)return null;
  const bare=x=>x.replace(/[+#!?]/g,""),want=bare(sanTxt);
  for(const [lk,mk] of [["p","m"],["xp","x"]])if(row[lk]&&row[mk]){
    const i=row[mk].findIndex(e=>bare(e[1])===want);
    if(i>=0&&row[lk][i])return row[lk][i];
  }
  return row.pv&&row.pv.length&&bare(row.pv[0])===want?row.pv:null;
}
// The opponent's move, written the way the move list writes it.
function theirs(sanTxt){return (L().you==="w"?"…":"")+sanTxt;}
/* ---------- counted choices (src/data/choices.js) ----------
   CHO counts what players of the trained colour chose at each drilled position, per
   rating band. A common mistake is a choice over CHO_FLOOR in the selected band that
   gradeMove prices as a concession or worse and that no line plays from this board.
   The count only picks which moves to mention; the grade alone makes one a mistake,
   and every number printed is a stored one. */
const MISTAKE=["concession","inferior","losing"];
const BOOKAT={};
for(const v of Object.values(KEYCACHE)){const i=v.lastIndexOf(":");(BOOKAT[v.slice(0,i)]=BOOKAT[v.slice(0,i)]||new Set()).add(v.slice(i+1));}
function choAt(pos){return (typeof CHO!=="undefined"&&CHO[keyFen(pos)])||null;}
// One move's count in the selected band, or null when it is under the floor there.
function choCount(pos,uci){
  const r=choAt(pos);if(!r)return null;
  const n=r[0][S.band];
  if(n<CHO_FLOOR.parent)return null;
  const e=r.slice(1).find(x=>x[0]===uci);
  const g=e?e[2+S.band]:0;
  return (g>=CHO_FLOOR.games&&g/n>=CHO_FLOOR.share)?{uci:e[0],san:e[1],g:g,n:n}:null;
}
// Counted choices over the floor in the selected band that no line plays here, each
// with its grade. A choice the table never scored stays "unknown" and is never priced.
function counted(pos){
  const r=choAt(pos),row=evalFor(pos);
  if(!r||!row)return [];
  const book=BOOKAT[keyFen(pos)]||new Set(),out=[];
  for(const e of r.slice(1)){
    if(book.has(e[0]))continue;
    const c=choCount(pos,e[0]);if(!c)continue;
    c.grade=gradeMove(row,pos,e[0]);out.push(c);
  }
  return out.sort((a,b)=>b.g-a.g);
}
function commonMistakes(pos){
  return counted(pos).filter(c=>c.grade.analysis==="checked"&&MISTAKE.indexOf(c.grade.verdict)>=0);
}
function countTxt(c){return c.g+" of "+c.n+" counted games ("+Math.round(100*c.g/c.n)+"%)";}
// A concession is named as one: 30 to 70 centipawns is a price, not a blunder.
function mistakeTxt(c){
  return c.san+(c.grade.verdict==="concession"?" (a concession)":"")+", chosen in "+countTxt(c)+
    ". Stockfish 16, depth "+c.grade.why.depth+": "+fmtScore(c.grade)+lossTxt(c.grade)+".";
}
// Shown after a correct answer, so it carries the count and the cost but not the
// engine readout: a clean answer is not relitigated with an engine block, and the
// full priced line is in the Position details panel.
function mistakeLead(c){return "A common "+(c.grade.verdict==="concession"?"concession":"mistake")+" here at "+
  FRQ_BANDS[S.band]+" ("+CHO_SRC+"): "+c.san+", chosen in "+countTxt(c)+
  (c.grade.lossCp?", "+c.grade.lossCp+" centipawn"+(c.grade.lossCp===1?"":"s")+" behind the table's first choice":"")+".";}
/* ---------- position details ----------
   One place for what the stored data can say about the position being asked, and
   nothing it cannot: occurrence (FRQ, CHO), the table's depth and the gap behind its
   first choice, the line's provenance, and once the position is answered, the line's
   plan, the table's first choice with the reply it expects, and the common mistakes.
   While a question is live only the first group is shown, and every row is run
   through refuteLeaks against the expected move, so nothing here can hand over the
   answer (invariant 4). The threat comes from a build-time null-move search
   (threatAt); the goal is the threat, the line's plan and the line's own note on
   the move, each labelled as what it is - nothing is written per position here. */
/* ---------- threats (EVL[key].t) ----------
   t is a null-move search computed at build time: the same board with the move
   handed to the opponent, searched by the same engine at the same depth, scored
   from the THREATENING side's view. Its gain is what that free move is worth to
   them over the position as it stands, where the table's first choice scores
   row.m[0] for the mover: gain = t + best (both in centipawns). A tempo alone is
   worth something in any opening position, so a threat is shown only when the
   free move gains at least THREAT_CP, or mates; the threshold and its calibration
   are in research/W5-POSITION-METADATA.md. Never shown for a position whose mover
   is already mating or already being mated: no centipawn gain is defined there. */
const THREAT_CP=150;
function threatAt(row){
  if(!row||!row.t||!row.m||!row.m.length)return null;
  const t=row.t,b=row.m[0];
  if(b[3]!==null)return null;
  if(t[3]!==null)return t[3]>0?{t:t,gain:null}:null;
  const gain=t[2]+b[2];
  return gain>=THREAT_CP?{t:t,gain:gain}:null;
}
function threatTxt(l,th,depth){
  const them=l.you==="w"?"Black":"White",t=th.t,dots=l.you==="w"?"\u2026":"";
  let s="If it were "+them+"'s move: "+dots+t[1]+", "+(t[3]!==null?"and "+them+" mates in "+t[3]:
    fmtScore({cp:t[2],mate:null})+" for "+them+", "+th.gain+" centipawns more than the position gives "+them+" as it stands")+
    " (Stockfish 16, depth "+depth+", searched with the move handed over).";
  if(t[4]&&t[4].length>1)s+=" Its line: "+dots+t[4].join(" ")+".";
  return s;
}
/* A threat stays hidden while the question is live when it points at the answer:
   the text names the answer's move or squares (refuteLeaks), or the threat move
   itself starts or lands on a square the answer starts or lands on - the answer
   parrying it by capturing, blocking or moving the target away. After answering
   it is always shown. */
function threatLeaks(txt,th,want){
  const a=[want[0].slice(0,2),want[0].slice(2,4)],u=th.t[0];
  return refuteLeaks(txt,want[0],want[1])||a.indexOf(u.slice(0,2))>=0||a.indexOf(u.slice(2,4))>=0;
}
// The line's plan before answering: refuteLeaks plus the piece name, and castling
// in any spelling when the answer castles - the same tests moveClue() applies.
function planLeaks(txt,pos,want){
  const m=findMove(pos,want[0]);if(!m)return true;
  const low=txt.toLowerCase();
  return refuteLeaks(txt,want[0],want[1])||low.indexOf(NAME[pos.b[m.f].toLowerCase()])>=0||
    (!!m.c&&(low.indexOf("castl")>=0||low.indexOf("o-o")>=0));
}
const OCC=["under 0.1%","at least 0.1%","at least 0.3%","at least 1%","at least 3%","at least 10%"];
function infoAt(){
  const l=L();
  if(S.mode==="puzzle")return null;
  // A credited setup move in Shuffle shows the user's own move through S.free, so the
  // answered check comes before the free-move one.
  if(S.mode==="shuffle"&&S.pending)return (S.infoAt&&S.infoAt.id===l.id)?{ply:S.infoAt.ply,answered:true}:null;
  if(S.free.length)return null;
  const mine=p=>p>=0&&p<l.moves.length&&(p%2===0?"w":"b")===l.you;
  if(S.mode==="shuffle")return mine(S.ply)?{ply:S.ply,answered:false}:null;
  if(mine(S.ply))return {ply:S.ply,answered:false};
  for(let p=Math.min(S.ply,l.moves.length)-1;p>=0;p--)if(mine(p))return {ply:p,answered:true};
  return null;
}
function infoRows(l,ply,answered){
  const pos=posAt(l,ply),k=keyFen(pos),row=evalFor(pos),want=l.moves[ply],rows=[];
  const band=FRQ_BANDS[S.band],h=fhash(k),b=FRQB[h],cho=choAt(pos);
  let occ=b===undefined
    ?"No occurrence bucket for this board at "+band+", so Shuffle weights it neutral."
    :"Reached in "+OCC[b]+" of the counted "+band+" games in this repertoire's tree.";
  if(cho&&cho[0][S.band])occ+=b===undefined
    ?" "+cho[0][S.band]+" counted game"+(cho[0][S.band]===1?"":"s")+" reached this exact board, too few to bucket."
    :" "+cho[0][S.band]+" counted game"+(cho[0][S.band]===1?"":"s")+" reached this exact board.";
  if(FRQS.has(h))occ+=" A rare forcing position, so it keeps full weight.";
  rows.push(["Occurrence",occ]);
  if(row){
    let c="Stockfish 16, depth "+row.d+".";
    if(row.m[0][3]!==null&&row.m[0][3]>0)c+=" Its first choice forces mate.";
    else if(row.m.length>1){
      const g2=gradeRow(row,pos,row.m[1][0]); // this row's own gap, at this row's depth
      if(g2.lossCp!==null)c+=GRADE.accept.indexOf(g2.verdict)>=0
        ?" Its top two moves are "+g2.lossCp+" centipawn"+(g2.lossCp===1?"":"s")+" apart, inside the noise band: more than one move is sound."
        :" Its first choice stands "+g2.lossCp+" centipawn"+(g2.lossCp===1?"":"s")+" clear of the second: a narrow position.";
    }
    const deep=typeof DEEP!=="undefined"?DEEP[k]:null;
    if(deep)c+=" A second search at depth "+deep.d+" is stored too, and a move either search accepts is accepted.";
    const all=new Set([row,deep].filter(Boolean).flatMap(r=>[...r.m,...(r.x||[])].map(e=>e[0])));
    // Accepted means sound AND in the system (inSystem); a sound move from another
    // opening is counted apart, because it is not credited here.
    const snd=[...all].filter(u=>GRADE.accept.indexOf(gradeMove(row,pos,u).verdict)>=0);
    const ok=snd.filter(u=>inSystem(l,pos,u,want[0],row)).length,off=snd.length-ok;
    c+=" "+ok+" stored move"+(ok===1?" is":"s are")+" accepted here"+
      (off?"; "+off+" more "+(off===1?"is":"are")+" sound but leave"+(off===1?"s":"")+" the system.":".");
    rows.push(["Confidence",c]);
  }
  if(S.mode!=="shuffle"||answered){
    const others=(ALT[k]||[]).filter(a=>LINES[a[0]].id!==l.id).length;
    rows.push(["Source",[l.name,l.src].filter(Boolean).join(" · ")+(KIND[l.id]?" ("+KIND[l.id]+")":"")+
      (others?"; "+others+" other line"+(others===1?"":"s")+" reach this board.":".")]);
  }
  // Goal, in three honest parts and no new prose: the threat (a stored search),
  // the line's own plan (per line, labelled as the line's) and, once answered, the
  // line's own note on the drilled move. Before answering the plan is shown only
  // in Drill (in Shuffle it would name the line) and only when it names neither
  // the answer, its squares, its piece nor castling for a castling answer.
  const th=threatAt(row);
  let thTxt=th?threatTxt(l,th,row.d):null;
  if(thTxt&&!answered&&threatLeaks(thTxt,th,want))thTxt=null;
  if(thTxt)rows.push(["Threat",thTxt]);
  else if(row&&row.t&&answered)rows.push(["Threat","Nothing concrete: handed the move, "+(l.you==="w"?"Black":"White")+
    " gains less than "+THREAT_CP+" centipawns over the position as it stands (Stockfish 16, depth "+row.d+")."]);
  const p=(l.plan||"").split(". ")[0].replace(/\.$/,"");
  if(p&&(answered||(S.mode!=="shuffle"&&!planLeaks(p,pos,want))))rows.push(["Plan","This line's aim: "+p+"."]);
  if(answered){
    const note=(want[2]||"").trim();
    if(note)rows.push(["Move note","The line's note on "+want[1]+": "+note]);
    if(row){
      let e="First choice "+row.m[0][1]+" "+fmtScore({cp:row.m[0][2],mate:row.m[0][3]});
      if(row.pv&&row.pv.length>1)e+="; the reply the table expects after it is "+theirs(row.pv[1])+".";
      else e+=".";
      rows.push(["Engine",e]);
    }
    const all=counted(pos),cm=all.filter(c=>c.grade.analysis==="checked"&&MISTAKE.indexOf(c.grade.verdict)>=0);
    const un=all.filter(c=>c.grade.analysis!=="checked").length;
    let t;
    if(cm.length)t=cm.slice(0,2).map(c=>mistakeTxt(c)).join(" ")+" Counted at "+band+", "+CHO_SRC+".";
    else if(cho&&cho[0][S.band]>=CHO_FLOOR.parent)t="None among the scored moves: nothing players at "+band+" chose that often here is priced as a concession or worse.";
    else t="Too few counted games at "+band+" to name one.";
    if(un)t+=" "+un+" other common choice"+(un===1?" has":"s have")+" no stored score, so nothing is said about "+(un===1?"it.":"them.");
    rows.push(["Common mistakes",t]);
  }
  // A live question shows nothing that names the move, its squares, or its piece.
  return answered?rows:rows.filter(r=>!refuteLeaks(r[1],want[0],want[1]));
}
let infoFor=null;
function renderInfo(){
  const box=el("infoBox"),l=L();
  if(infoFor!==l.id){box.open=false;infoFor=l.id;}
  const t=infoAt();
  box.style.display=t?"":"none";
  el("infoTxt").innerHTML=t?infoRows(l,t.ply,t.answered).map(r=>
    '<div class="irow"><b>'+esc(r[0])+"</b> "+esc(r[1])+"</div>").join(""):"";
}
// Distance from the row's first choice, in the unit the policy is calibrated in.
function lossTxt(g){
  if(g.lossCp===null)return "";
  if(g.lossCp===0)return ", and nothing in the table scores higher";
  return ", "+g.lossCp+" centipawn"+(g.lossCp===1?"":"s")+" behind its first choice";
}
/* What the move leaves, said only where scoreState said it. "lost" after a
   position that was already lost is "still lost", never a fresh verdict, and a
   best defence is never allowed to read as a rescue. */
function afterTxt(g){
  if(!g.after)return "";
  if(g.after==="mating")return "It forces mate.";
  if(g.after==="mated")return g.situation==="mated"?"The position was already mated and still is.":"It walks into a forced mate.";
  if(g.after==="won")return "The position stays winning.";
  if(g.after==="lost")return g.situation==="lost"?"The position stays lost; this is defence, not a rescue.":"It leaves the position lost.";
  return "";
}
/* gradeMove's split: the two stored searches of a deep-checked position disagree
   on whether this move is accepted. Both numbers are stored ones; the move is
   accepted because one of the two searches accepts it. */
function splitTxt(sp){
  const one=r=>"depth "+r.d+" "+fmtScore(r)+(r.lossCp===null?"":r.lossCp===0?" (its first choice)":" ("+r.lossCp+" behind its first choice)");
  return "The table's two searches disagree about this move: "+sp.map(one).join(", ")+". Either one accepting it is enough.";
}
/* The full stored sentence about one graded move: its own score, its distance from
   the first choice, what it leaves and the reply the table answers with. */
function gradeLine(g){
  if(!g||g.analysis!=="checked")return "The table does not cover this move, so nothing is claimed about it either way.";
  let s="Stockfish 16, depth "+g.why.depth+": "+g.san+" "+fmtScore(g)+lossTxt(g)+".";
  if(g.split)s+=" "+splitTxt(g.split);
  const a=afterTxt(g);
  if(a)s+=" "+a;
  if(g.reply)s+=" The table answers "+theirs(g.reply)+".";
  return s;
}
// The stored continuation of the move actually played, from that move's own line
// (lineOf) - never another move's line, which would be a game that was not played.
function pvTxt(g,row){
  const ln=g&&g.san?lineOf(row,g.san):null;
  return ln&&ln.length>=3?" Its line from here: "+ln.join(" ")+".":"";
}
// A move the table puts first or inside its noise band, played where the line
// wants another. Named as sound, with the number, and nothing stronger.
function goodLead(t,g,row){
  const head=g.verdict==="best"?t+" is the table's first choice here":
    t+" is sound here, inside the noise band of the table's first choice";
  return head+". "+gradeLine(g)+pvTxt(g,row);
}
// A formation move the gate credited. The sentence the Hippo's move order earned,
// plus the number where the table backed it rather than a four-ply material check.
function setupLead(t,g,row){
  const l=L();
  return "The "+(l.you==="b"?"wall":"setup")+" is a formation, not a move order: "+t+
    " fills one of its squares, and "+(g&&g.analysis==="checked"
      ?"the table has it within the noise band of its own first choice. "+gradeLine(g)+pvTxt(g,row)
      :"a four-ply material check finds no punishment for it here.");
}
/* A demanding position (hip66 plies 21 and 25, for two): the first choice is not a
   formation move at either depth the table holds, so building is not free here
   whatever the wall move scores. Run
   through the same leak filter a refutation is, because "not a formation move" is
   a fact about the position that could point at the answer. */
function demandLead(){
  const txt="This position asks for something concrete: the table's first choice here is not a formation move, so the order does matter.";
  const w=S.ply<L().moves.length?L().moves[S.ply]:null;
  return (w&&refuteLeaks(txt,w[0],w[1]))?null:txt;
}
/* What a wrong move concretely costs, said only when the material search
   (matVerdict, src/engine.js) proves it. The sentence claims exactly what was
   searched: the opponent's best first reply, and either a material swing that does
   not come back inside four plies, or a forced mate the search itself confirmed -
   the one evaluation claim allowed here, because it has been checked. A search that
   ran out of budget (v null) or found less than a pawn stays silent: an invented
   reason is worse than none. Suppressed whenever the text would leak the move the
   user was supposed to play - the position is still live for a retry, so the
   refutation may name the OPPONENT's move and nothing else. */
function refutation(v){
  if(!v||v.swing<1)return null;
  const reply=(L().you==="w"?"...":"")+v.san;
  let txt;
  if(v.mate)txt=v.mate===1?reply+" answers it, and it is mate."
    :reply+" answers it and forces mate in "+(v.mate===3?"two":Math.ceil(v.mate/2))+".";
  else txt=reply+" answers it, and "+(v.swing===1?"a pawn's worth of material does not come back"
    :v.swing+" points of material do not come back")+" inside four plies.";
  const w=S.ply<L().moves.length?L().moves[S.ply]:null;
  return (w&&refuteLeaks(txt,w[0],w[1]))?null:txt;
}
/* The move is not this line's, and was not credited. g is the gradeMove record
   (null in tactics, which keeps its own rules), v the material search's verdict,
   which now arrives only where the table does not cover the move.

   Blame needs evidence. The table saying a move is a concession or worse is
   evidence; a four-ply search proving material does not come back is evidence; the
   table simply not having searched the move is neither, so an unanalysed move is
   said to be unanalysed and costs the record nothing - no miss, no broken run, no
   spent hint, exactly as the "book too" branch in playMove already behaves.
   Tactics is unchanged: every wrong move there counts.

   Nothing here names the table's first choice or its pv. The position is live for
   a retry and the first choice is usually the repertoire move, so the numbers may
   be stated and the move behind them may not. */
function offBook(name,t,v,g,extra,u){
  const pz=S.mode==="puzzle";
  const checked=!!(g&&g.analysis==="checked");
  // concession is refused with its price named rather than passed off as equal:
  // GRADE.accept holds best and equal alone, and the number is the whole point.
  const priced=checked&&(GRADE.reject.indexOf(g.verdict)>=0||g.verdict==="concession");
  const punish=checked?null:refutation(v);
  const blame=pz||priced||!!punish;
  if(blame&&S.tries===0&&S.hint<3)gradeOncePerPass(key(L(),S.ply),false,0,t);
  if(pz&&S.tries===0){const r=pzRec();if(r){r.no++;save();}}
  if(blame&&S.tries===0){S.run=0;bumpToday();}
  const first=S.tries===0;
  if(blame&&first&&u)S.missAt={k:keyFen(nowPos()),u:u};
  if(blame)S.tries++;
  S.sel=null;
  // Say something about the move that is wanted instead of repeating the same
  // refusal on every retry - the same leak-filtered clue Hint tier 1 would give,
  // and never the move itself, because the position stays live for another try.
  // Taking it spends hint tier 1 so the next Hint tap moves on to "which piece"
  // rather than repeating what is already on screen. That costs nothing at
  // grading: the miss was graded above while S.hint was still 0, and good()'s
  // "clean" test is already false here because S.tries is non-zero.
  const why=(blame&&S.hint===0)?moveClue():null;
  if(why)S.hint=1;
  // The number is shown on the graded attempt only, and talks about the PLAYED
  // move alone.
  let evTxt=null;
  if(checked&&first){
    evTxt="Stockfish 16, depth "+g.why.depth+": "+t+" "+fmtScore(g)+lossTxt(g)+".";
    const a=afterTxt(g);
    if(a)evTxt+=" "+a;
    if(g.verdict==="concession")evTxt+=" Playable; that is what it costs.";
  }
  // analysis "unknown" is the only state with no number to print, so it is the one
  // state that gets said out loud instead.
  // How often players at the selected band chose this very move here: a count about
  // the move played, so it cannot point at the one wanted.
  const cc=(checked&&blame&&!pz)?choCount(nowPos(),g.uci):null;
  const common=cc?"Players at "+FRQ_BANDS[S.band]+" chose it here in "+countTxt(cc)+", "+CHO_SRC+".":null;
  const none=(!checked&&!punish&&!pz)?"The table has not searched this move, so nothing is claimed about it either way.":null;
  render(false);flash(name,blame?"bad":"warn");
  el("nMsg").innerHTML='<span class="'+(blame?"no":"neutral")+'">'+t+(pz
      ?" is legal, but the tactic needs something else.</span>"
      :" is legal, but it is not the repertoire move.</span>")+
    (punish?' <span class="no">'+punish+"</span>":"")+
    (extra?' <span class="neutral">'+extra+"</span>":"")+
    (evTxt?' <span class="neutral">'+evTxt+"</span>":"")+
    (common&&first?' <span class="neutral">'+esc(common)+"</span>":"")+
    (none?' <span class="neutral">'+none+"</span>":"")+
    (why?' <span class="neutral">'+why+"</span>":"");
  // The move just refused, and the reply the note names against it - only when the
  // note names it (refutation() has already run its leak filter), and only when
  // neither end of that reply sits on the wanted move's squares, which an arrow
  // would show where the words do not.
  const w=S.ply<L().moves.length?L().moves[S.ply][0]:"",ws=[w.slice(0,2),w.slice(2,4)];
  const ref=punish&&v&&v.uci&&ws.indexOf(v.uci.slice(0,2))<0&&ws.indexOf(v.uci.slice(2,4))<0?v.uci:null;
  if(u)setArrows([{u:u,c:"bad"},{u:ref,c:"ref"}],true);
}
/* A sound move from another opening: the grader accepts it and the learner's system
   does not play it. Neutral on purpose - no miss, no streak change, no credit, no
   hint spent - and the question stays live. The number describes the played move
   alone, and the whole sentence goes through the leak filter a refutation does,
   falling back to words that do not name the move at all. */
function offSystem(name,t,g){
  const l=L(),w=l.moves[S.ply],sys=sysName(l);
  let txt=t+" is sound, but it is not "+sys+" here. Try again.";
  const ev="Stockfish 16, depth "+g.why.depth+": "+t+" "+fmtScore(g)+lossTxt(g)+"."+(g.split?" "+splitTxt(g.split):"");
  if(!refuteLeaks(txt+" "+ev,w[0],w[1]))txt+=" "+ev;
  else if(refuteLeaks(txt,w[0],w[1]))txt="That move is sound, but it is not "+sys+" here. Try again.";
  S.sel=null;render(false);flash(name,"warn");
  el("nMsg").innerHTML='<span class="neutral">'+esc(txt)+"</span>";
}
/* A setup line's targets say where the formation wants each piece; grading against
   one fixed move order marks correct chess wrong - the Hippo's wall goes up in
   almost any order, and the user rightly complained when the trainer punished that.
   A move qualifies when the line has a formation to build (targets non-empty), the
   move puts the right piece on one of its squares, the piece was not merely
   shuffling from one target square to another, and the material search does not
   show it being punished - a quiet building move played while something concrete
   is happening is a mistake, and falls through to the refutation instead. A null
   verdict (node budget ran out) also disqualifies: unproven-safe is not safe.

   The structural half is isSetupMove (src/engine.js), shared with the fixture so
   the two cannot drift; the licence half is setupGate, which reads the stored row.
   The material check survives in exactly one place - where the gate says the row
   has not searched this move, or has no row at all. Everywhere else the table has
   already answered, including "demanding", where it answered no. */
function setupMove(pos,m,v,gate){
  const l=L();
  const g=gate||setupGate(evalFor(pos),pos,m,tgtOf(l));
  if(g.credit)return true;
  if(g.reason!=="unanalysed"&&g.reason!=="no-row")return false;
  return isSetupMove(tgtOf(l),pos,m)&&!!v&&v.swing<1;
}
/* Shuffle's credit for a qualifying setup move. good() cannot run here: it would
   advance S.ply along the line's own move, and the board would then show a move
   the user did not play. Grade in place instead (it is correct chess; punishing it
   was the bug this fixes) and show the position after the USER's move through the
   free-move plumbing, with ok:1 so renderOff keeps its take-back banner away.
   S.lastKey needs no update, unlike the book-alternative branch in tap(): the key
   graded is the very one shuffle() served, so the same board is already barred
   from coming straight back. skipNext -> shuffle(false) -> clearFree() cleans up. */
function setupGood(pos,m,t,lead,g){
  const clean=S.hint===0&&S.tries===0;
  const ms=elapsed();S.lastMs=ms;
  S.arrow=null;S.ans=null;
  if(clean)grade(key(L(),S.ply),true,ms,null,t);
  else if(S.hint<3)touch(key(L(),S.ply),ms);
  if(clean)S.run++;else S.run=0;
  bumpToday();
  S.free=[{uci:uciOf(m),san:t,ok:1}];S.fpos=make(pos,m);
  S.infoAt={id:L().id,ply:S.ply};
  S.sel=null;S.tries=0;S.hint=0;
  render(true);flash(sq(m.t),"good");
  // The reply arrow is the one the lead names (gradeLine's "The table answers"),
  // so a setup credited by the material check alone, which names none, draws none.
  setArrows(answerArrows(pos,uciOf(m),g&&g.reply?uciIn(S.fpos,g.reply):null,L().moves[S.ply][0]),false);
  const l=L(),want=l.moves[S.ply][1];
  el("nText").innerHTML='<span class="neutral">'+[l.name,l.src].filter(Boolean).join(" · ")+
    (KIND[l.id]?' <span class="kind '+KIND[l.id]+'">'+KIND[l.id]+"</span>":"")+"</span>"+
    "<br>"+(lead||setupLead(t,null,null))+" This line plays "+want+" first.";
  el("nMsg").innerHTML='<span class="ok hit">✓ Correct</span> <span class="ok">— '+t+
    (clean?"":" (with help)")+(ms?",</span> <span class='neutral'>"+fmtMs(ms)+".</span>":"</span>")+
    ' <span class="neutral wait">Tap to continue.</span>';
  armWait();
}
// PLAN is unsourced generic per-move prose written for this trainer: what a move
// is usually for in this repertoire, keyed by bare SAN alone. It is shown as a
// labelled "In general" fallback in Shuffle when a line has no authored note, and
// filtered through safe() before being used as a hint. It is not theory, carries
// no source, and must never be presented as a line's own annotation.
const PLAN={
 w:{"d4":"Claim the centre. Everything else is built on this advance.",
    "Nf3":"Cover e5 before doing anything ambitious.",
    "e3":"Solid, and it buries a bishop. That is the price of the system.",
    "Bd3":"Point something at h7.",
    "c3":"Prop up the centre so the pieces are free to leave.",
    "b3":"The other way to solve the buried bishop.",
    "Bb2":"Claim the long diagonal towards their king.",
    "Nbd2":"A third attacker on e4.",
    "Nc3":"A third attacker on e4.",
    "Ne5":"The outpost this whole system lives on.",
    "f4":"Cement the knight and open the rook's road.",
    "Rf3":"The last piece joins by lifting, not developing.",
    "Qe2":"Connect the rooks and back the coming break.",
    "Qf3":"Connect the rooks and look at h3 or g4.",
    "Re1":"Add a piece to the file the break will open.",
    "a3":"Take b4 from their knight before it goes there.",
    "h3":"Ask the bishop a question while you still can.",
    "Bg2":"Rebuild on the diagonal you just opened.",
    "e4":"The break the opening exists for.",
    "e5":"Gain space and evict the piece guarding their king.",
    "d5":"Close the centre and decide where the game will be played.",
    "c4":"Take the centre properly; the quiet system has nothing here."},
 b:{"g6":"The bishops belong on the long diagonals.",
    "b6":"The bishops belong on the long diagonals.",
    "Bg7":"Fianchetto, and aim through the centre.",
    "Bb7":"Fianchetto, and aim through the centre.",
    "d6":"Third rank, not fourth: nothing can hit it yet.",
    "e6":"Third rank, not fourth: nothing can hit it yet.",
    "a6":"Take b5 away from their pieces.",
    "h6":"Take g5 away from their pieces.",
    "Nd7":"Stay low, behind the wall.",
    "Ne7":"Stay low, behind the wall.",
    "Nf6":"Hit their centre at once instead of crouching.",
    "f5":"The break: strike where their structure is committed.",
    "c5":"The break: strike where their structure is committed.",
    "d5":"Lock the centre their advance just offered you.",
    "e5":"Lock the centre their advance just offered you.",
    "h5":"Meet the storm at its base before it lands.",
    "Kh7":"Step off the file the break is about to open.",
    "Kh8":"Step off the file the break is about to open.",
    "Qe8":"Reroute behind the wall before breaking.",
    "Na6":"Head for c5, where their bishop and pawn both live."}};
function clueLeaks(text,ctx){
  // One leak check every candidate clue passes through, whatever source it
  // came from (note, position fact, plan) — case-insensitive, and castling counts as
  // naming the move even when the note spells it "castling" instead of "O-O".
  const low=text.toLowerCase();
  return low.indexOf(ctx.bare)>=0||low.indexOf(ctx.to)>=0||low.indexOf(ctx.from)>=0||
    low.indexOf(ctx.pieceName)>=0||(ctx.isCastle&&(low.indexOf("castl")>=0||low.indexOf("o-o")>=0));
}
function moveClue(){
  const l=L(),ply=S.ply;
  if(ply>=l.moves.length)return null;
  const u=l.moves[ply][0],sanTxt=l.moves[ply][1];
  const pos=posAt(l,ply),m=findMove(pos,u);
  if(!m)return null;
  const to=sq(m.t),from=sq(m.f),pc=pos.b[m.f],t=pc.toLowerCase();
  const bare=sanTxt.replace(/[+#!?]/g,"");
  const ctx={bare:bare.toLowerCase(),to,from,pieceName:NAME[t],isCastle:!!m.c};
  const safe=txt=>(txt&&!clueLeaks(txt,ctx))?txt:null;
  const note=l.moves[ply][2]||"";
  if(note){
    const first=safe(note.split(". ")[0].replace(/\.$/,""));
    if(first&&first.length>14)return first+".";
  }
  const after=make(pos,m);
  const check=attacked(after.b,kingIdx(after.b,after.w),!after.w);
  const cap=!!pos.b[m.t]||m.ep;
  const prev=ply>0?l.moves[ply-1][0]:null;
  if(m.c)return safe("Get off the centre file before anything else in the position happens.");
  if(m.p)return safe("Something reaches the last rank.");
  if(cap&&prev&&prev.slice(2,4)===to){
    const c=safe("Recapture at once, before the material is consolidated.");
    if(c)return c;
  }
  if(cap&&check)return safe("There is a capture, and it arrives with check.");
  if(cap)return safe("Something of theirs can be taken.");
  if(check)return safe("The move gives check.");
  const plan=safe(PLAN[l.you]&&PLAN[l.you][bare]);
  if(plan)return plan;
  if(t==="p"){
    const opp=isW(pc)?"p":"P",d=isW(pc)?-8:8;
    const contested=[m.t+d-1,m.t+d+1,m.t-1,m.t+1].some(j=>j>=0&&j<64&&
      Math.abs((j%8)-(m.t%8))===1&&pos.b[j]===opp);
    if(contested)return safe("A break: the move offers a trade rather than a quiet gain.");
  }
  return null;
}
function hintLabel(){
  if(S.hint===0)return moveClue()?"Hint":"Which piece";
  return ["Hint","Which piece","Show me"][Math.min(S.hint,2)];
}
function hint(){
  // Guards the "h" keyboard shortcut the same way renderCtl guards the button:
  // while S.pending is set (armWait/armNext), S.ply already points at the
  // opponent's reply, so a hint here would leak or grade the wrong ply (finding 6).
  if(S.pending)return;
  if(S.ply>=L().moves.length)return;
  S.ans=null; // a hint tier moves the question on; the last attempt's arrows go
  const u=L().moves[S.ply][0],from=u.slice(0,2);
  const piece=posAt(L(),S.ply).b[ix(from)].toLowerCase();
  if(S.hint===0){
    const clue=moveClue();
    S.hint=1;
    if(clue){render(false);el("nMsg").innerHTML='<span class="neutral">'+clue+"</span>";return;}
  }
  S.hint++;
  if(S.hint===2){
    render(false);
    el("nMsg").innerHTML='<span class="neutral">Move the '+NAME[piece]+" on "+from+".</span>";
  }else{
    gradeOncePerPass(key(L(),S.ply),false);
    // Same persistent-arrow fix as offBook() (finding 7): set S.arrow before
    // render() so it survives the tap that selects the named piece, instead of
    // render()'s old unconditional drawArrow(null) wiping it immediately.
    S.arrow=u;render(false);
    el("nMsg").innerHTML='<span class="neutral">'+L().moves[S.ply][1]+". Play it to continue.</span>";
  }
}
function autoReply(){
  if(S.mode!=="line"&&S.mode!=="puzzle")return;
  // The note on the move just played is on screen for the 260ms before the reply
  // lands, which is not long enough to read it. Carry it across, labelled with its
  // own move so it is not read as a comment on the reply, and keep the reply's note
  // after it rather than in place of it.
  const i=S.ply-1,mine=S.mode==="line"&&i>=0&&(i%2===0?"w":"b")===L().you&&L().moves[i][2]
    ?L().moves[i][1]+": "+L().moves[i][2]:"";
  while(S.ply<L().moves.length&&!yourTurn())S.ply++;
  render(true);armClock();
  if(mine)el("nText").textContent=(mine+" "+el("nText").textContent).trim();
  if(S.evNote){el("nText").textContent=(el("nText").textContent+" "+S.evNote).trim();S.evNote=null;}
  el("nMsg").innerHTML=S.ply>=L().moves.length
    ?'<span class="ok">Line complete.</span>':'<span class="neutral">Your move.</span>';
}
// Structural-rule plies, derived from the line data rather than a hardcoded ply list:
// White e5 -> Black answers ...d5, break ...c5; White d5 -> Black answers ...e5, break
// ...f5 (README: "the two structural rules worth more than the move lists"). Only
// Black's own lines carry the reply half of either rule.
function isRulePly(l,p){
  if(l.you!=="b"||p===0)return false;
  const san=s=>s.replace(/[+#!?]/g,""),cur=san(l.moves[p][1]),prev=san(l.moves[p-1][1]);
  if((cur==="d5"&&prev==="e5")||(cur==="e5"&&prev==="d5"))return true;
  const need=cur==="c5"?["e5","d5"]:cur==="f5"?["d5","e5"]:null;
  if(!need)return false;
  for(let i=1;i<p;i++)if(san(l.moves[i][1])===need[1]&&san(l.moves[i-1][1])===need[0])return true;
  return false;
}
function shuffle(first){
  stopAll();
  // Deliberately-losing lines: fine in Study/Drill where the framing is visible, but
  const cand=[];
  for(let i=0;i<LINES.length;i++){
    const l=LINES[i];
    if(NO_SHUFFLE.has(l.id))continue;
    if(bookExcluded(l))continue;
    let seenNew=false;
    for(const p of drillPlies(l)){
      const k=key(l,p),st=state(k),frontier=st==="new"&&!seenNew;
      if(st==="new")seenNew=true;
      cand.push({i:i,p:p,k:k,st:st,frontier:frontier,rule:isRulePly(l,p)});
    }
  }
  // Keys are shared across lines, so the same board must be one weighted draw, not
  // one per line that transposes into it - otherwise a board reached by twenty lines
  // outweighs a board reached by one, independent of how due or how new it is. Group
  // by key; the first line/ply met (LINES order) is the representative, and a key
  // counts as frontier/rule if any of its views does - both are properties of "is
  // this worth introducing/boosting now", true if true anywhere it is asked.
  const byKey=new Map();
  for(const x of cand){
    const g=byKey.get(x.k);
    if(!g)byKey.set(x.k,{i:x.i,p:x.p,k:x.k,st:x.st,frontier:x.frontier,rule:x.rule});
    else{if(x.frontier)g.frontier=true;if(x.rule)g.rule=true;}
  }
  const uniq=[...byKey.values()];
  const anyDue=uniq.some(x=>x.st==="due");
  // Read once per draw: levels() walks the same filtered lines as the loop above.
  const curLv=S.lvW?levels().cur:-1;
  const pool=[];
  for(const x of uniq){
    const r=rec(x.k);
    let wt={new:2.2,due:3,learning:1.6,solid:.2}[x.st];
    if(x.st==="new"){
      if(anyDue)wt*=.25;
      // Flat fraction for non-frontier new plies, not a depth-decayed curve
      if(!x.frontier)wt*=.15;
      // Floor: due(3) > learning(1.6) > new-frontier(0.55 when anyDue, else 2.2) >
      // new-non-frontier(>=0.3) > solid(0.2). Without the floor, anyDue's 0.25 and
      // the 0.15 non-frontier fraction compound to 0.0825 - below solid's 0.2, so a
      // never-seen position would be served less than one already mastered whenever
      // anything was due (the common case). The floor keeps new material always
      // ranked above solid material while leaving the due-first, frontier-first,
      // rule-boosted ordering the rest of this function was written for.
      wt=Math.max(wt,.3);
    }
    if(r&&r.ms>SLOW)wt+=.8;
    if(r)wt+=Math.min(r.no,4)*.7;
    if(x.rule)wt+=.8;
    // Until this line a due review only competed with everything else: 3 against a
    // learning key that has missed and hesitates (1.6+.8+2.8=5.2), multiplied by
    // however many such keys exist, so "5 due now" on the menu bought roughly one due
    // prompt in twenty draws and the spacing the ladder computes decayed. Damp the
    // rest of the pool while anything is due - the same move the new branch above
    // already makes, extended to the whole pool. A tenth leaves the hottest learning
    // key worth about a fifth of the plainest due one, so due material leads without
    // the session becoming a queue: measured, due goes from 5% to 34% of draws with
    // sixty learning keys, so the rest still take most of them. New keys take this on
    // top of their own anyDue cut,
    // which is wanted - new material is the last thing a backlog needs - and the cut is
    // uniform, so the floor above still ranks new above solid. anyDue is read off the
    // same list, so at least one undamped candidate always remains.
    // Practical occurrence, on everything except due keys: a position met in one
    // game in three should come up more than one met in one in three thousand, never
    // at the cost of a due review, and skipping due keys is what keeps that true.
    // Uncounted positions are neutral, rare forcing ones have a floor.
    if(S.freqW&&x.st!=="due")wt*=freqFactor(x.k);
    // Depth, on the same terms: the learner's current level is favoured, deeper levels
    // fade with distance but never to zero, easier ones are left alone, and due keys
    // are never reweighted. Like the occurrence factor it lands after the new-above-
    // solid floor, so that floor holds within a level; across levels depth leads.
    if(x.st!=="due")wt*=levelFactor(x.k,curLv);
    if(anyDue&&x.st!=="due")wt*=.1;
    if(x.k===S.lastKey)wt=0;
    pool.push([x.i,x.p,x.k,wt]);
  }
  const sum=pool.reduce((a,x)=>a+x[3],0);
  let t=Math.random()*sum,pick=pool[0];
  for(const x of pool){t-=x[3];if(t<=0){pick=x;break;}}
  S.li=pick[0];S.ply=pick[1];S.lastKey=pick[2];clearFree();S.ans=null;S.missAt=null;
  S.sel=null;S.tries=0;S.hint=0;S.flip=LINES[pick[0]].you==="b";
  syncOpts();
  if(!first)render(false);
  armClock();
  const t2=totals();
  el("nMsg").innerHTML='<span class="neutral">'+t2.solid+" of "+t2.all+" positions solid.</span>";
}

/* ================= options sheet ================= */
function applyTheme(){
  // Fall back rather than throw: this runs at startup, before go("menu"), so an
  // index that is no longer valid used to leave a blank page and no way out.
  const t=THEMES[S.theme]||THEMES[0],r=document.documentElement.style;
  r.setProperty("--sqL",t[1]);r.setProperty("--sqD",t[2]);
  r.setProperty("--pcW",t[3]);r.setProperty("--pcB",t[4]);
  r.setProperty("--edgeW",t[5]);r.setProperty("--edgeB",t[6]);
}
function openOpts(o){el("opts").classList.toggle("on",o);el("scrim").classList.toggle("on",o);}
el("navMore").onclick=()=>openOpts(true);
el("scrim").onclick=()=>openOpts(false);
function syncOpts(){
  el("oFlip").setAttribute("aria-pressed",S.flip);el("oFlipS").textContent=S.flip?"on":"off";
  el("oGhost").setAttribute("aria-pressed",S.ghost);el("oGhostS").textContent=S.ghost?"on":"off";
  el("oThemeS").textContent=(THEMES[S.theme]||THEMES[0])[0];
  el("oSetS").textContent=(SETS[S.set]||SETS[0])[0];
  el("oBookS").textContent=S.bookOnly?"on":"off";
  el("oBook").setAttribute("aria-pressed",S.bookOnly);
  el("oFreqS").textContent=S.freqW?"on":"off";
  el("oFreq").setAttribute("aria-pressed",S.freqW);
  el("oBandS").textContent=FRQ_BANDS[S.band]+(S.band===FRQ_DEF?" (most games)":"");
  el("oRecogS").textContent=S.recog?"on":"off";
  el("oRecog").setAttribute("aria-pressed",S.recog);
  el("oLevelS").textContent=S.lvW?"on":"off";
  el("oLevel").setAttribute("aria-pressed",S.lvW);
  el("oArrowsS").textContent=S.arrowsOn?"on":"off";
  el("oArrows").setAttribute("aria-pressed",S.arrowsOn);
  el("oRestart").style.display=S.mode==="shuffle"?"none":"";
}
el("oFlip").onclick=()=>{S.flip=!S.flip;syncOpts();render(false);};
el("oGhost").onclick=()=>{S.ghost=!S.ghost;syncOpts();render(false);};
el("oTheme").onclick=()=>{S.theme=(S.theme+1)%THEMES.length;stats.theme=S.theme;save();applyTheme();syncOpts();};
el("oSet").onclick=()=>{S.set=(S.set+1)%SETS.length;stats.set=S.set;save();syncOpts();
  document.querySelectorAll(".ico[data-pc]").forEach(n=>{n.innerHTML="";n.appendChild(pieceEl2(n.dataset.pc,""));});
  if(S.screen==="board")render(false);};
el("oBook").onclick=()=>{S.bookOnly=!S.bookOnly;stats.bookOnly=S.bookOnly;save();syncOpts();};
el("oFreq").onclick=()=>{S.freqW=!S.freqW;stats.freqW=S.freqW;save();syncOpts();};
el("oBand").onclick=()=>{setBand((S.band+1)%FRQBS.length);stats.band=S.band;save();syncOpts();};
// Turning this off does not rewrite any record: the answer logs stay, and turning
// it back on reads them again.
el("oRecog").onclick=()=>{S.recog=!S.recog;stats.recog=S.recog;save();syncOpts();if(S.screen==="menu")renderMenu();};
el("oLevel").onclick=()=>{S.lvW=!S.lvW;stats.lvW=S.lvW;save();syncOpts();};
el("oArrows").onclick=()=>{S.arrowsOn=!S.arrowsOn;stats.arrows=S.arrowsOn;save();syncOpts();drawArrows();};
el("oRestart").onclick=()=>{openOpts(false);stopAll();S.ply=0;S.sel=null;S.tries=0;S.hint=0;S.arrow=null;S.ans=null;S.passKeys=new Set();render(false);
  if(S.mode==="line"&&!yourTurn())later(autoReply,250);};
el("oMenu").onclick=()=>{openOpts(false);go("menu");};
addEventListener("visibilitychange",()=>{if(!document.hidden&&S.screen==="board"&&S.mode!=="study")armClock();});
addEventListener("keydown",e=>{
  if(S.screen!=="board"||S.mode!=="study")return;
  // Mutually exclusive with the cursor-play handler above: that one only acts when
  // the board itself has focus, so this one must stand down exactly then. Without
  // this guard a focused board turned one ArrowRight into two conflicting actions
  // at once - move the accessible-play cursor a square, and step the line a ply
  // (finding 13, "double-fire").
  if(document.activeElement===el("board"))return;
  // clearFree() matches what the equivalent prev/next buttons in renderCtl() do:
  // without it, stepping S.ply while off-book moves were on the board (S.free
  // non-empty) left nowPos() still returning the stale free-play position, so the
  // board showed a diagram belonging to neither the line nor the free branch.
  if(e.key==="ArrowRight"){if(S.ply<L().moves.length){S.ply++;clearFree();render(true);}}
  if(e.key==="ArrowLeft"){if(S.ply>0){S.ply--;clearFree();stop();render(false);}}
});

/* ================= storage ================= */
/* Three tiers, tried in order: window.storage is the artifact host's async API,
   localStorage is the hosted-page case, memory is the last resort when both are
   absent or blocked. All three answer the same {value} shape, so nothing below
   needs to know which one it got. Memory-only means progress dies with the tab. */
const MEM={};
const STORE=(()=>{
  if(typeof window!=="undefined"&&window.storage)return window.storage;
  try{
    const probe="colle-hippo:probe";
    localStorage.setItem(probe,"1");localStorage.removeItem(probe);
    return {set:(k,v)=>Promise.resolve(localStorage.setItem(k,v)),
            get:k=>Promise.resolve({value:localStorage.getItem(k)})};
  }catch(e){
    // A plain object, wiped on reload. Nothing better is available if the
    // page is denied both APIs; the Progress screen's export is the escape hatch.
    // MEMONLY is the flag the UI reads so the app says this out loud rather than
    // letting the user believe a session is being kept.
    MEMONLY=true;
    return {set:(k,v)=>Promise.resolve(MEM[k]=v),
            get:k=>Promise.resolve({value:MEM[k]||null})};
  }
})();
// A write that fails is a write that did not happen, whichever tier took it: an
// artifact host's storage can reject, and localStorage can throw QuotaExceeded long
// after the probe in STORE passed. Latch MEMONLY so the menu and the crash bar stop
// claiming progress is being kept, rather than swallowing it silently.
async function save(){
  if(SAVE_HELD)return;
  try{await STORE.set("colle-hippo:v6",JSON.stringify(stats));}catch(e){MEMONLY=true;}
}

/* ================= lichess token (menu settings) ================= */
/* The token deliberately lives under its own key, outside the colle-hippo:v6
   stats blob: it is a credential, not progress, so it must not travel in an
   export/import backup and must survive "Reset all progress". Same three-tier
   STORE as everything else. Saving is gated on a live self-test: lichess's
   explorer refuses anonymous requests, and rather than trust that a Bearer
   token gets through, the Save button proves it with one real request and
   reports the outcome as it happened. Nothing runs at load beyond reading the
   stored value back - no request leaves this app until the user saves a token
   or opens the panel, so the no-token case stays at zero network calls. */
const TOK_KEY="colle-hippo:lichess-token";
function tokSay(cls,txt){el("tokMsg").innerHTML='<span class="'+cls+'">'+txt+"</span>";}
el("tokShow").onclick=function(){
  const i=el("tokIn"),show=i.type==="password";
  i.type=show?"text":"password";this.textContent=show?"Hide":"Show";
};
el("tokSave").onclick=async()=>{
  const t=el("tokIn").value.trim();
  if(!t){tokSay("neutral","Paste a token first, or use Clear to remove the stored one.");return;}
  tokSay("neutral","Asking the database with this token…");
  let r;
  try{
    r=await fetch(LIB_URL,{headers:{Authorization:"Bearer "+t}});
  }catch(e){
    tokSay("no","lichess could not be reached. That is a connection problem, not a verdict on the token; nothing was saved. Try again when you are online.");
    return;
  }
  if(r.status===401||r.status===403){
    tokSay("no","lichess rejected the token ("+r.status+"). It was not saved. Check it was copied whole, then try again.");
    return;
  }
  if(!r.ok){
    tokSay("no","The database answered with status "+r.status+", which is neither success nor a rejection. The token was not saved.");
    return;
  }
  try{await r.json();}catch(e){
    tokSay("no","lichess answered, but not with data this app can read. The token was not saved.");
    return;
  }
  libToken=t;
  try{await STORE.set(TOK_KEY,t);}catch(e){}
  tokSay("ok","Token accepted. The masters database panel is now available on the Study screen.");
};
el("tokClear").onclick=async()=>{
  libToken=null;el("tokIn").value="";
  try{await STORE.set(TOK_KEY,"");}catch(e){}
  tokSay("neutral","Token cleared. The trainer is fully offline again.");
};
async function load(){
  // v6 first; else adopt a v5 or v4 blob verbatim - a v5 record is a valid v6 record
  // without the optional "a" answer log, a v4 record is one without either log, and
  // keys never changed shape - so both migrations are adoption plus an immediate
  // rewrite under the v6 key. Nothing is dropped and nothing is remapped. Settings an
  // old blob lacks default to on in cleanStats(), not off, so omission disables
  // nothing.
  let raw=null,fromOld=false;
  try{
    let r=await STORE.get("colle-hippo:v6");
    for(const old of ["colle-hippo:v5","colle-hippo:v4"]){
      if(r&&r.value)break;
      r=await STORE.get(old);fromOld=!!(r&&r.value);
    }
    if(r&&r.value)raw=r.value;
  }catch(e){}
  if(raw!==null){
    /* Loading is lenient where importing is strict, and deliberately so. An import
       is a blob the user chose to paste, so refusing the whole thing costs them
       nothing. Storage is usually the only copy of their progress, so refusing the
       whole thing DESTROYS it: the next save() writes the empty set straight over
       it, silently and for good. Clean per record instead - sanRec() clamps a
       record that is merely wrong, and a negative ms is not hypothetical, since
       elapsed() is Date.now()-S.t0 and a backwards clock step between armClock()
       and the answer produces one - and drop only the entries that are not records
       at all. A blob with no usable pos object is the one thing refused outright,
       and then nothing is written over it either. */
    let d=null;
    try{d=JSON.parse(raw);}catch(e){d=null;}
    if(d&&typeof d==="object"&&d.pos&&typeof d.pos==="object"&&!Array.isArray(d.pos)){
      stats=cleanStats(d);
      S.theme=stats.theme;S.set=stats.set;S.bookOnly=stats.bookOnly;S.freqW=stats.freqW;setBand(stats.band);S.recog=stats.recog;S.lvW=stats.lvW;S.arrowsOn=stats.arrows;
      if(stats.day!==new Date().toDateString()){stats.day=new Date().toDateString();stats.today=0;}
      if(fromOld)save();
    }else{
      // Something is stored and it cannot be read. Overwriting it is the one
      // irreversible thing this app can do, so it holds off until the user says
      // otherwise: Import and Reset both release the hold, and the menu says so.
      SAVE_HELD=true;
    }
  }
  // Read the stored lichess token back. A local read only - the token is never
  // tested or sent anywhere at load, so a token-less start makes no network calls
  // and a stored token still costs nothing until the panel is actually opened.
  try{
    const t=await STORE.get(TOK_KEY);
    if(t&&t.value){libToken=t.value;el("tokIn").value=libToken;
      tokSay("neutral","A token is stored. The masters database panel is available on the Study screen.");}
  }catch(e){}
  // Startup must reach go("menu") whatever happened above. Anything that throws on
  // the way there leaves a blank page, so it is reported through the crash bar and
  // the menu is drawn anyway.
  try{
    applyTheme();syncOpts();
    document.querySelectorAll(".ico[data-pc]").forEach(n=>n.appendChild(pieceEl2(n.dataset.pc,"")));
    bindPointer();
  }catch(e){crash((e&&e.message)||"startup failed");}
  try{go("menu");}catch(e){crash((e&&e.message)||"startup failed");}
}

load();
