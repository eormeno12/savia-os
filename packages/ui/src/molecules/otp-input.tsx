"use client";

import { PinInput as ChakraPinInput } from "@chakra-ui/react";
import { forwardRef } from "react";

export interface OtpInputProps extends ChakraPinInput.RootProps {
  /** Number of cells. Defaults to 6 (Savia's OTP length). */
  count?: number;
}

/**
 * One-time-code input: N separate cells with autofill + paste, built on Chakra's
 * PinInput. Defaults to 6 numeric `otp` cells. Pass `value`/`onValueChange` to
 * control it (the value is a string[] of single chars).
 */
export const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(
  function OtpInput({ count = 6, otp = true, ...rest }, ref) {
    return (
      <ChakraPinInput.Root otp={otp} {...rest}>
        <ChakraPinInput.HiddenInput ref={ref} />
        <ChakraPinInput.Control>
          {Array.from({ length: count }).map((_, index) => (
            <ChakraPinInput.Input key={index} index={index} />
          ))}
        </ChakraPinInput.Control>
      </ChakraPinInput.Root>
    );
  },
);
