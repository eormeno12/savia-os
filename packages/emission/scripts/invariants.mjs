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

  // ── I11c/d/e · EL DIARIO DE DESHACER DEL CORREDOR DE MUTACIÓN ─────────────
  // La tercera mitad de I11, y la que cubre el modo de falla que ni I11a ni I11b ven.
  // El corredor muta el árbol EN EL LUGAR, así que lo único que lo hace seguro es que
  // el original de cada archivo esté EN DISCO antes de que el archivo cambie. Un
  // `SIGKILL` —el que `turbo` manda a las tareas concurrentes cuando otra falla— NO
  // EJECUTA NINGÚN HANDLER: un mapa en memoria muere con el proceso y la mutación
  // queda pegada sin nadie que sepa revertirla. Pasó dos veces en dos días:
  // `adapters/src/markdown.ts` con `role: "heading"` puesto, y ocho archivos de
  // `packages/ir/src`.
  //
  // Se mira ACÁ porque el corredor NO PUEDE correrse a sí mismo adentro de su propia
  // cadena —se quita de ella por eso—, así que el único testigo posible de su forma es
  // un guardián que lo lea de disco. Tres formas de perder la propiedad EDITANDO EL
  // CORREDOR, y una fila de mutación por cada una (D1, D2, D3):
  //
  //   (c) que la anotación NO ESTÉ;
  //   (d) que esté DESPUÉS de la mutación — deja una ventana en la que el archivo ya
  //       cambió y el diario todavía no lo sabe, que es el estado exacto que el diario
  //       existe para no tener;
  //   (e) que la sonda de vida dé por MUERTO un pid del que solo duda.
  //       `process.kill(pid, 0)` tira `EPERM` cuando el proceso existe y es de otro
  //       usuario, y los PID se reusan: solo `ESRCH` prueba que no está. Un falso
  //       «muerto» hace que una corrida repare encima de otra VIVA, que es el defecto
  //       que el candado existe para impedir.
  //
  // NO se congela el texto del corredor: se miran esas tres formas y nada más. El
  // control DC1 del propio corredor es el que lo deja verificado.
  {
    const arnés = readFileSync(join(RAIZ, "scripts", "mutants.mjs"), "utf8");
    const anotar = arnés.indexOf(`apuntar(archivo, antes);`);
    const mutar = arnés.indexOf(`writeFileSync(ruta(archivo), antes.replace(buscar, reemplazar), "utf8");`);
    const desde = arnés.indexOf("const vivo = (pid)");
    const hasta = arnés.indexOf("const DIARIO =");
    const sonda = desde === -1 || hasta <= desde ? "" : arnés.slice(desde, hasta);

    if (anotar === -1) {
      fallar(
        "I11c · el corredor de mutación no escribe el original al candado",
        "`scripts/mutants.mjs` no anota el texto de antes en el diario antes de mutar",
        "el candado vuelve a ser un DETECTOR: avisa en la corrida siguiente y deja la reparación para un humano con `git diff`. Un `SIGKILL` no ejecuta handlers, así que el mapa en memoria no es un respaldo de nada",
      );
    } else if (mutar === -1 || anotar > mutar) {
      fallar(
        "I11d · el corredor de mutación muta ANTES de anotar el original",
        "`scripts/mutants.mjs` escribe el archivo mutado y recién después toca el diario",
        "entre las dos escrituras hay un intervalo en el que el archivo YA CAMBIÓ y el candado no lo sabe: morir ahí adentro es indistinguible de no tener diario. El orden es la garantía, no la presencia",
      );
    }

    if (!sonda.includes(`e.code !== "ESRCH"`) || sonda.includes("return false;")) {
      fallar(
        "I11e · el corredor de mutación da por muerto un pid del que solo duda",
        "la sonda de vida del candado no trata `ESRCH` como el ÚNICO errno que prueba la muerte",
        "`process.kill(pid, 0)` tira `EPERM` cuando el proceso existe y es de otro usuario, y los PID se reusan. Un falso «está muerto» hace que dos corridas se pisen —que es el defecto que el candado existe para impedir—; un falso «está vivo» solo cuesta una corrida que no arranca, y eso se arregla a mano",
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

  const {
    emit,
    group,
    reconcile,
    knownVersionOf,
    CASES,
    GROUPING_CASES,
    CANONICAL_CASE,
    DELEGATED_CASE,
    EDITED_HEADING,
    DANGLING_PARENT,
  } = await import(pathToFileURL(join(destinoEmission, "index.js")).href);
  const { asElementId, cohesionOf, isLead, isNode, isRowNode, rank, render } = await import(
    pathToFileURL(join(destinoIr, "index.js")).href
  );

  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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

  // ══════════════════ TRAMO 5 · UN RECORRIDO, DOS SALIDAS (paso 3a) ═════════
  //
  // Los ocho de abajo son de COMPORTAMIENTO, todos escalón ⑤, y eso va dicho y no
  // disimulado: agrupar es comportamiento y ningún tipo puede rechazar «este
  // fragmento agrupó mal». Lo único que sí subió de escalón es la forma del fallo, y
  // ya estaba resuelta un tramo antes.
  for (const caso of GROUPING_CASES) {
    const emitidos = emit(caso.nodes, sha256);
    if (!emitidos.ok) {
      fallar(
        `emisión fallida — ${caso.name}`,
        `falla: ${JSON.stringify(emitidos.failure)}`,
        "los casos de agrupación son todos emisibles por construcción",
      );
      continue;
    }
    // EL TRAMO 5 CORRE DESPUÉS DEL RECONCILIADOR (paso 12). Antes de este paso el
    // banco pasaba `emitidos.nodes` derecho a `group`, y no por decisión: el
    // reconciliador no existía. El plan lo declara al abrir el tramo — «Entra: la
    // lista plana del tramo 4, CON IDENTIDAD y migas».
    //
    // EL ACUÑADOR ES FRESCO POR CASO, y eso es la mitad del invariante y no un
    // detalle: con un contador compartido entre casos, los ids de un caso dependerían
    // de cuántos casos hay arriba, y agregar uno movería las expectativas de todos los
    // demás. Un acoplamiento de orden entre casos es exactamente lo que un banco no
    // puede tener.
    //
    // `knownVersionOf([])` ES LA PRIMERA INGESTA, no un atajo: no hay versión anterior
    // contra la cual comparar, así que los tres pases no corren y los 24 nodos se
    // acuñan. Es el mismo camino que recorre un documento la primera vez que entra.
    let acuñados = 0;
    const reconciliado = reconcile(emitidos.nodes, knownVersionOf([]), {
      mint: () => asElementId(`e${(acuñados += 1)}`),
      // LOS DOS SON PARÁMETROS DEL BANCO y en este camino NO SE LEEN: sin versión
      // anterior no hay una sola comparación de similitud. Van explícitos igual
      // porque el tipo los exige, que es lo que impide que alguien invente un default
      // el día que sí haga falta.
      similarityThreshold: 0.5,
      maxComparisons: 10000,
      previousAdapter: null,
      previousVersion: null,
    });
    if (!reconciliado.ok) {
      fallar(
        `reconciliación fallida — ${caso.name}`,
        `falla: ${JSON.stringify(reconciliado.failure)}`,
        "las tres fallas de `reconcile` son violaciones de CONTRATO, no condiciones de datos: sobre nodos emitidos por `emit` ninguna puede ocurrir",
      );
      continue;
    }
    const nodos = reconciliado.output.nodes;
    const porLocal = new Map(nodos.map((n) => [n.id, n]));
    const g = group(nodos, caso.targetSizeChars);
    const cohesión = (local) => {
      const n = porLocal.get(local);
      return n === undefined ? null : cohesionOf(n.role, n.body.shape);
    };

    // ── I12 · NINGÚN NODO SE PIERDE ─────────────────────────────────────────
    // EL ENUNCIADO LITERAL DEL PLAN ES FALSO Y `ir` YA LO SABÍA. «Un nodo entra
    // entero en algún fragmento, SIEMPRE» (§{El recorrido}) no se cumple para
    // NINGÚN `lead`: un título «no arranca un fragmento con su texto, cierra el
    // anterior y entra a las migas» (§{Los títulos}), así que no está en `nodes` de
    // ninguno. Es textualmente el punto (1) de PROVISIONAL(C15/#50/#73) en
    // `ir/src/outputs.ts`. La forma verificable es «o está en `nodes`, o lo
    // referencia una miga», y lo segundo solo es expresable porque `Breadcrumb`
    // lleva `ref` — la mitad que el bloque 3 de `ir` agregó a propósito.
    {
      const apariciones = g.fragments.flatMap((f) => f.nodes);
      const cubiertos = new Set(apariciones);
      const referidos = new Set(g.fragments.flatMap((f) => f.breadcrumbs.map((b) => b.ref)));
      const perdidos = nodos.filter((n) => !cubiertos.has(n.id) && !referidos.has(n.id));
      if (perdidos.length > 0 || apariciones.length !== cubiertos.size) {
        fallar(
          `I12 · ningún nodo se pierde — ${caso.name}`,
          `${nodos.length} nodos, ${apariciones.length} apariciones, ${cubiertos.size} distintas` +
            (perdidos.length > 0
              ? `\n        se perdieron: ${JSON.stringify(perdidos.map((n) => n.location.anchor))}`
              : ""),
          "«no hay ninguna rama que corte» (§{El recorrido}): un nodo que no entra en ningún fragmento ni queda referenciado no existe para la búsqueda, y desaparece sin que nada se ponga rojo",
        );
      }
    }

    // ── I13 · LOS TÍTULOS NO SE DUPLICAN ────────────────────────────────────
    // Un `lead` NO comparte fragmento con nadie. Si entrara al cuerpo de sus
    // descendientes se embebería dos veces —una en el texto y otra en la miga— y
    // volvería el solapamiento que §{Los títulos} declara innecesario. El único
    // fragmento en el que un `lead` puede estar es el suyo propio, y ese caso lo
    // gobierna I14.
    {
      const mezclados = g.fragments.filter(
        (f) => f.nodes.length > 1 && f.nodes.some((l) => cohesión(l) === "lead"),
      );
      if (mezclados.length > 0) {
        fallar(
          `I13 · los títulos no se duplican — ${caso.name}`,
          `${mezclados.length} fragmentos llevan un título adentro del cuerpo: ${JSON.stringify(
            mezclados.map((f) => f.text),
          )}`,
          "el tramo 6 concatena la miga al embeber: si el título además estuviera en el texto, se embebe dos veces por fragmento y el vector queda sesgado hacia el título",
        );
      }
    }

    // ── I14 · UN TÍTULO QUE NO CONTEXTUALIZÓ NADA NO SE EVAPORA ─────────────
    {
      const referidos = new Set(g.fragments.flatMap((f) => f.breadcrumbs.map((b) => b.ref)));
      const huérfanos = nodos.filter(
        (n) => isLead(n.role, n.body.shape) && !referidos.has(n.id),
      );
      const propios = huérfanos.filter((n) =>
        g.fragments.some((f) => igual(f.nodes, [n.id])),
      );
      if (propios.length !== huérfanos.length) {
        fallar(
          `I14 · el título que no contextualizó nada emite su propio fragmento — ${caso.name}`,
          `${huérfanos.length} títulos sin descendencia, ${propios.length} con fragmento propio`,
          "es un caso raro y la única alternativa es perder información en silencio, que §{Estrategia} declara el peor modo de falla",
        );
      }
    }

    // ── I15 · EL TEXTO ES LIMPIO, LAS MIGAS SON DEL PRIMER NODO, Y EL ───────
    //          FRAGMENTO NO CRUZA UNA SECCIÓN
    {
      const sucios = g.fragments.filter((f) =>
        f.breadcrumbs.some((b) => b.text !== "" && f.text.startsWith(b.text)),
      );
      if (sucios.length > 0) {
        fallar(
          `I15 · el texto del fragmento es LIMPIO — ${caso.name}`,
          `${sucios.length} fragmentos arrancan con su propia miga`,
          "«el tramo 6 las concatena al embeber» (§{Las dos salidas}): si ya vinieran adentro se concatenarían dos veces y la clave del caché dejaría de ser la entrada de la función que cachea (C2 en `ir`)",
        );
      }
      const desalineados = g.fragments.filter((f) => {
        const primero = porLocal.get(f.nodes[0]);
        return primero !== undefined && !igual(f.breadcrumbs, primero.breadcrumbs);
      });
      if (desalineados.length > 0) {
        fallar(
          `I15 · las migas del fragmento son las de su primer nodo — ${caso.name}`,
          `${desalineados.length} fragmentos con migas propias`,
          "el tramo 5 NO construye migas: las toma de la pila del emisor. Si las construyera habría una SEGUNDA estructura que puede discrepar, que es lo que I3 existe para impedir un tramo antes",
        );
      }
      // Y TODOS los nodos del fragmento tienen que compartirlas. Es lo que hace
      // NECESARIO que un `lead` cierre: sin el cierre, un fragmento cruza un título
      // y lleva las migas de su primer nodo PARA TODOS — queda archivado bajo una
      // sección a la que la mitad de su texto no pertenece, y ninguna otra
      // comprobación lo ve.
      const mezclaSecciones = g.fragments.filter((f) =>
        f.nodes.some((l) => {
          const n = porLocal.get(l);
          return n !== undefined && !igual(n.breadcrumbs, f.breadcrumbs);
        }),
      );
      if (mezclaSecciones.length > 0) {
        fallar(
          `I15 · un fragmento no cruza una frontera de sección — ${caso.name}`,
          `${mezclaSecciones.length} fragmentos agrupan nodos de secciones distintas`,
          "«un `lead` cierra el fragmento en curso» (§{El recorrido}) existe para esto: sin el cierre, el filtro por sección del tramo 7 devuelve texto de otra sección y el error es MUDO",
        );
      }
    }

    // ── I16 · `solo` NO SE MEZCLA, `satellite` NUNCA QUEDA SOLO ────────────
    {
      const mezclados = g.fragments.filter(
        (f) =>
          f.nodes.some((l) => cohesión(l) === "solo") &&
          f.nodes.some((l) => cohesión(l) === "normal"),
      );
      if (mezclados.length > 0) {
        fallar(
          `I16 · \`solo\` no se mezcla con vecinos — ${caso.name}`,
          `${mezclados.length} fragmentos mezclan solo con normal: ${JSON.stringify(
            mezclados.map((f) => f.text),
          )}`,
          "es el argumento del vector turbio: un bloque de código con el párrafo que lo precede no representa bien a ninguno de los dos",
        );
      }
      // «NUNCA QUEDA SOLO» SE MIDE CONTRA SU VECINO, y esta forma es del segundo
      // intento. La primera miraba si el satélite había quedado ÉL SOLO en un
      // fragmento, y el mutante que invierte `acceptsSatellite` pasaba en verde por
      // la razón más incómoda posible: despegado de su imagen, el epígrafe se pegaba
      // al párrafo que venía DESPUÉS, así que nunca quedaba solo y el invariante no
      // veía nada — mientras la imagen quedaba en un fragmento sin una sola letra.
      // Solo lo movía el golden, y un golden que cambia no dice QUÉ se rompió.
      //
      // La forma de hoy es PROVISIONAL(C16) + PROVISIONAL(#52) literales: un
      // satélite va con el nodo que lo precede, salvo que ese nodo sea un `lead` —
      // en cuyo caso no hay fragmento vivo que aceptarlo y abrir uno propio es lo
      // correcto. Es universal, no una propiedad de estos seis casos.
      const despegados = nodos.filter((n, i) => {
        if (cohesionOf(n.role, n.body.shape) !== "satellite") return false;
        const previo = nodos[i - 1];
        if (previo === undefined) return false;
        if (cohesionOf(previo.role, previo.body.shape) === "lead") return false;
        return !g.fragments.some(
          (f) => f.nodes.includes(n.id) && f.nodes.includes(previo.id),
        );
      });
      if (despegados.length > 0) {
        fallar(
          `I16 · un satélite nunca queda solo — ${caso.name}`,
          `${JSON.stringify(despegados.map((n) => n.location.anchor))} no comparte fragmento con el nodo que lo precede`,
          "«un epígrafe termina siendo un fragmento de una línea sin su imagen» es exactamente lo que PROVISIONAL(C16) de `ir` decide evitar, y al rebote deja a la imagen en un fragmento sin texto",
        );
      }
    }

    // ── I17 · minLevel ES EL PEOR, Y LA CONFIANZA DISTINGUE null DE CERO ────
    // Los dos se RECALCULAN desde `nodes`, que es una segunda fuente independiente
    // del acumulador que los produjo. `null` es «NO APLICA» —el fragmento
    // enteramente declarativo, el MÁS confiable— y leerlo como cero invierte
    // exactamente el sentido (#74 en `ir/src/outputs.ts`).
    for (const f of g.fragments) {
      const suyos = f.nodes.map((l) => porLocal.get(l)).filter((n) => n !== undefined);
      const peor = suyos.reduce(
        (w, n) => (rank(n.level) > rank(w) ? n.level : w),
        "declarative",
      );
      if (f.minLevel !== peor) {
        fallar(
          `I17 · minLevel es el PEOR nivel — ${caso.name}`,
          `el fragmento ${JSON.stringify(f.text)} declara ${f.minLevel} y sus nodos dan ${peor}`,
          caso.why,
        );
      }
      const reportadas = suyos.map((n) => n.confidence).filter((c) => c !== null);
      const esperada =
        reportadas.length === 0
          ? null
          : { min: Math.min(...reportadas), hasNull: reportadas.length !== suyos.length };
      if (!igual(f.confidence, esperada)) {
        fallar(
          `I17 · la confianza distingue «no reportó» de «reportó bajo» — ${caso.name}`,
          `el fragmento ${JSON.stringify(f.text)} declara ${JSON.stringify(
            f.confidence,
          )} y sus nodos dan ${JSON.stringify(esperada)}`,
          "con un solo número, «todos confiables» es indistinguible de «hay un nodo sobre el que no sé nada», que es la pregunta exacta que la capa de skills hace donde decide citar",
        );
      }
    }

    // ── I18 · UN REGISTRO POR NODO-FILA ─────────────────────────────────────
    {
      const filas = nodos.filter((n) => isRowNode(n.body));
      if (g.records.length !== filas.length) {
        fallar(
          `I18 · un registro por nodo-fila — ${caso.name}`,
          `${filas.length} nodos-fila y ${g.records.length} registros`,
          "sin la mitad σ la planilla se puede buscar por similitud y no se puede CONSULTAR, que es la única cosa para la que existe el split π/σ",
        );
      }
      const claves = g.records.map((r) => r.values.map((v) => v.label));
      if (!igual(claves, caso.records)) {
        fallar(
          `I18 · un registro por nodo-fila, con las claves de \`fieldKey\` — ${caso.name}`,
          `esperadas ${JSON.stringify(caso.records)}\n        obtenidas ${JSON.stringify(claves)}`,
          "«si cada fila cargara sus etiquetas, renombrar una columna cambiaría el hash de las 50 000» (§{Las filas}): el esquema vive en el container y la política de claves en `ir`, para que dos consumidores no inventen dos registros distintos de la misma planilla",
        );
      }
      // «LA COORDENADA DEL REGISTRO ES `SourceRange`» NO SE VERIFICA ACÁ, Y NO ES UN
      // OLVIDO. Estuvo escrito y se borró al buscar aserciones que no pueden fallar:
      // `LocalDataRecord.coordinate` ES `SourceRange` —o sea `Extract<Coordinate,
      // {space:"grid"}>`— y `recordOf` corta antes de construir el registro si la
      // coordenada no es de grilla, así que la violación es INEXPRESABLE y el
      // chequeo era un booleano que nadie lee. El único modo de falla que quedaba
      // —que el `Extract` colapse a `never` y el campo pase a aceptar cualquier
      // cosa, EN VERDE— vive en `ir` y lo agarra `_SourceRangeExists`, con su
      // mutante. Subir de escalón es borrar el test, no agregarlo.

      // LAS DOS SALIDAS REFERENCIAN EL MISMO NODO. Es la forma verificable de «un
      // recorrido, dos salidas» (§{Las dos salidas}): la fila se recupera por
      // similitud DENTRO de un fragmento y se consulta EXACTO por su registro, y las
      // dos tienen que apuntar al mismo nodo o la respuesta exacta no se puede citar
      // de vuelta a su origen.
      const enFragmento = new Set(g.fragments.flatMap((f) => f.nodes));
      const locales = new Set(filas.map((n) => n.id));
      const descolgados = g.records.filter(
        (r) => !locales.has(r.node) || !enFragmento.has(r.node),
      );
      if (descolgados.length > 0) {
        fallar(
          `I18 · las dos salidas referencian el mismo nodo-fila — ${caso.name}`,
          `${descolgados.length} registros apuntan a un nodo que no es su fila o que no está en ningún fragmento`,
          "un registro que apunta al container en vez de a su fila hace incitable la respuesta exacta: se sabe QUÉ dice la celda y no de qué fila salió, que es la mitad del valor de la salida σ",
        );
      }
      // SEGURO SIN ACREDITACIÓN, ESCRITO: la segunda mitad —que el nodo del registro
      // esté ADEMÁS en un fragmento— no la pone roja ninguna mutación de una línea
      // de hoy, porque una fila se renderiza siempre y siempre entra en alguno. Se
      // conserva porque es la mitad que se cae el día que alguien haga que la salida
      // σ salte el recorrido, que es exactamente lo que el split π/σ prohíbe.
      // La fila sola es un `grid` con `headers: null`, o sea celdas sin encabezado:
      // si la composición no fuera a buscar el esquema al container, la fila se
      // indexa sin sus etiquetas y deja de ser recuperable por nombre de columna.
      for (const n of filas) {
        const suyo = g.fragments.find((f) => f.nodes.includes(n.id));
        const conEsquema =
          n.parentId === null
            ? null
            : porLocal.get(n.parentId)?.body.schema ?? null;
        if (conEsquema !== null && (suyo === undefined || !suyo.text.includes(conEsquema[0]))) {
          fallar(
            `I18 · la fila se renderiza con el esquema de su container — ${caso.name}`,
            `la fila "${n.location.anchor}" se embebe como ${JSON.stringify(suyo?.text)}`,
            "el esquema vive en el container justamente para que renombrar una columna toque UN nodo; si la composición no va a buscarlo, la fila se indexa sin sus etiquetas",
          );
        }
      }
    }

    // ── I19 · LA AGRUPACIÓN ESPERADA, Y LAS DOS SALIDAS DEL MISMO RECORRIDO ─
    // Es el único de los ocho que compara contra algo EXTERNO al tramo 5: los otros
    // siete verifican que la salida sea coherente consigo misma, y una salida puede
    // ser perfectamente coherente y ser la agrupación equivocada.
    {
      const textos = g.fragments.map((f) => f.text);
      if (!igual(textos, caso.fragments)) {
        fallar(
          `I19 · la agrupación esperada — ${caso.name}`,
          `esperada ${JSON.stringify(caso.fragments)}\n        obtenida ${JSON.stringify(textos)}`,
          caso.why,
        );
      }
      // Determinismo: es el único que un golden NO atrapa, porque una salida no
      // determinística es golden respecto de sí misma.
      const otra = group(nodos, caso.targetSizeChars);
      if (!igual(otra, g)) {
        fallar(
          `I19 · determinismo de la agrupación — ${caso.name}`,
          "dos corridas sobre la misma entrada dieron salidas distintas",
          "sin determinismo la huella del fragmento se mueve sola y el caché de vectores falla en cada re-ingesta",
        );
      }
    }
  }

  if (fallas > 0) process.exit(1);
  console.log(
    `invariantes ok (${CASES.length} casos sintéticos · I1 plana · I2 padre-antes · ` +
      `I3 migas · I4 nada se pierde · I5 determinismo · I6 locales únicos · ` +
      `I7 traza canónica · I8 delegación · I9 título editado · I10 padre colgante · ` +
      `I11 cadena completa || ${GROUPING_CASES.length} casos de agrupación · ` +
      `I12 nada se pierde · I13 títulos no duplicados · I14 título huérfano · ` +
      `I15 texto limpio y migas · I16 solo y satélite · I17 nivel y confianza · ` +
      `I18 registros · I19 golden y determinismo)`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
