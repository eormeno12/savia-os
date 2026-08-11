"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, HStack, SegmentGroup, Stack, Text } from "@chakra-ui/react";
import { ArrowRight, Plus } from "lucide-react";
import type { AreaDto, AreaMemoryDto } from "@savia-os/legacy-contracts";
import { FadeInUp } from "@savia-os/ui";
import { relativeTime } from "@/lib/relative-time";
import type { MapArea } from "./use-memory-data";
import { MemoryCanvas } from "./memory-canvas";
import { MemoryList } from "./memory-list";

type View = "map" | "list";

interface MemoryMapProps {
  areas: MapArea[];
  total: number;
  weekDelta: number;
  root: AreaDto | null;
  recent: AreaMemoryDto[];
  areaNames: Map<string, string>;
}

/**
 * The populated Memoria screen (M1): the headline metric, the map/list toggle,
 * the living portrait, and the "Recientes" strip. The map keeps a
 * screen-reader-only list alongside it so the visualization is never the only
 * way to read the data.
 */
export function MemoryMap({ areas, total, weekDelta, root, recent, areaNames }: MemoryMapProps) {
  const router = useRouter();
  const [view, setView] = useState<View>("map");

  const goToArea = (id: string) => router.push(`/memoria/${id}`);

  return (
    <Stack gap="6" flex="1" minH="0">
      <HStack align="flex-end" gap="6" flexWrap="wrap">
        <Box>
          <Text textStyle="label" color="fg.muted">
            Tu memoria
          </Text>
          <HStack align="baseline" gap="3.5" mt="2.5">
            <Text textStyle="heroNumber" color="fg">
              {total.toLocaleString("es-AR")}
            </Text>
            <Text textStyle="bodyLg" lineHeight="1.3" color="fg.muted">
              recuerdos · {areas.length} {areas.length === 1 ? "área" : "áreas"}
              {weekDelta > 0 ? (
                <>
                  {" · "}
                  <Box as="span" color="success.fg" fontWeight="500">
                    +{weekDelta.toLocaleString("es-AR")} esta semana
                  </Box>
                </>
              ) : null}
            </Text>
          </HStack>
        </Box>

        <HStack gap="3" ms="auto">
          <SegmentGroup.Root
            value={view}
            onValueChange={(e) => setView((e.value as View) ?? "map")}
            size="sm"
            bg="bg.subtle"
            aria-label="Vista de la memoria"
          >
            <SegmentGroup.Indicator bg="bg.panel" shadow="xs" />
            <SegmentGroup.Items
              items={[
                { value: "map", label: "Mapa" },
                { value: "list", label: "Lista" },
              ]}
            />
          </SegmentGroup.Root>
          <Button variant="outline" onClick={() => router.push("/memoria/nueva")}>
            <Plus size={15} /> Crear área
          </Button>
        </HStack>
      </HStack>

      {view === "map" ? (
        <>
          <MemoryCanvas areas={areas} rootId={root?.id} onSelect={goToArea} />
          <MemoryList srOnly areas={areas} onSelect={goToArea} />
        </>
      ) : (
        <MemoryList areas={areas} onSelect={goToArea} />
      )}

      {root ? (
        <FadeInUp delay={0.15}>
          <RecentStrip root={root} recent={recent} areaNames={areaNames} />
        </FadeInUp>
      ) : null}
    </Stack>
  );
}

/**
 * The latest drops of memory, plus where the unclassified rests. Time is the
 * second axis of navigation: by theme above (the map), by recency here.
 */
function RecentStrip({
  root,
  recent,
  areaNames,
}: {
  root: AreaDto;
  recent: AreaMemoryDto[];
  areaNames: Map<string, string>;
}) {
  if (recent.length === 0) return null;

  return (
    <Box>
      <HStack justify="space-between" mb="3">
        <HStack gap="2" align="baseline">
          <Text textStyle="label" color="fg.muted">
            Recientes
          </Text>
          <Text fontSize="13px" color="fg.subtle">
            — lo último que tú y tus IAs agregaron
          </Text>
        </HStack>
        <Button variant="plain" size="sm" color="fg.muted" asChild>
          <Link href="/pulso">
            Ver en Pulso <ArrowRight size={14} />
          </Link>
        </Button>
      </HStack>

      <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="3">
        {recent.map((m) => {
          const names = m.areaIds
            .map((id) => areaNames.get(id))
            .filter((n): n is string => Boolean(n) && n !== root.name);
          return (
            <Box
              key={m.memoryId}
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border"
              rounded="xl"
              px="4"
              py="3.5"
            >
              <HStack gap="2" mb="2">
                <Text fontSize="12px" color="fg.muted">
                  {m.createdAt ? relativeTime(m.createdAt) : "—"}
                  {names.length > 0 ? ` · ${names.slice(0, 2).join(" · ")}` : ""}
                </Text>
              </HStack>
              <Text fontSize="13px" color="fg" lineClamp={2}>
                {m.text}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
