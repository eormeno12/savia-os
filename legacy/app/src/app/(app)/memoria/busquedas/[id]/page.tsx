"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, HStack, Link as CkLink, Stack, Text } from "@chakra-ui/react";
import { Trash2 } from "lucide-react";
import type { AreaDto, LensDto, MemoryResult } from "@savia-os/legacy-contracts";
import { ConfirmDialog, Skeleton, notify } from "@savia-os/ui";
import { api } from "@/lib/api";
import { spaceColor } from "@/lib/space-colors";
import { tokenVar } from "@/lib/token-var";
import { MemoryRow, MemoryGroupHeading } from "@/components/memory/memory-row";

type State =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      lens: LensDto;
      results: MemoryResult[];
      areas: AreaDto[];
      /** The lens exists but its live matches couldn't be computed right now. */
      matchesUnavailable: boolean;
    };

/**
 * M4 detail — one saved search opened: its live matches, grouped by the areas
 * they actually live in, proving the "cut across the map" idea at a glance.
 */
export default function BusquedaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([
      api.lenses.list(),
      // Matches are best-effort: a vector-store hiccup shouldn't hide the lens.
      api.lenses.memories(id).catch(() => null),
      api.areas.list(),
    ])
      .then(([lenses, results, areas]) => {
        if (cancelled) return;
        const lens = lenses.find((l) => l.id === id);
        if (!lens) return setState({ status: "error" });
        setState({
          status: "ready",
          lens,
          results: results ?? [],
          areas,
          matchesUnavailable: results === null,
        });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => load(), [load]);

  const groups = useMemo(() => {
    if (state.status !== "ready") return [];
    const nameOf = new Map(state.areas.map((a) => [a.id, a.name]));
    const byArea = new Map<string, MemoryResult[]>();
    for (const r of state.results) {
      const key = r.areaIds[0] ?? "—";
      byArea.set(key, [...(byArea.get(key) ?? []), r]);
    }
    return [...byArea.entries()]
      .map(([areaId, items]) => ({
        areaId,
        name: nameOf.get(areaId) ?? "Sin área",
        color: tokenVar(`colors.${spaceColor(areaId).fill}`),
        items,
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [state]);

  if (state.status === "loading") {
    return (
      <Stack gap="4" maxW="820px">
        <Skeleton w="140px" h="13px" />
        <Skeleton w="320px" h="40px" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} w="100%" h="72px" rounded="2xl" />
        ))}
      </Stack>
    );
  }

  if (state.status === "error") {
    return (
      <Stack align="center" justify="center" minH="50vh" gap="4">
        <Text fontSize="15px" color="fg.muted">
          No encontramos esta búsqueda guardada.
        </Text>
        <Button colorPalette="ink" asChild>
          <Link href="/memoria/busquedas">Volver a búsquedas guardadas</Link>
        </Button>
      </Stack>
    );
  }

  const { lens, results } = state;

  async function removeLens() {
    await api.lenses.delete(lens.id);
    notify.success("Búsqueda eliminada", "Tus recuerdos no se tocaron — solo la vista.");
    router.push("/memoria/busquedas");
  }

  return (
    <Stack gap="0" maxW="820px">
      <Text fontSize="13px" color="fg.muted">
        <CkLink asChild color="fg.muted" _hover={{ color: "fg" }}>
          <Link href="/memoria/busquedas">Búsquedas guardadas</Link>
        </CkLink>{" "}
        /{" "}
        <Box as="span" color="fg" fontWeight="500">
          {lens.name}
        </Box>
      </Text>

      <HStack align="flex-start" gap="4" mt="3.5">
        <Box flex="1" minW="0">
          <Text textStyle="pageTitle" fontWeight="300" color="fg">
            {lens.name}
          </Text>
          <Text fontSize="14px" color="fg.muted" mt="2">
            {results.length} {results.length === 1 ? "coincidencia" : "coincidencias"}
            {lens.query ? (
              <>
                {" "}
                para «{lens.query}» · cruza {groups.length}{" "}
                {groups.length === 1 ? "área" : "áreas"} · se actualiza sola
              </>
            ) : null}
          </Text>
        </Box>
        <Button variant="outline" size="sm" color="fg.muted" onClick={() => setConfirming(true)}>
          <Trash2 size={14} /> Eliminar vista
        </Button>
      </HStack>

      {results.length === 0 ? (
        <Stack
          align="center"
          textAlign="center"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border"
          rounded="3xl"
          py="16"
          mt="8"
          gap="2"
        >
          <Text fontWeight="300" textStyle="titleLg" color="fg">
            Todavía sin coincidencias.
          </Text>
          <Text fontSize="14px" color="fg.muted" maxW="42ch" lineHeight="1.6">
            Cuando tu memoria sume recuerdos sobre este tema, aparecerán aquí solos.
          </Text>
        </Stack>
      ) : (
        <Stack gap="6" mt="7">
          {groups.map((g) => (
            <Box key={g.areaId}>
              <MemoryGroupHeading color={g.color} label={`${g.name} · ${g.items.length}`} />
              <Stack gap="2.5">
                {g.items.map((r) => (
                  <MemoryRow
                    key={r.id}
                    text={r.text}
                    meta={r.sensitivity === "sensitive" ? "Sensible" : undefined}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`¿Eliminar «${lens.name}»?`}
        description="Solo se elimina la vista. Tus recuerdos quedan exactamente donde están."
        confirmLabel="Eliminar"
        onConfirm={removeLens}
      />
    </Stack>
  );
}
