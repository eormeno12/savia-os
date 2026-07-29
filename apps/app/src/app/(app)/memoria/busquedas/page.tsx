"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { Bookmark, ChevronRight, Trash2 } from "lucide-react";
import type { LensDto } from "@savia-os/contracts";
import { ConfirmDialog, Skeleton, notify } from "@savia-os/ui";
import { api } from "@/lib/api";

/** A lens with its live match count (resolved per lens on load). */
interface LensRow extends LensDto {
  count: number | null;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; lenses: LensRow[] };

/**
 * M4 — Saved searches, backed by the lenses API: cross-area views that update
 * themselves. Lenses are strictly personal — no AI ever reads through one —
 * and the copy says so.
 */
export default function BusquedasPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [toDelete, setToDelete] = useState<LensRow | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      const lenses = await api.lenses.list();
      // Live counts, one round-trip per lens; a failure shows "—", not an error.
      const counts = await Promise.all(
        lenses.map((l) => api.lenses.memories(l.id).then((m) => m.length).catch(() => null)),
      );
      if (cancelled) return;
      setState({
        status: "ready",
        lenses: lenses.map((l, i) => ({ ...l, count: counts[i] })),
      });
    })().catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  async function removeLens(lens: LensRow) {
    await api.lenses.delete(lens.id);
    setToDelete(null);
    notify.success("Búsqueda eliminada", "Tus recuerdos no se tocaron — solo la vista.");
    load();
  }

  return (
    <Stack gap="0" maxW="820px">
      <Text textStyle="pageTitle" fontWeight="300" color="fg">
        Búsquedas guardadas
      </Text>
      <Text fontSize="15px" color="fg.muted" lineHeight="1.6" mt="3" maxW="56ch">
        Vistas que cruzan tus áreas y se actualizan solas — «todo sobre Fredd, esté donde esté». No
        son lugares en el mapa: son cortes transversales de tu memoria.
      </Text>
      <Text fontSize="13px" color="fg.subtle" mt="1.5">
        Solo tuyas — tus IAs nunca leen a través de una búsqueda guardada.
      </Text>

      {state.status === "loading" ? (
        <Stack gap="3" mt="6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} w="100%" h="76px" rounded="2xl" />
          ))}
        </Stack>
      ) : state.status === "error" ? (
        <Stack align="center" py="16" gap="4">
          <Text fontSize="15px" color="fg.muted">
            No pudimos cargar tus búsquedas guardadas.
          </Text>
          <Button colorPalette="ink" onClick={load}>
            Reintentar
          </Button>
        </Stack>
      ) : state.lenses.length === 0 ? (
        <Stack
          align="center"
          justify="center"
          textAlign="center"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border"
          rounded="3xl"
          py="20"
          mt="6"
          gap="0"
        >
          <Box color="fg.muted">
            <Bookmark size={40} strokeWidth={1.3} />
          </Box>
          <Text fontWeight="300" textStyle="titleLg" color="fg" mt="4.5">
            Aún no guardaste ninguna.
          </Text>
          <Text fontSize="14px" color="fg.muted" lineHeight="1.6" mt="2.5" maxW="40ch">
            Haz una búsqueda y guárdala como grupo. Se mantendrá al día sola, sin que muevas nada.
          </Text>
          <Button colorPalette="ink" mt="4.5" onClick={() => router.push("/memoria/resultados")}>
            Ir a buscar
          </Button>
        </Stack>
      ) : (
        <Stack gap="3" mt="6">
          {state.lenses.map((lens) => (
            <HStack
              key={lens.id}
              gap="4"
              bg="bg.panel"
              borderWidth="1px"
              borderColor="border"
              rounded="2xl"
              px="5"
              py="4"
              cursor="pointer"
              _hover={{ borderColor: "fg.subtle" }}
              onClick={() => router.push(`/memoria/busquedas/${lens.id}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(`/memoria/busquedas/${lens.id}`);
              }}
            >
              <Box
                w="42px"
                h="42px"
                rounded="xl"
                bg="bg.inverse"
                display="flex"
                alignItems="center"
                justifyContent="center"
                color="lime.solid"
                flexShrink="0"
              >
                <Bookmark size={18} />
              </Box>
              <Box flex="1" minW="0">
                <Text fontSize="16px" fontWeight="600" color="fg" truncate>
                  {lens.name}
                </Text>
                <Text fontSize="13px" color="fg.muted" mt="0.5" truncate>
                  {lens.query ? `«${lens.query}» · ` : ""}se actualiza sola
                </Text>
              </Box>
              <Text textStyle="cardTitle" color="fg" fontVariantNumeric="tabular-nums">
                {lens.count ?? "—"}
              </Text>
              <IconButton
                aria-label={`Eliminar «${lens.name}»`}
                variant="ghost"
                size="sm"
                color="fg.muted"
                onClick={(e) => {
                  e.stopPropagation();
                  setToDelete(lens);
                }}
              >
                <Trash2 size={15} />
              </IconButton>
              <Box color="fg.muted">
                <ChevronRight size={16} />
              </Box>
            </HStack>
          ))}
        </Stack>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`¿Eliminar «${toDelete?.name}»?`}
        description="Solo se elimina la vista. Tus recuerdos quedan exactamente donde están."
        confirmLabel="Eliminar"
        onConfirm={() => toDelete && removeLens(toDelete)}
      />
    </Stack>
  );
}
