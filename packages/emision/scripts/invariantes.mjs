/**
 * Los invariantes del PASO 2, con su guardián ejecutable. Cero dependencias.
 *
 * Hay garantías que ningún tipo expresa porque son de COMPORTAMIENTO del recorrido:
 * que la lista salga plana, que ningún padre apunte hacia adelante, que las migas no
 * salgan de una segunda estructura, que nada se pierda y que dos corridas den lo
 * mismo. Romperlas NO SE VE: un `padreLocal` de más o una miga de menos produce un
 * árbol distinto que compila, corre y persiste — y recién se nota cuando la curación
 * del cliente aparece colgada del nodo equivocado.
 *
 * Cada invariante de acá se acreditó ROMPIÉNDOLO: se mutó el emisor a propósito y se
 * verificó que este comando cae. Un test que nunca falló es indistinguible de uno que
 * no funciona.
 *
 * Compila `ir` y `emision` a un directorio temporal porque node no resuelve los
 * imports `.js` del código fuente a los `.ts` de disco. `ir` va a
 * `<tmp>/node_modules/@savia-os/ir` para que el import bare de `emision` resuelva
 * como en producción, sin reescribir un solo especificador.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ_IR = resolve(RAIZ, "..", "ir");
const salida = mkdtempSync(join(tmpdir(), "emision-invariantes-"));

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
    `EMISION-ERR: ${invariante}\n` +
      `        ${detalle}\n` +
      `        importa porque: ${porqué}`,
  );
  fallas += 1;
};

try {
  const destinoIr = join(salida, "node_modules", "@savia-os", "ir");
  compilar(RAIZ_IR, destinoIr);
  writeFileSync(
    join(destinoIr, "package.json"),
    JSON.stringify({ name: "@savia-os/ir", version: "0.0.0", type: "module", exports: { ".": "./index.js" } }),
  );

  const destinoEmision = join(salida, "emision");
  compilar(RAIZ, destinoEmision);

  const { emitir, CASOS, CASO_CANÓNICO, CASO_DELEGADO, TITULO_EDITADO, PADRE_COLGANTE } =
    await import(pathToFileURL(join(destinoEmision, "index.js")).href);
  const { esLead, esNodo, renderizar } = await import(
    pathToFileURL(join(destinoIr, "index.js")).href
  );

  const sha256 = (preimagen) => createHash("sha256").update(preimagen, "utf8").digest("hex");

  /** Emite y corta si el caso no era emisible: los casos de `CASOS` sí lo son. */
  const emitirOMorir = (caso) => {
    const r = emitir(caso.nodos, sha256);
    if (!r.ok) {
      fallar(
        `emisión fallida — ${caso.nombre}`,
        `falla: ${JSON.stringify(r.falla)}`,
        "los casos sintéticos son todos emisibles por construcción",
      );
      return [];
    }
    return r.nodos;
  };

  const porLocal = (nodos) => new Map(nodos.map((n) => [n.local, n]));

  /**
   * La cadena de ancestros por `padreLocal`, de la RAÍZ hacia el nodo. `null` si
   * la cadena no termina.
   *
   * EL TOPE NO ES DEFENSA CONTRA DATOS, ES DEFENSA CONTRA ESTE GUARDIÁN. Caminar
   * `padreLocal` sin tope se cuelga cuando la lista tiene un ciclo — y el ciclo es
   * exactamente uno de los defectos que I2 existe para atrapar. Un guardián que se
   * cuelga ante el defecto que busca no falla: no termina, que desde afuera es
   * indistinguible de «todavía está corriendo». Se descubrió rompiendo el emisor a
   * propósito (mutación M6, todos los nodos con el mismo `LocalId`): el guardián
   * quedó girando quince minutos al 100 % de CPU en vez de reportar.
   */
  const ancestros = (nodo, índice) => {
    const cadena = [];
    let actual = nodo.padreLocal;
    while (actual !== null && actual !== undefined) {
      if (cadena.length > índice.size) return null;
      const padre = índice.get(actual);
      if (padre === undefined) break;
      cadena.unshift(padre);
      actual = padre.padreLocal;
    }
    return cadena;
  };

  const texto = (n) => (n === undefined ? null : renderizar(n.cuerpo, null));

  // ── I1 · LA LISTA ES PLANA ────────────────────────────────────────────────
  // `container` no lleva hijos y la jerarquía es SOLO `padreLocal` (§{Tramo 3 › Qué sale} y
  // §{2 · Emisor}). Un payload que anide un nodo rompe la lista plana y vuelve
  // inexpresable la identidad estable por elemento.
  const marcasAnidadas = (valor, vistos) => {
    if (valor === null || typeof valor !== "object" || vistos.has(valor)) return 0;
    vistos.add(valor);
    let n = esNodo(valor) ? 1 : 0;
    for (const v of Object.values(valor)) n += marcasAnidadas(v, vistos);
    return n;
  };

  // ── El recorrido de todos los casos ───────────────────────────────────────
  for (const caso of CASOS) {
    const nodos = emitirOMorir(caso);
    if (nodos.length === 0 && caso.nodos.length > 0) continue;
    const índice = porLocal(nodos);

    for (const [i, n] of nodos.entries()) {
      // I1
      const marcas = marcasAnidadas(n, new Set());
      if (marcas !== 1) {
        fallar(
          `I1 · la lista es plana — ${caso.nombre} #${i}`,
          `el nodo emitido contiene ${marcas} marcas nodales (esperado 1: él mismo)`,
          caso.porqué,
        );
      }

      // I2 · todo `padreLocal` referencia un `LocalId` EMITIDO ANTES.
      // «Antes» es la mitad que importa: sin ella el grafo puede tener ciclos y
      // ningún recorrido posterior termina.
      if (n.padreLocal !== null) {
        const anteriores = new Set(nodos.slice(0, i).map((x) => x.local));
        if (!anteriores.has(n.padreLocal)) {
          fallar(
            `I2 · padre emitido antes — ${caso.nombre} #${i}`,
            `padreLocal=${n.padreLocal} no está entre los ${i} nodos anteriores`,
            "un padre adelantado o inexistente hace cíclico el grafo y despega la curación del nodo real",
          );
        }
      }

      // I3 · LAS MIGAS SON EXACTAMENTE LOS `lead` ABIERTOS EN SU PUNTO.
      // Se re-derivan de la LISTA PLANA (ancestros por `padreLocal` + `esLead`),
      // que es una segunda fuente independiente de la pila que las produjo. Si el
      // emisor tuviera una estructura aparte para las migas, acá discreparían.
      const cadena = ancestros(n, índice);
      if (cadena === null) {
        fallar(
          `I2 · la cadena de padres termina — ${caso.nombre} #${i}`,
          `caminar \`padreLocal\` desde ${n.local} no llega nunca a la raíz`,
          "un ciclo en la lista plana cuelga a todo consumidor que camine el árbol, empezando por este guardián",
        );
        continue;
      }
      const esperadas = cadena
        .filter((a) => esLead(a.tipo, a.cuerpo.forma) && texto(a) !== null)
        .map((a) => ({ ref: a.local, texto: texto(a) }));
      const obtenidas = n.migas.map((m) => ({ ref: m.ref, texto: m.texto }));
      if (JSON.stringify(esperadas) !== JSON.stringify(obtenidas)) {
        fallar(
          `I3 · migas = los lead abiertos — ${caso.nombre} #${i}`,
          `esperadas ${JSON.stringify(esperadas)}\n        obtenidas ${JSON.stringify(obtenidas)}`,
          "las migas salen de la misma pila que el padre; si no coinciden hay una segunda estructura que puede discrepar",
        );
      }
    }

    // I4 · NINGÚN NODO SE PIERDE, y salen en orden de lectura.
    if (nodos.length !== caso.nodos.length) {
      fallar(
        `I4 · ningún nodo se pierde — ${caso.nombre}`,
        `entraron ${caso.nodos.length}, salieron ${nodos.length}`,
        "un nodo que no se emite no existe para el resto del pipeline y desaparece sin que nada se ponga rojo",
      );
    }
    for (const [i, n] of nodos.entries()) {
      if (n.ubicación.ancla !== caso.nodos[i]?.ubicación.ancla) {
        fallar(
          `I4 · orden de lectura — ${caso.nombre} #${i}`,
          `salió "${n.ubicación.ancla}" donde entró "${caso.nodos[i]?.ubicación.ancla}"`,
          "el reconciliador parte AMBAS listas en tramos por posición; reordenar acá lo rompe todo",
        );
      }
    }

    // I7 · EL ÁRBOL ES EL ESPERADO, escrito a mano por caso. Es el único
    // invariante que compara contra algo EXTERNO al emisor: los otros verifican
    // que la salida sea coherente consigo misma, y una salida puede ser
    // perfectamente coherente y ser el árbol equivocado.
    const árbol = nodos.map((n) =>
      n.padreLocal === null ? null : (índice.get(n.padreLocal)?.ubicación.ancla ?? "?"),
    );
    if (JSON.stringify(árbol) !== JSON.stringify(caso.traza)) {
      fallar(
        `I7 · el árbol esperado — ${caso.nombre}`,
        `esperado ${JSON.stringify(caso.traza)}\n        obtenido ${JSON.stringify(árbol)}`,
        caso.porqué,
      );
    }

    // I5 · EL RECORRIDO ES DETERMINÍSTICO.
    const otra = emitir(caso.nodos, sha256);
    if (!otra.ok || JSON.stringify(otra.nodos) !== JSON.stringify(nodos)) {
      fallar(
        `I5 · determinismo — ${caso.nombre}`,
        "dos corridas sobre la misma entrada dieron salidas distintas",
        "sin determinismo el reconciliador ve cambios donde no los hubo y mueve ids en cada re-ingesta",
      );
    }

    // I6 · LOS `LocalId` SON ÚNICOS.
    if (índice.size !== nodos.length) {
      fallar(
        `I6 · LocalId únicos — ${caso.nombre}`,
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
    if (JSON.stringify(CASO_CANÓNICO.traza) !== JSON.stringify(esperada)) {
      fallar(
        "I7 · la traza canónica es la que publica el plan (§{2 · Emisor})",
        `el fixture declara ${JSON.stringify(CASO_CANÓNICO.traza)}`,
        "si la traza esperada se edita para que el test pase, el test deja de comparar contra el diseño",
      );
    }
  }

  // ── I8 · UN SUBÁRBOL DELEGADO NO PARTICIPA DE LA ESCALA DEL PADRE ─────────
  {
    const nodos = emitirOMorir(CASO_DELEGADO);
    const índice = porLocal(nodos);
    const [contrato, anexo, foto, acta, recibidos, raízDelMarco, vuelta] = nodos;

    // El `nivel 1` de adentro cuelga del punto de injerto, no de la raíz.
    if (acta?.padreLocal !== foto?.local) {
      fallar(
        "I8 · el delegado abre su propio scope",
        `"${texto(acta)}" (nivel 1, delegado) cuelga de ${JSON.stringify(
          acta?.padreLocal === null ? null : texto(índice.get(acta?.padreLocal)),
        )}, esperado "${texto(foto)}"`,
        "un título que un modelo encuentra dentro de una página escaneada se mezclaría con los niveles del contrato que lo contiene",
      );
    }
    // «Raíz» adentro de un marco es la raíz DEL MARCO. Sin esto la mutación «el
    // delegado no abre su propio scope» pasa inadvertida: contra un injerto que no
    // es título, la escala de niveles ya frena sola y el piso parece redundante.
    if (raízDelMarco?.padreLocal !== foto?.local) {
      fallar(
        "I8 · `ninguna` adentro de un marco es la raíz DEL MARCO",
        `"${texto(raízDelMarco)}" cuelga de ${JSON.stringify(
          raízDelMarco?.padreLocal == null ? null : texto(índice.get(raízDelMarco.padreLocal)),
        )}, esperado "${texto(foto)}"`,
        "un `.eml` dentro de un `.zip` abstiene siempre: si su raíz fuera la del documento, el subárbol entero se derrama sobre el padre",
      );
    }
    // Y NO cerró el `nivel 1` de afuera: al bajar, el documento sigue donde estaba.
    if (vuelta?.padreLocal !== anexo?.local) {
      fallar(
        "I8 · al bajar del delegado se restauran los scopes del padre",
        `"${texto(vuelta)}" cuelga de ${JSON.stringify(
          vuelta?.padreLocal === null ? null : texto(índice.get(vuelta?.padreLocal)),
        )}, esperado "${texto(anexo)}"`,
        "si el delegado cerrara los scopes del padre, todo lo que sigue al injerto se reordena",
      );
    }
    // Las migas de adentro llevan los títulos del padre Y el del subárbol.
    const migasDeAdentro = (recibidos?.migas ?? []).map((m) => m.texto);
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
    const v1 = emitir(TITULO_EDITADO.v1, sha256);
    const v2 = emitir(TITULO_EDITADO.v2, sha256);
    if (v1.ok && v2.ok) {
      const [, títuloV1, párrafoV1] = v1.nodos;
      const [, títuloV2, párrafoV2] = v2.nodos;
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
      const migasV1 = (párrafoV1?.migas ?? []).map((m) => m.texto);
      const migasV2 = (párrafoV2?.migas ?? []).map((m) => m.texto);
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
  // PENDIENTE(#46): la política elegida es cortar. Lo que este invariante fija —y
  // que sobrevive a cualquier política futura— es que NO puede codificar a lo mismo
  // que «cuelga de la raíz», que es un estado legítimo y frecuente.
  {
    const r = emitir(PADRE_COLGANTE, sha256);
    if (r.ok !== false) {
      fallar(
        "I10 · el padre colgante falla con un objeto de error",
        `emitir devolvió ok=${r.ok}`,
        "degradar a raíz haría que «referencia rota» y «cuelga de la raíz» sean indistinguibles, y la ausencia estaría codificando dos cosas",
      );
    } else if (r.nodos !== undefined) {
      fallar(
        "I10 · el fallo no es asignable al éxito",
        "la variante de fallo trae `nodos`",
        "si el llamador puede leer la salida sin mirar `ok`, la aserción no asegura nada",
      );
    }
  }

  if (fallas > 0) process.exit(1);
  console.log(
    `invariantes ok (${CASOS.length} casos sintéticos · I1 plana · I2 padre-antes · ` +
      `I3 migas · I4 nada se pierde · I5 determinismo · I6 locales únicos · ` +
      `I7 traza canónica · I8 delegación · I9 título editado · I10 padre colgante)`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
