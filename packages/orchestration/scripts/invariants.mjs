#!/usr/bin/env node
/**
 * Los invariantes de LA ESPINA DORSAL, con su guardián ejecutable. Cero dependencias.
 *
 * ACÁ VIVE EL GOLDEN `bytes → ÁRBOL` QUE EL PLAN PIDE (§{Estrategia}), y no en
 * `adapters`, y esa ubicación es un RESULTADO y no una comodidad. El árbol —`localParent`,
 * migas, huellas— lo produce `emit`, que vive en `@savia-os/emission`; los nodos los
 * produce el adaptador, que vive en `@savia-os/adapters`; y los dos paquetes NO PUEDEN
 * VERSE. El único lugar del repo donde el bytes→árbol es escribible es este, que es el
 * único que alcanza a los dos. La frontera no es una molestia del guardián: es lo que
 * decidió dónde va el golden.
 *
 * Y EL GOLDEN LLEVA LAS TRES SALIDAS MÁS EL SUMIDERO. El plan dice «bytes → árbol» y la
 * primera versión del guardián del prototipo snapshotaba solo los fragmentos: `mime`,
 * `language`, `marks`, `href` y `attribution` no se renderizan, así que no aparecen en
 * `Fragment.text` y una mutación sobre cualquiera de ellos pasaba en verde. Acá van el
 * árbol (con `localParent` y migas), los fragmentos, los registros y los avisos.
 *
 * EL CORPUS NO SE COPIA: se lee de `@savia-os/adapters`, a través de la dependencia que
 * este paquete ya declara. Duplicarlo daría dos archivos que hay que mantener iguales, y
 * el día que discrepen los dos goldens serían verdes sobre entradas distintas.
 *
 * LA CADENA DE GUARDIANES NO SE VERIFICA ACÁ: la verifica `scripts/boundaries.mjs`, que
 * corre PRIMERO. Un chequeo que otro guardián sombrea no acredita nada.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEP = (p) => resolve(RAIZ, "node_modules", "@savia-os", p);
const salida = mkdtempSync(join(tmpdir(), "orchestration-invariants-"));

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
    `ORCHESTRATION-ERR: ${invariante}\n        ${detalle}\n        importa porque: ${porqué}`,
  );
  fallas += 1;
};

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

try {
  const nm = join(salida, "node_modules", "@savia-os");
  mkdirSync(nm, { recursive: true });
  for (const nombre of ["ir", "emission", "adapters"]) {
    const destino = join(nm, nombre);
    compilar(realpathSync(DEP(nombre)), destino);
    writeFileSync(
      join(destino, "package.json"),
      JSON.stringify({
        name: `@savia-os/${nombre}`,
        version: "0.0.0",
        type: "module",
        exports: { ".": "./index.js" },
      }),
    );
  }
  // LAS DEPENDENCIAS DE RUNTIME DEL PIPELINE, enlazadas donde el resolvedor las busca
  // subiendo desde `<tmp>/node_modules/@savia-os/adapters/<archivo>.js`. Se DERIVAN del
  // manifiesto de `adapters` en vez de escribirse acá: hasta el paso 7 esta línea decía
  // `yaml` y nada más, y al entrar `fflate` y `txml` el banco falló con
  // `ERR_MODULE_NOT_FOUND` sobre un archivo compilado — ruidoso, pero sin nombrar la
  // causa. Derivada, la próxima dependencia se enlaza sola.
  {
    const manifiesto = JSON.parse(
      readFileSync(join(realpathSync(DEP("adapters")), "package.json"), "utf8"),
    );
    for (const dep of Object.keys(manifiesto.dependencies ?? {})) {
      if (dep.startsWith("@savia-os/")) continue;
      symlinkSync(
        realpathSync(join(realpathSync(DEP("adapters")), "node_modules", dep)),
        join(salida, "node_modules", dep),
        "dir",
      );
    }
  }

  const destino = join(salida, "orchestration");
  compilar(RAIZ, destino);

  const { contextOf, ingest } = await import(pathToFileURL(join(destino, "index.js")).href);
  const {
    TEXT_FLOOR_ID,
    chatAdapter,
    imageAdapter,
    coldProbeOf,
    docxAdapter,
    markdownAdapter,
    opaqueOf,
    printableProportionOf,
    registryOf,
    textFloorAdapter,
  } = await import(pathToFileURL(join(nm, "adapters", "index.js")).href);
  const { Evidence, asAdapterId, asElementId, asLocalId, asObjectKey, cohesionOf, project } =
    await import(pathToFileURL(join(nm, "ir", "index.js")).href);
  // El reconciliador (paso 11). Se importa acá y no en `emission` porque el golden de
  // identidades necesita nodos REALES, y `emission` no puede ver `adapters`.
  const { anchorsOf, fencesOf, knownVersionOf, reconcile } = await import(
    pathToFileURL(join(nm, "emission", "index.js")).href
  );

  const sha256 = (preimagen) => createHash("sha256").update(preimagen, "utf8").digest("hex");
  const corpus = (archivo) =>
    new Uint8Array(readFileSync(join(realpathSync(DEP("adapters")), "corpus", archivo)));
  const bytes = corpus("manual.md");
  const conf = corpus("servidor.conf");
  const png = corpus("sello.png");
  const docx = corpus("manual.docx");
  const docxZip = corpus("manual-deflated.docx");

  const REGISTRO = registryOf([opaqueOf(markdownAdapter)]);
  // OPCIONES ES UNA FÁBRICA Y NO UN OBJETO, y eso es lo que sostiene I2 · determinismo.
  //
  // El acuñador de `ElementId` es la única no-determinación legítima del pipeline
  // (H13(a): reloj + azar), y el banco la aísla con un contador. Pero un contador
  // ÚNICO compartido por las ~18 llamadas de este archivo le daría `e1..e24` a la
  // primera corrida y `e25..e48` a la segunda: I2 se pondría rojo SOBRE UN ÁRBOL SANO,
  // y peor, los ids de cualquier golden pasarían a depender de CUÁNTAS corridas hay
  // más arriba — agregar un invariante entre dos movería los goldens de los de abajo.
  // Un acoplamiento de orden entre invariantes es exactamente lo que un guardián no
  // puede tener. Con la fábrica, cada llamada arranca su contador en cero.
  const OPCIONES = () => {
    let acuñados = 0;
    return {
    registry: REGISTRO,
    sha256,
    // 60 y no otro número, y hay que decir qué es: es UN PARÁMETRO DEL BANCO, no del
    // producto. `PARAMETERS.grouping.targetSizeChars` sigue en `null` con su plan de
    // medición escrito, y 60 está elegido para que el corte por tamaño ocurra sobre un
    // corpus chico. Va dicho para que nadie lo lea como una medición.
    targetSizeChars: 60,
    // El acuñador CONTABLE del banco. `e` de «element», y el número es el orden de
    // acuñado dentro de ESTA corrida.
    mint: () => asElementId(`e${(acuñados += 1)}`),
    // Sin versión anterior: cada invariante de este archivo salvo I16 es una PRIMERA
    // ingesta. No saltea el reconciliador — reconcilia contra una versión vacía.
    previous: null,
    // Los dos parámetros del banco. En una primera ingesta NO SE LEEN —sin versión
    // anterior no hay una sola comparación de similitud— y van explícitos igual porque
    // el tipo los exige, que es lo que impide que alguien invente un default.
    similarityThreshold: 0.5,
    maxComparisons: 10000,
    previousAdapter: null,
    previousVersion: null,
    };
  };

  // La variante `bytes` de `Intake`, que desde el paso 5 lleva lo que era del entorno y
  // resultó ser de ESTA entrada: el nombre, el canal, quién subió y cuándo.
  const SUBIDA = (b, extra = {}) => ({
    kind: "bytes",
    bytes: b,
    // Desde el paso 6 la entrada trae su propia dirección: el request guarda ANTES de
    // encolar, así que la clave existe para cuando esto corre. Sin ella un adaptador
    // no puede emitir un `asset`, y sin `asset` no hay delegación.
    object: asObjectKey(`obj-${b.length}`),
    mime: "application/octet-stream",
    name: "manual.md",
    channel: "frontend",
    when: "2026-08-16T00:00:00.000Z",
    actor: "usuario-sintetico",
    ...extra,
  });

  const corrida = await ingest(SUBIDA(bytes), OPCIONES());
  // EL `?? "?"` NO ES DECORACIÓN, y este paso midió por qué. Hasta el paso 12 este
  // helper buscaba por `n.local`, y cuando `Run` pasó a llevar `EmittedNode` la
  // búsqueda NO cayó al `"?"`: `undefined === undefined` matcheaba EL PRIMER NODO, así
  // que los 24 nodos pasaron a decir que su padre era el frontmatter. Un valor
  // plausible, no un absurdo — y regenerar el golden en ese estado habría congelado un
  // árbol falso como LA REFERENCIA, en verde y para siempre. Por eso el re-tecleo a
  // `id` va ANTES de cualquier regeneración, y no después.
  const anclaDe = (id) =>
    id === null ? null : corrida.nodes.find((n) => n.id === id)?.location.anchor ?? "?";

  // ── I1 · GOLDEN: BYTES → ÁRBOL, LAS DOS SALIDAS Y EL SUMIDERO ─────────────
  // Se regenera con `ORCHESTRATION_REGEN=1`, y ningún script del `package.json` lo pasa:
  // regenerar es un comando que alguien escribe a mano y que aparece en el diff. La
  // diferencia entre un golden y un snapshot no es el formato, es cuánto cuesta borrarlo
  // sin querer.
  {
    const goldenPath = join(RAIZ, "corpus", "manual.golden.json");
    const actual = JSON.stringify(
      {
        adapter: corrida.adapter,
        achievedLevel: corrida.achievedLevel,
        árbol: corrida.nodes.map((n) => ({
          anchor: n.location.anchor,
          role: n.role,
          shape: n.body.shape,
          cohesion: cohesionOf(n.role, n.body.shape),
          level: n.level,
          attribution: n.attribution,
          confidence: n.confidence,
          parent: anclaDe(n.parentId),
          breadcrumbs: n.breadcrumbs.map((b) => b.text),
          hash: n.hash,
        })),
        fragmentos: corrida.fragments.map((f) => ({
          text: f.text,
          nodes: f.nodes.map(anclaDe),
          breadcrumbs: f.breadcrumbs.map((b) => b.text),
          minLevel: f.minLevel,
          confidence: f.confidence,
        })),
        registros: corrida.records,
        sumidero: corrida.sink,
        enEspera: corrida.onHold,
      },
      null,
      2,
    );
    if (process.env.ORCHESTRATION_REGEN === "1") {
      writeFileSync(goldenPath, `${actual}\n`, "utf8");
      console.log("golden REGENERADO — revisá el diff antes de commitear");
    } else {
      const esperado = readFileSync(goldenPath, "utf8").trimEnd();
      if (actual !== esperado) {
        const a = actual.split("\n");
        const b = esperado.split("\n");
        const i = a.findIndex((l, k) => l !== b[k]);
        fallar(
          "I1 · golden bytes→árbol",
          `primera diferencia en la línea ${i + 1}\n        esperado: ${b[i]}\n        obtenido: ${a[i]}`,
          "es el único invariante que compara contra algo EXTERNO al código: los demás verifican que la salida sea coherente CONSIGO MISMA, y una salida puede ser perfectamente coherente y ser el árbol equivocado",
        );
      }
    }
  }

  // ── I2 · DETERMINISMO: DOS CORRIDAS BYTE-IDÉNTICAS ────────────────────────
  {
    const otra = await ingest(SUBIDA(bytes), OPCIONES());
    if (!igual(otra, corrida)) {
      fallar(
        "I2 · determinismo",
        "dos corridas sobre los mismos bytes dieron salidas distintas",
        "es precondición del caché de reconocimiento, y es el único invariante que un golden NO atrapa: una salida no determinística es golden respecto de sí misma. No es un property test —es una entrada fija corrida dos veces— y hay que llamarlo así: un property test necesita un generador de `.md`, que es una pieza que nadie presupuestó",
      );
    }

    // LA SEGUNDA MITAD, y sin ella la primera es satisfacible IGNORANDO LA COSTURA.
    //
    // Desde el paso 12 los ids salen de `options.mint`, y el banco provee un acuñador
    // CONTABLE para que dos corridas den lo mismo. Pero un `ingest` que nunca llamara a
    // `options.mint` y derivara los ids de la posición daría dos corridas idénticas y
    // quedaría verde PARA SIEMPRE — la costura existiría sin usarse, y con ella se iría
    // la mitad del reconciliador: `EmittedNode.id` es «de la reconciliación, NO de una
    // fórmula» (H13(a)), y una fórmula sobre la posición es exactamente la que el plan
    // descartó porque insertar un párrafo arriba mueve todos los ids de abajo.
    //
    // Con un acuñador que NO se repite, esta mitad afirma las dos cosas juntas: que los
    // ids SÍ se mueven (o sea que la costura se usa) y que TODO LO DEMÁS NO (o sea que
    // los ids son la única no-determinación del pipeline). Eso convierte H13(a) de
    // supuesto en medición.
    {
      let n = 0;
      const azarosa = await ingest(SUBIDA(bytes), {
        ...OPCIONES(),
        mint: () => asElementId(`otro#${(n += 1)}`),
      });
      const sinIdentidad = (r) => ({
        ...r,
        nodes: r.nodes.map(({ id: _i, parentId: _p, breadcrumbs, ...resto }) => ({
          ...resto,
          breadcrumbs: breadcrumbs.map((b) => b.text),
        })),
        fragments: r.fragments.map(({ nodes: _n, breadcrumbs, ...resto }) => ({
          ...resto,
          breadcrumbs: breadcrumbs.map((b) => b.text),
        })),
        records: r.records.map(({ node: _n, ...resto }) => resto),
        matches: r.matches.length,
      });
      const idsDe = (r) => r.nodes.map((x) => x.id);
      if (igual(idsDe(azarosa), idsDe(corrida))) {
        fallar(
          "I2 · el acuñador de `IngestOptions` no se usa",
          `dos acuñadores distintos dieron los mismos ids: ${JSON.stringify(idsDe(corrida).slice(0, 3))}`,
          "si cambiar el acuñador no cambia un solo id, `ingest` los está derivando de otra cosa —la posición, un hash— y eso es la fórmula de una sola versión que §{Por qué la identidad} descartó: insertar un párrafo arriba movería los ids de todos los de abajo, y la curación del cliente se despegaría en silencio",
        );
      }
      if (!igual(sinIdentidad(azarosa), sinIdentidad(corrida))) {
        fallar(
          "I2 · cambiar el acuñador movió algo que no es un id",
          "dos corridas con acuñadores distintos difieren en algo más que la identidad",
          "H13(a) dice que el acuñado es la ÚNICA no-determinación del pipeline. Si al cambiarlo se mueve el texto de un fragmento, una huella o un aviso, entonces hay una segunda fuente de azar y el caché de reconocimiento deja de ser sano",
        );
      }
    }
  }

  // ── I3 · EL FRONTMATTER NO ES ANCESTRO DE NADIE ───────────────────────────
  // `adapters` verifica que su PISTA sea `{linkage:'none'}`; acá se verifica la
  // consecuencia, que es lo que de verdad importa: que no aparezca en ninguna miga. La
  // razón está medida — `ContextualFingerprint` es `sha256(miga ‖ texto)` y de ahí sale
  // `FragmentId`, así que con el frontmatter en la miga, editar `version:` re-embebe el
  // documento entero.
  {
    const fm = corrida.nodes.find((n) => n.role === "fields");
    if (fm === undefined) {
      fallar(
        "I3 · el corpus tiene frontmatter",
        "ningún nodo con rol `fields`",
        "sin el nodo, todo lo de abajo es vacuamente cierto y las filas que lo acreditan pasan en verde",
      );
    } else {
      // LAS DOS MITADES SE ROMPIERON EN DIRECCIONES OPUESTAS cuando `Run` cambió, y
      // por eso van juntas y anotadas. `n.parentId === fm.id` gritó —`undefined ===
      // undefined` daba TRUE para los 24 nodos—, pero `b.ref === fm.id` comparaba un
      // `ElementId` contra `undefined`, no matcheaba nunca, y quedaba VACUAMENTE VERDE.
      // Arreglar solo la que grita habría apagado sin ruido la garantía que el propio
      // docstring dice que está medida: que editar `version:` no re-embeba el archivo.
      const enMigas = corrida.nodes.filter((n) => n.breadcrumbs.some((b) => b.ref === fm.id));
      const hijos = corrida.nodes.filter((n) => n.parentId === fm.id);
      if (enMigas.length > 0 || hijos.length > 0) {
        fallar(
          "I3 · el frontmatter es hermano, no ancestro",
          `${enMigas.length} nodos lo llevan en las migas y ${hijos.length} cuelgan de él`,
          "`ContextualFingerprint` es `sha256(miga ‖ texto)` y de ahí sale `FragmentId`: con el frontmatter adentro de la miga de todos, cambiar una línea de metadato le mueve el id a cada fragmento del archivo y despega la curación del cliente EN SILENCIO",
        );
      }
      if (fm.breadcrumbs.length > 0 || fm.parentId !== null) {
        fallar(
          "I3 · el frontmatter cuelga de la raíz",
          `tiene ${fm.breadcrumbs.length} migas y su padre es ${JSON.stringify(anclaDe(fm.parentId))}`,
          "está ANTES de todas las secciones y no pertenece a ninguna: darle la sección del primer título sería archivarlo bajo algo que no lo contiene",
        );
      }
    }
  }

  // ── I4 · LA ASIMETRÍA `satellite`/`solo` SE EJERCE ────────────────────────
  // `caption` es `satellite` e `image` es `solo`, y esa asimetría estaba escrita en
  // `COHESION_BY_ROLE` desde el bloque 1 sin un solo caso que la produjera. Hasta este
  // paso, la mitad `satellite` de la tabla de cohesión NO TENÍA UN SOLO CASO EN TODO EL
  // PIPELINE.
  {
    const satélites = corrida.nodes.filter(
      (n) => cohesionOf(n.role, n.body.shape) === "satellite",
    );
    if (satélites.length === 0) {
      fallar(
        "I4 · la mitad `satellite` de la tabla de cohesión tiene casos",
        "ningún nodo del corpus es `satellite`",
        "`caption` y `footnote` son los dos únicos roles `satellite`, y `footnote` es de un dialecto que este adaptador no habla. Sin un epígrafe, `acceptsSatellite` y la rama `satellite` del tramo 5 son código que nadie ejerce",
      );
    }
    const solos = satélites.filter((n) =>
      // La MISMA asimetría que I3: esta mitad se calla (`igual(f.nodes, [undefined])`
      // no matchea nunca, así que «ningún satélite quedó solo» daba verde de mentira) y
      // la de abajo grita. Las dos se re-teclean juntas.
      corrida.fragments.some((f) => igual(f.nodes, [n.id])),
    );
    if (solos.length > 0) {
      fallar(
        "I4 · un satélite nunca queda solo",
        `${solos.length} epígrafes quedaron en un fragmento de un solo nodo`,
        "«un epígrafe termina siendo un fragmento de una línea sin su imagen» es exactamente lo que PROVISIONAL(C16) de `ir` decide evitar, y al rebote deja a la IMAGEN en un fragmento sin una sola letra",
      );
    }
    // Y la otra mitad: una imagen CON epígrafe no queda en un fragmento sin texto. Una
    // imagen SIN epígrafe sí, y eso es correcto —PROVISIONAL(#53): el nodo entra igual,
    // con texto vacío— así que el corpus lleva las dos y el invariante distingue.
    const conEpígrafe = corrida.nodes.filter((n, i) => {
      const siguiente = corrida.nodes[i + 1];
      return (
        n.body.shape === "asset" &&
        siguiente !== undefined &&
        cohesionOf(siguiente.role, siguiente.body.shape) === "satellite"
      );
    });
    const rescatadas = conEpígrafe.filter((n) =>
      corrida.fragments.some((f) => f.nodes.includes(n.id) && f.text !== ""),
    );
    if (conEpígrafe.length === 0 || rescatadas.length !== conEpígrafe.length) {
      fallar(
        "I4 · el epígrafe rescata a su imagen",
        `${conEpígrafe.length} imágenes con epígrafe, ${rescatadas.length} en un fragmento con texto`,
        "es la razón de ser de la cohesión `satellite`: una imagen y su epígrafe son una unidad semántica, y sin el rescate la imagen se indexa como un fragmento sin una sola letra — o sea, no se recupera nunca",
      );
    }
  }

  // ── I5 · UN DOCUMENTO QUE NADIE RECLAMA NO SE PIERDE NI LANZA ─────────────
  {
    const mudo = {
      id: asAdapterId("adaptador-mudo"),
      level: "declarative",
      version: "1",
      evidence: () => Promise.resolve(Evidence.None),
      recognize: () => Promise.resolve([]),
    };
    const r = await ingest(SUBIDA(bytes), { ...OPCIONES(), registry: registryOf([mudo]) }).catch(
      (e) => ({ tiró: String(e) }),
    );
    if (r.tiró !== undefined) {
      fallar(
        "I5 · sin adaptador, la ingesta no lanza",
        `lanzó ${r.tiró}`,
        "`select` devuelve `Selection | null` y `null` es un resultado LEGÍTIMO, no un error disfrazado: el documento queda `on_hold`. Una excepción obliga a cada llamador a capturarla y convierte «nadie sabe leer esto» en «el pipeline se rompió»",
      );
    } else if (r.adapter !== null || r.nodes.length !== 0 || r.achievedLevel !== "plain_text") {
      fallar(
        "I5 · sin adaptador, la corrida sale vacía y lo DICE",
        `adapter=${JSON.stringify(r.adapter)} nodos=${r.nodes.length} nivel=${JSON.stringify(r.achievedLevel)}`,
        "`adapter: null` es lo que distingue «nadie lo leyó» de «lo leyó alguien y no encontró nada», y son dos estados con destinos distintos: uno se reintenta cuando llega un adaptador nuevo, el otro no",
      );
    }
  }

  // ── I6 · UNA EMISIÓN QUE FALLA SE REPORTA, NO SE PIERDE ───────────────────
  // El único camino del paso 3 hacia `ok: false` es una pista que nombra a un padre que
  // nadie emitió, y el `.md` no puede producirla: sus contenedores siempre se declaran
  // antes que sus ítems. Va con un adaptador SINTÉTICO, y eso está escrito y no tapado —
  // sin él la rama es código muerto y ninguna fila del banco la puede tocar.
  {
    const colgante = {
      id: asAdapterId("adaptador-colgante"),
      level: "declarative",
      version: "1",
      evidence: () => Promise.resolve(Evidence.Extension),
      recognize: () =>
        Promise.resolve([
          {
            role: "paragraph",
            body: { shape: "text_span", text: "cuelgo de un fantasma", marks: [] },
            location: { anchor: "x", coordinate: { space: "source" }, adapter: asAdapterId("adaptador-colgante"), within: [] },
            hint: { linkage: "parent", id: asLocalId("x"), parent: asLocalId("fantasma") },
            delegation: [],
            attribution: null,
            level: "physical",
            confidence: null,
          },
        ]),
    };
    const r = await ingest(SUBIDA(bytes), { ...OPCIONES(), registry: registryOf([colgante]) }).catch(
      (e) => ({ tiró: String(e) }),
    );
    const códigos = r.sink?.notices.map((n) => n.code) ?? [];
    if (r.tiró !== undefined || !códigos.includes("emission.failed")) {
      fallar(
        "I6 · una emisión que falla se reporta",
        r.tiró !== undefined ? `lanzó ${r.tiró}` : `los avisos fueron ${JSON.stringify(códigos)}`,
        "«una referencia rota no degrada a raíz»: el emisor corta con un OBJETO de error, y la orquestación tiene que convertirlo en un aviso. Sin el aviso, un documento que no se pudo emitir sale igual que uno vacío y nadie se entera de que hubo una falla estructural",
      );
    }
    if (r.tiró === undefined && (r.nodes.length !== 0 || r.fragments.length !== 0)) {
      fallar(
        "I6 · una emisión que falla no entrega media salida",
        `salieron ${r.nodes.length} nodos y ${r.fragments.length} fragmentos`,
        "el fallo no es asignable al éxito: si el llamador puede leer nodos sin haber mirado el aviso, «el emisor corta» es decorativo y medio árbol llega al índice",
      );
    }
  }

  // ── I7 · LA DELEGACIÓN DE ESTE PASO ES DE PROFUNDIDAD CERO, Y ESTÁ IMPUESTA ─
  // El plan pide «casos con profundidad 0, 1 y ciclo» (§{Estrategia}). Los dos últimos
  // no son ejercitables acá y decirlo no alcanza: el `.md` referencia sus imágenes por
  // URL y NUNCA trae bytes incrustados, así que no hay a quién delegar, y `ingest` no
  // tiene bucle de delegación porque ese bucle es el paso 6. Lo que SÍ se puede
  // verificar es que la profundidad cero no es un olvido sino un estado impuesto.
  {
    const { ctx } = contextOf({
      maxMs: null,
      maxNodes: null,
      maxMaterializedBytes: null,
      maxInvocations: null,
      maxExpansions: null,
    });
    if (ctx.depth !== 0 || ctx.ancestors.length !== 0) {
      fallar(
        "I7 · la profundidad de este paso es cero",
        `depth=${ctx.depth} ancestors=${ctx.ancestors.length}`,
        "«el `Context` de un asset delegado es un HIJO del de su contenedor, no uno nuevo»: con la raíz en otra profundidad, la guarda de ciclo del paso 6 arrancaría desde un estado que nadie eligió",
      );
    }
    const materializó = await ctx
      .materialize(new Uint8Array([0]), "image/png")
      .then(() => true)
      .catch(() => false);
    if (materializó) {
      fallar(
        "I7 · `materialize` rechaza en el paso 3",
        "escribió bytes en un paso que no tiene almacenamiento",
        "«no llamar a `materialize` es lo que hace cumplir la precondición de terminación» (§{Dónde frena}). Que rechace convierte esa precondición en un hecho verificable en vez de una convención entre doce autores — y el día que el paso 6 la implemente, esta línea es el sitio exacto que hay que cambiar",
      );
    }
    const delegados = corrida.nodes.filter((n) => n.delegation.length > 0);
    if (delegados.length > 0) {
      fallar(
        "I7 · ningún nodo del corpus está delegado",
        `${delegados.length} nodos con cadena de delegación`,
        "la cadena la escribe el ORQUESTADOR al injertar, nunca el adaptador. Si aparece sin que nadie haya injertado, es que el adaptador la está inventando",
      );
    }
  }

  // ── I8 · EL TAMAÑO OBJETIVO LO PROVEE EL LLAMADOR, Y DECIDE ALGO ──────────
  // `PARAMETERS.grouping.targetSizeChars` es `Pending<number>` y hoy vale `null`. Este
  // invariante NO fija el número: fija que el parámetro MUEVE la salida. Un parámetro
  // que no cambia nada no es un parámetro pendiente de medición, es código muerto — y
  // dejarlo escrito como pendiente sería inventar una medición que nadie va a hacer.
  {
    const grande = await ingest(SUBIDA(bytes), { ...OPCIONES(), targetSizeChars: 100000 });
    if (grande.fragments.length >= corrida.fragments.length) {
      fallar(
        "I8 · el tamaño objetivo decide dónde corta",
        `con 60 salieron ${corrida.fragments.length} fragmentos y con 100000 salieron ${grande.fragments.length}`,
        "si el número no mueve la frontera de ningún fragmento, `targetSizeChars` no está pendiente de medición: está muerto. Y con él muerto, todo documento es un solo fragmento, un solo vector y una sola clave de caché",
      );
    }
  }

  // ── I9 · LA AUTORÍA NO ENTRA EN LA HUELLA ─────────────────────────────────
  // Se estampa en la orquestación y no en el adaptador porque el caché de reconocimiento
  // cruza organizaciones POR DISEÑO. Si la autoría moviera la huella, el mismo archivo
  // subido por dos personas sería dos contenidos distintos y el caché no serviría nunca.
  {
    const otroAutor = await ingest(
      SUBIDA(bytes, { when: "2030-01-01T00:00:00.000Z", actor: "otra-persona" }),
      OPCIONES(),
    );
    const huellas = corrida.nodes.map((n) => n.hash);
    const otras = otroAutor.nodes.map((n) => n.hash);
    if (!igual(huellas, otras)) {
      fallar(
        "I9 · la autoría no entra en la huella",
        "el mismo archivo con otro autor y otro instante dio huellas distintas",
        "el caché de reconocimiento se indexa por contenido y cruza organizaciones POR DISEÑO (§{Caché}): con la autoría adentro de la huella el mismo documento subido dos veces son dos contenidos, el caché no acierta nunca y la deduplicación de blobs deja de valer",
      );
    }
    const mismaAutoría = otroAutor.nodes.every((n) => n.authorship.actor === "otra-persona");
    if (!mismaAutoría) {
      fallar(
        "I9 · …y la autoría sí viaja con el nodo",
        "los nodos no llevan el actor que se pasó",
        "sin esta mitad, «la autoría no entra en la huella» lo cumple una autoría que no existe. Las dos direcciones hacen falta o el invariante lo satisface borrar el campo",
      );
    }
  }

  // ── EL PISO DE TEXTO, DE PUNTA A PUNTA ────────────────────────────────────
  // El umbral sale de MEDIR el corpus y no de elegir un número:
  // `PARAMETERS.intake.minPrintableProportion` es `Pending<number>` y sigue estándolo.
  // Es la misma disciplina que `targetSizeChars`, y por la misma razón.
  const UMBRAL = printableProportionOf(coldProbeOf(conf, null).magicBytes);
  const CON_PISO = registryOf([opaqueOf(markdownAdapter), opaqueOf(textFloorAdapter(UMBRAL))]);

  // ── I10 · LA DEGRADACIÓN ES REAL Y ES VISIBLE ─────────────────────────────
  // Las DOS mitades, y las dos hacen falta. Que el archivo entre —«nunca se pierde un
  // archivo»— y que DIGA que entró degradado. Un documento degradado que se recupera
  // exactamente igual que uno completo es el defecto: quien consume la memoria no puede
  // saber que lo que está leyendo perdió su estructura.
  {
    const r = await ingest(SUBIDA(conf, { name: "servidor.conf" }), { ...OPCIONES(), registry: CON_PISO });
    if (r.adapter !== TEXT_FLOOR_ID || r.nodes.length === 0 || r.fragments.length === 0) {
      fallar(
        "I10 · un archivo que ningún adaptador reclama entra igual",
        `adapter=${JSON.stringify(r.adapter)} nodos=${r.nodes.length} fragmentos=${r.fragments.length}`,
        "hasta este paso el camino del piso estaba escrito en el contrato y NUNCA había corrido: el `.md` siempre ganaba su archivo, así que `Evidence.Floor`, el segundo nivel del `pool` y `achievedLevel:'plain_text'` eran código que ningún caso tocaba",
      );
    }
    if (r.achievedLevel !== "plain_text" || r.onHold !== null) {
      fallar(
        "I10 · …y DICE que entró degradado",
        `achievedLevel=${JSON.stringify(r.achievedLevel)} onHold=${r.onHold === null ? "null" : "presente"}`,
        "es la mitad cara. `achievedLevel` es el campo que «vuelve visible la degradación» (§{Tramo 1 › El registro}) y se deriva de `evidence > Floor`: sin él, un `.conf` sin estructura y un `.md` con sus secciones se recuperan idénticos y nadie puede decir cuál perdió el árbol. Y `onHold` tiene que ser `null` porque este archivo SÍ se indexó",
      );
    }
    // Y LAS DOS CORRIDAS SON DISTINGUIBLES. Sin esta comparación, «dice plain_text» lo
    // cumpliría un pipeline que dijera `plain_text` para todo.
    if (r.achievedLevel === corrida.achievedLevel) {
      fallar(
        "I10 · el degradado y el completo no se reportan igual",
        `el .conf y el .md dieron los dos ${JSON.stringify(r.achievedLevel)}`,
        "el campo existe para SEPARAR los dos casos. Un valor constante lo satisface y no informa nada: la métrica de degradación de §{Observabilidad} pasaría a ser una columna con un solo valor",
      );
    }
    // El piso en el registro NO le roba el archivo al dedicado, y el golden lo prueba
    // sin repetirse: la corrida del `.md` con el piso puesto tiene que ser IDÉNTICA.
    const conPiso = await ingest(SUBIDA(bytes), { ...OPCIONES(), registry: CON_PISO });
    if (!igual(conPiso, corrida)) {
      fallar(
        "I10 · agregar el piso al registro no mueve al `.md`",
        "la misma corrida con el piso registrado dio otra salida",
        "`Floor` no compite en el mismo `sort` que los dedicados (PROVISIONAL(#429)), y esta es la única fila que lo mide sobre el pipeline ENTERO en vez de sobre `select`: si el piso ganara, todo documento estructurado del corpus se indexaría como texto plano",
      );
    }
  }

  // ── I11 · GUARDAR ES INCONDICIONAL; INDEXAR NO ────────────────────────────
  // El piso es de TEXTO y no es universal. Lo que no es texto y nadie sabe leer NO se
  // indexa —indexar basura binaria es el falso positivo de costo IRREVERSIBLE— pero
  // tampoco se pierde: queda `on_hold`, con lo necesario para reprocesarlo el día que
  // llegue el adaptador. `on_hold` no es «rechazado», es «todavía no lo soportamos».
  {
    const antes = JSON.stringify(png);
    const r = await ingest(SUBIDA(png, { name: "sello.png" }), { ...OPCIONES(), registry: CON_PISO }).catch(
      (e) => ({ tiró: String(e) }),
    );
    if (r.tiró !== undefined) {
      fallar(
        "I11 · lo que no se indexa tampoco lanza",
        `lanzó ${r.tiró}`,
        "un formato sin soporte es el caso NORMAL de una empresa, no una excepción. Convertirlo en throw obliga a capturar en cada llamador y borra la diferencia entre «en espera» y «roto»",
      );
    } else if (r.adapter !== null || r.nodes.length !== 0 || r.fragments.length !== 0) {
      fallar(
        "I11 · lo que no es texto y nadie sabe leer no se indexa",
        `adapter=${JSON.stringify(r.adapter)} nodos=${r.nodes.length} fragmentos=${r.fragments.length}`,
        "el plan le carga a este gate la consecuencia máxima: «erosiona la confianza en la memoria, que es el producto entero» (§{Qué se acepta}). Basura binaria indexada es costo irreversible; texto en espera es recuperable, y por eso el umbral se calibra hacia este lado",
      );
    } else {
      const códigos = r.sink.notices.map((n) => n.code);
      if (!códigos.includes("intake.on_hold")) {
        fallar(
          "I11 · el rechazo a indexar se AVISA",
          `los avisos fueron ${JSON.stringify(códigos)}`,
          "sin el aviso, un documento que nadie sabe leer sale EXACTAMENTE igual que uno que alguien leyó y del que no sacó nada, y «ninguna información se descarta en silencio» lo cumple por no haber nada escrito. Rechazar es información útil —«todavía no soportamos esto»—; rechazar callado es daño mudo",
        );
      }
      if (r.onHold === null || r.onHold.extension !== "png" || r.onHold.size !== png.length) {
        fallar(
          "I11 · lo que queda en espera lleva con qué reintentarlo",
          `onHold=${JSON.stringify(r.onHold === null ? null : { extension: r.onHold.extension, size: r.onHold.size })}`,
          "«se reprocesa el día que llegue el adaptador» solo es una promesa cumplible si queda escrito QUÉ estaba esperando: el barrido del plan corre «solo su `evidencia()` contra las sondas guardadas — se recorre una tabla chica, NO SE LEEN ARCHIVOS» (§{Lo que queda}). Sin la sonda fría, ese día es un barrido del corpus entero",
        );
      }
    }
    if (JSON.stringify(png) !== antes) {
      fallar(
        "I11 · los bytes se conservan",
        "la corrida modificó el arreglo de entrada",
        "guardar es INCONDICIONAL y no está sujeto al umbral: lo único que el umbral decide es la indexación. `sourceOfBytes` entrega el MISMO arreglo en `bytes()` —no una copia— así que un adaptador puede escribir sobre él, y el día que eso pase el original que la cita verbatim promete servir ya no es el original",
      );
    }
    // Y `on_hold` ES RECUPERABLE: los mismos bytes, con un adaptador que los reclama, se
    // leen. Es lo que separa «en espera» de «rechazado», y no es ejercitable sin un
    // adaptador binario — que no existe hasta el paso 6. Va con uno SINTÉTICO, dicho y
    // no tapado.
    const imagenSintética = {
      id: asAdapterId("imagen-sintetica"),
      level: "declarative",
      version: "1",
      evidence: (p) =>
        Promise.resolve(p.extension === "png" ? Evidence.Signature : Evidence.None),
      recognize: () => Promise.resolve([]),
    };
    const reintento = await ingest(SUBIDA(png, { name: "sello.png" }), {
      ...OPCIONES(),
      registry: registryOf([...CON_PISO, imagenSintética]),
    });
    if (reintento.adapter !== "imagen-sintetica" || reintento.onHold !== null) {
      fallar(
        "I11 · `on_hold` es «todavía no», no «nunca»",
        `con el adaptador registrado dio adapter=${JSON.stringify(reintento.adapter)} onHold=${reintento.onHold === null ? "null" : "presente"}`,
        "es lo que vuelve honesto el «aceptamos todo»: no se le guarda al usuario algo que nadie va a mirar nunca. Si registrar el adaptador no cambiara el destino de esos bytes, `on_hold` sería un cementerio con otro nombre",
      );
    }
  }

  // ── I12 · LA CINTURA NO TIENE FORMA DE DOCUMENTO ──────────────────────────
  // Es el invariante por el que existe el paso 5, y el plan lo dice sin vueltas:
  // «que el canal más distinto entre por la misma puerta es la evidencia más fuerte de
  // que la descomposición es correcta» (§{Chat}). Hasta acá era una afirmación sobre
  // el diseño; estas tres mitades la vuelven una medición.
  //
  // Un mensaje no tiene extensión, ni bytes que sondear, ni un documento del que
  // heredar la autoría, y llega por una herramienta MCP en vez de por una subida. Si
  // aguas abajo hiciera falta UNA excepción, la cintura tendría forma de documento.
  {
    const párrafos = [
      "La política de reembolsos cambia el primer lunes de cada trimestre.",
      "El CFO la aprueba antes de publicarla.",
    ];
    const AUTOR = {
      actor: "cfo@empresa",
      when: "2026-03-04T10:15:00.000Z",
      source: "hilo#814",
    };
    const mensaje = await ingest(
      {
        kind: "message",
        adapter: chatAdapter,
        input: { author: AUTOR, paragraphs: párrafos.map((t) => ({ text: t, marks: [] })) },
      },
      OPCIONES(),
    );

    // (a) El mensaje recorre TODO: emisión, migas, huellas, fragmentación. Si alguno de
    // los tramos de abajo tuviera una precondición de documento, se caería acá.
    if (
      mensaje.adapter !== "chat" ||
      mensaje.onHold !== null ||
      mensaje.achievedLevel !== "structured" ||
      mensaje.nodes.length !== párrafos.length ||
      mensaje.fragments.length === 0
    ) {
      fallar(
        "I12 · un mensaje recorre la espina entera",
        `adapter=${JSON.stringify(mensaje.adapter)} nodos=${mensaje.nodes.length} fragmentos=${mensaje.fragments.length} nivel=${JSON.stringify(mensaje.achievedLevel)} onHold=${mensaje.onHold === null ? "null" : "presente"}`,
        "el chat es el canal que más tensiona la abstracción y por eso el plan lo pone en el paso 5 y no en el 10: «descubrirlo roto en el paso 5 cuesta un día; en el 10, la arquitectura». Si un mensaje necesitara una rama propia en emisión o agrupación, la cintura tendría forma de documento",
      );
    }

    // (b) LA AUTORÍA SALE DEL MENSAJE, no de quien invocó. Es la mitad que fallaría en
    // silencio: `OPCIONES` ya no lleva `actor`, así que si la autoría se tomara del
    // llamador sería `undefined` y no un valor equivocado — pero con la puerta de los
    // bytes reutilizada sería el agente de MCP, y todo lo dicho en marzo por el CFO
    // quedaría atribuido a quien lo mandó.
    if (!mensaje.nodes.every((n) => n.authorship.actor === AUTOR.actor)) {
      fallar(
        "I12 · la autoría de un mensaje es la del mensaje",
        `los actores fueron ${JSON.stringify([...new Set(mensaje.nodes.map((n) => n.authorship.actor))])}`,
        "«esto lo dijo el CFO en marzo» es la mitad del valor de la memoria (§{Tramo 3 › Qué sale}). Un mensaje no tiene documento del que heredar la autoría, y tomarla de quien invocó la herramienta MCP le atribuye al agente lo que dijo una persona",
      );
    }
    if (!mensaje.nodes.every((n) => n.authorship.source === AUTOR.source)) {
      fallar(
        "I12 · la atribución cruda del mensaje sobrevive",
        `las fuentes fueron ${JSON.stringify([...new Set(mensaje.nodes.map((n) => n.authorship.source))])}`,
        "`Authorship.source` es «la atribución cruda tal como venía», y para un mensaje es lo único que permite volver al hilo original. En el camino de archivo es la constante `'upload'`; si el mensaje también la trajera constante, la citación de un chat no tendría a dónde apuntar",
      );
    }

    // (c) LA MEDICIÓN, y es la fila que de verdad vale: EL MISMO TEXTO POR LOS DOS
    // CANALES DA LAS MISMAS HUELLAS. La huella se calcula sobre el CUERPO —ni la
    // ubicación, ni la autoría, ni el adaptador entran en la preimagen—, así que dos
    // `text_span` con el mismo texto son el mismo contenido para todo lo que viene
    // después: caché, deduplicación, embeddings y reconciliación.
    //
    // Es «doce formatos convergen en seis formas» dejando de ser una frase sobre tipos
    // y pasando a ser una igualdad entre dos hexadecimales.
    const comoArchivo = await ingest(
      SUBIDA(new TextEncoder().encode(`${párrafos.join("\n\n")}\n`), { name: "nota.md" }),
      OPCIONES(),
    );
    const huellasDelChat = mensaje.nodes.map((n) => n.hash);
    const huellasDelMd = comoArchivo.nodes.map((n) => n.hash);
    if (!igual(huellasDelChat, huellasDelMd)) {
      fallar(
        "I12 · el mismo texto por los dos canales tiene la misma huella",
        `chat=${JSON.stringify(huellasDelChat)}\n        md  =${JSON.stringify(huellasDelMd)}`,
        "es la cintura MEDIDA en vez de afirmada. Si un `.md` y un chat con el mismo texto dieran huellas distintas, el formato estaría filtrándose adentro de la identidad del contenido — y con él a la clave del caché, al dedupe de blobs y a la reconciliación del paso 11, que es exactamente lo que la representación intermedia existe para impedir",
      );
    }
  }

  // ── I13 · LEÍDO Y VACÍO TAMPOCO SE VA EN SILENCIO ─────────────────────────
  // El otro extremo de I11. Allá NADIE supo leer los bytes y queda `on_hold`; acá un
  // adaptador dedicado SÍ los leyó y devolvió cero unidades. Sin aviso, los dos casos
  // salen idénticos a un documento vacío de verdad, y «ninguna información se descarta
  // en silencio» (§{Invariantes}) se cumple por no haber nada escrito.
  //
  // LO DESTAPÓ EL CHAT Y NO ES DEL CHAT: un `.docx` del que el adaptador no saca nada
  // hace lo mismo, pero casi nunca pasa. Una herramienta MCP manda una afirmación vacía
  // sin ningún esfuerzo, así que el canal nuevo volvió alcanzable un hueco que estaba
  // desde el paso 3. Por eso el aviso vive en `ingest` y no en la rama del mensaje, y
  // por eso esta fila lo ejercita por las DOS puertas.
  {
    const vacío = await ingest(
      {
        kind: "message",
        adapter: chatAdapter,
        input: {
          author: { actor: "a", when: "2026-01-01T00:00:00.000Z", source: "s" },
          paragraphs: [],
        },
      },
      OPCIONES(),
    );
    if (!vacío.sink.notices.some((n) => n.code === "intake.empty")) {
      fallar(
        "I13 · una corrida leída y vacía avisa",
        `los avisos fueron ${JSON.stringify(vacío.sink.notices.map((n) => n.code))}`,
        "es el mismo defecto que el paso 4 le cerró a la rama de `on_hold`, en el otro extremo del camino. Una afirmación vacía mandada por MCP sale exactamente igual que una que el pipeline procesó bien y de la que no había nada que sacar: quien invocó la herramienta no tiene cómo saber que lo que mandó no entró",
      );
    }
    if (vacío.onHold !== null) {
      fallar(
        "I13 · leído y vacío NO es «en espera»",
        "una corrida vacía quedó marcada para reprocesar",
        "`on_hold` significa «todavía no lo soportamos» y se REINTENTA cuando llega un adaptador nuevo. Un mensaje vacío no lo va a arreglar ningún adaptador: confundirlos hace crecer la cola con entradas que nunca van a producir nada",
      );
    }

    // Y POR LA PUERTA DE LOS BYTES, que es de donde el hueco venía. Un adaptador que
    // gana el archivo y no saca nada tiene que avisar igual.
    const {
      registry: _r,
      ...sinRegistro
    } = OPCIONES();
    const mudoQueGana = {
      id: asAdapterId("gana-y-no-produce"),
      level: "declarative",
      version: "1",
      evidence: () => Promise.resolve(Evidence.Signature),
      recognize: () => Promise.resolve([]),
    };
    const porBytes = await ingest(SUBIDA(bytes), {
      ...sinRegistro,
      registry: registryOf([mudoQueGana]),
    });
    if (!porBytes.sink.notices.some((n) => n.code === "intake.empty")) {
      fallar(
        "I13 · …y también por la puerta de los bytes",
        `los avisos fueron ${JSON.stringify(porBytes.sink.notices.map((n) => n.code))}`,
        "si el aviso viviera en la rama del mensaje, el hueco original —un adaptador dedicado que gana el archivo y devuelve cero unidades— seguiría abierto, y es el que estuvo abierto desde el paso 3. Las dos mitades hacen falta o la fila la satisface un aviso puesto en el lugar equivocado",
      );
    }
  }

  // ── I14 · UNA IMAGEN ES UN DOCUMENTO COMO CUALQUIER OTRO ──────────────────
  // El invariante por el que existe el paso 6. `adapters` ya fija la mitad local —que
  // el adaptador `imagen` mapee regiones a las seis formas y toque fondo cuando no hay
  // nada más—; esto fija la que solo se puede medir acá, porque necesita el emisor:
  // que el subárbol se INJERTE en la lista plana y HEREDE el contexto del contenedor.
  //
  // «Un asset delega si algún adaptador reclama sus bytes»
  // (§{La delegación es emergente}), y eso es `select()` aplicado a la parte. Si
  // hiciera falta una rama aguas abajo para un nodo que vino de una imagen, la
  // cintura tendría un agujero.
  {
    // El contenedor sintético: un título y una pieza incrustada. Es el paso 2 otra vez
    // —el emisor se construyó con nodos escritos a mano antes de que existiera un
    // adaptador— y por la misma razón: lo que se mide es el MECANISMO, no un decoder.
    const CONTENEDOR = asAdapterId("contenedor-sintetico");
    const contenedor = {
      id: CONTENEDOR,
      level: "declarative",
      version: "1",
      requires: [],
      evidence: (p) => Promise.resolve(p.extension === "caja" ? Evidence.Signature : Evidence.None),
      recognize: (source) =>
        Promise.resolve([
          {
            role: "heading",
            body: { shape: "text_span", text: "Informe anual", marks: [] },
            location: { anchor: "h1", coordinate: { space: "source" }, adapter: CONTENEDOR, within: [] },
            hint: { linkage: "level", level: 1 },
            delegation: [],
            attribution: "sintetico",
            level: "declarative",
            confidence: null,
          },
          {
            role: "image",
            body: {
              shape: "asset",
              // Un RANGO del mismo objeto: es el caso del miembro de un `.zip` o del
              // adjunto de un `.eml`. La ventana nombra la parte sin escribir un byte.
              ref: { object: source.ref.object, window: { scope: "range", start: 0, end: 8 } },
              mime: "image/png",
            },
            location: { anchor: "img1", coordinate: { space: "source" }, adapter: CONTENEDOR, within: [] },
            hint: null,
            delegation: [],
            attribution: null,
            level: "physical",
            confidence: null,
          },
        ]),
    };

    const REGIONES = [
      { box: { frame: "img", x: 0, y: 0, width: 1000, height: 120 }, text: "Ventas por región", confidence: 0.93 },
      { box: { frame: "img", x: 0, y: 140, width: 1000, height: 400 }, text: "Creció un 12%.", confidence: 0.81 },
    ];
    const REG = registryOf([contenedor, opaqueOf(imageAdapter)]);
    const CAJA = SUBIDA(new TextEncoder().encode("cajacaja"), { name: "todo.caja" });

    // ── (a) CON la capacidad: el subárbol se injerta ──────────────────────────
    const conModelo = await ingest(CAJA, {
      ...OPCIONES(),
      registry: REG,
      perceive: () => Promise.resolve(REGIONES),
    });
    const anclas = conModelo.nodes.map((n) => n.location.anchor);
    if (!igual(anclas, ["h1", "img1", "r#0", "r#1"])) {
      fallar(
        "I14 · el subárbol se injerta donde estaba la pieza",
        JSON.stringify(anclas),
        "«el resultado se injerta donde estaba la pieza, de modo que el contenido incrustado hereda el contexto jerárquico de su contenedor» (§{La delegación es emergente}). Si los nodos de la imagen salieran al final o en otra lista, el emisor no podría reencuadrar y las migas del subárbol serían las de la raíz",
      );
    }

    const delImagen = conModelo.nodes.filter((n) => n.location.anchor.startsWith("r#"));
    if (!delImagen.every((n) => n.delegation.length === 1)) {
      fallar(
        "I14 · los nodos delegados llevan su cadena",
        JSON.stringify(delImagen.map((n) => n.delegation)),
        "es una CADENA y no un id suelto porque el emisor tiene que distinguir bajar un nivel de bajar tres (PROVISIONAL(C21) de `ir`). Sin ella, la cita encadenada del ejemplo canónico —contrato.pdf → pg3 → esta celda— no se puede armar",
      );
    }

    // (b) LAS MIGAS CRUZAN LA FRONTERA. Es la mitad que solo el emisor puede dar, y la
    // razón por la que este invariante vive acá y no en `adapters`.
    const migas = delImagen.map((n) => n.breadcrumbs.map((b) => b.text));
    if (!migas.every((m) => m.includes("Informe anual"))) {
      fallar(
        "I14 · el contenido incrustado hereda el contexto de su contenedor",
        JSON.stringify(migas),
        "es la frase literal de §{La delegación es emergente}. Un párrafo que estaba adentro de una imagen que estaba bajo un título tiene que recuperarse SABIENDO bajo qué título estaba, o la memoria devuelve texto sin contexto — que es exactamente lo que las migas existen para impedir",
      );
    }

    // (c) `mixed` ESTRENA PRODUCTOR: parte estructurado, parte delegado.
    if (conModelo.achievedLevel !== "mixed" || conModelo.deferred.length !== 0) {
      fallar(
        "I14 · un documento con delegación sale `mixed`",
        `nivel=${JSON.stringify(conModelo.achievedLevel)} diferidos=${conModelo.deferred.length}`,
        "`mixed` es el ejemplo estrella del plan —198 páginas estructuradas + 2 delegadas— y hasta este paso NO LO PRODUCÍA NADIE. Sale de que hubo delegación y no de que haya corrido un modelo: un `.docx` con un `.xlsx` adentro también es mixto",
      );
    }

    // ── (d) SIN la capacidad: no se invoca, se anota ──────────────────────────
    const sinModelo = await ingest(CAJA, { ...OPCIONES(), registry: REG }).catch((e) => ({
      tiró: String(e),
    }));
    if (sinModelo.tiró !== undefined) {
      fallar(
        "I14 · sin la capacidad, el adaptador NI SE INVOCA",
        `la corrida lanzó: ${sinModelo.tiró}`,
        "el núcleo tiene que comparar `Adapter.requires` contra lo que el contexto trae ANTES de llamar. Si lo invoca igual, el adaptador se encuentra sin su capacidad y falla ruidoso — que es lo correcto de su lado y un desastre del otro: la ingesta entera se cae por una pieza que solo tenía que quedar anotada. Es la razón por la que la decisión vive en el núcleo y no en el adaptador",
      );
    }
    const códigos = sinModelo.sink?.notices.map((n) => n.code) ?? [];
    if (sinModelo.deferred?.length !== 1 || !códigos.includes("delegation.deferred")) {
      fallar(
        "I14 · sin la capacidad, el asset queda anotado",
        `diferidos=${sinModelo.deferred?.length} avisos=${JSON.stringify(códigos)}`,
        "el núcleo compara `Adapter.requires` contra lo que el contexto trae y decide ANTES de invocar. Sin la anotación, «no se intentó» y «se intentó y tocó fondo» son el mismo `asset` sin hijos: o el trabajo se pierde, o la foto de un gato se re-encola para siempre",
      );
    }
    if (sinModelo.nodes?.length !== 2) {
      fallar(
        "I14 · lo que sí se pudo leer entra igual",
        `salieron ${sinModelo.nodes?.length} nodos`,
        "el documento se indexa con lo que tiene y dice qué le falta. Esperar a la capacidad para entregar algo sería poner el trabajo pesado en el camino del usuario, que es justo lo que el corte del contexto existe para evitar",
      );
    }

    // (e) LA MISMA ENTRADA, LOS DOS CONTEXTOS, LOS MISMOS IDS donde el contenido no
    // cambió. Es la precondición de la delegación tardía: «todo lo que ya estaba →
    // hash idéntico → MISMO id» (§{La delegación tardía}). Sin esto, procesar la
    // imagen después movería la identidad de lo que nadie tocó.
    const huellasComunes = (r) =>
      (r.nodes ?? []).filter((n) => !n.location.anchor.startsWith("r#")).map((n) => n.hash);
    if (!igual(huellasComunes(sinModelo), huellasComunes(conModelo))) {
      fallar(
        "I14 · procesar la imagen después no mueve lo que ya estaba",
        `sin=${JSON.stringify(huellasComunes(sinModelo))}\n        con=${JSON.stringify(huellasComunes(conModelo))}`,
        "es lo que vuelve barata la delegación tardía: el documento se indexa incompleto y lo que llega después son ALTAS, no un re-etiquetado. Si las huellas se movieran, cada enriquecimiento despegaría toda la curación del documento — el invariante que §{Orden} llama «el más caro de recuperar si se rompe tarde»",
      );
    }
  }

  // ── I15 · LA RECURSIÓN FRENA, Y NO POR UN CONTADOR ────────────────────────
  // Las dos guardas de §{Dónde frena}, y ninguna es presupuestaria: el presupuesto es
  // la tercera y es el paso 10.
  {
    const IMG = asAdapterId("img-sintetica");
    // Se devuelve A SÍ MISMO: la ventana que sale cubre la que entró. Es la foto de un
    // gato — el modelo miró y no había nada más que sacar.
    const espejo = {
      id: IMG,
      level: "perceptual",
      version: "1",
      requires: [],
      evidence: (p) => Promise.resolve(p.declaredMime === "image/png" ? Evidence.Structure : Evidence.None),
      recognize: (source) =>
        Promise.resolve([
          {
            role: "image",
            body: { shape: "asset", ref: { object: source.ref.object, window: { scope: "whole" } }, mime: "image/png" },
            location: { anchor: "self", coordinate: { space: "source" }, adapter: IMG, within: [] },
            hint: null,
            delegation: [],
            attribution: null,
            level: "physical",
            confidence: null,
          },
        ]),
    };
    const CONT = asAdapterId("cont-espejo");
    const contenedor = {
      id: CONT,
      level: "declarative",
      version: "1",
      requires: [],
      evidence: (p) => Promise.resolve(p.extension === "espejo" ? Evidence.Signature : Evidence.None),
      recognize: (source) =>
        Promise.resolve([
          {
            role: "image",
            body: { shape: "asset", ref: { object: source.ref.object, window: { scope: "range", start: 0, end: 4 } }, mime: "image/png" },
            location: { anchor: "a", coordinate: { space: "source" }, adapter: CONT, within: [] },
            hint: null,
            delegation: [],
            attribution: null,
            level: "physical",
            confidence: null,
          },
        ]),
    };

    const r = await ingest(
      SUBIDA(new TextEncoder().encode("abcdefgh"), { name: "x.espejo" }),
      { ...OPCIONES(), registry: registryOf([contenedor, espejo]) },
    ).catch((e) => ({ tiró: String(e) }));

    if (r.tiró !== undefined) {
      fallar(
        "I15 · el punto fijo frena la recursión",
        `la corrida no terminó: ${r.tiró}`,
        "«si descomponer un asset devuelve un solo bloque cuyo contenido es el mismo que entró, se tocó fondo» (§{Dónde frena}). Sin el punto fijo esto no es un bug de calidad: es una recursión que no termina, y sin presupuesto —que es el paso 10— nada más la para",
      );
    } else {
      const códigos = r.sink.notices.map((n) => n.code);
      if (!códigos.includes("delegation.bottomed") || r.deferred.length !== 0) {
        fallar(
          "I15 · tocar fondo NO es quedar pendiente",
          `avisos=${JSON.stringify(códigos)} diferidos=${r.deferred.length}`,
          "es la otra mitad de la distinción: el modelo SÍ corrió y devolvió lo mismo, así que no hay nada que reintentar. Si esto entrara en `deferred`, la foto de un gato volvería a la cola en cada pasada, para siempre",
        );
      }
    }
  }

  // ── I16 · GOLDEN DE IDENTIDADES: NINGUNA ANOTACIÓN SE DESPEGA ─────────────
  // EL INVARIANTE DEL PASO 11, y §{Orden} lo llama «el más caro de recuperar si se
  // rompe tarde». Dos versiones REALES del mismo documento, con sus huellas calculadas
  // por el mismo `fingerprintOf` que corre en producción.
  //
  // POR QUÉ ACÁ Y NO EN `emission`, que es donde vive `reconcile`: los nodos los
  // produce el adaptador y `emission` NO PUEDE VER `adapters` (R1). Este es el único
  // paquete que alcanza a los dos — la misma razón que puso el golden de I1 acá.
  //
  // EL GOLDEN NO ES EL ÁRBOL: ES LA ASIGNACIÓN DE IDENTIDADES, y lleva DOS columnas.
  // Qué id de v1 quedó en qué nodo de v2, **y qué pase lo ancló**. Sin la segunda, un
  // reconciliador que acierta por casualidad se ve igual que uno que funciona: mover
  // un emparejamiento del pase 1 al 3 significa que la identidad ya no se conserva por
  // contenido sino por parecido, y con una sola columna eso pasa en verde.
  //
  // LOS IDS SE VUELVEN LEGIBLES A PROPÓSITO. Un `ElementId` real es ULID o UUIDv7 —
  // reloj + azar—, así que ningún golden puede congelarlo. El banco deriva los de v1
  // de su ancla (`v1#…`) y acuña con un contador, que es exactamente para lo que
  // `MintFn` entra por parámetro: sin esa costura este invariante no sería escribible.
  //
  // NO LLEVA NINGUNA CLAVE `role`, y es deliberado: la fila S60 muta `"role":` adentro
  // de `manual.golden.json`, y si el texto existiera en dos archivos esa mutación
  // pasaría a tocar los dos y la fila diría otra cosa de la que dice.
  {
    // LA MEMORIA DE LA VERSIÓN ANTERIOR, con ids LEGIBLES. `corrida` ya viene
    // reconciliada —`ingest` lo hace desde el paso 12— y sus ids son los del acuñador
    // contable (`e1..e24`). Acá se los reescribe a `v1#<ancla>` a propósito, por dos
    // razones: el golden se lee, y los dos espacios de acuñado quedan DISJUNTOS. Sin
    // eso, la corrida de v2 acuñaría `e1` para su única alta —su contador también
    // arranca en cero— y ese string ya lo lleva un nodo distinto de v1: el golden
    // saldría plausible y mentiría.
    const previous = knownVersionOf(
      corrida.nodes.map((n, order) => ({
        id: asElementId(`v1#${n.location.anchor}`),
        hash: n.hash,
        role: n.role,
        shape: n.body.shape,
        projection: project(n.body),
        order,
      })),
    );

    // LA RECONCILIACIÓN LA HACE `ingest`, no este guardián. Hasta el paso 12 este bloque
    // llamaba a `reconcile` directo porque la orquestación no lo invocaba; ahora
    // llamarlo a mano probaría la función y NO el cableado, que es lo que este paso
    // agrega. El umbral se elige holgado a propósito: los pares correctos del corpus
    // dan 0.60 y 0.79 y los distractores 0.00, así que CUALQUIER valor entre ambos da
    // el mismo golden — que el resultado no dependa del número es lo que permite que el
    // número siga sin medirse.
    const v2 = await ingest(SUBIDA(corpus("manual.v2.md"), { name: "manual.v2.md" }), {
      ...OPCIONES(),
      previous,
      previousAdapter: corrida.adapter,
      previousVersion: "v1",
    });
    if (v2.metrics === null) {
      fallar(
        "I16 · la v2 del corpus no llegó a reconciliar",
        `adapter=${JSON.stringify(v2.adapter)} nodos=${v2.nodes.length} avisos=${JSON.stringify(v2.sink.notices.map((n) => n.code))}`,
        "`metrics` en `null` es «esta corrida no reconcilió». Sobre dos versiones de un `.md` sano tiene que haber reconciliado, así que un `null` acá es la señal de que el cableado se cortó antes de llegar",
      );
    } else {
      // SE CRUZA POR `id` Y NO POR `local`. El `LocalId` deja de salir de `ingest` en el
      // paso 12, y cruzar por él fallaría MUDO: `get(undefined)` devuelve `undefined`, el
      // `?? null` lo vuelve `null`, y el golden se regeneraría con `"by": null` en las 23
      // filas sin que nada lance — o sea perdiendo justo la columna sin la cual «un
      // reconciliador que acierta por casualidad se ve igual que uno que funciona».
      // `Match.id` es el `ElementId`, que sí viaja en el nodo emitido.
      const porId = new Map(v2.matches.map((m) => [m.id, m.by]));
      // EL REMAPEO VA EN EL GOLDEN, y no es relleno. `parentId` y las migas se remapean
      // desde la MISMA tabla que el `id`, así que sin ellos una mutación que remape las
      // migas por su TEXTO en vez de por su referencia —que es el punto entero de C15,
      // porque el texto de un título es mutable por diseño— pasaría en verde: los ids
      // saldrían perfectos y el árbol quedaría cosido al nodo equivocado.
      const actual = JSON.stringify(
        {
          nodos: v2.nodes.map((n) => ({
            anchorV2: n.location.anchor,
            id: n.id,
            by: porId.get(n.id) ?? null,
            parentId: n.parentId,
            migas: n.breadcrumbs.map((b) => b.ref),
          })),
          bajas: v2.removals,
          metricas: v2.metrics,
        },
        null,
        2,
      );
      const identityPath = join(RAIZ, "corpus", "manual.identity.golden.json");
      if (process.env.ORCHESTRATION_REGEN === "1") {
        writeFileSync(identityPath, `${actual}\n`, "utf8");
        console.log("golden de identidades REGENERADO — revisá el diff antes de commitear");
      } else {
        const esperado = readFileSync(identityPath, "utf8").trimEnd();
        if (actual !== esperado) {
          const a = actual.split("\n");
          const b = esperado.split("\n");
          const i = a.findIndex((l, k) => l !== b[k]);
          fallar(
            "I16 · golden de identidades",
            `primera diferencia en la línea ${i + 1}\n        esperado: ${b[i]}\n        obtenido: ${a[i]}`,
            "un identificador que se mueve NO FALLA: despega en silencio la curación del cliente colgada de él. Este golden es lo único que convierte ese movimiento en un rojo",
          );
        }
      }

      // ACÁ HUBO UNA GUARDA DE FUGAS Y SE BORRÓ, que es una decisión y no un olvido.
      // Verificaba que ningún nodo emitido arrastrara su `local`/`localParent` —valen
      // SOLO dentro de una corrida del emisor, y persistidos dejan dos identidades por
      // nodo—. Al escribirle el mutante que la acreditara, las dos ediciones que
      // producen la fuga resultaron RECHAZADAS POR EL COMPILADOR: agregar la clave a
      // mano da `TS2353` («'local' does not exist in type 'EmittedNode'», porque un
      // literal SÍ tiene chequeo de propiedades de más) y cambiar `...rest` por
      // `...node` deja `rest` sin usar y da `TS6133`. La violación ya es
      // irrepresentable un peldaño más arriba, así que la guarda era una aserción que
      // ningún cambio plausible podía disparar — y una garantía que no se puede
      // acreditar rompiéndola es indistinguible de una que no funciona.
      //
      // LAS DOS SUMAS, y no son un test del golden: valen para cualquier entrada.
      // Salen de que todo se derive de `matches`, así que solo pueden fallar si
      // alguien reintroduce contadores paralelos.
      const m = v2.metrics;
      const emparejados = m.byHash + m.bySimilarity + m.byResidue;
      if (emparejados + m.additions !== m.newNodes || emparejados + m.removals !== m.oldNodes) {
        fallar(
          "I16 · las métricas no cierran",
          `${emparejados}+${m.additions}≠${m.newNodes} o ${emparejados}+${m.removals}≠${m.oldNodes}`,
          "«ninguna información se descarta en silencio» aplicado a la identidad: si las cuentas no cierran hay nodos que no son ni emparejados, ni altas, ni bajas — o sea que desaparecieron sin que nada lo diga",
        );
      }
    }
  }

  // ── I17 · LA CASCADA Y LA DELEGACIÓN SE COMPONEN, DE PUNTA A PUNTA ────────
  // ES EL PASO 7 VISTO DESDE ARRIBA. `adapters` verifica que los dos eslabones
  // resuelvan y que la pieza salga delegable; acá se verifica lo único que ese paquete
  // NO PUEDE ver, porque no alcanza a `emission` ni a la orquestación: que el subárbol
  // se injerte DONDE ESTABA la pieza y herede el contexto jerárquico de su contenedor.
  //
  // Y ES LA PRIMERA VEZ QUE LA DELEGACIÓN CORRE SOBRE UN FORMATO REAL. El paso 6 la
  // construyó con un contenedor sintético —«todo.caja»— porque el `.md` referencia sus
  // imágenes por URL y nunca trae bytes incrustados, así que no había a quién delegar.
  // El `.docx` sí: su imagen está adentro y, cuando la entrada del zip va SIN
  // COMPRIMIR, sus bytes están literales en un rango del archivo.
  {
    const REGIONES = [
      { box: { frame: "img", x: 0, y: 0, width: 100, height: 40 }, text: "SELLO APROBADO", confidence: 0.9 },
    ];
    const r = await ingest(SUBIDA(docx, { name: "manual.docx" }), {
      ...OPCIONES(),
      registry: registryOf([opaqueOf(docxAdapter), opaqueOf(imageAdapter)]),
      perceive: () => Promise.resolve(REGIONES),
    });

    // LOS DOS ESLABONES SOBREVIVEN AL PIPELINE ENTERO. En `adapters` se verifica sobre
    // la salida del adaptador; acá, sobre la salida de `ingest`, que es lo que se
    // persiste. La atribución es «qué eslabón resolvió cada nodo», y el plan la llama
    // «la importante» en observabilidad justamente porque es lo único que distingue un
    // título que el documento DECLARÓ de uno que nosotros INFERIMOS.
    const atribuciones = new Set(r.nodes.map((n) => n.attribution));
    for (const esperado of ["byDocxStyle", "byProminence"]) {
      if (!atribuciones.has(esperado)) {
        fallar(
          `I17 · la atribución \`${esperado}\` no llegó a la salida`,
          JSON.stringify([...atribuciones]),
          "si la atribución se pierde entre el adaptador y el `Run`, aguas abajo no hay forma de distinguir un título declarado de uno inferido — y esa distinción es la que decide cuánta confianza merece la jerarquía de un documento",
        );
      }
    }

    // EL INJERTO EN SU LUGAR. Los nodos del subárbol tienen que quedar ENTRE los del
    // documento, no al final: si salieran al final, el emisor los reencuadraría bajo la
    // sección equivocada y las migas del subárbol serían las del último título.
    const anclas = r.nodes.map((n) => n.location.anchor);
    const delegados = anclas.filter((a) => a.startsWith("r#"));
    const primero = anclas.findIndex((a) => a.startsWith("r#"));
    if (delegados.length === 0 || primero === anclas.length - delegados.length) {
      fallar(
        "I17 · el subárbol no se injertó donde estaba la pieza",
        JSON.stringify(anclas),
        "«el resultado se injerta donde estaba la pieza, de modo que el contenido incrustado hereda el contexto jerárquico de su contenedor» (§{La delegación es emergente}). Con cero delegados la composición no ocurrió; al final, ocurrió en el lugar equivocado",
      );
    }
    if (!r.nodes.filter((n) => n.location.anchor.startsWith("r#")).every((n) => n.delegation.length === 1)) {
      fallar(
        "I17 · los nodos delegados no llevan su cadena",
        JSON.stringify(r.nodes.filter((n) => n.location.anchor.startsWith("r#")).map((n) => n.delegation)),
        "la cadena es lo que corta la recursión por la guarda de ciclo y lo que dice de qué pieza salió cada nodo. Sin ella, un subárbol es indistinguible de contenido del documento padre",
      );
    }

    // Y NIVEL MIXTO. Un documento cuyo texto se reconoce declarativamente y cuya imagen
    // se reconoce perceptualmente no es ninguna de las dos cosas: `mixed` existe para
    // esto y hasta el paso 7 ningún formato real lo producía.
    if (r.achievedLevel !== "mixed") {
      fallar(
        "I17 · el nivel alcanzado no es `mixed`",
        `achievedLevel=${r.achievedLevel}`,
        "reportar `declarative` escondería que parte del documento salió de un modelo, y reportar `perceptual` escondería que la mayor parte no. `mixed` es la única lectura honesta, y este es el primer formato real que la produce",
      );
    }
  }

  // ── I18 · EL ASSET MATERIALIZADO ENTRA POR LA MISMA PUERTA ───────────────
  // La otra rama del paso 7. Cuando los bytes de la pieza NO están literales en el
  // original —comprimidos adentro de un zip, o del otro lado de una URL— el recorte por
  // referencia no se puede expresar y hay que producirlos: guardarlos y darles
  // dirección. Lo que este invariante afirma es que, hecho eso, la pieza recorre
  // EXACTAMENTE el mismo camino que un recorte: `select` la reclama, el adaptador la
  // descompone y el subárbol se injerta donde estaba.
  {
    const guardados = new Map();
    const almacen = {
      put: (k, b) => {
        guardados.set(String(k), b);
        return Promise.resolve();
      },
      get: (k) => Promise.resolve(guardados.get(String(k)) ?? null),
    };
    const byteHash = (b) => createHash("sha256").update(b).digest("hex");
    const conAlmacen = {
      ...OPCIONES(),
      registry: registryOf([opaqueOf(docxAdapter), opaqueOf(imageAdapter)]),
      // EL DOBLE EXIGE BYTES, y sin eso este invariante pasaba por la razón
      // equivocada. Un `perceive` que devuelve regiones sin mirar la fuente hace que la
      // delegación «funcione» aunque los bytes nunca lleguen: el adaptador de imagen
      // reclama por el MIME que declaró el padre —no por el contenido, y eso es
      // deliberado (ver `sourceOfAsset`)— así que un resolvedor roto es invisible.
      // Medido: con la resolución de objetos propios dada vuelta, los nodos delegados
      // seguían apareciendo. Un modelo real no puede hacer nada con cero bytes, y el
      // doble tiene que comportarse igual.
      perceive: async (source) => {
        const b = await source.bytes();
        return b.length === 0
          ? []
          : [{ box: { frame: "img", x: 0, y: 0, width: 100, height: 40 }, text: "SELLO", confidence: 0.9 }];
      },
      storage: almacen,
      byteHash,
    };
    const r = await ingest(SUBIDA(docxZip, { name: "manual-deflated.docx" }), conAlmacen);

    const delegados = r.nodes.filter((n) => n.location.anchor.startsWith("r#"));
    if (delegados.length === 0 || guardados.size === 0) {
      fallar(
        "I18 · el asset comprimido no llegó a delegar",
        `delegados=${delegados.length} objetos=${guardados.size} avisos=${JSON.stringify(r.sink.notices.map((n) => n.code))}`,
        "es la mitad del paso 7 que necesita almacenamiento, y la que prueba que materializar no es un camino aparte: la pieza tiene que entrar por la MISMA puerta que un recorte por referencia y salir con el mismo subárbol injertado",
      );
    }

    // LA DIRECCIÓN SE DERIVA DEL CONTENIDO, y esto es lo que sostiene el dedupe y el
    // reuso del modelo: la misma imagen en cincuenta documentos se guarda UNA vez y se
    // describe UNA vez. Se mide ingiriendo el mismo documento otra vez con el mismo
    // almacén: no puede aparecer un objeto nuevo.
    // Y LA DIRECCIÓN ES, LITERALMENTE, EL HASH DE LO GUARDADO. Verificarlo así y no
    // solo por «dos corridas dan lo mismo» es lo que lo vuelve mutable: cualquier
    // derivación determinística satisface la segunda —el corpus no varía— y solo esta
    // atrapa una clave que salga de otra cosa.
    for (const [clave, guardado] of guardados) {
      if (clave !== byteHash(guardado)) {
        fallar(
          "I18 · la dirección del objeto no es el hash de su contenido",
          `clave=${clave.slice(0, 16)}… hash=${byteHash(guardado).slice(0, 16)}…`,
          "«direccionado por contenido» es lo que declara `ObjectKey` y de lo que dependen el dedupe, el reuso del modelo y —porque la dirección entra en la huella del asset— la estabilidad de la identidad de toda figura",
        );
      }
    }

    // ── EL GOLDEN DE LA RAMA COMPRIMIDA ──────────────────────────────────────
    // El paso 7 lo dejó declarado como faltante: `manual-deflated.docx` tenía dos
    // observadores de COMPORTAMIENTO —I22 acá al lado y las guardas de arriba— y ningún
    // `bytes → nodos` congelado. Las guardas contestan preguntas sueltas («¿delegó?»,
    // «¿la clave es el hash?»); el golden contesta la que ninguna de ellas hace: si algo
    // MÁS se movió.
    //
    // VA EN LA ORQUESTACIÓN Y NO EN `adapters`, y no es preferencia: el banco de aquel
    // paquete rechaza al materializar A PROPÓSITO —es lo que vuelve verificable I22— así
    // que allá esta rama no existe. El único lugar donde el asset materializado llega a
    // tener nodos es acá.
    //
    // CONGELA TAMBIÉN EL ALMACENAMIENTO, que es la mitad que un golden de nodos no ve:
    // sin la columna `objetos` el golden no distingue materializar de degradar, porque
    // los nodos delegados se ven igual vengan de donde vengan.
    {
      const anclaZip = (id) => r.nodes.find((n) => n.id === id)?.location.anchor ?? "?";
      const goldenZip = join(RAIZ, "corpus", "manual-deflated.golden.json");
      const actualZip = JSON.stringify(
        {
          adapter: r.adapter,
          achievedLevel: r.achievedLevel,
          árbol: r.nodes.map((n) => ({
            anchor: n.location.anchor,
            role: n.role,
            shape: n.body.shape,
            level: n.level,
            attribution: n.attribution,
            parent: anclaZip(n.parentId),
            whence: n.whence,
            delegation: n.delegation,
            hash: n.hash,
          })),
          objetos: [...guardados].map(([clave, bytes]) => [clave, bytes.length]),
          sumidero: r.sink,
        },
        null,
        2,
      );
      if (process.env.ORCHESTRATION_REGEN === "1") {
        writeFileSync(goldenZip, `${actualZip}\n`, "utf8");
        console.log("golden del `.docx` deflateado REGENERADO — revisá el diff antes de commitear");
      } else {
        const esperadoZip = readFileSync(goldenZip, "utf8").trimEnd();
        if (actualZip !== esperadoZip) {
          const a = actualZip.split("\n");
          const b = esperadoZip.split("\n");
          const i = a.findIndex((l, k) => l !== b[k]);
          fallar(
            "I18 · golden bytes→nodos del `.docx` deflateado",
            `línea ${i + 1}: esperaba ${JSON.stringify(b[i])}, vino ${JSON.stringify(a[i])}`,
            "el asset materializado recorre el pipeline entero y el golden es lo único que verifica que TODO el recorrido siga dando lo mismo. Las guardas de arriba preguntan cosas puntuales; esto pregunta si algo más se movió",
          );
        }
      }
    }

    const antes = guardados.size;
    await ingest(SUBIDA(docxZip, { name: "otro-nombre.docx" }), conAlmacen);
    if (guardados.size !== antes) {
      fallar(
        "I18 · materializar dos veces el mismo contenido creó dos objetos",
        `${antes} → ${guardados.size}`,
        "si la dirección no sale del contenido, la misma imagen en dos documentos son dos objetos, se guarda dos veces y el modelo la describe dos veces. Y peor: como la dirección entra en la huella del asset, serían DOS IDENTIDADES para la misma figura, así que la curación de una no vale para la otra",
      );
    }

    // SIN ALMACENAMIENTO, LA MISMA ENTRADA DEGRADA EN VEZ DE FALLAR. Es la contracara y
    // va acá porque solo la orquestación puede correr las dos.
    const sinAlmacen = await ingest(SUBIDA(docxZip, { name: "manual-deflated.docx" }), {
      ...OPCIONES(),
      registry: registryOf([opaqueOf(docxAdapter), opaqueOf(imageAdapter)]),
    });
    const códigos = sinAlmacen.sink.notices.map((n) => n.code);
    if (sinAlmacen.nodes.length === 0 || !códigos.includes("docx.media_not_materialised")) {
      fallar(
        "I18 · sin almacenamiento no degrada honestamente",
        `nodos=${sinAlmacen.nodes.length} avisos=${JSON.stringify(códigos)}`,
        "un contexto sin bucket tiene que entregar el documento SIN esa figura y decir cuál falta. Fallar entero perdería el texto por una imagen, y callarse sería descartar en silencio",
      );
    }
  }

  // ── I19 · LA PROCEDENCIA VIAJA, Y LA HUELLA ES CIEGA A ELLA ───────────────
  // Las DOS mitades juntas, y por el mismo motivo que I9 las exige para la autoría:
  // «la procedencia no entra en la huella» lo cumple perfectamente una procedencia que
  // no existe. Sin la mitad positiva, el invariante lo satisface borrar el campo.
  //
  // EL MISMO CONTENEDOR CON OTRA DIRECCIÓN es lo que vuelve al par discriminante, y no
  // hace falta un segundo fixture: se ingiere el MISMO `.docx` declarando otra
  // `ObjectKey` de entrada, que es exactamente el caso real de la misma figura llegando
  // adentro de dos documentos distintos. El asset materializado tiene que dar el MISMO
  // objeto y la MISMA huella —su dirección es el hash de su contenido, y el contenido no
  // cambió— y distinta procedencia, porque salió de otro lado.
  {
    const guardados = new Map();
    const almacen = {
      put: (k, b) => {
        guardados.set(String(k), b);
        return Promise.resolve();
      },
      get: (k) => Promise.resolve(guardados.get(String(k)) ?? null),
    };
    const byteHash = (b) => createHash("sha256").update(b).digest("hex");
    const opcionesDe = () => ({
      ...OPCIONES(),
      registry: registryOf([opaqueOf(docxAdapter), opaqueOf(imageAdapter)]),
      perceive: async (source) => {
        const b = await source.bytes();
        return b.length === 0
          ? []
          : [{ box: { frame: "img", x: 0, y: 0, width: 100, height: 40 }, text: "SELLO", confidence: 0.9 }];
      },
      storage: almacen,
      byteHash,
    });

    const de = async (contenedor) => {
      const r = await ingest(
        SUBIDA(docxZip, { name: "manual-deflated.docx", object: asObjectKey(contenedor) }),
        opcionesDe(),
      );
      return r.nodes.find((n) => n.body.shape === "asset") ?? null;
    };

    const enA = await de("contenedor-A");
    const enB = await de("contenedor-B");

    // (1) LLEGA. Sin esto, las otras dos mitades las cumple `null`.
    if (enA === null || enA.whence === null || enA.whence.path !== "word/media/sello.png") {
      fallar(
        "I19 · la procedencia no llegó a la salida",
        JSON.stringify(enA === null ? null : enA.whence),
        "el único que sabe de dónde salieron los bytes es el adaptador que abrió el zip: si no lo escribe en la unidad, o si el compositor no lo copia al nodo, el dato no existe en ningún otro lado del pipeline y no hay de dónde reconstruirlo",
      );
    }

    // (2) DISTINGUE. La misma figura desde dos contenedores tiene dos procedencias.
    if (enA !== null && enB !== null && enA.whence?.container === enB.whence?.container) {
      fallar(
        "I19 · la procedencia no distingue dos contenedores",
        String(enA.whence?.container),
        "si la procedencia fuera igual para los dos, no contestaría la única pregunta que existe para contestar. Es el modo de falla de guardarla pegada al objeto: una clave, N apariciones, y la segunda pisa a la primera",
      );
    }

    // (3) LA HUELLA ES CIEGA — LATENTE, y se dice de frente. Hoy esta comparación NO
    // PUEDE ponerse roja, y no por debilidad del banco: `whence` es hermano de `body` y
    // `fingerprintOf` recibe `Body`, así que la ceguera la impone la FIRMA. Se midió:
    // ninguna mutación del sitio de materialización la mueve, porque ahí la procedencia
    // no está siquiera en alcance léxico. Quien la impone hoy es la frontera
    // `projection.ts ↛ provenance.ts`, acreditada rompiéndola por miembro (M46, M49 y
    // ahora M66).
    //
    // SE QUEDA PORQUE SE VUELVE VIVA, y el caso ya está escrito en el repo: el día que
    // el `.md` materialice sus imágenes por enlace, el productor de assets deja de ser
    // uno. Y ese camino HOY mete la URL adentro de la `ObjectKey` (`markdown.ts`), o sea
    // que direcciona por origen en vez de por contenido — exactamente lo que esta
    // comparación detecta. Sin ella, ese bug entra sin que nada se ponga rojo.
    if (enA !== null && enB !== null && enA.hash !== enB.hash) {
      fallar(
        "I19 · la procedencia movió la huella",
        `${enA.hash} ≠ ${enB.hash}`,
        "la dirección de un objeto es el hash de su contenido justamente para ser CIEGA a de dónde vino: eso es lo que hace que la misma imagen en cincuenta documentos se guarde una vez y el modelo la describa una vez. Si la procedencia moviera la huella serían cincuenta identidades para una figura, y la curación de una no valdría para las otras cuarenta y nueve",
      );
    }
  }

  if (fallas > 0) process.exit(1);

  console.log(
    `invariantes ok (I1 golden bytes→árbol · I2 determinismo · I3 frontmatter hermano · ` +
      `I4 satélite y su imagen · I5 sin adaptador no se pierde · I6 emisión fallida reportada · ` +
      `I7 delegación de profundidad cero · I8 el tamaño objetivo decide · I9 la autoría fuera de la huella · ` +
      `I10 degradación real y visible · I11 guardar incondicional, indexar no · ` +
      `I12 la cintura no tiene forma de documento · I13 leído y vacío avisa · ` +
      `I14 una imagen es un documento · I15 la recursión frena · ` +
      `I16 golden de identidades, ninguna anotación se despega · ` +
      `I17 la cascada y la delegación se componen · ` +
      `I18 el asset materializado entra por la misma puerta · ` +
      `I19 la procedencia viaja y la huella es ciega a ella)\n` +
      `           ${corrida.nodes.length} nodos · ${corrida.fragments.length} fragmentos · ` +
      `${corrida.records.length} registros · ${corrida.sink.notices.length} avisos`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
