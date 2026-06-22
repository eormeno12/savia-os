"use client";

import { useState } from "react";
import {
  Box,
  Text,
  Textarea,
  Button,
  VStack,
  HStack,
  Code,
  IconButton,
} from "@chakra-ui/react";
import { Copy, Check } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  onDone: () => void;
}

export function RescueStep({ onDone }: Props) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
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

  async function copyPrompt() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  async function handleIngest() {
    if (!rescueText.trim() || rescueText.length < 10) return;
    setIngesting(true);
    try {
      const res = await api.onboarding.ingestRescue(rescueText.trim());
      setResult(res);
    } finally {
      setIngesting(false);
    }
  }

  if (result) {
    return (
      <VStack align="flex-start" gap="4">
        <Text fontSize="sm" fontWeight="600" color="fg">
          ¡Memoria importada!
        </Text>
        <Text fontSize="sm" color="fg.muted">
          Se crearon <strong>{result.count}</strong> recuerdos a partir de tu respuesta.
          Savia los está clasificando en tus spaces en segundo plano.
        </Text>
        <Button size="sm" onClick={onDone}>Continuar</Button>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap="5">
      <Box>
        <Text fontSize="sm" color="fg.muted" mb="3">
          Pega este prompt en tu IA actual (ChatGPT, Claude, Gemini…) y copia
          la respuesta aquí abajo.
        </Text>

        {!prompt ? (
          <Button size="sm" onClick={loadPrompt} loading={loadingPrompt}>
            Generar prompt de rescate
          </Button>
        ) : (
          <Box
            position="relative"
            bg="bg.subtle"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="md"
            p="3"
          >
            <Box
              as="pre"
              fontSize="xs"
              fontFamily="mono"
              whiteSpace="pre-wrap"
              color="fg"
              pr="8"
              maxH="200px"
              overflowY="auto"
            >
              {prompt}
            </Box>
            <IconButton
              position="absolute"
              top="2"
              right="2"
              size="xs"
              variant="ghost"
              aria-label="Copiar prompt"
              onClick={copyPrompt}
            >
              {copiedPrompt ? <Check size={12} /> : <Copy size={12} />}
            </IconButton>
          </Box>
        )}
      </Box>

      {prompt && (
        <Box>
          <Text fontSize="xs" color="fg.muted" mb="2">
            Pega aquí la respuesta de tu IA:
          </Text>
          <Textarea
            value={rescueText}
            onChange={(e) => setRescueText(e.target.value)}
            placeholder="Pega la respuesta de tu IA aquí…"
            rows={8}
            fontSize="sm"
            mb="3"
          />
          <HStack>
            <Button
              size="sm"
              onClick={handleIngest}
              loading={ingesting}
              disabled={rescueText.length < 10}
            >
              Importar a Savia
            </Button>
          </HStack>
        </Box>
      )}
    </VStack>
  );
}
