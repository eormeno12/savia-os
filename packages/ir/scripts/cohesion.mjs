#!/usr/bin/env node
/**
 * `cohesionOf` sobre su DOMINIO COMPLETO — los 15 × 6 = 90 pares. Cero dependencias.
 *
 * La estrategia de prueba del plan manda un barrido exhaustivo de esta función
 * («**Exhaustiva** — 15 tipos × 6 formas», §{Estrategia}) y hasta hoy no tenía dueño.
 * Pero un barrido NO es una tabla de 90 respuestas esperadas: eso sería reescribir la
 * función en otro archivo, y la copia no puede fallar sin que falle también el
 * original. Los 90 no son 90 casos — son **el dominio completo sobre el que se verifica
 * UNA afirmación**:
 *
 *     Donde `COHESION_BY_ROLE` tiene entrada, `cohesionOf` la devuelve.
 *
 * TODO EL PESO ESTÁ EN EL `??`. La función es
 * `COHESION_BY_ROLE[role] ?? (SOLO_SHAPES.has(shape) ? "solo" : "normal")`: la tabla
 * MANDA y la red de formas responde donde la tabla calla. Dar vuelta las dos mitades
 * —`SOLO_SHAPES.has(shape) ? "solo" : COHESION_BY_ROLE[role] ?? "normal"`— compila, y
 * `COHESION_PROOFS` en `invariants.ts` SIGUE VERDE, porque asevera la TABLA y la tabla
 * no cambió: cambió quién la consulta. Con el `??` invertido un `heading` con forma
 * `verbatim` deja de ser `lead` y pasa a `solo`, un `caption` sobre un `asset` deja de
 * ser `satellite` —o sea que un epígrafe deja de pegarse a su imagen y se indexa como
 * un fragmento de una línea— y ni el tipo ni la aserción se enteran.
 *
 * ES EL MISMO HUECO QUE `fingerprintOf` DEVOLVIENDO `string`: la aserción prueba el
 * DATO, y nadie prueba al PRODUCTOR.
 *
 * DOS PROPIEDADES QUE SE DESCARTARON, y va dicho para que nadie las reponga:
 * la TOTALIDAD («los 90 pares devuelven una cohesión válida») NO PUEDE FALLAR —la
 * expresión es un `??` sobre un ternario, siempre hay valor y el tipo lo fija— y
 * verificarla sería exactamente la aserción infalseable que el bloque 5 de `emission`
 * borró; la COHERENCIA con `isLead` es esta misma propiedad dicha de otro modo, porque
 * `isLead` está definida COMO `cohesionOf(...) === "lead"`.
 *
 * POR QUÉ UN GUARDIÁN NUEVO Y NO UNA SECCIÓN DE `projection.mjs`. Ese archivo guarda las
 * propiedades de LA PROYECCIÓN —`preimageOfFingerprint`, `similarity`, `render`— y
 * `geometry.mjs` las de las dos funciones de `location.ts`. La cohesión no es ninguna de
 * las dos, y meterla en cualquiera de ellos dejaría el nombre del archivo mintiendo
 * sobre lo que contiene, que es el defecto que E1 de `GLOSARIO.md` existe para impedir.
 * Nace en inglés y se llama como lo que verifica (GLOSARIO.md, sección 6), igual que
 * `numbers.mjs` y `geometry.mjs`. `I11a` obliga a que `lint` lo nombre.
 *
 * Compila el paquete a un directorio temporal porque node no resuelve los imports `.js`
 * del código fuente a los `.ts` de disco.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const salida = mkdtempSync(join(tmpdir(), "ir-cohesion-"));

try {
  execFileSync(
    join(RAIZ, "node_modules", ".bin", "tsc"),
    ["--outDir", salida, "--noEmit", "false", "--declaration", "false"],
    { cwd: RAIZ, stdio: "inherit" },
  );

  const { COHESION_BY_ROLE, ROLES, ROLE_SHAPE_PAIRS, SHAPES, cohesionOf } = await import(
    pathToFileURL(join(salida, "index.js")).href
  );

  let fallas = 0;
  const fallar = (msg) => {
    console.error(`IR-ERR: ${msg}`);
    fallas += 1;
  };

  // ── RED · el dominio es el COMPLETO ────────────────────────────────────────
  // `ROLE_SHAPE_PAIRS` se deriva de las dos listas, así que barrerlo no garantiza que
  // sean 90: garantiza que sean todos los que haya. Lo que hay que atar es que no se
  // encogió — con `ROLES` recortado a un rol, el barrido de abajo sería de 6 pares y
  // seguiría diciendo «ok».
  if (ROLE_SHAPE_PAIRS.length !== ROLES.length * SHAPES.length) {
    fallar(
      `el dominio no es el producto de las dos listas\n` +
        `        ${ROLE_SHAPE_PAIRS.length} pares para ${ROLES.length} roles × ${SHAPES.length} formas\n` +
        "        importa porque: el barrido de abajo recorre `ROLE_SHAPE_PAIRS`, así que un dominio\n" +
        "        encogido lo vuelve verde por no haber mirado — que es el modo de falla que este\n" +
        "        guardián existe para no tener",
    );
  }

  // ── DONDE LA TABLA TIENE ENTRADA, LA FUNCIÓN LA DEVUELVE ───────────────────
  // El contador sale del LOOP y no de una multiplicación: es la lección de M39 en
  // `projection.mjs`, donde el script imprimió «6 preimágenes canónicas» sin haber
  // comparado ninguna porque el bucle no se había insertado. Un contador de cosas que
  // nunca miró es exactamente lo que este archivo no puede permitirse.
  let barridos = 0;
  let conEntrada = 0;
  for (const [role, shape] of ROLE_SHAPE_PAIRS) {
    barridos += 1;
    const enTabla = COHESION_BY_ROLE[role];
    if (enTabla === undefined) continue;
    conEntrada += 1;
    const obtenida = cohesionOf(role, shape);
    if (obtenida === enTabla) continue;
    fallar(
      `la tabla manda y la función no la obedece — (${role}, ${shape})\n` +
        `        \`COHESION_BY_ROLE.${role}\` dice ${JSON.stringify(enTabla)} y \`cohesionOf\` devolvió ${JSON.stringify(obtenida)}\n` +
        "        importa porque: la tabla es la fuente y `SOLO_SHAPES` es la red que responde donde\n" +
        "        la tabla CALLA. Invertir el `??` deja `COHESION_PROOFS` en verde —asevera la tabla,\n" +
        "        y la tabla no cambió— y sin embargo un `caption` sobre un `asset` deja de ser\n" +
        "        `satellite`: el epígrafe se despega de su imagen y las dos se indexan como\n" +
        "        fragmentos que nadie recupera. Es el mismo hueco que probar el dato sin probar al\n" +
        "        productor",
    );
  }

  const esperados = ROLES.filter((r) => COHESION_BY_ROLE[r] !== undefined).length * SHAPES.length;
  if (barridos !== ROLE_SHAPE_PAIRS.length || conEntrada !== esperados) {
    fallar(
      `el barrido no cubrió el dominio\n` +
        `        recorrió ${barridos} de ${ROLE_SHAPE_PAIRS.length} pares y evaluó ${conEntrada} de ${esperados} con entrada\n` +
        "        importa porque: una afirmación sobre «los 90 pares» que en realidad mira menos es\n" +
        "        peor que no tenerla — cuenta como cobertura y no cubre",
    );
  }
  if (conEntrada === 0) {
    fallar(
      "ningún par del dominio tiene entrada en la tabla\n" +
        "        importa porque: con `COHESION_BY_ROLE` vacía la propiedad se cumple VACUAMENTE, y\n" +
        "        `cohesionOf` pasaría a responder solo por forma sin que este guardián lo note",
    );
  }

  if (fallas > 0) process.exit(1);
  console.log(
    `cohesión ok (${barridos} pares barridos = ${ROLES.length} roles × ${SHAPES.length} formas, ` +
      `${conEntrada} con entrada en la tabla)`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
