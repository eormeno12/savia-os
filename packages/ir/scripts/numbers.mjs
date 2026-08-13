/**
 * Los números del paquete: dónde viven y cuántos son. Dos garantías, un scanner.
 *
 * `params.ts` abre diciendo que es «el ÚNICO objeto con valores numéricos de todo el
 * paquete», y apoya la regla en el plan (§{5 · Reconciliador}):
 *
 * > «Un número inventado con precisión falsa es peor que uno declarado como
 * > pendiente.»
 *
 * Esa frase era una PROMESA DE ESTILO, no una propiedad verificada. Nada impedía
 * escribir `export const _CAP = 42;` en `classification.ts` y ver los cuatro
 * comandos en verde — comprobado. Y ahí está el daño: un número suelto no trae
 * unidad, ni qué decide, ni cómo se mediría el definitivo, que son las cuatro cosas
 * que `params.ts` obliga a escribir al lado de cada valor. El que lo lee seis meses
 * después no puede distinguir una constante de contrato de un umbral inventado, que
 * es exactamente la confusión que la regla existe para impedir.
 *
 * Un número que hay que agregar tiene siempre dos salidas legítimas: si decide
 * comportamiento, va a `params.ts` con sus cuatro campos; si es aritmética
 * (`0`, `1`, `-1`), ya está en `PARAMETERS.arithmetic`.
 *
 * LA SEGUNDA GARANTÍA ES LA CIFRA MISMA, y es la que motivó este archivo. La
 * cobertura publicada de la mutación «convertir un pendiente en un número» decía
 * «17 campos en `null`». El árbol sano tiene 18: aplicar la mutación lo baja
 * justo a 17, o sea al número declarado correcto. Un auditor que verificara contra
 * la cifra publicada APROBABA EL ÁRBOL MUTADO Y RECHAZABA EL SANO. Corregir 17→18 a
 * mano deja la misma clase de bug esperando al próximo cambio, así que la cifra se
 * deriva del AST y se contrasta contra la línea `CENSO(numbers.mjs)` del docstring
 * de `params.ts`: si discrepan, esto falla y nombra las dos.
 *
 * Y una tercera, que es la que mata la mutación en su propia línea: un campo
 * anotado `as Pending<T>` tiene que estar en `null`. `Pending<T>` significa «el plan
 * lo declara medible y todavía no lo midió»; un valor ahí es la contradicción
 * exacta que el tipo existe para hacer visible. Cuando se mida de verdad, se borra
 * la anotación y el valor entra como los otros once, con unidad y con cómo se midió.
 *
 * QUÉ NO CUENTA. Un literal numérico en posición de TIPO (`Covers<…, 15, …>` en
 * `invariants.ts`) no es un valor: no puede decidir comportamiento en runtime, que
 * es lo que gobierna la regla de `params.ts`. Fijar 15 y 6 a nivel de tipo es lo
 * contrario de inventar un umbral — es atar el contrato al plan para que quitar un
 * rol rompa el build. La distinción se hace por AST (`ts.isLiteralTypeNode` en el
 * padre), no por heurística.
 *
 * POR QUÉ ESTE ES EL ÚNICO SCRIPT QUE IMPORTA UNA DEPENDENCIA. Los otros tres dicen
 * «cero dependencias» y se las arreglan con expresiones regulares porque buscan
 * imports y citas, que son texto. Un literal numérico NO es texto: `4096` adentro de
 * un comentario, de un string, de un `/[̀-ͯ]/` o de una versión no cuenta,
 * y decidir eso a mano es escribir un lexer de TypeScript incompleto. Un lexer
 * incompleto falla en el modo peor: da verde sobre lo que no supo leer. `typescript`
 * ya es devDependency del paquete —`projection.mjs` ejecuta su binario— así que el
 * scanner de verdad sale gratis, y con él la respuesta es exacta y no aproximada.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** El único archivo donde un número puede vivir. */
const HOGAR = "params.ts";

/** El tipo que marca un parámetro declarado y todavía no medido. */
const PENDIENTE = "Pending";

