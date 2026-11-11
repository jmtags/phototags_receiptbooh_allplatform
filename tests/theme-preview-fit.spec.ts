import { test, expect } from "@playwright/test";

test("smaller themes and full receipt remain visible above the footer", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.locator(".kiosk-dialog");
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await kiosk
    .locator('input[name="kiosk-photo"]')
    .setInputFiles("public/icons/icon-512.png");
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  const sizes =
    info.project.name === "desktop"
      ? [
          { width: 1363, height: 766 },
          { width: 1440, height: 900 },
          { width: 320, height: 640 },
          { width: 844, height: 390 },
        ]
      : [page.viewportSize()!];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await kiosk
      .getByRole("button", { name: "Super Snap", exact: true })
      .click();
    const canvas = kiosk.locator(".receipt-canvas");
    await expect(canvas).toBeInViewport({ ratio: 0.99 });
    const box = (await canvas.boundingBox())!;
    const footer = (await kiosk.locator(".kiosk-footer").boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(footer.y);
    const image = await canvas
      .locator("img")
      .evaluate((img: HTMLImageElement) => ({
        width: img.naturalWidth,
        height: img.naturalHeight,
      }));
    expect(box.width / box.height).toBeCloseTo(image.width / image.height, 2);
    const themes = kiosk.getByRole("group", { name: "Choose receipt theme" });
    const rail = (await themes.boundingBox())!;
    expect(rail.y + rail.height).toBeLessThanOrEqual(footer.y);
    await page.screenshot({
      path: `artifacts/theme-fit-${info.project.name}-${size.width}-${size.height}.png`,
    });
    const last = themes.getByRole("button").last();
    await last.click();
    await expect(last).toHaveAttribute("aria-pressed", "true");
    await expect(
      kiosk.getByRole("button", { name: "Review receipt" }),
    ).toBeEnabled();
  }
});
