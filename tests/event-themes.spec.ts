import { takePhotos } from "./camera-fixture";
import { test, expect } from "@playwright/test";
import sharp from "sharp";
import ts from "typescript";
import { readFile } from "node:fs/promises";

test("event themes persist offline, edit in place and appear beside built-ins for the active event", async ({
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
  await page.getByLabel("Event name", { exact: true }).fill("Spring Gala");
  await page.getByLabel("Theme name", { exact: true }).fill("Garden frame");
  await page.getByLabel("Receipt headline").fill("SPRING GALA");
  await page.getByLabel("Receipt footer").fill("A night to remember");
  await page.getByLabel("Preview photo count").selectOption("4");
  await page.getByLabel("Photo area left").focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Save theme for event" }).click();
  await expect(page.locator(".theme-status")).toContainText(
    "Saved for Spring Gala",
  );
  await page.getByRole("button", { name: "New theme", exact: true }).click();
  await page.getByLabel("Event name", { exact: true }).fill("Summer Party");
  await page.getByLabel("Theme name", { exact: true }).fill("Night strip");
  await page
    .getByLabel("Upload receipt artwork")
    .setInputFiles("public/assets/receipt_design_wanted.webp");
  await page.getByRole("button", { name: "Save theme for event" }).click();
  await expect(page.locator(".theme-status")).toContainText(
    "Saved for Summer Party",
  );
  await page.getByLabel("Active event").selectOption("Spring Gala");
  await page.reload();
  await page.getByRole("button", { name: "Event theme-ReceiptBooth", exact: true }).click();
  await expect(page.getByLabel("Active event")).toHaveValue("Spring Gala");
  await expect(page.locator(".saved-theme-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Edit Garden frame", exact: true })
    .click();
  await page.getByLabel("Theme name", { exact: true }).fill("Garden cover");
  await page.getByRole("button", { name: "Save theme for event" }).click();
  await expect(
    page.getByRole("button", { name: "Edit Garden cover", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".saved-theme-card")).toHaveCount(2);
  await page.screenshot({
    path: `artifacts/event-theme-editor-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name === "desktop") {
    const source = ts.transpile(await readFile("src/receipt.ts", "utf8"), {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    });
    const checks = await page.evaluate(async (source) => {
      const m = await import(
        URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
      );
      const themes: any[] = await new Promise((resolve, reject) => {
        const request = indexedDB.open("phototags-event-themes", 1);
        request.onsuccess = () => {
          const db = request.result,
            transaction = db.transaction("themes", "readonly"),
            read = transaction.objectStore("themes").getAll();
          transaction.oncomplete = () => {
            resolve(read.result);
            db.close();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
      const colors = ["#ff0000", "#00ff00", "#0000ff", "#ff00ff"],
        photos = colors.map((color) => {
          const c = document.createElement("canvas");
          c.width = c.height = 80;
          const x = c.getContext("2d")!;
          x.fillStyle = color;
          x.fillRect(0, 0, 80, 80);
          return c.toDataURL();
        });
      const result = [];
      for (const theme of themes)
        for (const profile of ["deli", "g80"])
          for (const shotCount of [1, 2, 3, 4]) {
            const c = await m.compose(
              theme,
              null,
              profile,
              1,
              false,
              "portrait",
              {
                photos,
                shotCount,
                placements: photos.map(() => m.defaultPlacement()),
                stickers: [],
                strokes: [],
              },
            );
            result.push(
              m
                .photoSlots(theme, c.width, c.height, shotCount)
                .map((s: any) =>
                  Array.from(
                    c
                      .getContext("2d")
                      .getImageData(
                        Math.floor(s.x + s.w / 2),
                        Math.floor(s.y + s.h / 2),
                        1,
                        1,
                      ).data,
                  ),
                ),
            );
          }
      return result;
    }, source);
    expect(checks).toHaveLength(16);
    for (const pixels of checks)
      expect(pixels).toEqual(
        [
          [255, 0, 0, 255],
          [0, 255, 0, 255],
          [0, 0, 255, 255],
          [255, 0, 255, 255],
        ].slice(0, pixels.length),
      );
  }
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const k = page.getByRole("dialog");
  await k.getByRole("button", { name: "Start", exact: true }).click();
  await k.getByRole("button", { name: "4 shots", exact: true }).click();
  await k.getByRole("button", { name: "Continue to camera" }).click();
  await expect(k.locator("input[type=file]")).toHaveCount(0);
  await takePhotos(page, 4);
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await k.getByRole("button", { name: "Continue to themes" }).click();
  await expect(
    k.getByRole("button", {
      name: "Garden cover for Spring Gala",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    k.getByRole("button", {
      name: "Night strip for Summer Party",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    k.getByRole("button", { name: "Super Snap", exact: true }),
  ).toBeVisible();
  await k
    .getByRole("button", { name: "Garden cover for Spring Gala", exact: true })
    .click();
  await k
    .getByRole("button", { name: "Add Rainbow Party Hat sticker", exact: true })
    .click();
  await k.getByRole("button", { name: "Review receipt" }).click();
  const downloaded = page.waitForEvent("download");
  await k.getByRole("button", { name: "Save receipt PNG" }).click();
  const file = await downloaded;
  const path = `artifacts/event-receipt-${info.project.name}.png`;
  await file.saveAs(path);
  expect((await sharp(path).metadata()).width).toBe(384);
  await k.getByRole("button", { name: "Host: open printer setup" }).click();
  await expect(page.locator(".print-summary")).toContainText(
    "Garden cover receipt",
  );
  const raw = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export ESC/POS job" }).click();
  await (await raw).saveAs(`artifacts/event-receipt-${info.project.name}.bin`);
  await page.getByRole("button", { name: "Event theme-ReceiptBooth", exact: true }).click();
  const summer = page
    .locator(".saved-theme-card")
    .filter({ hasText: "Night strip" });
  await summer.getByRole("button", { name: "Delete", exact: true }).click();
  await summer.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.locator(".saved-theme-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Edit Garden cover", exact: true }),
  ).toBeVisible();
});

test("theme storage failure does not claim a theme was saved", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Shared IndexedDB failure handling",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Event theme-ReceiptBooth", exact: true }).click();
  await page.getByLabel("Event name", { exact: true }).fill("Failure test");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Save theme for event" }).click();
  await expect(page.getByRole("alert")).toContainText("Storage full");
  await expect(page.locator(".saved-theme-card")).toHaveCount(0);
});
