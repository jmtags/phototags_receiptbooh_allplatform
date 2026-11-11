import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import type { BoothModel } from "./useBooth";

export function SecuritySettings({ booth: b }: { booth: BoothModel }) {
  const [current, setCurrent] = useState(""),
    [pin, setPin] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function save(e: FormEvent, remove = false) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!remove && (!/^\d{6}$/.test(pin) || pin !== confirm)) {
      setError(
        "Enter a six-digit PIN and make sure both new PIN fields match.",
      );
      return;
    }
    setBusy(true);
    try {
      await b.savePin(remove ? "" : pin, current);
      setCurrent("");
      setPin("");
      setConfirm("");
      setMessage(
        remove
          ? "Exit PIN removed. Kiosk exits no longer require a PIN."
          : "Exit PIN saved. Leaving the kiosk now requires your six-digit PIN.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="host-panel security-settings"
      aria-labelledby="security-heading"
    >
      <div className="host-panel-title">
        <LockKeyhole aria-hidden="true" size={22} />
        <div>
          <h2 id="security-heading">Kiosk exit PIN</h2>
          <p className="field-help">
            Keep customers in the booth and reserve Settings access for your
            team.
          </p>
        </div>
      </div>
      <p className="security-status" role="status">
        {b.hasPin
          ? "PIN protection is on."
          : "PIN protection is off. Set a PIN to protect kiosk exits."}
      </p>
      <form onSubmit={save}>
        <fieldset disabled={busy || b.busy || !!b.job}>
          {b.hasPin && (
            <label className="field">
              Current PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={current}
                onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          )}
          <div className="form-grid">
            <label className="field">
              New six-digit PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="field">
              Confirm new PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </div>
          <p className="field-help">
            Use six numbers, including any leading zeros. Save this PIN
            somewhere your team can find it. Changing or removing it requires
            the current PIN.
          </p>
          <div className="security-actions">
            <button className="button button-primary" type="submit">
              {busy ? "Saving…" : b.hasPin ? "Change exit PIN" : "Set exit PIN"}
            </button>
            {b.hasPin && (
              <button
                className="button button-secondary"
                type="button"
                onClick={(e) => void save(e, true)}
              >
                Remove exit PIN
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {error && (
        <p className="branding-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <p className="field-help">
        Saved on this device. Protects Exit kiosk, Escape and host printer setup
        within the app. Browser and device controls remain available.
      </p>
    </section>
  );
}
