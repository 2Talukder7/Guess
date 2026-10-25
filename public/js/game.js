'use strict';
/* Guess - Word. Play. Learn.  (vanilla JS + canvas, no dependencies) */
const $=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const Q=new URLSearchParams(location.search);
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
/* Block size: half-size blocks (26px, 16x26 board) on PC; phones keep chunkier 40px blocks so fingers can hit them.
   Force with ?chunky or ?half in the address bar. */
const chunky=Q.has('chunky')||(!Q.has('half')&&(matchMedia('(pointer:coarse)').matches||innerWidth<640));
const CS=chunky?40:26,C=chunky?10:16,R=chunky?16:26,BASE=chunky?1000:820;   /* BASE = ms per row at level 1 */
const W=new Set(String(window.WORDS||'').split(' '));
const MAXW=6,SC={2:10,3:30,4:80,5:160,6:300};      /* words are 2-6 letters */
const OFF=[[1,0],[0,1],[-1,0],[0,-1]];       /* where the 2nd letter sits for rotation 0..3 */
const PAL=[['#ffd34d','#ffb000','#b86e00'],['#ff6b5e','#e8382e','#9c1519'],['#6be070','#2fbf3f','#17792a'],['#5db2ff','#2a86f5','#1948a8'],['#c277ff','#9a3deb','#61199f'],['#ffa25a','#ff7a1a','#b84a08']];
const BAG=Object.entries({e:12,t:9,a:8,o:8,i:7,n:7,s:6,r:6,h:5,d:4,l:4,c:3,u:3,m:3,w:2,f:2,g:2,y:2,p:2,b:2,v:1,k:1,j:1,x:1,z:1}).map(([k,v])=>k.repeat(v)).join('');
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
let g,p,nx,ph=1,score=0,words=0,time=0,hi=+ls.get('guess-hi')||0,busy=true,run=false,snd=ls.get('guess-snd')!=='0',soft=false,acc=0,blk=0,moves=25,startN=0,sel=null,drag=null,night=true,parts=[],last=0,phHtml='',kc=null,kgrab=false,pid=0,started=false;
const vow=c=>'aeiou'.includes(c),pick=()=>BAG[Math.random()*BAG.length|0];
function mk(){let a,b;do{a=pick();b=pick();if(!vow(a)&&!vow(b)&&Math.random()<.4)b='aeiou'[Math.random()*5|0]}while(W.has(a+b)||W.has(b+a));return{a,b,col:Math.random()*6|0,id:++pid}}
const cv=$('cv'),X=cv.getContext('2d'),nc=$('nc'),N=nc.getContext('2d');
cv.width=C*CS*2;cv.height=R*CS*2;X.scale(2,2);nc.width=208;nc.height=112;N.scale(2,2);
const cellsOf=(q,x=q.x,y=q.y,r=q.r)=>[[x,y],[x+OFF[r][0],y+OFF[r][1]]],free=cs=>cs.every(([x,y])=>x>=0&&x<C&&y<R&&(y<0||!g[y][x])),cnt=()=>g.flat().filter(Boolean).length;
const emptyGrid=()=>[...Array(R)].map(()=>Array(C).fill(null));
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r)}
function tile(c,x,y,s,ch,col,sc=1,fl=0,pd=0){const[l,b,d]=PAL[col],z=s*sc,o=(s-z)/2,k=s/52;c.save();c.translate(x+o,y+o);
rr(c,1,3*k,z-2,z-3*k,z*.2);c.fillStyle=d;c.fill();rr(c,1,1,z-2,z-5*k,z*.2);const gr=c.createLinearGradient(0,0,0,z);gr.addColorStop(0,l);gr.addColorStop(1,b);c.fillStyle=gr;c.fill();
if(fl){c.fillStyle='rgba(255,255,255,'+(.35+.3*Math.sin(Date.now()/50))+')';c.fill();c.strokeStyle='#fff';c.lineWidth=3*k;c.stroke()}
if(pd){c.setLineDash([4,3]);c.strokeStyle='rgba(255,255,255,.95)';c.lineWidth=2;c.stroke();c.setLineDash([])}
c.fillStyle='#fff';c.font='700 '+(z*.6|0)+'px Fredoka,"Arial Rounded MT Bold",sans-serif';c.textAlign='center';c.textBaseline='middle';c.shadowColor='rgba(0,0,0,.4)';c.shadowBlur=3*k;c.fillText(ch.toUpperCase(),z/2,z/2-k);c.restore()}
function draw(dt){X.clearRect(0,0,C*CS,R*CS);X.strokeStyle=night?'rgba(120,160,255,.15)':'rgba(30,60,100,.13)';X.lineWidth=1;
for(let i=1;i<C;i++){X.beginPath();X.moveTo(i*CS,0);X.lineTo(i*CS,R*CS);X.stroke()}for(let i=1;i<R;i++){X.beginPath();X.moveTo(0,i*CS);X.lineTo(C*CS,i*CS);X.stroke()}
const f=Math.max(0,1-dt*.012);
for(let r=0;r<R;r++)for(let c=0;c<C;c++){const t=g[r][c];if(!t)continue;t.dy*=f;t.dx*=f;if(Math.abs(t.dy)<.01)t.dy=0;if(Math.abs(t.dx)<.01)t.dx=0;
tile(X,(c+t.dx)*CS,(r+t.dy)*CS,CS,t.ch,t.col,1,t.fl,t.pend);if(sel&&sel[0]==r&&sel[1]==c){X.strokeStyle='#fff';X.lineWidth=3;rr(X,c*CS+2,r*CS+2,CS-4,CS-4,CS*.2);X.stroke()}}
if(ph==2&&kc&&run){X.strokeStyle=kgrab?'#fff':'#46e6ff';X.lineWidth=kgrab?4:3;X.shadowColor='#46e6ff';X.shadowBlur=kgrab?14:6;rr(X,kc[1]*CS+1,kc[0]*CS+1,CS-2,CS-2,CS*.2);X.stroke();X.shadowBlur=0}
if(p&&!busy)cellsOf(p).forEach(([x,y],i)=>tile(X,x*CS,y*CS,CS,i?p.b:p.a,p.col));
const k=CS/52;parts=parts.filter(q=>q.l>0);parts.forEach(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=.0006*k*dt;q.l-=dt;X.fillStyle=q.c;X.globalAlpha=Math.max(0,q.l/600);X.fillRect(q.x,q.y,6*k+1,6*k+1)});X.globalAlpha=1}
function drawNext(){N.clearRect(0,0,104,56);tile(N,2,4,48,nx.a,nx.col);tile(N,54,4,48,nx.b,nx.col)}
/* ---- word search -------------------------------------------------------------------------------------------
   find(T): every dictionary word (2..6 letters, read left-to-right or top-to-bottom) that contains at least one cell
   of T (the cells just placed / moved). T=null scans the whole board. "own" rejects a word made only of the two
   letters of one falling pair, so a pair can never score by itself. Longest words win over shorter ones. */
