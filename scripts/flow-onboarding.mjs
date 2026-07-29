import puppeteer from "puppeteer-core";
import { existsSync, readFileSync } from "fs";

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].find((p) => existsSync(p));

const EMAIL = process.argv[2] ?? "onb-demo@savia.test";
const LOG = "/tmp/savia-api2.log";

function readCode(email) {
  const lines = readFileSync(LOG, "utf8").split("\n").reverse();
  for (const l of lines) {
    const m = l.match(new RegExp(`código para ${email.replace(/[.@]/g, "\\$&")}: (\\d{6})`));
    if (m) return m[1];
  }
  return null;
}

const browser = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

// 1. Request OTP
await page.goto("http://127.0.0.1:4345/login", { waitUntil: "networkidle0" });
await page.type('input[type="email"]', EMAIL);
await page.click('button[type="submit"]');
await page.waitForSelector('input[data-part="input"]', { timeout: 12000 });
await new Promise((r) => setTimeout(r, 800));

// 2. Read code from API debug log
const code = readCode(EMAIL);
if (!code) {
  console.error("No OTP code found in log for", EMAIL);
  await browser.close();
  process.exit(1);
}
console.log("OTP:", code);

// 3. Enter code → auto-submits on complete
const inputs = await page.$$('input[data-part="input"]');
await inputs[0].focus();
await page.keyboard.type(code, { delay: 80 });
await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1500));

// 4. Onboarding welcome
await page.goto("http://127.0.0.1:4345/onboarding", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "/tmp/savia-shots/onb-welcome.png" });
console.log("saved onb-welcome.png");

// 5. Select rescue + continue → rescue step
const cards = await page.$$('[role="button"][aria-pressed]');
if (cards[0]) await cards[0].click();
await new Promise((r) => setTimeout(r, 300));
const buttons = await page.$$("button");
for (const b of buttons) {
  const t = await page.evaluate((el) => el.textContent, b);
  if (t && t.includes("Continuar")) { await b.click(); break; }
}
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: "/tmp/savia-shots/onb-rescue.png" });
console.log("saved onb-rescue.png");

await browser.close();
