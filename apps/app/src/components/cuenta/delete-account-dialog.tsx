"use client";

import { useEffect, useState } from "react";
import { Box, Button, Input, Stack, Text } from "@chakra-ui/react";
import { Dialog, Field, notify } from "@savia-os/ui";
import { api } from "@/lib/api";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The signed-in email — the user must retype it to confirm. */
  email: string;
  /** Called after the account is deleted (navigate to /login). */
  onDeleted: () => void;
}

const GONE = ["Toda tu memoria y tus áreas", "Tus conexiones con cada IA", "Tu historial y tu actividad"];

/**
 * Two-step account deletion: opening the dialog is step one; retyping the exact
 * email to arm the destructive button is step two. Matches the product's habit
 * of asking for real intent before anything irreversible (`DELETE /account`).
 */
export function DeleteAccountDialog({ open, onOpenChange, email, onDeleted }: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset the typed confirmation whenever the dialog closes.
  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  const matches = confirmText.trim().toLowerCase() === email.trim().toLowerCase() && email !== "";

  async function remove() {
    if (!matches) return;
    setBusy(true);
    try {
      await api.account.delete(email);
      onDeleted();
    } catch {
      setBusy(false);
      notify.error("No pudimos eliminar tu cuenta.", "Intenta de nuevo en un momento.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Eliminar tu cuenta"
      description="Esto borra toda tu memoria de forma permanente. No podemos recuperarla después."
      footer={
        <>
          <Button variant="ghost" colorPalette="mist" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button colorPalette="danger" onClick={remove} disabled={!matches} loading={busy}>
            Eliminar mi cuenta
          </Button>
        </>
      }
    >
      <Stack gap="4">
        <Stack gap="2" bg="danger.subtle" borderWidth="1px" borderColor="danger.border" rounded="xl" p="4">
          <Text textStyle="label" color="danger.fg">
            Se borra para siempre
          </Text>
          {GONE.map((g) => (
            <Text key={g} fontSize="13px" color="fg" lineHeight="1.5">
              {g}
            </Text>
          ))}
        </Stack>

        <Field label={<>Escribe <Box as="span" fontWeight="600" color="fg">{email || "tu email"}</Box> para confirmar</>}>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={email}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </Field>
      </Stack>
    </Dialog>
  );
}
