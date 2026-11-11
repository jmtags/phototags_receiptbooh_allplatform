import { test, expect } from "@playwright/test";
test("QZ secure protocol sends raw bytes once, labels submission and blocks duplicates", async ({
  page,
}) => {
  const jobs: any[] = [];
  await page.routeWebSocket(/wss:\/\/localhost:\d+\/?/, (ws) => {
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
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Printer connection/ }).click();
  await page.getByRole("button", { name: "Load printer test artwork" }).click();
  await page
    .getByRole("button", { name: "Connect & find printer queues" })
    .click();
  await expect(page.getByLabel("Raw printer queue")).toBeEnabled();
  await page.getByLabel("Raw printer queue").selectOption("PhotoTags RAW");
  await page.getByRole("button", { name: "Send one receipt" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Check your last print" }),
  ).toContainText("Submitted to the helper. Physical output is unconfirmed");
  expect(jobs).toHaveLength(1);
  const data = jobs[0].params.data[0];
  expect(data.flavor).toBe("base64");
  expect(data.type).toBe("raw");
  expect([...Buffer.from(data.data, "base64").slice(0, 8)]).toEqual([
    27, 64, 27, 97, 1, 27, 51, 24,
  ]);
  expect(jobs[0].params.options.copies).toBe(1);
  await expect(
    page.getByRole("button", { name: "Send one receipt" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: /Printer connection/ }).click();
  await expect(
    page.getByRole("button", { name: "Send one receipt" }),
  ).toBeDisabled();
  expect(jobs).toHaveLength(1);
});
test("QZ rejection leaves uncertain job unresolved without retry", async ({
  page,
}) => {
  let prints = 0;
  await page.routeWebSocket(/wss:\/\/localhost:\d+\/?/, (ws) =>
    ws.onMessage((message) => {
      if (message === "ping") return;
      const request = JSON.parse(message.toString());
      if (request.call === "print") {
        prints++;
        ws.send(
          JSON.stringify({
            uid: request.uid,
            error: "Queue unavailable after send",
          }),
        );
      } else
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
  await page.getByRole("button", { name: /Printer connection/ }).click();
  await page.getByRole("button", { name: "Load printer test artwork" }).click();
  await expect(
    page.getByRole("button", { name: "Export ESC/POS job" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Connect & find printer queues" })
    .click();
  await expect(page.getByLabel("Raw printer queue")).toBeEnabled();
  await page.getByLabel("Raw printer queue").selectOption("PhotoTags RAW");
  await page.getByRole("button", { name: "Send one receipt" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Check your last print" }),
  ).toContainText("Output uncertain");
  await expect(
    page.getByRole("button", { name: "Send one receipt" }),
  ).toBeDisabled();
  expect(prints).toBe(1);
});
