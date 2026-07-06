'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

type Piece = { id: number; x: number; y: number; emoji: string; delay: number; rotate: number };

const EMOJIS = ['🎉', '🎊', '⭐', '✨', '🪙', '🌟', '💫', '🏆', '🎈', '🦊'];

export function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const newPieces: Piece[] = Array.from({ length: 40 }, (_, i) => ({
      id: trigger * 100 + i,
      x: Math.random() * 100,
      y: -10,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      delay: Math.random() * 0.3,
      rotate: Math.random() * 360,
    }));
    setPieces(newPieces);
    const t = setTimeout(() => setPieces([]), 3000);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {pieces.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: `${p.x}vw`, y: '-10vh', opacity: 1, rotate: 0 }}
            animate={{ y: '110vh', opacity: [1, 1, 0], rotate: p.rotate }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, delay: p.delay, ease: 'easeIn' }}
            className="absolute text-3xl"
          >
            {p.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
