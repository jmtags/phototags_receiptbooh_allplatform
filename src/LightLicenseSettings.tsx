import { useEffect, useState } from "react";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import type { BoothModel } from "./useBooth";
export function LightLicenseSettings({ booth: b }: { booth: BoothModel }) {
  const l = b.lightLicense;
  const [key, setKey] = useState(""), [email, setEmail] = useState(""), [agreed, setAgreed] = useState(false);
  useEffect(() => { if (l.enabled) void l.loadPlans(); }, []);
  return <section className="light-license-settings">
    <div className="setup-section-title"><span className="setup-icon"><ShieldCheck aria-hidden="true" size={23} /></span><div><h2>PhotoTags Light license</h2><p>License this installation for offline booth sessions.</p></div></div>
    <p className={`offline-box ${l.allowed && l.enabled ? "prepared" : ""}`} role="status">{l.message}</p>
    {!l.enabled ? <p>Licensing is not enabled on this deployment. Your host can configure the Light server and verification key before enabling paid access.</p> : <>
      <dl className="light-license-facts"><div><dt>Installation ID</dt><dd>{l.identityId || "Preparing installation..."}</dd></div>
        <div><dt>License</dt><dd>{l.claims?.plan || "Not activated"}</dd></div>
        <div><dt>Offline access until</dt><dd>{l.claims ? new Date(l.claims.exp * 1000).toLocaleString() : "Online activation required"}</dd></div>
        <div><dt>License expiry</dt><dd>{l.claims ? l.claims.licenseExpiresAt ? new Date(l.claims.licenseExpiresAt).toLocaleString() : "Lifetime" : "—"}</dd></div></dl>
      <label className="field">Installation name<input maxLength={80} value={l.name} onChange={e => l.setName(e.target.value)} /></label>
      <button className="button button-secondary" disabled={l.busy || !b.online} onClick={() => void l.refresh()}><RefreshCw size={17} aria-hidden="true" />Check license / payment</button>
      <form onSubmit={e => { e.preventDefault(); void l.activate(key); }}>
        <h3>Have a Light license key?</h3><label className="field">Light license key<input value={key} onChange={e => setKey(e.target.value)} placeholder="PTL-..." autoComplete="off" required /></label>
        <button className="button button-primary" disabled={l.busy || !b.online || !l.identityId}><KeyRound size={17} aria-hidden="true" />Activate Light license</button>
      </form>
      <h3>Buy or renew PhotoTags Light</h3>
      <p>Purchases apply to this installation. Renewal adds the purchased time to its current active license period.</p>
      <label className="field">Receipt email<input type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="light-agreement"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />I accept the <a href="https://www.phototags.app/light" target="_blank" rel="noreferrer">PhotoTags Light license terms</a>.</label>
      <div className="light-plan-grid">{l.plans.map(plan => <article key={plan.id}><h4>{plan.name}</h4><p>{new Intl.NumberFormat(undefined, { style: "currency", currency: plan.currency }).format(plan.amount / 100)}</p><p>{plan.duration_days ? `${plan.duration_days} days` : "Lifetime"} · {plan.max_installations} installation(s)</p><button className="button button-primary" disabled={l.busy || !b.online || !agreed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)} onClick={() => void l.checkout(plan.id, email, agreed)}>Continue to payment</button></article>)}</div>
      {!l.plans.length && <p>No Light plans are currently on sale. Ask your host for a Light license key or refresh the plans.</p>}
      {l.plansError && <p className="field-help">{l.plansError}</p>}
      <button className="button button-quiet" disabled={!b.online || l.busy} onClick={() => void l.loadPlans()}>Refresh Light plans</button>
      <details className="technical-details">
        <summary>Activation & offline guide</summary>
        <ol>
          <li>Open the app on the device you will use. On iPhone or iPad, install it on the Home Screen and open that app first.</li>
          <li>Enter a Light license key above, or enter your email, accept the terms and choose a plan to pay.</li>
          <li>After payment, return to this same app and tap Check license / payment. Wait for License active.</li>
          <li>In Offline &amp; installation, prepare the offline files. Reopen the app without internet and test Launch kiosk before the event.</li>
        </ol>
        <p>Reconnect before Offline access until expires. Each installation has its own saved browser identity; clearing site data or switching browsers may require a license transfer by your host.</p>
        <p>Blocking or transferring a license takes effect offline when its current permit expires.</p>
      </details>
    </>}
  </section>;
}
