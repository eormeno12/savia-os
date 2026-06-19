'use client';

import { useRef, useState, useEffect } from 'react';
import { Text } from '@chakra-ui/react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion';

// ─── SaviaMark path (148×148 viewBox, single piece in top-left quadrant) ─────
const PATH =
  'M42.2 0H63.8A7.2 7.2 0 0 1 71 7.2V28.8A7.2 7.2 0 0 1 63.8 36H42.2C38.8 36 36 38.8 36 42.2V63.8A7.2 7.2 0 0 1 28.8 71H7.2A7.2 7.2 0 0 1 0 63.8V42.2A7.2 7.2 0 0 1 7.2 35H28.8C32.2 35 35 32.2 35 28.8V7.2A7.2 7.2 0 0 1 42.2 0Z';

// ─── Phases ───────────────────────────────────────────────────────────────────
const PHASES = [
  {
    title: 'Tu data está repartida en todos lados',
    sub: 'Chats, apps y archivos en sitios diferentes.',
  },
  {
    title: 'SAVIA crea una estructura inteligente',
    sub: 'Toda tu información converge en una sola memoria.',
  },
  {
    title: 'Y la conecta con todas tus IAs',
    sub: 'Claude, ChatGPT, Gemini y más comparten el contexto.',
  },
];

// ─── IAs ──────────────────────────────────────────────────────────────────────
const IAS = [
  { name: 'Claude', opacity: 0.82 },
  { name: 'ChatGPT', opacity: 0.6 },
  { name: 'Gemini', opacity: 0.82 },
  { name: 'Cursor', opacity: 0.5 },
  { name: 'Windsurf', opacity: 0.36 },
];

// ─── Linear interpolation helper ─────────────────────────────────────────────
// Maps scroll progress p through [r0,r1] to output [from,to], clamped.
function interp(p: number, r0: number, r1: number, from: number, to: number) {
  const t = Math.min(1, Math.max(0, (p - r0) / (r1 - r0)));
  return from + (to - from) * t;
}

