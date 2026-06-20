'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Flex, Grid, Input, Stack, Text } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EASE_SAVIA, BRAND_COLORS } from '@/lib/constants';
import { MemoryGraph } from './memory-graph';
import { PersonaCard, type PersonaDisplay } from './persona-card';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Types ───────────────────────────────────────────────────────────────────

type Message = { role: 'user' | 'assistant'; content: string };
type ActiveTool = { name: string; done: boolean };

type StreamEvent =
  | { type: 'plain_delta'; delta: string }
  | { type: 'plain_done' }
  | { type: 'memory_tool_start'; name: string }
  | { type: 'memory_tool_done'; name: string }
  | { type: 'memory_delta'; delta: string }
  | { type: 'done'; toolCallsMade: string[] };

// ─── Data ────────────────────────────────────────────────────────────────────

const PERSONAS: PersonaDisplay[] = [
  { id: 'lucia-torres', emoji: '🚀', firstName: 'Lucía', name: 'Lucía Torres', role: 'Founder & CEO', company: 'Fitco', hint: 'Fundraising y producto' },
  { id: 'mateo-rios', emoji: '📣', firstName: 'Mateo', name: 'Mateo Ríos', role: 'Head de Marketing', company: 'Belcorp', hint: 'Campañas y marca' },
  { id: 'valeria-sanchez', emoji: '🧲', firstName: 'Valeria', name: 'Valeria Sánchez', role: 'Ejecutiva Comercial', company: 'Alicorp', hint: 'Pipeline y clientes' },
  { id: 'diego-herrera', emoji: '🔍', firstName: 'Diego', name: 'Diego Herrera', role: 'Recruiter', company: 'Interbank', hint: 'Talento y posiciones' },
  { id: 'camila-avila', emoji: '📦', firstName: 'Camila', name: 'Camila Ávila', role: 'Product Manager', company: 'Yape', hint: 'Producto y métricas' },
  { id: 'andres-molina', emoji: '🤝', firstName: 'Andrés', name: 'Andrés Molina', role: 'Consultor Senior', company: 'Apoyo Consultoría', hint: 'Clientes y proyectos' },
];

const SUGGESTIONS: Record<string, string[]> = {
  'lucia-torres': ['¿Cómo vas con el fundraising?', '¿Cuál es tu mayor reto este trimestre?', 'Cuéntame sobre tu equipo técnico'],
  'mateo-rios': ['¿En qué campaña estás trabajando?', '¿Cómo mides el impacto del equipo?', 'Cuéntame tu estrategia digital'],
  'valeria-sanchez': ['¿Cómo está tu pipeline este mes?', '¿Cuáles son tus principales cuentas?', '¿Qué objeción encuentras más seguido?'],
  'diego-herrera': ['¿Qué posiciones estás buscando?', '¿Cómo está el mercado de talento tech?', 'Cuéntame de un proceso abierto'],
  'camila-avila': ['¿En qué feature estás trabajando?', '¿Cuáles son tus métricas clave?', '¿Cuál es tu mayor fricción con el equipo?'],
  'andres-molina': ['¿En qué proyecto estás actualmente?', '¿Cuál es el sector más activo?', 'Cuéntame de un cliente desafiante'],
};

// ─── Small components ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <Flex gap="1" align="center" px="3" py="2.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', opacity: 0.4 }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </Flex>
  );
}

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  search_memories:  { label: 'Buscando en memoria',    icon: '⟳' },
  add_memories:     { label: 'Guardando recuerdo',     icon: '✦' },
  get_memories:     { label: 'Recuperando recuerdos',  icon: '⟳' },
  get_memory:       { label: 'Accediendo a recuerdo',  icon: '⟳' },
  update_memory:    { label: 'Actualizando memoria',   icon: '✦' },
  delete_memory:    { label: 'Eliminando recuerdo',    icon: '✦' },
};

