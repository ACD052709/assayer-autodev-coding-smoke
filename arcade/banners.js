import {el} from "./core.js";
let config=null, current="", loaded=false;
function render(){
  const home=el("ad-home"), game=el("ad-game");
  home.hidden=true;game.hidden=true;
  if(!config||arcade.demo||["account","scores"].includes(current))return;
  const host=current==="home"||!current?home:game;
  host.hidden=false;
  if(host.querySelector("ins"))return;
  const label=document.createElement("span");label.textContent="Advertisement";
  const ad=document.createElement("ins");ad.className="adsbygoogle";ad.style.display="block";
  ad.dataset.adClient=config.client;ad.dataset.adSlot=host===home?config.home:config.game;
  ad.dataset.adFormat="horizontal";ad.dataset.fullWidthResponsive="true";host.replaceChildren(label,ad);
  if(!loaded){
    loaded=true;const script=document.createElement("script");script.async=true;script.crossOrigin="anonymous";
    script.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+encodeURIComponent(config.client);document.head.append(script);
  }
  (window.adsbygoogle=window.adsbygoogle||[]).push({});
}
export function bannerRoute(name){current=name;render();}
if(!arcade.demo){
  fetch("/api/placements",{credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(data=>{
    if(!data?.client)return;
    // Publisher activation follows site approval and consent configuration. Where a
    // consent platform is required, its readiness is a prerequisite to loading ads.
    if(data.needsConsent){
      if(typeof window.__tcfapi!=="function")return;
      window.__tcfapi("addEventListener",2,(tc,ok)=>{
        if(ok && ["tcloaded","useractioncomplete"].includes(tc?.eventStatus) && (tc.gdprApplies===false || (tc.gdprApplies===true && tc.purpose?.consents?.[1] && tc.vendor?.consents?.[755]))){config=data;render();}
        else {config=null;render();}
      });
    }else{config=data;render();}
  }).catch(()=>{});
}
