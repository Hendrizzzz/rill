import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let mainAsset = null;

page.on("response", async (response) => {
  if (!/\/js\/monkeytype\.[^/]+\.js$/.test(new URL(response.url()).pathname)) {
    return;
  }
  const body = await response.body();
  mainAsset = {
    url: response.url(),
    status: response.status(),
    bytes: body.length,
    sha256: createHash("sha256").update(body).digest("hex"),
  };
});

try {
  await page.goto("https://monkeytype.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2_000);
  const html = await page.content();
  const bodyText = await page.locator("body").innerText();
  const version = bodyText.match(/\bv\d+\.\d+\.\d+\b/)?.[0] ?? null;

  console.log(
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        url: page.url(),
        title: await page.title(),
        browserVersion: browser.version(),
        htmlBytes: Buffer.byteLength(html),
        htmlSha256: createHash("sha256").update(html).digest("hex"),
        mainAsset,
        visibleVersion: version,
      },
      null,
      2,
    ),
  );
  if (mainAsset === null || mainAsset.status !== 200) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
