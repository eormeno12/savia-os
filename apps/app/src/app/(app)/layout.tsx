import { Box } from "@chakra-ui/react";
import { AppNav } from "@/components/layout/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box minH="100vh" bg="bg.subtle" display="flex" flexDir="column">
      <AppNav />
      <Box flex="1" maxW="1280px" mx="auto" w="full" px={{ base: 4, md: 8 }} py="8">
        {children}
      </Box>
    </Box>
  );
}