function find(T,own){const out=[],L=[],line=(k,i)=>k?[...Array(R)].map((_,r)=>[r,i]):[...Array(C)].map((_,c)=>[i,c]);
if(T){const rs=new Set(),cs=new Set();T.forEach(id=>{rs.add(id/C|0);cs.add(id%C)});rs.forEach(r=>L.push(line(0,r)));cs.forEach(c=>L.push(line(1,c)))}
else{for(let r=0;r<R;r++)L.push(line(0,r));for(let c=0;c<C;c++)L.push(line(1,c))}
for(const ln of L){let i=0;while(i<ln.length){if(!g[ln[i][0]][ln[i][1]]){i++;continue}let j=i;while(j<ln.length&&g[ln[j][0]][ln[j][1]])j++;const run=ln.slice(i,j);i=j;if(run.length<2)continue;
const cs=[];for(let a=0;a<run.length-1;a++)for(let b=a+2;b<=Math.min(run.length,a+MAXW);b++){const seg=run.slice(a,b),w=seg.map(q=>g[q[0]][q[1]].ch).join('');
if(W.has(w)&&(!T||seg.some(q=>T.has(q[0]*C+q[1])))&&!(own&&seg.every(q=>g[q[0]][q[1]].pid==g[seg[0][0]][seg[0][1]].pid)))cs.push({a,b,w,cells:seg})}
cs.sort((x,y)=>(y.b-y.a)-(x.b-x.a)||x.a-y.a);const used=new Array(run.length).fill(0);for(const q of cs){let ok=1;for(let k=q.a;k<q.b;k++)if(used[k])ok=0;if(ok){for(let k=q.a;k<q.b;k++)used[k]=1;out.push(q)}}}}return out}
function grav(){const m=new Set();for(let c=0;c<C;c++){let w=R-1;for(let r=R-1;r>=0;r--){const t=g[r][c];if(t){if(r!==w){g[w][c]=t;g[r][c]=null;t.dy=r-w;m.add(w*C+c)}w--}}}return m}
/* ---- spoken words: a female / young-sounding voice ------------------------------------------------------------------
   Browsers pick their own default voice (often a male one on Windows), so we choose one by name: neural female voices first,
   then any female-sounding voice, then anything that is not a known male voice. Pitch is raised a little so it sounds younger.
   Press V (or long-press the speaker button) to cycle through the voices installed on this device; the choice is remembered. */
