#!/usr/bin/env node
/**
 * EL CORREDOR DE MUTACIÓN DE `intake`. Cero dependencias.
 *
 * Cada garantía de `scripts/invariants.mjs` se ACREDITA ROMPIÉNDOLA: este script aplica
 * la mutación exacta que la rompe y falla si alguna deja de romperse. Una garantía que
 * nunca falló es indistinguible de una que no funciona, y en este paquete el riesgo es
 * peor que en los otros tres — la puerta son diez líneas, así que es fácil escribir un
 * banco que las cumpla sin ejercerlas.
 *
 * ARNÉS COPIADO DE `packages/ir/scripts/mutants.mjs`, la versión de la deuda del paso 7:
 * cadena derivada de `lint`, ids únicos, candado y diario de deshacer. Se copia y no se
 * comparte por la misma razón que `citations.mjs`: un paquete cuyo guardián vive en otro
 * árbol de archivos deja de ser verificable por sí solo.
 */

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
 *   VEZ. Cero o dos veces es un mutante PODRIDO, y eso es un error y no un salteo.
 * - `espera`: un regex sobre la salida. Que falle no alcanza: tiene que fallar POR LA
 *   RAZÓN correcta.
 * - `control`: no rompe nada y tiene que quedar VERDE. Sin controles, una suite donde
 *   todo falla es indistinguible de una donde el compilador está roto.
 */
