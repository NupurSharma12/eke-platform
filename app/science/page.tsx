'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { motion, AnimatePresence } from 'framer-motion';
import { SCIENCE_FACTS, SCIENCE_CATEGORIES, type ScienceFact } from '@/lib/content/science';
import { FlaskConical, Lightbulb, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

export default function SciencePage() {
  const { activeChild, recordQuiz, speak, settings } = useApp();
  const router = useRouter();
  const [category, setCategory] = useState<string>('all');
  const [selected, setSelected] = useState<ScienceFact | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  const facts = category === 'all' ? SCIENCE_FACTS : SCIENCE_FACTS.filter((f) => f.category === category);

  useEffect(() => {
    if (selected && settings.textToSpeech) {
      speak(`${selected.title}. ${selected.fact}. Did you know? ${selected.didYouKnow}`);
    }
  }, [selected, settings.textToSpeech, speak]);

  const openFact = (fact: ScienceFact) => {
    setSelected(fact);
    setIndex(facts.findIndex((f) => f.id === fact.id));
  };

  const navigate = (dir: number) => {
    if (!selected) return;
    const newIdx = (index + dir + facts.length) % facts.length;
    setIndex(newIdx);
    setSelected(facts[newIdx]);
  };

  const markLearned = async () => {
    if (!activeChild || !selected) return;
    await recordQuiz('science', selected.category, 1, 1, 3);
  };

  if (!activeChild) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  const colorMap: Record<string, string> = {
    rose: 'from-rose-400 to-rose-600', amber: 'from-amber-400 to-amber-600', sky: 'from-sky-400 to-sky-600',
    green: 'from-green-400 to-green-600', yellow: 'from-yellow-400 to-yellow-600', blue: 'from-blue-400 to-blue-600',
    orange: 'from-orange-400 to-orange-600', purple: 'from-purple-400 to-purple-600', pink: 'from-pink-400 to-pink-600',
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">🔬</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Science Discovery Lab</h1>
            <p className="opacity-90 mt-1">Discover amazing facts about the world around you!</p>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => { setCategory('all'); setSelected(null); }}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              category === 'all' ? 'bg-primary text-primary-foreground' : 'bg-white border-2 border-primary/10 hover:border-primary'
            }`}
          >
            🌟 All
          </button>
          {SCIENCE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => { setCategory(c); setSelected(null); }}
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                category === c ? 'bg-primary text-primary-foreground' : 'bg-white border-2 border-primary/10 hover:border-primary'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Fact grid or detail */}
        {!selected ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {facts.map((f, i) => (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -6, scale: 1.02 }}
                onClick={() => openFact(f)}
                className={`bg-gradient-to-br ${colorMap[f.color] || 'from-primary to-primary'} rounded-3xl p-6 text-white text-left shadow-lg relative overflow-hidden`}
              >
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
                  className="text-6xl mb-3"
                >
                  {f.emoji}
                </motion.div>
                <div className="text-xs opacity-80 mb-1">{f.category}</div>
                <h3 className="font-bold text-lg leading-tight" style={{ fontFamily: 'var(--font-fun)' }}>{f.title}</h3>
                <div className="flex items-center gap-1 mt-3 text-sm font-medium opacity-90">
                  Discover <ArrowRight className="w-4 h-4" />
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border-2 border-primary/10"
            >
              <div className="flex items-start justify-between mb-4">
                <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Back to all facts
                </button>
                <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">{selected.category}</span>
              </div>

              <div className="flex flex-col items-center text-center mb-6">
                <motion.div
                  animate={{ y: [0, -15, 0], rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-8xl mb-4"
                >
                  {selected.emoji}
                </motion.div>
                <h2 className="text-2xl lg:text-3xl font-bold mb-3" style={{ fontFamily: 'var(--font-fun)' }}>{selected.title}</h2>
                <p className="text-lg text-muted-foreground max-w-2xl">{selected.fact}</p>
              </div>

              <div className="bg-gradient-to-r from-secondary/20 to-primary/10 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Did You Know?</span>
                </div>
                <p className="text-foreground">{selected.didYouKnow}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={markLearned}
                  className="flex-1 bg-accent text-accent-foreground py-3 rounded-2xl font-bold hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" /> Mark as Learned (+10 XP)
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(-1)}
                    className="bg-white border-2 border-primary/20 px-5 py-3 rounded-2xl font-bold hover:border-primary transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-5 h-5" /> Prev
                  </button>
                  <button
                    onClick={() => navigate(1)}
                    className="bg-white border-2 border-primary/20 px-5 py-3 rounded-2xl font-bold hover:border-primary transition-colors flex items-center gap-1"
                  >
                    Next <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </AppShell>
  );
}
