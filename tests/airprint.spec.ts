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
  const frame = page.frames().find(f => f.parentFrame())!;
  await frame.evaluate(() => { (window as any).printCalls = 0; window.print = () => { (window as any).printCalls++; }; });
  await modal.getByRole("button", { name: "Print / AirPrint", exact: true }).click();
  expect(await frame.evaluate(() => (window as any).printCalls)).toBe(1);
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
  await expect(modal.getByRole("button", { name: "Open printable page" })).toBeEnabled();
  const popupEvent = page.waitForEvent("popup");
  await modal.getByRole("button", { name: "Open printable page" }).click();
  const popup = await popupEvent;
  await expect(popup.getByRole("button", { name: "Print / AirPrint" })).toBeVisible();
  await popup.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  const pdf = await popup.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  expect(pdf.toString("latin1")).toContain("/MediaBox [0 0 288 432]");
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
  await modal.getByRole("button", { name: "Open printable page" }).click();
  await expect(modal.getByRole("alert")).toContainText("blocked");
  expect(await page.evaluate(() => localStorage.getItem("pendingPrint"))).toBeNull();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview AirPrint sheet" })).toBeEnabled();
});
