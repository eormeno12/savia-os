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

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = (r) => resolve(RAIZ, r);

// Las anclas de las filas `D…`, que mutan ESTE MISMO ARCHIVO, se arman EN DOS PEDAZOS a
// propósito: escritas enteras, cada texto aparecería DOS VECES en `scripts/mutants.mjs`
// —la línea real y la fila que la nombra— y `soloUno()` se pondría rojo con razón. Es el
// precio de que el arnés se mute a sí mismo, y va dicho acá y no descubierto después.
const AL_DIARIO = `apuntar(archivo, ` + `antes);`;
const AL_ARCHIVO = `writeFileSync(ruta(archivo), antes.replace(buscar, ` + `reemplazar), "utf8");`;
const LADO_SEGURO = `return e.code !== ` + `"ESRCH";`;

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
 * - `archivo`: opcional, y hoy lo llevan SOLO las filas `D…`, que mutan este mismo
 *   archivo. `scripts/mutants.mjs` NO PUEDE entrar en `ARCHIVOS`: contiene
 *   literalmente el `buscar` de todas las filas, así que `ubicar()` vería DOS
 *   archivos para cada una y la suite entera se pondría roja. Con el destino DICHO,
 *   la unicidad la sostiene `soloUno()` adentro del archivo, que es la mitad que
 *   importa cuando no hay a dónde equivocarse. Mutar el arnés en caliente es
 *   inofensivo —node ya lo tiene en memoria—: lo que cambia es lo que el guardián LEE
 *   DE DISCO, que es donde vive la garantía.
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
      `      localParent: parentOf(route),`,
      `      localParent: parentOf(route) === null ? null : localOfNode(i + ONE),`,
    ]],
    espera: /I2 · padre emitido antes/,
    nota:
      "REANCLADA EN EL PASO 3, y la razón es el hallazgo del paso: `state.stack` y la ruta del nodo " +
      "dejaron de ser lo mismo. La mutación es la de siempre —el padre apunta hacia adelante— sobre " +
      "el argumento que hoy lleva la ruta. " +
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
      `      breadcrumbs: breadcrumbsOf(route),`,
      `      breadcrumbs: breadcrumbsOf(route.slice(state.floor)),`,
    ]],
    espera: /migas a través de la frontera de delegación/,
    nota:
      "REANCLADA EN EL PASO 3 por la misma razón que M2: las migas se derivan de la RUTA DEL NODO y " +
      "no de la pila, que desde el paso 3 pueden diferir. La mutación no cambió: " +
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
      `  if (hint === null) return { ok: true, from: "stack", route: [...state.stack], opens: null };`,
      `  if (hint === null) return { ok: true, from: "stack", route: root(state), opens: null };`,
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
      `    case "none":\n      return { ok: true, from: "stack", route: root(state), opens: null };`,
      `    case "none":\n      return { ok: true, from: "stack", route: [...state.stack], opens: null };`,
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
      `        return { ok: true, from: "stack", route: root(state), opens: null };`,
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
      `&& node scripts/invariants.mjs && node scripts/citations.mjs && node scripts/mutants.mjs",`,
      `&& node scripts/invariants.mjs && node scripts/mutants.mjs",`,
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
      `&& node scripts/invariants.mjs && node scripts/citations.mjs"`,
      `&& node scripts/invariants.mjs && node scripts/citations.mjs && node scripts/mutants.mjs"`,
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

  // ── El contenedor: hereda, abre y cierra (paso 3) ──────────────────────────
  //
  // Las cinco filas de este bloque acreditan la decisión del paso 3: `parent: null`
  // pasa a significar «heredo mi ruta» y «raíz» se dice con `{linkage:'none'}`. Son
  // cinco y no una porque las cinco mitades se rompen POR SEPARADO — heredar, abrir,
  // cerrar, que la pila sí se mueva cuando corresponde, y que la clasificación de
  // cada vía sea la que es.
  {
    id: "M31",
    garantía: "`{linkage:'parent', parent:null}` HEREDA la ruta vigente; ya no es «raíz»",
    cambios: [[
      `      if (hint.parent === null) {\n        return { ok: true, from: "stack", route: [...state.stack], opens: null };\n      }`,
      `      if (hint.parent === null) {\n        return { ok: true, from: "stack", route: root(state), opens: null };\n      }`,
    ]],
    espera: /I7 · el árbol esperado — un contenedor bajo una sección/,
    nota:
      "es la lectura que el paso 3 midió y descartó: con `parent:null` = raíz, la lista de un `.md` " +
      "se despega de su `##` y arrastra a todo lo que la sigue. El caso `un contenedor bajo una " +
      "sección` nació de acá y de ninguna otra fila: ningún caso del paso 2 tenía un container con " +
      "algo abierto por encima, así que la mutación pasaba EN VERDE contra los diez",
  },
  {
    id: "M32",
    garantía: "una ruta POR REFERENCIA no mueve la pila vigente — el contenedor CIERRA",
    cambios: [[
      `    if (routing.from === "stack") state.stack = [...route];`,
      `    state.stack = [...route];`,
    ]],
    espera: /I7 · el árbol esperado — un contenedor bajo una sección/,
    nota:
      "ES EL CÓDIGO DEL PASO 2 TAL COMO ESTABA: la asignación era incondicional. La mutación " +
      "restituye el defecto que el paso 3 encontró — después de un ítem de lista, el primer bloque " +
      "que abstiene cuelga DEL ÍTEM, y un contenedor no tiene forma de terminar. El caso `un " +
      "container (y uno anidado)` del paso 2 NO la ve: sus cinco nodos nombran a su padre, así que " +
      "nadie hereda nada y la pila da igual",
  },
  {
    id: "M33",
    garantía: "el contenedor ABRE para sus hijos: el hijo cuelga DE él, no al lado",
    cambios: [[
      `const fromAncestor = (a: Ancestor): Route => [...a.route, a.scope];`,
      `const fromAncestor = (a: Ancestor): Route => [...a.route];`,
    ]],
    espera: /I7 · el árbol esperado — un contenedor bajo una sección/,
    nota:
      "«`route(parent) ++ [scope(parent)]`» es la definición entera del caminador y NADA la " +
      "verificaba: sin el `++`, el hijo queda HERMANO de su padre y el árbol se aplana un nivel en " +
      "las dos vías que lo reusan (`parent` y `spatial`). Con la mutación puesta se ponen rojos " +
      "tres casos, que es lo que corresponde a una función que sostiene dos vías",
  },
  {
    id: "M34",
    garantía: "…y al revés: una ruta DESDE LA PILA sí pasa a ser la pila",
    cambios: [[
      `    if (routing.from === "stack") state.stack = [...route];`,
      `    if (routing.from === "stack" && route.length < ZERO) state.stack = [...route];`,
    ]],
    espera: /I3 · migas = los lead abiertos — títulos anidados/,
    nota:
      "el par de M32, y hace falta porque las dos mitades se rompen por separado: «no la muevas por " +
      "referencia» no dice nada sobre «movela cuando salió de ella». La guarda imposible es la " +
      "lección de M3 —sin ella `route` y `routing` quedarían sin uso y la fila la acreditaría " +
      "TS6133—. Lo que se ve NO es el árbol sino las MIGAS: con la pila sin truncar, «Cláusula " +
      "segunda» no cierra a «Cláusula primera», el párrafo que la sigue sigue teniendo el padre " +
      "correcto y arrastra una miga de más. Un padre bien elegido con migas de más es exactamente " +
      "el error que I3 existe para ver",
  },
  {
    id: "M35",
    garantía: "`spatial` también es una referencia: la geometría ubica UN nodo, no un contexto",
    cambios: [[
      `      return { ok: true, from: "reference", route: bySpatial(state, hint.box) };`,
      `      return { ok: true, from: "stack", route: bySpatial(state, hint.box), opens: null };`,
    ]],
    espera: /I7 · el árbol esperado — vía spatial/,
    nota:
      "ACREDITACIÓN POR CASUALIDAD ENCONTRADA Y CERRADA: con los tres nodos originales de `vía " +
      "spatial` esta fila pasaba EN VERDE, porque los tres traen su propia caja y ninguno hereda. " +
      "La clasificación de la vía existía, estaba escrita y NADA la verificaba. Se cerró agregando " +
      "un cuarto nodo que ABSTIENE — «Nota al margen, sin caja» — que es la única forma de que el " +
      "árbol note la diferencia",
  },

  // ── Tramo 5 · un recorrido, dos salidas (paso 3a) ──────────────────────────
  //
  // LO QUE ESTE BLOQUE CAMBIA RESPECTO DE LOS 35 DE ARRIBA. Hasta acá casi todas las
  // garantías eran de TIPOS o de estructura del árbol, y una mutación de tipos rompe
  // el compilador. Agrupar es código que CORRE: una mutación de comportamiento no
  // rompe nada, PRODUCE OTRA SALIDA. Por eso cada fila de abajo dice qué salida se
  // mueve, y por eso los casos de `GROUPING_CASES` traen su agrupación esperada
  // escrita a mano: sin la salida esperada escrita ANTES, la mitad de estas filas
  // pasaría en verde.
  {
    id: "M36",
    garantía: "un `lead` CIERRA el fragmento en curso — rompe LAS MIGAS",
    cambios: [[
      `        if (open !== null) sealed.push(sealOf(open));\n        open = null;\n        break;`,
      `        break;`,
    ]],
    espera: /I15 · un fragmento no cruza una frontera de sección/,
    nota:
      "el fragmento resultante agrupa nodos de DOS secciones y lleva las migas de su primer nodo para " +
      "todos, así que el filtro por sección del tramo 7 devuelve texto de otra sección y el error es " +
      "MUDO. El invariante que lo atrapa NO es el golden a propósito: un golden que cambia no dice QUÉ " +
      "se rompió",
  },
  {
    id: "M37",
    garantía: "un `lead` no arranca un fragmento con SU texto — rompe EL CUERPO",
    cambios: [[
      `        if (open !== null) sealed.push(sealOf(open));\n        open = null;\n        break;\n      case "satellite":`,
      `        open = reopen(i, n, text, cohesion);\n        break;\n      case "satellite":`,
    ]],
    espera: /I13 · los títulos no se duplican/,
    nota:
      "es la mitad de C15 que el propio `ir` documenta: con el título adentro del cuerpo vuelve el " +
      "solapamiento que §{Los títulos} declara innecesario —se embebe dos veces, una en el texto y otra " +
      "en la miga— y el fragmento nº 12 de una sección larga sigue sin llevar su contexto. Comparte " +
      "ancla con M36 y no garantía: aquella pregunta si el título CIERRA, esta si además ABRE",
  },
  {
    id: "M38",
    garantía: "`solo` no se mezcla con vecinos: cierra el fragmento abierto",
    cambios: [[
      `      case "solo":\n        // «Fragmento propio, sin mezclarse con vecinos»: el vector turbio.\n        open = reopen(i, n, text, cohesion);`,
      `      case "solo":\n        open = open === null ? reopen(i, n, text, cohesion) : add(open, n, text);`,
    ]],
    espera: /I16 · `solo` no se mezcla con vecinos/,
    nota:
      "es el argumento del vector turbio, y es la razón por la que `solo` existe como valor separado: " +
      "un bloque de código pegado al párrafo que lo precede produce un vector que no representa bien a " +
      "ninguno de los dos",
  },
  {
    id: "M39",
    garantía: "…y al revés: un `normal` tampoco se pega a un fragmento `solo`",
    cambios: [[`          open.cohesion !== "solo" &&\n`, ``]],
    espera: /I16 · `solo` no se mezcla con vecinos/,
    nota:
      "el par de M38, y hace falta porque las dos direcciones se rompen por separado: cerrar al ABRIR " +
      "un `solo` no dice nada sobre qué pasa DESPUÉS de cerrarlo. Acá el que se contamina es el vector " +
      "del código, con el párrafo que lo sigue adentro",
  },
  {
    id: "M40",
    garantía: "un `satellite` se pega al fragmento vivo (PROVISIONAL(C16) de `ir`)",
    cambios: [[
      `          open !== null && acceptsSatellite(open.cohesion)\n            ? add(open, n, text)\n            : reopen(i, n, text, cohesion);`,
      `          open !== null && !acceptsSatellite(open.cohesion)\n            ? add(open, n, text)\n            : reopen(i, n, text, cohesion);`,
    ]],
    espera: /I16 · un satélite nunca queda solo/,
    nota:
      "«un epígrafe termina siendo un fragmento de una línea sin su imagen» es el caso que C16 decide " +
      "evitar, y al rebote deja a la IMAGEN en un fragmento sin una sola letra. Es también la mutación " +
      "que en el prototipo destapó un bug real —la rama que abría sin sellar—: acá esa rama ya no " +
      "existe como sitio propio, ver `reopen` y M45",
  },
  {
    id: "M41",
    garantía: "el tamaño objetivo decide dónde corta un `normal`",
    cambios: [[`text.length <= targetSizeChars`, `text.length <= targetSizeChars * 1000`]],
    espera: /I19 · la agrupación esperada — el tamaño objetivo/,
    nota:
      "LA ÚNICA FILA DEL BLOQUE QUE NO TIENE INVARIANTE PROPIO, y es a propósito: " +
      "`PARAMETERS.grouping.targetSizeChars` es `Pending` («se mide: evaluación de recuperación sobre " +
      "corpus real»), así que escribir un invariante sobre el número sería inventar la medición que el " +
      "plan declara pendiente. Lo que el golden fija es que el número DECIDE algo — y con él decidiendo " +
      "de más, el documento entero es un solo fragmento, un solo vector y una sola clave de caché",
  },
  {
    id: "M42",
    garantía: "`minLevel` es el PEOR nivel de los nodos agrupados, por `rank()`",
    cambios: [[
      `ls.reduce((worst, l) => (rank(l) > rank(worst) ? l : worst), "declarative");`,
      `ls.reduce((worst, l) => (rank(l) < rank(worst) ? l : worst), "declarative");`,
    ]],
    espera: /I17 · minLevel es el PEOR nivel/,
    nota:
      "rompe LA CERTEZA QUE LLEGA A LA SKILL: un fragmento con un nodo adivinado por un modelo se " +
      "declara declarativo. Es la trampa que `ir` documenta en el #74 — el campo se llamaba " +
      "`minCertainty`, la peor era el MÁXIMO del rank, y un consumidor razonable escribía `Math.min` y " +
      "obtenía lo contrario de lo prometido, en verde",
  },
  {
    id: "M43",
    garantía: "`confidence.hasNull` distingue «no reportó» de «reportó bajo»",
    cambios: [[`    hasNull: reported.length !== cs.length,`, `    hasNull: false,`]],
    espera: /I17 · la confianza distingue/,
    nota:
      "rompe LA DECISIÓN DE CITAR: un fragmento con un nodo sobre el que no se sabe nada se ve igual de " +
      "confiable que uno enteramente declarativo. La forma de DOS campos es la que `ir` justifica en el " +
      "#74, y solo es observable con un caso que MEZCLE — por eso existe `niveles y confianzas " +
      "mezclados` y no alcanza con los otros cinco",
  },
  {
    id: "M44",
    garantía: "el `text` del fragmento es LIMPIO: las migas no van adentro",
    cambios: [[
      `  text: o.parts.join("\\n"),`,
      `  text: [...o.breadcrumbs.map((b) => b.text), ...o.parts].join("\\n"),`,
    ]],
    espera: /I15 · el texto del fragmento es LIMPIO/,
    nota:
      "«el tramo 6 las concatena al embeber» (§{Las dos salidas}): si ya vinieran adentro, el título se " +
      "concatena dos veces y la clave del caché deja de ser la entrada de la función que cachea — la " +
      "regla que cierra C2 en `ir`",
  },
  {
    id: "M45",
    garantía: "abrir un fragmento SELLA el anterior — el bug que `reopen` vuelve inescribible",
    cambios: [[
      `    if (open !== null) sealed.push(sealOf(open));\n    return started(i, n, text, cohesion);`,
      `    return started(i, n, text, cohesion);`,
    ]],
    espera: /I12 · ningún nodo se pierde/,
    nota:
      "ES UN BUG REAL DEL PROTOTIPO, RESTITUIDO. Vivía en la rama `else` de `satellite`, que es " +
      "INALCANZABLE —`acceptsSatellite` solo rechaza `lead` y un `lead` nunca deja fragmento abierto—, " +
      "así que ningún invariante lo veía y lo destapó un mutante que forzaba la rama. Acá el par " +
      "sellar-y-abrir existe UNA sola vez, y sus dos sitios alcanzables (`solo` y el corte de `normal`) " +
      "lo acreditan: con la mutación, el fragmento en curso se pierde entero y sus nodos desaparecen " +
      "del índice sin un solo aviso",
  },
  {
    id: "M46",
    garantía: "las migas del fragmento son las de su PRIMER nodo, no una segunda estructura",
    cambios: [[
      `    parts: text === "" ? [] : [text],\n    breadcrumbs: n.breadcrumbs,`,
      `    parts: text === "" ? [] : [text],\n    breadcrumbs: [],`,
    ]],
    espera: /I15 · las migas del fragmento son las de su primer nodo/,
    nota:
      "rompe EL CONTEXTO: los fragmentos salen sin sección y el filtro exacto del tramo 7 no matchea " +
      "nada. El tramo 5 NO construye migas: las toma de la pila del emisor. Si las construyera habría " +
      "DOS estructuras que pueden discrepar, que es exactamente lo que I3 existía para impedir un tramo " +
      "antes",
  },
  {
    id: "M47",
    garantía: "un título que no contextualizó nada emite su propio fragmento",
    cambios: [[
      `    if (referenced.has(n.local)) continue;`,
      `    if (referenced.has(n.local) || nodes.length > ZERO) continue;`,
    ]],
    espera: /I14 · el título que no contextualizó nada emite su propio fragmento/,
    nota:
      "rompe LA COBERTURA: el último título del documento desaparece de la salida, en silencio. La " +
      "guarda imposible mantiene `referenced` en uso — sin ella el mutante muere con TS6133 y la fila " +
      "quedaría acreditada por el linter (la lección de M3). El caso lo trae el `Anexo` final de `dos " +
      "secciones`, que está ahí por esta fila y por ninguna otra",
  },
  {
    id: "M48",
    garantía: "un nodo sin texto legible entra igual (PROVISIONAL(#53) de `ir`)",
    cambios: [[
      `    const text = render(n.body, schema) ?? "";`,
      `    const rendered = render(n.body, schema);\n    if (rendered === null) continue;\n    const text = rendered;`,
    ]],
    espera: /I12 · ningún nodo se pierde/,
    nota:
      "rompe LA COBERTURA por el otro lado que M45: la imagen y los containers desaparecen del índice " +
      "sin un solo aviso. `render` devuelve `null` para `asset` y `container` justamente para OBLIGAR " +
      "al tramo 5 a decidir en vez de embeber cadena vacía por accidente; la decisión que `ir` " +
      "recomienda es emitir el fragmento con `text: ''`, y omitirlo hace falso «un nodo entra entero en " +
      "algún fragmento, siempre»",
  },
  {
    id: "M49",
    garantía: "un nodo-FILA emite además un registro (la mitad σ del split π/σ)",
    cambios: [[`    if (isRowNode(n.body)) {`, `    if (isRowNode(n.body) && n.local === n.localParent) {`]],
    espera: /I18 · un registro por nodo-fila/,
    nota:
      "rompe LA SALIDA EXACTA: la planilla se puede buscar por similitud y no se puede consultar. La " +
      "guarda imposible conserva `isRowNode` en uso. Es la mitad del recorrido que NINGÚN adaptador del " +
      "paso 3 ejercita —una tabla de markdown es la tabla chica, `grain: 'whole'`— y por eso el caso es " +
      "sintético: está escrito, no tapado",
  },
  {
    id: "M50",
    garantía: "el esquema del registro viene del CONTAINER, no de la fila",
    cambios: [[`      const record = recordOf(n, schema);`, `      const record = recordOf(n, null);`]],
    espera: /I18 · un registro por nodo-fila, con las claves de/,
    nota:
      "rompe LAS CLAVES: `proveedor` pasa a ser `col_0` y la planilla deja de ser consultable por " +
      "nombre. «Si cada fila cargara sus etiquetas, renombrar una columna cambiaría el hash de las " +
      "50 000 y destruiría todas las anclas» (§{Las filas}) es la razón de que el esquema viva arriba, " +
      "y esta fila es la contrapartida: quien compone tiene que ir a buscarlo",
  },
  {
    id: "M51",
    garantía: "`fieldKey` desambigua etiquetas vacías Y repetidas",
    cambios: [[`fieldKey(schema?.[i] ?? null, i, used)`, `fieldKey(schema?.[i] ?? null, i, new Set())`]],
    espera: /I18 · un registro por nodo-fila, con las claves de/,
    nota:
      "rompe LAS CLAVES por el otro lado: dos columnas distintas colapsan en la misma y una se pierde " +
      "al construir el mapa. El `Record<string,string>` del plan exige claves únicas y no vacías, y una " +
      "planilla real tiene columnas sin encabezado y encabezados repetidos — por eso el esquema del " +
      "caso lleva una vacía y una repetida",
  },
  {
    id: "M52",
    garantía: "la fila se RENDERIZA con el esquema de su container",
    cambios: [[`    const text = render(n.body, schema) ?? "";`, `    const text = render(n.body, null) ?? "";`]],
    espera: /I18 · la fila se renderiza con el esquema de su container/,
    nota:
      "misma ancla que M48 y otra garantía: M48 pregunta si el nodo ENTRA, esta si entra COMPLETO. La " +
      "fila sola es un `grid` con `headers: null`, o sea celdas sin encabezado, así que sin el esquema " +
      "se indexa como `Acme⇥30-1⇥x⇥Acme SA` y deja de ser recuperable por nombre de columna",
  },

  {
    id: "M56",
    garantía: "el registro apunta a SU fila — las dos salidas referencian el mismo nodo",
    cambios: [[
      `  return { coordinate: n.location.coordinate, values, node: n.local };`,
      `  return { coordinate: n.location.coordinate, values, node: n.localParent ?? n.local };`,
    ]],
    espera: /I18 · las dos salidas referencian el mismo nodo-fila/,
    nota:
      "es la mutación PLAUSIBLE, no la absurda: apuntar el registro a la región suena razonable —«el " +
      "registro pertenece a la planilla»— y rompe la única cosa que hace citable una respuesta exacta. " +
      "Se sabría QUÉ dice la celda y no de qué fila salió. La fila nació buscando aserciones que no " +
      "pueden fallar: el chequeo anterior en este sitio miraba que `coordinate.space` fuera `grid`, y " +
      "eso el TIPO ya lo impide — se borró y se puso esta, que sí se puede romper",
  },

  // ── R1 · las fronteras, hechas grafo (paso 3a) ─────────────────────────────
  {
    id: "M53",
    garantía: "R1 — `emission` no puede alcanzar `adapters`, y el error NOMBRA la frontera",
    cambios: [[
      `import {\n  PARAMETERS,\n  acceptsSatellite,`,
      `import { markdownAdapter } from "@savia-os/adapters";\nexport const _cruza = markdownAdapter;\nimport {\n  PARAMETERS,\n  acceptsSatellite,`,
    ]],
    espera: /frontera cruzada · src\/grouping\.ts {2}↛ {2}@savia-os\/adapters/,
    nota:
      "ES LA FILA QUE VUELVE NO-VACÍA UNA FRASE QUE ERA CIERTA POR CONSTRUCCIÓN. Hasta el paso 3 no " +
      "había adaptador que importar, así que «`adapters` y `emission` nunca se ven» no podía fallar. " +
      "El `export const _cruza` mantiene el import en uso: sin él, TS6133 mata la corrida y la fila la " +
      "acreditaría el linter (la lección de M3). Y por esto el guardián de fronteras corre ANTES que " +
      "`tsc` en la cadena: el paquete no existe, así que el resolvedor de módulos moriría primero con " +
      "«Cannot find module», que no nombra ninguna frontera y manda a AGREGAR la dependencia",
  },
  {
    id: "M54",
    garantía: "…y tampoco nada más: `emission` tiene CERO dependencias de runtime",
    cambios: [[
      `import {\n  PARAMETERS,\n  asNodeFingerprint,`,
      `import { createHash } from "node:crypto";\nexport const _sha = createHash;\nimport {\n  PARAMETERS,\n  asNodeFingerprint,`,
    ]],
    espera: /src\/emitter\.ts importa `node:crypto`/,
    nota:
      "la mitad que M53 no cubre, y es la que distingue este guardián de un resolvedor de módulos: " +
      "`node:crypto` SÍ resuelve, así que `tsc` lo acepta sin una palabra y el paquete queda con una " +
      "dependencia de runtime en verde. `emit` recibe `sha256` POR PARÁMETRO exactamente para que eso " +
      "no pase, y hasta esta fila nada lo impedía",
  },
  {
    id: "M55",
    garantía: "el grafo DECLARADO coincide con el usado: `dependencies` es solo `ir`",
    cambios: [[
      `  "dependencies": {\n    "@savia-os/ir": "workspace:*"\n  },`,
      `  "dependencies": {\n    "@savia-os/ir": "workspace:*",\n    "typescript": "^5.9.3"\n  },`,
    ]],
    espera: /`dependencies` declara algo más que `ir`/,
    nota:
      "sin esta mitad, M53 y M54 se satisfacen agregando la dependencia y el import EL MISMO DÍA — y " +
      "el que lo hace está siguiendo al pie de la letra lo que le dijo «Cannot find module». Lo que de " +
      "verdad impone R1 es el grafo de PAQUETES (§{Paquetes}), y este es el único chequeo que lo mira",
  },

  // ── Paso 4 · R2, la regla que este paquete era el más propenso a romper ────
  {
    id: "M57",
    garantía: "R2 — aguas abajo se LEE `role`, nunca se RAMIFICA sobre él",
    cambios: [[
      `    const cohesion = cohesionOf(n.role, n.body.shape);`,
      `    const cohesion = n.role === "page_footer" ? "solo" : cohesionOf(n.role, n.body.shape);`,
    ]],
    espera: /R2 · src\/grouping\.ts nombra un literal de `role`/,
    nota:
      "LA MUTACIÓN ES LA PLAUSIBLE Y NO LA ABSURDA, y por eso duele: `PROVISIONAL(C1/#58)` de `ir` " +
      "documenta que bajo el codominio nuevo un `page_footer` pasó de «no se mezcla» a «se agrupa " +
      "libremente», y que «un pie repetido en 200 páginas entra en el texto de decenas de fragmentos, " +
      "contaminando vectores y hashes». O sea: el propio contrato deja escrito el argumento para " +
      "escribir esta línea acá, y la respuesta correcta es cambiar la TABLA en `ir`, no ramificar en el " +
      "tramo 5. Hasta el paso 4 este `switch` compilaba: R2 solo la imponía `orchestration`, y " +
      "`grouping.ts` es el consumidor de `cohesionOf` — o sea el candidato más real de todo el repo, " +
      "porque consultar la tabla es un renglón más largo que ramificar. NO ROMPÍA NADA MÁS: " +
      "`page_footer` no aparece en ningún caso sintético, así que ni el golden ni los diecinueve " +
      "invariantes se mueven. El vocabulario del guardián se DERIVA de `ROLES` en `ir`",
  },
  {
    id: "M58",
    garantía: "la exención del fixture es de NOMBRAR un rol, nunca de ramificar sobre él",
    cambios: [[
      `  node(t, "heading", prose(t), { linkage: "level", level }, delegation);`,
      `  node(t, t === "heading" ? "subheading" : "heading", prose(t), { linkage: "level", level }, delegation);`,
    ]],
    espera: /R2 · src\/synthetic\.ts nombra un literal de `role`/,
    nota:
      "ES LA FILA QUE PAGA LA EXENCIÓN. `synthetic.ts` CONSTRUYE nodos, así que tiene que poder " +
      "escribir `\"heading\"`; si no lo eximiera, R2 sería inaplicable en este paquete y la regla se " +
      "quedaría sin dueño otra vez. Pero una exención que nadie prueba es un agujero con nombre: acá se " +
      "verifica que sea NARROW —adentro del fixture sigue prohibida la forma que sí es ramificar— y que " +
      "el mensaje nombre al archivo exento y no a otro. Sin esta fila, ensanchar la exención a todos los " +
      "archivos apagaría M57 y nada cambiaría de color",
  },

  // ── El diario de deshacer del propio arnés ─────────────────────────────────
  // LAS TRES FILAS QUE NO VIENEN DEL PLAN, y las únicas que llevan EL MISMO ID EN LOS
  // CUATRO PAQUETES: acreditan la MISMA garantía sobre cuatro copias autónomas del mismo
  // diseño. Mutan `scripts/mutants.mjs` —el único archivo que el arnés no puede ubicar
  // solo, ver el campo `archivo` arriba— y el testigo es el guardián que sí lo lee DE
  // DISCO.
  //
  // LO QUE ESTAS TRES NO ACREDITAN, dicho acá y no descubierto después: que la reparación
  // FUNCIONE. Eso no se acredita con un mutante de texto — se acredita matando una corrida
  // de verdad con `SIGKILL` y mirando qué hace la siguiente. Lo que estas tres fijan es que
  // las TRES formas de perder la propiedad EDITANDO EL ARNÉS tengan un testigo que grite.
  {
    id: "D1",
    garantía: "el original va al diario ANTES de que el archivo se mute",
    archivo: "scripts/mutants.mjs",
    cambios: [[`${AL_DIARIO}\n      ${AL_ARCHIVO}`, `${AL_ARCHIVO}\n      ${AL_DIARIO}`]],
    espera: /muta ANTES de anotar el original/,
    nota:
      "invertir las dos líneas deja un intervalo en el que el archivo YA CAMBIÓ y el candado todavía no " +
      "lo sabe. Un `SIGKILL` ahí adentro es indistinguible del bug original: mutación pegada y nadie que " +
      "sepa revertirla. Es la fila que separa «hay un diario» de «el diario sirve»",
  },
  {
    id: "D2",
    garantía: "sin escribir el original al candado no hay nada que reparar",
    archivo: "scripts/mutants.mjs",
    cambios: [[`${AL_DIARIO}\n      `, ``]],
    espera: /no escribe el original al candado/,
    nota:
      "es el estado ANTERIOR a este paso escrito como mutante: el mapa en memoria alcanzaba para el " +
      "`finally`, para la excepción y para `SIGINT`/`SIGTERM`, y moría con el proceso ante un `SIGKILL` — " +
      "que es justo la señal que `turbo` usa para matar las tareas concurrentes cuando otra falla",
  },
  {
    id: "D3",
    garantía: "la duda sobre si el pid del candado vive cae del lado de «vivo»",
    archivo: "scripts/mutants.mjs",
    cambios: [[LADO_SEGURO, `return false;`]],
    espera: /da por muerto un pid del que solo duda/,
    nota:
      "`process.kill(pid, 0)` tira `EPERM` cuando el proceso EXISTE y es de otro usuario, y los PID se " +
      "reusan en máquinas de mucho uptime. Con `return false` cualquier errno pasa a significar «muerto»: " +
      "el arnés borra el candado ajeno, restaura encima de archivos que la otra corrida está mutando y las " +
      "dos siguen. El error caro es ese, no el de negarse a arrancar",
  },

  // ── Controles ──────────────────────────────────────────────────────────────
  {
    id: "DC1",
    control: true,
    garantía: "editar la prosa del docstring del diario no rompe nada",
    archivo: "scripts/mutants.mjs",
    cambios: [[
      `El estado dejó de depender ` + `de que el proceso viva.`,
      `El estado dejó de depender ` + `de que el proceso viva (control DC1).`,
    ]],
    nota:
      "el par de D1, D2 y D3. Lo que el guardián mira del arnés son TRES FORMAS —que la anotación exista, " +
      "que esté antes de la mutación y que la sonda de vida caiga del lado seguro—, no el archivo entero. " +
      "Sin este control, un guardián que congelara el texto del corredor sería indistinguible de uno que " +
      "verifica su forma, y congelarlo es la forma más rápida de que nadie lo mejore",
  },
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
      `  "description": "Tramos 4 y 5:`,
      `  "description": "control MC7 · tramos 4 y 5:`,
    ]],
    nota:
      "el par de M29–M30: `I11` lee `package.json` y lo que fija son las CADENAS de guardianes, no " +
      "el archivo entero. Sin este control, las dos filas de arriba serían indistinguibles de un " +
      "chequeo que congela el manifiesto",
  },
  {
    id: "MC8",
    control: true,
    garantía: "clasificar `cell` como ruta DESDE LA PILA no rompe nada — y no es porque esté verificado",
    cambios: [[
      `      return { ok: true, from: "reference", route: byCell(state, hint) };`,
      `      return { ok: true, from: "stack", route: byCell(state, hint), opens: null };`,
    ]],
    nota:
      "TERCER HALLAZGO INCÓMODO DEL PAQUETE, Y ES EL MISMO QUE MC5 POR OTRO LADO. La vía `cell` " +
      "está clasificada como referencia por el mismo argumento que `parent` y `spatial` —la " +
      "coordenada ubica a ESE nodo—, y la clasificación es INOBSERVABLE: los tres scopes de una " +
      "celda son SINTÉTICOS, así que H5 hace que el padre sea el primer ancestro que sí es nodo, y " +
      "una pila que quedó con `[hoja, región, fila]` produce exactamente el mismo `localParent` " +
      "—`null`— y las mismas migas —ninguna— que una que no se movió. A diferencia de M35, acá NO " +
      "alcanza con agregar un nodo que abstenga: el defecto no llega a la salida por ninguna vía. " +
      "Queda escrito en vez de dejar el docstring prometiendo de más. El día que un scope sintético " +
      "lleve algo legible, esta fila se pone roja y deja de ser un control",
  },
  {
    id: "MC9",
    control: true,
    garantía: "un comentario nuevo en `grouping.ts` no rompe nada",
    cambios: [[
      `const worstLevel = (`,
      `// control MC9: comentario inocuo\nconst worstLevel = (`,
    ]],
  },
  {
    id: "MC10",
    control: true,
    garantía: "renombrar una variable local del recorrido de agrupación no cambia nada",
    cambios: [[
      `  const sealed: (LocalFragment & { readonly order: number })[] = [];`,
      `  const cerrados: (LocalFragment & { readonly order: number })[] = [];\n  const sealed = cerrados;`,
    ]],
    nota:
      "el par de M36–M52: lo que esas filas fijan es el COMPORTAMIENTO del recorrido, no cómo se llaman " +
      "sus variables",
  },
  {
    id: "MC11",
    control: true,
    garantía: "editar la prosa de un caso de agrupación no rompe nada",
    cambios: [[`  why: "las filas son nodos`, `  why: "control MC11 · las filas son nodos`]],
    nota:
      "el par de M49–M52: el `why` viaja al mensaje de error del guardián y no a ninguna comparación. " +
      "Sin el control, un guardián demasiado sensible sería indistinguible de uno que verifica lo que " +
      "dice — es MC3 aplicado a la otra mitad del paquete",
  },
  {
    id: "MC12",
    control: true,
    garantía: "la mitad «el satélite NO se acepta» no decide nada — y eso está escrito",
    cambios: [[
      `          open !== null && acceptsSatellite(open.cohesion)`,
      `          open !== null && (acceptsSatellite(open.cohesion) || true)`,
    ]],
    nota:
      "CUARTO HALLAZGO INCÓMODO DEL PAQUETE, PINCHADO PARA QUE NO SE VUELVA MENTIRA. " +
      "`acceptsSatellite` solo rechaza `lead` (PROVISIONAL(C16) de `ir`) y un `lead` NUNCA deja " +
      "fragmento abierto, así que la rama «no se acepta» es INALCANZABLE desde este tramo y forzar el " +
      "predicado a `true` no mueve una sola salida. La llamada se conserva igual, y no por prolijidad: " +
      "la regla vive en `ir` y consultarla es lo que impide que `emission` la re-derive, que es R2. El " +
      "`|| true` mantiene la llamada en uso porque sin ella el import muere en TS6133 y el control " +
      "quedaría rojo por el linter. El día que exista una cohesión que la rechace de verdad —o que un " +
      "`lead` pueda dejar fragmento abierto— esta fila se pone roja y deja de ser un control",
  },
  {
    id: "MC13",
    control: true,
    garantía: "un comentario que NOMBRA un rol no es ramificar sobre `role`",
    cambios: [[
      `    const cohesion = cohesionOf(n.role, n.body.shape);`,
      `    // control MC13: nombrar "page_footer" en prosa no es ramificar sobre él\n    const cohesion = cohesionOf(n.role, n.body.shape);`,
    ]],
    nota:
      "el par de M57, y no es adorno: el guardián de R2 barre el archivo SIN comentarios justamente " +
      "para que un docstring que EXPLICA la regla no la viole. Sin este control, R2 sería " +
      "indistinguible de un `grep` sobre el archivo crudo — que se pondría rojo sobre su propia " +
      "documentación, que es la forma más rápida de que alguien lo apague",
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
  "src/grouping.ts",
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

// ── Exclusión mutua Y DIARIO DE DESHACER ─────────────────────────────────────
/**
 * UN SOLO ARCHIVO EN `tmpdir()` HACE DOS COSAS, y conviene no confundirlas:
 *
 *   (a) CANDADO — impide DOS corridas a la vez sobre el mismo árbol. Se pisan: la
 *       segunda captura como «original» un archivo que la primera ya mutó, y al
 *       restaurar deja la mutación puesta.
 *   (b) DIARIO DE DESHACER — el original de cada archivo se escribe ACÁ, EN DISCO, ANTES
 *       de mutarlo, y se borra de acá al restaurarlo. Es lo ÚNICO que sobrevive a un
 *       `SIGKILL`.
 *
 * POR QUÉ (b), MEDIDO DOS VECES EN DOS DÍAS. El mapa de originales vivía SOLO EN MEMORIA
 * y se volcaba desde el handler de `exit`, que cubre la salida normal, la excepción,
 * `SIGINT` y `SIGTERM` — y NO cubre `SIGKILL`, que POR DEFINICIÓN no ejecuta ningún
 * handler. `turbo` mata las tareas concurrentes cuando otra falla, y el disparador era el
 * `lint` de `design-tokens`, que nombraba un `eslint` que ese paquete no instala. Las dos
 * veces el mapa murió con el proceso: una dejó `src/markdown.ts` con `role: "heading"`
 * pegado, la otra ocho archivos de `packages/ir/src`. El candado sobrevivía y bloqueaba la
 * corrida siguiente con el mensaje correcto, pero SOLO DETECTABA: reparar quedaba para un
 * humano con el `git diff` en la mano. Con el diario, la corrida siguiente REPARA SOLA y
 * lo dice. El estado dejó de depender de que el proceso viva.
 *
 * ENCONTRAR EL CANDADO YA NO SIGNIFICA UNA SOLA COSA. Antes era «hay otra corrida». Ahora
 * es eso O «alguien murió y hay que reparar», y confundirlos es PEOR que el problema
 * original: un huérfano que bloquea para siempre, o dos corridas que se pisan creyendo
 * cada una que la otra murió. Se distinguen por si el PID que escribió el candado SIGUE
 * VIVO (`process.kill(pid, 0)`).
 *
 * EL LADO SEGURO DE LA DUDA ES «ESTÁ VIVO», y lo decide la ASIMETRÍA DEL ERROR, no la
 * probabilidad. `process.kill(pid, 0)` tira `ESRCH` cuando el proceso no existe y `EPERM`
 * cuando existe pero es de otro usuario; y en una máquina de mucho uptime un PID muerto
 * puede haberse REUSADO, así que ni siquiera «vivo» prueba que sea nuestra corrida. Por
 * eso SOLO `ESRCH` cuenta como muerto: `EPERM`, cualquier otro errno y un candado que no
 * parsea se tratan como corrida VIVA y el arnés se niega a arrancar. Un falso «está vivo»
 * cuesta una corrida que no arranca y un mensaje que dice exactamente qué mirar y qué
 * borrar — recuperable a mano. Un falso «está muerto» hace que dos corridas se pisen, o
 * que una repare encima de otra que está a mitad de mutar, que es EL defecto que el
 * candado existe para impedir.
 *
 * El candado vive en el directorio temporal del sistema y no adentro del paquete: un
 * archivo suelto en `scripts/` habría que ignorarlo en git, y un candado versionado por
 * accidente es peor que no tenerlo. La clave es la ruta del paquete, que es lo que
 * identifica al árbol que se está mutando.
 */
const CANDADO = join(tmpdir(), `savia-mutants-${Buffer.from(RAIZ).toString("base64url")}.lock`);
const PARCIAL = `${CANDADO}.${process.pid}.parcial`;

/** Sólo `ESRCH` prueba que no está. Todo lo demás cae del lado de «vivo» — ver arriba. */
const vivo = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code !== "ESRCH";
  }
};

