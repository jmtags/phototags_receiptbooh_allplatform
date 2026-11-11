import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("saved branding customizes the offline kiosk and can be restored", async ({
  page,
  context,
}, info) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error("fallback"));
  });
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole("button", { name: "Branding", exact: true }).click();
  const settings = page.getByRole("region", {
    name: "Kiosk branding",
    exact: true,
  });
  await settings.getByLabel("Brand or event name").fill("Juniper Studio");
  await settings
    .getByLabel("Tagline", { exact: true })
    .fill("Make room for a little joy.");
  await settings
    .getByLabel("Welcome headline")
    .fill("Make a memory at Juniper.");
  await settings
    .getByLabel("Welcome message")
    .fill("Step inside, strike a pose and take a little joy home.");
  await settings.getByLabel("Start button text").fill("Let’s begin");
  await settings.getByLabel("Accent color").fill("#f8d96b");
  await settings.getByLabel("Upload logo").setInputFiles({
    name: "invalid.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(settings.getByRole("alert")).toContainText("PNG, JPEG or WebP");
  await settings
    .getByLabel("Upload logo")
    .setInputFiles("public/assets/logo.png");
  await expect(
    settings.getByRole("button", { name: "Remove logo" }),
  ).toBeVisible();
  await settings
    .getByLabel("Upload background")
    .setInputFiles("public/icons/icon-512.png");
  await expect(
    settings.getByRole("button", { name: "Remove background" }),
  ).toBeVisible();
  await expect(settings.getByRole("status")).toContainText("Unsaved changes");
  await settings
    .getByRole("button", { name: "Save branding", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText("Branding saved");
  await page.reload();
  await page.getByRole("button", { name: "Branding", exact: true }).click();
  await expect(settings.getByLabel("Brand or event name")).toHaveValue(
    "Juniper Studio",
  );
  await expect(settings.getByLabel("Accent color")).toHaveValue("#f8d96b");
  await settings.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/branding-settings-${info.project.name}.png`,
    fullPage: true,
  });
  const audit = async () =>
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
  await audit();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  const kiosk = page.getByRole("dialog", { name: "PhotoTags guest kiosk" });
  await expect(kiosk.locator(".kiosk-header")).toHaveCount(0);
  await expect(kiosk.locator(".has-brand-background")).toHaveCount(1);
  expect(
    await page.evaluate(async () => {
      const source = JSON.parse(
        localStorage.getItem("phototags-kiosk-branding-v1")!,
      ).background;
      const img = new Image();
      img.src = source;
      await img.decode();
      return img.naturalWidth;
    }),
  ).toBeGreaterThan(0);
  await expect(
    kiosk.getByRole("heading", { name: "Make a memory at Juniper." }),
  ).toBeVisible();
  await expect(
    kiosk.getByRole("button", { name: "Let’s begin", exact: true }),
  ).toHaveCSS("background-color", "rgb(248, 217, 107)");
  await expect(kiosk.locator(".kiosk-welcome-logo img")).toHaveJSProperty(
    "complete",
    true,
  );
  expect(
    await kiosk
      .locator(".kiosk-welcome-logo img")
      .evaluate((e: HTMLImageElement) => e.naturalWidth),
  ).toBeGreaterThan(0);
  await audit();
  await page.screenshot({
    path: `artifacts/branding-kiosk-${info.project.name}.png`,
  });
  await kiosk.getByRole("button", { name: "Let’s begin", exact: true }).click();
  await expect(kiosk.locator(".has-brand-background")).toHaveCount(0);
  await kiosk.getByRole("button", { name: "1 shot", exact: true }).click();
  await kiosk.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(
    kiosk.getByRole("button", { name: "Let’s begin", exact: true }),
  ).toBeVisible();
  await kiosk.getByRole("button", { name: "Exit kiosk" }).click();
  await page.getByRole("button", { name: "Branding", exact: true }).click();
  await settings.getByRole("button", { name: "Remove background" }).click();
  await settings
    .getByRole("button", { name: "Save branding", exact: true })
    .click();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  await expect(kiosk.locator(".has-brand-background")).toHaveCount(0);
  await expect(kiosk.locator(".kiosk-header")).toHaveCount(0);
  await kiosk.getByRole("button", { name: "Exit kiosk" }).click();
  await settings
    .getByRole("button", { name: "Restore default branding" })
    .click();
  await expect(settings.getByRole("status")).toContainText(
    "Default PhotoTags branding restored",
  );
  await page.reload();
  await page.getByRole("button", { name: "Launch kiosk", exact: true }).click();
  await expect(
    kiosk.getByRole("heading", { name: "Good times start here." }),
  ).toBeVisible();
  await expect(
    kiosk.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  await expect(kiosk.locator(".kiosk-welcome-logo")).toHaveCount(0);
  await expect(kiosk.locator(".has-brand-background")).toHaveCount(0);
});

test("branding storage failure keeps the previous saved brand and reports the error", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared storage failure handling");
  await page.goto("/");
  await page.getByRole("button", { name: "Branding", exact: true }).click();
  const settings = page.getByRole("region", {
    name: "Kiosk branding",
    exact: true,
  });
  await settings.getByLabel("Brand or event name").fill("Saved brand");
  await settings
    .getByRole("button", { name: "Save branding", exact: true })
    .click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "phototags-kiosk-branding-v1")
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await settings.getByLabel("Brand or event name").fill("Unsaved brand");
  await settings
    .getByRole("button", { name: "Save branding", exact: true })
    .click();
  await expect(settings.getByRole("alert")).toContainText(
    "Your previous branding is still active",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("phototags-kiosk-branding-v1")!).name,
    ),
  ).toBe("Saved brand");
});
