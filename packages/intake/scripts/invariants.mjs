#!/usr/bin/env node
/**
 * LOS INVARIANTES DEL TRAMO 1, con su guardián ejecutable. Cero dependencias.
 *
 * ESTE PAQUETE NO TIENE GOLDEN, Y ES UNA DECISIÓN. Los otros tres lo tienen porque
 * comparan contra algo EXTERNO al código: una salida puede ser coherente consigo misma
 * y ser el árbol equivocado. Acá el espacio de entrada es FINITO y chico —tres
 * veredictos × dos valores de `encrypted`, seis casos— así que el barrido exhaustivo no
 * es una aproximación al golden: es estrictamente más fuerte. Un golden congela los
 * casos que alguien pensó en poner; el barrido no puede olvidarse de ninguno.
 *
 * LO QUE SE VERIFICA SON LAS DECISIONES NOMBRADAS, no una tabla copiada al lado. Es la
 * misma decisión que tomaron `cohesion.mjs` y `states.mjs`: una copia del contrato en
 * otro archivo no puede fallar sin que falle el original. Lo que se afirma acá es
 * fail-closed, las dos precedencias, y que haya UN solo camino a `admitted`.
 *
 * Compila `ir` e `intake` a un directorio temporal porque node no resuelve los imports
 * `.js` del código fuente a los `.ts` de disco. `ir` va a
 * `<tmp>/node_modules/@savia-os/ir` para que el import bare de `intake` resuelva como
 * en producción, sin reescribir un solo especificador.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ_IR = resolve(RAIZ, "..", "ir");
const salida = mkdtempSync(join(tmpdir(), "intake-invariants-"));

const compilar = (raíz, destino) => {
  mkdirSync(destino, { recursive: true });
  execFileSync(
    join(raíz, "node_modules", ".bin", "tsc"),
    ["--outDir", destino, "--noEmit", "false", "--declaration", "false"],
    { cwd: raíz, stdio: "inherit" },
  );
};

let fallas = 0;
const fallar = (invariante, detalle, porqué) => {
  console.error(`INTAKE-ERR: ${invariante}\n        ${detalle}\n        importa porque: ${porqué}`);
  fallas += 1;
};

try {
  // ── I0 · NINGÚN GUARDIÁN QUEDA FUERA DE LA CADENA ─────────────────────────
  // Va PRIMERO y no con los demás porque es el único que puede invalidar al resto: un
  // guardián que no corre NO AVISA QUE NO CORRIÓ. `boundaries.mjs` ya lo verifica, y
  // se repite acá a propósito —es la falla que `ir/GLOSARIO.md` (sección 6) documenta haber
  // tenido, y la única cuyo costo es que TODAS las otras filas dejen de significar—.
  {
    const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
    const enDisco = readdirSync(join(RAIZ, "scripts")).filter((f) => f.endsWith(".mjs")).sort();
    const lint = pkg.scripts?.lint ?? "";
    const faltan = enDisco.filter((g) => !lint.includes(`scripts/${g}`));
    if (faltan.length > 0) {
      fallar(
        "I0 · un guardián quedó fuera de `lint`",
        `no lo nombra: ${faltan.join(", ")}\n        la cadena dice: ${lint}`,
        "un guardián que no corre no avisa que no corrió: el paquete queda verde y la garantía que ese script acredita deja de existir sin que nada cambie de color",
      );
    }
  }

  const destinoIr = join(salida, "node_modules", "@savia-os", "ir");
  compilar(RAIZ_IR, destinoIr);
  compilar(RAIZ, salida);

  const { REJECTION_REASONS, SCAN_VERDICTS, admit, claimedBy } = await import(
    pathToFileURL(join(salida, "index.js")).href
  );
  const { Evidence } = await import(pathToFileURL(join(destinoIr, "index.js")).href);

  // ═══ LA PUERTA ════════════════════════════════════════════════════════════
  // Los seis casos, generados y no listados: si mañana aparece un cuarto veredicto, el
  // barrido lo incluye solo y las filas de abajo lo juzgan. Una lista escrita a mano se
  // quedaría corta EN SILENCIO, que es la falla que este archivo existe para no tener.
  const CASOS = SCAN_VERDICTS.flatMap((scan) =>
    [false, true].map((encrypted) => ({ gateway: { scan, encrypted }, out: admit({ scan, encrypted }) })),
  );
  const dónde = (c) => `scan=${c.gateway.scan} encrypted=${c.gateway.encrypted}`;

  // ── I1 · LA PUERTA ES TOTAL ────────────────────────────────────────────────
  // Ningún caso cae fuera, y los tres brazos son ALCANZABLES. La segunda mitad es la
  // que impide que las filas de abajo las cumpla una función que devuelve siempre lo
  // mismo: «`unavailable` nunca admite» lo satisface perfectamente rechazar todo.
  {
    const CLASES = ["admitted", "rejected", "retry"];
    const sinBrazo = CASOS.filter((c) => !CLASES.includes(c.out?.kind));
    if (sinBrazo.length > 0) {
      fallar(
        "I1 · un caso de la puerta no cayó en ningún brazo",
        sinBrazo.map((c) => `${dónde(c)} → ${JSON.stringify(c.out)}`).join(" · "),
        "`admit` es total por construcción —tres veredictos por dos booleanos— y un caso sin brazo es un documento que el host no sabe a qué estado mover",
      );
    }
    const alcanzados = new Set(CASOS.map((c) => c.out?.kind));
    const inalcanzables = CLASES.filter((k) => !alcanzados.has(k));
    if (inalcanzables.length > 0) {
      fallar(
        `I1 · brazos inalcanzables: ${inalcanzables.join(", ")}`,
        `alcanzados: ${[...alcanzados].join(", ")}`,
        "sin esta mitad, todo lo de abajo lo cumple una puerta que devuelve siempre lo mismo: «`unavailable` nunca admite» es verdadero si nada se admite nunca",
      );
    }
  }

  // ── I2 · FAIL-CLOSED ───────────────────────────────────────────────────────
  // LA decisión del paquete, y la que más cuesta. Si el escáner no contestó, el
  // documento NO AVANZA y NO SE RECHAZA: se queda en `recognizing` y se reintenta.
  {
    const mal = CASOS.filter((c) => c.gateway.scan === "unavailable" && c.out?.kind !== "retry");
    if (mal.length > 0) {
      fallar(
        "I2 · con el escáner sin contestar, la puerta decidió igual",
        mal.map((c) => `${dónde(c)} → ${c.out?.kind}`).join(" · "),
        "las dos formas de decidir están mal y por motivos distintos: `admitted` es fail-open e indexa contenido que nadie miró —y retractar un fragmento ya vectorizado no es una operación que este pipeline tenga—, y `rejected` le miente al que subió un archivo sano. «Antivirus obligatorio, requisito enterprise» es FALSO bajo cualquier otra política",
      );
    }
  }

  // ── I3 · `infected` GANA SOBRE `encrypted` ─────────────────────────────────
  {
    const c = CASOS.find((x) => x.gateway.scan === "infected" && x.gateway.encrypted);
    if (c?.out?.kind !== "rejected" || c?.out?.reason !== "infected") {
      fallar(
        "I3 · un archivo infectado Y cifrado no se rechazó por infectado",
        `${dónde(c)} → ${JSON.stringify(c?.out)}`,
        "el motivo es lo que el usuario ve, y «está cifrado» INVITA A RESUBIRLO con contraseña — que es exactamente lo que no queremos que haga con un archivo infectado. El orden de las dos primeras ramas de `admit` es lo que lo decide",
      );
    }
  }

  // ── I4 · `unavailable` GANA SOBRE `encrypted` ──────────────────────────────
  // Cubierta por I2, y va igual como fila propia porque nombra la tentación: rechazar
  // por cifrado sin esperar al escáner sale solo —«total, ya sabemos que no entra»—.
  {
    const c = CASOS.find((x) => x.gateway.scan === "unavailable" && x.gateway.encrypted);
    if (c?.out?.kind !== "retry") {
      fallar(
        "I4 · se rechazó por cifrado sin esperar al escáner",
        `${dónde(c)} → ${JSON.stringify(c?.out)}`,
        "es fail-open disfrazado: el veredicto de cifrado se toma sobre metadatos que el propio archivo DECLARA, así que un archivo hostil que miente sobre su bit de cifrado saldría rechazado sin haber pasado por el antivirus, y ese objeto queda en el bucket con la marca equivocada. Primero se sabe si está limpio; después se discute si se puede leer",
      );
    }
  }

  // ── I5 · HAY UN SOLO CAMINO A `admitted` ───────────────────────────────────
  // La mitad NEGATIVA, y sin ella las cuatro de arriba las cumple una puerta generosa.
  {
    const admitidos = CASOS.filter((c) => c.out?.kind === "admitted");
    const ok = admitidos.length === 1 && admitidos[0].gateway.scan === "clean" && !admitidos[0].gateway.encrypted;
    if (!ok) {
      fallar(
        `I5 · los caminos a \`admitted\` son ${admitidos.length}`,
        admitidos.map(dónde).join(" · ") || "(ninguno)",
        "un documento entra al pipeline si y solo si el escáner dijo `clean` Y se puede leer. Cualquier segundo camino es contenido indexado que no pasó por las dos puertas, y es irreversible: ya está vectorizado",
      );
    }
  }

  // ── I6 · LOS DOS VOCABULARIOS SE TOCAN EN UN SOLO VALOR ────────────────────
  // `infected` está en los dos a propósito —es el único veredicto que ES un motivo—, y
  // `clean` y `unavailable` NO pueden ser motivos de rechazo. Sin esta fila, agregar un
  // veredicto y olvidarse de decidir si rechaza pasa en verde.
  {
    const cruce = SCAN_VERDICTS.filter((v) => REJECTION_REASONS.includes(v));
    if (cruce.join(",") !== "infected") {
      fallar(
        `I6 · los vocabularios se cruzan en: ${cruce.join(", ") || "(nada)"}`,
        `veredictos: ${SCAN_VERDICTS.join(", ")} · motivos: ${REJECTION_REASONS.join(", ")}`,
        "`infected` es el ÚNICO veredicto que además es un motivo de rechazo. Que `clean` o `unavailable` aparezcan del otro lado sería decir que un archivo limpio se puede rechazar por estar limpio, o que un escáner caído es culpa del archivo",
      );
    }
  }

  // ═══ EL DISPARADOR DE `en_espera` ═════════════════════════════════════════
  const sonda = (extension) => ({
    extension,
    declaredMime: null,
    size: 100,
    magicBytes: new Uint8Array([1, 2, 3]),
    detectedFormat: null,
  });
  const ORIGEN = { kind: "channel", channel: "frontend" };
  const adaptador = (evidence) => ({ id: "doble", requires: [], evidence, recognize: async () => [] });

  const SONDAS = [sonda("pptx"), sonda("dwg"), sonda("zip")];

  // ── I7 · LOS CUATRO BRAZOS SON ALCANZABLES ─────────────────────────────────
  // Uno por doble, y cada doble es la forma real de su caso: el que reclama mira solo
  // la extensión (frío), el que no puede mira las entradas del zip (caliente), y el
  // roto tira.
  const reclamador = adaptador(async (p) => (p.extension === "pptx" ? Evidence.Extension : Evidence.None));
  const declinador = adaptador(async () => Evidence.None);
  const caliente = adaptador(async (p) => ((await p.zipEntries()).length > 0 ? Evidence.Signature : Evidence.None));
  const roto = adaptador(async () => {
    throw new Error("boom");
  });
  /**
   * EL IMPOSTOR, y no es rebuscado: tira un `Error` común cuyo MENSAJE es exactamente el
   * que produce el rechazo en frío. Es lo que escribe quien copia el patrón de este
   * archivo para señalar «necesito leer» sin usar la clase — o quien reusa el texto en un
   * log. Existe porque sin él, distinguir por TIPO y distinguir por TEXTO dan el mismo
   * resultado sobre los otros tres dobles, o sea que la garantía no sería falsable.
   */
  const impostor = adaptador(async () => {
    throw new Error("cold probe: zipEntries() would read the object");
  });

  const porReclamador = await claimedBy(reclamador, SONDAS, ORIGEN);
  const porDeclinador = await claimedBy(declinador, SONDAS, ORIGEN);
  const porCaliente = await claimedBy(caliente, SONDAS, ORIGEN);
  const porRoto = await claimedBy(roto, SONDAS, ORIGEN);
  const porImpostor = await claimedBy(impostor, SONDAS, ORIGEN);

  {
    const vistos = new Set([
      ...porReclamador.map((c) => c.kind),
      ...porDeclinador.map((c) => c.kind),
      ...porCaliente.map((c) => c.kind),
      ...porRoto.map((c) => c.kind),
    ]);
    const faltan = ["claimed", "declined", "undecidable", "broken"].filter((k) => !vistos.has(k));
    if (faltan.length > 0) {
      fallar(
        `I7 · brazos de \`Claim\` que ningún doble alcanzó: ${faltan.join(", ")}`,
        `vistos: ${[...vistos].join(", ")}`,
        "un brazo que el banco no ejerce es un brazo cuya primera corrida va a ser en producción, y dos de estos cuatro existen justamente para casos que nadie mira hasta que fallan",
      );
    }
  }

  // ── I8 · NO SE LEE UN SOLO OBJETO ──────────────────────────────────────────
  // LA promesa del plan: «se recorre una tabla chica, NO SE LEEN ARCHIVOS de
  // almacenamiento». Acá es estructural —`claimedBy` no recibe `Storage`— y observable:
  // el adaptador que quiso leer sale en `undecidable` DICIENDO QUÉ le faltó.
  {
    const mal = porCaliente.filter((c) => c.kind !== "undecidable" || c.needed !== "zipEntries");
    if (mal.length > 0) {
      fallar(
        "I8 · el adaptador que necesitaba leer el objeto no salió en `undecidable`",
        JSON.stringify(porCaliente),
        "es media `PROVISIONAL(C7)`: o el barrido lee los objetos —y desmiente la afirmación de costo del plan— o los cuatro adaptadores de zip devuelven `None` siempre y no rescatan NADA en silencio, incluido el `.pptx` que el propio plan usa de caso testigo. El tercer camino es este: no leer y no callar",
      );
    }
  }

  // ── I9 · `undecidable` Y `broken` NO SE CONFUNDEN ──────────────────────────
  // Los dos se ven idénticos desde afuera —ninguno reclama— y separarlos es el punto:
  // uno es una limitación conocida del barrido en frío, el otro es un defecto.
  {
    const rotoMal = porRoto.filter((c) => c.kind !== "broken");
    const calienteMal = porCaliente.filter((c) => c.kind === "broken");
    if (rotoMal.length > 0 || calienteMal.length > 0) {
      fallar(
        "I9 · una falla se reportó como la otra",
        `roto→${JSON.stringify(porRoto.map((c) => c.kind))} caliente→${JSON.stringify(porCaliente.map((c) => c.kind))}`,
        "un evidenciador que TIRA es un bug del adaptador y hay que arreglarlo; uno que necesita leer es una limitación de diseño que hay que dimensionar. Confundirlos hace que el bug se vea como limitación, que es la forma más cara de esconderlo",
      );
    }
    // Y LA DISTINCIÓN ES POR TIPO, NO POR TEXTO. Sin esta mitad, `instanceof ColdOnly` y
    // `String(err).includes("cold probe")` son indistinguibles sobre los otros dobles: la
    // garantía existiría en el código y no se podría romper. El impostor la vuelve falsable.
    const impostorMal = porImpostor.filter((c) => c.kind !== "broken");
    if (impostorMal.length > 0) {
      fallar(
        "I9 · una falla se reportó como la otra",
        `impostor→${JSON.stringify(porImpostor)}`,
        "el impostor tira un `Error` común con el MENSAJE del rechazo en frío adentro. Clasificado por texto pasa por `undecidable` —y encima sin `needed`, porque no tiene el campo— así que un bug de adaptador queda archivado como limitación de diseño y nadie lo va a arreglar nunca",
      );
    }
  }

  // ── I10 · EL ORDEN DE LA SALIDA ES EL DE LA ENTRADA ────────────────────────
  // Quien llama pagina sobre su tabla y empareja por índice. Con `Promise.all` el orden
  // se conserva; con un `for await` sobre un `Set`, o con cualquier reordenamiento por
  // velocidad de respuesta, dejaría de conservarse SIN QUE NADA MÁS CAMBIE.
  {
    const esperado = SONDAS.map((s) => (s.extension === "pptx" ? "claimed" : "declined"));
    const obtenido = porReclamador.map((c) => c.kind);
    if (obtenido.join(",") !== esperado.join(",")) {
      fallar(
        "I10 · la salida no viene en el orden de las sondas",
        `esperado: ${esperado.join(", ")}\n        obtenido: ${obtenido.join(", ")}`,
        "el resultado no lleva la sonda adentro: quien llama empareja POR ÍNDICE contra su propia página. Con el orden movido, encolar «la que reclamó» encola otra, y el que se procesa solo es el documento equivocado",
      );
    }
    if (porReclamador.length !== SONDAS.length || porDeclinador.length !== SONDAS.length) {
      fallar(
        "I10 · la salida no tiene una entrada por sonda",
        `${porReclamador.length} y ${porDeclinador.length} contra ${SONDAS.length}`,
        "filtrar acá dejaría a `undecidable` y a `broken` sin observador, y los dos son hallazgos. Quien llama filtra en una línea",
      );
    }
  }

  // ── I11 · DETERMINISMO ─────────────────────────────────────────────────────
  {
    const otra = await claimedBy(reclamador, SONDAS, ORIGEN);
    if (JSON.stringify(otra) !== JSON.stringify(porReclamador)) {
      fallar(
        "I11 · dos corridas del barrido no dan lo mismo",
        `${JSON.stringify(porReclamador)}\n        ${JSON.stringify(otra)}`,
        "el barrido corre en el arranque de cada réplica: si dos réplicas ven cosas distintas sobre la misma tabla, el mismo documento se encola dos veces o ninguna, y cuál de las dos pasa depende de a quién le tocó",
      );
    }
  }

  if (fallas > 0) process.exit(1);

  console.log(
    `invariantes ok (I0 la cadena · I1 la puerta es total · I2 fail-closed · ` +
      `I3 infectado gana a cifrado · I4 el escáner caído gana a cifrado · ` +
      `I5 un solo camino a admitted · I6 los vocabularios se tocan en uno || ` +
      `I7 los cuatro brazos · I8 no se lee un objeto · I9 undecidable ≠ broken · ` +
      `I10 el orden · I11 determinismo)\n` +
      `           ${CASOS.length} casos de puerta barridos = ${SCAN_VERDICTS.length} veredictos × 2 · ` +
      `${SONDAS.length} sondas × 5 dobles`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
