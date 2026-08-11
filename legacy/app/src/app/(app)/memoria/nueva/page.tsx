"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, HStack, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { Dialog, Field, notify } from "@savia-os/ui";
import { api, ApiError } from "@/lib/api";

/**
 * M3 — Create area (modal). Mounted as its own route so the URL is shareable;
 * closing returns to the map. The backend infers a name from the description,
 * so an explicit name is applied with a follow-up rename when given.
 */
export default function CrearAreaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => router.push("/memoria");

  async function submit() {
    if (name.trim().length < 2) {
      setError("Ponle un nombre al área.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const seed = description.trim() || name.trim();
      const space = await api.areas.create(seed);
      if (space.name !== name.trim()) {
        await api.areas.update(space.id, { name: name.trim() });
      }
      notify.success("Área creada", `«${name.trim()}» ya vive en tu memoria.`);
      router.push(`/memoria/${space.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear el área.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && close()} size="md">
      <Stack gap="0">
        <Text textStyle="label" color="fg.muted">
          Nuevo lugar en tu memoria
        </Text>
        <Text fontWeight="300" fontSize="titleLg" lineHeight="1.05" color="fg" mt="3">
          Crear un área.
        </Text>
        <Text fontSize="14px" color="fg.muted" lineHeight="1.55" mt="2.5">
          Solo nómbrala. Savia la irá llenando por clasificación a medida que tus IAs y fuentes
          aporten.
        </Text>

        <Stack gap="4" mt="6">
          <Field label="Nombre" error={error ?? undefined} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Inversiones"
              autoFocus
            />
          </Field>
          <Field label="¿De qué va? (opcional)">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Decisiones de inversión, carteras y notas de mercado."
              rows={3}
              resize="none"
            />
          </Field>
        </Stack>

        <HStack gap="3" mt="6">
          <Button flex="1" variant="outline" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button flex="1.4" colorPalette="ink" onClick={submit} loading={saving}>
            Crear área
          </Button>
        </HStack>
      </Stack>
      <Box />
    </Dialog>
  );
}
