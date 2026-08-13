/**
 * Las citas al plan. Cero dependencias.
 *
 * `index.ts` le vende al lector una garantía concreta: «cualquiera puede cotejar
 * cada símbolo contra su línea del borrador». Esa garantía era una MENTIRA mientras
 * nadie la ejecutara — el plan es un borrador vivo, y una sola inserción de treinta
 * líneas corre todas las citas de ahí para abajo sin que nada se queje. Ya pasó: al
 * escribir este script, las 389 citas por número del paquete estaban desfasadas
 * +9, +33, +172, +175, +203 y +339 según el tramo, y el paquete seguía en verde.
 *
 * Por eso las citas se anclan a ENCABEZADOS, no a números:
 *
 *     (§{Qué sale})                 en vez de   (L1034-1040)
 *     (§{Tramo 3 › Decisiones})                 cuando el título se repite
 *
 * El ancla es un PREFIJO del título de la sección, opcionalmente calificado por un
 * prefijo del encabezado de nivel 1 que la contiene. Se exige que resuelva a UNA
 * sola sección: si un prefijo corto se vuelve ambiguo porque alguien agregó una
 * sección parecida, el script falla y pide más texto. Corto y verificado le gana a
 * largo y sin verificar.
 *
 * Qué compra el cambio, exactamente: un encabezado sobrevive a cualquier inserción
 * que no lo toque, y cuando alguien lo renombra o lo borra este script FALLA — que
 * es cuando hay que revisar la cita. Un número, en cambio, sigue resolviendo a una
 * línea cualquiera: queda apuntando a texto ajeno y el error es MUDO. La diferencia
 * no es de precisión, es de detectabilidad. Se paga con precisión: una sección son
 * decenas de líneas, así que el comentario tiene que seguir citando el texto entre
 * «comillas» para que se sepa qué parte de la sección se está invocando.
 *
 * Qué hace el script:
 *
 *   1. Extrae toda cita `§{…}` de `src/`, de los propios scripts y del README, y la
 *      resuelve contra los encabezados del plan.
 *   2. Imprime, al lado de cada una, el TEXTO del plan al que resuelve. Ese volcado
 *      es el punto: un humano audita de un vistazo si la sección citada sostiene lo
 *      que el comentario afirma. Ninguna máquina puede decidir eso.
 *   3. FALLA (exit 1) cuando: la sección no existe, el ancla es ambigua, quedó una
 *      cita por número de línea al plan, o hay un `§` sin llaves.
 *
 * Lo tercero es lo que impide la recaída. Sin ello, el próximo autor escribe
 * `(L1234)`, nadie lo nota, y en dos ediciones del plan volvemos al estado inicial.
 * Citas a OTROS documentos (`05-capa1 L417-419`) sí se admiten por número: llevan
 * el documento adelante, no son a este plan, y acá no hay con qué verificarlas.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUÍ = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(AQUÍ, "..", "src");
const PLAN = resolve(
  AQUÍ, "..", "..", "..", "docs", "product", "savia-b2b", "borrador-pipeline-tecnico.md",
);

const líneasDelPlan = readFileSync(PLAN, "utf8").split("\n");

/**
 * Índice de encabezados del plan.
 *
 * Cada sección se puede nombrar por un prefijo de su título, o por
 * `<prefijo del tramo> › <prefijo del título>` cuando el título solo no alcanza
 * —«Decisiones tomadas» aparece cinco veces—. Sin la forma calificada, la mitad de
 * las secciones del documento serían inalcanzables.
 */
