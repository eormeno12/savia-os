// ────────────────────────────────────────────────────────────────────────────
// EL ICONO DE LA BANDEJA: la marca de Savia, rasterizada DESDE SU FUENTE.
//
// El path sale de `packages/ui/src/atoms/savia-mark.tsx`, que es donde vive la marca
// para todo el resto del producto. No se copia acá: se LEE. Un icono con su propio path
// es un icono que el dia que la marca cambie va a seguir siendo el viejo, y nadie se va
// a enterar hasta verlo en una pantalla.
//
// ── POR QUE UNA IMAGEN «TEMPLATE» ──────────────────────────────────────────
//
// La barra de macOS mide 22 puntos y comparte el fondo con lo que el usuario tenga
// puesto: un logo a color ahi es ilegible la mitad de las veces. El sistema lo resuelve
// con imagenes template, que son **negro pleno mas alfa** y las tine el SO segun el modo
// claro/oscuro. Asi que el icono no lleva el lima ni el ink — lo que transfiere de la
// marca es la FORMA, y la forma de Savia se sostiene sola en silueta.
//
// ── POR QUE UN RASTERIZADOR A MANO ─────────────────────────────────────────
//
// El crate no tiene dependencias de imagen y este script tampoco: aplana el path a
// poligonos —los arcos y las cubicas se subdividen— y decide cada pixel por
// submuestreo. Son ~120 lineas contra una dependencia que habria que auditar para
// generar 230 bytes.
// ────────────────────────────────────────────────────────────────────────────

import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// DOS TAMANOS, Y SON DOS TRABAJOS DISTINTOS.
//
//  · `iconTemplate.png` — 44x44, o sea 22 pt @2x: el alto util de la barra de macOS. Va
//    a la BANDEJA y lo carga el binario byte a byte, sin pasar por el `.icns`.
//  · `icon.png`         — 1024x1024: de acá sale el icono de la APP. Tauri lo convierte a
//    `.icns` y necesita el grande — darle el de 44 lo hace ESCALAR HASTA 1024, y la
//    bandeja terminaba tomando de ahi un icono remuestreado dos veces. Era exactamente
//    el «se ve ultra borroso».
const BANDEJA = { lado: 44, margen: 1, muestras: 8, archivo: "iconTemplate.png" };
// **LOS NOMBRES SON LOS QUE TAURI ESPERA, Y NO ES DECORATIVO.** El bundler arma el
// `.icns` mapeando cada archivo a un `IconType`, y lo hace por el NOMBRE: con
// `256x256.png` contesta «No matching IconType» y no empaqueta; con `128x128@2x.png`
// —la misma imagen, 256 px— empaqueta. Costo tres intentos averiguarlo.
//
// Cada tamano se RASTERIZA aparte en vez de escalar uno grande: escalar es de donde
// venia el icono borroso. El margen sube con el lado (~9%) para que la proporcion de
// aire sea la misma. A 32 px cada borde cuenta y va 8x8 de submuestreo; de 256 para
// arriba cada pixel es una fraccion diminuta de la forma y 2x2 alcanza.
const APP = [
  { lado: 32, archivo: "32x32.png" },
  { lado: 128, archivo: "128x128.png" },
  { lado: 256, archivo: "128x128@2x.png" },
].map((c) => ({
  ...c,
  margen: Math.round(c.lado * 0.09),
  muestras: c.lado <= 128 ? 8 : 2,
}));
const SUBDIVISIONES = 24; // segmentos por arco o cubica.
const VIEWBOX = 148; // el `viewBox` de `SaviaMark`.

const aca = dirname(fileURLToPath(import.meta.url));
const marca = join(aca, "../../../packages/ui/src/atoms/savia-mark.tsx");

const fuente = readFileSync(marca, "utf8");
const m = /const PATH =\s*\n?\s*"([^"]+)"/.exec(fuente);
if (!m) {
  console.error(
    `ICONO-ERR: no se encontro \`const PATH = "…"\` en ${marca}.\n` +
      `           La marca se LEE de ahi a proposito. Si el componente cambio de forma,\n` +
      `           actualiza este lector — no copies el path acá.`,
  );
  process.exit(1);
}
const PATH = m[1];

