import { test, expect } from "@playwright/test";

test("admin timer persists and controls each shot and retake", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
    let generation = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const c = document.createElement("canvas");
        c.width = 640;
        c.height = 480;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = ++generation === 1 ? "#325acc" : "#dc742b";
        ctx.fillRect(0, 0, 640, 480);
        const stream = c.captureStream(10);
        (window as any).timerStream = stream;
        return stream;
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(page.getByLabel("Capture countdown")).toHaveValue("3");
  await page.getByLabel("Capture countdown").selectOption("15");
  await page.reload();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(page.getByLabel("Capture countdown")).toHaveValue("15");
  await page.getByLabel("Capture countdown").selectOption("1");
  await page.reload();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(page.getByLabel("Capture countdown")).toHaveValue("1");
  await page.screenshot({
    path: `artifacts/camera-settings-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const k = page.getByRole("dialog");
  await k.getByRole("button", { name: "Start", exact: true }).click();
  await k.getByRole("button", { name: "2 shots", exact: true }).click();
  await k.getByRole("button", { name: "Continue to camera" }).click();
  await expect(k.locator(".kiosk-camera-status")).toContainText(
    "1-second countdown",
  );
  await k.getByRole("button", { name: "Open camera", exact: true }).click();
  await k.getByRole("button", { name: "Take 2 photos", exact: true }).click();
  await expect(k.locator(".countdown")).toHaveText("1");
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled({ timeout: 6000 });
  await expect(k.locator(".shot-gallery img")).toHaveCount(2);
  const second = await k
    .locator(".shot-gallery img")
    .nth(1)
    .getAttribute("src");
  await k.getByRole("button", { name: "Select photo 1" }).click();
  await k.getByRole("button", { name: "Retake photo", exact: true }).click();
  await k.getByRole("button", { name: "Take my photo", exact: true }).click();
  await expect(k.locator(".countdown")).toHaveText("1");
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled({ timeout: 4000 });
  expect(await k.locator(".shot-gallery img").nth(1).getAttribute("src")).toBe(
    second,
  );
  expect(
    await page.evaluate(() =>
      (window as any).timerStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
});
