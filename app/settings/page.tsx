'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app-context';
import { AppShell } from '@/components/app-shell';
import { Mascot } from '@/components/mascot';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Type, Contrast, Volume2, Sparkles, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { activeChild, settings, updateSettings, speak, signOut } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!activeChild) router.push('/login');
  }, [activeChild, router]);

  if (!activeChild) {
    return <AppShell><div className="flex items-center justify-center min-h-[60vh]"><Mascot mood="thinking" size={80} /></div></AppShell>;
  }

  const testSpeech = () => {
    speak('Hello! This is how the text to speech sounds. I can read questions and facts for you!');
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 text-9xl opacity-20 -translate-y-1/4">⚙️</div>
          <div className="relative">
            <h1 className="text-2xl lg:text-3xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Settings</h1>
            <p className="opacity-90 mt-1">Make learning work best for you</p>
          </div>
        </div>

        {/* Accessibility */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-fun)' }}>
            <Sparkles className="w-5 h-5 text-primary" /> Accessibility
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-3">
                <Type className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium">Dyslexia-friendly font</div>
                  <div className="text-sm text-muted-foreground">Uses a font that is easier to read</div>
                </div>
              </div>
              <Switch checked={settings.dyslexicFont} onCheckedChange={(v) => updateSettings({ dyslexicFont: v })} />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-3">
                <Contrast className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium">High contrast mode</div>
                  <div className="text-sm text-muted-foreground">Stronger colors for better visibility</div>
                </div>
              </div>
              <Switch checked={settings.highContrast} onCheckedChange={(v) => updateSettings({ highContrast: v })} />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium">Text-to-speech</div>
                  <div className="text-sm text-muted-foreground">Reads questions and facts aloud</div>
                </div>
              </div>
              <Switch checked={settings.textToSpeech} onCheckedChange={(v) => updateSettings({ textToSpeech: v })} />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium">Sound effects</div>
                  <div className="text-sm text-muted-foreground">Fun sounds for correct answers</div>
                </div>
              </div>
              <Switch checked={settings.soundEffects} onCheckedChange={(v) => updateSettings({ soundEffects: v })} />
            </div>
          </div>

          {settings.textToSpeech && (
            <button
              onClick={testSpeech}
              className="mt-4 flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <Volume2 className="w-4 h-4" /> Test text-to-speech
            </button>
          )}
        </div>

        {/* Keyboard navigation info */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-fun)' }}>
            <Info className="w-5 h-5 text-primary" /> Keyboard Navigation
          </h2>
          <p className="text-sm text-muted-foreground mb-3">You can navigate this app using your keyboard:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <kbd className="px-2 py-1 bg-white border rounded text-xs">Tab</kbd>
              <span>Move between buttons</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <kbd className="px-2 py-1 bg-white border rounded text-xs">Enter</kbd>
              <span>Select an option</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <kbd className="px-2 py-1 bg-white border rounded text-xs">1-4</kbd>
              <span>Quick answer select</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <kbd className="px-2 py-1 bg-white border rounded text-xs">Esc</kbd>
              <span>Close menus</span>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5">
          <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'var(--font-fun)' }}>Account</h2>
          <p className="text-sm text-muted-foreground mb-4">Signed in as {activeChild.name}'s parent</p>
          <button
            onClick={async () => { await signOut(); router.push('/'); }}
            className="bg-destructive/10 text-destructive px-4 py-2 rounded-xl text-sm font-medium hover:bg-destructive/20 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </AppShell>
  );
}
