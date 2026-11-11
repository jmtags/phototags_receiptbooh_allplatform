import { test, expect } from "@playwright/test";
import { takePhotos } from "./camera-fixture";

test("shutter flashes once per capture while upload and the previous editor remain available", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog");
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "4 shots", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await expect(kiosk.locator('input[type="file"]')).toBeVisible();
  await expect(kiosk).not.toHaveClass(/is-decorate-step/);
  await page.evaluate(() => {
    (window as any).shutterFrames = 0;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (
            node instanceof HTMLElement &&
            node.classList.contains("shutter-flash")
          )
            (window as any).shutterFrames++;
    }).observe(document.body, { subtree: true, childList: true });
  });
  await kiosk.locator('input[type="file"]').setInputFiles("public/icons/icon-512.png");
  await expect(kiosk.locator(".shot-gallery img")).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).shutterFrames)).toBe(0);
  await takePhotos(page, 4);
  expect(await page.evaluate(() => (window as any).shutterFrames)).toBe(3);
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await kiosk.getByRole("button", { name: "Super Snap", exact: true }).click();
  await expect(kiosk).not.toHaveClass(/is-decorate-step/);
  await expect(
    kiosk.getByRole("button", {
      name: "Add Rainbow Party Hat sticker",
      exact: true,
    }),
  ).toBeVisible();
  await kiosk.getByRole("button", { name: "Signature", exact: true }).click();
  await expect(kiosk.locator(".receipt-canvas")).toBeVisible();
});
