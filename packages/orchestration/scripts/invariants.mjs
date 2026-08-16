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
  // La única dependencia de runtime del pipeline, enlazada donde el resolvedor la busca
  // subiendo desde `<tmp>/node_modules/@savia-os/adapters/markdown.js`.
  symlinkSync(
    realpathSync(join(realpathSync(DEP("adapters")), "node_modules", "yaml")),
    join(salida, "node_modules", "yaml"),
    "dir",
  );

  const destino = join(salida, "orchestration");
  compilar(RAIZ, destino);

  const { contextOf, ingest } = await import(pathToFileURL(join(destino, "index.js")).href);
  const {
    TEXT_FLOOR_ID,
    coldProbeOf,
    markdownAdapter,
    opaqueOf,
    printableProportionOf,
    registryOf,
    textFloorAdapter,
  } = await import(pathToFileURL(join(nm, "adapters", "index.js")).href);
  const { Evidence, asAdapterId, asLocalId, cohesionOf } = await import(
    pathToFileURL(join(nm, "ir", "index.js")).href
  );

  const sha256 = (preimagen) => createHash("sha256").update(preimagen, "utf8").digest("hex");
  const corpus = (archivo) =>
    new Uint8Array(readFileSync(join(realpathSync(DEP("adapters")), "corpus", archivo)));
  const bytes = corpus("manual.md");
  const conf = corpus("servidor.conf");
  const png = corpus("sello.png");

  const REGISTRO = registryOf([opaqueOf(markdownAdapter)]);
  const OPCIONES = {
    registry: REGISTRO,
    name: "manual.md",
    sha256,
    // 60 y no otro número, y hay que decir qué es: es UN PARÁMETRO DEL BANCO, no del
    // producto. `PARAMETERS.grouping.targetSizeChars` sigue en `null` con su plan de
    // medición escrito, y 60 está elegido para que el corte por tamaño ocurra sobre un
    // corpus chico. Va dicho para que nadie lo lea como una medición.
    targetSizeChars: 60,
    when: "2026-08-16T00:00:00.000Z",
    actor: "usuario-sintetico",
  };

  const corrida = await ingest(bytes, OPCIONES);
  const anclaDe = (local) =>
    local === null ? null : corrida.nodes.find((n) => n.local === local)?.location.anchor ?? "?";

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
          parent: anclaDe(n.localParent),
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
    const otra = await ingest(bytes, OPCIONES);
    if (!igual(otra, corrida)) {
      fallar(
        "I2 · determinismo",
        "dos corridas sobre los mismos bytes dieron salidas distintas",
        "es precondición del caché de reconocimiento, y es el único invariante que un golden NO atrapa: una salida no determinística es golden respecto de sí misma. No es un property test —es una entrada fija corrida dos veces— y hay que llamarlo así: un property test necesita un generador de `.md`, que es una pieza que nadie presupuestó",
      );
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
      const enMigas = corrida.nodes.filter((n) => n.breadcrumbs.some((b) => b.ref === fm.local));
      const hijos = corrida.nodes.filter((n) => n.localParent === fm.local);
      if (enMigas.length > 0 || hijos.length > 0) {
        fallar(
          "I3 · el frontmatter es hermano, no ancestro",
          `${enMigas.length} nodos lo llevan en las migas y ${hijos.length} cuelgan de él`,
          "`ContextualFingerprint` es `sha256(miga ‖ texto)` y de ahí sale `FragmentId`: con el frontmatter adentro de la miga de todos, cambiar una línea de metadato le mueve el id a cada fragmento del archivo y despega la curación del cliente EN SILENCIO",
        );
      }
      if (fm.breadcrumbs.length > 0 || fm.localParent !== null) {
        fallar(
          "I3 · el frontmatter cuelga de la raíz",
          `tiene ${fm.breadcrumbs.length} migas y su padre es ${JSON.stringify(anclaDe(fm.localParent))}`,
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
      corrida.fragments.some((f) => igual(f.nodes, [n.local])),
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
      corrida.fragments.some((f) => f.nodes.includes(n.local) && f.text !== ""),
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
    const r = await ingest(bytes, { ...OPCIONES, registry: registryOf([mudo]) }).catch(
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
    const r = await ingest(bytes, { ...OPCIONES, registry: registryOf([colgante]) }).catch(
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
    const grande = await ingest(bytes, { ...OPCIONES, targetSizeChars: 100000 });
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
    const otroAutor = await ingest(bytes, {
      ...OPCIONES,
      when: "2030-01-01T00:00:00.000Z",
      actor: "otra-persona",
    });
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
    const r = await ingest(conf, { ...OPCIONES, name: "servidor.conf", registry: CON_PISO });
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
    const conPiso = await ingest(bytes, { ...OPCIONES, registry: CON_PISO });
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
    const r = await ingest(png, { ...OPCIONES, name: "sello.png", registry: CON_PISO }).catch(
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
    const reintento = await ingest(png, {
      ...OPCIONES,
      name: "sello.png",
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

  if (fallas > 0) process.exit(1);

  console.log(
    `invariantes ok (I1 golden bytes→árbol · I2 determinismo · I3 frontmatter hermano · ` +
      `I4 satélite y su imagen · I5 sin adaptador no se pierde · I6 emisión fallida reportada · ` +
      `I7 delegación de profundidad cero · I8 el tamaño objetivo decide · I9 la autoría fuera de la huella · ` +
      `I10 degradación real y visible · I11 guardar incondicional, indexar no)\n` +
      `           ${corrida.nodes.length} nodos · ${corrida.fragments.length} fragmentos · ` +
      `${corrida.records.length} registros · ${corrida.sink.notices.length} avisos`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
