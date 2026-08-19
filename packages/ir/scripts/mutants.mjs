#!/usr/bin/env node
// Acredita cada garantía del paquete ROMPIÉNDOLA, y falla si alguna deja de romperse.
//
//   node scripts/mutants.mjs           todas las mutaciones
//   node scripts/mutants.mjs M8        una sola, para iterar
//
// El total NO se escribe acá: lo imprime el cierre, contado sobre la lista. Esta línea
// decía «las 56 mutaciones» y ya estaba desfasada — una cifra sostenida a mano es una
// afirmación que nadie verifica.
//
// POR QUÉ ESTO ES UN SCRIPT Y NO UNA AUDITORÍA CON AGENTES
//
// La primera versión de esta suite la corrieron nueve subagentes en copias
// aisladas: 776k tokens y veinte minutos, para una foto de un solo momento.
// Aplicar una mutación conocida es determinístico —reemplazar texto, correr un
// comando, mirar la salida—, así que no necesita criterio. Lo que sí lo necesita
// es DESCUBRIR qué mutar y ESCRIBIR el testigo que cierra un hueco; eso lo sigue
// haciendo un humano o un agente, y su resultado se deposita acá como una fila.
//
// El cambio real no es el ahorro: es que la acreditación pasó de ocurrir una vez
// a correr en cada `pnpm lint`. Una garantía que solo se verificó el día que se
// escribió es indistinguible de una que nunca funcionó.
//
// EN SERIE Y EN EL ÁRBOL, a propósito. `tsc --noEmit` tarda 0,18 s y los cinco
// guardianes menos de un segundo: paralelizar en copias ahorraría medio minuto y costaría
// gestión de directorios temporales. El árbol se restaura siempre, incluso si
// algo explota, y se comprueba verde al principio Y al final.

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
 * - `cambios`: pares [buscar, reemplazar]. `buscar` tiene que aparecer
 *   EXACTAMENTE UNA VEZ. Si aparece cero o dos veces, la mutación se pudrió con
 *   una edición anterior y eso es un ERROR, no un salteo: un mutante obsoleto
 *   que se saltea en silencio es una garantía que dejó de verificarse.
 * - `espera`: lo que la salida tiene que decir. Un regex, no un exit code — que
 *   falle no alcanza, tiene que fallar POR LA RAZÓN correcta.
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
  {
    id: "M1",
    garantía: "SHAPES no admite una forma que Body no tenga",
    cambios: [[
      `  "container",\n] as const satisfies readonly Body["shape"][];`,
      `  "container",\n  "row",\n] as const satisfies readonly Body["shape"][];`,
    ]],
    espera: /TS2322/,
  },
  {
    id: "M2",
    garantía: "a SHAPES no le puede faltar una forma de Body",
    cambios: [[
      `  "fields",\n  "container",\n] as const satisfies`,
      `  "fields",\n] as const satisfies`,
    ]],
    espera: /SHAPES is missing a shape of Body/,
  },
  {
    id: "M4",
    garantía: "el piso físico no puede dar un par rol⇒forma ilegal",
    cambios: [[`  text_span: "paragraph",`, `  text_span: "code",`]],
    espera: /TS2322/,
  },
  {
    id: "M5",
    garantía: "«código siempre solo» — el valor no se puede cambiar",
    cambios: [[`  readonly code: "solo";`, `  readonly code: "normal";`]],
    espera: /TS2322/,
  },
  {
    id: "M6",
    garantía: "«código siempre solo» — el TIPO no se puede ensanchar",
    cambios: [[`  readonly code: "solo";`, `  readonly code: Cohesion;`]],
    espera: /widened past the literal/,
    nota: "pasaba en verde hasta COHESION_PROOFS (bloque 1b)",
  },
  {
    id: "M7",
    garantía: "el satisfies rechaza una clave que no es un Role, en su línea",
    cambios: [[`  image: "asset",\n}`, `  image: "asset",\n  codeblock: "verbatim",\n}`]],
    espera: /TS2353|TS2561/,
    nota: "escalón ②: la anotación lo rechaza donde se escribe",
  },
  {
    id: "M8",
    garantía: "y si alguien saca el satisfies, el testigo lo agarra igual",
    cambios: [
      [`  image: "asset",\n}`, `  image: "asset",\n  codeblock: "verbatim",\n}`],
      [`} as const satisfies Partial<Record<Role, Shape>>;`, `} as const;`],
    ],
    espera: /REQUIRED_SHAPE keys are no longer Role/,
    nota: "sacar el satisfies SOLO no rompe nada —las claves siguen siendo roles—; lo que impide es ESCRIBIR una que no lo sea. Sin el testigo, illegalPairs iba de 25 a 0 mudo",
  },
  {
    id: "M14",
    garantía: "el barrido 15×6 recorre el dominio que dice recorrer",
    cambios: [[`  "quote",\n  "list",`, `  "list",`]],
    espera: /ROLES no longer has 15 roles/,
    nota: "pasaba en verde hasta DOMAIN_PROOFS (bloque 1b)",
  },
  {
    id: "M9b",
    garantía: "un campo Pending<T> no puede llevar un número inventado",
    cambios: [[
      `    minPrintableProportion: null as Pending<number>,`,
      `    minPrintableProportion: 0.82 as Pending<number>,`,
    ]],
    espera: /Pending<T> field with a value/,
    nota: "la cifra publicada decía 17 y el árbol sano tiene 18: verificar contra ella aprobaba el árbol MUTADO",
  },
  {
    id: "M9c",
    garantía: "el censo publicado en el docstring no se puede desincronizar",
    cambios: [[
      ` * CENSO(numbers.mjs): 29 numéricos = 18 pending en null + 11 con valor`,
      ` * CENSO(numbers.mjs): 28 numéricos = 17 pending en null + 11 con valor`,
    ]],
    espera: /census published by params\.ts does not match/,
    nota: "es exactamente la cifra vieja: escribirla de nuevo tiene que ser imposible",
  },
  {
    id: "M11",
    garantía: "ningún literal numérico de valor fuera de params.ts",
    cambios: [[`export const ROLES = [`, `export const _CAP = 42;\nexport const ROLES = [`]],
    espera: /numeric literal outside params/,
  },
  {
    id: "M12c",
    garantía: "R1 — shapes.ts no puede alcanzar outputs.ts (anidar un nodo)",
    cambios: [[
      `export type Shape = Body["shape"];`,
      // El import tiene que USARSE: si queda huérfano, tsc lo rechaza con TS6133
      // antes de que el guardián de fronteras llegue a correr, y el mutante
      // estaría probando el linter en vez de la frontera.
      `import type { Node } from "./outputs.js";\nexport type _Anida = Node;\nexport type Shape = Body["shape"];`,
    ]],
    espera: /frontera/i,
    nota: "reanclada en el bloque 3 (salidas.ts → outputs.ts). Antes de reanclarla falló RUIDOSA con TS2307 «Cannot find module './salidas.js'», que NO matchea /frontera/i: «rompió, pero no por la razón esperada». Es el diseño del corredor — que falle no alcanza, tiene que fallar por la razón correcta",
  },
  {
    id: "M12d",
    garantía: "el guardián de fronteras avisa si su regex dejó de ver imports",
    cambios: [[
      `import type { ObjectKey } from "./identity.js";`,
      `import type { ObjectKey } from './identity.js';`,
    ]],
    espera: /no le parece importar nada|frontera/i,
    nota: "con comillas simples el grafo quedaba sin aristas y decía «fronteras ok»",
  },

  // ── Bloque 2 · identity.ts ─────────────────────────────────────────────────
  {
    id: "M18",
    garantía: "la guarda de Nominal está puesta: marcar sobre marcado no vuelve a ser never",
    cambios: [[
      `export type Nominal<Base, Label extends string> = [Base] extends [Branded]\n  ? { "IR-ERR: branding an already branded type collapses to never — the brand is FLAT": Base }\n  : Base & { readonly [nominal]: Label };`,
      `export type Nominal<Base, Label extends string> = Base & { readonly [nominal]: Label };\nexport type _BrandedSigueUsado = Branded;`,
    ]],
    espera: /the Nominal guard is gone/,
    nota: "el reemplazo re-exporta Branded a propósito: sin eso queda huérfano y TS6133 mata la corrida antes del testigo (la lección de M12c)",
  },
  {
    id: "M19",
    garantía: "una marca de dos niveles es un error EN SU LÍNEA, no un never silencioso",
    cambios: [[
      `export type NodeFingerprint = Nominal<string,"NodeFingerprint">;`,
      `export type NodeFingerprint = Nominal<ByteHash,"NodeFingerprint">;`,
    ]],
    espera: /branding an already branded type collapses to never/,
    nota: "el mensaje que sale es el de la guarda misma, por el as del constructor asNodeFingerprint",
  },
  {
    id: "M20",
    garantía: "el bug histórico completo — sin guarda, la familia de hashes colapsa a never",
    cambios: [
      [
        `export type Nominal<Base, Label extends string> = [Base] extends [Branded]\n  ? { "IR-ERR: branding an already branded type collapses to never — the brand is FLAT": Base }\n  : Base & { readonly [nominal]: Label };`,
        `export type Nominal<Base, Label extends string> = Base & { readonly [nominal]: Label };\nexport type _BrandedSigueUsado = Branded;`,
      ],
      [
        `export type NodeFingerprint = Nominal<string,"NodeFingerprint">;`,
        `export type NodeFingerprint = Nominal<ByteHash,"NodeFingerprint">;`,
      ],
    ],
    espera: /brand collapsed to never/,
    nota: "es la falla que el paquete tuvo: la familia entera en never, never asignable a todo, build en verde",
  },
  {
    id: "M21",
    garantía: "dos marcas no pueden compartir etiqueta (la familia de hashes separa)",
    cambios: [[
      `export type EmbeddingKey = Nominal<string,"EmbeddingKey">;`,
      `export type EmbeddingKey = Nominal<string,"NodeFingerprint">;`,
    ]],
    espera: /a node fingerprint is accepted as an embedding key/,
  },
  {
    id: "M22",
    garantía: "la marca sigue exigiendo su constructor: un string pelado no entra",
    cambios: [[
      `  : Base & { readonly [nominal]: Label };`,
      `  : Base & { readonly [nominal]?: Label };`,
    ]],
    espera: /a bare string is accepted as a node fingerprint/,
    nota: "ablandar la marca a opcional es un carácter y no cambia ninguna firma",
  },
  {
    id: "M23",
    garantía: "un id acuñado y uno local de adaptador no se confunden (H13)",
    cambios: [[
      `export type LocalId = Nominal<string, "LocalId">;`,
      `export type LocalId = Nominal<string, "ElementId">;`,
    ]],
    espera: /an ElementId is accepted as a LocalId/,
    nota: "la familia de hashes se escribe sin espacio tras la coma y los ids CON espacio: es lo que hace único a cada buscar. Si alguien pasa Prettier sobre identity.ts, seis filas se pudren juntas",
  },
  {
    id: "M29",
    garantía: "lo que se cachea por hashBytes no puede llevar un id (H13)",
    cambios: [[
      `export type RawNode = {\n  readonly role: Role;`,
      `export type RawNode = {\n  readonly id: ElementId;\n  readonly role: Role;`,
    ]],
    espera: /what is cached by hashBytes must not carry an id/,
    nota: "reanclada en el bloque 3 (salidas.ts → outputs.ts). Antes de reanclarla falló RUIDOSA —«el texto a mutar aparece en 0 archivos»—, que es el diseño del corredor: un mutante podrido es un error, no un salteo",
  },

  // ── Bloque 2 · location.ts ─────────────────────────────────────────────────
  {
    id: "M24",
    garantía: "SourceRange no puede colapsar a never si el tag de la variante grid se mueve",
    cambios: [[`      readonly space: "grid";`, `      readonly space: "sheet";`]],
    espera: /SourceRange collapsed to never/,
    nota: "Extract que no matchea no es un error: es never, y never es asignable a todo — la misma falla que la familia de hashes",
  },
  {
    id: "M25",
    garantía: "abrir la unión Coordinate rompe acá (ninguna variante nueva entra muda)",
    cambios: [[
      `  | { readonly space: "time"; readonly start: number; readonly end: number };`,
      `  | { readonly space: "time"; readonly start: number; readonly end: number }\n  | { readonly space: "page"; readonly page: number };`,
    ]],
    espera: /Coordinate gained a space/,
    nota: "la QUINTA variante (time, H4) ya entró de verdad en este bloque y rompió acá, que es el punto: esta fila guarda la sexta. El vocabulario de space es un compromiso con el plan y con los doce adaptadores, igual que ROLES.length === 15",
  },
  {
    id: "M26",
    garantía: "boxContains exige el MISMO marco",
    cambios: [[`  if (parent.frame !== child.frame) return false;\n`, ``]],
    espera: /MARCOS DISTINTOS no se contienen/,
    nota: "sin esta línea las cajas de las 40 diapositivas de un .pptx se contienen entre sí, y nada se pone rojo",
  },
  {
    id: "M27",
    garantía: "compareBoxes ordena por área ASCENDENTE",
    cambios: [[`  if (areaA !== areaB) return areaA - areaB;`, `  if (areaA !== areaB) return areaB - areaA;`]],
    espera: /área ascendente manda/,
  },
  {
    id: "M28",
    garantía: "R1 — location.ts no puede alcanzar outputs.ts (una Location que anida un Node)",
    cambios: [[
      `export type SourceRange = Extract<Coordinate, { space: "grid" }>;`,
      `import type { Node } from "./outputs.js";\nexport type _Anida = Node;\nexport type SourceRange = Extract<Coordinate, { space: "grid" }>;`,
    ]],
    espera: /frontera/i,
    nota: "mismo cuidado que M12c: el import tiene que USARSE o TS6133 mata la corrida antes del guardián. La cobertura es TRANSITIVA (shapes.ts → location.ts → outputs.ts): no hace falta una frontera nueva, pero si shapes.ts dejara de importar location.ts esta fila diría NO ROMPIÓ y ahí se vería",
  },
  {
    id: "M30",
    garantía: "Location.within sigue siendo RECURSIVA (la cita encadenada)",
    cambios: [[
      `  readonly within: readonly Location[];`,
      `  readonly within: readonly LocalLocation[];`,
    ]],
    espera: /Location\.within stopped being recursive/,
    nota: "aplanarla a un solo nivel compila: «la imagen dentro de la página 3 del PDF» deja de ser expresable sin un solo error",
  },
  {
    id: "M31",
    garantía: "Box.frame es OBLIGATORIO",
    cambios: [[`  readonly frame: string;`, `  readonly frame?: string;`]],
    espera: /Box\.frame became optional/,
    nota: "boxContains compara undefined !== undefined, que es false: opcionalizarlo no rompe ni una línea de código. Sin el testigo, lo agarraba de casualidad projection.ts —que mete el marco en la preimagen de huella— y eso habría acreditado una garantía que el contrato no impone",
  },

  // ── Bloque 3 · outputs.ts · los cuatro agregados de contrato ───────────────
  // Los cuatro campos entraron porque el dato que llevan NO SE RECONSTRUYE a
  // posteriori. Los cuatro son marcas nominales sobre `string`, así que la edición
  // que los rompe no es borrarlos: es cambiarles la marca por otra de la familia, y
  // sin `WRAPPER_PROOFS` (invariante 8) las cuatro compilan.
  {
    id: "M32",
    garantía: "Ingestion.version es el hash de los BYTES, no la huella de un nodo",
    cambios: [[
      `  readonly version: ByteHash;\n  /**\n   * AGREGADO(Capa 5 A6): el activo original`,
      `  readonly version: ContentHash;\n  /**\n   * AGREGADO(Capa 5 A6): el activo original`,
    ]],
    espera: /Ingestion\.version is no longer the ByteHash/,
    nota: "el plan usa «ContentHash» para dos cosas distintas (PROVISIONAL(ContentHash) en identity.ts): esta confusión es la plausible, no una inventada. `readonly version: ByteHash;` aparece DOS veces en el archivo —NodeInVersion e Ingestion— y por eso el ancla arrastra el docstring siguiente. Sin el testigo: NO ROMPÍA",
  },
  {
    id: "M33",
    garantía: "Ingestion.original apunta a un OBJETO, no a un documento",
    cambios: [[`  readonly original: ObjectKey;`, `  readonly original: DocumentId;`]],
    espera: /Ingestion\.original stopped being an ObjectKey/,
    nota: "SIN el testigo esta fila rompía POR CASUALIDAD: con TS6196 «'ObjectKey' is declared but never used», porque el import quedaba huérfano. Habría acreditado el linter, no el contrato — la falla del bloque 2, repetida. Es el caso más valioso de los ocho, porque es el que un revisor habría dado por bueno",
  },
  {
    id: "M34",
    garantía: "NodeInVersion.organization separa tenants (H3)",
    cambios: [[
      `  readonly organization: OrganizationId;\n  /**\n   * ATÓMICO CON LOS NODOS`,
      `  readonly organization: DocumentId;\n  /**\n   * ATÓMICO CON LOS NODOS`,
    ]],
    espera: /NodeInVersion\.organization stopped being an OrganizationId/,
    nota: "el campo entró para que `hash → documento` no cruce organizaciones; con la marca equivocada el filtro existe, compila, y filtra por lo que no es. Sin el testigo: NO ROMPÍA",
  },
  {
    id: "M35",
    garantía: "Annotation.actor es un actor, no un string cualquiera",
    cambios: [[
      `  readonly actor: ActorId;\n  readonly annotator: string;`,
      `  readonly actor: string;\n  readonly annotator: string;`,
    ]],
    espera: /Annotation\.actor stopped being an ActorId/,
    nota: "`readonly actor: ActorId;` también existe en Authorship —`identity.ts` hasta el bloque 3b, `authorship.ts` desde el corte, `provenance.ts` desde el rename—, así que el ancla necesita la línea siguiente o `ubicar` encuentra dos archivos. Que ni el corte ni el rename la hayan podrido es precisamente porque ese archivo ENTRA en ARCHIVOS: si no entrara, el texto pasaría a aparecer en un solo archivo y esta fila quedaría verde por una razón equivocada. Sin el testigo: NO ROMPÍA",
  },

  // ── Bloque 3 · el orden de Certainty (hueco cerrado) ──────────────────────
  {
    id: "M36",
    garantía: "CERTAINTY_RANK ordena, y en el sentido que dice la escalera",
    cambios: [[
      `  declared: PARAMETERS.arithmetic.zero,\n  inferred: PARAMETERS.arithmetic.one,`,
      `  declared: PARAMETERS.arithmetic.one,\n  inferred: PARAMETERS.arithmetic.zero,`,
    ]],
    espera: /CERTAINTY_RANK\.(declared|inferred) moved/,
    nota: "invertir la tabla marca como «declared» lo que el pipeline adivinó — la promesa de §{La escalera} exactamente al revés. Antes de este bloque «la peor certeza» que Fragment prometía NO ERA COMPUTABLE: el paquete no exportaba ningún orden sobre Certainty. Sin el testigo: NO ROMPÍA",
  },

  // ── Bloque 3 · projection.ts · la huella ──────────────────────────────────
  {
    id: "M37",
    garantía: "verbatim se tokeniza por LÍNEA — los espacios son significativos (H6)",
    cambios: [[
      `const lines = (text: string): readonly string[] => text.split("\\n");`,
      `const lines = (text: string): readonly string[] => text.split(/\\s+/gu);`,
    ]],
    espera: /verbatim: los espacios son significativos/,
    nota: "es el bug que tuvo la primera versión del archivo. Se muta `lines` y no el `case` a propósito: cambiar el case deja `lines` huérfana y la corrida muere con TS6133 ANTES del guardián, o sea acreditando el linter (la lección de M12c). Verificado: con `lines` en uso, los cinco guardianes quedaban VERDES antes de este bloque",
  },
  {
    id: "M38",
    garantía: "la normalización NFC es parte de la DEFINICIÓN de la huella",
    cambios: [[
      `  const base = text.normalize("NFC").replace(/\\r\\n?/gu, "\\n");`,
      `  const base = text.replace(/\\r\\n?/gu, "\\n");`,
    ]],
    espera: /NFC: el mismo texto compuesto y descompuesto/,
    nota: "sin NFC, guardar el mismo DOCX con otro editor mueve todas las anclas del corpus. Antes de este bloque el guardián no tenía un solo caso de normalización y esta edición pasaba limpia — sobre una línea que el propio archivo llama «PARTE DE LA DEFINICIÓN de la huella»",
  },
  {
    id: "M39",
    garantía: "el vocabulario de TokenKind no se puede cambiar en silencio",
    cambios: [
      [`  | "word"`, `  | "wrd"`],
      [`token("word", p)`, `token("wrd", p)`],
    ],
    espera: /la preimagen canónica de text_span cambió/,
    nota: "los casos de discriminación comparan cuerpos ENTRE SÍ y son ciegos al cambio que los mueve a TODOS: renombrar un valor de TokenKind cambia toda huella del corpus. Verificado antes de fijar las canónicas: «word» → «wrd» pasaba tsc y los cinco .mjs en verde. Este bloque HACE ese cambio doce veces, y por eso la tabla se fija en el mismo commit",
  },

  // ── Bloque 4 · adapter.ts · la superficie que implementan los doce ──────────
  // Tres de las seis filas de este bloque acreditan aserciones que YA EXISTÍAN y
  // que nadie había visto disparar nunca. Una aserción escrita que nadie vio
  // disparar es indistinguible de una que no puede fallar.
  {
    id: "M40",
    garantía: "la salida del adaptador no puede llevar un id (H13(a))",
    cambios: [[`  readonly signals: S;`, `  readonly id: string;\n  readonly signals: S;`]],
    espera: /adapter output must not carry an id/,
    nota: "`_UnitHasNoId` existe desde el bloque 1b y NUNCA tuvo mutante. Se muta a `string` y no a `ElementId` a propósito — `ElementId` no está importado en `adapter.ts` y la corrida moriría con TS2304 antes del testigo, acreditando el compilador en vez del contrato (la lección de M12c). Sin el testigo: NO ROMPÍA",
  },
  {
    id: "M41",
    garantía: "Context.ancestors sigue siendo una cadena de MatterHash (la recursión termina)",
    cambios: [
      [`  readonly ancestors: readonly MatterHash[];`, `  readonly ancestors: readonly string[];`],
      // El import de `MatterHash` queda huérfano si no se lo usa en otro lado, y
      // `TS6133`/`TS6196` mataría la corrida ANTES del testigo. Es exactamente el
      // caso M33 del bloque 3, evitado a mano: sin esta segunda línea el mutante
      // acreditaría el linter. Verificado.
      [`export type Unit<S> = {`, `export type _MatterHashStillUsed = MatterHash;\nexport type Unit<S> = {`],
    ],
    espera: /Context\.ancestors is no longer a chain of MatterHash/,
    nota: "misma familia que M32–M35 (una marca nominal sobre `string` en un campo que nadie reconstruye después) con un agravante: `ancestors` no direcciona un dato, DECIDE SI EL PROCESO TERMINA. Ensancharlo a `string` deja la guarda de ciclo comparando hashes de otra familia, compila, y no rompe una línea de código. Sin el testigo (invariante 10): NO ROMPÍA. Y si 3b parte `identity.ts` y `MatterHash` cambia de módulo, esta fila se pudre y falla ruidoso («0 archivos»), que es lo correcto",
  },
  {
    id: "M42",
    garantía: "EVIDENCE_SCALE sigue en el orden del que se derivan los seis valores de Evidence",
    cambios: [[`  "Content",\n  "Extension",`, `  "Extension",\n  "Content",`]],
    espera: /EVIDENCE_SCALE was reordered/,
    nota: "`Evidence` no lleva sus números escritos: los deriva de `indexOf` sobre este arreglo (PROVISIONAL(#429)). Esa decisión compra que la escala no diverja de sus valores y NO compra que el orden siga siendo el del plan: mover una fila cambia los seis números —`Signature` deja de ser 4— y con eso cambia quién gana cada archivo entre los doce adaptadores. Es el compromiso deliberado de `ROLES.length === 15` aplicado al tramo 2. Sin el testigo (invariante 11): NO ROMPÍA",
  },

  // ── Bloque 4 · tres aserciones viejas que nunca tuvieron quién las acreditara ─
  // Salieron del censo del bloque 4: de las 39 aserciones que el archivo tenía
  // ANTES de traducirse (hoy `invariants.ts`, 42), 20
  // tenían mutante y 19 no. Estas tres son las que tenían mutación PLAUSIBLE de
  // una línea; de las otras dieciséis, diez son la misma aserción sobre otro
  // miembro de una familia ya acreditada y seis no tienen mutación que las aísle
  // — las seis van con nombre y apellido en el encabezado de `invariants.ts`.
  {
    id: "M43",
    garantía: "el barrido 15×6 recorre SEIS formas, y duplicar una no pasa",
    cambios: [[`  "grid",\n  "fields",`, `  "grid",\n  "grid",\n  "fields",`]],
    espera: /SHAPES no longer has 6 shapes/,
    nota: "`_SixShapes` era la única mitad de DOMAIN_PROOFS sin fila propia. Se DUPLICA una forma en vez de borrarla porque borrar dispara primero `_ArrayCoversShapes` (que es M2) y la fila acreditaría la otra aserción: un duplicado sigue satisfaciendo el `satisfies` y sigue cubriendo las seis, así que lo único que se mueve es la longitud. Sin la aserción: NO ROMPÍA",
  },
  {
    id: "M44",
    garantía: "la pareja obligatoria RESTRINGE: text_span ⇒ code sigue sin compilar",
    cambios: [[`  code: "verbatim",\n  formula: "verbatim",`, `  formula: "verbatim",`]],
    espera: /RoleFor<text_span> admits code/,
    nota: "M8 acredita la MITAD de PAIR_PROOFS («las claves siguen siendo roles»); la otra mitad —que además restrinjan— no tenía fila. Sacar `code` de `REQUIRED_SHAPE` no rompe el `satisfies`, no deja imports huérfanos y no cambia ninguna firma: `RoleFor<'text_span'>` pasa a admitir `code` y el par que `ILLEGAL_PAIRS` cuenta como ilegal empieza a compilar. Sin la aserción: NO ROMPÍA",
  },
  {
    id: "M45",
    garantía: "sacarle una variante a Coordinate rompe acá (algo citable dejó de serlo)",
    cambios: [[
      `  | { readonly space: "time"; readonly start: number; readonly end: number };`,
      `  ;`,
    ]],
    espera: /Coordinate lost a space/,
    nota: "M25 guarda la dirección «entró una variante»; esta guarda «se fue una», y son fallas distintas. Se BORRA la variante en vez de renombrarle el tag a propósito: renombrarlo es un alta y una baja a la vez, dispara también `_SpacesDeclared`, y la fila quedaría acreditando M25 por segunda vez —verificado, con el tag renombrado el árbol sin `_SpacesPresent` seguía rompiendo—. Borrarla deja `_SpacesDeclared` en verde (cuatro espacios caben en cinco) y a `_SpacesPresent` como el único que grita. Sin la aserción: NO ROMPÍA",
  },

  // ── Bloque 3b · D24 · la marca sin productor, y la frontera que la destrabó ─
  // Las tres filas cierran el QUINTO caso de garantía verde y falsa del paquete:
  // `_S5` probaba que la marca separa y NADIE probaba que el productor la usara.
  {
    id: "M46",
    garantía: "R1 — projection.ts no puede alcanzar provenance.ts (la AUTORÍA en la huella)",
    cambios: [[
      `export type HashFn = (preimage: string) => string;`,
      // Calcada de M12c, con su lección: el import tiene que USARSE o `tsc` lo mata
      // con TS6133 antes de que el guardián de fronteras corra, y la fila estaría
      // acreditando al linter. Verificado a mano ANTES de escribir la frontera: con
      // el import puesto y usado, los seis guardianes quedaban VERDES.
      `import type { Authorship } from "./provenance.js";\nexport type _EntraEnLaHuella = Authorship;\nexport type HashFn = (preimage: string) => string;`,
    ]],
    espera: /frontera/i,
    nota: "esta frontera era INESCRIBIBLE hasta el bloque 3b: con `Authorship` en `identity.ts`, el camino projection.ts → shapes.ts → identity.ts ya existía (por `ObjectKey`) y nacía violada. Mover UN tipo es lo que la vuelve escribible, y es la única razón por la que ese archivo existe. Se reancló en este bloque (`authorship.js` → `provenance.js`); sin reanclarla habría fallado RUIDOSA con TS2307 «Cannot find module './authorship.js'», que NO matchea /frontera/i — la lección de M12c",
  },
  {
    id: "M47",
    garantía: "fingerprintOf MARCA la huella: el único productor no puede devolver un string pelado",
    cambios: [
      [
        `): NodeFingerprint =>\n  asNodeFingerprint(sha256(preimageOfFingerprint(body)));`,
        `): string =>\n  sha256(preimageOfFingerprint(body));`,
      ],
      // Sacar la marca deja huérfanos los DOS imports (`NodeFingerprint` y
      // `asNodeFingerprint`) y TS6133/TS6196 mataría la corrida ANTES del testigo:
      // sería el caso M33 otra vez, acreditando al linter. Con esta segunda línea el
      // único error que sale es el de `_FingerprintIsBranded`. Verificado.
      [
        `export type HashFn = (preimage: string) => string;`,
        `export type HashFn = (preimage: string) => string;\nexport type _BrandStillUsed = NodeFingerprint;\nexport const _ctorStillUsed = asNodeFingerprint;`,
      ],
    ],
    espera: /fingerprintOf returns a bare string/,
    nota: "es el estado que el paquete tuvo hasta el bloque 3b, y era exactamente esto: `fingerprintOf` devolvía `string`, ninguna marca de la familia tenía productor tipado, y los siete guardianes en verde. Verificado ANTES de escribir `_FingerprintIsBranded`, con los imports mantenidos en uso para que la corrida no muriera por el linter: NO ROMPÍA",
  },
  {
    id: "M48",
    garantía: "el censo de la familia de hashes no se puede desincronizar del AST",
    cambios: [[
      `// CENSO(numbers.mjs): 6 marcas en la familia + 1 alias, 6 cubiertas por Inhabited`,
      `// CENSO(numbers.mjs): 7 marcas en la familia + 1 alias, 6 cubiertas por Inhabited`,
    ]],
    espera: /the hash family census published by identity\.ts does not match/,
    nota: "es M9c aplicado al otro censo del paquete. La prosa decía «la familia son SEIS» y «esta línea y las seis de invariants.ts se actualizan juntas» desde el bloque 2, y NADIE LO CONTABA — el bloque 4 lo dejó escrito como hueco. Verificado antes del chequeo: mover la cifra pasaba en verde",
  },

  // ── Bloque 3c · la deuda del 3b: el segundo miembro de la frontera, y la ────
  // ── cifra que quedaba sostenida a mano ─────────────────────────────────────
  {
    id: "M49",
    garantía: "R1 — projection.ts no puede alcanzar provenance.ts (la DELEGACIÓN en la huella)",
    cambios: [[
      `export type HashFn = (preimage: string) => string;`,
      // Misma lección que M12c y M46: el import tiene que USARSE o TS6133 mata la
      // corrida antes del guardián de fronteras.
      `import type { DelegationId } from "./provenance.js";\nexport type _EntraEnLaHuella = DelegationId;\nexport type HashFn = (preimage: string) => string;`,
    ]],
    espera: /frontera/i,
    nota: "fila NUEVA, y no es M46 repetida: hasta este bloque `DelegationId` vivía en `identity.ts`, que `projection.ts` YA importa desde D24, así que este mismo mutante pasaba EN VERDE — verificado antes de mudarlo, con los siete guardianes limpios. Es la deuda que el bloque 3b dejó escrita en tres docstrings («su protección pasó de débil a ninguna») y que ninguna fila acreditaba. Va como fila propia y no ampliando M46 a propósito: un mutante que importara los DOS tipos se pondría rojo por `Authorship` solo, y sería indistinguible de M46 — acreditaría la mudanza sin haberla ejercido",
  },
  // ── Deuda del paso 7 · el TERCER miembro de la frontera ────────────────────
  {
    id: "M70",
    garantía: "R1 — projection.ts no puede alcanzar provenance.ts (la PROCEDENCIA en la huella)",
    cambios: [[
      `export type ByteHashFn = (bytes: Uint8Array) => string;`,
      // Misma lección que M46 y M49: el import tiene que USARSE o TS6133 mata la corrida
      // antes de que el guardián de fronteras llegue a mirar.
      `import type { Whence } from "./provenance.js";\nexport type _ProcedenciaEnLaHuella = Whence;\nexport type ByteHashFn = (bytes: Uint8Array) => string;`,
    ]],
    espera: /frontera/i,
    nota: "fila propia y no M46/M49 ampliadas, por la razón que la nota de M49 dejó escrita: un mutante que importara dos de los tres miembros se pondría rojo por el primero y no acreditaría nada del tercero. Es LA garantía de `Whence`, y hoy es la única que puede ponerse roja: la mitad de comportamiento —I19(3), «la misma figura desde dos contenedores da la misma huella»— NO ES FALSIFICABLE mientras el único productor de assets materializados sea el `.docx`, porque `whence` es hermano de `body` y en el sitio de materialización no está ni en alcance léxico. Se midió antes de escribir esta fila. O sea que la ceguera de la huella la impone ACÁ el grafo de módulos, y allá la firma de `fingerprintOf`",
  },
  // ── La máquina de estados · las cuatro respuestas, una fila cada una ───────
  // `DOCUMENT_STATES` vivió ocho meses SIN UNA SOLA FILA, y con razón: eran ocho
  // literales que nadie consultaba. Con `TRANSITIONS` deciden comportamiento, así que
  // cada respuesta que el docstring declara haber tomado necesita poder ponerse roja
  // — la tabla sola no dice qué fila contesta qué pregunta.
  {
    id: "M71",
    garantía: "de `received` solo se sale LEYENDO: no se afirma nada de bytes que nadie miró",
    cambios: [[`  ["received", "recognizing"],`, `  ["received", "indexing"],`]],
    espera: /desde `received` se sale a/,
    nota: "es el atajo que sale solo cuando alguien lee el orden del plan al pie de la letra —«validar en la puerta» es el paso 1— sin ver que con subida prefirmada la API NO TOCA BYTES: cuando nos enteramos de que hay un objeto, ya está en el bucket. Saltar a `indexing` es indexar un archivo del que no sabemos ni el tamaño ni si está cifrado ni si tiene virus",
  },
  {
    id: "M72",
    garantía: "a `rejected` se llega por UN solo lado, porque hay un solo lugar donde se descubre",
    cambios: [[
      `  ["recognizing", "rejected"],`,
      `  ["recognizing", "rejected"],\n  ["received", "rejected"],`,
    ]],
    espera: /a `rejected` se llega desde/,
    nota: "la fila agregada es plausible —«rechazar apenas llega»— y es justamente lo que la subida prefirmada vuelve imposible: en `received` nadie leyó un byte todavía. Un segundo predecesor sería una causa de rechazo que el plan no tiene, y las tres que sí tiene están ubicadas: virus y cifrado en la primera lectura, tamaño en el permiso",
  },
  {
    id: "M73",
    garantía: "un `en_espera` reactivado vuelve a RECONOCER, no a la puerta",
    cambios: [[`  ["on_hold", "recognizing"],`, `  ["on_hold", "received"],`]],
    espera: /desde `on_hold` se sale a/,
    nota: "vuelve a `received` es la lectura ingenua de «se reintenta»: sonaría a empezar de cero. Pero lo que cambió es que existe un adaptador nuevo — el objeto ya está hasheado y escaneado, y su veredicto es del CONTENIDO, así que no caduca. Re-leerlo entero no aprende nada y paga otro escaneo",
  },
  {
    id: "M74",
    garantía: "`partial` NO es terminal: los pendientes se drenan",
    cambios: [[`  ["partial", "indexing"],\n`, ``]],
    espera: /`partial` quedó terminal/,
    nota: "borrar esa fila es la mutación más barata de todas y la que más se parece a una simplificación: el estado sigue existiendo, sigue siendo alcanzable, y todo compila. Lo único que cambia es que un documento con delegaciones pendientes se queda ahí para siempre — contra «no se descarta: queda encolado y el documento se marca `parcial`». Muere por DOS guardianes a la vez, R4 y E5, y eso es correcto: un terminal de más y un drenaje de menos son el mismo error visto de los dos lados",
  },
  {
    id: "M75",
    garantía: "`isTerminal` se DERIVA de la tabla, no la contradice",
    cambios: [[
      `  !TRANSITIONS.some(([from]) => from === state);`,
      `  TRANSITIONS.some(([from]) => from === state);`,
    ]],
    espera: /los terminales son/,
    nota: "una negación caída. La función es la que decide si un worker deja de esperar por un documento, así que invertida hace lo contrario exacto: espera para siempre por los tres que terminaron y abandona los cinco que seguían",
  },
  {
    id: "M76",
    garantía: "`canTransition` respeta la tabla en las DOS direcciones",
    cambios: [[
      `  TRANSITIONS.some(([a, b]) => a === from && b === to);`,
      `  TRANSITIONS.some(([a, b]) => a === from || b === to);`,
    ]],
    espera: /no coincide con la tabla/,
    nota: "un `&&` que se vuelve `||`, y el mutante usa los dos parámetros para no morir con TS6133 acreditando al compilador. Es la función que un worker consulta ANTES de escribir: con `||` deja pasar cualquier salto que toque un estado nombrado, y la tabla pasa a ser decorativa. Lo caza el barrido de los 64 pares, que existe justamente porque la mitad NEGATIVA —qué NO se puede— es la que una implementación permisiva satisface sin que nadie la mire",
  },
  {
    id: "MC13",
    control: true,
    garantía: "editar la prosa del docstring de la máquina de estados no rompe nada",
    cambios: [[
      `LAS CUATRO RESPUESTAS`,
      `LAS CUATRO RESPUESTAS (control MC13)`,
    ]],
    nota: "el par de M71–M76. El docstring de `TRANSITIONS` es el más largo del paquete —lleva las cuatro respuestas, el fail-closed, la resolución de la contradicción del plan y por qué no hay checkpointing— y nada de eso puede decidir comportamiento: si un guardián se pusiera rojo al editarlo, estaría verificando la prosa en vez de la tabla",
  },
  // ── EL RETIRO (canal `folder`, P30) ───────────────────────────────────────
  // Tres filas para un campo, y no es desproporcionado: `retiredAt` entró VERDE —se
  // podía borrar entero sin que nada se pusiera rojo, que es el modo de falla que la
  // deuda del paso 7 dejó documentado— y las tres cosas que decide son distintas.
  {
    id: "M77",
    garantía: "`retiredAt` admite `null`, o sea que «vigente» es expresable",
    cambios: [[`  readonly retiredAt: Instant | null;`, `  readonly retiredAt: Instant;`]],
    espera: /Ingestion\.retiredAt stopped admitting null/,
    nota: "es la mutación que sale sola al leer el tipo sin leer el docstring: un campo nulable parece un campo opcional mal escrito, y sacarle el `| null` parece limpieza. Lo que hace es volver IRREPRESENTABLE el estado normal — `null` no es «falta el dato» acá, es la vida entera de la mayoría de los documentos—, así que todo documento nacería retirado y el canal `folder` retiraría el corpus completo en su primer barrido",
  },
  {
    id: "M78",
    garantía: "`retiredAt` lleva CUÁNDO, no si",
    cambios: [[`  readonly retiredAt: Instant | null;`, `  readonly retiredAt: boolean | null;`]],
    espera: /Ingestion\.retiredAt stopped being an Instant/,
    nota: "«un documento está retirado o no está: eso es un booleano» es un razonamiento correcto sobre el hecho y equivocado sobre el campo. La cuarentena vence del lado del servidor y necesita el instante; con un booleano habría que guardar el timestamp AL LADO, y dos campos que tienen que concordar son la clase de dato que se desincroniza — el mismo argumento por el que `isTerminal` se deriva en vez de escribirse",
  },
  {
    id: "M79",
    garantía: "el retiro tiene UNA representación: el campo, y no además un estado",
    cambios: [[`  "on_hold",\n] as const;`, `  "on_hold",\n  "retired",\n] as const;`]],
    espera: /el retiro aparece como estado/,
    nota: "es la forma que el plan tenía escrita —«pasa a estado `retirado`»— y por eso la fila existe: la mutación no es un error de tipeo, es la decisión anterior volviendo. Muere por TRES guardianes a la vez (E2 lo ve huérfano, E3 inalcanzable, E7 lo nombra) y eso está bien: el estado huérfano y el retiro duplicado son el mismo error visto desde ángulos distintos. E7 es el único que dice CUÁL es la decisión y dónde vive la otra mitad, y por eso es el que se espera",
  },
  {
    id: "M50",
    garantía: "la cifra de llamadas a NotAssignableTo no se puede desincronizar del AST",
    cambios: [[
      ` * CENSO(numbers.mjs): 14 llamadas a NotAssignableTo, 14 con mensaje propio`,
      ` * CENSO(numbers.mjs): 9 llamadas a NotAssignableTo, 9 con mensaje propio`,
    ]],
    espera: /the NotAssignableTo census published by invariants\.ts does not match/,
    nota: "es la cifra VIEJA, literal: el docstring decía «las nueve» hasta el bloque 3b, se recontó a mano y eran diez, y la MISMA frase seguía diciendo «las nueve pasan el suyo» dos párrafos más arriba — o sea que la corrección a mano arregló una de las dos apariciones y dejó la otra mintiendo. Escribir cualquiera de las dos de nuevo tiene que ser imposible. Es M9c/M48 aplicado al tercer censo del paquete. El ancla se reancló en el paso 5 (12→14, por el invariante 12): sin reanclarla el corredor falla RUIDOSO —«el texto a mutar aparece en 0 archivos»—, que es como tiene que fallar un mutante podrido y es exactamente como falló",
  },
  {
    id: "M51",
    garantía: "ningún guardián puede quedarse fuera de la cadena de `lint`",
    cambios: [[
      `node scripts/numbers.mjs && node scripts/mutants.mjs`,
      `node scripts/mutants.mjs`,
    ]],
    espera: /guardian left out of `lint`/,
    nota: "primera fila que muta `package.json`, y por eso el archivo entra en ARCHIVOS. Es el equivalente de I11a de `packages/emission`, que `ir` no tenía: un guardián que no corre NO AVISA QUE NO CORRIÓ, así que sacarlo de la cadena deja el paquete verde y apaga en silencio todo lo que ese script acredita. La mutación saca justamente a `numbers.mjs`, que es el que sostiene los tres censos. Sin el chequeo: NO ROMPÍA — el corredor armaba su propia cadena a mano en `guardianes()`, ciega a lo que dijera `package.json`. Esa ceguera dejó de existir en la deuda del paso 7 (ver `CADENA`), y con eso M51 pasó a decir MÁS de lo que decía: `boundaries.mjs` exige que todo `scripts/*.mjs` DEL DISCO esté en `lint`, y `CADENA` es `lint` menos el corredor, así que entre las dos sale que todo guardián que existe corre TAMBIÉN bajo mutación. Es lo que faltaba el día que `states.mjs` corría en `lint`, no corría acá, y M71–M76 salieron «NO ROMPIÓ» estando bien",
  },
  {
    id: "M52",
    garantía: "`build` no puede encadenar el corredor de mutación",
    cambios: [[
      // El ancla lleva el guardián ANTERIOR y la comilla de cierre a propósito:
      // `node scripts/numbers.mjs",` a secas aparece DOS veces —en `build` y en el
      // atajo `"numbers"`—, y `ubicar()` lo rechaza. Verificado: la primera versión
      // de esta fila salió «el texto a mutar aparece 2 veces».
      `citations.mjs && node scripts/numbers.mjs",`,
      `citations.mjs && node scripts/numbers.mjs && node scripts/mutants.mjs",`,
    ]],
    espera: /`build` chains the mutation runner/,
    nota: "equivalente de I11b de `packages/emission`. No es una excepción a M51: es la otra mitad. `mutants.mjs` muta los archivos del árbol EN EL LUGAR y `turbo` agenda `lint` y `build` del mismo paquete en paralelo, así que el segundo captura como «original» un archivo que el primero ya mutó. No es hipotético y le pasó a ESTE paquete: dejó ocho archivos de `packages/ir/src` con mutaciones pegadas. `emission` tenía el chequeo desde su bloque 5 y `ir`, que fue el que se lo comió, no",
  },

  // ── Paso 4 · la tabla de cohesión MANDA sobre la red de formas ─────────────
  {
    id: "M56",
    garantía: "donde `COHESION_BY_ROLE` tiene entrada, `cohesionOf` la devuelve",
    cambios: [[
      `  COHESION_BY_ROLE[role] ?? (SOLO_SHAPES.has(shape) ? "solo" : "normal");`,
      `  SOLO_SHAPES.has(shape) ? "solo" : COHESION_BY_ROLE[role] ?? "normal";`,
    ]],
    espera: /la tabla manda y la función no la obedece/,
    nota:
      "TODO EL PESO ESTÁ EN EL `??`, y esta es la única fila del paquete que lo toca. La mutación no " +
      "es absurda: las dos mitades siguen ahí y la expresión se lee igual de bien al derecho que al " +
      "revés. `COHESION_PROOFS` en `invariants.ts` SIGUE VERDE —asevera la TABLA contra `\"solo\"` " +
      "exacto, y la tabla no cambió: cambió quién la consulta— y `tsc` tampoco dice nada, porque el " +
      "tipo de salida es el mismo. Lo que se apaga son las cuatro entradas que NO son `solo`: un " +
      "`heading` con forma `verbatim` deja de ser `lead` y un `caption` sobre un `asset` deja de ser " +
      "`satellite`, o sea que un epígrafe deja de pegarse a su imagen y las dos se indexan como " +
      "fragmentos que nadie recupera. CORRECCIÓN A LA CONSIGNA: el ejemplo que se propuso para esta " +
      "fila era «un `code` con forma `text_span` pasa de `solo` a `normal`», y es FALSO — con el `??` " +
      "invertido ese par sigue dando `solo`, porque `text_span` no está en `SOLO_SHAPES` y la rama " +
      "`else` consulta la tabla igual. Las víctimas reales son los cuatro roles cuya entrada no es " +
      "`solo` (`heading`, `subheading`, `caption`, `footnote`) sobre las DOS formas que sí están en " +
      "`SOLO_SHAPES`: 8 de los 90 pares. Verificado corriendo la mutación",
  },

  // ── Paso 3a · las dos salidas del tramo 5 (PROVISIONAL(#75)) ───────────────
  //
  // Las tres acreditan el mismo hallazgo por sus tres mitades: `Fragment` y
  // `DataRecord` referenciaban `ElementId`, que no existe hasta la reconciliación, y
  // `Fragment` llevaba además un `id` que el tramo 5 no puede derivar. Se
  // parametrizaron por `Ref`, como ya estaba hecho para las migas.
  {
    id: "M53",
    garantía: "el fragmento del tramo 5 no puede llevar un `FragmentId` (H13(a), tercera salida)",
    cambios: [[
      `export type Fragment<Ref> = {\n  /** LIMPIO — las migas no van adentro`,
      `export type Fragment<Ref> = {\n  readonly id: FragmentId;\n  /** LIMPIO — las migas no van adentro`,
    ]],
    espera: /the tramo-5 fragment must not carry a FragmentId/,
    nota: "es el campo TAL COMO ESTABA hasta el paso 3a, restituido: `Fragment` declaraba `id: FragmentId` y nadie lo señalaba porque nadie había intentado producir un fragmento todavía. No es M40 sobre otro tipo: el motivo es distinto y más fuerte —`FragmentId` se DERIVA de `(DocumentId, contextualFingerprint)` y el tramo 5 no tiene documento, así que el id no es de más, es incalculable—. Se muta a `FragmentId` y no a `string` porque acá el tipo SÍ está importado en `outputs.ts` (la lección de M40 al revés). Sin el testigo: NO ROMPÍA",
  },
  {
    id: "M54",
    garantía: "las dos referencias de `Fragment` no se confunden",
    cambios: [[
      `export type LocalFragment = Fragment<LocalId>;`,
      `export type LocalFragment = Fragment<ElementId>;`,
    ]],
    espera: /the two ref spaces of Fragment collapsed/,
    nota: "es el defecto que un tipo genérico HACE POSIBLE y que el tipo plano no tenía: parametrizar mal el alias colapsa los dos extremos del pipeline sin tocar `ElementId` ni `LocalId`, así que `_S6` —la fila que separa los dos espacios de id— sigue EN VERDE. Por eso `_S7` existe y no alcanza con la de identidad",
  },
  {
    id: "M55",
    garantía: "…y las de `DataRecord` tampoco — son la otra salida del MISMO recorrido",
    cambios: [[
      `export type LocalDataRecord = DataRecord<LocalId>;`,
      `export type LocalDataRecord = DataRecord<ElementId>;`,
    ]],
    espera: /the two ref spaces of DataRecord collapsed/,
    nota: "el par de M54, y hace falta porque son DOS tipos parametrizados por separado: acertarle a uno no dice nada del otro, y «un recorrido, dos salidas» (§{Las dos salidas}) es exactamente la promesa de que las dos viajan juntas",
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

  // ── Paso 5 · el adaptador de canal no puede entrar al concurso (invariante 12) ─
  // Las cinco acreditan el corte que el paso 5 le hizo al contrato: `Adapter` se
  // partió en `FileAdapter` (compite por bytes) y `ChannelAdapter` (lo nombra quien
  // lo invoca), y `Unit` en `Unit` / `AuthoredUnit`. Antes del corte las cinco
  // garantías eran frases de docstring, y una de ellas —la autoría de la unidad— era
  // una frase FALSA: el campo existía, era opcional, y no lo leía nadie.
  {
    id: "M57",
    garantía: "un adaptador de canal no es asignable a uno de archivo (no puede entrar al registro)",
    cambios: [[
      `export interface ChannelAdapter<S, E> extends Adapter<S, E> {`,
      `export interface ChannelAdapter<S, E> extends Adapter<S, E> {\n  evidence(probe: Probe): Promise<Evidence>;`,
    ]],
    espera: /a ChannelAdapter became assignable to FileAdapter/,
    nota: "se le agrega `evidence`, que es EXACTAMENTE el miembro que lo separa. `Probe` y `Evidence` viven en este mismo archivo, así que no hay TS2304 que mate la corrida antes del testigo (la lección de M12c). La aserción compara las dos interfaces con el MISMO `S` y el MISMO `E`: con `ChannelAdapter<_, string>` también se pondría verde, pero acreditando que `string` no es `Source` en vez de lo que esta fila afirma. Sin el testigo: NO ROMPÍA",
  },
  {
    id: "M58",
    garantía: "la unidad de un adaptador de ARCHIVO no puede llevar autoría",
    cambios: [[`  readonly signals: S;`, `  readonly ownAuthorship?: { readonly actor: string };\n  readonly signals: S;`]],
    espera: /Unit carries authorship again/,
    nota: "misma ancla que M40 y MC8, y con eso las tres se leen juntas: en `Unit`, `id` es rojo (M40), `trace?` es verde (MC8) y `ownAuthorship?` es rojo. Se muta al campo OPCIONAL porque es la forma exacta que el tipo tenía hasta este paso — y su modo de falla no era un error de tipo sino un silencio: `opaqueOf` mapea `Unit → RawNode` con ocho campos, este no era uno, y la autoría que un adaptador escribiera desaparecía sin un aviso. Sin el testigo: NO ROMPÍA, y de hecho NO ROMPIÓ durante cuatro pasos",
  },
  {
    id: "M59",
    garantía: "la autoría de un adaptador de CANAL es obligatoria",
    cambios: [[
      `export type AuthoredUnit<S> = Unit<S> & {\n  readonly ownAuthorship: RawAuthorship;`,
      `export type AuthoredUnit<S> = Unit<S> & {\n  readonly ownAuthorship?: RawAuthorship;`,
    ]],
    espera: /AuthoredUnit.ownAuthorship became optional/,
    nota: "un signo de interrogación, y es la diferencia entre «cada mensaje trae su autor» y «cada mensaje trae su autor si el autor del adaptador se acordó». Con `?` la corrida compila y atribuye los mensajes a quien invocó la herramienta MCP en vez de a quien los dijo, que es la mitad del valor de la memoria (§{Tramo 3 › Qué sale}). Es la única fila de las cinco que `WithoutKey` no puede escribir: opcional y ausente son la misma clave, y solo `Required` las separa. Sin el testigo: NO ROMPÍA",
  },
  {
    id: "M60",
    garantía: "la entrada del registro no vuelve a ser `unknown` (P14)",
    cambios: [[
      `  recognize(input: Source, ctx: Context): Promise<readonly RawNode[]>;`,
      `  recognize(input: unknown, ctx: Context): Promise<readonly RawNode[]>;`,
    ]],
    espera: /recognize takes unknown again/,
    nota: "restituye P14 tal como estuvo hasta el paso 5. `unknown` en posición de PARÁMETRO no chequea nada, y eso estaba MEDIDO contra el compilador y no supuesto: `recognize(42, ctx)`, `recognize(null, ctx)`, una función y el mensaje de chat pasado al adaptador de `.docx` compilaban las cuatro. El paso 5 no lo arregló, le sacó la premisa —la heterogeneidad del registro ERA el chat—. Dispara las DOS mitades del invariante a la vez, y por eso hace falta M61",
  },
  {
    id: "M61",
    garantía: "la entrada del registro sigue siendo una `Source`, y no solo «algo que no es unknown»",
    cambios: [[`  recognize(input: Source, ctx: Context)`, `  recognize(input: Uint8Array, ctx: Context)`]],
    espera: /recognize stopped taking a Source/,
    nota: "es lo que vuelve NO REDUNDANTE la segunda mitad de la aserción, y la razón por la que las dos se assertean por separado en vez de con `&`. `Uint8Array` no es `unknown`, así que `_RegistryInputIsNotUnknown` queda VERDE y solo se cae `_RegistryInputIsSource`: sin esta fila, M60 dejaría la mitad positiva sin acreditar y nadie notaría que el contrato pasó a exigir el archivo entero en memoria — que es justo lo que `Source` existe para no exigir (PROVISIONAL(C9/#8))",
  },

  // ── Paso 6 · el núcleo decide si un adaptador puede correr (invariante 13) ──
  // Las cuatro sostienen un solo mecanismo: separar «no se intentó» de «se intentó y
  // tocó fondo», dos estados que desde afuera son un `asset` sin hijos y que tienen
  // destinos opuestos. Sin la separación, la foto de un gato vuelve a la cola para
  // siempre.
  {
    id: "M62",
    garantía: "un nombre de capacidad sigue nombrando un campo de `Context`",
    cambios: [[`export const CAPABILITIES = ["perceive"] as const;`, `export const CAPABILITIES = ["percieve"] as const;`]],
    espera: /a Capability stopped naming a Context field/,
    nota: "un TYPO, que es la mutación que de verdad ocurre. Y el modo de falla es el peligroso: el núcleo pregunta por `ctx['percieve']`, lee `undefined`, y `undefined !== null` da VERDADERO — o sea que la capacidad se declara PRESENTE y el adaptador se invoca en un contexto que no puede satisfacerlo. Falla hacia el lado inseguro y sin un aviso. Es la razón entera por la que los dos vocabularios se atan en el tipo en vez de en una tabla",
  },
  {
    id: "M63",
    garantía: "`requires` es el conjunto cerrado y no `string[]`",
    cambios: [[
      `  readonly requires: readonly Capability[];\n  decompose`,
      `  readonly requires: readonly string[];\n  decompose`,
    ]],
    espera: /Adapter.requires widened past the closed set/,
    nota: "el ancla lleva la línea siguiente porque `requires` aparece DOS veces —`Adapter` y `OpaqueAdapter`— y `ubicar()` rechazaría la fila por ambigua. Ensanchado a `string`, un typo deja de ser un error de tipo y pasa a ser un adaptador que no corre nunca: exactamente M62 pero sin testigo",
  },
  {
    id: "M64",
    garantía: "`Context.perceive` admite `null` — un contexto sin modelo es construible",
    cambios: [[`  perceive: PerceiveFn | null;`, `  perceive: PerceiveFn;`]],
    espera: /Context.perceive stopped admitting null/,
    nota: "es la mitad del corte entre el hilo del request y el worker. Sin `null`, el contexto rápido no se puede construir sin un modelo, y «lo pesado no bloquea» vuelve a ser una regla que alguien respeta en vez de algo que ese contexto NO PUEDE hacer. La ausencia de la capacidad no es una degradación: es la forma que toma el corte",
  },
  {
    id: "M65",
    garantía: "el `asset` no vuelve a llevar trabajo pendiente",
    cambios: [[
      `      readonly mime: string;\n      // DOS CAMPOS`,
      `      readonly mime: string;\n      readonly deferred: readonly string[];\n      // DOS CAMPOS`,
    ]],
    espera: /the asset body carries deferred work again/,
    nota: "restituye el campo que el paso 6 borró, y la lápida de `shapes.ts` dice por qué no puede volver: el cuerpo se regenera ENTERO desde los bytes en cada re-ingesta (R3) y está excluido de la huella —tiene que estarlo, o resolver un enriquecimiento movería el id—. Un campo que no toca la identidad y se reescribe de cero cada vez no registra nada: es una nota de planificación guardada adentro del contenido. El censo lo confirmó antes de borrarlo: 3 escrituras, todas vacías, 0 lecturas",
  },

  // ── Bloque 6 · paso 11 · los tres canales del reconciliador y el acuñador ───
  // Los tres campos NO son marcas nominales como M32–M35: son `number` pelado, así
  // que la edición que los mata es otra — volverlos OPCIONALES. Es un carácter, la
  // hace alguien de buena fe para «no romper a los que ya construyen el objeto», y
  // deja los tres canales existiendo y reportando nada. Sin el invariante 14 las tres
  // compilan.
  {
    id: "M66",
    garantía: "`comparisons` es obligatorio — es el único instrumento de `maxComparisons`",
    cambios: [[`  readonly comparisons: number;`, `  readonly comparisons?: number;`]],
    espera: /comparisons became optional or stopped being a count/,
    nota: "el plan declara `maxComparisons` MEDIBLE («se mide: curva tiempo vs tamaño de hueco») y no le deja instrumento; este campo es el instrumento. Opcional, un reconciliador que no lo reporta compila y el tope se elige a ojo, que es lo que «ningún número inventado» prohíbe. Sin el testigo: NO ROMPÍA",
  },
  {
    id: "M67",
    garantía: "`uncompared` es obligatorio — sin él «nunca se trunca en silencio» es falso",
    cambios: [[`  readonly uncompared: number;`, `  readonly uncompared?: number;`]],
    espera: /uncompared became optional or stopped being a count/,
    nota: "agotar el presupuesto NO mueve `byHash` ni `oldNodes`, así que no mueve `anchoring` y el evento de anclaje bajo no se dispara — la promesa del docstring de `maxComparisons` era imposible y el paso 11 la corrigió apoyándola en este campo. Opcional, la corrección se deshace sin tocar la prosa que la anuncia. Sin el testigo: NO ROMPÍA",
  },
  {
    id: "M68",
    garantía: "`ambiguous` es obligatorio — es la única alarma del colapso de identidad",
    cambios: [[`  readonly ambiguous: number;`, `  readonly ambiguous?: number;`]],
    espera: /ambiguous became optional or stopped being a count/,
    nota: "es la única señal que suena en la PRIMERA ingesta, cuando todavía no hay versión anterior contra la cual el anclaje pueda caer. El plan cuenta que el modo de falla ya ocurrió —la huella no cubría `grid`, las 500 filas de una planilla hashearon idénticas y una inserción movió 500 identificadores—, y ese día ninguna métrica de reconciliación existía para avisarlo. Sin el testigo: NO ROMPÍA",
  },
  {
    id: "M69",
    garantía: "`MintFn` devuelve un `ElementId`, no texto cualquiera",
    cambios: [[
      `export type MintFn = () => ElementId;`,
      `export type MintFn = () => string;`,
    ]],
    espera: /MintFn stopped returning an ElementId/,
    nota: "es el par de D24 sobre `fingerprintOf`, del otro lado del contrato: allá el productor de huellas tenía que APLICAR la marca, acá el productor de identidades tiene que DEVOLVERLA. Con `string` cualquier función que produzca texto entra como acuñador y el reconciliador reparte ids sin marca, que es el agujero que `asElementId` existe para tapar. No acredita por casualidad: `ElementId` aparece 12 veces en `invariants.ts`, así que la mutación no deja ningún import huérfano y `TS6133`/`TS6196` no pueden matarla. Sin el testigo: NO ROMPÍA",
  },

  // ── Controles ──────────────────────────────────────────────────────────────
  {
    id: "MC12",
    control: true,
    garantía: "agregarle a ReconciliationMetrics un campo que NO es uno de los tres canales no rompe nada",
    cambios: [[
      `  readonly ambiguous: number;`,
      `  readonly ambiguous: number;\n  /** control MC12 */\n  readonly spare?: number;`,
    ]],
    nota: "el par de M66–M68, y el contraste es exactamente el punto: volver opcional a `comparisons`, `uncompared` o `ambiguous` es ROJO, y agregar un cuarto campo opcional es VERDE. Sin este control las tres filas serían indistinguibles de un invariante que congela la FORMA del objeto, y congelar la forma prohibiría el próximo campo que la degradación honesta necesite. Va opcional y no obligatorio a propósito: uno obligatorio se pondría rojo el día que `reconcile` construya el objeto, y un control que caduca solo es peor que ninguno — es el modo de falla que MC4 documenta haber tenido",
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
    id: "MC1",
    control: true,
    garantía: "reordenar ROLE_BY_SHAPE sin cambiar ningún par no rompe nada",
    cambios: [[
      `  text_span: "paragraph",\n  verbatim: "code",`,
      `  verbatim: "code",\n  text_span: "paragraph",`,
    ]],
  },
  {
    id: "MC2",
    control: true,
    garantía: "un comentario nuevo no rompe nada",
    cambios: [[
      `export type Shape = Body["shape"];`,
      `// control MC2: comentario inocuo\nexport type Shape = Body["shape"];`,
    ]],
  },
  {
    id: "MC3",
    control: true,
    garantía: "reordenar dos campos de la variante grid no cambia el tipo",
    cambios: [[
      `      readonly sheet: string;\n      readonly region: string;`,
      `      readonly region: string;\n      readonly sheet: string;`,
    ]],
    nota: "el par de M24: mover el TAG es rojo, mover un campo es verde",
  },
  {
    id: "MC4",
    control: true,
    garantía: "una marca nueva con etiqueta propia no rompe nada",
    cambios: [[
      `export type Instant = Nominal<string, "Instant">;`,
      `export type Instant = Nominal<string, "Instant">;\nexport type ThumbnailKey = Nominal<string, "ThumbnailKey">;`,
    ]],
    nota: "el par de M19/M21: Nominal está abierta a marcas nuevas y cerrada a dos niveles y a etiquetas repetidas. SE MUDÓ DE ANCLA EN EL BLOQUE 3b, de debajo de `CacheKey` a debajo de `Instant`, y el motivo es lo interesante: en la sección de la familia de hashes esta fila ya NO es un control —M48 hace ROJO agregar un miembro sin su `Inhabited` y sin actualizar el censo, que es todo el punto del censo—. O sea que hasta este bloque el corredor tenía una fila que EJERCÍA el agujero del censo y lo declaraba inocuo. En la sección de identificadores el control dice lo mismo que decía y sigue siendo cierto",
  },
  {
    id: "MC5",
    control: true,
    garantía: "reordenar dos campos de Ingestion no cambia el tipo",
    cambios: [[
      `  readonly owner: ActorId;\n  readonly channel: Channel;`,
      `  readonly channel: Channel;\n  readonly owner: ActorId;`,
    ]],
    nota: "el par de M32–M35: cambiarle la MARCA a un campo del envoltorio es rojo, moverlo de lugar es verde",
  },
  {
    id: "MC6",
    control: true,
    garantía: "editar un docstring de projection.ts no mueve ninguna huella",
    cambios: [[
      `/** La preimagen de la huella de un nodo. Pura, sin dependencias, determinística. */`,
      `/** control MC6: la preimagen de la huella de un nodo. */`,
    ]],
    nota: "el par de M39: las canónicas fijan el VOCABULARIO de tokens, no la prosa. Sin este control, una tabla golden demasiado sensible sería indistinguible de una que verifica lo que dice",
  },
  {
    id: "MC7",
    control: true,
    garantía: "reordenar las CLAVES del objeto Evidence no cambia ningún valor",
    cambios: [[
      `  Signature: valueOfEvidence("Signature"),\n  Structure: valueOfEvidence("Structure"),`,
      `  Structure: valueOfEvidence("Structure"),\n  Signature: valueOfEvidence("Signature"),`,
    ]],
    nota: "el par de M42, y es el control que hace que el invariante 11 signifique algo: el orden que decide los seis números es el del ARREGLO, no el del objeto que los expone. Un testigo que también se pusiera rojo acá estaría fijando prosa",
  },
  {
    id: "MC8",
    control: true,
    garantía: "agregarle a Unit un campo que NO es un id no rompe nada",
    cambios: [[`  readonly signals: S;`, `  readonly trace?: string;\n  readonly signals: S;`]],
    nota: "el par de M40, sobre la MISMA ancla y con una sola palabra de diferencia: `id` es rojo, cualquier otro campo es verde. `_UnitHasNoId` asevera `'id' extends keyof Unit`, no «Unit está cerrada» — sin este control, la fila de arriba sería indistinguible de una que congela el tipo entero",
  },
  {
    id: "MC9",
    control: true,
    garantía: "reordenar dos entradas de `COHESION_BY_ROLE` no rompe nada",
    cambios: [[`  heading: "lead",\n  subheading: "lead",`, `  subheading: "lead",\n  heading: "lead",`]],
    nota: "el par de M56: lo que `scripts/cohesion.mjs` fija es el MAPEO —qué devuelve la función donde la tabla tiene entrada— y no el orden en que las entradas están escritas. Sin el control, la propiedad nueva sería indistinguible de una que congela el literal, y congelar el literal es lo que `COHESION_PROOFS` ya hace para los tres atómicos",
  },
  {
    id: "MC10",
    control: true,
    garantía: "agregarle a ChannelAdapter un miembro que NO es `evidence` no rompe nada",
    cambios: [[
      `export interface ChannelAdapter<S, E> extends Adapter<S, E> {`,
      `export interface ChannelAdapter<S, E> extends Adapter<S, E> {\n  readonly channel?: string;`,
    ]],
    nota: "el par de M57, sobre la MISMA ancla: `evidence` es rojo, cualquier otro miembro es verde. `_ChannelIsNotSelectable` asevera la AUSENCIA de un miembro, no que la interfaz esté congelada — y esa diferencia es la que deja crecer el adaptador de canal sin tocar el invariante. Sin este control, la fila de arriba sería indistinguible de una que prohíbe extender el tipo",
  },
  {
    id: "MC11",
    control: true,
    garantía: "agregarle al `asset` un campo que NO es trabajo pendiente no rompe nada",
    cambios: [[
      `      readonly mime: string;\n      // DOS CAMPOS`,
      `      readonly mime: string;\n      readonly trace?: string;\n      // DOS CAMPOS`,
    ]],
    nota: "el par de M65, sobre la MISMA ancla: `deferred` es rojo, cualquier otro campo es verde. `_AssetCarriesNoPendingWork` asevera la ausencia de UNA clave, no que la variante esté congelada — es la misma pareja que M40/MC8 sobre `Unit` y M57/MC10 sobre `ChannelAdapter`",
  },
];

