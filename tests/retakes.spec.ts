import { takePhotos } from "./camera-fixture";
import { test, expect, type Page } from "@playwright/test";
async function configure(page: Page, limit: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await page.getByLabel("Retakes per guest session").selectOption(limit);
  await page.getByLabel("Capture countdown").selectOption("1");
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
test("retake allowance counts successful replacements across slots and resets for a new session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
  await configure(page, "1");
  await page.reload();
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await expect(page.getByLabel("Retakes per guest session")).toHaveValue("1");
  const k = await enter(page, 2);
  await takePhotos(page, 1, true);
  await expect(k.locator(".capture-progress")).toContainText("1 of 2");
  await takePhotos(page, 2);
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await expect(k.locator(".retake-progress")).toContainText(
    "1 retake remaining",
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  await k.getByRole("button", { name: "Retake photo", exact: true }).click();
  await expect(k.getByRole("alert")).toContainText(
    "Camera permission was denied",
  );
  await expect(k.locator(".retake-progress")).toContainText(
    "1 retake remaining",
  );
  await takePhotos(page, 2);
  await expect(k.locator(".retake-progress")).toContainText(
    "0 retakes remaining",
  );
  await expect(k.locator("input[type=file]")).toBeDisabled();
  await expect(
    k.getByRole("button", { name: "Retake photo", exact: true }),
  ).toBeDisabled();
  await k.getByRole("button", { name: "Select photo 1" }).click();
  await expect(
    k.getByRole("button", { name: "Retake photo", exact: true }),
  ).toBeDisabled();
  await k.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    k.getByRole("button", { name: "3 shots", exact: true }),
  ).toBeDisabled();
  await k.getByRole("button", { name: "2 shots", exact: true }).click();
  await k.getByRole("button", { name: "Continue to camera" }).click();
  await expect(k.locator(".retake-progress")).toContainText(
    "0 retakes remaining",
  );
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await k.getByRole("button", { name: "Exit kiosk" }).click();
  await k.getByRole("button", { name: "Exit to Settings" }).click();
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await enter(page, 2);
  await expect(k.locator(".retake-progress")).toContainText(
    "1 retake remaining",
  );
  await expect(k.locator(".shot-gallery img")).toHaveCount(0);
});
test("zero retakes permits the complete automatic first set", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const c = document.createElement("canvas");
        c.width = 640;
        c.height = 480;
        c.getContext("2d")!.fillRect(0, 0, 640, 480);
        return c.captureStream(10);
      },
    });
  });
  await configure(page, "0");
  await page
    .getByRole("switch", { name: "Automatic capture in Step 2" })
    .check();
  const k = await enter(page, 4);
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled({ timeout: 10000 });
  await expect(k.locator(".shot-gallery img")).toHaveCount(4);
  await expect(k.locator(".retake-progress")).toContainText(
    "0 retakes remaining",
  );
  await expect(
    k.getByRole("button", { name: "Retake photo", exact: true }),
  ).toBeDisabled();
});
test("cancelled camera retakes cost nothing and a completed camera retake consumes the allowance", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Shared countdown budget enforcement",
  );
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const c = document.createElement("canvas");
        c.width = 640;
        c.height = 480;
        c.getContext("2d")!.fillRect(0, 0, 640, 480);
        return c.captureStream(10);
      },
    });
  });
  await configure(page, "1");
  const k = await enter(page);
  await takePhotos(page);
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await k.getByRole("button", { name: "Retake photo", exact: true }).click();
  await k.getByRole("button", { name: "Take my photo", exact: true }).click();
  await expect(k.locator(".countdown")).toHaveText("1");
  await k.getByRole("button", { name: "Exit kiosk" }).click();
  await k.getByRole("button", { name: "Keep booth open" }).click();
  await expect(k.locator(".retake-progress")).toContainText(
    "1 retake remaining",
  );
  await k.getByRole("button", { name: "Retake photo", exact: true }).click();
  await k.getByRole("button", { name: "Take my photo", exact: true }).click();
  await expect(k.locator(".retake-progress")).toContainText(
    "0 retakes remaining",
    { timeout: 5000 },
  );
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
});
