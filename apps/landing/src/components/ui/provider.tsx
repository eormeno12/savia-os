"use client";

import type { ReactNode } from "react";
import { marketingSystem } from "@savia-os/design-tokens";
import { SaviaProvider } from "@savia-os/ui";

export function Provider({ children }: { children: ReactNode }) {
  return <SaviaProvider system={marketingSystem}>{children}</SaviaProvider>;
}
