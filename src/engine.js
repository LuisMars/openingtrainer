/* ===== legal move engine: 0 = a8 ... 63 = h1 ===== */
const DIRS={n:[-17,-15,-10,-6,6,10,15,17],b:[-9,-7,7,9],r:[-8,-1,1,8],q:[-9,-8,-7,-1,1,7,8,9],k:[-9,-8,-7,-1,1,7,8,9]};
const file=i=>i%8, rank=i=>Math.floor(i/8);
function onBoard(from,to){
  if(to<0||to>63)return false;
  const df=Math.abs(file(to)-file(from));
  return df<=2;
}
function startPos(){return {b:fenBoard(START),w:true,cr:"KQkq",ep:-1};}
function fenPos(fen){
  const p=fen.split(" ");
  return {b:fenBoard(fen),w:(p[1]||"w")==="w",cr:p[2]&&p[2]!=="-"?p[2]:"",
    ep:p[3]&&p[3]!=="-"?ix(p[3]):-1};
}
function clonePos(p){return {b:p.b.slice(),w:p.w,cr:p.cr,ep:p.ep};}
function isW(c){return c===c.toUpperCase();}

function attacked(b,sqi,byWhite){
  // pawns
  const pd=byWhite?[9,7]:[-9,-7];      // from target back to attacker square
  for(const d of pd){
    const j=sqi+d;
    if(j<0||j>63)continue;
    if(Math.abs(file(j)-file(sqi))!==1)continue;
    const pc=b[j];
    if(pc&&(byWhite?pc==="P":pc==="p"))return true;
  }
  for(const d of DIRS.n){
    const j=sqi+d;
    if(j<0||j>63)continue;
    const dd=Math.abs(file(j)-file(sqi));
    if(dd>2||dd===0)continue;
    const pc=b[j];
    if(pc&&(byWhite?pc==="N":pc==="n"))return true;
  }
  for(const d of DIRS.k){
    const j=sqi+d;
    if(j<0||j>63)continue;
    if(Math.abs(file(j)-file(sqi))>1)continue;
    const pc=b[j];
    if(pc&&(byWhite?pc==="K":pc==="k"))return true;
  }
  const rays=[[DIRS.r,"rq"],[DIRS.b,"bq"]];
  for(const [dirs,set] of rays){
    for(const d of dirs){
      let j=sqi,prev=sqi;
      while(true){
        j+=d;
        if(j<0||j>63)break;
        if(Math.abs(file(j)-file(prev))>1)break;
        const pc=b[j];
        if(pc){
          const low=pc.toLowerCase();
          if(isW(pc)===byWhite&&set.includes(low))return true;
          break;
        }
        prev=j;
      }
    }
  }
  return false;
}
function kingIdx(b,white){
  const k=white?"K":"k";
  for(let i=0;i<64;i++)if(b[i]===k)return i;
  return -1;
}
function inCheck(p){return attacked(p.b,kingIdx(p.b,p.w),!p.w);}

