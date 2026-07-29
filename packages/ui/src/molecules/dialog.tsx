"use client";

import type { ReactNode } from "react";
import { Dialog as CkDialog, IconButton, Portal } from "@chakra-ui/react";
import { X } from "lucide-react";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "cover" | "full";
  /** Hide the top-right close affordance (e.g. for forced-choice dialogs). */
  hideCloseButton?: boolean;
}

/**
 * Controlled dialog built on Chakra v3's Dialog — focus trap, Esc-to-close,
 * scroll lock and a scale motion preset come for free. Replaces every
 * `window.confirm` and the hand-rolled inline modal.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  hideCloseButton = false,
}: DialogProps) {
  return (
    <CkDialog.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      size={size}
      placement="center"
      motionPreset="scale"
    >
      <Portal>
        <CkDialog.Backdrop bg="ink/40" backdropFilter="blur(6px)" />
        <CkDialog.Positioner>
          <CkDialog.Content
            borderRadius="card"
            bg="bg"
            boxShadow="float"
            overflow="hidden"
          >
            {title ? (
              <CkDialog.Header pb={description ? "2" : undefined}>
                <CkDialog.Title textStyle="cardTitle">{title}</CkDialog.Title>
              </CkDialog.Header>
            ) : null}
            <CkDialog.Body>
              {description ? (
                <CkDialog.Description color="fg.muted" mb={children ? "4" : "0"}>
                  {description}
                </CkDialog.Description>
              ) : null}
              {children}
            </CkDialog.Body>
            {footer ? <CkDialog.Footer gap="3">{footer}</CkDialog.Footer> : null}
            {!hideCloseButton ? (
              <CkDialog.CloseTrigger asChild>
                <IconButton
                  aria-label="Cerrar"
                  variant="ghost"
                  size="sm"
                  position="absolute"
                  top="3"
                  insetEnd="3"
                >
                  <X size={18} />
                </IconButton>
              </CkDialog.CloseTrigger>
            ) : null}
          </CkDialog.Content>
        </CkDialog.Positioner>
      </Portal>
    </CkDialog.Root>
  );
}
