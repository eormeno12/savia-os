/**
 * generate-og.mjs
 * Renders scripts/og-design.html with headless Chrome and saves the result
 * to apps/landing/public/og.png (1200×630).
 *
 * Usage:
 *   pnpm generate:og
 */

import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath  = resolve(__dirname, '../design/og-design.html');
const publicDir = resolve(__dirname, '../apps/landing/public');
const outPath   = resolve(publicDir, 'og.png');

mkdirSync(publicDir, { recursive: true });

// Locate Chrome — macOS system install or common Linux paths
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Chrome not found. Install Google Chrome or set CHROME_PATH.\nSearched:\n${CHROME_CANDIDATES.join('\n')}`
  );
}

const executablePath = process.env.CHROME_PATH ?? findChrome();
console.log(`Chrome: ${executablePath}`);
console.log('Rendering OG image…');

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--font-render-hinting=none',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });

const html = readFileSync(htmlPath, 'utf-8');
// setContent (not file://) allows Google Fonts CDN to load
await page.setContent(html, { waitUntil: 'networkidle0' });

// Give Inter weights a moment to render
await new Promise((r) => setTimeout(r, 600));

await page.screenshot({
  path: outPath,
  type: 'png',
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});

await browser.close();
console.log(`✓  Saved → ${outPath}`);
