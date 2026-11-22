import {el,node,button,routeInfo,shareControls,gameUrl} from "./core.js";
const classics={circuit:["Circuit","c-score"],orbit:["Orbit","o-score"],switchyard:["Switchyard","s-moves"],cargo:["Cargo Rush","g-score"]};
const rules={};
const pointRules={circuit:"1 per completed round",orbit:"1 per lock",switchyard:"5 per solved grid",cargo:"1 per three correct sorts",merge:"1 per scoring drop",slipstream:"1 per cleared gate",letterlift:"1 per new rung",thread:"4 per solved puzzle",dial:"3 per completed round",sum:"2 per board",trail:"3 per trail",pairs:"4 per board",code:"4 per cracked code"};
let frame=null,seeded=false,countdown=0,stopAt=0,activeDemo="",sizer;
function allRules(){
  for(const section of document.querySelectorAll("section.game-layout")){
    const id=section.id,info=section.querySelector(".game-info");rules[id]=info.querySelector("p").textContent;
    if(!arcade.demo){
      const demo=button("See demo","button demo-trigger",()=>openDemo(id));info.querySelector("h1").after(demo);
      const line=node("p",undefined,"arcade-earn"),total=node("b",String(arcade.total||0));total.dataset.points="";
      line.append(total,document.createTextNode(" Arcade Points · "+pointRules[id]));info.append(line);
      if(classics[id]){
        const share=node("div",undefined,"share-slot");section.querySelector(".game-panel").append(share);
        const target=node("p","","challenge");target.id="classic-target-"+id;target.hidden=true;info.append(target);
        shareControls(share,()=>{
          const [name,scoreId]=classics[id], key=arcade.shareSeed(id);
          const b=id==="switchyard"&&!arcade.switchSolved()?0:Number(el(scoreId).textContent)||0;
          return {title:name+" · Minute Arcade",text:b?"Try my "+name+" challenge. My result was "+b+".":"Try this "+name+" challenge.",url:gameUrl(id,{s:key.toString(36),b})};
        });
      }
    }
  }
}
function suspend(value) {arcade.suspended=value;window.dispatchEvent(new CustomEvent("arcade:suspend",{detail:value}));}
function stopClip(){
  clearInterval(countdown);
  if(frame?.contentWindow)frame.contentWindow.postMessage({type:"minute-demo-stop"},location.origin);
  el("demo-clock").textContent="Demo complete · 10 seconds";el("demo-replay").hidden=false;
}
function destroyClip(){clearInterval(countdown);sizer?.disconnect();sizer=null;frame?.remove();frame=null;}
function fit(){
  if(!frame)return;
  let panel;try{panel=frame.contentDocument?.querySelector("section.game-layout:not([hidden]) .game-panel");}catch{}
  if(!panel)return;
  const h=Math.max(150,Math.ceil(panel.scrollHeight+12)),w=430,screen=el("demo-screen");
  const scale=Math.min(screen.clientWidth/w,Math.max(190,innerHeight*.53)/h,1);
  frame.style.width=w+"px";frame.style.height=h+"px";frame.style.transform="translateX(-50%) scale("+scale+")";screen.style.height=(h*scale)+"px";
}
function playClip(){
  destroyClip();seeded=false;
  el("demo-clock").textContent="Loading demo…";el("demo-replay").hidden=true;
  frame=node("iframe");frame.title=el("demo-title").textContent;frame.tabIndex=-1;
  const url=new URL(location.pathname,location.origin);url.searchParams.set("demo","1");url.hash=activeDemo+(activeDemo==="dial"?"?t=4":"?s=2r&k=p");
  frame.src=url.href;el("demo-screen").replaceChildren(frame);
}
function openDemo(id){
  activeDemo=id;el("demo-title").textContent=el(id).querySelector("h1").textContent+" demo";
  el("demo-rule").textContent=rules[id];suspend(true);el("demo-dialog").showModal();playClip();
}
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
let finger,running=false;
async function tap(element) {
  if(!running||!element||element.disabled)return;
  const pos=element.getBoundingClientRect();finger.style.left=pos.left+pos.width/2+"px";finger.style.top=pos.top+pos.height/2+"px";finger.classList.remove("touch");
  await delay(125);if(!running)return;finger.classList.add("touch");element.click();
}
async function playInside(){
  const name=routeInfo().name;
  finger=node("div","👆","demo-finger");finger.setAttribute("aria-hidden","true");document.body.append(finger);
  running=true;parent.postMessage({type:"minute-demo-ready"},location.origin);
  const select=s=>document.querySelector(s);
  await delay(300);
  let turn=0,switches=[];
  while(running){
    if(name==="circuit"){
      if(!turn)await tap(el("c-start"));else {const i=arcade.classicDemo.circuit();if(i!==null)await tap(el("tiles").children[i]);}
    }else if(name==="orbit"){if(!turn||arcade.classicDemo.orbit())await tap(el("o-start"));}
    else if(name==="switchyard"){if(!turn)switches=arcade.switchSolution();if(switches.length)await tap(el("switches").children[switches.shift()]);}
    else if(name==="cargo"){if(!turn)await tap(el("g-start"));else await tap(Number(el("g-crate").textContent)%2?el("g-odd"):el("g-even"));}
    else if(name==="merge"){await tap(turn===2?el("m-hold"):el("m-board").children[arcade.demoFuse()]);}
    else if(name==="slipstream"){if(!turn)await tap(el("d-action"));else {const d=arcade.demoSteer();if(d)await tap(d<0?el("d-left"):el("d-right"));}}
    else if(name==="letterlift"){
      const input=el("l-answer"),answer=arcade.demoWords().answer;
      if(answer&&!el("l-form").hidden){await tap(input);input.value=answer;await tap(select("#l-form button"));}
    }else if(name==="thread"){if(turn<2)await tap(el("t-next"));else await tap([...el("t-choices").children].find(b=>b.textContent===arcade.demoWords().connection));}
    else if(name==="dial"){
      const control=text=>[...el("w-content").querySelectorAll("button")].find(b=>b.textContent===text);
      const input=el("dial-clue");
      if(input){await tap(input);input.value="A neighborhood drum solo";await tap(control("Seal my clue"));}
      else if(control("Pass this phone"))await tap(control("Pass this phone"));
      else if(control("Lock in my guess")){await tap(control("7"));await tap(control("Lock in my guess"));}
      else if(control("Reveal together"))await tap(control("Reveal together"));
    }else{
      const choice=arcade.bonusDemo?.();if(choice){const host=el("bonus-"+name);
        if(choice.cell!==undefined)await tap(host.querySelector(".bonus-grid")?.children[choice.cell]);
        else if(choice.check)await tap([...host.querySelectorAll("button")].find(b=>/^Check/.test(b.textContent)));
      }
    }
    turn++;await delay(name==="orbit"?75:name==="slipstream"?170:name==="circuit"?220:name==="dial"?1150:650);
  }
}
allRules();
if(!arcade.demo){
  for(const button of document.querySelectorAll("[data-tutorial]"))button.addEventListener("click",()=>el("tutorial-dialog").showModal());
  for(const button of document.querySelectorAll("[data-close]"))button.addEventListener("click",()=>button.closest("dialog").close());
  el("demo-replay").addEventListener("click",playClip);
  el("demo-dialog").addEventListener("close",()=>{destroyClip();suspend(false);});
  window.addEventListener("message",event=>{
    if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
    if(event.data?.type==="minute-demo-close"){el("demo-dialog").close();return;}
    if(event.data?.type!=="minute-demo-ready"||seeded)return;
    seeded=true;stopAt=performance.now()+10000;fit();sizer=new ResizeObserver(fit);sizer.observe(el("demo-dialog"));
    countdown=setInterval(()=>{const left=Math.max(0,Math.ceil((stopAt-performance.now())/1000));el("demo-clock").textContent=left+" s left";fit();if(!left)stopClip();},125);
  });
}else{
  window.addEventListener("message",e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==="minute-demo-stop"){running=false;suspend(true);finger?.classList.remove("touch");}});
  window.addEventListener("keydown",e=>{if(e.key==="Escape")parent.postMessage({type:"minute-demo-close"},location.origin);});
  window.addEventListener("load",()=>{playInside().catch(()=>{});},{once:true});
}
export function demoRoute(name,params){
  if(arcade.demo)return;
  if(el("demo-dialog").open)el("demo-dialog").close();
  if(!classics[name])return;
  const line=el("classic-target-"+name), shared=/^[0-9a-z]{1,7}$/.test(params.get("s")||"");
  line.hidden=!shared;
  const b=/^\d{1,9}$/.test(params.get("b")||"")?Number(params.get("b")):0;
  line.textContent=b?(name==="switchyard"?"Your friend cleared this board in "+b+" moves.":"Your friend scored "+b+". Try the same challenge."):"Friend challenge · Play the same sequence.";
}
