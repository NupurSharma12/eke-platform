'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mascot } from '@/components/mascot';
import { FloatingBackground } from '@/components/floating-background';
import { Calculator, FlaskConical, Landmark, Globe, Trophy, Sparkles, ArrowRight, Star, Zap, Heart } from 'lucide-react';

const FEATURES = [
  { icon: Calculator, title: 'Math Adventure', desc: 'Unlimited Grade 5 math with adaptive difficulty', color: 'from-blue-400 to-blue-600' },
  { icon: FlaskConical, title: 'Science Lab', desc: 'Discover amazing facts about the world', color: 'from-green-400 to-green-600' },
  { icon: Landmark, title: 'History Time Machine', desc: 'Travel through time with fun stories', color: 'from-amber-400 to-amber-600' },
  { icon: Globe, title: 'Geography Explorer', desc: 'Explore countries and landmarks', color: 'from-teal-400 to-teal-600' },
];

const STATS = [
  { icon: Zap, label: 'XP Points', value: 'Earn & Level Up' },
  { icon: Trophy, label: 'Badges', value: '8 to Unlock' },
  { icon: Star, label: 'Streaks', value: 'Daily Goals' },
  { icon: Heart, label: 'Virtual Pet', value: 'Grows With You' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-secondary/5 to-accent/5">
      <FloatingBackground count={15} />

      {/* Nav */}
      <nav className="flex items-center justify-between p-4 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Mascot mood="happy" size={40} />
          <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-fun)' }}>Adventure Learning Quest</span>
        </div>
        <Link href="/login" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold hover:scale-105 transition-transform">
          Parent Login
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-12 lg:py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6"
        >
          <Mascot mood="excited" size={120} message="Hi! I am your learning buddy!" />
          <div className="inline-flex items-center gap-2 bg-secondary/20 text-secondary px-4 py-2 rounded-full text-sm font-semibold">
            <Sparkles className="w-4 h-4" /> For curious 5th graders aged 10-11
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold max-w-3xl" style={{ fontFamily: 'var(--font-fun)' }}>
            Learning is an <span className="text-primary">Adventure!</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl">
            Explore math, science, history, and geography through fun quizzes, games, and rewards. Level up, earn badges, and grow your virtual pet!
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/login" className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-2xl text-lg font-bold hover:scale-105 transition-transform shadow-lg shadow-primary/30">
              Start Your Quest <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/login" className="flex items-center gap-2 bg-white border-2 border-primary/20 px-8 py-4 rounded-2xl text-lg font-bold hover:border-primary transition-colors">
              Parent Dashboard
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-center mb-10" style={{ fontFamily: 'var(--font-fun)' }}>Four Amazing Worlds to Explore</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className="bg-white rounded-3xl p-6 shadow-lg border-2 border-primary/5"
            >
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                <f.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-fun)' }}>{f.title}</h3>
              <p className="text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white/60 backdrop-blur rounded-2xl p-5 text-center border-2 border-primary/5">
              <s.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="font-bold text-lg">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 lg:px-8 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-10 text-white"
        >
          <Mascot mood="celebrating" size={80} />
          <h2 className="text-3xl font-bold mt-4 mb-3" style={{ fontFamily: 'var(--font-fun)' }}>Ready to Begin?</h2>
          <p className="text-lg mb-6 opacity-90">Create a parent account, set up your child's profile, and start the adventure today!</p>
          <Link href="/login" className="inline-flex items-center gap-2 bg-white text-primary px-8 py-4 rounded-2xl text-lg font-bold hover:scale-105 transition-transform">
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      <footer className="text-center py-8 text-sm text-muted-foreground">
        Adventure Learning Quest — Safe, ad-free learning for kids
      </footer>
    </div>
  );
}
