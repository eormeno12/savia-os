"use client";

import { useRef, useState } from "react";
import { Button, Text, Box } from "@chakra-ui/react";
import { Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "application/json",
];
const MAX_BYTES = 20 * 1024 * 1024;

interface UploadButtonProps {
  onUploaded: () => void;
}

export function UploadButton({ onUploaded }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Tipo de archivo no permitido (PDF, TXT, MD, DOCX, CSV, JSON).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("El archivo supera los 20 MB.");
      return;
    }

    try {
      setProgress(0);
      const { uploadUrl, fields, s3Key } = await api.files.presign(file.name, file.type, file.size);

      await uploadToS3(uploadUrl, fields, file, setProgress);

      await api.files.create(file.name, file.type, file.size, s3Key);
      setProgress(null);
      onUploaded();
    } catch (err) {
      setProgress(null);
      setError(err instanceof ApiError ? err.message : "Error al subir el archivo.");
    }
  }

  return (
    <Box>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,.docx,.csv,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        colorPalette="lime"
        variant="solid"
        onClick={() => inputRef.current?.click()}
        loading={progress !== null}
        loadingText={progress !== null ? `${progress}%` : undefined}
      >
        <Upload size={16} />
        Subir archivo
      </Button>
      {error && (
        <Text color="red.500" fontSize="sm" mt="2">{error}</Text>
      )}
    </Box>
  );
}

function uploadToS3(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`S3 ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}
