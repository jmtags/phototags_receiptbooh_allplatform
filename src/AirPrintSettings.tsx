import type { BoothModel } from "./useBooth";
import { airPrintPapers, type AirPrintPaper } from "./airprint";

export function AirPrintSettings({ booth: b }: { booth: BoothModel }) {
  return <>
    <label className="field queue-field">Paper size
      <select value={b.airPrintPaper} disabled={b.busy || !!b.job} onChange={e => b.setAirPrintPaper(e.target.value as AirPrintPaper)}>
        {Object.entries(airPrintPapers).map(([key, paper]) => <option value={key} key={key}>{paper.name}</option>)}
      </select>
    </label>
    <p className="field-help">Use 4 × 6 inch photo paper for Xiaomi Instant Photo Printer 1S. The full receipt fits onto one sheet with a white border and no cropping. Longer receipts appear smaller.</p>
    <p className="field-help">AirPrint uses the high-resolution receipt in its original tones. Thermal lightness and ESC/POS profiles apply only to receipt printers.</p>
  </>;
}

export function AirPrintGuide() {
  return <>
    <h2>Print from your iPad</h2>
    <ol className="setup-steps">
      <li><span>1</span><div><h3>Connect to Wi-Fi</h3><p>Set up Xiaomi 1S in Xiaomi Home, then connect the iPad and printer to the same Wi-Fi.</p></div></li>
      <li><span>2</span><div><h3>Choose your paper</h3><p>Use the matching paper size here and in the system print dialog.</p></div></li>
      <li><span>3</span><div><h3>Open Print / AirPrint</h3><p>Preview the sheet, open the system print dialog and select your printer. The printer list is provided by iPadOS.</p></div></li>
      <li><span>4</span><div><h3>Check the output</h3><p>Choose one copy. Review the paper before clearing the attempt, including after cancelling.</p></div></li>
    </ol>
    <p className="field-help">If printing does not open from the Home Screen app, use Open printable page in the sheet preview. Print from that page and return here.</p>
    <p className="field-help">AirPrint requires an AirPrint-compatible printer. USB or Bluetooth alone does not add AirPrint support to the Poseidon PSD-200I. Photo printers use sheets rather than a receipt roll.</p>
    <a className="text-link" href="https://support.apple.com/109349" target="_blank" rel="noreferrer">Apple AirPrint setup guide</a>
  </>;
}
