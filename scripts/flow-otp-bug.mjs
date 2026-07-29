import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => existsSync(p));
const b = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
await p.goto("http://localhost:4345/login", { waitUntil: "networkidle0" });
await p.type('input[type="email"]', "otpbug@savia.test");
await p.click('button[type="submit"]');
await p.waitForSelector('input[data-part="input"]', { timeout: 12000 });
await new Promise((r) => setTimeout(r, 600));

// type ONE digit, then inspect all cell values
const inputs = await p.$$('input[data-part="input"]');
await inputs[0].focus();
await p.keyboard.type("1");
await new Promise((r) => setTimeout(r, 300));

const vals = await p.evaluate(() =>
  Array.from(document.querySelectorAll('input[data-part="input"]')).map((el) => el.value),
);
console.log("cell values after typing '1':", JSON.stringify(vals));
console.log("has undefined?:", vals.some((v) => v === "undefined" || v === undefined));
await p.screenshot({ path: "/tmp/savia-shots/otp-onedigit.png" });
console.log("saved otp-onedigit.png");
await b.close();
