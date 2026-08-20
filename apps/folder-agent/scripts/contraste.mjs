// ────────────────────────────────────────────────────────────────────────────
// EL GUARDIAN DEL CONTRASTE DE LA BANDEJA.
//
// Existe porque el defecto que lo motivo no lo atrapo nada: el punto de «Barriendo»
// usaba `--savia-color-info`, que sobre ink da **2.67:1** y no llega ni al piso de 3:1
// que la 1.4.11 pide para un grafico no textual. Se veia bien en la maqueta, pasaba
// `tsc`, pasaba las 99 pruebas de Rust, y era invisible en la pantalla de alguien.
//
// La razon de fondo: **la capa semantica del sistema de diseno esta resuelta para
// superficie CLARA**. `success`/`info`/`warning` estan calibrados contra papel, y sobre
// ink cada uno cae distinto — `warning` a 5.24, `success` a 3.98, `info` a 2.67. Elegir
// «el token de estado que corresponde» no alcanza; hay que medir cual sobrevive.
//
// Mide los tonos que la bandeja usa como `--tono`, que es el unico lugar donde un color
// del sistema toca una superficie oscura sin texto encima que cargue el contraste.
// ────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aca = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(
  join(aca, "../../../packages/design-tokens/css/tokens.css"),
  "utf8",
);
const css = readFileSync(join(aca, "../panel/panel.css"), "utf8");

/** El piso de la 1.4.11 para componentes graficos no textuales. */
const PISO = 3;
/** La superficie de la bandeja. Sale del token, no de un hex escrito acá. */
const SUPERFICIE = "--savia-color-bg-inverse";

const crudos = new Map(
  [...tokens.matchAll(/(--savia-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
);

/** Resuelve `var(--x)` en cadena hasta llegar a un literal. */
function resolver(valor, visto = new Set()) {
  const v = valor.trim();
  const ref = /^var\((--[\w-]+)(?:,.*)?\)$/.exec(v);
  if (!ref) return v;
  if (visto.has(ref[1])) throw new Error(`ciclo de tokens en ${ref[1]}`);
  visto.add(ref[1]);
  const siguiente = crudos.get(ref[1]);
  if (!siguiente) throw new Error(`token inexistente: ${ref[1]}`);
  return resolver(siguiente, visto);
}

const aRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lineal = (c) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const luminancia = ([r, g, b]) =>
  0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const fondo = aRgb(resolver(`var(${SUPERFICIE})`));

/**
 * Los tonos translucidos se COMPONEN CONTRA LA SUPERFICIE antes de medir. Medir el
 * color puro seria medir algo que nadie ve: `paper` al 62% sobre ink no es paper.
 *
 * **Se resuelve el `var()` ANTES de preguntar si es una mezcla**, y ese orden fue el
 * primer error que este guardian encontro — en si mismo. Al reves, `var(--texto-tenue)`
 * no matchea el `color-mix`, cae al parseo de hex, `parseInt` da `NaN`, los
 * corrimientos lo vuelven `[0,0,0]` y el negro contra ink mide 1.31:1: **una falla que
 * parece un hallazgo**. Un guardian que se equivoca hacia el rojo cuesta menos que uno
 * que se equivoca hacia el verde, pero sigue siendo un guardian roto.
 */
function color(valor) {
  const literal = resolver(valor);
  const mezcla = /^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*transparent\)$/.exec(literal);
  if (mezcla) {
    const base = color(mezcla[1]);
    const p = Number(mezcla[2]) / 100;
    return base.map((c, i) => Math.round(c * p + fondo[i] * (1 - p)));
  }
  if (!/^#[0-9a-f]{6}$/i.test(literal)) {
    throw new Error(`no se pudo medir «${valor}»: resolvio a «${literal}», que no es un hex ni una mezcla conocida`);
  }
  return aRgb(literal);
}

// Las variables locales de la bandeja —`--texto-tenue` y compania— viven en `.bandeja`
// y no en los tokens, asi que se leen del mismo archivo que se esta auditando.
const locales = new Map(
  [...css.matchAll(/^\s{2}(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]),
);
for (const [k, v] of locales) if (!crudos.has(k)) crudos.set(k, v);

const usos = [...css.matchAll(/\[data-estado="([\w-]+)"\][^{]*\{\s*--tono:\s*([^;]+);/g)];
if (usos.length === 0) {
  console.error("CONTRASTE-ERR: no se encontro ningun `--tono`. El guardian no mide nada.");
  process.exit(1);
}

let fallo = false;
for (const [, estado, valor] of usos) {
  const r = contraste(color(valor), fondo);
  const ok = r >= PISO;
  if (!ok) fallo = true;
  console.log(
    `  ${ok ? " " : "✗"} ${estado.padEnd(16)} ${r.toFixed(2).padStart(6)}:1  ${valor}`,
  );
}

if (fallo) {
  console.error(
    `\nCONTRASTE-ERR: un punto de estado por debajo de ${PISO}:1 sobre la superficie de la\n` +
      `               bandeja es un punto que no se ve. **No lo arregles subiendo el piso.**\n` +
      `               Los tonos de estado del sistema estan calibrados para superficie CLARA;\n` +
      `               si ninguno sobrevive sobre ink, la pregunta es si ese estado necesita\n` +
      `               un color — «Barriendo» no lo necesitaba, es actividad y se dice con\n` +
      `               movimiento.`,
  );
  process.exit(1);
}
console.log(`contraste ok  — ${usos.length} tonos, todos sobre ${PISO}:1 en la superficie oscura`);