function ToolChip({ tool }: { tool: ActiveTool }) {
  const meta = TOOL_LABELS[tool.name] ?? { label: tool.name, icon: '⟳' };

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: EASE_SAVIA }}
      style={{ width: '100%' }}
    >
      <Box
        display="flex"
        alignItems="center"
        gap="2.5"
        px="3"
        py="2.5"
        borderRadius="8px"
        borderWidth="1px"
        borderLeftWidth="3px"
        borderColor={tool.done ? 'fg.inverse/15' : 'border.subtle'}
        borderLeftColor="signalLime"
        bg={tool.done ? 'bg.inverse' : 'bg.subtle'}
        position="relative"
        overflow="hidden"
      >
        {/* Scan shimmer while in progress */}
        {!tool.done && (
          <motion.div
            animate={{ x: ['-120%', '220%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 }}
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: '45%',
              background: 'linear-gradient(90deg, transparent, rgba(231,255,24,0.08), transparent)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Icon */}
        <Box
          fontSize="sm"
          color={tool.done ? 'signalLime' : 'fg.muted'}
          lineHeight={1}
          flexShrink={0}
        >
          {tool.done ? (
            '✓'
          ) : (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block' }}
            >
              {meta.icon}
            </motion.span>
          )}
        </Box>

        {/* Label */}
        <Text
          fontSize="xs"
          fontWeight="500"
          color={tool.done ? 'fg.inverse' : 'fg'}
          flex="1"
        >
          {meta.label}
        </Text>

        {/* Status tag */}
        <Box
          px="1.5"
          py="0.5"
          borderRadius="4px"
          fontSize="2xs"
          fontWeight="600"
          lineHeight={1}
          bg={tool.done ? 'signalLime' : 'fg.subtle/10'}
          color={tool.done ? 'bg.inverse' : 'fg.subtle'}
          letterSpacing="0.04em"
          textTransform="uppercase"
          flexShrink={0}
        >
          {tool.done ? 'listo' : 'en curso'}
        </Box>
      </Box>
    </motion.div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <Flex justify={isUser ? 'flex-end' : 'flex-start'}>
      <Box
        maxW="85%"
        px="3"
        py="2.5"
        borderRadius="message"
        bg={isUser ? 'bg.inverse' : 'bg'}
        color={isUser ? 'fg.inverse' : 'fg'}
        fontSize="sm"
        lineHeight="1.6"
        boxShadow={isUser ? undefined : 'soft'}
        borderWidth={isUser ? undefined : '1px'}
        borderColor="border.subtle"
        css={{
          /* Markdown prose styles scoped to assistant bubbles */
          '& p': { margin: 0 },
          '& p + p': { marginTop: '0.6em' },
          '& strong': { fontWeight: 600 },
          '& em': { fontStyle: 'italic' },
          '& ul, & ol': { paddingLeft: '1.25em', margin: '0.4em 0' },
          '& li': { marginBottom: '0.15em' },
          '& li + li': { marginTop: '0.1em' },
          '& code': {
            fontFamily: 'monospace',
            fontSize: '0.82em',
            background: 'rgba(0,0,0,0.06)',
            borderRadius: '3px',
            padding: '0.1em 0.35em',
          },
          '& pre': {
            background: 'rgba(0,0,0,0.06)',
            borderRadius: '6px',
            padding: '0.6em 0.8em',
            overflowX: 'auto',
            margin: '0.5em 0',
            fontSize: '0.8em',
          },
          '& pre code': { background: 'none', padding: 0 },
          '& blockquote': {
            borderLeft: '3px solid',
            borderColor: 'border.subtle',
            paddingLeft: '0.75em',
            margin: '0.4em 0',
            opacity: 0.75,
          },
          '& h1, & h2, & h3': { fontWeight: 600, lineHeight: 1.3, margin: '0.5em 0 0.25em' },
          '& h1': { fontSize: '1.1em' },
          '& h2': { fontSize: '1.05em' },
          '& h3': { fontSize: '1em' },
          '& a': { textDecoration: 'underline', opacity: 0.8 },
          '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'border.subtle', margin: '0.5em 0' },
        }}
      >
        {isUser ? (
          msg.content
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {msg.content}
          </ReactMarkdown>
        )}
      </Box>
    </Flex>
  );
}

// Spark particles on memory tool activation
function MemorySparkEffect() {
  const particles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    angle: (i / 8) * Math.PI * 2,
    dist: 24 + (i % 3) * 12,
  }));
  return (
    <Box position="absolute" top="50%" left="50%" pointerEvents="none" zIndex={20}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 1.2, opacity: 0.9 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist,
            scale: 0,
            opacity: 0,
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#E7FF18',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </Box>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  title: string;
  subtitle?: string;
  messages: Message[];
  loading: boolean;
  seeding?: boolean;
  seedingPersona?: { emoji: string; firstName: string; company: string };
  accent?: boolean;
  pulsing?: boolean;
  saviaWakingUp?: boolean;
  showSpark?: boolean;
  activeTools?: ActiveTool[];
  memoryCount?: number;
  countBump?: boolean;
  showToast?: boolean;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  lastOtherMessage?: string;
  onCopyMessage?: () => void;
  suggestions?: string[];
  onSuggestionClick?: (s: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function ChatPanel({
  title,
  subtitle,
  messages,
  loading,
  seeding,
  seedingPersona,
  accent,
  pulsing,
  saviaWakingUp,
  showSpark,
  activeTools,
  memoryCount,
  countBump,
  showToast,
  inputValue,
  onInputChange,
  onSend,
  lastOtherMessage,
  onCopyMessage,
  suggestions,
  onSuggestionClick,
  disabled,
  placeholder,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading, activeTools]);

  const lastMsg = messages[messages.length - 1];
  const showDots = loading && (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content === '');
  const showSuggestions = suggestions && suggestions.length > 0 && messages.length === 0 && !loading;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      bg="bg.inset"
      borderRadius="panel"
      borderWidth="1px"
      borderColor={accent && pulsing ? 'signalLime/60' : 'border.subtle'}
      borderTopWidth="2px"
      borderTopColor={accent ? 'signalLime' : 'border.subtle'}
      overflow="hidden"
      h="100%"
      minH="0"
      position="relative"
      transition="border-color 0.3s, box-shadow 0.3s"
      boxShadow={accent && pulsing ? '0 0 0 3px rgba(231,255,24,0.15)' : undefined}
    >
      {/* Savia wake-up sweep */}
      <AnimatePresence>
        {accent && saviaWakingUp && (
          <motion.div
            key="sweep"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: '120%', opacity: [0, 0.4, 0] }}
            exit={{}}
            transition={{ duration: 0.85, ease: EASE_SAVIA }}
            style={{
              position: 'absolute',
              top: 0, bottom: 0,
              width: '55%',
              background: 'linear-gradient(90deg, transparent, rgba(231,255,24,0.07), transparent)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
      </AnimatePresence>

      {/* Typing shimmer when Savia is loading */}
      {accent && loading && (
        <motion.div
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(231,255,24,0.025)',
            pointerEvents: 'none',
            zIndex: 0,
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* Header */}
      <Box
        px="5"
        py="4"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        bg="bg"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        flexShrink={0}
        position="relative"
        zIndex={2}
        opacity={accent ? 1 : 0.72}
      >
        <Box>
          <Text textStyle="label" color="fg.muted">{title}</Text>
          {subtitle && (
            <Text fontSize="xs" color="fg.subtle" mt="1">{subtitle}</Text>
          )}
        </Box>

        {/* Memory count badge */}
        {accent && typeof memoryCount === 'number' && memoryCount > 0 && (
          <motion.div
            animate={countBump ? { scale: [1, 1.45, 1] } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 12 }}
          >
            <Box
              px="2"
              py="0.5"
              borderRadius="chip"
              borderWidth="1px"
              borderColor="fg.inverse/20"
              bg="fg.inverse"
              fontSize="xs"
              fontWeight="700"
              color="signalLime"
              transition="background 0.3s, border-color 0.3s"
            >
              {memoryCount} recuerdo{memoryCount !== 1 ? 's' : ''}
            </Box>
          </motion.div>
        )}
      </Box>

      {/* Messages — minH="0" is required so the flex item can shrink and scroll instead of growing */}
      <Box flex="1" minH="0" overflowY="auto" px="5" py="4" position="relative" zIndex={2}>

        {/* Seeding overlay — prominent loading state when profile is being loaded */}
        <AnimatePresence>
          {seeding && accent && seedingPersona && (
            <motion.div
              key="seeding-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '20px',
                padding: '24px',
                zIndex: 10,
                background: BRAND_COLORS.ink,
              }}
            >
              {/* Spinning lime ring around persona emoji — lime on ink = correct contrast */}
              <Box position="relative" w="72px" h="72px">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                  style={{ position: 'absolute', inset: 0 }}
                >
                  <Box
                    w="72px" h="72px"
                    borderRadius="full"
                    borderWidth="3px"
                    borderColor="signalLime/20"
                    borderTopColor="signalLime"
                    style={{ display: 'block' }}
                  />
                </motion.div>
                {/* Inner glow */}
                <motion.div
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: 'rgba(231,255,24,0.08)' }}
                />
                {/* Persona emoji */}
                <Box
                  position="absolute" inset={0}
                  display="flex" alignItems="center" justifyContent="center"
                  fontSize="2xl"
                  lineHeight={1}
                >
                  {seedingPersona.emoji}
                </Box>
              </Box>

              {/* Text block — paper on ink */}
              <Box textAlign="center">
                <Text fontWeight="600" fontSize="sm" color="fg.inverse" mb="1">
                  Cargando el perfil de {seedingPersona.firstName}
                </Text>
                <Text fontSize="xs" color="fg.inverse/50">
                  {seedingPersona.company}
                </Text>
              </Box>

              {/* Lime dots — lime on ink = fully visible */}
              <Flex gap="2" align="center">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 1.4, delay: i * 0.22, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: 7, height: 7,
                      borderRadius: '50%',
                      background: BRAND_COLORS.lime,
                    }}
                  />
                ))}
              </Flex>

              {/* Label */}
              <Text fontSize="xs" color="fg.inverse/40">
                Accediendo a sus recuerdos…
              </Text>
            </motion.div>
          )}
        </AnimatePresence>

        <Stack gap="3">
          {messages.length === 0 && !loading && !seeding && (
            <Text fontSize="sm" color="fg.subtle" textAlign="center" mt="8">
              {disabled
                ? 'Selecciona una persona para comenzar'
                : accent
                  ? 'Savia recuerda todo sobre esta persona'
                  : 'Responde sin ningún contexto previo'}
            </Text>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE_SAVIA }}
              >
                <MessageBubble msg={msg} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Active tool activity */}
          {accent && activeTools && activeTools.length > 0 && (
            <Stack gap="1.5" position="relative">
              {showSpark && <MemorySparkEffect />}
              {activeTools.map((tool, i) => (
                <ToolChip key={`${tool.name}-${i}`} tool={tool} />
              ))}
            </Stack>
          )}

          {showDots && (
            <Flex>
              <Box
                bg="bg"
                borderRadius="message"
                borderWidth="1px"
                borderColor="border.subtle"
                color="fg.subtle"
                boxShadow="soft"
              >
                <TypingDots />
              </Box>
            </Flex>
          )}
          <div ref={bottomRef} />
        </Stack>
      </Box>

      {/* Footer: suggestions + input */}
      <Box
        px="5"
        pb="4"
        pt="3"
        borderTopWidth="1px"
        borderColor="border.subtle"
        bg="bg"
        flexShrink={0}
        position="relative"
        zIndex={2}
      >
        {/* Suggestion chips */}
        <AnimatePresence mode="wait">
          {showSuggestions && (
            <motion.div
              key="suggestions"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                visible: { transition: { staggerChildren: 0.06 } },
                hidden: {},
              }}
            >
              <Flex gap="2" flexWrap="wrap" mb="3">
                {suggestions!.map((s, i) => (
                  <motion.div
                    key={i}
                    variants={{
                      visible: { opacity: 1, y: 0 },
                      hidden: { opacity: 0, y: 6 },
                    }}
                    transition={{ duration: 0.22, ease: EASE_SAVIA }}
                  >
                    <Box
                      as="button"
                      onClick={() => onSuggestionClick?.(s)}
                      px="2.5"
                      py="1.5"
                      borderRadius="chip"
                      borderWidth="1px"
                      borderColor="border.subtle"
                      bg="bg.subtle"
                      fontSize="xs"
                      color="fg.muted"
                      cursor="pointer"
                      transition="all 0.15s"
                      _hover={{ borderColor: 'fg.muted/50', color: 'fg', bg: 'bg' }}
                      textAlign="left"
                    >
                      {s}
                    </Box>
                  </motion.div>
                ))}
              </Flex>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row */}
        <Flex gap="2" align="center">
          <Input
            ref={inputRef}
            flex="1"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? 'Escribe algo…'}
            bg="bg.subtle"
            borderColor="border"
            borderRadius="full"
            color="fg"
            fontSize="sm"
            h="10"
            px="4"
            _placeholder={{ color: 'fg.subtle' }}
            _focus={{ borderColor: accent ? 'signalLime' : 'fg/40', boxShadow: 'none' }}
            disabled={disabled || loading}
          />
          <Button
            colorPalette={accent ? 'lime' : 'ink'}
            borderRadius="full"
            h="10"
            px="4"
            onClick={onSend}
            disabled={disabled || loading || !inputValue.trim()}
            aria-label="Enviar"
          >
            <Send size={14} />
          </Button>
        </Flex>

        {/* Copy last message from other panel */}
        <AnimatePresence>
          {lastOtherMessage && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
            >
              <Box
                as="button"
                onClick={() => {
                  onCopyMessage?.();
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                display="flex"
                alignItems="center"
                gap="1.5"
                mt="2"
                px="1"
                py="0.5"
                color="fg.subtle"
                fontSize="xs"
                cursor="pointer"
                _hover={{ color: 'fg.muted' }}
                transition="color 0.15s"
              >
                <CornerDownLeft size={11} />
                Usar el mismo mensaje del otro chat
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* "Guardado en Savia" toast */}
      <AnimatePresence>
        {accent && showToast && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.25, ease: EASE_SAVIA }}
            style={{
              position: 'absolute',
              bottom: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Box
              px="3.5"
              py="2"
              borderRadius="chip"
              bg="bg.inverse"
              color="signalLime"
              fontSize="xs"
              fontWeight="700"
              boxShadow="float"
              borderWidth="1px"
              borderColor="signalLime/30"
            >
              ✦ Guardado en memoria
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

// ─── Mobile Tab Bar ───────────────────────────────────────────────────────────

function MobileTabBar({
  active,
  onChange,
}: {
  active: 'plain' | 'memory' | 'graph';
  onChange: (t: 'plain' | 'memory' | 'graph') => void;
}) {
  const tabs = [
    { id: 'plain' as const, label: 'Sin memoria' },
    { id: 'memory' as const, label: 'Con Savia' },
    { id: 'graph' as const, label: 'Mapa' },
  ];
  return (
    <Flex
      display={{ base: 'flex', lg: 'none' }}
      gap="1"
      p="1"
      bg="bg.subtle"
      borderRadius="chip"
      borderWidth="1px"
      borderColor="border.subtle"
      mb="4"
    >
      {tabs.map((t) => (
        <Box
          key={t.id}
          as="button"
          flex="1"
          py="1.5"
          borderRadius="8px"
          fontSize="xs"
          fontWeight="600"
          color={active === t.id ? (t.id === 'memory' ? 'fg.inverse' : 'fg') : 'fg.muted'}
          bg={active === t.id ? (t.id === 'memory' ? 'fg.inverse' : 'bg') : 'transparent'}
          borderWidth={active === t.id ? '1px' : '0'}
          borderColor={active === t.id ? (t.id === 'memory' ? 'fg.inverse/20' : 'border.subtle') : 'transparent'}
          cursor="pointer"
          transition="all 0.15s"
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </Box>
      ))}
    </Flex>
  );
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function getSessionId(): string {
  const key = 'savia-demo-sid';
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DemoChat() {
  const [plainMessages, setPlainMessages] = useState<Message[]>([]);
  const [memoryMessages, setMemoryMessages] = useState<Message[]>([]);
  const [plainInput, setPlainInput] = useState('');
  const [memoryInput, setMemoryInput] = useState('');
  const [plainLoading, setPlainLoading] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [countBump, setCountBump] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isSaviaPulsing, setIsSaviaPulsing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [saviaWakingUp, setSaviaWakingUp] = useState(false);
  const [sparkKey, setSparkKey] = useState(0);
  const [showSpark, setShowSpark] = useState(false);
  const [graphRefresh, setGraphRefresh] = useState(0);
  const [persona, setPersona] = useState<PersonaDisplay | null>(null);
  const [userId, setUserId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [activeTab, setActiveTab] = useState<'plain' | 'memory' | 'graph'>('plain');
  const usedUserIdsRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setSessionId(getSessionId()); }, []);

  useEffect(() => {
    if (!sessionId) return;
    const cleanup = () => {
      const ids = [...usedUserIdsRef.current];
      if (!ids.length) return;
      navigator.sendBeacon('/api/demo/cleanup', JSON.stringify({ userIds: ids }));
    };
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, [sessionId]);

  // ── Stream parser (shared) ──────────────────────────────────────────────────

  const processStream = useCallback(
    async (
      res: Response,
      mode: 'plain' | 'memory' | 'both',
      onPlainDelta: (d: string) => void,
      onMemoryDelta: (d: string) => void,
      onDone: (toolCalls: string[]) => void,
    ) => {
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const event = JSON.parse(part.slice(6)) as StreamEvent;

          switch (event.type) {
            case 'plain_delta':
              onPlainDelta(event.delta);
              break;
            case 'memory_tool_start':
              setActiveTools((prev) => [...prev, { name: event.name, done: false }]);
              setIsSaviaPulsing(true);
              setShowSpark(true);
              setSparkKey((k) => k + 1);
              setTimeout(() => setShowSpark(false), 700);
              break;
            case 'memory_tool_done':
              setActiveTools((prev) => {
                const idx = prev.findIndex((t) => t.name === event.name && !t.done);
                if (idx === -1) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], done: true };
                return next;
              });
              break;
            case 'memory_delta':
              onMemoryDelta(event.delta);
              break;
            case 'done':
              onDone(event.toolCallsMade);
              break;
          }
        }
      }
    },
    [],
  );

  // ── Send: Both panels (initial "Hola") ─────────────────────────────────────

  const sendBoth = useCallback(
    async (message: string, uid: string, personaId: string) => {
      setPlainLoading(true);
      setMemoryLoading(true);
      setActiveTools([]);

      setPlainMessages([{ role: 'user', content: message }]);
      setMemoryMessages([{ role: 'user', content: message }]);

      try {
        const res = await fetch('/api/demo/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, userId: uid, personaId, sessionHistory: [], mode: 'both' }),
        });

        let plainAcc = '';
        let memoryAcc = '';

        await processStream(
          res,
          'both',
          (d) => {
            plainAcc += d;
            setPlainMessages([
              { role: 'user', content: message },
              { role: 'assistant', content: plainAcc },
            ]);
          },
          (d) => {
            memoryAcc += d;
            setMemoryMessages([
              { role: 'user', content: message },
              { role: 'assistant', content: memoryAcc },
            ]);
          },
          (toolCalls) => {
            setActiveTools([]);
            setIsSaviaPulsing(false);
            setPlainLoading(false);
            setMemoryLoading(false);
            setGraphRefresh((n) => n + 1);

            const adds = toolCalls.filter((t) => t === 'add_memories').length;
            if (adds > 0) {
              setMemoryCount((c) => c + adds);
              setCountBump(true);
              setTimeout(() => setCountBump(false), 500);
              if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
              setShowToast(true);
              toastTimerRef.current = setTimeout(() => setShowToast(false), 2500);
            }
          },
        );
      } catch {
        setPlainMessages((prev) => [...prev, { role: 'assistant', content: 'Error al conectar.' }]);
        setMemoryMessages((prev) => [...prev, { role: 'assistant', content: 'Error al conectar.' }]);
        setPlainLoading(false);
        setMemoryLoading(false);
      }
    },
    [processStream],
  );

  // ── Send: Plain only ────────────────────────────────────────────────────────

  const sendPlain = useCallback(async () => {
    const message = plainInput.trim();
    if (!message || plainLoading || !userId || !persona) return;
    setPlainInput('');
    setPlainLoading(true);

    const history = plainMessages.map((m) => ({ role: m.role, content: m.content }));
    const newMessages: Message[] = [...plainMessages, { role: 'user', content: message }];
    setPlainMessages(newMessages);

    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, userId, personaId: persona.id, sessionHistory: history, mode: 'plain' }),
      });

      let acc = '';
      await processStream(
        res,
        'plain',
        (d) => {
          acc += d;
          setPlainMessages([...newMessages, { role: 'assistant', content: acc }]);
        },
        () => {},
        () => {
          setPlainLoading(false);
        },
      );
    } catch {
      setPlainMessages((prev) => [...prev, { role: 'assistant', content: 'Error al conectar.' }]);
      setPlainLoading(false);
    }
  }, [plainInput, plainLoading, userId, persona, plainMessages, processStream]);

  // ── Send: Memory only ───────────────────────────────────────────────────────

  const sendMemory = useCallback(async () => {
    const message = memoryInput.trim();
    if (!message || memoryLoading || !userId || !persona) return;
    setMemoryInput('');
    setMemoryLoading(true);
    setActiveTools([]);

    const history = memoryMessages.map((m) => ({ role: m.role, content: m.content }));
    const newMessages: Message[] = [...memoryMessages, { role: 'user', content: message }];
    setMemoryMessages(newMessages);

    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, userId, personaId: persona.id, sessionHistory: history, mode: 'memory' }),
      });

      let acc = '';
      await processStream(
        res,
        'memory',
        () => {},
        (d) => {
          acc += d;
          setMemoryMessages([...newMessages, { role: 'assistant', content: acc }]);
        },
        (toolCalls) => {
          setActiveTools([]);
          setIsSaviaPulsing(false);
          setMemoryLoading(false);
          setGraphRefresh((n) => n + 1);

          const adds = toolCalls.filter((t) => t === 'add_memories').length;
          if (adds > 0) {
            setMemoryCount((c) => c + adds);
            setCountBump(true);
            setTimeout(() => setCountBump(false), 500);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            setShowToast(true);
            toastTimerRef.current = setTimeout(() => setShowToast(false), 2500);
          }
        },
      );
    } catch {
      setMemoryMessages((prev) => [...prev, { role: 'assistant', content: 'Error al conectar.' }]);
      setMemoryLoading(false);
      setIsSaviaPulsing(false);
    }
  }, [memoryInput, memoryLoading, userId, persona, memoryMessages, processStream]);

  // ── Persona selection ────────────────────────────────────────────────────────

  async function handlePersonaSelect(p: PersonaDisplay) {
    if (plainLoading || memoryLoading || seeding) return;
    const sid = sessionId || getSessionId();
    const composedUserId = `${p.id}-${sid}`;
    usedUserIdsRef.current.add(composedUserId);
    setPersona(p);
    setUserId(composedUserId);
    setPlainMessages([]);
    setMemoryMessages([]);
    setPlainInput('');
    setMemoryInput('');
    setActiveTools([]);
    setMemoryCount(0);
    setActiveTab('plain');

    // Seed memories first — show loading state so the user knows something is happening.
    // The chat is sent only after seed completes so the LLM already has context.
    setSeeding(true);
    try {
      await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: composedUserId, personaId: p.id }),
      });
    } catch {
      // seed failure is non-fatal — the chat will still work, just without pre-loaded context
    } finally {
      setSeeding(false);
    }

    // Wake-up sweep then send first message
    setSaviaWakingUp(true);
    setTimeout(() => setSaviaWakingUp(false), 900);

    await sendBoth('Hola', composedUserId, p.id);
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isLoading = plainLoading || memoryLoading || seeding;
  const lastPlainUserMsg = plainMessages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  const lastMemoryUserMsg = memoryMessages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  const suggestions = persona && !seeding ? (SUGGESTIONS[persona.id] ?? []) : [];
  const memoryTitle = 'Con Savia';
  const memorySubtitle = seeding
    ? `Cargando perfil de ${persona?.firstName ?? 'la persona'}…`
    : persona
      ? `${persona.firstName} recuerda todo`
      : 'Recuerda el contexto';

  // ── Panel visibility for mobile tabs ─────────────────────────────────────────

  function panelDisplay(tab: 'plain' | 'memory' | 'graph') {
    return { base: activeTab === tab ? 'flex' : 'none', lg: 'flex' };
  }

  return (
    <Box display="flex" flexDirection="column" flex="1" overflow="hidden" gap="3">
      {/* Top strip: heading + persona cards side by side */}
      <Flex align="center" gap={{ base: '3', lg: '5' }} flexShrink={0} overflow="hidden">
        {/* Compact heading */}
        <Box flexShrink={0} display={{ base: 'none', lg: 'block' }}>
          <Text fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase" letterSpacing="0.08em" mb="1">
            Ve la diferencia
          </Text>
          <Text fontSize="xl" fontWeight="300" color="fg.muted" lineHeight="1.1" whiteSpace="nowrap">
            El mismo mensaje.{' '}
            <Text as="span" fontWeight={600}>No la misma respuesta.</Text>
          </Text>
        </Box>

        {/* Separator */}
        <Box w="1px" alignSelf="stretch" bg="border.subtle" flexShrink={0} display={{ base: 'none', lg: 'block' }} />

        {/* Persona cards — scroll horizontal */}
        <Flex flex="1" gap="3" overflowX="auto" overflowY="hidden" py="1" css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {PERSONAS.map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              isActive={persona?.id === p.id}
              onClick={() => handlePersonaSelect(p)}
              disabled={isLoading}
            />
          ))}
        </Flex>
      </Flex>

      {/* Mobile tab bar */}
      <MobileTabBar active={activeTab} onChange={setActiveTab} />

      {/* Chat panels + graph — fills remaining height */}
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 1fr' }} gap={{ base: '3', lg: '4' }} flex="1" minH="0">
        {/* Plain panel */}
        <Box display={panelDisplay('plain')} flexDirection="column" h="100%" minH="0">
          <ChatPanel
            title="Sin memoria"
            subtitle="Responde sin contexto previo"
            messages={plainMessages}
            loading={plainLoading}
            inputValue={plainInput}
            onInputChange={setPlainInput}
            onSend={sendPlain}
            placeholder={persona ? `Escribe a ${persona.firstName}…` : 'Selecciona una persona primero…'}
            lastOtherMessage={lastMemoryUserMsg}
            onCopyMessage={() => setPlainInput(lastMemoryUserMsg)}
            suggestions={suggestions}
            onSuggestionClick={(s) => { setPlainInput(s); }}
            disabled={!persona || seeding}
          />
        </Box>

        {/* Savia panel */}
        <Box display={panelDisplay('memory')} flexDirection="column" h="100%" minH="0">
          <ChatPanel
            title={memoryTitle}
            subtitle={memorySubtitle}
            messages={memoryMessages}
            loading={memoryLoading}
            seeding={seeding}
            seedingPersona={persona ? { emoji: persona.emoji, firstName: persona.firstName, company: persona.company } : undefined}
            accent
            pulsing={isSaviaPulsing}
            saviaWakingUp={saviaWakingUp}
            showSpark={showSpark}
            activeTools={activeTools}
            memoryCount={memoryCount}
            countBump={countBump}
            showToast={showToast}
            inputValue={memoryInput}
            onInputChange={setMemoryInput}
            onSend={sendMemory}
            placeholder={persona ? `Escribe a ${persona.firstName}…` : 'Selecciona una persona primero…'}
            lastOtherMessage={lastPlainUserMsg}
            onCopyMessage={() => setMemoryInput(lastPlainUserMsg)}
            suggestions={suggestions}
            onSuggestionClick={(s) => { setMemoryInput(s); }}
            disabled={!persona}
          />
        </Box>

        {/* Memory graph */}
        <Box display={panelDisplay('graph')} flexDirection="column" h="100%" minH="0">
          <MemoryGraph userId={userId} refreshTrigger={graphRefresh} />
        </Box>
      </Grid>
    </Box>
  );
}
