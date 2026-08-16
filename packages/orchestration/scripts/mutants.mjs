#!/usr/bin/env node
// Acredita cada garantía del paquete ROMPIÉNDOLA, y falla si alguna deja de romperse.
//
//   node scripts/mutants.mjs           todas las mutaciones
//   node scripts/mutants.mjs S39       una sola, para iterar
//
// MISMO DISEÑO QUE LOS TRES CORREDORES ANTERIORES, con el campo `rompe` que `adapters`
// estrenó: acá tampoco la respuesta es «el build». Una orquestación es pegamento, y su
// modo de falla característico no es que no compile: es que pega mal y la salida sale
// distinta sin que nada se ponga rojo.
//
// LA NUMERACIÓN VIENE DEL PLAN DEL PASO 3. S39 y S40 son las dos filas que el plan
// asignaba a este paquete; S58 en adelante son de este paso, y cada una dice por qué
// existe. Las que faltan viven en `emission` (S1–S16) y en `adapters` (S17–S38, S41–S57).

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = (r) => resolve(RAIZ, r);

/**
 * Cada fila es una garantía y la forma exacta de romperla.
 *
 * - `cambios`: pares [buscar, reemplazar]. `buscar` tiene que aparecer EXACTAMENTE UNA
 *   VEZ en EXACTAMENTE UN archivo de `ARCHIVOS`. Cero o dos es un ERROR, no un salteo.
 * - `espera`: un regex sobre la salida. Que falle no alcanza — tiene que fallar POR LA
 *   RAZÓN correcta.
 * - `rompe`: qué SALIDA se mueve.
 * - `control`: no rompe nada y tiene que quedar VERDE.
 */