/** La línea del docstring de `HOGAR` que publica la cifra. */
// «en null» no es adorno: es LA cifra que se publicaba mal. Que se pueda escribir
// junto a «pending» sin mentir lo garantiza el chequeo 2 (todo `Pending<T>` está en
// `null`), así que las dos palabras dicen lo mismo por construcción, y eso es lo que
// se quiere: la cifra que un auditor va a leer y la que el AST deriva son una sola.
const CENSO =
  /CENSO\(numbers\.mjs\):\s*(\d+)\s+numéricos\s*=\s*(\d+)\s+pending en null\s*\+\s*(\d+)\s+con valor/;

// Mismo cuidado que en `boundaries.mjs`: el archivo exento se nombra por STRING. Si
// se renombra y nadie toca esta línea, el guardián deja de eximirlo —eso se nota, el
// build se pone rojo— pero si además alguien "arregla" el rojo agregando el nombre
// nuevo sin borrar el viejo, la exención queda apuntando a la nada. Se chequea acá.
if (!existsSync(join(SRC, HOGAR))) {
  console.error(
    `IR-ERR: el guardián exime a ${HOGAR} y ese archivo no existe\n` +
      "        con la exención colgando, este script no verifica lo que dice verificar",
  );
  process.exit(1);
}

const leer = (archivo) => {
  const texto = readFileSync(join(SRC, archivo), "utf8");
  return {
    texto,
    fuente: ts.createSourceFile(archivo, texto, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS),
    líneas: texto.split("\n"),
  };
};

/**
 * `true` si el literal está en posición de tipo. `15` en `Covers<…, 15, …>` cuelga de
 * un `LiteralTypeNode`; `-1` en posición de tipo cuelga de un unario que cuelga de
 * uno. En posición de valor, el padre es una expresión.
 */
const esLiteralDeTipo = (nodo) => {
  const padre = nodo.parent;
  if (padre === undefined) return false;
  if (ts.isLiteralTypeNode(padre)) return true;
  return ts.isPrefixUnaryExpression(padre) && padre.parent !== undefined && ts.isLiteralTypeNode(padre.parent);
};

/** Literales numéricos EN POSICIÓN DE VALOR, con línea, columna y contexto. */
const númerosDe = (archivo) => {
  const { fuente, líneas } = leer(archivo);
  const hallazgos = [];

  const recorrer = (nodo) => {
    if ((ts.isNumericLiteral(nodo) || ts.isBigIntLiteral(nodo)) && !esLiteralDeTipo(nodo)) {
      const { line, character } = fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente));
      hallazgos.push({
        línea: line + 1,
        columna: character + 1,
        literal: nodo.getText(fuente),
        contexto: (líneas[line] ?? "").trim(),
      });
    }
    ts.forEachChild(nodo, recorrer);
  };

  recorrer(fuente);
  return hallazgos;
};

/**
 * Censo de `HOGAR`: cada campo cuyo valor es un número o un `as Pending<T>`.
 * Es la cifra que el docstring publica, derivada y no transcrita.
 */
const censoDelHogar = () => {
  const { fuente } = leer(HOGAR);
  const pending = [];
  const conValor = [];

  const recorrer = (nodo) => {
    if (ts.isPropertyAssignment(nodo)) {
      let valor = nodo.initializer;
      let anotadoPending = false;

      if (ts.isAsExpression(valor)) {
        const tipo = valor.type;
        if (ts.isTypeReferenceNode(tipo) && tipo.typeName.getText(fuente) === PENDIENTE) {
          anotadoPending = true;
          valor = valor.expression;
        }
      }

      const esNúmero =
        ts.isNumericLiteral(valor) ||
        (ts.isPrefixUnaryExpression(valor) && ts.isNumericLiteral(valor.operand));
      const { line } = fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente));
      const campo = {
        nombre: nodo.name.getText(fuente),
        línea: line + 1,
        enNull: valor.kind === ts.SyntaxKind.NullKeyword,
        texto: valor.getText(fuente),
      };

      if (anotadoPending) pending.push(campo);
      else if (esNúmero) conValor.push(campo);
    }
    ts.forEachChild(nodo, recorrer);
  };

  recorrer(fuente);
  return { pending, conValor };
};

