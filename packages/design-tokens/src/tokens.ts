/**
 * LOS VALORES, Y SON DATOS. Cero imports: este archivo no sabe que existe Chakra.
 *
 * Es la misma forma que `packages/ir` en el pipeline —el contrato se congela primero, sin
 * dependencias de runtime, y los consumidores lo implementan—. Acá los consumidores son
 * dos: el adaptador de Chakra (`index.ts`, que alimenta a `apps/landing`) y el emisor de
 * CSS que consume el agente de carpeta. **Ninguno de los dos es la fuente.**
 *
 * El formato —`{ value }` y las referencias `{colors.x}`— es la convencion de W3C Design
 * Tokens, NO una invencion de Chakra: Chakra la adopto. Por eso mudarse le costo a este
 * archivo exactamente un import.
 */
export const tokens = {
  colors: {
    // SAVIA brand palette — raw values, no alpha variants needed.
    // Use CSS color-mix or inline opacity (e.g. bg="ink/8") for transparency.
    ink: { value: "#0B2529" },
    softInk: { value: "#152F34" },
    paper: { value: "#F4F4F1" },
    signalLime: { value: "#E7FF18" },
    signalLimeSoft: { value: "#F1FF67" },
    mist: { value: "#ECEDEA" },
    line: { value: "#DDDFDC" },
    slateText: { value: "#53606C" },

    // State colors — calm and brand-aligned, never Chakra's defaults.
    // `*Ink` variants are the readable foreground/solid tone on paper;
    // the base is the accent fill used for subtle backgrounds.
    successInk: { value: "#2F7048" },
    success: { value: "#3E8E5A" },
    warningInk: { value: "#8A5A12" },
    warning: { value: "#C9852A" },
    dangerInk: { value: "#B23529" },
    danger: { value: "#D6483B" },
    dangerSoft: { value: "#F2A99E" }, // readable red on ink surfaces
    infoInk: { value: "#1C4A57" },
    info: { value: "#2E6B7A" },

    // Space scale — a single tonal family (ink → teal → lime) used to color
    // each space deterministically. NOT a rainbow: every step belongs to the
    // brand. `space-colors.ts` maps each space to a step + its readable ink.
    spaceScale: {
      1: { value: "#0B2529" },
      2: { value: "#163F40" },
      3: { value: "#1F5A53" },
      4: { value: "#2C7560" },
      5: { value: "#357A4C" },
      6: { value: "#74A93F" },
      7: { value: "#A8C72B" },
      8: { value: "#E7FF18" },
    },

    /**
     * DEFINIDO ACA Y NO HEREDADO, y es lo unico que la mudanza tuvo que desenredar.
     * `semantic-tokens.ts` referencia `{colors.white}` y ese token no era nuestro: salia
     * del `defaultConfig` de Chakra. Mientras Chakra fuera la fuente eso era invisible;
     * ahora que la fuente es este archivo, una referencia a algo que no esta acá es una
     * variable CSS colgante del lado del agente — y un panel sin fondo.
     */
    white: { value: "#FFFFFF" },
  },

  // EL FALLBACK VA ADENTRO DEL `var()`, y no es cosmetico. `--font-inter` lo define
  // `next/font` y **solo existe en las apps de Next**: en cualquier otro consumidor
  // —la bandeja del agente, un `.html` suelto, un correo— `var(--font-inter)` es
  // invalido al calcular el valor, y eso no cae al siguiente item de la lista: anula
  // la DECLARACION ENTERA. El resultado no es "system-ui", es la serif por omision del
  // navegador. Escrito como `var(--font-inter, system-ui)` la sustitucion siempre
  // resuelve, y en Next no cambia nada porque ahi la variable si esta definida.
  fonts: {
    heading: { value: "var(--font-inter, system-ui), system-ui, sans-serif" },
    body: { value: "var(--font-inter, system-ui), system-ui, sans-serif" },
  },

  // Fluid display scale — fills the gap above Chakra's 6xl (3.75rem).
  // Chakra already handles xs → 7xl; only add what doesn't exist.
  fontSizes: {
    displayXl: { value: "clamp(40px, 4.8vw, 80px)" },
    display2xl: { value: "clamp(2.35rem, 5vw, 5rem)" },
    display3xl: { value: "clamp(2.75rem, 6vw, 6rem)" },
    display4xl: { value: "clamp(4.3rem, 10vw, 7.4rem)" },
    displayLg: { value: "clamp(36px, 4vw, 64px)" },
    displayMd: { value: "clamp(2rem, 3.4vw, 3.35rem)" },
    titleLg: { value: "clamp(20px, 1.6vw, 32px)" },
    bodyLg: { value: "clamp(16px, 1.1vw, 20px)" },
  },

  // SAVIA-specific semantic radii.
  // Chakra already covers: none, sm(4px), md(6px), lg(8px), xl(12px),
  // 2xl(16px), 3xl(24px), full(9999px). Only add what's genuinely missing.
  radii: {
    /** La otra heredada. Ver `colors.white`: misma razon, mismo valor que traia Chakra. */
    sm: { value: "0.25rem" },
    card: { value: "28px" },
    panel: { value: "40px" },
    message: { value: "22px" },
    chip: { value: "16px" },
  },

  // SAVIA depth vocabulary — supplements Chakra's xs/sm/md/lg/xl/2xl shadows.
  shadows: {
    soft: { value: "0 18px 70px rgb(11 37 41 / 0.08)" },
    float: { value: "0 34px 110px rgb(11 37 41 / 0.14)" },
    // Depth on dark (ink) surfaces — the product's deliberate dark accents.
    floatDark: { value: "0 30px 90px rgb(0 0 0 / 0.45)" },
    inset: { value: "inset 0 1px 0 rgb(255 255 255 / 0.72)" },
    controlKnob: { value: "0 1px 4px rgb(11 37 41 / 0.16)" },
  },

  // Fluid section + stack rhythm — not in Chakra's 0–96 spacing scale.
  spacing: {
    sectionY: { value: "clamp(5rem, 8vw, 9rem)" },
    sectionYTight: { value: "clamp(3.5rem, 6vw, 6.5rem)" },
    sectionYLoose: { value: "clamp(6.5rem, 10vw, 11rem)" },
    stackXs: { value: "clamp(8px, 1vw, 16px)" },
    stackSm: { value: "clamp(16px, 1.5vw, 24px)" },
    stackMd: { value: "clamp(24px, 2vw, 32px)" },
    stackLg: { value: "clamp(32px, 3vw, 48px)" },
    stackXl: { value: "clamp(48px, 5vw, 80px)" },
    gridGap: { value: "clamp(16px, 2vw, 24px)" },
    surfacePadding: { value: "clamp(24px, 2vw, 32px)" },
  },

  // Fluid container widths with viewport-responsive side margins.
  sizes: {
    container: {
      value: "min(calc(100% - clamp(2.5rem, 10vw, 12rem)), 78rem)",
    },
    containerWide: {
      value: "min(calc(100% - clamp(2.5rem, 10vw, 12rem)), 108rem)",
    },
    containerNarrow: {
      value: "min(calc(100% - clamp(2.5rem, 10vw, 12rem)), 62rem)",
    },
  },

  easings: {
    savia: { value: "cubic-bezier(0.22, 1, 0.36, 1)" },
  },

  durations: {
    fast: { value: "160ms" },
    soft: { value: "260ms" },
    slow: { value: "700ms" },
  },
} as const;
