import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function checkHeader(kiosk: Locator, step: number) {
  const header = kiosk.locator(".kiosk-header");
  const progress = header.getByRole("navigation", { name: "Booth progress" });
  await expect(progress).toBeVisible();
  await expect(progress.locator('li[aria-current="step"]')).toContainText(
    ["Choose layout", "Take a photo", "Choose theme", "Print & keep"][step - 1],
  );
  await expect(header.locator(".kiosk-brand")).toHaveCount(0);
  expect((await header.boundingBox())!.y).toBe(0);
  for (const label of [
    "Choose layout",
    "Take a photo",
    "Choose theme",
    "Print & keep",
  ])
    await expect(progress.getByText(label, { exact: true })).toBeInViewport({
      ratio: 0.99,
    });
  const exit = header.getByRole("button", { name: "Exit kiosk", exact: true });
  await expect(exit).toBeInViewport({ ratio: 0.99 });
  expect((await exit.textContent())!.trim()).toBe("");
  const box = (await exit.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(
    (await progress.boundingBox())!.x + (await progress.boundingBox())!.width,
  ).toBeLessThanOrEqual(box.x);
}

test("progress replaces the brand bar on every step and icon exit retains PIN protection", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Security", exact: true }).click();
  await page.getByLabel("New six-digit PIN", { exact: true }).fill("123456");
  await page.getByLabel("Confirm new PIN", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Set exit PIN" }).click();
  await expect(
    page.getByText("PIN protection is on.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog");
  await expect(kiosk.locator(".kiosk-header")).toHaveCount(0);
  const welcomeExit = kiosk.getByRole("button", {
    name: "Exit kiosk",
    exact: true,
  });
  await expect(welcomeExit).toBeInViewport({ ratio: 0.99 });
  await expect(welcomeExit).toHaveCSS("backdrop-filter", "blur(14px)");
  await page.screenshot({
    path: `artifacts/kiosk-welcome-glass-${info.project.name}.png`,
  });
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await checkHeader(kiosk, 1);
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await checkHeader(kiosk, 2);
  await kiosk.getByRole("button", { name: "Enlarge camera view" }).click();
  await checkHeader(kiosk, 2);
  await kiosk
    .locator('input[name="kiosk-photo"]')
    .setInputFiles("public/icons/icon-512.png");
  await page.screenshot({
    path: `artifacts/kiosk-header-expanded-${info.project.name}.png`,
  });
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await checkHeader(kiosk, 3);
  await kiosk.getByRole("button", { name: "Super Snap", exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".kiosk-header")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `artifacts/kiosk-header-themes-${info.project.name}.png`,
  });
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  await checkHeader(kiosk, 4);
  if (info.project.name === "desktop") {
    await page.setViewportSize({ width: 320, height: 640 });
    await checkHeader(kiosk, 4);
    await page.setViewportSize({ width: 844, height: 390 });
    await checkHeader(kiosk, 4);
  }
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await expect(
    kiosk.getByRole("heading", { name: "Enter host PIN" }),
  ).toBeVisible();
  await kiosk.getByRole("button", { name: "Keep booth open" }).click();
  await checkHeader(kiosk, 4);
});