const MUTANTES = [
  // ── La orquestación ────────────────────────────────────────────────────────
  {
    id: "S39",
    garantía: "el tamaño objetivo lo PROVEE el llamador (`Pending` en `params.ts`)",
    rompe: "toda frontera de fragmento del corpus",
    cambios: [[
      `  const grouped = group(emission.nodes, options.targetSizeChars);`,
      `  const grouped = group(emission.nodes, 300);`,
    ]],
    espera: /I1 · golden bytes→árbol/,
    nota:
      "`PARAMETERS.grouping.targetSizeChars` está en `null` con su plan de medición escrito, y el tipo " +
      "obliga a que quien lo necesite lo provea. Un literal en la orquestación es exactamente «un " +
      "número inventado con precisión falsa», que el plan declara peor que uno pendiente. El 300 no es " +
      "al azar: es el ÚNICO orden de magnitud que el plan da, y lo da EN TOKENS y EN LA SECCIÓN DEL " +
      "TRAMO 6 — ni la unidad ni el tramo son los de este parámetro, que es exactamente cómo un número " +
      "inventado entra por la ventana",
  },
  {
    id: "S40",
    garantía: "el detalle de un aviso viaja hasta el sumidero",
    rompe: "el diagnóstico: los avisos llegan sin decir qué pasó ni dónde",
    cambios: [[
      `void notices.push({ code, location, detail: detail ?? null })`,
      `void notices.push({ code, location, detail: detail === undefined ? null : null })`,
    ]],
    espera: /I1 · golden bytes→árbol/,
    nota:
      "de los dos métodos de `Diagnostics` dependen el estado `partial`, la métrica de degradación y el " +
      "invariante «ninguna información se descarta en silencio», y los dos devuelven `void`: lo único " +
      "que los hace verificables es que el sumidero esté tipado y snapshotado. ACREDITACIÓN POR " +
      "CASUALIDAD CERRADA: el reemplazo conserva `detail` EN USO — con `detail: null` a secas el " +
      "parámetro queda sin leer y el mutante muere en TS6133",
  },
  {
    id: "S71",
    garantía: "el ÁRBOL viaja en la salida, no solo los fragmentos",
    rompe: "el golden entero — y con él las seis filas que dependen de que sea bytes→ÁRBOL",
    cambios: [[`    nodes: emission.nodes,`, `    nodes: [],`]],
    espera: /I1 · golden bytes→árbol/,
    nota:
      "ES LA FILA QUE JUSTIFICA LA FORMA DEL GOLDEN. El plan pide «bytes → árbol» y la primera versión " +
      "del guardián del prototipo snapshotaba solo los fragmentos: `mime`, `language`, `marks`, `href` " +
      "y `attribution` NO SE RENDERIZAN, así que no aparecen en `Fragment.text` y una mutación sobre " +
      "cualquiera de ellos pasaba en verde. Y el árbol no es un extra del guardián: es lo que el " +
      "reconciliador del paso 11 consume",
  },
  {
    id: "S66",
    garantía: "`null` de `select` es un resultado LEGÍTIMO, no un error disfrazado",
    rompe: "la disponibilidad: un archivo que nadie sabe leer rompe el pipeline en vez de quedar en espera",
    // EL ANCLA SE REANCLÓ EN EL PASO 4 y el motivo va escrito: la rama ganó el aviso de
    // `intake.on_hold` y el campo `onHold`, así que el bloque entero dejó de existir tal
    // como estaba y `ubicar()` rechazó la fila. Ahora muta SOLO el `return`, que es lo que
    // esta garantía toca: el aviso lo acredita S82 y la sonda fría S81, por separado.
    cambios: [[
      `    return { ...EMPTY, sink, achievedLevel: "plain_text", adapter: null, onHold: cold };\n  }`,
      `    throw new Error("ORCHESTRATION-ERR: no adapter claimed these bytes");\n  }`,
    ]],
    espera: /I5 · sin adaptador, la ingesta no lanza/,
    nota:
      "«el fallo nunca es asignable al éxito» tiene una contracara que se olvida: no todo lo que no es " +
      "éxito es un fallo. `select` devuelve `Selection | null` y el `null` significa «todavía nadie " +
      "sabe leer esto» — un estado que se REINTENTA el día que llega un adaptador nuevo. Convertirlo en " +
      "excepción obliga a capturar en cada llamador y borra la diferencia entre «en espera» y «roto»",
  },
  {
    id: "S67",
    garantía: "una emisión que falla se REPORTA",
    rompe: "el diagnóstico: una falla estructural sale igual que un documento vacío",
    cambios: [[
      `    ctx.diagnostics.notice(\n      "emission.failed",\n      null,\n      \`\${emission.failure.kind} at position \${emission.failure.position}\`,\n    );`,
      `    void emission.failure;`,
    ]],
    espera: /I6 · una emisión que falla se reporta/,
    nota:
      "el emisor corta con un OBJETO de error y no con una excepción, y esa decisión solo vale si " +
      "alguien lo convierte en un aviso. El `.md` no puede producir esta falla —sus contenedores " +
      "siempre se declaran antes que sus ítems—, así que el guardián la fuerza con un adaptador " +
      "SINTÉTICO que emite una pista colgante: sin él la rama es código muerto y esta fila no existiría",
  },
  {
    id: "S69",
    garantía: "`materialize` RECHAZA: la delegación de este paso es de profundidad cero",
    rompe: "la precondición de terminación, que pasa de ser un hecho a ser una convención",
    cambios: [[
      `      Promise.reject(new Error("ORCHESTRATION-ERR: step 3 does not materialize bytes")),`,
      `      Promise.resolve(_bytes as unknown as ObjectRef),`,
    ]],
    espera: /I7 · `materialize` rechaza en el paso 3/,
    nota:
      "«no llamar a `materialize` es lo que hace cumplir la precondición de terminación». El plan pide " +
      "casos de delegación con profundidad 0, 1 y ciclo; los dos últimos NO son ejercitables acá —un " +
      "`.md` referencia sus imágenes por URL y nunca trae bytes incrustados, y el bucle de delegación " +
      "es el paso 6— y decir «profundidad 0» no alcanza. Esta fila convierte el cero en un estado " +
      "IMPUESTO: el día que el paso 6 lo implemente, esta línea es el sitio exacto que hay que cambiar",
  },
  {
    id: "S72",
    garantía: "el contexto raíz arranca en profundidad cero",
    rompe: "la guarda de ciclo del paso 6, que empezaría a contar desde un número que nadie eligió",
    cambios: [[`    depth: ZERO,`, `    depth: ZERO + 1,`]],
    espera: /I7 · la profundidad de este paso es cero/,
    nota:
      "«el `Context` de un asset delegado es un HIJO del de su contenedor, no uno nuevo», así que la " +
      "profundidad y la cadena de ancestros del raíz son el punto de partida de toda la recursión. El " +
      "error es de los que no se ven hasta que hay recursión, o sea tres pasos más tarde",
  },
  {
    id: "S70",
    garantía: "la autoría que se estampa es la que pidió el llamador",
    rompe: "la atribución: todo documento aparece subido por la misma persona",
    cambios: [[`        actor: asActorId(options.actor),`, `        actor: asActorId("usuario-sintetico"),`]],
    espera: /I9 · …y la autoría sí viaja con el nodo/,
    nota:
      "es la mitad que impide que «la autoría no entra en la huella» lo cumpla una autoría que no " +
      "existe. Las dos direcciones hacen falta o el invariante lo satisface borrar el campo. El " +
      "reemplazo usa el mismo actor que la corrida del golden a propósito: así el golden NO se mueve y " +
      "la fila la acredita el invariante que le corresponde y no un snapshot que cambió de color",
  },

  // ── Paso 4 · el piso de texto, de punta a punta ────────────────────────────
  {
    id: "S81",
    garantía: "lo que queda en espera lleva CON QUÉ reintentarlo",
    rompe: "el reprocesamiento: el día que llegue el adaptador hay que barrer el corpus entero",
    cambios: [[
      `    return { ...EMPTY, sink, achievedLevel: "plain_text", adapter: null, onHold: cold };`,
      `    return { ...EMPTY, sink, achievedLevel: "plain_text", adapter: null, onHold: null };`,
    ]],
    espera: /I11 · lo que queda en espera lleva con qué reintentarlo/,
    nota:
      "`on_hold` NO es «rechazado»: es «todavía no lo soportamos», y esa promesa solo es cumplible si " +
      "queda escrito QUÉ estaba esperando. El plan describe el barrido como «se corre solo su " +
      "`evidencia()` contra las sondas guardadas — se recorre una tabla chica, NO SE LEEN ARCHIVOS» " +
      "(§{Lo que queda}), y sin la sonda fría esa afirmación de costo es falsa. La mutación no rompe " +
      "NADA MÁS: la corrida sale igual de vacía, el aviso sigue estando y el golden no se mueve, " +
      "porque el `.md` nunca queda en espera",
  },
  {
    id: "S82",
    garantía: "el rechazo a indexar se AVISA",
    rompe: "el diagnóstico: un formato sin soporte sale idéntico a un documento del que no se sacó nada",
    cambios: [[
      `    ctx.diagnostics.notice(\n      "intake.on_hold",`,
      `    void ((code: string, location: null, detail: string) => [code, location, detail])(\n      "intake.on_hold",`,
    ]],
    espera: /I11 · el rechazo a indexar se AVISA/,
    nota:
      "hasta el paso 4 esta rama devolvía la corrida vacía SIN UN SOLO AVISO, así que «ninguna " +
      "información se descarta en silencio» la cumplía por no haber nada escrito. Rechazar es " +
      "información útil —«todavía no soportamos esto», que además es lo que arma el roadmap de qué " +
      "formatos pedir— y rechazar callado es daño mudo. El reemplazo CONSUME los tres argumentos a " +
      "propósito: borrar la llamada dejaría `cold` sin usar en esa rama y el mutante moriría en el " +
      "compilador",
  },
  {
    id: "S83",
    garantía: "el nivel alcanzado del piso llega HASTA LA SALIDA",
    rompe: "la degradación deja de ser visible: el `.conf` se recupera igual que el `.md`",
    cambios: [[
      `    achievedLevel: selection.achievedLevel,\n    adapter: selection.adapter.id,\n    onHold: null,`,
      `    achievedLevel: "structured",\n    adapter: selection.adapter.id,\n    onHold: null,`,
    ]],
    espera: /I10 · …y DICE que entró degradado/,
    nota:
      "NO ES S30 DE `adapters` OTRA VEZ: aquella fija que `select` DERIVE el nivel de `evidence > " +
      "Floor`, y esta que la orquestación lo PROPAGUE. Son dos sitios y el segundo no lo cubría nadie. " +
      "El reemplazo es `\"structured\"` a propósito, que es el valor que el `.md` ya tiene: el golden NO " +
      "se mueve y la fila la acredita el invariante que le corresponde, no un snapshot que cambió de " +
      "color. Un archivo degradado que se recupera exactamente igual que uno completo es el defecto: " +
      "quien consume la memoria no puede saber que lo que lee perdió su estructura",
  },
  {
    id: "S84",
    garantía: "«en espera» y «leído» no se confunden",
    rompe: "el barrido futuro: documentos ya indexados vuelven a la cola que ningún adaptador va a arreglar",
    cambios: [[
      `    achievedLevel: selection.achievedLevel,\n    adapter: selection.adapter.id,\n    onHold: null,\n  };\n};`,
      `    achievedLevel: selection.achievedLevel,\n    adapter: selection.adapter.id,\n    onHold: cold,\n  };\n};`,
    ]],
    espera: /I1 · golden bytes→árbol/,
    nota:
      "el par de S81, y va al revés: aquella BORRA la sonda de un documento en espera, esta se la pone " +
      "a uno que se indexó perfecto. Son dos estados con destinos distintos —uno se reintenta cuando " +
      "llega un adaptador nuevo, el otro no— y confundirlos hace crecer la cola con documentos que ya " +
      "están en el índice. Es la única fila del bloque que muta el golden, y por eso es la única que lo " +
      "espera: el campo `enEspera` está en el snapshot justamente para que borrarlo o llenarlo de más " +
      "sea un acto visible",
  },

  // ── R2, el borde de dependencias y la composición ──────────────────────────
  {
    id: "S61",
    garantía: "R2 — aguas abajo se LEE `role`, nunca se RAMIFICA sobre él",
    rompe: "la regla que impide que la semántica del formato se re-derive en cada tramo",
    cambios: [[
      `  const emission = emit(nodes, options.sha256);`,
      `  const emission = emit(nodes.filter((n) => n.role !== "page_footer"), options.sha256);`,
    ]],
    espera: /R2 · src\/ingest\.ts nombra un literal de `role`/,
    nota:
      "EL GUARDIÁN QUE EL PASO 3 DEBÍA TRAER Y QUE NO EXISTÍA EN NINGÚN PAQUETE. El plan lista R2 como " +
      "«lint sobre el núcleo, detectable estáticamente» y nadie la imponía: un `switch (n.role)` acá " +
      "compilaba. La mutación es la PLAUSIBLE y no la absurda —filtrar el mobiliario de página suena " +
      "razonable— y es exactamente cómo la deriva empieza: el día que un consumidor escribe el nombre " +
      "de un rol, agregar el rol dieciséis pasa a ser una búsqueda por todo el repo. El vocabulario del " +
      "guardián se DERIVA de `ROLES` en `ir`, así que un rol nuevo queda cubierto sin tocar nada",
  },
  {
    id: "S62",
    garantía: "cero dependencias de runtime: ni un `node:`",
    rompe: "el borde de dependencias, que deja de coincidir con el borde de formato",
    cambios: [[
      `import { group, emit } from "@savia-os/emission";`,
      `import { createHash } from "node:crypto";\nexport const _sha = createHash;\nimport { group, emit } from "@savia-os/emission";`,
    ]],
    espera: /src\/ingest\.ts importa `node:crypto`/,
    nota:
      "`node:crypto` SÍ resuelve, así que `tsc` lo acepta sin una palabra y el paquete queda con una " +
      "dependencia de runtime EN VERDE. `sha256` entra por parámetro exactamente para que eso no pase " +
      "—la misma disciplina que `emit`—, y hasta este guardián nada lo impedía. El `export const _sha` " +
      "mantiene el import en uso: sin él, TS6133 mataría la corrida y la fila la acreditaría el linter",
  },
  {
    id: "S63",
    garantía: "…y tampoco un GLOBAL de node",
    rompe: "la lista blanca de imports, que sigue diciendo la verdad mientras el paquete ya usa node",
    cambios: [[
      `  const source = sourceOfBytes(bytes);`,
      `  const source = sourceOfBytes(Buffer.from(bytes));`,
    ]],
    espera: /usa el global de node `Buffer`/,
    nota:
      "es la mitad del borde que un barrido de IMPORTS nunca puede cubrir: `Buffer` no es un import. Es " +
      "también la razón por la que ni este paquete ni `adapters` traen `@types/node` — con esos tipos " +
      "en alcance, `src/` puede usar node sin escribir un solo `import`",
  },
  {
    id: "S65",
    garantía: "la orquestación COMPONE los dos lados, y por eso la frontera no es vacía",
    rompe: "la prueba entera de R1 — sin que ninguna otra fila se ponga roja",
    cambios: [[
      `} from "@savia-os/adapters";`,
      `} from "@savia-os/ir";`,
    ]],
    espera: /la orquestación dejó de componer los dos lados/,
    nota:
      "ES LA FILA MÁS SUTIL DEL PASO. «`adapters` y `emission` nunca se ven entre sí» se puede cumplir " +
      "por VACÍO —nadie los usa— y eso fue literalmente cierto hasta el paso 3: `emission` se escribió " +
      "entero con nodos sintéticos. Lo que convierte la frase en una afirmación es que alguien los " +
      "COMPONGA. Si este paquete deja de importar uno de los dos, las cuatro fronteras nombradas siguen " +
      "verdes sobre un pipeline que ya no existe",
  },
  {
    id: "S64",
    garantía: "el grafo DECLARADO coincide con el usado: `dependencies` son exactamente los tres",
    rompe: "nada visible hoy — y ese es el punto: las tres filas de arriba se satisfacen agregando la dependencia",
    cambios: [[
      `    "@savia-os/ir": "workspace:*"\n  },`,
      `    "@savia-os/ir": "workspace:*",\n    "typescript": "^5.9.3"\n  },`,
    ]],
    espera: /`dependencies` no es exactamente los tres/,
    nota:
      "sin esta mitad, S62 se satisface agregando la dependencia y el import EL MISMO DÍA — y el que lo " +
      "hace está siguiendo al pie de la letra lo que le dijo «Cannot find module». Lo que de verdad " +
      "impone el grafo es `package.json`, y este es el único chequeo que lo mira",
  },

  // ── La cadena y el golden ──────────────────────────────────────────────────
  {
    id: "S58",
    garantía: "ningún guardián queda fuera de `lint`",
    rompe: "nada visible — y ese es el punto: la garantía deja de verificarse sin que nada cambie de color",
    cambios: [[
      `&& node scripts/invariants.mjs && node scripts/citations.mjs && node scripts/mutants.mjs",`,
      `&& node scripts/invariants.mjs && node scripts/mutants.mjs",`,
    ]],
    espera: /guardian left out of `lint`/,
    nota:
      "la única falla que ningún otro chequeo puede ver, porque para verla hay que mirar el " +
      "`package.json` y no la salida. Saca `citations.mjs` y no `boundaries.mjs` a propósito: el que " +
      "chequea es `boundaries.mjs`, y sacarlo a él sacaría también al testigo",
  },
  {
    id: "S59",
    garantía: "`build` NO puede encadenar el corredor de mutación",
    rompe: "el árbol de trabajo: turbo corre `lint` y `build` en paralelo y quedan mutaciones pegadas",
    cambios: [[
      `&& node scripts/invariants.mjs && node scripts/citations.mjs"`,
      `&& node scripts/invariants.mjs && node scripts/citations.mjs && node scripts/mutants.mjs"`,
    ]],
    espera: /`build` chains the mutation runner/,
    nota:
      "la mitad de adelante de S58, y va al revés: acá el mutante AGREGA. Pasó de verdad en `ir` —dejó " +
      "ocho archivos de `src/` con mutaciones pegadas— y la regla de fondo es más simple que la " +
      "carrera: un build no muta su fuente",
  },
  {
    id: "S60",
    garantía: "el golden de la espina no se puede editar para que el código pase",
    rompe: "la única comparación contra algo externo al código",
    cambios: [[`      "role": "ordered_list",`, `      "role": "list",`]],
    espera: /I1 · golden bytes→árbol/,
    nota:
      "los otros ocho invariantes verifican que la salida sea coherente CONSIGO MISMA, y una salida " +
      "puede ser perfectamente coherente y ser el árbol equivocado. Es la razón por la que este paso NO " +
      "trae un runner con snapshots: un golden que se regenera con una tecla es el modo de falla que " +
      "esta fila existe para impedir",
  },

  {
    id: "S73",
    garantía: "`lint` se ordena por el grafo de paquetes, no solo `build`",
    rompe: "los invariantes de este paquete, que se ponen rojos SOBRE UN ÁRBOL SANO",
    cambios: [[`      "dependsOn": ["^build", "^lint"]`, `      "dependsOn": ["^build"]`]],
    espera: /`lint` no se ordena por el grafo de paquetes/,
    nota:
      "HALLAZGO MEDIDO EN ESTE PASO, y es la mitad que I11b de `emission` no cubría. Aquella fija que " +
      "`build` no encadene el corredor de mutación, porque `lint` y `build` DEL MISMO paquete corren en " +
      "paralelo. Acá son dos paquetes: los guardianes de `orchestration` COMPILAN el `src/` de " +
      "`adapters` —es el único paquete que lee el `src/` de otro— y el corredor de `adapters` lo muta " +
      "en el lugar. Se reprodujo: `turbo lint` sobre los dos filtros dio cinco invariantes rojos de " +
      "`orchestration` con la mutación de S17 puesta, sobre un árbol sano. El candado de exclusión " +
      "mutua no lo cubre: protege dos corridas sobre el MISMO árbol y acá son dos distintos. La fila " +
      "muta un archivo de la RAÍZ y no del paquete, y eso es deliberado — el hecho es del repo y el " +
      "único que puede acreditarlo es el que lo sufre",
  },

  // ── Controles ──────────────────────────────────────────────────────────────
  {
    id: "SC13",
    control: true,
    garantía: "un comentario nuevo no rompe nada",
    cambios: [[
      `const NEVER_ABORTED: CancellationSignal = { aborted: false };`,
      `// control SC13: comentario inocuo\nconst NEVER_ABORTED: CancellationSignal = { aborted: false };`,
    ]],
  },
  {
    id: "SC14",
    control: true,
    garantía: "renombrar una variable local del sumidero no cambia nada",
    cambios: [[`  const notices: Notice[] = [];`, `  const avisos: Notice[] = [];\n  const notices = avisos;`]],
    nota: "el par de S40: lo que esa fila fija es QUÉ llega al sumidero, no cómo se llama el arreglo",
  },
  {
    id: "SC15",
    control: true,
    garantía: "editar el `description` de `package.json` no rompe nada",
    cambios: [[
      `  "description": "La orquestación mínima del paso 3:`,
      `  "description": "control SC15 · la orquestación mínima del paso 3:`,
    ]],
    nota:
      "el par de S58, S59 y S64: los tres leen `package.json` y lo que fijan son las CADENAS y las " +
      "`dependencies`, no el archivo entero",
  },
  {
    id: "SC16",
    control: true,
    garantía: "reordenar dos exports del barril no rompe nada",
    cambios: [[`  type IngestOptions,\n  type Run,`, `  type Run,\n  type IngestOptions,`]],
    nota: "el barril es una lista, no un contrato de orden",
  },
  {
    id: "SC20",
    control: true,
    garantía: "cambiar el TEXTO del aviso de `on_hold` no rompe nada, pero su CÓDIGO sí",
    cambios: [[
      `      \`no adapter claimed these bytes: extension \${JSON.stringify(cold.extension)}, \` +`,
      `      \`nobody claimed these bytes: extension \${JSON.stringify(cold.extension)}, \` +`,
    ]],
    nota:
      "el par de S82, y separa las dos mitades que un aviso tiene. Lo que el invariante fija es el " +
      "CÓDIGO —`intake.on_hold`, que es lo que una consulta agrupa— y no la prosa del detalle, que es " +
      "para un humano. Sin este control, S82 sería indistinguible de un chequeo que congela el mensaje, " +
      "y congelar el mensaje es la forma más rápida de que nadie lo mejore",
  },
  {
    id: "SC17",
    control: true,
    garantía: "editar la prosa de un docstring no rompe nada",
    cambios: [[`Sin HTTP, sin base, sin cola.`, `Sin HTTP, sin base y sin cola (control SC17).`]],
    nota:
      "el par de S39 y S71: el docstring viaja al guardián de citas y no a ninguna comparación de " +
      "salida. Sin el control, un guardián demasiado sensible sería indistinguible de uno que verifica " +
      "lo que dice",
  },
];

