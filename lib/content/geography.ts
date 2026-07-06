export type Country = {
  id: string;
  name: string;
  continent: string;
  capital: string;
  flag: string;
  landmark: string;
  landmarkEmoji: string;
  animal: string;
  animalEmoji: string;
  funFacts: string[];
  color: string;
};

export const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];

export const COUNTRIES: Country[] = [
  {
    id: 'geo-india', name: 'India', continent: 'Asia', capital: 'New Delhi', flag: '🇮🇳',
    landmark: 'Taj Mahal', landmarkEmoji: '🕌', animal: 'Bengal Tiger', animalEmoji: '🐯',
    funFacts: ['India is the world\'s largest democracy!', 'Chess was invented in India.', 'The Taj Mahal was built as a gift of love.', 'India has 22 official languages!'],
    color: 'orange',
  },
  {
    id: 'geo-japan', name: 'Japan', continent: 'Asia', capital: 'Tokyo', flag: '🇯🇵',
    landmark: 'Mount Fuji', landmarkEmoji: '🗻', animal: 'Snow Monkey', animalEmoji: '🐒',
    funFacts: ['Japan has over 6,800 islands!', 'Vending machines sell almost anything in Japan.', 'Mount Fuji is a sacred volcano.', 'Japan is famous for cherry blossoms in spring.'],
    color: 'rose',
  },
  {
    id: 'geo-egypt', name: 'Egypt', continent: 'Africa', capital: 'Cairo', flag: '🇪🇬',
    landmark: 'Pyramids of Giza', landmarkEmoji: '🔺', animal: 'Camel', animalEmoji: '🐫',
    funFacts: ['The Great Pyramid is over 4,500 years old!', 'The Nile is the longest river in Africa.', 'Egyptians made the first calendar.', 'Mummies were preserved for thousands of years.'],
    color: 'amber',
  },
  {
    id: 'geo-france', name: 'France', continent: 'Europe', capital: 'Paris', flag: '🇫🇷',
    landmark: 'Eiffel Tower', landmarkEmoji: '🗼', animal: 'Gallic Rooster', animalEmoji: '🐓',
    funFacts: ['The Eiffel Tower grows taller in summer due to heat!', 'France is the most visited country in the world.', 'The Louvre is the world\'s largest art museum.', 'Croissants were actually invented in Austria!'],
    color: 'blue',
  },
  {
    id: 'geo-brazil', name: 'Brazil', continent: 'South America', capital: 'Brasília', flag: '🇧🇷',
    landmark: 'Christ the Redeemer', landmarkEmoji: '🗿', animal: 'Jaguar', animalEmoji: '🐆',
    funFacts: ['The Amazon Rainforest produces 20% of the world\'s oxygen!', 'Brazil is the largest country in South America.', 'The Amazon River is the second longest in the world.', 'Brazil has won the most FIFA World Cups!'],
    color: 'green',
  },
  {
    id: 'geo-australia', name: 'Australia', continent: 'Oceania', capital: 'Canberra', flag: '🇦🇺',
    landmark: 'Sydney Opera House', landmarkEmoji: '🎭', animal: 'Kangaroo', animalEmoji: '🦘',
    funFacts: ['Australia is both a country and a continent!', 'Kangaroos cannot walk backwards.', 'The Great Barrier Reef is the largest coral reef on Earth.', 'Australia has more kangaroos than people!'],
    color: 'yellow',
  },
  {
    id: 'geo-usa', name: 'United States', continent: 'North America', capital: 'Washington, D.C.', flag: '🇺🇸',
    landmark: 'Statue of Liberty', landmarkEmoji: '🗽', animal: 'Bald Eagle', animalEmoji: '🦅',
    funFacts: ['The Statue of Liberty was a gift from France!', 'The USA has 50 states.', 'The Grand Canyon is over 1.8 km deep.', 'Alaska is the largest state by area.'],
    color: 'sky',
  },
  {
    id: 'geo-kenya', name: 'Kenya', continent: 'Africa', capital: 'Nairobi', flag: '🇰🇪',
    landmark: 'Mount Kenya', landmarkEmoji: '⛰️', animal: 'Lion', animalEmoji: '🦁',
    funFacts: ['Kenya is famous for the Great Migration of wildebeest!', 'The Maasai people are known for their colorful clothing.', 'Kenya\'s marathon runners are world champions.', 'Nairobi has a national park right inside the city!'],
    color: 'teal',
  },
  {
    id: 'geo-italy', name: 'Italy', continent: 'Europe', capital: 'Rome', flag: '🇮🇹',
    landmark: 'Colosseum', landmarkEmoji: '🏟️', animal: 'Wolf', animalEmoji: '🐺',
    funFacts: ['The Colosseum could hold 50,000 spectators!', 'Italy is shaped like a boot.', 'Pizza was invented in Naples, Italy.', 'Vatican City inside Rome is the smallest country in the world.'],
    color: 'red',
  },
  {
    id: 'geo-china', name: 'China', continent: 'Asia', capital: 'Beijing', flag: '🇨🇳',
    landmark: 'Great Wall of China', landmarkEmoji: '🧱', animal: 'Giant Panda', animalEmoji: '🐼',
    funFacts: ['The Great Wall is over 21,000 km long!', 'Paper and gunpowder were invented in China.', 'The Giant Panda is China\'s national treasure.', 'Chinese New Year lasts 15 days!'],
    color: 'red',
  },
  {
    id: 'geo-mexico', name: 'Mexico', continent: 'North America', capital: 'Mexico City', flag: '🇲🇽',
    landmark: 'Chichén Itzá', landmarkEmoji: '🏛️', animal: 'Axolotl', animalEmoji: '🦎',
    funFacts: ['Chocolate was invented in Mexico by the Aztecs!', 'The axolotl is a salamander that can regrow its body parts.', 'Mexico has 35 UNESCO World Heritage sites.', 'Day of the Dead is a famous Mexican holiday.'],
    color: 'green',
  },
  {
    id: 'geo-uk', name: 'United Kingdom', continent: 'Europe', capital: 'London', flag: '🇬🇧',
    landmark: 'Big Ben', landmarkEmoji: '🕰️', animal: 'Red Fox', animalEmoji: '🦊',
    funFacts: ['Big Ben is actually the name of the bell, not the tower!', 'The UK has four countries: England, Scotland, Wales, Northern Ireland.', 'The London Eye is Europe\'s tallest Ferris wheel.', 'The Queen\'s Guard never smiles on duty!'],
    color: 'indigo',
  },
];

