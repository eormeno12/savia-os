import puppeteer from "puppeteer-core";
import { existsSync } from "fs";
const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => existsSync(p));
const b = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1320, height: 900, deviceScaleFactor: 2 });
await p.goto("http://localhost:4345/login", { waitUntil: "domcontentloaded" }).catch(() => {});
await p.setCookie(
  { name: "access_token", value: process.env.ACCESS, domain: "localhost", path: "/" },
  { name: "refresh_token", value: process.env.REFRESH, domain: "localhost", path: "/" },
);
await p.goto("http://localhost:4345/connections", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));

// open dialog
for (const btn of await p.$$("button")) {
  const t = await p.evaluate((el) => el.textContent, btn);
  if (t && t.includes("Conectar mi primera IA")) { await btn.click(); break; }
}
await new Promise((r) => setTimeout(r, 700));
await p.screenshot({ path: "/tmp/savia-shots/conn-dialog-form.png" });
console.log("saved conn-dialog-form.png");

// fill + create
await p.type('input[placeholder^="Ej:"]', "Claude personal");
for (const btn of await p.$$("button")) {
  const t = await p.evaluate((el) => el.textContent, btn);
  if (t && t.trim() === "Crear conexión") { await btn.click(); break; }
}
await new Promise((r) => setTimeout(r, 1400));
await p.screenshot({ path: "/tmp/savia-shots/conn-dialog-config.png" });
console.log("saved conn-dialog-config.png");
await b.close();