// Dónde vive cada mutación se deduce de su primer `buscar`. `package.json` entra porque
// lo que S58, S59 y S64 verifican NO está en `src/`. El golden entra porque S60 lo muta.
// Los dos guardianes entran SIN alojar ninguna mutación: sostienen la unicidad de las
// anclas —si un texto a mutar aparece también en un guardián, `ubicar` falla en vez de
// mutar el archivo equivocado— y de paso dejan verificado que la lista no se corrió.
const ARCHIVOS = [
  "src/ingest.ts",
  "src/index.ts",
  "package.json",
  "corpus/manual.golden.json",
  "scripts/boundaries.mjs",
  "scripts/invariants.mjs",
  // El único archivo de la RAÍZ que un corredor de mutación toca en todo el repo, y va
  // con su razón: el orden entre `lint` y `lint` es un hecho del monorepo, no del
  // paquete, y el único que lo puede acreditar es el que lo sufre (S73). El arnés lo
  // restaura como a cualquier otro.
  "../../turbo.json",
];

// LA CADENA NO SE ESCRIBE ACÁ: SE LEE DE `package.json`. Escribirla a mano la deja
// derivar de la que corre `pnpm lint` —el arnés acreditaría una cadena que nadie
// ejecuta— y el paquete tendría DOS listas de guardianes que pueden discrepar en
// silencio. Se le quita este propio script porque el arnés no puede correrse a sí mismo
// adentro de cada mutación.
const PKG = JSON.parse(readFileSync(ruta("package.json"), "utf8"));
const CADENA = (PKG.scripts?.lint ?? "")
  .split("&&")
  .map((t) => t.trim())
  .filter((t) => t !== "" && !t.endsWith("scripts/mutants.mjs"))
  .join(" && ");