const DIARIO = { pid: process.pid, desde: new Date().toISOString(), originales: {} };

/**
 * El diario se escribe ENTERO en un archivo aparte y se RENOMBRA encima. Un `SIGKILL` en
 * la mitad de un `writeFileSync` dejaría un diario truncado —el único estado del que YA NO
 * SE PUEDE reparar, porque no se sabe qué falta devolver—, y `rename` sobre el mismo
 * filesystem es atómico: el candado es siempre o el de antes o el de después.
 */
const volcar = () => {
  writeFileSync(PARCIAL, JSON.stringify(DIARIO), "utf8");
  renameSync(PARCIAL, CANDADO);
};

/**
 * Toma el candado, o devuelve el texto del que ya está. `wx` CREA-O-FALLA en UNA sola
 * llamada al sistema: con `existsSync` y después `writeFileSync` hay una ventana entre las
 * dos en la que dos corridas ven el candado libre y las dos lo escriben. Reintenta una vez
 * si el candado desaparece entre el `wx` y la lectura — eso es una corrida ajena que acaba
 * de terminar, no un huérfano.
 */
const tomar = () => {
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      writeFileSync(CANDADO, JSON.stringify(DIARIO), { encoding: "utf8", flag: "wx" });
      return null;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    try {
      return readFileSync(CANDADO, "utf8");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  return "";
};

{
  let previo = tomar();
  if (previo !== null) {
    let ajeno = null;
    try {
      const leído = JSON.parse(previo);
      if (leído !== null && typeof leído === "object" && Number.isInteger(leído.pid)) ajeno = leído;
    } catch {
      ajeno = null;
    }

    if (ajeno === null || vivo(ajeno.pid)) {
      console.error(
        `EMISSION-ERR: hay otro candado de mutantes en este árbol y NO se puede dar por muerto.\n` +
          `  candado: ${CANDADO}\n` +
          `  ${ajeno === null ? "no parsea: no dice de quién es ni qué habría que devolver" : `lo tiene el pid ${ajeno.pid}, y ese pid sigue vivo`}\n` +
          `  Este arnés muta el árbol EN EL LUGAR: dos corridas a la vez se pisan y dejan mutaciones\n` +
          `  pegadas. La duda cae del lado de «está vivo» a propósito: negarse a correr se arregla a\n` +
          `  mano, pisarse no. Si estás seguro de que no hay ninguna corriendo, mirá \`git diff\` y\n` +
          `  borrá el archivo.`,
      );
      process.exit(1);
    }

    // HUÉRFANO: el pid está muerto y lo que dejó anotado es exactamente lo que falta
    // devolver. Se restaura ANTES de tomar el candado, y el orden importa poco porque
    // reparar es IDEMPOTENTE: si esto se muere en la mitad, el diario sigue en disco y la
    // corrida siguiente vuelve a escribir los mismos bytes.
    const pendientes = Object.entries(ajeno.originales ?? {});
    for (const [archivo, texto] of pendientes) writeFileSync(ruta(archivo), texto, "utf8");
    rmSync(CANDADO, { force: true });
    previo = tomar();
    if (previo !== null) {
      console.error(
        `EMISSION-ERR: reparé el candado huérfano del pid ${ajeno.pid} y otra corrida se lo llevó\n` +
          `  antes que yo. No sigo: dos corridas a la vez se pisan.`,
      );
      process.exit(1);
    }
    console.error(
      pendientes.length === 0
        ? `EMISSION-AVISO: había un candado HUÉRFANO (pid ${ajeno.pid}, muerto) sin nada pendiente. Lo tomé y sigo.`
        : `EMISSION-AVISO: había un candado HUÉRFANO (pid ${ajeno.pid}, muerto) con ${pendientes.length} archivo(s) sin restaurar.\n` +
            `  Los devolví antes de arrancar — la corrida anterior murió sin poder hacerlo, que es para lo\n` +
            `  que el original va al candado ANTES de mutar:\n` +
            pendientes.map(([a]) => `    ${a}`).join("\n"),
    );
  }
}

const soltar = () => {
  rmSync(CANDADO, { force: true });
  rmSync(PARCIAL, { force: true });
};

/**
 * LO QUE HAY QUE DEVOLVER SI EL PROCESO MUERE, en los DOS lugares donde vive.
 *
 * `ORIGINALES` es el mapa en memoria y `DIARIO.originales` su copia en disco: las dos se
 * escriben en `apuntar()` —ANTES de mutar— y las dos se vacían en `restaurar()`. El
 * handler de `exit` cubre lo que el `finally` de la vuelta NO cubre (la señal), y node lo
 * corre también en el camino de `process.exit()`; es síncrono, igual que `writeFileSync`.
 * El diario cubre lo que NINGÚN handler cubre: `SIGKILL`.
 *
 * EL ORDEN DE `restaurar()` NO ES CASUAL: primero los archivos, DESPUÉS el diario. Si se
 * muere en el medio, el diario todavía nombra archivos que ya volvieron y la corrida
 * siguiente les escribe los mismos bytes, que es inofensivo. Al revés, la ventana dejaría
 * archivos mutados que ya nadie sabe deshacer.
 */
const ORIGINALES = new Map();
const apuntar = (archivo, texto) => {
  if (ORIGINALES.has(archivo)) return;
  ORIGINALES.set(archivo, texto);
  DIARIO.originales[archivo] = texto;
  volcar();
};
const restaurar = () => {
  if (ORIGINALES.size === 0) return;
  for (const [archivo, texto] of ORIGINALES) writeFileSync(ruta(archivo), texto, "utf8");
  ORIGINALES.clear();
  DIARIO.originales = {};
  volcar();
};
process.on("exit", () => {
  restaurar();
  soltar();
});
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
  try {
    for (const [buscar, reemplazar] of m.cambios) {
      const archivo = m.archivo ?? ubicar(buscar);
      const antes = readFileSync(ruta(archivo), "utf8");
      soloUno(antes, buscar, m.id);
      apuntar(archivo, antes);
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
    // Pase lo que pase, el árbol vuelve. Sin esto un crash deja el repo mutado — y el
    // handler de `exit` de arriba cubre el caso que este `finally` NO cubre: la señal.
    // El que NINGUNO de los dos cubre —`SIGKILL`— lo cubre el diario, en disco.
    restaurar();
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
