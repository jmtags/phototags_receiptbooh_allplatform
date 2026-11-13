import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("studio views pass automated accessibility and keyboard checks", async ({
  page,
}, info) => {
  test.setTimeout(120000); // Eleven settings screens each receive a full accessibility scan.
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page
    .getByRole("button", { name: "Printer connection", exact: true })
    .click();
  await page.getByLabel("Printer profile").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Printer profile")).toHaveValue("g80");
  await expect(page.getByLabel("Photo lightness")).toBeVisible();
  for (const view of [
    "Light license",
    "Overview",
    "Branding",
    "Camera",
    "Kiosk session",
    "Event theme-ReceiptBooth",
    "Event Theme-PhotoBooth",
    "Photo history",
    "Security",
    "Printer connection",
    "Offline & installation",
  ]) {
    await page
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("button", { name: view, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/studio-${info.project.name}-${view.split(" ")[0].toLowerCase()}.png`,
      fullPage: true,
    });
  }
});
