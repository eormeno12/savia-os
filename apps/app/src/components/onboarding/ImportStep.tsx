"use client";

import { useState, useRef } from "react";
import {
  Box,
  Text,
  Button,
  VStack,
  HStack,
} from "@chakra-ui/react";
import { Upload } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  onDone: () => void;
}

export function ImportStep({ onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
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
    } catch (err: any) {
      setError(err.message ?? 'Error al importar el archivo');
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (result) {
    return (
      <VStack align="flex-start" gap="4">
        <Text fontSize="sm" fontWeight="600" color="fg">
          Export importado
        </Text>
        <Text fontSize="sm" color="fg.muted">
          Se encolaron <strong>{result.queued}</strong> conversaciones.
          Savia las procesa en segundo plano y extrae los hechos relevantes.
        </Text>
        <Button size="sm" onClick={onDone}>Continuar</Button>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" gap="4">
      <Text fontSize="sm" color="fg.muted">
        Descarga tu historial de ChatGPT desde{" "}
        <strong>Configuración → Exportar datos</strong>. Obtendrás un ZIP;
        extrae el archivo <strong>conversations.json</strong> y súbelo aquí.
      </Text>

      <Box
        border="2px dashed"
        borderColor={fileName ? "brand.solid" : "border.subtle"}
        borderRadius="lg"
        p="8"
        textAlign="center"
        cursor="pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        transition="border-color 0.15s"
        _hover={{ borderColor: "brand.solid" }}
      >
        <Upload size={24} style={{ margin: "0 auto 8px" }} />
        {fileName ? (
          <Text fontSize="sm" fontWeight="600" color="fg">{fileName}</Text>
        ) : (
          <>
            <Text fontSize="sm" color="fg" fontWeight="500">
              Arrastra conversations.json aquí
            </Text>
            <Text fontSize="xs" color="fg.muted">o haz clic para seleccionar</Text>
          </>
        )}
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
      />

      {error && (
        <Text fontSize="sm" color="red.500">{error}</Text>
      )}

      {fileName && !result && (
        <HStack>
          <Button size="sm" onClick={() => inputRef.current?.click()} variant="outline">
            Cambiar archivo
          </Button>
          {importing && (
            <Text fontSize="xs" color="fg.muted">Procesando…</Text>
          )}
        </HStack>
      )}
    </VStack>
  );
}
