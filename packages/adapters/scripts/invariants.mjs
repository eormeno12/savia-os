#!/usr/bin/env node
/**
 * Los invariantes del TRAMO 2 y del TRAMO 3, con su guardián ejecutable. Cero
 * dependencias.
 *
 * LO QUE CAMBIA RESPECTO DE `ir` Y DE `emission`. Hasta acá casi toda garantía era de
 * TIPOS o de grafo de módulos, y el testigo era el compilador. Un adaptador es código
 * que CORRE: una mutación de comportamiento no rompe nada, PRODUCE OTRA SALIDA. Por eso
 * el invariante central de este archivo no es una propiedad sino un GOLDEN, y por eso el
 * golden tiene que estar escrito ANTES: sin la salida esperada, la mitad de las filas
 * del banco de mutación pasaría en verde.
 *
 * EL GOLDEN ES `bytes → NODOS CRUDOS`, Y NO PUEDE SER OTRA COSA — es R1 medida.
 * El plan pide «golden files: bytes → árbol» (§{Estrategia}), y el árbol —`localParent`,
 * migas, huellas— lo produce `emit`, que vive en `@savia-os/emission`. Este paquete NO
 * PUEDE VERLO, ni siquiera desde `scripts/`: alcanzarlo por una devDependency para
 * armar el golden sería el borde de paquetes roto por la puerta de servicio, que es
 * exactamente lo que este paso existe para impedir. Así que el golden de `adapters` es
 * lo que `adapters` produce —la lista plana de `RawNode`, con el cuerpo entero— y el
 * bytes→ÁRBOL vive en `@savia-os/orchestration`, que es el único paquete que puede
 * componer los dos. La frontera no es una molestia del guardián: es su resultado.
 *
 * Y EL CUERPO ENTERO, no un resumen. `mime`, `language`, `marks`, `href`, `grain` y
 * `attribution` no se renderizan, así que no aparecen en `Fragment.text` y una mutación
 * sobre cualquiera de ellos pasaría en verde contra un golden de fragmentos. Seis filas
 * del banco dependen de haberlo hecho así.
 *
 * Compila `ir` y este paquete a un directorio temporal —igual que
 * `emission/scripts/invariants.mjs`, y por la misma razón: node no resuelve los imports
 * `.js` del código fuente a los `.ts` de disco— y enlaza `yaml` donde el resolvedor lo
 * va a buscar.
 *
 * LA CADENA DE GUARDIANES NO SE VERIFICA ACÁ. La verifica `scripts/boundaries.mjs`, que
 * corre PRIMERO. Tiene un solo dueño: un chequeo que otro guardián sombrea no acredita
 * nada.
 */

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
const RAIZ_IR = resolve(RAIZ, "..", "ir");
const salida = mkdtempSync(join(tmpdir(), "adapters-invariants-"));

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
  console.error(`ADAPTERS-ERR: ${invariante}\n        ${detalle}\n        importa porque: ${porqué}`);
  fallas += 1;
};

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