const encabezados = [];
{
  let ancestro = null;
  let enValla = false;
  for (const [i, línea] of líneasDelPlan.entries()) {
    // Dentro de un bloque de código, `#  texto  pista  ruta` es un comentario, no un
    // encabezado. Sin esto el plan aparenta tener secciones que no tiene.
    if (/^\s*```/.test(línea)) enValla = !enValla;
    if (enValla) continue;
    const m = /^(#{1,6}) +(.+?) *$/.exec(línea);
    if (m === null) continue;
    if (m[1].length === 1) ancestro = m[2];
    encabezados.push({ nivel: m[1].length, título: m[2], ancestro, línea: i + 1 });
  }
  // El alcance de una sección llega hasta el próximo encabezado de nivel <=.
  for (const [i, e] of encabezados.entries()) {
    const siguiente = encabezados.slice(i + 1).find((o) => o.nivel <= e.nivel);
    e.hasta = siguiente === undefined ? líneasDelPlan.length : siguiente.línea - 1;
  }
}

/** Para comparar: sin acentos, sin adornos de markdown, sin dobles espacios. */
const normal = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Secciones que responden a un ancla, sea pelada o calificada por el tramo. */
const resolverAncla = (ancla) => {
  const partes = ancla.split("›").map((p) => p.trim()).filter((p) => p !== "");
  const título = normal(partes[partes.length - 1]);
  const tramo = partes.length > 1 ? normal(partes[0]) : null;
  return encabezados.filter(
    (e) =>
      normal(e.título).startsWith(título) &&
      (tramo === null || (e.ancestro !== null && normal(e.ancestro).startsWith(tramo))),
  );
};

/**
 * Extrae las citas de un archivo.
 *
 * El ancla va entre llaves —`§{Qué sale}`— y no por la puntuación que la rodee: en
 * prosa corrida («§{La única} dice que…») no hay signo que marque dónde termina el
 * título, y adivinarlo por espacios rompe con cualquier título de dos palabras. El
 * `·` es parte de algunos títulos (`§{2 · Emisor}`); el `›` separa el tramo del
 * título (`§{Tramo 3 › Qué sale}`). `L####` solo se admite precedido del
 * documento al que pertenece (`05-capa1 L417`); pelado es un error, porque es
 * exactamente la forma de cita que este script existe para desterrar.
 */
const citasDe = (código) => {
  const citas = [];
  for (const [i, línea] of código.split("\n").entries()) {
    for (const m of línea.matchAll(/§(?:\{([^}\n]*)\}|(\S))/g)) {
      if (m[2] !== undefined) {
        citas.push({ línea: i + 1, tipo: "rota", crudo: línea.slice(m.index, m.index + 24) });
        continue;
      }
      citas.push({ línea: i + 1, tipo: "sección", ancla: m[1].trim() });
    }
    for (const m of línea.matchAll(/(\S+ +)?\bL(\d+)(?:-(\d+))?\b/g)) {
      const previo = (m[1] ?? "").replace(/^[(«"'¡¿[]+/, "").trim();
      const crudo = `L${m[2]}${m[3] === undefined ? "" : `-${m[3]}`}`;
      const ajena = /^\d\d-[\w-]+$|^[\w-]+\.md$/.test(previo);
      citas.push({ línea: i + 1, tipo: ajena ? "ajena" : "número", crudo, previo });
    }
  }
  return citas;
};

const recorte = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);
const cuerpoDe = (desde, hasta) =>
  líneasDelPlan.slice(desde, hasta).map((l) => l.trim()).filter((l) => l !== "").join(" ⏎ ");

// El README y los propios scripts citan el plan igual que `src/`: si quedan
// afuera, la garantía tiene un agujero justo donde nadie mira.
const archivos = [
  ...readdirSync(SRC).filter((f) => f.endsWith(".ts")).sort().map((f) => [`src/${f}`, join(SRC, f)]),
  // Menos este archivo: su docstring MUESTRA citas rotas a propósito, y un
  // verificador que se lee a sí mismo confunde el ejemplo con el caso.
  ...readdirSync(AQUÍ)
    .filter((f) => f.endsWith(".mjs") && f !== "citations.mjs")
    .sort()
    .map((f) => [`scripts/${f}`, join(AQUÍ, f)]),
  ["README.md", resolve(AQUÍ, "..", "README.md")],
];

let errores = 0;
let secciones = 0;
let ajenas = 0;

for (const [archivo, ruta] of archivos) {
  const citas = citasDe(readFileSync(ruta, "utf8"));
  if (citas.length === 0) continue;
  console.log(`\n── ${archivo} ${"─".repeat(Math.max(0, 58 - archivo.length))}`);

  for (const cita of citas) {
    const dónde = `${archivo}:${cita.línea}`;

    if (cita.tipo === "ajena") {
      ajenas += 1;
      console.log(`  ${dónde.padEnd(20)} ${`${cita.previo} ${cita.crudo}`.padEnd(30)} · otro documento`);
      continue;
    }

    if (cita.tipo === "rota") {
      errores += 1;
      console.error(
        `IR-ERR: ${dónde} — cita mal formada «${cita.crudo}»: el ancla va entre llaves, §{así}.`,
      );
      continue;
    }

    if (cita.tipo === "número") {
      errores += 1;
      console.error(
        `IR-ERR: ${dónde} — cita ${cita.crudo} al plan por número de línea.\n` +
          "        Los números del plan se corren solos; anclá por sección: §{Qué sale}.",
      );
      continue;
    }

    const candidatos = resolverAncla(cita.ancla);
    if (candidatos.length === 0) {
      errores += 1;
      console.error(`IR-ERR: ${dónde} — no hay sección del plan que empiece con «${cita.ancla}»`);
      continue;
    }
    if (candidatos.length > 1) {
      errores += 1;
      console.error(
        `IR-ERR: ${dónde} — «${cita.ancla}» es ambigua, ${candidatos.length} secciones responden:\n` +
          candidatos.map((c) => `        L${c.línea} · ${c.ancestro} · ${c.título}`).join("\n"),
      );
      continue;
    }
    secciones += 1;
    const e = candidatos[0];
    console.log(
      `  ${dónde.padEnd(20)} ${recorte(`§${cita.ancla}`, 30).padEnd(30)} │ ` +
        `L${e.línea}-${e.hasta} ${recorte(cuerpoDe(e.línea, e.hasta), 88)}`,
    );
  }
}

console.log("");
if (errores > 0) {
  console.error(`IR-ERR: ${errores} cita${errores === 1 ? "" : "s"} no resuelve al plan.`);
  process.exit(1);
}
console.log(`citas ok (${secciones} por sección, ${ajenas} a otros documentos)`);
