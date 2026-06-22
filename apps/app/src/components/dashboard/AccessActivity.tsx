"use client";

import { Box, Text, HStack, VStack, Badge } from "@chakra-ui/react";
import { Zap } from "lucide-react";
import type { AccessActivity } from "@/lib/api";

interface Props {
  activity: AccessActivity[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export function AccessActivity({ activity }: Props) {
  if (activity.length === 0) {
    return (
      <Box p="4" textAlign="center">
        <Text fontSize="sm" color="fg.muted">
          Ninguna IA ha accedido a tu memoria todavía.
        </Text>
      </Box>
    );
  }

  return (
    <VStack align="stretch" gap="2">
      {activity.map((a) => (
        <HStack
          key={a.connectionId}
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="lg"
          px="4"
          py="3"
          bg="bg"
          justify="space-between"
        >
          <HStack gap="3">
            <Box color="brand.solid">
              <Zap size={16} />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="500" color="fg">{a.label}</Text>
              <Text fontSize="xs" color="fg.muted">{timeAgo(a.lastSeenAt)}</Text>
            </Box>
          </HStack>
          <Badge colorPalette="blue" variant="subtle">
            {a.totalCalls} llamadas
          </Badge>
        </HStack>
      ))}
    </VStack>
  );
}
