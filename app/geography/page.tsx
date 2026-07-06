'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { QuizEngine } from '@/components/quiz-engine';
import { motion, AnimatePresence } from 'framer-motion';
import { COUNTRIES, CONTINENTS, GEOGRAPHY_QUIZZES, type Country } from '@/lib/content/geography';
import { Globe, ArrowRight, MapPin, Sparkles, Gamepad2 } from 'lucide-react';

export default function GeographyPage() {
  const { activeChild, recordQuiz, speak, settings } = useApp();
  const router = useRouter();
  const [continent, setContinent] = useState('all');
  const [selected, setSelected] = useState<Country | null>(null);
  const [quizMode, setQuizMode] = useState(false);

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  useEffect(() => {
    if (selected && settings.textToSpeech) {
      speak(`${selected.name}. Capital: ${selected.capital}. ${selected.funFacts[0]}`);
    }
  }, [selected, settings.textToSpeech, speak]);

  const countries = continent === 'all' ? COUNTRIES : COUNTRIES.filter((c) => c.continent === continent);

  const handleQuizComplete = async (score: number, total: number) => {
    if (!activeChild) return;
    await recordQuiz('geography', 'mixed', score, total, 3);
  };

  const markExplored = async () => {
    if (!activeChild || !selected) return;
    await recordQuiz('geography', selected.id, 1, 1, 3);
  };

  if (!activeChild) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  const colorMap: Record<string, string> = {
    orange: 'from-orange-400 to-orange-600', rose: 'from-rose-400 to-rose-600', amber: 'from-amber-400 to-amber-600',
    blue: 'from-blue-400 to-blue-600', green: 'from-green-400 to-green-600', yellow: 'from-yellow-400 to-yellow-600',
    sky: 'from-sky-400 to-sky-600', teal: 'from-teal-400 to-teal-600', red: 'from-red-400 to-red-600',
    indigo: 'from-indigo-400 to-indigo-600',
  };

  if (quizMode) {
    const allQuiz = [...GEOGRAPHY_QUIZZES.capitals, ...GEOGRAPHY_QUIZZES.landmarks, ...GEOGRAPHY_QUIZZES.continents]
      .sort(() => Math.random() - 0.5).slice(0, 8);
    return (
      <AppShell>
        <div className="space-y-6">
          <button onClick={() => setQuizMode(false)} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to map
          </button>
          <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border-2 border-primary/10">
            <QuizEngine
              questions={allQuiz}
              subject="geography"
              topic="mixed"
              onComplete={handleQuizComplete}
              title="Geography Quiz"
            />
          </div>
        </div>
      </AppShell>
    );
  }

  if (selected) {
    return (
      <AppShell>
        <div className="space-y-6">
          <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to all countries
          </button>

          <div className={`bg-gradient-to-br ${colorMap[selected.color] || 'from-primary to-primary'} rounded-3xl p-6 text-white relative overflow-hidden`}>
            <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">{selected.flag}</div>
            <div className="relative">
              <div className="text-6xl mb-2">{selected.flag}</div>
              <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>{selected.name}</h1>
              <p className="opacity-90 mt-1">{selected.continent}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Capital + Landmark */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5"
            >
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Capital City</h3>
              </div>
              <div className="text-2xl font-bold mb-4">{selected.capital}</div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{selected.landmarkEmoji}</span>
                <h4 className="font-bold">{selected.landmark}</h4>
              </div>
              <p className="text-sm text-muted-foreground">A famous landmark in {selected.name}!</p>
            </motion.div>

            {/* Animal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🐾</span>
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-fun)' }}>National Animal</h3>
              </div>
              <motion.div
                animate={{ y: [0, -10, 0], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl text-center my-4"
              >
                {selected.animalEmoji}
              </motion.div>
              <div className="text-center font-bold text-lg">{selected.animal}</div>
            </motion.div>
          </div>

          {/* Fun facts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5"
          >
            <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-fun)' }}>Fun Facts About {selected.name}</h3>
            <div className="grid gap-3">
              {selected.funFacts.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="flex items-start gap-3 bg-gradient-to-r from-secondary/10 to-primary/5 rounded-2xl p-4"
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <p>{f}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <button
            onClick={markExplored}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground py-3 rounded-2xl font-bold hover:scale-[1.02] transition-transform"
          >
            <Sparkles className="w-5 h-5" /> Mark as Explored (+10 XP)
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">🌍</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Geography Explorer</h1>
            <p className="opacity-90 mt-1">Explore countries, capitals, and landmarks around the world!</p>
            <button
              onClick={() => setQuizMode(true)}
              className="mt-4 flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-xl font-medium hover:bg-white/30 transition-colors"
            >
              <Gamepad2 className="w-5 h-5" /> Take Geography Quiz
            </button>
          </div>
        </div>

        {/* Continent filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setContinent('all')}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              continent === 'all' ? 'bg-primary text-primary-foreground' : 'bg-white border-2 border-primary/10 hover:border-primary'
            }`}
          >
            🌎 All
          </button>
          {CONTINENTS.map((c) => (
            <button
              key={c}
              onClick={() => setContinent(c)}
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                continent === c ? 'bg-primary text-primary-foreground' : 'bg-white border-2 border-primary/10 hover:border-primary'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Countries grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {countries.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -6, scale: 1.02 }}
              onClick={() => setSelected(c)}
              className={`bg-gradient-to-br ${colorMap[c.color] || 'from-primary to-primary'} rounded-3xl p-6 text-white text-left shadow-lg relative overflow-hidden`}
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.2 }}
                className="text-5xl mb-3"
              >
                {c.flag}
              </motion.div>
              <div className="text-xs opacity-80 mb-1">{c.continent}</div>
              <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--font-fun)' }}>{c.name}</h3>
              <div className="text-sm opacity-90 mt-1">Capital: {c.capital}</div>
              <div className="flex items-center gap-1 mt-3 text-sm font-medium opacity-90">
                Explore <ArrowRight className="w-4 h-4" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
