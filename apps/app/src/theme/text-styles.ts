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
});
