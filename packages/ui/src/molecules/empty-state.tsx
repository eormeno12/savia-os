"use client";

import type { ReactNode } from "react";
import { VStack, Text, Box } from "@chakra-ui/react";

export interface EmptyStateProps {
  /** Icon or brand mark — rendered muted above the title. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Primary call to action (e.g. a Button or Link). */
  action?: ReactNode;
}

/**
 * The one empty-state look across the product — replaces the five different
 * dashed-card / plain-text placeholders that exist today.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <VStack
      gap="4"
      textAlign="center"
      py="12"
      px="6"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border"
      borderRadius="card"
      bg="bg.subtle/40"
    >
      {icon ? (
        <Box color="fg.subtle" aria-hidden>
          {icon}
        </Box>
      ) : null}
      <VStack gap="1.5">
        <Text textStyle="cardTitle">{title}</Text>
        {description ? (
          <Text color="fg.muted" maxW="sm" textWrap="pretty">
            {description}
          </Text>
        ) : null}
      </VStack>
      {action ? <Box pt="1">{action}</Box> : null}
    </VStack>
  );
}
