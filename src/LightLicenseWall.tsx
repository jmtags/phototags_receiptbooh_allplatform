import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { LightLicenseSettings } from "./LightLicenseSettings";
import type { BoothModel } from "./useBooth";

export function LightLicenseWall({booth,onClose}:{booth:BoothModel;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const title=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const modal=dialog.current!;
    modal.showModal();title.current?.focus();
    return()=>{modal.close();if(previous?.isConnected)previous.focus();};
  },[]);
  return <dialog ref={dialog} className="light-activation-dialog" aria-labelledby="light-launch-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <header className="light-dialog-header">
      <div><span className="section-kicker">PhotoTags Light</span><h2 ref={title} tabIndex={-1} id="light-launch-title">Activate to launch your booth</h2></div>
      <button className="icon-button" aria-label="Close license wall" onClick={onClose}><X size={21} aria-hidden="true"/></button>
    </header>
    <div className="light-dialog-body"><p>{booth.lightLicense.trialAvailable&&!booth.lightLicense.trialUsed?"Start your free trial or activate a Light license to continue.":"Activate a Light license to continue."} Your booth opens automatically when access is ready.</p><LightLicenseSettings booth={booth}/></div>
  </dialog>;
}
