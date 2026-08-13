#!/usr/bin/env node
// Acredita cada garantía del paquete ROMPIÉNDOLA, y falla si alguna deja de romperse.
//
//   node scripts/mutants.mjs           todas las mutaciones
//   node scripts/mutants.mjs M8        una sola, para iterar
//
// MISMO DISEÑO QUE `ir/scripts/mutants.mjs`, y por la misma razón. `emission` tenía
// un guardián de invariantes de 362 líneas que AFIRMABA, en su encabezado, que «cada
// invariante de acá se acreditó ROMPIÉNDOLO» — y no había con qué comprobarlo: la
// acreditación había ocurrido una vez, a mano, cuando se escribió. Ese es exactamente
// el estado en el que `ir` se mintió a sí mismo cinco veces (la marca que colapsaba a
// `never`, el detector con cinco huecos, la cifra invertida, la aserción muda, el
// string pelado aceptado como huella). Una garantía que solo se verificó el día que
// se escribió es indistinguible de una que nunca funcionó.
//
// EN SERIE Y EN EL ÁRBOL, a propósito. La cadena de guardianes tarda medio segundo:
// paralelizar en copias ahorraría segundos y costaría gestión de directorios
// temporales. El árbol se restaura siempre, incluso si algo explota, y se comprueba
// verde al principio Y al final.

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = (r) => resolve(RAIZ, r);

// Las tres mutaciones que rompen `citations.mjs` tienen que ESCRIBIR una cita rota, y
// este archivo lo escanea `citations.mjs` como a cualquier otro script del paquete.
// Si el carácter de sección o un `L` seguido de dígitos aparecieran LITERALES acá, el
// árbol sano ya estaría rojo y ninguna fila de abajo significaría nada. Se escriben
// por código de escape: el guardián lee el archivo como TEXTO y no los ve; el runtime
// sí los produce. La alternativa era excluir este archivo del barrido, que es abrir
// un agujero en el guardián justo donde nadie mira.
const SEC = "\u00A7";
const ELE = "\u004C";

/**
 * Cada fila es una garantía y la forma exacta de romperla.
 *
 * - `cambios`: pares [buscar, reemplazar]. `buscar` tiene que aparecer
 *   EXACTAMENTE UNA VEZ. Si aparece cero o dos veces, la mutación se pudrió con
 *   una edición anterior y eso es un ERROR, no un salteo: un mutante obsoleto
 *   que se saltea en silencio es una garantía que dejó de verificarse.
 * - `espera`: lo que la salida tiene que decir. Un regex, no un exit code — que
 *   falle no alcanza, tiene que fallar POR LA RAZÓN correcta. Es lo que separa
 *   «acredité el invariante» de «rompí la compilación y algo se puso rojo».
 * - `control`: no rompe nada y tiene que quedar VERDE. Sin controles, una suite
 *   donde todo falla es indistinguible de una donde el compilador está roto.
 */
