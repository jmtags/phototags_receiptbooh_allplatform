import type { BoothModel } from "./useBooth";
import { bluetoothAvailable } from "./blePrinting";

export function BlePrinterSettings({ booth: b }: { booth: BoothModel }) {
  const supported = bluetoothAvailable(), locked = b.busy || !!b.job;
  return <section aria-label="Bluetooth receipt printer setup">
    <div className="notice"><p>{supported ? "Bluetooth access is available. Connect an ESC/POS BLE receipt printer, then print one test before your event." : "Safari and Home Screen apps do not provide Bluetooth printer access. On iPad/iPhone, open this booth in Bluefy to use BLE printing."}</p></div>
    {!supported && <p><a className="text-link" href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055" target="_blank" rel="noreferrer">Get free Bluefy for iPad / iPhone</a></p>}
    <p className="field-help">Use the same booth URL in Bluefy. Its license, photos and settings are separate from Safari; activate your license there or transfer the existing installation through the host. Do not buy another license just to change browsers.</p>
    <div className="form-grid">
      <label className="field">BLE printable width<select value={b.bleWidth} disabled={locked} onChange={e => b.setBleWidth(+e.target.value)}><option value="576">80 mm paper · 576 dots</option><option value="384">58 mm paper · 384 dots</option></select></label>
      <label className="field">BLE photo lightness<select value={b.bleGamma} disabled={locked} onChange={e => b.setBleGamma(+e.target.value)}><option value="1">Natural</option><option value="1.5">Lighter photos</option><option value="2">Lightest photos</option></select></label>
      <label className="field">BLE transfer speed<select value={b.bleSpeed} disabled={locked} onChange={e => b.setBleSpeed(e.target.value)}><option value="standard">Standard · faster 20-byte transfer</option><option value="fast">Fast · 128-byte packets</option><option value="compatible">Compatibility · slower 20-byte transfer</option></select></label>
    </div>
    <p className="field-help">Match the printable dot width in the printer's self-test. These settings apply only to BLE output; QZ profiles are unchanged. BLE printing is monochrome.</p>
    <p className="field-help">Standard removes unnecessary pauses and keeps small packets. Try Fast only after a successful test; some Bluetooth modules accept only 20 bytes. Failed transfers never replay automatically. Receipts feed and cut once after the image, on printers with an automatic cutter.</p>
    <p role="status">{b.bleName ? `Connected: ${b.bleName}` : "No BLE printer connected. Reconnect after reloading or waking the device."}</p>
    <div className="test-buttons">
      <button className="button button-secondary" disabled={!supported || locked} onClick={b.connectBle}>{b.working ? "Connecting…" : "Find Bluetooth printer"}</button>
      <button className="button button-quiet" disabled={!b.bleName || locked} onClick={b.disconnectBle}>Disconnect Bluetooth</button>
    </div>
    <p className="field-help">Only select your receipt printer. The app checks known ESC/POS BLE endpoints before enabling printing. Poseidon PSD-200I compatibility requires a BLE-capable model; Bluetooth Classic/SPP, USB cables and proprietary label printers do not work through this option.</p>
  </section>;
}

export function BlePrinterGuide() {
  return <>
    <h2>Print from iPad or iPhone</h2>
    <ol className="setup-steps">
      <li><span>1</span><div><h3>Use a BLE browser</h3><p>Install Bluefy, open this booth's HTTPS URL, and allow Bluetooth. Keep the app visible while printing.</p></div></li>
      <li><span>2</span><div><h3>Prepare the printer</h3><p>Turn on the printer and Bluetooth. Disconnect other phones/apps. Check the self-test for BLE / Bluetooth Low Energy and ESC/POS support.</p></div></li>
      <li><span>3</span><div><h3>Connect here</h3><p>Tap Find Bluetooth printer and select your printer in the browser picker. Match its paper width, then load the test artwork.</p></div></li>
      <li><span>4</span><div><h3>Check one print</h3><p>Send one receipt and inspect the image and automatic cut. Keep the screen open until transfer finishes. A failed or interrupted job is never retried automatically.</p></div></li>
    </ol>
    <details className="technical-details"><summary>Printer missing or unable to connect?</summary><p>A Classic-only printer will not appear in a BLE scan. A visible printer can still use an unsupported protocol. Use its self-test or a BLE scanner to identify the model and services before assuming compatibility. USB printing remains unavailable in Safari/Bluefy. AirPrint requires an AirPrint printer; a LAN bridge requires another device.</p></details>
    <a className="text-link" href="https://github.com/at-point-of-sale/WebBluetoothReceiptPrinter" target="_blank" rel="noreferrer">Open-source BLE protocol reference</a>
  </>;
}
