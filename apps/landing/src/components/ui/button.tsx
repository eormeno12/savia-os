"use client";

import { Button as ChakraButton, type ButtonProps } from "@chakra-ui/react";

// Savia defaults layered on top of Chakra's Button.
// colorPalette drives the color — define "lime" | "ink" | "mist" in semantic-tokens.ts.
// variant is Chakra's display mode — "solid" | "outline" | "ghost" | "subtle" | "surface" | "plain".
// All Chakra features (loading state, ARIA, focus management) are preserved via the wrapper.

type SaviaButtonProps = ButtonProps & {
  colorPalette?: "lime" | "ink" | "mist";
};

export function Button({
  colorPalette = "lime",
  variant = "solid",
  borderRadius = "full",
  fontWeight = "semibold",
  ...props
}: SaviaButtonProps) {
  return (
    <ChakraButton
      colorPalette={colorPalette}
      variant={variant}
      borderRadius={borderRadius}
      fontWeight={fontWeight}
      {...props}
    />
  );
}

// Renders as an anchor element using Ark UI's asChild pattern.
// The <a> inherits all Chakra Button styles and behaviors.
type LinkButtonProps = SaviaButtonProps & { href: string };

export function LinkButton({
  colorPalette = "lime",
  variant = "solid",
  borderRadius = "full",
  fontWeight = "semibold",
  href,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <ChakraButton
      colorPalette={colorPalette}
      variant={variant}
      borderRadius={borderRadius}
      fontWeight={fontWeight}
      asChild
      {...props}
    >
      <a href={href}>{children}</a>
    </ChakraButton>
  );
}
