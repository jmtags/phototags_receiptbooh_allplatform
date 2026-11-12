import { takePhotos } from "./camera-fixture";
import { test, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import ts from "typescript";
const photoPath = "public/assets/logo.png";
async function photoStep(page: any) {
  await page.evaluate(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "1 shot", exact: true }).click();
  await page.getByRole("button", { name: "Continue to camera" }).click();
}

test("host settings replace the duplicate studio and configure the station", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Settings", level: 1 }),
  ).toBeVisible();
  for (const name of ["The collection", "Your moment", "Your receipt"])
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      0,
    );
  await expect(page.locator('input[name="kiosk-photo"]')).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  const settingsNav = page.getByRole("navigation", { name: "Settings sections" });
  await expect(settingsNav.getByRole("button", { name: "Receipt output", exact: true })).toHaveCount(0);
  await expect(settingsNav.getByRole("button", { name: "About the system", exact: true })).toHaveCount(0);
  await page
    .getByText("About the system", { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "One station. Four simple steps." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await page.getByLabel("Printer profile").selectOption("g80");
  await expect(page.getByLabel("Photo lightness")).toBeVisible();
  await page.getByLabel("Photo lightness").selectOption("2");
  await page.getByLabel("Thermal preview & PNG export").uncheck();
  await page.reload();
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await expect(page.getByLabel("Printer profile")).toHaveValue("g80");
  await expect(page.getByLabel("Photo lightness")).toHaveValue("2");
  await expect(
    page.getByLabel("Thermal preview & PNG export"),
  ).not.toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `artifacts/host-settings-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Configure printer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Printer connection", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Check offline setup", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your offline kit" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await photoStep(page);
  await takePhotos(page);
  await page.getByRole("button", { name: "Continue to themes" }).click();
  await page.getByRole("button", { name: "Super Snap", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review receipt" }),
  ).toBeEnabled();
  const chromatic = await page
    .getByRole("img", { name: "Your themed receipt preview" })
    .evaluate((img: HTMLImageElement) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
      let colors = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
            Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >
          40
        )
          colors++;
      return colors;
    });
  expect(chromatic).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

test("camera denied and missing camera allow manual retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    });
  });
  await page.goto("/");
  await photoStep(page);
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Camera permission was denied",
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => Promise.reject(new DOMException("Missing", "NotFoundError")),
    });
  });
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "No camera was found",
  );
  await takePhotos(page);
  await expect(
    page.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
});
test("offline reopening audits all files and detects deletion", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole("button", { name: /Offline & installation/ }).click();
  await page
    .getByRole("button", { name: "Prepare / check offline files" })
    .click();
  await expect(page.locator(".offline-box")).toHaveText(
    "Ready for offline use",
  );
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /Offline & installation/ }).click();
  await page
    .getByRole("button", { name: "Prepare / check offline files" })
    .click();
  await expect(page.locator(".offline-box")).toHaveText(
    "Ready for offline use",
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
    window.dispatchEvent(new Event("online"));
  });
  await page.getByRole("button", { name: "Repair offline package" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Offline files were kept",
  );
  await page
    .getByRole("button", { name: "Prepare / check offline files" })
    .click();
  await expect(page.locator(".offline-box")).toHaveText(
    "Ready for offline use",
  );
  await page.evaluate(() => {
    delete (navigator as any).onLine;
    window.dispatchEvent(new Event("offline"));
  });
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await page.getByRole("button", { name: "Load printer test artwork" }).click();
  await expect(
    page.getByRole("button", { name: "Export ESC/POS job" }),
  ).toBeEnabled();
  await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const key of await cache.keys())
        if (key.url.includes("receipt_design_fashion.webp"))
          await cache.delete(key);
    }
  });
  await page.getByRole("button", { name: /Offline & installation/ }).click();
  await page
    .getByRole("button", { name: "Prepare / check offline files" })
    .click();
  await expect(page.locator(".offline-box")).toContainText("missing");
  await context.setOffline(false);
  await page.getByRole("button", { name: "End session & clear photo" }).click();
  await Promise.all([
    page.waitForEvent("framenavigated", (frame) => frame === page.mainFrame()),
    page.getByRole("button", { name: "Repair offline package" }).click(),
  ]);
  await page.waitForLoadState("load");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole("button", { name: /Offline & installation/ }).click();
  await page
    .getByRole("button", { name: "Prepare / check offline files" })
    .click();
  await expect(page.locator(".offline-box")).toHaveText(
    "Ready for offline use",
  );
});
test("unresolved print survives reload and prevents another submission", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("pendingPrint", "uncertain-test-job"),
  );
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: "Check your last print" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Printer connection/ }).click();
  await expect(
    page.getByRole("button", { name: "Send one receipt" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "I checked the printer" }).click();
  expect(await page.evaluate(() => localStorage.getItem("pendingPrint"))).toBe(
    "",
  );
});
test("printer encoder command vectors and generated actual-artwork test receipts", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared encoder, run once");
  await page.goto("/");
  const source = ts.transpile(await readFile("src/receipt.ts", "utf8"), {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  const result = await page.evaluate(async (source) => {
    const mod = await import(
      URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
    );
    const cases: any = {};
    for (const profile of ["deli", "g80"]) {
      const width = mod.profiles[profile].width;
      const test = new Uint8Array(width);
      test[0] = 1;
      test[width - 1] = 1;
      const bytes = mod.encode(test, width, 1, profile);
      cases[profile] = Array.from(bytes);
    }
    const rgba = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0]);
    cases.pure = Array.from(mod.monochrome(rgba, 3, 1, "g80", 2));
    cases.artifacts = [];
    const photo = await mod.printerTestPhoto();
    for (const profile of ["deli", "g80"]) {
      const c = await mod.compose(mod.templates[0], photo, profile);
      const t = mod.thermal(c, profile, 1.5);
      cases.artifacts.push({
        profile,
        width: c.width,
        height: c.height,
        png: t.preview.toDataURL().split(",")[1],
        raw: Array.from(t.bytes),
      });
    }
    return cases;
  }, source);
  expect(result.pure).toEqual([1, 0, 0]);
  expect(result.g80.slice(0, 13)).toEqual([
    27, 64, 27, 97, 1, 29, 118, 48, 0, 72, 0, 1, 0,
  ]);
  expect(result.g80[13]).toBe(128);
  expect(result.g80[84]).toBe(1);
  expect(result.g80.length).toBe(94);
  expect(result.deli.slice(0, 13)).toEqual([
    27, 64, 27, 97, 1, 27, 51, 24, 27, 42, 33, 128, 1,
  ]);
  expect(result.deli[13]).toBe(128);
  expect(result.deli[13 + 383 * 3]).toBe(128);
  expect(result.deli.length).toBe(1175);
  await mkdir("artifacts", { recursive: true });
  for (const a of result.artifacts) {
    await writeFile(
      `artifacts/printer-test-${a.width}.png`,
      Buffer.from(a.png, "base64"),
    );
    await writeFile(
      `artifacts/printer-test-${a.width}.bin`,
      Buffer.from(a.raw),
    );
  }
});