const FEM=/aria|jenny|zira|samantha|ava\b|allison|susan|hazel|catherine|karen|moira|tessa|fiona|victoria|serena|libby|sonia|natasha|emma|olivia|amy|joanna|ivy|kendra|kimberly|salli|female|woman|girl|google us english|google uk english female/i,MALE=/david|mark|james|george|richard|\bguy\b|ryan|alex\b|daniel|fred|thomas|oliver|arthur|brian|matthew|joey|justin|kevin|russell|geraint|\bmale\b|man\b/i;
let VOICES=[],vi=0;
function loadVoices(){if(!window.speechSynthesis)return;const sc=v=>(MALE.test(v.name)&&!/female/i.test(v.name)?0:/natural|online|neural/i.test(v.name)&&FEM.test(v.name)?4:FEM.test(v.name)?3:2);
VOICES=speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang)).sort((a,b)=>sc(b)-sc(a));const saved=ls.get('guess-voice'),k=VOICES.findIndex(v=>v.name===saved);vi=k>=0?k:0}
const pitchOf=v=>v&&MALE.test(v.name)&&!/female/i.test(v.name)?1.6:1.3;      /* a male-sounding fallback is lifted more */
function say(w,force){if((!snd&&!force)||!window.speechSynthesis)return;try{if(!VOICES.length)loadVoices();speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(w),v=VOICES[vi];u.lang=v?v.lang:'en-US';if(v)u.voice=v;u.pitch=pitchOf(v);u.rate=.9;speechSynthesis.speak(u)}catch(e){}}
function cycleVoice(){loadVoices();if(!VOICES.length)return;vi=(vi+1)%VOICES.length;ls.set('guess-voice',VOICES[vi].name);$('tl').textContent='VOICE CHANGED';$('tw').textContent=VOICES[vi].name.replace(/^Microsoft |^Google | Desktop| Online \(Natural\)/g,'').slice(0,22);$('tp').textContent=(vi+1)+'/'+VOICES.length;say('Hello! Let us find some words.',true)}
if(window.speechSynthesis){loadVoices();try{speechSynthesis.addEventListener('voiceschanged',loadVoices)}catch(e){}}
function burst(r,c,col){const k=CS/52;for(let i=0;i<7;i++)parts.push({x:(c+.5)*CS,y:(r+.5)*CS,vx:(Math.random()-.5)*.35*k,vy:-Math.random()*.3*k,l:600,c:PAL[col][0]})}
/* Phase 1 "grace turn": a 2-letter word is not cleared the moment it appears. It is marked (dashed outline) and waits one
   piece, so the player can stretch it into a 3+ letter word first. 3+ letter words clear immediately. */
