import {el,node,button,readData,saveData,routeInfo,shareControls,gameUrl} from "./core.js";
import {refreshUnlocks,catalog,bonusRoute} from "./bonus.js";
const worth={circuit:1,orbit:1,switchyard:5,cargo:1,merge:1,slipstream:1,letterlift:1,thread:4,dial:3,sum:2,trail:3,pairs:4,code:4};
let player=readData("club-player-v1"),ready,draining=false,accountMode="register",boardRequest=0;
const known=new Set();
function pending(){return readData("club-pending-v1",[]);}
function scopeMatch(entry){return entry.owner===null || entry.owner===player?.id;}
async function request(path,body) {
  const opt=body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)};
  const response=await fetch("/api/"+path,{...opt,credentials:"same-origin",cache:"no-store"});
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||"The score service is unavailable.");error.status=response.status;throw error;}
  return data;
}
function reflect(){
  const old=arcade.total||0;
  arcade.total=(player?.points||0)+pending().filter(scopeMatch).reduce((n,entry)=>n+worth[entry.game],0);
  document.querySelectorAll("[data-points]").forEach(e=>{e.textContent=String(arcade.total);});
  el("home-identity").textContent=player?.handle?"Playing as @"+player.handle:"Playing as a guest";
  el("welcome-account").textContent=player?.handle?"My account":"Sign in or create account";
  refreshUnlocks();
  const route=routeInfo();
  if(catalog[route.name]&&old<catalog[route.name].cost&&arcade.total>=catalog[route.name].cost&&el("bonus-share-"+route.name)?.hidden)bonusRoute(route.name,route.params);
}
function accept(p){player=p;saveData("club-player-v1",p);reflect();}
function ensure(){
  if(!ready)ready=(async()=>{let data=await request("me");if(!data.player)data=await request("guest",{});accept(data.player);return data.player;})().catch(e=>{ready=null;throw e;});
  return ready;
}
async function flush() {
  if(draining||arcade.demo)return;
  draining=true;
  try{
    await ensure();
    for(let entry=pending().find(scopeMatch);entry;entry=pending().find(scopeMatch)){
      const result=await request("award",{game:entry.game,mark:entry.mark,owner:player.id});
      if(result.id!==player.id)break;
      saveData("club-pending-v1",pending().filter(x=>x.key!==entry.key));
      accept({...player,points:result.points});
    }
  }catch(error){if(error.status===401||error.status===409)ready=null;}finally{draining=false;}
}
window.addEventListener("arcade:award",event=>{
  if(arcade.demo)return;
  const {game,mark}=event.detail;
  if(!Object.hasOwn(worth,game))return;
  const key=(player?.id??"guest")+"|"+game+"|"+mark;
  if(known.has(key)||pending().some(x=>x.key===key))return;
  known.add(key);saveData("club-pending-v1",[...pending(),{key,owner:player?.id??null,game,mark}]);reflect();flush();
});
window.addEventListener("online",flush);
window.addEventListener("storage",event=>{if(event.key?.includes("club-")){player=readData("club-player-v1");ready=null;reflect();}});
function field(form,id,title,type,value,autocomplete) {
  const label=node("label",title);label.htmlFor=id;const input=node("input");input.id=id;input.type=type;input.value=value||"";if(autocomplete)input.autocomplete=autocomplete;form.append(label,input);return input;
}
function checkbox(form,checked) {
  const label=node("label",undefined,"checkbox-line"),input=node("input");input.type="checkbox";input.checked=checked;
  label.append(input,document.createTextNode("Show my score publicly and let friends find me by username"));form.append(label);return input;
}
function statusLine(){const n=node("p","","form-status");n.setAttribute("role","status");return n;}
async function passwordProof(handle,password) {
  const te=new TextEncoder(),key=await crypto.subtle.importKey("raw",te.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:te.encode("Minute Arcade credential v1/"+handle.toLowerCase()),iterations:600000,hash:"SHA-256"},key,256);
  return [...new Uint8Array(bits)].map(n=>n.toString(16).padStart(2,"0")).join("");
}
function accountView(message="") {
  const box=el("account-panel");box.replaceChildren();const status=statusLine();status.textContent=message;
  const form=node("form",undefined,"account-form");
  if(player?.handle){
    box.append(node("h2","@"+player.handle),node("p","Your points and unlocks follow this account across devices."));
    const nick=field(form,"nick","Nickname","text",player.nickname,"nickname");nick.maxLength=28;
    const vis=checkbox(form,player.public),submit=node("button","Save profile","button mint");submit.type="submit";form.append(submit);
    form.addEventListener("submit",async e=>{e.preventDefault();submit.disabled=true;try{const res=await request("settings",{nickname:nick.value,public:vis.checked});accept(res.player);status.textContent="Profile saved.";}catch(err){status.textContent=err.message;}finally{submit.disabled=false;}});
    box.append(form,status);
    if(player.public){const share=node("div",undefined,"share-slot");shareControls(share,()=>({title:"My Minute Arcade score",text:"Compare Arcade Points with @"+player.handle+".",url:gameUrl("scores",{friend:player.handle})}),"Share my score");box.append(share);}
    box.append(button("Sign out","button outline",async()=>{try{await flush();await request("logout",{});ready=null;accept(null);await ensure();accountView("You’re playing as a guest.");}catch(err){status.textContent=err.message;}}));
    return;
  }
  const register=accountMode==="register";
  box.append(node("h2",register?"Create a player account":"Sign in"),node("p","Play as a guest for as long as you like. An account keeps points across devices. No email address or real name is needed."));
  const handle=field(form,"acct-name","Unique username","text","","username");handle.required=true;handle.pattern="[A-Za-z0-9_]{3,20}";handle.minLength=3;handle.maxLength=20;handle.autocapitalize="none";handle.spellcheck=false;handle.title="3–20 letters, numbers or underscores";
  const password=field(form,"acct-pass",register?"Password · at least 12 characters":"Password","password","",register?"new-password":"current-password");password.required=true;password.maxLength=128;if(register)password.minLength=12;
  let nickname,vis;
  if(register){nickname=field(form,"acct-nick","Nickname (optional, others can use the same one)","text","","nickname");nickname.maxLength=28;vis=checkbox(form,false);}
  const submit=node("button",register?"Create account":"Sign in","button mint");submit.type="submit";form.append(submit);
  form.addEventListener("submit",async e=>{
    e.preventDefault();submit.disabled=true;status.textContent=register?"Creating your account…":"Signing in…";
    const name=handle.value.trim().toLowerCase();
    try{
      await ensure();await flush();
      if(pending().some(scopeMatch)){status.textContent="Your latest points are still syncing. Try again in a moment.";return;}
      const proof=await passwordProof(name,password.value);
      const res=await request(register?"register":"login",{handle:name,proof,nickname:nickname?.value||name,public:vis?.checked===true});
      password.value="";accept(res.player);ready=Promise.resolve(player);accountView(register?"Account created. Your guest points came with you.":"Signed in. Your points are ready.");
    }catch(err){status.textContent=err.message;}finally{submit.disabled=false;}
  });
  const toggle=button(register?"Already have an account? Sign in":"Create an account","copy-link",()=>{accountMode=register?"login":"register";accountView();});
  const guest=node("a","Keep playing as guest","back game-home");guest.href="#";
  box.append(form,status,toggle,guest);
}
const titles=["Arcade Champion","Grandmaster","Ace"];
async function rankings(friend=""){
  const seq=++boardRequest,list=el("rank-list");el("friend-name").value=friend;
  list.replaceChildren(node("li","Loading scores…"));
  try{
    const [res,me]=await Promise.all([request("board"+(friend?"?player="+encodeURIComponent(friend):"")),request("me")]);
    if(seq!==boardRequest)return;
    if(me.player)accept(me.player);
    const rank=el("my-rank");
    rank.textContent=player?.handle?(player.public?(player.place?"Global #"+player.place:"Earn a point to enter the rankings.")+(player.decile?" · Top "+player.decile+"% last week":""):"Your score is private."):"Guest score · Create an account to join the rankings.";
    list.replaceChildren();for(const row of res.rows){
      const li=node("li",undefined,row.place<=10?"top-ten":"");li.append(node("span","#"+row.place,"place"),node("strong",row.nickname+" (@"+row.handle+")"));
      if(row.place<=3)li.append(node("small",titles[row.place-1],"rank-title"));if(row.decile)li.append(node("small","Top "+row.decile+"% last week"));li.append(node("b",row.points+" pts"));list.append(li);
    }
    if(!res.rows.length)list.append(node("li","No public scores yet. Earn points and opt in to take the first spot."));
    const f=res.friend;
    el("friend-result").textContent=friend?(f?f.nickname+" (@"+f.handle+") has "+f.points+" points. You have "+arcade.total+". "+(f.points===arcade.total?"You’re tied.":Math.abs(f.points-arcade.total)+" points apart.")+(f.place?" Global #"+f.place+".":"")+(f.decile?" Top "+f.decile+"% last week.":""):"No public player found with that username."):"";
  }catch{if(seq===boardRequest)list.replaceChildren(node("li","The rankings could not load. Open Rankings again to retry."));}
}
el("friend-form").addEventListener("submit",e=>{e.preventDefault();rankings(el("friend-name").value.trim().toLowerCase());});
export function clubRoute(name,params) {
  if(arcade.demo)return;
  if(name==="account"){accountView();ensure().then(()=>{if(routeInfo().name==="account"&&!el("account-panel").contains(document.activeElement))accountView();}).catch(()=>{});}
  if(name==="scores")rankings(params.get("friend")||"");
}
if(!arcade.demo){
  let day=Math.floor(Date.now()/86400000);
  const checkDay=()=>{const now=Math.floor(Date.now()/86400000);if(now!==day){day=now;refreshUnlocks();if(routeInfo().name==="scores")rankings(el("friend-name").value);}};
  setInterval(checkDay,60000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkDay();});
  reflect();ensure().then(flush).catch(()=>{});setInterval(()=>{if(!document.hidden&&pending().some(scopeMatch))flush();},15000);}
