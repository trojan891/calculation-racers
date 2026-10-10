import { QuestionCategory, QuestionDifficulty, QuestionItem } from '../game/types';
import { EXPANDED_SEED_QUESTIONS } from './questionBankExpansion';


/**
 * Deterministic answer hash so /questions documents never expose plaintext correctOption
 * before a player submits their answer.
 */
export function computeAnswerHash(questionId: string, optionIndex: number): string {
  const raw = `calc_racer_v1:${questionId}:opt_${optionIndex}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function verifyOptionWithHash(
  questionId: string,
  selectedOption: number,
  answerHash: string
): boolean {
  if (selectedOption < 0 || selectedOption > 3) return false;
  return computeAnswerHash(questionId, selectedOption) === answerHash;
}

export function findCorrectOptionFromHash(questionId: string, answerHash: string): number {
  for (let i = 0; i < 4; i++) {
    if (computeAnswerHash(questionId, i) === answerHash) {
      return i;
    }
  }
  return 0;
}

interface RawSeedQuestion {
  id: string;
  category: QuestionCategory;
  subcategory: string;
  difficulty: QuestionDifficulty;
  questionText: string;
  options: [string, string, string, string];
  correctOption: number;
  explanation: string;
  sourceUrl?: string;
  publishedAt?: string;
  verifiedAt?: string;
  expiresAt?: string;
}

const RAW_SEED_QUESTIONS: RawSeedQuestion[] = [
  // ===========================================================================
  // MATHEMATICS — EASY (Small whole numbers, no negatives/decimals/exponents)
  // ===========================================================================
  {
    id: 'seed_math_e1',
    category: 'math',
    subcategory: 'Addition',
    difficulty: 'easy',
    questionText: 'What is 7 + 5?',
    options: ['11', '12', '13', '14'],
    correctOption: 1,
    explanation: '7 plus 5 equals 12.',
  },
  {
    id: 'seed_math_e2',
    category: 'math',
    subcategory: 'Addition',
    difficulty: 'easy',
    questionText: 'What is 8 + 6?',
    options: ['12', '14', '15', '16'],
    correctOption: 1,
    explanation: '8 plus 6 equals 14.',
  },
  {
    id: 'seed_math_e3',
    category: 'math',
    subcategory: 'Addition',
    difficulty: 'easy',
    questionText: 'What is 12 + 9?',
    options: ['19', '20', '21', '22'],
    correctOption: 2,
    explanation: '12 plus 9 equals 21.',
  },
  {
    id: 'seed_math_e4',
    category: 'math',
    subcategory: 'Subtraction',
    difficulty: 'easy',
    questionText: 'What is 15 − 6?',
    options: ['7', '8', '9', '10'],
    correctOption: 2,
    explanation: '15 minus 6 equals 9.',
  },
  {
    id: 'seed_math_e5',
    category: 'math',
    subcategory: 'Subtraction',
    difficulty: 'easy',
    questionText: 'What is 18 − 7?',
    options: ['9', '10', '11', '12'],
    correctOption: 2,
    explanation: '18 minus 7 equals 11.',
  },
  {
    id: 'seed_math_e6',
    category: 'math',
    subcategory: 'Subtraction',
    difficulty: 'easy',
    questionText: 'What is 20 − 8?',
    options: ['10', '11', '12', '13'],
    correctOption: 2,
    explanation: '20 minus 8 equals 12.',
  },
  {
    id: 'seed_math_e7',
    category: 'math',
    subcategory: 'Multiplication',
    difficulty: 'easy',
    questionText: 'What is 4 × 3?',
    options: ['10', '12', '14', '16'],
    correctOption: 1,
    explanation: '4 multiplied by 3 equals 12.',
  },
  {
    id: 'seed_math_e8',
    category: 'math',
    subcategory: 'Multiplication',
    difficulty: 'easy',
    questionText: 'What is 6 × 5?',
    options: ['25', '30', '35', '40'],
    correctOption: 1,
    explanation: '6 multiplied by 5 equals 30.',
  },
  {
    id: 'seed_math_e9',
    category: 'math',
    subcategory: 'Multiplication',
    difficulty: 'easy',
    questionText: 'What is 7 × 4?',
    options: ['24', '26', '28', '32'],
    correctOption: 2,
    explanation: '7 multiplied by 4 equals 28.',
  },
  {
    id: 'seed_math_e10',
    category: 'math',
    subcategory: 'Division',
    difficulty: 'easy',
    questionText: 'What is 24 ÷ 6?',
    options: ['3', '4', '5', '6'],
    correctOption: 1,
    explanation: '6 × 4 = 24, so 24 ÷ 6 = 4.',
  },
  {
    id: 'seed_math_e11',
    category: 'math',
    subcategory: 'Division',
    difficulty: 'easy',
    questionText: 'What is 18 ÷ 3?',
    options: ['5', '6', '7', '8'],
    correctOption: 1,
    explanation: '3 × 6 = 18, so 18 ÷ 3 = 6.',
  },
  {
    id: 'seed_math_e12',
    category: 'math',
    subcategory: 'Division',
    difficulty: 'easy',
    questionText: 'What is 35 ÷ 5?',
    options: ['5', '6', '7', '8'],
    correctOption: 2,
    explanation: '5 × 7 = 35, so 35 ÷ 5 = 7.',
  },

  // ===========================================================================
  // MATHEMATICS — MEDIUM (Larger numbers, multiplication tables, order of ops)
  // ===========================================================================
  {
    id: 'seed_math_m1',
    category: 'math',
    subcategory: 'Addition',
    difficulty: 'medium',
    questionText: 'What is 68 + 57?',
    options: ['115', '123', '125', '135'],
    correctOption: 2,
    explanation: '60 + 50 = 110, and 8 + 7 = 15. 110 + 15 = 125.',
  },
  {
    id: 'seed_math_m2',
    category: 'math',
    subcategory: 'Subtraction',
    difficulty: 'medium',
    questionText: 'What is 142 − 68?',
    options: ['64', '74', '76', '84'],
    correctOption: 1,
    explanation: '142 minus 68 equals 74.',
  },
  {
    id: 'seed_math_m3',
    category: 'math',
    subcategory: 'Multiplication',
    difficulty: 'medium',
    questionText: 'What is 14 × 7?',
    options: ['88', '94', '98', '104'],
    correctOption: 2,
    explanation: '10 × 7 = 70 and 4 × 7 = 28; 70 + 28 = 98.',
  },
  {
    id: 'seed_math_m4',
    category: 'math',
    subcategory: 'Division',
    difficulty: 'medium',
    questionText: 'What is 156 ÷ 12?',
    options: ['11', '12', '13', '14'],
    correctOption: 2,
    explanation: '12 × 13 = 156, so 156 ÷ 12 = 13.',
  },
  {
    id: 'seed_math_m5',
    category: 'math',
    subcategory: 'Mixed Operations',
    difficulty: 'medium',
    questionText: 'Calculate: 18 + 6 × 4',
    options: ['42', '48', '72', '96'],
    correctOption: 0,
    explanation: 'Multiply first: 6 × 4 = 24. Then add 18 + 24 = 42.',
  },
  {
    id: 'seed_math_m6',
    category: 'math',
    subcategory: 'Mixed Operations',
    difficulty: 'medium',
    questionText: 'Simplify: (15 × 4) − (72 ÷ 6)',
    options: ['44', '48', '52', '54'],
    correctOption: 1,
    explanation: '15 × 4 = 60 and 72 ÷ 6 = 12. 60 − 12 = 48.',
  },

  // ===========================================================================
  // MATHEMATICS — HARD (Multi-step, brackets, percentages, fractions, powers, roots)
  // ===========================================================================
  {
    id: 'seed_math_h1',
    category: 'math',
    subcategory: 'Mixed Operations',
    difficulty: 'hard',
    questionText: 'What is 35% of 240?',
    options: ['74', '82', '84', '90'],
    correctOption: 2,
    explanation: '10% of 240 is 24. 30% is 72, and 5% is 12. 72 + 12 = 84.',
  },
  {
    id: 'seed_math_h2',
    category: 'math',
    subcategory: 'Addition',
    difficulty: 'hard',
    questionText: 'Evaluate the fraction sum: 3/4 + 5/8',
    options: ['11/8', '8/12', '9/8', '13/8'],
    correctOption: 0,
    explanation: '3/4 = 6/8. Adding 6/8 + 5/8 gives 11/8.',
  },
  {
    id: 'seed_math_h3',
    category: 'math',
    subcategory: 'Mixed Operations',
    difficulty: 'hard',
    questionText: 'What is the value of √289 + 14²?',
    options: ['203', '213', '215', '223'],
    correctOption: 1,
    explanation: '√289 = 17 and 14² = 196. 17 + 196 = 213.',
  },
  {
    id: 'seed_math_h4',
    category: 'math',
    subcategory: 'Mixed Operations',
    difficulty: 'hard',
    questionText: 'Evaluate: 2⁵ × 3² − 5³',
    options: ['153', '163', '173', '183'],
    correctOption: 1,
    explanation: '2⁵ = 32, 3² = 9, so 32 × 9 = 288. Subtract 5³ = 125: 288 − 125 = 163.',
  },
  {
    id: 'seed_math_h5',
    category: 'math',
    subcategory: 'Multiplication',
    difficulty: 'hard',
    questionText: 'What is 25 × 36?',
    options: ['800', '850', '900', '950'],
    correctOption: 2,
    explanation: '25 × 4 × 9 = 100 × 9 = 900.',
  },
  {
    id: 'seed_math_h6',
    category: 'math',
    subcategory: 'Division',
    difficulty: 'hard',
    questionText: 'Evaluate: (625 ÷ 25) + (324 ÷ 18)',
    options: ['41', '43', '45', '47'],
    correctOption: 1,
    explanation: '625 ÷ 25 = 25, and 324 ÷ 18 = 18. 25 + 18 = 43.',
  },

  // ===========================================================================
  // GENERAL KNOWLEDGE (GK) — EASY, MEDIUM, HARD
  // ===========================================================================
  {
    id: 'seed_gk_e1',
    category: 'gk',
    subcategory: 'Geography',
    difficulty: 'easy',
    questionText: 'Which ocean is the largest by surface area on Earth?',
    options: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'],
    correctOption: 2,
    explanation: 'The Pacific Ocean covers more than 30% of Earth’s surface.',
  },
  {
    id: 'seed_gk_e2',
    category: 'gk',
    subcategory: 'Geography',
    difficulty: 'easy',
    questionText: 'What is the capital city of Japan?',
    options: ['Kyoto', 'Osaka', 'Tokyo', 'Yokohama'],
    correctOption: 2,
    explanation: 'Tokyo has been the capital of Japan since 1868.',
  },
  {
    id: 'seed_gk_e3',
    category: 'gk',
    subcategory: 'Sports',
    difficulty: 'easy',
    questionText: 'How many players from one team are on the court at a time in standard basketball?',
    options: ['4', '5', '6', '7'],
    correctOption: 1,
    explanation: 'Each basketball team fields 5 active players on the court.',
  },
  {
    id: 'seed_gk_e4',
    category: 'gk',
    subcategory: 'Geography',
    difficulty: 'easy',
    questionText: 'Which continent contains the Sahara Desert?',
    options: ['Asia', 'South America', 'Africa', 'Australia'],
    correctOption: 2,
    explanation: 'The Sahara Desert spans much of North Africa.',
  },
  {
    id: 'seed_gk_e5',
    category: 'gk',
    subcategory: 'Computers',
    difficulty: 'easy',
    questionText: 'In computing, what does CPU stand for?',
    options: ['Central Processing Unit', 'Core Program Utility', 'Central Power Unit', 'Computer Personal Unit'],
    correctOption: 0,
    explanation: 'CPU stands for Central Processing Unit.',
  },
  {
    id: 'seed_gk_e6',
    category: 'gk',
    subcategory: 'History',
    difficulty: 'easy',
    questionText: 'Which ancient civilization built the Great Pyramids of Giza?',
    options: ['Romans', 'Ancient Egyptians', 'Greeks', 'Mayans'],
    correctOption: 1,
    explanation: 'The Great Pyramids of Giza were built during the Fourth Dynasty of Ancient Egypt.',
  },
  {
    id: 'seed_gk_e7',
    category: 'gk',
    subcategory: 'General Facts',
    difficulty: 'easy',
    questionText: 'How many days are there in a leap year?',
    options: ['364', '365', '366', '367'],
    correctOption: 2,
    explanation: 'A leap year adds February 29, resulting in 366 days.',
  },
  {
    id: 'seed_gk_e8',
    category: 'gk',
    subcategory: 'Sports',
    difficulty: 'easy',
    questionText: 'In which sport is the term "Love" used to mean a score of zero?',
    options: ['Cricket', 'Tennis', 'Golf', 'Baseball'],
    correctOption: 1,
    explanation: 'In tennis, a score of zero is called "love".',
  },
  {
    id: 'seed_gk_e9',
    category: 'gk',
    subcategory: 'Computers',
    difficulty: 'easy',
    questionText: 'Which key combination is commonly used to copy selected text on most computers?',
    options: ['Ctrl + V', 'Ctrl + C', 'Ctrl + X', 'Ctrl + Z'],
    correctOption: 1,
    explanation: 'Ctrl + C (or Cmd + C) copies the current selection to the clipboard.',
  },
  {
    id: 'seed_gk_e10',
    category: 'gk',
    subcategory: 'General Facts',
    difficulty: 'easy',
    questionText: 'How many colors are traditionally listed in a rainbow (ROYGBIV)?',
    options: ['5', '6', '7', '8'],
    correctOption: 2,
    explanation: 'Red, Orange, Yellow, Green, Blue, Indigo, and Violet make 7 colors.',
  },
  {
    id: 'seed_gk_m1',
    category: 'gk',
    subcategory: 'Geography',
    difficulty: 'medium',
    questionText: 'Which country is home to the ancient rock-carved city of Petra?',
    options: ['Egypt', 'Jordan', 'Morocco', 'Syria'],
    correctOption: 1,
    explanation: 'Petra is a historic and archaeological city in southern Jordan.',
  },
  {
    id: 'seed_gk_m2',
    category: 'gk',
    subcategory: 'History',
    difficulty: 'medium',
    questionText: 'Who wrote the tragic play "Hamlet"?',
    options: ['Christopher Marlowe', 'William Shakespeare', 'John Milton', 'Charles Dickens'],
    correctOption: 1,
    explanation: 'William Shakespeare wrote Hamlet around 1600.',
  },
  {
    id: 'seed_gk_m3',
    category: 'gk',
    subcategory: 'Geography',
    difficulty: 'medium',
    questionText: 'Which mountain range forms part of the conventional boundary between Europe and Asia?',
    options: ['The Alps', 'The Andes', 'The Ural Mountains', 'The Carpathians'],
    correctOption: 2,
    explanation: 'The Ural Mountains run from north to south through western Russia.',
  },
  {
    id: 'seed_gk_m4',
    category: 'gk',
    subcategory: 'Sports',
    difficulty: 'medium',
    questionText: 'In Formula 1 racing, what does a waved black-and-white checkered flag signify?',
    options: ['Track hazard ahead', 'Pit lane closed', 'The race session has ended', 'Slow car on track'],
    correctOption: 2,
    explanation: 'The checkered flag signals the official completion of the race.',
  },
  {
    id: 'seed_gk_m5',
    category: 'gk',
    subcategory: 'General Facts',
    difficulty: 'medium',
    questionText: 'What is the official currency of Switzerland?',
    options: ['Euro', 'Swiss Franc', 'Swiss Krone', 'Pound Sterling'],
    correctOption: 1,
    explanation: 'Switzerland uses the Swiss Franc (CHF).',
  },
  {
    id: 'seed_gk_m6',
    category: 'gk',
    subcategory: 'Computers',
    difficulty: 'medium',
    questionText: 'How many bits make up one standard byte in digital computing?',
    options: ['4 bits', '8 bits', '16 bits', '32 bits'],
    correctOption: 1,
    explanation: 'One standard byte consists of 8 bits.',
  },
  {
    id: 'seed_gk_m7',
    category: 'gk',
    subcategory: 'History',
    difficulty: 'medium',
    questionText: 'In which year did the Apollo 11 mission achieve the first crewed lunar landing?',
    options: ['1965', '1969', '1971', '1973'],
    correctOption: 1,
    explanation: 'Apollo 11 landed on the Moon on July 20, 1969.',
  },
  {
    id: 'seed_gk_m8',
    category: 'gk',
    subcategory: 'Sports',
    difficulty: 'medium',
    questionText: 'What is the standard marathon running distance in kilometers (rounded to one decimal)?',
    options: ['38.5 km', '40.0 km', '42.2 km', '45.0 km'],
    correctOption: 2,
    explanation: 'A marathon is 42.195 kilometers (approx. 42.2 km or 26.2 miles).',
  },
  {
    id: 'seed_gk_m9',
    category: 'gk',
    subcategory: 'Computers',
    difficulty: 'medium',
    questionText: 'What does HTTP stand for in web addresses?',
    options: [
      'HyperText Transfer Protocol',
      'High Transmission Text Program',
      'Hyperlink Terminal Transfer Path',
      'Host Text Transmission Protocol',
    ],
    correctOption: 0,
    explanation: 'HTTP stands for HyperText Transfer Protocol.',
  },
  {
    id: 'seed_gk_m10',
    category: 'gk',
    subcategory: 'Geography',
    difficulty: 'medium',
    questionText: 'Which river flows through the city of Cairo in Egypt?',
    options: ['Tigris', 'Euphrates', 'Nile', 'Zambezi'],
    correctOption: 2,
    explanation: 'Cairo is located near the Nile Delta along the Nile River.',
  },
  {
    id: 'seed_gk_h1',
    category: 'gk',
    subcategory: 'Computers',
    difficulty: 'hard',
    questionText: 'In which year was the World Wide Web first made publicly available on the Internet by Tim Berners-Lee?',
    options: ['1985', '1989', '1991', '1995'],
    correctOption: 2,
    explanation: 'Tim Berners-Lee published the first public web page in August 1991.',
  },
  {
    id: 'seed_gk_h2',
    category: 'gk',
    subcategory: 'History',
    difficulty: 'hard',
    questionText: 'Which treaty signed in 1648 ended the Thirty Years’ War in Europe?',
    options: ['Treaty of Utrecht', 'Peace of Westphalia', 'Treaty of Ghent', 'Congress of Vienna'],
    correctOption: 1,
    explanation: 'The Peace of Westphalia (1648) ended the Thirty Years’ War.',
  },
  {
    id: 'seed_gk_h3',
    category: 'gk',
    subcategory: 'Geography',
    difficulty: 'hard',
    questionText: 'Which strait separates the North and South Islands of New Zealand?',
    options: ['Bass Strait', 'Cook Strait', 'Torres Strait', 'Magellan Strait'],
    correctOption: 1,
    explanation: 'Cook Strait connects the Tasman Sea with the South Pacific Ocean.',
  },
  {
    id: 'seed_gk_h4',
    category: 'gk',
    subcategory: 'General Facts',
    difficulty: 'hard',
    questionText: 'Which architect designed the titanium-clad Guggenheim Museum in Bilbao, Spain?',
    options: ['Zaha Hadid', 'Frank Gehry', 'Renzo Piano', 'Norman Foster'],
    correctOption: 1,
    explanation: 'Frank Gehry designed the Guggenheim Museum Bilbao, opened in 1997.',
  },
  {
    id: 'seed_gk_h5',
    category: 'gk',
    subcategory: 'Geography',
    difficulty: 'hard',
    questionText: 'What is the smallest independent country in the world by land area?',
    options: ['Monaco', 'Nauru', 'San Marino', 'Vatican City'],
    correctOption: 3,
    explanation: 'Vatican City covers approximately 0.49 square kilometers.',
  },
  {
    id: 'seed_gk_h6',
    category: 'gk',
    subcategory: 'Computers',
    difficulty: 'hard',
    questionText: 'Who is credited with writing the first algorithm intended to be carried out by Charles Babbage’s Analytical Engine?',
    options: ['Grace Hopper', 'Ada Lovelace', 'Alan Turing', 'Margaret Hamilton'],
    correctOption: 1,
    explanation: 'Ada Lovelace published the first algorithm for the Analytical Engine in 1843.',
  },
  {
    id: 'seed_gk_h7',
    category: 'gk',
    subcategory: 'Sports',
    difficulty: 'hard',
    questionText: 'In which city were the first modern Olympic Games held in 1896?',
    options: ['Paris', 'London', 'Athens', 'Rome'],
    correctOption: 2,
    explanation: 'Athens, Greece hosted the inaugural modern Summer Olympics in April 1896.',
  },
  {
    id: 'seed_gk_h8',
    category: 'gk',
    subcategory: 'History',
    difficulty: 'hard',
    questionText: 'Which script was deciphered in 1822 by Jean-François Champollion using the Rosetta Stone?',
    options: ['Cuneiform', 'Linear B', 'Egyptian Hieroglyphs', 'Indus Script'],
    correctOption: 2,
    explanation: 'Champollion used the trilingual Rosetta Stone to decipher Egyptian hieroglyphs.',
  },
  {
    id: 'seed_gk_h9',
    category: 'gk',
    subcategory: 'General Facts',
    difficulty: 'hard',
    questionText: 'Which international organization is headquartered at the Palais des Nations in Geneva, Switzerland?',
    options: [
      'United Nations Office at Geneva',
      'International Court of Justice',
      'UNESCO',
      'NATO',
    ],
    correctOption: 0,
    explanation: 'The Palais des Nations serves as the headquarters of the United Nations Office at Geneva.',
  },
  {
    id: 'seed_gk_h10',
    category: 'gk',
    subcategory: 'Sports',
    difficulty: 'hard',
    questionText: 'What is the maximum possible break in a standard frame of snooker without a free ball?',
    options: ['140', '147', '150', '155'],
    correctOption: 1,
    explanation: '15 reds with 15 blacks (120) plus all 6 colors (27) equals 147.',
  },

  // ===========================================================================
  // SCIENCE — EASY, MEDIUM, HARD
  // ===========================================================================
  {
    id: 'seed_sci_e1',
    category: 'science',
    subcategory: 'Chemistry',
    difficulty: 'easy',
    questionText: 'What is the chemical symbol for Gold?',
    options: ['Ag', 'Gd', 'Au', 'Go'],
    correctOption: 2,
    explanation: 'Au comes from the Latin word for gold, "aurum".',
  },
  {
    id: 'seed_sci_e2',
    category: 'science',
    subcategory: 'Space',
    difficulty: 'easy',
    questionText: 'Which planet is known as the Red Planet due to iron oxide on its surface?',
    options: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
    correctOption: 1,
    explanation: 'Mars appears reddish because of iron oxide dust on its surface.',
  },
  {
    id: 'seed_sci_e3',
    category: 'science',
    subcategory: 'Biology',
    difficulty: 'easy',
    questionText: 'What gas do plants primarily absorb from the atmosphere for photosynthesis?',
    options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
    correctOption: 2,
    explanation: 'Plants take in carbon dioxide (CO₂) and water to produce glucose and oxygen.',
  },
  {
    id: 'seed_sci_e4',
    category: 'science',
    subcategory: 'Physics',
    difficulty: 'easy',
    questionText: 'At standard atmospheric pressure, at what Celsius temperature does pure water boil?',
    options: ['90 °C', '95 °C', '100 °C', '110 °C'],
    correctOption: 2,
    explanation: 'Pure water boils at 100 °C at 1 atmosphere of pressure.',
  },
  {
    id: 'seed_sci_e5',
    category: 'science',
    subcategory: 'Biology',
    difficulty: 'easy',
    questionText: 'Which organelle is commonly referred to as the powerhouse of the cell?',
    options: ['Ribosome', 'Mitochondrion', 'Golgi apparatus', 'Lysosome'],
    correctOption: 1,
    explanation: 'Mitochondria generate most of the cell’s ATP.',
  },
  {
    id: 'seed_sci_e6',
    category: 'science',
    subcategory: 'Space',
    difficulty: 'easy',
    questionText: 'What is the closest star to Earth?',
    options: ['Proxima Centauri', 'The Sun', 'Sirius', 'Alpha Centauri'],
    correctOption: 1,
    explanation: 'The Sun is the star at the center of our Solar System.',
  },
  {
    id: 'seed_sci_e7',
    category: 'science',
    subcategory: 'Chemistry',
    difficulty: 'easy',
    questionText: 'What is the chemical formula for water?',
    options: ['CO₂', 'H₂O', 'O₂', 'NaCl'],
    correctOption: 1,
    explanation: 'Water consists of two hydrogen atoms bonded to one oxygen atom (H₂O).',
  },
  {
    id: 'seed_sci_e8',
    category: 'science',
    subcategory: 'Physics',
    difficulty: 'easy',
    questionText: 'Which force pulls objects toward the center of the Earth?',
    options: ['Magnetism', 'Friction', 'Gravity', 'Tension'],
    correctOption: 2,
    explanation: 'Gravity attracts objects with mass toward each other.',
  },
  {
    id: 'seed_sci_e9',
    category: 'science',
    subcategory: 'Biology',
    difficulty: 'easy',
    questionText: 'Which organ in the human body pumps blood throughout the circulatory system?',
    options: ['Lungs', 'Liver', 'Heart', 'Kidneys'],
    correctOption: 2,
    explanation: 'The heart pumps oxygenated and deoxygenated blood through blood vessels.',
  },
  {
    id: 'seed_sci_e10',
    category: 'science',
    subcategory: 'Space',
    difficulty: 'easy',
    questionText: 'Which planet in our Solar System is famous for its prominent ring system?',
    options: ['Mars', 'Saturn', 'Venus', 'Mercury'],
    correctOption: 1,
    explanation: 'Saturn has the most extensive and bright ring system in the Solar System.',
  },
  {
    id: 'seed_sci_m1',
    category: 'science',
    subcategory: 'Physics',
    difficulty: 'medium',
    questionText: 'What is the SI unit of electrical resistance?',
    options: ['Volt', 'Ampere', 'Ohm', 'Farad'],
    correctOption: 2,
    explanation: 'Electrical resistance is measured in Ohms (Ω).',
  },
  {
    id: 'seed_sci_m2',
    category: 'science',
    subcategory: 'Physics',
    difficulty: 'medium',
    questionText: 'According to Newton’s Second Law, what net force is required to accelerate a 1,200 kg race car at 4 m/s²?',
    options: ['300 N', '2,400 N', '4,800 N', '6,000 N'],
    correctOption: 2,
    explanation: 'Force = mass × acceleration = 1,200 kg × 4 m/s² = 4,800 N.',
  },
  {
    id: 'seed_sci_m3',
    category: 'science',
    subcategory: 'Chemistry',
    difficulty: 'medium',
    questionText: 'Which element has the atomic number 6 and forms the basis of organic chemistry?',
    options: ['Nitrogen', 'Carbon', 'Oxygen', 'Silicon'],
    correctOption: 1,
    explanation: 'Carbon has 6 protons and forms four covalent bonds.',
  },
  {
    id: 'seed_sci_m4',
    category: 'science',
    subcategory: 'Space',
    difficulty: 'medium',
    questionText: 'Approximately how long does light take to travel from the Sun to Earth?',
    options: ['8 seconds', '8 minutes 20 seconds', '45 minutes', '2 hours'],
    correctOption: 1,
    explanation: 'Sunlight takes approximately 499 seconds (8 minutes 19 seconds) to reach Earth.',
  },
  {
    id: 'seed_sci_m5',
    category: 'science',
    subcategory: 'Chemistry',
    difficulty: 'medium',
    questionText: 'What is the pH value of a neutral solution at 25 °C?',
    options: ['0', '5.5', '7', '14'],
    correctOption: 2,
    explanation: 'A pH of 7.0 at 25 °C indicates neutrality.',
  },
  {
    id: 'seed_sci_m6',
    category: 'science',
    subcategory: 'Biology',
    difficulty: 'medium',
    questionText: 'Which pigment gives plant leaves their green color and absorbs light for photosynthesis?',
    options: ['Carotene', 'Hemoglobin', 'Chlorophyll', 'Melanin'],
    correctOption: 2,
    explanation: 'Chlorophyll absorbs blue and red wavelengths and reflects green light.',
  },
  {
    id: 'seed_sci_m7',
    category: 'science',
    subcategory: 'Space',
    difficulty: 'medium',
    questionText: 'Which galaxy is the closest major spiral galaxy to the Milky Way?',
    options: ['Triangulum Galaxy', 'Andromeda Galaxy', 'Whirlpool Galaxy', 'Sombrero Galaxy'],
    correctOption: 1,
    explanation: 'The Andromeda Galaxy (M31) is approximately 2.5 million light-years away.',
  },
  {
    id: 'seed_sci_m8',
    category: 'science',
    subcategory: 'Biology',
    difficulty: 'medium',
    questionText: 'How many chromosomes are found in a typical human somatic (body) cell?',
    options: ['23', '44', '46', '48'],
    correctOption: 2,
    explanation: 'Human diploid somatic cells have 23 pairs of chromosomes, totaling 46.',
  },
  {
    id: 'seed_sci_m9',
    category: 'science',
    subcategory: 'Chemistry',
    difficulty: 'medium',
    questionText: 'Which noble gas is the second most abundant element in the observable universe?',
    options: ['Neon', 'Argon', 'Helium', 'Krypton'],
    correctOption: 2,
    explanation: 'Helium is the second most abundant element in the universe after hydrogen.',
  },
  {
    id: 'seed_sci_m10',
    category: 'science',
    subcategory: 'Physics',
    difficulty: 'medium',
    questionText: 'What is the approximate speed of sound in dry air at 20 °C?',
    options: ['120 m/s', '343 m/s', '750 m/s', '1,500 m/s'],
    correctOption: 1,
    explanation: 'Sound travels at about 343 meters per second in dry air at 20 °C.',
  },
  {
    id: 'seed_sci_h1',
    category: 'science',
    subcategory: 'Physics',
    difficulty: 'hard',
    questionText: 'What is the kinetic energy of a 2 kg object moving at a velocity of 10 m/s?',
    options: ['20 J', '50 J', '100 J', '200 J'],
    correctOption: 2,
    explanation: 'KE = ½mv² = 0.5 × 2 kg × (10 m/s)² = 100 Joules.',
  },
  {
    id: 'seed_sci_h2',
    category: 'science',
    subcategory: 'Physics',
    difficulty: 'hard',
    questionText: 'Which subatomic particle was discovered by J.J. Thomson in 1897 using cathode ray tubes?',
    options: ['Proton', 'Neutron', 'Electron', 'Positron'],
    correctOption: 2,
    explanation: 'J.J. Thomson showed that cathode rays are composed of negatively charged electrons.',
  },
  {
    id: 'seed_sci_h3',
    category: 'science',
    subcategory: 'Chemistry',
    difficulty: 'hard',
    questionText: 'In thermodynamics, which quantity measures the disorder or number of microstates of a system?',
    options: ['Enthalpy', 'Entropy', 'Gibbs Free Energy', 'Internal Energy'],
    correctOption: 1,
    explanation: 'Entropy (S) quantifies microscopic configurations in a thermodynamic system.',
  },
  {
    id: 'seed_sci_h4',
    category: 'science',
    subcategory: 'Biology',
    difficulty: 'hard',
    questionText: 'Which enzyme is responsible for unwinding the DNA double helix during replication?',
    options: ['DNA Polymerase', 'DNA Helicase', 'RNA Primase', 'DNA Ligase'],
    correctOption: 1,
    explanation: 'DNA Helicase separates the two strands of the DNA double helix.',
  },
  {
    id: 'seed_sci_h5',
    category: 'science',
    subcategory: 'Space',
    difficulty: 'hard',
    questionText: 'What is the escape velocity from Earth’s surface (ignoring atmospheric drag)?',
    options: ['7.9 km/s', '9.8 km/s', '11.2 km/s', '16.7 km/s'],
    correctOption: 2,
    explanation: 'Escape velocity v = √(2GM/R) ≈ 11.2 km/s at Earth’s surface.',
  },
  {
    id: 'seed_sci_h6',
    category: 'science',
    subcategory: 'Chemistry',
    difficulty: 'hard',
    questionText: 'What is the approximate value of Avogadro’s constant (particles per mole)?',
    options: ['6.022 × 10²³', '3.00 × 10⁸', '6.626 × 10⁻³⁴', '1.38 × 10⁻²³'],
    correctOption: 0,
    explanation: 'One mole contains exactly 6.02214076 × 10²³ elementary entities.',
  },
  {
    id: 'seed_sci_h7',
    category: 'science',
    subcategory: 'Space',
    difficulty: 'hard',
    questionText: 'What is the boundary around a black hole beyond which no light or matter can escape?',
    options: ['Roche Limit', 'Event Horizon', 'Oort Cloud', 'Heliopause'],
    correctOption: 1,
    explanation: 'The Event Horizon marks the gravitational point of no return around a black hole.',
  },
  {
    id: 'seed_sci_h8',
    category: 'science',
    subcategory: 'Biology',
    difficulty: 'hard',
    questionText: 'In cellular respiration, where does the Citric Acid Cycle (Krebs Cycle) take place in eukaryotic cells?',
    options: ['Cytosol', 'Mitochondrial Matrix', 'Nucleolus', 'Endoplasmic Reticulum'],
    correctOption: 1,
    explanation: 'The Citric Acid Cycle occurs inside the mitochondrial matrix in eukaryotes.',
  },
  {
    id: 'seed_sci_h9',
    category: 'science',
    subcategory: 'Physics',
    difficulty: 'hard',
    questionText: 'Which physical law states that the induced electromotive force in any closed circuit is equal to the negative rate of change of magnetic flux?',
    options: ['Coulomb’s Law', 'Faraday’s Law of Induction', 'Ohm’s Law', 'Hooke’s Law'],
    correctOption: 1,
    explanation: 'Faraday’s Law of Electromagnetic Induction relates induced EMF to changing magnetic flux.',
  },
  {
    id: 'seed_sci_h10',
    category: 'science',
    subcategory: 'Chemistry',
    difficulty: 'hard',
    questionText: 'Which type of chemical bond involves the equal or unequal sharing of electron pairs between atoms?',
    options: ['Ionic Bond', 'Covalent Bond', 'Metallic Bond', 'Hydrogen Bond'],
    correctOption: 1,
    explanation: 'Covalent bonds form when atoms share pairs of valence electrons.',
  },

  // ===========================================================================
  // CURRENT AFFAIRS (VERIFIED WITH SOURCES, VERIFICATION DATES & EXPIRY)
  // ===========================================================================
  {
    id: 'seed_ca_e1',
    category: 'current_affairs',
    subcategory: 'Sports',
    difficulty: 'easy',
    questionText: 'Which city hosted the 2024 Summer Olympic Games?',
    options: ['Los Angeles', 'Paris', 'Tokyo', 'Brisbane'],
    correctOption: 1,
    explanation: 'Paris, France hosted the Games of the XXXIII Olympiad from July 26 to August 11, 2024.',
    sourceUrl: 'https://olympics.com/en/paris-2024',
    publishedAt: '2024-08-11',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_e2',
    category: 'current_affairs',
    subcategory: 'Science and Technology',
    difficulty: 'easy',
    questionText: 'Which space telescope launched in December 2021 operates at the Sun-Earth L2 point to observe the infrared universe?',
    options: ['Hubble Space Telescope', 'James Webb Space Telescope', 'Chandra X-ray Observatory', 'Kepler Space Telescope'],
    correctOption: 1,
    explanation: 'The James Webb Space Telescope (JWST) conducts infrared astronomy from the L2 Lagrange point.',
    sourceUrl: 'https://science.nasa.gov/mission/webb/',
    publishedAt: '2022-07-12',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_e3',
    category: 'current_affairs',
    subcategory: 'World',
    difficulty: 'easy',
    questionText: 'Which country became the 32nd member of NATO in March 2024?',
    options: ['Finland', 'Sweden', 'Austria', 'Switzerland'],
    correctOption: 1,
    explanation: 'Sweden officially joined NATO as its 32nd member on March 7, 2024.',
    sourceUrl: 'https://www.nato.int/cps/en/natohq/news_223446.htm',
    publishedAt: '2024-03-07',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_e4',
    category: 'current_affairs',
    subcategory: 'India',
    difficulty: 'easy',
    questionText: 'Which Indian city hosted the 2023 G20 Leaders’ Summit at Bharat Mandapam?',
    options: ['Mumbai', 'New Delhi', 'Bengaluru', 'Hyderabad'],
    correctOption: 1,
    explanation: 'New Delhi hosted the 18th G20 Summit in September 2023.',
    sourceUrl: 'https://www.mea.gov.in/',
    publishedAt: '2023-09-10',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_e5',
    category: 'current_affairs',
    subcategory: 'Sports',
    difficulty: 'easy',
    questionText: 'Which national team won the 2024 ICC Men’s T20 World Cup final in Barbados?',
    options: ['South Africa', 'Australia', 'India', 'England'],
    correctOption: 2,
    explanation: 'India defeated South Africa by 7 runs in the final on June 29, 2024.',
    sourceUrl: 'https://www.icc-cricket.com/',
    publishedAt: '2024-06-29',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_m1',
    category: 'current_affairs',
    subcategory: 'India',
    difficulty: 'medium',
    questionText: 'Which country’s Chandrayaan-3 mission achieved the first successful soft landing near the lunar south pole in August 2023?',
    options: ['Japan', 'India', 'China', 'United States'],
    correctOption: 1,
    explanation: 'ISRO’s Chandrayaan-3 Vikram lander touched down near the lunar south pole on August 23, 2023.',
    sourceUrl: 'https://www.isro.gov.in/Chandrayaan3.html',
    publishedAt: '2023-08-23',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_m2',
    category: 'current_affairs',
    subcategory: 'Science and Technology',
    difficulty: 'medium',
    questionText: 'The 2024 Nobel Prize in Chemistry recognized breakthroughs in protein design and structure prediction by David Baker, Demis Hassabis, and whom?',
    options: ['John Jumper', 'Geoffrey Hinton', 'Carolyn Bertozzi', 'Katalin Karikó'],
    correctOption: 0,
    explanation: 'David Baker shared the 2024 Nobel Prize in Chemistry with Demis Hassabis and John Jumper.',
    sourceUrl: 'https://www.nobelprize.org/prizes/chemistry/2024/summary/',
    publishedAt: '2024-10-09',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_m3',
    category: 'current_affairs',
    subcategory: 'Science and Technology',
    difficulty: 'medium',
    questionText: 'Which NASA asteroid sample-return mission delivered material from asteroid Bennu to Earth in September 2023?',
    options: ['Hayabusa2', 'OSIRIS-REx', 'DART', 'Lucy'],
    correctOption: 1,
    explanation: 'NASA’s OSIRIS-REx capsule landed in Utah on September 24, 2023 carrying material from Bennu.',
    sourceUrl: 'https://science.nasa.gov/mission/osiris-rex/',
    publishedAt: '2023-09-24',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_m4',
    category: 'current_affairs',
    subcategory: 'India',
    difficulty: 'medium',
    questionText: 'What is the name of ISRO’s solar observation mission launched in September 2023 to study the Sun from Lagrange point L1?',
    options: ['Surya-1', 'Aditya-L1', 'Bhaskara-3', 'AstroSat-2'],
    correctOption: 1,
    explanation: 'ISRO launched Aditya-L1 on September 2, 2023 to observe the solar corona and chromosphere.',
    sourceUrl: 'https://www.isro.gov.in/Aditya_L1.html',
    publishedAt: '2023-09-02',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_m5',
    category: 'current_affairs',
    subcategory: 'Sports',
    difficulty: 'medium',
    questionText: 'Which Indian chess grandmaster won the 2024 World Chess Championship in Singapore at age 18?',
    options: ['R Praggnanandhaa', 'Gukesh Dommaraju', 'Arjun Erigaisi', 'Vidit Gujrathi'],
    correctOption: 1,
    explanation: 'Gukesh Dommaraju defeated Ding Liren in December 2024 to become the youngest undisputed World Chess Champion.',
    sourceUrl: 'https://www.fide.com/',
    publishedAt: '2024-12-12',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_h1',
    category: 'current_affairs',
    subcategory: 'Science and Technology',
    difficulty: 'hard',
    questionText: 'Who were awarded the 2024 Nobel Prize in Physics for foundational discoveries enabling machine learning with artificial neural networks?',
    options: [
      'John Hopfield and Geoffrey Hinton',
      'Alain Aspect and Anton Zeilinger',
      'Pierre Agostini and Anne L’Huillier',
      'Roger Penrose and Andrea Ghez',
    ],
    correctOption: 0,
    explanation: 'John J. Hopfield and Geoffrey E. Hinton received the 2024 Nobel Prize in Physics.',
    sourceUrl: 'https://www.nobelprize.org/prizes/physics/2024/summary/',
    publishedAt: '2024-10-08',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_h2',
    category: 'current_affairs',
    subcategory: 'Science and Technology',
    difficulty: 'hard',
    questionText: 'Which NASA spacecraft launched in October 2024 to conduct detailed reconnaissance of Jupiter’s icy moon Europa?',
    options: ['JUICE', 'Europa Clipper', 'Dragonfly', 'Psyche'],
    correctOption: 1,
    explanation: 'NASA’s Europa Clipper launched on October 14, 2024.',
    sourceUrl: 'https://science.nasa.gov/mission/europa-clipper/',
    publishedAt: '2024-10-14',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_h3',
    category: 'current_affairs',
    subcategory: 'World',
    difficulty: 'hard',
    questionText: 'Which South Korean author was awarded the 2024 Nobel Prize in Literature?',
    options: ['Han Kang', 'Shin Kyung-sook', 'Hwang Sok-yong', 'Kim Young-ha'],
    correctOption: 0,
    explanation: 'Han Kang received the 2024 Nobel Prize in Literature.',
    sourceUrl: 'https://www.nobelprize.org/prizes/literature/2024/summary/',
    publishedAt: '2024-10-10',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_h4',
    category: 'current_affairs',
    subcategory: 'World',
    difficulty: 'hard',
    questionText: 'Who were awarded the 2024 Nobel Prize in Physiology or Medicine for the discovery of microRNA?',
    options: [
      'Victor Ambros and Gary Ruvkun',
      'Katalin Karikó and Drew Weissman',
      'Svante Pääbo and David Julius',
      'Jennifer Doudna and Emmanuelle Charpentier',
    ],
    correctOption: 0,
    explanation: 'Victor Ambros and Gary Ruvkun received the 2024 Nobel Prize in Physiology or Medicine.',
    sourceUrl: 'https://www.nobelprize.org/prizes/medicine/2024/summary/',
    publishedAt: '2024-10-07',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
  {
    id: 'seed_ca_h5',
    category: 'current_affairs',
    subcategory: 'World',
    difficulty: 'hard',
    questionText: 'Which regional bloc was admitted as a permanent member of the G20 during the 2023 New Delhi Summit?',
    options: ['ASEAN', 'African Union', 'Arab League', 'Mercosur'],
    correctOption: 1,
    explanation: 'The African Union became a permanent member of the G20 in September 2023.',
    sourceUrl: 'https://au.int/',
    publishedAt: '2023-09-09',
    verifiedAt: '2025-01-15',
    expiresAt: '2028-12-31',
  },
];

export const SEED_QUESTIONS: QuestionItem[] = [
  ...RAW_SEED_QUESTIONS,
  ...EXPANDED_SEED_QUESTIONS,
].map((q) => ({
  id: q.id,
  category: q.category,
  subcategory: q.subcategory,
  difficulty: q.difficulty,
  questionText: q.questionText,
  options: q.options,
  answerHash: computeAnswerHash(q.id, q.correctOption),
  sourceUrl: q.sourceUrl || '',
  publishedAt: q.publishedAt || '2025-01-01',
  verifiedAt: q.verifiedAt || '2025-01-15',
  expiresAt: q.expiresAt || '2028-12-31',
  isActive: true,
  correctOption: q.correctOption,
  explanation: q.explanation,
}));

const AI_QUESTIONS_STORAGE_KEY = 'calc_racer_ai_questions_v1';

export function getCachedAiQuestions(): QuestionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AI_QUESTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QuestionItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCachedAiQuestions(newItems: QuestionItem[]): QuestionItem[] {
  if (typeof window === 'undefined') return newItems;
  try {
    const existing = getCachedAiQuestions();
    const seenTexts = new Set(
      [...SEED_QUESTIONS, ...existing].map((q) =>
        q.questionText.trim().toLowerCase()
      )
    );
    const filteredNew = newItems.filter(
      (q) => !seenTexts.has(q.questionText.trim().toLowerCase())
    );
    const merged = [...filteredNew, ...existing].slice(0, 300);
    localStorage.setItem(AI_QUESTIONS_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return newItems;
  }
}


/**
 * Deterministic Mathematics Question Generator
 * Produces verified questions matching the exact difficulty rules and selected operations:
 * - Easy: Small beginner-friendly whole numbers (+, −, ×, ÷), whole-number division, no negatives/decimals/powers.
 * - Medium: Larger numbers, multiplication tables, division, order of operations.
 * - Hard: Multi-step arithmetic, brackets, percentages, squares/roots, powers.
 *
 * Encodes the seed index in the ID (`mgen_<diff>_<opCode>_<seed>`) so any multiplayer client
 * can reconstruct the exact same question from its ID!
 */
export function buildDeterministicMathQuestion(
  difficulty: QuestionDifficulty,
  operation: 'Addition' | 'Subtraction' | 'Multiplication' | 'Division' | 'Mixed Operations',
  seedNum: number
): QuestionItem {
  const opCodeMap: Record<string, string> = {
    Addition: 'add',
    Subtraction: 'sub',
    Multiplication: 'mul',
    Division: 'div',
    'Mixed Operations': 'mix',
  };
  const opCode = opCodeMap[operation] || 'add';
  const id = `mgen_${difficulty}_${opCode}_${seedNum}`;

  // Simple deterministic PRNG from seedNum
  const nextRand = (mod: number, offset: number = 1) => {
    const val = Math.abs(Math.imul(seedNum + offset * 97, 1664525) + 1013904223);
    return val % mod;
  };

  let questionText = '';
  let answer = 0;
  let explanation = '';

  if (difficulty === 'easy') {
    // Easy: small beginner-friendly whole numbers, single step, no negatives
    const effectiveOp =
      operation === 'Mixed Operations'
        ? (['Addition', 'Subtraction', 'Multiplication', 'Division'] as const)[seedNum % 4]
        : operation;

    if (effectiveOp === 'Addition') {
      const a = 3 + nextRand(13, 1); // 3..15
      const b = 2 + nextRand(12, 2); // 2..13
      answer = a + b;
      questionText = `What is ${a} + ${b}?`;
      explanation = `${a} + ${b} = ${answer}.`;
    } else if (effectiveOp === 'Subtraction') {
      const b = 2 + nextRand(10, 1); // 2..11
      const diff = 3 + nextRand(12, 2); // 3..14 (always positive!)
      const a = b + diff;
      answer = diff;
      questionText = `What is ${a} − ${b}?`;
      explanation = `${a} − ${b} = ${answer}.`;
    } else if (effectiveOp === 'Multiplication') {
      const a = 2 + nextRand(8, 1); // 2..9
      const b = 2 + nextRand(8, 2); // 2..9
      answer = a * b;
      questionText = `What is ${a} × ${b}?`;
      explanation = `${a} × ${b} = ${answer}.`;
    } else {
      // Division: guaranteed whole-number answer
      const divisor = 2 + nextRand(7, 1); // 2..8
      const quotient = 2 + nextRand(8, 2); // 2..9
      const dividend = divisor * quotient;
      answer = quotient;
      questionText = `What is ${dividend} ÷ ${divisor}?`;
      explanation = `${divisor} × ${quotient} = ${dividend}, so ${dividend} ÷ ${divisor} = ${answer}.`;
    }
  } else if (difficulty === 'medium') {
    if (operation === 'Addition') {
      const a = 24 + nextRand(65, 1);
      const b = 18 + nextRand(55, 2);
      answer = a + b;
      questionText = `What is ${a} + ${b}?`;
      explanation = `${a} + ${b} = ${answer}.`;
    } else if (operation === 'Subtraction') {
      const b = 25 + nextRand(55, 1);
      const diff = 18 + nextRand(65, 2);
      const a = b + diff;
      answer = diff;
      questionText = `What is ${a} − ${b}?`;
      explanation = `${a} − ${b} = ${answer}.`;
    } else if (operation === 'Multiplication') {
      const a = 11 + nextRand(8, 1); // 11..18
      const b = 4 + nextRand(9, 2); // 4..12
      answer = a * b;
      questionText = `What is ${a} × ${b}?`;
      explanation = `${a} × ${b} = ${answer}.`;
    } else if (operation === 'Division') {
      const divisor = 6 + nextRand(9, 1); // 6..14
      const quotient = 7 + nextRand(10, 2); // 7..16
      const dividend = divisor * quotient;
      answer = quotient;
      questionText = `What is ${dividend} ÷ ${divisor}?`;
      explanation = `${divisor} × ${quotient} = ${dividend}, so ${dividend} ÷ ${divisor} = ${answer}.`;
    } else {
      // Mixed Operations (Order of operations)
      const a = 10 + nextRand(20, 1);
      const b = 3 + nextRand(8, 2);
      const c = 3 + nextRand(7, 3);
      answer = a + b * c;
      questionText = `Calculate: ${a} + ${b} × ${c}`;
      explanation = `Multiply first: ${b} × ${c} = ${b * c}. Then add ${a} + ${b * c} = ${answer}.`;
    }
  } else {
    // Hard
    if (operation === 'Addition') {
      const a = 135 + nextRand(250, 1);
      const b = 148 + nextRand(240, 2);
      const c = 45 + nextRand(90, 3);
      answer = a + b + c;
      questionText = `Calculate: ${a} + ${b} + ${c}`;
      explanation = `${a} + ${b} = ${a + b}, plus ${c} = ${answer}.`;
    } else if (operation === 'Subtraction') {
      const a = 420 + nextRand(300, 1);
      const b = 135 + nextRand(120, 2);
      const c = 45 + nextRand(80, 3);
      answer = a - b - c;
      questionText = `Calculate: ${a} − ${b} − ${c}`;
      explanation = `${a} − ${b} = ${a - b}, minus ${c} = ${answer}.`;
    } else if (operation === 'Multiplication') {
      const a = 15 + nextRand(15, 1); // 15..29
      const b = 12 + nextRand(12, 2); // 12..23
      answer = a * b;
      questionText = `What is ${a} × ${b}?`;
      explanation = `${a} × ${b} = ${answer}.`;
    } else if (operation === 'Division') {
      const divisor = 12 + nextRand(14, 1); // 12..25
      const quotient = 14 + nextRand(16, 2); // 14..29
      const dividend = divisor * quotient;
      answer = quotient;
      questionText = `What is ${dividend} ÷ ${divisor}?`;
      explanation = `${divisor} × ${quotient} = ${dividend}, so ${dividend} ÷ ${divisor} = ${answer}.`;
    } else {
      // Hard Mixed Operations (Squares, roots, brackets)
      const rootBase = 6 + nextRand(10, 1); // 6..15
      const sq = rootBase * rootBase;
      const multA = 4 + nextRand(9, 2);
      const multB = 5 + nextRand(8, 3);
      answer = rootBase + multA * multB;
      questionText = `Evaluate: √${sq} + (${multA} × ${multB})`;
      explanation = `√${sq} = ${rootBase} and ${multA} × ${multB} = ${multA * multB}. ${rootBase} + ${multA * multB} = ${answer}.`;
    }
  }

  // Build 4 distinct plausible options
  const correctPos = seedNum % 4;
  const offsets =
    difficulty === 'easy'
      ? [-2, -1, 1, 2, 3, 4]
      : [-10, -4, -2, 2, 4, 10];
  const distractors: number[] = [];
  let idx = 0;
  while (distractors.length < 3) {
    const delta = offsets[(seedNum + idx) % offsets.length] + (idx >= offsets.length ? idx : 0);
    const candidate = Math.max(1, answer + (delta === 0 ? 3 : delta));
    if (candidate !== answer && !distractors.includes(candidate)) {
      distractors.push(candidate);
    }
    idx++;
  }

  const opts: string[] = [];
  let dPtr = 0;
  for (let i = 0; i < 4; i++) {
    if (i === correctPos) {
      opts.push(String(answer));
    } else {
      opts.push(String(distractors[dPtr++]));
    }
  }

  return {
    id,
    category: 'math',
    subcategory: operation,
    difficulty,
    questionText,
    options: opts as [string, string, string, string],
    answerHash: computeAnswerHash(id, correctPos),
    sourceUrl: '',
    publishedAt: '2025-01-01',
    verifiedAt: '2025-01-15',
    isActive: true,
    correctOption: correctPos,
    explanation,
  };
}

export function reconstructQuestionById(
  id: string,
  pool: QuestionItem[]
): QuestionItem | null {
  const aiCached = getCachedAiQuestions();
  const fromPool =
    pool.find((q) => q.id === id) ||
    aiCached.find((q) => q.id === id) ||
    SEED_QUESTIONS.find((q) => q.id === id);
  if (fromPool) return fromPool;

  // Check if it is a deterministic mathgen question: mgen_<diff>_<opCode>_<seed>
  const match = /^mgen_(easy|medium|hard)_(add|sub|mul|div|mix)_(\d+)$/.exec(id);
  if (match) {
    const diff = match[1] as QuestionDifficulty;
    const opCode = match[2];
    const seed = parseInt(match[3], 10);
    const opMap: Record<
      string,
      'Addition' | 'Subtraction' | 'Multiplication' | 'Division' | 'Mixed Operations'
    > = {
      add: 'Addition',
      sub: 'Subtraction',
      mul: 'Multiplication',
      div: 'Division',
      mix: 'Mixed Operations',
    };
    return buildDeterministicMathQuestion(diff, opMap[opCode] || 'Addition', seed);
  }
  return null;
}

export function isQuestionValidAndUnexpired(q: QuestionItem): boolean {
  if (!q.isActive) return false;
  if (!q.options || q.options.length !== 4) return false;
  if (q.category === 'current_affairs') {
    if (!q.verifiedAt) return false;
    if (q.expiresAt) {
      const today = new Date().toISOString().slice(0, 10);
      if (q.expiresAt < today) return false;
    }
  }
  return true;
}

export function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Selects a verified sequence of questions strictly matching the chosen category, difficulty,
 * and optional subcategories/operations.
 * - Never repeats a question within a single game (by ID or normalized text).
 * - Prioritizes unseen questions (`!seenQuestionIds.has(q.id)`) across games.
 * - Automatically recycles previously seen questions only when the unseen pool is exhausted.
 */
export function selectRaceQuestions(
  pool: QuestionItem[],
  category: QuestionCategory,
  difficulty: QuestionDifficulty,
  count: number = 10,
  selectedSubcategories: string[] = [],
  seenQuestionIds: Set<string> = new Set()
): QuestionItem[] {
  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Merge active DB pool with cached AI questions and SEED_QUESTIONS to ensure full baseline coverage
  const poolIds = new Set<string>();
  const combinedPool: QuestionItem[] = [];
  for (const item of [...pool, ...getCachedAiQuestions(), ...SEED_QUESTIONS]) {
    if (!poolIds.has(item.id) && isQuestionValidAndUnexpired(item)) {
      poolIds.add(item.id);
      combinedPool.push(item);
    }
  }

  const categoryDifficultyPool = combinedPool.filter(
    (q) => q.category === category && q.difficulty === difficulty
  );

  const chosen: QuestionItem[] = [];
  const usedIds = new Set<string>();
  const usedTexts = new Set<string>();

  const tryAddUnique = (candidates: QuestionItem[]) => {
    for (const q of candidates) {
      if (chosen.length >= count) break;
      const norm = normalizeQuestionText(q.questionText);
      if (!usedIds.has(q.id) && !usedTexts.has(norm)) {
        usedIds.add(q.id);
        usedTexts.add(norm);
        chosen.push(q);
      }
    }
  };

  // If Mathematics is selected, resolve operations
  if (category === 'math') {
    let activeOps =
      selectedSubcategories.length > 0
        ? selectedSubcategories
        : ['Addition', 'Subtraction', 'Multiplication', 'Division'];

    if (difficulty === 'easy') {
      const basicOnly = activeOps.filter((op) => op !== 'Mixed Operations');
      activeOps =
        basicOnly.length > 0
          ? basicOnly
          : ['Addition', 'Subtraction', 'Multiplication', 'Division'];
    }

    const matchingMath = categoryDifficultyPool.filter(
      (q) =>
        !q.subcategory ||
        activeOps.includes(q.subcategory) ||
        selectedSubcategories.includes('Mixed Operations')
    );

    const unseenMath = shuffle(matchingMath.filter((q) => !seenQuestionIds.has(q.id)));
    tryAddUnique(unseenMath);

    // Generate deterministic math questions with unseen seeds first
    let seedBase = Math.floor(Math.random() * 900) + 1;
    let attempts = 0;
    while (chosen.length < count && attempts < 250) {
      const op = activeOps[(chosen.length + attempts) % activeOps.length] as
        | 'Addition'
        | 'Subtraction'
        | 'Multiplication'
        | 'Division'
        | 'Mixed Operations';
      const generated = buildDeterministicMathQuestion(
        difficulty,
        op,
        ((seedBase + attempts * 7) % 1200) + 1
      );
      attempts++;
      const norm = normalizeQuestionText(generated.questionText);
      if (
        !seenQuestionIds.has(generated.id) &&
        !usedIds.has(generated.id) &&
        !usedTexts.has(norm)
      ) {
        usedIds.add(generated.id);
        usedTexts.add(norm);
        chosen.push(generated);
      }
    }

    // Fallback to recycling seen math questions if needed
    if (chosen.length < count) {
      tryAddUnique(shuffle(matchingMath));
      while (chosen.length < count) {
        const op = activeOps[chosen.length % activeOps.length] as
          | 'Addition'
          | 'Subtraction'
          | 'Multiplication'
          | 'Division'
          | 'Mixed Operations';
        const generated = buildDeterministicMathQuestion(difficulty, op, seedBase++);
        const norm = normalizeQuestionText(generated.questionText);
        if (!usedIds.has(generated.id) && !usedTexts.has(norm)) {
          usedIds.add(generated.id);
          usedTexts.add(norm);
          chosen.push(generated);
        }
      }
    }

    return shuffle(chosen).slice(0, count);
  }

  // For GK, Science, and Current Affairs:
  // 1. Primary pool: matching selected subcategories (or all in category+difficulty)
  const primaryPool =
    selectedSubcategories.length > 0
      ? categoryDifficultyPool.filter(
          (q) => q.subcategory && selectedSubcategories.includes(q.subcategory)
        )
      : categoryDifficultyPool;

  // Step A: Unseen questions in primary subcategory selection
  const unseenPrimary = shuffle(primaryPool.filter((q) => !seenQuestionIds.has(q.id)));
  tryAddUnique(unseenPrimary);

  // Step B: If more needed and a narrow subcategory was selected, take unseen from same Category + Difficulty
  if (chosen.length < count && selectedSubcategories.length > 0) {
    const unseenCategory = shuffle(
      categoryDifficultyPool.filter((q) => !seenQuestionIds.has(q.id))
    );
    tryAddUnique(unseenCategory);
  }

  // Step C: Recycle seen questions from primary subcategory selection if unseen pool exhausted
  if (chosen.length < count) {
    const seenPrimary = shuffle(primaryPool.filter((q) => seenQuestionIds.has(q.id)));
    tryAddUnique(seenPrimary);
  }

  // Step D: Recycle seen questions from same Category + Difficulty if still < count
  if (chosen.length < count) {
    const seenCategory = shuffle(
      categoryDifficultyPool.filter((q) => seenQuestionIds.has(q.id))
    );
    tryAddUnique(seenCategory);
  }

  return chosen.slice(0, count);
}

/**
 * Counts how many valid questions exist for the given setup configuration
 * so the Game Setup Screen can validate before starting.
 */
export function countAvailableQuestions(
  pool: QuestionItem[],
  category: QuestionCategory,
  difficulty: QuestionDifficulty,
  selectedSubcategories: string[] = []
): number {
  if (category === 'math') {
    return 60;
  }
  const seenIds = new Set<string>();
  const combinedPool: QuestionItem[] = [];
  for (const item of [...pool, ...getCachedAiQuestions(), ...SEED_QUESTIONS]) {
    if (!seenIds.has(item.id) && isQuestionValidAndUnexpired(item)) {
      seenIds.add(item.id);
      combinedPool.push(item);
    }
  }
  const categoryDifficultyPool = combinedPool.filter(
    (q) => q.category === category && q.difficulty === difficulty
  );
  if (selectedSubcategories.length > 0) {
    const subMatches = categoryDifficultyPool.filter(
      (q) => q.subcategory && selectedSubcategories.includes(q.subcategory)
    );
    // If a single subcategory is selected, we prioritize its questions and allow same-category/difficulty top-up for 15/20-question races
    return Math.max(subMatches.length, categoryDifficultyPool.length);
  }
  return categoryDifficultyPool.length;
}

