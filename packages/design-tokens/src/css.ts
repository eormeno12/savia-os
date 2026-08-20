/**
 * EL EMISOR DE CSS. Datos → texto, y **sin importar nada**: vive en `src/` y no en
 * `scripts/` justamente para caer bajo el guardián de fronteras, porque es el consumidor
 * cuya independencia de Chakra hay que sostener.
 *
 * La división es la misma de todo el repo: acá la transformación pura, y el I/O afuera
 * (`scripts/emitir.mjs`). Esta función no sabe qué es un archivo.
 */

/**
 * SINGULAR, PORQUE UNA VARIABLE NOMBRA UN VALOR Y NO UNA COLECCIÓN. `--savia-colors-ink`
 * se lee mal; `--savia-color-ink` se lee como lo que es. El mapa es explícito y no una
 * regla de despluralización: `radii → radius` no sale de ninguna regla mecánica, y una
 * categoría nueva tiene que pasar por acá para que nadie invente su nombre en el momento.
 */
const SINGULAR: Record<string, string> = {
  colors: "color",
  fonts: "font",
  fontSizes: "font-size",
  radii: "radius",
  shadows: "shadow",
  spacing: "spacing",
  sizes: "size",
  easings: "easing",
  durations: "duration",
};

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * EL PREFIJO ES `--savia-` Y NO `--chakra-`, y no es cosmético: el webview del agente no
 * tiene Chakra adentro, así que un nombre que dijera `chakra` sería falso sobre lo único
 * que la variable garantiza. Que los dos consumidores nombren distinto el mismo valor es
 * correcto — son dos consumidores del mismo contrato, no dos copias de una fuente.
 */
const nombreDeVariable = (categoria: string, ruta: readonly string[]) =>
  `--savia-${[SINGULAR[categoria] ?? kebab(categoria), ...ruta.map(kebab)].join("-")}`;

type Hoja = { readonly ruta: readonly string[]; readonly valor: string };

/**
 * `DEFAULT` SE APLANA: `bg.DEFAULT` es `bg`. Es la sintaxis de «el token base del grupo»,
 * y sin aplanarla el agente tendría un `--savia-color-bg-default` que ningún otro
 * consumidor nombra así.
 */
function hojas(arbol: unknown, prefijo: readonly string[] = []): Hoja[] {
  if (!arbol || typeof arbol !== "object") return [];
  const salida: Hoja[] = [];
  for (const [clave, valor] of Object.entries(arbol as Record<string, unknown>)) {
    const ruta = [...prefijo, clave];
    if (valor && typeof valor === "object" && "value" in (valor as object)) {
      salida.push({
        ruta: ruta.filter((k) => k !== "DEFAULT"),
        valor: String((valor as { value: unknown }).value),
      });
      continue;
    }
    salida.push(...hojas(valor, ruta));
  }
  return salida;
}

/**
 * LAS REFERENCIAS QUEDAN COMO `var()`, NO RESUELTAS AL LITERAL, y ahí está toda la
 * diferencia entre emitir una paleta y emitir un sistema: con `var()`, mover
 * `--savia-color-paper` mueve todo lo que depende de él. Resolver al literal aplanaría la
 * estructura y con ella la posibilidad de un tema.
 *
 * Una referencia a un token que no existe **no se detecta acá**: sale como `var(--x)` y el
 * navegador la deja vacía. La detecta `verificarReferencias`, que es lo que impide que un
 * panel quede sin fondo por un `{colors.white}` que nadie definió.
 */
const resolver = (valor: string) =>
  valor.replace(
    /\{([a-zA-Z]+)\.([a-zA-Z0-9_.]+)\}/g,
    (_, categoria: string, ruta: string) =>
      `var(${nombreDeVariable(categoria, ruta.split("."))})`,
  );

/** Toda referencia que no apunte a una variable emitida. Vacío = todas resuelven. */
export function verificarReferencias(
  tokens: unknown,
  semanticTokens: unknown,
): { desde: string; a: string }[] {
  const emitidas = new Set<string>();
  for (const fuente of [tokens, semanticTokens]) {
    for (const [categoria, arbol] of Object.entries(fuente as Record<string, unknown>)) {
      for (const h of hojas(arbol)) emitidas.add(nombreDeVariable(categoria, h.ruta));
    }
  }
  const colgantes: { desde: string; a: string }[] = [];
  for (const fuente of [tokens, semanticTokens]) {
    for (const [categoria, arbol] of Object.entries(fuente as Record<string, unknown>)) {
      for (const h of hojas(arbol)) {
        for (const m of h.valor.matchAll(/\{([a-zA-Z]+)\.([a-zA-Z0-9_.]+)\}/g)) {
          const destino = nombreDeVariable(m[1], m[2].split("."));
          if (!emitidas.has(destino)) {
            colgantes.push({ desde: nombreDeVariable(categoria, h.ruta), a: destino });
          }
        }
      }
    }
  }
  return colgantes;
}

/**
 * El bloque `:root` entero. **El orden es el de declaración, no alfabético**: los archivos
 * de tokens están agrupados por sentido —la marca, después los estados, después la escala
 * de espacios— y ordenar alfabéticamente rompería esa lectura sin comprar nada, porque un
 * `:root` no depende del orden para resolver.
 */
export function aCss(tokens: unknown, semanticTokens: unknown): string {
  const bloque = (fuente: unknown, titulo: string) => {
    const lineas: string[] = [`  /* ${titulo} */`];
    for (const [categoria, arbol] of Object.entries(fuente as Record<string, unknown>)) {
      for (const h of hojas(arbol)) {
        lineas.push(`  ${nombreDeVariable(categoria, h.ruta)}: ${resolver(h.valor)};`);
      }
    }
    return lineas.join("\n");
  };
  return [
    "/* GENERADO por packages/design-tokens/scripts/emitir.mjs — no se edita a mano.",
    " *",
    " * Los valores de Savia sin una linea de JavaScript. Lo consume el webview del agente",
    " * de carpeta, que no tiene Chakra: por eso el prefijo dice `savia` y no `chakra`.",
    " */",
    ":root {",
    bloque(tokens, "crudos"),
    "",
    bloque(semanticTokens, "semanticos"),
    "}",
    "",
  ].join("\n");
}
