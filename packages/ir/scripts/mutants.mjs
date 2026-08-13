#!/usr/bin/env node
// Acredita cada garantía del paquete ROMPIÉNDOLA, y falla si alguna deja de romperse.
//
//   node scripts/mutants.mjs           las 56 mutaciones, ~26 s
//   node scripts/mutants.mjs M8        una sola, para iterar
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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = (r) => resolve(RAIZ, r);

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
  {
    id: "M50",
    garantía: "la cifra de llamadas a NotAssignableTo no se puede desincronizar del AST",
    cambios: [[
      ` * CENSO(numbers.mjs): 10 llamadas a NotAssignableTo, 10 con mensaje propio`,
      ` * CENSO(numbers.mjs): 9 llamadas a NotAssignableTo, 9 con mensaje propio`,
    ]],
    espera: /the NotAssignableTo census published by invariants\.ts does not match/,
    nota: "es la cifra VIEJA, literal: el docstring decía «las nueve» hasta el bloque 3b, se recontó a mano y eran diez, y la MISMA frase seguía diciendo «las nueve pasan el suyo» dos párrafos más arriba — o sea que la corrección a mano arregló una de las dos apariciones y dejó la otra mintiendo. Escribir cualquiera de las dos de nuevo tiene que ser imposible. Es M9c/M48 aplicado al tercer censo del paquete",
  },
  {
    id: "M51",
    garantía: "ningún guardián puede quedarse fuera de la cadena de `lint`",
    cambios: [[
      `node scripts/numbers.mjs && node scripts/mutants.mjs`,
      `node scripts/mutants.mjs`,
    ]],
    espera: /guardian left out of `lint`/,
    nota: "primera fila que muta `package.json`, y por eso el archivo entra en ARCHIVOS. Es el equivalente de I11a de `packages/emission`, que `ir` no tenía: un guardián que no corre NO AVISA QUE NO CORRIÓ, así que sacarlo de la cadena deja el paquete verde y apaga en silencio todo lo que ese script acredita. La mutación saca justamente a `numbers.mjs`, que es el que sostiene los tres censos. Sin el chequeo: NO ROMPÍA — el corredor arma su propia cadena en `guardianes()` y es ciego a lo que diga `package.json`",
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

  // ── Controles ──────────────────────────────────────────────────────────────
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
  // La cadena de `guardianes()` de este archivo está escrita a mano y es ciega a
  // `package.json`, así que sin las dos filas el chequeo nuevo sería indistinguible de
  // uno que no puede fallar.
  "package.json",
];

const guardianes = () => {
  try {
    const salida = execSync(
      `./node_modules/.bin/tsc --noEmit && node scripts/boundaries.mjs && ` +
        `node scripts/projection.mjs && node scripts/geometry.mjs && ` +
        `node scripts/citations.mjs && node scripts/numbers.mjs`,
      { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
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
const soloEste = process.argv[2];
const lista = soloEste ? MUTANTES.filter((m) => m.id === soloEste) : MUTANTES;
if (soloEste && lista.length === 0) {
  console.error(`IR-ERR: no existe el mutante «${soloEste}»`);
  process.exit(1);
}

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
