"use client";

import { Button as ChakraButton, type ButtonProps } from "@chakra-ui/react";

/**
 * Pure pass-through over Chakra's Button — no brand defaults baked in here.
 * Shape (pill vs. the shared control-radius family) and weight come from
 * which Chakra system wraps the tree (see `SaviaProvider`'s `system` prop),
 * not from this component, so a surface's button language can't drift
 * call-site by call-site.
 */
export function Button(props: ButtonProps) {
  return <ChakraButton {...props} />;
}

export type LinkButtonProps = ButtonProps & { href: string };

/** Same button, rendered as an anchor via Ark UI's `asChild` pattern. */
export function LinkButton({ href, children, ...props }: LinkButtonProps) {
  return (
    <ChakraButton asChild {...props}>
      <a href={href}>{children}</a>
    </ChakraButton>
  );
}