if (!CADENA.includes("scripts/")) {
  console.error(
    `ORCHESTRATION-ERR: el \`lint\` de package.json no nombra ningún guardián además de este arnés.\n` +
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
      `${id}: el texto a mutar aparece ${n} veces (esperaba 1). El mutante se pudrió con una ` +
        `edición anterior — arreglalo, no lo saltees: un mutante obsoleto es una garantía que ` +
        `dejó de verificarse.\n  «${buscar.slice(0, 70).replace(/\n/g, "⏎")}»`,
    );
  }
};

// ── Corrida ──────────────────────────────────────────────────────────────────
const soloEste = process.argv[2];
const lista = soloEste ? MUTANTES.filter((m) => m.id === soloEste) : MUTANTES;
if (soloEste && lista.length === 0) {
  console.error(`ORCHESTRATION-ERR: no existe el mutante «${soloEste}»`);
  process.exit(1);
}

// ── Exclusión mutua ──────────────────────────────────────────────────────────
// ESTE ARNÉS MUTA EL ÁRBOL DE TRABAJO EN EL LUGAR: dos corridas a la vez se pisan y al
// restaurar dejan la mutación puesta. Falla en vez de esperar — un arnés que espera
// parece colgado. El candado vive en el temporal del sistema: un archivo suelto en
// `scripts/` habría que ignorarlo en git, y uno versionado por accidente es peor que no
// tenerlo.
const CANDADO = join(tmpdir(), `savia-mutants-${Buffer.from(RAIZ).toString("base64url")}.lock`);
if (existsSync(CANDADO)) {
  console.error(
    `ORCHESTRATION-ERR: ya hay otra corrida de mutantes en este árbol (${CANDADO}).\n` +
      `  Este arnés muta \`src/\` en el lugar: dos a la vez se pisan y dejan mutaciones pegadas.\n` +
      `  Si estás seguro de que no hay ninguna corriendo, borrá el archivo.`,
  );
  process.exit(1);
}
writeFileSync(CANDADO, `${process.pid}\n`, "utf8");
const soltar = () => rmSync(CANDADO, { force: true });

