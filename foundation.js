"use strict";
const arcade = (() => {
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  if(demo) document.documentElement.classList.add("demo-mode");
  const memory = new Map();
  const local = {getItem(key){if(!demo){try{return localStorage.getItem(key);}catch{}}return memory.get(key)??null;},setItem(key,value){memory.set(key,String(value));if(!demo){try{localStorage.setItem(key,String(value));}catch{}}}};
  const rounds={}, seeds={}, initial={}, reserved={};
  function start(game) {
    const [name,qs]=location.hash.slice(1).split("?");
    const shared=new URLSearchParams(qs).get("s");
    let seed = name===game && /^[a-z0-9]{1,7}$/.test(shared||"") ? parseInt(shared,36) : (reserved[game] ?? crypto.getRandomValues(new Uint32Array(1))[0]);
    delete reserved[game];
    seed=seed>>>0; seeds[game]=initial[game]=seed; rounds[game]=crypto.randomUUID();
  }
  function roll(game){if(!(game in seeds))start(game);seeds[game]=(Math.imul(seeds[game],1664525)+1013904223)>>>0;return seeds[game]/4294967296;}
  let audio,enabled=local.getItem("ma-sound")!=="off", lastTone=0;
  function tone(kind="point"){
    if(!enabled||demo||!audio||audio.state!=="running")return;
    const time=audio.currentTime;if(time-lastTone<.085)return;lastTone=time;
    const notes=kind==="gold"?[740,988]:kind==="win"?[440,554,660]:kind==="merge"?[392,523]:kind==="miss"?[220]:[465];
    notes.forEach((hz,i)=>{const osc=audio.createOscillator(), gain=audio.createGain(),t=time+i*.055;osc.type="sine";osc.frequency.value=hz;gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.035,t+.009);gain.gain.exponentialRampToValueAtTime(.0001,t+.13);osc.connect(gain).connect(audio.destination);osc.start(t);osc.stop(t+.15);});
  }
  function unlockAudio(){if(!demo&&enabled){try{const C=window.AudioContext||window.webkitAudioContext;if(C){audio ||= new C();if(audio.state==="suspended")audio.resume().catch(()=>{});}}catch{}}}
  for(const name of ["pointerdown","keydown"])document.addEventListener(name,unlockAudio,{passive:true});
  function setSound(){const control=document.getElementById("sound-toggle");control.textContent=enabled?"Sound on":"Sound off";control.setAttribute("aria-pressed",String(enabled));}
  document.getElementById("sound-toggle").addEventListener("click",()=>{enabled=!enabled;local.setItem("ma-sound",enabled?"on":"off");unlockAudio();setSound();if(enabled)tone();});setSound();
  function point(game,stage,key,kind="point"){if(demo)return;if(!rounds[game])start(game);tone(kind);window.dispatchEvent(new CustomEvent("arcade:award",{detail:{game,mark:String(key??rounds[game])+"."+stage}}));}
  function orbitCurve(score){const base=Math.min(10,score),later=Math.max(0,score-10);return {speed:1.9+base*.23+1.35*(1-Math.exp(-later/25)),width:.52-base*.025-.085*(1-Math.exp(-later/28))};}
  return {demo,local,start,roll,point,tone,orbitCurve,shareSeed:(game)=>{const [name,query]=location.hash.slice(1).split("?");const value=new URLSearchParams(query).get("s");return initial[game] ?? (reserved[game] ??= name===game && /^[a-z0-9]{1,7}$/.test(value||"") ? parseInt(value,36)>>>0 : crypto.getRandomValues(new Uint32Array(1))[0]);},clearSeed:(game)=>{delete initial[game];delete reserved[game];},route:"home"};
})();
window.arcade=arcade;
