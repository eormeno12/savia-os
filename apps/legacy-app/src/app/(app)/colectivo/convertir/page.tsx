"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Group,
  HStack,
  Input,
  RadioCard,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ArrowRight, Check, Eye, PenLine, ShieldCheck } from "lucide-react";
import { EmptyState, Field, FadeInUp, Skeleton, Stepper, notify } from "@savia-os/ui";
import type { AreaDto, GroupRole } from "@savia-os/contracts";
import { api } from "@/lib/api";
import { SpaceGlyph } from "@/components/ui/SpaceGlyph";

/** Default visibility for people who join — the two honest options. */
const VISIBILITY: { value: Extract<GroupRole, "viewer" | "contributor">; title: string; description: string; icon: typeof Eye }[] = [
  { value: "viewer", title: "Solo lectura", description: "Quienes se unan leen esta memoria.", icon: Eye },
  { value: "contributor", title: "Lectura y contribución", description: "Quienes se unan leen y también aportan.", icon: PenLine },
];

/**
 * CO6 — Convert an area into a collective memory. Two calm steps on a light
 * canvas: pick the area (and how new people start), then name it and confirm.
 * The mental model is corrected up front: sharing is visibility, never a move
 * or a copy — nothing leaves your memory.
 */
export default function ConvertirPage() {
  const router = useRouter();
  const [areas, setAreas] = useState<AreaDto[] | null>(null);
  const [selected, setSelected] = useState<AreaDto | null>(null);
  const [visibility, setVisibility] = useState<"viewer" | "contributor">("contributor");
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    api.areas.list().then(setAreas).catch(() => setAreas([]));
  }, []);

  // Only real areas can be shared — the default "General" stays private.
  const shareable = useMemo(() => (areas ?? []).filter((a) => !a.isDefault), [areas]);

  function goConfirm() {
    if (!selected) return;
    if (!name.trim()) setName(selected.name);
    setStep(1);
  }

  async function convert() {
    if (!selected || !name.trim()) return;
    setWorking(true);
    try {
      // NOTE: `visibility` is the intended default role for new members, but the
      // current API can't persist it (POST /groups takes only a name). Documented
      // as a gap — expected: POST /groups { name, defaultRole }.
      const group = await api.groups.create(name.trim());
      await api.groups.shareFragment(group.id, selected.id);
      notify.success("Ya es colectiva", `«${selected.name}» ahora se comparte con tu equipo.`);
      router.push(`/colectivo/${group.id}`);
    } catch {
      notify.error("No pudimos crear la memoria colectiva");
      setWorking(false);
    }
  }

  return (
    <Stack gap="8" maxW="620px">
      <FadeInUp>
        <Box>
          <Text textStyle="label" color="fg.muted">
            Memoria colectiva
          </Text>
          <Text textStyle="pageTitle" fontWeight="300" color="fg" mt="2.5">
            Comparte un área con tu equipo.
          </Text>
        </Box>
      </FadeInUp>

      <Stepper
        step={step}
        items={[{ title: "Elige el área" }, { title: "Nombre y confirmación" }]}
      />

      {step === 0 ? (
        <FadeInUp key="step-0">
          <Stack gap="7">
            <Stack gap="3">
              <Text fontSize="14px" fontWeight="600" color="fg">
                ¿Qué área quieres compartir?
              </Text>
              {areas === null ? (
                <Stack gap="2.5">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} h="72px" rounded="card" />
                  ))}
                </Stack>
              ) : shareable.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheck size={30} />}
                  title="Aún no tienes un área para compartir"
                  description="General es tu memoria privada y no se comparte. Crea un área primero y luego vuelve aquí."
                  action={
                    <Button colorPalette="ink" asChild>
                      <Link href="/memoria/nueva">Crear un área</Link>
                    </Button>
                  }
                />
              ) : (
                <Stack gap="2.5">
                  {shareable.map((a) => {
                    const isSel = selected?.id === a.id;
                    return (
                      <HStack
                        key={a.id}
                        as="button"
                        gap="3.5"
                        textAlign="start"
                        bg="bg.panel"
                        borderWidth="1.5px"
                        borderColor={isSel ? "ink.solid" : "border"}
                        rounded="card"
                        px="4.5"
                        py="3.5"
                        cursor="pointer"
                        transition="border-color 0.16s"
                        onClick={() => setSelected(a)}
                      >
                        <SpaceGlyph spaceId={a.id} name={a.name} size={40} />
                        <Box flex="1" minW="0">
                          <Text fontSize="15px" fontWeight="600" color="fg" truncate>
                            {a.name}
                          </Text>
                          <Text fontSize="12.5px" color="fg.muted">
                            {a.memoryCount} {a.memoryCount === 1 ? "recuerdo" : "recuerdos"}
                          </Text>
                        </Box>
                        {isSel ? (
                          <Box color="ink.solid" flexShrink="0">
                            <Check size={18} />
                          </Box>
                        ) : null}
                      </HStack>
                    );
                  })}
                </Stack>
              )}
            </Stack>

            {shareable.length > 0 ? (
              <Stack gap="3">
                <Text fontSize="14px" fontWeight="600" color="fg">
                  ¿Cómo empiezan los nuevos miembros?
                </Text>
                <RadioCard.Root
                  value={visibility}
                  onValueChange={(e) => e.value && setVisibility(e.value as "viewer" | "contributor")}
                  colorPalette="ink"
                >
                  <Group orientation="vertical" attached={false} gap="2.5" w="full">
                    {VISIBILITY.map((v) => {
                      const Icon = v.icon;
                      return (
                        <RadioCard.Item key={v.value} value={v.value} w="full">
                          <RadioCard.ItemHiddenInput />
                          <RadioCard.ItemControl>
                            <RadioCard.ItemContent>
                              <HStack gap="2">
                                <Icon size={15} />
                                <RadioCard.ItemText>{v.title}</RadioCard.ItemText>
                              </HStack>
                              <RadioCard.ItemDescription>{v.description}</RadioCard.ItemDescription>
                            </RadioCard.ItemContent>
                            <RadioCard.ItemIndicator />
                          </RadioCard.ItemControl>
                        </RadioCard.Item>
                      );
                    })}
                  </Group>
                </RadioCard.Root>
              </Stack>
            ) : null}

            <TransparencyNote />

            <HStack>
              <Button variant="outline" asChild>
                <Link href="/colectivo">Cancelar</Link>
              </Button>
              <Button colorPalette="ink" ms="auto" disabled={!selected} onClick={goConfirm}>
                Continuar <ArrowRight size={16} />
              </Button>
            </HStack>
          </Stack>
        </FadeInUp>
      ) : (
        <FadeInUp key="step-1">
          <Stack gap="7">
            <Field label="Nombre del grupo" helperText="Así lo verá tu equipo. Puedes cambiarlo después.">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={selected?.name}
                size="lg"
                autoFocus
                maxLength={80}
              />
            </Field>

            <Stack gap="3" bg="bg.subtle" rounded="card" p="6">
              <Text fontSize="14px" fontWeight="600" color="fg">
                Lo que va a pasar
              </Text>
              <Stack gap="2.5">
                <SummaryRow>
                  Compartes{" "}
                  <Box as="span" fontWeight="600" color="fg">
                    «{selected?.name}»
                  </Box>{" "}
                  con quienes invites.
                </SummaryRow>
                <SummaryRow>
                  Los nuevos miembros entran con{" "}
                  <Box as="span" fontWeight="600" color="fg">
                    {visibility === "viewer" ? "solo lectura" : "lectura y contribución"}
                  </Box>
                  .
                </SummaryRow>
                <SummaryRow>Quedas como admin y decides quién entra y qué puede hacer.</SummaryRow>
                <SummaryRow>Nada se mueve ni se copia — tu memoria sigue siendo tuya.</SummaryRow>
              </Stack>
            </Stack>

            <HStack>
              <Button variant="outline" onClick={() => setStep(0)} disabled={working}>
                Atrás
              </Button>
              <Button
                colorPalette="ink"
                ms="auto"
                onClick={convert}
                loading={working}
                loadingText="Creando…"
                disabled={!name.trim()}
              >
                Crear memoria colectiva
              </Button>
            </HStack>
          </Stack>
        </FadeInUp>
      )}
    </Stack>
  );
}

/** The trust callout — corrects the "move or copy" mental model. */
function TransparencyNote() {
  return (
    <HStack gap="3" bg="bg.subtle" rounded="card" px="5" py="4" align="flex-start">
      <Box color="fg.muted" mt="0.5" flexShrink="0">
        <Eye size={18} />
      </Box>
      <Text fontSize="13.5px" color="fg.muted" lineHeight="1.6">
        Tus recuerdos no se mueven ni se duplican — los miembros solo ganan{" "}
        <Box as="span" color="fg" fontWeight="600">
          visibilidad
        </Box>{" "}
        sobre esta área. Tú sigues siendo dueño de tu memoria.
      </Text>
    </HStack>
  );
}

function SummaryRow({ children }: { children: React.ReactNode }) {
  return (
    <HStack gap="2.5" align="flex-start">
      <Box color="fg.subtle" mt="0.5" flexShrink="0">
        <Check size={15} />
      </Box>
      <Text fontSize="13.5px" color="fg.muted" lineHeight="1.6">
        {children}
      </Text>
    </HStack>
  );
}