// ── Aplanado del path a un poligono ────────────────────────────────────────

/** Arco SVG por extremos → centro, y muestreo. Ver la especificacion, apendice F.6.5. */
function arco(x0, y0, rx, ry, giro, grande, barrido, x1, y1, salida) {
  const f = (giro * Math.PI) / 180;
  const [cos, sin] = [Math.cos(f), Math.sin(f)];
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const x0p = cos * dx + sin * dy;
  const y0p = -sin * dx + cos * dy;
  // Un radio que no alcanza se AGRANDA, no se ignora: la spec lo exige y sin esto un
  // path valido produciria un NaN que despues pinta el pixel entero.
  const lambda = (x0p * x0p) / (rx * rx) + (y0p * y0p) / (ry * ry);
  if (lambda > 1) {
    const k = Math.sqrt(lambda);
    rx *= k;
    ry *= k;
  }
  const num = rx * rx * ry * ry - rx * rx * y0p * y0p - ry * ry * x0p * x0p;
  const den = rx * rx * y0p * y0p + ry * ry * x0p * x0p;
  const co = (grande === barrido ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y0p) / ry;
  const cyp = (-co * ry * x0p) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x1) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y1) / 2;
  const ang = (ux, uy, vx, vy) => {
    const s = Math.sign(ux * vy - uy * vx) || 1;
    const c = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    return s * Math.acos(Math.min(1, Math.max(-1, c)));
  };
  const t0 = ang(1, 0, (x0p - cxp) / rx, (y0p - cyp) / ry);
  let dt = ang((x0p - cxp) / rx, (y0p - cyp) / ry, (-x0p - cxp) / rx, (-y0p - cyp) / ry);
  if (!barrido && dt > 0) dt -= 2 * Math.PI;
  if (barrido && dt < 0) dt += 2 * Math.PI;
  for (let i = 1; i <= SUBDIVISIONES; i++) {
    const t = t0 + (dt * i) / SUBDIVISIONES;
    const px = rx * Math.cos(t);
    const py = ry * Math.sin(t);
    salida.push([cos * px - sin * py + cx, sin * px + cos * py + cy]);
  }
}

function cubica(x0, y0, x1, y1, x2, y2, x3, y3, salida) {
  for (let i = 1; i <= SUBDIVISIONES; i++) {
    const t = i / SUBDIVISIONES;
    const u = 1 - t;
    salida.push([
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ]);
  }
}

/** Solo los comandos que la marca usa: M H V A C Z. Cualquier otro es un error. */
function aPoligono(d) {
  const t = d.match(/[A-Za-z]|-?\d*\.?\d+/g);
  const p = [];
  let i = 0;
  let x = 0;
  let y = 0;
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    switch (c) {
      case "M": x = num(); y = num(); p.push([x, y]); break;
      case "H": x = num(); p.push([x, y]); break;
      case "V": y = num(); p.push([x, y]); break;
      case "A": {
        const [rx, ry, giro, grande, barrido] = [num(), num(), num(), num(), num()];
        const [nx, ny] = [num(), num()];
        arco(x, y, rx, ry, giro, grande, barrido, nx, ny, p);
        x = nx; y = ny;
        break;
      }
      case "C": {
        const [x1, y1, x2, y2, nx, ny] = [num(), num(), num(), num(), num(), num()];
        cubica(x, y, x1, y1, x2, y2, nx, ny, p);
        x = nx; y = ny;
        break;
      }
      case "Z": case "z": break;
      default:
        console.error(`ICONO-ERR: comando de path no soportado: «${c}». La marca cambio de forma.`);
        process.exit(1);
    }
  }
  return p;
}

const girar = (p, g) => {
  const r = (g * Math.PI) / 180;
  const [c, s] = [Math.cos(r), Math.sin(r)];
  const o = VIEWBOX / 2;
  return p.map(([px, py]) => [
    c * (px - o) - s * (py - o) + o,
    s * (px - o) + c * (py - o) + o,
  ]);
};

const base = aPoligono(PATH);
// Las cuatro copias, igual que `SaviaMark`: `rotate(90|180|270 74 74)`.
const formas = [0, 90, 180, 270].map((g) => girar(base, g));

