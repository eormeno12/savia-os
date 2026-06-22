"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
  Input,
  Spinner,
} from "@chakra-ui/react";
import { Check, X } from "lucide-react";
import { api, SuggestedSpace } from "@/lib/api";

interface SpaceCard extends SuggestedSpace {
  accepted: boolean;
  customName: string;
}

interface Props {
  onDone: () => void;
}

export function SuggestedSpaces({ onDone }: Props) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<SpaceCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.onboarding.suggestSpaces()
      .then((suggestions) => {
        setCards(suggestions.map((s) => ({
          ...s,
          accepted: true,
          customName: s.name,
        })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function toggle(i: number) {
    setCards((prev) => prev.map((c, idx) => idx === i ? { ...c, accepted: !c.accepted } : c));
  }

  function rename(i: number, name: string) {
    setCards((prev) => prev.map((c, idx) => idx === i ? { ...c, customName: name } : c));
  }

  async function handleSave() {
    const toCreate = cards.filter((c) => c.accepted && c.customName.trim());
    if (toCreate.length === 0) { onDone(); return; }
    setSaving(true);
    try {
      await Promise.all(
        toCreate.map((c) => api.spaces.create(c.description)),
      );
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <VStack gap="3" py="6">
        <Spinner size="md" />
        <Text fontSize="sm" color="fg.muted">
          Analizando tus memorias y sugiriendo spaces…
        </Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <VStack align="flex-start" gap="3">
        <Text fontSize="sm" color="red.500">{error}</Text>
        <Button size="sm" onClick={onDone} variant="outline">Saltar</Button>
      </VStack>
    );
  }

  if (cards.length === 0) {
    return (
      <VStack align="flex-start" gap="3">
        <Text fontSize="sm" color="fg.muted">
          Aún no hay suficientes memorias para sugerir spaces. Puedes crearlos manualmente.
        </Text>
        <Button size="sm" onClick={onDone}>Continuar</Button>
      </VStack>
    );
  }

  const accepted = cards.filter((c) => c.accepted).length;

  return (
    <VStack align="stretch" gap="4">
      <Text fontSize="sm" color="fg.muted">
        Savia detectó <strong>{cards.length}</strong> áreas en tu memoria.
        Acepta o rechaza cada una — puedes editarlas luego.
      </Text>

      <VStack align="stretch" gap="3">
        {cards.map((card, i) => (
          <Box
            key={i}
            border="1px solid"
            borderColor={card.accepted ? "brand.solid" : "border.subtle"}
            borderRadius="lg"
            p="4"
            opacity={card.accepted ? 1 : 0.5}
            transition="all 0.15s"
          >
            <HStack justify="space-between" mb="2">
              <HStack gap="2">
                <Input
                  value={card.customName}
                  onChange={(e) => rename(i, e.target.value)}
                  fontSize="sm"
                  fontWeight="600"
                  border="none"
                  p="0"
                  h="auto"
                  bg="transparent"
                  color="fg"
                  _focus={{ outline: "none" }}
                  disabled={!card.accepted}
                />
                <Badge
                  colorPalette="blue"
                  variant="subtle"
                  size="sm"
                  flexShrink={0}
                >
                  {card.memoryCount} mem.
                </Badge>
              </HStack>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => toggle(i)}
                color={card.accepted ? "green.500" : "fg.muted"}
              >
                {card.accepted ? <Check size={14} /> : <X size={14} />}
              </Button>
            </HStack>

            <VStack align="stretch" gap="1">
              {card.examples.map((ex, j) => (
                <Text
                  key={j}
                  fontSize="xs"
                  color="fg.muted"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  · {ex}
                </Text>
              ))}
            </VStack>
          </Box>
        ))}
      </VStack>

      <HStack justify="flex-end" gap="2">
        <Button variant="ghost" size="sm" onClick={onDone}>Saltar</Button>
        <Button
          size="sm"
          onClick={handleSave}
          loading={saving}
          disabled={accepted === 0}
        >
          Crear {accepted} space{accepted !== 1 ? 's' : ''}
        </Button>
      </HStack>
    </VStack>
  );
}
