"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SaviaMark } from "./savia-mark";

const NAV_LINKS = [
  { href: "/design-system", label: "Inicio" },
  { href: "/design-system/brand", label: "Marca" },
  { href: "/design-system/voice", label: "Voz" },
  { href: "/design-system/logo", label: "Logo" },
  { href: "/design-system/colors", label: "Color" },
  { href: "/design-system/typography", label: "Tipografía" },
  { href: "/design-system/tokens", label: "Tokens" },
  { href: "/design-system/buttons", label: "Botones" },
  { href: "/design-system/island", label: "Órbitas" },
  { href: "/design-system/isla", label: "Isla" },
];

export function DsNav() {
  const pathname = usePathname();

  return (
    <Box
      as="nav"
      position="sticky"
      top={0}
      zIndex={10}
      style={{
        background: "rgb(244 244 241 / 0.92)",
        backdropFilter: "saturate(180%) blur(20px)",
      }}
      borderBottom="1px solid"
      borderColor="border.subtle"
    >
      <Flex
        alignItems="center"
        justifyContent="space-between"
        maxW="containerWide"
        mx="auto"
        px={{ base: "5", md: "8" }}
        py="3"
      >
        <Link
          href="/design-system"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <SaviaMark size={18} color="#0B2529" />
          <Text
            as="span"
            fontSize="13px"
            fontWeight="600"
            letterSpacing="0.04em"
            color="fg"
          >
            SAVIA · Design System
          </Text>
        </Link>

        <Flex
          as="ul"
          gap="6"
          listStyleType="none"
          display={{ base: "none", md: "flex" }}
          p={0}
          m={0}
          overflowX="auto"
        >
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Box as="li" key={href} flexShrink={0}>
                <Link href={href} style={{ textDecoration: "none" }}>
                  <Text
                    as="span"
                    fontSize="13px"
                    fontWeight={isActive ? "600" : "500"}
                    color={isActive ? "fg" : "fg.muted"}
                    _hover={{ color: "fg" }}
                    transition="color 160ms ease"
                  >
                    {label}
                  </Text>
                </Link>
              </Box>
            );
          })}
        </Flex>
      </Flex>
    </Box>
  );
}
