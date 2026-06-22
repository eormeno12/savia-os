"use client";

import { Box, Text, HStack, VStack, Badge, Link } from "@chakra-ui/react";
import type { AreaDto } from "@/lib/api";

interface Props {
  areas: AreaDto[];
}

// Palette of colors for space cards
const PALETTE = [
  "blue", "purple", "teal", "orange", "pink", "green", "cyan", "red",
];

export function AreasOverview({ areas }: Props) {
  if (areas.length === 0) {
    return (
      <Box
        border="1px dashed"
        borderColor="border.subtle"
        borderRadius="lg"
        p="8"
        textAlign="center"
      >
        <Text fontSize="sm" color="fg.muted" mb="3">
          Aún no tienes spaces con memorias clasificadas.
        </Text>
        <Link href="/onboarding" fontSize="sm" color="brand.solid">
          Empezar onboarding →
        </Link>
      </Box>
    );
  }

  const maxCount = Math.max(...areas.map((a) => a.count), 1);

  return (
    <Box>
      <HStack gap="2" wrap="wrap">
        {areas.map((area, i) => {
          const size = Math.max(0.5, area.count / maxCount);
          const color = PALETTE[i % PALETTE.length];
          return (
            <AreaCard key={area.spaceId} area={area} size={size} color={color} />
          );
        })}
      </HStack>

      {/* Legend bar */}
      <Box mt="4">
        <HStack
          h="6px"
          borderRadius="full"
          overflow="hidden"
          gap="0"
        >
          {areas.map((area, i) => (
            <Box
              key={area.spaceId}
              flex={area.share}
              h="full"
              bg={`${PALETTE[i % PALETTE.length]}.400`}
              title={`${area.name}: ${area.share}%`}
            />
          ))}
        </HStack>
        <HStack gap="3" mt="2" wrap="wrap">
          {areas.map((area, i) => (
            <HStack key={area.spaceId} gap="1.5">
              <Box
                w="8px"
                h="8px"
                borderRadius="full"
                bg={`${PALETTE[i % PALETTE.length]}.400`}
                flexShrink={0}
              />
              <Text fontSize="xs" color="fg.muted">{area.name}</Text>
            </HStack>
          ))}
        </HStack>
      </Box>
    </Box>
  );
}

function AreaCard({ area, size, color }: { area: AreaDto; size: number; color: string }) {
  const minH = 80;
  const maxH = 160;
  const h = Math.round(minH + size * (maxH - minH));

  return (
    <VStack
      align="flex-start"
      justify="space-between"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="xl"
      p="4"
      bg="bg"
      h={`${h}px`}
      w="fit-content"
      minW="120px"
      maxW="200px"
      position="relative"
      overflow="hidden"
      _hover={{ borderColor: `${color}.400`, shadow: "sm" }}
      transition="all 0.15s"
    >
      {/* Background accent */}
      <Box
        position="absolute"
        top="0"
        right="0"
        w="60px"
        h="60px"
        borderRadius="full"
        bg={`${color}.50`}
        transform="translate(20px, -20px)"
        opacity={0.8}
      />

      <Box position="relative" zIndex={1}>
        <Text fontSize="xs" fontWeight="600" color="fg" mb="1" lineClamp={2}>
          {area.name}
        </Text>
      </Box>

      <VStack align="flex-start" gap="0.5" position="relative" zIndex={1}>
        <Text fontSize="2xl" fontWeight="800" color={`${color}.600`} lineHeight="1">
          {area.count}
        </Text>
        <Badge colorPalette={color} variant="subtle" size="sm">
          {area.share}%
        </Badge>
      </VStack>
    </VStack>
  );
}
