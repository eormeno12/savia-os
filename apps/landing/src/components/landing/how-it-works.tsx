import { Box, Grid, Stack, Text } from '@chakra-ui/react';
import styles from './how-it-works.module.css';
import { SectionHeader } from '@/components/ui/section-header';
import { FadeInUp } from '@/components/ui/animated-section';

// ─── Mini-UI illustrations ────────────────────────────────────────────────────

function McpConfigMini() {
  return (
    <div
      aria-hidden="true"
      style={{
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid rgb(11 37 41 / 0.08)',
        background: 'white',
        boxShadow: '0 2px 16px rgb(11 37 41 / 0.06)',
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          background: '#F5F5F5',
          borderBottom: '1px solid #E8E8E8',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 5 }}>
          {['#FF6058', '#FFBD2E', '#28CA41'].map((c) => (
            <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            background: 'white',
            border: '1px solid #E0E0E0',
            borderRadius: 4,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 8,
            fontSize: 9,
            color: '#999',
          }}
        >
          Configuración — MCP Servers
        </div>
      </div>

      {/* Panel body */}
      <div style={{ padding: '12px 14px' }}>
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgb(11 37 41 / 0.4)',
            marginBottom: 8,
          }}
        >
          Servidores conectados
        </div>

        {/* Existing server row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            background: '#F9F9F8',
            borderRadius: 6,
            border: '1px solid #EAEAE8',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: '#F0F0F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              fontWeight: 700,
              color: 'rgb(11 37 41 / 0.4)',
              flexShrink: 0,
            }}
          >
            fs
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#0B2529' }}>filesystem</div>
            <div style={{ fontSize: 7.5, color: 'rgb(11 37 41 / 0.4)', fontFamily: 'monospace' }}>
              local
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 7.5,
              color: 'rgb(11 37 41 / 0.35)',
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'rgb(11 37 41 / 0.25)',
              }}
            />
            activo
          </div>
        </div>

        {/* Savia server row — active */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            background: '#FAFFF0',
            borderRadius: 6,
            border: '1px solid rgb(231 255 24 / 0.45)',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: '#0B2529',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 800,
              color: '#E7FF18',
              flexShrink: 0,
            }}
          >
            S
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#0B2529' }}>Savia</div>
            <div style={{ fontSize: 7.5, color: 'rgb(11 37 41 / 0.4)', fontFamily: 'monospace' }}>
              mcp.savia.ai
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 7.5,
              fontWeight: 600,
              color: '#4A5A20',
            }}
          >
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#E7FF18' }} />
            conectado
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatCaptureMini() {
  return (
    <div
      aria-hidden="true"
      style={{
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid rgb(11 37 41 / 0.08)',
        background: 'white',
        boxShadow: '0 2px 16px rgb(11 37 41 / 0.06)',
        padding: '12px 14px',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: '1px solid #F0F0F0',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: '#0B2529' }}>Claude</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: '#FAFFF0',
            borderRadius: 20,
            padding: '3px 8px',
            fontSize: 7.5,
            fontWeight: 600,
            color: '#4A5A20',
            border: '1px solid rgb(231 255 24 / 0.45)',
          }}
        >
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#E7FF18' }} />
          Savia activo
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          background: '#0B2529',
          borderRadius: '8px 8px 2px 8px',
          padding: '6px 9px',
          fontSize: 9,
          color: '#F4F4F1',
          marginBottom: 7,
          maxWidth: '82%',
          marginLeft: 'auto',
          lineHeight: 1.45,
        }}
      >
        Estoy rediseñando el onboarding para el Q3.
      </div>

      <div
        style={{
          background: '#F4F4F1',
          borderRadius: '8px 8px 8px 2px',
          padding: '6px 9px',
          fontSize: 9,
          color: '#0B2529',
          maxWidth: '82%',
          lineHeight: 1.45,
          marginBottom: 8,
        }}
      >
        Entendido. ¿Qué aspecto del flujo quieres revisar primero?
      </div>

      {/* Capture indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 8,
          color: 'rgb(11 37 41 / 0.38)',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <circle cx="5" cy="5" r="4" stroke="#E7FF18" strokeWidth="1.2" />
          <path d="M3 5l1.5 1.5L7 3.5" stroke="#E7FF18" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Contexto guardado
      </div>
    </div>
  );
}

function MemoryBridgeMini() {
  return (
    <div
      aria-hidden="true"
      style={{
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid rgb(11 37 41 / 0.08)',
        background: 'white',
        boxShadow: '0 2px 16px rgb(11 37 41 / 0.06)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}
    >
      {/* From: Claude */}
      <div
        style={{
          background: '#F9F9F8',
          borderRadius: 7,
          border: '1px solid #EAEAE8',
          padding: '8px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgb(11 37 41 / 0.6)' }}>Claude</span>
        </div>
        <div style={{ fontSize: 8.5, lineHeight: 1.45, color: 'rgb(11 37 41 / 0.55)' }}>
          "…rediseño del onboarding Q3, enfocado en activación…"
        </div>
      </div>

      {/* Bridge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 4px' }}>
        <div
          style={{
            flex: 1,
            height: 1,
            background:
              'repeating-linear-gradient(90deg, #E7FF18 0, #E7FF18 4px, transparent 4px, transparent 9px)',
          }}
        />
        <div
          style={{
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#9AAA30',
            whiteSpace: 'nowrap',
          }}
        >
          Savia MCP
        </div>
        <div
          style={{
            flex: 1,
            height: 1,
            background:
              'repeating-linear-gradient(90deg, #E7FF18 0, #E7FF18 4px, transparent 4px, transparent 9px)',
          }}
        />
      </div>

      {/* To: Gemini */}
      <div
        style={{
          background: '#F9F9F8',
          borderRadius: 7,
          border: '1px solid #EAEAE8',
          padding: '8px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4285F4' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgb(11 37 41 / 0.6)' }}>Gemini</span>
        </div>
        <div
          style={{
            fontSize: 8.5,
            lineHeight: 1.45,
            color: 'rgb(11 37 41 / 0.55)',
            marginBottom: 5,
          }}
        >
          Hola — veo que estás trabajando en el onboarding Q3.
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            background: 'rgb(231 255 24 / 0.12)',
            border: '1px solid rgb(231 255 24 / 0.4)',
            borderRadius: 4,
            padding: '2px 7px',
            fontSize: 7.5,
            fontWeight: 600,
            color: '#4A5A20',
          }}
        >
          ✦ contexto de Claude
        </div>
      </div>
    </div>
  );
}