// Dónde vive cada mutación se deduce de su primer `buscar`, así que no hay que
// mantener la ruta al día por separado.
const ARCHIVOS = [
  "src/shapes.ts",
  "src/classification.ts",
  "src/params.ts",
  "src/identity.ts",
  // Nace en el bloque 3b como `src/authorship.ts`, con el corte que hace escribible
  // `projection.ts ↛ authorship.ts`, y se renombra en este bloque al mudarse
  // `DelegationId` (la frontera es hoy `projection.ts ↛ provenance.ts`). No aloja
  // ninguna mutación —M46 y M49 mutan `projection.ts`, que es el lado que viola la
  // frontera— y entra igual, por la misma razón que `invariants.ts`: `readonly actor:
  // ActorId;` vive acá desde el corte y en `outputs.ts`, así que sin este archivo en
  // la lista el ancla de M35 pasaría a encontrar UN solo archivo y la fila quedaría
  // verde por una razón equivocada.
  "src/provenance.ts",
  "src/location.ts",
  // `salidas.ts` → `outputs.ts` (bloque 3). Ya no entra «solo por M29»: ahora aloja
  // los cuatro agregados de contrato (M32–M35) y el control MC5.
  "src/outputs.ts",
  // Entra en el bloque 3 con M37, M38, M39 y el control MC6.
  "src/projection.ts",
  // `adaptador.ts` → `adapter.ts` (bloque 4). Entra con M40, M41, M42 y los
  // controles MC7 y MC8: es la superficie que van a implementar los doce
  // adaptadores, y hasta este bloque no tenía UNA sola fila.
  "src/adapter.ts",
  // `invariantes.ts` → `invariants.ts` (bloque 4). No aloja ninguna mutación
  // todavía —las filas mutan el CONTRATO y miran si el testigo grita—, pero entra
  // igual: es el archivo donde viven los mensajes que las `espera` de arriba
  // matchean, y tenerlo en la lista es lo que hace que `ubicar()` avise si mañana
  // alguien muta uno de esos mensajes desde dos lados.
  "src/invariants.ts",
  // Entra en el bloque 3c, con M51 y M52. Es el ÚNICO que no es de `src/`, y entra
  // por la misma razón que los demás: aloja una garantía —qué guardianes corre `lint`
  // y cuál NO puede correr `build`— que hasta este bloque no verificaba nadie en `ir`.
  // Sin las dos filas, el chequeo de `boundaries.mjs` sería indistinguible de uno que no
  // puede fallar.
  //
  // Desde la deuda del paso 7 este archivo además DECIDE qué corre el corredor: `CADENA`
  // se deriva de `lint` restándole `mutants.mjs`. Congelada al cargar, a propósito, para
  // que la mutación de M51 no le apague al corredor el mismo guardián que tiene que
  // cazarla — la explicación larga está en el docstring de `CADENA`.
  "package.json",
];

