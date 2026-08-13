/**
 * Los invariantes del PASO 2, con su guardián ejecutable. Cero dependencias.
 *
 * Hay garantías que ningún tipo expresa porque son de COMPORTAMIENTO del recorrido:
 * que la lista salga plana, que ningún padre apunte hacia adelante, que las migas no
 * salgan de una segunda estructura, que nada se pierda y que dos corridas den lo
 * mismo. Romperlas NO SE VE: un `localParent` de más o una miga de menos produce un
 * árbol distinto que compila, corre y persiste — y recién se nota cuando la curación
 * del cliente aparece colgada del nodo equivocado.
 *
 * Cada invariante de acá se acredita ROMPIÉNDOLO, y desde el bloque 5 eso no es una
 * afirmación sino un comando: `scripts/mutants.mjs` aplica la mutación exacta que
 * rompe cada fila y falla si alguna deja de romperse. Un test que nunca falló es
 * indistinguible de uno que no funciona.
 *
 * Compila `ir` y `emission` a un directorio temporal porque node no resuelve los
 * imports `.js` del código fuente a los `.ts` de disco. `ir` va a
 * `<tmp>/node_modules/@savia-os/ir` para que el import bare de `emission` resuelva
 * como en producción, sin reescribir un solo especificador.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ_IR = resolve(RAIZ, "..", "ir");
const salida = mkdtempSync(join(tmpdir(), "emission-invariants-"));

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
  console.error(
    `EMISSION-ERR: ${invariante}\n` +
      `        ${detalle}\n` +
      `        importa porque: ${porqué}`,
  );
  fallas += 1;
};

try {
  // ── I11 · NINGÚN GUARDIÁN QUEDA FUERA DE LA CADENA ────────────────────────
  // Va PRIMERO y no al final con los otros diez porque es el único que puede
  // invalidar a los demás: un guardián que no corre NO AVISA QUE NO CORRIÓ. Es la
  // falla que `ir/GLOSARIO.md` (sección 6) documenta haber tenido —una lista de renombres
  // que se olvidó de un script— y la única que ningún otro chequeo de este archivo
  // puede ver, porque para verla hay que mirar el `package.json`, no la salida.
  //
  // Cubre las dos formas de perderlo: OMITIRLO de la cadena y NOMBRARLO MAL (un
  // rename a medio hacer deja el nombre viejo, que no está en disco y por lo tanto
  // no aparece en la lista de guardianes). Y cubre `lint` Y `build` por separado,
  // que es el descuido probable: se actualiza uno y se olvida el otro.
  {
    const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
    const enDisco = readdirSync(join(RAIZ, "scripts")).filter((f) => f.endsWith(".mjs")).sort();
    // `lint` los nombra a TODOS: es la cadena de chequeo, y un guardián que no
    // corre no avisa que no corrió.
    const lint = pkg.scripts?.lint ?? "";
    const faltan = enDisco.filter((g) => !lint.includes(`scripts/${g}`));
    if (faltan.length > 0) {
      fallar(
        "I11a · ningún guardián queda fuera de `lint`",
        `\`lint\` no nombra: ${faltan.join(", ")}\n        la cadena dice: ${lint}`,
        "un guardián que no corre no avisa que no corrió: el paquete queda verde y la garantía que ese script acredita deja de existir sin que nada cambie de color",
      );
    }

    // Y `build` NO puede nombrar al corredor de mutación. No es una excepción a
    // I11a: es la otra mitad. `mutants.mjs` edita los archivos del árbol en el
    // lugar y los restaura; `turbo` agenda `lint` y `build` del mismo paquete EN
    // PARALELO, así que si los dos lo encadenan se pisan — el segundo captura como
    // «original» un archivo que el primero ya mutó. Pasó de verdad: dejó ocho
    // archivos de `packages/ir/src` con mutaciones pegadas.
    //
    // La regla de fondo es más simple que la carrera: un build no muta su fuente.
    if ((pkg.scripts?.build ?? "").includes("scripts/mutants.mjs")) {
      fallar(
        "I11b · `build` no puede encadenar el corredor de mutación",
        `la cadena dice: ${pkg.scripts.build}`,
        "muta los archivos del árbol en el lugar, y turbo corre `lint` y `build` en paralelo: se pisan y dejan mutaciones pegadas. Va solo en `lint`",
      );
    }
  }

  const destinoIr = join(salida, "node_modules", "@savia-os", "ir");
  compilar(RAIZ_IR, destinoIr);
  writeFileSync(
    join(destinoIr, "package.json"),
    JSON.stringify({ name: "@savia-os/ir", version: "0.0.0", type: "module", exports: { ".": "./index.js" } }),
  );

  const destinoEmission = join(salida, "emission");
  compilar(RAIZ, destinoEmission);

  const { emit, CASES, CANONICAL_CASE, DELEGATED_CASE, EDITED_HEADING, DANGLING_PARENT } =
    await import(pathToFileURL(join(destinoEmission, "index.js")).href);
  const { isLead, isNode, render } = await import(
    pathToFileURL(join(destinoIr, "index.js")).href
  );

  const sha256 = (preimagen) => createHash("sha256").update(preimagen, "utf8").digest("hex");

  /** Emite y corta si el caso no era emisible: los casos de `CASES` sí lo son. */
  const emitirOMorir = (caso) => {
    const r = emit(caso.nodes, sha256);
    if (!r.ok) {
      fallar(
        `emisión fallida — ${caso.name}`,
        `falla: ${JSON.stringify(r.failure)}`,
        "los casos sintéticos son todos emisibles por construcción",
      );
      return [];
    }
    return r.nodes;
  };

  const porLocal = (nodos) => new Map(nodos.map((n) => [n.local, n]));

  /**
   * La cadena de ancestros por `localParent`, de la RAÍZ hacia el nodo. `null` si
   * la cadena no termina.
   *
   * EL TOPE NO ES DEFENSA CONTRA DATOS, ES DEFENSA CONTRA ESTE GUARDIÁN. Caminar
   * `localParent` sin tope se cuelga cuando la lista tiene un ciclo — y el ciclo es
   * exactamente uno de los defectos que I2 existe para atrapar. Un guardián que se
   * cuelga ante el defecto que busca no falla: no termina, que desde afuera es
   * indistinguible de «todavía está corriendo». Se descubrió rompiendo el emisor a
   * propósito (hoy `M6` de `scripts/mutants.mjs`, todos los nodos con el mismo
   * `LocalId`): el guardián quedó girando quince minutos al 100 % de CPU en vez de
   * reportar.
   */
  const ancestros = (nodo, índice) => {
    const cadena = [];
    let actual = nodo.localParent;
    while (actual !== null && actual !== undefined) {
      if (cadena.length > índice.size) return null;
      const padre = índice.get(actual);
      if (padre === undefined) break;
      cadena.unshift(padre);
      actual = padre.localParent;
    }
    return cadena;
  };

  const texto = (n) => (n === undefined ? null : render(n.body, null));

  // ── I1 · LA LISTA ES PLANA ────────────────────────────────────────────────
  // `container` no lleva hijos y la jerarquía es SOLO `localParent` (§{Tramo 3 › Qué sale} y
  // §{2 · Emisor}). Un payload que anide un nodo rompe la lista plana y vuelve
  // inexpresable la identidad estable por elemento.
  //
  // El conteo es `=== 1`, y las DOS desigualdades importan por razones distintas.
  // «2 o más» es la lista anidada, y hoy es INEXPRESABLE desde este paquete: `Node`
  // no tiene campo donde meter otro `Node` y el chequeo de propiedades en exceso
  // rechaza inventarlo (ver la nota de `M1` en `scripts/mutants.mjs`). «0» sí es
  // alcanzable y es el caso real: la marca es un `symbol`, así que cualquier viaje
  // por JSON la borra en silencio y el nodo deja de ser un `Node` sin que ninguna
  // firma cambie.
  const marcasAnidadas = (valor, vistos) => {
    if (valor === null || typeof valor !== "object" || vistos.has(valor)) return 0;
    vistos.add(valor);
    let n = isNode(valor) ? 1 : 0;
    for (const v of Object.values(valor)) n += marcasAnidadas(v, vistos);
    return n;
  };

  // ── El recorrido de todos los casos ───────────────────────────────────────
  for (const caso of CASES) {
    const nodos = emitirOMorir(caso);
    if (nodos.length === 0 && caso.nodes.length > 0) continue;
    const índice = porLocal(nodos);

    for (const [i, n] of nodos.entries()) {
      // I1
      const marcas = marcasAnidadas(n, new Set());
      if (marcas !== 1) {
        fallar(
          `I1 · la lista es plana — ${caso.name} #${i}`,
          `el nodo emitido contiene ${marcas} marcas nodales (esperado 1: él mismo)`,
          caso.why,
        );
      }

      // I2 · todo `localParent` referencia un `LocalId` EMITIDO ANTES.
      // «Antes» es la mitad que importa: sin ella el grafo puede tener ciclos y
      // ningún recorrido posterior termina.
      if (n.localParent !== null) {
        const anteriores = new Set(nodos.slice(0, i).map((x) => x.local));
        if (!anteriores.has(n.localParent)) {
          fallar(
            `I2 · padre emitido antes — ${caso.name} #${i}`,
            `localParent=${n.localParent} no está entre los ${i} nodos anteriores`,
            "un padre adelantado o inexistente hace cíclico el grafo y despega la curación del nodo real",
          );
        }
      }

      // I3 · LAS MIGAS SON EXACTAMENTE LOS `lead` ABIERTOS EN SU PUNTO.
      // Se re-derivan de la LISTA PLANA (ancestros por `localParent` + `isLead`),
      // que es una segunda fuente independiente de la pila que las produjo. Si el
      // emisor tuviera una estructura aparte para las migas, acá discreparían.
      const cadena = ancestros(n, índice);
      if (cadena === null) {
        fallar(
          `I2 · la cadena de padres termina — ${caso.name} #${i}`,
          `caminar \`localParent\` desde ${n.local} no llega nunca a la raíz`,
          "un ciclo en la lista plana cuelga a todo consumidor que camine el árbol, empezando por este guardián",
        );
        continue;
      }
      const esperadas = cadena
        .filter((a) => isLead(a.role, a.body.shape) && texto(a) !== null)
        .map((a) => ({ ref: a.local, texto: texto(a) }));
      const obtenidas = n.breadcrumbs.map((m) => ({ ref: m.ref, texto: m.text }));
      if (JSON.stringify(esperadas) !== JSON.stringify(obtenidas)) {
        fallar(
          `I3 · migas = los lead abiertos — ${caso.name} #${i}`,
          `esperadas ${JSON.stringify(esperadas)}\n        obtenidas ${JSON.stringify(obtenidas)}`,
          "las migas salen de la misma pila que el padre; si no coinciden hay una segunda estructura que puede discrepar",
        );
      }
    }

    // I4 · NINGÚN NODO SE PIERDE, y salen en orden de lectura.
    if (nodos.length !== caso.nodes.length) {
      fallar(
        `I4 · ningún nodo se pierde — ${caso.name}`,
        `entraron ${caso.nodes.length}, salieron ${nodos.length}`,
        "un nodo que no se emite no existe para el resto del pipeline y desaparece sin que nada se ponga rojo",
      );
    }
    for (const [i, n] of nodos.entries()) {
      if (n.location.anchor !== caso.nodes[i]?.location.anchor) {
        fallar(
          `I4 · orden de lectura — ${caso.name} #${i}`,
          `salió "${n.location.anchor}" donde entró "${caso.nodes[i]?.location.anchor}"`,
          "el reconciliador parte AMBAS listas en tramos por posición; reordenar acá lo rompe todo",
        );
      }
    }

    // I7 · EL ÁRBOL ES EL ESPERADO, escrito a mano por caso. Es el único
    // invariante que compara contra algo EXTERNO al emisor: los otros verifican
    // que la salida sea coherente consigo misma, y una salida puede ser
    // perfectamente coherente y ser el árbol equivocado.
    const árbol = nodos.map((n) =>
      n.localParent === null ? null : (índice.get(n.localParent)?.location.anchor ?? "?"),
    );
    if (JSON.stringify(árbol) !== JSON.stringify(caso.trace)) {
      fallar(
        `I7 · el árbol esperado — ${caso.name}`,
        `esperado ${JSON.stringify(caso.trace)}\n        obtenido ${JSON.stringify(árbol)}`,
        caso.why,
      );
    }

    // I5 · EL RECORRIDO ES DETERMINÍSTICO.
    const otra = emit(caso.nodes, sha256);
    if (!otra.ok || JSON.stringify(otra.nodes) !== JSON.stringify(nodos)) {
      fallar(
        `I5 · determinismo — ${caso.name}`,
        "dos corridas sobre la misma entrada dieron salidas distintas",
        "sin determinismo el reconciliador ve cambios donde no los hubo y mueve ids en cada re-ingesta",
      );
    }

    // I6 · LOS `LocalId` SON ÚNICOS.
    if (índice.size !== nodos.length) {
      fallar(
        `I6 · LocalId únicos — ${caso.name}`,
        `${nodos.length} nodos, ${índice.size} locales distintos`,
        "dos nodos con el mismo local hacen ambiguo el mapa LocalId→ElementId de la reconciliación",
      );
    }
  }

  // ── I7 (bis) · LA TRAZA DEL CASO CANÓNICO ES, LITERALMENTE, LA DEL PLAN ───
  // El chequeo por caso ya corrió arriba; lo que se verifica acá es que el caso
  // canónico siga siendo el ejemplo publicado en §{1 · Ruta} y no una variante que
  // alguien ajustó para que diera.
  {
    const esperada = [null, "Contrato de servicios", "Cláusula primera", "Cláusula primera", "Contrato de servicios", "Cláusula segunda"];
    if (JSON.stringify(CANONICAL_CASE.trace) !== JSON.stringify(esperada)) {
      fallar(
        "I7 · la traza canónica es la que publica el plan (§{2 · Emisor})",
        `el fixture declara ${JSON.stringify(CANONICAL_CASE.trace)}`,
        "si la traza esperada se edita para que el test pase, el test deja de comparar contra el diseño",
      );
    }
  }

  // ── I8 · UN SUBÁRBOL DELEGADO NO PARTICIPA DE LA ESCALA DEL PADRE ─────────
  {
    const nodos = emitirOMorir(DELEGATED_CASE);
    const índice = porLocal(nodos);
    const [contrato, anexo, foto, acta, recibidos, raízDelMarco, vuelta] = nodos;

    // El `level 1` de adentro cuelga del punto de injerto, no de la raíz.
    if (acta?.localParent !== foto?.local) {
      fallar(
        "I8 · el delegado abre su propio scope",
        `"${texto(acta)}" (level 1, delegado) cuelga de ${JSON.stringify(
          acta?.localParent === null ? null : texto(índice.get(acta?.localParent)),
        )}, esperado "${texto(foto)}"`,
        "un título que un modelo encuentra dentro de una página escaneada se mezclaría con los niveles del contrato que lo contiene",
      );
    }
    // «Raíz» adentro de un marco es la raíz DEL MARCO. Sin esto la mutación «el
    // delegado no abre su propio scope» pasa inadvertida: contra un injerto que no
    // es título, la escala de niveles ya frena sola y el piso parece redundante.
    if (raízDelMarco?.localParent !== foto?.local) {
      fallar(
        "I8 · `none` adentro de un marco es la raíz DEL MARCO",
        `"${texto(raízDelMarco)}" cuelga de ${JSON.stringify(
          raízDelMarco?.localParent == null ? null : texto(índice.get(raízDelMarco.localParent)),
        )}, esperado "${texto(foto)}"`,
        "un `.eml` dentro de un `.zip` abstiene siempre: si su raíz fuera la del documento, el subárbol entero se derrama sobre el padre",
      );
    }
    // Y NO cerró el `level 1` de afuera: al bajar, el documento sigue donde estaba.
    if (vuelta?.localParent !== anexo?.local) {
      fallar(
        "I8 · al bajar del delegado se restauran los scopes del padre",
        `"${texto(vuelta)}" cuelga de ${JSON.stringify(
          vuelta?.localParent === null ? null : texto(índice.get(vuelta?.localParent)),
        )}, esperado "${texto(anexo)}"`,
        "si el delegado cerrara los scopes del padre, todo lo que sigue al injerto se reordena",
      );
    }
    // Las migas de adentro llevan los títulos del padre Y el del subárbol.
    const migasDeAdentro = (recibidos?.breadcrumbs ?? []).map((m) => m.text);
    const esperadas = [texto(contrato), texto(anexo), texto(acta)];
    if (JSON.stringify(migasDeAdentro) !== JSON.stringify(esperadas)) {
      fallar(
        "I8 · migas a través de la frontera de delegación",
        `esperadas ${JSON.stringify(esperadas)}, obtenidas ${JSON.stringify(migasDeAdentro)}`,
        "la cita encadenada contrato → página → imagen depende de que la miga cruce la frontera",
      );
    }
  }

  // ── I9 · EL TÍTULO EDITADO: LA RUTA CAMBIA, LA HUELLA NO (§{Por qué esto funciona}) ─────
  {
    const v1 = emit(EDITED_HEADING.v1, sha256);
    const v2 = emit(EDITED_HEADING.v2, sha256);
    if (v1.ok && v2.ok) {
      const [, títuloV1, párrafoV1] = v1.nodes;
      const [, títuloV2, párrafoV2] = v2.nodes;
      if (párrafoV1?.hash !== párrafoV2?.hash) {
        fallar(
          "I9 · la ruta no entra en la huella",
          "el párrafo NO cambió y su hash sí: editar el título le movió la identidad",
          "es el peor modo de falla del pipeline: la curación del cliente en esa sección se despega EN SILENCIO (§{Por qué la identidad})",
        );
      }
      if (títuloV1?.hash === títuloV2?.hash) {
        fallar(
          "I9 · el que sí cambió tiene huella distinta",
          "los dos títulos tienen texto distinto y la misma huella",
          "si el título editado anclara igual, el reconciliador no vería nunca una edición",
        );
      }
      const migasV1 = (párrafoV1?.breadcrumbs ?? []).map((m) => m.text);
      const migasV2 = (párrafoV2?.breadcrumbs ?? []).map((m) => m.text);
      if (JSON.stringify(migasV1) === JSON.stringify(migasV2)) {
        fallar(
          "I9 · la ruta sí cambia",
          `las migas del párrafo son iguales en las dos versiones: ${JSON.stringify(migasV1)}`,
          "si no cambiaran, el caso no estaría probando nada",
        );
      }
    }
  }

  // ── I10 · UN PADRE COLGANTE NO ES UNA RAÍZ SILENCIOSA ─────────────────────
  // PENDING(#46): la política elegida es cortar. Lo que este invariante fija —y
  // que sobrevive a cualquier política futura— es que NO puede codificar a lo mismo
  // que «cuelga de la raíz», que es un estado legítimo y frecuente.
  {
    const r = emit(DANGLING_PARENT, sha256);
    if (r.ok !== false) {
      fallar(
        "I10 · el padre colgante falla con un objeto de error",
        `emit devolvió ok=${r.ok}`,
        "degradar a raíz haría que «referencia rota» y «cuelga de la raíz» sean indistinguibles, y la ausencia estaría codificando dos cosas",
      );
    } else if (r.nodes !== undefined) {
      fallar(
        "I10 · el fallo no es asignable al éxito",
        "la variante de fallo trae `nodes`",
        "si el llamador puede leer la salida sin mirar `ok`, la aserción no asegura nada",
      );
    }
  }

  if (fallas > 0) process.exit(1);
  console.log(
    `invariantes ok (${CASES.length} casos sintéticos · I1 plana · I2 padre-antes · ` +
      `I3 migas · I4 nada se pierde · I5 determinismo · I6 locales únicos · ` +
      `I7 traza canónica · I8 delegación · I9 título editado · I10 padre colgante · ` +
      `I11 cadena completa)`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
