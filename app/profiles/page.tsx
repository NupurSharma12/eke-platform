'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { Mascot } from '@/components/mascot';
import { FloatingBackground } from '@/components/floating-background';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowRight, X } from 'lucide-react';

const AVATARS = [
  { key: 'fox', emoji: '🦊' },
  { key: 'owl', emoji: '🦉' },
  { key: 'cat', emoji: '🐱' },
  { key: 'panda', emoji: '🐼' },
  { key: 'lion', emoji: '🦁' },
  { key: 'frog', emoji: '🐸' },
];

export default function ProfilesPage() {
  const { user, profiles, loading, selectChild, addChild } = useApp();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('fox');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const handleAdd = async () => {
    if (!name.trim()) { setError('Please enter a name'); return; }
    setAdding(true);
    setError(null);
    const { error } = await addChild(name.trim(), avatar, 'primary');
    setAdding(false);
    if (error) { setError(error); return; }
    setShowAdd(false);
    setName('');
  };

  const handleSelect = (id: string) => {
    const p = profiles.find((p) => p.id === id);
    if (p) {
      selectChild(p);
      router.push('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Mascot mood="thinking" size={80} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-secondary/5 p-4 lg:p-8">
      <FloatingBackground count={10} />
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <Mascot mood="excited" size={80} />
          <h1 className="text-3xl font-bold mt-2" style={{ fontFamily: 'var(--font-fun)' }}>Who is learning today?</h1>
          <p className="text-muted-foreground mt-1">Pick a profile or create a new one</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p, i) => {
            const av = AVATARS.find((a) => a.key === p.avatar) || AVATARS[0];
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(p.id)}
                className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/10 hover:border-primary transition-colors flex flex-col items-center gap-3"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-5xl">
                  {av.emoji}
                </div>
                <div className="text-xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>{p.name}</div>
                <div className="flex items-center gap-1 text-primary text-sm font-medium">
                  Start Learning <ArrowRight className="w-4 h-4" />
                </div>
              </motion.button>
            );
          })}

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: profiles.length * 0.1 }}
            whileHover={{ y: -6, scale: 1.02 }}
            onClick={() => setShowAdd(true)}
            className="bg-white/60 border-2 border-dashed border-primary/30 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-primary/5 transition-colors min-h-[200px]"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <div className="font-semibold text-primary">Add New Child</div>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowAdd(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 z-50"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>New Child Profile</h2>
                <button onClick={() => setShowAdd(false)} className="p-2 rounded-lg hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Child's Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name"
                    className="w-full px-4 py-3 rounded-xl border-2 border-primary/10 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Pick an Avatar</label>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATARS.map((a) => (
                      <button
                        key={a.key}
                        onClick={() => setAvatar(a.key)}
                        className={`aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all ${
                          avatar === a.key ? 'bg-primary/20 ring-2 ring-primary scale-110' : 'bg-muted hover:bg-primary/10'
                        }`}
                      >
                        {a.emoji}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <div className="bg-destructive/10 text-destructive text-sm rounded-xl p-3 text-center">{error}</div>}
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50"
                >
                  {adding ? 'Creating...' : 'Create Profile'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
