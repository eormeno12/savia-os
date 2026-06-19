'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Flex, Link } from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { CtaButton } from '@/components/landing/cta-button';
import { SaviaMark } from '@/components/design-system/savia-mark';
import { NAV_ITEMS, BRAND_COLORS, EASE_SAVIA } from '@/lib/constants';

function MobileMenu({ onClose }: { onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus first interactive element on mount
  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>('a[href], button')?.focus();
  }, []);

  // Focus trap + Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const el = menuRef.current;
      if (!el) return;
      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>('a[href], button')
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: EASE_SAVIA }}
      style={{ position: 'fixed', inset: 0, zIndex: 1400 }}
    >
      <Box
        ref={menuRef}
        id="mobile-menu"
        role="dialog"
        aria-modal={true}
        aria-label="Menú de navegación"
        bg="bg.inverse"
        h="full"
        display="flex"
        flexDirection="column"
        px="6"
        pt="5"
        pb="8"
      >
        {/* Overlay top bar */}
        <Flex alignItems="center" justifyContent="space-between" h="14">
          <Link
            href="#inicio"
            display="flex"
            alignItems="center"
            gap="2.5"
            textDecoration="none"
            _hover={{ textDecoration: 'none' }}
            onClick={onClose}
          >
            <SaviaMark size={18} color={BRAND_COLORS.lime} />
            <Box as="span" color="fg.inverse" fontWeight="600" fontSize="sm" letterSpacing="0.06em">
              SAVIA
            </Box>
          </Link>
          <Box
            as="button"
            aria-label="Cerrar menú"
            onClick={onClose}
            display="flex"
            alignItems="center"
            justifyContent="center"
            p="2"
            color="fg.inverse"
            cursor="pointer"
            bg="transparent"
            border="none"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Box>
        </Flex>

        {/* Nav links */}
        <Flex
          as="nav"
          aria-label="Principal móvil"
          flex="1"
          flexDirection="column"
          justifyContent="center"
          gap="1"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              color="fg.inverse"
              fontSize="2xl"
              fontWeight="300"
              textDecoration="none"
              opacity={0.7}
              transition="opacity 150ms ease"
              _hover={{ textDecoration: 'none', opacity: 1 }}
              py="4"
              borderBottom="1px solid"
              borderColor="border.inverse"
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
        </Flex>

        {/* Bottom CTA */}
        <Box pt="8">
          <CtaButton size="lg" w="full" onClick={onClose}>
            Early access
          </CtaButton>
        </Box>
      </Box>
    </motion.div>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      {/* ── Sticky header ───────────────────────────────────────── */}
      <Box as="header" pt="4" pb="3">
        {/* Pill */}
        <Flex
          bg="bg.inverse"
          borderRadius="full"
          boxShadow="float"
          mx="auto"
          maxW="container"
          px="6"
          h="14"
          alignItems="center"
          justifyContent="space-between"
        >
          {/* Logo */}
          <Link
            href="#inicio"
            display="flex"
            alignItems="center"
            gap="2.5"
            textDecoration="none"
            _hover={{ textDecoration: 'none' }}
            onClick={close}
          >
            <SaviaMark size={18} color={BRAND_COLORS.lime} />
            <Box as="span" color="fg.inverse" fontWeight="600" fontSize="sm" letterSpacing="0.06em">
              SAVIA
            </Box>
          </Link>

          {/* Desktop nav */}
          <Flex as="nav" aria-label="Principal" display={{ base: 'none', md: 'flex' }} gap="7">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                color="fg.inverse"
                fontWeight="500"
                fontSize="sm"
                textDecoration="none"
                opacity={0.65}
                transition="opacity 150ms ease"
                _hover={{ textDecoration: 'none', opacity: 1 }}
              >
                {item.label}
              </Link>
            ))}
          </Flex>

          {/* Desktop CTA */}
          <Box display={{ base: 'none', md: 'block' }}>
            <CtaButton size="sm">Early access</CtaButton>
          </Box>

          {/* Mobile: compact CTA + hamburger */}
          <Flex display={{ base: 'flex', md: 'none' }} gap="2" alignItems="center">
            <CtaButton size="sm">Early access</CtaButton>
            <Box
              as="button"
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-haspopup="dialog"
              onClick={() => setMenuOpen(true)}
              display="flex"
              alignItems="center"
              justifyContent="center"
              p="2"
              color="fg.inverse"
              cursor="pointer"
              bg="transparent"
              border="none"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M3 5h14M3 10h14M3 15h14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </Box>
          </Flex>
        </Flex>
      </Box>

      {/* ── Mobile overlay (AnimatePresence for proper mount/unmount) ─── */}
      <AnimatePresence>
        {menuOpen && <MobileMenu onClose={close} />}
      </AnimatePresence>
    </>
  );
}
