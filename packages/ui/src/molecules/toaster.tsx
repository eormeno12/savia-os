"use client";

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react";

/**
 * Single global toaster instance. Show toasts from anywhere via the `notify`
 * helpers below; the visual `<Toaster />` mounts once in SaviaProvider.
 */
export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
  gap: 12,
});

/** Brand-shaped convenience API over `toaster.create`. */
export const notify = {
  success: (title: string, description?: string) =>
    toaster.create({ title, description, type: "success" }),
  error: (title: string, description?: string) =>
    toaster.create({ title, description, type: "error" }),
  info: (title: string, description?: string) =>
    toaster.create({ title, description, type: "info" }),
  warning: (title: string, description?: string) =>
    toaster.create({ title, description, type: "warning" }),
  loading: (title: string, description?: string) =>
    toaster.create({ title, description, type: "loading" }),
};

export function Toaster() {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root
            width={{ md: "sm" }}
            borderRadius="message"
            boxShadow="float"
          >
            {toast.type === "loading" ? (
              <Spinner size="sm" color="fg.muted" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxW="full">
              {toast.title ? (
                <Toast.Title textStyle="cardTitle" fontSize="sm">
                  {toast.title}
                </Toast.Title>
              ) : null}
              {toast.description ? (
                <Toast.Description color="fg.muted" fontSize="sm">
                  {toast.description}
                </Toast.Description>
              ) : null}
            </Stack>
            {toast.action ? (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            ) : null}
            {toast.closable ? <Toast.CloseTrigger /> : null}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
}