/**
 * LA CADENA QUE CORRE EL CORREDOR SE **DERIVA** DE `lint`, Y NO SE ESCRIBE A MANO.
 *
 * Hasta el paso 7 esta cadena era un literal —los siete guardianes, tipeados acá— y la
 * nota de M51 lo dejó escrito como una propiedad («el corredor arma su propia cadena en
 * `guardianes()` y es ciego a lo que diga `package.json`»). Era un HUECO, no una
 * propiedad, y la máquina de estados lo cobró: `states.mjs` entró en `lint` y en `build`,
 * quedó fuera de este literal, y sus seis filas —M71 a M76, correctas todas— salieron
 * **«NO ROMPIÓ — la garantía se perdió»**. Seis falsos negativos que se leen exactamente
 * igual que seis garantías de verdad rotas, que es la peor forma de fallar que tiene un
 * arnés: el que lo lee sale a arreglar el contrato en vez del arnés.
 *
 * La simetría con M51 es exacta y vale nombrarla. M51 acredita que **ningún guardián
 * puede quedarse fuera de `lint`**. Lo que faltaba es el otro lado: ningún guardián puede
 * quedarse fuera **del corredor**. Un guardián que corre en `lint` pero no bajo mutación
 * no está apagado —se ejecuta, y protege— pero TODO lo que acredita queda sin acreditar,
 * y el arnés miente en la dirección ruidosa. Derivar cierra el hueco en el peldaño 2 de
 * la escalera —no hay dos listas que puedan divergir porque hay UNA— en vez del 3, que
 * sería un `assert` comparando el literal contra `package.json`.
 *
 * SE CONGELA AL CARGAR, Y ESO ES LO QUE SALVA A M51. `package.json` está en `ARCHIVOS`:
 * M51 le SACA `numbers.mjs` a la cadena de `lint` para probar que sacarlo se nota. Si esta
 * derivación leyera el archivo en cada llamada, la mutación de M51 le sacaría `numbers.mjs`
 * también al corredor —o sea, apagaría al guardián que tiene que cazarla— y M51 dejaría de
 * morir. Un módulo de nivel superior se evalúa una sola vez y ANTES de la primera mutación
 * (la corrida base de `guardianes()` está más abajo, y el bucle todavía más), así que lo que
 * se congela es el árbol limpio. Es el mismo razonamiento que `ORIGINALES`.
 */
