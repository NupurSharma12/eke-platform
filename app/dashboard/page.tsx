'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { motion } from 'framer-motion';
import { Calculator, FlaskConical, Landmark, Globe, Gamepad2, Trophy, Flame, Star, Coins, Target, TrendingUp, ArrowRight, Zap } from 'lucide-react';
import { getLevel, getLevelProgress, getNextLevel, BADGES, getPetStage, PETS } from '@/lib/game';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const ZONES = [
  { href: '/math', label: 'Math Adventure', icon: Calculator, color: 'from-blue-400 to-blue-600', emoji: '🔢' },
  { href: '/science', label: 'Science Lab', icon: FlaskConical, color: 'from-green-400 to-green-600', emoji: '🔬' },
  { href: '/history', label: 'History Time Machine', icon: Landmark, color: 'from-amber-400 to-amber-600', emoji: '🏛️' },
  { href: '/geography', label: 'Geography Explorer', icon: Globe, color: 'from-teal-400 to-teal-600', emoji: '🌍' },
  { href: '/quiz', label: 'Quiz Arena', icon: Gamepad2, color: 'from-rose-400 to-rose-600', emoji: '🎮' },
  { href: '/rewards', label: 'Rewards Center', icon: Trophy, color: 'from-yellow-400 to-orange-500', emoji: '🏆' },
];

