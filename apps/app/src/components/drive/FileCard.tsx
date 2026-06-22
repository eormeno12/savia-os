"use client";

import { Box, Text, HStack, IconButton } from "@chakra-ui/react";
import { FileText, Trash2, Clock, CheckCircle, AlertCircle, Loader } from "lucide-react";

type FileStatus = "pending" | "processing" | "indexed" | "failed";

interface FileCardProps {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  memoryCount?: number;
  createdAt: string;
  onDelete: (id: string) => void;
}

function StatusBadge({ status }: { status: FileStatus }) {
  const map: Record<FileStatus, { label: string; color: string; icon: React.ReactNode }> = {
    pending:    { label: "Pendiente",    color: "fg.muted",   icon: <Clock size={14} /> },
    processing: { label: "Procesando…", color: "orange.500", icon: <Loader size={14} /> },
    indexed:    { label: "Indexado",    color: "green.600",  icon: <CheckCircle size={14} /> },
    failed:     { label: "Error",       color: "red.500",    icon: <AlertCircle size={14} /> },
  };
  const { label, color, icon } = map[status];
  return (
    <HStack gap="1" color={color} fontSize="xs" fontWeight="500">
      {icon}
      <Text>{label}</Text>
    </HStack>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileCard({ id, name, sizeBytes, status, memoryCount, onDelete }: FileCardProps) {
  return (
    <Box
      bg="bg"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="card"
      p="5"
      display="flex"
      flexDir="column"
      gap="3"
    >
      <HStack justify="space-between" align="flex-start">
        <HStack gap="3" flex="1" minW="0">
          <Box color="fg.muted" flexShrink={0}>
            <FileText size={20} />
          </Box>
          <Text fontWeight="500" color="fg" fontSize="sm" truncate>
            {name}
          </Text>
        </HStack>
        <IconButton
          aria-label="Eliminar archivo"
          variant="ghost"
          size="sm"
          color="fg.muted"
          onClick={() => onDelete(id)}
        >
          <Trash2 size={16} />
        </IconButton>
      </HStack>

      <HStack justify="space-between">
        <StatusBadge status={status} />
        <Text color="fg.muted" fontSize="xs">{formatBytes(sizeBytes)}</Text>
      </HStack>

      {status === "indexed" && memoryCount !== undefined && (
        <Text color="fg.muted" fontSize="xs">
          {memoryCount} {memoryCount === 1 ? "memoria extraída" : "memorias extraídas"}
        </Text>
      )}
    </Box>
  );
}
