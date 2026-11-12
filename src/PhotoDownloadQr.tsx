import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { LoaderCircle, QrCode } from "lucide-react";
import type { BoothModel } from "./useBooth";

type SharedPhoto = { qr: string; url: string; expiresAt: string };
export function PhotoDownloadQr({ booth: b }: { booth: BoothModel }) {
  const [selection,setSelection]=useState("photo-0"),[busy,setBusy]=useState(false);
  const [shared,setShared]=useState<SharedPhoto>(),[error,setError]=useState("");
  const generation=useRef(0),controller=useRef<AbortController|null>(null);
  const cache=useRef(new Map<string,SharedPhoto>());
  const source=selection==="receipt" ? b.preview : b.photos[Number(selection.slice(6))] || "";
  const expired=!!shared && Date.parse(shared.expiresAt)<=Date.now();
  useEffect(()=>{
    generation.current++;controller.current?.abort();setBusy(false);setShared(undefined);setError("");
    return ()=>{generation.current++;controller.current?.abort();};
  },[source]);
  async function share() {
    if(busy || !source || !b.online || !b.lightLicense.allowed)return;
    const cached=cache.current.get(source);
    if(cached && Date.parse(cached.expiresAt)>Date.now()){setShared(cached);return;}
    const token=++generation.current,abort=new AbortController();controller.current=abort;
    setBusy(true);setError("");setShared(undefined);
    try {
      const image=new Image();image.src=source;await image.decode();
      if(token!==generation.current)return;
      const canvas=document.createElement("canvas"),scale=Math.min(1,1800/Math.max(image.width,image.height));
      canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      const context=canvas.getContext("2d")!;context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value ? resolve(value) : reject(new Error("Could not prepare this image.")),"image/jpeg",0.93));
      if(token!==generation.current)return;
      const slot=await b.lightLicense.reservePhotoDownload();
      if(token!==generation.current)return;
      const upload=new URL(slot.signedUploadUrl),link=new URL(slot.qrUrl);
      if(upload.protocol!=="https:" || !upload.hostname.endsWith(".supabase.co") || !upload.pathname.startsWith("/storage/v1/object/upload/sign/photobooth-downloads/") || link.origin!=="https://www.phototags.app" || !/^\/download\/[A-Za-z0-9_-]{4,64}$/.test(link.pathname))throw new Error("The photo service returned an invalid download link.");
      const timer=setTimeout(()=>abort.abort(),30000);
      try {
        const response=await fetch(slot.signedUploadUrl,{method:"PUT",headers:{"Content-Type":"image/jpeg"},body:blob,signal:abort.signal,credentials:"omit",cache:"no-store"});
        if(!response.ok)throw new Error("The photo could not be uploaded. Please try again.");
      } finally {clearTimeout(timer);}
      const qr=await QRCode.toDataURL(slot.qrUrl,{width:240,margin:2,errorCorrectionLevel:"M"});
      if(token!==generation.current)return;
      const result={qr,url:slot.qrUrl,expiresAt:slot.expiresAt};cache.current.set(source,result);setShared(result);
    } catch(e) {
      if(token===generation.current)setError(abort.signal.aborted ? "Upload timed out. Please reconnect and try again." : (e as Error).message);
    } finally {if(token===generation.current)setBusy(false);}
  }
  return <section className="photo-download-card" aria-labelledby="photo-download-heading">
    <h3 id="photo-download-heading"><QrCode size={20} aria-hidden="true" />Take a copy on your phone</h3>
    <label className="field">Image to download<select value={selection} onChange={e=>setSelection(e.target.value)} disabled={busy}>
      {b.photos.map((photo,index)=>photo && <option key={index} value={`photo-${index}`}>Photo {index+1}</option>)}
      <option value="receipt">Decorated receipt</option>
    </select></label>
    <p className="field-help">Uploads only the selected image to PhotoTags. Anyone with its link can download it for 30 minutes.</p>
    {shared && !expired ? <div className="photo-download-code"><img src={shared.qr} alt="Scan to download your selected photo" width="220" height="220" /><strong>Scan with your phone camera</strong><a href={shared.url} target="_blank" rel="noreferrer">Open download page</a><small>Available until {new Date(shared.expiresAt).toLocaleTimeString()}</small></div> : <button className="button button-secondary" disabled={busy || !b.online || !source || !b.complete || b.rendering || !b.lightLicense.enabled || !b.lightLicense.allowed} onClick={()=>void share()}>{busy ? <LoaderCircle className="spinner" size={18} aria-hidden="true" /> : <QrCode size={18} aria-hidden="true" />}{busy ? "Uploading image..." : expired ? "Get a new download QR" : "Get download QR"}</button>}
    <p role="status">{error || (!b.online ? "Online downloads need an internet connection. Local saving and printing are still available." : !b.lightLicense.enabled || !b.lightLicense.allowed ? "Activate a Light license to use online downloads." : "")}</p>
  </section>;
}