// ─── Static fallback for prefers-reduced-motion ───────────────────────────────
function AssembledStatic() {
  return (
    <section
      id="flujo"
      style={{
        background: '#0B2529',
        padding: '80px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32,
      }}
    >
      <Text
        as="h2"
        fontSize={{ base: 'xl', md: '2xl' }}
        fontWeight="700"
        color="fg.inverse"
        textAlign="center"
        maxW="md"
      >
        SAVIA conecta tu conocimiento con todas tus IAs
      </Text>
      <svg viewBox="0 0 148 148" width={88} height={88} aria-hidden="true">
        <path d={PATH} fill="rgba(255,255,255,.82)" />
        <path d={PATH} fill="rgba(255,255,255,.82)" transform="rotate(90 74 74)" />
        <path d={PATH} fill="#E7FF18" transform="rotate(180 74 74)" />
        <path d={PATH} fill="rgba(255,255,255,.82)" transform="rotate(270 74 74)" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        {IAS.map(({ name, opacity }) => (
          <p
            key={name}
            style={{
              color: `rgba(231,255,24,${opacity})`,
              fontSize: 15,
              margin: '6px 0',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
            }}
          >
            {name}
          </p>
        ))}
      </div>
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function EcosystemScroll() {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) return <AssembledStatic />;
  return <EcosystemScrollAnimated />;
}

// ─── Animated component ───────────────────────────────────────────────────────
function EcosystemScrollAnimated() {
  const sectionRef = useRef<HTMLElement>(null);
  const boundsRef = useRef({ top: 0, height: 0, vp: 720 });
  // Tracks layout breakpoint without causing re-renders
  // mobile <640 | tablet 640-1023 | desktop ≥1024
  const layoutRef = useRef<'mobile' | 'tablet' | 'desktop'>('desktop');

  const [phase, setPhase] = useState(0);
  const [showIas, setShowIas] = useState(false);

  useEffect(() => {
    const update = () => {
      const el = sectionRef.current;
      if (!el) return;
      boundsRef.current = {
        top: el.offsetTop,
        height: el.offsetHeight,
        vp: window.innerHeight,
      };
      const w = window.innerWidth;
      layoutRef.current = w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Scroll progress: 0 at section start, 1 at section end ─────────────────
  const { scrollY } = useScroll();
  const scrollYProgress = useTransform(scrollY, (y) => {
    const { top, height, vp } = boundsRef.current;
    const range = height - vp;
    if (range <= 0) return 0;
    return Math.min(1, Math.max(0, (y - top) / range));
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setPhase(v < 0.27 ? 0 : v < 0.72 ? 1 : 2);
    setShowIas(v >= 0.78);
  });

  // ── Responsive motion values (function form reads layoutRef each frame) ────
  //
  // EXPLODED positions:
  //   Desktop  — horizontal row: L at x=-280, C at x=0 y=+38, R at x=+280
  //   Mobile   — vertical stack: top at y=-115, center at y=0, bottom at y=+115
  //
  // ASSEMBLED positions (same for both layouts):
  //   CONV (Conversaciones)  → bottom-left  x=-46, y=+46
  //   APPS (Apps)            → top-left     x=-46, y=-46
  //   ARCH (Archivos)        → top-right    x=+46, y=-46
  //   IA   (lime connector)  → bottom-right x=+46, y=+46
  //
  // PIECE=84px (2× the original 42px quadrant of the 88px SAVIA logo)
  // At ±46 with HALF=42: gap between pieces = (46-42)×2 = 8px ≈ 2× logo gap
  // Four pieces at scale=1 tile a perfect 176×176 area.

  // Mobile: positions pieces dynamically so the top piece starts right below
  // the text block (~275px from top of sticky viewport). This adapts to any
  // phone height instead of using a fixed pixel offset.
  // Formula: textBottom + halfPiece - vp/2  (halfPiece ≈ 84×0.85/2 = 36px)
  const mobileTopY = () => 275 + 36 - boundsRef.current.vp / 2;

  const convX = useTransform(scrollYProgress, (p) => {
    const startX = layoutRef.current === 'mobile' ? 0 : -280;
    return interp(p, 0.25, 0.55, startX, -46);
  });
  const convY = useTransform(scrollYProgress, (p) => {
    const startY = layoutRef.current === 'mobile' ? mobileTopY() : 0;
    return interp(p, 0.25, 0.55, startY, 46);
  });
  const convScale = useTransform(scrollYProgress, (p) => {
    return interp(p, 0.25, 0.55, layoutRef.current === 'mobile' ? 0.85 : 1.5, 1.0);
  });

  const appsX = useTransform(scrollYProgress, (p) => interp(p, 0.25, 0.55, 0, -46));
  const appsY = useTransform(scrollYProgress, (p) => {
    const startY = layoutRef.current === 'mobile' ? mobileTopY() + 120 : 0;
    return interp(p, 0.25, 0.55, startY, -46);
  });
  const appsScale = useTransform(scrollYProgress, (p) => {
    return interp(p, 0.25, 0.55, layoutRef.current === 'mobile' ? 0.85 : 1.5, 1.0);
  });

  const archX = useTransform(scrollYProgress, (p) => {
    const startX = layoutRef.current === 'mobile' ? 0 : 280;
    return interp(p, 0.25, 0.55, startX, 46);
  });
  const archY = useTransform(scrollYProgress, (p) => {
    const startY = layoutRef.current === 'mobile' ? mobileTopY() + 240 : 0;
    return interp(p, 0.25, 0.55, startY, -46);
  });
  const archScale = useTransform(scrollYProgress, (p) => {
    return interp(p, 0.25, 0.55, layoutRef.current === 'mobile' ? 0.85 : 1.5, 1.0);
  });

  // IA enters from lower-right during assembly
  const iaX = useTransform(scrollYProgress, (p) => {
    const startX = layoutRef.current === 'mobile' ? 65 : 280;
    return interp(p, 0.38, 0.55, startX, 46);
  });
  const iaY = useTransform(scrollYProgress, (p) => {
    const startY = layoutRef.current === 'mobile' ? mobileTopY() + 240 : 120;
    return interp(p, 0.38, 0.55, startY, 46);
  });
  const iaScale = useTransform(scrollYProgress, (p) => {
    return interp(p, 0.38, 0.55, layoutRef.current === 'mobile' ? 0.85 : 1.4, 1.0);
  });
  const iaEnter = useTransform(scrollYProgress, (p) => interp(p, 0.34, 0.48, 0, 1));

  // ── Opacity / visibility ──────────────────────────────────────────────────
  // Pieces stay fully visible — they physically travel to logo positions.
  // The 4 piece divs at assembled positions naturally form the 88×88 SAVIA logo.
  const labelOpacity = useTransform(scrollYProgress, (p) => interp(p, 0.15, 0.32, 1, 0));
  const glowOpacity = useTransform(scrollYProgress, (p) => interp(p, 0.65, 0.80, 0, 1));
  const iaFlowOpacity = useTransform(scrollYProgress, (p) => interp(p, 0.74, 0.88, 0, 1));
  const pieceFill = useTransform(scrollYProgress, (p) => {
    const t = interp(p, 0.71, 0.76, 0, 1);
    const r = Math.round(255 + (231 - 255) * t);
    const b = Math.round(255 + (24 - 255) * t);
    const a = +(0.82 + 0.18 * t).toFixed(3);
    return `rgba(${r},255,${b},${a})`;
  });

  // ── Piece div size: one quadrant of the 88px assembled SAVIA logo ─────────
  // 42 ≈ 71/148×88 = 42.2px. At ±23: four pieces + 4px gap = 88px total.
  const PIECE = 84;
  const HALF = PIECE / 2; // 42

  // ── Shared label style (no opacity — set per element via MotionValue) ──────
  const LABEL: React.CSSProperties = {
    position: 'absolute',
    top: '120%',
    left: '50%',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'rgba(255,255,255,0.42)',
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
    textTransform: 'uppercase',
  };

  return (
    <section
      id="flujo"
      ref={sectionRef as React.RefObject<HTMLElement>}
      style={{ height: '300vh', background: '#0B2529', position: 'relative' }}
      aria-label="Cómo SAVIA une tu conocimiento y lo conecta con tus IAs"
    >
      {/* Sticky viewport */}
      <div
        style={{
          // No background here — the <section> paints #0B2529 below the fixed
          // particle layer (z:1), while this sticky content sits above it (z:2),
          // so the particles drift behind the assembling logo.
          position: 'sticky',
          top: 0,
          height: '100svh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          zIndex: 2,
        }}
      >
        {/* Phase text — paddingTop compensates for sticky nav (banner≈50 + header≈50) */}
        <div
          style={{
            textAlign: 'center',
            padding: '160px 24px 0',
            width: '100%',
            maxWidth: 500,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              <Text
                as="h2"
                fontSize={{ base: 'xl', md: '2xl' }}
                fontWeight="700"
                color="fg.inverse"
                lineHeight="1.25"
                textAlign="center"
              >
                {PHASES[phase].title}
              </Text>
              <Text fontSize="md" color="rgba(244,244,241,.36)" mt="1.5" textAlign="center">
                {PHASES[phase].sub}
              </Text>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Center anchor — all animated elements positioned from here */}
        <div style={{ position: 'absolute', top: '50%', left: '50%' }}>
          {/* ── Assembly glow — renders first so it sits behind all pieces ── */}
          <motion.div
            aria-hidden="true"
            style={{
              opacity: glowOpacity,
              position: 'absolute',
              width: 280,
              height: 280,
              marginLeft: -140,
              marginTop: -140,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(231,255,24,0.13) 0%, transparent 65%)',
              pointerEvents: 'none',
            }}
          />

          {/* ── CONV — Conversaciones, goes to bottom-left of logo (270° shape) ── */}
          <motion.div
            style={{
              x: convX,
              y: convY,
              scale: convScale,
              position: 'absolute',
              width: PIECE,
              height: PIECE,
              marginLeft: -HALF,
              marginTop: -HALF,
            }}
          >
            <svg
              viewBox="0 77 71 71"
              width={PIECE}
              height={PIECE}
              aria-hidden="true"
              style={{ display: 'block', filter: 'drop-shadow(0 0 28px rgba(255,255,255,0.30))' }}
            >
              <motion.path d={PATH} fill={pieceFill} transform="rotate(270 74 74)" />
            </svg>
            <motion.span style={{ ...LABEL, opacity: labelOpacity }}>Chats</motion.span>
          </motion.div>

          {/* ── APPS — Apps, goes to top-left of logo (0° shape) ── */}
          <motion.div
            style={{
              x: appsX,
              y: appsY,
              scale: appsScale,
              position: 'absolute',
              width: PIECE,
              height: PIECE,
              marginLeft: -HALF,
              marginTop: -HALF,
            }}
          >
            <svg
              viewBox="0 0 71 71"
              width={PIECE}
              height={PIECE}
              aria-hidden="true"
              style={{ display: 'block', filter: 'drop-shadow(0 0 28px rgba(255,255,255,0.30))' }}
            >
              <motion.path d={PATH} fill={pieceFill} />
            </svg>
            <motion.span style={{ ...LABEL, opacity: labelOpacity }}>Apps</motion.span>
          </motion.div>

          {/* ── ARCH — Archivos, goes to top-right of logo (90° shape) ── */}
          <motion.div
            style={{
              x: archX,
              y: archY,
              scale: archScale,
              position: 'absolute',
              width: PIECE,
              height: PIECE,
              marginLeft: -HALF,
              marginTop: -HALF,
            }}
          >
            <svg
              viewBox="77 0 71 71"
              width={PIECE}
              height={PIECE}
              aria-hidden="true"
              style={{ display: 'block', filter: 'drop-shadow(0 0 28px rgba(255,255,255,0.30))' }}
            >
              <motion.path d={PATH} fill={pieceFill} transform="rotate(90 74 74)" />
            </svg>
            <motion.span style={{ ...LABEL, opacity: labelOpacity }}>Archivos</motion.span>
          </motion.div>

          {/* ── IA connector piece (180° path, lime) — enters during assembly ── */}
          <motion.div
            style={{
              x: iaX,
              y: iaY,
              scale: iaScale,
              opacity: iaEnter,
              position: 'absolute',
              width: PIECE,
              height: PIECE,
              marginLeft: -HALF,
              marginTop: -HALF,
            }}
          >
            <svg
              viewBox="77 77 71 71"
              width={PIECE}
              height={PIECE}
              aria-hidden="true"
              style={{ display: 'block', filter: 'drop-shadow(0 0 36px rgba(231,255,24,0.55))' }}
            >
              <path d={PATH} fill="#E7FF18" transform="rotate(180 74 74)" />
            </svg>
          </motion.div>

          {/* ── IA flow (below assembled logo) ── */}
          <motion.div
            style={{
              opacity: iaFlowOpacity,
              position: 'absolute',
              top: 96,
              left: -100,
              width: 200,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 1,
                height: 36,
                background:
                  'linear-gradient(to bottom, rgba(231,255,24,0.30), rgba(231,255,24,0.05))',
                margin: '0 auto 8px',
              }}
            />
            <AnimatePresence>
              {showIas &&
                IAS.map(({ name, opacity }, i) => (
                  <motion.p
                    key={name}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.09, duration: 0.3 }}
                    style={{
                      color: `rgba(231,255,24,${opacity})`,
                      fontSize: 14,
                      fontWeight: i % 2 === 0 ? 700 : 500,
                      fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      margin: '5px 0',
                      lineHeight: 1.2,
                    }}
                  >
                    {name}
                  </motion.p>
                ))}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Scroll hint — phase 0 only */}
        <AnimatePresence>
          {phase === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.0, duration: 0.5 }}
              style={{
                position: 'absolute',
                bottom: '6%',
                textAlign: 'center',
                width: '100%',
              }}
            >
              <Text
                fontSize="xs"
                color="rgba(244,244,241,.18)"
                letterSpacing="0.14em"
                textTransform="uppercase"
              >
                Scroll
              </Text>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
