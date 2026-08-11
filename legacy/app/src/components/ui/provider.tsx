"use client";

import type { ReactNode } from "react";
import { SaviaProvider } from "@savia-os/ui";

export function Provider({ children }: { children: ReactNode }) {
  return <SaviaProvider>{children}</SaviaProvider>;
}
