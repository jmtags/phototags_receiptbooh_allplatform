import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("exit popup keeps the current step in place and traps focus until cancelled or confirmed", async ({
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
  await kiosk.getByRole("button", { name: "2 shots", exact: true }).click();
  const before = await kiosk.locator(".kiosk-body").boundingBox();
  const exit = kiosk.getByRole("button", { name: "Exit kiosk", exact: true });
  await exit.click();
  const popup = page.getByRole("alertdialog", { name: "Return to Settings?" });
  await expect(popup).toBeVisible();
  expect(await kiosk.locator(".kiosk-body").boundingBox()).toEqual(before);
  expect(await popup.evaluate((el) => el.matches(":modal"))).toBe(true);
  expect(
    await popup.evaluate(
      (el) => getComputedStyle(el, "::backdrop").backdropFilter,
    ),
  ).toContain("blur");
  await expect(
    popup.getByRole("button", { name: "Keep booth open" }),
  ).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await popup.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include(".kiosk-prompt")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `artifacts/kiosk-exit-popup-${info.project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(exit).toBeFocused();
  await expect(
    kiosk.getByRole("button", { name: "2 shots", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await exit.click();
  await popup.getByRole("button", { name: "Close dialog" }).click();
  await expect(exit).toBeFocused();
  await exit.click();
  await popup.getByRole("button", { name: "Exit to Settings" }).click();
  await expect(kiosk).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Launch kiosk", exact: true }),
  ).toBeFocused();
});