const CADENA = (() => {
  const { scripts } = JSON.parse(readFileSync(ruta("package.json"), "utf8"));
  const pasos = String(scripts?.lint ?? "")
    .split("&&")
    .map((p) => p.trim())
    .filter(Boolean);
  // El corredor NO se corre a sí mismo, y que él sea el último paso de `lint` no es una
  // convención de estilo: es la única forma de que el resto de la cadena esté verde antes
  // de que alguien mute nada. Si deja de estarlo, la resta de abajo sacaría al guardián
  // equivocado y el corredor quedaría acreditando de menos EN SILENCIO — que es el hueco
  // que este bloque existe para cerrar. Así que se falla ruidoso y acá.
  if (pasos.at(-1) !== "node scripts/mutants.mjs") {
    throw new Error(
      `IR-ERR: el corredor deriva su cadena de \`lint\` restándose a sí mismo, y esperaba\n` +
        `ser el ÚLTIMO paso. El último es: ${pasos.at(-1) ?? "(cadena vacía)"}\n` +
        `Cadena leída: ${pasos.join(" && ")}`,
    );
  }
  // `tsc --noEmit` se reescribe al binario local: `execSync` no pasa por el resolvedor de
  // scripts de pnpm, así que `node_modules/.bin` no está en el PATH del hijo.
  return pasos
    .slice(0, -1)
    .map((p) => (p === "tsc --noEmit" ? "./node_modules/.bin/tsc --noEmit" : p))
    .join(" && ");
})();

