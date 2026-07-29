import type { ReactNode } from "react";
import { Box, HStack, Stack, Text } from "@chakra-ui/react";

interface PageHeroProps {
  eyebrow?: string;
  /** Title. Wrap an emphasis word in <HeroEm> to make it glow lime. */
  title: ReactNode;
  description?: ReactNode;
  /** Optional headline metric shown large on the right. */
  metric?: { value: ReactNode; label: ReactNode };
  /** Primary action — use a lime button here; it glows on the dark panel. */
  action?: ReactNode;
}

/** Lime emphasis span for hero titles — glows on the dark panel. */
export function HeroEm({ children }: { children: ReactNode }) {
  return (
    <Box as="span" color="signalLime">
      {children}
    </Box>
  );
}

/**
 * The signature dramatic element of every screen: a dark ink panel with display
 * typography where the lime accent finally glows. Light work content sits below
 * it. This is where the brand lives inside the product.
 */
export function PageHero({ eyebrow, title, description, metric, action }: PageHeroProps) {
  return (
    <Box
      position="relative"
      overflow="hidden"
      bg="bg.inverse"
      color="fg.inverse"
      borderRadius="panel"
      boxShadow="floatDark"
      px={{ base: 6, md: 10 }}
      py={{ base: 8, md: 10 }}
    >
      {/* Atmospheric lime glow — only readable on the dark surface. */}
      <Box
        position="absolute"
        top="-40%"
        insetEnd="-10%"
        w="420px"
        h="420px"
        borderRadius="full"
        bg="signalLime"
        opacity={0.1}
        filter="blur(90px)"
        pointerEvents="none"
        aria-hidden
      />
      <HStack
        position="relative"
        justify="space-between"
        align={{ base: "flex-start", md: "flex-end" }}
        gap="8"
        flexDir={{ base: "column", md: "row" }}
      >
        <Stack gap="3" maxW="2xl">
          {eyebrow ? (
            <Text textStyle="label" color="signalLime">
              {eyebrow}
            </Text>
          ) : null}
          <Text
            as="h1"
            fontSize={{ base: "display2xl", md: "displayMd" }}
            fontWeight="300"
            lineHeight="1.0"
            letterSpacing="-0.01em"
            textWrap="balance"
          >
            {title}
          </Text>
          {description ? (
            <Text color="fg.inverse/70" fontSize="md" maxW="lg" textWrap="pretty">
              {description}
            </Text>
          ) : null}
          {action ? <Box pt="2">{action}</Box> : null}
        </Stack>
        {metric ? (
          <Stack gap="0" align={{ base: "flex-start", md: "flex-end" }} flexShrink="0">
            <Text textStyle="metric" fontSize="5xl" color="signalLime" lineHeight="1">
              {metric.value}
            </Text>
            <Text textStyle="label" color="fg.inverse/60">
              {metric.label}
            </Text>
          </Stack>
        ) : null}
      </HStack>
    </Box>
  );
}
