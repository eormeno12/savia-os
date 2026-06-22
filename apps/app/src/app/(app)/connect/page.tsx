import { Box, Text, VStack, HStack, Button } from "@chakra-ui/react";
import { Link } from "@chakra-ui/react";
import { Zap, Search, Brain } from "lucide-react";

const TOOLS = [
  {
    name: "Claude Code",
    icon: "⌨️",
    desc: "Añade tu memoria a Claude Code con una línea de config JSON.",
  },
  {
    name: "Cursor",
    icon: "🖱️",
    desc: "Conecta Cursor a Savia y busca en tu historial desde cualquier proyecto.",
  },
  {
    name: "Cualquier cliente MCP",
    icon: "🔌",
    desc: "Savia habla el protocolo MCP estándar — compatible con cualquier herramienta.",
  },
];

const FEATURES = [
  {
    icon: <Search size={18} />,
    title: "savia_search",
    desc: "Tu IA busca en tu memoria con lenguaje natural.",
  },
  {
    icon: <Brain size={18} />,
    title: "savia_remember",
    desc: "Tu IA guarda lo que aprendes, automáticamente clasificado.",
  },
  {
    icon: <Zap size={18} />,
    title: "Solo tus spaces",
    desc: "Cada conexión ve solo lo que tú le concedes.",
  },
];

export default function ConnectPage() {
  return (
    <Box maxW="640px" mx="auto" py="10" px="4">
      <VStack align="flex-start" gap="8">
        <Box>
          <Text fontSize="2xl" fontWeight="800" color="fg" mb="2">
            Conecta tu IA
          </Text>
          <Text color="fg.muted">
            Dale a tu herramienta de IA acceso a tu memoria de Savia.
            Cada conexión tiene su propio token y solo ve los spaces que tú eliges.
          </Text>
        </Box>

        <Box w="full">
          <Text fontSize="sm" fontWeight="700" color="fg" mb="3" textTransform="uppercase" letterSpacing="wide">
            Herramientas compatibles
          </Text>
          <VStack align="stretch" gap="2">
            {TOOLS.map((t) => (
              <HStack
                key={t.name}
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="lg"
                p="3"
                gap="3"
                bg="bg"
              >
                <Text fontSize="xl">{t.icon}</Text>
                <Box>
                  <Text fontSize="sm" fontWeight="600" color="fg">{t.name}</Text>
                  <Text fontSize="xs" color="fg.muted">{t.desc}</Text>
                </Box>
              </HStack>
            ))}
          </VStack>
        </Box>

        <Box w="full">
          <Text fontSize="sm" fontWeight="700" color="fg" mb="3" textTransform="uppercase" letterSpacing="wide">
            Qué puede hacer tu IA
          </Text>
          <VStack align="stretch" gap="3">
            {FEATURES.map((f) => (
              <HStack key={f.title} gap="3" align="flex-start">
                <Box color="brand.solid" mt="0.5" flexShrink={0}>{f.icon}</Box>
                <Box>
                  <Text fontSize="sm" fontWeight="600" color="fg" fontFamily="mono">{f.title}</Text>
                  <Text fontSize="xs" color="fg.muted">{f.desc}</Text>
                </Box>
              </HStack>
            ))}
          </VStack>
        </Box>

        <Box
          border="1px dashed"
          borderColor="border.subtle"
          borderRadius="lg"
          p="5"
          w="full"
          bg="bg.subtle"
        >
          <Text fontSize="sm" fontWeight="600" color="fg" mb="1">
            ¿Listo para conectar?
          </Text>
          <Text fontSize="xs" color="fg.muted" mb="4">
            Ve a Conexiones, crea una nueva, asigna spaces y copia la config MCP.
          </Text>
          <Link href="/connections">
            <Button size="sm">
              Ir a Conexiones →
            </Button>
          </Link>
        </Box>
      </VStack>
    </Box>
  );
}
