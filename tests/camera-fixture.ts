import { expect, type Page } from "@playwright/test";

// A real synthetic MediaStream; only countdown waits are accelerated in these
// non-timing tests. Dedicated timer/cancel tests keep their original clocks.
// Partial sets retain normal spacing so Stop can land between captured shots.
export async function takePhotos(
  page: Page,
  expectedTotal = 1,
  partial = false,
) {
  await page.evaluate(
    ({ partial }) => {
      const state = window as any;
      state.fixtureGeneration = (state.fixtureGeneration || 0) + 1;
      const descriptor = Object.getOwnPropertyDescriptor(
        navigator.mediaDevices,
        "getUserMedia",
      );
      if (!descriptor || descriptor.configurable)
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          configurable: true,
          value: async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const context = canvas.getContext("2d")!;
            const gradient = context.createLinearGradient(0, 0, 640, 480);
            gradient.addColorStop(
              0,
              state.fixtureGeneration % 2 ? "#ff4455" : "#2255ee",
            );
            gradient.addColorStop(1, "#22dd66");
            context.fillStyle = gradient;
            context.fillRect(0, 0, 640, 480);
            return canvas.captureStream(10);
          },
        });
      state.fixtureTimeout = window.setTimeout;
      window.setTimeout = ((
        callback: TimerHandler,
        delay?: number,
        ...args: any[]
      ) =>
        state.fixtureTimeout(
          callback,
          delay === 1000 ? (partial ? 1000 : 20) : delay,
          ...args,
        )) as typeof window.setTimeout;
    },
    { partial },
  );
  const kiosk = page.getByRole("dialog");
  try {
    const captured = await kiosk.locator(".shot-gallery img").count();
    if (captured < expectedTotal)
      await kiosk
        .getByRole("button", {
          name: `Select photo ${captured + 1}`,
          exact: true,
        })
        .click();
    await kiosk.locator(".kiosk-camera-button").click();
    await expect(kiosk.locator(".kiosk-camera-button")).toBeEnabled();
    await kiosk.locator(".kiosk-camera-button").click();
    await expect(kiosk.locator(".shot-gallery img")).toHaveCount(
      expectedTotal,
      { timeout: 20000 },
    );
    if (partial)
      await kiosk
        .getByRole("button", { name: "Close camera", exact: true })
        .click();
    await expect(kiosk.locator("video")).toHaveCount(0);
  } finally {
    await page.evaluate(() => {
      window.setTimeout = (window as any).fixtureTimeout;
    });
  }
}
