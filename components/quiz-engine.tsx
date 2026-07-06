'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Lightbulb, ChevronRight, RotateCcw } from 'lucide-react';
import { Mascot } from '@/components/mascot';
import { useApp } from '@/lib/app-context';

export type QuizItem = {
  question: string;
  options: string[];
  answer: string;
  hint?: string;
};

export function QuizEngine({
  questions,
  subject,
  topic,
  onComplete,
  title = 'Quiz Time!',
}: {
  questions: QuizItem[];
  subject: string;
  topic: string;
  onComplete?: (score: number, total: number) => void;
  title?: string;
}) {
  const { speak, settings } = useApp();
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const q = questions[current];

  useEffect(() => {
    if (settings.textToSpeech && q) speak(q.question);
  }, [current, q, settings.textToSpeech, speak]);

  const handleSelect = (opt: string) => {
    if (showResult) return;
    setSelected(opt);
    setShowResult(true);
    const correct = opt === q.answer;
    setAnswers((prev) => [...prev, correct]);
    if (correct) {
      setScore((s) => s + 1);
      speak('Great job! That is correct!');
    } else {
      speak('Good try! Let us learn from this one.');
    }
    setTimeout(() => {
      if (current + 1 < questions.length) {
        setCurrent((c) => c + 1);
        setSelected(null);
        setShowResult(false);
        setShowHint(false);
      } else {
        setFinished(true);
        onComplete?.(correct ? score + 1 : score, questions.length);
      }
    }, 2000);
  };

  const restart = () => {
    setCurrent(0); setSelected(null); setShowResult(false); setShowHint(false);
    setScore(0); setFinished(false); setAnswers([]);
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 py-8"
      >
        <Mascot mood={pct >= 80 ? 'celebrating' : pct >= 50 ? 'excited' : 'happy'} size={100}
          message={pct >= 80 ? 'Amazing work!' : pct >= 50 ? 'Great effort!' : 'Keep practicing!'} />
        <div className="text-center">
          <div className="text-5xl font-bold mb-2" style={{ fontFamily: 'var(--font-fun)' }}>
            {score} / {questions.length}
          </div>
          <div className="text-xl text-muted-foreground">{pct}% correct</div>
        </div>
        <div className="flex gap-2 flex-wrap justify-center max-w-md">
          {answers.map((a, i) => (
            <div key={i} className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
              a ? 'bg-accent' : 'bg-destructive/70'
            }`}>
              {a ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </div>
          ))}
        </div>
        <div className="bg-gradient-to-r from-secondary/20 to-primary/20 rounded-2xl px-6 py-4 text-center">
          <div className="text-2xl font-bold">+{score * 10 + (pct >= 80 ? 20 : 0)} XP earned!</div>
          <div className="text-lg">+{score * 5} coins collected!</div>
        </div>
        <button onClick={restart} className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-semibold hover:scale-105 transition-transform">
          <RotateCcw className="w-5 h-5" /> Try Again
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="text-sm font-medium">Question {current + 1} of {questions.length}</div>
      </div>
      <div className="flex gap-1.5 mb-6">
        {questions.map((_, i) => (
          <div key={i} className={`h-2 flex-1 rounded-full ${i < current ? 'bg-accent' : i === current ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="bg-white rounded-3xl p-6 shadow-xl border-2 border-primary/10"
        >
          <div className="flex items-start gap-3 mb-6">
            <Mascot mood="thinking" size={48} />
            <h2 className="text-xl font-bold pt-2" style={{ fontFamily: 'var(--font-fun)' }}>{q.question}</h2>
          </div>

          <div className="grid gap-3">
            {q.options.map((opt) => {
              const isCorrect = opt === q.answer;
              const isSelected = opt === selected;
              let style = 'border-2 border-primary/10 bg-white hover:border-primary hover:bg-primary/5';
              if (showResult) {
                if (isCorrect) style = 'border-2 border-accent bg-accent/10 text-accent';
                else if (isSelected) style = 'border-2 border-destructive bg-destructive/10 text-destructive';
                else style = 'border-2 border-muted bg-muted/50 opacity-60';
              }
              return (
                <motion.button
                  key={opt}
                  whileHover={!showResult ? { scale: 1.02 } : {}}
                  whileTap={!showResult ? { scale: 0.98 } : {}}
                  disabled={showResult}
                  onClick={() => handleSelect(opt)}
                  className={`flex items-center justify-between px-5 py-4 rounded-2xl font-semibold text-lg transition-all ${style}`}
                >
                  <span>{opt}</span>
                  {showResult && isCorrect && <Check className="w-6 h-6" />}
                  {showResult && isSelected && !isCorrect && <X className="w-6 h-6" />}
                </motion.button>
              );
            })}
          </div>

          {q.hint && !showResult && (
            <>
              <button
                onClick={() => setShowHint(!showHint)}
                className="mt-4 flex items-center gap-2 text-sm text-secondary font-medium hover:underline"
              >
                <Lightbulb className="w-4 h-4" /> {showHint ? 'Hide hint' : 'Need a hint?'}
              </button>
              <AnimatePresence>
                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 bg-secondary/10 rounded-xl p-3 text-sm text-foreground"
                  >
                    {q.hint}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 rounded-xl p-3 text-center font-medium ${
                selected === q.answer ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-foreground'
              }`}
            >
              {selected === q.answer ? '🎉 Correct! Great job!' : `The answer is ${q.answer}. You will get it next time!`}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
