import type { ReactNode } from "react";
import { Box, HStack, Stack, Text } from "@chakra-ui/react";

interface PageHeaderProps {
  /** Uppercase eyebrow above the title. */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Primary action, aligned to the right of the title row. */
  action?: ReactNode;
}

/**
 * The one page header across the product: eyebrow + title + optional action,
 * with a consistent description slot. Replaces the ad-hoc title HStacks.
 */
export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <Stack gap="2" mb="2">
      <HStack justify="space-between" align="flex-start" gap="4">
        <Stack gap="1.5">
          {eyebrow ? (
            <Text textStyle="label" color="fg.muted">
              {eyebrow}
            </Text>
          ) : null}
          <Text as="h1" textStyle="pageTitle">
            {title}
          </Text>
        </Stack>
        {action ? <Box flexShrink="0">{action}</Box> : null}
      </HStack>
      {description ? (
        <Text color="fg.muted" textWrap="pretty" maxW="2xl">
          {description}
        </Text>
      ) : null}
    </Stack>
  );
}
