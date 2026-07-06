'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { Confetti } from '@/components/confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { BADGES, getPetStage, PETS, getLevel, getLevelProgress, getNextLevel } from '@/lib/game';
import { Trophy, Coins, Star, Flame, Zap, Lock, Sparkles } from 'lucide-react';

export default function RewardsPage() {
  const { activeChild, progress, badges } = useApp();
  const router = useRouter();
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [unlockedBadge, setUnlockedBadge] = useState<string | null>(null);

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  useEffect(() => {
    if (badges.length > 0) {
      const latest = badges[badges.length - 1];
      setUnlockedBadge(latest);
      setConfettiTrigger((t) => t + 1);
      const timer = setTimeout(() => setUnlockedBadge(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [badges.length]);

  if (!activeChild || !progress) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  const level = getLevel(progress.xp);
  const lvlProg = getLevelProgress(progress.xp);
  const nextLevel = getNextLevel(progress.xp);
  const petStage = getPetStage(progress.level);
  const pet = PETS[petStage];
  const earnedBadges = BADGES.filter((b) => badges.includes(b.key));

  return (
    <AppShell>
      <Confetti trigger={confettiTrigger} />
      <div className="space-y-6">
        {/* Badge unlock notification */}
        <AnimatePresence>
          {unlockedBadge && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: -50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -50 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-secondary to-primary text-white rounded-3xl px-8 py-4 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="text-4xl">{BADGES.find((b) => b.key === unlockedBadge)?.emoji}</span>
                <div>
                  <div className="font-bold text-lg">Badge Unlocked!</div>
                  <div className="text-sm opacity-90">{BADGES.find((b) => b.key === unlockedBadge)?.name}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">🏆</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Rewards Center</h1>
            <p className="opacity-90 mt-1">See your badges, pet, and progress!</p>
          </div>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow border-2 border-primary/5 flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            <div><div className="text-2xl font-bold">{progress.xp}</div><div className="text-xs text-muted-foreground">Total XP</div></div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border-2 border-primary/5 flex items-center gap-3">
            <Coins className="w-8 h-8 text-secondary" />
            <div><div className="text-2xl font-bold">{progress.coins}</div><div className="text-xs text-muted-foreground">Coins</div></div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border-2 border-primary/5 flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-500" />
            <div><div className="text-2xl font-bold">{progress.streak}</div><div className="text-xs text-muted-foreground">Day Streak</div></div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border-2 border-primary/5 flex items-center gap-3">
            <Star className="w-8 h-8 text-accent" />
            <div><div className="text-2xl font-bold">{progress.level}</div><div className="text-xs text-muted-foreground">Level</div></div>
          </div>
        </div>

        {/* Virtual Pet */}
        <div className="bg-gradient-to-br from-secondary/20 to-primary/10 rounded-3xl p-6 shadow-lg border-2 border-primary/5">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-fun)' }}>Your Virtual Pet: {progress.pet_name}</h2>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <motion.div
              animate={{ y: [0, -15, 0], rotate: [0, -5, 5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-8xl"
            >
              {pet.emoji}
            </motion.div>
            <div className="flex-1 w-full">
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{pet.name} (Stage {petStage + 1}/{PETS.length})</span>
                  <span className="text-muted-foreground">Level {progress.level}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${lvlProg.pct}%` }}
                    transition={{ duration: 1 }}
                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                  />
                </div>
              </div>
              <p className="text-foreground mb-3">{pet.desc}</p>
              <div className="flex gap-2 flex-wrap">
                {PETS.map((p, i) => (
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                      i <= petStage ? 'bg-white shadow' : 'bg-muted/50 grayscale opacity-40'
                    }`}
                    title={p.name}
                  >
                    {p.emoji}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {petStage < PETS.length - 1 ? `Reach Level ${level.level + 2} to evolve your pet!` : 'Your pet has reached its final form!'}
              </p>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Badges Collection</h2>
            <span className="text-sm text-muted-foreground">{earnedBadges.length}/{BADGES.length} unlocked</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {BADGES.map((b, i) => {
              const earned = badges.includes(b.key);
              return (
                <motion.div
                  key={b.key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={earned ? { scale: 1.05, y: -4 } : {}}
                  className={`rounded-3xl p-4 text-center border-2 transition-all ${
                    earned ? 'bg-gradient-to-br from-secondary/20 to-primary/10 border-primary/20' : 'bg-muted/30 border-muted'
                  }`}
                >
                  <motion.div
                    animate={earned ? { rotate: [0, -10, 10, 0] } : {}}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.1 }}
                    className={`text-5xl mb-2 ${earned ? '' : 'grayscale opacity-30'}`}
                  >
                    {earned ? b.emoji : '🔒'}
                  </motion.div>
                  <div className={`font-bold text-sm ${earned ? '' : 'text-muted-foreground'}`}>{b.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
                  {earned && (
                    <div className="flex items-center justify-center gap-1 mt-2 text-xs text-accent font-medium">
                      <Sparkles className="w-3 h-3" /> Unlocked!
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Level progression */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-fun)' }}>Level Journey</h2>
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => {
              const lvl = i + 1;
              const thresholds = [0, 100, 250, 500, 850, 1300, 1900, 2700, 3700, 5000];
              const reached = progress.xp >= thresholds[i];
              const current = progress.level === lvl;
              return (
                <div key={lvl} className={`flex items-center gap-3 p-3 rounded-xl ${current ? 'bg-primary/10 border-2 border-primary' : reached ? 'bg-accent/5' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${reached ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'}`}>
                    {reached ? '✓' : lvl}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Level {lvl} — {['Rookie Explorer', 'Curious Scout', 'Brave Adventurer', 'Knowledge Seeker', 'Star Learner', 'Super Scholar', 'Master Explorer', 'Grand Champion', 'Legendary Hero', 'Ultimate Quest Master'][i]}</div>
                    <div className="text-xs text-muted-foreground">{thresholds[i]} XP</div>
                  </div>
                  {current && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full font-medium">You are here!</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
