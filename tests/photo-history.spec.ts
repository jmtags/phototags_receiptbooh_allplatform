import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { takePhotos } from "./camera-fixture";

async function setup(page: Page, sharing = true) {
  await page.addInitScript((sharing) => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files![0];
        (window as any).shared = {
          name: file.name,
          active: navigator.userActivation.isActive,
          bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
        };
      },
    });
    if (!sharing)
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      });
  }, sharing);
  await page.goto("/");
}
async function createReceipt(page: Page, count = 2) {
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.locator(".kiosk-dialog");
  await kiosk
    .getByRole("button", { name: /^(Start|Start a new session)$/ })
    .click();
  await kiosk
    .getByRole("button", {
      name: `${count} ${count === 1 ? "shot" : "shots"}`,
      exact: true,
    })
    .click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await takePhotos(page, count);
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  await kiosk
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
}
async function openFolder(page: Page) {
  await page
    .getByRole("button", { name: /^Open folder / })
    .first()
    .click();
  return page.locator(".history-modal");
}
async function openReceipt(page: Page) {
  const modal = await openFolder(page);
  await modal
    .getByRole("button", { name: /^View receipt from / })
    .first()
    .click();
  return modal;
}

test("thumbnail folders open a gallery, images share on a user click, and renamed folders work offline", async ({
  page,
  context,
}, info) => {
  await setup(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await createReceipt(page);
  const folder = page.getByRole("button", { name: /^Open folder / });
  await expect(folder).toHaveCount(1);
  await expect(folder.locator("img")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Reprint receipt", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `artifacts/history-folders-${info.project.name}.png`,
    fullPage: true,
  });
  const modal = await openFolder(page);
  await expect(modal.locator(".history-file")).toHaveCount(3);
  await modal.getByText("Folder options", { exact: true }).click();
  await modal.getByRole("button", { name: "Rename folder" }).click();
  await modal.getByLabel("Folder name", { exact: true }).fill("Family party");
  await modal.getByRole("button", { name: "Save folder name" }).click();
  await expect(
    modal.getByRole("heading", { name: "Family party", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/history-gallery-${info.project.name}.png`,
  });
  const photoButton = modal.getByRole("button", {
    name: /^View photo 2 from /,
  });
  await photoButton.click();
  const photo = modal.getByRole("img", { name: "Saved photo 2", exact: true });
  await expect(photo).toBeVisible();
  const original = (await photo.getAttribute("src"))!;
  await modal.getByRole("button", { name: "Share image", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).shared?.active))
    .toBe(true);
  const shared = await page.evaluate(() => (window as any).shared);
  expect(shared.name).toContain("Family party-");
  expect(Buffer.from(shared.bytes).toString("base64")).toBe(
    original.split(",")[1],
  );
  const downloading = page.waitForEvent("download");
  await modal
    .getByRole("button", { name: "Download photo", exact: true })
    .click();
  const downloaded = await downloading;
  expect(downloaded.suggestedFilename()).toContain("Family party-");
  await downloaded.saveAs(
    `artifacts/history-original-${info.project.name}.jpg`,
  );
  expect(
    (
      await readFile(`artifacts/history-original-${info.project.name}.jpg`)
    ).toString("base64"),
  ).toBe(original.split(",")[1]);
  await expect(
    modal.getByRole("button", { name: "Reprint photo", exact: true }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `artifacts/history-image-${info.project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await expect(photoButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open folder Family party" }),
  ).toBeFocused();
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open folder Family party" }),
  ).toBeVisible();
  await openReceipt(page);
  await expect(
    modal.getByRole("img", { name: "Saved receipt preview" }),
  ).toBeVisible();
  await modal.getByText("More options", { exact: true }).click();
  await modal.getByRole("button", { name: "Delete saved session" }).click();
  await modal.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    modal.getByRole("heading", { name: "This folder is empty." }),
  ).toBeVisible();
  await modal.getByRole("button", { name: "Close photo folder" }).click();
  await expect(
    page.getByRole("heading", { name: "Your moments will be here." }),
  ).toBeVisible();
});

test("receipt and raw-photo reprints use the current profile and require review inside the dialog", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared print pipeline");
  const jobs: any[] = [];
  await page.routeWebSocket(/wss:\/\/localhost:\d+\/?/, (ws) =>
    ws.onMessage((message) => {
      if (message === "ping") return;
      const request = JSON.parse(message.toString());
      if (request.call === "print") jobs.push(request);
      ws.send(
        JSON.stringify({
          uid: request.uid,
          result:
            request.call === "getVersion"
              ? "2.3.0"
              : request.call === "printers.find"
                ? ["PhotoTags RAW"]
                : null,
        }),
      );
    }),
  );
  await setup(page);
  await createReceipt(page, 1);
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Printer profile", exact: true })
    .selectOption("g80");
  await page
    .getByRole("button", { name: "Connect & find printer queues" })
    .click();
  await page.getByLabel("Raw printer queue").selectOption("PhotoTags RAW");
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  const modal = await openReceipt(page);
  const reprint = modal.getByRole("button", {
    name: "Reprint receipt",
    exact: true,
  });
  await expect(reprint).toBeEnabled();
  await reprint.click();
  await expect(
    modal.getByRole("button", { name: "I checked the printer" }),
  ).toBeEnabled();
  await expect(reprint).toBeDisabled();
  expect(jobs).toHaveLength(1);
  expect([
    ...Buffer.from(jobs[0].params.data[0].data, "base64").subarray(0, 11),
  ]).toEqual([27, 64, 27, 97, 1, 29, 118, 48, 0, 72, 0]);
  await modal.getByRole("button", { name: "I checked the printer" }).click();
  await modal.getByRole("button", { name: "Back to folder" }).click();
  await modal.getByRole("button", { name: /^View photo 1 from / }).click();
  await modal
    .getByRole("button", { name: "Reprint photo", exact: true })
    .click();
  await expect(
    modal.getByRole("button", { name: "I checked the printer" }),
  ).toBeEnabled();
  expect(jobs).toHaveLength(2);
  const raw = Buffer.from(jobs[1].params.data[0].data, "base64");
  expect([...raw.subarray(9, 11)]).toEqual([72, 0]);
  expect(raw.length).toBeLessThan(
    Buffer.from(jobs[0].params.data[0].data, "base64").length,
  );
  expect(jobs[1].params.options.copies).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "I checked the printer" }),
  ).toBeVisible();
  expect(jobs).toHaveLength(2);
  await page.getByRole("button",{name:"Photo history",exact:true}).click();
  await openReceipt(page);
  await expect(
    modal.getByRole("button", { name: "Reprint receipt", exact: true }),
  ).toBeDisabled();
  await modal.getByRole("button", { name: "I checked the printer" }).click();
  expect(jobs).toHaveLength(2);
});