// ── Rasterizado ────────────────────────────────────────────────────────────

/**
 * **BARRIDO POR LINEAS, no punto-en-poligono por pixel.** La version ingenua prueba cada
 * muestra contra cada arista: a 1024 px con 2x2 son cuatro millones de muestras por
 * ochocientas aristas, y el script no termina — se colgo de verdad antes de que esto se
 * escribiera. Acá las intersecciones de cada fila se calculan UNA vez y se rellenan
 * tramos, que es lineal en aristas mas lineal en ancho.
 *
 * La union de las cuatro copias se hace marcando un mismo renglon de muestras desde cada
 * poligono: dos formas que se pisan marcan la misma casilla y cuenta una sola vez.
 */
function rasterizar(lado, margen, muestras) {
  const util = lado - margen * 2;
  const ancho = lado * muestras;
  const conteo = new Uint32Array(lado * lado);
  const renglon = new Uint8Array(ancho);
  const cruces = [];

  for (let sy = 0; sy < lado * muestras; sy++) {
    const py = (sy + 0.5) / muestras; // en pixeles
    const uy = ((py - margen) / util) * VIEWBOX; // en unidades del viewBox
    renglon.fill(0);
    for (const poli of formas) {
      cruces.length = 0;
      for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
        const [xi, yi] = poli[i];
        const [xj, yj] = poli[j];
        if (yi > uy !== yj > uy) cruces.push(((xj - xi) * (uy - yi)) / (yj - yi) + xi);
      }
      cruces.sort((a, b) => a - b);
      // De a pares: entre el cruce 0 y el 1 se esta adentro, entre el 1 y el 2 afuera.
      for (let k = 0; k + 1 < cruces.length; k += 2) {
        const aPx = (u) => (u / VIEWBOX) * util + margen;
        const desde = Math.max(0, Math.ceil(aPx(cruces[k]) * muestras - 0.5));
        const hasta = Math.min(ancho - 1, Math.floor(aPx(cruces[k + 1]) * muestras - 0.5));
        for (let sx = desde; sx <= hasta; sx++) renglon[sx] = 1;
      }
    }
    const fila = Math.floor(py);
    if (fila < 0 || fila >= lado) continue;
    for (let sx = 0; sx < ancho; sx++) {
      if (renglon[sx]) conteo[fila * lado + Math.floor((sx + 0.5) / muestras)]++;
    }
  }

  const pixeles = Buffer.alloc(lado * lado * 4);
  let cubiertos = 0;
  const total = muestras * muestras;
  for (let i = 0; i < conteo.length; i++) {
    // NEGRO PLENO Y EL ALFA HACE TODO EL TRABAJO: en una imagen template el SO ignora el
    // color y usa la forma. Poner gris daria un icono lavado en modo oscuro.
    const a = Math.min(255, Math.round((conteo[i] / total) * 255));
    pixeles[i * 4 + 3] = a;
    if (a > 0) cubiertos++;
  }
  return { pixeles, cubiertos };
}

// ── PNG a mano: tres trozos y un CRC. Sin dependencias. ────────────────────

const crcTabla = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const trozo = (tipo, datos) => {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const suma = Buffer.alloc(4);
  suma.writeUInt32BE(crc(cuerpo));
  return Buffer.concat([largo, cuerpo, suma]);
};