try {
  const destinoIr = join(salida, "node_modules", "@savia-os", "ir");
  compilar(RAIZ_IR, destinoIr);
  writeFileSync(
    join(destinoIr, "package.json"),
    JSON.stringify({
      name: "@savia-os/ir",
      version: "0.0.0",
      type: "module",
      exports: { ".": "./index.js" },
    }),
  );
  // LAS DEPENDENCIAS DE RUNTIME se ENLAZAN donde el resolvedor las va a buscar subiendo
  // desde `<tmp>/adapters/<archivo>.js`, y el guardián tiene que ejercitarlas de verdad:
  // un frontmatter parseado por un doble, o un zip inflado por un doble, serían los
  // únicos lugares del paquete donde la prueba no toca el código que corre.
  // SE DERIVAN DE `dependencies`, no se escriben a mano. Hasta el paso 7 acá decía
  // `yaml` y nada más, y al entrar `fflate` y `txml` el banco falló con
  // `ERR_MODULE_NOT_FOUND` sobre un archivo compilado — ruidoso, pero por un motivo que
  // no menciona la causa. Derivada de la lista, la próxima dependencia se enlaza sola.
  for (const dep of Object.keys(
    JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")).dependencies ?? {},
  )) {
    if (dep.startsWith("@savia-os/")) continue;
    symlinkSync(
      realpathSync(join(RAIZ, "node_modules", dep)),
      join(salida, "node_modules", dep),
      "dir",
    );
  }

  const destino = join(salida, "adapters");
  compilar(RAIZ, destino);

  const {
    MARKDOWN_ID,
    TEXT_FLOOR_ID,
    blocksOf,
    cascade,
    chatAdapter,
    imageAdapter,
    coldProbeOf,
    docxAdapter,
    markdownAdapter,
    opaqueOf,
    printableProportionOf,
    probeOf,
    recognizeMessage,
    registryOf,
    sourceOfAsset,
    select,
    sourceOfBytes,
    textFloorAdapter,
  } = await import(pathToFileURL(join(destino, "index.js")).href);
  const { Evidence, asAdapterId, asObjectKey, certaintyOfLevel, isLegalPair, ROLES } = await import(
    pathToFileURL(join(destinoIr, "index.js")).href
  );

  const bytes = new Uint8Array(readFileSync(join(RAIZ, "corpus", "manual.md")));
  const conf = new Uint8Array(readFileSync(join(RAIZ, "corpus", "servidor.conf")));
  const png = new Uint8Array(readFileSync(join(RAIZ, "corpus", "sello.png")));
  const docx = new Uint8Array(readFileSync(join(RAIZ, "corpus", "manual.docx")));
  const docxZip = new Uint8Array(readFileSync(join(RAIZ, "corpus", "manual-deflated.docx")));

  /**
   * LOS DOS UMBRALES SALEN DE MEDIR EL CORPUS, NO DE ELEGIR UN NÚMERO.
   * `PARAMETERS.intake.minPrintableProportion` es `Pending<number>` y sigue estándolo:
   * el plan lo declara medible («curva ROC sobre un corpus etiquetado binario/texto») y
   * no lo midió. Lo que este guardián verifica NO es que el umbral valga 0.8 —eso sería
   * el número inventado— sino que **el parámetro gobierna la decisión**: con el umbral
   * en la proporción del archivo de texto, el binario cae; con el umbral en la
   * proporción del binario, el binario entra. Si el parámetro dejara de decidir, las
   * dos mitades no podrían dar resultados distintos.
   */
  const ventanaDe = (b) => coldProbeOf(b, null).magicBytes;
  const P_TEXTO = printableProportionOf(ventanaDe(conf));
  const P_BINARIO = printableProportionOf(ventanaDe(png));

  /**
   * El contexto MÍNIMO que un adaptador necesita, escrito acá y no importado: el que el
   * pipeline usa de verdad vive en `@savia-os/orchestration`, y traerlo cruzaría la
   * frontera que este paquete acredita. Que quepa en veinte líneas es el dato: un
   * adaptador consume `diagnostics` y nada más.
   */
  const contextoDe = () => {
    const notices = [];
    const degradations = [];
    return {
      notices,
      degradations,
      ctx: {
        diagnostics: {
          notice: (code, location, detail) =>
            void notices.push({ code, location, detail: detail ?? null }),
          degraded: (from, to, reason) => void degradations.push({ from, to, reason }),
        },
        limits: {
          maxMs: null,
          maxNodes: null,
          maxMaterializedBytes: null,
          maxInvocations: null,
          maxExpansions: null,
        },
        ancestors: [],
        depth: 0,
        signal: { aborted: false },
        spend: () => true,
        invoke: (_k, work) => work(),
        materialize: () => Promise.reject(new Error("no")),
        // `null` = este contexto NO PUEDE percibir, que es el estado del hilo del
        // request. Un contexto de banco que lo trajera por defecto escondería
        // justamente el corte que el paso 6 introduce.
        perceive: null,
      },
    };
  };

  /**
   * Desde el paso 6 una `Source` lleva su propia identidad —`ref` y `mime`—, porque
   * un adaptador tiene que poder NOMBRAR lo que está leyendo para emitir un `asset`.
   * El banco le da una clave sintética y estable: no hay host que las acuñe acá, y
   * una clave que cambiara por corrida rompería el determinismo de I2.
   */
  const fuenteDe = (b, mime = "application/octet-stream") =>
    sourceOfBytes(b, asObjectKey(`obj-${b.length}`), mime);

  const opaco = opaqueOf(markdownAdapter);
  const corrida = contextoDe();
  const crudos = await opaco.recognize(fuenteDe(bytes), corrida.ctx);

  // ── I1 · GOLDEN: BYTES → NODOS CRUDOS ─────────────────────────────────────
  // Es el único invariante que compara contra algo EXTERNO al código. Los demás
  // verifican que la salida sea coherente CONSIGO MISMA, y una salida puede ser
  // perfectamente coherente y ser el árbol equivocado.
  //
  // Se regenera con `ADAPTERS_REGEN=1`, y eso NO es lo mismo que `vitest -u`: no hay
  // ningún script del `package.json` que lo pase, así que regenerar es un comando que
  // alguien escribe a mano y que aparece en el diff del golden. La diferencia entre un
  // golden y un snapshot no es el formato, es cuánto cuesta borrarlo sin querer.
  {
    const goldenPath = join(RAIZ, "corpus", "manual.golden.json");
    const actual = JSON.stringify(
      {
        nodos: crudos.map((n) => ({
          anchor: n.location.anchor,
          coordinate: n.location.coordinate,
          adapter: n.location.adapter,
          role: n.role,
          level: n.level,
          attribution: n.attribution,
          confidence: n.confidence,
          hint: n.hint,
          delegation: n.delegation,
          body: n.body,
        })),
        avisos: corrida.notices,
      },
      null,
      2,
    );
    if (process.env.ADAPTERS_REGEN === "1") {
      writeFileSync(goldenPath, `${actual}\n`, "utf8");
      console.log("golden REGENERADO — revisá el diff antes de commitear");
    } else {
      const esperado = readFileSync(goldenPath, "utf8").trimEnd();
      if (actual !== esperado) {
        const a = actual.split("\n");
        const b = esperado.split("\n");
        const i = a.findIndex((l, k) => l !== b[k]);
        fallar(
          "I1 · golden bytes→nodos",
          `primera diferencia en la línea ${i + 1}\n        esperado: ${b[i]}\n        obtenido: ${a[i]}`,
          "un adaptador es código que CORRE: sin la salida esperada escrita antes, una mutación de comportamiento no rompe el compilador — produce otra salida y nadie se entera",
        );
      }
    }
  }

  // ── I2 · DETERMINISMO: DOS CORRIDAS BYTE-IDÉNTICAS ────────────────────────
  {
    const otra = contextoDe();
    const segundos = await opaco.recognize(fuenteDe(bytes), otra.ctx);
    if (!igual(segundos, crudos) || !igual(otra.notices, corrida.notices)) {
      fallar(
        "I2 · determinismo",
        "dos corridas sobre los mismos bytes dieron salidas distintas",
        "es precondición del caché de reconocimiento (§{El determinismo}), y es el único invariante que un golden NO atrapa: una salida no determinística es golden respecto de sí misma. Corre con `maxMs` en `null`, como `ir` exige — con un tope de tiempo de pared el conjunto de nodos depende de la velocidad de la máquina",
      );
    }
  }

  // ── I3 · LA PAREJA OBLIGATORIA rol⇒forma ──────────────────────────────────
  // «No se corrige en runtime: SE VERIFICA» (§{La pareja}). El plan la lista como
  // «aserción en el registro, ningún test», y eso NO EXISTE: `Adapter` no expone qué
  // pares emitirá, así que decidirlo exige EJECUTAR. Esta es la compuerta de CI que lo
  // reemplaza, y hay que llamarla así.
  {
    const ilegales = crudos.filter((n) => !isLegalPair(n.role, n.body.shape));
    if (ilegales.length > 0) {
      fallar(
        "I3 · la pareja obligatoria rol⇒forma",
        `${ilegales.length} nodos ilegales: ${JSON.stringify(ilegales.map((n) => [n.role, n.body.shape]))}`,
        "un `role:'fields'` con forma `grid` es exactamente la clase de error para la que existe la pareja, y sin la compuerta llega al índice",
      );
    }
  }

  // ── I4 · CERO FUGAS DE FORMATO EN EL NODO ─────────────────────────────────
  // Las señales MUEREN en la unidad (§{`descomponer`}). El TIPO ya cierra la puerta
  // —`RawNode` no tiene dónde ponerlas— y esto cierra la ventana: `location.anchor` es
  // un `string` OPACO y `attribution` también, así que un adaptador puede filtrarlas
  // ADENTRO de un campo libre sin que nada se queje.
  {
    const serializado = JSON.stringify(crudos);
    const fugas = ["signals", "styleId", "depth=", "block=", "container=", "previous="].filter(
      (marca) => serializado.includes(marca),
    );
    if (fugas.length > 0) {
      fallar(
        "I4 · cero fugas de formato en el nodo",
        `la salida menciona: ${fugas.join(", ")}`,
        "si una señal del formato cruza el borde, R1 deja de ser una propiedad del grafo y pasa a ser una convención que alguien revisa",
      );
    }
  }

  // ── I5 · EL PISO FÍSICO RESPONDE DONDE EL CLASIFICADOR SE ABSTIENE ────────
  {
    const delPiso = crudos.filter((n) => n.attribution === null);
    if (delPiso.length === 0) {
      fallar(
        "I5 · el piso físico responde",
        "ningún nodo del corpus lo resolvió el piso",
        "sin C1 un clasificador declarativo resuelve TODO y los eslabones siguientes no corren nunca: el caso para el que se inventó la cascada quedaría sin cubrir. Y el rol sale igual por los dos caminos —`paragraph`—, así que lo único que lo delata es el NIVEL",
      );
    }
    const malNivel = delPiso.filter((n) => n.level !== "physical");
    if (malNivel.length > 0) {
      fallar(
        "I5 · el piso es de nivel `physical`",
        `${malNivel.length} nodos del piso con nivel ${JSON.stringify(malNivel.map((n) => n.level))}`,
        "`certaintyOfLevel` mapea `physical` y `declarative` a `declared`, así que la CERTEZA no cambia y ningún consumidor de certeza se entera: lo que se pierde es la atribución, que es «el indicador de salud de toda la capa» (§{Observabilidad})",
      );
    }
    const disfrazados = crudos.filter((n) => n.attribution !== null && n.level === "physical");
    if (disfrazados.length > 0) {
      fallar(
        "I5 · atribución y nivel no se contradicen",
        `${disfrazados.length} nodos con eslabón y nivel de piso`,
        "`attribution: null` significa «lo resolvió el piso» y NADIE MÁS lo escribe. Con el piso disfrazado de eslabón, «si en DOCX el 60 % lo resuelve `porProminencia` en vez de `porStyleId` hay un mapa de estilos incompleto» (§{Observabilidad}) es una lectura imposible",
      );
    }
    const sinConfianza = delPiso.filter((n) => n.confidence !== null);
    if (sinConfianza.length > 0) {
      fallar(
        "I5 · el piso no reporta confianza",
        `${sinConfianza.length} nodos del piso con confianza`,
        "`null` es NO APLICA y nunca «cero»: el piso no infiere nada, así que no hay confianza que reportar, y leer el `null` como cero invierte exactamente el sentido (el #74 de `Fragment` en `ir`)",
      );
    }
  }

  // ── I6 · NINGUNA INFORMACIÓN SE DESCARTA EN SILENCIO ──────────────────────
  // Cinco casos, y los cuatro que no están en el corpus se ejercitan con entradas
  // propias: meterlos en el corpus lo convertiría en un catálogo de patologías y el
  // golden dejaría de leerse como un documento.
  {
    const avisosDe = (texto) => {
      const códigos = [];
      blocksOf(texto, (code) => códigos.push(code));
      return códigos;
    };
    const casos = [
      ["md.thematic_break", corrida.notices.map((n) => n.code), "el corpus tiene una regla horizontal"],
      ["md.fence.unterminated", avisosDe("```js\nx\n"), "una valla que abre y no cierra"],
      ["md.frontmatter.unterminated", avisosDe("---\na: 1\n"), "un frontmatter que abre y no cierra"],
      ["md.frontmatter.invalid", avisosDe("---\na: [1, 2\n---\n"), "un frontmatter que no es YAML"],
      ["md.frontmatter.unsupported", avisosDe("---\na:\n  b: 1\n---\n"), "un valor no escalar"],
    ];
    for (const [código, vistos, qué] of casos) {
      if (vistos.includes(código)) continue;
      fallar(
        "I6 · nada se descarta en silencio",
        `${qué} y no salió \`${código}\` — los avisos fueron ${JSON.stringify(vistos)}`,
        "«descartar en silencio es el peor modo de falla» (§{Estrategia}): lo que no tiene forma que lo exprese se AVISA, no se borra. Los tres casos de frontmatter son además la política de «nunca se pierde un archivo, nunca se indexa basura» — el bloque cae a prosa y el aviso dice por qué",
      );
    }
    // Y el frontmatter que no se pudo leer NO produce un nodo `fields`: cae a prosa.
    const rotos = blocksOf("---\na: [1, 2\n---\n", () => {});
    if (rotos.some((d) => d.signals.block === "frontmatter")) {
      fallar(
        "I6 · un frontmatter ilegible no se indexa igual",
        "un frontmatter inválido produjo un nodo `fields`",
        "«nunca se indexa basura»: si el bloque entra al índice con los pares que se pudieron adivinar, el metadato del documento pasa a ser una conjetura sin marca de que lo sea",
      );
    }
  }

  // ── I7 · `caption` LLEGA POR DOS ESLABONES, Y CON NIVELES DISTINTOS ───────
  // Es la decisión D1 hecha invariante. NO fija cuántos epígrafes hay: fija que los dos
  // caminos existen y que el nivel lo pone la señal más débil de cada uno.
  {
    const captions = crudos.filter((n) => n.role === "caption");
    const declarado = captions.find((n) => n.attribution === "byMarkdownBlock");
    const inferido = captions.find((n) => n.attribution === "byNearbyItalic");
    if (declarado === undefined || inferido === undefined) {
      fallar(
        "I7 · `caption` llega por DOS eslabones",
        `los epígrafes del corpus son ${JSON.stringify(captions.map((n) => [n.attribution, n.level]))}`,
        "el título de CommonMark —`![alt](fig.png \"epígrafe\")`— es la única construcción que DECLARA un epígrafe, y prácticamente nadie la escribe; lo que la gente escribe es un párrafo en cursiva debajo de la figura. Con un solo eslabón, o el rol es inalcanzable en la práctica o todo epígrafe se reporta como inferido",
      );
    } else {
      if (declarado.level !== "declarative" || certaintyOfLevel(declarado.level) !== "declared") {
        fallar(
          "I7 · el epígrafe DECLARADO es `declarative`",
          `salió con nivel ${declarado.level}`,
          "el documento lo dijo con una construcción del formato: rebajarlo a inferido le pone a Savia una duda que el autor no tenía",
        );
      }
      if (inferido.level !== "positional" || certaintyOfLevel(inferido.level) !== "inferred") {
        fallar(
          "I7 · el epígrafe POR POSICIÓN es `positional`, no `declarative`",
          `salió con nivel ${inferido.level} (certeza ${certaintyOfLevel(inferido.level)})`,
          "la cursiva sola no dice «epígrafe» —dice énfasis—; lo dice estar pegado a una imagen, y eso es POSICIÓN. El nivel lo fija la señal más débil, e inferirlo estampando `declarative` es exactamente lo que `certaintyOfLevel` existe para impedir",
        );
      }
    }
    // LA MITAD NEGATIVA, sin la cual la anterior la cumple «todo párrafo tras una imagen
    // es epígrafe». El corpus lleva una tercera imagen seguida de un párrafo que NO está
    // en cursiva, y ese párrafo tiene que seguir siendo un párrafo.
    const pegadoNoEpígrafe = crudos.some((n, i) => {
      const previo = crudos[i - 1];
      return previo !== undefined && previo.body.shape === "asset" && n.role === "paragraph";
    });
    if (!pegadoNoEpígrafe) {
      fallar(
        "I7 · no todo lo que sigue a una imagen es epígrafe",
        "el corpus no tiene un párrafo pegado a una imagen que haya quedado como párrafo",
        "sin el caso negativo, «cursiva Y adyacente» es indistinguible de «adyacente», y la mitad que de verdad discrimina no está verificada por nada",
      );
    }
  }

  // ── I8 · EL SELECTOR ──────────────────────────────────────────────────────
  {
    // EL PISO DE VERDAD, y no un sosías. Hasta el paso 4 acá había un doble de cinco
    // líneas que devolvía `Floor` a secas: el gate de CI verificaba el selector contra
    // un adaptador que el registro nunca guardaría, que es exactamente el defecto que
    // PROVISIONAL(C9) de `ir` nombra para `recognize`. Con el piso escrito, el doble se
    // borra — una pieza menos, y la que queda es la que corre en producción.
    const piso = opaqueOf(textFloorAdapter(P_TEXTO));
    // Un evidenciador ROTO. `Promise.all` propaga el rechazo: sin captura, un bug en un
    // adaptador que ni siquiera reclamaba el archivo decide su destino (PROVISIONAL(#9)).
    const roto = {
      id: asAdapterId("adaptador-roto"),
      level: "declarative",
      version: "1",
      evidence: () => Promise.reject(new Error("boom")),
      recognize: () => Promise.resolve([]),
    };
    // Un SEGUNDO dedicado, con evidencia más baja. Sin él el `pool` tiene un solo
    // elemento y la DIRECCIÓN del `sort` es inobservable — el banco de mutación del
    // prototipo la invirtió EN VERDE.
    const flojo = {
      id: asAdapterId("markdown-heuristico"),
      level: "physical",
      version: "1",
      evidence: (p) => Promise.resolve(p.extension === "md" ? Evidence.Content : Evidence.None),
      recognize: () => Promise.resolve([]),
    };
    const registro = registryOf([piso, roto, flojo, opaco]);
    const sonda = (nombre) =>
      probeOf(
        coldProbeOf(bytes, nombre),
        { kind: "channel", channel: "frontend" },
        fuenteDe(bytes),
      );

    const conMd = await select(registro, sonda("manual.md")).catch(() => "TIRÓ");
    if (conMd === "TIRÓ") {
      fallar(
        "I8 · un evidenciador que lanza cuenta como None",
        "un adaptador roto hizo fallar la selección de todos",
        "`select` usa `Promise.all`, que PROPAGA el rechazo, en un pipeline donde «los archivos rotos son la norma, no la excepción» (§{Los decodificadores})",
      );
    } else if (conMd?.adapter.id !== MARKDOWN_ID) {
      fallar(
        "I8 · el piso no compite con un adaptador dedicado",
        `ganó ${JSON.stringify(conMd?.adapter.id ?? null)}`,
        "con el filtro literal del plan (`e > None`), `Floor = 0` pasa y empata, y quién gana lo decide el ORDEN ALFABÉTICO del nombre del adaptador (PROVISIONAL(#429))",
      );
    }

    const enMayúsculas = await select(registro, sonda("MANUAL.MD"));
    if (enMayúsculas?.adapter.id !== MARKDOWN_ID) {
      fallar(
        "I8 · la extensión se normaliza en la sonda",
        `con "MANUAL.MD" ganó ${JSON.stringify(enMayúsculas?.adapter.id ?? null)}`,
        "es el campo del que dependen todos los evidenciadores de nivel `Extension`, o sea el que decide en ausencia de firma: normalizarlo en cada adaptador son doce oportunidades de no hacerlo",
      );
    }

    let duplicadoAceptado = false;
    try {
      registryOf([piso, piso]);
      duplicadoAceptado = true;
    } catch {
      duplicadoAceptado = false;
    }
    if (duplicadoAceptado) {
      fallar(
        "I8 · dos adaptadores no pueden compartir id",
        "el registro aceptó dos entradas con el mismo id",
        "el desempate por id es «precondición de que el caché sea válido» (§{El selector}) y con dos iguales el comparador da 0: el resultado pasa a depender del orden de declaración",
      );
    }

    const sinExtensión = await select(registro, sonda("manual"));
    if (sinExtensión?.adapter.id !== TEXT_FLOOR_ID || sinExtensión.achievedLevel !== "plain_text") {
      fallar(
        "I8 · sin adaptador dedicado se cae al piso, y se DECLARA",
        `ganó ${JSON.stringify(sinExtensión?.adapter.id ?? null)} con nivel ${JSON.stringify(sinExtensión?.achievedLevel ?? null)}`,
        "`achievedLevel` es el campo que «vuelve visible la degradación» (§{Tramo 1 › El registro}) y se deriva de `evidence > Floor`, no de comparar la identidad de un adaptador desde afuera",
      );
    }

    const dosVeces = await select(registro, sonda("manual.md"));
    if (dosVeces?.adapter.id !== conMd?.adapter.id) {
      fallar(
        "I8 · el mismo archivo elige siempre el mismo adaptador",
        "dos selecciones sobre la misma sonda dieron adaptadores distintos",
        "es precondición de que el caché sea válido (§{El selector})",
      );
    }

    const sinNadie = await select(registryOf([roto]), sonda("manual.md"));
    if (sinNadie !== null) {
      fallar(
        "I8 · sin nadie que reclame, la selección es `null`",
        `devolvió ${JSON.stringify(sinNadie)}`,
        "`null` es un resultado LEGÍTIMO y no un error disfrazado: el documento queda `on_hold`, no se pierde y no se rompe. Si en vez de `null` saliera el primero del registro, un archivo que nadie sabe leer entraría al índice como si alguien lo hubiera leído",
      );
    }
  }

  // ── I9 · LA CASCADA REORDENA POR NIVEL, NO POR ORDEN DEL AUTOR ────────────
  // Se ejerce con los eslabones escritos AL REVÉS a propósito: contra una cascada ya
  // ordenada por su autor, quitar el `sort` no cambia nada y el invariante no acredita.
  {
    const unidad = {
      signals: {},
      body: { shape: "text_span", text: "x", marks: [] },
      location: { anchor: "x", coordinate: { space: "source" } },
    };
    const alRevés = cascade([
      { name: "perceptual", level: "perceptual", detect: () => () => ({ role: "quote", hint: null }) },
      { name: "declarativo", level: "declarative", detect: () => () => ({ role: "code", hint: null }) },
    ])([unidad]);
    const r = alRevés(unidad);
    if (r?.attribution !== "declarativo" || r?.level !== "declarative") {
      fallar(
        "I9 · la cascada reordena por nivel",
        `resolvió ${JSON.stringify(r?.attribution ?? null)} con nivel ${JSON.stringify(r?.level ?? null)}`,
        "«el invariante se cumple POR CONSTRUCCIÓN, no por revisión» (§{La única}): si el orden del autor decidiera, un modelo perceptual le ganaría a lo que el documento DECLARA y la certeza que viaja hasta la skill mentiría",
      );
    }
  }

  // ── I10 · `range` ES `[start, end)`, EN BYTES ─────────────────────────────
  {
    const diez = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const s = fuenteDe(diez);
    const trozos = [await s.range(0, 4), await s.range(4, 8), await s.range(8, 10)];
    const total = trozos.reduce((t, x) => t + x.length, 0);
    if (total !== diez.length || trozos[0].length !== 4) {
      fallar(
        "I10 · `range` es [start, end), en bytes",
        `tres tramos de 4+4+2 devolvieron ${trozos.map((x) => x.length).join("+")} = ${total} de ${diez.length}`,
        "media abierta es la convención que `ir` ya fija tres veces (bytes, code points, milisegundos); leerla cerrada mete agujeros en el documento SIN UNA SOLA EXCEPCIÓN y sin un aviso",
      );
    }
  }

  // ── I11 · EL FRONTMATTER ES HERMANO, NO ANCESTRO ──────────────────────────
  // La razón está medida y no es de gusto: `ContextualFingerprint` es
  // `sha256(miga ‖ texto)` y de ahí sale `FragmentId`. Si el frontmatter abriera scope
  // entraría en la miga de TODOS, y editar `version:` re-embebería el documento entero.
  {
    const fm = crudos.find((n) => n.role === "fields");
    if (fm === undefined || !igual(fm.hint, { linkage: "none" })) {
      fallar(
        "I11 · el frontmatter es hermano, no ancestro",
        `su pista es ${JSON.stringify(fm?.hint ?? null)} y tiene que ser {"linkage":"none"}`,
        "`{linkage:'none'}` es raíz explícita SIN abrir scope. Cualquier pista que abra —`level`, o `parent` con un id— lo mete en la miga de todo el documento, y con la miga adentro de la huella contextual editar una línea de metadato mueve el `FragmentId` de cada fragmento del archivo",
      );
    }
    const loNombran = crudos.filter((n) => n.hint?.linkage === "parent" && n.hint.parent === "frontmatter");
    if (loNombran.length > 0) {
      fallar(
        "I11 · nadie cuelga del frontmatter",
        `${loNombran.length} nodos lo nombran como padre`,
        "es la otra mitad: no alcanza con que él no abra scope si alguien lo nombra igual",
      );
    }
  }

  // ── I12 · LOS DOS ROLES DE PÁGINA SON INALCANZABLES POR CONSTRUCCIÓN ──────
  // No es un hueco: markdown NO TIENE PÁGINAS. Se verifica en vez de declararse porque
  // la afirmación es falsable — un adaptador que los emitiera estaría inventando una
  // paginación que el formato no tiene, y el mecanismo de «el mobiliario de página se
  // descompone último» quedaría alimentado por una conjetura.
  {
    const dePágina = crudos.filter((n) => n.role === "page_header" || n.role === "page_footer");
    if (dePágina.length > 0) {
      fallar(
        "I12 · `page_header`/`page_footer` no son alcanzables en markdown",
        `${dePágina.length} nodos con rol de página`,
        "el concepto no existe en el formato. Emitirlos sería inventar una paginación, y el mecanismo que los consume («el mobiliario de página se descompone último») pasaría a alimentarse de una conjetura del adaptador",
      );
    }
  }

  // ── I13 · EL FRONTMATTER SE LEE CON UN PARSER DE VERDAD, EN YAML 1.2 CORE ─
  // Es la única línea del paquete que justifica una dependencia de runtime, así que la
  // garantía tiene que ser explícita y no un renglón del golden. Los dos casos son los
  // que un parser a mano —y cualquier librería que siga YAML 1.1— se come.
  {
    const fm = crudos.find((n) => n.role === "fields");
    const pares = fm?.body.shape === "fields" ? fm.body.pairs : [];
    const valor = (label) => pares.find((p) => p.label === label)?.value;
    const casos = [
      ["archivado", "no", "`no` es un TEXTO, no el booleano `false` — es YAML 1.1 lo que lo convierte"],
      ["vigencia", "2026-08-16", "una fecha es un TEXTO, no un `Date` auto-convertido"],
      ["version", "3", "un número conserva la forma que el autor escribió"],
    ];
    for (const [label, esperado, porqué] of casos) {
      if (valor(label) === esperado) continue;
      fallar(
        "I13 · el frontmatter se lee en YAML 1.2 core",
        `\`${label}\` salió ${JSON.stringify(valor(label))} y tenía que salir ${JSON.stringify(esperado)}`,
        `${porqué}. \`Pair.value\` es un \`string\`: cualquier conversión que la librería haga por su cuenta llega al índice como un dato que el documento no dice`,
      );
    }
  }

  // ── I14 · UN CONTENEDOR DECLARA SU ID Y HEREDA SU RUTA ────────────────────
  // Es la fase 1 del paso 3 vista desde el productor. `Hint` no sabía decir «declaro mi
  // id y heredo mi ruta» y un `<ul>` necesita las dos cosas: declarar un id, para que
  // sus ítems cuelguen de él, y quedar bajo su `##`. Las dos mitades se rompen POR
  // SEPARADO, así que son dos chequeos.
  {
    const contenedores = crudos.filter((n) => n.body.shape === "container");
    if (contenedores.length === 0) {
      fallar(
        "I14 · el corpus tiene contenedores",
        "ninguna unidad salió con forma `container`",
        "sin un contenedor en el corpus, las dos mitades de abajo son vacuamente ciertas y las filas que las acreditan pasan en verde",
      );
    }
    const sueltos = contenedores.filter((n) => n.hint?.linkage !== "parent");
    if (sueltos.length > 0) {
      fallar(
        "I14 · un contenedor declara su id",
        `${sueltos.length} contenedores con pista ${JSON.stringify(sueltos.map((n) => n.hint))}`,
        "solo `{linkage:'parent'}` registra el nodo en `byAdapterId`, que es por donde los ítems lo encuentran. Con cualquier otra pista la lista no se despega de su sección pero SE PIERDE la jerarquía lista→ítem: los ítems quedan hermanos de la lista",
      );
    }
    const raíces = contenedores.filter(
      (n) => n.hint?.linkage === "none" || n.hint?.linkage === "level",
    );
    if (raíces.length > 0) {
      fallar(
        "I14 · un contenedor no se declara raíz ni abre nivel",
        `${raíces.length} contenedores con pista ${JSON.stringify(raíces.map((n) => n.hint))}`,
        "es la mitad que el paso 3 midió y descartó: con la lista en la raíz, todo lo que la sigue hereda la ruta vacía y el bloque de código, la imagen y la tabla posteriores pierden su sección. Y con la lista en la escala de niveles —el rodeo del prototipo— el emisor solo puede cerrarla cuando llega otro título",
      );
    }
    // El padre de una SUBLISTA es el ítem que la contiene y no la lista de arriba: la
    // jerarquía real de markdown es lista → ítem → sublista. Por eso lo que se exige es
    // que el padre nombrado lo haya DECLARADO alguien, no que sea un contenedor.
    const declarados = new Set(
      crudos.filter((n) => n.hint?.linkage === "parent").map((n) => n.hint.id),
    );
    const items = crudos.filter((n) => n.hint?.linkage === "parent" && n.hint.parent !== null);
    const huérfanos = items.filter((n) => !declarados.has(n.hint.parent));
    if (items.length === 0 || huérfanos.length > 0) {
      fallar(
        "I14 · todo ítem nombra a su contenedor",
        `${items.length} nodos nombran un padre, ${huérfanos.length} nombran uno que nadie declaró`,
        "«el contenedor sabe terminar porque el primero que no lo nombra ya está afuera» solo es cierto si los que están adentro SÍ lo nombran. Un ítem sin padre cuelga de la sección, al lado de su lista en vez de adentro",
      );
    }
  }

  // ── I15 · EL PISO DECIDE POR CONTENIDO, NUNCA POR EL NOMBRE ───────────────
  // Es el mismo principio con el que este proyecto identifica un documento —por
  // contenido, nunca por nombre— y acá vale por la misma razón: la extensión MIENTE EN
  // LAS DOS DIRECCIONES. Un `.dat` puede ser texto puro y un `.txt` puede ser basura
  // binaria. Por eso el corpus lleva un `.conf` y NO lleva un `.txt`: con un `.txt`
  // adentro, un piso que decidiera por extensión pasaría en verde.
  {
    // RED: si los dos archivos dejaran de ser separables, TODO lo de abajo es
    // vacuamente cierto y las filas que lo acreditan pasan en verde.
    if (!(P_BINARIO < P_TEXTO)) {
      fallar(
        "I15 · el corpus separa texto de binario",
        `el .conf mide ${P_TEXTO} y el .png mide ${P_BINARIO}`,
        "sin dos archivos que CUALQUIER umbral razonable separe, no hay nada que un umbral pueda decidir: los tres invariantes de abajo se cumplirían con un detector que responde siempre lo mismo",
      );
    }
    // RED: si un adaptador dedicado reclamara el `.conf`, el piso nunca contestaría y
    // el caso no probaría nada.
    const sondaDe = (b, nombre) =>
      probeOf(coldProbeOf(b, nombre), { kind: "channel", channel: "frontend" }, fuenteDe(b));
    const reclamado = await markdownAdapter.evidence(sondaDe(conf, "servidor.conf"));
    if (reclamado !== Evidence.None) {
      fallar(
        "I15 · ningún adaptador dedicado reclama el `.conf`",
        `el \`.md\` respondió ${reclamado}`,
        "el archivo de texto del corpus existe para que el piso conteste DE VERDAD. Si un dedicado lo gana, la rama del piso no se recorre y las filas que la acreditan son verdes por no haberla tocado",
      );
    }

    // LO QUE NO ES UTF-8 VÁLIDO NO PUEDE MEDIR COMO TEXTO. Es la mitad `U+FFFD` de
    // `UNPRINTABLE`, y va con una ventana propia y no con el `.png` a propósito: sobre el
    // corpus la mitad se puede quitar y el binario BAJA de 1.00 igual —medido: 0.44 con
    // la regla, 0.81 sin ella— así que un caso apoyado en el `.png` pasaría en verde con
    // el detector roto. Cuatro bytes que ningún decodificador puede leer son la forma
    // mínima e inequívoca: sin la regla miden 1.00, o sea «texto puro».
    const basura = printableProportionOf(new Uint8Array([255, 255, 255, 255]));
    const limpio = printableProportionOf(new TextEncoder().encode("hola\nmundo\n"));
    if (basura !== 0 || limpio !== 1) {
      fallar(
        "I15 · lo que no es UTF-8 válido no mide como texto",
        `cuatro bytes ilegibles midieron ${basura} (tenían que medir 0) y un ASCII limpio midió ${limpio} (tenía que medir 1)`,
        "`U+FFFD` es lo que `TextDecoder` pone donde los bytes no eran UTF-8, o sea la huella EXACTA de un binario leído como texto — y su categoría Unicode es `So`, así que `\\p{C}` NO lo atrapa. Sin esa mitad, un archivo de bytes arbitrarios mide 1.00 y el piso lo indexa entero. La segunda mitad es el par: un detector que devolviera 0 siempre también cumpliría la primera",
      );
    }

    const piso = textFloorAdapter(P_TEXTO);
    // EL NOMBRE NO MUEVE LA RESPUESTA — los mismos bytes con tres nombres. Es la mitad
    // que se rompe con una sola línea (`probe.extension === "txt"`) y que ningún otro
    // chequeo del paquete puede ver.
    for (const nombre of ["servidor.conf", "servidor.dat", "servidor", null]) {
      const e = await piso.evidence(sondaDe(conf, nombre));
      if (e === Evidence.Floor) continue;
      fallar(
        "I15 · el piso reclama por contenido, no por extensión",
        `con el nombre ${JSON.stringify(nombre)} respondió ${e} y tenía que responder ${Evidence.Floor}`,
        "el caso que el piso existe para atrapar no es el `.txt` —que nadie escribe en una empresa— sino el `.conf`, el `.ini` y el `.log` sin extensión conocida. Un piso que mire la extensión es un adaptador de `.txt` disfrazado, y deja afuera exactamente los archivos por los que existe",
      );
    }
    // Y AL REVÉS: un binario con extensión de texto sigue siendo binario.
    const disfrazado = await piso.evidence(sondaDe(png, "sello.conf"));
    if (disfrazado !== Evidence.None) {
      fallar(
        "I15 · un binario con nombre de texto sigue sin ser texto",
        `respondió ${disfrazado} y tenía que responder ${Evidence.None}`,
        "es la otra dirección de la mentira de la extensión, y la cara cara: aceptar por el nombre indexa basura binaria, que el plan declara COSTO IRREVERSIBLE («erosiona la confianza en la memoria, que es el producto entero», §{Qué se acepta})",
      );
    }
    // `Floor` EXACTO y ni un peldaño más: subirlo le ganaría archivos a adaptadores
    // dedicados que sí saben leerlos.
    const sobreElMd = await piso.evidence(sondaDe(bytes, "manual.md"));
    if (sobreElMd !== Evidence.Floor) {
      fallar(
        "I15 · el piso nunca declara más que `Floor`",
        `sobre el \`.md\` respondió ${sobreElMd}`,
        "`Floor` es el escalón que la escala le RESERVA (§{Evidencia}). Con un peldaño más el piso entra al `pool` de arriba y le gana el archivo a quien sí sabe leerlo — y el `.md` se indexaría como texto plano",
      );
    }
  }

  // ── I16 · LAS TRES RAMAS, Y EL UMBRAL ES QUIEN DECIDE ─────────────────────
  // «Nunca se pierde un archivo» significa que los BYTES se guardan siempre, no que
  // siempre salga un fragmento. El árbol es de tres ramas y no de dos.
  {
    const sondaDe = (b, nombre) =>
      probeOf(coldProbeOf(b, nombre), { kind: "channel", channel: "frontend" }, fuenteDe(b));
    const piso = opaqueOf(textFloorAdapter(P_TEXTO));
    const md = opaqueOf(markdownAdapter);

    // A · es texto por contenido → el piso lo reclama y la degradación se DECLARA.
    const a = await select(registryOf([md, piso]), sondaDe(conf, "servidor.conf"));
    if (a?.adapter.id !== TEXT_FLOOR_ID || a.achievedLevel !== "plain_text") {
      fallar(
        "I16 · A · un archivo de texto que nadie reclama entra por el piso",
        `ganó ${JSON.stringify(a?.adapter.id ?? null)} con nivel ${JSON.stringify(a?.achievedLevel ?? null)}`,
        "es la mitad que el plan promete y que hasta este paso NADIE ejercitaba: el `.md` siempre ganaba su archivo, así que la rama del piso estaba escrita en el contrato y nunca había corrido",
      );
    }

    // C · no es texto y no hay dedicado → NADIE reclama. `null` no es un error: es
    // `on_hold`, y los bytes se guardan igual.
    const c = await select(registryOf([md, piso]), sondaDe(png, "sello.png"));
    if (c !== null) {
      fallar(
        "I16 · C · lo que no es texto y nadie sabe leer no se indexa",
        `ganó ${JSON.stringify(c?.adapter.id ?? null)}`,
        "el piso es de TEXTO y no es universal. Indexar basura binaria es el falso positivo que el umbral existe para minimizar, y su costo es IRREVERSIBLE; `on_hold` es el falso negativo, y es recuperable: el día que llegue el adaptador, se reprocesa",
      );
    }

    // B · no es texto y SÍ hay dedicado → gana el dedicado y el piso no participa. No
    // hay ningún adaptador binario hasta el paso 6, así que la rama va con uno
    // SINTÉTICO y eso está dicho, no tapado: lo que se verifica es que la rama sea
    // EXPRESABLE hoy —que el `None` del piso no envenene la selección— para que el paso
    // 6 agregue una entrada al registro en vez de reabrir el selector.
    const imagenSintética = {
      id: asAdapterId("imagen-sintetica"),
      level: "declarative",
      version: "1",
      evidence: (p) =>
        Promise.resolve(p.extension === "png" ? Evidence.Signature : Evidence.None),
      recognize: () => Promise.resolve([]),
    };
    const b = await select(registryOf([md, piso, imagenSintética]), sondaDe(png, "sello.png"));
    if (b?.adapter.id !== "imagen-sintetica" || b.achievedLevel !== "structured") {
      fallar(
        "I16 · B · un binario CON adaptador lo procesa el adaptador",
        `ganó ${JSON.stringify(b?.adapter.id ?? null)} con nivel ${JSON.stringify(b?.achievedLevel ?? null)}`,
        "«binario» y «no soportado» no son lo mismo, y colapsarlos obligaría al paso 6 a reabrir el selector en vez de agregar una entrada al registro. La rama del medio no la recorre nada todavía y por eso se verifica con un sintético declarado: lo que se está midiendo es que el `None` del piso no impida que otro gane",
      );
    }

    // Y EL UMBRAL ES QUIEN DECIDE, no una regla escondida. Con el umbral en la
    // proporción del binario, el binario entra. No fija ningún valor —el parámetro
    // sigue `Pending`— fija que el parámetro GOBIERNA.
    const pisoLaxo = opaqueOf(textFloorAdapter(P_BINARIO));
    const conUmbralBajo = await select(registryOf([md, pisoLaxo]), sondaDe(png, "sello.png"));
    if (conUmbralBajo?.adapter.id !== TEXT_FLOOR_ID) {
      fallar(
        "I16 · la decisión la toma el umbral",
        `con el umbral en ${P_BINARIO} el .png dio ${JSON.stringify(conUmbralBajo?.adapter.id ?? null)}`,
        "`minPrintableProportion` es `Pending<number>` y este guardián NO fija su valor —eso sería el número inventado que el plan declara peor que uno pendiente—: fija que la frontera entre indexar y `on_hold` se MUEVE con el parámetro. Si no se moviera, el gate estaría escrito en otro lado y el pendiente sería decorativo",
      );
    }
  }

  // ── I17 · EL PISO PRODUCE NODOS, Y TODOS SON DEL PISO FÍSICO ──────────────
  // La otra mitad de la rama A: no alcanza con que el piso RECLAME el archivo, tiene que
  // producir algo recuperable. Y todo lo que produce lo resuelve el piso físico, porque
  // `detect` se abstiene siempre.
  {
    const corridaPiso = contextoDe();
    const delPiso = await opaqueOf(textFloorAdapter(P_TEXTO)).recognize(
      fuenteDe(conf),
      corridaPiso.ctx,
    );

    // El corte es la LÍNEA EN BLANCO, y el salto de línea de adentro SE CONSERVA. La
    // cadena va exacta y entera: pin de las dos mitades a la vez, y las dos se rompen
    // por separado —partir por línea da tres nodos donde hay uno, y reflowear con
    // espacios borra los saltos—. Es más corta que un golden y no se puede regenerar
    // con una tecla.
    const anclas = delPiso.map((n) => n.location.anchor);
    const BLOQUES = ["line#0", "line#4", "line#8"];
    if (!igual(anclas, BLOQUES)) {
      fallar(
        "I17 · el piso corta por línea en blanco",
        `las anclas fueron ${JSON.stringify(anclas)} y tenían que ser ${JSON.stringify(BLOQUES)}`,
        "la línea en blanco es la ÚNICA estructura que un archivo de texto tiene. Cortar por línea multiplica los nodos y los fragmentos por cinco; no cortar deja el archivo entero en un solo vector",
      );
    }
    const segundo = delPiso[1]?.body;
    const ESPERADO = "[worker]\nconcurrencia = 4\nreintentos = 3";
    if (segundo?.text !== ESPERADO) {
      fallar(
        "I17 · el salto de línea de adentro de un bloque se conserva",
        `el segundo bloque es ${JSON.stringify(segundo?.text ?? null)} y tenía que ser ${JSON.stringify(ESPERADO)}`,
        "el piso NO sabe si el salto lo puso el autor o el ancho de una terminal, y adivinarlo sería leer un formato que no existe. Reflowear con espacios convierte tres líneas de configuración en una oración y las vuelve irreconocibles en el resultado de una búsqueda",
      );
    }

    const impropios = delPiso.filter(
      (n) =>
        n.attribution !== null ||
        n.level !== "physical" ||
        n.hint !== null ||
        n.confidence !== null ||
        n.role !== "paragraph" ||
        n.body.shape !== "text_span",
    );
    if (delPiso.length === 0 || impropios.length > 0) {
      fallar(
        "I17 · todo nodo del piso lo resolvió el piso físico",
        `${delPiso.length} nodos, ${impropios.length} impropios: ${JSON.stringify(impropios.map((n) => [n.role, n.level, n.attribution]))}`,
        "`detect` se abstiene SIEMPRE, sin cascada: un archivo de texto plano no DECLARA nada. Una cascada acá inventaría títulos a partir de líneas cortas y los estamparía con `attribution`, y la métrica que §{Observabilidad} llama «la importante» diría que un clasificador resolvió lo que nadie miró",
      );
    }

    const otra = contextoDe();
    const segundas = await opaqueOf(textFloorAdapter(P_TEXTO)).recognize(
      fuenteDe(conf),
      otra.ctx,
    );
    if (!igual(segundas, delPiso)) {
      fallar(
        "I17 · el piso es determinístico",
        "dos corridas sobre los mismos bytes dieron salidas distintas",
        "es la misma precondición del caché de reconocimiento que I2 fija para el `.md`, y no la hereda: son dos adaptadores y el caché se indexa por `(hashBytes, adaptador, versión)`",
      );
    }
  }

  // ── I18 · EL CHAT ENTRA POR LA MISMA PUERTA ───────────────────────────────
  // La mitad LOCAL de la afirmación del paso 5. La otra mitad —que el mismo texto por
  // los dos canales tenga la misma huella— vive en `orchestration/scripts/invariants.mjs`
  // (I12) porque necesita el emisor, y el emisor no se ve desde acá.
  //
  // Esta fila fija lo que HACE CIERTA a aquella: que el chat produzca `text_span` con el
  // texto y las marcas del párrafo, sin envolverlo en nada. La huella se calcula sobre el
  // CUERPO, así que cualquier forma distinta —`verbatim`, un `container` de más— rompe la
  // igualdad entre canales, y rompiéndola el formato se filtra adentro de la identidad
  // del contenido: la clave del caché, el dedupe de blobs y la reconciliación del paso 11.
  {
    // EL MENSAJE ES CORPUS VERSIONADO, igual que el `.md` y el `.conf`. Un mensaje no es
    // un archivo, y esa es exactamente la razón por la que la fixture tiene que estar en
    // disco: si viviera en este script, cambiar la entrada y cambiar la expectativa serían
    // la misma edición y el golden no compararía contra nada externo. Lleva marcas —una
    // negrita y un enlace— porque `marks` no se renderiza en `Fragment.text`, así que una
    // mutación sobre ellas pasaría en verde contra cualquier golden que no traiga el
    // cuerpo entero. Es la misma lección que el encabezado de este archivo ya cobró.
    const mensaje = JSON.parse(readFileSync(join(RAIZ, "corpus", "mensaje.json"), "utf8"));
    const AUTOR = mensaje.author;
    const párrafos = mensaje.paragraphs;
    const corridaChat = contextoDe();
    const delChat = await recognizeMessage(chatAdapter, mensaje, corridaChat.ctx);

    // El GOLDEN del chat. Se regenera con `ADAPTERS_REGEN=1`, igual que el del `.md`, y
    // ningún script del `package.json` lo pasa.
    {
      const goldenPath = join(RAIZ, "corpus", "mensaje.golden.json");
      const actual = JSON.stringify(
        {
          nodos: delChat.map((n) => ({
            anchor: n.location.anchor,
            coordinate: n.location.coordinate,
            adapter: n.location.adapter,
            role: n.role,
            level: n.level,
            attribution: n.attribution,
            confidence: n.confidence,
            hint: n.hint,
            delegation: n.delegation,
            ownAuthorship: n.ownAuthorship,
            body: n.body,
          })),
          avisos: corridaChat.notices,
        },
        null,
        2,
      );
      if (process.env.ADAPTERS_REGEN === "1") {
        writeFileSync(goldenPath, `${actual}\n`, "utf8");
        console.log("golden del chat REGENERADO — revisá el diff antes de commitear");
      } else {
        const esperado = readFileSync(goldenPath, "utf8").trimEnd();
        if (actual !== esperado) {
          const a = actual.split("\n");
          const b = esperado.split("\n");
          const i = a.findIndex((l, k) => l !== b[k]);
          fallar(
            "I18 · golden mensaje→nodos",
            `primera diferencia en la línea ${i + 1}\n        esperado: ${b[i]}\n        obtenido: ${a[i]}`,
            "las otras tres mitades de I18 verifican PROPIEDADES —la forma, la abstención, la autoría— y una salida puede cumplir las tres y ser la equivocada. El golden es lo único que compara contra algo externo al código: sin él, una mutación que moviera una marca o un ancla pasaría en verde",
          );
        }
      }
    }

    const formas = [...new Set(delChat.map((n) => n.body.shape))];
    if (delChat.length !== párrafos.length || !igual(formas, ["text_span"])) {
      fallar(
        "I18 · el chat produce un `text_span` por párrafo y nada más",
        `salieron ${delChat.length} nodos con formas ${JSON.stringify(formas)}`,
        "es lo que vuelve cierta la igualdad de huellas entre canales (I12 de `orchestration`): la huella se calcula sobre el cuerpo, así que envolver el mensaje en otra forma haría que el mismo texto por dos canales fuera dos contenidos distintos para el caché y para la reconciliación",
      );
    }

    // El piso responde, igual que en el `.md` sin estructura: el chat SE ABSTIENE y el
    // rol sale de `ROLE_BY_SHAPE.text_span`. Es la línea que el plan anota al lado del
    // adaptador — «se abstiene: el piso responde 'parrafo'» (§{Chat}).
    if (!delChat.every((n) => n.role === "paragraph" && n.level === "physical" && n.attribution === null)) {
      fallar(
        "I18 · el chat se abstiene y responde el piso físico",
        JSON.stringify(delChat.map((n) => ({ role: n.role, level: n.level, attribution: n.attribution }))),
        "una cascada acá inventaría títulos a partir de mensajes cortos, y los estamparía como si la conversación los hubiera declarado. `attribution: null` es lo que la métrica de §{Observabilidad} lee como «lo resolvió el piso», que es la verdad",
      );
    }

    // Y la autoría viaja PEGADA A CADA NODO, cruda. Es la única diferencia real con el
    // camino de archivo, y la razón de que `AuthoredUnit` exista.
    if (!delChat.every((n) => igual(n.ownAuthorship, AUTOR))) {
      fallar(
        "I18 · cada nodo del mensaje trae su autoría",
        JSON.stringify(delChat.map((n) => n.ownAuthorship)),
        "un mensaje no tiene documento del que heredar la autoría. Si se perdiera acá —que es lo que pasaba hasta el paso 5, en silencio, porque `opaqueOf` mapeaba `Unit → RawNode` sin este campo— la orquestación no tendría de dónde sacarla y atribuiría al agente de MCP lo que dijo una persona",
      );
    }
  }

  // ── I19 · UNA IMAGEN ES UN DOCUMENTO COMO CUALQUIER OTRO ──────────────────
  // La mitad LOCAL de la afirmación del paso 6. La otra —que el subárbol se injerte
  // heredando las migas del contenedor— vive en `orchestration`, porque necesita el
  // emisor y el emisor no se ve desde acá.
  {
    // El modelo, sintético y fijo. No es un atajo: es lo mismo que hizo el paso 2 al
    // construir el emisor entero con nodos escritos a mano ANTES de que existiera un
    // adaptador. Lo que se prueba acá es el mapeo región→unidad y la cascada, no la
    // calidad de un OCR.
    const REGIONES = [
      { box: { frame: "img", x: 0, y: 0, width: 1000, height: 120 }, text: "Informe trimestral", confidence: 0.94 },
      { box: { frame: "img", x: 0, y: 140, width: 1000, height: 300 }, text: "Las ventas subieron.", confidence: 0.88 },
      { box: { frame: "img", x: 0, y: 460, width: 480, height: 400 }, text: null, confidence: 0.71 },
    ];
    const conModelo = (regiones) => {
      const c = contextoDe();
      return { ...c, ctx: { ...c.ctx, perceive: () => Promise.resolve(regiones) } };
    };

    // (a) DECLARA LO QUE NECESITA, y `opaqueOf` lo propaga. Es lo único que este
    // adaptador tiene y los otros tres no, y de eso depende que el núcleo pueda
    // decidir por él.
    if (!igual(imageAdapter.requires, ["perceive"]) || !igual(opaqueOf(imageAdapter).requires, ["perceive"])) {
      fallar(
        "I19 · el adaptador imagen declara su capacidad y el registro la conserva",
        `adaptador=${JSON.stringify(imageAdapter.requires)} opaco=${JSON.stringify(opaqueOf(imageAdapter).requires)}`,
        "sin la declaración, el núcleo no puede distinguir «no lo intenté» de «lo intenté y tocó fondo» — y esas dos cosas son un `asset` sin hijos las dos, con destinos opuestos. Si `opaqueOf` la borrara, la declaración existiría y no llegaría a quien decide",
      );
    }

    // (b) LAS TRES ALTURAS DE LA ESCALA, y el orden es «contenido sobre extensión».
    // La fila del medio es la decisión del paso 6: un delegado sin bytes propios gana
    // por el mime que declaró el padre, y `Structure` es el peldaño que significa «el
    // formato lo declaró» sin estirar `Signature`, que es «firma EN EL CONTENIDO».
    const sondaDe = (magic, mime, ext) => ({ magicBytes: new Uint8Array(magic), declaredMime: mime, extension: ext });
    const PNG = [0x89, 0x50, 0x4e, 0x47];
    const casos = [
      ["firma en el contenido", sondaDe(PNG, null, null), Evidence.Signature],
      ["mime declarado por el padre", sondaDe([1, 2, 3], "image/png", null), Evidence.Structure],
      ["solo la extensión", sondaDe([1, 2, 3], null, "jpg"), Evidence.Extension],
      ["nada", sondaDe([1, 2, 3], "text/plain", "txt"), Evidence.None],
    ];
    for (const [qué, sonda, esperado] of casos) {
      const dio = await imageAdapter.evidence(sonda);
      if (dio !== esperado) {
        fallar(
          `I19 · evidencia: ${qué}`,
          `dio ${dio}, se esperaba ${esperado}`,
          "«contenido sobre extensión» (§{Tramo 2 › Decisiones}), y el peldaño del medio es lo que vuelve seleccionable a un delegado que NO TIENE BYTES PROPIOS: un rectángulo de una página renderizada no tiene firma que oler, y fabricarle una devolvería los del original — el bug H9 exacto",
        );
      }
    }

    // (c) LA FUENTE DE UN DELEGADO. Un rango SÍ tiene bytes; un rectángulo NO, y
    // devolver vacío es lo correcto y no una carencia: renderizarlo sería
    // materializar, y si cada nivel generara bytes el hash cambiaría siempre y el
    // punto fijo no dispararía jamás (§{Dónde frena}).
    const origen = fuenteDe(new Uint8Array([10, 11, 12, 13, 14, 15]), "application/zip");
    const porRango = sourceOfAsset(origen, {
      shape: "asset",
      ref: { object: origen.ref.object, window: { scope: "range", start: 2, end: 5 } },
      mime: "image/png",
    });
    const porRegion = sourceOfAsset(origen, {
      shape: "asset",
      ref: { object: origen.ref.object, window: { scope: "region", box: { frame: "p3", x: 0, y: 0, width: 1000, height: 500 } } },
      mime: "image/png",
    });
    if (!igual([...(await porRango.bytes())], [12, 13, 14]) || porRango.size !== 3) {
      fallar(
        "I19 · un delegado por rango lee los bytes de su ventana",
        `bytes=${JSON.stringify([...(await porRango.bytes())])} size=${porRango.size}`,
        "`[start, end)` MEDIA ABIERTA, la misma convención que `Source.range` fija con número. Leerla cerrada pierde un byte de cada tramo, sin excepción y sin aviso: el delegado entra al pipeline con agujeros",
      );
    }
    if ((await porRegion.bytes()).length !== 0 || porRegion.size !== 0) {
      fallar(
        "I19 · un delegado por región NO tiene bytes propios",
        `bytes=${(await porRegion.bytes()).length} size=${porRegion.size}`,
        "devolver los del original es el bug H9: los primeros 4 KB de la página 3 serían los del PDF entero, `esImagen` daría `None` y ganaría otra vez el adaptador de PDF. El ejemplo canónico del plan —contrato.pdf → pg3 → adaptador `imagen`— no funcionaría",
      );
    }
    if (porRango.ref.object !== origen.ref.object || porRegion.ref.object !== origen.ref.object) {
      fallar(
        "I19 · la clave del delegado es la del objeto que lo contiene",
        "un delegado cambió de objeto",
        "es lo que hace que la guarda de ciclo y el caché vean la misma materia, y lo que permite que el punto fijo compare (objeto, ventana) contra lo que entró",
      );
    }

    // (d) REGIÓN → UNIDAD. Texto va a `text_span`; sin texto va a `asset`. Y ninguna
    // de las dos decide un rol: eso es de la cascada.
    const c = conModelo(REGIONES);
    const unidades = await imageAdapter.decompose(fuenteDe(png, "image/png"), c.ctx);
    const formas = unidades.map((u) => u.body.shape);
    if (!igual(formas, ["text_span", "text_span", "asset"])) {
      fallar(
        "I19 · las regiones se mapean a las formas de la cintura",
        JSON.stringify(formas),
        "una imagen entra por la misma puerta que un `.docx`: las mismas seis formas, el mismo `recognizerOf`, el mismo emisor. Si acá hiciera falta una forma nueva, la cintura tendría un agujero con nombre de imagen",
      );
    }
    if (!unidades.every((u) => typeof u.signals.confidence === "number" && u.location.coordinate.space === "visual")) {
      fallar(
        "I19 · cada unidad trae confianza y su caja",
        JSON.stringify(unidades.map((u) => [u.signals.confidence, u.location.coordinate.space])),
        "`RawNode.confidence` es `null` en el 100% del corpus hasta este paso, y es la promesa con la que §{La escalera} se distingue: «la diferencia entre un pipeline que adivina y uno que declara cuánto está adivinando». La coordenada `visual` es lo que permite citar «acá, en esta parte de la imagen»",
      );
    }

    // (e) LA CASCADA: la región más alta, si es única a esa altura, es el título. Es
    // `porProminencia` un escalón más abajo en la escalera — geometría en vez de
    // estilos— y por ser perceptual viaja `inferred` con su confianza.
    const clasificar = imageAdapter.detect(unidades);
    const roles = unidades.map((u) => clasificar(u)?.role ?? null);
    if (!igual(roles, ["heading", null, null])) {
      fallar(
        "I19 · la región más alta y única es el título",
        JSON.stringify(roles),
        "es lo único que este adaptador infiere, y lo infiere de un HECHO de la imagen —la posición—, no de una adivinanza. Las otras dos se abstienen a propósito: donde nadie resuelve responde el piso físico, y eso es lo que la métrica de §{Observabilidad} lee como «acá no hubo clasificador»",
      );
    }

    // (f) EL CASO DEGENERADO — la foto de un gato. Una sola región pictórica que
    // cubre el marco entero sale como un `asset` con `window: 'whole'`, o sea
    // EXACTAMENTE lo que entró. El punto fijo lo detecta comparando refs, sin que el
    // adaptador tenga una rama que diga «esto es una foto y no se descompone»: se
    // descubre haciéndolo, no declarándolo (§{Dónde frena}).
    const gato = conModelo([
      { box: { frame: "img", x: 0, y: 0, width: 1000, height: 1000 }, text: null, confidence: 0.4 },
    ]);
    const fondo = await imageAdapter.decompose(fuenteDe(png, "image/png"), gato.ctx);
    if (fondo.length !== 1 || fondo[0].body.shape !== "asset" || fondo[0].body.ref.window.scope !== "whole") {
      fallar(
        "I19 · una imagen que no se descompone se devuelve a sí misma",
        JSON.stringify(fondo.map((u) => [u.body.shape, u.body.ref?.window?.scope])),
        "es la fila «foto de un gato» de §{La delegación es emergente}, y es lo que hace que el punto fijo dispare sin una regla sobre imágenes. Si saliera con `scope:'region'` cubriendo todo, `windowCovers` no lo reconocería como lo mismo que entró y la recursión seguiría sobre recortes idénticos hasta agotarse",
      );
    }

    // (g) SIN LA CAPACIDAD, TIRA. Es inalcanzable si el núcleo cumple, y por eso
    // tiene que ser ruidoso: devolver `[]` sería indistinguible de una imagen vacía y
    // el asset se daría por TERMINADO — el documento diría que no había nada que leer.
    const sinModelo = contextoDe();
    const tiró = await imageAdapter
      .decompose(fuenteDe(png, "image/png"), sinModelo.ctx)
      .then(() => null, (e) => String(e));
    if (tiró === null || !/perceive/.test(tiró)) {
      fallar(
        "I19 · invocado sin la capacidad, falla ruidoso",
        tiró === null ? "no tiró" : tiró,
        "llegar acá significa que alguien invocó sin mirar `requires`, o sea que el contrato que separa «no lo intenté» de «tocó fondo» está roto. Un fallo ruidoso es recuperable; el silencio de un `[]` no: el asset se da por terminado y nadie vuelve a mirarlo",
      );
    }
  }

  // ── I20 · LA SONDA VE ADENTRO DE UN ZIP, Y SIN DESCOMPRIMIR ───────────────
  // Es la mitad del paso 7 que NO necesita ninguna librería, y la que decide el tramo
  // 2: `.docx`, `.xlsx`, `.pptx` y `.odt` comparten bytes mágicos —los cuatro empiezan
  // con `PK\x03\x04`— así que la extensión y la firma NO alcanzan para elegir quién
  // lee el archivo. Lo que los separa es QUÉ ENTRADAS tienen, y eso se lee caminando el
  // directorio central: bytes, sin inflar nada.
  //
  // POR QUÉ IMPORTA QUE ESTO SEA OBSERVABLE. Hasta el paso 7 `zipEntries` devolvía la
  // lista vacía, y un evidenciador que la consultara habría recibido «este zip no tiene
  // nada» en vez de «todavía no sé leer zips». Las dos cosas se ven igual desde afuera
  // y llevan a decisiones opuestas: la primera hace que el adaptador se abstenga con
  // razón, la segunda que se abstenga por un bug.
  {
    const sondaZip = probeOf(
      coldProbeOf(docx, "manual.docx"),
      { kind: "channel", channel: "frontend" },
      fuenteDe(docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    );
    const entradas = await sondaZip.zipEntries();
    const delator = "word/document.xml";
    if (!entradas.includes(delator)) {
      fallar(
        "I20 · la sonda no ve adentro del zip",
        `entradas=${JSON.stringify(entradas)}`,
        `\`${delator}\` es lo que distingue un \`.docx\` de un \`.xlsx\` o un \`.pptx\`, que comparten sus bytes mágicos. Sin verlo, el tramo 2 no puede elegir quién lee el archivo y los cuatro adaptadores de zip quedan indistinguibles`,
      );
    }
    // La MEMOIZACIÓN es la mitad de la frase del plan que sí se cumple hoy —«una sola
    // apertura»— y se verifica por identidad de promesa, que es lo que PROVISIONAL(#432)
    // de `ir` exige: memoizar el VALOR resuelto haría que los cuatro evidenciadores de
    // zip, que corren con `Promise.all`, abrieran el archivo cuatro veces.
    if (sondaZip.zipEntries() !== sondaZip.zipEntries()) {
      fallar(
        "I20 · `zipEntries` no memoiza la promesa en vuelo",
        "dos llamadas devuelven promesas distintas",
        "`select` dispara los doce evidenciadores con `Promise.all`: sin memoizar la promesa EN VUELO —no el valor resuelto— los cuatro adaptadores de zip abren el archivo cuatro veces, y la afirmación de costo del plan pasa a ser falsa",
      );
    }
    // Y NO LANZA sobre basura, que es lo que sostiene «cada adaptador se abstiene por su
    // cuenta» en vez de que un archivo corrupto decida por los cuatro.
    const basura = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02]);
    const sondaRota = probeOf(
      coldProbeOf(basura, "roto.docx"),
      { kind: "channel", channel: "frontend" },
      fuenteDe(basura),
    );
    const nada = await sondaRota.zipEntries().catch(() => "TIRÓ");
    if (nada === "TIRÓ" || nada.length !== 0) {
      fallar(
        "I20 · un zip roto no devuelve la lista vacía en silencio",
        `devolvió ${JSON.stringify(nada)}`,
        "«archivos rotos son la norma, no la excepción» (§{Los decodificadores}): si esto lanza, el evidenciador que lo consultó cuenta como `None` y un archivo corrupto decide por los cuatro adaptadores de zip en vez de que cada uno se abstenga",
      );
    }
  }

  // ── I21 · LA CASCADA Y LA DELEGACIÓN SE COMPONEN ─────────────────────────
  // ES EL PASO 7, Y LO QUE PRUEBA NO ES EL FORMATO. La cascada se construyó en el paso
  // 3 y la delegación en el paso 6, por separado; el `.docx` es el primer formato donde
  // se encuentran — un documento que entra por la cascada y lleva adentro una pieza que
  // delega. Acá se verifica la mitad de `adapters`: que los DOS eslabones resuelvan y
  // que la pieza salga delegable. Que el subárbol se injerte es de `orchestration`,
  // que es el único paquete que compone los dos lados.
  {
    const opacoDocx = opaqueOf(docxAdapter);
    const corridaDocx = contextoDe();
    const nodosDocx = await opacoDocx.recognize(fuenteDe(docx), corridaDocx.ctx);

    // LOS DOS ESLABONES, cada uno con su nodo. Un `.docx` corporativo declara algunos
    // títulos con estilo y escribe otros a mano en negrita, y sin el segundo eslabón la
    // mitad de los títulos de un documento real caen al piso como párrafos.
    const porEslabón = new Map(nodosDocx.map((n) => [n.attribution, n]));
    for (const esperado of ["byDocxStyle", "byProminence"]) {
      if (!porEslabón.has(esperado)) {
        fallar(
          `I21 · el eslabón \`${esperado}\` no resolvió ningún nodo`,
          `atribuciones: ${JSON.stringify([...new Set(nodosDocx.map((n) => n.attribution))])}`,
          "«cascada: estilo → prominencia» (§{Tramo 3 › El registro}) son DOS eslabones porque el formato solo declara la mitad de sus títulos. Si uno de los dos no resuelve nada, el banco no lo está ejerciendo y su primera falla va a ser en producción",
        );
      }
    }
    // Y EN ESE ORDEN. `cascade` reordena por nivel, así que un párrafo con estilo
    // declarado NUNCA debe llegar a la prominencia: si llegara, un documento bien
    // marcado quedaría a merced de un heurístico de tamaño.
    const conEstilo = porEslabón.get("byDocxStyle");
    const sinEstilo = porEslabón.get("byProminence");
    if (conEstilo?.level !== "declarative" || sinEstilo?.level !== "physical") {
      fallar(
        "I21 · los eslabones no están en su escalón",
        `estilo=${conEstilo?.level} prominencia=${sinEstilo?.level}`,
        "el nivel es lo que `cascade` usa para ordenar. Con los dos en el mismo escalón el orden pasa a depender de cómo se escribió el arreglo, y `rank` deja de gobernar la precedencia",
      );
    }

    // LA IMAGEN SALE POR RANGO Y NO MATERIALIZADA, que es lo medido: cuando la entrada
    // del zip está SIN COMPRIMIR sus bytes están literales en el `.docx`, así que el
    // asset se expresa como el rectángulo de un PDF —mismo objeto, ventana más chica—
    // y entra al pipeline sin escribir un byte. Es la razón por la que este paso no
    // necesita almacenamiento.
    const imagen = nodosDocx.find((n) => n.body.shape === "asset");
    if (imagen === undefined || imagen.body.ref.window.scope !== "range") {
      fallar(
        "I21 · la imagen incrustada no sale como un rango del propio documento",
        `asset=${JSON.stringify(imagen?.body.ref ?? null)}`,
        "si saliera con ventana `whole` y objeto propio, este paso dependería del almacenamiento, que no está cableado — y la mitad de los `.docx` reales, que guardan sus medios sin comprimir, pagarían una materialización que no hace falta",
      );
    }

    // EL GOLDEN. Mismo molde que el de `manual.md` y misma variable de entorno: los dos
    // se regeneran en la misma corrida, así que el diff se lee junto.
    const goldenDocx = join(RAIZ, "corpus", "manual.docx.golden.json");
    const actualDocx = JSON.stringify(
      {
        nodos: nodosDocx.map((n) => ({
          anchor: n.location.anchor,
          adapter: n.location.adapter,
          role: n.role,
          level: n.level,
          attribution: n.attribution,
          hint: n.hint,
          body: n.body,
        })),
        avisos: corridaDocx.notices,
      },
      null,
      2,
    );
    if (process.env.ADAPTERS_REGEN === "1") {
      writeFileSync(goldenDocx, `${actualDocx}\n`, "utf8");
      console.log("golden del .docx REGENERADO — revisá el diff antes de commitear");
    } else {
      const esperadoDocx = readFileSync(goldenDocx, "utf8").trimEnd();
      if (actualDocx !== esperadoDocx) {
        const a = actualDocx.split("\n");
        const b = esperadoDocx.split("\n");
        const i = a.findIndex((l, k) => l !== b[k]);
        fallar(
          "I21 · golden bytes→nodos del `.docx`",
          `primera diferencia en la línea ${i + 1}\n        esperado: ${b[i]}\n        obtenido: ${a[i]}`,
          "es el único invariante del `.docx` que compara contra algo EXTERNO al código: los demás verifican que la salida sea coherente consigo misma, y una salida puede ser coherente y ser el árbol equivocado",
        );
      }
    }
  }

  // ── I22 · SIN ALMACENAMIENTO, LA IMAGEN SE ANUNCIA Y EL TEXTO ENTRA ───────
  // La otra mitad del paso 7, y la que decide si el adaptador es honesto. Cuando la
  // entrada del zip está COMPRIMIDA sus bytes no están literales en ningún rango, así
  // que el recorte por referencia no se puede expresar y hay que producirlos — eso es
  // materializar, y este banco NO TIENE ALMACENAMIENTO a propósito.
  //
  // LAS TRES MITADES SE VERIFICAN JUNTAS. Que la imagen no se emita es lo esperable;
  // que el TEXTO ENTRE IGUAL es lo que separa «degradar» de «fallar»; y que haya un
  // AVISO es lo que separa «degradar» de «descartar en silencio». Con las tres, un
  // `.docx` cuyo medio no se pudo materializar sigue siendo un documento indexado al
  // que le falta una figura, y se sabe cuál.
  {
    const corridaZip = contextoDe();
    const nodosZip = await opaqueOf(docxAdapter).recognize(fuenteDe(docxZip), corridaZip.ctx);
    const conAsset = nodosZip.filter((n) => n.body.shape === "asset");
    const textos = nodosZip.filter((n) => n.body.shape === "text_span");
    const códigos = corridaZip.notices.map((n) => n.code);
    if (conAsset.length !== 0) {
      fallar(
        "I22 · se emitió un asset que no se pudo materializar",
        JSON.stringify(conAsset.map((n) => n.body.ref)),
        "un asset cuyos bytes no están ni en el original ni en el almacenamiento apunta a ninguna parte: la delegación no lo va a poder leer, así que sería un nodo que promete una figura que nadie puede traer",
      );
    }
    if (textos.length === 0 || !códigos.includes("docx.media_not_materialised")) {
      fallar(
        "I22 · la degradación no es honesta",
        `texto=${textos.length} avisos=${JSON.stringify(códigos)}`,
        "«guardar es incondicional, indexar no»: sin texto el adaptador falló en vez de degradar, y sin aviso descartó en silencio, que es el modo de falla que §{Diagnóstico} declara inadmisible",
      );
    }
  }

  if (fallas > 0) process.exit(1);

  const roles = [...new Set(crudos.map((n) => n.role))].sort();
  console.log(
    `invariantes ok (I1 golden bytes→nodos · I2 determinismo · I3 pareja obligatoria · ` +
      `I4 cero fugas · I5 piso físico · I6 nada en silencio · I7 caption por dos eslabones · ` +
      `I8 selector · I9 cascada reordenada · I10 range medio abierto · I11 frontmatter hermano · ` +
      `I12 sin roles de página · I13 YAML 1.2 core · I14 contenedores · I15 el piso por contenido · ` +
      `I16 las tres ramas · I17 el piso produce y se abstiene · ` +
      `I18 el chat entra por la misma puerta · I19 una imagen es un documento · ` +
      `I20 la sonda ve adentro del zip sin descomprimir · ` +
      `I21 la cascada y la delegación se componen · ` +
      `I22 sin almacenamiento la imagen se anuncia y el texto entra)\n` +
      `           ${crudos.length} nodos · ${roles.length} de ${ROLES.length} roles alcanzados: ${roles.join(" ")}\n` +
      `           piso: .conf ${P_TEXTO.toFixed(4)} imprimible → indexa · ` +
      `.png ${P_BINARIO.toFixed(4)} → on_hold`,
  );
} finally {
  rmSync(salida, { recursive: true, force: true });
}
