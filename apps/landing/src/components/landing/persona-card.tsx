'use client';

import { Box, Text } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { EASE_SAVIA } from '@/lib/constants';

export type PersonaDisplay = {
  id: string;
  name: string;
  firstName: string;
  role: string;
  company: string;
  emoji: string;
  hint: string;
};

export function PersonaCard({
  persona,
  isActive,
  onClick,
  disabled,
}: {
  persona: PersonaDisplay;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Box as="div" position="relative" flexShrink={0}>
      {/* Ring burst on selection */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="ring"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.5, ease: EASE_SAVIA }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 20,
              border: '2px solid #E7FF18',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      <motion.button
        onClick={disabled ? undefined : onClick}
        whileTap={disabled ? {} : { scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        style={{ display: 'block', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <Box
          px="4"
          pt="4"
          pb="3.5"
          borderRadius="20px"
          borderWidth="1.5px"
          borderColor={isActive ? 'signalLime' : 'border.subtle'}
          bg={isActive ? 'signalLime/10' : 'bg'}
          minW="140px"
          maxW="160px"
          textAlign="left"
          transition="all 0.18s"
          opacity={disabled && !isActive ? 0.55 : 1}
          position="relative"
          _hover={disabled ? {} : { borderColor: isActive ? 'signalLime' : 'fg.muted/40', bg: isActive ? 'signalLime/10' : 'bg.subtle' }}
        >
          {/* Active check */}
          {isActive && (
            <Box
              position="absolute"
              top="2.5"
              right="2.5"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="16px"
              h="16px"
              borderRadius="full"
              bg="signalLime"
            >
              <Check size={9} strokeWidth={3} color="#0B2529" />
            </Box>
          )}

          <Text fontSize="2xl" mb="2" lineHeight="1">{persona.emoji}</Text>
          <Text fontSize="sm" fontWeight="600" color="fg" lineHeight="1.25" mb="1">
            {persona.firstName}
          </Text>
          <Text fontSize="xs" color="fg.muted" lineHeight="1.35" mb="0.5">
            {persona.role}
          </Text>
          <Text fontSize="xs" color="fg.subtle" lineHeight="1.3">
            {persona.company}
          </Text>
        </Box>
      </motion.button>
    </Box>
  );
}
