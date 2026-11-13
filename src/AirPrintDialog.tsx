import { useEffect, useRef, useState } from "react";
import { Printer, X, ExternalLink } from "lucide-react";
import type { BoothModel } from "./useBooth";
import { airPrintPapers, photoSheet, printDocument } from "./airprint";
import "./airprint.css";

export function AirPrintDialog({ booth: b }: { booth: BoothModel }) {
  const modal = useRef<HTMLDialogElement>(null), frame = useRef<HTMLIFrameElement>(null);
  const [sheet, setSheet] = useState(""), [error, setError] = useState(""), [ready, setReady] = useState(false);
  const sent = useRef(false);
  useEffect(() => {
    const dialog = modal.current!; dialog.showModal();
    return () => { dialog.close(); };
  }, []);
  useEffect(() => {
    let active = true;
    photoSheet(b.airPrintImage, b.airPrintPaper).then(png => { if (active) setSheet(png); }).catch(() => { if (active) setError("Could not prepare the print sheet. Close and try again."); });
    return () => { active = false; };
  }, [b.airPrintImage, b.airPrintPaper]);
  useEffect(() => { if (!b.lightLicense.hasAccess()) b.closeAirPrint(); }, [b.lightLicense.allowed]);
  function openPrint(separatePage = false) {
    if (!sheet || !ready || sent.current) return;
    if (!b.lightLicense.hasAccess()) { setError("Your license has expired. Return to Settings to activate it."); return; }
    // Opening a fallback page must remain in this user gesture, before any async work.
    const target = separatePage ? window.open("", "_blank") : frame.current?.contentWindow;
    if (!target) { setError("The print page was blocked. Allow pop-ups for this app and try again."); return; }
    if (!b.beginAirPrint()) { if (separatePage) target.close(); setError("Could not start printing. Close this preview and check the message in Settings before trying again."); return; }
    sent.current = true;
    try {
      if (separatePage) {
        target.opener = null;
        target.document.open(); target.document.write(printDocument(sheet, b.airPrintPaper, true)); target.document.close();
        target.document.getElementById("print")?.addEventListener("click", () => target.print());
      } else { target.focus(); target.print(); }
    } catch { setError("The system print dialog could not open. Close this preview, review the pending attempt, then use Open printable page."); }
  }
  return <dialog className="airprint-dialog" ref={modal} aria-labelledby="airprint-title" onCancel={e => { e.preventDefault(); b.closeAirPrint(); }}>
    <header><div><span className="section-kicker">AirPrint / system printing</span><h2 id="airprint-title">Print your photo sheet</h2></div><button className="icon-button" aria-label="Close AirPrint preview" onClick={b.closeAirPrint}><X aria-hidden="true" size={20}/></button></header>
    <div className="airprint-body">
      {sheet ? <img className="airprint-sheet" src={sheet} alt="Receipt fitted onto a photo sheet without cropping"/> : <p role="status">Preparing your print sheet...</p>}
      <div><p>{airPrintPapers[b.airPrintPaper].name} · one image fitted without cropping.</p><p>Choose your printer in the system dialog. For Xiaomi 1S, use the same Wi-Fi as your iPad and matching photo paper.</p><p>Printing or cancelling cannot be confirmed by the app. Check the paper before clearing this attempt.</p>
      {error && <p role="alert" className="alert">{error}</p>}
      {b.job ? <p role="status">Print dialog requested. Close this preview to review the attempt. If you cancelled, review it before trying again.</p> : <div className="airprint-actions"><button className="button button-primary" disabled={!ready || !sheet} onClick={() => openPrint()}><Printer size={18} aria-hidden="true"/>Print / AirPrint</button><button className="button button-secondary" disabled={!ready || !sheet} onClick={() => openPrint(true)}><ExternalLink size={18} aria-hidden="true"/>Open printable page</button></div>}
      <p className="field-help">If the Home Screen app does not open the print dialog, use Open printable page instead, then tap Print / AirPrint on that page.</p></div>
    </div>
    {sheet && <iframe ref={frame} className="airprint-frame" title="Printable photo sheet" tabIndex={-1} aria-hidden="true" srcDoc={printDocument(sheet, b.airPrintPaper)} onLoad={async () => { try { await frame.current?.contentDocument?.querySelector("img")?.decode(); setReady(true); } catch { setError("Could not load the printable image."); } }}/>}
  </dialog>;
}
