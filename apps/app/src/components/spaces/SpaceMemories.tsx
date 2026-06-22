"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Text,
  HStack,
  Badge,
  IconButton,
  Spinner,
} from "@chakra-ui/react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

interface SpaceMemoryDto {
  memoryId: string; text: string; score?: number;
  manualOverride: boolean;
  otherSpaces: { id: string; name: string }[];
}

interface Props {
  spaceId: string;
}

export function SpaceMemories({ spaceId }: Props) {
  const [memories, setMemories] = useState<SpaceMemoryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.spaces.memories(spaceId)
      .then(setMemories)
      .finally(() => setLoading(false));
  }, [spaceId]);

  async function handleRemove(memoryId: string) {
    await api.spaces.removeMemory(spaceId, memoryId);
    setMemories((prev) => prev.filter((m) => m.memoryId !== memoryId));
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="4">
        <Spinner size="sm" color="fg.muted" />
      </Box>
    );
  }

  if (memories.length === 0) {
    return (
      <Text fontSize="xs" color="fg.muted">
        Aún no hay memorias clasificadas en este space.
      </Text>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap="2">
      <Text fontSize="xs" color="fg.muted" fontWeight="500" mb="1">
        {memories.length} {memories.length === 1 ? "memoria" : "memorias"}
      </Text>
      {memories.map((m) => (
        <Box
          key={m.memoryId}
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="md"
          px="3"
          py="2"
          bg="bg.subtle"
        >
          <HStack justify="space-between" align="flex-start" gap="2">
            <Box flex="1" minW="0">
              <Text fontSize="xs" color="fg" lineClamp={2}>
                {m.text || <Text as="span" color="fg.muted" fontStyle="italic">[texto no disponible]</Text>}
              </Text>
              {m.otherSpaces.length > 0 && (
                <HStack gap="1" mt="1" flexWrap="wrap">
                  {m.otherSpaces.map((s) => (
                    <Badge key={s.id} size="xs" colorPalette="blue" variant="subtle">
                      {s.name}
                    </Badge>
                  ))}
                </HStack>
              )}
            </Box>
            <IconButton
              variant="ghost"
              size="xs"
              color="fg.muted"
              aria-label="Quitar de este space"
              onClick={() => handleRemove(m.memoryId)}
              flexShrink={0}
            >
              <X size={12} />
            </IconButton>
          </HStack>
        </Box>
      ))}
    </Box>
  );
}