async function resolve(T,own,grace){let chain=0,any=false;const prev=new Set();
if(grace)g.forEach((row,r)=>row.forEach((t,c)=>{if(t&&t.pend){prev.add(r*C+c);t.pend=0;T.add(r*C+c)}}));
for(;;){let f=find(T,own);
if(grace){const keep=[],wait=[];f.forEach(x=>(x.w.length>2||x.cells.every(q=>prev.has(q[0]*C+q[1])))?keep.push(x):wait.push(x));
wait.forEach(x=>x.cells.forEach(q=>g[q[0]][q[1]].pend=1));if(wait.length&&!keep.length){$('tl').textContent='SHORT WORD - EXTEND IT!';$('tw').textContent=wait.map(x=>x.w.toUpperCase()).join(' + ');$('tp').textContent=''}f=keep}
if(!f.length)break;chain++;any=true;const cells=new Set();f.forEach(x=>x.cells.forEach(q=>cells.add(q[0]*C+q[1])));
cells.forEach(id=>g[id/C|0][id%C].fl=1);let pts=0;f.forEach(x=>pts+=SC[x.w.length]||4000);pts*=chain;const ws=f.map(x=>x.w.toUpperCase()).join(' + ');
$('tw').textContent=ws;$('tp').textContent='+'+pts+(chain>1?' x'+chain:'');$('tl').textContent=chain>1?'CHAIN x'+chain+'!':'WORD CLEARED!';say(f.map(x=>x.w).join(', '));await sleep(430);
cells.forEach(id=>{const r=id/C|0,c=id%C;burst(r,c,g[r][c].col);g[r][c]=null});score+=pts;words+=f.length;T=grav();await sleep(280)}return any}
function dead(){for(let r=0;r<R;r++)for(let c=0;c<C;c++)for(const[dr,dc]of[[0,1],[1,0]]){const r2=r+dr,c2=c+dc;if(r2>=R||c2>=C||!g[r][c]||!g[r2][c2])continue;
[g[r][c],g[r2][c2]]=[g[r2][c2],g[r][c]];const n=find(new Set([r*C+c,r2*C+c2])).length;[g[r][c],g[r2][c2]]=[g[r2][c2],g[r][c]];if(n)return false}return true}
async function shuffle(){$('tl').textContent='NO WORDS POSSIBLE';$('tw').textContent='Shuffling...';$('tp').textContent='';const cs=[];g.forEach((row,r)=>row.forEach((t,c)=>t&&cs.push([r,c])));
for(let k=0;k<160;k++){const ts=cs.map(([r,c])=>g[r][c]).sort(()=>Math.random()-.5);cs.forEach(([r,c],i)=>g[r][c]=ts[i]);if(!dead()&&(k>70||!find().length))break}
cs.forEach(([r,c])=>{g[r][c].dy=(Math.random()-.5)*4;g[r][c].dx=(Math.random()-.5)*4});await sleep(600);return !dead()}
/* Rescue rule: if even reshuffling cannot create a possible word (e.g. only consonants left), the player is not punished with
   25 wasted swaps - the falling blocks come back so new letters (and vowels) arrive. If the stack is still full, it is game over. */
