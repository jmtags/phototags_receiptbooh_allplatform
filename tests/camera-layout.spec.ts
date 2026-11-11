import { takePhotos } from "./camera-fixture";
import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function visibleControl(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  const box = (await control.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(
    await control.evaluate((element) => {
      if (
        element.matches(":disabled") ||
        element.classList.contains("disabled")
      )
        return true;
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return hit === element || element.contains(hit);
    }),
  ).toBe(true);
}

test("large camera and enlarged view retain visible controls, capture cancellation and protected exits", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "white";
        context.fillRect(0, 0, 640, 480);
        const stream = canvas.captureStream(10);
        (window as any).layoutCameraStream = stream;
        return stream;
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Security", exact: true }).click();
  await page.getByLabel("New six-digit PIN", { exact: true }).fill("123456");
  await page.getByLabel("Confirm new PIN", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Set exit PIN" }).click();
  await expect(
    page.getByText("PIN protection is on.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await page.getByLabel("Capture countdown").selectOption("15");
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog");
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "4 shots", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await expect(kiosk.locator(".capture-progress")).toHaveCount(0);
  const captureSize = (await kiosk.locator(".kiosk-camera-button").boundingBox())!;
  expect(captureSize.width).toBeLessThanOrEqual(56);
  expect(captureSize.height).toBeLessThanOrEqual(56);
  await kiosk.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(
    kiosk.getByRole("button", { name: "Take 4 photos", exact: true }),
  ).toBeEnabled();
  const normal = (await kiosk.locator(".kiosk-camera").boundingBox())!;
  expect(normal.height).toBeGreaterThan(page.viewportSize()!.height * 0.4);
  for (const expanded of [false, true]) {
    if (expanded)
      await kiosk
        .getByRole("button", { name: "Enlarge camera view", exact: true })
        .click();
    for (const name of [
      "Exit kiosk",
      expanded ? "Restore camera view" : "Enlarge camera view",
      "Take 4 photos",
      "Close camera",
      "Back",
      "Continue to themes",
    ]) {
      await visibleControl(
        page,
        kiosk.getByRole("button", { name, exact: true }),
      );
    }
    await expect(kiosk.locator("input[type=file]")).toHaveCount(0);
    for (let i = 1; i <= 4; i++)
      await visibleControl(
        page,
        kiosk.getByRole("button", { name: `Select photo ${i}`, exact: true }),
      );
    expect(
      (
        await new AxeBuilder({ page })
          .include(".kiosk-dialog")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/camera-${expanded ? "expanded" : "large"}-${info.project.name}.png`,
    });
  }
  const enlarged = (await kiosk.locator(".kiosk-camera").boundingBox())!;
  expect(enlarged.width).toBe(page.viewportSize()!.width);
  expect(enlarged.height).toBe(page.viewportSize()!.height);
  await kiosk
    .getByRole("button", { name: "Take 4 photos", exact: true })
    .click();
  await expect(kiosk.locator(".countdown")).toHaveText("15");
  await visibleControl(
    page,
    kiosk.getByRole("button", { name: "Restore camera view" }),
  );
  await visibleControl(
    page,
    kiosk.getByRole("button", { name: "Close camera" }),
  );
  await kiosk.getByRole("button", { name: "Restore camera view" }).click();
  await kiosk.getByRole("button", { name: "Close camera" }).click();
  await expect(kiosk.locator("video")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (window as any).layoutCameraStream
        .getTracks()
        .every((track: MediaStreamTrack) => track.readyState === "ended"),
    ),
  ).toBe(true);
  await takePhotos(page, 4);
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Enlarge camera view" }).click();
  await visibleControl(
    page,
    kiosk.getByRole("button", { name: "Retake photo", exact: true }),
  );
  await visibleControl(page, kiosk.locator(".kiosk-photo-adjust"));
  const zoom = kiosk.getByRole("slider", { name: "Photo zoom" });
  await visibleControl(page, zoom);
  await expect(zoom).toHaveAttribute("aria-orientation", "vertical");
  const zoomBox = (await zoom.boundingBox())!;
  expect(zoomBox.x + zoomBox.width).toBeLessThan(page.viewportSize()!.width / 2);
  expect(zoomBox.height).toBeGreaterThan(zoomBox.width);
  await zoom.focus();
  await page.keyboard.press("ArrowUp");
  await expect(zoom).toHaveValue("1.05");
  await page.screenshot({ path: `artifacts/camera-vertical-zoom-${info.project.name}.png` });
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await expect(
    kiosk.getByRole("heading", { name: "Enter host PIN" }),
  ).toBeVisible();
  // The PIN popup keeps the originating camera layout mounted behind it.
  await expect(kiosk).toHaveClass(/is-camera-expanded/);
  await kiosk.getByRole("button", { name: "Keep booth open" }).click();
  await expect(kiosk).toHaveClass(/is-camera-expanded/);
  await expect(kiosk.locator(".shot-gallery img")).toHaveCount(4);
});

test("automatic capture controls stay reachable on narrow and short screens", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Explicit narrow and landscape viewports",
  );
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        canvas.getContext("2d")!.fillRect(0, 0, 640, 480);
        return canvas.captureStream(10);
      },
    });
  });
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Camera", exact: true }).click();
    await page.getByLabel("Capture countdown").selectOption("15");
    await page
      .getByRole("switch", { name: "Automatic capture in Step 2" })
      .check();
    await page
      .getByRole("button", { name: "Launch kiosk", exact: true })
      .click();
    const kiosk = page.getByRole("dialog");
    await kiosk.getByRole("button", { name: "Start", exact: true }).click();
    await kiosk.getByRole("button", { name: "4 shots", exact: true }).click();
    await kiosk.getByRole("button", { name: "Continue to camera" }).click();
    await expect(kiosk.locator(".countdown")).toHaveText("15");
    for (const expanded of [false, true]) {
      if (expanded)
        await kiosk
          .getByRole("button", { name: "Enlarge camera view" })
          .click();
      for (const name of [
        "Stop automatic capture",
        expanded ? "Restore camera view" : "Enlarge camera view",
        "Exit kiosk",
        "Back",
        "Continue to themes",
      ])
        await visibleControl(
          page,
          kiosk.getByRole("button", { name, exact: true }),
        );
      await visibleControl(page, kiosk.locator(".kiosk-camera-button"));
      await expect(kiosk.locator("input[type=file]")).toHaveCount(0);
      const controls = await kiosk.locator("button").evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              name:
                element.getAttribute("aria-label") ||
                element.textContent?.trim(),
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
          }),
      );
      for (let i = 0; i < controls.length; i++)
        for (let j = i + 1; j < controls.length; j++) {
          const a = controls[i],
            b = controls[j];
          const intersects =
            Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) + 1 &&
            Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) + 1;
          expect(intersects, `${a.name} overlaps ${b.name}`).toBe(false);
        }
      await page.screenshot({
        path: `artifacts/camera-${viewport.width}x${viewport.height}-${expanded ? "expanded" : "normal"}.png`,
      });
    }
    await kiosk.getByRole("button", { name: "Stop automatic capture" }).click();
    await expect(kiosk.locator("video")).toHaveCount(0);
    await page.evaluate(() =>
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      }),
    );
    await kiosk
      .getByRole("button", { name: "Open camera", exact: true })
      .click();
    await expect(kiosk.getByRole("alert")).toContainText(
      "Camera permission was denied",
    );
    for (const name of [
      "Open camera",
      "Restore camera view",
      "Exit kiosk",
      "Dismiss error",
      "Back",
      "Continue to themes",
    ])
      await visibleControl(
        page,
        kiosk.getByRole("button", { name, exact: true }),
      );
    await expect(kiosk.locator("input[type=file]")).toHaveCount(0);
  }
});
