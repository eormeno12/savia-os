"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Editable,
  HStack,
  IconButton,
  Link as CkLink,
  Menu,
  Portal,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { ChevronRight, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react";
import { ConfirmDialog, Skeleton, StatusBadge, notify } from "@savia-os/ui";
import type { AreaDto, AreaMemoryDto } from "@savia-os/contracts";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/relative-time";
import { MemoryRow } from "@/components/memory/memory-row";
import { MemoryDetailDialog, type MemoryView } from "@/components/memory/memory-detail-dialog";
import { MemoryEmpty } from "@/components/memory/memory-empty";
import { AreaAccessPanel } from "@/components/memory/area-access-panel";

interface Loaded {
  area: AreaDto;
  parent: AreaDto | null;
  children: AreaDto[];
  memories: AreaMemoryDto[];
  nextCursor: string | null;
  /** id → name for resolving the "también en" links. */
  names: Map<string, string>;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: Loaded };

/**
 * M2 — Area panel: explore and correct one area. Inline-editable title, real
 * governance/sensitivity chips, sub-areas, and two tabs — its memories, and the
 * per-AI access control (the same model consolidated in Pulso). Every state is
 * designed.
 */
export default function AreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [active, setActive] = useState<MemoryView | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([api.areas.list(), api.areas.memories(id)])
      .then(([all, page]) => {
        if (cancelled) return;
        const area = all.find((a) => a.id === id);
        if (!area) return setState({ status: "error" });
        setState({
          status: "ready",
          data: {
            area,
            parent: area.parentId ? (all.find((a) => a.id === area.parentId) ?? null) : null,
            children: all.filter((a) => a.parentId === id),
            memories: page.items,
            nextCursor: page.nextCursor,
            names: new Map(all.map((a) => [a.id, a.name])),
          },
        });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => load(), [load]);

  async function rename(next: string) {
    if (state.status !== "ready") return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === state.data.area.name) return;
    try {
      await api.areas.update(id, { name: trimmed });
      notify.success("Área renombrada", "Savia usará el nuevo nombre de ahora en más.");
      load();
    } catch {
      notify.error("No pudimos renombrar el área");
    }
  }

  async function loadMore() {
    if (state.status !== "ready" || !state.data.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await api.areas.memories(id, state.data.nextCursor);
      setState((s) =>
        s.status === "ready"
          ? {
              status: "ready",
              data: {
                ...s.data,
                memories: [...s.data.memories, ...page.items],
                nextCursor: page.nextCursor,
              },
            }
          : s,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function removeArea() {
    try {
      await api.areas.delete(id);
      notify.success("Área eliminada", "Tus recuerdos no se borran — vuelven a General.");
      router.push("/memoria");
    } catch {
      notify.error("No pudimos eliminar el área");
      setConfirmDelete(false);
    }
  }

  if (state.status === "loading") {
    return (
      <Stack gap="5" maxW="900px">
        <Skeleton w="120px" h="13px" />
        <Skeleton w="280px" h="40px" />
        <HStack gap="2" mt="1">
          <Skeleton w="120px" h="26px" rounded="full" />
          <Skeleton w="90px" h="26px" rounded="full" />
        </HStack>
        <Skeleton w="100%" h="72px" mt="4" rounded="2xl" />
        <Skeleton w="100%" h="72px" rounded="2xl" />
      </Stack>
    );
  }
  if (state.status === "error") {
    return <MemoryEmpty error onRetry={load} />;
  }

  const { area, parent, children, memories, nextCursor, names } = state.data;
  const isAuto = area.governance === "auto";

  return (
    <Stack gap="0" maxW="900px">
      {/* breadcrumb */}
      <Text fontSize="13px" color="fg.muted">
        <CkLink asChild color="fg.muted" _hover={{ color: "fg" }}>
          <Link href="/memoria">Tu memoria</Link>
        </CkLink>
        {parent ? (
          <>
            {" / "}
            <CkLink asChild color="fg.muted" _hover={{ color: "fg" }}>
              <Link href={`/memoria/${parent.id}`}>{parent.name}</Link>
            </CkLink>
          </>
        ) : null}
        {" / "}
        <Box as="span" color="fg" fontWeight="500">
          {area.name}
        </Box>
      </Text>

      {/* title + actions */}
      <HStack align="flex-start" gap="3" mt="3.5">
        <Editable.Root
          key={area.name}
          ref={editRef}
          defaultValue={area.name}
          onValueCommit={(e) => rename(e.value)}
          fontWeight="300"
          fontSize="displayMd"
          lineHeight="1"
          flex="1"
          minW="0"
        >
          <Editable.Preview />
          <Editable.Input />
        </Editable.Root>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton aria-label="Acciones del área" variant="ghost" color="fg.muted" mt="1">
              <MoreHorizontal size={20} />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="rename" onClick={() => editRef.current?.querySelector("button")?.click()}>
                  <Pencil size={15} /> Renombrar
                </Menu.Item>
                {!area.isDefault ? (
                  <Menu.Item value="delete" color="dangerInk" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={15} /> Eliminar área
                  </Menu.Item>
                ) : null}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>

      {/* meta chips */}
      <HStack gap="2" mt="3.5" flexWrap="wrap">
        <Chip>{isAuto ? "Organizada por Savia" : "Creada por ti"}</Chip>
        {area.isDefault ? <Chip>Tu área base</Chip> : null}
        <Text fontSize="12px" color="fg.muted">
          {area.memoryCount} {area.memoryCount === 1 ? "recuerdo" : "recuerdos"}
        </Text>
      </HStack>

      {/* sub-areas */}
      {children.length > 0 ? (
        <Box mt="6">
          <Text textStyle="label" color="fg.muted" mb="2.5">
            Sub-áreas
          </Text>
          <HStack gap="2.5" flexWrap="wrap">
            {children.map((c) => (
              <HStack
                key={c.id}
                as="button"
                gap="2.5"
                bg="bg.panel"
                borderWidth="1px"
                borderColor="border"
                rounded="xl"
                px="4"
                py="2.5"
                cursor="pointer"
                _hover={{ borderColor: "fg.subtle" }}
                onClick={() => router.push(`/memoria/${c.id}`)}
              >
                <Text fontSize="14px" fontWeight="500" color="fg">
                  {c.name}
                </Text>
                <Text fontSize="12px" color="fg.muted" fontVariantNumeric="tabular-nums">
                  {c.memoryCount}
                </Text>
                <Box color="fg.muted">
                  <ChevronRight size={14} />
                </Box>
              </HStack>
            ))}
          </HStack>
        </Box>
      ) : null}

      {/* tabs */}
      <Tabs.Root defaultValue="memories" mt="7" variant="line">
        <Tabs.List>
          <Tabs.Trigger value="memories">Recuerdos</Tabs.Trigger>
          <Tabs.Trigger value="ias">¿Quién ve esta área?</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="memories" pt="5">
          {memories.length === 0 ? (
            <Stack
              align="center"
              justify="center"
              textAlign="center"
              borderWidth="1px"
              borderStyle="dashed"
              borderColor="border"
              rounded="3xl"
              py="16"
              gap="0"
            >
              <Box color="fg.muted">
                <Upload size={38} strokeWidth={1.3} />
              </Box>
              <Text fontWeight="300" textStyle="titleLg" color="fg" mt="5">
                {area.memoryCount > 0
                  ? "Estos recuerdos se están organizando."
                  : "Aún no hay recuerdos aquí."}
              </Text>
              <Text fontSize="15px" color="fg.muted" lineHeight="1.6" mt="3" maxW="44ch">
                {area.memoryCount > 0
                  ? "Savia los está clasificando en esta área. Aparecerán en un momento."
                  : "Se llena sola cuando tus IAs o tus fuentes aporten algo sobre este tema. También puedes mover recuerdos desde otra área."}
              </Text>
              <Button colorPalette="ink" mt="5" asChild>
                <Link href="/fuentes">Sumar fuentes a {area.name}</Link>
              </Button>
            </Stack>
          ) : (
            <Stack gap="2.5">
              {memories.map((m) => {
                const others = m.areaIds
                  .filter((a) => a !== id)
                  .map((a) => names.get(a))
                  .filter((n): n is string => Boolean(n));
                const meta = [
                  m.createdAt ? relativeTime(m.createdAt) : null,
                  others.length > 0 ? `También en ${others.slice(0, 2).join(", ")}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Box key={m.memoryId} position="relative">
                    <MemoryRow
                      text={m.text}
                      meta={meta || undefined}
                      onClick={() =>
                        setActive({
                          id: m.memoryId,
                          text: m.text,
                          when: m.createdAt ? relativeTime(m.createdAt) : undefined,
                          sensitivity: m.sensitivity,
                          spaces: [
                            { id: area.id, name: area.name },
                            ...m.areaIds
                              .filter((a) => a !== id)
                              .map((a) => ({ id: a, name: names.get(a) ?? "Sin área" })),
                          ],
                          allAreas: [...names.entries()].map(([aid, name]) => ({ id: aid, name })),
                        })
                      }
                    />
                    {m.sensitivity === "sensitive" ? (
                      <Box position="absolute" top="3.5" insetEnd="3.5">
                        <StatusBadge tone="warning">Sensible</StatusBadge>
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
              {nextCursor ? (
                <Button variant="outline" onClick={loadMore} loading={loadingMore} alignSelf="center" mt="2">
                  Cargar más
                </Button>
              ) : null}
            </Stack>
          )}
        </Tabs.Content>

        <Tabs.Content value="ias" pt="5">
          <AreaAccessPanel areaId={area.id} areaName={area.name} />
        </Tabs.Content>
      </Tabs.Root>

      <MemoryDetailDialog memory={active} onClose={() => setActive(null)} onChanged={load} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar «${area.name}»?`}
        description="Esto elimina el área, no tus recuerdos — vuelven a General. No se puede deshacer."
        confirmLabel="Eliminar área"
        onConfirm={removeArea}
      />
    </Stack>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <Box
      fontSize="12px"
      fontWeight="500"
      color="fg"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      px="2.5"
      py="1"
      rounded="full"
    >
      {children}
    </Box>
  );
}
