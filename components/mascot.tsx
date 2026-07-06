'use client';

import { motion } from 'framer-motion';

type Mood = 'happy' | 'excited' | 'sleeping' | 'celebrating' | 'thinking' | 'sad';

const moodConfig: Record<Mood, { emoji: string; anim: any }> = {
  happy: { emoji: '🦊', anim: { y: [0, -8, 0], transition: { duration: 2, repeat: Infinity } } },
  excited: { emoji: '🦊', anim: { rotate: [0, -10, 10, 0], y: [0, -12, 0], transition: { duration: 0.6, repeat: Infinity } } },
  sleeping: { emoji: '😴', anim: { rotate: [0, 5, 0], transition: { duration: 3, repeat: Infinity } } },
  celebrating: { emoji: '🦊', anim: { y: [0, -20, 0], rotate: [0, -15, 15, 0], transition: { duration: 0.5, repeat: Infinity } } },
  thinking: { emoji: '🤔', anim: { rotate: [0, -5, 5, 0], transition: { duration: 2, repeat: Infinity } } },
  sad: { emoji: '🦊', anim: { y: [0, 4, 0], transition: { duration: 2, repeat: Infinity } } },
};

export function Mascot({ mood = 'happy', size = 80, message }: { mood?: Mood; size?: number; message?: string }) {
  const cfg = moodConfig[mood];
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        animate={cfg.anim}
        style={{ fontSize: size, lineHeight: 1, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
      >
        {cfg.emoji}
      </motion.div>
      {message && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white rounded-2xl px-4 py-2 text-sm font-medium shadow-lg border-2 border-primary/20 relative max-w-xs text-center"
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l-2 border-t-2 border-primary/20 rotate-45" />
          {message}
        </motion.div>
      )}
    </div>
  );
}

export { moodConfig };
export type { Mood };