export default function DashboardPage() {
  const { activeChild, progress, badges, loading } = useApp();
  const router = useRouter();
  const [quizCount, setQuizCount] = useState(0);
  const [dailyDone, setDailyDone] = useState({ math: false, science: false, history: false, quiz: false });

  useEffect(() => {
    if (!loading && !activeChild) router.push('/login');
  }, [loading, activeChild, router]);

  useEffect(() => {
    if (!activeChild) return;
    supabase.from('quiz_results').select('id', { count: 'exact', head: true }).eq('child_id', activeChild.id)
      .then(({ count }) => setQuizCount(count || 0));
    const today = new Date().toISOString().slice(0, 10);
    supabase.from('daily_challenges').select('*').eq('child_id', activeChild.id).eq('challenge_date', today).maybeSingle()
      .then(({ data }) => {
        if (data) setDailyDone({ math: data.math_completed, science: data.science_completed, history: data.history_completed, quiz: data.quiz_completed });
      });
  }, [activeChild]);

  if (!activeChild || !progress) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  const level = getLevel(progress.xp);
  const nextLevel = getNextLevel(progress.xp);
  const lvlProg = getLevelProgress(progress.xp);
  const petStage = getPetStage(progress.level);
  const pet = PETS[petStage];
  const dailyPct = Math.min(100, Math.round((progress.daily_xp_earned / progress.daily_goal_xp) * 100));
  const earnedBadges = BADGES.filter((b) => badges.includes(b.key));

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-secondary/20 rounded-full translate-y-1/2" />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Mascot mood="excited" size={64} />
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>
                  Hi, {activeChild.name}! 👋
                </h1>
                <p className="opacity-90">Level {level.level} · {level.title}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2 text-center">
                <div className="flex items-center gap-1 text-2xl font-bold"><Zap className="w-5 h-5" /> {progress.xp}</div>
                <div className="text-xs opacity-80">Total XP</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2 text-center">
                <div className="flex items-center gap-1 text-2xl font-bold"><Flame className="w-5 h-5" /> {progress.streak}</div>
                <div className="text-xs opacity-80">Day Streak</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2 text-center">
                <div className="flex items-center gap-1 text-2xl font-bold"><Coins className="w-5 h-5" /> {progress.coins}</div>
                <div className="text-xs opacity-80">Coins</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Level + Daily Goal */}
        <div className="grid lg:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fun)' }}>Level Progress</h3>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {level.level}
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{progress.xp} XP</span>
                  <span className="text-muted-foreground">{nextLevel ? `${nextLevel.threshold} XP` : 'Max Level!'}</span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${lvlProg.pct}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full relative"
                  >
                    <div className="absolute inset-0 bg-white/30 animate-pulse" />
                  </motion.div>
                </div>
              </div>
            </div>
            {nextLevel && (
              <p className="text-sm text-muted-foreground">
                {nextLevel.threshold - progress.xp} XP to reach Level {nextLevel.level} — {nextLevel.title}!
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fun)' }}>Daily Goal</h3>
              <Target className="w-5 h-5 text-accent" />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <motion.circle
                    cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--accent))" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 34}
                    initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - dailyPct / 100) }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">{dailyPct}%</div>
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold">{progress.daily_xp_earned} / {progress.daily_goal_xp} XP</div>
                <p className="text-sm text-muted-foreground">
                  {dailyPct >= 100 ? 'Goal complete! Amazing! 🎉' : `Earn ${progress.daily_goal_xp - progress.daily_xp_earned} more XP today!`}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Zones */}
        <div>
          <h2 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-fun)' }}>Choose Your Adventure</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ZONES.map((z, i) => (
              <motion.div
                key={z.href}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                whileHover={{ y: -6 }}
              >
                <Link href={z.href} className="block bg-white rounded-3xl p-5 shadow-lg border-2 border-primary/5 hover:border-primary transition-colors">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${z.color} flex items-center justify-center mb-3`}>
                    <z.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-lg" style={{ fontFamily: 'var(--font-fun)' }}>{z.label}</div>
                      <div className="text-2xl">{z.emoji}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Daily Challenges + Pet + Badges */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Daily challenges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-white rounded-3xl p-5 shadow-lg border-2 border-primary/5"
          >
            <h3 className="font-bold mb-3" style={{ fontFamily: 'var(--font-fun)' }}>Today's Challenges</h3>
            <div className="space-y-2">
              {[
                { label: 'Daily Math', done: dailyDone.math, icon: Calculator },
                { label: 'Daily Science', done: dailyDone.science, icon: FlaskConical },
                { label: 'Daily History', done: dailyDone.history, icon: Landmark },
                { label: 'Daily Quiz', done: dailyDone.quiz, icon: Gamepad2 },
              ].map((c) => (
                <div key={c.label} className={`flex items-center gap-2 p-2 rounded-xl ${c.done ? 'bg-accent/10' : 'bg-muted/50'}`}>
                  <c.icon className={`w-5 h-5 ${c.done ? 'text-accent' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${c.done ? 'text-accent' : ''}`}>{c.label}</span>
                  {c.done && <Star className="w-4 h-4 text-accent ml-auto fill-accent" />}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Virtual Pet */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-secondary/20 to-primary/10 rounded-3xl p-5 shadow-lg border-2 border-primary/5 flex flex-col items-center"
          >
            <h3 className="font-bold mb-2" style={{ fontFamily: 'var(--font-fun)' }}>Your Pet: {progress.pet_name}</h3>
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, -5, 5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-7xl my-2"
            >
              {pet.emoji}
            </motion.div>
            <div className="text-center">
              <div className="font-semibold">{pet.name} Stage</div>
              <p className="text-sm text-muted-foreground">{pet.desc}</p>
              <p className="text-xs text-muted-foreground mt-1">Reach Level {petStage + 2 < PETS.length ? petStage + 2 : petStage + 1} to evolve!</p>
            </div>
          </motion.div>

          {/* Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-white rounded-3xl p-5 shadow-lg border-2 border-primary/5"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Badges</h3>
              <span className="text-sm text-muted-foreground">{earnedBadges.length}/{BADGES.length}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {BADGES.map((b) => {
                const earned = badges.includes(b.key);
                return (
                  <div
                    key={b.key}
                    title={`${b.name}: ${b.desc}`}
                    className={`aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all ${
                      earned ? 'bg-gradient-to-br from-secondary/30 to-primary/20 scale-100' : 'bg-muted/50 grayscale opacity-40 scale-95'
                    }`}
                  >
                    {b.emoji}
                  </div>
                );
              })}
            </div>
            <Link href="/rewards" className="text-sm text-primary font-medium hover:underline mt-3 block">
              View all rewards →
            </Link>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Quizzes Done', value: quizCount, icon: Gamepad2, color: 'text-rose-500' },
            { label: 'Badges Earned', value: earnedBadges.length, icon: Trophy, color: 'text-yellow-500' },
            { label: 'Current Level', value: progress.level, icon: Star, color: 'text-primary' },
            { label: 'Day Streak', value: progress.streak, icon: Flame, color: 'text-orange-500' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow border-2 border-primary/5 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
