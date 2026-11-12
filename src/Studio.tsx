import { useEffect } from "react";
import {
  Aperture,
  LayoutDashboard,
  Palette,
  Layers3,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Download,
  FileImage,
  ImagePlus,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  Maximize,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  WifiOff,
  X,
  Timer,
} from "lucide-react";
import { profiles, type Profile } from "./receipt";
import { HostSettings } from "./HostSettings";
import { BrandingSettings } from "./BrandingSettings";
import { CameraSettings } from "./CameraSettings";
import { KioskSessionSettings } from "./KioskSessionSettings";
import { ThemeSettings } from "./ThemeSettings";
import { SecuritySettings } from "./SecuritySettings";
import { HistorySettings } from "./HistorySettings";
import { LightLicenseSettings } from "./LightLicenseSettings";
import type { BoothModel } from "./useBooth";

export function Studio({
  booth: b,
  onLaunchKiosk,
}: {
  booth: BoothModel;
  onLaunchKiosk: () => void;
}) {
  const ready = b.offline === "Ready for offline use";
  const active = b.tab === "booth";
  useEffect(() => window.scrollTo(0, 0), [b.tab]);
  const sections = [
    {
      id: "license",
      label: "Light license",
      icon: ShieldCheck,
      description: "Activate this installation, renew access and check offline permits.",
    },
    {
      id: "booth",
      label: "Overview",
      icon: LayoutDashboard,
      description: "Station status and the event checklist.",
    },
    {
      id: "branding",
      label: "Branding",
      icon: Palette,
      description: "Personalize the kiosk welcome screen.",
    },
    {id:"session",label:"Kiosk session",icon:Timer,description:"Automatic download QRs and the Step 4 start-over countdown."},
    {
      id: "camera",
      label: "Camera",
      icon: Camera,
      description: "Set the countdown before every photo.",
    },
    {
      id: "themes",
      label: "Event themes",
      icon: Layers3,
      description:
        "Create receipt themes, save them by event and add them to the kiosk collection.",
    },
    {
      id: "history",
      label: "Photo history",
      icon: FileImage,
      description:
        "Browse local date folders, download photos and reprint saved receipts.",
    },
    {
      id: "security",
      label: "Security",
      icon: LockKeyhole,
      description: "Protect kiosk exits with a six-digit host PIN.",
    },
    {
      id: "print",
      label: "Printer connection",
      icon: Printer,
      description: "Set receipt output, connect your printer and run a test.",
    },
    {
      id: "help",
      label: "Offline & installation",
      icon: ShieldCheck,
      description: "Prepare this device for offline events.",
    },
  ];
  const current =
    sections.find((section) => section.id === b.tab) || sections[0];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => b.navigate("booth")}
          aria-label="PhotoTags Settings"
        >
          <img src="/icons/icon-192.png" alt="" width="40" height="40" />
          <span translate="no">PhotoTags</span>
          <span className="product-name">Receipt Booth</span>
        </button>
        <button
          className="button button-primary launch-kiosk-button"
          disabled={b.busy || !!b.job}
          onClick={onLaunchKiosk}
        >
          <Maximize size={20} aria-hidden="true" />
          Launch kiosk
        </button>
      </header>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <div className="settings-sidebar-heading">
            <span className="section-kicker">Station controls</span>
            <h2>Settings</h2>
          </div>
          <nav aria-label="Settings sections">
            {sections.map((section) => (
              <button
                key={section.id}
                aria-current={b.tab === section.id ? "page" : undefined}
                onClick={() => b.navigate(section.id)}
              >
                <section.icon size={18} aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
          <p className="settings-sidebar-note">
            Settings are stored on this device.
          </p>
        </aside>
        <main id="workspace" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="breadcrumb">
                <span>PhotoTags</span>
                <ChevronRight aria-hidden="true" size={12} />
                <span>{current.label}</span>
              </div>
              <h1>{active ? "Settings" : current.label}</h1>
              <p>{current.description}</p>
            </div>
            <div className="session-actions">
              <div
                className={`readiness ${ready ? "is-ready" : ""}`}
                role="status"
              >
                {!b.online ? (
                  <WifiOff aria-hidden="true" size={14} />
                ) : (
                  <span className="state-dot" />
                )}
                <span>
                  {ready
                    ? "Ready for offline use"
                    : b.online
                      ? "Preparing offline files…"
                      : "Offline files need checking"}
                </span>
              </div>
              <button
                className="button button-quiet new-session"
                disabled={b.busy || !!b.job || (!b.hasPhotos && !b.camera)}
                onClick={b.newSession}
              >
                <Plus aria-hidden="true" size={16} />
                New session
              </button>
            </div>
          </div>

          {b.error && (
            <div className="alert" role="alert">
              <CircleHelp aria-hidden="true" size={19} />
              <div>{b.error}</div>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => b.setError("")}
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
          )}
          {b.historyError && b.tab !== "history" && (
            <p className="alert" role="alert">
              {b.historyError} Open Photo history to review saved sessions.
            </p>
          )}
          {b.deviceFolderError && b.tab !== "history" && (
            <p className="alert" role="alert">
              {b.deviceFolderError} Open Photo history to reconnect the device
              folder.
            </p>
          )}
          {b.job && (
            <div className="alert warning" role="status">
              <Printer aria-hidden="true" size={21} />
              <div>
                <strong>Check your last print before continuing</strong>
                <p>
                  {b.printMessage ||
                    "A previous print was left unresolved. Check the paper and queue; it may already have printed."}
                </p>
                <small>Job {b.job}</small>
              </div>
              <button
                className="button button-secondary"
                disabled={b.working}
                onClick={b.resolvePrint}
              >
                I checked the printer
              </button>
            </div>
          )}

          {b.tab === "license" ? (
            <LightLicenseSettings booth={b} />
          ) : b.tab === "history" ? (
            <HistorySettings booth={b} />
          ) : b.tab === "branding" ? (
            <BrandingSettings booth={b} />
          ) : b.tab === "themes" ? (
            <ThemeSettings booth={b} />
          ) : b.tab === "session" ? (
            <KioskSessionSettings booth={b} />
          ) : b.tab === "camera" ? (
            <CameraSettings booth={b} />
          ) : b.tab === "security" ? (
            <SecuritySettings booth={b} />
          ) : b.tab === "booth" ? (
            <HostSettings booth={b} />
          ) : b.tab === "print" ? (
            <div className="setup-layout">
              <section className="setup-main">
                <div className="setup-section-title">
                  <span className="setup-icon">
                    <Printer aria-hidden="true" size={22} />
                  </span>
                  <div>
                    <h2>Printer connection</h2>
                    <p>Choose where your receipt goes.</p>
                  </div>
                </div>
                <div className="notice">
                  <ShieldCheck aria-hidden="true" size={18} />
                  <p>
                    Use an installed QZ Tray helper and a configured raw thermal
                    queue. Physical printer output has not been verified.
                  </p>
                </div>
                <div className="form-grid">
                  <label className="field">
                    Printer profile
                    <select
                      name="print-profile"
                      value={b.profile}
                      disabled={b.busy || !!b.job}
                      onChange={(e) => b.setProfile(e.target.value as Profile)}
                    >
                      <option value="deli">Deli ES423 · 384 dots</option>
                      <option value="g80">VOZY G80 · 576 dots</option>
                    </select>
                  </label>
                  <label className="field">
                    QZ host
                    <input
                      name="qz-host"
                      autoComplete="off"
                      spellCheck={false}
                      value={b.host}
                      disabled={b.working}
                      onChange={(e) => {
                        b.setHost(e.target.value);
                        b.setPrinter("");
                        b.setPrinters([]);
                      }}
                      placeholder="e.g. localhost…"
                    />
                  </label>
                </div>
                <label className="field queue-field">
                  Photo lightness
                  <select
                    value={b.gamma}
                    disabled={b.busy || !!b.job}
                    onChange={(e) => b.setGamma(+e.target.value)}
                  >
                    <option value="1">Natural</option>
                    <option value="1.5">Lighter photos</option>
                    <option value="2">Lightest photos</option>
                  </select>
                </label>
                <p className="field-help">
                  Saved separately for each printer profile. Applies to the
                  thermal preview, thermal PNG export and printed receipt. Color
                  PNGs keep their original tones.
                </p>
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
                  Turn off for color previews and PNGs. Printing always uses the
                  selected thermal profile.
                </p>
                <div className="host-output-spec">
                  <span>{profiles[b.profile].width} dots</span>
                  <span>{profiles[b.profile].mm} mm printable width</span>
                </div>
                <p className="field-help">
                  Use localhost on this computer, or a certificate-trusted
                  hostname for a configured LAN bridge.
                </p>
                <button
                  className="button button-secondary connect-button"
                  disabled={b.working}
                  onClick={b.connect}
                >
                  {b.working ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="spinner"
                      size={17}
                    />
                  ) : (
                    <RefreshCw aria-hidden="true" size={17} />
                  )}
                  Connect & find printer queues
                </button>
                <label className="field queue-field">
                  Raw printer queue
                  <select
                    name="queue"
                    value={b.printer}
                    disabled={!b.printers.length || b.working}
                    onChange={(e) => b.setPrinter(e.target.value)}
                  >
                    <option value="">Select a queue explicitly</option>
                    {b.printers.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <div className="print-summary">
                  <FileImage aria-hidden="true" size={19} />
                  <div>
                    <b>
                      {b.photo
                        ? `${b.template.name} receipt`
                        : "No photo selected yet"}
                    </b>
                    <span>
                      {b.photo
                        ? `${b.dimensions}, one copy`
                        : "Capture a photo or load the test artwork below."}
                    </span>
                  </div>
                  {b.photo && <CheckCircle2 aria-hidden="true" size={18} />}
                </div>
                <button
                  className="button button-primary send-button"
                  disabled={
                    !b.complete ||
                    !b.printer ||
                    b.working ||
                    !!b.job ||
                    !b.preview ||
                    b.rendering
                  }
                  onClick={b.print}
                >
                  <Printer aria-hidden="true" size={17} />
                  Send one receipt
                </button>
                <p className="field-help">
                  Submission confirms delivery to the helper. Check the paper
                  before sending another. Uncertain jobs never retry
                  automatically.
                </p>
                <div className="test-section">
                  <h3>Try the printer test</h3>
                  <p>
                    Original PhotoTags artwork with a grayscale ramp. A useful
                    first check for width, tone and feed.
                  </p>
                  <div className="test-buttons">
                    <button
                      className="button button-secondary"
                      disabled={b.working || !!b.job}
                      onClick={b.loadTestArtwork}
                    >
                      <ImagePlus aria-hidden="true" size={16} />
                      Load printer test artwork
                    </button>
                    <button
                      className="button button-quiet"
                      disabled={!b.complete || !b.preview || b.rendering}
                      onClick={b.exportRaw}
                    >
                      <Download aria-hidden="true" size={16} />
                      Export ESC/POS job
                    </button>
                  </div>
                </div>
              </section>
              <aside className="setup-guide">
                <div className="guide-heading">
                  <CircleHelp aria-hidden="true" size={20} />
                  <h2>A little setup, then you’re ready.</h2>
                </div>
                <ol className="setup-steps">
                  <li>
                    <span>1</span>
                    <div>
                      <h3>Install the helper</h3>
                      <p>
                        Install QZ Tray on the Windows or Mac computer connected
                        to your printer.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>2</span>
                    <div>
                      <h3>Set up a raw queue</h3>
                      <p>
                        The queue must pass ESC/POS bytes unchanged, without
                        rescaling the receipt.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>3</span>
                    <div>
                      <h3>Connect and approve</h3>
                      <p>
                        Connect here, approve the PhotoTags origin in QZ, and
                        select your printer queue.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>4</span>
                    <div>
                      <h3>Print one test</h3>
                      <p>
                        Match the profile to your printer. Check the full
                        receipt before printing more.
                      </p>
                    </div>
                  </li>
                </ol>
                <details className="technical-details">
                  <summary>Using iPhone or iPad?</summary>
                  <p>
                    A secure LAN print bridge is experimental and requires
                    client certificate trust, local network permissions and
                    actual device tests. Direct Safari USB/Bluetooth and
                    AirPrint are not provided.
                  </p>
                </details>
                <details className="technical-details">
                  <summary>About authorization</summary>
                  <p>
                    This attended integration uses QZ authorization prompts.
                    Silent printing requires trusted certificates and secure
                    message signing. No private signing keys are stored in this
                    app.
                  </p>
                </details>
                <a
                  className="text-link"
                  href="https://qz.io/docs/print-server"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the QZ setup guide
                  <ArrowUpRight aria-hidden="true" size={15} />
                </a>
              </aside>
            </div>
          ) : (
            <div className="setup-layout">
              <section className="setup-main">
                <div className="setup-section-title">
                  <span className="setup-icon">
                    <ShieldCheck aria-hidden="true" size={23} />
                  </span>
                  <div>
                    <h2>Your offline kit</h2>
                    <p>Everything you need, on this device.</p>
                  </div>
                </div>
                <div
                  className={`offline-box ${ready ? "prepared" : ""}`}
                  role="status"
                >
                  {ready ? (
                    <CheckCircle2 aria-hidden="true" size={21} />
                  ) : (
                    <RefreshCw aria-hidden="true" size={21} />
                  )}
                  <span>{b.offline}</span>
                </div>
                <p className="setup-body">
                  After the first preparation, your camera, designs and receipt
                  exports work without internet. Printing also needs the
                  configured local helper connection.
                </p>
                <button className="button button-primary" onClick={b.prepare}>
                  <RefreshCw aria-hidden="true" size={17} />
                  Prepare / check offline files
                </button>
                <p className="field-help" role="status">
                  {b.persistent ||
                    "Check readiness before your event, especially after clearing browser data."}
                </p>
                <div className="maintenance-section">
                  <h3>Between sessions</h3>
                  <p>
                    Finish your booth session before repairing files or applying
                    an update. The photo will be cleared when you end the
                    session.
                  </p>
                  <button
                    className="button button-secondary"
                    disabled={b.busy || !!b.job}
                    onClick={b.newSession}
                  >
                    <RotateCcw aria-hidden="true" size={16} />
                    End session & clear photo
                  </button>
                  {b.update && (
                    <div className="update-notice">
                      <p>
                        An update is ready. Finish the session and review any
                        unresolved print to apply it.
                      </p>
                      <button
                        className="button button-primary"
                        disabled={b.hasPhotos || b.camera || b.busy || !!b.job}
                        onClick={() => b.updateSW(true)}
                      >
                        <Download aria-hidden="true" size={17} />
                        Apply update between sessions
                      </button>
                    </div>
                  )}
                  <button
                    className="button button-quiet repair-button"
                    disabled={
                      !b.online || b.hasPhotos || b.camera || b.busy || !!b.job
                    }
                    onClick={b.repair}
                  >
                    Repair offline package
                  </button>
                  <p className="field-help">
                    Initial preparation, repairs and updates require internet.
                    Storage may be cleared by your browser; persistent storage
                    is requested when supported.
                  </p>
                </div>
              </section>
              <aside className="setup-guide">
                <div className="guide-heading">
                  <Download aria-hidden="true" size={20} />
                  <h2>Give your booth a home.</h2>
                </div>
                <div className="install-option">
                  <Laptop aria-hidden="true" size={23} />
                  <div>
                    <h3>Windows & macOS</h3>
                    <p>
                      In Chrome or Edge, use the install button in the address
                      bar or the browser’s Install app menu. In supported macOS
                      Safari versions, choose File → Add to Dock.
                    </p>
                  </div>
                </div>
                <div className="install-option">
                  <Smartphone aria-hidden="true" size={23} />
                  <div>
                    <h3>iPhone & iPad</h3>
                    <p>
                      Safari uses Add to Home Screen instead of an automatic
                      install prompt. Use the installation instructions below
                      to add the booth to your phone.
                    </p>
                  </div>
                </div>
                {b.installPrompt ? (
                  <button className="button button-primary" onClick={b.install}>
                    <Download aria-hidden="true" size={17} />
                    Install Receipt Booth
                  </button>
                ) : (
                  <details className="manual-install">
                    <summary className="button button-primary">
                      <Download aria-hidden="true" size={17} />
                      Install Receipt Booth
                    </summary>
                    <div className="manual-install-steps">
                      <h3>On iPhone or iPad</h3>
                      <ol>
                        <li>Open this booth page directly in Safari.</li>
                        <li>Open Safari's Share menu and choose Add to Home Screen.</li>
                        <li>Turn on Open as Web App if shown, then tap Add.</li>
                      </ol>
                      <p>
                        If Add to Home Screen is missing, scroll down in the
                        Share menu and use Edit Actions to add it.
                      </p>
                      <h3>Before going offline</h3>
                      <p>
                        Open the new Home Screen icon while online. In Settings,
                        open Offline &amp; installation, tap Prepare / check offline
                        files, and wait for Ready for offline use. Test reopening
                        the app without internet before your event.
                      </p>
                      <p>
                        On Windows or Mac, use your browser's Install app menu,
                        or File → Add to Dock in supported macOS Safari versions.
                      </p>
                    </div>
                  </details>
                )}
                <div className="guide-tip">
                  <LockKeyhole aria-hidden="true" size={18} />
                  <p>
                    Use a trusted HTTPS origin or localhost. Plain HTTP on a
                    Wi-Fi address cannot provide camera or installation
                    features.
                  </p>
                </div>
                <details className="technical-details">
                  <summary>Camera permission help</summary>
                  <p>
                    Allow the camera when prompted. If it was blocked, change
                    the site’s camera permission in your browser settings, then
                    reopen the camera in Step 2.
                  </p>
                </details>
                <p className="field-help">
                  Captured photos and finished receipts are saved in Photo
                  history on this device, including after a session ends.
                </p>
              </aside>
            </div>
          )}
          <footer className="studio-footer">
            <span>
              <Aperture aria-hidden="true" size={15} />
              Made for the moments in between.
            </span>
            <span>
              PhotoTags Receipt Booth
              <span className="footer-dot" />
              {active
                ? "Capture. Create. Keep."
                : "Your photos stay on your device."}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
