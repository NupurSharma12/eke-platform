export type ScienceFact = {
  id: string;
  category: string;
  emoji: string;
  title: string;
  fact: string;
  didYouKnow: string;
  color: string;
};

export const SCIENCE_FACTS: ScienceFact[] = [
  { id: 'sci-1', category: 'Animals', emoji: '🐙', title: 'Octopuses Have Three Hearts!', fact: 'Octopuses have three hearts. Two pump blood to the gills, and one pumps blood to the rest of the body.', didYouKnow: 'When an octopus swims, its main heart stops beating — that is why they prefer crawling!', color: 'rose' },
  { id: 'sci-2', category: 'Space', emoji: '🪐', title: 'Saturn Could Float!', fact: 'Saturn is made mostly of gas. If there were a bathtub big enough, Saturn would float on water!', didYouKnow: 'Saturn has 146 moons — more than any other planet in our solar system.', color: 'amber' },
  { id: 'sci-3', category: 'Human Body', emoji: '🦴', title: 'Bones Are Super Strong!', fact: 'Your bones are stronger than steel of the same weight. A small bone can hold up to 5 times your body weight!', didYouKnow: 'You are born with 300 bones, but as you grow some fuse together, leaving 206.', color: 'sky' },
  { id: 'sci-4', category: 'Plants', emoji: '🌳', title: 'Trees Talk to Each Other!', fact: 'Trees can send food and messages to each other through underground fungus networks called the "Wood Wide Web".', didYouKnow: 'A single tree can produce enough oxygen for 4 people every day!', color: 'green' },
  { id: 'sci-5', category: 'Weather', emoji: '⚡', title: 'Lightning Is Super Hot!', fact: 'A bolt of lightning is about 5 times hotter than the surface of the Sun — around 30,000°C!', didYouKnow: 'Lightning never strikes the same place twice? Myth! The Empire State Building gets hit 25 times a year.', color: 'yellow' },
  { id: 'sci-6', category: 'Oceans', emoji: '🌊', title: 'The Ocean Is Mostly Unexplored!', fact: 'Humans have explored less than 5% of the ocean. The deep sea is full of mysterious creatures!', didYouKnow: 'The deepest part of the ocean, the Mariana Trench, is deeper than Mount Everest is tall!', color: 'blue' },
  { id: 'sci-7', category: 'Energy', emoji: '☀️', title: 'The Sun Gives Us Power!', fact: 'In just one hour, the Sun gives Earth enough energy to power the whole world for a year!', didYouKnow: 'Solar panels can turn sunlight directly into electricity using special materials.', color: 'orange' },
  { id: 'sci-8', category: 'Animals', emoji: '🦒', title: 'Giraffes Have Long Tongues!', fact: 'A giraffe\'s tongue can be up to 50 cm long — and it is dark blue to protect it from sunburn!', didYouKnow: 'Giraffes only need to drink water every few days — they get most from leaves!', color: 'amber' },
  { id: 'sci-9', category: 'Space', emoji: '🌌', title: 'A Day on Venus Is Longer Than a Year!', fact: 'Venus spins so slowly that one day there is longer than its whole year going around the Sun!', didYouKnow: 'Venus is the hottest planet — about 465°C — because of its thick clouds.', color: 'purple' },
  { id: 'sci-10', category: 'Human Body', emoji: '🧠', title: 'Your Brain Is a Supercomputer!', fact: 'Your brain has about 86 billion nerve cells and sends messages faster than a race car!', didYouKnow: 'Your brain uses about 20% of your body\'s energy, even when you are resting.', color: 'pink' },
  { id: 'sci-11', category: 'Plants', emoji: '🌻', title: 'Sunflowers Follow the Sun!', fact: 'Young sunflowers turn their heads to follow the Sun across the sky during the day.', didYouKnow: 'A single sunflower can have up to 2,000 seeds!', color: 'yellow' },
  { id: 'sci-12', category: 'Animals', emoji: '🐝', title: 'Bees Do a Waggle Dance!', fact: 'Honeybees tell other bees where to find flowers by doing a special "waggle dance".', didYouKnow: 'A bee visits up to 100 flowers in one trip and flies at 24 km per hour!', color: 'amber' },
];

export const SCIENCE_CATEGORIES = ['Animals', 'Space', 'Human Body', 'Plants', 'Weather', 'Oceans', 'Energy'];
