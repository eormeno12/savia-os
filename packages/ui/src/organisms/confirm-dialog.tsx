"use client";

import type { ReactNode } from "react";
import { Button } from "@chakra-ui/react";
import { Dialog } from "../molecules/dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Spell out the consequence — e.g. "Esto desconecta a Claude de 3 spaces". */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive actions (default), "default" otherwise. */
  tone?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * Styled confirmation — the replacement for every `window.confirm()`.
 * Destructive by default; the confirm button carries the danger palette.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            colorPalette="mist"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            colorPalette={tone === "danger" ? "danger" : "ink"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
