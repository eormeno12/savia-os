"use client";

import { FormatNumber, Stat } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface MetricStatProps extends Stat.RootProps {
  /** Small caption above the number. */
  label?: ReactNode;
  /** The headline number (formatted with Intl). */
  value: number;
  /** Intl.NumberFormat options (e.g. `{ notation: "compact" }`). */
  formatOptions?: Intl.NumberFormatOptions;
  /** Secondary line under the number (e.g. "+12 esta semana"). */
  help?: ReactNode;
}

/**
 * A headline metric: big number (textStyle `metric`) with an optional caption
 * and helper line. Used in the Memoria hero (total memories) and Pulso growth.
 */
export function MetricStat({
  label,
  value,
  formatOptions,
  help,
  ...rest
}: MetricStatProps) {
  return (
    <Stat.Root {...rest}>
      {label != null && <Stat.Label>{label}</Stat.Label>}
      <Stat.ValueText textStyle="metric">
        <FormatNumber value={value} {...formatOptions} />
      </Stat.ValueText>
      {help != null && <Stat.HelpText>{help}</Stat.HelpText>}
    </Stat.Root>
  );
}
