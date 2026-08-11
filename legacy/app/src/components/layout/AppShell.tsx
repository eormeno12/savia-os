"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Button, HStack, IconButton, Kbd, Stack, Text } from "@chakra-ui/react";
import { Bell, Bookmark, HelpCircle, Search, Zap } from "lucide-react";
import {
  Avatar,
  CommandPalette,
  NavItem,
  Shell,
  type CommandItem,
  type ShellTone,
} from "@savia-os/ui";
import type { LensDto } from "@savia-os/legacy-contracts";
import { api } from "@/lib/api";
import { NAV_ENTRIES, isActive } from "@/lib/nav";

/** Routes that render the shell chrome on ink (the signature dark surfaces). */
const DARK_ROUTES = ["/pulso"];

/**
 * Client shell that wires the generic `Shell` to the app: active nav, the ⌘K
 * command palette, top-bar actions and the account row. Page content is the
 * server-rendered `children`. The shell tone follows the route so accent
 * surfaces (Pulso) get the whole chrome on ink.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [areas, setAreas] = useState<{ spaceId: string; name: string }[]>([]);
  const [lenses, setLenses] = useState<LensDto[]>([]);
  const [unread, setUnread] = useState(0);

  const tone: ShellTone = DARK_ROUTES.some((r) => pathname.startsWith(r)) ? "dark" : "light";
  const dark = tone === "dark";

  // Refetch the ambient rail data whenever the route changes, so newly-saved
  // searches, fresh areas and read notifications stay in sync as the user moves.
  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
    api.growth.areas().then(setAreas).catch(() => setAreas([]));
    api.lenses.list().then(setLenses).catch(() => setLenses([]));
    api.inbox
      .list()
      .then((items) => setUnread(items.filter((i) => !i.seen).length))
      .catch(() => setUnread(0));
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commandItems = useMemo<CommandItem[]>(
    () => [
      ...NAV_ENTRIES.map((e) => ({ value: e.href, label: e.label, group: "Ir a" })),
      ...areas.map((a) => ({ value: `/memoria/${a.spaceId}`, label: a.name, group: "Área" })),
    ],
    [areas],
  );

  const nav = (
    <>
      {NAV_ENTRIES.map((e) => (
        <NavItem key={e.href} asChild tone={tone} active={isActive(pathname, e.href)}>
          <Link href={e.href}>
            {e.icon}
            {e.label}
          </Link>
        </NavItem>
      ))}

      {lenses.length > 0 ? (
        <Stack gap="0.5" mt="6">
          <Text
            textStyle="label"
            color={dark ? "fg.inverse/50" : "fg.muted"}
            px="3"
            pb="1.5"
          >
            Búsquedas guardadas
          </Text>
          {lenses.slice(0, 5).map((l) => (
            <NavItem
              key={l.id}
              asChild
              tone={tone}
              active={pathname === `/memoria/busquedas/${l.id}`}
            >
              <Link href={`/memoria/busquedas/${l.id}`}>
                <Bookmark size={16} />
                {l.name}
              </Link>
            </NavItem>
          ))}
        </Stack>
      ) : null}
    </>
  );

  const railFooter = (
    <HStack gap="2.5" pt="3" borderTopWidth="1px" borderColor={dark ? "border.inverse" : "border"}>
      <Avatar size="sm" name={user?.email ?? "?"} />
      <Box minW="0">
        <Text fontSize="13px" fontWeight="500" color={dark ? "fg.inverse" : "fg"} truncate>
          {user?.email?.split("@")[0] ?? "Tu cuenta"}
        </Text>
        <Text fontSize="11px" color={dark ? "fg.inverse/60" : "fg.muted"} truncate>
          {user?.email ?? "—"}
        </Text>
      </Box>
    </HStack>
  );

  const search = (
    <HStack
      as="button"
      onClick={() => setPaletteOpen(true)}
      w="full"
      gap="2.5"
      bg={dark ? "fg.inverse/8" : "bg"}
      borderWidth="1px"
      borderColor={dark ? "border.inverse" : "border"}
      rounded="xl"
      px="3.5"
      py="2.5"
      color={dark ? "fg.inverse/60" : "fg.muted"}
      cursor="pointer"
      _hover={{ borderColor: dark ? "fg.inverse/25" : "fg.subtle" }}
    >
      <Search size={18} />
      <Box as="span" flex="1" textAlign="start" fontSize="15px">
        Busca cualquier recuerdo o área…
      </Box>
      <Kbd>⌘K</Kbd>
    </HStack>
  );

  const actions = (
    <>
      <IconButton
        aria-label="Ayuda y soporte"
        variant="outline"
        rounded="xl"
        color={dark ? "fg.inverse" : undefined}
        borderColor={dark ? "border.inverse" : undefined}
        asChild
      >
        <Link href="/cuenta">
          <HelpCircle size={18} />
        </Link>
      </IconButton>
      <Box position="relative">
        <IconButton
          aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
          variant="outline"
          rounded="xl"
          color={dark ? "fg.inverse" : undefined}
          borderColor={dark ? "border.inverse" : undefined}
          asChild
        >
          <Link href="/bandeja">
            <Bell size={18} />
          </Link>
        </IconButton>
        {unread > 0 ? (
          <Box
            position="absolute"
            top="1.5"
            right="2"
            w="2"
            h="2"
            rounded="full"
            bg={dark ? "lime.solid" : "fg"}
            borderWidth="1.5px"
            borderColor={dark ? "bg.inverse" : "bg.panel"}
          />
        ) : null}
      </Box>
      <Button colorPalette={dark ? "lime" : "ink"} asChild>
        <Link href="/conexiones/nueva">
          <Zap size={16} /> Conectar IA
        </Link>
      </Button>
    </>
  );

  return (
    <>
      <Shell nav={nav} railFooter={railFooter} search={search} actions={actions} tone={tone}>
        {children}
      </Shell>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={commandItems}
        placeholder="Busca cualquier recuerdo o área…"
        onSelect={(value) => router.push(value)}
        onSubmitQuery={(q) => router.push(`/memoria/resultados?q=${encodeURIComponent(q)}`)}
      />
    </>
  );
}
