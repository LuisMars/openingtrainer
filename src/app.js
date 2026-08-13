/* ================= state ================= */
const S={screen:"menu",mode:"study",li:0,ply:0,flip:false,ghost:false,
  sel:null,timer:null,tries:0,hint:0,lastKey:null,theme:0,
  run:0,bestRun:0,today:0,t0:0,lastMs:0,set:0,bookOnly:false,free:[],fpos:null,pending:0,drag:null,tapDown:null,pz:0,cursor:null,
  arrow:null,passKeys:null};
let stats={pos:{},best:{},pz:{},day:"",today:0,bestRun:0,theme:0};
const THEMES=[
  ["Brown","#f0d9b5","#b58863","#f6f1e6","#12161b","#12161b","#ded5bd"],
  ["Blue","#dee3e6","#8ca2ad","#f8f6f0","#14181d","#14181d","#dfe4e8"],
  ["Green","#ebecd0","#779556","#f7f6ec","#12161b","#12161b","#e3e6cd"],
  ["Slate","#e4dabc","#48645f","#f6f1e6","#12161b","#12161b","#ded5bd"]
];
const SETS=[["Standard","0 0 45 45",()=>CB,false],["Engraved","0 0 100 100",()=>PIECE,true]];
function pieceEl2(ch,cls){
  const set=SETS[S.set||0],svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox",set[1]);
  svg.setAttribute("class",cls+(set[3]?" custom":""));
  const map=set[2]();
  svg.innerHTML=set[3]?map[ch.toLowerCase()]:map[ch];
  return svg;
}
const el=id=>document.getElementById(id);
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
  clearTimeout(S.pending);S.pending=0;
  S.mode="puzzle";S.pz=((i%PZ.length)+PZ.length)%PZ.length;makePz(S.pz);
  S.ply=0;S.sel=null;S.tries=0;S.hint=0;S.arrow=null;clearFree();
  S.flip=PZLINE.you==="b";syncOpts();
  el("nMsg").textContent="";go("board");armClock();
}
function armPz(ms){
  clearTimeout(S.pending);
  const bar=el("progBar");
  bar.style.transition="none";bar.style.width="100%";void bar.offsetWidth;
  bar.style.transition="width "+ms+"ms linear";bar.style.width="0%";
  S.pending=setTimeout(()=>{S.pending=0;startPuzzle(S.pz+1);},ms);
}
const L=()=>(S.mode==="puzzle"&&PZLINE)?PZLINE:LINES[S.li];
const yourTurn=()=>(nowPos().w?"w":"b")===L().you;
const HOUR=36e5, LADDER=[0,4,24,72,168,336];
const CHAPTERS=["Colle as White","Hippopotamus as Black"];
LINES.sort((a,b)=>CHAPTERS.indexOf(a.ch)-CHAPTERS.indexOf(b.ch));

