import { Box, Text } from "@chakra-ui/react";

export default function Home() {
  return (
    <Box as="main" minH="100svh" display="flex" alignItems="center" justifyContent="center" bg="bg">
      <Box textAlign="center">
        <Text textStyle="titleLg" fontWeight="600" color="fg">Savia</Text>
        <Text color="fg.muted" mt="2">La memoria que conecta todas tus IAs.</Text>
      </Box>
    </Box>
  );
}
