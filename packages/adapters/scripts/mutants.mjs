#!/usr/bin/env node
// Acredita cada garantía del paquete ROMPIÉNDOLA, y falla si alguna deja de romperse.
//
//   node scripts/mutants.mjs           todas las mutaciones
//   node scripts/mutants.mjs S20       una sola, para iterar
//
// MISMO DISEÑO QUE `ir/scripts/mutants.mjs` Y `emission/scripts/mutants.mjs`, con UN
// CAMPO NUEVO: `rompe`. En los dos paquetes anteriores la respuesta era siempre «el
// build», porque casi toda garantía era de tipos o de grafo de módulos y el testigo era
// el compilador. Un adaptador es código que CORRE: una mutación de comportamiento no
// rompe nada, PRODUCE OTRA SALIDA. `rompe` dice cuál — el árbol, los avisos, la
// selección, la certeza, los bytes.
//
// LA NUMERACIÓN VIENE DEL PLAN DEL PASO 3 y se conserva a propósito, aunque salte:
// S1–S16 se repartieron a `emission` en el paso 3a (allá son M36–M52) y S39–S40 a
// `orchestration`. Las filas S45 en adelante son de este paso y no estaban en el plan;
// cada una dice por qué existe.
//
// EN SERIE Y EN EL ÁRBOL, a propósito, igual que los otros dos: la cadena de guardianes
// tarda pocos segundos, el árbol se restaura siempre —incluso si algo explota— y se
// comprueba verde al principio Y al final.

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ruta = (r) => resolve(RAIZ, r);

// Las anclas de las filas `D…`, que mutan ESTE MISMO ARCHIVO, se arman EN DOS PEDAZOS a
// propósito: escritas enteras, cada texto aparecería DOS VECES en `scripts/mutants.mjs`
// —la línea real y la fila que la nombra— y `soloUno()` se pondría rojo con razón. Es el
// precio de que el arnés se mute a sí mismo, y va dicho acá y no descubierto después.
const AL_DIARIO = `apuntar(archivo, ` + `antes);`;
const AL_ARCHIVO = `writeFileSync(ruta(archivo), antes.replace(buscar, ` + `reemplazar), "utf8");`;
const LADO_SEGURO = `return e.code !== ` + `"ESRCH";`;

/**
 * Cada fila es una garantía y la forma exacta de romperla.
 *
 * - `cambios`: pares [buscar, reemplazar]. `buscar` tiene que aparecer EXACTAMENTE UNA
 *   VEZ en EXACTAMENTE UN archivo de `ARCHIVOS`. Cero o dos es un ERROR, no un salteo:
 *   un mutante obsoleto que se saltea en silencio es una garantía que dejó de
 *   verificarse.
 * - `espera`: un regex sobre la salida. Que falle no alcanza — tiene que fallar POR LA
 *   RAZÓN correcta. Es lo que separa «acredité el invariante» de «rompí algo».
 * - `rompe`: qué SALIDA se mueve. Es el campo que este paquete estrena.
 * - `control`: no rompe nada y tiene que quedar VERDE. Sin controles, una suite donde
 *   todo falla es indistinguible de una donde el compilador está roto.
 * - `archivo`: opcional, y hoy lo llevan SOLO las filas `D…`, que mutan este mismo
 *   archivo. `scripts/mutants.mjs` NO PUEDE entrar en `ARCHIVOS`: contiene literalmente el
 *   `buscar` de todas las filas, así que `ubicar()` vería DOS archivos para cada una y la
 *   suite entera se pondría roja. Con el destino DICHO, la unicidad la sostiene
 *   `soloUno()` adentro del archivo, que es la mitad que importa cuando no hay a dónde
 *   equivocarse. Mutar el arnés en caliente es inofensivo —node ya lo tiene en memoria—:
 *   lo que cambia es lo que el guardián LEE DE DISCO, que es donde vive la garantía.
 */
