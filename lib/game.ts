export type Level = { level: number; threshold: number; title: string };

// XP thresholds — cumulative
export const LEVELS: Level[] = [
  { level: 1, threshold: 0, title: 'Rookie Explorer' },
  { level: 2, threshold: 100, title: 'Curious Scout' },
  { level: 3, threshold: 250, title: 'Brave Adventurer' },
  { level: 4, threshold: 500, title: 'Knowledge Seeker' },
  { level: 5, threshold: 850, title: 'Star Learner' },
  { level: 6, threshold: 1300, title: 'Super Scholar' },
  { level: 7, threshold: 1900, title: 'Master Explorer' },
  { level: 8, threshold: 2700, title: 'Grand Champion' },
  { level: 9, threshold: 3700, title: 'Legendary Hero' },
  { level: 10, threshold: 5000, title: 'Ultimate Quest Master' },
];

export function getLevel(xp: number): Level {
  let result = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.threshold) result = l;
  return result;
}

export function getNextLevel(xp: number): Level | null {
  for (const l of LEVELS) if (xp < l.threshold) return l;
  return null;
}

export function getLevelProgress(xp: number): { current: number; needed: number; pct: number } {
  const current = getLevel(xp);
  const next = getNextLevel(xp);
  if (!next) return { current: xp - current.threshold, needed: 0, pct: 100 };
  const into = xp - current.threshold;
  const span = next.threshold - current.threshold;
  return { current: into, needed: span, pct: Math.min(100, Math.round((into / span) * 100)) };
}

export const BADGES = [
  { key: 'math_wizard', name: 'Math Wizard', emoji: '🧙', desc: 'Score 80%+ on 5 math quizzes', icon: 'calculator' },
  { key: 'science_explorer', name: 'Science Explorer', emoji: '🔬', desc: 'Discover 10 science facts', icon: 'flask-conical' },
  { key: 'history_detective', name: 'History Detective', emoji: '🕵️', desc: 'Complete 3 history lessons', icon: 'landmark' },
  { key: 'geography_master', name: 'Geography Master', emoji: '🌍', desc: 'Explore 5 countries', icon: 'globe' },
  { key: 'quiz_champion', name: 'Quiz Champion', emoji: '🏆', desc: 'Earn 500 XP total', icon: 'trophy' },
  { key: 'streak_starter', name: 'Streak Starter', emoji: '🔥', desc: 'Reach a 3-day streak', icon: 'flame' },
  { key: 'first_steps', name: 'First Steps', emoji: '👣', desc: 'Complete your first quiz', icon: 'footprints' },
  { key: 'coin_collector', name: 'Coin Collector', emoji: '🪙', desc: 'Collect 100 coins', icon: 'coins' },
];

export function checkBadge(
  subject: string, score: number, total: number,
  currentBadges: string[], xp: number, streak: number
): string[] {
  const earned: string[] = [];
  const pct = total > 0 ? (score / total) * 100 : 0;
  if (!currentBadges.includes('first_steps')) earned.push('first_steps');
  if (subject === 'math' && pct >= 80) earned.push('math_wizard');
  if (subject === 'science') earned.push('science_explorer');
  if (subject === 'history') earned.push('history_detective');
  if (subject === 'geography') earned.push('geography_master');
  if (xp >= 500 && !currentBadges.includes('quiz_champion')) earned.push('quiz_champion');
  if (streak >= 3 && !currentBadges.includes('streak_starter')) earned.push('streak_starter');
  return earned.filter((b) => !currentBadges.includes(b));
}

export const PETS = [
  { stage: 0, name: 'Egg', emoji: '🥚', desc: 'Your pet is still growing!' },
  { stage: 1, name: 'Baby', emoji: '🐣', desc: 'A baby has hatched!' },
  { stage: 2, name: 'Young', emoji: '🐥', desc: 'Growing bigger and stronger!' },
  { stage: 3, name: 'Adult', emoji: '🦊', desc: 'A fully grown companion!' },
  { stage: 4, name: 'Master', emoji: '🦄', desc: 'A legendary magical pet!' },
];

export function getPetStage(level: number): number {
  if (level >= 9) return 4;
  if (level >= 6) return 3;
  if (level >= 4) return 2;
  if (level >= 2) return 1;
  return 0;
}
