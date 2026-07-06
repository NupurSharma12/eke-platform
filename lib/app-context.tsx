'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { LEVELS, checkBadge } from '@/lib/game';

export type ChildProfile = {
  id: string;
  name: string;
  avatar: string;
  color: string;
};

export type Progress = {
  xp: number;
  level: number;
  coins: number;
  streak: number;
  daily_goal_xp: number;
  daily_xp_earned: number;
  pet_stage: number;
  pet_name: string;
  math_skill_level: number;
};

export type Badge = { badge_key: string; earned_at: string };

export type Settings = {
  dyslexicFont: boolean;
  highContrast: boolean;
  textToSpeech: boolean;
  soundEffects: boolean;
};

type AppState = {
  user: User | null;
  profiles: ChildProfile[];
  activeChild: ChildProfile | null;
  progress: Progress | null;
  badges: string[];
  settings: Settings;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  selectChild: (child: ChildProfile) => void;
  addChild: (name: string, avatar: string, color: string) => Promise<{ error: string | null }>;
  recordQuiz: (subject: string, topic: string, score: number, total: number, difficulty: number) => Promise<void>;
  refreshProgress: () => Promise<void>;
  updateSettings: (s: Partial<Settings>) => void;
  speak: (text: string) => void;
};

const defaultSettings: Settings = {
  dyslexicFont: false,
  highContrast: false,
  textToSpeech: false,
  soundEffects: true,
};

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [activeChild, setActiveChild] = useState<ChildProfile | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // load settings from localStorage
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('alq-settings') : null;
    if (saved) {
      try { setSettings({ ...defaultSettings, ...JSON.parse(saved) }); } catch {}
    }
  }, []);

  // apply settings to document
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
    document.body.classList.toggle('font-dyslexic', settings.dyslexicFont);
    if (typeof window !== 'undefined') localStorage.setItem('alq-settings', JSON.stringify(settings));
  }, [settings]);

  // auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) { setProfiles([]); setActiveChild(null); setProgress(null); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // load profiles when user changes
  const loadProfiles = useCallback(async (uid: string) => {
    const { data } = await supabase.from('child_profiles').select('*').eq('parent_id', uid).order('created_at');
    setProfiles((data || []) as ChildProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) loadProfiles(user.id);
  }, [user, loadProfiles]);

  const refreshProgress = useCallback(async () => {
    if (!activeChild) return;
    const { data } = await supabase.from('progress').select('*').eq('child_id', activeChild.id).maybeSingle();
    if (data) setProgress(data as Progress);
    const { data: bdata } = await supabase.from('badges').select('badge_key').eq('child_id', activeChild.id);
    setBadges((bdata || []).map((b: any) => b.badge_key));
  }, [activeChild]);

  useEffect(() => {
    if (activeChild) refreshProgress();
    else setProgress(null);
  }, [activeChild, refreshProgress]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setActiveChild(null);
    setProfiles([]);
    setProgress(null);
  };

  const selectChild = (child: ChildProfile) => setActiveChild(child);

  const addChild = async (name: string, avatar: string, color: string) => {
    if (!user) return { error: 'Not signed in' };
    const { data, error } = await supabase.from('child_profiles').insert({ parent_id: user.id, name, avatar, color }).select().single();
    if (error) return { error: error.message };
    await loadProfiles(user.id);
    return { error: null };
  };

  const recordQuiz = async (subject: string, topic: string, score: number, total: number, difficulty: number) => {
    if (!activeChild) return;
    const pct = total > 0 ? (score / total) * 100 : 0;
    const xpEarned = Math.round(score * 10 + (pct >= 80 ? 20 : 0));
    const coinsEarned = score * 5;

    // insert quiz result
    await supabase.from('quiz_results').insert({
      child_id: activeChild.id, subject, topic, score, total,
      xp_earned: xpEarned, coins_earned: coinsEarned, difficulty,
    });

    // fetch current progress
    const { data: cur } = await supabase.from('progress').select('*').eq('child_id', activeChild.id).maybeSingle();
    let prog = cur as any;
    if (!prog) {
      await supabase.from('progress').insert({ child_id: activeChild.id });
      const { data } = await supabase.from('progress').select('*').eq('child_id', activeChild.id).maybeSingle();
      prog = data as any;
    }

    const today = new Date().toISOString().slice(0, 10);
    const newStreak = prog.last_active_date === today ? prog.streak : prog.streak + 1;
    const newXp = (prog.xp || 0) + xpEarned;
    const newLevel = LEVELS.findIndex((l) => newXp < l.threshold) === -1 ? LEVELS.length : LEVELS.findIndex((l) => newXp < l.threshold);
    const lvl = newLevel === LEVELS.length ? LEVELS.length : Math.max(1, newLevel);

    // adaptive difficulty
    let newSkill = prog.math_skill_level || 3.0;
    if (subject === 'math') {
      if (pct > 80) newSkill = Math.min(10, newSkill + 0.5);
      else if (pct < 50) newSkill = Math.max(1, newSkill - 0.5);
    }

    const newDailyXp = prog.last_active_date === today ? (prog.daily_xp_earned || 0) + xpEarned : xpEarned;

    await supabase.from('progress').update({
      xp: newXp, level: lvl, coins: (prog.coins || 0) + coinsEarned,
      streak: newStreak, last_active_date: today,
      daily_xp_earned: newDailyXp, math_skill_level: newSkill,
    }).eq('child_id', activeChild.id);

    // check badges
    const newBadges = checkBadge(subject, score, total, badges, newXp, newStreak);
    for (const b of newBadges) {
      await supabase.from('badges').insert({ child_id: activeChild.id, badge_key: b }).maybeSingle();
    }

    // daily challenge
    const { data: dc } = await supabase.from('daily_challenges').select('*').eq('child_id', activeChild.id).eq('challenge_date', today).maybeSingle();
    if (!dc) {
      await supabase.from('daily_challenges').insert({ child_id: activeChild.id, [`${subject}_completed`]: true });
    } else {
      await supabase.from('daily_challenges').update({ [`${subject}_completed`]: true }).eq('id', dc.id);
    }

    // activity log
    await supabase.from('activity_log').insert({ child_id: activeChild.id, activity_type: 'quiz', subject });

    await refreshProgress();
  };

  const updateSettings = (s: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...s }));

  const speak = useCallback((text: string) => {
    if (!settings.textToSpeech || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  }, [settings.textToSpeech]);

  return (
    <AppContext.Provider value={{
      user, profiles, activeChild, progress, badges, settings, loading,
      signIn, signUp, signOut, selectChild, addChild, recordQuiz, refreshProgress, updateSettings, speak,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
