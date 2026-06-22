"use client";

import { useState, useEffect } from "react";
import { Box, Text, VStack, Separator, Spinner, HStack } from "@chakra-ui/react";
import { api, AreaDto, GrowthSummary, AccessActivity as AccessActivityType } from "@/lib/api";
import { AreasOverview } from "@/components/dashboard/AreasOverview";
import { GrowthStats } from "@/components/dashboard/GrowthStats";
import { GrowthChart } from "@/components/dashboard/GrowthChart";
import { AccessActivity } from "@/components/dashboard/AccessActivity";

export default function DashboardPage() {
  const [areas, setAreas] = useState<AreaDto[]>([]);
  const [summary, setSummary] = useState<GrowthSummary | null>(null);
  const [activity, setActivity] = useState<AccessActivityType[]>([]);
  const [range, setRange] = useState<'day' | 'week'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [a, g, ac] = await Promise.all([
        api.growth.areas().catch(() => []),
        api.growth.summary(range).catch(() => null),
        api.growth.accessActivity().catch(() => []),
      ]);
      setAreas(a);
      setSummary(g);
      setActivity(ac);
      setLoading(false);
    }
    load();
  }, [range]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" h="200px">
        <Spinner />
      </Box>
    );
  }

  const totalMemories = areas.reduce((s, a) => s + a.count, 0);

  return (
    <Box maxW="800px" mx="auto" py="8" px="4">
      <VStack align="stretch" gap="8">
        {/* Header */}
        <Box>
          <HStack justify="space-between" mb="1">
            <Text fontSize="2xl" fontWeight="800" color="fg">
              Tu memoria
            </Text>
            <Text fontSize="sm" color="fg.muted" fontWeight="500">
              {totalMemories} recuerdos en total
            </Text>
          </HStack>
          <Text fontSize="sm" color="fg.muted">
            Así crece y se distribuye tu conocimiento en Savia.
          </Text>
        </Box>

        {/* Growth stats */}
        {summary && <GrowthStats summary={summary} />}

        <Separator />

        {/* Areas */}
        <Box>
          <Text fontSize="sm" fontWeight="700" color="fg" mb="4" textTransform="uppercase" letterSpacing="wide">
            Tus spaces
          </Text>
          <AreasOverview areas={areas} />
        </Box>

        <Separator />

        {/* Growth chart */}
        {summary && (
          <Box
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="xl"
            p="5"
            bg="bg"
          >
            <GrowthChart summary={summary} range={range} onRangeChange={setRange} />
          </Box>
        )}

        {/* Access activity */}
        {activity.length > 0 && (
          <>
            <Separator />
            <Box>
              <Text fontSize="sm" fontWeight="700" color="fg" mb="4" textTransform="uppercase" letterSpacing="wide">
                Actividad de IAs conectadas
              </Text>
              <AccessActivity activity={activity} />
            </Box>
          </>
        )}
      </VStack>
    </Box>
  );
}