function pseudo(p){
  const out=[],b=p.b,w=p.w;
  for(let i=0;i<64;i++){
    const pc=b[i];
    if(!pc||isW(pc)!==w)continue;
    const t=pc.toLowerCase();
    if(t==="p"){
      const dir=w?-8:8, one=i+dir;
      const last=w?0:7;
      if(one>=0&&one<64&&!b[one]){
        if(rank(one)===last)for(const q of "qrbn")out.push({f:i,t:one,p:q});
        else out.push({f:i,t:one});
        const two=i+dir*2;
        if(rank(i)===(w?6:1)&&!b[two])out.push({f:i,t:two,dbl:1});
      }
      for(const d of [dir-1,dir+1]){
        const j=i+d;
        if(j<0||j>63||Math.abs(file(j)-file(i))!==1)continue;
        if(b[j]&&isW(b[j])!==w){
          if(rank(j)===last)for(const q of "qrbn")out.push({f:i,t:j,p:q});
          else out.push({f:i,t:j});
        }else if(j===p.ep&&!b[j])out.push({f:i,t:j,ep:1});
      }
    }else if(t==="n"||t==="k"){
      for(const d of DIRS[t]){
        const j=i+d;
        if(j<0||j>63)continue;
        const dd=Math.abs(file(j)-file(i));
        if(t==="n"){if(dd>2||dd===0)continue;}else if(dd>1)continue;
        if(b[j]&&isW(b[j])===w)continue;
        out.push({f:i,t:j});
      }
      if(t==="k"){
        const home=w?60:4;
        if(i===home&&!attacked(b,i,!w)){
          const K=w?"K":"k",Q=w?"Q":"q";
          if(p.cr.includes(K)&&!b[i+1]&&!b[i+2]&&b[i+3]===(w?"R":"r")
            &&!attacked(b,i+1,!w)&&!attacked(b,i+2,!w))out.push({f:i,t:i+2,c:"k"});
          if(p.cr.includes(Q)&&!b[i-1]&&!b[i-2]&&!b[i-3]&&b[i-4]===(w?"R":"r")
            &&!attacked(b,i-1,!w)&&!attacked(b,i-2,!w))out.push({f:i,t:i-2,c:"q"});
        }
      }
    }else{
      for(const d of DIRS[t]){
        let j=i,prev=i;
        while(true){
          j+=d;
          if(j<0||j>63)break;
          if(Math.abs(file(j)-file(prev))>1)break;
          if(b[j]){if(isW(b[j])!==w)out.push({f:i,t:j});break;}
          out.push({f:i,t:j});
          prev=j;
        }
      }
    }
  }
  return out;
}
function make(p,m){
  const n=clonePos(p),b=n.b,pc=b[m.f],w=isW(pc);
  b[m.f]="";
  if(m.ep)b[m.t+(w?8:-8)]="";
  b[m.t]=m.p?(w?m.p.toUpperCase():m.p):pc;
  if(m.c==="k"){b[m.t+1]="";b[m.t-1]=w?"R":"r";}
  if(m.c==="q"){b[m.t-2]="";b[m.t+1]=w?"R":"r";}
  let cr=n.cr;
  const drop=s=>{for(const ch of s)cr=cr.replace(ch,"");};
  if(pc==="K")drop("KQ");
  if(pc==="k")drop("kq");
  if(m.f===63||m.t===63)drop("K");
  if(m.f===56||m.t===56)drop("Q");
  if(m.f===7||m.t===7)drop("k");
  if(m.f===0||m.t===0)drop("q");
  n.cr=cr;
  n.ep=m.dbl?(m.f+(w?-8:8)):-1;
  n.w=!n.w;
  return n;
}
function legal(p){
  const out=[];
  for(const m of pseudo(p)){
    const n=make(p,m);
    if(!attacked(n.b,kingIdx(n.b,p.w),!p.w))out.push(m);
  }
  return out;
}
function uciOf(m){return sq(m.f)+sq(m.t)+(m.p||"");}
function findMove(p,uci){
  return legal(p).find(m=>uciOf(m)===uci||uciOf(m)===uci.slice(0,4)&&!m.p)||
         legal(p).find(m=>sq(m.f)+sq(m.t)===uci.slice(0,4));
}
function san(p,m){
  const pc=p.b[m.f],t=pc.toLowerCase(),cap=!!p.b[m.t]||m.ep;
  if(m.c)return m.c==="k"?"O-O":"O-O-O";
  let s="";
  if(t==="p"){
    s=cap?sq(m.f)[0]+"x"+sq(m.t):sq(m.t);
    if(m.p)s+="="+m.p.toUpperCase();
  }else{
    const same=legal(p).filter(x=>x.t===m.t&&x.f!==m.f&&p.b[x.f]===pc);
    let dis="";
    if(same.length){
      if(!same.some(x=>file(x.f)===file(m.f)))dis=sq(m.f)[0];
      else if(!same.some(x=>rank(x.f)===rank(m.f)))dis=sq(m.f)[1];
      else dis=sq(m.f);
    }
    s=t.toUpperCase()+dis+(cap?"x":"")+sq(m.t);
  }
  const n=make(p,m);
  if(attacked(n.b,kingIdx(n.b,n.w),!n.w))s+=legal(n).length?"+":"#";
  return s;
}
function perft(p,d){
  if(d===0)return 1;
  let n=0;
  for(const m of legal(p))n+=perft(make(p,m),d-1);
  return n;
}

/* ===== fixed-depth material search =====
   Exists so the trainer can say something concrete about a wrong move instead of a
   bare refusal. Alpha-beta on material only (VAL), no positional terms, with a
   quiescence extension on captures so the search never stops mid-exchange and
   misreports a recapture as a loss. One hard node budget covers a whole verdict
   (both searches inside matVerdict); when it runs out the caller gets null, never
   a half-searched claim - on a slow phone, silence is the honest answer. Mate is
   folded into the same scale as MATE minus plies from the root, so a nearer mate
   outranks a farther one and any score beyond MATE-64 can only mean a forced mate
   inside the search depth - which is the one evaluation claim this search licenses. */
const MATE=1000,MAT_CAP=60000,MAT_STOP={};
let matNodes=0;
function matBal(b){
  let s=0;
  for(const pc of b)if(pc)s+=isW(pc)?VAL[pc.toLowerCase()]:-VAL[pc.toLowerCase()];
  return s;
}
// Winning-looking captures first (victim over attacker), quiet moves next, losing-
// looking captures last. The middle slot matters as much as the first: at a node
// whose bound is already level material, a QUIET move is what proves the cutoff,
// and trying QxP-style losing captures ahead of it made half the verdicts blow the
// node budget in testing - measured, this ordering is what keeps a four-ply search
// of a full opening position inside it.
function matOrder(p,ms){
  const v=m=>{
    const cap=m.ep?1:(p.b[m.t]?VAL[p.b[m.t].toLowerCase()]:0);
    return cap?cap*10-VAL[p.b[m.f].toLowerCase()]:5;
  };
  return ms.sort((a,b)=>v(b)-v(a));
}
/* Quiescence: captures only, so the search never stands on a position where half
   an exchange is still hanging. Two shaping rules keep it from exploding - both
   were measured to matter, not guessed. After two quiescence plies only recaptures
   on the square just captured on are tried: an exchange still runs to the end
   (that is the whole point of quiescing), but unrelated capture flurries across
   the board stop multiplying. And a capture that cannot lift the score to alpha
   even if the victim came free is skipped. Both trim the tree towards "exchanges
   resolve, nothing else", which is exactly the claim the caller makes with the
   result. Mate at the horizon: only checked when stand-pat did not already cut,
   because the check costs a full legal(); a mate missed by an early stand-pat cut
   can only make the verdict more cautious, never overclaim. */
