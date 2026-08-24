// ────────────────────────────────────────────────────────────────────────────
// EL GUARDIAN DEL CONTRASTE DE LA BANDEJA Y EL ONBOARDING.
//
// La version anterior de este archivo media UN patron que ya no existe:
// `[data-estado="..."] { --tono: ...; }`, el punto de color solo (sin texto) que
// la bandeja VIEJA y oscura pintaba contra `--savia-color-bg-inverse`, con el piso
// de 3:1 que la 1.4.11 pide para un objeto grafico no textual. El rediseno (Fase
// 5/6) saco ese punto: hoy CADA estado se dice con palabra + fondo tenue, nunca
// color solo — asi que correr el guardian viejo daba "no se encontro ningun
// `--tono`" y salia con codigo 1 sin medir nada.
//
// **El criterio cambia junto con el patron.** Lo que se mide ahora es SIEMPRE
// texto — una palabra adentro de un badge, o el texto de un motivo o una fila —
// asi que el piso correcto es el de la 1.4.3 (AA, texto normal): **4.5:1**, no
// 3:1. El piso mas bajo de la 1.4.3 solo aplica a "texto grande" (18pt/24px, o
// 14pt/18.66px en negrita), y la escala de estos elementos —`--texto-pequeno`
// (11.5px) y `--texto-etiqueta` (11px), ver `panel.css`— esta muy por debajo de
// eso en los cuatro patrones, asi que 4.5:1 aplica sin excepcion.
//
// Los cuatro patrones, en las dos superficies con estado-color del rediseno:
//
//   1. `.badge[data-tono="X"]` (panel.css) — fondo Y color en la MISMA regla:
//      se compone el `--savia-color-X-muted` (translucido) contra el fondo del
//      panel y se mide el `--savia-color-X-fg` contra ESE compuesto.
//   2. `.carpeta-card__motivo[data-tono="X"]` (panel.css) — sin fondo propio:
//      hereda `--savia-color-bg-panel`, el fondo de la bandeja entera.
//   3. `.archivo-fila[data-estado="fallo"] ...` (panel.css) — mismo caso: sin
//      fondo propio, hereda `--savia-color-bg-panel`.
//   4. `.fila-archivo__estado--fallo` (onboarding.css) — la vista de archivos
//      del onboarding usa clase en vez de atributo, pero es la misma garantia:
//      sin fondo propio, hereda `--savia-color-bg-panel` (las pantallas Q2–Q6;
//      Q1, `.pantalla--oscura`, es la unica sobre tinta y no tiene badges ni
//      estado-color, asi que no se mide).
//
// La compra translucida de un `--X-muted` ya NO es un `color-mix()` local de la
// bandeja vieja — los tokens semanticos de `tokens.css` la escriben directo como
// `rgb(r g b / alfa)`. El resolver de `var()` es el mismo de siempre; lo que
// cambia es el formato final que hay que componer contra el fondo.
// ────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aca = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(
  join(aca, "../../../packages/design-tokens/css/tokens.css"),
  "utf8",
);
const cssPanel = readFileSync(join(aca, "../panel/panel.css"), "utf8");
const cssOnboarding = readFileSync(
  join(aca, "../panel/onboarding/onboarding.css"),
  "utf8",
);

/** El piso de la 1.4.3 (AA) para texto normal — los cuatro patrones son texto. */
const PISO = 4.5;
/** El fondo por omision de ambas superficies cuando la regla no trae el suyo. */
const FONDO_TOKEN = "--savia-color-bg-panel";

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

/**
 * Compone un color translucido (canal por canal) contra lo que tiene detras.
 * Mismo motivo que el guardian anterior dejaba anotado para su `color-mix`:
 * medir el canal puro seria medir algo que nadie ve.
 */
const componer = (base, alfa, fondo) =>
  base.map((c, i) => Math.round(c * alfa + fondo[i] * (1 - alfa)));

/**
 * Resuelve un valor de color hasta RGB. Si es opaco (hex) no necesita fondo;
 * si es translucido (`rgb(r g b / a)`, el formato que `tokens.css` usa hoy
 * para todo `--X-muted`) se compone contra `fondo`.
 */
function color(valorCrudo, fondo) {
  const literal = resolver(valorCrudo);
  if (/^#[0-9a-f]{6}$/i.test(literal)) return aRgb(literal);
  const translucido = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)$/i.exec(literal);
  if (translucido) {
    if (!fondo) {
      throw new Error(
        `«${valorCrudo}» resolvio a un rgb() translucido pero no se le dio un fondo contra el cual componer`,
      );
    }
    const base = [Number(translucido[1]), Number(translucido[2]), Number(translucido[3])];
    return componer(base, Number(translucido[4]), fondo);
  }
  throw new Error(
    `no se pudo medir «${valorCrudo}»: resolvio a «${literal}», que no es un hex opaco ni un rgb() translucido`,
  );
}

const fondoPanel = color(`var(${FONDO_TOKEN})`, null);

/** Saca `background:` y `color:` de un cuerpo de regla CSS ya extraido. */
const declaracion = (cuerpo, propiedad) =>
  new RegExp(`\\b${propiedad}:\\s*([^;]+);`).exec(cuerpo)?.[1]?.trim() ?? null;

const grupos = [];

