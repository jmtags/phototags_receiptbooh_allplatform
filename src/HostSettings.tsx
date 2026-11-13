import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Layers3,
  LockKeyhole,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { profiles } from "./receipt";
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
            <strong>{b.printMethod === "ble" ? b.bleName || "Connect a BLE printer" : b.printMethod === "airprint" ? "AirPrint / system printing" : b.printer || "Select a printer queue"}</strong>
            <p>
              {b.printMethod === "ble" ? `Bluetooth Low Energy · ${b.bleWidth} dots · keep the app visible.` : b.printMethod === "airprint" ? "Choose your photo printer in the system print dialog." : b.printer
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
              ReceiptBooth and PhotoBooth have separate event collections, with 176 stickers and offline guest sessions.
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
        {b.tab === "booth" && (
          <details className="host-panel host-system">
            <summary>About the system</summary>
            <div className="host-panel-title">
              <Layers3 size={22} aria-hidden="true" />
              <div>
                <span className="section-kicker">Guest experience</span>
                <h2 id="system-heading">One station. Four simple steps.</h2>
              </div>
            </div>
            <p className="host-intro">
              PhotoTags Light RB (Receipt Photobooth) turns a photo session into a decorated
              receipt. Guests create in the kiosk; this page handles station
              settings.
            </p>
            <p className="field-help">Usage reporting sends app opens, device/browser information, camera labels when available, and selected printer details to the host's Light admin. It does not send photos, PINs, MAC addresses or raw camera device IDs.</p>
            <ol className="host-flow">
              {[
                ["Choose shots", "Select 1, 2, 3 or 4 photos."],
                [
                  "Capture",
                  "A separate countdown for every shot.",
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
          </details>
        )}
      </div>
      {b.tab === "booth" && (
        <section className="host-checklist" aria-labelledby="event-heading">
          <div>
            <CheckCircle2 size={22} aria-hidden="true" />
            <h2 id="event-heading">Before you welcome guests</h2>
          </div>
          <ol>
            {b.lightLicense.enabled && <li>Activate this installation and check its offline license expiry.</li>}
            <li>Check the offline package on this device.</li>
            <li>Choose a print method and inspect one test receipt.</li>
            <li>Launch the kiosk and allow camera access when prompted.</li>
          </ol>
          <p>
            A prepared booth works without internet. Printing needs the
            configured local QZ Tray helper or an AirPrint printer on the same Wi-Fi. After sending a receipt, check the
            paper before resolving the print.
          </p>
        </section>
      )}
    </div>
  );
}
