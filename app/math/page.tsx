'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { Confetti } from '@/components/confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { generateMathQuestion, type MathQuestion } from '@/lib/content/math';
import { Calculator, Lightbulb, Coins, Zap, TrendingUp, RotateCcw, Check, X } from 'lucide-react';

const TOPICS = [
  { key: 'all', label: 'All Topics', emoji: '🎯' },
  { key: 'arithmetic', label: 'Arithmetic', emoji: '➕' },
  { key: 'fractions', label: 'Fractions', emoji: '🍕' },
  { key: 'decimals', label: 'Decimals', emoji: '🔢' },
  { key: 'percentages', label: 'Percentages', emoji: '%' },
  { key: 'word_problems', label: 'Word Problems', emoji: '📝' },
];

export default function MathPage() {
  const { activeChild, progress, recordQuiz, speak, settings } = useApp();
  const router = useRouter();
  const [topic, setTopic] = useState('all');
  const [question, setQuestion] = useState<MathQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [coins, setCoins] = useState(0);
  const [sessionStart, setSessionStart] = useState(0);

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  const skill = progress?.math_skill_level || 3;

  const nextQuestion = useCallback(() => {
    let q = generateMathQuestion(skill);
    if (topic !== 'all') {
      let tries = 0;
      while (q.topic !== topic && tries < 10) {
        q = generateMathQuestion(skill);
        tries++;
      }
    }
    setQuestion(q);
    setSelected(null);
    setShowResult(false);
    setShowHint(false);
    if (settings.textToSpeech) speak(q.question);
  }, [skill, topic, settings.textToSpeech, speak]);

  useEffect(() => {
    if (activeChild && !question) {
      setSessionStart(Date.now());
      nextQuestion();
    }
  }, [activeChild, question, nextQuestion]);

  const handleAnswer = (opt: string) => {
    if (showResult || !question) return;
    setSelected(opt);
    setShowResult(true);
    setTotal((t) => t + 1);
    const correct = opt === question.answer;
    if (correct) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      setCoins((c) => c + 5);
      setConfettiTrigger((t) => t + 1);
      speak('Correct! You are a math star!');
    } else {
      setStreak(0);
      speak('Good try! Keep going, you are learning!');
    }
  };

  const handleFinish = async () => {
    if (!activeChild || total === 0) return;
    await recordQuiz('math', topic, score, total, Math.round(skill));
    router.push('/dashboard');
  };

  if (!activeChild || !question) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <AppShell>
      <Confetti trigger={confettiTrigger} />
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">🔢</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Math Adventure Zone</h1>
            <p className="opacity-90 mt-1">Solve problems, earn XP, and level up your math skills!</p>
            <div className="flex gap-3 mt-4">
              <div className="bg-white/20 backdrop-blur rounded-xl px-3 py-1.5 text-sm font-medium flex items-center gap-1">
                <Zap className="w-4 h-4" /> Skill Level: {skill.toFixed(1)}
              </div>
              <div className="bg-white/20 backdrop-blur rounded-xl px-3 py-1.5 text-sm font-medium flex items-center gap-1">
                <TrendingUp className="w-4 h-4" /> {score}/{total} correct
              </div>
              <div className="bg-white/20 backdrop-blur rounded-xl px-3 py-1.5 text-sm font-medium flex items-center gap-1">
                🔥 {streak} streak
              </div>
            </div>
          </div>
        </div>

        {/* Topic selector */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {TOPICS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTopic(t.key); setScore(0); setTotal(0); setStreak(0); setCoins(0); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                topic === t.key ? 'bg-primary text-primary-foreground' : 'bg-white border-2 border-primary/10 hover:border-primary'
              }`}
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${question.question}-${total}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border-2 border-primary/10"
          >
            <div className="flex items-start gap-3 mb-6">
              <Mascot mood={showResult ? (selected === question.answer ? 'celebrating' : 'thinking') : 'happy'} size={56} />
              <div className="flex-1">
                <div className="text-sm text-muted-foreground mb-1 capitalize">{question.topic.replace('_', ' ')}</div>
                <h2 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>{question.question}</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {question.options.map((opt) => {
                const isCorrect = opt === question.answer;
                const isSelected = opt === selected;
                let style = 'border-2 border-primary/10 bg-white hover:border-primary hover:bg-primary/5 hover:scale-[1.02]';
                if (showResult) {
                  if (isCorrect) style = 'border-2 border-accent bg-accent/10 text-accent scale-[1.02]';
                  else if (isSelected) style = 'border-2 border-destructive bg-destructive/10 text-destructive';
                  else style = 'border-2 border-muted bg-muted/50 opacity-50';
                }
                return (
                  <motion.button
                    key={opt}
                    whileHover={!showResult ? { scale: 1.03 } : {}}
                    whileTap={!showResult ? { scale: 0.97 } : {}}
                    disabled={showResult}
                    onClick={() => handleAnswer(opt)}
                    className={`flex items-center justify-center gap-2 px-5 py-5 rounded-2xl font-bold text-xl lg:text-2xl transition-all ${style}`}
                  >
                    {opt}
                    {showResult && isCorrect && <Check className="w-6 h-6" />}
                    {showResult && isSelected && !isCorrect && <X className="w-6 h-6" />}
                  </motion.button>
                );
              })}
            </div>

            {/* Hint */}
            {!showResult && (
              <button
                onClick={() => setShowHint(!showHint)}
                className="mt-4 flex items-center gap-2 text-sm text-secondary font-medium hover:underline"
              >
                <Lightbulb className="w-4 h-4" /> {showHint ? 'Hide hint' : 'Need a hint?'}
              </button>
            )}
            <AnimatePresence>
              {showHint && !showResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 bg-secondary/10 rounded-xl p-3 text-sm"
                >
                  💡 {question.hint}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result feedback */}
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 rounded-2xl p-4 text-center font-bold text-lg ${
                  selected === question.answer ? 'bg-accent/10 text-accent' : 'bg-secondary/10'
                }`}
              >
                {selected === question.answer ? (
                  <span className="flex items-center justify-center gap-2">
                    🎉 Correct! +10 XP +5 coins!
                    {streak >= 3 && <span className="text-secondary">🔥 {streak} in a row!</span>}
                  </span>
                ) : (
                  <span>Almost! The answer is {question.answer}. You are learning! 💪</span>
                )}
              </motion.div>
            )}

            {/* Next button */}
            {showResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3 mt-4"
              >
                <button
                  onClick={nextQuestion}
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-2xl font-bold hover:scale-[1.02] transition-transform"
                >
                  Next Question →
                </button>
                <button
                  onClick={handleFinish}
                  className="bg-white border-2 border-primary/20 px-5 py-3 rounded-2xl font-bold hover:border-primary transition-colors"
                >
                  Finish & Save
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Session stats */}
        {total > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 text-center shadow border-2 border-primary/5">
              <div className="text-2xl font-bold text-accent">{score}</div>
              <div className="text-xs text-muted-foreground">Correct</div>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow border-2 border-primary/5">
              <div className="text-2xl font-bold text-primary">{pct}%</div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow border-2 border-primary/5">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-secondary">
                <Coins className="w-5 h-5" /> {coins}
              </div>
              <div className="text-xs text-muted-foreground">Coins</div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
