// Adaptive Grade 5 math question generator

export type MathQuestion = {
  question: string;
  options: string[];
  answer: string;
  difficulty: number;
  topic: string;
  hint: string;
};

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

function makeOptions(answer: number, spread: number): string[] {
  const opts = new Set<number>([answer]);
  while (opts.size < 4) {
    const delta = rand(1, Math.max(2, spread));
    const sign = Math.random() < 0.5 ? -1 : 1;
    const val = answer + sign * delta;
    if (val >= 0 && val !== answer) opts.add(val);
  }
  return Array.from(opts).sort(() => Math.random() - 0.5).map(String);
}

function genArithmetic(skill: number): MathQuestion {
  const topics = ['addition', 'subtraction', 'multiplication', 'division'];
  const topic = pick(topics);
  let a: number, b: number, answer: number, q: string, hint: string;
  const range = Math.round(10 + skill * 15);

  if (topic === 'addition') {
    a = rand(10, range * 2); b = rand(10, range * 2); answer = a + b;
    q = `${a} + ${b} = ?`; hint = `Try breaking it down: ${a} + ${b}. Add the tens first!`;
  } else if (topic === 'subtraction') {
    a = rand(20, range * 2); b = rand(5, a); answer = a - b;
    q = `${a} − ${b} = ?`; hint = `Count up from ${b} to ${a}.`;
  } else if (topic === 'multiplication') {
    a = rand(2, Math.min(12, 3 + Math.round(skill))); b = rand(2, Math.min(12, 3 + Math.round(skill)));
    answer = a * b; q = `${a} × ${b} = ?`; hint = `Think of ${a} groups of ${b}.`;
  } else {
    b = rand(2, Math.min(12, 3 + Math.round(skill))); answer = rand(2, Math.min(12, 3 + Math.round(skill)));
    a = b * answer; q = `${a} ÷ ${b} = ?`; hint = `How many ${b}s make ${a}?`;
  }
  return { question: q, options: makeOptions(answer, Math.max(5, answer)), answer: String(answer), difficulty: Math.round(skill), topic, hint };
}

function genFractions(skill: number): MathQuestion {
  const sub = pick(['compare', 'equivalent', 'add']);
  if (sub === 'compare') {
    const n1 = rand(1, 8), d1 = rand(2, 9);
    const n2 = rand(1, 8), d2 = rand(2, 9);
    const v1 = n1 / d1, v2 = n2 / d2;
    const answer = v1 > v2 ? `${n1}/${d1}` : v1 < v2 ? `${n2}/${d2}` : 'equal';
    const opts = [`${n1}/${d1}`, `${n2}/${d2}`, 'equal'];
    while (opts.length < 4) opts.push(`${rand(1,8)}/${rand(2,9)}`);
    return { question: `Which is bigger: ${n1}/${d1} or ${n2}/${d2}?`, options: opts.slice(0,4).sort(() => Math.random()-0.5), answer, difficulty: Math.round(skill), topic: 'fractions', hint: 'Find a common denominator to compare.' };
  }
  if (sub === 'equivalent') {
    const n = rand(1, 5), d = rand(2, 8), factor = rand(2, 4);
    const answer = `${n * factor}/${d * factor}`;
    const opts = [answer, `${n}/${d}`, `${n * 2}/${d * 3}`, `${n + 1}/${d + 1}`].sort(() => Math.random()-0.5);
    return { question: `Which fraction is equal to ${n}/${d}?`, options: opts, answer, difficulty: Math.round(skill), topic: 'fractions', hint: `Multiply top and bottom by the same number.` };
  }
  // add fractions with same denominator
  const d = rand(2, 9), n1 = rand(1, d - 1), n2 = rand(1, d - 1);
  const sumN = n1 + n2;
  let answer = `${sumN}/${d}`;
  if (sumN > d) { const w = Math.floor(sumN / d); const r = sumN % d; answer = r === 0 ? `${w}` : `${w} ${r}/${d}`; }
  const opts = [answer, `${n1 + n2}/${d + 1}`, `${n1}/${d}`, `${n2}/${d}`].sort(() => Math.random()-0.5);
  return { question: `${n1}/${d} + ${n2}/${d} = ?`, options: opts, answer, difficulty: Math.round(skill), topic: 'fractions', hint: 'Same denominator — just add the tops!' };
}

function genDecimals(skill: number): MathQuestion {
  const sub = pick(['add', 'subtract']);
  const a = rand(10, 99) / 10, b = rand(10, 99) / 10;
  let answer: number, q: string;
  if (sub === 'add') { answer = +(a + b).toFixed(1); q = `${a.toFixed(1)} + ${b.toFixed(1)} = ?`; }
  else { const big = Math.max(a, b), small = Math.min(a, b); answer = +(big - small).toFixed(1); q = `${big.toFixed(1)} − ${small.toFixed(1)} = ?`; }
  const opts = new Set<string>([answer.toFixed(1)]);
  while (opts.size < 4) { const d = (answer + rand(-3, 3)).toFixed(1); if (+d >= 0) opts.add(d); }
  return { question: q, options: Array.from(opts).sort(() => Math.random()-0.5), answer: answer.toFixed(1), difficulty: Math.round(skill), topic: 'decimals', hint: 'Line up the decimal points!' };
}

function genPercent(skill: number): MathQuestion {
  const pct = pick([10, 20, 25, 50, 75]);
  const base = pick([20, 40, 60, 80, 100, 200]);
  const answer = (base * pct) / 100;
  const opts = makeOptions(answer, Math.max(5, answer));
  return { question: `What is ${pct}% of ${base}?`, options: opts, answer: String(answer), difficulty: Math.round(skill), topic: 'percentages', hint: `${pct}% = ${pct}/100. Multiply by ${base}!` };
}

function genWordProblem(skill: number): MathQuestion {
  const scenarios = [
    () => {
      const apples = rand(12, 48), friends = rand(3, 6);
      const each = Math.floor(apples / friends);
      return { q: `Emma has ${apples} apples and shares them equally among ${friends} friends. How many does each friend get?`, a: each, hint: `Divide ${apples} by ${friends}.` };
    },
    () => {
      const price = rand(3, 15), qty = rand(2, 8);
      return { q: `A book costs $${price}. How much do ${qty} books cost?`, a: price * qty, hint: `Multiply ${price} by ${qty}.` };
    },
    () => {
      const total = rand(50, 200), spent = rand(10, 40);
      return { q: `Liam had $${total}. He spent $${spent}. How much is left?`, a: total - spent, hint: `Subtract ${spent} from ${total}.` };
    },
    () => {
      const speed = rand(40, 80), time = rand(2, 5);
      return { q: `A car travels at ${speed} km per hour. How far in ${time} hours?`, a: speed * time, hint: `Distance = speed × time.` };
    },
  ];
  const s = pick(scenarios)();
  return { question: s.q, options: makeOptions(s.a, Math.max(5, s.a)), answer: String(s.a), difficulty: Math.round(skill), topic: 'word_problems', hint: s.hint };
}

export function generateMathQuestion(skillLevel: number): MathQuestion {
  const skill = Math.max(1, Math.min(10, skillLevel));
  const r = Math.random();
  if (r < 0.35) return genArithmetic(skill);
  if (r < 0.55) return genFractions(skill);
  if (r < 0.70) return genDecimals(skill);
  if (r < 0.85) return genPercent(skill);
  return genWordProblem(skill);
}

export function generateQuizSet(skillLevel: number, count: number): MathQuestion[] {
  return Array.from({ length: count }, () => generateMathQuestion(skillLevel));
}
