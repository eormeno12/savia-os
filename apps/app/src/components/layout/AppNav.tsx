"use client";

import { Box, HStack, Text, Button } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HardDrive, LogOut, Layers } from "lucide-react";
import { api } from "@/lib/api";

const navItems = [
  { href: "/drive", label: "Drive", icon: <HardDrive size={16} /> },
  { href: "/spaces", label: "Spaces", icon: <Layers size={16} /> },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await api.logout().catch(() => null);
    router.push("/login");
  }

  return (
    <Box
      as="nav"
      borderBottom="1px solid"
      borderColor="border.subtle"
      bg="bg"
      px={{ base: 4, md: 8 }}
      py="3"
    >
      <HStack justify="space-between" maxW="1280px" mx="auto">
        <HStack gap="6">
          <Text fontWeight="700" fontSize="sm" letterSpacing="-0.02em" color="fg">
            savia
          </Text>
          <HStack gap="1">
            {navItems.map(({ href, label, icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href}>
                  <HStack
                    gap="2"
                    px="3"
                    py="1.5"
                    borderRadius="md"
                    fontSize="sm"
                    fontWeight="500"
                    color={active ? "fg" : "fg.muted"}
                    bg={active ? "bg.subtle" : "transparent"}
                    _hover={{ bg: "bg.subtle", color: "fg" }}
                    transition="all 0.1s"
                  >
                    {icon}
                    <Text>{label}</Text>
                  </HStack>
                </Link>
              );
            })}
          </HStack>
        </HStack>

        <Button variant="ghost" size="sm" color="fg.muted" onClick={handleLogout}>
          <HStack gap="1.5">
            <LogOut size={14} />
            <Text>Salir</Text>
          </HStack>
        </Button>
      </HStack>
    </Box>
  );
}
