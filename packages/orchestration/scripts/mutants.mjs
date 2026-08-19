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

/**
 * Cada fila es una garantía y la forma exacta de romperla.
 *
 * - `cambios`: pares [buscar, reemplazar]. `buscar` tiene que aparecer EXACTAMENTE UNA
 *   VEZ en EXACTAMENTE UN archivo de `ARCHIVOS`. Cero o dos es un ERROR, no un salteo.
 * - `espera`: un regex sobre la salida. Que falle no alcanza — tiene que fallar POR LA
 *   RAZÓN correcta.
 * - `rompe`: qué SALIDA se mueve.
 * - `control`: no rompe nada y tiene que quedar VERDE.
 * - `archivo`: opcional, y hoy lo llevan SOLO las filas `D…`, que mutan este mismo
 *   archivo. `scripts/mutants.mjs` NO PUEDE entrar en `ARCHIVOS`: contiene literalmente el
 *   `buscar` de todas las filas, así que `ubicar()` vería DOS archivos para cada una y la
 *   suite entera se pondría roja. Con el destino DICHO, la unicidad la sostiene
 *   `soloUno()` adentro del archivo, que es la mitad que importa cuando no hay a dónde
 *   equivocarse. Mutar el arnés en caliente es inofensivo —node ya lo tiene en memoria—:
 *   lo que cambia es lo que el guardián LEE DE DISCO, que es donde vive la garantía.
 */
