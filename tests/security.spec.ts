import { takePhotos } from "./camera-fixture";
import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setup(page: Page) {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Security", exact: true }).click();
}
async function newPin(page: Page, pin = "001234") {
  await page.getByLabel("New six-digit PIN", { exact: true }).fill(pin);
  await page.getByLabel("Confirm new PIN", { exact: true }).fill(pin);
  await page.getByRole("button", { name: "Set exit PIN", exact: true }).click();
  await expect(
    page.getByText("PIN protection is on.", { exact: true }),
  ).toBeVisible();
}
async function enter(kiosk: Locator, pin: string) {
  for (const digit of pin)
    await kiosk
      .getByRole("group", { name: "PIN keypad" })
      .getByRole("button", { name: digit, exact: true })
      .click();
  await kiosk
    .getByRole("button", { name: "Unlock Settings", exact: true })
    .click();
}

test("six-digit exit PIN persists offline, keypad blocks incorrect exits and settings require the old PIN", async ({
  page,
  context,
}, info) => {
  await setup(page);
  await page.getByLabel("New six-digit PIN", { exact: true }).fill("12345");
  await page.getByLabel("Confirm new PIN", { exact: true }).fill("12345");
  await page.getByRole("button", { name: "Set exit PIN", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("six-digit PIN");
  await newPin(page);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("phototags-kiosk-security-v1")!),
  );
  expect(saved.hash).toHaveLength(64);
  expect(saved.salt).toHaveLength(32);
  expect(JSON.stringify(saved)).not.toContain("001234");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog");
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await expect(
    kiosk.getByLabel("Six-digit PIN", { exact: true }),
  ).toBeFocused();
  await expect(
    kiosk.getByLabel("Six-digit PIN", { exact: true }),
  ).toHaveAttribute("type", "password");
  await expect(
    kiosk.getByLabel("Six-digit PIN", { exact: true }),
  ).toHaveAttribute("inputmode", "none");
  await enter(kiosk, "000000");
  await expect(kiosk.getByRole("alert")).toContainText("Incorrect PIN");
  await expect(kiosk).toBeVisible();
  for (const digit of "00123")
    await kiosk
      .getByRole("group", { name: "PIN keypad" })
      .getByRole("button", { name: digit, exact: true })
      .click();
  await kiosk.getByRole("button", { name: "Delete last digit" }).click();
  await expect(kiosk.getByLabel("Six-digit PIN", { exact: true })).toHaveValue(
    "0012",
  );
  await kiosk.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(kiosk.getByLabel("Six-digit PIN", { exact: true })).toHaveValue(
    "",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include(".kiosk-dialog")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `artifacts/kiosk-pin-${info.project.name}.png`,
    fullPage: true,
  });
  await kiosk.getByRole("button", { name: "Keep booth open" }).click();
  await expect(
    kiosk.getByRole("button", { name: "Exit kiosk", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    kiosk.getByRole("heading", { name: "Enter host PIN" }),
  ).toBeVisible();
  await kiosk
    .getByLabel("Six-digit PIN", { exact: true })
    .pressSequentially("001234");
  await kiosk.getByLabel("Six-digit PIN", { exact: true }).press("Enter");
  await expect(kiosk).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Launch kiosk", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Security", exact: true }).click();
  await page.getByLabel("Current PIN", { exact: true }).fill("999999");
  await page.getByLabel("New six-digit PIN", { exact: true }).fill("654321");
  await page.getByLabel("Confirm new PIN", { exact: true }).fill("654321");
  await page.getByRole("button", { name: "Change exit PIN" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "current PIN is incorrect",
  );
  await page.getByLabel("Current PIN", { exact: true }).fill("001234");
  await page.getByRole("button", { name: "Change exit PIN" }).click();
  await expect(
    page.getByText("Exit PIN saved.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Security", exact: true }).click();
  await page.getByLabel("Current PIN", { exact: true }).fill("001234");
  await page.getByRole("button", { name: "Remove exit PIN" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "current PIN is incorrect",
  );
  await page.getByLabel("Current PIN", { exact: true }).fill("654321");
  await page.getByRole("button", { name: "Remove exit PIN" }).click();
  await expect(
    page.getByText("PIN protection is off.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await expect(kiosk).not.toBeVisible();
});

test("protected host printer setup retains the photo and repeated PIN failures pause unlocks", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Shared host setup and retry handling",
  );
  await setup(page);
  await newPin(page);
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog");
  await kiosk.getByRole("button", { name: "Start", exact: true }).click();
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Continue to camera" }).click();
  await takePhotos(page);
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await expect(page.locator(".kiosk-footer")).toHaveCount(1);
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    kiosk.getByRole("button", { name: "Continue to themes" }),
  ).toBeEnabled();
  await kiosk.getByRole("button", { name: "Continue to themes" }).click();
  await kiosk.getByRole("button", { name: "Super Snap", exact: true }).click();
  await kiosk.getByRole("button", { name: "Review receipt" }).click();
  await kiosk.getByRole("button", { name: "Host: open printer setup" }).click();
  await page.clock.install();
  for (let i = 0; i < 5; i++) {
    await enter(kiosk, "999999");
    await expect(
      kiosk.getByLabel("Six-digit PIN", { exact: true }),
    ).toHaveValue("");
  }
  await expect(
    kiosk.getByText("Too many attempts.", { exact: false }),
  ).toBeVisible();
  await kiosk.getByRole("button", { name: "Keep booth open" }).click();
  await kiosk.getByRole("button", { name: "Host: open printer setup" }).click();
  await expect(
    kiosk.getByRole("button", { name: "Unlock Settings" }),
  ).toBeDisabled();
  await page.clock.fastForward(31000);
  await enter(kiosk, "001234");
  await expect(kiosk).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Printer connection", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".print-summary")).toContainText(
    "Super Snap receipt",
  );
});

test("security save failure keeps the previous PIN", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Shared security storage failure");
  await setup(page);
  await newPin(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "phototags-kiosk-security-v1")
        throw new DOMException("Storage full", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.getByLabel("Current PIN", { exact: true }).fill("001234");
  await page.getByLabel("New six-digit PIN", { exact: true }).fill("654321");
  await page.getByLabel("Confirm new PIN", { exact: true }).fill("654321");
  await page.getByRole("button", { name: "Change exit PIN" }).click();
  await expect(page.getByRole("alert")).toContainText("previous PIN was kept");
  await page.reload();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog");
  await kiosk.getByRole("button", { name: "Exit kiosk", exact: true }).click();
  await enter(kiosk, "001234");
  await expect(kiosk).not.toBeVisible();
});
