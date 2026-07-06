# Adventure Learning Quest

A full-stack interactive learning adventure app for 5th graders (ages 10-11). Built with Next.js, TypeScript, Tailwind CSS, Framer Motion, and Supabase.

## Features

- **Learning Dashboard** — XP points, levels, streaks, badges, daily goal progress with animated bars
- **Math Adventure Zone** — Unlimited Grade 5 math questions (arithmetic, fractions, decimals, percentages, word problems) with adaptive difficulty that adjusts based on performance
- **Science Discovery Lab** — Interactive science facts across 7 categories (Animals, Space, Human Body, Plants, Weather, Oceans, Energy) with "Did You Know?" sections
- **History Time Machine** — Story-based history lessons (Ancient Egypt, Romans, Ancient India, Indus Valley, Explorers, Inventions, Scientists) with timelines, key facts, and mini quizzes
- **Geography Explorer** — Interactive country exploration with capitals, landmarks, animals, and fun facts
- **Quiz Arena** — Multiple quiz types (math, science, history, geography, mixed mega quiz)
- **Gamification** — XP system with 10 levels, 8 badges, virtual pet that grows with progress, coin rewards, daily challenges, streaks
- **Parent Dashboard** — Learning time, quiz scores, strong/weak topics, progress charts (bar, pie, line)
- **Accessibility** — Dyslexia-friendly font, high-contrast mode, text-to-speech, keyboard navigation
- **Animations** — Confetti, floating decorations, mascot reactions, animated cards, progress transitions

## Tech Stack

- **Frontend:** Next.js 13, React, TypeScript, Tailwind CSS, Framer Motion, shadcn/ui, Recharts, Lucide icons
- **Backend:** Supabase (PostgreSQL database, authentication, RLS policies)
- **Deployment:** Vercel / Docker

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (for database and auth)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

### Database Setup

The database schema (child profiles, progress, quiz results, badges, daily challenges, activity log) is created via Supabase migrations with Row Level Security (RLS) policies that ensure parents can only access their own children's data.

## Project Structure

```
app/
  page.tsx              # Landing page
  login/                # Parent login/signup
  profiles/             # Child profile selection
  dashboard/            # Learning dashboard
  math/                 # Math Adventure Zone
  science/              # Science Discovery Lab
  history/              # History Time Machine
  geography/            # Geography Explorer
  quiz/                 # Quiz Arena
  rewards/              # Rewards Center + Virtual Pet
  parent/               # Parent Dashboard with charts
  settings/             # Accessibility settings
components/
  app-shell.tsx         # Navigation layout
  mascot.tsx            # Animated fox mascot
  confetti.tsx          # Celebration confetti
  quiz-engine.tsx       # Reusable quiz component
  floating-background.tsx
  ui/                   # shadcn/ui components
lib/
  app-context.tsx       # Global state (auth, profiles, progress)
  supabase.ts           # Supabase client
  game.ts               # Levels, badges, pet logic
  content/
    math.ts             # Adaptive math question generator
    science.ts          # Science facts data
    history.ts          # History lessons data
    geography.ts        # Countries and geography quizzes
```

## Deployment

### Vercel

1. Push to GitHub
2. Import the repo in Vercel
3. Add environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
4. Deploy

### Docker

```bash
docker build -t adventure-learning-quest .
docker run -p 3000:3000 adventure-learning-quest
```

## Accessibility

- **Dyslexia-friendly font** — Toggle in Settings to use a more readable font
- **High-contrast mode** — Stronger color contrast for better visibility
- **Text-to-speech** — Reads questions and facts aloud
- **Keyboard navigation** — Full keyboard support for all interactions

## License

Educational use. Built for safe, ad-free learning for children.