const MUTANTES = [
  // ── La orquestación ────────────────────────────────────────────────────────
  {
    id: "S39",
    garantía: "el tamaño objetivo lo PROVEE el llamador (`Pending` en `params.ts`)",
    rompe: "toda frontera de fragmento del corpus",
    cambios: [[
      `  const grouped = group(reconciled.output.nodes, options.targetSizeChars);`,
      `  const grouped = group(reconciled.output.nodes, 300);`,
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
    cambios: [[`    nodes: reconciled.output.nodes,`, `    nodes: [],`]],
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
      `    return { onHold: cold };\n  }`,
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
  // ─── LÁPIDA · S69, retirada en el paso 7 ──────────────────────────────────
  // Decía «`materialize` RECHAZA: la delegación de este paso es de profundidad cero», y
  // era verdad mientras ningún formato trajera bytes propios: con `.md` las imágenes se
  // referencian por URL, así que no había a quién delegar y el rechazo incondicional
  // volvía esa profundidad un HECHO en vez de una convención.
  //
  // El paso 7 la superó de frente: el `.docx` sí trae bytes, `materialize` guarda
  // cuando hay almacenamiento, y la profundidad pasó a uno — que es lo que I17 e I18
  // verifican ahora. La garantía no se perdió, cambió de forma.
  //
  // Y LO QUE QUEDA DE ELLA NO NECESITA FILA: que `materialize` rechace SIN
  // almacenamiento lo impone el TIPO. Se le escribió el mutante —dar vuelta la guarda
  // `storage === null`— y murió con `TS18047: 'storage' is possibly 'null'`, o sea
  // acreditando al compilador. La violación es irrepresentable un peldaño más arriba,
  // que es donde este repo la quiere.
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
    cambios: [[`          actor: asActorId(intake.actor),`, `          actor: asActorId("usuario-sintetico"),`]],
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
      `      onHold: recognized.onHold,`,
      `      onHold: null,`,
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
      `    achievedLevel: grown.delegated ? "mixed" : selection.achievedLevel,`,
      `    achievedLevel: "structured",`,
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
    cambios: [[`      readonly onHold: null;`, `      readonly onHold: ColdProbe | null;`]],
    espera: /the read variant of Recognized can carry a cold probe again/,
    nota:
      "el par de S81, y va al revés: aquella BORRA la sonda de un documento en espera, esta se la pone " +
      "a uno que se indexó perfecto. Son dos estados con destinos distintos —uno se reintenta cuando " +
      "llega un adaptador nuevo, el otro no— y confundirlos hace crecer la cola con documentos que ya " +
      "están en el índice. LA GARANTÍA SUBIÓ DE PELDAÑO EN EL PASO 5 y la fila cambió con ella: hasta " +
      "acá mutaba la SALIDA y la esperaba el golden, y con `Recognized` partida en dos variantes esa " +
      "mutación dejó de compilar —se midió: `TS1117` por el campo duplicado y tres `TS2339` porque " +
      "ensanchar `onHold` rompe el discriminante—. Un mutante que muere en el compilador acredita al " +
      "compilador y no al contrato (la lección de M12c), así que ahora muta el TIPO y la espera " +
      "`RECOGNIZED_PROOFS`. Hacer inexpresable lo que antes se detectaba es el objetivo, no un efecto",
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
      `import {\n  group,\n  emit,\n  reconcile,\n  knownVersionOf,`,
      `import { createHash } from "node:crypto";\nexport const _sha = createHash;\nimport {\n  group,\n  emit,\n  reconcile,\n  knownVersionOf,`,
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
      `  const source = sourceOfBytes(intake.bytes, intake.object, intake.mime);`,
      `  const source = sourceOfBytes(Buffer.from(intake.bytes), intake.object, intake.mime);`,
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

  // ── Paso 5 · la cintura no tiene forma de documento (I12) ───────────────────
  // Las tres mutan el camino del MENSAJE, y las tres son la misma equivocación: tratarlo
  // como si fuera el camino de los bytes. Es el error que la puerta única vuelve fácil, y
  // por eso el paso trajo I12 en el mismo commit que la puerta.
  {
    id: "S85",
    garantía: "la autoría de un mensaje sale del mensaje, no de quien invocó",
    rompe: "«esto lo dijo el CFO en marzo», que es la mitad del valor de la memoria",
    cambios: [[
      `          actor: asActorId(ownAuthorship.actor),`,
      `          actor: asActorId("mcp-agent"),`,
    ]],
    espera: /I12 · la autoría de un mensaje es la del mensaje/,
    nota:
      "es la copia del camino de archivo, que es la mutación PLAUSIBLE: ahí la autoría es del " +
      "documento y vale para las mil unidades, y el reflejo es estamparla igual acá. Un mensaje no " +
      "tiene documento del que heredarla, así que lo que queda estampado es el agente que la mandó " +
      "por MCP. El defecto no rompe nada visible —la corrida sale completa, con sus fragmentos y sus " +
      "huellas— y solo se nota preguntándole a la memoria quién dijo qué",
  },
  {
    id: "S86",
    garantía: "un mensaje lo lee un adaptador dedicado, no el piso",
    rompe: "la métrica de degradación, que pasa a contar como degradado lo que no lo está",
    cambios: [[`    achievedLevel: "structured",`, `    achievedLevel: "plain_text",`]],
    espera: /I12 · un mensaje recorre la espina entera/,
    nota:
      "el otro reflejo del camino de archivo: el chat se ABSTIENE de clasificar, así que se parece a " +
      "un documento que cayó al piso. No es lo mismo — al piso se cae cuando nadie supo leer los " +
      "bytes, y acá el adaptador es dedicado y lo trajo quien invocó. Con `plain_text` la métrica de " +
      "§{Observabilidad} reporta degradado todo lo que entra por MCP, que es el canal del que el " +
      "producto más espera",
  },
  {
    id: "S87",
    garantía: "la atribución cruda del mensaje sobrevive hasta el nodo",
    rompe: "la citación de un chat, que se queda sin a dónde apuntar",
    cambios: [[`          source: ownAuthorship.source,`, `          source: "upload",`]],
    espera: /I12 · la atribución cruda del mensaje sobrevive/,
    nota:
      "`'upload'` es la constante LITERAL del camino de archivo doce líneas más arriba, así que esta " +
      "es la mutación de copiar y pegar. `Authorship.source` es «la atribución cruda tal como venía» " +
      "y para un mensaje es lo único que permite volver al hilo original. Es la fila que distingue " +
      "«la autoría llegó» de «la autoría llegó ENTERA»: S85 sigue verde con esta mutación puesta, " +
      "porque el actor y el instante están bien y lo que se perdió es de dónde salió",
  },

  {
    id: "S88",
    garantía: "una corrida que alguien SÍ leyó y de la que no salió nada tampoco se va en silencio",
    rompe: "el invariante «ninguna información se descarta en silencio», que pasa a cumplirse por no haber nada escrito",
    cambios: [[`  if (nodes.length === ZERO) {`, `  if (nodes.length < ZERO) {`]],
    espera: /I13 · una corrida leída y vacía avisa/,
    nota:
      "el hueco lo DESTAPÓ el paso 5 y no lo introdujo: estaba desde el paso 3, en el otro extremo del " +
      "camino que el paso 4 arregló. Allá nadie sabía leer los bytes y quedaba `on_hold`; acá un " +
      "adaptador dedicado los leyó y devolvió cero unidades, y la corrida salía idéntica a un documento " +
      "vacío de verdad. Con un `.docx` casi nunca pasa; con una herramienta MCP mandar una afirmación " +
      "vacía no cuesta nada, así que el canal nuevo lo volvió alcanzable. La mutación es `<` en vez de " +
      "`===`, que es la que un typo produce de verdad y deja la condición muerta sin tocar el aviso: " +
      "borrar el bloque entero dejaría `ZERO` huérfano y mataría la corrida con TS6133, acreditando al " +
      "linter (la lección de M12c)",
  },

  // ── Paso 6 · la delegación (I14, I15) ───────────────────────────────────────
  {
    id: "S89",
    garantía: "el punto fijo reconoce que le devolvieron lo mismo que dio",
    rompe: "la terminación: la recursión sigue sobre recortes idénticos",
    cambios: [[
      `    windowCovers(only.body.ref.window, ref.window)`,
      `    !windowCovers(only.body.ref.window, ref.window)`,
    ]],
    espera: /I15 · tocar fondo NO es quedar pendiente/,
    nota:
      "se INVIERTE en vez de constantear a `false`, y eso es deliberado: con `false` el import de " +
      "`windowCovers` queda huérfano y `tsc` mata la corrida ANTES del guardián, o sea acreditando al " +
      "compilador (la lección de M12c). Se midió: la primera versión de esta fila murió así. Invertido, " +
      "la recursión baja un nivel más y la ataja la guarda de CICLO — el aviso pasa de `bottomed` a " +
      "`cycle`, y ahí se ve que las dos guardas cubren cosas distintas y ninguna sobra",
  },
  {
    id: "S90",
    garantía: "el subárbol se injerta DONDE ESTABA la pieza, no al final",
    rompe: "las migas del contenido incrustado, que pasan a ser las de la raíz",
    cambios: [[`    out.push(...sub.nodes);`, `    out.unshift(...sub.nodes);`]],
    espera: /I14 · el subárbol se injerta donde estaba la pieza/,
    nota:
      "«el resultado se injerta donde estaba la pieza, de modo que el contenido incrustado hereda el " +
      "contexto jerárquico de su contenedor» (§{La delegación es emergente}). El emisor decide BAJÓ y " +
      "SUBIÓ comparando la cadena del nodo anterior con la actual, así que mover los nodos rompe el " +
      "reencuadre y con él las migas — y esa es la mitad que solo se puede medir en este paquete",
  },
  {
    id: "S91",
    garantía: "el núcleo chequea `requires` ANTES de invocar",
    rompe: "la ingesta entera, por una pieza que solo tenía que quedar anotada",
    cambios: [[
      `  const missing = selection.adapter.requires.filter((c) => ctx[c] === null);`,
      `  const missing = selection.adapter.requires.filter(() => false);`,
    ]],
    espera: /I14 · sin la capacidad, el adaptador NI SE INVOCA/,
    nota:
      "es la fila que justifica que la decisión viva en el NÚCLEO y no en el adaptador. Sin el chequeo, " +
      "el `imagen` se invoca en un contexto sin modelo y falla ruidoso —que es lo correcto de su lado— " +
      "y la corrida entera se cae. El adaptador no puede hacerlo mejor: si respondiera «no pude» en vez " +
      "de tirar, «no lo intenté» y «lo intenté y tocó fondo» volverían a ser indistinguibles",
  },
  {
    id: "S92",
    garantía: "los nodos delegados llevan su cadena",
    rompe: "el reencuadre del emisor, que deja de saber que bajó un nivel",
    cambios: [[
      `    out.push(chain.length === ZERO ? node : { ...node, delegation: chain });`,
      `    out.push(node);`,
    ]],
    espera: /I14 · los nodos delegados llevan su cadena/,
    nota:
      "la cadena la estampa el ORQUESTADOR y nunca el adaptador —«el adaptador delegado no sabe que fue " +
      "delegado» (PROVISIONAL(C21) de `ir`)— y es una CADENA y no un id suelto porque el emisor tiene " +
      "que distinguir bajar un nivel de bajar tres. Sin ella la cita encadenada del ejemplo canónico " +
      "—contrato.pdf → pg3 → esta celda— no se puede armar",
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
    rompe: "la reparación, en la ventana exacta que el diario existe para no tener",
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
    rompe: "el diario entero: queda un candado que DETECTA y no repara",
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
    rompe: "la exclusión mutua: una corrida repara encima de otra que está mutando",
    archivo: "scripts/mutants.mjs",
    cambios: [[LADO_SEGURO, `return false;`]],
    espera: /da por muerto un pid del que solo duda/,
    nota:
      "`process.kill(pid, 0)` tira `EPERM` cuando el proceso EXISTE y es de otro usuario, y los PID se " +
      "reusan en máquinas de mucho uptime. Con `return false` cualquier errno pasa a significar «muerto»: " +
      "el arnés borra el candado ajeno, restaura encima de archivos que la otra corrida está mutando y las " +
      "dos siguen. El error caro es ese, no el de negarse a arrancar",
  },

  // ── El reconciliador (paso 11) · las fallas que NO SE VEN ──────────────────
  // Las cuatro mutan `../emission/src/reconcile.ts` y las mata I16, que es el único
  // invariante del repo que corre el reconciliador sobre nodos reales. Las cuatro
  // COMPILAN y devuelven un `EmissionOutput` perfectamente formado: sin el golden de
  // identidades, ninguna se ve.
  {
    id: "S93",
    garantía: "los cercos son la subsecuencia creciente más larga, no todas las anclas",
    rompe: "el golden de identidades",
    cambios: [[
      `    if (tail !== undefined && tail.anchor.known < target) lo = mid + ONE;`,
      `    if (tail !== undefined && tail.anchor.known > target) lo = mid + ONE;`,
    ]],
    espera: /I16 · golden de identidades/,
    nota:
      "es LA decisión que el plan no toma, y la mutación es la comparación dada vuelta — un carácter, y " +
      "el error más común al escribir una búsqueda binaria. Con el predicado invertido la subsecuencia " +
      "deja de ser la más larga, las divisorias del lado viejo dejan de ser monótonas —el corpus lo " +
      "provoca: la cita se mudó del orden 12 al 3— y el cursor de `splitAround` avanza buscando un borde " +
      "que ya pasó: los huecos de los dos lados dejan de salir del mismo par de anclas. Nada explota; " +
      "empareja distinto. LA PRIMERA VERSIÓN DE ESTA FILA reemplazaba la llamada entera por " +
      "`tails.length` y moría por `TS6133` —`lowerBound` quedaba sin usar—, o sea acreditando al " +
      "compilador en vez del contrato: el corredor la rechazó. Sin el golden: NO ROMPÍA",
  },
  {
    id: "S94",
    garantía: "`anchoring` se mide sobre el lado VIEJO (ANCHORING_DENOMINATOR)",
    rompe: "el golden de identidades",
    cambios: [[
      `    anchoring: m === ZERO ? ONE : byHash / m,`,
      `    anchoring: m === ZERO ? ONE : byHash / n,`,
    ]],
    espera: /I16 · golden de identidades/,
    nota:
      "PROVISIONAL(#62) eligió el conteo viejo porque la métrica vigila CUÁNTA CURACIÓN SOBREVIVIÓ, y esa " +
      "es una proporción del pasado. Con el denominador nuevo, borrar 400 de 500 nodos MEJORA el número " +
      "—quedan menos por preservar— y la única alerta del peor modo de falla se apaga justo cuando más " +
      "hace falta. Los dos valores están en [0,1] y los dos parecen razonables: sin el golden: NO ROMPÍA",
  },
  {
    id: "S95",
    garantía: "los pases 2 y 3 solo comparan mismo `role` Y misma `shape`",
    rompe: "el golden de identidades",
    cambios: [
      [
        `        bucket(encodeParts(fresh.it.role, fresh.it.body.shape)).fresh.push(fresh);`,
        `        bucket(encodeParts(fresh.it.body.shape)).fresh.push(fresh);`,
      ],
      [
        `        bucket(encodeParts(old.it.role, old.it.shape)).old.push(old);`,
        `        bucket(encodeParts(old.it.shape)).old.push(old);`,
      ],
    ],
    espera: /I16 · golden de identidades/,
    nota:
      "la guarda del plan («con mismo tipo y misma forma») está escrita como DOMINIO y no como condición: " +
      "un par de roles distintos no se rechaza, no se enumera. Quitar `role` de la clave no produce un " +
      "emparejamiento visiblemente absurdo sobre este corpus —los distractores dan 0.00— pero SÍ agranda " +
      "el dominio, y eso se ve en `comparisons`, que el golden congela: 6 pasa a 9. Es el único canal por " +
      "el que la guarda es observable sin un caso adversarial, y es exactamente para lo que ese campo entró",
  },

  {
    id: "S96",
    garantía: "los ids salen del ACUÑADOR, no de una fórmula sobre la posición",
    rompe: "la segunda mitad de I2 · determinismo",
    cambios: [[
      `    const id = assigned[at] ?? options.mint();`,
      `    const id = assigned[at] ?? (node.local as unknown as ElementId);`,
    ]],
    espera: /I2 · el acuñador/,
    nota:
      "ES EL ATAJO QUE ALGUIEN ESCRIBE DE BUENA FE —«el `LocalId` ya es único en la corrida, ¿para qué " +
      "acuñar?»— y compila sin tocar nada más. Y es EXACTAMENTE la fórmula de una sola versión que " +
      "§{Por qué la identidad} descartó: el `LocalId` es posicional, así que insertar un párrafo arriba " +
      "le mueve el id a todos los de abajo y despega su curación en silencio. LA PRIMERA MITAD DE I2 " +
      "QUEDA VERDE con esta mutación —dos corridas siguen dando lo mismo, porque la posición es " +
      "determinística— y ese es el punto de la fila: hasta el paso 12 NINGÚN mutante del repo tenía " +
      "`espera: /I2/`, así que un `ingest` que ignorara la costura del acuñador habría pasado para " +
      "siempre. La mitad que la mata es la que corre una tercera vez con un acuñador distinto y exige " +
      "que los ids SE MUEVAN. No acredita por casualidad: `options.mint` es un acceso a propiedad, no " +
      "un símbolo que quede huérfano, así que `TS6133` no puede matarla",
  },

  // ── Controles ──────────────────────────────────────────────────────────────
  // ── El asset materializado (paso 7, fase 2) ───────────────────────────────
  {
    id: "S104",
    garantía: "la dirección de un objeto es el hash de SU CONTENIDO",
    rompe: "I18 · la dirección del objeto no es el hash de su contenido",
    cambios: [[`      const object = asObjectKey(byteHash(bytes));`, `      const object = asObjectKey(byteHash(bytes) + mime);`]],
    espera: /la dirección del objeto no es el hash de su contenido/,
    nota:
      "meter el mime en la clave se hace de buena fe —«así dos objetos distintos con el mismo contenido no " +
      "se pisan»— y rompe justo lo que el direccionamiento por contenido compra: la MISMA imagen servida " +
      "como `image/png` y como `application/octet-stream` pasa a ser dos objetos, se guarda dos veces, el " +
      "modelo la describe dos veces y —porque la dirección entra en la huella del asset— son DOS " +
      "IDENTIDADES, así que la curación de una no vale para la otra. Y no rompe nada visible en el árbol",
  },
  {
    id: "S106",
    garantía: "un asset con objeto PROPIO no es un rectángulo sin bytes",
    rompe: "I18 · el asset comprimido no llegó a delegar",
    cambios: [[
      `  if (ref.object !== origin.ref.object && resolve !== null) {`,
      `  if (ref.object === origin.ref.object && resolve !== null) {`,
    ]],
    espera: /el asset comprimido no llegó a delegar/,
    nota:
      "SU INVARIANTE PASABA POR LA RAZÓN EQUIVOCADA y esta fila lo encontró. Con la comparación dada vuelta " +
      "los nodos delegados SEGUÍAN apareciendo: el adaptador de imagen reclama por el MIME que declaró el " +
      "padre —no por el contenido, y eso es deliberado— y el `perceive` del banco devolvía regiones sin " +
      "mirar la fuente. O sea que la delegación «funcionaba» con cero bytes. El doble pasó a exigir bytes, " +
      "que es lo que un modelo real hace. " +
      "Hasta el paso 7 las dos cosas caían en la misma rama y estaba bien, porque nada se materializaba: la " +
      "única pregunta era «¿es un rango?» y como la respuesta era no para los dos, los dos volvían vacíos. " +
      "Uno con razón —un rectángulo de una página no existe hasta que alguien la renderiza— y el otro, " +
      "desde que hay objetos propios, mal. Con la comparación dada vuelta el materializado vuelve a la " +
      "rama del rectángulo: sale sin bytes, nadie lo reclama y la figura desaparece SIN UN SOLO AVISO, " +
      "porque desde afuera es indistinguible de un asset que legítimamente no tiene bytes propios",
  },

  {
    id: "S107",
    garantía: "la imagen materializada dice de dónde salió, y NADA MÁS en el pipeline lo sabe",
    cambios: [["            whence: { container: input.ref.object, path: entrada.name },", "            whence: null,"]],
    espera: /I19 · la procedencia no llegó a la salida/,
    nota: "el hermano de S105 de `adapters` con el observador cambiado: la misma línea, vista desde la salida de `ingest` en vez de desde el golden del adaptador. Lo que dice es que la dirección del asset es el hash de SU CONTENIDO —ciega a de dónde vino, por diseño y a propósito— así que con `whence` en `null` no queda un solo dato en todo el pipeline que diga de cuál documento salió esta figura. SE REANCLÓ AL IMPLEMENTAR «¿los bytes ya existen?», de catorce espacios a doce: la nota vieja explicaba que el ancla larga era la única única, porque la corta era su subcadena. Con una sola rama esa precaución sobra, y con ella se fue la asimetría que la fila describía —«en la rama sin comprimir la dirección ES el contenedor, así que perder la procedencia es reconstruible»—: ya no hay una rama donde lo sea"
  },
  {
    id: "S108",
    garantía: "un objeto materializado es la pieza ENTERA, y su ventana lo dice de UNA sola manera",
    cambios: [[
      "      return storage.put(object, bytes, mime).then(() => ({ object, window: { scope: \"whole\" } }));",
      "      return storage\n        .put(object, bytes, mime)\n        .then(() => ({ object, window: { scope: \"range\", start: 0, end: bytes.length } }));",
    ]],
    espera: /I18 · golden bytes→nodos del/,
    nota: "la mutación dice LO MISMO —el rango completo de los bytes ES la pieza entera— y ahí está el veneno: no cambia un solo comportamiento, así que las tres guardas de I18 siguen verdes (delegó, la clave es el hash, no hubo objeto de más). Lo único que se mueve es la HUELLA, porque `window` entra en la preimagen del asset. Dos formas de escribir «todo» son dos identidades para la misma figura, y la única red que lo ve es el golden. Es exactamente la clase de cambio que este paso agregó el golden para atrapar",
  },
  {
    id: "SC21",
    control: true,
    garantía: "editar la prosa de un docstring del reconciliador no rompe nada",
    cambios: [[
      `ES UNA FUNCIÓN PURA.`,
      `ES UNA FUNCIÓN PURA (control SC21).`,
    ]],
    nota:
      "el par de S93–S96: sin él, las cuatro filas serían indistinguibles de un golden que congela el " +
      "ARCHIVO en vez de su comportamiento. El reconciliador es el archivo más comentado del paquete " +
      "—la mitad de sus líneas son razonamiento— y congelarlo sería la forma más rápida de que nadie " +
      "lo pueda mejorar",
  },
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
    cambios: [[`  type Intake,\n  type IngestOptions,`, `  type IngestOptions,\n  type Intake,`]],
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
  "corpus/manual.identity.golden.json",
  // El de la rama comprimida, y entra con su consumidor: sin él en esta lista, S108
  // no tiene qué mutar y la única garantía que solo el golden ve queda sin fila.
  "corpus/manual-deflated.golden.json",
  "scripts/boundaries.mjs",
  "scripts/invariants.mjs",
  // El `src/` de OTRO paquete, y va con la misma razón que `turbo.json` de abajo: el
  // reconciliador vive en `emission`, pero lo único que puede acreditar su
  // COMPORTAMIENTO es I16, que necesita nodos reales y por eso vive acá — `emission` no
  // puede ver `adapters` (R1). El único que puede acreditar una garantía es el que la
  // sufre. El arnés lo restaura como a cualquier otro, y el orden `^lint` del grafo
  // garantiza que la cadena de `emission` ya terminó cuando esto lo muta (S73).
  "../emission/src/reconcile.ts",
  // El SEGUNDO `src/` ajeno, y por la misma razón que el primero: la única prueba de
  // que un asset MATERIALIZADO entra por la misma puerta que un recorte necesita las
  // dos mitades —el adaptador que lo produce y la orquestación que lo resuelve— y solo
  // este paquete alcanza a las dos.
  "../adapters/src/registry.ts",
  // El CUARTO archivo ajeno, y entra en la deuda del paso 7 por la misma razón que los
  // otros: la procedencia de la rama COMPRIMIDA no tiene observador en `adapters` —el
  // banco de ahí no puede materializar a propósito—, así que el único paquete que puede
  // acreditarla es este, que corre las dos mitades.
  "../adapters/src/docx.ts",
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
        `ORCHESTRATION-ERR: hay otro candado de mutantes en este árbol y NO se puede dar por muerto.\n` +
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
        `ORCHESTRATION-ERR: reparé el candado huérfano del pid ${ajeno.pid} y otra corrida se lo llevó\n` +
          `  antes que yo. No sigo: dos corridas a la vez se pisan.`,
      );
      process.exit(1);
    }
    console.error(
      pendientes.length === 0
        ? `ORCHESTRATION-AVISO: había un candado HUÉRFANO (pid ${ajeno.pid}, muerto) sin nada pendiente. Lo tomé y sigo.`
        : `ORCHESTRATION-AVISO: había un candado HUÉRFANO (pid ${ajeno.pid}, muerto) con ${pendientes.length} archivo(s) sin restaurar.\n` +
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
    `ORCHESTRATION-ERR: el árbol NO está verde antes de mutar. Nada de lo que sigue significaría nada.\n` +
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