const MUTANTES = [
  // ── I1 · la lista es plana ─────────────────────────────────────────────────
  {
    id: "M1",
    garantía: "I1 — un nodo emitido que perdió su marca nodal no pasa por plano",
    cambios: [
      [`    output.push({\n      ...node,`, `    output.push(JSON.parse(JSON.stringify({\n      ...node,`],
      [
        `      hash: asNodeFingerprint(fingerprintOf(node.body, sha256)),\n    });`,
        `      hash: asNodeFingerprint(fingerprintOf(node.body, sha256)),\n    })));`,
      ],
    ],
    espera: /I1 · la lista es plana/,
    nota:
      "la mitad «2 o más» de I1 —un nodo ADENTRO de otro— es INEXPRESABLE desde este paquete: " +
      "`Node` no tiene campo donde meter otro `Node` y el chequeo de propiedades en exceso rechaza " +
      "inventarlo, así que toda mutación de esa forma muere en `tsc` y acreditaría al compilador, " +
      "no a I1. La mitad que SÍ se puede romper es «0», y es el caso real: la marca es un `symbol`, " +
      "así que un viaje por JSON la borra sin cambiar una sola firma",
  },

  // ── I2 · todo padre fue emitido antes ──────────────────────────────────────
  {
    id: "M2",
    garantía: "I2 — un `localParent` que apunta hacia ADELANTE no pasa",
    cambios: [[
      `      localParent: parentOf(state.stack),`,
      `      localParent: parentOf(state.stack) === null ? null : localOfNode(i + ONE),`,
    ]],
    espera: /I2 · padre emitido antes/,
    nota:
      "ACREDITACIÓN POR CASUALIDAD, ENCONTRADA Y CERRADA. La primera versión reemplazaba la " +
      "llamada entera por `localOfNode(i + ONE)` y el mutante SÍ se ponía rojo — con " +
      "«TS6133: 'parentOf' is declared but its value is never read». O sea que la fila la " +
      "acreditaba `noUnusedLocals`, no I2: el mismo defecto escrito en un emisor que además usara " +
      "`parentOf` en otro lado habría pasado en verde. La forma de hoy conserva la llamada",
  },
  {
    id: "M3",
    garantía: "I2 — un ciclo en la lista plana se REPORTA, no cuelga al guardián",
    cambios: [[
      `  asLocalId(encodeParts(NODE_PREFIX, String(i)));`,
      `  asLocalId(encodeParts(NODE_PREFIX, String(i * ZERO)));`,
    ]],
    espera: /la cadena de padres termina/,
    nota:
      "es la mutación que descubrió el tope de `ancestros`: sin él el guardián giraba quince " +
      "minutos al 100 % de CPU, que desde afuera es indistinguible de «todavía está corriendo». " +
      "El `* ZERO` no es adorno: `String(0)` a secas deja el parámetro `i` sin usar y " +
      "`noUnusedParameters` mata la corrida con TS6133 ANTES de que el guardián opine — la fila " +
      "quedaría acreditada por el linter",
  },
  {
    id: "M4",
    garantía: "H5 — el padre no puede ser un scope SINTÉTICO (hoja, región, fila)",
    cambios: [[`    if (s?.kind === "node") return s.local;`, `    if (s !== undefined) return s.local;`]],
    espera: /I2 · padre emitido antes — vía cell/,
    nota:
      "H5 es la razón de que `Scope` sea una UNIÓN y no un registro con campos opcionales. Sin " +
      "el filtro, las celdas cuelgan del scope sintético de su fila, que no es un nodo emitido: " +
      "el `localParent` apunta a un id que no está en la lista y el árbol deja de ser recorrible",
  },

  // ── I3 · las migas son los `lead` abiertos ─────────────────────────────────
  {
    id: "M5",
    garantía: "I3 — una miga de MENOS no pasa",
    cambios: [[`  stack.flatMap((s) =>`, `  stack.slice(ONE).flatMap((s) =>`]],
    espera: /I3 · migas = los lead abiertos/,
  },
  {
    id: "M6",
    garantía: "I3 — las migas en el ORDEN equivocado no pasan",
    cambios: [[`  stack.flatMap((s) =>`, `  [...stack].reverse().flatMap((s) =>`]],
    espera: /I3 · migas = los lead abiertos/,
    nota:
      "el par de M5 sobre la misma ancla: I3 compara la lista ENTERA, no el conjunto. La miga va " +
      "al payload del tramo 7 «para filtrar por sección de forma exacta» y de afuera hacia adentro " +
      "es lo que la hace legible",
  },
  {
    id: "M7",
    garantía: "I3 — una miga que apunta al nodo EQUIVOCADO no pasa",
    cambios: [[
      `  return { ref: local, text: cap === null ? text : text.slice(ZERO, cap) };`,
      `  return { ref: asLocalId(encodeParts(NODE_PREFIX, local)), text: cap === null ? text : text.slice(ZERO, cap) };`,
    ]],
    espera: /I3 · migas = los lead abiertos/,
    nota:
      "la referencia es la mitad de la miga que el bloque 3 de `ir` agregó a propósito " +
      "(PROVISIONAL(C15/#50/#73)): el texto de un título es MUTABLE POR DISEÑO, así que el filtro " +
      "por sección sobrevive por la `ref` y no por el `text`. El reemplazo re-usa `local` en vez " +
      "de escribir un id inventado porque `local` es un PARÁMETRO: dejarlo sin usar es TS6133 y la " +
      "fila quedaría acreditada por el linter (la lección de M3)",
  },
  {
    id: "M8",
    garantía: "I8 — las migas CRUZAN la frontera de delegación",
    cambios: [[
      `      breadcrumbs: breadcrumbsOf(state.stack),`,
      `      breadcrumbs: breadcrumbsOf(state.stack.slice(state.floor)),`,
    ]],
    espera: /migas a través de la frontera de delegación/,
    nota:
      "es la mutación «el subárbol delegado empieza sus migas en su propia raíz», que suena " +
      "razonable y rompe la cita encadenada contrato → página → imagen: el acta escaneada dejaría " +
      "de saber de qué contrato salió",
  },

  // ── I4 · nada se pierde y sale en orden de lectura ─────────────────────────
  {
    id: "M9",
    garantía: "I4 — un nodo que no se emite no pasa",
    cambios: [[`  return { ok: true, nodes: output };`, `  return { ok: true, nodes: output.slice(ONE) };`]],
    espera: /I4 · ningún nodo se pierde/,
  },
  {
    id: "M10",
    garantía: "I4 — reordenar la salida no pasa",
    cambios: [[`  return { ok: true, nodes: output };`, `  return { ok: true, nodes: [...output].reverse() };`]],
    espera: /I4 · orden de lectura/,
    nota: "el reconciliador parte AMBAS listas en tramos por posición; el orden es contrato, no estética",
  },

  // ── I5 · el recorrido es determinístico ────────────────────────────────────
  {
    id: "M11",
    garantía: "I5 — dos corridas sobre la misma entrada dan lo mismo",
    cambios: [[
      `  asLocalId(encodeParts(NODE_PREFIX, String(i)));`,
      `  asLocalId(encodeParts(NODE_PREFIX, String(i), String(Math.random())));`,
    ]],
    espera: /I5 · determinismo/,
    nota:
      "es el único invariante que necesita DOS corridas para verse, y por eso es el único que " +
      "una tabla golden no atrapa: una salida no determinística es golden respecto de sí misma",
  },

  // ── I6 · los `LocalId` son únicos ──────────────────────────────────────────
  {
    id: "M12",
    garantía: "I6 — dos nodos no pueden compartir `LocalId`",
    cambios: [[`    const local = localOfNode(i);`, `    const local = localOfNode(state.stack.length);`]],
    espera: /I6 · LocalId únicos/,
    nota:
      "acuñar el id por la POSICIÓN EN EL ÁRBOL en vez de por la posición en la secuencia es una " +
      "mutación plausible —suena más semántica— y hace ambiguo el mapa LocalId→ElementId del que " +
      "cuelga toda la reconciliación",
  },

  // ── I7 · el árbol es el esperado ───────────────────────────────────────────
  {
    id: "M13",
    garantía: "I7 — `spatial` elige el contenedor más INTERNO, no el más externo",
    cambios: [[`    if (best === null || isInnerThan(cand, best)) best = cand;`, `    if (best === null || isInnerThan(best, cand)) best = cand;`]],
    espera: /I7 · el árbol esperado — vía spatial/,
    nota:
      "es la mutación histórica que obligó a que `Case.trace` sea OBLIGATORIA: el sello colgaba " +
      "de la página en vez del recuadro y ningún invariante se enteraba, porque las migas se " +
      "re-derivan de `localParent` y un padre mal elegido produce migas coherentes con él",
  },
  {
    id: "M14",
    garantía: "el desempate de `isInnerThan` es TOTAL: gana el emitido más tarde",
    cambios: [[`area(a.box) <= area(b.box)`, `area(a.box) < area(b.box)`]],
    espera: /I7 · el árbol esperado — cajas empatadas/,
    nota:
      "ESTA FILA NO EXISTÍA Y LA MUTACIÓN PASABA EN VERDE. La tercera regla del desempate vive en " +
      "un solo carácter y contra los siete casos originales no se ejercía nunca: en todos ellos " +
      "las cajas que compiten están ANIDADAS, así que la primera regla (ruta más larga) ya decide. " +
      "El caso `cajas empatadas` de `synthetic.ts` nació de acá — dos hermanas de la misma área que " +
      "contienen a la misma caja. De paso corrigió el docstring, que decía que sin la tercera " +
      "regla la salida «dependería del orden de iteración de un `Set`»: no hay ningún `Set`, los " +
      "candidatos viven en un ARREGLO y las dos variantes son igualmente determinísticas",
  },
  {
    id: "M15",
    garantía: "I7 — la escala de niveles cierra lo que está a su nivel o más profundo",
    cambios: [[`    if (its === undefined || its < level) break;`, `    if (its === undefined || its <= level) break;`]],
    espera: /I7 · el árbol esperado — títulos anidados/,
    nota: "con `<=`, «Cláusula segunda» no cierra «Cláusula primera» y cuelga de ella: el documento entero se reanida",
  },
  {
    id: "M16",
    garantía: "la abstención (`hint === null`) NO es `{linkage:'none'}` — PROVISIONAL(#43)",
    cambios: [[
      `  if (hint === null) return { ok: true, route: [...state.stack], opens: null };`,
      `  if (hint === null) return { ok: true, route: root(state), opens: null };`,
    ]],
    espera: /I7 · el árbol esperado — títulos anidados/,
    nota:
      "es el colapso que PROVISIONAL(#43) existe para impedir: `null` = «no modifica la ruta», " +
      "`{linkage:'none'}` = «raíz». Con los dos significando lo mismo, todo párrafo abstenido de un " +
      "DOCX cierra la pila entera y el árbol de CUALQUIER documento se aplana. De esto dependen las " +
      "rutas de la mayoría de los nodos de la mayoría de los documentos",
  },
  {
    id: "M17",
    garantía: "…y al revés: `{linkage:'none'}` tampoco es la abstención",
    cambios: [[
      `    case "none":\n      return { ok: true, route: root(state), opens: null };`,
      `    case "none":\n      return { ok: true, route: [...state.stack], opens: null };`,
    ]],
    espera: /I7 · el árbol esperado — un subárbol delegado/,
    nota:
      "el par de M16, y hace falta porque las dos mitades se rompen por separado. Se ve SOLO " +
      "dentro del marco delegado: en la raíz del documento la pila está vacía y las dos ramas " +
      "devuelven `[]`, que es justamente por qué el caso `documento plano` mezcla las dos a propósito",
  },
  {
    id: "M18",
    garantía: "I7 (bis) — la traza canónica no se puede editar para que el test pase",
    cambios: [[
      `    "Contrato de servicios",\n    "Cláusula segunda",\n  ],`,
      `    "Contrato de servicios",\n    "Cláusula primera",\n  ],`,
    ]],
    espera: /la traza canónica es la que publica el plan/,
    nota:
      "el único invariante del paquete que compara contra algo EXTERNO al emisor. Los otros nueve " +
      "verifican que la salida sea coherente consigo misma, y una salida puede ser perfectamente " +
      "coherente y ser el árbol equivocado — que es lo que pasa si el fixture se ajusta al código",
  },

  // ── I8 · un subárbol delegado no participa de la escala del padre ──────────
  {
    id: "M19",
    garantía: "I8 — el marco de delegación impone un PISO a la escala de niveles",
    cambios: [[
      `    frames.push({ id, base, floor: state.stack.length });`,
      `    frames.push({ id, base, floor: base });`,
    ]],
    espera: /adentro de un marco es la raíz DEL MARCO/,
    nota:
      "es la mitad `floor` de la pareja que M20 empieza: `base` es la altura ANTES del injerto y " +
      "`floor` la de DESPUÉS, y con `floor: base` la raíz del marco deja afuera al nodo que delegó. " +
      "Sin el nodo `{linkage:'none'}` del caso delegado esto pasaba inadvertido: contra un injerto " +
      "que no es título la escala de niveles ya frena sola y el piso parece redundante. " +
      "SEGUNDA ACREDITACIÓN POR CASUALIDAD ENCONTRADA: la primera versión ponía `state.floor = ZERO` " +
      "siempre, y el guardián no reportaba I8 — MORÍA con un `TypeError: Cannot read properties of " +
      "undefined` adentro de `breadcrumbsOf`. Con el piso en cero la escala de niveles puede vaciar " +
      "la pila por debajo de `base`, y `state.stack.length = gone.base` la vuelve a AGRANDAR, que en " +
      "JavaScript deja agujeros. Un guardián que muere con un stack trace de `fs` en vez de decir " +
      "qué invariante se rompió no acredita: informa que algo explotó",
  },
  {
    id: "M20",
    garantía: "I8 — cerrar el marco devuelve la pila a `base`, no a `floor`",
    cambios: [[`    if (gone !== undefined) state.stack.length = gone.base;`, `    if (gone !== undefined) state.stack.length = gone.floor;`]],
    espera: /al bajar del delegado se restauran los scopes del padre/,
    nota:
      "los dos números del marco son distintos y esta fila es la que lo prueba: con uno solo, o el " +
      "injerto sobrevive al cierre —y todo lo que sigue cuelga de una imagen— o un `level 1` " +
      "delegado cierra el título del documento padre",
  },
  {
    id: "M21",
    garantía: "I8 — el nodo que delegó abre un scope PROPIO",
    cambios: [[
      `    if (lastScope !== null) state.stack.push(lastScope);`,
      `    if (lastScope !== null && frames.length < ZERO) state.stack.push(lastScope);`,
    ]],
    espera: /I8 · el delegado abre su propio scope/,
    nota:
      "la guarda imposible (`frames.length < ZERO`) es para que `lastScope` siga usado: es un " +
      "PARÁMETRO y sin uso es TS6133 (la lección de M3). Sin el injerto, el acta escaneada se " +
      "mezcla con los niveles del contrato que la contiene",
  },

  // ── I9 · el título editado ─────────────────────────────────────────────────
  {
    id: "M22",
    garantía: "I9 — la RUTA no entra en la huella (el caso que sostiene el tramo)",
    cambios: [
      [`  asNodeFingerprint,\n  fingerprintOf,`, `  asNodeFingerprint,\n  encodeParts,\n  fingerprintOf,`],
      [
        `      hash: asNodeFingerprint(fingerprintOf(node.body, sha256)),`,
        `      hash: asNodeFingerprint(sha256(encodeParts(fingerprintOf(node.body, sha256), ...breadcrumbsOf(state.stack).map((b) => b.text)))),`,
      ],
    ],
    espera: /I9 · la ruta no entra en la huella/,
    nota:
      "es la fórmula ORIGINAL del plan —`hash(migas ‖ contenido ‖ ordinal)`— y el peor modo de " +
      "falla del pipeline: editar «Cláusula primera» a «Cláusula 1ª» le mueve el id a todo párrafo " +
      "de la sección y despega la curación del cliente EN SILENCIO. El `import` va en la misma " +
      "mutación porque sin él el mutante muere con TS2304 y acreditaría al resolvedor de módulos",
    },
  {
    id: "M23",
    garantía: "I9 — …y el que SÍ cambió tiene huella distinta",
    cambios: [[
      `      hash: asNodeFingerprint(fingerprintOf(node.body, sha256)),`,
      `      hash: asNodeFingerprint(fingerprintOf({ shape: "text_span", text: "", marks: [] }, sha256)),`,
    ]],
    espera: /el que sí cambió tiene huella distinta/,
    nota:
      "sin esta mitad, `hash = constante` satisface la mitad de arriba PERFECTAMENTE: el párrafo " +
      "no movería su huella nunca. Las dos direcciones hacen falta o el invariante lo cumple una " +
      "función constante. TERCERA ACREDITACIÓN POR CASUALIDAD ENCONTRADA: la versión que hashea " +
      "`node.body.shape` deja `fingerprintOf` sin usar y el mutante moría en TS6133, o sea que lo " +
      "acreditaba el linter. Hoy la constante se construye CON `fingerprintOf`, sobre un cuerpo " +
      "vacío",
  },

  // ── I10 · un padre colgante no es una raíz silenciosa ──────────────────────
  {
    id: "M24",
    garantía: "I10 — una referencia rota no degrada a raíz",
    cambios: [[
      `        return { ok: false, failure: { kind: "parent-not-emitted", parent: hint.parent } };`,
      `        return { ok: true, route: root(state), opens: null };`,
    ]],
    espera: /I10 · el padre colgante falla con un objeto de error/,
    nota:
      "`Route` es `readonly Scope[]` y `[]` es una ruta legítima, así que degradar a raíz hace que " +
      "«referencia rota» y «cuelga de la raíz» codifiquen a lo mismo — y «cuelga de la raíz» es un " +
      "estado frecuente, no un borde",
  },
  {
    id: "M25",
    garantía: "I10 — la variante de fallo no puede traer `nodes`",
    cambios: [
      [
        `  | { readonly ok: false; readonly failure: EmissionFailure };`,
        `  | { readonly ok: false; readonly failure: EmissionFailure; readonly nodes?: readonly RoutedNode[] };`,
      ],
      [
        `      return { ok: false, failure: { ...routing.failure, position: i } };`,
        `      return { ok: false, failure: { ...routing.failure, position: i }, nodes: output };`,
      ],
    ],
    espera: /el fallo no es asignable al éxito/,
    nota:
      "es la mitad de I10 que NO es sobre el valor sino sobre el TIPO: si el llamador puede leer " +
      "`nodes` sin haber mirado `ok`, la unión discriminada no asegura nada y la política de " +
      "PENDING(#46) («el emisor corta») es decorativa",
  },

  // ── El guardián de citas ───────────────────────────────────────────────────
  {
    id: "M26",
    garantía: "citas — una cita al plan por NÚMERO DE LÍNEA no pasa",
    cambios: [[
      ` * Pieza 2 del tramo 4 — «Emisor: un solo recorrido» (${SEC}{2 · Emisor}).`,
      ` * Pieza 2 del tramo 4 — «Emisor: un solo recorrido» (${ELE}1250).`,
    ]],
    espera: /al plan por número de línea/,
    nota:
      "es la recaída que el guardián existe para impedir. Las 389 citas por número del paquete " +
      "estuvieron desfasadas hasta 339 líneas y el paquete seguía en verde: un número sigue " +
      "resolviendo a UNA línea cualquiera, así que el error es MUDO",
  },
  {
    id: "M27",
    garantía: "citas — un ancla sin llaves no pasa",
    cambios: [[
      ` * Pieza 2 del tramo 4 — «Emisor: un solo recorrido» (${SEC}{2 · Emisor}).`,
      ` * Pieza 2 del tramo 4 — «Emisor: un solo recorrido» (${SEC}2 · Emisor).`,
    ]],
    espera: /cita mal formada/,
    nota: "sin las llaves no hay forma de saber dónde termina el título, y el guardián la contaría como resuelta",
  },
  {
    id: "M28",
    garantía: "citas — un ancla que ya no existe en el plan no pasa",
    cambios: [[
      ` * Pieza 2 del tramo 4 — «Emisor: un solo recorrido» (${SEC}{2 · Emisor}).`,
      ` * Pieza 2 del tramo 4 — «Emisor: un solo recorrido» (${SEC}{2 · Emisor de fantasía}).`,
    ]],
    espera: /no hay sección del plan que empiece con/,
    nota:
      "es la mitad que compra el anclaje por encabezado: cuando alguien renombra o borra la " +
      "sección, el guardián GRITA. Un número, en cambio, sigue apuntando a texto ajeno",
  },

  // ── I11 · ningún guardián queda fuera de la cadena ─────────────────────────
  {
    id: "M29",
    garantía: "I11 — sacar un guardián de `lint` no pasa",
    cambios: [[
      `    "lint": "tsc --noEmit && node scripts/invariants.mjs && node scripts/citations.mjs && node scripts/mutants.mjs",`,
      `    "lint": "tsc --noEmit && node scripts/invariants.mjs && node scripts/mutants.mjs",`,
    ]],
    espera: /I11a · ningún guardián queda fuera de `lint`/,
    nota:
      "es la ÚNICA falla del paquete que ningún otro chequeo puede ver, porque para verla hay que " +
      "mirar el `package.json` y no la salida. `ir/GLOSARIO.md` (sección 6) documenta haberla tenido: una " +
      "lista de renombres que se olvidó de un script, y «un guardián que no corre no avisa que no " +
      "corrió». La misma fila cubre el rename a medio hacer — un nombre viejo en la cadena tampoco " +
      "está en disco, así que el guardián real sigue faltando",
  },
  {
    id: "M30",
    garantía: "I11b — `build` NO puede encadenar el corredor de mutación",
    cambios: [[
      `    "build": "tsc --noEmit && node scripts/invariants.mjs && node scripts/citations.mjs"`,
      `    "build": "tsc --noEmit && node scripts/invariants.mjs && node scripts/citations.mjs && node scripts/mutants.mjs"`,
    ]],
    espera: /I11b · `build` no puede encadenar/,
    nota:
      "la mitad de adelante de M29, y va al revés: acá el mutante AGREGA en vez de sacar. " +
      "`mutants.mjs` edita los archivos del árbol en el lugar y los restaura, y `turbo` agenda " +
      "`lint` y `build` del mismo paquete EN PARALELO: si los dos lo encadenan se pisan y el " +
      "segundo captura como «original» un archivo que el primero ya mutó. Pasó de verdad — dejó " +
      "ocho archivos de `packages/ir/src` con mutaciones pegadas. La regla de fondo es más simple " +
      "que la carrera: un build no muta su fuente",
  },

  // ── Controles ──────────────────────────────────────────────────────────────
  {
    id: "MC1",
    control: true,
    garantía: "reordenar dos casos de `CASES` no rompe nada",
    cambios: [[`  CELLS,\n  SPATIAL,`, `  SPATIAL,\n  CELLS,`]],
    nota: "cada caso se verifica contra su propia traza; el orden del arreglo no es contrato de nada",
  },
  {
    id: "MC2",
    control: true,
    garantía: "un comentario nuevo no rompe nada",
    cambios: [[`const area = (b: Box): number =>`, `// control MC2: comentario inocuo\nconst area = (b: Box): number =>`]],
  },
  {
    id: "MC3",
    control: true,
    garantía: "cambiar el texto de un fixture que NO es título no mueve ningún árbol",
    cambios: [[`    paragraph("Perfecto."),`, `    paragraph("Perfectísimo."),`]],
    nota:
      "el par de M18: la traza se compara por `anchor`, y en los fixtures el ancla ES el texto, " +
      "así que un guardián demasiado sensible se pondría rojo acá. Que el árbol de `documento " +
      "plano` sea `[null, null, null]` no depende de lo que digan sus párrafos",
  },
  {
    id: "MC4",
    control: true,
    garantía: "renombrar una variable local del recorrido no cambia nada",
    cambios: [[
      `  const frames: DelegationFrame[] = [];`,
      `  const marcos: DelegationFrame[] = [];\n  const frames = marcos;`,
    ]],
    nota: "el par de M19–M21: lo que esas filas fijan es el COMPORTAMIENTO de la pila de marcos, no cómo se llama",
  },
  {
    id: "MC5",
    control: true,
    garantía: "borrar el componente `row` de la ruta de `cell` NO rompe nada — y eso está escrito",
    cambios: [[
      `  synthetic(encodeParts("row", h.sheet, h.region, String(h.row))),\n`,
      ``,
    ]],
    nota:
      "ES EL HALLAZGO QUE `byCell` DOCUMENTA, PINCHADO PARA QUE NO SE VUELVA MENTIRA. Dos filas " +
      "distintas colapsando en el mismo scope no las nota NINGÚN invariante, y no por falta de " +
      "invariantes: cuando los tres scopes son sintéticos, H5 hace que el padre sea el primer " +
      "ancestro que sí es nodo, así que la profundidad de la parte sintética no llega a la salida " +
      "—ni a `localParent`, ni a `breadcrumbs`, ni a `hash`—. El componente se conserva porque el " +
      "tramo 5 y el reconciliador lo declaran como entrada; el día que alguno lo lea de verdad, " +
      "esta fila se pone roja y deja de ser un control, que es exactamente lo que tiene que pasar",
  },
  {
    id: "MC7",
    control: true,
    garantía: "editar el `description` de `package.json` no rompe nada",
    cambios: [[
      `  "description": "Tramo 4, piezas 1 y 2:`,
      `  "description": "control MC7 · tramo 4, piezas 1 y 2:`,
    ]],
    nota:
      "el par de M29–M30: `I11` lee `package.json` y lo que fija son las CADENAS de guardianes, no " +
      "el archivo entero. Sin este control, las dos filas de arriba serían indistinguibles de un " +
      "chequeo que congela el manifiesto",
  },
  {
    id: "MC6",
    control: true,
    garantía: "colapsar los prefijos de `LocalId` no rompe nada — y NO es porque esté verificado",
    cambios: [[`const SYNTHETIC_PREFIX = "s";`, `const SYNTHETIC_PREFIX = "n";`]],
    nota:
      "SEGUNDO HALLAZGO, Y ES INCÓMODO: el docstring de `Scope` dice que los espacios de `LocalId` " +
      "se parten en tres «para que un id de nodo, uno de scope sintético y uno de adaptador no " +
      "puedan confundirse por accidente», y con los dos prefijos iguales NADA se pone rojo. La " +
      "razón es que la protección de verdad la da `encodeParts`, que es inyectiva: un local de nodo " +
      "es el prefijo más un ÍNDICE DECIMAL y una clave sintética es el prefijo más otro " +
      "`encodeParts`, así que las preimágenes no pueden coincidir con o sin la letra distinta. El " +
      "prefijo es redundancia, no la garantía — y esta fila lo deja dicho en vez de dejar el " +
      "docstring prometiendo de más",
  },
];

