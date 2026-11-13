import { useEffect, useRef, useState } from "react";
import type { BoothModel } from "./useBooth";

export function usageDevice(){
 const ua=navigator.userAgent,ipad=/iPad/.test(ua)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1;
 const os=ipad||/iPhone|iPod/.test(ua)?"iOS/iPadOS":/Android/.test(ua)?"Android":/Windows/.test(ua)?"Windows":/Mac/.test(ua)?"macOS":/Linux/.test(ua)?"Linux":"Unknown";
 const type=ipad||/Tablet|Android(?!.*Mobile)/.test(ua)?"Tablet":/iPhone|iPod|Mobile/.test(ua)?"Mobile":os==="Unknown"?"Unknown":"Desktop";
 const match=[/(Edg|EdgiOS|EdgA)\/([\d.]+)/,/(OPR)\/([\d.]+)/,/(Firefox|FxiOS)\/([\d.]+)/,/(CriOS|Chrome)\/([\d.]+)/].map(pattern=>ua.match(pattern)).find(Boolean);
 const names:Record<string,string>={Edg:"Edge",EdgiOS:"Edge",EdgA:"Edge",OPR:"Opera",Firefox:"Firefox",FxiOS:"Firefox",CriOS:"Chrome",Chrome:"Chrome"};
 const browser=match?`${names[match[1]]} ${match[2]}`:/Safari/.test(ua)?`Safari ${ua.match(/Version\/([\d.]+)/)?.[1]||""}`.trim():"Unknown";
 return {os,type,browser,installed:matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true};
}

export function useLightUsage(booth:BoothModel,kiosk:boolean){
 const [visitId]=useState(()=>crypto.randomUUID());
 const latest=useRef({booth,kiosk});latest.current={booth,kiosk};
 const camera=useRef<Record<string,string|number>>({});
 const queue=useRef(()=>{});
 useEffect(()=>{
  if(!booth.lightLicense.enabled||!booth.lightLicense.loaded||!booth.lightLicense.identityId)return;
  let alive=true,inFlight=false,lastSent=0,pending:ReturnType<typeof setTimeout>|undefined;
  async function send(){
   pending=undefined;
   if(!alive||inFlight||!navigator.onLine||document.visibilityState!=="visible")return;
   inFlight=true;lastSent=Date.now();const {booth:b,kiosk}=latest.current;
   try{await b.lightLicense.reportUsage({visitId,mode:kiosk?"kiosk":"settings",device:usageDevice(),camera:{...camera.current,active:b.camera&&b.cameraReady},printer:{queue:b.printMethod==="airprint"?"":b.printer,profile:b.printMethod==="airprint"?"":b.profile}});}finally{inFlight=false;}
  }
  const schedule=()=>{if(pending)clearTimeout(pending);pending=setTimeout(()=>void send(),Math.max(0,15000-(Date.now()-lastSent)));};
  queue.current=schedule;schedule();
  const interval=setInterval(schedule,60000);
  window.addEventListener("online",schedule);window.addEventListener("pageshow",schedule);document.addEventListener("visibilitychange",schedule);
  return()=>{alive=false;queue.current=()=>{};clearInterval(interval);if(pending)clearTimeout(pending);window.removeEventListener("online",schedule);window.removeEventListener("pageshow",schedule);document.removeEventListener("visibilitychange",schedule);};
 },[booth.lightLicense.enabled,booth.lightLicense.loaded,booth.lightLicense.identityId,visitId]);
 useEffect(()=>{
  const stream=booth.video.current?.srcObject as MediaStream|null;
  const track=stream?.getVideoTracks?.()[0];
  if(track){const settings=track.getSettings();camera.current={...(track.label?{label:track.label.slice(0,160)}:{}),...(settings.width?{width:settings.width}:{}),...(settings.height?{height:settings.height}:{}),...(settings.facingMode?{facingMode:settings.facingMode}:{})};}
  queue.current();
 },[booth.camera,booth.cameraReady,booth.printer,booth.profile,booth.printMethod,kiosk]);
}
