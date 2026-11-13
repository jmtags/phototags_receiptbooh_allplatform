import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { takePhotos } from "./camera-fixture";

async function fakeBluetooth(page: Page, options: { failAt?: number; unsupported?: boolean; legacy?: boolean; hold?: boolean } = {}) {
  await page.addInitScript(options => {
    const w = window as any;
    w.bleFixture = { packets: [], requests: [], waits: [], failAt: options.failAt, pendingBeforeWrite: false, held: false };
    const state = w.bleFixture, device: any = new EventTarget();
    device.name = "Poseidon BLE fixture";
    device.gatt = {
      connected: false,
      connect: async () => { device.gatt.connected = true; return {
        getPrimaryService: async (uuid: string) => {
          if (options.unsupported || uuid !== "000018f0-0000-1000-8000-00805f9b34fb") throw new Error("Service absent");
          return { getCharacteristic: async () => {
            const write = async (bytes: Uint8Array) => {
              state.pendingBeforeWrite = !!localStorage.getItem("pendingPrint");
              if (options.hold && !state.held) { state.held = true; await new Promise(resolve => state.release = resolve); }
              state.packets.push(Array.from(bytes));
              if (state.failAt && state.packets.length === state.failAt) throw new Error("BLE link lost after partial write");
            };
            return options.legacy ? { properties: { write: true }, writeValue: write } : { properties: { write: false, writeWithoutResponse: true }, writeValueWithoutResponse: write };
          } };
        }
      }; },
      disconnect: () => { device.gatt.connected = false; device.dispatchEvent(new Event("gattserverdisconnected")); }
    };
    state.drop = () => device.gatt.disconnect();
    Object.defineProperty(navigator, "bluetooth", { configurable: true, value: { requestDevice: async (options: unknown) => { state.requests.push(options); return device; } } });
    const delay = window.setTimeout;
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: any[]) => {
      if ((ms === 2 || ms === 10) && typeof fn === "function") { state.waits.push(ms); queueMicrotask(() => fn(...args)); return 0; }
      return delay(fn, ms, ...args);
    }) as typeof window.setTimeout;
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: () => Promise.reject(new Error("fixture viewport")) });
  }, options);
}
async function setup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Printer connection", exact: true }).click();
  await page.getByRole("combobox", { name: "Print method", exact: true }).selectOption("ble");
}
async function pair(page: Page) {
  await page.getByRole("button", { name: "Find Bluetooth printer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Connected:" })).toContainText("Poseidon BLE fixture");
}

