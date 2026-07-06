'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { BarChart3, Clock, TrendingUp, Award, AlertCircle, CheckCircle2 } from 'lucide-react';

type QuizRow = { subject: string; topic: string; score: number; total: number; created_at: string; difficulty: number };

export default function ParentPage() {
  const { activeChild, profiles, progress, badges } = useApp();
  const router = useRouter();
  const [quizData, setQuizData] = useState<QuizRow[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  useEffect(() => {
    if (!activeChild) return;
    supabase.from('quiz_results').select('*').eq('child_id', activeChild.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setQuizData((data || []) as QuizRow[]));
    supabase.from('activity_log').select('*').eq('child_id', activeChild.id).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setActivityData(data || []));
  }, [activeChild]);

  if (!activeChild || !progress) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  // Compute stats
  const subjectStats: Record<string, { total: number; correct: number; count: number }> = {};
  quizData.forEach((q) => {
    if (!subjectStats[q.subject]) subjectStats[q.subject] = { total: 0, correct: 0, count: 0 };
    subjectStats[q.subject].total += q.total;
    subjectStats[q.subject].correct += q.score;
    subjectStats[q.subject].count += 1;
  });

  const subjectChart = Object.entries(subjectStats).map(([subject, s]) => ({
    subject: subject.charAt(0).toUpperCase() + subject.slice(1),
    accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    quizzes: s.count,
  }));

  const pieData = subjectChart.map((s) => ({ name: s.subject, value: s.quizzes }));
  const PIE_COLORS = ['hsl(250 84% 60%)', 'hsl(142 71% 45%)', 'hsl(45 93% 58%)', 'hsl(0 84% 60%)', 'hsl(199 89% 48%)'];

  // Last 7 days activity
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const dayQuizzes = quizData.filter((q) => q.created_at.startsWith(dateStr));
    return {
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      xp: dayQuizzes.reduce((sum, q) => sum + q.score * 10, 0),
      quizzes: dayQuizzes.length,
    };
  });

  // Strong/weak topics
  const topicStats: Record<string, { correct: number; total: number }> = {};
  quizData.forEach((q) => {
    const key = `${q.subject}/${q.topic}`;
    if (!topicStats[key]) topicStats[key] = { correct: 0, total: 0 };
    topicStats[key].correct += q.score;
    topicStats[key].total += q.total;
  });
  const topicArr = Object.entries(topicStats).map(([topic, s]) => ({
    topic,
    pct: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
  }));
  const strongTopics = [...topicArr].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const weakTopics = [...topicArr].sort((a, b) => a.pct - b.pct).slice(0, 3);

  const totalQuizzes = quizData.length;
  const avgScore = quizData.length > 0 ? Math.round((quizData.reduce((sum, q) => sum + (q.total > 0 ? q.score / q.total : 0), 0) / quizData.length) * 100) : 0;
  const totalTime = activityData.reduce((sum, a) => sum + (a.duration_seconds || 0), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">📊</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Parent Dashboard</h1>
            <p className="opacity-90 mt-1">Track {activeChild.name}'s learning progress</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow border-2 border-primary/5">
            <BarChart3 className="w-6 h-6 text-primary mb-2" />
            <div className="text-2xl font-bold">{totalQuizzes}</div>
            <div className="text-xs text-muted-foreground">Quizzes Taken</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border-2 border-primary/5">
            <TrendingUp className="w-6 h-6 text-accent mb-2" />
            <div className="text-2xl font-bold">{avgScore}%</div>
            <div className="text-xs text-muted-foreground">Average Score</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border-2 border-primary/5">
            <Award className="w-6 h-6 text-secondary mb-2" />
            <div className="text-2xl font-bold">{badges.length}</div>
            <div className="text-xs text-muted-foreground">Badges Earned</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow border-2 border-primary/5">
            <Clock className="w-6 h-6 text-rose-500 mb-2" />
            <div className="text-2xl font-bold">{Math.round(totalTime / 60)}m</div>
            <div className="text-xs text-muted-foreground">Learning Time</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Subject accuracy */}
          <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
            <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-fun)' }}>Accuracy by Subject</h3>
            {subjectChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={subjectChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '2px solid hsl(var(--primary) / 0.2)' }} />
                  <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No quiz data yet</div>
            )}
          </div>

          {/* Quiz distribution pie */}
          <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
            <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-fun)' }}>Quiz Distribution</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No quiz data yet</div>
            )}
          </div>
        </div>

        {/* XP over time */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
          <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-fun)' }}>XP Earned (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={last7}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '2px solid hsl(var(--primary) / 0.2)' }} />
              <Line type="monotone" dataKey="xp" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Strong / Weak topics */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <h3 className="font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Strong Topics</h3>
            </div>
            {strongTopics.length > 0 ? (
              <div className="space-y-2">
                {strongTopics.map((t) => (
                  <div key={t.topic} className="flex items-center justify-between p-3 bg-accent/5 rounded-xl">
                    <span className="text-sm font-medium capitalize">{t.topic.replace(/_/g, ' ')}</span>
                    <span className="text-accent font-bold">{t.pct}%</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Complete more quizzes to see insights!</p>}
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-secondary" />
              <h3 className="font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Areas to Improve</h3>
            </div>
            {weakTopics.length > 0 ? (
              <div className="space-y-2">
                {weakTopics.map((t) => (
                  <div key={t.topic} className="flex items-center justify-between p-3 bg-secondary/5 rounded-xl">
                    <span className="text-sm font-medium capitalize">{t.topic.replace(/_/g, ' ')}</span>
                    <span className="text-secondary font-bold">{t.pct}%</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Complete more quizzes to see insights!</p>}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
          <h3 className="font-bold mb-4" style={{ fontFamily: 'var(--font-fun)' }}>Recent Quiz Results</h3>
          {quizData.length > 0 ? (
            <div className="space-y-2">
              {quizData.slice(0, 10).map((q, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                  <div>
                    <div className="text-sm font-medium capitalize">{q.subject} · {q.topic.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{q.score}/{q.total}</div>
                    <div className="text-xs text-muted-foreground">{Math.round((q.score / q.total) * 100)}%</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No quizzes taken yet.</p>}
        </div>
      </div>
    </AppShell>
  );
}
