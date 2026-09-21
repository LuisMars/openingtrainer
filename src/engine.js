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
// Same answer as c===c.toUpperCase() for every ASCII character, without the string
// allocation: this is on the hottest path of the material search.
function isW(c){return c<"a"||c>"z";}

/* attacked(b, sqi, byWhite): does a piece of that colour attack sqi? The squares
   each kind of attacker could stand on are precomputed per target square, by
   exactly the stepping and wrap rules the loop version used (including sqi -1,
   which kingIdx returns for a kingless board), so the answer is the same and only
   the per-call arrays and string work are gone. Rays are listed nearest first; the
   first occupied square on a ray is the only one that can attack. */
const AT_P={},AT_N={},AT_K={},AT_O={},AT_D={};
for(let s=-1;s<64;s++){
  const steps=(ds,lim,lo)=>ds.map(d=>s+d).filter(j=>j>=0&&j<=63&&
    Math.abs(file(j)-file(s))<=lim&&Math.abs(file(j)-file(s))>=lo);
  AT_P[s]=[steps([9,7],1,1),steps([-9,-7],1,1)];  // [by white, by black]
  AT_N[s]=steps(DIRS.n,2,1);
  AT_K[s]=steps(DIRS.k,1,0);
  const rays=ds=>ds.map(d=>{
    const r=[];let j=s,prev=s;
    while(true){j+=d;if(j<0||j>63||Math.abs(file(j)-file(prev))>1)break;r.push(j);prev=j;}
    return r;
  }).filter(r=>r.length);
  AT_O[s]=rays(DIRS.r);AT_D[s]=rays(DIRS.b);
}
function attacked(b,sqi,byWhite){
  const P=byWhite?"P":"p",N=byWhite?"N":"n",K=byWhite?"K":"k",
    R=byWhite?"R":"r",B=byWhite?"B":"b",Q=byWhite?"Q":"q";
  for(const j of AT_P[sqi][byWhite?0:1])if(b[j]===P)return true;
  for(const j of AT_N[sqi])if(b[j]===N)return true;
  for(const j of AT_K[sqi])if(b[j]===K)return true;
  for(const r of AT_O[sqi])for(const j of r){const pc=b[j];if(pc){if(pc===R||pc===Q)return true;break;}}
  for(const r of AT_D[sqi])for(const j of r){const pc=b[j];if(pc){if(pc===B||pc===Q)return true;break;}}
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
  const drop=s=>{if(cr)for(const ch of s)cr=cr.replace(ch,"");};
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
/* legalMove(b, w, m, ki): would m leave the mover's own king attacked? Plays the
   board half of make() on b in place, asks, and puts every square back, so legal()
   no longer clones a position per pseudo-move. ki is the mover's king square before
   the move (kingIdx), which is where it is afterwards unless the king moved. The
   promoted piece and the castling rook are placed exactly as make() places them:
   what the king can see depends on every occupied square. */
function legalMove(b,w,m,ki){
  matTests++;
  const f=m.f,t=m.t,pc=b[f],cap=b[t];
  let eps=-1,epc="",r1=-1,r2=-1,c1="",c2="";
  b[f]="";
  if(m.ep){eps=t+(w?8:-8);epc=b[eps];b[eps]="";}
  b[t]=m.p?(w?m.p.toUpperCase():m.p):pc;
  if(m.c==="k"){r1=t+1;r2=t-1;}else if(m.c==="q"){r1=t-2;r2=t+1;}
  if(r1>=0){c1=b[r1];c2=b[r2];b[r1]="";b[r2]=w?"R":"r";}
  const ok=!attacked(b,pc===(w?"K":"k")?t:ki,!w);
  if(r1>=0){b[r2]=c2;b[r1]=c1;}
  b[t]=cap;
  if(eps>=0)b[eps]=epc;
  b[f]=pc;
  return ok;
}
function legal(p){
  const out=[],b=p.b,w=p.w,ki=kingIdx(b,w);
  for(const m of pseudo(p))if(legalMove(b,w,m,ki))out.push(m);
  return out;
}
function uciOf(m){return sq(m.f)+sq(m.t)+(m.p||"");}
function findMove(p,uci){
  return legal(p).find(m=>uciOf(m)===uci||uciOf(m)===uci.slice(0,4)&&!m.p)||
         legal(p).find(m=>sq(m.f)+sq(m.t)===uci.slice(0,4));
}
function san(p,m){
  const pc=p.b[m.f],t=pc.toLowerCase(),cap=!!p.b[m.t]||m.ep;
  let s="";
  // Castling falls THROUGH to the check/mate suffix below rather than returning
  // here: a rook landing on f1/d1 with check is "O-O+", and an early return made
  // it "O-O". Nothing stored in LINES or PZ castles into check today, so this
  // fixes a latent bug rather than changing any shipped notation.
  if(m.c)s=m.c==="k"?"O-O":"O-O-O";
  else if(t==="p"){
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
// matTests counts legality tests (legalMove calls, from anywhere), reset with
// matNodes per verdict: tests per node is the per-node cost the regression check
// in test/w1b-engine.mjs holds down, because wall time on a loaded box cannot.
let matNodes=0,matTests=0;
// VAL signed by colour and keyed by the board's own letter, so the hot loops below
// never call toLowerCase().
const VALC={};
for(const k in VAL){VALC[k]=-VAL[k];VALC[k.toUpperCase()]=VAL[k];}
function matBal(b){
  let s=0;
  for(const pc of b)if(pc)s+=VALC[pc];
  return s;
}
// Material a move wins outright: the victim, plus what a promotion adds (the pawn
// is gone and the promoted piece is there, so the uplift is VAL[promo]-1). Victim
// alone was the old rule and it mispriced both halves of a promotion - a capture-
// promotion counted as the captured piece, and a quiet promotion counted as zero,
// which is what made quiescence skip queening altogether. Used by both the ordering
// below and the delta-pruning test in matQuiesce, so the two cannot drift apart.
function matGain(p,m){
  const v=p.b[m.t];
  return (m.ep?1:(v?Math.abs(VALC[v]):0))+(m.p?VAL[m.p]-1:0);
}
// Winning-looking captures first (gain over attacker), quiet moves next, losing-
// looking captures last. The middle slot matters as much as the first: at a node
// whose bound is already level material, a QUIET move is what proves the cutoff,
// and trying QxP-style losing captures ahead of it made half the verdicts blow the
// node budget in testing - measured, this ordering is what keeps a four-ply search
// of a full opening position inside it.
// Each key is computed once, not once per comparison; sort() is stable, so equal
// keys keep generation order exactly as before.
function matOrder(p,ms){
  if(ms.length<2)return ms;
  const dec=ms.map(m=>{
    const g=matGain(p,m);
    return {m:m,k:g?g*10-Math.abs(VALC[p.b[m.f]]):5};
  });
  dec.sort((a,b)=>b.k-a.k);
  for(let i=0;i<dec.length;i++)ms[i]=dec[i].m;
  return ms;
}
/* Quiescence: captures only (and queening), so the search never stands on a
   position where half an exchange is still hanging. Two shaping rules keep it from
   exploding: captures are tried best-looking first (matOrder), and a capture that
   cannot lift the score to alpha even if the victim came free is skipped.
   Every capture is tried at every quiescence ply. An earlier rule tried only
   recaptures on the square just captured on after the first ply, and it was
   unsound, not just a trim: a capture elsewhere that wins the material back, or a
   piece left hanging by the exchange, was invisible, so the search stood pat a pawn
   down and matVerdict claimed a swing the position does not have - measured against
   the exact reference in tools/check-matsearch.mjs, 13 overclaims in 3,879
   comparisons, five of which reached the user as a false sentence. Dropping it
   costs about a fifth more nodes on average and turns 25 of 3,880 sampled
   verdicts into budget misses (was 1); a budget miss is silence, not a claim.
   Delta pruning is still not exact: a capture that gives check denies the
   opponent a stand-pat, so it can win more than its victim. One sampled verdict
   (ohanlon:28 g4) would overclaim for that reason if MAT_CAP were raised enough
   to finish it; at the current budget it is silent. See tools/check-matsearch.mjs.
   In check there is no stand-pat at all. A side in check cannot decline to move,
   so the static score is not a lower bound on what it can hold, and a cutoff taken
   on it is a bound the node cannot claim - measured, on R6k/1R6/8/8/8/8/q7/6K1 b
   the old code returned -1 against beta -500 while Black was in check and lost, and
   at an OPPONENT node that inflates the swing the caller reports. So the check test is
   paid at every quiescence node (one attacked() scan), and when it is true every evasion is searched - blocks and king steps
   included, not just captures, which were the only evasions the old code could see.
   Termination of a long checking sequence rests on MAT_CAP: a check chain that will
   not resolve spends the budget and the caller gets null, which is the honest
   answer, not a wrong one.
   Speed: the rewrite that made legal() test moves in place (legalMove) and made
   quiescence test only the moves it will search visits exactly the same nodes in
   the same order - every one of 4,110 verdicts (516 drill positions x 8 wrong
   moves) came back identical, swing, reply, null and node count - at about a sixth
   of the wall time. test/w1b-engine.mjs holds the cost down by counting work. */
function matQuiesce(p,alpha,beta,ply){
  if(++matNodes>MAT_CAP)throw MAT_STOP;
  const b=p.b,w=p.w,ki=kingIdx(b,w);
  const stand=(w?1:-1)*matBal(b),chk=attacked(b,ki,!w);
  let ms;
  if(chk){
    ms=legal(p);
    if(!ms.length)return -(MATE-ply);
  }else{
    if(stand>=beta)return stand;
    if(stand>alpha)alpha=stand;
    // Only moves that win material are searched out of check, so only those are
    // tested for legality - same moves in the same order as filtering legal(p)
    // afterwards, without paying for every quiet move. Under-promotions can never
    // win more material than the queen does, so the material search skips them
    // here; matOrder still ranks them if a full-width ply above hands one over.
    const ps=pseudo(p);
    ms=[];
    for(const m of ps)
      if(matGain(p,m)&&!(m.p&&m.p!=="q")&&legalMove(b,w,m,ki))ms.push(m);
    // No legal move at all is stalemate, scored 0 whatever the stand-pat said.
    if(!ms.length)return ps.some(m=>legalMove(b,w,m,ki))?alpha:0;
  }
  matOrder(p,ms);
  for(const m of ms){
    if(!chk&&stand+matGain(p,m)<alpha)continue;
    const s=-matQuiesce(make(p,m),-beta,-alpha,ply+1);
    if(s>=beta)return s;
    if(s>alpha)alpha=s;
  }
  return alpha;
}
function matSearch(p,depth,alpha,beta,ply){
  if(++matNodes>MAT_CAP)throw MAT_STOP;
  if(depth===0)return matQuiesce(p,alpha,beta,ply);
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
   the opponent has after the move. Both sides are searched to the same four plies
   from pos - the "after" half spends one on the move itself and one on the reply,
   so the tail search is 2, not 3 - so "does not come back inside four plies", which
   is what the UI says, is exactly what a swing proves. It used to be 4 against 5,
   and a swing measured across two different horizons is partly a horizon artefact
   rather than material lost. */
function matVerdict(pos,m){
  matNodes=0;matTests=0;
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
    const seed=replies.map(r=>[-matQuiesce(make(after,r),-MATE,MATE,1),r]);
    seed.sort((a,b)=>b[0]-a[0]);
    let best=null,bestS=-MATE-1;
    for(const [,r] of seed){
      const s=-matSearch(make(after,r),2,-MATE,-bestS,1);
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

/* ===== shared helpers: position identity and candidate lookup =====
   Both pure - no DOM, no module state, nothing beyond what the bundle already
   shares - so fixtures can be written against them directly. */

/* posKey(pos): the position's identity string, and the key EVL is built on.
   fenOf writes an ep square whenever the last move was a double pawn push, whether
   or not a capture onto it is legal, so two move orders reaching the same board get
   two different fenOf strings. Blank that field unless an en-passant capture is
   actually available. Castling rights are part of identity and are never touched.
   Halfmove and fullmove are fenOf's fixed "0 1", so repetition and the 50-move rule
   are deliberately NOT part of identity. This is the same fold keyFen() applies in
   src/app.js and tools/build-evals.mjs; those two keep their own copies for now
   (app.js is owned by another lane this wave, and the tool runs outside the
   bundle), so this must stay identical in behaviour to them or EVL lookups miss.
   ponytail: fold both onto this one the next time app.js and the tool are open. */
function posKey(pos){
  if(pos.ep<0)return fenOf(pos);
  return legal(pos).some(m=>m.ep)?fenOf(pos):fenOf({b:pos.b,w:pos.w,cr:pos.cr,ep:-1});
}

/* candidateEval(row, pos, mv): what one stored EVL row says about ONE move, with
   "the table does not cover this move" as a first-class answer rather than a
   penalty. 76 of the 442 repertoire drill moves sit outside their row's five, so
   anything that read absence as bad would mark a book move down for not being among
   the engine's favourites. row is EVL[posKey(pos)] or null; mv is a move object or a
   uci string. Returns {known, rank, entry, best, depth, reason} where reason is one
   of "listed" (in the ranked five), "scored" (outside the five but searched on its
   own and carried in row.x), "unanalysed" (the row exists, the move is in neither)
   or "no-row" (no stored analysis at all). When known is false, entry is null and
   there is no score to infer - callers must say nothing rather than guess.
   rank is the place in the ranked five, and is 0 for a "scored" move: having a
   number is not the same as having a rank, and nothing may present it as one. */
function candidateEval(row,pos,mv){
  const out={known:false,rank:0,entry:null,best:null,depth:(row&&row.d)||0,reason:"no-row"};
  if(!row||!row.m||!row.m.length)return out;
  out.best=row.m[0];
  out.reason="unanalysed";
  const uci=typeof mv==="string"?mv:uciOf(mv);
  const bare=typeof mv==="string"?"":san(pos,mv).replace(/[+#!?]/g,"");
  const hit=r=>r[0]===uci||(bare&&r[1].replace(/[+#!?]/g,"")===bare);
  const i=row.m.findIndex(hit);
  if(i>=0){out.known=true;out.rank=i+1;out.entry=row.m[i];out.reason="listed";return out;}
  const j=row.x?row.x.findIndex(hit):-1;
  if(j>=0){out.known=true;out.entry=row.x[j];out.reason="scored";}
  return out;
}

/* ===== grading policy v1 (research/GRADING.md) =====
   Pure: a stored EVL row, the position it describes and one move in, a record out.
   No DOM, no state, nothing from the frequency record - the signature has no
   place for a game count, so the grade of a position seen seven times and one
   seen three hundred thousand times is the same by construction.

   The bands are in centipawns of loss against the row's best entry, side-to-move
   relative like everything in EVL. They were calibrated against the shipped
   table, not taken from the plan: the plan's provisional 50/100 put "dropped a
   clean pawn" (84-88 cp in the one narrow pilot row) in concession and hid the
   repertoire's own 37 cp concession after 1.d4 c5 inside equal. See GRADING.md
   for the histogram that puts the boundaries at 30 and 70. DECISIVE is the
   absolute score past which a position is called won or lost; mates are never
   folded into it or into any centipawn figure. */
const GRADE={version:"v1",equal:30,concession:70,decisive:200,
  accept:["best","equal"],reject:["inferior","losing"]};
/* Order two EVL entries [uci,san,cp,mate] from the mover's view: positive means a
   is better. Mates sort outside the centipawn scale entirely - a mate for the
   mover beats any score, a shorter one beats a longer one, and being mated is
   worse than any score with the longer the better. Never subtracts a mate from
   a centipawn: the two are not on one scale, and lossCp is null across them. */
function cmpScore(a,b){
  const am=a[3],bm=b[3];
  if(am==null&&bm==null)return a[2]-b[2];
  if(am!=null&&bm!=null){
    if((am>0)!==(bm>0))return am>0?1:-1;
    return am>0?bm-am:bm-am;   // mating: fewer is better; mated: more is better
  }
  return am!=null?(am>0?1:-1):(bm>0?-1:1);
}
/* What the board is from the mover's view given one entry: "mating", "won",
   "level", "lost" or "mated". Used twice per record - for the row's best (the
   position as it stood) and for the move played (what it leaves) - so the UI can
   say "best defence, still lost" rather than "saved". */
function scoreState(e){
  if(e[3]!=null)return e[3]>0?"mating":"mated";
  if(e[2]>=GRADE.decisive)return "won";
  if(e[2]<=-GRADE.decisive)return "lost";
  return "level";
}
/* gradeRow(row, pos, mv): the move-grading record of research/CONTRACTS.md,
   from one row. Callers use gradeMove below, which adds the deeper search.
   Returns {key, uci, san, cp, mate, rank, reason, analysis, lossCp, verdict,
   situation, after, why, reply, split}. verdict is best | equal | concession | inferior
   | losing | unknown; analysis is "checked" when the engine searched the move
   (listed in the five or scored on its own in row.x) and "unknown" otherwise, in
   which case the verdict is unknown, lossCp is null and why.kind says only that
   nothing was analysed - no penalty and no praise. rank is the place in the
   ranked five and 0 for a scored move: it identifies a candidate and decides
   nothing, the gap to the best entry does. why is the structured input to the
   explanation (kind, the best entry, the move's own entry, the depth) and never
   prose; reply is left null for the caller that knows what was shown.
   Precedence, top first, because the centipawn bands cannot see these:
     allows-mate   move gets the mover mated, best does not      -> losing
     mates / slower-mate  move mates; shortest -> best, else equal
     missed-mate   best mates, move does not                     -> inferior
     already-lost  best is mated too: best defence by distance, never "saved"
     now-lost      move crosses into lost, best did not, beyond the noise band -> losing
     threw-win     best decisive, move not, beyond the noise band -> inferior
   then the bands: 0 or rank 1 best, <=equal equal, <=concession concession,
   else inferior. A move already inside the lost region before it was played is
   graded on the bands with situation "lost" so nothing calls its best defence
   a save, and nothing calls a losing move "losing" twice. */
function gradeRow(row,pos,mv){
  const c=candidateEval(row,pos,mv);
  const m=typeof mv==="string"?findMove(pos,mv):mv;
  const uci=typeof mv==="string"?mv:uciOf(mv);
  const out={key:posKey(pos),uci:uci,san:m?san(pos,m):"",cp:null,mate:null,rank:c.rank,
    reason:c.reason,analysis:"unknown",lossCp:null,verdict:"unknown",situation:null,
    after:null,why:{kind:c.reason,best:c.best,move:null,depth:c.depth},reply:null,split:null};
  if(c.best)out.situation=scoreState(c.best);
  if(!c.known)return out;
  const e=c.entry,b=c.best;
  out.analysis="checked";out.cp=e[2];out.mate=e[3];out.after=scoreState(e);
  out.why.move=e;
  const cpBoth=e[3]==null&&b[3]==null;
  if(cpBoth)out.lossCp=Math.max(0,b[2]-e[2]);
  const say=(v,k)=>{out.verdict=v;out.why.kind=k;return out;};
  if(e[3]!=null&&e[3]<0){
    if(b[3]!=null&&b[3]<0){
      if(e[3]===b[3])return say("best","already-lost");
      return say("inferior","already-lost");
    }
    return say("losing","allows-mate");
  }
  if(e[3]!=null&&e[3]>0){
    if(b[3]!=null&&b[3]>0&&e[3]>b[3])return say("equal","slower-mate");
    return say("best","mates");
  }
  if(b[3]!=null&&b[3]>0)return say("inferior","missed-mate");
  // A centipawn move while the row's best is mated: only possible through row.x,
  // and by cmpScore it is the better of the two - the defence that escapes.
  if(b[3]!=null&&b[3]<0)return say("best","already-lost");
  // both centipawns from here
  const loss=out.lossCp;
  if(c.rank===1||loss===0)return say("best","best");
  if(loss<=GRADE.equal)return say("equal","within-noise");
  if(e[2]<=-GRADE.decisive&&b[2]>-GRADE.decisive)return say("losing","now-lost");
  if(b[2]>=GRADE.decisive&&e[2]<GRADE.decisive)return say("inferior","threw-win");
  if(loss<=GRADE.concession)return say("concession","concession");
  return say("inferior","inferior");
}
/* A second search (DEEP, src/data/deep.js) covers some drilled positions at a
   greater depth with the same engine. It applies only when row IS the shipped
   depth-20 row for the position (EVL[key]) - a constructed row describes nothing
   the deeper search looked at. Null everywhere else, so positions without a deep
   row, and every constructed fixture, grade exactly as gradeRow does. */
function deepRow(row,key){
  return (row&&typeof DEEP!=="undefined"&&typeof EVL!=="undefined"&&EVL[key]===row&&DEEP[key])||null;
}
const LENIENT=["losing","inferior","concession","equal","best"];
/* gradeMove(row, pos, mv): gradeRow, except at a deep-checked position, where the
   move gets the MORE GENEROUS of its two verdicts: the page never penalises a move
   either depth accepts. A depth that did not search the move has no verdict and
   gives way to one that did; on an equal verdict the depth-20 record stands, so
   agreement changes nothing. The record returned is the chosen depth's own, with
   its own numbers and why.depth. Where one depth accepts the move and the other
   does not, split holds both sides - [{d,verdict,cp,mate,lossCp}, ...] depth 20
   first - so the caller can say the two searches disagree, with both numbers. */
function gradeMove(row,pos,mv){
  const a=gradeRow(row,pos,mv),deep=deepRow(row,a.key);
  if(!deep)return a;
  const b=gradeRow(deep,pos,mv);
  if(b.analysis!=="checked")return a;
  if(a.analysis!=="checked")return b;
  const g=LENIENT.indexOf(b.verdict)>LENIENT.indexOf(a.verdict)?b:a;
  const acc=r=>GRADE.accept.indexOf(r.verdict)>=0;
  if(acc(a)!==acc(b))g.split=[a,b].map(r=>({d:r.why.depth,verdict:r.verdict,cp:r.cp,mate:r.mate,lossCp:r.lossCp}));
  return g;
}
/* isSetupMove(targets, pos, m): the structural half of setup credit, lifted from
   setupMove in app.js so the fixture and the app test one rule. The move puts the
   right piece on one of the formation's squares and is not a shuffle from one
   target square to another. Nothing here says the move is good. */
function isSetupMove(targets,pos,m){
  if(!targets||!targets.length)return false;
  const pc=pos.b[m.f];
  return targets.some(x=>x[0]===sq(m.t)&&x[1]===pc)&&!targets.some(x=>x[0]===sq(m.f)&&x[1]===pc);
}
/* setupGate(row, pos, mv, targets): whether "builds the setup too - the formation
   matters more than the order it goes up in" may be said of this move here.
   Returns {credit, reason, grade}. credit is true only when the stored analysis
   backs the claim on both sides: the row's own first choice is itself a formation
   move (so the position tolerates building - when the engine wants a flank strike or a
   central break, the order matters and the claim is false however safe the wall
   move looks to a four-ply material search), and the move played grades best or
   equal against it. reason is one of:
     no-targets  the line builds nothing; nothing to credit
     not-target  the move is not a formation move
     no-row      no stored analysis; the caller's material brake is all there is
     demanding   the position wants something concrete: neither the best entry
                 nor anything tied with it is a formation move. No credit at
                 any evaluation - grade it instead
     unanalysed  quiet position, but this move was not searched; the caller may
                 fall back to its material brake, and only here
     out-of-band searched and worse than the noise band: no credit, grade it
     in-band     credited
   grade carries the gradeMove record whenever a row exists, so the caller never
   grades twice. */
function setupGate(row,pos,mv,targets){
  const m=typeof mv==="string"?findMove(pos,mv):mv;
  const out={credit:false,reason:"no-targets",grade:null};
  if(!targets||!targets.length)return out;
  if(!m||!isSetupMove(targets,pos,m)){out.reason="not-target";return out;}
  if(!row||!row.m||!row.m.length){out.reason="no-row";return out;}
  out.grade=gradeMove(row,pos,m);
  // The first choice, and anything tied with it to the centipawn (hip-150 ply 11:
  // c5 -78, Nd7 -78 - the table itself says the wall move is a joint first
  // choice there). A tie is exact; the noise band is not applied here, or every
  // wall move within 30 cp of a concrete first choice would reopen the gate.
  // At a deep-checked position both depths must say demanding before the gate
  // refuses: at hip-150 ply 13 depth 20 puts ...h5 first (...Nd7 11 cp behind)
  // and depth 28 puts ...Nd7 first (...h5 1 cp behind), so the gate is open there.
  const demanding=r=>!r.m.filter(e=>cmpScore(e,r.m[0])===0).map(e=>findMove(pos,e[0]))
    .some(bm=>bm&&isSetupMove(targets,pos,bm));
  const deep=deepRow(row,posKey(pos));
  if(demanding(row)&&(!deep||demanding(deep))){out.reason="demanding";return out;}
  if(out.grade.verdict==="unknown"){out.reason="unanalysed";return out;}
  if(out.grade.verdict==="best"||out.grade.verdict==="equal"){out.credit=true;out.reason="in-band";return out;}
  out.reason="out-of-band";
  return out;
}