let rescuing=false;async function stuckCheck(){if(!dead())return false;if(await shuffle())return false;rescuing=true;resume('NOT ENOUGH LETTERS','New blocks are coming!');return true}
async function enterSwap(){ph=2;busy=true;p=null;kc=null;kgrab=false;g.forEach(row=>row.forEach(t=>t&&(t.pend=0)));grav();await sleep(500);startN=cnt();moves=25;if(startN<2)return resume();if(await stuckCheck())return;busy=false}
function resume(a,b){ph=1;sel=null;kc=null;kgrab=false;$('tl').textContent=a||'BLOCKS ARE BACK!';$('tw').textContent=b||'Falling words';$('tp').textContent='';spawn()}
function spawn(){p={...nx,x:(C>>1)-1,y:0,r:0};nx=mk();drawNext();acc=0;blk=0;if(!free(cellsOf(p))){p=null;if(rescuing){rescuing=false;return over('The stack is full and no words can be made.')}enterSwap()}else{rescuing=false;busy=false}}
async function lock(){busy=true;let top=false;const T=new Set();cellsOf(p).forEach(([x,y],i)=>{if(y<0)top=true;else{g[y][x]={ch:i?p.b:p.a,col:p.col,pid:p.id,dy:0,dx:0,fl:0,pend:0};T.add(y*C+x)}});p=null;await resolve(T,true,true);top?enterSwap():spawn()}
/* Phase 2: 25 swaps in total per swap phase. The counter never resets when a word is made. */
async function doSwap(a,b){busy=true;sel=null;const ta=g[a[0]][a[1]],tb=g[b[0]][b[1]];g[a[0]][a[1]]=tb;g[b[0]][b[1]]=ta;ta.dy=a[0]-b[0];ta.dx=a[1]-b[1];tb.dy=b[0]-a[0];tb.dx=b[1]-a[1];moves--;await sleep(240);
await resolve(new Set([a[0]*C+a[1],b[0]*C+b[1]]));if(cnt()<=startN/3)return resume();if(moves<=0)return over('Out of swaps: all 25 used.');if(await stuckCheck())return;busy=false}
function step(){if(free(cellsOf(p,p.x,p.y+1))){p.y++;blk=0}else if(++blk>=2)lock()}
const ok1=()=>run&&ph==1&&p&&!busy,mv=dx=>{if(ok1()&&free(cellsOf(p,p.x+dx))){p.x+=dx;blk=0}};
function rot(){if(!ok1())return;const r=(p.r+1)%4;for(const[k,j]of[[0,0],[-1,0],[1,0],[0,-1]])if(free(cellsOf(p,p.x+k,p.y+j,r))){p.x+=k;p.y+=j;p.r=r;blk=0;return}}
/* keyboard cursor for swap mode: arrows move it, Space grabs the letter, the next arrow swaps it with that neighbour */
function kstart(){let best=null,bd=1e9;for(let r=0;r<R;r++)for(let c=0;c<C;c++)if(g[r][c]){const d=(R-1-r)*2+Math.abs(c-C/2);if(d<bd){bd=d;best=[r,c]}}return best||[R-1,C>>1]}
function kcur(dr,dc){if(!run||ph!=2||busy)return;sel=null;if(!kc){kc=kstart();return}const r=kc[0]+dr,c=kc[1]+dc;if(r<0||r>=R||c<0||c>=C)return;
if(kgrab){if(g[kc[0]][kc[1]]&&g[r][c]){const a=kc;kc=[r,c];kgrab=false;doSwap(a,[r,c])}}else kc=[r,c]}
function grab(){if(!run||ph!=2||busy)return;if(!kc)kc=kstart();if(g[kc[0]][kc[1]])kgrab=!kgrab}
function show(h,t,b){$('oh').textContent=h;$('op').textContent=t;$('go').textContent=b;$('ov').style.display='flex';$('go').focus()}
function over(m){run=false;busy=true;if(score>hi){hi=score;ls.set('guess-hi',hi)}show('Game over',m+' Score '+score+' | '+words+' words.','Play again')}
function begin(){g=emptyGrid();score=words=time=0;ph=1;run=true;sel=null;kc=null;kgrab=false;nx=mk();$('ov').style.display='none';document.body.classList.remove('paused');spawn()}
const lvl=()=>1+(words/6|0),speed=()=>Math.max(220,BASE-(lvl()-1)*45);
function hud(){$('sc').textContent=score;$('hi').textContent=Math.max(hi,score);$('lv').textContent=lvl();$('wd').textContent=words;const s=time/1000|0;$('tm2').textContent=String(s/60|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
const h=ph==1?'<small>PHASE 1</small><b style="font-size:22px">Falling words</b>':'<small>SWAPS LEFT</small><b>'+moves+'</b><div id="bar"><i style="width:'+Math.min(100,(startN-cnt())/(startN*2/3||1)*100)+'%"></i></div><small style="font-size:12px;margin-top:4px">clear 2/3 to resume</small>';
if(h!==phHtml){phHtml=h;$('phc').innerHTML=h}
$('hint').textContent=ph==1?'Rotate the pair to read AB or BA. A 2-letter word waits one turn, so you can make it longer.':(fine?'Arrows move the cursor, Space grabs a letter, an arrow swaps it. ':'Tap two neighbouring letters, or drag one, to swap. ')+moves+' of 25 swaps left.'}
function loop(t){const dt=Math.min(50,t-last||16);last=t;if(run){time+=dt;if(ph==1&&p&&!busy){acc+=dt;if(acc>=(soft?35:speed())){acc=0;step()}}}draw(dt);hud();requestAnimationFrame(loop)}
const cellAt=e=>{const b=cv.getBoundingClientRect(),c=Math.floor((e.clientX-b.left)/b.width*C),r=Math.floor((e.clientY-b.top)/b.height*R);return r>=0&&r<R&&c>=0&&c<C&&g[r][c]?[r,c]:null},adj=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])==1;
cv.onpointerdown=e=>{if(!run||ph!=2||busy)return;const q=cellAt(e);if(!q)return;kc=null;kgrab=false;if(sel&&adj(sel,q)){doSwap(sel,q)}else sel=q;drag=q};
cv.onpointermove=e=>{if(!drag||busy)return;const q=cellAt(e);if(q&&adj(drag,q)){const d=drag;drag=null;doSwap(d,q)}};cv.onpointerup=cv.onpointerleave=()=>drag=null;
/* ---- controls: the on-screen buttons and the keyboard drive the SAME actions and light up together ---------- */
const ACT={bl:()=>ph==1?mv(-1):kcur(0,-1),br:()=>ph==1?mv(1):kcur(0,1),bu:()=>ph==1?rot():kcur(-1,0),bd2:()=>ph==1?(soft=true):kcur(1,0)};
const hold={};
function press(id){if(hold[id])return;const h=hold[id]={};$(id).classList.add('on');ACT[id]();
if(id!='bu'&&!(id=='bd2'&&ph==1))h.t=setTimeout(()=>h.iv=setInterval(()=>ACT[id](),id=='bd2'?60:65),id=='bd2'?170:160)}
function release(id){const h=hold[id];if(!h)return;clearTimeout(h.t);clearInterval(h.iv);delete hold[id];$(id).classList.remove('on');if(id=='bd2')soft=false}
Object.keys(ACT).forEach(id=>{const b=$(id);b.onpointerdown=e=>{e.preventDefault();press(id)};b.onpointerup=b.onpointerleave=b.onpointercancel=()=>release(id)});
const KEYS={ArrowLeft:'bl',a:'bl',A:'bl',ArrowRight:'br',d:'br',D:'br',ArrowUp:'bu',w:'bu',W:'bu',ArrowDown:'bd2',s:'bd2',S:'bd2'};
onkeydown=e=>{const k=e.key;if($('ov').style.display=='flex'){if(k=='Enter'||k==' '){e.preventDefault();$('go').click()}else if(k=='Escape'&&document.body.classList.contains('paused'))pause();else if(k=='v'||k=='V')cycleVoice();return}
if(e.ctrlKey||e.metaKey||e.altKey)return;
if(KEYS[k]){e.preventDefault();if(!e.repeat)press(KEYS[k])}
else if(k==' '||k=='Enter'){e.preventDefault();if(!e.repeat){ph==1?press('bu'):grab()}}
else if(k=='p'||k=='P'||k=='Escape')pause();else if(k=='v'||k=='V')cycleVoice()};
onkeyup=e=>{const k=e.key;if(KEYS[k])release(KEYS[k]);else if(k==' '||k=='Enter')release('bu')};
onblur=()=>Object.keys(hold).forEach(release);
function setTheme(n){night=n;document.body.className=(n?'night':'day')+(document.body.classList.contains('paused')?' paused':'');$('mn').textContent=n?'NIGHT':'DAY';$('mn').style.color=n?'#ffc400':'#e07a00'}
$('ts').onclick=()=>setTheme(false);$('tm').onclick=()=>setTheme(true);$('mode').onclick=()=>setTheme(!night);
const SPK='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 4V5L7 9H3z"/>',sndI=()=>$('snd').innerHTML=SPK+(snd?'<path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/>':'<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')+'</svg>';
let holdT,longHit=false;$('snd').onpointerdown=()=>{longHit=false;holdT=setTimeout(()=>{longHit=true;cycleVoice()},650)};$('snd').onpointerup=$('snd').onpointerleave=()=>clearTimeout(holdT);
$('snd').onclick=()=>{if(longHit){longHit=false;return}snd=!snd;ls.set('guess-snd',snd?1:0);sndI()};sndI();
function pause(){if(!started)return;if(!run&&!document.body.classList.contains('paused'))return;if(run){run=false;document.body.classList.add('paused');show('Paused','Take a breath, then jump back in.','Resume')}else{run=true;document.body.classList.remove('paused');$('ov').style.display='none'}}
$('pz').onclick=pause;$('go').onclick=()=>{if(!started||$('oh').textContent=='Game over'){started=true;begin()}else pause()};
/* Two stage layouts, picked by window shape: 'port' (720x1080: phones, tall windows) and 'land' (1280x720: PC, laptop,
   tablet landscape). The stage is scaled to fit; the board is sized per layout so it fills the available height. */
