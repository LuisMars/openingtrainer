/* ================= plumbing ================= */
const F="abcdefgh";
const START="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const G={k:"\u265A",q:"\u265B",r:"\u265C",b:"\u265D",n:"\u265E",p:"\u265F"};
const PIECE={p:'<circle cx="50" cy="30" r="13"/><path d="M34 72c0-14 6-21 16-25 10 4 16 11 16 25z"/><path d="M30 74h40l4 8H26z"/><path d="M24 84h52l4 8H20z"/>',r:'<path d="M26 18h11v8h9v-8h8v8h9v-8h11v17l-7 6v25l7 6H26l7-6V41l-7-6z"/><path d="M22 80h56l4 8H18z"/>',n:'<path d="M36 82c-2-16 4-24 14-31 5-4 5-8 1-10l-9 5c-5 2-9-1-8-6 2-11 12-20 24-24l2-9 7 7c12 5 18 16 18 33 0 18-5 27-6 35z"/><circle cx="58" cy="34" r="3.5" fill="none" stroke-width="5"/><path d="M26 82h52l4 8H22z"/>',b:'<circle cx="50" cy="15" r="6"/><path d="M50 22c9 7 16 18 16 27 0 9-7 15-16 15s-16-6-16-15c0-9 7-20 16-27z"/><path d="M42 30 L60 50" fill="none" stroke-width="5" stroke-linecap="round"/><path d="M31 66h38l5 10H26z"/><path d="M24 80h52l4 8H20z"/>',q:'<circle cx="20" cy="26" r="6"/><circle cx="35" cy="18" r="6"/><circle cx="50" cy="14" r="7"/><circle cx="65" cy="18" r="6"/><circle cx="80" cy="26" r="6"/><path d="M22 30l8 22 6-30 14 30 14-30 6 30 8-22-8 42H30z"/><path d="M28 74h44l4 8H24z"/><path d="M22 84h56l4 8H18z"/>',k:'<path d="M46 12h8v8h8v8h-8v10h-8V28h-8v-8h8z"/><path d="M32 74c-3-18 5-28 18-36 13 8 21 18 18 36z"/><path d="M28 74h44l4 8H24z"/><path d="M22 86h56l4 8H18z"/>'};
const NAME={k:"king",q:"queen",r:"rook",b:"bishop",n:"knight",p:"pawn"};
function pieceEl(ch,cls){
  const s=document.createElementNS("http://www.w3.org/2000/svg","svg");
  s.setAttribute("viewBox","0 0 100 100");s.setAttribute("class",cls);
  s.innerHTML=PIECE[ch.toLowerCase()];
  return s;
}
const VAL={p:1,n:3,b:3,r:5,q:9,k:0};
const ix=s=>(8-parseInt(s[1],10))*8+F.indexOf(s[0]);
const sq=i=>F[i%8]+(8-Math.floor(i/8));

function fenBoard(f){const b=new Array(64).fill("");let i=0;
  for(const c of f.split(" ")[0]){if(c==="/")continue;if(c>="1"&&c<="8")i+=+c;else b[i++]=c;}return b;}
function apply(b,u){
  const f=ix(u.slice(0,2)),t=ix(u.slice(2,4)),pr=u[4],p=b[f];
  b[f]="";
  if(p.toLowerCase()==="p"&&f%8!==t%8&&!b[t])b[t+(p==="P"?8:-8)]="";
  b[t]=pr?(p==="P"?pr.toUpperCase():pr.toLowerCase()):p;
  if(p==="K"&&u==="e1g1"){b[ix("h1")]="";b[ix("f1")]="R";}
  if(p==="K"&&u==="e1c1"){b[ix("a1")]="";b[ix("d1")]="R";}
  if(p==="k"&&u==="e8g8"){b[ix("h8")]="";b[ix("f8")]="r";}
  if(p==="k"&&u==="e8c8"){b[ix("a8")]="";b[ix("d8")]="r";}
  return b;
}

/* ================= repertoire ================= */
const HIPPO_T=[["a6","p"],["b6","p"],["d6","p"],["e6","p"],["g6","p"],["h6","p"],["b7","b"],["g7","b"],["d7","n"],["e7","n"]];
const COLLE_T=[["d4","P"],["e3","P"],["c3","P"],["d3","B"],["f3","N"],["d2","N"]];
const ZUK_T=[["d4","P"],["e3","P"],["b3","P"],["d3","B"],["b2","B"],["e5","N"],["d2","N"]];

