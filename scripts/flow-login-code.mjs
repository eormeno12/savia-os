import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].find((p) => existsSync(p));

const browser = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:4345/login", { waitUntil: "networkidle0" });
await page.type('input[type="email"]', "demo@savia.test");
await page.click('button[type="submit"]');
await page.waitForSelector('input[inputmode="numeric"], [data-part="input"]', { timeout: 10000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: "/tmp/savia-shots/login-code.png" });
await browser.close();
console.log("saved login-code.png");
