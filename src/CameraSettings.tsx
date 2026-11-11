import { Camera, Timer, ShieldCheck } from "lucide-react";
import type { BoothModel } from "./useBooth";
export function CameraSettings({ booth: b }: { booth: BoothModel }) {
  return (
    <section
      className="host-panel camera-settings"
      aria-labelledby="camera-settings-heading"
    >
      <div className="host-panel-title">
        <Camera aria-hidden="true" size={24} />
        <div>
          <span className="section-kicker">Give guests a moment</span>
          <h2 id="camera-settings-heading">Camera timer</h2>
        </div>
      </div>
      <p className="host-intro">
        Choose how long guests have to get ready before each photo. This timer
        applies to every shot and retake in the kiosk.
      </p>
      <div className="auto-capture-setting">
        <label className="check-label">
          <input
            type="checkbox"
            role="switch"
            checked={b.autoCapture}
            disabled={b.busy || !!b.job}
            onChange={(e) => b.setAutoCapture(e.target.checked)}
          />
          <span>Automatic capture in Step 2</span>
        </label>
        <p className="field-help">
          When enabled, entering Step 2 opens the camera and starts the
          countdown as soon as the preview is ready. Every empty photo slot is
          captured automatically. Guests can stop capture or choose photos
          instead.
        </p>
        <p className="field-help" role="status">
          {b.autoCapture
            ? "On — saved on this device."
            : "Off — guests open the camera and start capture manually."}
        </p>
      </div>
      <div className="camera-timer-layout">
        <div>
          <label className="field">
            Capture countdown
            <select
              value={b.countdownSeconds}
              disabled={b.busy || !!b.job}
              onChange={(e) => b.setCountdownSeconds(+e.target.value)}
            >
              {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                <option value={n} key={n}>
                  {n} {n === 1 ? "second" : "seconds"}
                </option>
              ))}
            </select>
          </label>
          <p className="field-help" role="status">
            Saved on this device. Each shot counts down from{" "}
            {b.countdownSeconds}.
          </p>
        </div>
        <div
          className="timer-preview"
          aria-label={`${b.countdownSeconds}-second camera timer preview`}
        >
          <Timer aria-hidden="true" size={20} />
          <strong>{b.countdownSeconds}</strong>
          <span>seconds before each photo</span>
        </div>
      </div>
      <div className="retake-settings">
        <label className="field">
          Retakes per guest session
          <select
            value={b.retakeLimit}
            disabled={b.busy || !!b.job}
            onChange={(e) => b.setRetakeLimit(+e.target.value)}
          >
            <option value="-1">Unlimited retakes</option>
            {Array.from({ length: 11 }, (_, n) => (
              <option value={n} key={n}>
                {n === 0
                  ? "No retakes"
                  : `${n} ${n === 1 ? "retake" : "retakes"}`}
              </option>
            ))}
          </select>
        </label>
        <p className="field-help">
          First photos are included. Each successfully replaced photo uses one
          retake, whether captured or uploaded. Cancelling a countdown or a
          failed upload uses none. The allowance resets for a new guest session.
        </p>
        <p className="field-help" role="status">
          Saved on this device.{" "}
          {b.retakeLimit < 0
            ? "Retakes are unlimited."
            : `${b.retakesUsed} used in the current session.`}
        </p>
      </div>
      <div className="host-system-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          Browser camera permission is still required. Leaving the kiosk stops
          the camera and cancels the countdown. Returning to a completed photo
          step keeps the captured photos.
        </p>
      </div>
    </section>
  );
}
