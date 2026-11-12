import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, RefreshCw, X } from "lucide-react";
import type { LightLicenseModel } from "./lightLicense";

export function LightActivationDialog({ license: l, online, onClose }: { license: LightLicenseModel; online: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), title = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(l.pendingPaymentId ? 2 : 0);
  const [agreed, setAgreed] = useState(false), [email, setEmail] = useState(l.payment?.receiptEmail || "");
  const emailEdited = useRef(false), resumed = useRef(!!l.pendingPaymentId);
  const [planId, setPlanId] = useState(l.payment?.planId || "");
  const success = !!l.completedPayment;
  const failed = l.payment?.status === "failed";
  const hosted = !!l.payment?.checkoutUrl;
  const setupReady = l.paymentSetup?.inlineQr !== false;
  const selected = l.plans.find(p => p.id === planId);
  const expired = !!l.payment?.expiresAt && Date.parse(l.payment.expiresAt) <= Date.now();
  const canPay = setupReady && online && !l.busy && agreed && !!selected && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  useEffect(() => {
    const modal = dialog.current!; modal.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { modal.close(); document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => { title.current?.focus(); }, [step, success]);
  useEffect(() => { if (!emailEdited.current && l.payment?.receiptEmail) setEmail(l.payment.receiptEmail); }, [l.payment?.receiptEmail]);
  async function startOver() {
    if (await l.cancelPayment()) { resumed.current=false; setAgreed(false); setPlanId(""); setStep(0); }
  }
  async function pay(replaceHosted = false) {
    const result = await l.checkout(planId || l.payment?.planId || "", email.trim(), agreed || !!l.pendingPaymentId, replaceHosted);
    if (result?.paymentId) setStep(2);
  }
  return <dialog ref={dialog} className="light-activation-dialog" aria-labelledby="light-activation-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className="light-dialog-header">
      <div><span className="section-kicker">PhotoTags Light</span><h2 id="light-activation-title" ref={title} tabIndex={-1}>{success ? "Your booth is licensed" : ["Before you activate", "Choose your license", failed ? "Payment attempt closed" : hosted ? "Resume your payment" : "Scan to activate"][step]}</h2></div>
      <button className="icon-button" aria-label="Close license activation" onClick={onClose}><X size={21} aria-hidden="true" /></button>
    </header>
    {!success && <ol className="light-dialog-steps" aria-label="Activation progress">{["Terms", "Plan", "Payment"].map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined}><span>{i < step ? "✓" : i + 1}</span>{label}</li>)}</ol>}
    <div className="light-dialog-body">
      {success ? <div className="light-payment-success"><CheckCircle2 size={52} aria-hidden="true" /><h3>{l.plans.find(p => p.id === l.claims?.plan)?.name || l.claims?.plan}</h3><p>Payment verified. Your license and offline permit are saved on this installation.</p><p>{l.claims?.licenseExpiresAt ? `License expires ${new Date(l.claims.licenseExpiresAt).toLocaleString()}` : "Lifetime license"}</p></div> : <>
        {step === 0 && <>
          <h3>Light license terms</h3>
          <div className="light-terms-copy">
            <p>A Light license covers the purchased number of registered browser installations. Android APK licenses are a separate product and do not activate this booth.</p>
            <p>Clearing app data or changing browsers may require a host-assisted transfer. On iPhone or iPad, install the booth on the Home Screen and activate inside that app.</p>
            <p>First activation and renewal require internet. Offline use requires downloaded app files and an unexpired signed license permit. Reconnect before the offline permit expires; lifetime licenses also require periodic checks.</p>
            <p>Revocation and transfers cannot invalidate permits on devices that remain offline before permit expiry. Paid renewals extend this installation's current active license period; each purchase creates a separately tracked Light license record.</p>
            <p>Keep proof of payment. Contact <a href="mailto:support@phototags.app">support@phototags.app</a> for activation, transfers or payment issues. Access is granted only after server verification of payment.</p>
            <p>These terms supplement the <a href="https://www.phototags.app/use-policy" target="_blank" rel="noreferrer">use policy</a> and <a href="https://www.phototags.app/privacy-policy" target="_blank" rel="noreferrer">privacy policy</a>.</p>
          </div>
          <label className="light-agreement"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />I agree to the PhotoTags Light license terms.</label>
        </>}
        {step === 1 && <>
          <fieldset className="light-plan-picker"><legend>License plan</legend>{l.plans.map(plan => <label className={`light-plan-choice ${planId === plan.id ? "selected" : ""}`} key={plan.id}>
            <input type="radio" name="light-plan" value={plan.id} checked={planId === plan.id} onChange={() => setPlanId(plan.id)} />
            <span><strong>{plan.name}</strong><small>{plan.duration_days ? `${plan.duration_days} days` : "Lifetime"} · {plan.max_installations} installation(s)</small></span>
            <b>{new Intl.NumberFormat(undefined, { style: "currency", currency: plan.currency }).format(plan.amount / 100)}</b>
          </label>)}</fieldset>
          {!l.plans.length && <p>No plans are currently available. Ask your host for a license key.</p>}
          <label className="field">Receipt email<input type="email" autoComplete="email" maxLength={254} value={email} onChange={e => { emailEdited.current = true; setEmail(e.target.value); }} required /></label>
          <p className="field-help">Payment is for a PhotoTags Light license on this installation. Renewals add time to your current active license.</p>
          {l.plansError && <p role="alert">{l.plansError}</p>}
          {!setupReady && <p role="alert">{l.paymentSetup?.status === "light_inline_qr_not_configured" ? "QR setup is incomplete. Your host must apply the Light QR migration in Supabase." : "The Light QR payment service needs configuration. Ask your host to check the existing Light service."}</p>}
        </>}
        {step === 2 && <>
          {resumed.current && <p className="field-help">You are resuming an unfinished purchase. Terms and plan selection were saved. Use Cancel &amp; start over to choose a different plan.</p>}
          {l.payment?.qrImageUrl && !expired && !failed ? <div className="light-qr-payment">
            <p className="light-qr-amount">{new Intl.NumberFormat(undefined, { style: "currency", currency: l.payment.currency || "PHP" }).format((l.payment.amount || 0) / 100)}</p>
            <p>PhotoTags Light license · {l.plans.find(p => p.id === l.payment?.planId)?.name || l.payment.planId}</p>
            <img src={l.payment.qrImageUrl} alt="QR Ph code for PhotoTags Light license payment" width="280" height="280" />
            <p>Scan with a participating bank or e-wallet app. Your license updates here after payment is verified.</p>
            <a className="text-link" href={l.payment.qrImageUrl} download="PhotoTags-Light-payment.png">Save QR image</a>
            <small>QR valid until {new Date(l.payment.expiresAt!).toLocaleTimeString()}. On the same phone, save the QR and import it in your banking app if supported.</small>
          </div> : <p>{failed ? "This payment was cancelled. Close this dialog to choose a new license payment." : expired ? "This QR code has expired. Check payment before generating a replacement." : hosted ? "Your earlier attempt used hosted checkout, so it has no in-app QR image. You can switch an unpaid attempt to QR below." : "Checking your pending payment. Keep this app open; you can safely close and resume this dialog."}</p>}
          {l.payment?.reference && <p className="light-payment-reference">Reference: {l.payment.reference}</p>}
          {l.payment?.checkoutUrl && <p>You can also <a href={l.payment.checkoutUrl} target="_blank" rel="noreferrer">complete the earlier payment at PayMongo</a>. Payment is always verified before activation.</p>}
          {hosted && <p className="field-help">Switching first closes the unpaid hosted checkout. A paid or processing payment will be preserved.</p>}
          {(expired || hosted) && <label className="field">Receipt email<input type="email" value={email} onChange={e => { emailEdited.current = true; setEmail(e.target.value); }} /></label>}
        </>}
        <p role="status" className="light-dialog-status">{!online ? "You are offline. Reconnect to continue payment." : l.paymentError || (step === 2 ? failed ? "This attempt is closed. Start over to choose a license plan." : hosted ? "This earlier payment has not been verified yet. Confirmation updates automatically. You can switch an unpaid attempt to QR." : "Waiting for payment confirmation. This page updates automatically after payment." : l.busy ? "Contacting the license service..." : "")}</p>
      </>}
    </div>
    <footer className="light-dialog-actions">
      {success ? <button className="button button-primary" onClick={onClose}>Done</button> : step === 0 ? <button className="button button-primary" disabled={!agreed || !online} onClick={() => { void l.loadPlans(); setStep(1); }}>Agree & continue <ArrowRight size={17} aria-hidden="true" /></button> : step === 1 ? <><button className="button button-secondary" disabled={l.busy} onClick={() => setStep(0)}><ArrowLeft size={17} aria-hidden="true" />Back</button><button className="button button-primary" disabled={!canPay} onClick={() => void pay()}>{l.busy ? <LoaderCircle className="spinner" size={17} aria-hidden="true" /> : null}Show payment QR</button></> : <><button className="button button-quiet" disabled={l.busy || !online} onClick={() => void startOver()}>Cancel &amp; start over</button><button className="button button-secondary" disabled={l.busy || !online} onClick={() => void l.refresh()}><RefreshCw size={17} aria-hidden="true" />Refresh status</button>{(expired || hosted) && <button className="button button-primary" disabled={!setupReady || l.busy || !online || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)} onClick={() => void pay(hosted)}>{hosted ? "Switch to in-app QR" : "Generate a new QR"}</button>}</>}
    </footer>
  </dialog>;
}
