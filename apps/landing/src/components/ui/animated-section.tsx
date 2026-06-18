'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { EASE_SAVIA } from '@/lib/constants';

type FadeInUpProps = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: React.CSSProperties;
  className?: string;
};

export function FadeInUp({ children, delay = 0, distance = 24, ...props }: FadeInUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-64px 0px' });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: reduced ? 0 : distance }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: reduced ? 0 : distance }}
      transition={reduced ? { duration: 0 } : { duration: 0.7, ease: EASE_SAVIA, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
