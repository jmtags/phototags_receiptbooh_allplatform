import { image, monochrome } from "./receipt";

// ESC/POS GATT endpoints documented by the MIT WebBluetoothReceiptPrinter project.
// These are protocol identifiers, not a claim of support for any particular printer model.
export const bleEndpoints = [
  ["000018f0-0000-1000-8000-00805f9b34fb", "00002af1-0000-1000-8000-00805f9b34fb"],
  ["0000ff00-0000-1000-8000-00805f9b34fb", "0000ff02-0000-1000-8000-00805f9b34fb"],
  ["0000ffe0-0000-1000-8000-00805f9b34fb", "0000ffe1-0000-1000-8000-00805f9b34fb"],
  ["49535343-fe7d-4ae5-8fa9-9fafd205e455", "49535343-8841-43f4-a8d4-ecbe34729bb3"],
  ["e7810a71-73ae-499d-8c15-faa9aef0c3f2", "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f"],
] as const;
type Characteristic = {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValueWithResponse?: (data: Uint8Array) => Promise<void>;
  writeValueWithoutResponse?: (data: Uint8Array) => Promise<void>;
  writeValue?: (data: Uint8Array) => Promise<void>;
};
type Device = EventTarget & {
  name?: string;
  gatt?: { connected: boolean; connect(): Promise<Server>; disconnect(): void };
};
type Server = { getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<Characteristic> }> };
type Bluetooth = { requestDevice(options: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<Device> };
export function bluetoothAvailable() {
  return !!(navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth?.requestDevice;
}
function deadline<T>(operation: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Bluetooth operation timed out. Check the printer before reconnecting.")), ms);
    operation.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}
export class BleReceiptPrinter {
  private device: Device | null = null;
  private characteristic: Characteristic | null = null;
  private sending = false;
  private connecting = false;
  onChange: (name: string) => void = () => {};
  get connected() { return !!this.device?.gatt?.connected && !!this.characteristic; }
  private dropped = () => { this.characteristic = null; this.onChange(""); };
  disconnect() {
    const device = this.device;
    this.device = null; this.characteristic = null;
    device?.removeEventListener("gattserverdisconnected", this.dropped);
    device?.gatt?.disconnect(); this.onChange("");
  }
  async connect() {
    if (this.sending || this.connecting) throw new Error("Wait for the current Bluetooth operation.");
    const bluetooth = (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;
    if (!bluetooth?.requestDevice) throw new Error("This browser cannot access BLE. On iPad/iPhone, open this booth in Bluefy and allow Bluetooth. Safari and Home Screen apps need AirPrint or a LAN bridge.");
    this.connecting = true;
    try {
      this.disconnect();
      // Keep the picker in the initiating user gesture; never auto-pair or auto-reconnect.
      const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: bleEndpoints.map(pair => pair[0]) });
      this.device = device;
      device.addEventListener("gattserverdisconnected", this.dropped);
      if (!device.gatt) throw new Error("The selected device does not expose Bluetooth Low Energy GATT.");
      const connection = device.gatt.connect();
      // A connection that resolves after our timeout must not remain orphaned.
      void connection.then(() => { if (this.device !== device) device.gatt?.disconnect(); }, () => {});
      const server = await deadline(connection);
      for (const [service, characteristic] of bleEndpoints) {
        try {
          const port = await deadline((await deadline(server.getPrimaryService(service))).getCharacteristic(characteristic));
          if ((port.properties.write && (port.writeValueWithResponse || port.writeValue)) || (port.properties.writeWithoutResponse && port.writeValueWithoutResponse)) {
            this.characteristic = port; break;
          }
        } catch { /* Probe only the known ESC/POS endpoints; do not write to arbitrary services. */ }
      }
      if (!this.connected) throw new Error("No supported ESC/POS BLE write endpoint found. Bluetooth Classic, label/cat-printer protocols and USB are not supported by this mode. Check the printer's BLE specification or use the LAN bridge.");
      this.onChange(device.name || "BLE receipt printer");
    } catch (error) { this.disconnect(); throw error; }
    finally { this.connecting = false; }
  }
  async submit(bytes: Uint8Array) {
    if (this.sending) throw new Error("A Bluetooth print is already running.");
    const port = this.characteristic, device = this.device;
    if (!port || !this.connected) throw new Error("Reconnect the BLE printer in Settings first.");
    this.sending = true;
    try {
      for (let offset = 0; offset < bytes.length; offset += 20) {
        if (!this.connected || this.device !== device) throw new Error("Bluetooth disconnected during printing.");
        const packet = bytes.slice(offset, offset + 20);
        // Prefer acknowledged writes. Never replay failed packets: partial delivery is uncertain.
        if (port.properties.write && port.writeValueWithResponse) await deadline(port.writeValueWithResponse(packet), 10000);
        else if (port.properties.write && port.writeValue) await deadline(port.writeValue(packet), 10000);
        else if (port.properties.writeWithoutResponse && port.writeValueWithoutResponse) await deadline(port.writeValueWithoutResponse(packet), 10000);
        else throw new Error("The BLE write method is unavailable.");
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) { this.disconnect(); throw error; }
    finally { this.sending = false; }
  }
}

// This separate generic raster path does not change Deli/G80 commands, cut or feed behavior.
export function encodeBleRaster(bits: Uint8Array, width: number, height: number) {
  if (![384, 576].includes(width) || !Number.isInteger(height) || height < 1 || height > 65535 || bits.length !== width * height) throw new Error("Invalid BLE raster dimensions.");
  const stride = width / 8, out: number[] = [27, 64, 27, 97, 1];
  // Short bands avoid a single large image command overrunning small printer buffers.
  for (let top = 0; top < height; top += 64) {
    const rows = Math.min(64, height - top);
    out.push(29, 118, 48, 0, stride & 255, stride >> 8, rows, 0);
    for (let y = top; y < top + rows; y++) for (let x = 0; x < width; x += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) if (bits[y * width + x + bit]) byte |= 128 >> bit;
      out.push(byte);
    }
  }
  out.push(10, 10, 10); // Feed only. No unverified cutter command.
  return new Uint8Array(out);
}
export async function bleImageJob(source: string, width: number, gamma: number) {
  const img = await image(source), canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = Math.round(width * img.naturalHeight / img.naturalWidth);
  if (canvas.height < 1 || canvas.height > 65535) throw new Error("This image is too tall to print.");
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, width, canvas.height); ctx.drawImage(img, 0, 0, width, canvas.height);
  const bits = monochrome(ctx.getImageData(0, 0, width, canvas.height).data, width, canvas.height, "g80", gamma);
  return encodeBleRaster(bits, width, canvas.height);
}