function aPng({ pixeles }, lado) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // Una linea de filtro `0` por fila: el formato lo exige aunque no se filtre nada.
  const crudo = Buffer.concat(
    Array.from({ length: lado }, (_, y) =>
      Buffer.concat([Buffer.from([0]), pixeles.subarray(y * lado * 4, (y + 1) * lado * 4)]),
    ),
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(crudo, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

// ── El `.ico` de Windows ───────────────────────────────────────────────────
//
// **NO ES DECORACION: SIN EL, `cargo check --target x86_64-pc-windows-msvc` NO COMPILA.**
// `tauri-build` genera un recurso de Windows y exige `icons/icon.ico`; sin ese archivo el
// cross-check contra Windows —lo unico que impide que el nucleo se ate a macOS sin que
// nadie se entere— falla en el script de build, no en el codigo, y por eso el error no se
// parece en nada a su causa.
//
// Un `.ico` moderno es un contenedor: cabecera, un directorio, y los PNG adentro tal
// cual. No hace falta ningun codificador nuevo — se reusan los mismos que ya se
// rasterizaron, que es lo que garantiza que el icono de Windows sea la misma marca y no
// una version escalada de otra cosa.
const ICO = "icon.ico";

function aIco(entradas) {
  const CAB = 6;
  const DIR = 16;
  const cabecera = Buffer.alloc(CAB);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // 1 = icono
  cabecera.writeUInt16LE(entradas.length, 4);

  let desplazamiento = CAB + DIR * entradas.length;
  const directorio = [];
  for (const e of entradas) {
    const d = Buffer.alloc(DIR);
    // 0 significa 256: por eso el lado va modulo 256 y no recortado.
    d.writeUInt8(e.lado % 256, 0);
    d.writeUInt8(e.lado % 256, 1);
    d.writeUInt8(0, 2); // paleta: ninguna
    d.writeUInt8(0, 3); // reservado
    d.writeUInt16LE(1, 4); // planos
    d.writeUInt16LE(32, 6); // bits por pixel
    d.writeUInt32LE(e.png.length, 8);
    d.writeUInt32LE(desplazamiento, 12);
    desplazamiento += e.png.length;
    directorio.push(d);
  }
  return Buffer.concat([cabecera, ...directorio, ...entradas.map((e) => e.png)]);
}

// ── Los archivos ───────────────────────────────────────────────────────────

const destino = join(aca, "../src-tauri/icons");
const salidas = [BANDEJA, ...APP].map((cfg) => {
  const r = rasterizar(cfg.lado, cfg.margen, cfg.muestras);
  if (r.cubiertos < cfg.lado * 4) {
    console.error(
      `ICONO-ERR: ${cfg.archivo} cubrio ${r.cubiertos} px de ${cfg.lado * cfg.lado}. Es\n` +
        `           demasiado poco para ser la marca: probablemente el aplanado del path\n` +
        `           fallo y el icono saldria casi vacio — que en la barra se ve como «no\n` +
        `           hay icono».`,
    );
    process.exit(1);
  }
  return { ...cfg, png: aPng(r, cfg.lado), cubiertos: r.cubiertos };
});

// **VERIFICA POR OMISION Y SOLO ESCRIBE CON `ICONO=si`**, igual que el emisor de
// `design-tokens` y la copia de los tokens. El icono se deriva de la marca, asi que si
// alguien toca `savia-mark.tsx` y no lo regenera, `pnpm lint` se pone rojo — que es lo
// unico que impide que el agente ande por ahi con una marca vieja.
salidas.push({
  archivo: ICO,
  lado: 256,
  // Los tres tamanos que Windows realmente pide: lista, escritorio y ventana.
  png: aIco(salidas.filter((s) => s.archivo !== BANDEJA.archivo)),
});

if (process.env.ICONO === "si") {
  mkdirSync(destino, { recursive: true });
  for (const s of salidas) writeFileSync(join(destino, s.archivo), s.png);
  console.log(`icono escrito — ${salidas.map((s) => `${s.archivo} (${s.lado}px)`).join(", ")}`);
  process.exit(0);
}

for (const s of salidas) {
  let actual;
  try {
    actual = readFileSync(join(destino, s.archivo));
  } catch {
    console.error(`ICONO-ERR: falta ${s.archivo}. Para crearlo: ICONO=si node scripts/icono.mjs`);
    process.exit(1);
  }
  if (!actual.equals(s.png)) {
    console.error(
      `ICONO-ERR: ${s.archivo} no coincide con lo que sale de savia-mark.tsx hoy.\n` +
        `           La marca cambio y el icono quedo viejo — o alguien edito el PNG a mano.\n` +
        `           Para regenerarlo: ICONO=si node scripts/icono.mjs`,
    );
    process.exit(1);
  }
}
console.log(
  `icono ok      — la marca desde savia-mark.tsx en ${salidas
    .map((s) => `${s.lado}px`)
    .join(" y ")}`,
);