function boardAt(l,n){let b=fenBoard(l.start);for(let i=0;i<n;i++)b=apply(b,l.moves[i][0]);return b;}
function posAt(l,n){
  let p=l.start===START?startPos():fenPos(l.start.indexOf(" ")>0?l.start:l.start+" w - -");
  for(let i=0;i<n;i++){const m=findMove(p,l.moves[i][0]);if(!m)break;p=make(p,m);}
  return p;
}
function nowPos(){return S.free.length?S.fpos:posAt(L(),S.ply);}
function clearFree(){S.free=[];S.fpos=null;const o=el("offbook");if(o)o.classList.remove("on");}
function drillPlies(l){const a=[];for(let p=0;p<l.moves.length;p++)if((p%2===0?"w":"b")===l.you)a.push(p);return a;}
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
const NO_SHUFFLE=new Set(["trap","soltis-trap","syn-hipdown"]);
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
const KEYCACHE={},ALT={};
(function(){
  LINES.forEach((l,li)=>{
    if(l.id==="pz")return;
    for(const p of drillPlies(l)){
      const f=keyFen(posAt(l,p));
      KEYCACHE[l.id+":"+p]=f+":"+l.moves[p][0];
      if(!NO_SHUFFLE.has(l.id))(ALT[f]=ALT[f]||[]).push([li,p,l.moves[p][0].slice(0,4)]);
    }
  });
})();
function altAt(pos,uci){const a=ALT[keyFen(pos)];return a?a.find(x=>x[2]===uci):null;}
function key(l,p){return l.id.indexOf("pz:")===0?l.id+":"+p:(KEYCACHE[l.id+":"+p]||l.id+":"+p);}
function rec(k){return stats.pos[k];}
const SLOW=7000;
function quick(r){return r&&r.ms&&r.ms<SLOW;}
function state(k){
  const r=rec(k);
  if(!r||r.ok+r.no===0)return "new";
  const step=Math.min(r.streak,LADDER.length-1);
  const hrs=LADDER[step]*(quick(r)?1:.4);
  if(Date.now()>=r.last+hrs*HOUR)return "due";
  return (r.streak>=2&&quick(r))?"solid":"learning";
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
  for(const l of LINES){if(l.id==="pz")continue;for(const p of drillPlies(l)){
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
  S.screen=scr;stop();
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
el("cShuffle").onclick=()=>{S.mode="shuffle";S.arrow=null;shuffle(true);go("board");};
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
}
function renderLines(){
  const c=el("lineList");c.innerHTML="";let ch=null;
  LINES.forEach((l,i)=>{
    if(l.id==="pz")return;
    if(l.ch!==ch){ch=l.ch;const h=document.createElement("div");h.className="chapter";h.textContent=ch;c.appendChild(h);}
    const s=lineScore(l),pct=s.n?s.solid/s.n*100:0;
    const b=document.createElement("button");
    b.className="lbtn"+(pct===100?" done":"");
    b.innerHTML='<span class="nm">'+l.name+'</span><span class="meta">'+
      '<span class="pbar"><i style="width:'+pct+'%"></i></span>'+
      "<span>"+s.solid+"/"+s.n+" solid</span><span class='kind' style='margin-left:auto'>"+KIND[l.id]+"</span></span>";
    b.onclick=()=>{S.li=i;startLine();};
    c.appendChild(b);
  });
}
function startLine(){
  S.ply=0;S.sel=null;S.tries=0;S.hint=0;S.arrow=null;S.passKeys=new Set();clearFree();
  S.flip=L().you==="b";syncOpts();
  el("nMsg").textContent="";go("board");armClock();
  if(S.mode==="line"&&!yourTurn())setTimeout(autoReply,300);
}

/* ---------- production guards ---------- */
function crash(msg){
  const c=el("crash");if(!c)return;
  c.classList.add("on");
  c.innerHTML="<span>Something went wrong: "+String(msg).slice(0,140)+
    ". Your progress is saved; reloading is safe.</span>";
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
  const c=el("pRows");c.innerHTML="";let ch=null;
  for(const l of LINES){
    if(l.id==="pz")continue;
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
    if(l.id==="pz")continue;
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
    b.innerHTML="<span>"+x.name+" \u00b7 move "+(Math.floor(x.ply/2)+1)+"</span><em>"+
      x.r.no+" miss"+(x.r.no>1?"es":"")+(x.r.ms?" \u00b7 "+fmtMs(x.r.ms):"")+"</em>";
    b.onclick=()=>{S.mode="study";S.li=x.li;S.ply=x.ply;S.sel=null;S.hint=0;
      S.flip=LINES[x.li].you==="b";syncOpts();go("board");};
    c.appendChild(b);
  }
}
el("pExport").onclick=()=>{
  // v:4 stamps the payload with the stats shape it was written in. Storage keys are
  // versioned so a later format change can be told apart from the current one; backups
  // made before this stamp existed carry no "v" at all but are still v4-shaped
  // (fen-keyed) data, so validateImport() below treats those as valid rather than
  // rejecting every backup a user already has.
  el("pData").value=JSON.stringify(Object.assign({v:4},stats));
  el("pData").select();
};
// A v4 key is either "pz:<id>:<ply>" or a fenOf()-derived string, which always
// contains "/" (the FEN board-row separator). A v3 key was "<line id>:<ply>"
// (e.g. "cz:5") and never contains either. Used to tell an unstamped-but-genuine
// v4 backup (exported before the "v" marker existed) apart from a real v3 backup:
// no code to remap v3 keys to v4 was ever written for that format bump, so this
// shape check is what stands in for a real migration.
function looksV4Key(k){return k.indexOf("pz:")===0||k.indexOf("/")>=0;}
// Import is a trust boundary: validate the whole shape before anything touches
// `stats`, and never partially assign it. Returns null when valid, else a short
// reason string used to pick the message shown to the user.
function validateImport(d){
  if(!d||typeof d!=="object"||!d.pos||typeof d.pos!=="object")return "shape";
  const keys=Object.keys(d.pos);
  if(d.v!==undefined&&d.v!==4)return "version";
  if(d.v===undefined&&keys.length&&!keys.every(looksV4Key))return "version";
  for(const k of keys){
    const r=d.pos[k];
    if(!r||typeof r!=="object"||typeof r.ok!=="number"||typeof r.no!=="number")return "shape";
  }
  return null;
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
  stats={pos:d.pos,
    best:(d.best&&typeof d.best==="object")?d.best:{},
    pz:(d.pz&&typeof d.pz==="object")?d.pz:{},
    day:typeof d.day==="string"?d.day:"",
    today:typeof d.today==="number"?d.today:0,
    bestRun:typeof d.bestRun==="number"?d.bestRun:0,
    theme:typeof d.theme==="number"?d.theme:0,
    set:typeof d.set==="number"?d.set:0,
    bookOnly:!!d.bookOnly};
  S.theme=stats.theme;S.set=stats.set;S.bookOnly=stats.bookOnly;
  applyTheme();syncOpts(); // apply immediately; do not make the user reload to see it
  save();renderProgress();el("pData").value="Imported.";
};
let resetArmed=false;
el("pReset").onclick=function(){
  if(!resetArmed){resetArmed=true;this.textContent="Tap again to erase everything";return;}
  stats={pos:{},best:{},pz:{},day:"",today:0,bestRun:0,theme:S.theme,set:S.set};S.run=0;save();resetArmed=false;this.textContent="Reset all progress";renderProgress();
};

/* ================= board rendering ================= */
function render(anim){
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
  drawArrow(S.arrow);
  renderTray(b,l);
  renderOff();
  renderCtl();
  renderNote();
  renderSheet();
  renderSess();
  const bar=el("progBar");
  if(!S.pending){bar.style.transition="width .25s";bar.style.width=(S.ply/l.moves.length*100)+"%";}
}
function renderOff(){
  const o=el("offbook");
  if(!S.free.length){o.classList.remove("on");o.innerHTML="";return;}
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
  const g=pieceEl2(pc,"pc drag"+(SETS[S.set][3]?" "+(isW(pc)?"w":"b"):""));
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
  clearTimeout(S.pending);
  const bar=el("progBar");
  bar.style.transition="none";bar.style.width="100%";
  void bar.offsetWidth;
  bar.style.transition="width "+ms+"ms linear";bar.style.width="0%";
  S.pending=setTimeout(()=>{S.pending=0;S.arrow=null;shuffle(false);},ms);
  // good() calls render(true) BEFORE arming the wait, so renderCtl() built the
  // Hint/Skip buttons while S.pending was still falsy - refresh them now that it
  // is set, or they stay live (targeting the opponent's ply) for the whole wait
  // (finding 6).
  if(S.mode==="shuffle")renderCtl();
}
function skipNext(){
  if(!S.pending)return false;
  clearTimeout(S.pending);S.pending=0;S.arrow=null;shuffle(false);return true;
}
// No timer here on purpose — armWait just marks S.pending so a tap
// (via skipNext) advances immediately; the position stays on screen until read.
function armWait(){
  clearTimeout(S.pending);
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
  // still on screen unless rebuilt here.
  if(S.mode==="shuffle")renderCtl();
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
function drawArrow(u){
  const svg=el("arrows");
  [...svg.querySelectorAll("line")].forEach(n=>n.remove());
  if(!u)return;
  const pt=s=>{let f=F.indexOf(s[0]),r=8-parseInt(s[1],10);if(S.flip){f=7-f;r=7-r;}return[f+.5,r+.5];};
  const a=pt(u.slice(0,2)),c=pt(u.slice(2,4));
  const ln=document.createElementNS("http://www.w3.org/2000/svg","line");
  ln.setAttribute("x1",a[0]);ln.setAttribute("y1",a[1]);
  ln.setAttribute("x2",c[0]);ln.setAttribute("y2",c[1]);
  ln.setAttribute("stroke","rgba(224,161,60,.8)");ln.setAttribute("stroke-width",".14");
  ln.setAttribute("marker-end","url(#ah)");
  svg.appendChild(ln);
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
    const pl=add(S.timer?"&#9208;":"&#9654;&#9654;",toggleplay);
    add("&#9654;",()=>{if(S.ply<L().moves.length)S.ply++;clearFree();render(true);},"",S.ply>=L().moves.length);
    add("&#9654;&#124;",()=>{S.ply=L().moves.length;clearFree();stop();render(false);},"",S.ply>=L().moves.length);
    void pl;
  }else if(S.mode==="line"||S.mode==="puzzle"){
    const done=S.ply>=L().moves.length;
    // Back one intentionally does NOT reset S.passKeys: replaying forward from here
    // through positions already graded this pass must fall back to touch() (finding 12),
    // not grade again. S.arrow is cleared because the position on screen is changing.
    add("Back one",()=>{S.ply=Math.max(0,S.ply-2);S.sel=null;S.tries=0;S.hint=0;S.arrow=null;render(false);},"wide",S.ply===0);
    if(done&&S.mode==="line")add("Next line &#8594;",()=>{S.li=(S.li+1)%LINES.length;startLine();},"wide");
    else if(!done)add(hintLabel(),hint,"wide",false);
    add("Restart",()=>{S.ply=0;S.sel=null;S.tries=0;S.hint=0;S.arrow=null;S.passKeys=new Set();render(false);if(!yourTurn())setTimeout(autoReply,250);},"wide");
    if(done&&S.mode==="puzzle")add("Next puzzle &#8594;",()=>startPuzzle(S.pz+1),"wide");
  }else if(S.pending){
    // Waiting for a tap after a correct answer: S.ply already points past your
    // move, at the opponent's reply, so Hint/Skip must not be live here — Hint
    // would target and reveal the opponent's move instead of yours (finding 6).
    add("Continue",()=>{skipNext();},"wide");
  }else{
    add(hintLabel(),hint,"wide",false);
    add("Skip &#8594;",()=>{S.arrow=null;shuffle(false);},"wide");
  }
}
function toggleplay(){
  if(S.timer){stop();render(false);return;}
  if(S.ply>=L().moves.length)S.ply=0;
  S.timer=setInterval(()=>{
    if(S.ply>=L().moves.length){stop();render(false);return;}
    S.ply++;render(true);
  },1150);
  render(false);
}
function stop(){if(S.timer){clearInterval(S.timer);S.timer=null;}}
function openingName(){
  const per=typeof NAMES!=="undefined"&&NAMES[L().id];
  if(!per)return "";
  let best="";
  for(const k in per)if(+k<=S.ply)best=per[k];
  return best;
}
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
    el("nSrc").textContent=l.ch;
    el("nMove").textContent=(l.you==="w"?"White":"Black")+" to play";
    const played=S.ply>0?"They just played "+m[S.ply-1][1]+". ":"";
    el("nText").textContent=played+((S.tries||S.hint)?l.name+" \u00b7 "+l.src:"Find the repertoire move.");
    return;
  }
  el("nSrc").innerHTML=(SRC[l.id]?'<a href="'+SRC[l.id]+'" target="_blank" rel="noopener">'+l.src+"</a>":l.src)+
    (KIND[l.id]?'<br><span class="kind">'+KIND[l.id]+"</span>":"")+
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
const libCache={};
let libInFlight=null; // {moves, promise} - dedupes a repeat request for the same position
function currentMoves(){return L().moves.slice(0,S.ply).map(m=>m[0]).join(",");}
async function loadLib(){
  const l=L(),moves=currentMoves();
  const box=el("lib");
  if(l.start!==START){box.innerHTML="This position is a diagram, not a game score, so the database cannot look it up.";return;}
  if(libCache[moves]){paintLib(libCache[moves]);return;}
  box.innerHTML="Asking the masters database...";
  // This is the app's only online part, and the only fetch on the page - a step
  // forward/back while a request is still in flight must not let a slow reply for
  // the old position paint over the position now on screen (finding 11). Reuse
  // one in-flight promise per moves-key rather than firing a duplicate request,
  // and re-check the current position after the await before painting anything.
  const inflight=(libInFlight&&libInFlight.moves===moves)?libInFlight.promise:null;
  const p=inflight||fetch("https://explorer.lichess.ovh/masters?moves=5&topGames=0&play="+moves)
    .then(r=>{if(!r.ok)throw 0;return r.json();});
  if(!inflight)libInFlight={moves:moves,promise:p};
  try{
    const d=await p;
    libCache[moves]=d;
    if(currentMoves()===moves&&L().start===START)paintLib(d);
  }catch(e){
    if(currentMoves()===moves&&L().start===START)
      box.innerHTML="Database unreachable. It needs a connection to lichess.org; everything else here works offline.";
  }finally{
    if(libInFlight&&libInFlight.moves===moves)libInFlight=null;
  }
}
function paintLib(d){
  const box=el("lib"),tot=d.white+d.draws+d.black;
  if(!tot){box.innerHTML="No master games have reached this position. You are already off the map, which is not always bad.";return;}
  const next=S.ply<L().moves.length?L().moves[S.ply][0]:null;
  const pc=n=>Math.round(n/tot*100);
  let h='<div class="hd"><span>'+tot.toLocaleString()+" master games</span><span>"+
    (d.opening?d.opening.eco+" "+d.opening.name:"")+'</span></div><div class="wdl">'+
    '<i style="width:'+pc(d.white)+'%;background:#e8e2d2"></i>'+
    '<i style="width:'+pc(d.draws)+'%;background:#6b7c8c"></i>'+
    '<i style="width:'+pc(d.black)+'%;background:#1b232d"></i></div>';
  const max=Math.max(...d.moves.map(m=>m.white+m.draws+m.black),1);
  for(const m of d.moves){
    const n=m.white+m.draws+m.black,ours=next&&m.uci===next.slice(0,4);
    h+='<div class="lrow'+(ours?" ours":"")+'"><b>'+m.san+'</b><span class="bar"><i style="width:'+
      Math.round(n/max*100)+'%"></i></span><em>'+(n>=1000?Math.round(n/1000)+"k":n)+"</em></div>";
  }
  if(next&&!d.moves.some(m=>m.uci===next.slice(0,4)))
    h+='<div class="lrow ours"><b>'+L().moves[S.ply][1]+"</b><span>rare or unplayed at master level</span></div>";
  box.innerHTML=h;
}
el("libBox").addEventListener("toggle",function(){if(this.open)loadLib();});
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
  lb.style.display=S.mode==="study"&&L().start===START?"":"none";
  if(lb.open&&S.mode==="study")loadLib();
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
function tap(name){
  if(skipNext())return;
  const pos=nowPos(),study=S.mode==="study";
  if(!study&&(!yourTurn()||S.ply>=L().moves.length))return;
  const pc=pos.b[ix(name)],mine=pc&&(isW(pc)===pos.w);
  if(!S.sel){if(mine){S.sel=name;render(false);}return;}
  if(S.sel===name){S.sel=null;render(false);return;}
  if(mine){S.sel=name;render(false);return;}
  const m=legal(pos).find(x=>sq(x.f)===S.sel&&sq(x.t)===name&&(!x.p||x.p==="q"));
  const wanted=S.ply<L().moves.length?L().moves[S.ply][0].slice(0,4):null;
  if(!m){
    S.sel=null;render(false);
    el("nMsg").innerHTML='<span class="neutral">Not a legal move; nothing counted.</span>';
    return;
  }
  if(study){
    if(!S.free.length&&wanted===S.sel+name){S.sel=null;S.ply++;render(true);return;}
    const t=san(pos,m);
    S.free.push({uci:uciOf(m),san:t});S.fpos=make(pos,m);S.sel=null;render(true);
    el("nMsg").innerHTML='<span class="neutral">'+t+". Off the line.</span>";
    return;
  }
  if(S.sel+name===wanted){good();return;}
  if(S.mode==="shuffle"){
    const alt=altAt(pos,S.sel+name);
    // bookExcluded mirrors shuffle()'s own candidate filter (app.js, S.bookOnly check):
    // an alt from a line drill-book-only mode was told to exclude must not be credited,
    // or S.li ends up pointing at exactly the kind of line the mode hides.
    if(alt&&!bookExcluded(LINES[alt[0]])){
      S.li=alt[0];S.ply=alt[1];
      // The board just answered must not be served straight back: shuffle() only
      // zeroed S.lastKey's own exact key, but the alt reply is graded under a
      // different key (same board, different expected move) - update it here too.
      S.lastKey=key(LINES[alt[0]],alt[1]);
      good();return;
    }
  }
  offBook(name,san(pos,m));
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
function grade(k,right,ms){
  if(k.indexOf("pz:")===0)return;
  const r=stats.pos[k]||{ok:0,no:0,streak:0,last:0,ms:0};
  if(right){r.ok++;r.streak++;}else{r.no++;r.streak=0;}
  if(ms)r.ms=r.ms?Math.round(r.ms*.6+ms*.4):ms;
  r.last=Date.now();stats.pos[k]=r;save();
}
// Drill's Back one/Restart replay positions already graded this pass. A second
// grade() for the same key lets streak/"solid" be farmed and pushes r.last to
// now, postponing the shared record's next review across every other line that
// keys onto it. S.passKeys tracks what has already been graded since the line
// was (re)started; a repeat within the same pass falls back to touch(), which
// still keeps the timing average honest without moving streak/last.
function gradeOncePerPass(k,right,ms){
  if(S.mode==="line"){
    S.passKeys=S.passKeys||new Set();
    if(S.passKeys.has(k)){touch(k,ms);return;}
    S.passKeys.add(k);
  }
  grade(k,right,ms);
}
function elapsed(){return S.t0?Date.now()-S.t0:0;}
function armClock(){S.t0=Date.now();}
function fmtMs(m){return m>=10000?Math.round(m/1000)+"s":(m/1000).toFixed(1)+"s";}
function good(){
  const clean=S.hint===0&&S.tries===0,hadMiss=S.tries>0;
  const ms=elapsed();S.lastMs=ms;
  S.arrow=null; // the position is being answered now, so any reveal arrow is done
  if(clean)gradeOncePerPass(key(L(),S.ply),true,ms);
  else if(S.hint<3)touch(key(L(),S.ply),ms);
  if(S.mode!=="study"){
    if(clean){S.run++;if(S.run>(stats.bestRun||0))stats.bestRun=S.run;}else S.run=0;
    bumpToday();
  }
  const san=L().moves[S.ply][1];
  const to=L().moves[S.ply][0].slice(2,4);
  S.sel=null;S.ply++;S.tries=0;S.hint=0;
  render(true);flash(to,"good");
  el("nMsg").innerHTML='<span class="ok hit">✓ Correct</span> <span class="ok">— '+san+(clean?"":" (with help)")+(ms?",":".")+"</span>"+
    (ms?' <span class="neutral">'+fmtMs(ms)+(clean&&ms>SLOW?", slow: it will come back sooner":"")+".</span>":"");
  if(S.mode==="line"||S.mode==="puzzle"){
    // stats.best is keyed by l.id; for puzzle mode that id is "pz:<id>", so without
    // this guard every puzzle solve grows stats.best with puzzle ids nothing reads.
    if(S.mode==="line"){
      const b=stats.best[L().id]||0;
      if(S.ply>b){stats.best[L().id]=S.ply;save();}
    }
    if(S.ply>=L().moves.length){
      if(S.mode==="puzzle"){
        const r=pzRec();if(r){r.ok++;if(ms)r.ms=ms;save();}
        armPz(1500);
        el("nMsg").innerHTML='<span class="ok">Solved'+(clean?", clean":"")+". "+fmtMs(ms)+"</span>";}
      else el("nMsg").innerHTML='<span class="ok">Line complete.</span>';
      return;}
    setTimeout(autoReply,260);
  }else{
    const note=L().moves[S.ply-1][2];
    el("nText").textContent=note||L().name;
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
function offBook(name,t){
  if(S.tries===0&&S.hint<3)gradeOncePerPass(key(L(),S.ply),false);
  if(S.mode==="puzzle"&&S.tries===0){const r=pzRec();if(r){r.no++;save();}}
  if(S.tries===0){S.run=0;bumpToday();}
  S.tries++;S.sel=null;
  render(false);flash(name,"bad");
  el("nMsg").innerHTML='<span class="no">'+t+(S.mode==="puzzle"
      ?" is legal, but the tactic needs something else.</span>"
      :" is legal, but it is not the repertoire move.</span>");
}
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
    "d6":"Third rank, not fourth. Nothing there can be attacked profitably.",
    "e6":"Third rank, not fourth. Nothing there can be attacked profitably.",
    "a6":"Take b5 away from their pieces for good.",
    "h6":"Take g5 away from their pieces for good.",
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
  while(S.ply<L().moves.length&&!yourTurn())S.ply++;
  render(true);armClock();
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
  clearTimeout(S.pending);S.pending=0;
  // Deliberately-losing lines: fine in Study/Drill where the framing is visible, but
  const cand=[];
  for(let i=0;i<LINES.length;i++){
    const l=LINES[i];
    if(l.id==="pz"||NO_SHUFFLE.has(l.id))continue;
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
    if(x.k===S.lastKey)wt=0;
    pool.push([x.i,x.p,x.k,wt]);
  }
  const sum=pool.reduce((a,x)=>a+x[3],0);
  let t=Math.random()*sum,pick=pool[0];
  for(const x of pool){t-=x[3];if(t<=0){pick=x;break;}}
  S.li=pick[0];S.ply=pick[1];S.lastKey=pick[2];clearFree();
  S.sel=null;S.tries=0;S.hint=0;S.flip=LINES[pick[0]].you==="b";
  syncOpts();
  if(!first)render(false);
  armClock();
  const t2=totals();
  el("nMsg").innerHTML='<span class="neutral">'+t2.solid+" of "+t2.all+" positions solid.</span>";
}

/* ================= options sheet ================= */
function applyTheme(){
  const t=THEMES[S.theme],r=document.documentElement.style;
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
  el("oThemeS").textContent=THEMES[S.theme][0];
  el("oSetS").textContent=SETS[S.set][0];
  el("oBookS").textContent=S.bookOnly?"on":"off";
  el("oBook").setAttribute("aria-pressed",S.bookOnly);
  el("oRestart").style.display=S.mode==="shuffle"?"none":"";
}
el("oFlip").onclick=()=>{S.flip=!S.flip;syncOpts();render(false);};
el("oGhost").onclick=()=>{S.ghost=!S.ghost;syncOpts();render(false);};
el("oTheme").onclick=()=>{S.theme=(S.theme+1)%THEMES.length;stats.theme=S.theme;save();applyTheme();syncOpts();};
el("oSet").onclick=()=>{S.set=(S.set+1)%SETS.length;stats.set=S.set;save();syncOpts();
  document.querySelectorAll(".ico[data-pc]").forEach(n=>{n.innerHTML="";n.appendChild(pieceEl2(n.dataset.pc,""));});
  if(S.screen==="board")render(false);};
el("oBook").onclick=()=>{S.bookOnly=!S.bookOnly;stats.bookOnly=S.bookOnly;save();syncOpts();};
el("oRestart").onclick=()=>{openOpts(false);S.ply=0;S.sel=null;S.tries=0;S.hint=0;S.arrow=null;S.passKeys=new Set();render(false);
  if(S.mode==="line"&&!yourTurn())setTimeout(autoReply,250);};
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
    return {set:(k,v)=>Promise.resolve(MEM[k]=v),
            get:k=>Promise.resolve({value:MEM[k]||null})};
  }
})();
async function save(){try{await STORE.set("colle-hippo:v4",JSON.stringify(stats));}catch(e){}}
async function load(){
  try{
    const r=await STORE.get("colle-hippo:v4");
    if(r&&r.value){const d=JSON.parse(r.value);
      stats={pos:d.pos||{},best:d.best||{},pz:d.pz||{},day:d.day||"",today:d.today||0,bestRun:d.bestRun||0,
        theme:d.theme||0,set:d.set||0,bookOnly:!!d.bookOnly};
      S.theme=stats.theme||0;S.set=stats.set||0;S.bookOnly=!!stats.bookOnly;
      if(stats.day!==new Date().toDateString()){stats.day=new Date().toDateString();stats.today=0;}
    }
  }catch(e){stats={pos:{},best:{},pz:{},day:"",today:0,bestRun:0,theme:0};}
  applyTheme();syncOpts();
  document.querySelectorAll(".ico[data-pc]").forEach(n=>n.appendChild(pieceEl2(n.dataset.pc,"")));
  bindPointer();
  go("menu");
}

load();
