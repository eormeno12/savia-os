"use client";

import { Box, Center, Text } from "@chakra-ui/react";
import { SaviaMark } from "@savia-os/ui";
import { spaceColor } from "@/lib/space-colors";

interface SpaceGlyphProps {
  spaceId: string;
  name: string;
  /** The home/"General" space — renders the brand mark instead of an initial. */
  isDefault?: boolean;
  /** Collective spaces get a ring to signal shared ownership at a glance. */
  collective?: boolean;
  size?: number;
}

/**
 * The visual identity of a space — a deterministic colored cell from the brand
 * ramp with the space's initial (or the Savia mark for the home space). Reused
 * across nav, cards, the memory map and member lists.
 */
export function SpaceGlyph({
  spaceId,
  name,
  isDefault = false,
  collective = false,
  size = 32,
}: SpaceGlyphProps) {
  const { fill, ink } = spaceColor(spaceId, { isDefault });
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <Center
      w={`${size}px`}
      h={`${size}px`}
      bg={fill}
      color={ink}
      borderRadius="chip"
      flexShrink="0"
      ringColor="lime.solid"
      ring={collective ? "2px" : undefined}
      ringOffset={collective ? "2px" : undefined}
      ringOffsetColor="bg"
      aria-hidden
    >
      {isDefault ? (
        <SaviaMark size={Math.round(size * 0.5)} color="currentColor" />
      ) : (
        <Text fontSize={`${Math.round(size * 0.42)}px`} fontWeight="700" lineHeight="1">
          {initial}
        </Text>
      )}
      <Box srOnly>{name}</Box>
    </Center>
  );
}