const LAY={port:{w:720,h:1080,box:[152,134,416,676],cp:chunky?40:26},land:{w:1280,h:720,box:[214,84,400,624],cp:chunky?39:24}};let lay='port',CP=CS;
function fit(){const d=document.documentElement,vw=d.clientWidth||innerWidth,vh=d.clientHeight||innerHeight;lay=vw/vh>=1.25?'land':'port';const L=LAY[lay],st=$('st');CP=L.cp;
st.className=lay;st.style.width=L.w+'px';st.style.height=L.h+'px';const[bx,by,bw,bh]=L.box;cv.style.width=C*CP+'px';cv.style.height=R*CP+'px';cv.style.left=bx+(bw-C*CP)/2+'px';cv.style.top=by+(bh-R*CP)/2+'px';
st.style.transform='scale('+Math.min(vw/L.w,vh/L.h)+') translate(-50%,-50%)';fxSize()}onresize=fit;
/* cursor glitter: a handful of tiny blue-violet specks at the exact click / tap point (skipped if the system asks for reduced motion) */
const fx=$('fx'),F=fx.getContext('2d'),SP=[],calm=matchMedia('(prefers-reduced-motion:reduce)').matches,TINT=['#7eb2ff','#9a8bff','#b98cff','#8fd8ff','#c9b3ff'];let fxRun=false,fxBeat=0,fxLast=0;
function fxSize(){const d=devicePixelRatio||1;fx.width=innerWidth*d;fx.height=innerHeight*d;F.setTransform(d,0,0,d,0,0)}
function glitter(x,y){if(calm||SP.length>120)return;for(let i=0;i<9;i++){const a=Math.random()*6.283,v=.015+Math.random()*.04,l=380+Math.random()*200;SP.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-.01,l,m:l,s:1.4+Math.random()*1.8,c:TINT[i%5],ph:Math.random()*6})}if(!fxRun||performance.now()-fxBeat>300){fxRun=true;fxLast=performance.now();fxLoop(fxLast)}}   /* first frame is drawn instantly, the rest by requestAnimationFrame */
function fxLoop(t){fxBeat=performance.now();const dt=Math.min(40,t-fxLast||16);fxLast=t;F.clearRect(0,0,innerWidth,innerHeight);
for(let i=SP.length-1;i>=0;i--){const q=SP[i];q.l-=dt;if(q.l<=0){SP.splice(i,1);continue}q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.985;q.vy*=.985;const a=q.l/q.m*(.65+.35*Math.sin(t*.03+q.ph)),r=q.s*(.5+.5*q.l/q.m);
F.globalAlpha=Math.max(0,a);F.fillStyle=F.shadowColor=q.c;F.shadowBlur=6;F.beginPath();F.moveTo(q.x,q.y-r*1.8);F.lineTo(q.x+r*.5,q.y);F.lineTo(q.x,q.y+r*1.8);F.lineTo(q.x-r*.5,q.y);F.closePath();F.moveTo(q.x-r*1.8,q.y);F.lineTo(q.x,q.y+r*.5);F.lineTo(q.x+r*1.8,q.y);F.lineTo(q.x,q.y-r*.5);F.closePath();F.fill()}
F.globalAlpha=1;if(SP.length)requestAnimationFrame(fxLoop);else{fxRun=false;F.clearRect(0,0,innerWidth,innerHeight)}}
addEventListener('pointerdown',e=>{if(e.isPrimary)glitter(e.clientX,e.clientY)},true);fit();
g=emptyGrid();nx=mk();drawNext();
show('Guess','Pairs of letters fall like Tetris. Rotate and stack them so letters spell real words. When the stack tops out, swap neighbouring letters to clear it.','Play');
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
/* optional: your own extra words in extra-words.txt (2-6 letters) */
fetch('extra-words.txt').then(r=>r.ok?r.text():'').then(s=>s.split('\n').filter(l=>l[0]!='#').join(' ').toLowerCase().split(/\s+/).forEach(x=>/^[a-z]{2,6}$/.test(x)&&W.add(x))).catch(()=>{});
/* small hook used by the automated tests in tools/ */
window.G={fill(n){for(let r=R-n;r<R;r++)for(let c=0;c<C;c++)if(Math.random()<.85)g[r][c]={ch:pick(),col:Math.random()*6|0,dy:0,dx:0,fl:0}},put(r,c,ch){g[r][c]={ch,col:Math.random()*6|0,dy:0,dx:0,fl:0}},swap:enterSwap,theme:setTheme,p:()=>p,g:()=>g,dims:{C,R,CS},W,voices:()=>VOICES.map(v=>v.name),get lay(){return lay},get cp(){return CP},get moves(){return moves},get ph(){return ph}};
requestAnimationFrame(loop);
