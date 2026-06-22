"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, SimpleGrid, Text, Spinner } from "@chakra-ui/react";
import { api } from "@/lib/api";
import { FileCard } from "./FileCard";
import { UploadButton } from "./UploadButton";

type FileItem = Awaited<ReturnType<typeof api.files.list>>[number];

export function FileGrid() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    try {
      setFiles(await api.files.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este archivo y sus memorias?")) return;
    await api.files.delete(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="16">
        <Spinner color="fg.muted" />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb="6">
        <Text textStyle="titleLg" fontWeight="600" color="fg">Tus archivos</Text>
        <UploadButton onUploaded={fetchFiles} />
      </Box>

      {files.length === 0 ? (
        <Box
          border="1px dashed"
          borderColor="border.subtle"
          borderRadius="card"
          p="12"
          textAlign="center"
        >
          <Text color="fg.muted">Aún no hay archivos. Sube algo para empezar.</Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap="4">
          {files.map((f) => (
            <FileCard
              key={f.id}
              {...f}
              onDelete={handleDelete}
            />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