// ─── Step data ────────────────────────────────────────────────────────────────

type VisualId = 'mcp-config' | 'chat-capture' | 'memory-bridge';

const VISUAL_MAP: Record<VisualId, () => React.JSX.Element> = {
  'mcp-config':    McpConfigMini,
  'chat-capture':  ChatCaptureMini,
  'memory-bridge': MemoryBridgeMini,
};

const STEPS: { num: string; visualId: VisualId; title: string; desc: string; active: boolean }[] = [
  { num: '01', visualId: 'mcp-config',    title: 'Añade Savia como MCP',    desc: 'Una línea de configuración en tu cliente de IA. Compatible con Claude, Cursor, Windsurf y más.', active: true  },
  { num: '02', visualId: 'chat-capture',  title: 'Sigue usando tus IAs',    desc: 'Nada cambia. Savia escucha en segundo plano y captura lo que importa.',                            active: false },
  { num: '03', visualId: 'memory-bridge', title: 'La memoria viaja contigo',desc: 'Cuando cambias de IA, el contexto ya está ahí. Sin repetirte, sin perder el hilo.',               active: false },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function HowItWorks() {
  return (
    <Box as="section" id="flujo" py="sectionY" position="relative">
      <Box mx="auto" w="container" position="relative" zIndex={2}>
        {/* Header */}
        <FadeInUp>
          <SectionHeader
            eyebrow="Plug & Play"
            mb={{ base: '14', md: '16' }}
            headline={
              <>
                Una conexión.{' '}
                <Text as="span" color="fg" fontWeight="700">
                  Magia para tu IA.
                </Text>
              </>
            }
            description="Sin cambiar tu flujo. Savia se integra vía MCP — el protocolo que conecta IAs con herramientas externas."
          />
        </FadeInUp>

        {/* Steps */}
        <Box position="relative">
          {/* Desktop connector line — sits behind dots */}
          <Box
            display={{ base: 'none', md: 'block' }}
            position="absolute"
            top="6px"
            left="calc(100% / 6)"
            right="calc(100% / 6)"
            height="1px"
            style={{
              background:
                'repeating-linear-gradient(90deg, rgb(11 37 41 / 0.18) 0, rgb(11 37 41 / 0.18) 4px, transparent 4px, transparent 10px)',
            }}
            aria-hidden="true"
          />

          <Grid
            templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
            gap={{ base: '12', md: '8' }}
          >
            {STEPS.map((step, index) => {
              const Visual = VISUAL_MAP[step.visualId];
              return (
                <FadeInUp key={step.num} delay={index * 0.12}>
                  <Box position="relative">
                    {/* Watermark number */}
                    <Box
                      position="absolute"
                      top="-16px"
                      left="-6px"
                      fontSize="8rem"
                      fontWeight="800"
                      lineHeight="1"
                      color="fg"
                      opacity="0.04"
                      userSelect="none"
                      aria-hidden="true"
                    >
                      {step.num}
                    </Box>

                    {/* Dot */}
                    <Box
                      w="14px"
                      h="14px"
                      borderRadius="full"
                      mb="5"
                      position="relative"
                      zIndex="1"
                      className={step.active ? styles.dotActive : undefined}
                      style={
                        step.active
                          ? { background: '#E7FF18', border: '2px solid #E7FF18' }
                          : {
                              background: '#F4F4F1',
                              border: '2px solid rgb(11 37 41 / 0.28)',
                            }
                      }
                    />

                    {/* Text content */}
                    <Stack gap="2" mb="6" position="relative" zIndex="1">
                      <Text
                        fontSize="9px"
                        fontWeight="700"
                        letterSpacing="0.12em"
                        textTransform="uppercase"
                        color="fg.muted"
                        opacity={0.6}
                      >
                        Paso {step.num}
                      </Text>
                      <Text fontSize="md" fontWeight="700" color="fg" lineHeight="1.2">
                        {step.title}
                      </Text>
                      <Text fontSize="sm" color="fg.muted" lineHeight="1.65">
                        {step.desc}
                      </Text>
                    </Stack>

                    {/* Mini-UI illustration */}
                    <Box position="relative" zIndex="1">
                      <Visual />
                    </Box>
                  </Box>
                </FadeInUp>
              );
            })}
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}
