import { takePhotos } from "./camera-fixture";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import ts from "typescript";
import { readFile } from "node:fs/promises";

async function fallbackFullscreen(page: Page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("Fullscreen unavailable in this test"));
  });
}
async function launch(page: Page) {
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog", { name: "PhotoTags guest kiosk" });
  await expect(kiosk).toBeVisible();
  return kiosk;
}
async function toThemes(page: Page) {
  const kiosk = await launch(page);
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await takePhotos(page);
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  return kiosk;
}
test("offline full-screen guest journey has gated steps, export, keyboard focus and accessible screens", async ({
  page,
  context,
}, info) => {
  await fallbackFullscreen(page);
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  const kiosk = await launch(page);
  expect(
    await kiosk.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return (
        Math.abs(r.width - innerWidth) < 2 &&
        Math.abs(r.height - innerHeight) < 2
      );
    }),
  ).toBeTruthy();
  await expect(
    kiosk.getByRole("button", { name: "Start", exact: true }),
  ).toBeFocused();
  const audit = async () => {
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      r.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  };
  await audit();
  await page.screenshot({
    path: `artifacts/kiosk-${info.project.name}-welcome.png`,
  });
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    kiosk.getByRole("button", { name: "Continue to camera" }),
  ).toBeDisabled();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await audit();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeDisabled();
  await audit();
  await takePhotos(page);
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await expect(kiosk.getByRole("img",{name:"Your themed receipt preview"})).toHaveJSProperty("naturalWidth",1200);
  await expect(kiosk.getByRole("button",{name:"Super Snap",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(
    kiosk.getByRole("button", { name: "Review receipt" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Wanted", exact: true }).click();
  await expect(
    kiosk.getByRole("button", { name: "Review receipt" }),
  ).toBeEnabled();
  await audit();
  await page.screenshot({
    path: `artifacts/kiosk-${info.project.name}-themes.png`,
  });
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  const printButton = kiosk.locator(".kiosk-final-preview .kiosk-print-button");
  await expect(printButton).toBeVisible();
  const printBox = (await printButton.boundingBox())!;
  const receiptBox = (await kiosk.getByRole("img", { name: "Your final receipt" }).boundingBox())!;
  const panelBox = (await kiosk.locator(".kiosk-final-preview").boundingBox())!;
  const counterBox=(await kiosk.getByRole("timer",{name:"Session reset countdown"}).boundingBox())!;
  const restartBox=(await kiosk.locator(".kiosk-footer").getByRole("button",{name:"Start over",exact:true}).boundingBox())!;
  expect(Math.abs(counterBox.y+counterBox.height/2-restartBox.y-restartBox.height/2)).toBeLessThan(8);
  expect(restartBox.x-counterBox.x-counterBox.width).toBeLessThan(20);
  const downloadBox=(await kiosk.locator(".photo-download-card").boundingBox())!;
  if(info.project.name==="desktop")expect(downloadBox.x).toBeGreaterThanOrEqual(panelBox.x+panelBox.width);
  expect(printBox.y).toBeGreaterThanOrEqual(receiptBox.y + receiptBox.height);
  expect(printBox.x + printBox.width).toBeGreaterThan(panelBox.x + panelBox.width / 2);
  await expect(
    kiosk.getByRole("button", { name: "Print my receipt" }),
  ).toBeDisabled();
  await expect(
    kiosk.getByRole("button", { name: "Host: open printer setup" }),
  ).toBeVisible();
  await audit();
  const downloaded = page.waitForEvent("download");
  await kiosk.getByRole("button", { name: "Save receipt PNG" }).click();
  const file = await downloaded;
  await file.saveAs(`artifacts/kiosk-${info.project.name}-square.png`);
  expect(
    (await sharp(`artifacts/kiosk-${info.project.name}-square.png`).metadata())
      .width,
  ).toBe(384);
  await page.screenshot({
    path: `artifacts/kiosk-${info.project.name}-print.png`,
  });
  await kiosk.getByRole("button", { name: "Host: open printer setup" }).click();
  await expect(kiosk).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Printer connection", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".print-summary")).toContainText("Wanted receipt");
});
test("kiosk camera captures, cancels countdown, stops tracks and returns focus on exit", async ({
  page,
}) => {
  await fallbackFullscreen(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const c = document.createElement("canvas");
        c.width = 640;
        c.height = 480;
        c.getContext("2d")!.fillRect(0, 0, 640, 480);
        const stream = c.captureStream(10);
        (window as any).kioskStream = stream;
        return stream;
      },
    });
  });
  await page.goto("/");
  const kiosk = await launch(page);
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await kiosk.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(
    kiosk.getByRole("button", { name: "Take my photo" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Take my photo" }).click();
  await expect(kiosk.locator(".countdown")).toHaveText("3");
  await page.keyboard.press("Escape");
  await expect(
    kiosk.getByRole("heading", { name: "Return to Settings?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as any).kioskStream
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBeTruthy();
  await kiosk.getByRole("button", { name: "Keep booth open" }).click();
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeDisabled();
  await kiosk.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(
    kiosk.getByRole("button", { name: "Take my photo" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Take my photo" }).click();
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled({ timeout: 10000 });
  await kiosk.getByRole("checkbox", { name: "Mirror photo" }).check();
  await expect(
    kiosk.getByRole("img", { name: "Your captured photo" }),
  ).toHaveCSS("transform", "matrix(-1, 0, 0, 1, 0, 0)");
  await kiosk.locator('input[name="kiosk-zoom"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    kiosk.getByRole("img", { name: "Your captured photo" }),
  ).toHaveCSS("transform", "matrix(-1.05, 0, 0, 1.05, 0, 0)");
  await kiosk.getByRole("button", { name: "Exit kiosk" }).click();
  await kiosk.getByRole("button", { name: "Exit to Settings" }).click();
  await expect(kiosk).not.toBeVisible();
  await expect(
    page.locator(".host-status-card").filter({ hasText: "Current session" }),
  ).toContainText("1 of 1 photos captured");
  await expect(
    page.getByRole("button", { name: "Launch kiosk", exact: true }),
  ).toBeFocused();
});
test("kiosk submits once, requires host review and clears the guest photo for the next session", async ({
  page,
}) => {
  await fallbackFullscreen(page);
  let prints = 0;
  await page.routeWebSocket(/wss:\/\/localhost:\d+\/?/, (ws) =>
    ws.onMessage((message) => {
      if (message === "ping") return;
      const r = JSON.parse(message.toString());
      if (r.call === "print") prints++;
      ws.send(
        JSON.stringify({
          uid: r.uid,
          result:
            r.call === "getVersion"
              ? "2.3.0"
              : r.call === "printers.find"
                ? ["PhotoTags RAW"]
                : null,
        }),
      );
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connect & find printer queues" })
    .click();
  await expect(page.getByLabel("Raw printer queue")).toBeEnabled();
  await page.getByLabel("Raw printer queue").selectOption("PhotoTags RAW");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const kiosk = await toThemes(page);
  await kiosk.getByRole("button", { name: "Super Snap", exact: true }).click();
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  await kiosk.getByRole("button", { name: "Print my receipt" }).click();
  await expect(
    kiosk.getByRole("heading", { name: "Sent to the print helper." }),
  ).toBeVisible();
  await expect(
    kiosk.getByRole("button", { name: "Finish session", exact: true }),
  ).toBeDisabled();
  expect(prints).toBe(1);
  await page.clock.install();await page.clock.fastForward(125000);
  await expect(kiosk.getByRole("heading", { name: "Sent to the print helper." })).toBeVisible();
  await expect(kiosk.getByRole("timer", { name: "Session reset countdown" })).toContainText("paused");
  await page.clock.resume();
  await kiosk.getByRole("button", { name: "Host: review this print" }).click();
  await kiosk.getByRole("button", { name: "I checked the printer" }).click();
  await kiosk
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await expect(
    kiosk.getByRole("button", { name: "Start", exact: true }),
  ).toBeFocused();
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeDisabled();
  await expect(
    kiosk.getByRole("img", { name: "Your captured photo" }),
  ).not.toBeVisible();
  expect(prints).toBe(1);
});
test("square photo layout preserves the artwork and fits a centered square", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared canvas geometry");
  await page.goto("/");
  const source = ts.transpile(await readFile("src/receipt.ts", "utf8"), {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  const result = await page.evaluate(async (source) => {
    const m = await import(
      URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
    );
    const photo = document.createElement("canvas");
    photo.width = 200;
    photo.height = 200;
    const context = photo.getContext("2d")!;
    context.fillStyle = "red";
    context.fillRect(0, 0, 200, 200);
    const t = m.templates[0];
    const portrait = await m.compose(
      t,
      photo.toDataURL(),
      "deli",
      1,
      false,
      "portrait",
    );
    const square = await m.compose(
      t,
      photo.toDataURL(),
      "deli",
      1,
      false,
      "square",
    );
    const top = Math.round(t.area[1] * square.height) + 10,
      center = Math.round(((t.area[1] + t.area[3]) * square.height) / 2);
    return {
      portrait: Array.from(
        portrait.getContext("2d").getImageData(192, top, 1, 1).data,
      ),
      squareTop: Array.from(
        square.getContext("2d").getImageData(192, top, 1, 1).data,
      ),
      squareCenter: Array.from(
        square.getContext("2d").getImageData(192, center, 1, 1).data,
      ),
    };
  }, source);
  expect(result.portrait).toEqual([255, 0, 0, 255]);
  expect(result.squareTop).toEqual([255, 255, 255, 255]);
  expect(result.squareCenter).toEqual([255, 0, 0, 255]);
});
test("native fullscreen paints the kiosk above the studio", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop native fullscreen check");
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const kiosk = await launch(page);
  await expect(
    kiosk.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  const screenshot = await page.screenshot({
    path: "artifacts/kiosk-native-fullscreen.png",
  });
  const pixel = await sharp(screenshot)
    .extract({ left: 100, top: 300, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  expect([...pixel]).toEqual([243, 243, 247]);
  await kiosk.getByRole("button", { name: "Exit kiosk" }).click();
  await expect(kiosk).not.toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBeFalsy();
});


test("Step 4 countdown starts over without printing and saves kiosk settings", async ({page})=>{
  await fallbackFullscreen(page);await page.goto("/");
  await page.getByRole("button",{name:"Kiosk session",exact:true}).click();
  await expect(page.getByLabel("Automatic start-over timer")).toHaveValue("120");
  await expect(page.getByRole("switch",{name:"Automatically generate download QRs"})).toBeChecked();
  await page.getByLabel("Automatic start-over timer").selectOption("30");
  await page.getByRole("switch",{name:"Automatically generate download QRs"}).uncheck();
  await page.reload();await page.getByRole("button",{name:"Kiosk session",exact:true}).click();
  await expect(page.getByLabel("Automatic start-over timer")).toHaveValue("30");
  await expect(page.getByRole("switch",{name:"Automatically generate download QRs"})).not.toBeChecked();
  const kiosk=await toThemes(page);
  await expect(kiosk.getByRole("button",{name:"Super Snap",exact:true})).toHaveAttribute("aria-pressed","true");
  await kiosk.getByRole("button",{name:"Review receipt"}).click();
  const counter=kiosk.getByRole("timer",{name:"Session reset countdown"});await expect(counter).toContainText("0:30");
  await page.clock.install();await page.clock.fastForward(29000);await expect(counter).toContainText("0:01");
  await page.clock.fastForward(1500);await expect(kiosk.getByRole("button",{name:"Start",exact:true})).toBeVisible();
  await expect(kiosk.getByRole("img",{name:"Your final receipt"})).toHaveCount(0);
  await page.clock.resume();await kiosk.getByRole("button",{name:"Start",exact:true}).click();
  await kiosk.getByRole("button",{name:"1 shot",exact:true}).click();await kiosk.getByRole("button",{name:"Continue to camera"}).click();
  await expect(kiosk.locator(".shot-gallery img")).toHaveCount(0);
});


test("host can disable the automatic start-over countdown",async({page})=>{
  await fallbackFullscreen(page);await page.goto("/");await page.getByRole("button",{name:"Kiosk session",exact:true}).click();
  await page.getByLabel("Automatic start-over timer").selectOption("0");
  const kiosk=await toThemes(page);await kiosk.getByRole("button",{name:"Super Snap",exact:true}).click();await kiosk.getByRole("button",{name:"Review receipt"}).click();
  await expect(kiosk.getByRole("timer",{name:"Session reset countdown"})).toHaveCount(0);
  await page.clock.install();await page.clock.fastForward(180000);
  await expect(kiosk.getByRole("img",{name:"Your final receipt"})).toBeVisible();
});
