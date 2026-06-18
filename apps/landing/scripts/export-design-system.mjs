/**
 * Exports the Next.js design system as self-contained HTML files
 * for upload to claude.ai/design via DesignSync.
 *
 * Usage: npm run export:ds
 * Requires: dev server running (npm run dev)
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "design-system-preview");
const BASE = "http://127.0.0.1:4343";

const PAGES = [
  { path: "/design-system",            name: "index",      group: "Design System" },
  { path: "/design-system/brand",      name: "brand",      group: "Identidad"     },
  { path: "/design-system/voice",      name: "voice",      group: "Identidad"     },
  { path: "/design-system/logo",       name: "logo",       group: "Identidad"     },
  { path: "/design-system/island",     name: "orbitas",    group: "Identidad"     },
  { path: "/design-system/isla",       name: "isla",       group: "Identidad"     },
  { path: "/design-system/colors",     name: "colors",     group: "Tokens"        },
  { path: "/design-system/typography", name: "typography", group: "Tokens"        },
  { path: "/design-system/tokens",     name: "tokens",     group: "Tokens"        },
  { path: "/design-system/buttons",    name: "buttons",    group: "Componentes"   },
];

// Fetch a URL and return text, or null on error.
async function getText(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Replace <link stylesheet href="/_next/static/..."> with inlined <style>.
async function inlineCSS(html) {
  const re = /<link[^>]+rel=["']stylesheet["'][^>]*href=["'](\/[^"']+)["'][^>]*\/?>/gi;
  const matches = [...html.matchAll(re)];
  for (const m of matches) {
    const href = m[1];
    if (!href.startsWith("/_next/static/")) continue;
    const css = await getText(BASE + href);
    if (css) {
      html = html.replace(m[0], `<style>\n${css}\n</style>`);
    }
  }
  return html;
}

function clean(html, group) {
  // Remove all <script> tags
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, "");
  // Remove next/image preconnect/preload that point to local server
  html = html.replace(/<link[^>]+as=["']image["'][^>]*\/?>/gi, "");
  // Prepend DesignSync card marker
  return `<!-- @dsCard group="${group}" -->\n` + html;
}

async function exportPage({ path, name, group }) {
  process.stdout.write(`  ${name.padEnd(12)}`);
  const html = await getText(BASE + path);
  if (!html) {
    console.log("✗  (fetch failed — is dev server running?)");
    return false;
  }
  const withCSS = await inlineCSS(html);
  const final = clean(withCSS, group);
  writeFileSync(join(OUT_DIR, `${name}.html`), final, "utf8");
  console.log("✓");
  return true;
}

async function main() {
  // Verify server
  const ok = await getText(BASE);
  if (ok === null) {
    console.error(
      "\nDev server not reachable at " + BASE +
      "\nStart it first:  npm run dev\n"
    );
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\nExporting design system → design-system-preview/\n`);

  let success = 0;
  for (const page of PAGES) {
    if (await exportPage(page)) success++;
  }

  console.log(`\n${success}/${PAGES.length} pages exported.`);
  if (success > 0) {
    console.log(
      "\nNext: upload to claude.ai/design via DesignSync in a Claude Code session.\n"
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