/**
 * LO QUE HAY QUE DEVOLVER SI EL PROCESO MUERE, y por qué no alcanza con el `finally` de
 * la vuelta.
 *
 * SE MIDIÓ EN ESTE PASO. `turbo` MATA las tareas concurrentes cuando otra falla, y un
 * `SIGTERM` no ejecuta el `finally` del bucle: la corrida se cortó con la mutación de
 * `S18` puesta y dejó `src/markdown.ts` con `role: "heading"` pegado. El síntoma en la
 * corrida siguiente fue «el árbol NO está verde antes de mutar», que es el mensaje
 * correcto — pero recién en la corrida SIGUIENTE, y con el árbol de trabajo sucio en el
 * medio. El mapa vive afuera del bucle y se vacía en el handler de `exit`, que node sí
 * corre en el camino de `process.exit()` y que es síncrono, igual que `writeFileSync`.
 */
const ORIGINALES = new Map();
const restaurar = () => {
  for (const [archivo, texto] of ORIGINALES) writeFileSync(ruta(archivo), texto, "utf8");
  ORIGINALES.clear();
};
process.on("exit", () => {
  restaurar();
  soltar();
});
for (const señal of ["SIGINT", "SIGTERM"]) process.on(señal, () => process.exit(1));

const base = guardianes();
if (!base.verde) {
  console.error(
    `ORCHESTRATION-ERR: el árbol NO está verde antes de mutar. Nada de lo que sigue significaría nada.\n` +
      base.salida.split("\n").slice(0, 12).map((l) => "  " + l).join("\n"),
  );
  process.exit(1);
}

