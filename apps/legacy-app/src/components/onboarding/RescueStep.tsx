"use client";

import { useState } from "react";
import { Box, Text, Textarea, Button, VStack, Center } from "@chakra-ui/react";
import { Sparkles } from "lucide-react";
import { Card, CopyBlock, FadeInUp, Field, notify } from "@savia-os/ui";
import { api } from "@/lib/api";

interface Props {
  onDone: () => void;
}

export function RescueStep({ onDone }: Props) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [rescueText, setRescueText] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);

  async function loadPrompt() {
    setLoadingPrompt(true);
    try {
      const res = await api.onboarding.rescuePrompt();
      setPrompt(res.prompt);
    } finally {
      setLoadingPrompt(false);
    }
  }

  async function handleIngest() {
    if (rescueText.trim().length < 10) return;
    setIngesting(true);
    try {
      const res = await api.onboarding.ingestRescue(rescueText.trim());
      setResult(res);
      notify.success(`${res.count} recuerdos creados`);
    } finally {
      setIngesting(false);
    }
  }

  if (result) {
    return (
      <FadeInUp>
        <Card variant="inverse" p="8">
          <VStack gap="4" textAlign="center">
            <Center w="56px" h="56px" borderRadius="card" bg="signalLime" color="ink">
              <Sparkles size={26} />
            </Center>
            <Box>
              <Text textStyle="metric" fontSize="5xl" color="signalLime">
                {result.count}
              </Text>
              <Text textStyle="cardTitle" mt="1">
                recuerdos creados
              </Text>
            </Box>
            <Text fontSize="sm" color="fg.inverse/70" maxW="sm">
              Savia los está clasificando en tus spaces en segundo plano. Tu memoria
              acaba de encenderse.
            </Text>
            <Button colorPalette="lime" onClick={onDone}>
              Continuar
            </Button>
          </VStack>
        </Card>
      </FadeInUp>
    );
  }

  return (
    <VStack align="stretch" gap="5">
      {!prompt ? (
        <Card variant="flat" p="6">
          <VStack gap="3" align="flex-start">
            <Text fontSize="sm" color="fg.muted">
              Genera un prompt, pégalo en tu IA actual (ChatGPT, Claude, Gemini…) y trae
              la respuesta de vuelta aquí.
            </Text>
            <Button colorPalette="ink" onClick={loadPrompt} loading={loadingPrompt}>
              Generar prompt de rescate
            </Button>
          </VStack>
        </Card>
      ) : (
        <VStack align="stretch" gap="5">
          <Box>
            <Text textStyle="label" color="fg.muted" mb="2">
              1 · Copia y pégalo en tu IA
            </Text>
            <CopyBlock value={prompt} copyLabel="Copiar prompt" />
          </Box>
          <Field label="2 · Pega aquí la respuesta de tu IA">
            <Textarea
              value={rescueText}
              onChange={(e) => setRescueText(e.target.value)}
              placeholder="Pega la respuesta completa de tu IA…"
              rows={7}
              fontSize="sm"
              borderRadius="message"
            />
          </Field>
          <Button
            colorPalette="ink"
            alignSelf="flex-start"
            onClick={handleIngest}
            loading={ingesting}
            loadingText="Importando…"
            disabled={rescueText.trim().length < 10}
          >
            Importar a Savia
          </Button>
        </VStack>
      )}
    </VStack>
  );
}
