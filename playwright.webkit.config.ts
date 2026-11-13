import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Safari-engine checks for sheet readiness and popup handling. No native printer is simulated as successful.
export default defineConfig({
  ...base,
  outputDir: "artifacts/webkit-results",
  reporter: "list",
  use: { ...base.use, browserName: "webkit", channel: undefined },
  projects: [{
    name: "webkit-ipad",
    testMatch: /airprint\.spec\.ts/,
    grep: /settings persist|blocked printable popup/,
    use: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
  }],
});
