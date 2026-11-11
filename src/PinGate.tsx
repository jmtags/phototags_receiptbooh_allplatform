import { useEffect, useRef, useState, type FormEvent } from "react";
import { Delete, LockKeyhole } from "lucide-react";
import type { BoothModel } from "./useBooth";

export function PinGate({
  booth: b,
  onUnlock,
  onCancel,
}: {
  booth: BoothModel;
  onUnlock: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState(""),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false),
    [now, setNow] = useState(Date.now());
  const input = useRef<HTMLInputElement>(null),
    active = useRef(true);
  const remaining = Math.max(0, Math.ceil((b.pinLockedUntil - now) / 1000));
  useEffect(() => {
    active.current = true;
    input.current?.focus();
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => {
      active.current = false;
      clearInterval(timer);
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pin.length !== 6 || checking || remaining) return;
    setChecking(true);
    setError("");
    try {
      const correct = await b.verifyPin(pin);
      if (!active.current) return;
      if (correct) onUnlock();
      else {
        setPin("");
        setError("Incorrect PIN. Please try again.");
        requestAnimationFrame(() => input.current?.focus());
      }
    } catch {
      if (active.current)
        setError("The PIN could not be checked. Please try again.");
    } finally {
      if (active.current) setChecking(false);
    }
  }
  return (
    <section className="kiosk-pin" aria-labelledby="pin-heading">
      <div className="kiosk-confirm-icon">
        <LockKeyhole aria-hidden="true" size={30} />
      </div>
      <h1 id="pin-heading">Enter host PIN</h1>
      <p>Enter your six-digit PIN to return to Settings.</p>
      <form onSubmit={submit}>
        <label className="field">
          Six-digit PIN
          <input
            ref={input}
            className="pin-input"
            type="password"
            inputMode="none"
            autoComplete="off"
            maxLength={6}
            value={pin}
            disabled={checking || !!remaining}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
          />
        </label>
        <div className="pin-keypad" role="group" aria-label="PIN keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              type="button"
              key={digit}
              disabled={checking || !!remaining || pin.length === 6}
              onClick={() => {
                setPin((p) => p + digit);
                setError("");
              }}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={checking || !!remaining || !pin}
            onClick={() => setPin("")}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={checking || !!remaining || pin.length === 6}
            onClick={() => {
              setPin((p) => p + "0");
              setError("");
            }}
          >
            0
          </button>
          <button
            type="button"
            aria-label="Delete last digit"
            disabled={checking || !!remaining || !pin}
            onClick={() => setPin((p) => p.slice(0, -1))}
          >
            <Delete aria-hidden="true" size={24} />
          </button>
        </div>
        {error && (
          <p className="pin-error" role="alert">
            {error}
          </p>
        )}
        {!!remaining && (
          <p className="pin-error" role="status">
            Too many attempts. Try again in {remaining} seconds.
          </p>
        )}
        <button
          className="button button-primary"
          type="submit"
          disabled={pin.length !== 6 || checking || !!remaining}
        >
          {checking ? "Checking…" : "Unlock Settings"}
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
        >
          Keep booth open
        </button>
      </form>
    </section>
  );
}