const MUTANTES = [
  // ── La puerta ─────────────────────────────────────────────────────────────
  {
    id: "T1",
    garantía: "FAIL-CLOSED · un escáner que no contestó no admite",
    cambios: [[
      `  if (gateway.scan === "unavailable") return { kind: "retry" };`,
      `  if (gateway.scan === "unavailable") return { kind: "admitted" };`,
    ]],
    espera: /I2 · con el escáner sin contestar/,
    nota: "es LA fila del paquete. La mutación es exactamente la que sale sola cuando el escáner se cae en producción y hay presión por indexar —«total, casi todo está limpio»— y es irreversible: retractar un fragmento ya vectorizado no es una operación que este pipeline tenga. Muere por I2 y por I5 a la vez, y eso es correcto: un camino de más a `admitted` y un fail-open son el mismo error visto de los dos lados",
  },
  {
    id: "T2",
    garantía: "FAIL-CLOSED · tampoco rechaza",
    cambios: [[
      `  if (gateway.scan === "unavailable") return { kind: "retry" };`,
      `  if (gateway.scan === "unavailable") return { kind: "rejected", reason: "infected" };`,
    ]],
    espera: /I2 · con el escáner sin contestar/,
    nota: "la mitad conservadora del mismo error, y es la que se defiende mejor: «ante la duda, rechazá». Le miente al que subió un archivo sano, y el `reason` que elige —el único que el vocabulario tiene para algo malo— lo acusa de estar infectado. El brazo `retry` existe para que «no sé» no tenga que disfrazarse de ninguno de los dos",
  },
  {
    id: "T3",
    garantía: "un archivo infectado Y cifrado se rechaza por INFECTADO",
    cambios: [[
      `  if (gateway.scan === "infected") return { kind: "rejected", reason: "infected" };\n  if (gateway.scan === "unavailable") return { kind: "retry" };\n  if (gateway.encrypted) return { kind: "rejected", reason: "encrypted" };`,
      `  if (gateway.encrypted) return { kind: "rejected", reason: "encrypted" };\n  if (gateway.scan === "infected") return { kind: "rejected", reason: "infected" };\n  if (gateway.scan === "unavailable") return { kind: "retry" };`,
    ]],
    espera: /I3 · un archivo infectado Y cifrado/,
    nota: "sube `encrypted` al principio, que es el orden que sale de leer el plan en orden («cifrado sin contraseña» va primero en la lista de motivos). No cambia ningún veredicto salvo en las dos filas donde las dos cosas son ciertas, y ahí cambia LO QUE EL USUARIO LEE: «está cifrado» invita a resubirlo con contraseña. Muere además por I4, porque el mismo reordenamiento rechaza sin esperar al escáner",
  },
  {
    id: "T4",
    garantía: "hay UN SOLO camino a `admitted`",
    cambios: [[
      `  if (gateway.encrypted) return { kind: "rejected", reason: "encrypted" };`,
      ``,
    ]],
    espera: /I5 · los caminos a `admitted` son/,
    nota: "borrar la rama es la simplificación que sale sola el día que alguien mide que casi ningún archivo está cifrado. Compila, y el efecto es que un `.docx` protegido con contraseña entra al pipeline: el adaptador no puede abrirlo, cae al piso de texto, y se indexa el envoltorio como si fuera el documento. La fila mide la mitad NEGATIVA —cuántos caminos hay— que es la que una implementación generosa satisface sin que nadie la mire",
  },
  {
    id: "T5",
    garantía: "`unavailable` NO es un motivo de rechazo",
    cambios: [[
      `export const REJECTION_REASONS = ["encrypted", "infected"] as const;`,
      `export const REJECTION_REASONS = ["encrypted", "infected", "unavailable"] as const;`,
    ]],
    espera: /I6 · los vocabularios se cruzan en/,
    nota: "agrandar el vocabulario es lo que hace quien va a escribir la rama que lo produce, y el orden importa: primero el valor, después el código. Con el valor adentro, «rechazado porque el escáner estaba caído» pasa a ser expresable, y el fail-closed de T1/T2 queda a un `if` de distancia. La fila caza el paso previo, que es cuando todavía es gratis",
  },
  // ── El disparador de `en_espera` ──────────────────────────────────────────
  {
    id: "T6",
    garantía: "un adaptador que necesita LEER el objeto sale `undecidable`, no `broken`",
    cambios: [[
      `        return err instanceof ColdOnly\n          ? { kind: "undecidable", needed: err.field }\n          : { kind: "broken", detail: err instanceof Error ? err.message : String(err) };`,
      `        return { kind: "broken", detail: err instanceof Error ? err.message : String(err) };`,
    ]],
    espera: /I8 · el adaptador que necesitaba leer el objeto/,
    nota: "colapsar los dos rechazos en uno es la simplificación honesta —«total, los dos fallaron»— y borra media `PROVISIONAL(C7)`: los cuatro adaptadores de zip pasarían a verse como CUATRO BUGS en vez de como el hueco de diseño que son, así que alguien saldría a arreglar adaptadores que no están rotos. Muere también por I9, que es la fila que dice justamente que no se confunden",
  },
  {
    id: "T7",
    garantía: "los perezosos de una sonda guardada RECHAZAN — no se lee un solo objeto",
    cambios: [[
      `  zipEntries: () => Promise.reject(new ColdOnly("zipEntries")),`,
      `  zipEntries: () => Promise.resolve([]),`,
    ]],
    espera: /I8 · el adaptador que necesitaba leer el objeto/,
    nota: "devolver la lista vacía es la mutación más peligrosa del archivo porque PARECE la más inofensiva: no lee nada, no tira, y compila. Lo que hace es MENTIRLE al adaptador —«este zip no tiene entradas»— así que los cuatro adaptadores de zip devuelven `None` y no rescatan nada EN SILENCIO, que es exactamente la salida que `PROVISIONAL(C7)` marca como inaceptable. Con el rechazo, el mismo caso sale nombrado",
  },
  {
    id: "T8",
    garantía: "el rechazo en frío se distingue por TIPO, no por texto",
    cambios: [[
      `        return err instanceof ColdOnly\n          ? { kind: "undecidable", needed: err.field }`,
      `        return String(err).includes("cold probe")\n          ? { kind: "undecidable", needed: (err as ColdOnly).field }`,
    ]],
    espera: /I9 · una falla se reportó como la otra/,
    nota: "comparar el mensaje es la forma frágil de hacer lo mismo y funciona hasta que alguien edita el texto del error. Peor: un adaptador que tire un error con esa frase adentro —copiada de este mismo archivo por alguien que quiso imitar el patrón— pasaría por `undecidable`, y encima sin `needed`, así que su bug quedaría archivado como limitación de diseño. La clase con el campo adentro es el peldaño 1 donde el `includes` es el 5. " +
      "LA FILA SE ESCRIBIÓ DOS VECES Y LAS DOS LECCIONES VAN JUNTAS. (a) La mutación primera cambiaba SOLO la condición, y sin el `instanceof` que estrecha, `err` volvía a ser `unknown`: moría por `TS18046` y acreditaba al compilador, no al contrato. Muta las DOS líneas y lleva el `as` que el `instanceof` daba gratis. (b) Aun compilando, NO ROMPÍA: sobre los tres dobles que había, distinguir por tipo y por texto daban lo mismo, o sea que la garantía no era falsable. Lo que la volvió falsable es el doble `impostor` de I9 — un `Error` común con el mensaje del rechazo en frío adentro. Una garantía que no se puede romper no es una garantía, y esta fila la descubrió antes de que se creyera acreditada",
  },
  {
    id: "T9",
    garantía: "el barrido devuelve TODOS los brazos, no solo los que reclaman",
    cambios: [[
      `        return e > Evidence.None ? { kind: "claimed", evidence: e } : { kind: "declined" };`,
      `        return e >= Evidence.None ? { kind: "claimed", evidence: e } : { kind: "declined" };`,
    ]],
    espera: /I7 · brazos de `Claim` que ningún doble alcanzó/,
    nota: "un `>` que se vuelve `>=`, y con `Evidence.None` valiendo `-1` eso hace que CUALQUIER evidencia reclame: las tres sondas se encolan para reconocimiento y el barrido deja de ser un filtro. Es la fila que sostiene el «> Ninguna» del plan, media línea que decide si registrar un adaptador nuevo despierta a los que le corresponden o a la tabla entera. " +
      "MUTA EL OPERADOR Y NO BORRA LA COMPARACIÓN, y esa es la lección: la versión primera devolvía `claimed` a secas, lo que dejaba huérfano el import de `Evidence` y la mataba `TS6133` — acreditando al linter en vez de al contrato. Es la regla del repo aplicada de nuevo: si borrar algo orfana un símbolo, se lo muta",
  },
  {
    id: "T10",
    garantía: "el orden de la salida es el de la entrada",
    cambios: [[
      `  Promise.all(\n    probes.map(async (p): Promise<Claim> => {`,
      `  Promise.all(\n    [...probes].reverse().map(async (p): Promise<Claim> => {`,
    ]],
    espera: /I10 · la salida no viene en el orden/,
    nota: "el resultado NO lleva la sonda adentro —a propósito, para que quien llama pagine sobre su propia tabla— así que el emparejamiento es por índice y el orden es parte del contrato. Un reordenamiento no rompe nada visible: las mismas tres respuestas, en otro orden, y el documento que se procesa solo es el equivocado",
  },
  // ── Controles ─────────────────────────────────────────────────────────────
  {
    id: "TC1",
    control: true,
    garantía: "editar la prosa del docstring de la puerta no rompe nada",
    cambios: [[
      `LA PUERTA DEL TRAMO 1`,
      `LA PUERTA DEL TRAMO 1 (control TC1)`,
    ]],
    nota: "el par de T1–T5. El docstring de `admission.ts` es más largo que su código —lleva el fail-closed con su costo, las dos precedencias y por qué el tamaño no está— y nada de eso puede decidir comportamiento: si un guardián se pusiera rojo al editarlo, estaría verificando la prosa en vez de la tabla",
  },
  {
    id: "TC2",
    control: true,
    garantía: "renombrar una variable local del barrido no cambia nada",
    cambios: [[`      const e = await adapter.evidence(`, `      const ev = await adapter.evidence(`], [`        return e > Evidence.None ? { kind: "claimed", evidence: e }`, `        return ev > Evidence.None ? { kind: "claimed", evidence: ev }`]],
    nota: "el par de T6–T10. Sin él, las cinco filas del barrido serían indistinguibles de un guardián que congela el archivo. Muta DOS líneas —la declaración y el uso— porque cambiar una sola no compilaría, y un control que muere por `tsc` no controla nada",
  },
  {
    id: "TC3",
    control: true,
    garantía: "agregarle a `Gateway` un campo que NO decide nada no rompe nada",
    cambios: [[
      `export type Gateway = {\n  readonly scan: ScanVerdict;`,
      `export type Gateway = {\n  /** control TC3 */\n  readonly scannedAt?: string;\n  readonly scan: ScanVerdict;`,
    ]],
    nota: "el complemento de T5: aquel dice que agrandar el VOCABULARIO rompe, y este que agrandar la ENTRADA con algo que la decisión no mira, no. Los dos juntos dicen dónde está la garantía —en qué decide `admit`, no en qué recibe— que es lo que hace que el contrato pueda crecer sin que cada campo nuevo sea una negociación",
  },
];

