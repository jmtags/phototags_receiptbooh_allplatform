import { test, expect } from "@playwright/test";
import ts from "typescript";
import { readFile } from "node:fs/promises";

test("native two-finger gestures resize and rotate photos and stickers without a bottom control panel", async ({
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
  await kiosk.getByRole("button", { name: "Super Snap", exact: true }).click();
  await expect(kiosk.locator(".decoration-controls")).toHaveCount(0);
  const preview = kiosk.getByRole("img", {
    name: "Your themed receipt preview",
  });
  const ready = () =>
    expect(kiosk.getByRole("button", { name: "Review receipt" })).toBeEnabled();
  await ready();
  const session = await page.context().newCDPSession(page);
  const touch = (
    type: string,
    points: { id: number; x: number; y: number }[],
  ) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map((p) => ({
        ...p,
        radiusX: 2,
        radiusY: 2,
        force: 1,
      })),
    });
  await kiosk
    .getByRole("button", { name: "Add Rainbow Party Hat sticker", exact: true })
    .click();
  const sticker = kiosk.getByRole("button", {
    name: "Move Rainbow Party Hat sticker",
    exact: true,
  });
  const rect = (await sticker.boundingBox())!;
  const cx = rect.x + rect.width / 2,
    cy = rect.y + rect.height / 2;
  const widthBefore = await sticker
    .locator("..")
    .evaluate((el) => (el as HTMLElement).style.width);
  await touch("touchStart", [
    { id: 1, x: cx - 5, y: cy },
    { id: 2, x: cx + 5, y: cy },
  ]);
  await touch("touchMove", [
    { id: 1, x: cx - 12, y: cy - 9 },
    { id: 2, x: cx + 12, y: cy + 9 },
  ]);
  await expect
    .poll(() =>
      sticker.locator("..").evaluate((el) => (el as HTMLElement).style.width),
    )
    .not.toBe(widthBefore);
  await expect
    .poll(() =>
      sticker
        .locator("..")
        .evaluate((el) => (el as HTMLElement).style.transform),
    )
    .not.toContain("rotate(0deg)");
  // Lifting one finger rebases the gesture without moving the remaining finger's target.
  const leftBeforeLift = await sticker
    .locator("..")
    .evaluate((el) => (el as HTMLElement).style.left);
  await touch("touchEnd", [{ id: 2, x: cx + 12, y: cy + 9 }]);
  expect(
    await sticker
      .locator("..")
      .evaluate((el) => (el as HTMLElement).style.left),
  ).toBe(leftBeforeLift);
  await touch("touchMove", [{ id: 1, x: cx - 5, y: cy - 5 }]);
  await touch("touchEnd", []);
  await expect
    .poll(() =>
      sticker.locator("..").evaluate((el) => (el as HTMLElement).style.left),
    )
    .not.toBe(leftBeforeLift);
  await ready();
  await page.screenshot({
    path: `artifacts/receipt-touch-sticker-${info.project.name}.png`,
  });
  await kiosk
    .getByRole("button", { name: "Remove Rainbow Party Hat sticker" })
    .click();
  await expect(sticker).toHaveCount(0);
  await ready();
  const photo = kiosk.getByRole("button", {
    name: "Adjust photo 1",
    exact: true,
  });
  const photoRect = (await photo.boundingBox())!;
  const px = photoRect.x + photoRect.width / 2,
    py = photoRect.y + photoRect.height / 2;
  const original = await preview.getAttribute("src");
  await touch("touchStart", [
    { id: 1, x: px - 12, y: py },
    { id: 2, x: px + 12, y: py },
  ]);
  await touch("touchMove", [
    { id: 1, x: px - 20, y: py - 14 },
    { id: 2, x: px + 20, y: py + 14 },
  ]);
  await touch("touchEnd", []);
  await ready();
  await expect.poll(() => preview.getAttribute("src")).not.toBe(original);
  const rotated = await preview.getAttribute("src");
  await page.screenshot({
    path: `artifacts/receipt-touch-photo-${info.project.name}.png`,
  });
  // Cancellation releases the gesture; keyboard alternatives still edit the same photo.
  await touch("touchStart", [{ id: 3, x: px, y: py }]);
  await touch("touchCancel", []);
  await photo.focus();
  await page.keyboard.press("0");
  await ready();
  await expect.poll(() => preview.getAttribute("src")).toBe(original);
  await page.keyboard.press("+");
  await page.keyboard.press("]");
  await ready();
  await expect.poll(() => preview.getAttribute("src")).not.toBe(original);
  expect(rotated).not.toBe(original);
  const composed = await preview.getAttribute("src");
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  const download = page.waitForEvent("download");
  await kiosk.getByRole("button", { name: "Save receipt PNG" }).click();
  const file = await download;
  const path = `artifacts/receipt-touch-export-${info.project.name}.png`;
  await file.saveAs(path);
  expect(
    "data:image/png;base64," + (await readFile(path)).toString("base64"),
  ).toBe(composed);
});

test("photo rotation renders inside its frame at both printer widths", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared composition renderer");
  await page.goto("/");
  const source = ts.transpile(await readFile("src/receipt.ts", "utf8"), {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  const checks = await page.evaluate(async (source) => {
    const m = await import(
      URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
    );
    const photo = document.createElement("canvas");
    photo.width = photo.height = 100;
    const ctx = photo.getContext("2d")!;
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 50, 100);
    ctx.fillStyle = "blue";
    ctx.fillRect(50, 0, 50, 100);
    const results = [];
    for (const profile of ["deli", "g80"]) {
      for (const rotation of [0, 90, 37]) {
        const canvas = await m.compose(
          m.templates[0],
          null,
          profile,
          1,
          false,
          "portrait",
          {
            shotCount: 1,
            photos: [photo.toDataURL()],
            placements: [{ ...m.defaultPlacement(), rotation }],
            stickers: [],
            strokes: [],
          },
        );
        const slot = m.photoSlots(
          m.templates[0],
          canvas.width,
          canvas.height,
          1,
        )[0];
        const pixels = (x: number, y: number) =>
          Array.from(
            canvas
              .getContext("2d")!
              .getImageData(Math.floor(x), Math.floor(y), 1, 1).data,
          );
        const cx = slot.x + slot.w / 2,
          cy = slot.y + slot.h / 2;
        const colors =
          rotation === 0
            ? [pixels(cx - slot.w * 0.2, cy), pixels(cx + slot.w * 0.2, cy)]
            : rotation === 90
              ? [pixels(cx, cy - slot.h * 0.2), pixels(cx, cy + slot.h * 0.2)]
              : [];
        const corners = [
          [0.02, 0.02],
          [0.98, 0.02],
          [0.02, 0.98],
          [0.98, 0.98],
        ].map(([x, y]) => pixels(slot.x + slot.w * x, slot.y + slot.h * y));
        results.push({ width: canvas.width, rotation, colors, corners });
      }
    }
    return results;
  }, source);
  expect(checks.map((c) => c.width)).toEqual([384, 384, 384, 576, 576, 576]);
  for (const check of checks) {
    if (check.colors.length)
      expect(check.colors).toEqual([
        [255, 0, 0, 255],
        [0, 0, 255, 255],
      ]);
    for (const pixel of check.corners)
      expect(pixel[0] + pixel[2]).toBeGreaterThan(200);
  }
});
