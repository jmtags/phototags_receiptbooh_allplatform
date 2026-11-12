import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { LightActivationDialog } from "./LightActivationDialog";
import type { BoothModel } from "./useBooth";

export function LightLicenseSettings({ booth: b }: { booth: BoothModel }) {
  const l = b.lightLicense;
  const [key, setKey] = useState(""), [open, setOpen] = useState(false);
  useEffect(() => { if (l.enabled) void l.loadPlans(); }, []);
  const planName = l.plans.find(p => p.id === l.claims?.plan)?.name || l.claims?.plan;
  const lifetime = l.allowed && !!l.claims && !l.claims.licenseExpiresAt;
  return <section className="light-license-settings">
    <div className="setup-section-title"><span className="setup-icon"><ShieldCheck aria-hidden="true" size={23} /></span><div><h2>PhotoTags Light license</h2><p>{l.claims && l.allowed ? planName : "Activate this installation for your next event."}</p></div></div>
    <p className={`offline-box ${l.allowed && l.enabled ? "prepared" : ""}`} role="status">{l.message}</p>
    {!l.enabled ? <p>Licensing is not enabled on this deployment.</p> : <>
      <dl className="light-license-facts">
        <div><dt>License plan</dt><dd>{planName || "Not activated"}</dd></div>
        <div><dt>License expiry</dt><dd>{l.claims ? l.claims.licenseExpiresAt ? new Date(l.claims.licenseExpiresAt).toLocaleString() : "Lifetime" : "?"}</dd></div>
        <div><dt>Offline access until</dt><dd>{l.claims ? new Date(l.claims.exp * 1000).toLocaleString() : "Online activation required"}</dd></div>
      </dl>
      {(!lifetime || l.pendingPaymentId) && <button className="button button-primary light-activate-cta" disabled={!b.online || !l.identityId || l.busy} onClick={() => { l.beginActivation(); setOpen(true); }}><ShieldCheck size={23} aria-hidden="true" />{l.pendingPaymentId ? "Resume license payment" : l.allowed ? "Renew license" : "Activate license"}<ArrowRight size={21} aria-hidden="true" /></button>}
      <form onSubmit={e => { e.preventDefault(); void l.activate(key); }}>
        <label className="field" htmlFor="light-manual-key">Have a Light license key?</label>
        <div className="light-manual-key-row"><input id="light-manual-key" aria-label="Light license key" value={key} onChange={e => setKey(e.target.value)} placeholder="PTL-..." autoComplete="off" required /><button className="button button-secondary" disabled={l.busy || !b.online || !l.identityId}><KeyRound size={17} aria-hidden="true" />Activate Light license</button></div>
      </form>
      <details className="technical-details">
        <summary>Installation & offline access</summary>
        <label className="field">Installation name<input maxLength={80} value={l.name} onChange={e => l.setName(e.target.value)} /></label>
        <p className="light-installation-id">Installation ID: {l.identityId || "Preparing installation?"}</p>
        <p>Use this same browser or installed app. Clearing app data or switching browsers may require a host-assisted license transfer.</p>
        <p>Prepare files in Offline &amp; installation before an event. Reconnect before the offline access expiry; lifetime licenses also need periodic online checks.</p>
        <button className="button button-secondary" disabled={l.busy || !b.online} onClick={() => void l.refresh()}><RefreshCw size={17} aria-hidden="true" />Check license / payment</button>
      </details>
      {open && <LightActivationDialog license={l} online={b.online} onClose={() => setOpen(false)} />}
    </>}
  </section>;
}