// Dónde vive cada mutación se deduce de su primer `buscar`, así que no hay que
// mantener la ruta al día por separado.
// `package.json` entra en la lista porque el bloque 5 agregó `I11`, y lo que `I11`
// verifica NO está en `src/`: está en las cadenas de `lint` y `build`.
const ARCHIVOS = [
  "src/route.ts",
  "src/emitter.ts",
  "src/synthetic.ts",
  "src/index.ts",
  "package.json",
];

// LA CADENA NO SE ESCRIBE ACÁ: SE LEE DE `package.json`. Escribirla a mano la deja
// derivar de la que corre `pnpm lint` —el arnés acreditaría una cadena que nadie
// ejecuta—, y con eso el paquete tendría DOS listas de guardianes que pueden
// discrepar en silencio. Derivada, las dos formas de perder un guardián se ven: si se
// lo saca de `lint`, `I11` (en `invariants.mjs`) grita; si se saca `invariants.mjs`
// mismo —que es quien grita—, las veinticinco filas que esperan sus mensajes se ponen
// rojas de golpe. Se le quita este propio script porque el arnés no puede correrse a
// sí mismo adentro de cada mutación.
//
// El `PATH` se extiende con `node_modules/.bin` porque la cadena empieza con `tsc`
// pelado —así la escribe `package.json`, y pnpm se lo resuelve— y este script se
// corre también a mano, fuera de pnpm.
const PKG = JSON.parse(readFileSync(ruta("package.json"), "utf8"));
const CADENA = (PKG.scripts?.lint ?? "")
  .split("&&")
  .map((t) => t.trim())
  .filter((t) => t !== "" && !t.endsWith("scripts/mutants.mjs"))
  .join(" && ");
