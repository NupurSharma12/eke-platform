'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Check, X, Loader2, ArrowRight } from 'lucide-react';
import type { GeneratedQuestion } from '@/packages/shared-types';
import { QuestionVisual } from '@/components/visuals/QuestionVisual';

type DifficultyOption = 'foundation' | 'grade' | 'advanced' | 'olympiad';

const DIFFICULTIES: { key: DifficultyOption; label: string }[] = [
  { key: 'foundation', label: 'Foundation' },
  { key: 'grade', label: 'Grade' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'olympiad', label: 'Olympiad' },
];

const DEFAULT_CONCEPT_ID = 'fractions';

export default function PracticePage() {
  const { activeChild } = useApp();
  const router = useRouter();

  const [concepts, setConcepts] = useState<{ id: string; name: string }[]>([]);
  const [conceptsError, setConceptsError] = useState<string | null>(null);

  const [conceptId, setConceptId] = useState(DEFAULT_CONCEPT_ID);
  const [difficulty, setDifficulty] = useState<DifficultyOption>('grade');

  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poolExhausted, setPoolExhausted] = useState(false);

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  useEffect(() => {
    fetch('/api/eke/concepts')
      .then((res) => res.json())
      .then((data: { concepts: { id: string; name: string }[] }) => {
        setConcepts(data.concepts);
        if (data.concepts.length > 0 && !data.concepts.some((c) => c.id === DEFAULT_CONCEPT_ID)) {
          setConceptId(data.concepts[0].id);
        }
      })
      .catch(() => setConceptsError('Could not load concepts from the Knowledge Graph.'));
  }, []);

  // Discriminated result rather than a thrown error for the
  // pool-exhausted case — it's an explicit, expected state (every
  // cached question for this concept/difficulty has already been
  // attempted by this student), not a failure.
  type FetchQuestionResult =
    | { kind: 'ok'; question: GeneratedQuestion }
    | { kind: 'pool-exhausted' };

  const fetchQuestion = async (): Promise<FetchQuestionResult> => {
    const res = await fetch('/api/eke/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // studentId scopes the attempt-history exclusion server-side
      // (see packages/knowledge-engine/studentAttempts) — the same
      // dev-bypass identity already used to gate this page.
      body: JSON.stringify({ conceptId, difficulty, studentId: activeChild?.id }),
    });
    const data = await res.json();

    if (res.status === 409 && data.poolExhausted) {
      return { kind: 'pool-exhausted' };
    }

    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate a question.');
    }

    return { kind: 'ok', question: data.question as GeneratedQuestion };
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setPoolExhausted(false);
    setQuestion(null);
    setSelected(null);
    setSubmitted(false);

    try {
      const result = await fetchQuestion();
      if (result.kind === 'pool-exhausted') {
        setPoolExhausted(true);
      } else {
        setQuestion(result.question);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate a question.');
    } finally {
      setLoading(false);
    }
  };

  // Keeps the current (already-submitted) question and its result
  // visible for the entire fetch — only swapped out once a new
  // question actually arrives, so there's no flash of an empty card
  // while the next one loads.
  const nextQuestion = async () => {
    setNextLoading(true);
    setError(null);
    setPoolExhausted(false);

    try {
      const result = await fetchQuestion();
      if (result.kind === 'pool-exhausted') {
        setPoolExhausted(true);
      } else {
        setQuestion(result.question);
        setSelected(null);
        setSubmitted(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the next question.');
    } finally {
      setNextLoading(false);
    }
  };

  const submitAnswer = () => {
    if (!selected || !question) return;
    setSubmitted(true);

    // Recorded on Submit, not on generate/display — a question only
    // counts as "attempted" once the student has actually answered
    // it. Fire-and-forget: this is bookkeeping for future exclusion,
    // not part of the immediate result feedback, so a transient
    // failure here shouldn't block or error out the student's view
    // of their answer.
    if (activeChild) {
      fetch('/api/eke/record-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: activeChild.id, questionId: question.id }),
      }).catch((err) => {
        console.error('Failed to record question attempt:', err);
      });
    }
  };

  if (!activeChild) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  const isCorrect = question ? selected === question.correctAnswer : false;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">📘</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>EKE Practice</h1>
            <p className="opacity-90 mt-1">Questions generated fresh from the Knowledge Engine.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-primary/10 space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Concept</label>
            {conceptsError ? (
              <p className="text-sm text-destructive">{conceptsError}</p>
            ) : (
              <select
                value={conceptId}
                onChange={(e) => setConceptId(e.target.value)}
                className="w-full sm:w-auto border-2 border-primary/10 rounded-xl px-4 py-2.5 font-medium"
              >
                {concepts.length === 0 && (
                  <option value={DEFAULT_CONCEPT_ID}>Fractions</option>
                )}
                {concepts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Difficulty</label>
            <div className="flex gap-2 flex-wrap">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    difficulty === d.key ? 'bg-primary text-primary-foreground' : 'bg-white border-2 border-primary/10 hover:border-primary'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading || nextLoading || !conceptId}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
            {loading ? 'Generating…' : 'Generate Question'}
          </button>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">{error}</div>
          )}

          {poolExhausted && (
            <div className="bg-secondary/10 text-foreground rounded-xl p-3 text-sm font-medium">
              🎉 You&apos;ve attempted every question available for this concept and difficulty. Try a different concept or difficulty!
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {question && (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl border-2 border-primary/10"
            >
              <div className="flex items-start gap-3 mb-6">
                <Mascot mood={submitted ? (isCorrect ? 'celebrating' : 'thinking') : 'happy'} size={56} />
                <h2 className="text-xl lg:text-2xl font-bold pt-2" style={{ fontFamily: 'var(--font-fun)' }}>
                  {question.questionText}
                </h2>
              </div>

              <QuestionVisual spec={question.visualSpec} />

              <div className="grid gap-3">
                {(question.options ?? []).map((opt) => {
                  const isCorrectOption = opt === question.correctAnswer;
                  const isSelected = opt === selected;
                  let style = 'border-2 border-primary/10 bg-white hover:border-primary hover:bg-primary/5';
                  if (submitted) {
                    if (isCorrectOption) style = 'border-2 border-accent bg-accent/10 text-accent';
                    else if (isSelected) style = 'border-2 border-destructive bg-destructive/10 text-destructive';
                    else style = 'border-2 border-muted bg-muted/50 opacity-60';
                  } else if (isSelected) {
                    style = 'border-2 border-primary bg-primary/5';
                  }
                  return (
                    <button
                      key={opt}
                      disabled={submitted}
                      onClick={() => setSelected(opt)}
                      className={`flex items-center justify-between px-5 py-4 rounded-2xl font-semibold text-lg transition-all ${style}`}
                    >
                      <span>{opt}</span>
                      {submitted && isCorrectOption && <Check className="w-6 h-6" />}
                      {submitted && isSelected && !isCorrectOption && <X className="w-6 h-6" />}
                    </button>
                  );
                })}
              </div>

              {!submitted && (
                <button
                  onClick={submitAnswer}
                  disabled={!selected}
                  className="mt-4 w-full bg-primary text-primary-foreground py-3 rounded-2xl font-bold hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  Submit Answer
                </button>
              )}

              {submitted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 space-y-3"
                >
                  <div className={`rounded-2xl p-4 text-center font-bold text-lg ${
                    isCorrect ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-foreground'
                  }`}>
                    {isCorrect ? '🎉 Correct!' : `Not quite — the correct answer is ${question.correctAnswer}.`}
                  </div>
                  <div className="bg-muted/50 rounded-2xl p-4 text-sm">
                    <div className="font-semibold mb-1">Explanation</div>
                    <p className="text-muted-foreground">{question.explanation}</p>
                  </div>

                  <button
                    onClick={nextQuestion}
                    disabled={nextLoading}
                    className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-3 rounded-2xl font-bold hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {nextLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                    {nextLoading ? 'Loading next question…' : 'Next Question'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
