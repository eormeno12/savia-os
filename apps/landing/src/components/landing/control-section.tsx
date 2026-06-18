import { Box, Flex, Grid, HStack, Text } from "@chakra-ui/react";
import { SectionHeader } from '@/components/ui/section-header';
import {
  Briefcase,
  MessageCircle,
  FileText,
  Code,
  Calendar,
  Lock,
  Plus,
} from "lucide-react";
import { SiClaude, SiGithubcopilot, SiCursor } from "@icons-pack/react-simple-icons";
import { ChatGptIcon } from "@/components/design-system/chatgpt-icon";

const PLATFORMS = [
  { id: "claude",  label: "Claude",  Icon: SiClaude,       bg: "#FDEEE8", color: "#D97757" },
  { id: "chatgpt", label: "ChatGPT", Icon: ChatGptIcon,    bg: "#E9F9F4", color: "#10A37F" },
  { id: "copilot", label: "Copilot", Icon: SiGithubcopilot, bg: "#F0EFF8", color: "#6E5BCB" },
  { id: "cursor",  label: "Cursor",  Icon: SiCursor,       bg: "#F1EFE8", color: "#444441" },
] as const;

const TEMAS = [
  { label: "Trabajo",        Icon: Briefcase,     permissions: [true,  true,  false, true ] },
  { label: "Conversaciones", Icon: MessageCircle, permissions: [true,  false, false, false] },
  { label: "Documentos",     Icon: FileText,      permissions: [true,  true,  false, true ] },
  { label: "Código",         Icon: Code,          permissions: [false, false, true,  true ] },
  { label: "Reuniones",      Icon: Calendar,      permissions: [true,  false, false, false] },
  { label: "Personal",       Icon: Lock,          permissions: [false, false, false, false] },
];

const COL = "1fr repeat(4, minmax(80px, 88px))";
const ICON_COLOR = "#53606C";

function ToggleVisual({ on }: { on: boolean }) {
  return (
    <Box
      borderRadius="full"
      bg={on ? "signalLime" : "border"}
      position="relative"
      flexShrink={0}
      style={{ width: 32, height: 18 }}
    >
      <Box
        position="absolute"
        borderRadius="full"
        bg={on ? "fg" : "bg"}
        style={{ width: 14, height: 14, top: 2, left: on ? 16 : 2 }}
      />
    </Box>
  );
}

export function ControlSection() {
  return (
    <Box as="section" id="control" py="sectionY" bg="bg.subtle" position="relative">
      <Box mx="auto" w="container" position="relative" zIndex={2}>

        {/* Header */}
        <SectionHeader
          eyebrow="Control"
          mb={{ base: '12', lg: '16' }}
          headline={
            <>
              Tu memoria,{' '}
              <Text as="span" color="fg" fontWeight="700">
                tus reglas.
              </Text>
            </>
          }
          description="Crea temas para cada parte de tu vida. Activa o bloquea el acceso por IA, con un solo toggle."
        />

        {/* Matriz */}
        <Box
          bg="bg"
          borderRadius="card"
          borderWidth="1px"
          borderColor="border"
          overflowX="auto"
          role="table"
          aria-label="Permisos de memoria por plataforma de IA"
        >
          {/* Cabecera de plataformas */}
          <Grid templateColumns={COL} px="4" py="3" bg="bg.subtle" minW="480px" role="row">
            <Box role="columnheader" aria-label="Tema" />
            {PLATFORMS.map((p) => (
              <Flex key={p.id} direction="column" align="center" gap="1" role="columnheader" aria-label={p.label}>
                <Box
                  borderRadius="full"
                  style={{
                    width: 24,
                    height: 24,
                    background: p.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <p.Icon size={13} color={p.color} />
                </Box>
                <Text fontSize="xs" color="fg.muted">
                  {p.label}
                </Text>
              </Flex>
            ))}
          </Grid>

          {/* Filas de temas */}
          {TEMAS.map((tema) => (
            <Grid
              key={tema.label}
              templateColumns={COL}
              px="4"
              py="3"
              alignItems="center"
              borderTopWidth="1px"
              borderColor="border"
              minW="480px"
              role="row"
            >
              <HStack gap="2" role="rowheader">
                <tema.Icon size={15} color={ICON_COLOR} aria-hidden />
                <Text fontSize="sm" color="fg">
                  {tema.label}
                </Text>
              </HStack>
              {PLATFORMS.map((platform, pi) => (
                <Flex
                  key={platform.id}
                  justify="center"
                  align="center"
                  role="cell"
                  aria-label={`${platform.label}: ${tema.permissions[pi] ? 'permitido' : 'bloqueado'}`}
                >
                  <ToggleVisual on={tema.permissions[pi]} />
                </Flex>
              ))}
            </Grid>
          ))}

          {/* Fila "Añadir tema" */}
          <Grid
            templateColumns={COL}
            px="4"
            py="3"
            bg="bg.subtle"
            alignItems="center"
            borderTopWidth="1px"
            borderColor="border.subtle"
            minW="480px"
          >
            <HStack gap="2">
              <Plus size={14} color="rgb(11 37 41 / 0.3)" aria-hidden />
              <Text fontSize="sm" color="fg.subtle">
                Añadir tema
              </Text>
            </HStack>
            {PLATFORMS.map((platform) => (
              <Box key={platform.id} />
            ))}
          </Grid>
        </Box>

      </Box>
    </Box>
  );
}
