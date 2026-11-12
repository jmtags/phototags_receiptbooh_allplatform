import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { LoaderCircle, QrCode } from "lucide-react";
import type { BoothModel } from "./useBooth";

type SharedPhoto = { qr: string; url: string; expiresAt: string };
type UploadState = { busy: boolean; source?: string; shared?: SharedPhoto; error?: string };
export function PhotoDownloadQr({ booth: b }: { booth: BoothModel }) {
  const fallbackCache=useRef(new Map<string,SharedPhoto>());
  const cache=b.photoDownloadCache||fallbackCache.current;
  const assets=[{id:"receipt",label:"Decorated receipt",source:b.preview},...b.photos.flatMap((photo,index)=>photo?[{id:`raw-${index}`,label:b.photos.length===1?"Raw photo":`Raw photo ${index+1}`,source:photo}]:[])];
  return <section className="photo-download-card" aria-labelledby="photo-download-heading">
    <h3 id="photo-download-heading"><QrCode size={20} aria-hidden="true"/>Scan to keep your photos</h3>
    <div className="photo-download-grid">{assets.map(asset=><DownloadTile key={asset.id} source={asset.source} label={asset.label} booth={b} cache={cache}/>)}</div>
    {(!b.online||!b.lightLicense.enabled||!b.lightLicense.allowed)&&<p role="status">{!b.online?"Online downloads need an internet connection. Local saving and printing are still available.":"Activate a Light license to use online downloads."}</p>}
  </section>;
}
function DownloadTile({source,label,booth:b,cache}:{source:string;label:string;booth:BoothModel;cache:Map<string,SharedPhoto>}){
  const [state,setState]=useState<UploadState>({busy:false}),generation=useRef(0),controller=useRef<AbortController|null>(null);
  const ready=!!source&&b.online&&b.complete&&!b.rendering&&b.lightLicense.enabled&&b.lightLicense.allowed;
  const automatic=b.autoDownloadQr;
  function cached(){const result=cache.get(source);return result&&Date.parse(result.expiresAt)>Date.now()?result:undefined;}
  useEffect(()=>{
    const token=++generation.current;controller.current?.abort();
    const saved=cached();setState({busy:false,shared:saved,source});
    if(automatic&&ready&&!saved)void upload(token);
    return()=>{generation.current++;controller.current?.abort();};
  },[source,ready,automatic]);
  async function upload(token=++generation.current){
    if(!ready)return;
    const saved=cached();if(saved){setState({busy:false,shared:saved,source});return;}
    const abort=new AbortController();controller.current=abort;setState({busy:true,source});
    try{
      const image=new Image();image.src=source;await image.decode();if(token!==generation.current)return;
      const canvas=document.createElement("canvas"),scale=Math.min(1,1800/Math.max(image.width,image.height));
      canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      const context=canvas.getContext("2d")!;context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not prepare this image.")),"image/jpeg",0.93));
      if(token!==generation.current)return;
      const slot=await b.lightLicense.reservePhotoDownload();if(token!==generation.current)return;
      const target=new URL(slot.signedUploadUrl),link=new URL(slot.qrUrl);
      if(target.protocol!=="https:"||!target.hostname.endsWith(".supabase.co")||!target.pathname.startsWith("/storage/v1/object/upload/sign/photobooth-downloads/")||link.origin!=="https://www.phototags.app"||!/^\/download\/[A-Za-z0-9_-]{4,64}$/.test(link.pathname))throw new Error("Invalid photo download link.");
      const timer=setTimeout(()=>abort.abort(),30000);
      try{const response=await fetch(slot.signedUploadUrl,{method:"PUT",headers:{"Content-Type":"image/jpeg"},body:blob,signal:abort.signal,credentials:"omit",cache:"no-store"});if(!response.ok)throw new Error("Upload failed. Please retry.");}finally{clearTimeout(timer);}
      const qr=await QRCode.toDataURL(slot.qrUrl,{width:240,margin:2,errorCorrectionLevel:"M"});if(token!==generation.current)return;
      const shared={qr,url:slot.qrUrl,expiresAt:slot.expiresAt};cache.set(source,shared);setState({busy:false,shared,source});
    }catch(e){if(token===generation.current)setState({busy:false,source,error:abort.signal.aborted?"Upload timed out. Please retry.":(e as Error).message});}
  }
  const shared=state.source===source&&state.shared&&Date.parse(state.shared.expiresAt)>Date.now()?state.shared:undefined;
  return <div className="photo-download-tile" role="group" aria-label={label}>
    <strong>{label}</strong>
    {shared?<><img src={shared.qr} alt={`Scan to download ${label.toLowerCase()}`} width="160" height="160"/></>:state.busy?<div className="photo-download-pending" role="status"><LoaderCircle className="spinner" size={24} aria-hidden="true"/><span>Preparing QR...</span></div>:<><button className="button button-secondary" disabled={!ready} onClick={()=>void upload()}>{state.error?"Retry QR":"Get QR"}<span className="sr-only"> for {label.toLowerCase()}</span></button>{state.error&&<p role="status">{state.error}</p>}</>}
  </div>;
}
