"use client";

import { useState, useEffect } from "react";
import { Text, Button, VStack, HStack, Badge, Input, Center } from "@chakra-ui/react";
import { Check, X } from "lucide-react";
import { Card, CardSkeleton, EmptyState, notify } from "@savia-os/ui";
import { SpaceGlyph } from "@/components/ui/SpaceGlyph";
import type { SuggestedSpace } from "@savia-os/legacy-contracts";
import { api } from "@/lib/api";

interface SpaceCardModel extends SuggestedSpace {
  accepted: boolean;
  customName: string;
}

interface Props {
  onDone: () => void;
}

export function SuggestedSpaces({ onDone }: Props) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<SpaceCardModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.onboarding
      .suggestSpaces()
      .then((suggestions) =>
        setCards(suggestions.map((s) => ({ ...s, accepted: true, customName: s.name }))),
      )
      .catch((err) => setError(err instanceof Error ? err.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  function toggle(i: number) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, accepted: !c.accepted } : c)));
  }

  function rename(i: number, name: string) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, customName: name } : c)));
  }

  async function handleSave() {
    const toCreate = cards.filter((c) => c.accepted && c.customName.trim());
    if (toCreate.length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    try {
      await Promise.all(toCreate.map((c) => api.areas.create(c.description)));
      notify.success(`${toCreate.length} spaces creados`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <VStack align="stretch" gap="3">
        <Text fontSize="sm" color="fg.muted">
          Analizando tus memorias y sugiriendo spaces…
        </Text>
        <CardSkeleton count={3} height="92px" />
      </VStack>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="No pudimos sugerir spaces"
        description={error}
        action={
          <Button variant="outline" onClick={onDone}>
            Continuar de todas formas
          </Button>
        }
      />
    );
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        title="Aún no hay suficientes memorias"
        description="Cuando importes o conectes más, Savia sugerirá áreas. Por ahora puedes crearlas a mano."
        action={
          <Button colorPalette="ink" onClick={onDone}>
            Continuar
          </Button>
        }
      />
    );
  }

  const accepted = cards.filter((c) => c.accepted).length;

  return (
    <VStack align="stretch" gap="4">
      <Text fontSize="sm" color="fg.muted">
        Savia detectó <strong>{cards.length}</strong> áreas en tu memoria. Acepta, renombra
        o rechaza cada una — puedes editarlas luego.
      </Text>

      <VStack align="stretch" gap="3">
        {cards.map((card, i) => (
          <Card
            key={i}
            variant="flat"
            p="4"
            opacity={card.accepted ? 1 : 0.55}
            borderColor={card.accepted ? "ink" : "border.subtle"}
            transition="opacity 160ms, border-color 160ms"
          >
            <HStack justify="space-between" mb="2" gap="3">
              <HStack gap="3" flex="1" minW="0">
                <SpaceGlyph spaceId={card.name + i} name={card.customName} size={36} />
                <Input
                  value={card.customName}
                  onChange={(e) => rename(i, e.target.value)}
                  fontWeight="600"
                  variant="flushed"
                  disabled={!card.accepted}
                  maxW="14rem"
                />
                <Badge colorPalette="mist" variant="subtle" size="sm" flexShrink="0">
                  {card.memoryCount} mem.
                </Badge>
              </HStack>
              <Center
                as="button"
                onClick={() => toggle(i)}
                w="32px"
                h="32px"
                borderRadius="full"
                flexShrink="0"
                bg={card.accepted ? "ink" : "bg.subtle"}
                color={card.accepted ? "signalLime" : "fg.muted"}
                aria-label={card.accepted ? "Rechazar" : "Aceptar"}
              >
                {card.accepted ? <Check size={16} /> : <X size={16} />}
              </Center>
            </HStack>
            <VStack align="stretch" gap="1" pl="12">
              {card.examples.slice(0, 3).map((ex, j) => (
                <Text key={j} fontSize="xs" color="fg.muted" lineClamp={1}>
                  · {ex}
                </Text>
              ))}
            </VStack>
          </Card>
        ))}
      </VStack>

      <HStack justify="space-between">
        <Button variant="plain" color="fg.muted" onClick={onDone}>
          Saltar
        </Button>
        <Button colorPalette="ink" onClick={handleSave} loading={saving} disabled={accepted === 0}>
          Crear {accepted} space{accepted !== 1 ? "s" : ""}
        </Button>
      </HStack>
    </VStack>
  );
}
