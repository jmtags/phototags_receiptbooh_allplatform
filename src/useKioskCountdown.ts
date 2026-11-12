import {useEffect,useRef,useState} from "react";
export function useKioskCountdown(active:boolean,seconds:number,onReset:()=>void){
  const [remaining,setRemaining]=useState<number|null>(null),latest=useRef(onReset);latest.current=onReset;
  useEffect(()=>{
    if(!active || seconds===0){setRemaining(null);return;}
    const deadline=Date.now()+seconds*1000;let finished=false;
    const tick=()=>{if(finished)return;const value=Math.max(0,Math.ceil((deadline-Date.now())/1000));setRemaining(value);if(value===0){finished=true;latest.current();}};
    tick();const timer=setInterval(tick,250);window.addEventListener("focus",tick);document.addEventListener("visibilitychange",tick);
    return()=>{finished=true;clearInterval(timer);window.removeEventListener("focus",tick);document.removeEventListener("visibilitychange",tick);};
  },[active,seconds]);
  return remaining;
}
