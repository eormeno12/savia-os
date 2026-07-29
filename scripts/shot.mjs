// Dev-only screenshot helper: node scripts/shot.mjs <url> <outfile> [width] [height]
import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];
const executablePath =
  process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((p) => existsSync(p));

const [url, out, w = "1280", h = "900"] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node scripts/shot.mjs <url> <outfile> [w] [h]");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath,
  args: ["--no-sandbox", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
