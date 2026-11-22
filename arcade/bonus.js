import {el,node,button,randomStream,randomSeed,parseSeed,routeInfo,gameUrl,shareControls} from "./core.js";
export const catalog={
  sum:{name:"Sum Garden",cost:0,rule:"Pick two or three numbers that add up to the target, then check your sum.",art:"4 + 7",color:"lime"},
  trail:{name:"Star Trail",cost:15,rule:"Tap the stars from 1 to 12 in order. Each wrong tap adds two seconds.",art:"✦ · ✦",color:"ice"},
  pairs:{name:"Pocket Pairs",cost:35,rule:"Turn over two cards at a time and find all six matching pairs in as few turns as possible.",art:"◇  ◇",color:"rose"},
  code:{name:"Vault Code",cost:60,rule:"Crack a three-gem code in eight guesses. Clues count gems in the right spot and gems in another spot. Colors may repeat.",art:"◆ ● ▲",color:"apricot"}
};
export const shapes=["◆","●","▲","■","★","✚"];
const names=["diamond","circle","triangle","square","star","plus"];
function daily() {const day=Math.floor(Date.now()/86400000);return {game:Object.keys(catalog)[day%4], seed:Math.imul(day,2654435761)>>>0};}
function qualify(game,params) {
  return arcade.demo || (arcade.total||0)>=catalog[game].cost || (params.get("visit")==="friend" && parseSeed(params.get("s"))!==null) || daily().game===game;
}
export function codeFeedback(secret,guess) {
  const a=[],b=[];let exact=0,other=0;
  secret.forEach((v,i)=>{if(v===guess[i])exact++;else{a.push(v);b.push(guess[i]);}});
  b.forEach(v=>{const j=a.indexOf(v);if(j>=0){other++;a.splice(j,1);}});
  return {exact,other};
}
let game="",seed,round=0,board,state,frozen=false,clock=0,flipTimer=0;
function generate(){
  const rng=randomStream((seed^Math.imul(round+1,0x9e3779b9))>>>0);
  if(game==="sum"){
    const values=Array.from({length:9},()=>1+Math.floor(rng.next()*9));
    const solution=rng.shuffle([0,1,2,3,4,5,6,7,8]).slice(0,2+Math.floor(rng.next()*2));
    return {values,solution,target:solution.reduce((n,i)=>n+values[i],0)};
  }
  if(game==="trail")return {values:rng.shuffle(Array.from({length:12},(_,i)=>i+1))};
  if(game==="pairs")return {values:rng.shuffle([0,0,1,1,2,2,3,3,4,4,5,5])};
  return {values:Array.from({length:3},()=>Math.floor(rng.next()*4))};
}
function fresh(){
  clearTimeout(flipTimer);clearInterval(clock);
  board=generate();state={selected:[],matched:[],rows:[],next:1,mistakes:0,started:0,turns:0,done:false,won:false,elapsed:0,note:""};frozen=false;draw();
}
function frame(game) {return el("bonus-"+game);}
function showNote(text){state.note=text;const line=frame(game).querySelector(".bonus-note");if(line)line.textContent=text;}
function finished(won,note) {
  state.done=true;state.won=won;state.note=note;clearInterval(clock);
  if(won)arcade.point(game,"win",seed.toString(36)+"."+round,"win");
}
function cell(label,action,cls="") {return button(label,"choice bonus-cell "+cls,action);}
function clockText() {
  const seconds=state.done?state.elapsed:state.started?(performance.now()-state.started)/1000+2*state.mistakes:0;
  return seconds.toFixed(1)+" s";
}
function pick(i){
  if(state.done||frozen)return;
  if(game==="sum"){
    const selected=state.selected;
    if(selected.includes(i))state.selected=selected.filter(j=>j!==i);
    else if(selected.length<3)selected.push(i);else return showNote("Choose at most three. Tap a selected number to remove it.");
  }else if(game==="trail"){
    if(!state.started){
      state.started=performance.now();
      clock=setInterval(()=>{const t=frame(game)?.querySelector(".bonus-time");if(t)t.textContent=clockText();},100);
    }
    if(board.values[i]!==state.next){state.mistakes++;arcade.tone("miss");state.note="Look for "+state.next+". Two seconds added.";}
    else {state.next++;state.note="";if(state.next===13){state.elapsed=(performance.now()-state.started)/1000+2*state.mistakes;finished(true,"Trail complete in "+state.elapsed.toFixed(1)+" seconds.");}}
  }else if(game==="pairs"){
    if(state.selected.includes(i)||state.matched.includes(i))return;
    state.selected.push(i);
    if(state.selected.length===2){
      state.turns++;
      const [a,b]=state.selected;
      if(board.values[a]===board.values[b]){
        state.matched.push(a,b);state.selected=[];state.note="Pair found.";
        if(state.matched.length===12)finished(true,"All six pairs in "+state.turns+" turns.");
      }else{frozen=true;state.note="Different symbols. Remember their positions.";flipTimer=setTimeout(()=>{state.selected=[];frozen=false;draw();},700);}
    }
  }else if(state.selected.length<3)state.selected.push(i);
  draw();
}
function check(){
  if(state.done)return;
  if(game==="sum"){
    const total=state.selected.reduce((n,i)=>n+board.values[i],0);
    if(state.selected.length>=2&&total===board.target)finished(true,"Exactly "+total+"! Garden cleared.");
    else {state.note="Your selection totals "+total+". Pick two or three numbers for "+board.target+".";arcade.tone("miss");}
  }else if(game==="code"&&state.selected.length===3){
    const guess=[...state.selected], f=codeFeedback(board.values,guess);
    state.rows.push({guess,...f});state.selected=[];
    if(f.exact===3)finished(true,"Vault open in "+state.rows.length+" guesses.");
    else if(state.rows.length===8)finished(false,"The code was "+board.values.map(x=>shapes[x]).join(" ")+".");
    else state.note=f.exact+" in the right spot, "+f.other+" in another spot.";
  }
  draw();
}
function draw(){
  if(!game||!board)return;
  const host=frame(game), items=node("div",undefined,"bonus-grid "+game), heading=node("div",undefined,"bonus-readout"),actions=node("div",undefined,"game-actions");
  if(game==="sum"){
    heading.append(node("span","Target"),node("strong",String(board.target)),node("small","Selected total "+state.selected.reduce((n,i)=>n+board.values[i],0)));
    board.values.forEach((v,i)=>{const b=cell(String(v),()=>pick(i));b.setAttribute("aria-pressed",String(state.selected.includes(i)));b.disabled=state.done;items.append(b);});
    if(!state.done)actions.append(button("Check sum","button lime",check));
  }else if(game==="trail"){
    heading.append(node("span",state.done?"Time":"Next star"),node("strong",state.done?"✓":String(state.next)),node("small",clockText(),"bonus-time"));
    board.values.forEach((v,i)=>{const b=cell(String(v),()=>pick(i),v<state.next?"collected":"");b.disabled=v<state.next||state.done;items.append(b);});
  }else if(game==="pairs"){
    heading.append(node("span","Pairs found"),node("strong",state.matched.length/2+" / 6"),node("small",state.turns+" turns"));
    board.values.forEach((v,i)=>{const seen=state.matched.includes(i)||state.selected.includes(i);const b=cell(seen?shapes[v]:"?",()=>pick(i),seen?"gem-"+v:"");b.disabled=state.matched.includes(i)||state.done;b.setAttribute("aria-label","Card "+(i+1)+(seen?", "+names[v]:", face down"));items.append(b);});
  }else{
    heading.append(node("span","Your guess"),node("strong",[0,1,2].map(i=>shapes[state.selected[i]]??"·").join(" ")),node("small","Guess "+Math.min(8,state.rows.length+1)+" of 8"));
    for(let i=0;i<4;i++){const b=cell(shapes[i],()=>pick(i),"gem-"+i);b.setAttribute("aria-label",names[i]);b.disabled=state.done||state.selected.length===3;items.append(b);}
    if(!state.done){actions.append(button("Undo gem","button outline",()=>{state.selected.pop();draw();}));const submit=button("Check code","button apricot",check);submit.disabled=state.selected.length!==3;actions.append(submit);}
  }
  const history=node("div",undefined,"code-history");
  if(game==="code")state.rows.forEach(r=>history.append(node("div",r.guess.map(i=>shapes[i]).join(" ")+" · "+r.exact+" exact, "+r.other+" elsewhere")));
  if(state.done)actions.append(button("Next board","button "+catalog[game].color,()=>{round++;fresh();}));
  const note=node("p",state.note,"status bonus-note");note.setAttribute("role","status");
  host.replaceChildren(heading,items,history,actions,note);
}
function buildCards(){
  const cards=el("bonus-cards");
  for(const [id,info] of Object.entries(catalog)){
    const a=node("article",undefined,"card bonus-card "+id), art=node("div",info.art,"bonus-art");art.setAttribute("aria-hidden","true");
    const text=node("div",undefined,"card-info"),link=node("a","Play "+info.name,"button "+info.color);link.href="#"+id;link.dataset.bonusLink=id;
    text.append(node("h3",info.name),node("p",info.rule),link);a.append(art,text);cards.append(a);
    const section=node("section",undefined,"game-layout extended bonus-section");section.id=id;section.hidden=true;
    const infoBox=node("div",undefined,"game-info");const back=node("a","All games","back game-home");back.href="#";infoBox.append(back,node("h1",info.name),node("p",info.rule));
    const panel=node("div",undefined,"game-panel bonus-panel");const surface=node("div");surface.id="bonus-"+id;const share=node("div",undefined,"share-slot");share.id="bonus-share-"+id;
    panel.append(surface,share);section.append(infoBox,panel);el("main").append(section);
  }
}
buildCards();
export function refreshUnlocks(){
  const pick=daily();el("rotation-info").textContent=catalog[pick.game].name+" · A shared board, free to play today.";
  const a=el("rotation-link");a.href="#"+pick.game+"?s="+pick.seed.toString(36);a.textContent="Play "+catalog[pick.game].name;
  document.querySelectorAll("[data-bonus-link]").forEach(a=>{const g=a.dataset.bonusLink;a.textContent=qualify(g,new URLSearchParams())?"Play "+catalog[g].name:"Unlock at "+catalog[g].cost+" points";});
  const next=Object.values(catalog).find(e=>e.cost>(arcade.total||0));el("next-unlock").textContent=next?next.name+" unlocks at "+next.cost:"All games unlocked";
}
export function bonusRoute(name,params) {
  clearInterval(clock);clearTimeout(flipTimer);game=Object.hasOwn(catalog,name)?name:"";board=null;
  if(!game)return;
  el(game).hidden=false;
  const host=frame(game),shares=el("bonus-share-"+game);shares.hidden=false;
  if(!qualify(game,params)){
    host.replaceChildren(node("h2",catalog[game].cost+" Arcade Points to unlock"),node("p","You have "+(arcade.total||0)+". Try the demo or earn points in any open game."));
    const back=node("a","Pick another game","button");back.href="#";host.append(back);shares.hidden=true;return;
  }
  seed=parseSeed(params.get("s"))??randomSeed();round=/^\d{1,5}$/.test(params.get("r")||"")?Number(params.get("r")):0;
  shareControls(shares,()=>({title:catalog[game].name,text:"Try my "+catalog[game].name+" board.",url:gameUrl(game,{s:seed.toString(36),r:round,visit:"friend"})}));
  fresh();
}
if(arcade.demo)arcade.bonusDemo=()=>{
  if(!board||state.done)return null;
  if(game==="sum")return state.selected.length<board.solution.length?{cell:board.solution[state.selected.length]}:{check:true};
  if(game==="trail")return {cell:board.values.indexOf(state.next)};
  if(game==="pairs"){const index=state.selected.length?board.values.findIndex((v,i)=>v===board.values[state.selected[0]]&&i!==state.selected[0]):board.values.findIndex((v,i)=>!state.matched.includes(i));return {cell:index};}
  return state.selected.length<3?{cell:(board.values[state.selected.length]+(state.rows.length?0:1))%4}:{check:true};
};

let trailPause=0;window.addEventListener("arcade:suspend",e=>{if(game!=="trail"||!state?.started||state.done)return;if(e.detail)trailPause=performance.now();else if(trailPause){state.started+=performance.now()-trailPause;trailPause=0;}});
