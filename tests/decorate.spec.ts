import { takePhotos } from "./camera-fixture";
import { test, expect } from "@playwright/test";
import ts from "typescript";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("four shots, original offline stickers, signature and decorated export", async ({
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
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const k = page.getByRole("dialog");
  await k.getByRole("button", { name: "Start", exact: true }).click();
  for (const count of [1, 2, 3, 4]) {
    await k
      .getByRole("button", {
        name: `${count} ${count === 1 ? "shot" : "shots"}`,
        exact: true,
      })
      .click();
    await expect(
      k.getByRole("button", {
        name: `${count} ${count === 1 ? "shot" : "shots"}`,
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await page.screenshot({ path: `artifacts/shots-${info.project.name}.png` });
  await k.getByRole("button", { name: "Continue to camera" }).click();
  await takePhotos(page, 2, true);
  await expect(k.locator(".shot-gallery img")).toHaveCount(2);
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeDisabled();
  await takePhotos(page, 4);
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  // Reselecting the current layout keeps the captured set.
  await k.getByRole("button", { name: "Back", exact: true }).click();
  await k.getByRole("button", { name: "3 shots", exact: true }).click();
  await expect(
    k.getByRole("heading", { name: "Change your shot count?" }),
  ).toBeVisible();
  await k.getByRole("button", { name: "Keep booth open" }).click();
  await k.getByRole("button", { name: "4 shots", exact: true }).click();
  await k.getByRole("button", { name: "Continue to camera" }).click();
  await expect(k.locator(".shot-gallery img")).toHaveCount(4);
  await k.getByRole("button", { name: "Continue to themes" }).click();
  await k.getByRole("button", { name: "Super Snap", exact: true }).click();
  await expect(k.getByRole("button", { name: "Review receipt" })).toBeEnabled();
  const preview = k.getByRole("img", { name: "Your themed receipt preview" });
  const before = await preview.getAttribute("src");
  await k
    .getByRole("button", { name: "Add Rainbow Party Hat sticker", exact: true })
    .click();
  const sticker = k.getByRole("button", {
    name: "Move Rainbow Party Hat sticker",
    exact: true,
  });
  await expect(sticker).toBeVisible();
  const left = await sticker
    .locator("..")
    .evaluate((e) => (e as HTMLElement).style.left);
  await sticker.focus();
  await page.keyboard.press("ArrowRight");
  expect(
    await sticker.locator("..").evaluate((e) => (e as HTMLElement).style.left),
  ).not.toBe(left);
  await page.keyboard.press("+");
  await page.keyboard.press("]");
  await k.locator(".kiosk-body").evaluate((e) => (e.scrollTop = 0));
  await page.screenshot({
    path: `artifacts/decorate-top-${info.project.name}.png`,
  });
  await k.getByLabel("Sticker category").selectOption("Eyes & glasses");
  await expect
    .poll(() =>
      k
        .locator(".sticker-strip img")
        .first()
        .evaluate((e: HTMLImageElement) => e.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(k.getByRole("button", { name: "Review receipt" })).toBeEnabled();
  const beforeSignature = await preview.getAttribute("src");
  await k.getByRole("button", { name: "Signature", exact: true }).click();
  const canvas = k.locator(".receipt-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(
    rect.x + rect.width * 0.25,
    rect.y + rect.height * 0.65,
  );
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.7, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(k.getByRole("button", { name: "Undo stroke" })).toBeEnabled();
  await expect(k.getByRole("button", { name: "Review receipt" })).toBeEnabled();
  expect(await preview.getAttribute("src")).not.toBe(beforeSignature);
  expect(await preview.getAttribute("src")).not.toBe(before);
  await page.screenshot({
    path: `artifacts/decorate-screen-${info.project.name}.png`,
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
  await k.getByRole("button", { name: "Cute icons", exact: true }).click();
  await k.getByRole("button", { name: "Wanted", exact: true }).click();
  await expect(sticker).toBeAttached();
  await expect(k.getByRole("button", { name: "Review receipt" })).toBeEnabled();
  await k.getByRole("button", { name: "Review receipt" }).click();
  const finalPreview = k.getByRole("img", { name: "Your final receipt", exact: true });
  await expect(finalPreview).toBeVisible();
  const exportPreview = await finalPreview.getAttribute("src");
  const downloaded = page.waitForEvent("download");
  await k.getByRole("button", { name: "Save receipt PNG" }).click();
  const download = await downloaded;
  await download.saveAs(`artifacts/decorated-${info.project.name}.png`);
  const saved = await readFile(`artifacts/decorated-${info.project.name}.png`);
  // Receipt exports honor the selected thermal/native output; the editor is high resolution.
  expect("data:image/png;base64," + saved.toString("base64") === exportPreview).toBe(true);
});

test("one to four distinct photos fit every template at both printer widths", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared renderer");
  await page.goto("/");
  const source = ts.transpile(await readFile("src/receipt.ts", "utf8"), {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  const result = await page.evaluate(async (source) => {
    const m = await import(
      URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
    );
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ff00ff"];
    const photos = colors.map((color) => {
      const c = document.createElement("canvas");
      c.width = c.height = 80;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 80, 80);
      return c.toDataURL();
    });
    const checks = [];
    for (const template of m.templates)
      for (const profile of ["deli", "g80"])
        for (const shotCount of [1, 2, 3, 4]) {
          const c = await m.compose(
            template,
            null,
            profile,
            1,
            false,
            "portrait",
            {
              shotCount,
              photos: photos.slice(0, shotCount),
              placements: photos.map(() => m.defaultPlacement()),
              stickers: [],
              strokes: [],
            },
          );
          const slots = m.photoSlots(template, c.width, c.height, shotCount);
          checks.push(
            slots.map((s: any) =>
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
    return checks;
  }, source);
  expect(result).toHaveLength(40);
  for (const pixels of result)
    expect(pixels).toEqual(
      [
        [255, 0, 0, 255],
        [0, 255, 0, 255],
        [0, 0, 255, 255],
        [255, 0, 255, 255],
      ].slice(0, pixels.length),
    );
});

test("four-shot camera sequence counts down separately and stops its stream", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared capture sequence");
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
    let generation = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const session = ++generation;
        const c = document.createElement("canvas");
        c.width = 640;
        c.height = 480;
        let n = 0;
        const timer = setInterval(() => {
          const x = c.getContext("2d")!;
          x.fillStyle = `hsl(${(n++ * 17) % 360} 80% 50%)`;
          x.fillRect(0, 0, 640, 480);
          x.fillStyle = "#000";
          x.font = "120px sans-serif";
          x.fillText(String(session), 50, 160);
        }, 100);
        const stream = c.captureStream(10);
        (window as any).testStream = stream;
        stream
          .getTracks()[0]
          .addEventListener("ended", () => clearInterval(timer));
        return stream;
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const k = page.getByRole("dialog");
  await k.getByRole("button", { name: "Start", exact: true }).click();
  await k.getByRole("button", { name: "4 shots", exact: true }).click();
  await k.getByRole("button", { name: "Continue to camera" }).click();
  await k.getByRole("button", { name: "Open camera", exact: true }).click();
  await k.getByRole("button", { name: "Take 4 photos", exact: true }).click();
  await expect(k.locator(".shot-gallery img")).toHaveCount(1, {
    timeout: 6000,
  });
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeDisabled();
  await k.getByRole("button", { name: "Exit kiosk" }).click();
  await k.getByRole("button", { name: "Keep booth open" }).click();
  await expect(k.locator(".shot-gallery img")).toHaveCount(1);
  await k.getByRole("button", { name: "Select photo 2" }).click();
  await k.getByRole("button", { name: "Open camera", exact: true }).click();
  await k.getByRole("button", { name: "Take 3 photos", exact: true }).click();
  await expect(
    k.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled({ timeout: 16000 });
  const images = await k
    .locator(".shot-gallery img")
    .evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
  expect(new Set(images).size).toBe(4);
  expect(
    await page.evaluate(() =>
      (window as any).testStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
});