let fallos = 0;
for (const m of lista) {
  try {
    for (const [buscar, reemplazar] of m.cambios) {
      const archivo = ubicar(buscar);
      const antes = readFileSync(ruta(archivo), "utf8");
      if (!ORIGINALES.has(archivo)) ORIGINALES.set(archivo, antes);
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
      if (m.rompe) console.log(`         rompe: ${m.rompe}`);
      if (m.nota) console.log(`         nota: ${m.nota}`);
      console.log(r.salida.split("\n").filter(Boolean).slice(0, 6).map((l) => "         │ " + l).join("\n"));
    }
  } catch (e) {
    fallos++;
    console.log(`  ✗ ${m.id.padEnd(6)} ${m.garantía}\n         ${e.message}`);
  } finally {
    // Pase lo que pase, el árbol vuelve. Sin esto un crash deja el repo mutado — y el
    // handler de `exit` de arriba cubre el caso que este `finally` NO cubre: la señal.
    restaurar();
  }
}

const cierre = guardianes();
if (!cierre.verde) {
  console.error(`\nORCHESTRATION-ERR: el árbol quedó ROTO después de restaurar. Revisá con git diff.`);
  process.exit(1);
}

const rompen = lista.filter((m) => !m.control).length;
console.log(
  fallos === 0
    ? `\nmutantes ok (${rompen} garantías acreditadas rompiéndolas, ${lista.length - rompen} controles verdes)`
    : `\nORCHESTRATION-ERR: ${fallos} de ${lista.length} mutantes fallaron`,
);
process.exit(fallos === 0 ? 0 : 1);
