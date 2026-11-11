import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, zipSync, strToU8 } from "fflate";
import AxeBuilder from "@axe-core/playwright";

async function createReceipt(page: Page, count = 1) {
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
  await kiosk
    .locator('input[name="kiosk-photo"]')
    .setInputFiles(
      count === 2
        ? ["public/icons/icon-192.png", "public/icons/icon-512.png"]
        : "public/icons/icon-512.png",
    );
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await kiosk.getByRole("button", { name: "Super Snap", exact: true }).click();
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  await kiosk
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Saved receipt preview" }),
  ).toBeVisible();
}
async function setup(page: Page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
}

test("Files fallback creates a real date-folder ZIP, shares on a user click and restores saved sessions", async ({
  page,
  context,
}, info) => {
  await setup(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: undefined,
    });
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
          count: data.files!.length,
          bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
        };
      },
    });
  });
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await createReceipt(page, 2);
  await expect(
    page.getByRole("button", { name: "Choose local folder", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Rename folder", exact: true })
    .click();
  await page.getByLabel("Folder name", { exact: true }).fill("Winter event");
  await page
    .getByRole("button", { name: "Save folder name", exact: true })
    .click();
  const source = await page
    .getByRole("img", { name: "Saved receipt preview" })
    .getAttribute("src");
  await page
    .getByRole("button", { name: "Prepare folder for Files", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save folder to Files", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).shared?.name))
    .toBe("PhotoTags-Winter event.zip");
  expect(await page.evaluate(() => (window as any).shared.active)).toBe(true);
  expect(await page.evaluate(() => (window as any).shared.count)).toBe(1);
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download folder ZIP", exact: true })
    .click();
  const download = await downloaded,
    path = `artifacts/device-history-${info.project.name}.zip`;
  await download.saveAs(path);
  const zipped = await readFile(path),
    files = unzipSync(zipped);
  const manifestPath = Object.keys(files).find((path) =>
    path.endsWith("/session.json"),
  )!;
  expect(manifestPath).toMatch(
    /^PhotoTags Receipt Booth\/\d{4}-\d{2}-\d{2} Winter event\/[^/]+\/session.json$/,
  );
  const base = manifestPath.slice(0, -"session.json".length);
  expect(Object.keys(files).sort()).toEqual(
    [
      base + "photo-1.jpg",
      base + "photo-2.jpg",
      base + "receipt.png",
      manifestPath,
    ].sort(),
  );
  expect(
    "data:image/png;base64," +
      Buffer.from(files[base + "receipt.png"]).toString("base64"),
  ).toBe(source);
  expect(
    Buffer.from(await page.evaluate(() => (window as any).shared.bytes)),
  ).toEqual(zipped);
  await expect(
    page.getByRole("button", { name: "Save image to Files", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/device-files-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Delete saved session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.locator(".history-card")).toHaveCount(0);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await page.getByLabel("Open saved ZIP", { exact: true }).setInputFiles(path);
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Winter event", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Saved receipt preview" }),
  ).toHaveAttribute("src", source!);
  await expect(
    page.getByRole("button", { name: "View photo 2", exact: true }),
  ).toBeVisible();
  const olderManifest = JSON.parse(Buffer.from(files[manifestPath]).toString("utf8"));
  olderManifest.entry.updatedAt = "2020-01-01T00:00:00.000Z";
  olderManifest.entry.theme = "Outdated receipt";
  const older = zipSync({ ...files, [manifestPath]: strToU8(JSON.stringify(olderManifest)) }, { level: 0 });
  await page.getByLabel("Open saved ZIP", { exact: true }).setInputFiles({ name: "older.zip", mimeType: "application/zip", buffer: Buffer.from(older) });
  await expect(page.getByText("Opened 0 saved sessions.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Outdated receipt", exact: true })).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("native directory writes, folder restore, permissions and reprints use real browser file handles", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Shared desktop folder implementation",
  );
  test.setTimeout(90000);
  await setup(page);
  await page.addInitScript(() => {
    const query = FileSystemDirectoryHandle.prototype.queryPermission;
    FileSystemDirectoryHandle.prototype.queryPermission = function (options) {
      return (window as any).denyFolder
        ? Promise.resolve("prompt")
        : query.call(this, options);
    };
    FileSystemDirectoryHandle.prototype.requestPermission = async function () {
      (window as any).denyFolder = false;
      return "granted";
    };
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: async () => {
        if ((window as any).cancelPicker)
          throw new DOMException("Cancelled", "AbortError");
        return (await navigator.storage.getDirectory()).getDirectoryHandle(
          "Device Photos",
          { create: true },
        );
      },
    });
    const writable = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = function (...args) {
      if ((window as any).diskFull)
        return Promise.reject(
          new DOMException("Device storage is full", "QuotaExceededError"),
        );
      return writable.apply(this, args);
    };
  });
  let prints = 0;
  await page.routeWebSocket(/wss:\/\/localhost:\d+\/?/, (ws) =>
    ws.onMessage((message) => {
      if (message === "ping") return;
      const request = JSON.parse(message.toString());
      if (request.call === "print") prints++;
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
  await page.goto("/");
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose local folder", exact: true })
    .click();
  await expect(
    page.getByText("Automatic saving on", { exact: true }),
  ).toBeVisible();
  await createReceipt(page);
  const manifests = () =>
    page.evaluate(async () => {
      const root = await (
        await navigator.storage.getDirectory()
      ).getDirectoryHandle("Device Photos");
      const result: any[] = [];
      try {
        const app = await root.getDirectoryHandle("PhotoTags Receipt Booth");
        for await (const date of app.values())
          if (date.kind === "directory") {
            for await (const session of date.values())
              if (session.kind === "directory") {
                try {
                  result.push(
                    JSON.parse(
                      await (
                        await (
                          await session.getFileHandle("session.json")
                        ).getFile()
                      ).text(),
                    ),
                  );
                } catch {
                  /* A write may be committing. */
                }
              }
          }
      } catch {
        /* Folder not created yet. */
      }
      return result;
    });
  await expect
    .poll(async () => (await manifests()).filter((m) => m.receipt).length)
    .toBe(1);
  await page
    .getByRole("button", { name: "Rename folder", exact: true })
    .click();
  await page.getByLabel("Folder name", { exact: true }).fill("Gala night");
  await page
    .getByRole("button", { name: "Save folder name", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await manifests()).filter((m) => m.folderName === "Gala night").length,
    )
    .toBe(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await expect(
    page.getByText("Automatic saving on", { exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("phototags-photo-history", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["entries", "assets", "folders"], "readwrite");
      for (const name of ["entries", "assets", "folders"])
        tx.objectStore(name).clear();
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await expect(page.locator(".history-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Change local folder", exact: true })
    .click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect(
    page.getByRole("img", { name: "Saved receipt preview" }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as any).cancelPicker = true;
  });
  await page
    .getByRole("button", { name: "Change local folder", exact: true })
    .click();
  await expect(
    page.getByText("Automatic saving on", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as any).cancelPicker = false;
    (window as any).denyFolder = true;
  });
  await createReceipt(page, 2);
  await expect(page.getByRole("alert")).toContainText(
    "The browser copy is kept",
  );
  await page
    .getByRole("button", { name: "Reconnect folder", exact: true })
    .click();
  await expect(
    page.getByText("Automatic saving on", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        new Set(
          (await manifests()).filter((m) => m.receipt).map((m) => m.entry.id),
        ).size,
    )
    .toBe(2);
  await page.evaluate(() => {
    (window as any).diskFull = true;
  });
  await page
    .getByRole("button", {
      name: "Save cached sessions to folder",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText("Device storage is full");
  await expect(page.locator(".history-card")).toHaveCount(2);
  await page.evaluate(() => {
    (window as any).diskFull = false;
  });
  await page
    .getByRole("button", { name: "Reconnect folder", exact: true })
    .click();
  await expect(
    page.getByText("Automatic saving on", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connect & find printer queues" })
    .click();
  await page.getByLabel("Raw printer queue").selectOption("PhotoTags RAW");
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reprint receipt", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "I checked the printer", exact: true }),
  ).toBeEnabled();
  expect(prints).toBe(1);
  await page.screenshot({
    path: "artifacts/device-folder-native.png",
    fullPage: true,
  });
});

test("invalid archives leave existing history intact and unavailable sharing keeps ZIP downloads", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Shared archive validation and fallback",
  );
  await setup(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    });
  });
  await page.goto("/");
  await createReceipt(page);
  await page.getByLabel("Open saved ZIP", { exact: true }).setInputFiles({
    name: "invalid.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".history-card")).toHaveCount(1);
  const unsafe = zipSync({ "../escape/session.json": strToU8("{}") });
  await page.getByLabel("Open saved ZIP", { exact: true }).setInputFiles({
    name: "unsafe.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(unsafe),
  });
  await expect(page.getByRole("alert")).toContainText("invalid path");
  await expect(page.locator(".history-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Prepare folder for Files", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Download folder ZIP", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save folder to Files", exact: true }),
  ).toHaveCount(0);
});

test("the device-folder upgrade preserves existing version-one history", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared IndexedDB upgrade");
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 20;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#4488cc";
    ctx.fillRect(0, 0, 20, 20);
    const photo = canvas.toDataURL("image/png");
    (window as any).legacyPhoto = photo;
    const request = indexedDB.open("phototags-photo-history", 1);
    request.onupgradeneeded = () => {
      for (const store of ["entries", "assets", "folders"])
        request.result.createObjectStore(store, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      const tx = db.transaction(["entries", "assets", "folders"], "readwrite");
      tx.objectStore("entries").put({
        id: "legacy-session",
        date: "2026-01-01",
        createdAt: "2026-01-01T12:00:00.000Z",
        updatedAt: "2026-01-01T12:00:00.000Z",
        theme: "Legacy receipt",
        shots: 1,
        thumbnail: photo,
        hasReceipt: true,
      });
      tx.objectStore("assets").put({
        id: "legacy-session",
        photos: [photo],
        receipt: photo,
      });
      tx.objectStore("folders").put({ id: "2026-01-01", name: "Legacy event" });
      tx.oncomplete = () => db.close();
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Legacy event", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Saved receipt preview" }),
  ).toHaveAttribute(
    "src",
    await page.evaluate(() => (window as any).legacyPhoto),
  );
  await expect(
    page.getByRole("button", { name: "View photo 1", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open("phototags-photo-history");
            request.onsuccess = () => {
              const version = request.result.version;
              request.result.close();
              resolve(version);
            };
            request.onerror = () => reject(request.error);
          }),
      ),
    )
    .toBe(2);
});
