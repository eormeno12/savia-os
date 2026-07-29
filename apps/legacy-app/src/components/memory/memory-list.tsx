"use client";

import { Box, HStack, Table, Text } from "@chakra-ui/react";
import { Activity, ChevronRight, Layers } from "lucide-react";
import { StatusBadge } from "@savia-os/ui";
import { spaceColor } from "@/lib/space-colors";
import { relativeTime } from "@/lib/relative-time";
import type { MapArea } from "./use-memory-data";

interface MemoryListProps {
  areas: MapArea[];
  onSelect: (id: string) => void;
  /**
   * When true the table is the screen-reader-only alternative to the visual
   * map — kept in the DOM, hidden from sight, still navigable.
   */
  srOnly?: boolean;
}

/**
 * The list view of the memory map. Doubles as the first-class accessible
 * representation: a real semantic `<table>` of every area with its count,
 * last activity and signals, sorted by size. Rows route to the area.
 */
export function MemoryList({ areas, onSelect, srOnly }: MemoryListProps) {
  const rows = [...areas].sort((a, b) => b.count - a.count);

  return (
    <Box
      srOnly={srOnly}
      bg="bg.panel"
      borderWidth={srOnly ? "0" : "1px"}
      borderColor="border"
      rounded="2xl"
      overflow="hidden"
    >
      <Table.Root size="md" interactive>
        <Table.Header>
          <Table.Row bg="bg.panel">
            <Table.ColumnHeader textStyle="label" color="fg.muted">
              Área
            </Table.ColumnHeader>
            <Table.ColumnHeader textStyle="label" color="fg.muted" w="130px">
              Recuerdos
            </Table.ColumnHeader>
            <Table.ColumnHeader textStyle="label" color="fg.muted" w="170px">
              Última actividad
            </Table.ColumnHeader>
            <Table.ColumnHeader textStyle="label" color="fg.muted" w="130px">
              Señales
            </Table.ColumnHeader>
            <Table.ColumnHeader w="40px" />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((area) => {
            const col = spaceColor(area.id);
            // Dot size scales gently with share, like the mockup's list view.
            const dot = 3 + Math.round(area.share * 3);
            return (
              <Table.Row
                key={area.id}
                cursor="pointer"
                tabIndex={0}
                role="link"
                aria-label={`${area.name}: ${area.count.toLocaleString("es-AR")} recuerdos`}
                onClick={() => onSelect(area.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelect(area.id);
                }}
                _hover={{ bg: "bg.subtle" }}
              >
                <Table.Cell>
                  <HStack gap="3">
                    <Box w={`${dot}`} h={`${dot}`} rounded="full" bg={col.fill} flexShrink="0" />
                    <Text fontWeight="600" color="fg">
                      {area.name}
                    </Text>
                    {area.childCount > 0 ? (
                      <HStack gap="1" color="fg.subtle" fontSize="12px">
                        <Layers size={12} />
                        <Text as="span">{area.childCount} sub</Text>
                      </HStack>
                    ) : null}
                  </HStack>
                </Table.Cell>
                <Table.Cell fontWeight="500" color="fg" fontVariantNumeric="tabular-nums">
                  {area.count.toLocaleString("es-AR")}
                </Table.Cell>
                <Table.Cell color="fg.muted" fontSize="13px">
                  {relativeTime(area.updatedAt)}
                </Table.Cell>
                <Table.Cell>
                  {area.live ? (
                    <StatusBadge tone="success" icon={<Activity size={12} />}>
                      Viva
                    </StatusBadge>
                  ) : null}
                </Table.Cell>
                <Table.Cell>
                  <Box color="fg.muted">
                    <ChevronRight size={16} />
                  </Box>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