function matQuiesce(p,alpha,beta,ply,qd,lastTo){
  if(++matNodes>MAT_CAP)throw MAT_STOP;
  const stand=(p.w?1:-1)*matBal(p.b);
  if(stand>=beta)return stand;
  const ms=legal(p);
  if(!ms.length)return inCheck(p)?-(MATE-ply):0;
  if(stand>alpha)alpha=stand;
  matOrder(p,ms);
  for(const m of ms){
    const v=m.ep?1:(p.b[m.t]?VAL[p.b[m.t].toLowerCase()]:0);
    if(!v)continue;
    if(qd>=1&&m.t!==lastTo)continue;
    if(stand+v<alpha)continue;
    const s=-matQuiesce(make(p,m),-beta,-alpha,ply+1,qd+1,m.t);
    if(s>=beta)return s;
    if(s>alpha)alpha=s;
  }
  return alpha;
}
function matSearch(p,depth,alpha,beta,ply){
  if(++matNodes>MAT_CAP)throw MAT_STOP;
  if(depth===0)return matQuiesce(p,alpha,beta,ply,0,-1);
  const ms=legal(p);
  if(!ms.length)return inCheck(p)?-(MATE-ply):0;
  matOrder(p,ms);
  for(const m of ms){
    const s=-matSearch(make(p,m),depth-1,-beta,-alpha,ply+1);
    if(s>=beta)return s;
    if(s>alpha)alpha=s;
  }
  return alpha;
}
/* matVerdict(pos, m): pos is the position m was played FROM. Compares the mover's
   best searched score before the move against the best they can still get after
   it, and names the opponent reply that enforces the difference. Returns null when
   the node budget ran out (no claim can be made), otherwise {swing, san, uci, mate}:
   swing is pawns of material the move loses against best play (under 1 means the
   search proved nothing worth saying), mate is 0 or the ply count of a forced mate
   the opponent has after the move. Both sides are searched to the same four plies,
   so "does not come back inside four plies" is exactly what a swing proves. */
function matVerdict(pos,m){
  matNodes=0;
  try{
    const before=matSearch(pos,4,-MATE,MATE,0);
    const after=make(pos,m);
    const replies=legal(after);
    if(!replies.length)return {swing:0,san:"",uci:"",mate:0};
    // Seed the reply order with a cheap quiescence score of each: the true best
    // reply almost always surfaces first, so every later one fails low against a
    // tight window instead of being searched in full. Measured, this and the
    // ordering rules above are the difference between fitting the node budget on
    // a full opening position and blowing it on half of them.
    const seed=replies.map(r=>[-matQuiesce(make(after,r),-MATE,MATE,1,1,r.t),r]);
    seed.sort((a,b)=>b[0]-a[0]);
    let best=null,bestS=-MATE-1;
    for(const [,r] of seed){
      const s=-matSearch(make(after,r),3,-MATE,-bestS,1);
      if(s>bestS){bestS=s;best=r;}
    }
    // A mover who had a forced mate and let it slip shows up as a huge swing with
    // no mate for the opponent. That is not a material claim and must not be
    // phrased as one; report nothing rather than a wrong reason.
    const swing=before>MATE-64&&bestS<MATE-64?0:before-(-bestS);
    return {swing:swing,san:san(after,best),uci:uciOf(best),
      mate:bestS>MATE-64?MATE-bestS:0};
  }catch(e){
    if(e===MAT_STOP)return null;
    throw e;
  }
}
/* The refutation names the opponent's reply while the user's own position is still
   live for a retry, so it must never smuggle in the move they were supposed to
   play. Same idea as clueLeaks in app.js, narrowed to what a refutation string can
   actually leak: the expected move's SAN, its origin square or its destination. */
function refuteLeaks(text,uci,sanTxt){
  const low=text.toLowerCase();
  return low.indexOf(sanTxt.replace(/[+#!?]/g,"").toLowerCase())>=0||
    low.indexOf(uci.slice(0,2))>=0||low.indexOf(uci.slice(2,4))>=0;
}

function fenOf(p){
  let rows=[];
  for(let r=0;r<8;r++){
    let s="",e=0;
    for(let f=0;f<8;f++){
      const c=p.b[r*8+f];
      if(c){if(e){s+=e;e=0;}s+=c;}else e++;
    }
    if(e)s+=e;rows.push(s);
  }
  return rows.join("/")+" "+(p.w?"w":"b")+" "+(p.cr||"-")+" "+(p.ep>=0?sq(p.ep):"-")+" 0 1";
}
