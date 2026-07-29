import { defineTextStyles } from "@chakra-ui/react";

export const textStyles = defineTextStyles({
  displayXl: {
    value: {
      fontSize: "{fontSizes.displayXl}",
      lineHeight: "0.92",
      letterSpacing: "0",
      fontWeight: "300",
    },
  },
  display2xl: {
    value: {
      fontSize: "{fontSizes.display2xl}",
      lineHeight: "0.88",
      letterSpacing: "0",
      fontWeight: "300",
    },
  },
  display3xl: {
    value: {
      fontSize: "{fontSizes.display3xl}",
      lineHeight: "0.92",
      letterSpacing: "0",
      fontWeight: "300",
    },
  },
  displayMd: {
    value: {
      fontSize: "{fontSizes.displayMd}",
      lineHeight: "1.02",
      letterSpacing: "0",
      fontWeight: "600",
    },
  },
  titleLg: {
    value: {
      fontSize: "{fontSizes.titleLg}",
      lineHeight: "1.1",
      letterSpacing: "0",
      fontWeight: "600",
    },
  },
  bodyLg: {
    value: {
      fontSize: "{fontSizes.bodyLg}",
      lineHeight: "1.75",
      letterSpacing: "0",
      fontWeight: "400",
    },
  },
  label: {
    value: {
      fontSize: "12px",
      lineHeight: "1",
      letterSpacing: "0.12em",
      fontWeight: "600",
      textTransform: "uppercase",
    },
  },

  // Product scale — the mid range a product UI uses constantly. Surfaces must
  // use these instead of loose fontSize + fontWeight pairs.
  pageTitle: {
    value: {
      fontSize: "{fontSizes.displayMd}",
      lineHeight: "1.02",
      letterSpacing: "-0.01em",
      fontWeight: "600",
    },
  },
  cardTitle: {
    value: {
      fontSize: "lg",
      lineHeight: "1.2",
      letterSpacing: "-0.01em",
      fontWeight: "600",
    },
  },
  metric: {
    value: {
      fontSize: "3xl",
      lineHeight: "1",
      letterSpacing: "-0.02em",
      fontWeight: "700",
      fontVariantNumeric: "tabular-nums",
    },
  },
  // Editorial hero numbers (mockup: "1.248" at 58px / "247" at 88px) — light
  // weight, tight leading, tabular so deltas don't jiggle as data updates.
  heroNumber: {
    value: {
      fontSize: "{fontSizes.displayLg}",
      lineHeight: "0.9",
      letterSpacing: "-0.01em",
      fontWeight: "300",
      fontVariantNumeric: "tabular-nums",
    },
  },
  heroNumberXl: {
    value: {
      fontSize: "{fontSizes.display3xl}",
      lineHeight: "0.9",
      letterSpacing: "-0.01em",
      fontWeight: "300",
      fontVariantNumeric: "tabular-nums",
    },
  },
  caption: {
    value: {
      fontSize: "sm",
      lineHeight: "1.5",
      letterSpacing: "0",
      fontWeight: "400",
    },
  },
});
