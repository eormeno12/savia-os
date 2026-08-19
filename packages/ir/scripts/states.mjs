#!/usr/bin/env node
/**
 * LA MÁQUINA DE ESTADOS DEL DOCUMENTO, sobre su grafo COMPLETO. Cero dependencias.
 *
 * `DOCUMENT_STATES` vivió ocho meses como ocho literales SIN UN SOLO CONSUMIDOR —los
 * ocho aparecían una vez en todo el repo, adentro de su propio arreglo— y sin ninguna
 * fila de mutación. Era una lista, no un contrato: nadie podía romperla porque nadie
 * la usaba. Con `TRANSITIONS` pasa a decidir comportamiento, y este guardián existe
 * para que la afirmación «así se mueve un documento» pueda ponerse roja.
 *
 * LO QUE NO HACE, Y ES LA MISMA DECISIÓN QUE TOMÓ `cohesion.mjs`: no hay una tabla de
 * transiciones esperadas escrita al lado. Eso sería reescribir el contrato en otro
 * archivo, y la copia no puede fallar sin que falle el original. Lo que se verifica son
 * PROPIEDADES DEL GRAFO —cobertura, alcanzabilidad, ausencia de sumideros falsos— más
 * las cuatro respuestas que el docstring de `TRANSITIONS` declara haber tomado. Una
 * propiedad sobrevive a que alguien agregue un estado; una tabla copiada, no.
 *
 * Compila el paquete a un directorio temporal, igual que los otros cuatro: node no
 * resuelve los imports `.js` del fuente a los `.ts` de disco.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const salida = mkdtempSync(join(tmpdir(), "ir-states-"));

try {
  execFileSync(
    join(RAIZ, "node_modules", ".bin", "tsc"),
    ["--outDir", salida, "--noEmit", "false", "--declaration", "false"],
    { cwd: RAIZ, stdio: "inherit" },
  );

  const { DOCUMENT_STATES, TRANSITIONS, canTransition, isTerminal } = await import(
    pathToFileURL(join(salida, "index.js")).href
  );

  let fallas = 0;
  const fallar = (msg) => {
    console.error(`IR-ERR: ${msg}`);
    fallas += 1;
  };

  const estados = new Set(DOCUMENT_STATES);
  const desde = (s) => TRANSITIONS.filter(([a]) => a === s).map(([, b]) => b);

  // ── E1 · NINGUNA TRANSICIÓN NOMBRA UN ESTADO QUE NO EXISTE ─────────────────
  // Va primera porque las demás la presuponen: un destino con un typo produce un
  // estado fantasma que ninguna otra verificación distingue de uno legítimo.
  for (const [a, b] of TRANSITIONS) {
    if (!estados.has(a) || !estados.has(b)) {
      fallar(
        `la transición ${a} → ${b} nombra un estado que no está en DOCUMENT_STATES\n` +
          "        importa porque: un destino con un typo es un estado al que un documento entra\n" +
          "        y del que ninguna transición lo saca — un sumidero que nadie declaró",
      );
    }
  }

  // ── E2 · NINGÚN ESTADO HUÉRFANO ────────────────────────────────────────────
  // Un estado que no aparece en ninguna transición es una etiqueta que nadie puede
  // alcanzar ni abandonar. `partial` fue eso durante ocho meses.
  const nombrados = new Set(TRANSITIONS.flat());
  const huérfanos = DOCUMENT_STATES.filter((s) => !nombrados.has(s));
  if (huérfanos.length > 0) {
    fallar(
      `estados que no aparecen en ninguna transición: ${huérfanos.join(", ")}\n` +
        "        importa porque: el plan declara un estado `parcial` «pero sin canal para llenarlo\n" +
        "        es una etiqueta vacía». Un estado huérfano es exactamente esa etiqueta",
    );
  }

  // ── E3 · TODO ESTADO ES ALCANZABLE DESDE `received` ────────────────────────
  // E2 no alcanza: un par de estados que se apuntan entre sí aparece en la tabla y
  // sigue siendo inalcanzable desde la puerta.
  const alcanzados = new Set(["received"]);
  for (let cambió = true; cambió; ) {
    cambió = false;
    for (const [a, b] of TRANSITIONS) {
      if (alcanzados.has(a) && !alcanzados.has(b)) {
        alcanzados.add(b);
        cambió = true;
      }
    }
  }
  const inalcanzables = DOCUMENT_STATES.filter((s) => !alcanzados.has(s));
  if (inalcanzables.length > 0) {
    fallar(
      `inalcanzables desde \`received\`: ${inalcanzables.join(", ")}\n` +
        "        importa porque: todo documento entra por `received` —el objeto aterriza y nadie lo\n" +
        "        leyó— así que un estado al que no se llega desde ahí no se alcanza nunca",
    );
  }

  // ── E4 · SIN AUTO-TRANSICIONES ─────────────────────────────────────────────
  const bucles = TRANSITIONS.filter(([a, b]) => a === b);
  if (bucles.length > 0) {
    fallar(
      `auto-transiciones: ${bucles.map(([a]) => a).join(", ")}\n` +
        "        importa porque: un paso de un estado a sí mismo no es un paso — es un reintento, y\n" +
        "        los reintentos los cuenta `maxRetries`, no la máquina",
    );
  }

  // ── LAS CUATRO RESPUESTAS, cada una con su fila ────────────────────────────
  // El docstring de `TRANSITIONS` declara haber contestado cuatro preguntas abiertas.
  // La tabla sola no dice CUÁL fila contesta cuál, así que editarla podría revertir
  // una respuesta sin que nada lo nombre. Estas cuatro las nombran.

  // R1 · «¿qué estado tiene un documento guardado pero no escaneado?» → `received`,
  //      y lo único que se sale de ahí es la primera lectura.
  if (desde("received").join(",") !== "recognizing") {
    fallar(
      `desde \`received\` se sale a: ${desde("received").join(", ") || "(ningún lado)"}\n` +
        "        importa porque: `received` significa «el objeto existe y ningún worker lo leyó», y la\n" +
        "        ÚNICA forma de saber algo de esos bytes es leerlos. Una salida directa a otro estado\n" +
        "        sería afirmar algo del contenido sin haberlo mirado",
    );
  }

  // R2 · «¿`rejected` es alcanzable después de `received`?» → sí, y por un solo lado.
  const haciaRejected = TRANSITIONS.filter(([, b]) => b === "rejected").map(([a]) => a);
  if (haciaRejected.join(",") !== "recognizing") {
    fallar(
      `a \`rejected\` se llega desde: ${haciaRejected.join(", ") || "(ningún lado)"}\n` +
        "        importa porque: las dos causas que el plan nombra —virus y cifrado sin contraseña— se\n" +
        "        descubren las dos en la primera lectura. La tercera, el tamaño, se impone en el permiso\n" +
        "        prefirmado y nunca llega a ser un documento. Un segundo predecesor sería una causa que\n" +
        "        el plan no tiene",
    );
  }

  // R3 · «¿`on_hold` va a `received` o a `recognizing`?» → a `recognizing`.
  if (desde("on_hold").join(",") !== "recognizing") {
    fallar(
      `desde \`on_hold\` se sale a: ${desde("on_hold").join(", ") || "(ningún lado)"}\n` +
        "        importa porque: lo que cambió cuando un `en_espera` se reactiva es que existe un\n" +
        "        adaptador nuevo. El objeto ya está hasheado y escaneado, y volver a `received` lo\n" +
        "        re-leería entero para no aprender nada",
    );
  }

  // R4 · «¿`partial` es terminal?» → no.
  if (isTerminal("partial")) {
    fallar(
      "`partial` quedó terminal\n" +
        "        importa porque: un documento con delegaciones pendientes «se indexa de inmediato,\n" +
        "        marcado parcial» y vuelve cuando drena una. Terminal significaría que los pendientes\n" +
        "        no se drenan nunca, y el plan dice lo contrario: «no se descarta: queda encolado»",
    );
  }

  // ── E5 · LOS TERMINALES SE DERIVAN Y SON LOS TRES ──────────────────────────
  const terminales = DOCUMENT_STATES.filter(isTerminal).sort();
  if (terminales.join(",") !== "failed,indexed,rejected") {
    fallar(
      `los terminales son: ${terminales.join(", ")}\n` +
        "        importa porque: de un documento solo se deja de esperar por tres motivos —terminó, no\n" +
        "        pasó, o se rompió—. Un cuarto terminal es un documento que se quedó sin que nadie lo\n" +
        "        declarara, y uno de menos es una espera que no termina",
    );
  }

  // ── E6 · `canTransition` RESPETA LA TABLA, en las dos direcciones ──────────
  // Sin la mitad negativa, la función que devuelve `true` siempre pasa.
  const legales = new Set(TRANSITIONS.map(([a, b]) => `${a}→${b}`));
  for (const a of DOCUMENT_STATES) {
    for (const b of DOCUMENT_STATES) {
      if (canTransition(a, b) !== legales.has(`${a}→${b}`)) {
        fallar(
          `canTransition("${a}", "${b}") no coincide con la tabla\n` +
            "        importa porque: es la función que un worker consulta antes de escribir, así que una\n" +
            "        que dijera `true` a todo dejaría pasar cualquier salto y la tabla sería decorativa",
        );
      }
    }
  }

  // ── E7 · EL RETIRO TIENE UNA SOLA REPRESENTACIÓN ──────────────────────────
  // No es una fila defensiva contra una palabra: es la que impide que el mismo hecho
  // se pueda escribir en DOS lugares que después discrepan. El canal `folder` decide
  // que borrar un archivo RETIRA el documento sin destruirlo (§{Borrar en la carpeta})
  // y eso vive en `Ingestion.retiredAt`, un `Instant` nulable. Si además existiera como
  // estado, un documento podría tener `retiredAt` con valor y `state` en otra cosa —o
  // al revés— y ninguna de las dos lecturas sería la autoridad.
  //
  // E5 YA SE PONDRÍA ROJO con el agregado ingenuo, y esta fila no lo duplica: E5 dice
  // «los terminales cambiaron», que es un síntoma, y manda a contar sumideros. Esta
  // dice cuál es la decisión y dónde vive la otra mitad.
  const RETIRO = ["retired", "retirado"];
  const comoEstado = DOCUMENT_STATES.filter((s) => RETIRO.includes(s));
  if (comoEstado.length > 0) {
    fallar(
      `el retiro aparece como estado: ${comoEstado.join(", ")}\n` +
        "        importa porque: el retiro ya vive en `Ingestion.retiredAt` y como estado sería la\n" +
        "        MISMA cosa escrita dos veces, con dos lecturas que pueden discrepar. Además los ocho\n" +
        "        estados contestan «¿en qué punto del pipeline está?» y el retiro contesta «¿está\n" +
        "        vigente?»: un documento retirado que estaba `indexed` sigue estando indexado. Ver\n" +
        "        GLOSARIO.md, P30",
    );
  }

  if (fallas > 0) process.exit(1);

  console.log(
    `estados ok (${DOCUMENT_STATES.length} estados · ${TRANSITIONS.length} transiciones · ` +
      `${terminales.length} terminales: ${terminales.join(" ")} · ` +
      `${DOCUMENT_STATES.length * DOCUMENT_STATES.length} pares barridos contra la tabla)`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
