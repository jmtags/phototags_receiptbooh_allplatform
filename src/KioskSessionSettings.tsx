import { QrCode, Timer } from "lucide-react";
import type { BoothModel } from "./useBooth";
export function KioskSessionSettings({booth:b}:{booth:BoothModel}){
  return <section className="host-panel" aria-labelledby="kiosk-session-settings-heading">
    <div className="host-panel-title"><Timer size={24} aria-hidden="true"/><div><span className="section-kicker">Ready for the next guest</span><h2 id="kiosk-session-settings-heading">Kiosk session</h2></div></div>
    <label className="field">Automatic start-over timer<select value={b.kioskResetSeconds} disabled={b.busy||!!b.job} onChange={e=>b.setKioskResetSeconds(Number(e.target.value))}>
      {[0,30,60,120,180,300,600].map(value=><option key={value} value={value}>{value===0?"Off":value<60?`${value} seconds`:`${value/60} ${value===60?"minute":"minutes"}`}</option>)}
    </select></label>
    <p className="field-help">The countdown begins in Step 4. At zero, the booth returns to Start and clears the guest session. Saved photo history stays available. The timer pauses while printing or awaiting host review.</p>
    <div className="auto-capture-setting"><label className="check-label"><input type="checkbox" role="switch" checked={b.autoDownloadQr} disabled={b.busy||!!b.job} onChange={e=>b.setAutoDownloadQr(e.target.checked)}/><span><QrCode size={17} aria-hidden="true"/> Automatically generate download QRs</span></label>
    <p className="field-help">Entering Step 4 uploads only the decorated receipt and shows its download QR beside the preview. This needs internet and an active Light license. Anyone with a link can download that image for 30 minutes. Turn this off to generate the receipt link manually.</p></div>
    <p role="status">{b.kioskSettingsError||"Saved on this device."}</p>
  </section>;
}
