"use client";

import { useState } from "react";
import {
  Box,
  Drawer,
  Flex,
  HStack,
  IconButton,
  Portal,
  Stack,
} from "@chakra-ui/react";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { SaviaMark } from "../atoms/savia-mark";

export type ShellTone = "light" | "dark";

export interface ShellProps {
  /** Nav items — the app provides a NavItem/<Link> list. */
  nav: ReactNode;
  /** Bottom-of-rail slot: account row, Connect-IA promo, or IA status. */
  railFooter?: ReactNode;
  /** Prominent search field or ⌘K trigger for the top bar. */
  search?: ReactNode;
  /** Right-aligned top-bar actions: help, notification bell, Connect-IA. */
  actions?: ReactNode;
  /** Brand wordmark text beside the mark. */
  brand?: ReactNode;
  /**
   * Surface tone. `light` = paper canvas + white rail/top bar (default).
   * `dark` = the whole chrome on ink — the signature treatment for Pulso and
   * other accent screens. The app picks tone per route; NavItems get the same
   * tone so their active state matches.
   */
  tone?: ShellTone;
  children: ReactNode;
}

/** Brand lockup (mark + wordmark), shared by the rail and the mobile drawer. */
function Brand({ brand, dark }: { brand: ReactNode; dark: boolean }) {
  return (
    <HStack px="2" pb="6" gap="2.5">
      <SaviaMark size={24} color={dark ? "var(--chakra-colors-lime-solid)" : undefined} />
      <Box
        as="span"
        fontWeight="600"
        fontSize="17px"
        letterSpacing="0.09em"
        textTransform="uppercase"
        color={dark ? "fg.inverse" : "fg"}
      >
        {brand}
      </Box>
    </HStack>
  );
}

/**
 * Authenticated app shell (S1): sticky rail (brand + nav + footer) and sticky
 * top bar (search + actions) over the canvas. Generic — all product wiring
 * (routes, bell, account) is injected via props.
 *
 * On mobile the rail collapses into a hamburger-triggered drawer (same nav +
 * footer), so navigation is never lost on small screens.
 */
export function Shell({
  nav,
  railFooter,
  search,
  actions,
  brand = "Savia",
  tone = "light",
  children,
}: ShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dark = tone === "dark";

  const surface = dark ? "bg.inverse" : "bg.panel";
  const edge = dark ? "border.inverse" : "border";

  return (
    <Flex minH="100dvh" bg={dark ? "bg.inverse" : "bg"}>
      <Stack
        as="aside"
        display={{ base: "none", md: "flex" }}
        w="60"
        flexShrink={0}
        gap="0"
        px="4"
        py="6"
        position="sticky"
        top="0"
        h="100dvh"
        bg={surface}
        borderRightWidth="1px"
        borderColor={edge}
      >
        <Brand brand={brand} dark={dark} />

        <Stack as="nav" gap="1">
          {nav}
        </Stack>

        {railFooter != null && (
          <Box mt="auto" pt="4">
            {railFooter}
          </Box>
        )}
      </Stack>

      <Flex direction="column" flex="1" minW="0">
        <HStack
          as="header"
          h="18"
          px={{ base: "4", md: "6" }}
          gap="4"
          position="sticky"
          top="0"
          zIndex="docked"
          bg={surface}
          borderBottomWidth="1px"
          borderColor={edge}
        >
          <IconButton
            aria-label="Abrir navegación"
            variant="outline"
            rounded="xl"
            display={{ base: "inline-flex", md: "none" }}
            color={dark ? "fg.inverse" : undefined}
            borderColor={dark ? "border.inverse" : undefined}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={18} />
          </IconButton>
          <Box flex="1" maxW="560px">
            {search}
          </Box>
          <HStack gap="3" ms="auto">
            {actions}
          </HStack>
        </HStack>

        <Box as="main" flex="1" px={{ base: "4", md: "14" }} py={{ base: "6", md: "12" }}>
          {children}
        </Box>
      </Flex>

      {/* Mobile navigation drawer — same nav + footer as the rail. */}
      <Drawer.Root
        open={drawerOpen}
        onOpenChange={(e) => setDrawerOpen(e.open)}
        placement="start"
      >
        <Portal>
          <Drawer.Backdrop bg="ink/40" backdropFilter="blur(4px)" />
          <Drawer.Positioner>
            <Drawer.Content bg={surface} maxW="17rem">
              <Drawer.Body
                display="flex"
                flexDirection="column"
                gap="0"
                px="4"
                py="6"
                onClick={() => setDrawerOpen(false)}
              >
                <Brand brand={brand} dark={dark} />
                <Stack as="nav" gap="1">
                  {nav}
                </Stack>
                {railFooter != null && (
                  <Box mt="auto" pt="4">
                    {railFooter}
                  </Box>
                )}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Flex>
  );
}
