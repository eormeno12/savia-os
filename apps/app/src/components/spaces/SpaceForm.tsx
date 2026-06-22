"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Textarea,
  Text,
  Spinner,
  Input,
} from "@chakra-ui/react";
import { api } from "@/lib/api";

interface Props {
  onCreated: () => void;
}

export function SpaceForm({ onCreated }: Props) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError("La descripción debe tener al menos 10 caracteres");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.spaces.create(description.trim());
      setDescription("");
      onCreated();
    } catch (err: any) {
      setError(err.message ?? "Error al crear el space");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="card"
      p="6"
      bg="bg"
    >
      <Text fontWeight="600" fontSize="sm" color="fg" mb="3">
        Nuevo space
      </Text>
      <Text fontSize="xs" color="fg.muted" mb="2">
        Describe este espacio en lenguaje natural
      </Text>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder='Ej: "Todo sobre mi trabajo: proyectos, reuniones, tareas, carrera profesional y mis colegas de equipo."'
        rows={3}
        fontSize="sm"
        mb="3"
        resize="vertical"
        disabled={loading}
      />
      {error && (
        <Text fontSize="xs" color="red.500" mb="2">{error}</Text>
      )}
      <Button
        type="submit"
        size="sm"
        loading={loading}
        loadingText="Creando…"
        disabled={description.trim().length < 10}
      >
        Crear space
      </Button>
    </Box>
  );
}
