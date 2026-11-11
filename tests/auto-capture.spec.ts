import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await page.getByLabel("Capture countdown").selectOption("1");
  await page
    .getByRole("switch", { name: "Automatic capture in Step 2" })
    .check();
}
async function enter(page: Page, shots = 1) {
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const k = page.getByRole("dialog");
  await k.getByRole("button", { name: "Start", exact: true }).click();
  await k
    .getByRole("button", {
      name: `${shots} ${shots === 1 ? "shot" : "shots"}`,
      exact: true,
    })
    .click();
  await k.getByRole("button", { name: "Continue to camera" }).click();
  return k;
}
async function synthetic(page: Page, deferred = false) {
  await page.addInitScript((deferred) => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
    (window as any).mediaCalls = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        (window as any).mediaCalls++;
        const c = document.createElement("canvas");
        c.width = 640;
        c.height = 480;
        c.getContext("2d")!.fillRect(0, 0, 640, 480);
        const stream = c.captureStream(10);
        (window as any).autoStream = stream;
        if (deferred && (window as any).mediaCalls === 1)
          await new Promise(
            (resolve) => ((window as any).allowCamera = resolve),
          );
        return stream;
      },
    });
  }, deferred);
}

test("saved automatic mode captures all shots once, retains completed photos and can be disabled", async ({
  page,
}, info) => {
  await synthetic(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Automatic capture in Step 2" }),
  ).not.toBeChecked();
  await page.getByLabel("Capture countdown").selectOption("1");
  await page
    .getByRole("switch", { name: "Automatic capture in Step 2" })
    .check();
  await page.reload();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Automatic capture in Step 2" }),
  ).toBeChecked();
  const k = await enter(page, 4);
  await expect(k.locator(".countdown")).toHaveText("1");
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled({ timeout: 10000 });
  await expect(k.locator(".shot-gallery img")).toHaveCount(4);
  expect(await page.evaluate(() => (window as any).mediaCalls)).toBe(1);
  expect(
    await page.evaluate(() =>
      (window as any).autoStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await k.getByRole("button", { name: "Continue to themes" }).click();
  await k.getByRole("button", { name: "Back", exact: true }).click();
  await expect(k.locator(".shot-gallery img")).toHaveCount(4);
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  expect(await page.evaluate(() => (window as any).mediaCalls)).toBe(1);
  await k.getByRole("button", { name: "Exit kiosk" }).click();
  await k.getByRole("button", { name: "Exit to Settings" }).click();
  await page
    .getByRole("switch", { name: "Automatic capture in Step 2" })
    .uncheck();
  await page.reload();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Automatic capture in Step 2" }),
  ).not.toBeChecked();
  await enter(page);
  await expect(
    k.getByRole("button", { name: "Open camera", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => (window as any).mediaCalls)).toBe(0);
  await page.screenshot({
    path: `artifacts/auto-capture-disabled-${info.project.name}.png`,
  });
});

test("stopping automatic camera permission prevents a late capture and reentry starts a fresh run", async ({
  page,
}, info) => {
  await synthetic(page, true);
  await setup(page);
  const k = await enter(page, 2);
  await expect(
    k.getByRole("button", { name: "Stop automatic capture" }),
  ).toBeVisible();
  await expect(
    k.getByRole("button", { name: "Stop automatic capture" }),
  ).toBeInViewport();
  await page.screenshot({
    path: `artifacts/auto-capture-waiting-${info.project.name}.png`,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await k.getByRole("button", { name: "Stop automatic capture" }).click();
  await page.evaluate(() => (window as any).allowCamera());
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).autoStream
          .getTracks()
          .every((t: MediaStreamTrack) => t.readyState === "ended"),
      ),
    )
    .toBe(true);
  await expect(k.locator(".shot-gallery img")).toHaveCount(0);
  await expect(
    k.getByRole("button", { name: "Open camera", exact: true }),
  ).toBeEnabled();
  await k.getByRole("button", { name: "Back", exact: true }).click();
  await k.getByRole("button", { name: "Continue to camera" }).click();
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled({ timeout: 7000 });
  await expect(k.locator(".shot-gallery img")).toHaveCount(2);
  expect(await page.evaluate(() => (window as any).mediaCalls)).toBe(2);
});

test("automatic permission denial stops without retries and keeps camera retry available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
    (window as any).mediaCalls = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        (window as any).mediaCalls++;
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
  });
  await setup(page);
  const k = await enter(page);
  await expect(k.getByRole("alert")).toContainText(
    "Camera permission was denied",
  );
  await expect(
    k.getByRole("button", { name: "Stop automatic capture" }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).mediaCalls)).toBe(1);
  await expect(k.locator("input[type=file]")).toBeEnabled();
  await expect(
    k.getByRole("button", { name: "Open camera", exact: true }),
  ).toBeEnabled();
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => (window as any).mediaCalls)).toBe(1);
});

test("stopping a running countdown keeps completed shots and a new entry fills the remaining slots", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared countdown cancellation");
  await synthetic(page);
  await setup(page);
  const k = await enter(page, 4);
  await expect(k.locator(".capture-progress")).toContainText("1 of 4", {
    timeout: 5000,
  });
  await k.getByRole("button", { name: "Stop automatic capture" }).click();
  await expect(k.locator("video")).toHaveCount(0);
  const first = await k
    .locator(".shot-gallery img")
    .first()
    .getAttribute("src");
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeDisabled();
  await k.getByRole("button", { name: "Back", exact: true }).click();
  await k.getByRole("button", { name: "Continue to camera" }).click();
  await expect(k.locator(".capture-progress")).toContainText("2 of 4", {
    timeout: 5000,
  });
  await expect(
    k.getByRole("button", { name: "Stop automatic capture" }),
  ).toBeVisible();
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled({ timeout: 6000 });
  expect(await k.locator(".shot-gallery img").first().getAttribute("src")).toBe(
    first,
  );
  await expect(k.locator(".shot-gallery img")).toHaveCount(4);
});