const guardianes = () => {
  try {
    const salida = execSync(CADENA, {
      cwd: RAIZ,
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
  // rompió el arnés o el contrato. Es el MISMO bug que `boundaries.mjs` documenta
  // haber arreglado en sí mismo, y el bloque 3 (`salidas.ts` → `outputs.ts`) es el
  // primero donde el caso se ejerce de verdad. Con la lista corrida, además, un
  // mutante que no encuentra su texto es indistinguible de uno podrido.
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
/**
 * LOS IDS SON ÚNICOS, y hasta la deuda del paso 7 nadie lo comprobaba: la lista llegó a
 * tener DOS `MC12` y el corredor imprimió las dos filas sin decir una palabra.
 *
 * No es cosmético, y tiene dos daños distintos. El primero es el atajo de acá abajo:
 * `mutants.mjs MC12` deja de significar «corré ESE mutante» y corre los dos, así que el
 * error de `soloUno()` —el que dice «el texto a mutar aparece N veces»— sale rotulado con
 * un id que no distingue cuál de los dos se pudrió, que es exactamente el diagnóstico que
 * ese mensaje existe para dar. El segundo es la prosa: este paquete referencia filas por
 * id en todos lados —«es M9c aplicado al otro censo», «no es M46 repetida»—, y un id
 * duplicado vuelve esas referencias ambiguas hacia atrás, sobre notas ya escritas.
 *
 * Va antes del filtro y no después: si la lista está mal formada, el atajo tampoco vale.
 *
 * Se acreditó a mano —el corredor no puede mutarse a sí mismo— duplicando un id y viendo
 * salir el rojo. Hacía falta: la primera versión contaba con `!vistos.add(id)`, y `add`
 * devuelve el Set, no un booleano, así que el filtro era constantemente falso y el chequeo
 * pasaba en verde SOBRE LA LISTA DUPLICADA. Un chequeo que no puede fallar es peor que
 * ninguno, porque además ocupa el lugar.
 */
{
  const cuenta = new Map();
  for (const m of MUTANTES) cuenta.set(m.id, (cuenta.get(m.id) ?? 0) + 1);
  const repetidos = [...cuenta].filter(([, n]) => n > 1).map(([id, n]) => `${id} (×${n})`);
  if (repetidos.length > 0) {
    console.error(
      `IR-ERR: ids de mutante repetidos — ${repetidos.join(", ")}\n` +
        "        un id nombra UNA fila: el atajo `mutants.mjs <id>` y las referencias en\n" +
        "        las notas dependen de que así sea",
    );
    process.exit(1);
  }
}

const soloEste = process.argv[2];
const lista = soloEste ? MUTANTES.filter((m) => m.id === soloEste) : MUTANTES;
if (soloEste && lista.length === 0) {
  console.error(`IR-ERR: no existe el mutante «${soloEste}»`);
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
        `IR-ERR: hay otro candado de mutantes en este árbol y NO se puede dar por muerto.\n` +
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
        `IR-ERR: reparé el candado huérfano del pid ${ajeno.pid} y otra corrida se lo llevó\n` +
          `  antes que yo. No sigo: dos corridas a la vez se pisan.`,
      );
      process.exit(1);
    }
    console.error(
      pendientes.length === 0
        ? `IR-AVISO: había un candado HUÉRFANO (pid ${ajeno.pid}, muerto) sin nada pendiente. Lo tomé y sigo.`
        : `IR-AVISO: había un candado HUÉRFANO (pid ${ajeno.pid}, muerto) con ${pendientes.length} archivo(s) sin restaurar.\n` +
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
    `IR-ERR: el árbol NO está verde antes de mutar. Nada de lo que sigue significaría nada.\n` +
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
  console.error(`\nIR-ERR: el árbol quedó ROTO después de restaurar. Revisá con git diff.`);
  process.exit(1);
}

const rompen = lista.filter((m) => !m.control).length;
console.log(
  fallos === 0
    ? `\nmutantes ok (${rompen} garantías acreditadas rompiéndolas, ${lista.length - rompen} controles verdes)`
    : `\nIR-ERR: ${fallos} de ${lista.length} mutantes fallaron`,
);
process.exit(fallos === 0 ? 0 : 1);
