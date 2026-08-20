/**
 * EL ADAPTADOR DE CHAKRA. **Chakra es un consumidor de los tokens, no su fuente.**
 *
 * Antes la fuente era este lado: los valores vivian bajo `defineTokens` y salian de acá
 * hacia todos lados. La consecuencia era que una actualizacion de Chakra podia mover un
 * color de Savia sin que nadie lo pidiera. Ahora los valores son datos en `tokens.ts` y
 * `semantic-tokens.ts` —cero imports— y este archivo los envuelve en la forma que Chakra
 * espera, exactamente igual que el emisor de CSS los envuelve en la que espera el agente.
 *
 * Lo que SI se queda de este lado son las `recipes` y los `textStyles`: son estilos de
 * componente, no valores, y el agente no los usa. Ver el borrador del agente de carpeta,
 * «Que se reusa del sistema de diseño, y que no».
 */
import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineSemanticTokens,
  defineTokens,
} from "@chakra-ui/react";
import { semanticTokens as datosSemanticos, tokens as datosCrudos } from "./data";

// `defineTokens` y `defineSemanticTokens` son IDENTIDAD: no transforman nada, solo
// aportan el tipo. Por eso envolver acá no puede cambiar un valor — y el golden lo
// verifica en vez de dejarlo como promesa.
const tokens = defineTokens(datosCrudos);
const semanticTokens = defineSemanticTokens(datosSemanticos);
import { textStyles } from "./text-styles";
import { cardRecipe } from "./recipes/card";
import { inputRecipe } from "./recipes/input";
import { marketingButtonRecipe } from "./recipes/button";

const config = defineConfig({
  globalCss: {
    "html, body": {
      minWidth: "320px",
    },
    html: {
      scrollBehavior: "smooth",
      overflowX: "hidden",
    },
    body: {
      bg: "bg",
      color: "fg",
      fontFamily: "body",
      textRendering: "geometricPrecision",
    },
    "::selection": {
      background: "rgb(11 37 41 / 0.14)",
    },
    ".skip-link": {
      position: "fixed",
      left: "-9999px",
      top: "1rem",
      zIndex: 9999,
      background: "#0B2529",
      color: "#F4F4F1",
      padding: "0.5rem 1rem",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      fontWeight: "600",
      textDecoration: "none",
      "&:focus-visible": {
        left: "1rem",
        outline: "2px solid #E7FF18",
        outlineOffset: "4px",
      },
    },
  },
  theme: {
    tokens,
    semanticTokens,
    textStyles,
    recipes: {
      card: cardRecipe,
      input: inputRecipe,
    },
  },
});

export const system = createSystem(defaultConfig, config);

/**
 * Marketing-surface system — same tokens/recipes as `system`, plus the
 * button overlay (pill + semibold) that makes every CTA on the landing
 * surface consistent by construction. Used only by apps/landing's provider;
 * apps/app renders under the plain `system` above.
 */
const marketingConfig = defineConfig({
  theme: {
    recipes: {
      button: marketingButtonRecipe,
    },
  },
});

export const marketingSystem = createSystem(defaultConfig, config, marketingConfig);

// Barrel: expose the raw token sources so consumers (preview generators,
// design tooling) can read them without re-importing each file.
export { tokens } from "./tokens";
export { semanticTokens } from "./semantic-tokens";
export { textStyles } from "./text-styles";
export { cardRecipe } from "./recipes/card";
