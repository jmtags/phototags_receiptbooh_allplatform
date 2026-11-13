import { takePhotos } from "./camera-fixture";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("printer lightness is saved separately for each profile", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Photo lightness", exact: true }),
  ).toHaveValue("1");
  await page
    .getByRole("combobox", { name: "Photo lightness", exact: true })
    .selectOption("2");
  await page.getByLabel("Printer profile").selectOption("g80");
  await expect(
    page.getByRole("combobox", { name: "Photo lightness", exact: true }),
  ).toHaveValue("1.5");
  await page
    .getByRole("combobox", { name: "Photo lightness", exact: true })
    .selectOption("1");
  await page.reload();
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Photo lightness", exact: true }),
  ).toHaveValue("1");
  await page.getByLabel("Printer profile").selectOption("deli");
  await expect(
    page.getByRole("combobox", { name: "Photo lightness", exact: true }),
  ).toHaveValue("2");
});

test("event theme visibility persists offline and limits the guest collection", async ({
  page,
  context,
}, info) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.getByRole("button", { name: "Event theme-ReceiptBooth", exact: true }).click();
  await page.getByLabel("Event name", { exact: true }).fill("Wedding");
  await page.getByLabel("Theme name", { exact: true }).fill("Our day");
  await page.getByRole("button", { name: "Save theme for event" }).click();
  await expect(page.locator(".theme-status")).toContainText(
    "Saved for Wedding",
  );
  const choices = page.locator(".launch-theme-options input");
  await expect(choices).toHaveCount(6);
  for (let i = 0; i < 5; i++) await choices.nth(i).uncheck();
  await expect(choices.nth(5)).toBeChecked();
  await expect(choices.nth(5)).toBeDisabled();
  await page.getByLabel("Active event").selectOption("");
  await expect(choices.nth(0)).toBeChecked();
  await page.getByLabel("Active event").selectOption("Wedding");
  await expect(choices.nth(0)).not.toBeChecked();
  await page.screenshot({
    path: `artifacts/launch-theme-selection-${info.project.name}.png`,
    fullPage: true,
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Event theme-ReceiptBooth", exact: true }).click();
  await expect(page.getByLabel("Active event")).toHaveValue("Wedding");
  await expect(choices.nth(0)).not.toBeChecked();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog");
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await takePhotos(page);
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await expect(
    kiosk.getByRole("button", { name: "Super Snap", exact: true }),
  ).toHaveCount(0);
  await expect(
    kiosk.getByRole("button", { name: "Our day for Wedding", exact: true }),
  ).toBeVisible();
  await kiosk
    .getByRole("button", { name: "Our day for Wedding", exact: true })
    .click();
  await expect(
    kiosk.getByRole("button", { name: "Review receipt" }),
  ).toBeEnabled();
});

test("lightness changes both rasters while retaining natural Deli and existing G80 defaults", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared raster logic");
  const current = ts.transpile(await readFile("src/receipt.ts", "utf8"), {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  await page.goto("/");
  const result = await page.evaluate(
    async ({ current }) => {
      const load = (source: string) =>
        import(
          URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
        );
      const now = await load(current);
      const rgba = new Uint8Array(64 * 64 * 4);
      for (let i = 0; i < 64 * 64; i++)
        rgba.set([i % 256, i % 256, i % 256, 255], i * 4);
      return Promise.all(
        ["deli", "g80"].map(async (profile) => {
          const updated = now.monochrome(rgba, 64, 64, profile);
          const sums = [1, 1.5, 2].map((gamma) =>
            Array.from(
              now.monochrome(rgba, 64, 64, profile, gamma) as Uint8Array,
            ).reduce((a, b) => a + b, 0),
          );
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", updated)),
          )
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
          return { hash, sums };
        }),
      );
    },
    { current },
  );
  // Frozen from the pre-change renderer using this deterministic grayscale ramp.
  expect(result.map((r) => r.hash)).toEqual([
    "d21934c589aec13544155e9301a840ccf89c57586d438500e5e96f780405da6f",
    "a58b68418188b4cba0e3f57e6680efb33b2145d43e8f90da376ba840dbb33f35",
  ]);
  for (const profile of result) {
    expect(profile.sums[0]).toBeGreaterThan(profile.sums[1]);
    expect(profile.sums[1]).toBeGreaterThan(profile.sums[2]);
  }
});