let fallas = 0;

// ── 1 · Ningún literal numérico en posición de valor fuera de `params.ts` ──────

const archivos = readdirSync(SRC)
  .filter((f) => f.endsWith(".ts"))
  .sort();

for (const archivo of archivos) {
  if (archivo === HOGAR) continue;
  for (const n of númerosDe(archivo)) {
    fallas += 1;
    console.error(
      `IR-ERR: numeric literal outside ${HOGAR} — ${archivo}:${n.línea}:${n.columna} «${n.literal}»\n` +
        `        ${n.contexto}\n` +
        `        si decide comportamiento va a ${HOGAR}, con unidad, qué decide y cómo\n` +
        "        se mediría; si es aritmética ya está en PARAMETERS.arithmetic",
    );
  }
}

// ── 2 · Todo campo anotado `as Pending<T>` está en `null` ─────────────────────

const { pending, conValor } = censoDelHogar();

// Canario: si `params.ts` se queda sin números, o la regla se cumple sola porque el
// paquete ya no tiene ninguno, o alguien vació el hogar y los mudó a otro lado. Lo
// segundo lo agarra el barrido de arriba; lo primero vuelve vacuo a este guardián y
// conviene enterarse.
if (pending.length + conValor.length === 0) {
  console.error(
    `IR-ERR: ${HOGAR} no declara ni un campo numérico\n` +
      "        o los parámetros se fueron a otro archivo, o este guardián quedó vacuo",
  );
  process.exit(1);
}

for (const campo of pending) {
  if (campo.enNull) continue;
  fallas += 1;
  console.error(
    `IR-ERR: ${PENDIENTE}<T> field with a value — ${HOGAR}:${campo.línea} «${campo.nombre} = ${campo.texto}»\n` +
      `        ${PENDIENTE}<T> significa «declarado medible y todavía no medido»: un valor acá\n` +
      "        es el número inventado con precisión falsa que §{5 · Reconciliador} prohíbe\n" +
      `        si ya se midió, se borra el «as ${PENDIENTE}<T>» y el valor entra con unidad,\n` +
      "        qué decide y cómo se midió",
  );
}

// ── 3 · La cifra publicada en el docstring coincide con el AST ────────────────

const publicado = CENSO.exec(readFileSync(join(SRC, HOGAR), "utf8"));

if (publicado === null) {
  fallas += 1;
  console.error(
    `IR-ERR: ${HOGAR} no publica la línea «CENSO(numbers.mjs): N numéricos = P pending en null + V con valor»\n` +
      "        sin ella la cifra vuelve a sostenerse a mano, que es como llegó a certificar\n" +
      "        el árbol roto en vez del sano",
  );
} else {
  const [, total, enPending, valuados] = publicado;
  const real = {
    total: pending.length + conValor.length,
    pending: pending.length,
    conValor: conValor.length,
  };
  const dicho = { total: Number(total), pending: Number(enPending), conValor: Number(valuados) };
  if (
    dicho.total !== real.total ||
    dicho.pending !== real.pending ||
    dicho.conValor !== real.conValor
  ) {
    fallas += 1;
    console.error(
      `IR-ERR: the census published by ${HOGAR} does not match the AST\n` +
        `        dice:    ${dicho.total} numéricos = ${dicho.pending} pending en null + ${dicho.conValor} con valor\n` +
        `        el AST:  ${real.total} numéricos = ${real.pending} pending en null + ${real.conValor} con valor\n` +
        "        el AST manda: corregí la línea CENSO(numbers.mjs) del docstring",
    );
  }
}

if (fallas > 0) process.exit(1);

const enNull = pending.filter((c) => c.enNull).length;
console.log(
  `números ok (${pending.length + conValor.length} campos en ${HOGAR}: ` +
    `${pending.length} ${PENDIENTE} —${enNull} en null— y ${conValor.length} con valor; ` +
    `${archivos.length - 1} archivos sin un literal numérico de valor)`,
);
