'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { QuizEngine } from '@/components/quiz-engine';
import { motion, AnimatePresence } from 'framer-motion';
import { generateQuizSet } from '@/lib/content/math';
import { SCIENCE_FACTS } from '@/lib/content/science';
import { HISTORY_LESSONS } from '@/lib/content/history';
import { GEOGRAPHY_QUIZZES } from '@/lib/content/geography';
import { Gamepad2, Calculator, FlaskConical, Landmark, Globe, Sparkles, ArrowRight } from 'lucide-react';

const QUIZ_TYPES = [
  { key: 'math', label: 'Math Challenge', emoji: '🔢', icon: Calculator, color: 'from-blue-400 to-blue-600', desc: 'Test your math skills!' },
  { key: 'science', label: 'Science Quiz', emoji: '🔬', icon: FlaskConical, color: 'from-green-400 to-green-600', desc: 'How much do you know about science?' },
  { key: 'history', label: 'History Quiz', emoji: '🏛️', icon: Landmark, color: 'from-amber-400 to-amber-600', desc: 'Travel back in time!' },
  { key: 'geography', label: 'Geography Quiz', emoji: '🌍', icon: Globe, color: 'from-teal-400 to-teal-600', desc: 'Explore the world!' },
  { key: 'mixed', label: 'Mixed Mega Quiz', emoji: '🎮', icon: Sparkles, color: 'from-rose-400 to-rose-600', desc: 'A mix of everything!' },
];

export default function QuizPage() {
  const { activeChild, progress, recordQuiz } = useApp();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  const startQuiz = (type: string) => {
    let qs: any[] = [];
    if (type === 'math') {
      qs = generateQuizSet(progress?.math_skill_level || 3, 8);
    } else if (type === 'science') {
      qs = SCIENCE_FACTS.slice(0, 8).map((f) => ({
        question: `True or False: ${f.title}`,
        options: ['True', 'False'],
        answer: 'True',
        hint: f.fact,
      }));
    } else if (type === 'history') {
      qs = HISTORY_LESSONS.flatMap((l) => l.quiz).sort(() => Math.random() - 0.5).slice(0, 8);
    } else if (type === 'geography') {
      qs = [...GEOGRAPHY_QUIZZES.capitals, ...GEOGRAPHY_QUIZZES.landmarks, ...GEOGRAPHY_QUIZZES.continents]
        .sort(() => Math.random() - 0.5).slice(0, 8);
    } else if (type === 'mixed') {
      const mathQs = generateQuizSet(progress?.math_skill_level || 3, 3);
      const sciQs = SCIENCE_FACTS.slice(0, 2).map((f) => ({
        question: `True or False: ${f.title}`, options: ['True', 'False'], answer: 'True',
      }));
      const histQs = HISTORY_LESSONS.flatMap((l) => l.quiz).sort(() => Math.random() - 0.5).slice(0, 2);
      const geoQs = GEOGRAPHY_QUIZZES.capitals.slice(0, 2);
      qs = [...mathQs, ...sciQs, ...histQs, ...geoQs].sort(() => Math.random() - 0.5);
    }
    setQuestions(qs);
    setSelected(type);
  };

  const handleComplete = async (score: number, total: number) => {
    if (!activeChild) return;
    await recordQuiz(selected || 'mixed', 'quiz_arena', score, total, 3);
  };

  if (!activeChild) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  if (selected) {
    const qt = QUIZ_TYPES.find((q) => q.key === selected);
    return (
      <AppShell>
        <div className="space-y-6">
          <button onClick={() => { setSelected(null); setQuestions([]); }} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to quiz selection
          </button>
          <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border-2 border-primary/10">
            <QuizEngine
              questions={questions}
              subject={selected}
              topic="quiz_arena"
              onComplete={handleComplete}
              title={`${qt?.label || 'Quiz'}`}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">🎮</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Quiz Arena</h1>
            <p className="opacity-90 mt-1">Pick a quiz and test your knowledge. Earn XP and coins!</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUIZ_TYPES.map((q, i) => (
            <motion.button
              key={q.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -6, scale: 1.02 }}
              onClick={() => startQuiz(q.key)}
              className={`bg-gradient-to-br ${q.color} rounded-3xl p-6 text-white text-left shadow-lg relative overflow-hidden`}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.2 }}
                className="text-6xl mb-3"
              >
                {q.emoji}
              </motion.div>
              <h3 className="font-bold text-lg mb-1" style={{ fontFamily: 'var(--font-fun)' }}>{q.label}</h3>
              <p className="text-sm opacity-90 mb-3">{q.desc}</p>
              <div className="flex items-center gap-1 text-sm font-medium opacity-90">
                Start Quiz <ArrowRight className="w-4 h-4" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
