import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Layers3,
  LockKeyhole,
  Printer,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { profiles, type Profile } from "./receipt";
import type { BoothModel } from "./useBooth";

export function HostSettings({ booth: b }: { booth: BoothModel }) {
  const ready = b.offline === "Ready for offline use";
  return (
    <div className="host-settings">
      {b.tab === "booth" && (
        <section className="host-status-grid" aria-label="System status">
          <article className="host-status-card">
            <Printer size={21} aria-hidden="true" />
            <span>Print destination</span>
            <strong>{b.printer || "Select a printer queue"}</strong>
            <p>
              {b.printer
                ? `${profiles[b.profile].name} · ${profiles[b.profile].width} dots`
                : "Configure your helper and queue before the event."}
            </p>
            <button
              className="host-text-button"
              onClick={() => b.navigate("print")}
            >
              Configure printer <ArrowRight size={15} aria-hidden="true" />
            </button>
          </article>
          <article className="host-status-card">
            <ShieldCheck size={21} aria-hidden="true" />
            <span>Offline package</span>
            <strong>
              {ready ? "Prepared on this device" : "Check offline readiness"}
            </strong>
            <p>
              Five built-in themes, {b.eventThemes.length} saved event themes,
              176 stickers and the guest experience.
            </p>
            <button
              className="host-text-button"
              onClick={() => b.navigate("help")}
            >
              Check offline setup <ArrowRight size={15} aria-hidden="true" />
            </button>
          </article>
          <article className="host-status-card">
            <Camera size={21} aria-hidden="true" />
            <span>Current session</span>
            <strong>
              {b.hasPhotos
                ? `${b.photos.filter(Boolean).length} of ${b.shotCount} photos captured`
                : "Waiting for your next guest"}
            </strong>
            <p>
              {b.job
                ? "Review the last print before starting another session."
                : b.hasPhotos
                  ? "Launch the kiosk to continue. Saved sessions remain in Photo history."
                  : "The camera opens when a guest chooses to capture."}
            </p>
            <span className="host-session-note">
              <LockKeyhole size={14} aria-hidden="true" /> Photos are saved
              locally in Photo history
            </span>
          </article>
        </section>
      )}

      <div className="host-details-grid">
        {b.tab === "output" && (
          <section
            className="host-panel"
            aria-labelledby="output-settings-heading"
          >
            <div className="host-panel-title">
              <SlidersHorizontal size={22} aria-hidden="true" />
              <div>
                <span className="section-kicker">Device configuration</span>
                <h2 id="output-settings-heading">Receipt output</h2>
              </div>
            </div>
            <p className="host-intro">
              Set the output for this station before guests enter the kiosk.
            </p>
            <label className="field">
              Printer profile
              <select
                name="host-profile"
                value={b.profile}
                disabled={b.busy || !!b.job}
                onChange={(e) => b.setProfile(e.target.value as Profile)}
              >
                {Object.entries(profiles).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.name} · {p.width} dots
                  </option>
                ))}
              </select>
            </label>
            {b.profile === "g80" && (
              <label className="field">
                G80 photo tone
                <select
                  name="host-tone"
                  value={b.gamma}
                  disabled={b.busy || !!b.job}
                  onChange={(e) => b.setGamma(+e.target.value)}
                >
                  <option value="1">Natural</option>
                  <option value="1.5">Lighter photos</option>
                  <option value="2">Lightest photos</option>
                </select>
              </label>
            )}
            <label className="check-label host-output-toggle">
              <input
                type="checkbox"
                checked={b.thermalView}
                disabled={b.busy || !!b.job}
                onChange={(e) => b.setThermalView(e.target.checked)}
              />
              <span>Thermal preview & PNG export</span>
            </label>
            <p className="field-help">
              Thermal mode previews the black-and-white printer bitmap. Turn it
              off for a color preview and PNG. Printer output always uses the
              selected thermal profile.
            </p>
            <div className="host-output-spec">
              <span>{profiles[b.profile].width} dots</span>
              <span>{profiles[b.profile].mm} mm printable width</span>
              <span>One copy per print action</span>
            </div>
          </section>
        )}
        {b.tab === "about" && (
          <section
            className="host-panel host-system"
            aria-labelledby="system-heading"
          >
            <div className="host-panel-title">
              <Layers3 size={22} aria-hidden="true" />
              <div>
                <span className="section-kicker">About the system</span>
                <h2 id="system-heading">One station. Four simple steps.</h2>
              </div>
            </div>
            <p className="host-intro">
              PhotoTags Receipt Booth turns a photo session into a decorated
              receipt. Guests create in the kiosk; this page handles station
              settings.
            </p>
            <ol className="host-flow">
              {[
                ["Choose shots", "Select 1, 2, 3 or 4 photos."],
                [
                  "Capture",
                  "A separate countdown for every shot, with local photo upload available.",
                ],
                [
                  "Decorate",
                  "Choose a theme, place stickers and add a signature.",
                ],
                [
                  "Print & keep",
                  "Review the receipt, save a PNG or send one print.",
                ],
              ].map(([title, description], i) => (
                <li key={title}>
                  <span>{i + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="host-system-note">
              <LockKeyhole size={18} aria-hidden="true" />
              <p>
                Captured photos and finished receipts are saved locally in Photo
                history. Finishing clears the current kiosk session. You can
                browse, download, reprint or delete saved sessions in Settings.
              </p>
            </div>
          </section>
        )}
      </div>
      {b.tab === "booth" && (
        <section className="host-checklist" aria-labelledby="event-heading">
          <div>
            <CheckCircle2 size={22} aria-hidden="true" />
            <h2 id="event-heading">Before you welcome guests</h2>
          </div>
          <ol>
            <li>Check the offline package on this device.</li>
            <li>Select the printer queue and inspect one test receipt.</li>
            <li>Launch the kiosk and allow camera access when prompted.</li>
          </ol>
          <p>
            A prepared booth works without internet. Printing needs the
            configured local QZ Tray helper. After sending a receipt, check the
            paper before resolving the print.
          </p>
        </section>
      )}
    </div>
  );
}
