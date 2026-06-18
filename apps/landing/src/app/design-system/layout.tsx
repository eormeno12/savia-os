import { Box } from "@chakra-ui/react";
import { DsNav } from "@/components/design-system/ds-nav";

export const metadata = {
  title: { default: "Design System", template: "%s · Savia DS" },
};

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DsNav />
      <Box as="main" minH="100dvh">
        {children}
      </Box>
      <Box
        as="footer"
        px={{ base: "5", md: "8" }}
        py="8"
        borderTop="1px solid"
        borderColor="border.subtle"
      >
        <Box
          fontSize="11px"
          color="fg.muted"
          letterSpacing="0.08em"
          fontWeight="500"
          textTransform="uppercase"
        >
          Savia Design System · 2026
        </Box>
      </Box>
    </>
  );
}
