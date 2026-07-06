'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { Mascot } from '@/components/mascot';
import { FloatingBackground } from '@/components/floating-background';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, UserPlus, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      router.push('/profiles');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-secondary/5 p-4">
      <FloatingBackground count={8} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 border-primary/10 p-8"
      >
        <div className="flex flex-col items-center mb-6">
          <Mascot mood="happy" size={64} />
          <h1 className="text-2xl font-bold mt-2" style={{ fontFamily: 'var(--font-fun)' }}>
            {mode === 'login' ? 'Parent Login' : 'Create Account'}
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            {mode === 'login' ? 'Sign in to manage your child\'s learning' : 'Create a parent account to get started'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-primary/10 focus:border-primary outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-primary/10 focus:border-primary outline-none transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-xl p-3 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? (
              <><LogIn className="w-5 h-5" /> Sign In</>
            ) : (
              <><UserPlus className="w-5 h-5" /> Create Account</>
            )}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
            className="text-sm text-primary font-medium hover:underline"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