test("Safari setup explains Bluefy, persists BLE settings and leaves QZ preferences alone", async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "bluetooth", { configurable: true, value: undefined }));
  await setup(page);
  await expect(page.getByRole("link", { name: "Get free Bluefy for iPad / iPhone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Find Bluetooth printer" })).toBeDisabled();
  await expect(page.getByLabel("QZ host", { exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "BLE printable width", exact: true }).selectOption("384");
  await page.getByRole("combobox", { name: "BLE photo lightness", exact: true }).selectOption("2");
  await page.getByRole("combobox", { name: "BLE transfer speed", exact: true }).selectOption("fast");
  expect((await new AxeBuilder({ page }).include(".setup-layout").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()).violations.map(v => v.id)).toEqual([]);
  await page.screenshot({ path: `artifacts/ble-setup-${info.project.name}.png`, fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "Printer connection", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Print method", exact: true })).toHaveValue("ble");
  await expect(page.getByRole("combobox", { name: "BLE printable width", exact: true })).toHaveValue("384");
  await expect(page.getByRole("combobox", { name: "BLE photo lightness", exact: true })).toHaveValue("2");
  await expect(page.getByRole("combobox", { name: "BLE transfer speed", exact: true })).toHaveValue("fast");
  await page.getByRole("combobox", { name: "Print method", exact: true }).selectOption("qz");
  await expect(page.getByRole("combobox", { name: "Printer profile", exact: true })).toHaveValue("deli");
  await expect(page.getByLabel("QZ host", { exact: true })).toHaveValue("localhost");
  await expect(page.getByRole("combobox", { name: "Photo lightness", exact: true })).toHaveValue("1");
});

test("BLE sends one paced raster job, preserves unresolved safety and reconnects explicitly", async ({ page }) => {
  let sockets = 0; page.on("websocket", () => sockets++);
  await fakeBluetooth(page, { hold: true }); await setup(page); await pair(page);
  await page.getByRole("button", { name: "Load printer test artwork" }).click();
  await expect(page.getByRole("button", { name: "Send one receipt" })).toBeEnabled();
  await page.getByRole("button", { name: "Send one receipt" }).click();
  await expect.poll(() => page.evaluate(() => (window as any).bleFixture.held)).toBe(true);
  await expect(page.getByRole("button", { name: "Send one receipt" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Print method", exact: true })).toBeDisabled();
  await page.evaluate(() => (window as any).bleFixture.release());
  await expect(page.getByRole("status").filter({ hasText: "Check your last print" })).toContainText("Sent to the BLE printer", { timeout: 20000 });
  const wire = await page.evaluate(() => { const s = (window as any).bleFixture, bytes = s.packets.flat(); return { first: bytes.slice(0, 13), tail: bytes.slice(-7), size: bytes.length, max: Math.max(...s.packets.map((p: number[]) => p.length)), count: s.packets.length, pending: s.pendingBeforeWrite, requests: s.requests.length }; });
  expect(wire.first.slice(0, 11)).toEqual([27, 64, 27, 97, 1, 29, 118, 48, 0, 72, 0]);
  const height = wire.first[11] + wire.first[12] * 256;
  expect(height).toBeGreaterThan(64);
  expect(wire.size).toBe(13 + 72 * height + 7);
  expect(wire.tail).toEqual([10,10,10,29,86,66,0]);
  expect(wire.max).toBe(20); expect(wire.count).toBeGreaterThan(100); expect(wire.pending).toBe(true); expect(wire.requests).toBe(1); expect(sockets).toBe(0);
  await expect(page.getByRole("button", { name: "Send one receipt" })).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Printer connection", exact: true }).click();
  await expect(page.getByRole("button", { name: "Find Bluetooth printer" })).toBeDisabled();
  await page.getByRole("button", { name: "I checked the printer", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "No BLE printer" })).toBeVisible();
  expect(await page.evaluate(() => (window as any).bleFixture.requests.length)).toBe(0);
  await pair(page); await page.evaluate(() => (window as any).bleFixture.drop());
  await expect(page.getByRole("button", { name: "Send one receipt" })).toBeDisabled();
});

test("partial BLE failure never replays data or silently switches to QZ", async ({ page }) => {
  let sockets = 0; page.on("websocket", () => sockets++);
  await fakeBluetooth(page, { failAt: 3 }); await setup(page); await pair(page);
  await page.getByRole("button", { name: "Load printer test artwork" }).click();
  await expect(page.getByRole("button", { name: "Send one receipt" })).toBeEnabled();
  await page.getByRole("button", { name: "Send one receipt" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Check your last print" })).toContainText("Output uncertain");
  expect(await page.evaluate(() => (window as any).bleFixture.packets.length)).toBe(3);
  await expect(page.getByRole("button", { name: "Send one receipt" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Find Bluetooth printer" })).toBeDisabled();
  expect(sockets).toBe(0);
});

test("unknown BLE services are rejected without any write", async ({ page }) => {
  await fakeBluetooth(page, { unsupported: true }); await setup(page);
  await page.getByRole("button", { name: "Find Bluetooth printer" }).click();
  await expect(page.getByRole("alert")).toContainText("No supported ESC/POS BLE write endpoint");
  expect(await page.evaluate(() => (window as any).bleFixture.packets.length)).toBe(0);
});

test("BLE receipt kiosk works offline through the legacy iOS write method", async ({ page, context }) => {
  await fakeBluetooth(page, { legacy: true }); await setup(page); await pair(page);
  await page.getByRole("combobox", { name: "BLE printable width", exact: true }).selectOption("384");
  await expect(page.getByText("Ready for offline use", { exact: true }).first()).toBeAttached({ timeout: 20000 });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog", { name: "PhotoTags LRB guest kiosk", exact: true });
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click(); await takePhotos(page);
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  await kiosk.getByRole("button", { name: "Print my receipt" }).click();
  await expect(kiosk.getByRole("heading", { name: "Sent to your Bluetooth printer." })).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => (window as any).bleFixture.packets.flat().slice(9, 11))).toEqual([48, 0]);
  await kiosk.getByRole("button", { name: "Host: review this print" }).click();
  await kiosk.getByRole("button", { name: "I checked the printer", exact: true }).click();
  await expect(kiosk.getByRole("button", { name: "Print my receipt" })).toBeEnabled();
});

test("continuous BLE raster preserves every row and feeds/cuts once, like both QZ profiles", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Shared protocol check");
  await page.goto("/");
  const receipt = ts.transpile(await readFile("src/receipt.ts", "utf8"), { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
  const ble = ts.transpile(await readFile("src/blePrinting.ts", "utf8"), { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
  const result = await page.evaluate(async ({ receipt, ble }) => {
    const receiptUrl = URL.createObjectURL(new Blob([receipt], { type: "text/javascript" }));
    const m = await import(URL.createObjectURL(new Blob([ble.replace('"./receipt"', JSON.stringify(receiptUrl))], { type: "text/javascript" })));
    const bits = new Uint8Array(384 * 65); bits[0] = 1; bits[383] = 1; bits[384 * 64] = 1;
    const data = m.encodeBleRaster(bits, 384, 65);
    let rejected = false; try { m.encodeBleRaster(bits, 385, 65); } catch { rejected = true; }
    const original = await import(receiptUrl);
    return { head: [...data.slice(0, 14)], lastPixel: data[13 + 47], row65: data[13 + 48 * 64], tail: [...data.slice(-7)], length: data.length, rejected, cuts: ["deli", "g80"].map(profile => [...original.encode(new Uint8Array(original.profiles[profile].width), original.profiles[profile].width, 1, profile).slice(-4)]) };
  }, { receipt, ble });
  expect(result).toEqual({ head: [27,64,27,97,1,29,118,48,0,48,0,65,0,128], lastPixel: 1, row65: 128, tail: [10,10,10,29,86,66,0], length: 13 + 48 * 65 + 7, rejected: true, cuts: [[29,86,66,0],[29,86,66,0]] });
});

test("BLE speed presets reduce pauses and packet count without replay", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Shared transport check");
  await fakeBluetooth(page); await page.goto("/");
  const receipt = ts.transpile(await readFile("src/receipt.ts", "utf8"), { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
  const ble = ts.transpile(await readFile("src/blePrinting.ts", "utf8"), { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
  const result = await page.evaluate(async ({ receipt, ble }) => {
    const receiptUrl = URL.createObjectURL(new Blob([receipt], { type: "text/javascript" }));
    const m = await import(URL.createObjectURL(new Blob([ble.replace('"./receipt"', JSON.stringify(receiptUrl))], { type: "text/javascript" })));
    const printer = new m.BleReceiptPrinter(); await printer.connect(); const results = [];
    for (const speed of ["standard", "fast", "compatible"]) {
      const state = (window as any).bleFixture; state.packets = []; state.waits = [];
      await printer.submit(new Uint8Array(256), speed);
      results.push({ speed, packets: state.packets.map((p: number[]) => p.length), waits: [...state.waits], bytes: state.packets.flat().length });
    }
    printer.disconnect(); return results;
  }, { receipt, ble });
  expect(result.map(r => [r.speed, r.packets.length, r.bytes])).toEqual([["standard",13,256],["fast",2,256],["compatible",13,256]]);
  expect(result[0].waits).toEqual(Array(13).fill(2));
  expect(result[1].packets).toEqual([128,128]);
  expect(result[2].waits).toEqual(Array(13).fill(10));
});

test("PhotoBooth BLE print and history reprint use the same decorated sheet", async ({ page }) => {
  await fakeBluetooth(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => {
      const c = document.createElement("canvas"); c.width = 1280; c.height = 960;
      c.getContext("2d")!.fillRect(0, 0, 1280, 960); return c.captureStream(10);
    } });
    const delay = window.setTimeout;
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: any[]) => delay(fn, ms === 1000 ? 20 : ms, ...args)) as typeof setTimeout;
  });
  await setup(page); await pair(page);
  await page.getByRole("button", { name: "Launch PhotoBooth", exact: true }).click();
  const kiosk = page.getByRole("dialog", { name: "PhotoTags LRB PhotoBooth kiosk", exact: true });
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await expect(kiosk.getByRole("heading", { name: "Make it yours.", exact: true })).toBeVisible({ timeout: 20000 });
  await kiosk.getByRole("button", { name: "Review photo", exact: true }).click();
  await kiosk.getByRole("button", { name: "Print my photo", exact: true }).click();
  await expect(kiosk.getByRole("heading", { name: "Sent to your Bluetooth printer." })).toBeVisible({ timeout: 20000 });
  const original = await page.evaluate(() => (window as any).bleFixture.packets.flat());
  await kiosk.getByRole("button", { name: "Host: review this print" }).click();
  await kiosk.getByRole("button", { name: "I checked the printer", exact: true }).click();
  await expect(kiosk.getByRole("heading", { name: "Your photos are ready to download." })).toBeVisible();
  await kiosk.getByRole("button", { name: "Finish PhotoBooth session", exact: true }).click();
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await page.getByRole("button", { name: "Photo history", exact: true }).click();
  await page.getByRole("button", { name: /^Open folder / }).first().click();
  const gallery = page.locator(".history-modal");
  await gallery.getByRole("button", { name: /^View receipt from / }).first().click();
  await page.evaluate(() => (window as any).bleFixture.packets = []);
  await gallery.getByRole("button", { name: "Reprint receipt", exact: true }).click();
  await expect(gallery.getByRole("status").filter({ hasText: "Check your last print" })).toContainText("Sent to the BLE printer", { timeout: 20000 });
  const reprint = await page.evaluate(() => (window as any).bleFixture.packets.flat());
  expect(Buffer.from(original).equals(Buffer.from(reprint))).toBe(true);
});
