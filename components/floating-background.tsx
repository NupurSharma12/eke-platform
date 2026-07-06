'use client';

import { motion } from 'framer-motion';

const DECORATIONS = ['⭐', '✨', '🌟', '💫', '☁️', '🌈', '🦋', '🎈'];

export function FloatingBackground({ count = 12 }: { count?: number }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {Array.from({ length: count }).map((_, i) => {
        const emoji = DECORATIONS[i % DECORATIONS.length];
        const left = (i * 37) % 100;
        const size = 16 + (i % 4) * 8;
        const duration = 4 + (i % 5);
        return (
          <motion.div
            key={i}
            className="absolute opacity-20"
            style={{ left: `${left}%`, fontSize: size }}
            animate={{ y: [0, -30, 0], rotate: [0, 10, -10, 0] }}
            transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
          >
            {emoji}
          </motion.div>
        );
      })}
    </div>
  );
}
