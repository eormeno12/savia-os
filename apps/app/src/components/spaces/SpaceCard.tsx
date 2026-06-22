"use client";

import { useState } from "react";
import {
  Box,
  Text,
  HStack,
  Badge,
  Spinner,
  Button,
  IconButton,
  Collapsible,
} from "@chakra-ui/react";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { SpaceMemories } from "./SpaceMemories";
import { api } from "@/lib/api";

interface SpaceDto {
  id: string; name: string; description: string;
  version: number; memoryCount: number; reclassifying: boolean;
  createdAt: string; updatedAt: string;
}

interface Props {
  space: SpaceDto;
  onDeleted: () => void;
}

export function SpaceCard({ space, onDeleted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`¿Eliminar el space "${space.name}"? Se quitarán las etiquetas de las memorias.`)) return;
    setDeleting(true);
    await api.spaces.delete(space.id);
    onDeleted();
  }

  return (
    <Box
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="card"
      bg="bg"
      overflow="hidden"
    >
      <Box px="5" py="4">
        <HStack justify="space-between" align="flex-start">
          <Box flex="1" minW="0">
            <HStack gap="2" mb="1">
              <Text fontWeight="600" fontSize="sm" color="fg" truncate>
                {space.name}
              </Text>
              {space.reclassifying && (
                <HStack gap="1">
                  <Spinner size="xs" color="brand.500" />
                  <Text fontSize="xs" color="fg.muted">clasificando…</Text>
                </HStack>
              )}
            </HStack>
            <Text fontSize="xs" color="fg.muted" lineClamp={2}>
              {space.description}
            </Text>
            <HStack gap="2" mt="2">
              <Badge size="sm" colorPalette="gray" variant="subtle">
                {space.memoryCount} {space.memoryCount === 1 ? "memoria" : "memorias"}
              </Badge>
              <Badge size="sm" colorPalette="gray" variant="subtle">
                v{space.version}
              </Badge>
            </HStack>
          </Box>

          <HStack gap="1" flexShrink={0}>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={expanded ? "Cerrar" : "Ver memorias"}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </IconButton>
            <IconButton
              variant="ghost"
              size="sm"
              color="fg.muted"
              aria-label="Eliminar space"
              loading={deleting}
              onClick={handleDelete}
            >
              <Trash2 size={14} />
            </IconButton>
          </HStack>
        </HStack>
      </Box>

      {expanded && (
        <Box borderTop="1px solid" borderColor="border.subtle" px="5" py="4">
          <SpaceMemories spaceId={space.id} />
        </Box>
      )}
    </Box>
  );
}
