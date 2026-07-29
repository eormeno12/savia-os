"use client";

import { useState, useRef } from "react";
import { Box, Text, Button, VStack, HStack, Center } from "@chakra-ui/react";
import { Upload, FileJson, Sparkles } from "lucide-react";
import { Card, FadeInUp, notify } from "@savia-os/ui";
import { api } from "@/lib/api";

interface Props {
  onDone: () => void;
}

export function ImportStep({ onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{ queued: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setImporting(true);
    try {
      const content = await file.text();
      const res = await api.onboarding.importChatGpt(content);
      setResult(res);
      notify.success(`${res.queued} conversaciones en cola`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar el archivo");
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
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
                {result.queued}
              </Text>
              <Text textStyle="cardTitle" mt="1">
                conversaciones en cola
              </Text>
            </Box>
            <Text fontSize="sm" color="fg.inverse/70" maxW="sm">
              Savia las procesa en segundo plano y extrae los hechos relevantes — sin
              guardar las conversaciones completas.
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
    <VStack align="stretch" gap="4">
      <Text fontSize="sm" color="fg.muted">
        Descarga tu historial desde <strong>ChatGPT → Configuración → Exportar datos</strong>.
        Extrae <strong>conversations.json</strong> del ZIP y súbelo aquí.
      </Text>

      <Box
        borderWidth="2px"
        borderStyle="dashed"
        borderColor={dragging || fileName ? "lime.solid" : "border"}
        bg={dragging ? "lime.subtle" : "bg"}
        borderRadius="card"
        p="10"
        textAlign="center"
        cursor="pointer"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        transition="border-color 160ms, background 160ms"
        _hover={{ borderColor: "lime.solid" }}
      >
        <Center mb="3">
          {fileName ? <FileJson size={28} /> : <Upload size={28} />}
        </Center>
        {fileName ? (
          <Text fontSize="sm" fontWeight="600">
            {fileName}
          </Text>
        ) : (
          <>
            <Text fontSize="sm" fontWeight="600">
              Arrastra conversations.json aquí
            </Text>
            <Text fontSize="sm" color="fg.muted">
              o haz clic para seleccionar
            </Text>
          </>
        )}
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.[0]) void handleFile(e.target.files[0]);
        }}
      />

      {error ? (
        <Text fontSize="sm" color="danger.fg">
          {error}
        </Text>
      ) : null}

      {fileName ? (
        <HStack>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            Cambiar archivo
          </Button>
          {importing ? (
            <Text fontSize="sm" color="fg.muted">
              Procesando…
            </Text>
          ) : null}
        </HStack>
      ) : null}
    </VStack>
  );
}