// PATRÓN 1 — .badge[data-tono="X"]: fondo Y color en la misma regla.
{
  const mediciones = [];
  for (const m of cssPanel.matchAll(/\.badge\[data-tono="([\w-]+)"\]\s*\{([^}]*)\}/g)) {
    const [, tono, cuerpo] = m;
    const bg = declaracion(cuerpo, "background");
    const fg = declaracion(cuerpo, "color");
    if (!bg || !fg) {
      throw new Error(`.badge[data-tono="${tono}"] no declara background y color juntos`);
    }
    const fondoEfectivo = color(bg, fondoPanel);
    const colorTexto = color(fg, fondoEfectivo);
    mediciones.push({
      etiqueta: tono,
      r: contraste(colorTexto, fondoEfectivo),
      detalle: `bg=${bg}  color=${fg}`,
    });
  }
  grupos.push({
    nombre: 'panel.css · .badge[data-tono="X"]  (fondo y color propios)',
    mediciones,
  });
}

// PATRÓN 2 — .carpeta-card__motivo[data-tono="X"]: hereda el fondo del panel.
{
  const mediciones = [];
  for (const m of cssPanel.matchAll(/\.carpeta-card__motivo\[data-tono="([\w-]+)"\]\s*\{([^}]*)\}/g)) {
    const [, tono, cuerpo] = m;
    const fg = declaracion(cuerpo, "color");
    if (!fg) throw new Error(`.carpeta-card__motivo[data-tono="${tono}"] no declara color`);
    mediciones.push({
      etiqueta: tono,
      r: contraste(color(fg, fondoPanel), fondoPanel),
      detalle: `color=${fg}  (fondo heredado: ${FONDO_TOKEN})`,
    });
  }
  grupos.push({
    nombre: `panel.css · .carpeta-card__motivo[data-tono="X"]  (hereda ${FONDO_TOKEN})`,
    mediciones,
  });
}

// PATRÓN 3 — .archivo-fila[data-estado="fallo"] ...: hereda el fondo del panel.
// El selector real agrupa dos descendientes (`__icono`, `__estado`) en UNA regla;
// otras reglas con el mismo prefijo (ej. `__nombre { font-weight }`) no traen
// `color` y se descartan — no son parte de esta garantia.
{
  const mediciones = [];
  for (const m of cssPanel.matchAll(/\.archivo-fila\[data-estado="([\w-]+)"\][^{]*\{([^}]*)\}/g)) {
    const [, estado, cuerpo] = m;
    const fg = declaracion(cuerpo, "color");
    if (!fg) continue;
    mediciones.push({
      etiqueta: `${estado} (icono + estado)`,
      r: contraste(color(fg, fondoPanel), fondoPanel),
      detalle: `color=${fg}  (fondo heredado: ${FONDO_TOKEN})`,
    });
  }
  grupos.push({
    nombre: `panel.css · .archivo-fila[data-estado="X"] ...  (hereda ${FONDO_TOKEN})`,
    mediciones,
  });
}

// PATRÓN 4 — .fila-archivo__estado--fallo (onboarding.css): hereda el fondo del panel.
{
  const mediciones = [];
  for (const m of cssOnboarding.matchAll(/\.fila-archivo__estado--fallo\s*\{([^}]*)\}/g)) {
    const [, cuerpo] = m;
    const fg = declaracion(cuerpo, "color");
    if (!fg) continue;
    mediciones.push({
      etiqueta: "fallo",
      r: contraste(color(fg, fondoPanel), fondoPanel),
      detalle: `color=${fg}  (fondo heredado: ${FONDO_TOKEN})`,
    });
  }
  grupos.push({
    nombre: `onboarding.css · .fila-archivo__estado--fallo  (hereda ${FONDO_TOKEN})`,
    mediciones,
  });
}

const total = grupos.reduce((n, g) => n + g.mediciones.length, 0);
if (total === 0) {
  console.error(
    "CONTRASTE-ERR: no se encontro ninguno de los cuatro patrones de estado-color. " +
      "El guardian no mide nada.",
  );
  process.exit(1);
}

let fallo = false;
for (const grupo of grupos) {
  console.log(`${grupo.nombre}  — ${grupo.mediciones.length} instancia(s)`);
  for (const { etiqueta, r, detalle } of grupo.mediciones) {
    const ok = r >= PISO;
    if (!ok) fallo = true;
    console.log(
      `  ${ok ? " " : "✗"} ${etiqueta.padEnd(20)} ${r.toFixed(2).padStart(6)}:1  ${detalle}`,
    );
  }
}

if (fallo) {
  console.error(
    `\nCONTRASTE-ERR: un texto de estado por debajo de ${PISO}:1 sobre la superficie que\n` +
      "               realmente lo rodea es un texto que no se lee — 1.4.3 (AA, texto\n" +
      "               normal) pide 4.5:1, y ninguno de estos elementos llega al tamano de\n" +
      '               "texto grande" que habilitaria un piso mas bajo. **No lo arregles\n' +
      "               subiendo el piso.** La superficie decide que tono sobrevive: si un\n" +
      "               `--savia-color-X-fg` no aguanta sobre el fondo que esta regla hereda\n" +
      "               o compone, la pregunta es si ese estado necesita ese tono, no si el\n" +
      "               piso de la 1.4.3 se puede negociar.",
  );
  process.exit(1);
}
console.log(`\ncontraste ok  — ${total} instancias de texto, todas sobre ${PISO}:1`);