if (!CADENA.includes("scripts/")) {
  console.error(
    `EMISSION-ERR: el \`lint\` de package.json no nombra ningún guardián además de este arnés.\n` +
      `  Sin cadena que correr, cada mutación de abajo daría VERDE y la suite entera mentiría.`,
  );
  process.exit(1);
}
const ENTORNO = { ...process.env, PATH: `${ruta("node_modules/.bin")}:${process.env.PATH ?? ""}` };

const guardianes = () => {
  try {
    const salida = execSync(CADENA, {
      cwd: RAIZ,
      env: ENTORNO,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { verde: true, salida };
  } catch (e) {
    return { verde: false, salida: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

const ubicar = (buscar) => {
  // Si `ARCHIVOS` nombra un archivo que no está en disco —un rename a medio hacer—,
  // el `readFileSync` de abajo salía con un ENOENT CRUDO de Node: stack trace, y un
  // mensaje que habla de `fs` y no de mutantes, así que el que lo lee no sabe si se
  // rompió el arnés o el contrato. Con la lista corrida, además, un mutante que no
  // encuentra su texto es indistinguible de uno podrido.
  const faltantes = ARCHIVOS.filter((a) => !existsSync(ruta(a)));
  if (faltantes.length > 0) {
    throw new Error(
      `ARCHIVOS nombra ${faltantes.length} archivo(s) que no están en disco: ${faltantes.join(", ")}\n` +
        `  ¿rename a medio hacer? Actualizá la lista: con ella corrida, este arnés no acredita nada.`,
    );
  }
  const encontrados = ARCHIVOS.filter((a) => readFileSync(ruta(a), "utf8").includes(buscar));
  if (encontrados.length !== 1) {
    throw new Error(
      `el texto a mutar aparece en ${encontrados.length} archivos (esperaba 1)` +
        `${encontrados.length ? ": " + encontrados.join(", ") : ""}\n  «${buscar.slice(0, 70).replace(/\n/g, "⏎")}»`,
    );
  }
  return encontrados[0];
};

const soloUno = (texto, buscar, id) => {
  const n = texto.split(buscar).length - 1;
  if (n !== 1) {
    throw new Error(
      `${id}: el texto a mutar aparece ${n} veces (esperaba 1). El mutante se pudrió ` +
        `con una edición anterior — arreglalo, no lo saltees: un mutante obsoleto es ` +
        `una garantía que dejó de verificarse.\n  «${buscar.slice(0, 70).replace(/\n/g, "⏎")}»`,
    );
  }
};

// ── Corrida ──────────────────────────────────────────────────────────────────
const soloEste = process.argv[2];
const lista = soloEste ? MUTANTES.filter((m) => m.id === soloEste) : MUTANTES;
if (soloEste && lista.length === 0) {
  console.error(`EMISSION-ERR: no existe el mutante «${soloEste}»`);
  process.exit(1);
}

// ── Exclusión mutua ──────────────────────────────────────────────────────────
// ESTE ARNÉS MUTA EL ÁRBOL DE TRABAJO EN EL LUGAR, así que DOS corridas a la vez se
// pisan: la segunda captura como «original» un archivo que la primera ya mutó, y al
// restaurar deja la mutación puesta. No es teórico — `turbo lint --continue` en la
// raíz agenda `@savia-os/ir#lint` y `@savia-os/ir#build` EN PARALELO (los dos
// encadenan su propio `mutants.mjs`, y el segundo entra por el `dependsOn: ["^build"]`
// de este paquete), y el resultado es `packages/ir/src` con mutaciones pegadas y el
// mensaje «el árbol quedó ROTO después de restaurar». `emission` no puede caer en esa
// carrera con el grafo de hoy —`turbo lint` no agenda su `build`—, y el candado está
// igual: la protección no puede depender de la forma que tenga el grafo mañana, ni de
// que nadie abra dos terminales.
//
// Falla en vez de esperar: si hay otra corrida, la respuesta correcta es no correr,
// no encolarse. Un arnés que espera parece colgado.
// Vive en el directorio temporal del sistema y no adentro del paquete: un archivo
// suelto en `scripts/` habría que ignorarlo en git, y un candado versionado por
// accidente es peor que no tenerlo. La clave es la ruta del paquete, que es lo que
// identifica al árbol que se está mutando.
const CANDADO = join(
  tmpdir(),
  `savia-mutants-${Buffer.from(RAIZ).toString("base64url")}.lock`,
);
if (existsSync(CANDADO)) {
  console.error(
    `EMISSION-ERR: ya hay otra corrida de mutantes en este árbol (${CANDADO}).\n` +
      `  Este arnés muta \`src/\` en el lugar: dos a la vez se pisan y dejan mutaciones pegadas.\n` +
      `  Si estás seguro de que no hay ninguna corriendo, borrá el archivo.`,
  );
  process.exit(1);
}
writeFileSync(CANDADO, `${process.pid}\n`, "utf8");
const soltar = () => rmSync(CANDADO, { force: true });
process.on("exit", soltar);
for (const señal of ["SIGINT", "SIGTERM"]) process.on(señal, () => process.exit(1));

const base = guardianes();
if (!base.verde) {
  console.error(
    `EMISSION-ERR: el árbol NO está verde antes de mutar. Nada de lo que sigue significaría nada.\n` +
      base.salida.split("\n").slice(0, 12).map((l) => "  " + l).join("\n"),
  );
  process.exit(1);
}

let fallos = 0;
for (const m of lista) {
  const originales = new Map();
  try {
    for (const [buscar, reemplazar] of m.cambios) {
      const archivo = ubicar(buscar);
      const antes = readFileSync(ruta(archivo), "utf8");
      if (!originales.has(archivo)) originales.set(archivo, antes);
      soloUno(antes, buscar, m.id);
      writeFileSync(ruta(archivo), antes.replace(buscar, reemplazar), "utf8");
    }

    const r = guardianes();
    let ok, detalle;
    if (m.control) {
      ok = r.verde;
      detalle = ok ? "verde, como corresponde" : "ROMPIÓ — el arnés o el compilador están mal";
    } else if (r.verde) {
      ok = false;
      detalle = "NO ROMPIÓ — la garantía se perdió";
    } else if (!m.espera.test(r.salida)) {
      ok = false;
      detalle = `rompió, pero no por la razón esperada (${m.espera})`;
    } else {
      ok = true;
      detalle = "rompió como corresponde";
    }

    console.log(`  ${ok ? "✓" : "✗"} ${m.id.padEnd(6)} ${m.garantía}`);
    if (!ok) {
      fallos++;
      console.log(`         ${detalle}`);
      if (m.nota) console.log(`         nota: ${m.nota}`);
      console.log(r.salida.split("\n").filter(Boolean).slice(0, 4).map((l) => "         │ " + l).join("\n"));
    }
  } catch (e) {
    fallos++;
    console.log(`  ✗ ${m.id.padEnd(6)} ${m.garantía}\n         ${e.message}`);
  } finally {
    // Pase lo que pase, el árbol vuelve. Sin esto un crash deja el repo mutado.
    for (const [archivo, texto] of originales) writeFileSync(ruta(archivo), texto, "utf8");
  }
}

const cierre = guardianes();
if (!cierre.verde) {
  console.error(`\nEMISSION-ERR: el árbol quedó ROTO después de restaurar. Revisá con git diff.`);
  process.exit(1);
}

const rompen = lista.filter((m) => !m.control).length;
console.log(
  fallos === 0
    ? `\nmutantes ok (${rompen} garantías acreditadas rompiéndolas, ${lista.length - rompen} controles verdes)`
    : `\nEMISSION-ERR: ${fallos} de ${lista.length} mutantes fallaron`,
);
process.exit(fallos === 0 ? 0 : 1);
