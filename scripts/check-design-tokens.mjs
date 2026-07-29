#!/usr/bin/env node
/**
 * Guardrail "tokens o nada" — falla si aparece un color crudo (hex de 3 o 6
 * dígitos, o una escala de color de Chakra como `red.500`) en el código de
 * producto, en vez de un token del design system (`@savia-os/design-tokens`).
 *
 * Cubre el app **y** los paquetes compartidos (la auditoría 2026-06-27 detectó
 * que solo se escaneaba `apps/app/src`). Además **reporta** (sin fallar todavía)
 * la tipografía suelta (`fontSize`/`fontWeight` en vez de `textStyle`) para que
 * la migración a los componentes de texto de `@savia-os/ui` se mida y tienda a
 * cero — cuando llegue a cero, este reporte pasa a ser un hard-fail.
 *
 * Deuda conocida: los archivos en ALLOWLIST son excepciones legítimas (fuentes
 * de marca) o deuda con step asignado. Cuando una superficie migra, se borra su
 * entrada. ALLOWLIST vacía ⇒ guardrail de color 100% activo.
 *
 * Uso: node scripts/check-design-tokens.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["apps/app/src", "packages/ui/src"];

const HEX6 = /#[0-9a-fA-F]{6}\b/;
const HEX3 = /#[0-9a-fA-F]{3}\b/;
const CHAKRA_COLOR =
  /\b(red|green|blue|orange|purple|teal|pink|cyan|yellow|gray)\.[0-9]{2,3}\b/;
// Tipografía suelta: `fontSize=` o `fontWeight=` como prop (no `textStyle`).
const LOOSE_TYPE = /\bfont(Size|Weight)=/;

// Excepciones legítimas / deuda con step.
const ALLOWLIST = new Set([
  "apps/app/src/app/layout.tsx", // themeColor en metadata de Next (no es token Chakra)
  "packages/ui/src/constants.ts", // BRAND_COLORS: fuente de marca para Framer/no-Chakra
  "packages/ui/src/brand/savia-particles.tsx", // color de partículas (canvas/SVG)
]);

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const colorViolations = [];
const typeHits = new Map(); // file → count

for (const scanDir of SCAN_DIRS) {
  const abs = join(ROOT, scanDir);
  if (!existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file);
    const allow = ALLOWLIST.has(rel);
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return; // comentarios
      if (!allow) {
        const hit = line.match(HEX6) ?? line.match(HEX3) ?? line.match(CHAKRA_COLOR);
        if (hit) colorViolations.push(`${rel}:${i + 1}  ${hit[0]}  →  ${trimmed.slice(0, 80)}`);
      }
      if (LOOSE_TYPE.test(line)) typeHits.set(rel, (typeHits.get(rel) ?? 0) + 1);
    });
  }
}

// Reporte de tipografía (no falla — todavía).
const totalType = [...typeHits.values()].reduce((a, b) => a + b, 0);
if (totalType > 0) {
  const top = [...typeHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`\n⚠ Tipografía suelta: ${totalType} usos de fontSize/fontWeight (migrar a textStyle / <PageTitle|CardTitle|Metric|Caption|Eyebrow>).`);
  for (const [f, n] of top) console.log(`   ${n.toString().padStart(3)}  ${f}`);
  console.log("   (informativo; será hard-fail cuando llegue a 0)\n");
}

if (colorViolations.length > 0) {
  console.error("\n✖ Guardrail de design tokens: colores crudos fuera de @savia-os/design-tokens\n");
  for (const v of colorViolations) console.error("  " + v);
  console.error(
    `\n${colorViolations.length} violación(es). Usa tokens del design system, o añade el archivo a ALLOWLIST si es excepción legítima.\n`,
  );
  process.exit(1);
}

console.log("✓ Guardrail de design tokens: sin colores crudos fuera del allowlist.");
