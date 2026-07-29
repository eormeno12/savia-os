"use client";

import { Box, Steps } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface StepperItem {
  title?: string;
  description?: ReactNode;
}

export interface StepperProps extends Omit<Steps.RootProps, "count"> {
  /** The steps to render; `count` is derived from this. */
  items: StepperItem[];
}

/**
 * Progress indicator for multi-step flows (login journey, onboarding, the
 * collective convert wizard). Renders only the step rail; the consumer renders
 * the per-step content. Control with `step`/`onStepChange` or `defaultStep`.
 */
export function Stepper({ items, ...rest }: StepperProps) {
  return (
    <Steps.Root count={items.length} {...rest}>
      <Steps.List>
        {items.map((item, index) => (
          <Steps.Item key={index} index={index} title={item.title}>
            <Steps.Indicator />
            {(item.title || item.description) && (
              <Box>
                {item.title && <Steps.Title>{item.title}</Steps.Title>}
                {item.description && (
                  <Steps.Description>{item.description}</Steps.Description>
                )}
              </Box>
            )}
            <Steps.Separator />
          </Steps.Item>
        ))}
      </Steps.List>
    </Steps.Root>
  );
}