test("date folders stay separate, incomplete sessions show raw photos, and unavailable sharing saves locally", async ({
  page,
}, info) => {
  await setup(page, false);
  await page.evaluate(async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("phototags-photo-history", 2);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ec5b53";
    ctx.fillRect(0, 0, 100, 80);
    const image = canvas.toDataURL();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["entries", "assets"], "readwrite");
      for (const [id, date] of [
        ["fixture-a", "2026-11-10"],
        ["fixture-b", "2026-11-11"],
      ]) {
        tx.objectStore("entries").put({
          id,
          date,
          createdAt: date + "T10:00:00",
          updatedAt: date + "T10:00:00",
          theme: "Test theme",
          shots: 1,
          thumbnail: image,
          hasReceipt: false,
        });
        tx.objectStore("assets").put({ id, photos: [image], receipt: null });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await expect(page.locator(".history-folder-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Open folder 2026-11-10" }).click();
  const modal = page.locator(".history-modal");
  await expect(modal.locator(".history-file")).toHaveCount(1);
  await expect(
    modal.getByRole("button", { name: /^View receipt from / }),
  ).toHaveCount(0);
  await modal.getByRole("button", { name: /^View photo 1 from / }).click();
  const downloading = page.waitForEvent("download");
  await modal.getByRole("button", { name: "Save image", exact: true }).click();
  expect((await downloading).suggestedFilename()).toContain(
    "2026-11-10-fixture-",
  );
  await modal.getByRole("button", { name: "Close photo folder" }).click();
  await page.getByRole("button", { name: "Open folder 2026-11-11" }).click();
  await expect(
    modal.getByRole("heading", { name: "2026-11-11", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("history storage failures remain visible while the camera session remains usable", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared storage failure handling");
  await setup(page);
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (
      ...args: Parameters<typeof original>
    ) {
      const tx = original.apply(this, args);
      if (this.name === "phototags-photo-history" && args[1] === "readwrite")
        queueMicrotask(() => tx.abort());
      return tx;
    };
  });
  await createReceipt(page, 1);
  await expect(page.getByRole("alert")).toContainText(
    "Photo history could not be saved or read",
  );
  await expect(page.locator(".history-folder-card")).toHaveCount(0);
});
