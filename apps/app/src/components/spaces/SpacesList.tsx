"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, SimpleGrid, Text, Spinner } from "@chakra-ui/react";
import { api } from "@/lib/api";
import { SpaceCard } from "./SpaceCard";
import { SpaceForm } from "./SpaceForm";

type SpaceDto = Awaited<ReturnType<typeof api.spaces.list>>[number];

export function SpacesList() {
  const [spaces, setSpaces] = useState<SpaceDto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSpaces = useCallback(async () => {
    try {
      setSpaces(await api.spaces.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSpaces(); }, [fetchSpaces]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="16">
        <Spinner color="fg.muted" />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb="6">
        <Text textStyle="titleLg" fontWeight="600" color="fg">Spaces</Text>
      </Box>

      <SpaceForm onCreated={fetchSpaces} />

      {spaces.length === 0 ? (
        <Box
          border="1px dashed"
          borderColor="border.subtle"
          borderRadius="card"
          p="12"
          textAlign="center"
          mt="6"
        >
          <Text color="fg.muted">
            Aún no tienes spaces. Define uno arriba para empezar a organizar tu memoria.
          </Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mt="6">
          {spaces.map((s) => (
            <SpaceCard
              key={s.id}
              space={s}
              onDeleted={fetchSpaces}
            />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