const MUTANTES = [
  // ── Tramo 3 · el adaptador `.md` ───────────────────────────────────────────
  {
    id: "S17",
    garantía: "el `.md` reclama sus bytes con evidencia de nivel `Extension`",
    rompe: "la selección: el manual entra por el piso de texto y pierde toda su estructura",
    cambios: [[
      `        ? Evidence.Extension\n        : Evidence.None,`,
      `        ? Evidence.None\n        : Evidence.None,`,
    ]],
    espera: /I8 · el piso no compite con un adaptador dedicado/,
    nota:
      "`Extension` y no `Signature`: el criterio operativo de `ir` define `Signature` como «una " +
      "secuencia de bytes que NO PUEDE aparecer en otro formato», y `# ` puede aparecer en cualquier " +
      "texto. Es la primera vez que ese criterio se aplica a un adaptador real, y declarar de más le " +
      "gana archivos a adaptadores que sí tienen firma",
  },
  {
    id: "S18",
    garantía: "el nivel ATX decide `heading` vs `subheading`",
    rompe: "el árbol: todo título es de primer nivel y el documento se aplana",
    cambios: [[
      `            role: s.depth === ONE ? "heading" : "subheading",`,
      `            role: "heading",`,
    ]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "los dos roles son `lead`, así que la cohesión no cambia y NINGÚN invariante de agrupación se " +
      "entera: lo ve solo el golden. Es el ejemplo más claro de por qué el golden tiene que llevar el " +
      "nodo entero y no la salida renderizada",
  },
  {
    id: "S19",
    garantía: "la pista de un título lleva SU nivel",
    rompe: "el árbol: las secciones dejan de anidarse",
    cambios: [[
      `            hint: { linkage: "level", level: s.depth },`,
      `            hint: { linkage: "level", level: ONE },`,
    ]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "el emisor normaliza los saltos —un `###` después de un `#` cuelga del `#`, sin `##` fantasma— " +
      "pero no puede inventar un nivel que el adaptador no le dio: la pista es el único dato " +
      "estructural que produce este tramo",
  },
  {
    id: "S20",
    garantía: "el lenguaje de una valla se normaliza a minúsculas",
    rompe: "el árbol: `SQL` y `sql` son dos bloques distintos para el mismo código",
    cambios: [[
      `            : { shape: "verbatim", text: body.join("\\n"), language: language.toLowerCase() },`,
      `            : { shape: "verbatim", text: body.join("\\n"), language },`,
    ]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "los lenguajes son ilimitados por naturaleza y por eso `language` es un `string` abierto, pero " +
      "`js` vs `javascript` vs `JavaScript` es la misma deriva por la que se cerró `role`. R2 permite " +
      "LEERLO para mostrar y filtrar, que es justo donde la deriva se le vuelve visible al usuario. El " +
      "corpus escribe ```SQL en mayúsculas por esta fila y por ninguna otra",
  },
  {
    id: "S21",
    garantía: "C1 — un párrafo NO es una declaración: el clasificador se abstiene",
    rompe: "la atribución y la certeza: el piso físico deja de responder y todo se declara `declarative`",
    cambios: [[
      `        case "paragraph":\n          return null;`,
      `        case "paragraph":\n          return { role: "paragraph", hint: null };`,
    ]],
    espera: /I5 · el piso físico responde/,
    nota:
      "«sin C1, un mapeo por estilo resuelve absolutamente todo y los eslabones siguientes nunca " +
      "corren». Lo que hace difícil de ver esta falla es que el resultado VISIBLE es el mismo rol " +
      "—`paragraph` por los dos caminos— y lo que cambia es el NIVEL: la métrica que el plan llama «la " +
      "importante» pasa a decir que el documento entero lo resolvió un clasificador declarativo",
  },
  {
    id: "S22",
    garantía: "la pareja obligatoria rol⇒forma: un adaptador que la viola no entra",
    rompe: "la compuerta de CI: un `role:'fields'` con cuerpo `grid` llega al índice",
    cambios: [[
      `          return { role: "table", hint: null };`,
      `          return { role: "fields", hint: null };`,
    ]],
    espera: /I3 · la pareja obligatoria rol⇒forma/,
    nota:
      "el plan la lista como «aserción en el registro, ningún test», y eso NO EXISTE: `Adapter` no " +
      "expone qué pares emitirá, así que decidirlo exige EJECUTAR sobre el corpus. Esta fila acredita " +
      "la compuerta de CI que lo reemplaza, que es lo que hay que llamarla",
  },
  {
    id: "S23",
    garantía: "cero fugas de formato en el nodo",
    rompe: "el borde R1: una señal del formato cruza adentro de un campo libre",
    cambios: [[`        anchor: t,`, `        anchor: \`\${t}?depth=\${depth}\`,`]],
    espera: /I4 · cero fugas de formato en el nodo/,
    nota:
      "el TIPO ya impide la fuga por la puerta —`RawNode` no tiene dónde poner las señales— y esta " +
      "fila la mete por la ventana: `location.anchor` es un `string` OPACO y `attribution` también. R1 " +
      "no es una propiedad del tipo del nodo, es una propiedad de lo que el adaptador ESCRIBE adentro",
  },
  {
    id: "S24",
    garantía: "lo que no tiene forma que lo exprese se AVISA, no se borra",
    rompe: "el sumidero: la regla horizontal desaparece sin registro",
    cambios: [[`      notice("md.thematic_break", \`línea \${i + ONE}\`);`, `      void i;`]],
    espera: /I6 · nada se descarta en silencio/,
    nota:
      "«descartar en silencio es el peor modo de falla». El `void i;` mantiene el parámetro en uso: " +
      "borrar la línea a secas deja `i` sin leer en esa rama, el mutante muere con TS6133 y la fila " +
      "quedaría acreditada por `noUnusedParameters` en vez de por el contrato",
  },
  {
    id: "S25",
    garantía: "una lista numerada es `ordered_list` y no `list`",
    rompe: "el árbol: la distinción de la que depende la tesis del producto",
    cambios: [[`      const ordered = /\\d/.test(bullet[TWO] ?? "");`, `      const ordered = false;`]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "es PROVISIONAL(#435) de `ir` visto desde el otro lado: `roleFromBody` mira `ordered` para que " +
      "`ordered_list` sea alcanzable desde el piso, y acá el adaptador lo declara. Si el adaptador " +
      "miente, la función de `ir` no tiene con qué",
  },
  {
    id: "S26",
    garantía: "las listas anidadas anidan",
    rompe: "el árbol: cada ítem abre su propia lista",
    cambios: [[`      closeTo(indent + ONE);`, `      closeTo(indent);`]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "el caso borde de markdown que más se subestima. La indentación es la ÚNICA señal de anidamiento " +
      "y no hay marcador de cierre: por eso la pila existe y por eso su condición de corte es `>=` y " +
      "no `>`",
  },
  {
    id: "S27",
    garantía: "las marcas inline se miden sobre el texto YA NORMALIZADO",
    rompe: "el árbol: los offsets de negrita, código y enlaces apuntan al texto crudo",
    cambios: [[`    const start = text.length;`, `    const start = m.index;`]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "PROVISIONAL(Mark) de `ir`: «si los offsets son sobre el texto crudo, la normalización NFC los " +
      "invalida». Acá se ve sin NFC: la sintaxis desaparece del texto y los offsets del crudo señalan " +
      "otra palabra. Nada lo detecta salvo comparar la salida",
  },
  {
    id: "S28",
    garantía: "el destino de un enlace viaja en la marca",
    rompe: "el árbol: el enlace queda sin `href` y la cita pierde su destino",
    cambios: [[`href: href ?? ""`, `href: (href ?? "").slice(ZERO, ZERO)`]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "`Marca.destino → href` es una de las decisiones del glosario y ningún tramo posterior la lee " +
      "todavía: si el golden fuera sobre la salida renderizada, borrarlo pasaría en verde para " +
      "siempre. ACREDITACIÓN POR CASUALIDAD CERRADA: el reemplazo conserva `href` EN USO — con `href: " +
      "\"\"` a secas el parámetro queda sin leer y el mutante muere en TS6133",
  },
  {
    id: "S29",
    garantía: "una tabla de markdown es la TABLA CHICA, `grain: 'whole'`",
    rompe: "el árbol y la identidad: dos filas con el mismo contenido pasan a competir por ancla",
    cambios: [[
      `        body: { shape: "grid", headers, rows, grain: "whole" },`,
      `        body: { shape: "grid", headers, rows, grain: "row" },`,
    ]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "«`grid` NO desaparece: la ganancia del cambio fue la identidad por fila, no bajar de seis formas " +
      "a cinco». Y el mutante NO produce registros aunque diga `row`, porque `isRowNode` exige las " +
      "cuatro condiciones a la vez: es el ejemplo de por qué el predicado vive en `ir` y no en cada " +
      "adaptador",
  },

  // ── Tramo 3 · las tres decisiones del paso, hechas fila ────────────────────
  //
  // Las siete de abajo no estaban en el plan del paso 3: son las decisiones que el plan
  // presentaba como abiertas y que este paso cerró. Una decisión cerrada sin una fila
  // que la rompa es una preferencia escrita en un docstring.
  {
    id: "S45",
    garantía: "un contenedor HEREDA su ruta; no se declara raíz",
    rompe: "el árbol: la lista se despega de su sección y arrastra a todo lo que la sigue",
    cambios: [[
      `          return { role: s.ordered ? "ordered_list" : "list", hint: containerHint(u) };`,
      `          return { role: s.ordered ? "ordered_list" : "list", hint: { linkage: "none" } };`,
    ]],
    espera: /I14 · un contenedor no se declara raíz ni abre nivel/,
    nota:
      "es la lectura que el paso 3 midió y descartó, y la razón de que la fase 1 tocara `route.ts`: " +
      "con la lista en la raíz, el bloque de código, la imagen y la tabla posteriores pierden su " +
      "sección. `{linkage:'parent', parent:null}` es lo único que sabe decir «declaro mi id y heredo " +
      "mi ruta»",
  },
  {
    id: "S46",
    garantía: "un ítem cuelga de SU lista, y por eso el `id` del contenedor tiene un lector",
    rompe: "el árbol: los ítems quedan hermanos de su lista en vez de adentro",
    cambios: [[
      `          return { role: "paragraph", hint: containerHint(u) };`,
      `          return { role: "paragraph", hint: null };`,
    ]],
    espera: /I14 · todo ítem nombra a su contenedor/,
    nota:
      "ERA UN CONTROL DEL PLAN Y HOY ES UNA GARANTÍA. El prototipo del paso 3 tenía `SC7`: «borrar el " +
      "`id` de la pila de contenedores no rompe nada», y su nota decía «el día que `Hint` sepa decir " +
      "declaro mi id y heredo mi ruta, vuelve a ser la referencia y esta fila se pone roja». Ese día " +
      "fue la fase 1 de este paso. El control se convirtió en esta fila, que es exactamente lo que " +
      "tenía que pasar",
  },
  {
    id: "S47",
    garantía: "el epígrafe DECLARADO sale del título de CommonMark",
    rompe: "el árbol: `caption` pierde su único camino declarativo",
    cambios: [[`      const title = image[THREE];`, `      const title = image[THREE]?.slice(ZERO, ZERO);`]],
    espera: /I7 · `caption` llega por DOS eslabones/,
    nota:
      "el reemplazo conserva `image[THREE]` en uso y devuelve la cadena vacía, que la guarda de abajo " +
      "descarta: sin eso el mutante moriría en TS2367 por comparar `undefined` con `\"\"`, y la fila la " +
      "acreditaría el compilador",
  },
  {
    id: "S48",
    garantía: "el epígrafe por posición exige CURSIVA, no solo adyacencia",
    rompe: "el rol: cualquier párrafo debajo de una figura se reporta como su epígrafe",
    cambios: [[
      `      if (!isWhollyItalic(u.body)) return null;`,
      `      if (!isWhollyItalic(u.body) && u.signals.previous < ZERO) return null;`,
    ]],
    espera: /I7 · no todo lo que sigue a una imagen es epígrafe/,
    nota:
      "son DOS señales y hay que exigir las dos. El corpus lleva una tercera imagen seguida de un " +
      "párrafo que NO está en cursiva exactamente por esta fila: sin ese caso negativo, «cursiva Y " +
      "adyacente» es indistinguible de «adyacente» y la mutación pasa en verde. La guarda imposible " +
      "mantiene `isWhollyItalic` en uso",
  },
  {
    id: "S49",
    garantía: "el nivel lo fija la señal más DÉBIL: el epígrafe por posición es `positional`",
    rompe: "la certeza que llega a la skill: una inferencia se reporta como una declaración",
    cambios: [[
      `  name: "byNearbyItalic",\n  level: "positional",`,
      `  name: "byNearbyItalic",\n  level: "declarative",`,
    ]],
    espera: /I7 · el epígrafe POR POSICIÓN es `positional`, no `declarative`/,
    nota:
      "la cursiva sola no dice «epígrafe» —dice énfasis—; lo dice estar pegado a una imagen, y eso es " +
      "POSICIÓN. `certaintyOfLevel` convierte `positional` en `inferred`, así que el nodo pasa de «el " +
      "documento lo dijo» a «Savia lo concluyó» y `Fragment.minLevel` empeora con él. Inferirlo y " +
      "estampar `declarative` es exactamente lo que `certaintyOfLevel` existe para impedir",
  },
  {
    id: "S50",
    garantía: "el frontmatter es HERMANO, no ancestro",
    rompe: "toda huella contextual del documento: editar una línea de metadato re-embebe el archivo entero",
    cambios: [[
      `          return { role: "fields", hint: { linkage: "none" } };`,
      `          return { role: "fields", hint: { linkage: "level", level: ZERO } };`,
    ]],
    espera: /I11 · el frontmatter es hermano, no ancestro/,
    nota:
      "la razón está MEDIDA y no es de gusto: `ContextualFingerprint` es `sha256(miga ‖ texto)` y de " +
      "ahí sale `FragmentId`. Si el frontmatter abriera scope entraría en la miga de todos los " +
      "fragmentos del documento, y cambiar `version: 3` por `version: 4` movería el id de cada uno",
  },
  {
    id: "S51",
    garantía: "un frontmatter que no es YAML no se descarta en silencio",
    rompe: "el sumidero: el metadato desaparece sin decir por qué",
    cambios: [[`    notice("md.frontmatter.invalid", firstError.message);`, `    void firstError;`]],
    espera: /I6 · nada se descarta en silencio/,
    nota:
      "la política ante un frontmatter inválido es «nunca se pierde un archivo, nunca se indexa " +
      "basura»: el bloque cae a prosa —así que el texto entra igual— y NO se emite un `fields` con los " +
      "pares que se pudieron adivinar. Las dos mitades hacen falta, y sin el aviso la primera es " +
      "indistinguible de un archivo que no tenía frontmatter",
  },
  {
    id: "S52",
    garantía: "un valor no escalar del frontmatter se avisa, no se aplana",
    rompe: "el sumidero: una clave del metadato desaparece sin registro",
    cambios: [[
      `      notice("md.frontmatter.unsupported", \`\${label}: el valor no es escalar\`);`,
      `      void label;`,
    ]],
    espera: /I6 · nada se descarta en silencio/,
    nota:
      "`fields` es un arreglo PLANO de `Pair` y YAML tiene listas y mapas anidados. Las tres salidas " +
      "eran aplanar con un separador (inventa sintaxis que nadie declaró), quedarse con el primer " +
      "nivel (pierde en silencio) o avisar. Esta fila acredita que se avisa",
  },

  // ── Tramo 2 · sonda, registro y selector ───────────────────────────────────
  {
    id: "S30",
    garantía: "`achievedLevel` se deriva de `evidence > Floor`",
    rompe: "la observabilidad: un documento que cayó al piso se reporta como estructurado",
    cambios: [[
      `winner.e > Evidence.Floor ? "structured" : "plain_text"`,
      `winner.e > Evidence.None ? "structured" : "plain_text"`,
    ]],
    espera: /I8 · sin adaptador dedicado se cae al piso, y se DECLARA/,
    nota:
      "es el campo que «vuelve visible la degradación» y que `seleccionar()` descartaba: sin él, el " +
      "llamador no puede distinguir «ganó un dedicado» de «cayó al piso» sin comparar `a.id === 'piso'`, " +
      "que es ramificar sobre la identidad de un adaptador desde la orquestación",
  },
  {
    id: "S31",
    garantía: "gana la evidencia MÁS ALTA",
    rompe: "la selección entera: el adaptador más flojo le gana al dedicado",
    cambios: [[
      `    (x, y) => y.e - x.e || (x.a.id < y.a.id ? -ONE : x.a.id > y.a.id ? ONE : ZERO),`,
      `    (x, y) => x.e - y.e || (x.a.id < y.a.id ? -ONE : x.a.id > y.a.id ? ONE : ZERO),`,
    ]],
    espera: /I8 · el piso no compite con un adaptador dedicado/,
    nota:
      "ACREDITACIÓN POR CASUALIDAD HEREDADA Y CERRADA: en el prototipo esta fila pasaba EN VERDE, " +
      "porque el `pool` tenía un solo elemento y la dirección del `sort` era inobservable. El guardián " +
      "de acá registra un SEGUNDO dedicado con evidencia más baja —`markdown-heuristico`, que responde " +
      "`Content`— y sin él la fila no acreditaría nada",
  },
  {
    id: "S32",
    garantía: "un evidenciador que LANZA cuenta como `None`",
    rompe: "la selección de los doce: un bug en un adaptador que ni reclamaba el archivo decide su destino",
    cambios: [[
      `      } catch {\n        return { a, e: Evidence.None };\n      }`,
      `      } catch (e) {\n        throw e;\n      }`,
    ]],
    espera: /I8 · un evidenciador que lanza cuenta como None/,
    nota:
      "PROVISIONAL(#9) de `ir`: `select` usa `Promise.all`, que PROPAGA el rechazo, en un pipeline " +
      "donde «los archivos rotos son la norma, no la excepción»",
  },
  {
    id: "S33",
    garantía: "los `id` del registro son ÚNICOS",
    rompe: "el desempate y con él la validez del caché: con dos iguales el comparador da 0",
    cambios: [[`    if (seen.has(e.id)) {`, `    if (seen.has(e.id) && seen.size < ZERO) {`]],
    espera: /I8 · dos adaptadores no pueden compartir id/,
    nota:
      "el plan nunca declara la unicidad y PROVISIONAL(#427) de `ir` la nombra como el hueco. El " +
      "registro es el único lugar donde se puede imponer, porque es el único que ve a los doce a la vez",
  },
  {
    id: "S34",
    garantía: "la cascada REORDENA por nivel: `declarative` antes que `positional`",
    rompe: "la certeza: un eslabón posicional le gana a lo que el documento DECLARA",
    cambios: [[
      `      .sort((a, b) => rank(a.level) - rank(b.level))`,
      `      .sort((a, b) => rank(b.level) - rank(a.level))`,
    ]],
    espera: /I9 · la cascada reordena por nivel/,
    nota:
      "«el invariante se cumple por construcción, no por revisión». El caso del guardián escribe los " +
      "eslabones AL REVÉS a propósito, y el adaptador también: contra una cascada ya ordenada por su " +
      "autor, quitar el `sort` no cambia nada y la fila no acreditaría",
  },
  {
    id: "S35",
    garantía: "el piso físico es de nivel `physical`",
    rompe: "la certeza que llega a la skill: lo que respondió la forma se declara leído del formato",
    cambios: [[
      `      level: r === null ? "physical" : r.level,`,
      `        level: r === null ? "declarative" : r.level,`,
    ]],
    espera: /I5 · el piso es de nivel `physical`/,
    nota:
      "`certaintyOfLevel` mapea los dos a `declared`, así que la CERTEZA no cambia y ningún consumidor " +
      "de certeza se entera: lo que se pierde es la atribución, que es la métrica de salud de toda la " +
      "capa de reconocimiento",
  },
  {
    id: "S36",
    garantía: "`attribution: null` significa «lo resolvió el piso», y nadie más lo escribe",
    rompe: "la observabilidad: el 100 % del documento aparece resuelto por un eslabón que no lo tocó",
    cambios: [[
      `      attribution: r === null ? null : r.attribution,`,
      `        attribution: r === null ? "byMarkdownBlock" : r.attribution,`,
    ]],
    espera: /I5 · el piso físico responde/,
    nota:
      "el par de S35 sobre el otro campo. «Si en DOCX el 60 % de los nodos los resuelve `porProminencia` " +
      "en vez de `porStyleId`, no hay un bug: hay un mapa de estilos incompleto» — y con el piso " +
      "disfrazado de eslabón, esa lectura es imposible",
  },
  {
    id: "S37",
    garantía: "la extensión se normaliza UNA vez, en la sonda",
    rompe: "la selección: el mismo archivo elige adaptadores distintos según cómo lo nombró quien lo subió",
    cambios: [[`  return name.slice(dot + ONE).toLowerCase();`, `  return name.slice(dot + ONE);`]],
    espera: /I8 · la extensión se normaliza en la sonda/,
    nota:
      "PROVISIONAL(#430) de `ir`: «es el campo del que dependen todos los evidenciadores de nivel " +
      "`Extension`, y hoy hay que decidirlo doce veces». Normalizar en cada adaptador son doce " +
      "oportunidades de no hacerlo",
  },
  {
    id: "S38",
    garantía: "`Source.range` es `[start, end)`, en bytes",
    rompe: "los bytes: el documento entra al pipeline con agujeros, sin excepción y sin aviso",
    cambios: [[
      `  range: (start, end) => Promise.resolve(bytes.slice(start, end)),`,
      `  range: (start, end) => Promise.resolve(bytes.slice(start, end - 1)),`,
    ]],
    espera: /I10 · `range` es \[start, end\), en bytes/,
    nota:
      "`ir` escribe el modo de falla con número: un archivo de 10 bytes recorrido de a 4 devuelve 7, " +
      "perdiendo el 3, el 7 y el 9. Es la mutación más barata de todo el paso y la más cara de " +
      "descubrir en producción",
  },

  // ── Paso 4 · el piso de texto ──────────────────────────────────────────────
  //
  // Las siete filas de este bloque acreditan un camino que hasta hoy NUNCA había
  // corrido: el `.md` siempre gana su archivo, así que `Evidence.Floor`, el segundo
  // nivel del `pool` y `achievedLevel:'plain_text'` estaban escritos en el contrato y
  // no los tocaba ningún caso.
  {
    id: "S74",
    garantía: "el piso decide por CONTENIDO, nunca por la extensión",
    rompe: "el piso entero: pasa a ser un adaptador de `.txt` disfrazado",
    cambios: [[
      `      printableProportionOf(probe.magicBytes) >= minPrintableProportion\n        ? Evidence.Floor\n        : Evidence.None,`,
      `      probe.extension === "txt" &&\n      printableProportionOf(probe.magicBytes) >= minPrintableProportion\n        ? Evidence.Floor\n        : Evidence.None,`,
    ]],
    espera: /I15 · el piso reclama por contenido, no por extensión/,
    nota:
      "ES LA MUTACIÓN PLAUSIBLE Y LA QUE MÁS DUELE: leer la extensión es un renglón más corto que " +
      "medir la ventana, y el resultado sobre un `.txt` es idéntico. Lo que se pierde son EXACTAMENTE " +
      "los archivos por los que el piso existe —el `.conf`, el `.ini`, el `.properties`, el `.log` sin " +
      "extensión conocida— que en una empresa son todos los que hay, porque `.txt` no lo escribe nadie. " +
      "POR ESO EL CORPUS NO TIENE UN `.txt`: con uno adentro esta fila pasaría en verde y la propiedad " +
      "quedaría sin probar. La mutación CONSERVA la medición para que el parámetro siga en uso — con " +
      "`probe.extension === \"txt\"` a secas el mutante muere en TS6133 y la fila la acreditaría el " +
      "linter en vez del guardián",
  },
  {
    id: "S75",
    garantía: "el gate de imprimibles CORTA: lo que no es texto no entra por el piso",
    rompe: "la confianza en la memoria — basura binaria indexada, que el plan declara IRREVERSIBLE",
    cambios: [[
      `      printableProportionOf(probe.magicBytes) >= minPrintableProportion`,
      `      printableProportionOf(probe.magicBytes) <= minPrintableProportion`,
    ]],
    espera: /I16 · C · lo que no es texto y nadie sabe leer no se indexa/,
    nota:
      "una comparación dada vuelta, que es de las mutaciones más baratas de escribir sin querer. El " +
      "archivo de texto SIGUE ENTRANDO —mide exactamente el umbral, así que el `<=` también lo acepta— " +
      "y por eso ni el golden ni la rama A se mueven: lo único que cambia es que el `.png` pasa a " +
      "indexarse. Es el falso positivo que el umbral existe para minimizar, y su costo es el que el " +
      "plan carga con todas las letras: «erosiona la confianza en la memoria, que es el producto " +
      "entero» (§{Qué se acepta})",
  },
  {
    id: "S76",
    garantía: "`U+FFFD` cuenta como NO imprimible: es la huella de un binario leído como texto",
    rompe: "el detector: un archivo de bytes arbitrarios mide 1.00 y entra entero",
    cambios: [[`const UNPRINTABLE = /\\p{C}|\\uFFFD/u;`, `const UNPRINTABLE = /\\p{C}/u;`]],
    espera: /I15 · lo que no es UTF-8 válido no mide como texto/,
    nota:
      "ACREDITACIÓN POR CASUALIDAD BUSCADA Y CERRADA, Y ES LA CARA DE LA CLASE CARA. `U+FFFD` es " +
      "categoría `So` y no `C`, así que quitarlo del regex compila y se lee razonable. La primera " +
      "versión de esta fila apoyaba el caso en el `.png` del corpus y PASABA EN VERDE: medido, el " +
      "binario da 0.4402 con la regla y 0.8120 sin ella, o sea que sigue por debajo del umbral y la " +
      "rama C no se mueve. El invariante se reescribió con una ventana propia —cuatro bytes que ningún " +
      "decodificador puede leer, que sin la regla miden 1.00 exacto— y recién ahí la fila acredita algo",
  },
  {
    id: "S77",
    garantía: "el piso nunca declara más que `Floor`",
    rompe: "la selección: le gana archivos a los adaptadores que sí saben leerlos",
    cambios: [[`        ? Evidence.Floor\n        : Evidence.None,`, `        ? Evidence.Extension\n        : Evidence.None,`]],
    espera: /I15 · el piso nunca declara más que `Floor`/,
    nota:
      "`Floor` es el escalón que la escala le RESERVA y el único que el `pool` de dos niveles trata " +
      "aparte (PROVISIONAL(#429) de `ir`). Con un peldaño más el piso entra al `pool` de arriba, y ahí " +
      "el desempate lo decide el ORDEN ALFABÉTICO del id — o sea que qué adaptador lee un archivo " +
      "pasaría a depender de cómo alguien llamó al suyo. Es también la fila que explica por qué " +
      "`achievedLevel` NO se deriva de `a.id === 'piso'`: con la comparación por identidad, esta " +
      "mutación dejaría el nivel diciendo `plain_text` sobre un archivo que ganó por `Extension`",
  },
  {
    id: "S78",
    garantía: "el piso se ABSTIENE siempre: no inventa estructura donde no hay formato",
    rompe: "la métrica de atribución — un clasificador aparece resolviendo lo que nadie miró",
    cambios: [[
      `  detect: () => (): Classification | null => null,\n});`,
      `  detect: () => (): Classification | null => ({ role: "paragraph", hint: null }),\n});`,
    ]],
    espera: /I17 · todo nodo del piso lo resolvió el piso físico/,
    nota:
      "EL ROL NO CAMBIA —`roleFromBody` de un `text_span` ya da `paragraph`— y esa es justamente la " +
      "trampa: la salida se ve idéntica salvo por dos campos que nadie renderiza. Lo que se pierde es " +
      "que `attribution: null` significa «lo resolvió el piso» y NADIE MÁS lo escribe: con el piso " +
      "disfrazado de eslabón, «si en DOCX el 60 % lo resuelve `porProminencia` en vez de `porStyleId`, " +
      "hay un mapa de estilos incompleto» (§{Observabilidad}) es una lectura imposible. Es la razón por " +
      "la que el piso NO tiene cascada: un eslabón que mirara líneas cortas inventaría títulos y los " +
      "estamparía como si el documento los hubiera dicho",
  },
  {
    id: "S79",
    garantía: "el salto de línea de adentro de un bloque se conserva; el corte es la línea EN BLANCO",
    rompe: "el texto indexado: tres líneas de configuración se vuelven una oración",
    cambios: [[`  text: open.text.join("\\n"),`, `  text: open.text.join(" "),`]],
    espera: /I17 · el salto de línea de adentro de un bloque se conserva/,
    nota:
      "el piso NO SABE si el salto lo puso el autor o el ancho de una terminal, y adivinarlo es leer un " +
      "formato que no existe. La huella no se mueve —`text_span` se proyecta por PALABRA— así que la " +
      "identidad del nodo es idéntica y ningún invariante de proyección se entera: lo único que cambia " +
      "es lo que un humano lee en el resultado de una búsqueda. El sellado vive en UN solo sitio " +
      "(`sealOf`) y por eso esta fila tiene un ancla única; con las dos copias que tenía la primera " +
      "versión, `ubicar` habría rechazado la fila en vez de mutar",
  },
  {
    id: "S80",
    garantía: "el umbral entra POR PARÁMETRO: `minPrintableProportion` sigue `Pending`",
    rompe: "nada visible hoy — y ese es el punto: el pendiente pasa a ser decorativo",
    cambios: [
      [
        `export const textFloorAdapter = (\n  minPrintableProportion: number,\n)`,
        `export const textFloorAdapter = (\n  _minPrintableProportion: number,\n)`,
      ],
      [
        `      printableProportionOf(probe.magicBytes) >= minPrintableProportion`,
        `      printableProportionOf(probe.magicBytes) >= 0.8`,
      ],
    ],
    espera: /I16 · la decisión la toma el umbral/,
    nota:
      "ES EL NÚMERO INVENTADO ENTRANDO POR LA VENTANA, escrito como lo escribiría alguien de buena fe: " +
      "0.8 SUENA medido. `PARAMETERS.intake.minPrintableProportion` es `Pending<number>` con su plan de " +
      "medición escrito («curva ROC sobre un corpus etiquetado binario/texto») y con la asimetría " +
      "declarada, y ningún caso del corpus distingue 0.8 de un umbral bien elegido — por eso lo que el " +
      "guardián verifica no es el VALOR sino que el parámetro GOBIERNE: con el literal puesto, los dos " +
      "pisos del invariante se comportan igual y la frontera deja de moverse. La fila necesita DOS " +
      "cambios porque quitar el uso del parámetro sin renombrarlo muere en TS6133 y acreditaría al " +
      "linter",
  },

  // ── El borde R1 y el confinamiento de la dependencia ───────────────────────
  {
    id: "S54",
    garantía: "R1 — `adapters` no puede alcanzar `emission`, y el error NOMBRA la frontera",
    rompe: "el borde R1, desde el lado que hasta este paso no existía",
    cambios: [[
      `import { cascade } from "./registry.js";`,
      `import { group } from "@savia-os/emission";\nexport const _cruza = group;\nimport { cascade } from "./registry.js";`,
    ]],
    espera: /frontera cruzada · src\/markdown\.ts {2}↛ {2}@savia-os\/emission/,
    nota:
      "ES LA MITAD QUE FALTABA. `emission` acredita la suya desde el paso 3a, y hasta hoy no tenía " +
      "sentido escribir esta: no existía ningún adaptador desde el cual cruzar. Con las dos, la frase " +
      "«nunca se ven entre sí» deja de ser cierta por vacío. El `export const _cruza` mantiene el " +
      "import en uso —sin él TS6133 mata la corrida y la fila la acreditaría el linter— y por esto el " +
      "guardián de fronteras corre ANTES que `tsc`: el paquete no está en `dependencies`, así que el " +
      "resolvedor moriría primero con «Cannot find module», que no nombra ninguna frontera",
  },
  {
    id: "S55",
    garantía: "no hay `delegar()`: `adapters` no puede alcanzar la orquestación",
    rompe: "el grafo de paquetes: la delegación deja de ser emergente y pasa a ser una llamada",
    // EL ANCLA CRECIÓ EN EL PASO 4, y el motivo va escrito: `src/floor.ts` abre con el
    // MISMO prefijo de import, así que `import {⏎ Evidence, PARAMETERS, asAdapterId,`
    // pasó a encontrar DOS archivos y `ubicar()` rechazó la fila. Es el arnés
    // funcionando: un ancla ambigua muta el archivo equivocado, y el `espera` de abajo
    // nombra a `markdown.ts`. `asLocalId` es lo que distingue a los dos.
    cambios: [[
      `import {\n  Evidence,\n  PARAMETERS,\n  asAdapterId,\n  asLocalId,`,
      `import { ingest } from "@savia-os/orchestration";\nexport const _delegar = ingest;\nimport {\n  Evidence,\n  PARAMETERS,\n  asAdapterId,\n  asLocalId,`,
    ]],
    espera: /frontera cruzada · src\/markdown\.ts {2}↛ {2}@savia-os\/orchestration/,
    nota:
      "es la frontera que `ir/src/adapter.ts` DECLARA en prosa —«NO hay `delegar()`»— y que ninguna " +
      "línea imponía. El adaptador emite `asset` y nada más; quien recorre las unidades, detecta los " +
      "assets y llama a `select` es la orquestación",
  },
  {
    id: "S53",
    garantía: "`yaml` está confinada al adaptador que la usa",
    rompe: "el borde de dependencias: el tramo 2 pasa a depender de una librería de formato",
    cambios: [[
      `import {\n  Evidence,\n  PARAMETERS,\n  rank,`,
      `import { parse } from "yaml";\nexport const _yaml = parse;\nimport {\n  Evidence,\n  PARAMETERS,\n  rank,`,
    ]],
    espera: /confinamiento roto · src\/registry\.ts importa `yaml`/,
    nota:
      "es la primera dependencia de runtime del proyecto y la regla que la admite dice «solo `adapters` " +
      "las tiene», NO «cualquier archivo de `adapters`». El tramo 2 decide QUIÉN lee un archivo: si " +
      "dependiera de una librería de formato, cada adaptador nuevo arrastraría la suya a la selección " +
      "de los doce y el borde de dependencias dejaría de coincidir con el de formato",
  },
  {
    id: "S56",
    garantía: "el grafo DECLARADO coincide con el usado: `dependencies` es `ir` + `yaml` y nada más",
    rompe: "nada visible hoy — y ese es el punto: las tres filas de arriba se satisfacen agregando la dependencia",
    cambios: [[
      `    "@savia-os/ir": "workspace:*",\n    "yaml": "^2.8.1"`,
      `    "@savia-os/ir": "workspace:*",\n    "yaml": "^2.8.1",\n    "typescript": "^5.9.3"`,
    ]],
    espera: /`dependencies` no es exactamente la lista blanca/,
    nota:
      "sin esta mitad, S53, S54 y S55 se satisfacen agregando la dependencia y el import EL MISMO DÍA " +
      "— y el que lo hace está siguiendo al pie de la letra lo que le dijo «Cannot find module». Lo que " +
      "de verdad impone R1 es el grafo de PAQUETES, y este es el único chequeo que lo mira",
  },
  {
    id: "S57",
    garantía: "ni un global de node en `src/`",
    rompe: "la lista blanca de imports: un global no es un import y ningún regex de imports lo ve",
    cambios: [[
      `  size: bytes.length,\n  bytes: () => Promise.resolve(bytes),`,
      `  size: Buffer.from(bytes).length,\n  bytes: () => Promise.resolve(bytes),`,
    ]],
    espera: /usa el global de node `Buffer`/,
    nota:
      "ES LA RAZÓN DE QUE ESTE PAQUETE NO TRAIGA `@types/node`. Con esos tipos en alcance, `src/` puede " +
      "usar node sin escribir un solo `import`, y el guardián —que mira especificadores— daría verde. " +
      "Lo que el paquete toma del entorno se declara a mano en `src/env.d.ts`, así que la lista se lee " +
      "de un vistazo y crece con un diff visible",
  },

  // ── La cadena y el golden ──────────────────────────────────────────────────
  {
    id: "S41",
    garantía: "ningún guardián queda fuera de `lint`",
    rompe: "nada visible — y ese es el punto: la garantía deja de verificarse sin que nada cambie de color",
    cambios: [[
      `&& node scripts/invariants.mjs && node scripts/citations.mjs && node scripts/mutants.mjs",`,
      `&& node scripts/invariants.mjs && node scripts/mutants.mjs",`,
    ]],
    espera: /guardian left out of `lint`/,
    nota:
      "es la ÚNICA falla del paquete que ningún otro chequeo puede ver, porque para verla hay que mirar " +
      "el `package.json` y no la salida. `ir/GLOSARIO.md` (sección 6) documenta haberla tenido: una " +
      "lista de renombres que se olvidó de un script. Saca `citations.mjs` y no `boundaries.mjs` a " +
      "propósito — el que chequea es `boundaries.mjs`, y sacarlo a él sacaría también al testigo",
  },
  {
    id: "S42",
    garantía: "`build` NO puede encadenar el corredor de mutación",
    rompe: "el árbol de trabajo: turbo corre `lint` y `build` en paralelo y quedan mutaciones pegadas",
    cambios: [[
      `&& node scripts/invariants.mjs && node scripts/citations.mjs"`,
      `&& node scripts/invariants.mjs && node scripts/citations.mjs && node scripts/mutants.mjs"`,
    ]],
    espera: /`build` chains the mutation runner/,
    nota:
      "la mitad de adelante de S41, y va al revés: acá el mutante AGREGA en vez de sacar. Pasó de " +
      "verdad en `ir` —dejó ocho archivos de `src/` con mutaciones pegadas— y la regla de fondo es más " +
      "simple que la carrera: un build no muta su fuente",
  },
  {
    id: "S43",
    garantía: "el golden no se puede editar para que el código pase",
    rompe: "la única comparación contra algo externo al código",
    cambios: [[`      "role": "ordered_list",`, `      "role": "list",`]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "los otros trece invariantes verifican que la salida sea coherente CONSIGO MISMA, y una salida " +
      "puede ser perfectamente coherente y ser el árbol equivocado — que es lo que pasa si el fixture " +
      "se ajusta al código. Es la razón por la que este paquete NO usa un runner con snapshots: un " +
      "golden que se regenera con una tecla es el modo de falla que esta fila existe para impedir",
  },
  {
    id: "S44",
    garantía: "el corpus es versionado y su salida está congelada",
    rompe: "el golden — a propósito: cambiar el corpus es cambiar la prueba",
    cambios: [[`## Cierre`, `## Cierre final`]],
    espera: /I1 · golden bytes→nodos/,
    nota:
      "«corpus real versionado en el repo» significa que el corpus es PARTE del contrato de prueba: " +
      "tocarlo tiene que ser un acto visible, con el golden regenerado en el mismo commit",
  },

  // ── Paso 5 · el chat entra por la misma puerta (I18) ────────────────────────
  {
    id: "S45",
    garantía: "el chat produce `text_span` y no envuelve el mensaje en otra forma",
    rompe: "la igualdad de huellas entre canales, que es la cintura MEDIDA",
    cambios: [[
      `body: { shape: "text_span", text: p.text, marks: p.marks },`,
      `body: { shape: "verbatim", text: p.text },`,
    ]],
    espera: /I18 · el chat produce un `text_span` por párrafo/,
    nota:
      "`verbatim` es la mutación PLAUSIBLE y no una inventada: un mensaje de chat se parece a texto " +
      "preformateado, y la diferencia real —¿se puede reflowear, o los espacios son significativos?— " +
      "es justo la que el fragmentador consulta. La huella se calcula sobre el CUERPO, así que con " +
      "esta forma el mismo texto por dos canales pasa a ser dos contenidos distintos para el caché, " +
      "el dedupe de blobs y la reconciliación del paso 11. Es la mitad local de I12 de `orchestration`",
  },
  {
    id: "S46",
    garantía: "el chat SE ABSTIENE: quien clasifica un mensaje es el piso físico",
    rompe: "el rol, el nivel y la atribución de todo mensaje",
    cambios: [[
      `  detect: () => (): Classification | null => null,\n};`,
      `  detect: () => (): Classification | null => ({ role: "heading", hint: { linkage: "none" } }),\n};`,
    ]],
    espera: /I18 · el chat se abstiene y responde el piso físico/,
    nota:
      "el plan lo anota en la misma línea del adaptador —«se abstiene: el piso responde 'parrafo'» " +
      "(§{Chat})— y sin testigo esa línea es prosa. Una cascada acá inventaría títulos a partir de " +
      "mensajes cortos y los estamparía como si la conversación los hubiera declarado; peor, un " +
      "`heading` cambia la cohesión a `lead` y pasa a ABRIR fragmento, así que el defecto no se queda " +
      "en una etiqueta: reparte todos los mensajes siguientes en otro fragmento",
  },
  {
    id: "S47",
    garantía: "la autoría del mensaje llega a cada nodo",
    rompe: "«esto lo dijo el CFO en marzo», que es la mitad del valor de la memoria",
    cambios: [[`          ownAuthorship: input.author,`, `          ownAuthorship: { actor: "", when: "", source: "" },`]],
    espera: /I18 · cada nodo del mensaje trae su autoría/,
    nota:
      "es el modo de falla que este paso ENCONTRÓ y que estuvo cuatro pasos en silencio: `ownAuthorship` " +
      "existía en `Unit` como campo opcional, no lo leía nadie, y `opaqueOf` mapeaba `Unit → RawNode` " +
      "sin él. Un adaptador podía escribir la autoría de cada unidad y verla desaparecer sin un aviso. " +
      "Se muta a strings vacíos y no se borra el campo: borrarlo daría un error de TIPO —`AuthoredUnit` " +
      "lo exige— y acreditaría al compilador en vez del guardián, que es la lección de M12c",
  },

  {
    id: "S48",
    garantía: "el corpus del chat es versionado y su salida está congelada",
    rompe: "el golden del mensaje — a propósito: cambiar el corpus es cambiar la prueba",
    cambios: [[`{ "kind": "bold", "start": 32, "end": 48 }`, `{ "kind": "italic", "start": 32, "end": 48 }`]],
    espera: /I18 · golden mensaje→nodos/,
    nota:
      "muta una MARCA y no el texto, y ahí está el punto: `marks` no se renderiza en `Fragment.text`, " +
      "así que contra un golden de fragmentos esta edición pasaría en verde. El golden del chat trae el " +
      "cuerpo ENTERO por la misma razón que el del `.md`, y esta fila es la que lo mide. Que el chat " +
      "propague las marcas sin tocarlas es además media prueba de §{Chat}: el adaptador no interpreta " +
      "nada, solo traduce",
  },
  {
    id: "S49",
    garantía: "el golden del chat no se puede editar para que el código pase",
    rompe: "la única comparación del chat contra algo externo al código",
    cambios: [[`      "anchor": "msg#1",`, `      "anchor": "msg#uno",`]],
    espera: /I18 · golden mensaje→nodos/,
    nota:
      "el par de S48 y va al revés: aquella mueve la ENTRADA, esta la EXPECTATIVA. Las otras tres " +
      "mitades de I18 verifican propiedades —forma, abstención, autoría— y una salida puede cumplir las " +
      "tres y ser la equivocada; el golden es lo único que la ata a algo escrito afuera. Se regenera con " +
      "`ADAPTERS_REGEN=1` y ningún script del `package.json` lo pasa: regenerar es un comando que " +
      "alguien escribe a mano y que aparece en el diff",
  },

  // ── El diario de deshacer del propio arnés ─────────────────────────────────
  // LAS TRES FILAS QUE NO VIENEN DEL PLAN, y las únicas que llevan EL MISMO ID EN LOS
  // CUATRO PAQUETES: acreditan la MISMA garantía sobre cuatro copias autónomas del mismo
  // diseño. Mutan `scripts/mutants.mjs` —el único archivo que el arnés no puede ubicar
  // solo, ver el campo `archivo` arriba— y el testigo es el guardián que sí lo lee DE
  // DISCO.
  //
  // LO QUE ESTAS TRES NO ACREDITAN, dicho acá y no descubierto después: que la reparación
  // FUNCIONE. Eso no se acredita con un mutante de texto — se acredita matando una corrida
  // de verdad con `SIGKILL` y mirando qué hace la siguiente. Lo que estas tres fijan es que
  // las TRES formas de perder la propiedad EDITANDO EL ARNÉS tengan un testigo que grite.
  {
    id: "D1",
    garantía: "el original va al diario ANTES de que el archivo se mute",
    rompe: "la reparación, en la ventana exacta que el diario existe para no tener",
    archivo: "scripts/mutants.mjs",
    cambios: [[`${AL_DIARIO}\n      ${AL_ARCHIVO}`, `${AL_ARCHIVO}\n      ${AL_DIARIO}`]],
    espera: /muta ANTES de anotar el original/,
    nota:
      "invertir las dos líneas deja un intervalo en el que el archivo YA CAMBIÓ y el candado todavía no " +
      "lo sabe. Un `SIGKILL` ahí adentro es indistinguible del bug original: mutación pegada y nadie que " +
      "sepa revertirla. Es la fila que separa «hay un diario» de «el diario sirve»",
  },
  {
    id: "D2",
    garantía: "sin escribir el original al candado no hay nada que reparar",
    rompe: "el diario entero: queda un candado que DETECTA y no repara",
    archivo: "scripts/mutants.mjs",
    cambios: [[`${AL_DIARIO}\n      `, ``]],
    espera: /no escribe el original al candado/,
    nota:
      "es el estado ANTERIOR a este paso escrito como mutante: el mapa en memoria alcanzaba para el " +
      "`finally`, para la excepción y para `SIGINT`/`SIGTERM`, y moría con el proceso ante un `SIGKILL` — " +
      "que es justo la señal que `turbo` usa para matar las tareas concurrentes cuando otra falla",
  },
  {
    id: "D3",
    garantía: "la duda sobre si el pid del candado vive cae del lado de «vivo»",
    rompe: "la exclusión mutua: una corrida repara encima de otra que está mutando",
    archivo: "scripts/mutants.mjs",
    cambios: [[LADO_SEGURO, `return false;`]],
    espera: /da por muerto un pid del que solo duda/,
    nota:
      "`process.kill(pid, 0)` tira `EPERM` cuando el proceso EXISTE y es de otro usuario, y los PID se " +
      "reusan en máquinas de mucho uptime. Con `return false` cualquier errno pasa a significar «muerto»: " +
      "el arnés borra el candado ajeno, restaura encima de archivos que la otra corrida está mutando y las " +
      "dos siguen. El error caro es ese, no el de negarse a arrancar",
  },

  // ── Controles ──────────────────────────────────────────────────────────────
  {
    id: "DC1",
    control: true,
    garantía: "editar la prosa del docstring del diario no rompe nada",
    archivo: "scripts/mutants.mjs",
    cambios: [[
      `El estado dejó de depender ` + `de que el proceso viva.`,
      `El estado dejó de depender ` + `de que el proceso viva (control DC1).`,
    ]],
    nota:
      "el par de D1, D2 y D3. Lo que el guardián mira del arnés son TRES FORMAS —que la anotación exista, " +
      "que esté antes de la mutación y que la sonda de vida caiga del lado seguro—, no el archivo entero. " +
      "Sin este control, un guardián que congelara el texto del corredor sería indistinguible de uno que " +
      "verifica su forma, y congelarlo es la forma más rápida de que nadie lo mejore",
  },
  {
    id: "SC5",
    control: true,
    garantía: "cambiar la `version` del adaptador no rompe nada — y NO es porque esté verificada",
    cambios: [[
      `  id: MARKDOWN_ID,\n  level: "declarative",\n  version: "1",`,
      `  id: MARKDOWN_ID,\n  level: "declarative",\n  version: "2",`,
    ]],
    nota:
      "HALLAZGO INCÓMODO, PINCHADO PARA QUE NO SE VUELVA MENTIRA. `ir` documenta en " +
      "PROVISIONAL(#25/C20) que `version` cubre el ADAPTADOR ENTERO y entra en la clave del caché de " +
      "reconocimiento, y que con el nombre viejo «el caché sirve árboles CORRUPTOS PARA SIEMPRE». En el " +
      "paso 3 no hay caché, así que NADA la lee y moverla es inocuo. El día que exista el tramo 7 esta " +
      "fila se pone roja y deja de ser un control, que es exactamente lo que tiene que pasar",
  },
  {
    id: "SC8",
    control: true,
    garantía: "un comentario nuevo no rompe nada",
    cambios: [[
      `const isWhollyItalic = (body: Body): boolean => {`,
      `// control SC8: comentario inocuo\nconst isWhollyItalic = (body: Body): boolean => {`,
    ]],
  },
  {
    id: "SC9",
    control: true,
    garantía: "renombrar una variable local del recorrido no cambia nada",
    cambios: [[`  const out: Draft[] = [];`, `  const salida: Draft[] = [];\n  const out = salida;`]],
    nota:
      "el par de S18–S29: lo que esas filas fijan es el COMPORTAMIENTO del recorrido, no cómo se llaman " +
      "sus variables",
  },
  {
    id: "SC10",
    control: true,
    garantía: "editar el `description` de `package.json` no rompe nada",
    cambios: [[`  "description": "Tramos 2 y 3:`, `  "description": "control SC10 · tramos 2 y 3:`]],
    nota:
      "el par de S41–S42 y S56: los tres leen `package.json` y lo que fijan son las CADENAS y las " +
      "`dependencies`, no el archivo entero. Sin este control serían indistinguibles de un chequeo que " +
      "congela el manifiesto",
  },
  {
    id: "SC11",
    control: true,
    garantía: "reordenar dos exports del barril no rompe nada",
    cambios: [[`  MARKDOWN_ID,\n  type MdSignals,`, `  type MdSignals,\n  MARKDOWN_ID,`]],
    nota:
      "el barril es una lista, no un contrato de orden; lo que sí es contrato es que un símbolo de `ir` " +
      "no se re-declare acá",
  },
  {
    id: "SC18",
    control: true,
    garantía: "renombrar una variable local del piso no cambia nada",
    cambios: [[`  const out: Block[] = [];`, `  const salida: Block[] = [];\n  const out = salida;`]],
    nota:
      "el par de S79: lo que esa fila fija es QUÉ texto sale de un bloque, no cómo se llama el " +
      "acumulador que lo junta",
  },
  // Acá se propuso un control «cambiar el prefijo del ancla del piso no rompe nada», con
  // el argumento de que lo que I17 fija es DÓNDE corta el piso y no cómo se llama el
  // prefijo. Se corrió y salió ROJO: la tabla de I17 compara las anclas ENTERAS, así que
  // el prefijo sí está pinchado. La hipótesis era falsa y el control se borra en vez de
  // relajar el invariante para que el control sobreviva — que es la forma exacta de
  // convertir un guardián en un espejo.
  {
    id: "SC12",
    control: true,
    garantía: "editar la prosa de un docstring no rompe nada",
    cambios: [[`el reconocedor no es recursivo`, `el reconocedor no es recursivo (control SC12)`]],
    nota:
      "el par de S27: el docstring viaja al guardián de citas y no a ninguna comparación de salida. Sin " +
      "el control, un guardián demasiado sensible sería indistinguible de uno que verifica lo que dice",
  },
];

// Dónde vive cada mutación se deduce de su primer `buscar`, así que no hay que mantener
// la ruta al día por separado.
//
// `package.json` entra porque lo que S41, S42 y S56 verifican NO está en `src/`: está en
// las cadenas de guardianes y en `dependencies`. `corpus/` entra porque el corpus y su
// golden son PARTE del contrato de prueba de este paso, y son los dos únicos archivos
// del paquete que no son código y sin los cuales una mutación de comportamiento no rompe
// nada (S43, S44). Los dos guardianes entran SIN alojar ninguna mutación: sostienen la
// unicidad de las anclas —si un texto a mutar aparece también en un guardián, `ubicar`
// falla en vez de mutar el archivo equivocado— y de paso dejan verificado que la lista
// no se corrió.
const ARCHIVOS = [
  "src/registry.ts",
  "src/markdown.ts",
  // Entra en el paso 4 con S74–S80. Los dos archivos nuevos del corpus NO entran: no
  // aloja ninguna mutación un `.conf` cuyo contenido es irrelevante para las filas —lo
  // que decide es su EXTENSIÓN, y eso lo verifica S74 renombrándolo en memoria— y el
  // `.png` es binario, así que una mutación textual sobre él no es escribible. Que estén
  // en disco lo exige `boundaries.mjs`, que es donde corresponde.
  "src/floor.ts",
  // Entra en el paso 5 con S45-S47. Es el adaptador que prueba que la cintura no tiene
  // forma de documento, así que sus mutaciones son de COMPORTAMIENTO y no de tipo.
  "src/chat.ts",
  "src/index.ts",
  "src/env.d.ts",
  "package.json",
  "corpus/manual.md",
  // El corpus del CHAT, desde el paso 5. Un mensaje no es un archivo, y por eso la
  // fixture tiene que estar en disco igual que el `.md`: si viviera en el guardián,
  // cambiar la entrada y cambiar la expectativa serían la misma edición.
  "corpus/mensaje.json",
  "corpus/mensaje.golden.json",
  "corpus/manual.golden.json",
  "scripts/boundaries.mjs",
  "scripts/invariants.mjs",
];

// LA CADENA NO SE ESCRIBE ACÁ: SE LEE DE `package.json`. Escribirla a mano la deja
// derivar de la que corre `pnpm lint` —el arnés acreditaría una cadena que nadie
// ejecuta—, y con eso el paquete tendría DOS listas de guardianes que pueden discrepar
// en silencio. Derivada, las dos formas de perder un guardián se ven: si se lo saca de
// `lint`, `boundaries.mjs` grita; si se saca `boundaries.mjs` mismo —que es quien
// grita—, las filas que esperan sus mensajes se ponen rojas de golpe. Se le quita este
// propio script porque el arnés no puede correrse a sí mismo adentro de cada mutación.
//
// El `PATH` se extiende con `node_modules/.bin` porque la cadena nombra `tsc` pelado
// —así la escribe `package.json`, y pnpm se lo resuelve— y este script se corre también
// a mano, fuera de pnpm.
const PKG = JSON.parse(readFileSync(ruta("package.json"), "utf8"));
const CADENA = (PKG.scripts?.lint ?? "")
  .split("&&")
  .map((t) => t.trim())
  .filter((t) => t !== "" && !t.endsWith("scripts/mutants.mjs"))
  .join(" && ");
if (!CADENA.includes("scripts/")) {
  console.error(
    `ADAPTERS-ERR: el \`lint\` de package.json no nombra ningún guardián además de este arnés.\n` +
      `  Sin cadena que correr, cada mutación de abajo daría VERDE y la suite entera mentiría.`,
  );
  process.exit(1);
}
const ENTORNO = { ...process.env, PATH: `${ruta("node_modules/.bin")}:${process.env.PATH ?? ""}` };

const guardianes = () => {
  try {
    const salida = execSync(CADENA, {
      cwd: RAIZ,
      env: ENTORNO,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { verde: true, salida };
  } catch (e) {
    return { verde: false, salida: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

const ubicar = (buscar) => {
  // Si `ARCHIVOS` nombra un archivo que no está en disco —un rename a medio hacer—, el
  // `readFileSync` de abajo salía con un ENOENT CRUDO de node: un stack trace que habla
  // de `fs` y no de mutantes, así que el que lo lee no sabe si se rompió el arnés o el
  // contrato. Con la lista corrida, además, un mutante que no encuentra su texto es
  // indistinguible de uno podrido.
  const faltantes = ARCHIVOS.filter((a) => !existsSync(ruta(a)));
  if (faltantes.length > 0) {
    throw new Error(
      `ARCHIVOS nombra ${faltantes.length} archivo(s) que no están en disco: ${faltantes.join(", ")}\n` +
        `  ¿rename a medio hacer? Actualizá la lista: con ella corrida, este arnés no acredita nada.`,
    );
  }
  const encontrados = ARCHIVOS.filter((a) => readFileSync(ruta(a), "utf8").includes(buscar));
  if (encontrados.length !== 1) {
    throw new Error(
      `el texto a mutar aparece en ${encontrados.length} archivos (esperaba 1)` +
        `${encontrados.length ? ": " + encontrados.join(", ") : ""}\n  «${buscar.slice(0, 70).replace(/\n/g, "⏎")}»`,
    );
  }
  return encontrados[0];
};

const soloUno = (texto, buscar, id) => {
  const n = texto.split(buscar).length - 1;
  if (n !== 1) {
    throw new Error(
      `${id}: el texto a mutar aparece ${n} veces (esperaba 1). El mutante se pudrió con una ` +
        `edición anterior — arreglalo, no lo saltees: un mutante obsoleto es una garantía que ` +
        `dejó de verificarse.\n  «${buscar.slice(0, 70).replace(/\n/g, "⏎")}»`,
    );
  }
};

// ── Corrida ──────────────────────────────────────────────────────────────────
const soloEste = process.argv[2];
const lista = soloEste ? MUTANTES.filter((m) => m.id === soloEste) : MUTANTES;
if (soloEste && lista.length === 0) {
  console.error(`ADAPTERS-ERR: no existe el mutante «${soloEste}»`);
  process.exit(1);
}

// ── Exclusión mutua Y DIARIO DE DESHACER ─────────────────────────────────────
/**
 * UN SOLO ARCHIVO EN `tmpdir()` HACE DOS COSAS, y conviene no confundirlas:
 *
 *   (a) CANDADO — impide DOS corridas a la vez sobre el mismo árbol. Se pisan: la
 *       segunda captura como «original» un archivo que la primera ya mutó, y al
 *       restaurar deja la mutación puesta.
 *   (b) DIARIO DE DESHACER — el original de cada archivo se escribe ACÁ, EN DISCO, ANTES
 *       de mutarlo, y se borra de acá al restaurarlo. Es lo ÚNICO que sobrevive a un
 *       `SIGKILL`.
 *
 * POR QUÉ (b), MEDIDO DOS VECES EN DOS DÍAS. El mapa de originales vivía SOLO EN MEMORIA
 * y se volcaba desde el handler de `exit`, que cubre la salida normal, la excepción,
 * `SIGINT` y `SIGTERM` — y NO cubre `SIGKILL`, que POR DEFINICIÓN no ejecuta ningún
 * handler. `turbo` mata las tareas concurrentes cuando otra falla, y el disparador era el
 * `lint` de `design-tokens`, que nombraba un `eslint` que ese paquete no instala. Las dos
 * veces el mapa murió con el proceso: una dejó `src/markdown.ts` con `role: "heading"`
 * pegado, la otra ocho archivos de `packages/ir/src`. El candado sobrevivía y bloqueaba la
 * corrida siguiente con el mensaje correcto, pero SOLO DETECTABA: reparar quedaba para un
 * humano con el `git diff` en la mano. Con el diario, la corrida siguiente REPARA SOLA y
 * lo dice. El estado dejó de depender de que el proceso viva.
 *
 * ENCONTRAR EL CANDADO YA NO SIGNIFICA UNA SOLA COSA. Antes era «hay otra corrida». Ahora
 * es eso O «alguien murió y hay que reparar», y confundirlos es PEOR que el problema
 * original: un huérfano que bloquea para siempre, o dos corridas que se pisan creyendo
 * cada una que la otra murió. Se distinguen por si el PID que escribió el candado SIGUE
 * VIVO (`process.kill(pid, 0)`).
 *
 * EL LADO SEGURO DE LA DUDA ES «ESTÁ VIVO», y lo decide la ASIMETRÍA DEL ERROR, no la
 * probabilidad. `process.kill(pid, 0)` tira `ESRCH` cuando el proceso no existe y `EPERM`
 * cuando existe pero es de otro usuario; y en una máquina de mucho uptime un PID muerto
 * puede haberse REUSADO, así que ni siquiera «vivo» prueba que sea nuestra corrida. Por
 * eso SOLO `ESRCH` cuenta como muerto: `EPERM`, cualquier otro errno y un candado que no
 * parsea se tratan como corrida VIVA y el arnés se niega a arrancar. Un falso «está vivo»
 * cuesta una corrida que no arranca y un mensaje que dice exactamente qué mirar y qué
 * borrar — recuperable a mano. Un falso «está muerto» hace que dos corridas se pisen, o
 * que una repare encima de otra que está a mitad de mutar, que es EL defecto que el
 * candado existe para impedir.
 *
 * El candado vive en el directorio temporal del sistema y no adentro del paquete: un
 * archivo suelto en `scripts/` habría que ignorarlo en git, y un candado versionado por
 * accidente es peor que no tenerlo. La clave es la ruta del paquete, que es lo que
 * identifica al árbol que se está mutando.
 */
const CANDADO = join(tmpdir(), `savia-mutants-${Buffer.from(RAIZ).toString("base64url")}.lock`);
const PARCIAL = `${CANDADO}.${process.pid}.parcial`;

/** Sólo `ESRCH` prueba que no está. Todo lo demás cae del lado de «vivo» — ver arriba. */
const vivo = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code !== "ESRCH";
  }
};

const DIARIO = { pid: process.pid, desde: new Date().toISOString(), originales: {} };

/**
 * El diario se escribe ENTERO en un archivo aparte y se RENOMBRA encima. Un `SIGKILL` en
 * la mitad de un `writeFileSync` dejaría un diario truncado —el único estado del que YA NO
 * SE PUEDE reparar, porque no se sabe qué falta devolver—, y `rename` sobre el mismo
 * filesystem es atómico: el candado es siempre o el de antes o el de después.
 */
const volcar = () => {
  writeFileSync(PARCIAL, JSON.stringify(DIARIO), "utf8");
  renameSync(PARCIAL, CANDADO);
};

/**
 * Toma el candado, o devuelve el texto del que ya está. `wx` CREA-O-FALLA en UNA sola
 * llamada al sistema: con `existsSync` y después `writeFileSync` hay una ventana entre las
 * dos en la que dos corridas ven el candado libre y las dos lo escriben. Reintenta una vez
 * si el candado desaparece entre el `wx` y la lectura — eso es una corrida ajena que acaba
 * de terminar, no un huérfano.
 */
const tomar = () => {
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      writeFileSync(CANDADO, JSON.stringify(DIARIO), { encoding: "utf8", flag: "wx" });
      return null;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    try {
      return readFileSync(CANDADO, "utf8");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  return "";
};

{
  let previo = tomar();
  if (previo !== null) {
    let ajeno = null;
    try {
      const leído = JSON.parse(previo);
      if (leído !== null && typeof leído === "object" && Number.isInteger(leído.pid)) ajeno = leído;
    } catch {
      ajeno = null;
    }

    if (ajeno === null || vivo(ajeno.pid)) {
      console.error(
        `ADAPTERS-ERR: hay otro candado de mutantes en este árbol y NO se puede dar por muerto.\n` +
          `  candado: ${CANDADO}\n` +
          `  ${ajeno === null ? "no parsea: no dice de quién es ni qué habría que devolver" : `lo tiene el pid ${ajeno.pid}, y ese pid sigue vivo`}\n` +
          `  Este arnés muta el árbol EN EL LUGAR: dos corridas a la vez se pisan y dejan mutaciones\n` +
          `  pegadas. La duda cae del lado de «está vivo» a propósito: negarse a correr se arregla a\n` +
          `  mano, pisarse no. Si estás seguro de que no hay ninguna corriendo, mirá \`git diff\` y\n` +
          `  borrá el archivo.`,
      );
      process.exit(1);
    }

    // HUÉRFANO: el pid está muerto y lo que dejó anotado es exactamente lo que falta
    // devolver. Se restaura ANTES de tomar el candado, y el orden importa poco porque
    // reparar es IDEMPOTENTE: si esto se muere en la mitad, el diario sigue en disco y la
    // corrida siguiente vuelve a escribir los mismos bytes.
    const pendientes = Object.entries(ajeno.originales ?? {});
    for (const [archivo, texto] of pendientes) writeFileSync(ruta(archivo), texto, "utf8");
    rmSync(CANDADO, { force: true });
    previo = tomar();
    if (previo !== null) {
      console.error(
        `ADAPTERS-ERR: reparé el candado huérfano del pid ${ajeno.pid} y otra corrida se lo llevó\n` +
          `  antes que yo. No sigo: dos corridas a la vez se pisan.`,
      );
      process.exit(1);
    }
    console.error(
      pendientes.length === 0
        ? `ADAPTERS-AVISO: había un candado HUÉRFANO (pid ${ajeno.pid}, muerto) sin nada pendiente. Lo tomé y sigo.`
        : `ADAPTERS-AVISO: había un candado HUÉRFANO (pid ${ajeno.pid}, muerto) con ${pendientes.length} archivo(s) sin restaurar.\n` +
            `  Los devolví antes de arrancar — la corrida anterior murió sin poder hacerlo, que es para lo\n` +
            `  que el original va al candado ANTES de mutar:\n` +
            pendientes.map(([a]) => `    ${a}`).join("\n"),
    );
  }
}

const soltar = () => {
  rmSync(CANDADO, { force: true });
  rmSync(PARCIAL, { force: true });
};

/**
 * LO QUE HAY QUE DEVOLVER SI EL PROCESO MUERE, en los DOS lugares donde vive.
 *
 * `ORIGINALES` es el mapa en memoria y `DIARIO.originales` su copia en disco: las dos se
 * escriben en `apuntar()` —ANTES de mutar— y las dos se vacían en `restaurar()`. El
 * handler de `exit` cubre lo que el `finally` de la vuelta NO cubre (la señal), y node lo
 * corre también en el camino de `process.exit()`; es síncrono, igual que `writeFileSync`.
 * El diario cubre lo que NINGÚN handler cubre: `SIGKILL`.
 *
 * EL ORDEN DE `restaurar()` NO ES CASUAL: primero los archivos, DESPUÉS el diario. Si se
 * muere en el medio, el diario todavía nombra archivos que ya volvieron y la corrida
 * siguiente les escribe los mismos bytes, que es inofensivo. Al revés, la ventana dejaría
 * archivos mutados que ya nadie sabe deshacer.
 */
const ORIGINALES = new Map();
const apuntar = (archivo, texto) => {
  if (ORIGINALES.has(archivo)) return;
  ORIGINALES.set(archivo, texto);
  DIARIO.originales[archivo] = texto;
  volcar();
};
const restaurar = () => {
  if (ORIGINALES.size === 0) return;
  for (const [archivo, texto] of ORIGINALES) writeFileSync(ruta(archivo), texto, "utf8");
  ORIGINALES.clear();
  DIARIO.originales = {};
  volcar();
};
process.on("exit", () => {
  restaurar();
  soltar();
});
for (const señal of ["SIGINT", "SIGTERM"]) process.on(señal, () => process.exit(1));

const base = guardianes();
if (!base.verde) {
  console.error(
    `ADAPTERS-ERR: el árbol NO está verde antes de mutar. Nada de lo que sigue significaría nada.\n` +
      base.salida.split("\n").slice(0, 12).map((l) => "  " + l).join("\n"),
  );
  process.exit(1);
}

let fallos = 0;
for (const m of lista) {
  try {
    for (const [buscar, reemplazar] of m.cambios) {
      const archivo = m.archivo ?? ubicar(buscar);
      const antes = readFileSync(ruta(archivo), "utf8");
      soloUno(antes, buscar, m.id);
      apuntar(archivo, antes);
      writeFileSync(ruta(archivo), antes.replace(buscar, reemplazar), "utf8");
    }

    const r = guardianes();
    let ok, detalle;
    if (m.control) {
      ok = r.verde;
      detalle = ok ? "verde, como corresponde" : "ROMPIÓ — el arnés o el compilador están mal";
    } else if (r.verde) {
      ok = false;
      detalle = "NO ROMPIÓ — la garantía se perdió";
    } else if (!m.espera.test(r.salida)) {
      ok = false;
      detalle = `rompió, pero no por la razón esperada (${m.espera})`;
    } else {
      ok = true;
      detalle = "rompió como corresponde";
    }

    console.log(`  ${ok ? "✓" : "✗"} ${m.id.padEnd(6)} ${m.garantía}`);
    if (!ok) {
      fallos++;
      console.log(`         ${detalle}`);
      if (m.rompe) console.log(`         rompe: ${m.rompe}`);
      if (m.nota) console.log(`         nota: ${m.nota}`);
      console.log(r.salida.split("\n").filter(Boolean).slice(0, 6).map((l) => "         │ " + l).join("\n"));
    }
  } catch (e) {
    fallos++;
    console.log(`  ✗ ${m.id.padEnd(6)} ${m.garantía}\n         ${e.message}`);
  } finally {
    // Pase lo que pase, el árbol vuelve. Sin esto un crash deja el repo mutado — y el
    // handler de `exit` de arriba cubre el caso que este `finally` NO cubre: la señal.
    restaurar();
  }
}

const cierre = guardianes();
if (!cierre.verde) {
  console.error(`\nADAPTERS-ERR: el árbol quedó ROTO después de restaurar. Revisá con git diff.`);
  process.exit(1);
}

const rompen = lista.filter((m) => !m.control).length;
console.log(
  fallos === 0
    ? `\nmutantes ok (${rompen} garantías acreditadas rompiéndolas, ${lista.length - rompen} controles verdes)`
    : `\nADAPTERS-ERR: ${fallos} de ${lista.length} mutantes fallaron`,
);
process.exit(fallos === 0 ? 0 : 1);
