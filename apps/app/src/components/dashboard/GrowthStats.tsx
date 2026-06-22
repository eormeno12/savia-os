"use client";

import { Box, HStack, Text } from "@chakra-ui/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { GrowthSummary } from "@/lib/api";

interface Props {
  summary: GrowthSummary;
}

export function GrowthStats({ summary }: Props) {
  const { todayTotal, weekTotal, weekDelta } = summary;
  const deltaPositive = weekDelta >= 0;

  return (
    <HStack gap="4" wrap="wrap">
      <StatCard label="Hoy" value={todayTotal} />
      <StatCard label="Esta semana" value={weekTotal} />
      <StatCard
        label="vs semana anterior"
        value={weekDelta}
        showDelta
        positive={deltaPositive}
      />
    </HStack>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  showDelta?: boolean;
  positive?: boolean;
}

function StatCard({ label, value, showDelta, positive }: StatCardProps) {
  return (
    <Box
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="lg"
      px="4"
      py="3"
      minW="140px"
      bg="bg"
    >
      <Text fontSize="xs" color="fg.muted" mb="1">{label}</Text>
      <HStack gap="1.5" align="center">
        {showDelta && (
          <Box color={positive ? "green.500" : "red.400"}>
            {positive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          </Box>
        )}
        <Text fontSize="xl" fontWeight="700" color="fg">
          {showDelta && value > 0 ? `+${value}` : value}
        </Text>
        <Text fontSize="xs" color="fg.muted" alignSelf="flex-end" mb="0.5">mem.</Text>
      </HStack>
    </Box>
  );
}
