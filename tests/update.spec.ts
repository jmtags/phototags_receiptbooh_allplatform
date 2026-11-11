import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
test("real waiting service-worker update requires ending the booth session", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Shared service worker, run once");
  const original = await readFile("dist/sw.js", "utf8");
  try {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page
      .getByRole("button", { name: "Printer connection", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Load printer test artwork" })
      .click();
    await expect(
      page.getByRole("button", { name: "Export ESC/POS job" }),
    ).toBeEnabled();
    await writeFile(
      "dist/sw.js",
      original + "\n// Waiting-worker integration test\n",
    );
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r?.update();
    });
    await page.getByRole("button", { name: /Offline & installation/ }).click();
    await expect(
      page.getByRole("button", { name: "Apply update between sessions" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: "Apply update between sessions" }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "End session & clear photo" })
      .click();
    await expect(
      page.getByRole("button", { name: "Apply update between sessions" }),
    ).toBeEnabled();
    await Promise.all([
      page.waitForEvent(
        "framenavigated",
        (frame) => frame === page.mainFrame(),
      ),
      page
        .getByRole("button", { name: "Apply update between sessions" })
        .click(),
    ]);
    await expect(
      page.getByRole("button", { name: "New session", exact: true }),
    ).toBeDisabled();
  } finally {
    await writeFile("dist/sw.js", original);
  }
});
