"use client";

import type { ReactNode } from "react";
import { ChakraProvider, type SystemContext } from "@chakra-ui/react";
import { system } from "@savia-os/design-tokens";
import { Toaster } from "./molecules/toaster";

export interface SaviaProviderProps {
  children: ReactNode;
  /**
   * Which Chakra system this surface renders under — defaults to the shared
   * product system. Pass `marketingSystem` from `@savia-os/design-tokens`
   * for surfaces whose buttons are always CTAs (e.g. the landing app), so
   * the pill/semibold treatment is a property of the surface, not a prop
   * each call site has to remember.
   */
  system?: SystemContext;
}

/**
 * Base Chakra provider wired to a Savia design system. Every app wraps its
 * tree with this so the brand is configured in exactly one place. The global
 * Toaster mounts here, so `notify.*` works anywhere without per-app setup.
 */
export function SaviaProvider({ children, system: systemProp }: SaviaProviderProps) {
  return (
    <ChakraProvider value={systemProp ?? system}>
      {children}
      <Toaster />
    </ChakraProvider>
  );
}
