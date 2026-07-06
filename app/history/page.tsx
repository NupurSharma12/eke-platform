'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { QuizEngine } from '@/components/quiz-engine';
import { motion, AnimatePresence } from 'framer-motion';
import { HISTORY_LESSONS, type HistoryLesson } from '@/lib/content/history';
import { Landmark, ArrowRight, Clock, Lightbulb, BookOpen, CheckCircle2 } from 'lucide-react';

export default function HistoryPage() {
  const { activeChild, recordQuiz, speak, settings } = useApp();
  const router = useRouter();
  const [selected, setSelected] = useState<HistoryLesson | null>(null);
  const [phase, setPhase] = useState<'story' | 'timeline' | 'facts' | 'quiz'>('story');

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  useEffect(() => {
    if (selected && phase === 'story' && settings.textToSpeech) speak(selected.story);
  }, [selected, phase, settings.textToSpeech, speak]);

  const openLesson = (lesson: HistoryLesson) => {
    setSelected(lesson);
    setPhase('story');
  };

  const handleQuizComplete = async (score: number, total: number) => {
    if (!activeChild || !selected) return;
    await recordQuiz('history', selected.id, score, total, 3);
  };

  if (!activeChild) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  const colorMap: Record<string, string> = {
    amber: 'from-amber-400 to-amber-600', rose: 'from-rose-400 to-rose-600', orange: 'from-orange-400 to-orange-600',
    teal: 'from-teal-400 to-teal-600', blue: 'from-blue-400 to-blue-600', yellow: 'from-yellow-400 to-yellow-600',
    green: 'from-green-400 to-green-600',
  };

  if (selected) {
    return (
      <AppShell>
        <div className="space-y-6">
          <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            ← Back to all lessons
          </button>

          <div className={`bg-gradient-to-br ${colorMap[selected.color] || 'from-primary to-primary'} rounded-3xl p-6 text-white relative overflow-hidden`}>
            <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">{selected.emoji}</div>
            <div className="relative">
              <div className="text-sm opacity-80 mb-1">{selected.era}</div>
              <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>{selected.title}</h1>
            </div>
          </div>

          {/* Phase tabs */}
          <div className="flex gap-2">
            {[
              { key: 'story', label: 'Story', icon: BookOpen },
              { key: 'timeline', label: 'Timeline', icon: Clock },
              { key: 'facts', label: 'Key Facts', icon: Lightbulb },
              { key: 'quiz', label: 'Mini Quiz', icon: CheckCircle2 },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPhase(p.key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  phase === p.key ? 'bg-primary text-primary-foreground' : 'bg-white border-2 border-primary/10 hover:border-primary'
                }`}
              >
                <p.icon className="w-4 h-4" /> {p.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {phase === 'story' && (
              <motion.div
                key="story"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border-2 border-primary/10"
              >
                <div className="flex items-start gap-4 mb-4">
                  <Mascot mood="happy" size={56} />
                  <div>
                    <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-fun)' }}>Once Upon a Time...</h2>
                    <p className="text-lg leading-relaxed">{selected.story}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPhase('timeline')}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-transform"
                >
                  See the Timeline <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {phase === 'timeline' && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border-2 border-primary/10"
              >
                <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'var(--font-fun)' }}>Timeline of Events</h2>
                <div className="relative pl-8">
                  <div className="absolute left-3 top-0 bottom-0 w-1 bg-primary/20 rounded-full" />
                  {selected.timeline.map((t, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.15 }}
                      className="relative mb-6"
                    >
                      <div className="absolute -left-6 top-1 w-6 h-6 rounded-full bg-primary border-4 border-white shadow" />
                      <div className="bg-primary/5 rounded-2xl p-4">
                        <div className="text-sm font-bold text-primary mb-1">{t.year}</div>
                        <div className="text-foreground">{t.event}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <button
                  onClick={() => setPhase('facts')}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-transform mt-4"
                >
                  See Key Facts <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {phase === 'facts' && (
              <motion.div
                key="facts"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border-2 border-primary/10"
              >
                <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-fun)' }}>Key Facts</h2>
                <div className="grid gap-3">
                  {selected.facts.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3 bg-gradient-to-r from-secondary/10 to-primary/5 rounded-2xl p-4"
                    >
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <p className="text-foreground">{f}</p>
                    </motion.div>
                  ))}
                </div>
                <button
                  onClick={() => setPhase('quiz')}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-transform mt-4"
                >
                  Take the Mini Quiz <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {phase === 'quiz' && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border-2 border-primary/10"
              >
                <QuizEngine
                  questions={selected.quiz}
                  subject="history"
                  topic={selected.id}
                  onComplete={handleQuizComplete}
                  title={`${selected.title} Quiz`}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">🏛️</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>History Time Machine</h1>
            <p className="opacity-90 mt-1">Travel through time and discover amazing stories!</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HISTORY_LESSONS.map((lesson, i) => (
            <motion.button
              key={lesson.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -6, scale: 1.02 }}
              onClick={() => openLesson(lesson)}
              className={`bg-gradient-to-br ${colorMap[lesson.color] || 'from-primary to-primary'} rounded-3xl p-6 text-white text-left shadow-lg relative overflow-hidden`}
            >
              <motion.div
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
                className="text-6xl mb-3"
              >
                {lesson.emoji}
              </motion.div>
              <div className="text-xs opacity-80 mb-1">{lesson.era}</div>
              <h3 className="font-bold text-lg leading-tight" style={{ fontFamily: 'var(--font-fun)' }}>{lesson.title}</h3>
              <div className="flex items-center gap-1 mt-3 text-sm font-medium opacity-90">
                Start Lesson <ArrowRight className="w-4 h-4" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