export const GEOGRAPHY_QUIZZES: Record<string, { question: string; options: string[]; answer: string }[]> = {
  capitals: [
    { question: 'What is the capital of Japan?', options: ['Tokyo', 'Kyoto', 'Osaka', 'Nagoya'], answer: 'Tokyo' },
    { question: 'What is the capital of France?', options: ['Paris', 'Lyon', 'Nice', 'Marseille'], answer: 'Paris' },
    { question: 'What is the capital of Australia?', options: ['Canberra', 'Sydney', 'Melbourne', 'Perth'], answer: 'Canberra' },
    { question: 'What is the capital of Brazil?', options: ['Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador'], answer: 'Brasília' },
    { question: 'What is the capital of Egypt?', options: ['Cairo', 'Alexandria', 'Giza', 'Luxor'], answer: 'Cairo' },
  ],
  landmarks: [
    { question: 'Where is the Eiffel Tower?', options: ['Paris', 'London', 'Rome', 'Berlin'], answer: 'Paris' },
    { question: 'Where is the Taj Mahal?', options: ['India', 'Pakistan', 'China', 'Thailand'], answer: 'India' },
    { question: 'Where is the Great Wall?', options: ['China', 'Japan', 'Korea', 'Mongolia'], answer: 'China' },
    { question: 'Where is the Colosseum?', options: ['Rome', 'Athens', 'Cairo', 'Madrid'], answer: 'Rome' },
  ],
  continents: [
    { question: 'Which continent is Egypt in?', options: ['Africa', 'Asia', 'Europe', 'Oceania'], answer: 'Africa' },
    { question: 'Which continent is Brazil in?', options: ['South America', 'North America', 'Africa', 'Asia'], answer: 'South America' },
    { question: 'Which continent is Japan in?', options: ['Asia', 'Europe', 'Oceania', 'Africa'], answer: 'Asia' },
    { question: 'Which continent is France in?', options: ['Europe', 'Asia', 'Africa', 'North America'], answer: 'Europe' },
  ],
};
