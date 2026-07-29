"use client";

import type { ReactNode } from "react";
import { Field as CkField } from "@chakra-ui/react";

export interface FieldProps {
  label?: ReactNode;
  /** When set, the field renders in its invalid state and shows this message. */
  error?: string;
  helperText?: ReactNode;
  required?: boolean;
  children: ReactNode;
}

/**
 * Labeled form field — wires label, error and helper text to the control with
 * the right ARIA wiring (Chakra's Field handles `aria-describedby` /
 * `aria-invalid`). Replaces bare inputs with placeholder-only labels.
 */
export function Field({
  label,
  error,
  helperText,
  required = false,
  children,
}: FieldProps) {
  return (
    <CkField.Root invalid={Boolean(error)} required={required}>
      {label ? (
        <CkField.Label>
          {label}
          {required ? <CkField.RequiredIndicator /> : null}
        </CkField.Label>
      ) : null}
      {children}
      {helperText && !error ? (
        <CkField.HelperText>{helperText}</CkField.HelperText>
      ) : null}
      {error ? <CkField.ErrorText>{error}</CkField.ErrorText> : null}
    </CkField.Root>
  );
}
