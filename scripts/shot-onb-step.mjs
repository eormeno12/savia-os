// Screenshot a specific onboarding step by seeding localStorage.
// ACCESS=.. REFRESH=.. node scripts/shot-onb-step.mjs <step> <out>
import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].find((p) => existsSync(p));

const [step, out] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1320, height: 920, deviceScaleFactor: 2 });
await page.goto("http://localhost:4345/login", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.setCookie(
  { name: "access_token", value: process.env.ACCESS, domain: "localhost", path: "/" },
  { name: "refresh_token", value: process.env.REFRESH, domain: "localhost", path: "/" },
);
await page.evaluateOnNewDocument((s) => {
  localStorage.setItem("savia.onboarding", JSON.stringify({ step: s, importMode: "rescue" }));
}, step);
await page.goto("http://localhost:4345/onboarding", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: out });
console.log(`saved ${out} (${page.url()})`);
await browser.close();
