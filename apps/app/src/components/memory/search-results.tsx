"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, HStack, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { Bookmark, ChevronDown, Search } from "lucide-react";
import { Skeleton, notify } from "@savia-os/ui";
import type { AreaDto, MemoryResult } from "@savia-os/contracts";
import { api } from "@/lib/api";
import { spaceColor } from "@/lib/space-colors";
import { MemoryRow, MemoryGroupHeading } from "./memory-row";
import { MemoryDetailDialog, type MemoryView } from "./memory-detail-dialog";
import { tokenVar } from "@/lib/token-var";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; results: MemoryResult[] };

interface Group {
  areaId: string;
  name: string;
  color: string;
  items: MemoryResult[];
}

/**
 * M5 — Search results grouped by area, with matched fragments highlighted, a
 * server-side area filter, and "save as group" backed by the lenses API (M4).
 * Reads the `q` query param; empty query and no-results states are designed.
 */
export function SearchResults() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q")?.trim() ?? "";

  const [state, setState] = useState<State>({ status: "idle" });
  const [areas, setAreas] = useState<AreaDto[]>([]);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [active, setActive] = useState<MemoryView | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.areas.list().then(setAreas).catch(() => setAreas([]));
  }, []);

  const run = useCallback(() => {
    if (!query) return setState({ status: "idle" });
    let cancelled = false;
    setState({ status: "loading" });
    api.memory
      .search(query, { limit: 50, areaIds: areaFilter ? [areaFilter] : undefined })
      .then((results) => !cancelled && setState({ status: "ready", results }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [query, areaFilter]);

  useEffect(() => run(), [run]);

  const groups = useMemo<Group[]>(() => {
    if (state.status !== "ready") return [];
    const nameOf = new Map(areas.map((a) => [a.id, a.name]));
    const rootId = areas.find((a) => a.isDefault)?.id;
    const byArea = new Map<string, MemoryResult[]>();
    for (const r of state.results) {
      // Group under the most specific home: any named area beats General.
      const key = r.areaIds.find((id) => id !== rootId) ?? r.areaIds[0] ?? "—";
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
  }, [state, areas]);

  const total = state.status === "ready" ? state.results.length : 0;
  const filterName = areaFilter
    ? (areas.find((a) => a.id === areaFilter)?.name ?? "área")
    : "todas";

  async function save() {
    setSaving(true);
    try {
      const label = query.charAt(0).toUpperCase() + query.slice(1);
      await api.lenses.create({ name: label, query });
      notify.success(
        "Búsqueda guardada",
        "La verás en «Búsquedas guardadas» — se mantiene al día sola.",
      );
    } catch {
      notify.error("No pudimos guardarla", "Prueba de nuevo en un momento.");
    } finally {
      setSaving(false);
    }
  }

  if (!query) {
    return (
      <Emptyish
        title="Busca en tu memoria."
        body="Escribe en la barra de arriba para encontrar cualquier recuerdo, esté en el área que esté."
      />
    );
  }

  if (state.status === "loading") {
    return (
      <Stack gap="3" maxW="820px">
        <Skeleton w="300px" h="32px" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} w="100%" h="76px" />
        ))}
      </Stack>
    );
  }

  if (state.status === "error") {
    return (
      <Emptyish
        title="No pudimos buscar ahora."
        body="Algo falló al consultar tu memoria. Prueba de nuevo en un momento."
        action={
          <Button colorPalette="ink" onClick={run}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (total === 0) {
    return (
      <Emptyish
        icon
        title={`Nada sobre «${query}».`}
        body={
          areaFilter
            ? `No hay coincidencias dentro de ${filterName}. Prueba buscando en todas las áreas.`
            : "Tu memoria todavía no tiene recuerdos de este tema. Prueba con otras palabras, o suma una fuente que lo cubra."
        }
        action={
          <HStack gap="2.5">
            {areaFilter ? (
              <Button colorPalette="ink" onClick={() => setAreaFilter(null)}>
                Buscar en todas las áreas
              </Button>
            ) : (
              <Button colorPalette="ink" onClick={() => router.push("/fuentes")}>
                Sumar una fuente
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/memoria")}>
              Limpiar búsqueda
            </Button>
          </HStack>
        }
      />
    );
  }

  return (
    <Stack gap="0" maxW="820px">
      <HStack align="center" gap="4" flexWrap="wrap">
        <Text fontWeight="300" textStyle="titleLg" color="fg">
          {total} {total === 1 ? "resultado" : "resultados"} para{" "}
          <Box as="span" fontWeight="600">
            «{query}»
          </Box>
        </Text>
        <HStack ms="auto" gap="2.5">
          <AreaFilter
            areas={areas}
            value={areaFilter}
            label={`Área: ${filterName}`}
            onChange={setAreaFilter}
          />
          <Button colorPalette="ink" size="sm" onClick={save} loading={saving}>
            <Bookmark size={14} /> Guardar como grupo
          </Button>
        </HStack>
      </HStack>

      <Stack gap="6" mt="6">
        {groups.map((g) => (
          <Box key={g.areaId}>
            <MemoryGroupHeading color={g.color} label={`${g.name} · ${g.items.length}`} />
            <Stack gap="2.5">
              {g.items.map((r) => (
                <MemoryRow
                  key={r.id}
                  text={r.text}
                  highlight={query}
                  meta={r.sensitivity === "sensitive" ? "Sensible" : undefined}
                  onClick={() =>
                    setActive({
                      id: r.id,
                      text: r.text,
                      sensitivity: r.sensitivity,
                      spaces: [{ id: g.areaId, name: g.name }],
                      allAreas: areas.filter((a) => !a.isDefault).map((a) => ({ id: a.id, name: a.name })),
                    })
                  }
                />
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>

      <MemoryDetailDialog memory={active} onClose={() => setActive(null)} onChanged={run} />
    </Stack>
  );
}

/** Pill dropdown to clamp the search to one area (server-side re-query). */
function AreaFilter({
  areas,
  value,
  label,
  onChange,
}: {
  areas: AreaDto[];
  value: string | null;
  label: string;
  onChange: (id: string | null) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="outline" size="sm" color={value ? "fg" : "fg.muted"}>
          {label} <ChevronDown size={14} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="__all__" onClick={() => onChange(null)}>
              Todas las áreas
            </Menu.Item>
            {areas
              .filter((a) => !a.isDefault)
              .map((a) => (
                <Menu.Item key={a.id} value={a.id} onClick={() => onChange(a.id)}>
                  {a.name}
                </Menu.Item>
              ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

function Emptyish({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: boolean;
}) {
  return (
    <Stack flex="1" align="center" justify="center" textAlign="center" minH="60vh" gap="0" px="6">
      {icon ? (
        <Box
          w="90px"
          h="90px"
          rounded="full"
          bg="bg.subtle"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="fg.muted"
          mb="6"
        >
          <Search size={38} strokeWidth={1.5} />
        </Box>
      ) : null}
      <Text fontWeight="300" textStyle="pageTitle" color="fg">
        {title}
      </Text>
      <Text textStyle="bodyLg" color="fg.muted" lineHeight="1.6" mt="3.5" maxW="44ch">
        {body}
      </Text>
      {action ? <Box mt="6">{action}</Box> : null}
    </Stack>
  );
}
