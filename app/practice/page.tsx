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

interface CatalogChapter {
  id: string;
  number: number | null;
  name: string | null;
  status: 'pending' | 'confirmed';
}

interface PracticePaper {
  allocations: { questionType: string; difficulty: string; requested: number; questions: GeneratedQuestion[] }[];
}

export default function PracticePage() {
  const { activeChild } = useApp();
  const router = useRouter();

  // Grade -> Subject -> Chapter content-catalog selection.
  const [grades, setGrades] = useState<number[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradeId, setGradeId] = useState<number | null>(null);

  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const [chapters, setChapters] = useState<CatalogChapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chapterId, setChapterId] = useState<string | null>(null);

  const [catalogError, setCatalogError] = useState<string | null>(null);

  // The generated paper, flattened into a single question-by-question
  // sequence across all blueprint allocations.
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  useEffect(() => {
    setGradesLoading(true);
    setCatalogError(null);
    fetch('/api/eke/chapters')
      .then((res) => res.json())
      .then((data: { grades: number[] }) => setGrades(data.grades))
      .catch(() => setCatalogError('Could not load available grades.'))
      .finally(() => setGradesLoading(false));
  }, []);

  // Grade changes: reset subject/chapter, load subjects for the new grade.
  useEffect(() => {
    setSubjectId(null);
    setChapterId(null);
    setChapters([]);
    setSubjects([]);

    if (gradeId === null) return;

    setSubjectsLoading(true);
    setCatalogError(null);
    fetch(`/api/eke/chapters?gradeId=${gradeId}`)
      .then((res) => res.json())
      .then((data: { subjects: string[] }) => setSubjects(data.subjects))
      .catch(() => setCatalogError('Could not load available subjects.'))
      .finally(() => setSubjectsLoading(false));
  }, [gradeId]);

  // Subject changes: reset chapter, load chapters for the new grade+subject.
  useEffect(() => {
    setChapterId(null);
    setChapters([]);

    if (gradeId === null || subjectId === null) return;

    setChaptersLoading(true);
    setCatalogError(null);
    fetch(`/api/eke/chapters?gradeId=${gradeId}&subjectId=${encodeURIComponent(subjectId)}`)
      .then((res) => res.json())
      .then((data: { chapters: CatalogChapter[] }) => setChapters(data.chapters))
      .catch(() => setCatalogError('Could not load available chapters.'))
      .finally(() => setChaptersLoading(false));
  }, [gradeId, subjectId]);

  const generatePaper = async () => {
    if (gradeId === null || subjectId === null || !chapterId) return;

    setGenerating(true);
    setGenerateError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelected(null);
    setSubmitted(false);

    try {
      const res = await fetch('/api/eke/generate-practice-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId, subjectId, chapterId, studentId: activeChild?.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate a practice paper.');
      }

      const paper = data.paper as PracticePaper;
      const flattened = paper.allocations.flatMap((a) => a.questions);
      setQuestions(flattened);

      if (flattened.length === 0) {
        setGenerateError('No questions were generated for this chapter. Please try again.');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate a practice paper.');
    } finally {
      setGenerating(false);
    }
  };

  const question = questions[currentIndex] ?? null;
  const isCorrect = question ? selected === question.correctAnswer : false;
  const isLastQuestion = currentIndex >= questions.length - 1;

  const submitAnswer = () => {
    if (!selected || !question) return;
    setSubmitted(true);

    // Fire-and-forget bookkeeping, same as before — a transient
    // failure here shouldn't block the student's view of their result.
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

  const nextQuestion = () => {
    setCurrentIndex((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
  };

  if (!activeChild) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  const selectedChapter = chapters.find((c) => c.id === chapterId) ?? null;
  const canGenerate = gradeId !== null && subjectId !== null && !!chapterId && !generating;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">📘</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>EKE Practice</h1>
            <p className="opacity-90 mt-1">Generate a practice paper from the Knowledge Engine.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-primary/10 space-y-4">
          {catalogError && (
            <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">{catalogError}</div>
          )}

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Grade</label>
              <select
                value={gradeId ?? ''}
                onChange={(e) => setGradeId(e.target.value ? Number(e.target.value) : null)}
                disabled={gradesLoading}
                className="w-full border-2 border-primary/10 rounded-xl px-4 py-2.5 font-medium"
              >
                <option value="">{gradesLoading ? 'Loading…' : 'Select grade'}</option>
                {grades.map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
              {!gradesLoading && grades.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No grades available yet.</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Subject</label>
              <select
                value={subjectId ?? ''}
                onChange={(e) => setSubjectId(e.target.value || null)}
                disabled={gradeId === null || subjectsLoading}
                className="w-full border-2 border-primary/10 rounded-xl px-4 py-2.5 font-medium"
              >
                <option value="">{subjectsLoading ? 'Loading…' : 'Select subject'}</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {gradeId !== null && !subjectsLoading && subjects.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No subjects available for this grade yet.</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Chapter</label>
              <select
                value={chapterId ?? ''}
                onChange={(e) => setChapterId(e.target.value || null)}
                disabled={subjectId === null || chaptersLoading}
                className="w-full border-2 border-primary/10 rounded-xl px-4 py-2.5 font-medium"
              >
                <option value="">{chaptersLoading ? 'Loading…' : 'Select chapter'}</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.status !== 'confirmed'}>
                    {c.name ?? c.id}{c.status !== 'confirmed' ? ' (not yet available)' : ''}
                  </option>
                ))}
              </select>
              {subjectId !== null && !chaptersLoading && chapters.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No chapters available for this subject yet.</p>
              )}
            </div>
          </div>

          {selectedChapter && selectedChapter.status !== 'confirmed' && (
            <div className="bg-secondary/10 text-foreground rounded-xl p-3 text-sm font-medium">
              This chapter is still pending confirmation and isn&apos;t available for practice yet.
            </div>
          )}

          <button
            onClick={generatePaper}
            disabled={!canGenerate}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
            {generating ? 'Generating…' : 'Generate Practice Paper'}
          </button>

          {generateError && (
            <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">{generateError}</div>
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
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Question {currentIndex + 1} of {questions.length}
              </div>

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

                  {!isLastQuestion ? (
                    <button
                      onClick={nextQuestion}
                      className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground py-3 rounded-2xl font-bold hover:scale-[1.01] transition-transform"
                    >
                      <ArrowRight className="w-5 h-5" />
                      Next Question
                    </button>
                  ) : (
                    <div className="text-center font-bold text-lg py-2">🎉 Practice paper complete!</div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