// Dónde vive cada mutación se deduce de su primer `buscar`, así que no hay que
// mantener la ruta al día por separado.
const ARCHIVOS = ["src/admission.ts", "src/claims.ts"];

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
      `INTAKE-ERR: el corredor deriva su cadena de \`lint\` restándose a sí mismo, y esperaba\n` +
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
      `INTAKE-ERR: ids de mutante repetidos — ${repetidos.join(", ")}\n` +
        "        un id nombra UNA fila: el atajo `mutants.mjs <id>` y las referencias en\n" +
        "        las notas dependen de que así sea",
    );
    process.exit(1);
  }
}

const soloEste = process.argv[2];
const lista = soloEste ? MUTANTES.filter((m) => m.id === soloEste) : MUTANTES;
if (soloEste && lista.length === 0) {
  console.error(`INTAKE-ERR: no existe el mutante «${soloEste}»`);
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
        `INTAKE-ERR: hay otro candado de mutantes en este árbol y NO se puede dar por muerto.\n` +
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
        `INTAKE-ERR: reparé el candado huérfano del pid ${ajeno.pid} y otra corrida se lo llevó\n` +
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
    `INTAKE-ERR: el árbol NO está verde antes de mutar. Nada de lo que sigue significaría nada.\n` +
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
  console.error(`\nINTAKE-ERR: el árbol quedó ROTO después de restaurar. Revisá con git diff.`);
  process.exit(1);
}

const rompen = lista.filter((m) => !m.control).length;
console.log(
  fallos === 0
    ? `\nmutantes ok (${rompen} garantías acreditadas rompiéndolas, ${lista.length - rompen} controles verdes)`
    : `\nINTAKE-ERR: ${fallos} de ${lista.length} mutantes fallaron`,
);
process.exit(fallos === 0 ? 0 : 1);
