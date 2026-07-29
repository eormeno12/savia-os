// Authenticated screenshots. Usage:
//   ACCESS=... REFRESH=... node scripts/shot-auth.mjs <path:out> [path:out ...]
import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].find((p) => existsSync(p));

const cookies = [
  { name: "access_token", value: process.env.ACCESS, domain: "localhost", path: "/" },
  { name: "refresh_token", value: process.env.REFRESH, domain: "localhost", path: "/" },
];

const targets = process.argv.slice(2).map((s) => {
  const [route, out] = s.split("::");
  return { route, out };
});

const browser = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1320, height: 920, deviceScaleFactor: 2 });
// Visit origin once so cookies attach to the right host (localhost, matching Domain).
await page.goto("http://localhost:4345/login", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.setCookie(...cookies);

for (const { route, out } of targets) {
  await page.goto(`http://localhost:4345${route}`, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: out });
  console.log(`saved ${out}  (${page.url()})`);
}
await browser.close();
