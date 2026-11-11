import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function setup(page: Page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
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
  await kiosk
    .locator('input[name="kiosk-photo"]')
    .setInputFiles(
      count === 2
        ? ["public/icons/icon-192.png", "public/icons/icon-512.png"]
        : "public/icons/icon-512.png",
    );
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await kiosk.getByRole("button", { name: "Super Snap", exact: true }).click();
  return kiosk;
}
async function finish(page: Page) {
  await page.getByRole("button", { name: "Review receipt" }).click();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await page.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
}

test("each sticker has its own X and date folders retain photos and receipts offline", async ({
  page,
  context,
}, info) => {
  await setup(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const kiosk = await createReceipt(page);
  await kiosk
    .getByRole("button", { name: "Add Rainbow Party Hat sticker", exact: true })
    .click();
  await kiosk
    .getByRole("button", { name: "Add Royal Crown sticker", exact: true })
    .click();
  const crown = kiosk.getByRole("button", {
    name: "Move Royal Crown sticker",
    exact: true,
  });
  await crown.focus();
  for (let move = 0; move < 15; move++) await page.keyboard.press("ArrowRight");
  await expect(crown).toHaveAttribute("aria-pressed", "true");
  const removeHat = kiosk.getByRole("button", {
    name: "Remove Rainbow Party Hat sticker",
    exact: true,
  });
  await expect(removeHat).toBeVisible();
  await expect(kiosk.locator(".sticker-remove-x")).toHaveCount(2);
  await page.screenshot({
    path: `artifacts/sticker-x-${info.project.name}.png`,
  });
  await removeHat.click();
  await expect(
    kiosk.getByRole("button", {
      name: "Move Rainbow Party Hat sticker",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(crown).toHaveAttribute("aria-pressed", "true");
  await expect(
    kiosk.getByRole("button", { name: "Review receipt" }),
  ).toBeEnabled();
  await finish(page);
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect(
    page.getByRole("img", { name: "Saved receipt preview" }),
  ).toBeVisible();
  const date = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await expect(
    page.getByRole("heading", { name: date, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rename folder" }).click();
  await page.getByLabel("Folder name", { exact: true }).fill("Family party");
  await page.getByRole("button", { name: "Save folder name" }).click();
  await expect(
    page.getByRole("heading", { name: "Family party", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View photo 2", exact: true }).click();
  const photo = page.getByRole("img", { name: "Saved photo 2", exact: true });
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const original = await photo.getAttribute("src");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download photo", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("Family party-");
  const path = `artifacts/history-original-${info.project.name}.jpg`;
  await download.saveAs(path);
  expect(
    "data:image/jpeg;base64," + (await readFile(path)).toString("base64"),
  ).toBe(original);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Family party", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "View photo 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reprint receipt", exact: true }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `artifacts/history-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Delete saved session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.locator(".history-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your moments will be here." }),
  ).toBeVisible();
});

test("history reprints use the current printer width and retain the one-job review lock", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared history print pipeline");
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
  await finish(page);
  await expect(
    page.getByRole("img", { name: "Saved receipt preview" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Printer profile", exact: true })
    .selectOption("g80");
  await page
    .getByRole("combobox", { name: "Photo lightness", exact: true })
    .selectOption("2");
  await page
    .getByRole("button", { name: "Connect & find printer queues" })
    .click();
  await page.getByLabel("Raw printer queue").selectOption("PhotoTags RAW");
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  const reprint = page.getByRole("button", {
    name: "Reprint receipt",
    exact: true,
  });
  await expect(reprint).toBeEnabled();
  await reprint.click();
  await expect(
    page.getByRole("button", { name: "I checked the printer", exact: true }),
  ).toBeEnabled();
  await expect(reprint).toBeDisabled();
  expect(jobs).toHaveLength(1);
  const bytes = Buffer.from(jobs[0].params.data[0].data, "base64");
  expect([...bytes.subarray(0, 11)]).toEqual([
    27, 64, 27, 97, 1, 29, 118, 48, 0, 72, 0,
  ]);
  expect(jobs[0].params.options.copies).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "I checked the printer", exact: true }),
  ).toBeVisible();
  expect(jobs).toHaveLength(1);
  await page
    .getByRole("button", { name: "I checked the printer", exact: true })
    .click();
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
  await expect(reprint).toBeEnabled();
  expect(jobs).toHaveLength(1);
  await reprint.click();
  await expect(
    page.getByRole("button", { name: "I checked the printer", exact: true }),
  ).toBeEnabled();
  expect(jobs).toHaveLength(2);
});

test("history storage failures are reported while capture remains usable", async ({
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
  await expect(
    page.getByRole("button", { name: "Review receipt" }),
  ).toBeEnabled();
  await finish(page);
  await expect(page.getByRole("alert")).toContainText(
    "Photo history could not be saved or read",
  );
  await expect(page.locator(".history-card")).toHaveCount(0);
});

test("deleted working sessions stay deleted and new guests have separate saved records", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Shared session identity and deletion handling",
  );
  await setup(page);
  const kiosk = await createReceipt(page, 1);
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await page
    .getByRole("button", { name: "Exit to Settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Saved receipt preview" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete saved session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.locator(".history-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Printer profile", exact: true })
    .selectOption("g80");
  await expect(
    page.getByRole("button", { name: "Export ESC/POS job", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Photo history", exact: true })
    .click();
  await expect(page.locator(".history-card")).toHaveCount(0);
  await createReceipt(page, 2);
  await finish(page);
  await expect(page.locator(".history-card")).toHaveCount(1);
  await createReceipt(page, 1);
  await finish(page);
  await expect(page.locator(".history-card")).toHaveCount(2);
  await expect(
    page
      .getByRole("navigation", { name: "Photo date folders" })
      .getByRole("button"),
  ).toHaveCount(1);
  await page.locator(".history-card").last().click();
  await expect(
    page.getByRole("button", { name: "View photo 2", exact: true }),
  ).toBeVisible();
  await page.locator(".history-card").first().click();
  await expect(
    page.getByRole("button", { name: "View photo 2", exact: true }),
  ).toHaveCount(0);
});
