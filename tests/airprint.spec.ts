import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { takePhotos } from "./camera-fixture";

async function configure(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Printer connection", exact: true }).click();
  await page.getByRole("combobox", { name: "Print method", exact: true }).selectOption("airprint");
  await expect(page.getByLabel("QZ host", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Paper size", exact: true })).toHaveValue("photo");
}

async function preview(page: Page) {
  await page.getByRole("button", { name: "Preview AirPrint sheet", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Print your photo sheet" });
  await expect(modal.getByRole("button", { name: "Print / AirPrint", exact: true })).toBeEnabled();
  return modal;
}

test("AirPrint settings persist, sheet fits without cropping, native request is once and remains unresolved", async ({ page }, info) => {
  let sockets = 0; page.on("websocket", () => sockets++);
  await configure(page);
  await page.getByRole("combobox", { name: "Paper size", exact: true }).selectOption("a4");
  await page.reload();
  await page.getByRole("button", { name: "Printer connection", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Print method", exact: true })).toHaveValue("airprint");
  await expect(page.getByRole("combobox", { name: "Paper size", exact: true })).toHaveValue("a4");
  await page.getByRole("combobox", { name: "Paper size", exact: true }).selectOption("photo");
  await page.getByRole("button", { name: "Load printer test artwork" }).click();
  const modal = await preview(page);
  expect(await modal.locator(".airprint-sheet").evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1200, 1800]);
  expect((await new AxeBuilder({ page }).include(".airprint-dialog").withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `artifacts/airprint-${info.project.name}.png` });
  const opened = page.waitForEvent("popup");
  await modal.getByRole("button", { name: "Print / AirPrint", exact: true }).click();
  const printable = await opened;
  await expect(printable.getByRole("button", { name: "Print / AirPrint", exact: true })).toBeEnabled();
  await printable.evaluate(() => { (window as any).printCalls = 0; window.print = () => { (window as any).printCalls++; }; });
  await printable.getByRole("button", { name: "Print / AirPrint", exact: true }).click();
  expect(await printable.evaluate(() => (window as any).printCalls)).toBe(1);
  await expect(printable.getByRole("button", { name: "Print / AirPrint", exact: true })).toBeDisabled();
  await printable.close();
  await expect(modal.getByRole("button", { name: "Print / AirPrint", exact: true })).toHaveCount(0);
  await modal.getByRole("button", { name: "Close AirPrint preview" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Check your last print" })).toContainText("Printing or cancellation is unconfirmed");
  await page.reload();
  await page.getByRole("button", { name: "Printer connection", exact: true }).click();
  await expect(page.getByRole("button", { name: "Preview AirPrint sheet" })).toBeDisabled();
  await page.getByRole("button", { name: "I checked the printer", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Print method", exact: true })).toBeEnabled();
  expect(sockets).toBe(0);
});

test("kiosk AirPrint works offline and printable fallback produces one 4x6 page, history can reprint", async ({ page, context }) => {
  await configure(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog", { name: "PhotoTags LRB guest kiosk" });
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await takePhotos(page);
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  await expect(kiosk.getByRole("button", { name: "Print my receipt" })).toBeEnabled();
  await kiosk.getByRole("button", { name: "Print my receipt" }).click();
  const modal = page.getByRole("dialog", { name: "Print your photo sheet" });
  await expect(modal.getByRole("button", { name: "Print / AirPrint" })).toBeEnabled();
  const popupEvent = page.waitForEvent("popup");
  await modal.getByRole("button", { name: "Print / AirPrint" }).click();
  const popup = await popupEvent;
  await expect(popup.getByRole("button", { name: "Print / AirPrint" })).toBeEnabled();
  await popup.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  const pdf = await popup.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  expect(pdf.toString("latin1")).toContain("/MediaBox [0 0 288 432]");
  expect(pdf.toString("latin1")).toContain("/Subtype /Image");
  await popup.close();
  await modal.getByRole("button", { name: "Close AirPrint preview" }).click();
  await kiosk.getByRole("button", { name: "Host: review this print" }).click();
  await kiosk.getByRole("button", { name: "I checked the printer", exact: true }).click();
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await page.getByRole("button", { name: "Exit to Settings", exact: true }).click();
  await page.getByRole("button", { name: "Photo history", exact: true }).click();
  await page.getByRole("button", { name: /^Open folder / }).first().click();
  await page.getByRole("button", { name: /^View receipt from / }).first().click();
  await page.getByRole("button", { name: "Reprint receipt", exact: true }).click();
  await expect(modal.getByRole("button", { name: "Print / AirPrint", exact: true })).toBeEnabled();
  await modal.getByRole("button", { name: "Close AirPrint preview" }).click();
  expect(await page.evaluate(() => localStorage.getItem("pendingPrint"))).toBe("");
});

test("blocked printable popup does not create a print job and can be cancelled safely", async ({ page }) => {
  await configure(page);
  await page.getByRole("button", { name: "Load printer test artwork" }).click();
  const modal = await preview(page);
  await page.evaluate(() => { window.open = () => null; });
  await modal.getByRole("button", { name: "Print / AirPrint" }).click();
  await expect(modal.getByRole("alert")).toContainText("blocked");
  expect(await page.evaluate(() => localStorage.getItem("pendingPrint"))).toBeNull();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview AirPrint sheet" })).toBeEnabled();
});

test("decoration Color switch changes actual receipt and AirPrint pixels without reducing resolution", async ({ page }, info) => {
  await configure(page);
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog", { name: "PhotoTags LRB guest kiosk" });
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await takePhotos(page);
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  const toggle = kiosk.getByRole("switch", { name: "Color receipt", exact: true });
  await expect(toggle).toBeChecked();
  expect(await toggle.locator("..").evaluate(label => {
    const box = label.getBoundingClientRect();
    return document.elementFromPoint(box.right - 4, box.top + box.height / 2)?.closest(".receipt-color-toggle") === label;
  })).toBe(true);
  const receipt = kiosk.getByAltText("Your themed receipt preview");
  const chroma = async (selector: typeof receipt) => selector.evaluate(async (img: HTMLImageElement) => {
    await img.decode(); const c = document.createElement("canvas"); c.width = 200; c.height = 300;
    c.getContext("2d")!.drawImage(img, 0, 0, 200, 300);
    const pixels = c.getContext("2d")!.getImageData(0, 0, 200, 300).data;
    let count = 0; for (let i = 0; i < pixels.length; i += 4) if (Math.max(pixels[i], pixels[i+1], pixels[i+2]) - Math.min(pixels[i], pixels[i+1], pixels[i+2]) > 10) count++;
    return count;
  });
  await expect.poll(() => chroma(receipt)).toBeGreaterThan(100);
  const original = await receipt.getAttribute("src");
  await toggle.uncheck();
  await expect.poll(() => chroma(receipt)).toBe(0);
  expect(await receipt.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1200);
  await page.screenshot({ path: `artifacts/receipt-monochrome-${info.project.name}.png` });
  await toggle.check();
  await expect(receipt).toHaveAttribute("src", original!);
  await expect.poll(() => chroma(receipt)).toBeGreaterThan(100);
  await toggle.uncheck();
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  await expect.poll(() => chroma(kiosk.getByAltText("Your final receipt"))).toBe(0);
  await kiosk.getByRole("button", { name: "Print my receipt" }).click();
  const sheet = page.getByRole("dialog", { name: "Print your photo sheet" });
  await expect(sheet.getByRole("button", { name: "Print / AirPrint", exact: true })).toBeEnabled();
  expect(await chroma(sheet.locator(".airprint-sheet"))).toBe(0);
});
