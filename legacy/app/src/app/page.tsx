import { Box, VStack, Text } from "@chakra-ui/react";
import { SaviaMark } from "@savia-os/ui";

export default function Home() {
  return (
    <Box
      as="main"
      minH="100svh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="bg.inverse"
      color="fg.inverse"
    >
      <VStack gap="5">
        <Box color="signalLime">
          <SaviaMark size={48} color="currentColor" />
        </Box>
        <VStack gap="1">
          <Text fontWeight="700" letterSpacing="0.08em" textTransform="uppercase">
            Savia
          </Text>
          <Text color="fg.inverse/60" fontSize="sm">
            La memoria que conecta todas tus IAs.
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}
