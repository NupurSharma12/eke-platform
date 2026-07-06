export type HistoryLesson = {
  id: string;
  title: string;
  emoji: string;
  era: string;
  color: string;
  story: string;
  timeline: { year: string; event: string }[];
  facts: string[];
  quiz: { question: string; options: string[]; answer: string }[];
};

export const HISTORY_LESSONS: HistoryLesson[] = [
  {
    id: 'hist-egypt',
    title: 'Ancient Egypt',
    emoji: '🐫',
    era: '3100 BCE – 30 BCE',
    color: 'amber',
    story: 'Long ago, along the mighty Nile River, a great civilization rose. The Egyptians built giant pyramids, wrote with pictures called hieroglyphs, and worshipped many gods. Their pharaohs were powerful kings who ruled for thousands of years!',
    timeline: [
      { year: '3100 BCE', event: 'King Narmer unites Upper and Lower Egypt' },
      { year: '2560 BCE', event: 'The Great Pyramid of Giza is built' },
      { year: '1332 BCE', event: 'Boy king Tutankhamun becomes pharaoh' },
      { year: '196 BCE', event: 'The Rosetta Stone is carved' },
    ],
    facts: [
      'The Great Pyramid is the only Ancient Wonder of the World still standing!',
      'Egyptians invented a 365-day calendar based on the flooding of the Nile.',
      'They made paper from a reed called papyrus that grew along the river.',
      'Cats were sacred in Ancient Egypt — harming one could be punished!',
    ],
    quiz: [
      { question: 'What river was central to Ancient Egypt?', options: ['The Nile', 'The Amazon', 'The Thames', 'The Mississippi'], answer: 'The Nile' },
      { question: 'What did Egyptians write with?', options: ['Hieroglyphs', 'Alphabet', 'Numbers only', 'Sign language'], answer: 'Hieroglyphs' },
      { question: 'Who was the boy king?', options: ['Ramses', 'Tutankhamun', 'Cleopatra', 'Narmer'], answer: 'Tutankhamun' },
    ],
  },
  {
    id: 'hist-romans',
    title: 'The Roman Empire',
    emoji: '🏛️',
    era: '753 BCE – 476 CE',
    color: 'rose',
    story: 'From a small city in Italy, the Romans built a huge empire that stretched across Europe, Africa, and Asia. They built roads, aqueducts, and giant arenas. Their army was one of the strongest ever, and their ideas still shape our world today!',
    timeline: [
      { year: '753 BCE', event: 'Rome is founded by Romulus' },
      { year: '509 BCE', event: 'Rome becomes a republic' },
      { year: '27 BCE', event: 'Augustus becomes the first emperor' },
      { year: '80 CE', event: 'The Colosseum is completed' },
    ],
    facts: [
      'Roman roads were so well built that many are still used today!',
      'The Colosseum could hold 50,000 spectators for gladiator games.',
      'Romans used aqueducts to carry water for miles into their cities.',
      'Our calendar and months come from the Romans — July is named after Julius Caesar!',
    ],
    quiz: [
      { question: 'Who founded Rome?', options: ['Romulus', 'Caesar', 'Augustus', 'Cicero'], answer: 'Romulus' },
      { question: 'What did Romans build to carry water?', options: ['Aqueducts', 'Pipelines', 'Wells', 'Canals'], answer: 'Aqueducts' },
      { question: 'What was the Colosseum used for?', options: ['Gladiator games', 'Swimming', 'Farming', 'School'], answer: 'Gladiator games' },
    ],
  },
  {
    id: 'hist-india',
    title: 'Ancient India',
    emoji: '🪔',
    era: '1500 BCE – 500 CE',
    color: 'orange',
    story: 'Ancient India gave the world amazing gifts — the number zero, chess, and beautiful stories. Great empires like the Maurya and Gupta ruled vast lands. People shared wisdom in sacred texts and built stunning temples and monuments.',
    timeline: [
      { year: '1500 BCE', event: 'The Vedas are composed' },
      { year: '322 BCE', event: 'Chandragupta Maurya founds the Maurya Empire' },
      { year: '273 BCE', event: 'King Ashoka spreads Buddhism' },
      { year: '320 CE', event: 'The Gupta Empire begins — a golden age' },
    ],
    facts: [
      'The number zero was invented in Ancient India — without it, modern math would not exist!',
      'Chess was originally called "Chaturanga" and was invented in India.',
      'Ayurveda, one of the oldest medical systems, began in India over 3,000 years ago.',
      'The Taj Mahal was built much later, in 1632, by a Mughal emperor for his wife.',
    ],
    quiz: [
      { question: 'What number was invented in India?', options: ['Zero', 'One', 'Ten', 'Hundred'], answer: 'Zero' },
      { question: 'What game was invented in India?', options: ['Chess', 'Soccer', 'Tennis', 'Cricket'], answer: 'Chess' },
      { question: 'Who spread Buddhism across India?', options: ['Ashoka', 'Gandhi', 'Akbar', 'Buddha only'], answer: 'Ashoka' },
    ],
  },
  {
    id: 'hist-indus',
    title: 'Indus Valley Civilization',
    emoji: '🏺',
    era: '2600 BCE – 1900 BCE',
    color: 'teal',
    story: 'One of the world\'s oldest civilizations grew along the Indus River. The people of Harappa and Mohenjo-daro built neat cities with straight streets, brick houses, and even indoor plumbing! They were master traders and crafters.',
    timeline: [
      { year: '2600 BCE', event: 'Cities of Harappa and Mohenjo-daro flourish' },
      { year: '2500 BCE', event: 'The Great Bath is built in Mohenjo-daro' },
      { year: '1900 BCE', event: 'Cities are abandoned, possibly due to climate change' },
    ],
    facts: [
      'Indus Valley cities had the world\'s first indoor plumbing and drains!',
      'Their writing has never been fully decoded — it remains a mystery.',
      'They made beautiful clay seals with animal pictures, including unicorns!',
      'The Great Bath may have been the world\'s first public swimming pool.',
    ],
    quiz: [
      { question: 'What did Indus Valley cities have first?', options: ['Indoor plumbing', 'Cars', 'Electricity', 'Telephones'], answer: 'Indoor plumbing' },
      { question: 'What river did this civilization grow along?', options: ['The Indus', 'The Nile', 'The Ganges', 'The Amazon'], answer: 'The Indus' },
      { question: 'What is special about their writing?', options: ['It is undecoded', 'It uses letters', 'It is English', 'It is numbers'], answer: 'It is undecoded' },
    ],
  },
  {
    id: 'hist-explorers',
    title: 'Great Explorers',
    emoji: '⛵',
    era: '1400s – 1600s',
    color: 'blue',
    story: 'Brave explorers sailed across unknown oceans to discover new lands. They faced storms, hunger, and danger, but their journeys connected the whole world. Some found new trade routes, others met new peoples and cultures.',
    timeline: [
      { year: '1492', event: 'Christopher Columbus reaches the Americas' },
      { year: '1498', event: 'Vasco da Gama reaches India by sea' },
      { year: '1519', event: 'Ferdinand Magellan begins the first trip around the world' },
      { year: '1606', event: 'Willem Janszoon reaches Australia' },
    ],
    facts: [
      'Magellan\'s crew was the first to sail all the way around the world — it took 3 years!',
      'Vasco da Gama found a sea route from Europe to India around Africa.',
      'Explorers used the stars and a tool called an astrolabe to navigate.',
      'Many explorers brought new foods like tomatoes and potatoes back to Europe.',
    ],
    quiz: [
      { question: 'Who reached the Americas in 1492?', options: ['Columbus', 'Magellan', 'Da Gama', 'Cook'], answer: 'Columbus' },
      { question: 'What did Magellan\'s crew do first?', options: ['Sail around the world', 'Find gold', 'Build ships', 'Map the moon'], answer: 'Sail around the world' },
      { question: 'How did explorers navigate?', options: ['The stars', 'GPS', 'Maps on phones', 'Compass apps'], answer: 'The stars' },
    ],
  },
  {
    id: 'hist-inventions',
    title: 'Amazing Inventions',
    emoji: '💡',
    era: 'All of history',
    color: 'yellow',
    story: 'Inventors changed the world with their bright ideas! From the wheel to the lightbulb, each invention made life easier and more exciting. Many inventions started as simple ideas that grew into amazing things we use every day.',
    timeline: [
      { year: '3500 BCE', event: 'The wheel is invented in Mesopotamia' },
      { year: '1450', event: 'Gutenberg invents the printing press' },
      { year: '1879', event: 'Thomas Edison improves the lightbulb' },
      { year: '1903', event: 'The Wright Brothers fly the first airplane' },
    ],
    facts: [
      'The wheel is one of the oldest inventions — it changed how people travel and work!',
      'The printing press let books be made fast, so more people could learn to read.',
      'The Wright Brothers\' first flight lasted only 12 seconds!',
      'The telephone was invented by Alexander Graham Bell in 1876.',
    ],
    quiz: [
      { question: 'Who invented the airplane?', options: ['Wright Brothers', 'Edison', 'Bell', 'Ford'], answer: 'Wright Brothers' },
      { question: 'What did Edison improve?', options: ['The lightbulb', 'The wheel', 'The phone', 'The car'], answer: 'The lightbulb' },
      { question: 'What is one of the oldest inventions?', options: ['The wheel', 'The computer', 'The TV', 'The radio'], answer: 'The wheel' },
    ],
  },
  {
    id: 'hist-scientists',
    title: 'Famous Scientists',
    emoji: '🔬',
    era: 'All of history',
    color: 'green',
    story: 'Scientists ask questions about the world and find answers through experiments. From Newton watching apples fall to Marie Curie discovering new elements, these curious people changed how we understand everything around us!',
    timeline: [
      { year: '1687', event: 'Isaac Newton publishes his laws of motion' },
      { year: '1859', event: 'Charles Darwin publishes his theory of evolution' },
      { year: '1898', event: 'Marie Curie discovers radium and polonium' },
      { year: '1915', event: 'Albert Einstein publishes his theory of relativity' },
    ],
    facts: [
      'Isaac Newton thought of gravity after watching an apple fall from a tree!',
      'Marie Curie was the first person to win two Nobel Prizes in different sciences.',
      'Albert Einstein\'s brain was preserved after his death for scientific study.',
      'Charles Darwin traveled the world on a ship called the Beagle for 5 years.',
    ],
    quiz: [
      { question: 'Who thought of gravity from an apple?', options: ['Newton', 'Einstein', 'Darwin', 'Curie'], answer: 'Newton' },
      { question: 'Who won two Nobel Prizes?', options: ['Marie Curie', 'Einstein', 'Newton', 'Darwin'], answer: 'Marie Curie' },
      { question: 'What did Darwin study?', options: ['Evolution', 'Gravity', 'Light', 'Sound'], answer: 'Evolution' },
    ],
  },
];
