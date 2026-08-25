'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Calculator, FlaskConical, Landmark, Globe, Trophy, Settings, LogOut, Menu, X, Gamepad2, BarChart3, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Mascot } from '@/components/mascot';
import { getLevel } from '@/lib/game';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/math', label: 'Math', icon: Calculator },
  { href: '/science', label: 'Science', icon: FlaskConical },
  { href: '/history', label: 'History', icon: Landmark },
  { href: '/geography', label: 'Geography', icon: Globe },
  { href: '/quiz', label: 'Quiz', icon: Gamepad2 },
  { href: '/practice', label: 'EKE Practice', icon: BookOpen },
  { href: '/rewards', label: 'Rewards', icon: Trophy },
  { href: '/parent', label: 'Parent', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeChild, progress, signOut } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!activeChild) {
    return <>{children}</>;
  }

  const level = progress ? getLevel(progress.xp) : null;

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-grid">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col bg-white/80 backdrop-blur border-r-2 border-primary/10 p-4 z-40">
        <Link href="/dashboard" className="flex items-center gap-2 mb-6 px-2">
          <Mascot mood="happy" size={40} />
          <div>
            <div className="font-bold text-lg leading-tight" style={{ fontFamily: 'var(--font-fun)' }}>Quest</div>
            <div className="text-xs text-muted-foreground">Learning Adventure</div>
          </div>
        </Link>

        <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-3 mb-4 border-2 border-primary/10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl">
              {activeChild.avatar === 'fox' ? '🦊' : activeChild.avatar === 'owl' ? '🦉' : activeChild.avatar === 'cat' ? '🐱' : '🐼'}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{activeChild.name}</div>
              <div className="text-xs text-muted-foreground">{level ? `Level ${level.level} · ${progress?.xp ?? 0} XP` : ''}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'hover:bg-primary/10 text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-destructive/10 text-destructive transition-all"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/90 backdrop-blur border-b-2 border-primary/10 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Mascot mood="happy" size={32} />
          <span className="font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Quest</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{progress?.xp ?? 0} XP</span>
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-primary/10">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed right-0 top-0 h-screen w-72 bg-white z-50 p-4 flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-bold text-lg" style={{ fontFamily: 'var(--font-fun)' }}>Menu</span>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-primary/10">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 flex flex-col gap-1">
                {NAV.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                        active ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium hover:bg-destructive/10 text-destructive"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="lg:ml-64 min-h-screen">
        <div className="max-w-6xl mx-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
