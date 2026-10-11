import {
  IQ_RELAY_ALL_FIELDS,
  IqRelayField,
  QuestionCategory,
  QuestionDifficulty,
  QuestionItem,
  TrojoGameId,
} from '../game/types';
import { computeAnswerHash, SEED_QUESTIONS } from './seedQuestions';

interface RawTrojoQuestion {
  id: string;
  gameId: TrojoGameId;
  category: QuestionCategory;
  subcategory: string;
  difficulty: QuestionDifficulty;
  questionText: string;
  options: [string, string, string, string];
  correctOption: number;
  explanation: string;
  acceptedAnswers?: string[];
  scrambledLetters?: string;
  emojiClue?: string;
  memoryTarget?: string;
  iqField?: IqRelayField;
}

const RAW_TROJO_QUESTIONS: RawTrojoQuestion[] = [
  // ===========================================================================
  // GAME 2: CHEAT YOUR FRIEND (Bluffing & Surprising Trivia)
  // ===========================================================================
  {
    id: 'cyf_e1',
    gameId: 'cheat_your_friend',
    category: 'gk',
    subcategory: 'Weird Nature',
    difficulty: 'easy',
    questionText: 'What shape is a wombat’s poop in the wild?',
    options: ['Cube-shaped', 'Star-shaped', 'Pyramid-shaped', 'Spiral-shaped'],
    correctOption: 0,
    explanation: 'Wombats produce cube-shaped scat so it does not roll away when marking territory!',
  },
  {
    id: 'cyf_e2',
    gameId: 'cheat_your_friend',
    category: 'science',
    subcategory: 'Animal Facts',
    difficulty: 'easy',
    questionText: 'Where is a shrimp’s heart actually located?',
    options: ['In its tail fin', 'In its head', 'In its left claw', 'In its antennae'],
    correctOption: 1,
    explanation: 'A shrimp’s heart is located inside its head (cephalothorax).',
  },
  {
    id: 'cyf_e3',
    gameId: 'cheat_your_friend',
    category: 'gk',
    subcategory: 'Food & Everyday',
    difficulty: 'easy',
    questionText: 'Which fruit is botanically classified as a berry, while strawberries are not?',
    options: ['Peach', 'Apple', 'Banana', 'Cherry'],
    correctOption: 2,
    explanation: 'Botanically, bananas (and watermelons) are true berries!',
  },
  {
    id: 'cyf_e4',
    gameId: 'cheat_your_friend',
    category: 'science',
    subcategory: 'Space Quirks',
    difficulty: 'easy',
    questionText: 'On which planet is a single day (rotation) longer than a single year (orbit)?',
    options: ['Mars', 'Mercury', 'Jupiter', 'Venus'],
    correctOption: 3,
    explanation: 'Venus takes 243 Earth days to rotate once, but only 225 Earth days to orbit the Sun!',
  },
  {
    id: 'cyf_e5',
    gameId: 'cheat_your_friend',
    category: 'gk',
    subcategory: 'Human Body',
    difficulty: 'easy',
    questionText: 'Which part of the human body has zero blood supply and gets oxygen directly from the air?',
    options: ['Ear lobe', 'Cornea of the eye', 'Fingernail bed', 'Tip of the tongue'],
    correctOption: 1,
    explanation: 'The cornea has no blood vessels so it remains transparent for vision.',
  },
  {
    id: 'cyf_e6',
    gameId: 'cheat_your_friend',
    category: 'gk',
    subcategory: 'History Quirks',
    difficulty: 'easy',
    questionText: 'What were high-heeled shoes originally invented for in 10th-century Persia?',
    options: [
      'Horseback archers to grip stirrups',
      'Walking through muddy palace gardens',
      'Royal stage actors',
      'Reaching high library shelves',
    ],
    correctOption: 0,
    explanation: 'Persian cavalry riders wore heels to lock their boots into stirrups while shooting bows.',
  },
  {
    id: 'cyf_e7',
    gameId: 'cheat_your_friend',
    category: 'science',
    subcategory: 'Animal Facts',
    difficulty: 'easy',
    questionText: 'How do sea otters keep from drifting apart while sleeping on the ocean surface?',
    options: [
      'They anchor to rocks with their tails',
      'They hold paws with each other',
      'They sleep on floating coconuts',
      'They swim in slow circles',
    ],
    correctOption: 1,
    explanation: 'Sea otters hold paws in "rafts" and wrap themselves in kelp so they don’t float away!',
  },
  {
    id: 'cyf_e8',
    gameId: 'cheat_your_friend',
    category: 'gk',
    subcategory: 'Food & Everyday',
    difficulty: 'easy',
    questionText: 'Which food found in ancient Egyptian tombs over 3,000 years old is still completely edible?',
    options: ['Dried figs', 'Salted olives', 'Honey', 'Roasted barley'],
    correctOption: 2,
    explanation: 'Pure honey has ultra-low moisture and high acidity, allowing it to last thousands of years without spoiling.',
  },
  {
    id: 'cyf_m1',
    gameId: 'cheat_your_friend',
    category: 'gk',
    subcategory: 'World Quirks',
    difficulty: 'medium',
    questionText: 'What is the official national animal of Scotland?',
    options: ['Highland Cow', 'Unicorn', 'Golden Eagle', 'Red Stag'],
    correctOption: 1,
    explanation: 'The mythical Unicorn has been a Scottish heraldic symbol since the 12th century.',
  },
  {
    id: 'cyf_m2',
    gameId: 'cheat_your_friend',
    category: 'science',
    subcategory: 'Ocean Life',
    difficulty: 'medium',
    questionText: 'How many hearts does a giant Pacific octopus have?',
    options: ['2 hearts', '5 hearts', '3 hearts', '8 hearts'],
    correctOption: 2,
    explanation: 'An octopus has 3 hearts: two pump blood to the gills and one pumps it to the body.',
  },
  {
    id: 'cyf_m3',
    gameId: 'cheat_your_friend',
    category: 'gk',
    subcategory: 'Inventions',
    difficulty: 'medium',
    questionText: 'What was Bubble Wrap originally invented to be in 1957?',
    options: [
      'Textured 3D plastic wallpaper',
      'Greenhouse roof insulation',
      'Astronaut boot lining',
      'Floating pool covers',
    ],
    correctOption: 0,
    explanation: 'Engineers Alfred Fielding and Marc Chavannes originally designed Bubble Wrap as 3D plastic wallpaper!',
  },
  {
    id: 'cyf_m4',
    gameId: 'cheat_your_friend',
    category: 'gk',
    subcategory: 'History Quirks',
    difficulty: 'medium',
    questionText: 'How long did the shortest recorded war in history (the Anglo-Zanzibar War of 1896) last?',
    options: ['4 hours', '1 day', '3 days', '38 minutes'],
    correctOption: 3,
    explanation: 'The Anglo-Zanzibar War of August 27, 1896 lasted between 38 and 45 minutes.',
  },
  {
    id: 'cyf_m5',
    gameId: 'cheat_your_friend',
    category: 'science',
    subcategory: 'Animal Facts',
    difficulty: 'medium',
    questionText: 'What color is a polar bear’s skin underneath its translucent white fur?',
    options: ['Pink', 'Jet black', 'Snow white', 'Silver grey'],
    correctOption: 1,
    explanation: 'A polar bear’s skin is jet black to absorb maximum warmth from sunlight!',
  },
  {
    id: 'cyf_h1',
    gameId: 'cheat_your_friend',
    category: 'science',
    subcategory: 'Space Quirks',
    difficulty: 'hard',
    questionText: 'According to Apollo astronauts, what does Moon dust smell like inside the lunar module?',
    options: ['Spent gunpowder', 'Burnt almonds', 'Wet copper coins', 'Fresh peppermint'],
    correctOption: 0,
    explanation: 'Apollo astronauts consistently reported that lunar regolith smelled like spent gunpowder.',
  },
  {
    id: 'cyf_h2',
    gameId: 'cheat_your_friend',
    category: 'gk',
    subcategory: 'Language & Law',
    difficulty: 'hard',
    questionText: 'What is the technical term for the plastic or metal tip at the end of a shoelace?',
    options: ['Ferrule', 'Aglet', 'Grommet', 'Spindle'],
    correctOption: 1,
    explanation: 'The protective sheath at the end of a shoelace is called an aglet.',
  },
  {
    id: 'cyf_h3',
    gameId: 'cheat_your_friend',
    category: 'science',
    subcategory: 'Physics & Earth',
    difficulty: 'hard',
    questionText: 'Why is the Eiffel Tower about 15 cm taller during hot summer days than in winter?',
    options: [
      'Humidity swells the foundation stones',
      'Summer winds lift the upper spire',
      'Thermal expansion of its puddled iron',
      'Solar magnetic attraction',
    ],
    correctOption: 2,
    explanation: 'Heat causes the iron structure to expand through thermal expansion, adding up to 15 cm in height.',
  },

  // ===========================================================================
  // GAME 3: SOLVE THE PUZZLE (Number, Pattern, Logic, Sequence & Word Puzzles)
  // ===========================================================================
  {
    id: 'puz_e1',
    gameId: 'solve_the_puzzle',
    category: 'math',
    subcategory: 'Sequence Puzzle',
    difficulty: 'easy',
    questionText: 'Find the next number in the sequence: 2, 4, 8, 16, ___',
    options: ['24', '30', '32', '64'],
    correctOption: 2,
    explanation: 'Each number doubles the previous one: 16 × 2 = 32.',
  },
  {
    id: 'puz_e2',
    gameId: 'solve_the_puzzle',
    category: 'gk',
    subcategory: 'Logic Riddle',
    difficulty: 'easy',
    questionText: 'I have keys but no locks, space but no room, and you can enter but can’t go inside. What am I?',
    options: ['A Piano', 'A Keyboard', 'A Treasure Map', 'A Dictionary'],
    correctOption: 1,
    explanation: 'A computer keyboard has keys, a spacebar, and an Enter key!',
  },
  {
    id: 'puz_e3',
    gameId: 'solve_the_puzzle',
    category: 'math',
    subcategory: 'Number Puzzle',
    difficulty: 'easy',
    questionText: 'If 3 cats catch 3 mice in 3 minutes, how many minutes does it take 10 cats to catch 10 mice?',
    options: ['3 minutes', '1 minute', '10 minutes', '30 minutes'],
    correctOption: 0,
    explanation: 'Each cat takes 3 minutes to catch 1 mouse, so 10 cats working together still take 3 minutes.',
  },
  {
    id: 'puz_e4',
    gameId: 'solve_the_puzzle',
    category: 'gk',
    subcategory: 'Pattern Recognition',
    difficulty: 'easy',
    questionText: 'Complete the visual pattern: 🔺 🔵 🔺 🔵 🔺 ___',
    options: ['🔺', '🟩', '⭐', '🔵'],
    correctOption: 3,
    explanation: 'The pattern alternates Red Triangle and Blue Circle, so Blue Circle (🔵) comes next.',
  },
  {
    id: 'puz_e5',
    gameId: 'solve_the_puzzle',
    category: 'gk',
    subcategory: 'Word Puzzle',
    difficulty: 'easy',
    questionText: 'Which month of the year has 28 days?',
    options: ['Only February', 'All 12 months', 'Only leap-year months', 'None of them'],
    correctOption: 1,
    explanation: 'Every single month of the year has at least 28 days!',
  },
  {
    id: 'puz_e6',
    gameId: 'solve_the_puzzle',
    category: 'math',
    subcategory: 'Sequence Puzzle',
    difficulty: 'easy',
    questionText: 'What comes next in the square number sequence: 1, 4, 9, 16, 25, ___?',
    options: ['30', '35', '36', '49'],
    correctOption: 2,
    explanation: 'These are perfect squares (1², 2², 3², 4², 5²), so 6² = 36.',
  },
  {
    id: 'puz_e7',
    gameId: 'solve_the_puzzle',
    category: 'gk',
    subcategory: 'Logic Riddle',
    difficulty: 'easy',
    questionText: 'What gets wetter the more it dries?',
    options: ['A Towel', 'An Umbrella', 'A Sponge', 'An Ice Cube'],
    correctOption: 0,
    explanation: 'A towel absorbs water and gets wetter as it dries you off!',
  },
  {
    id: 'puz_m1',
    gameId: 'solve_the_puzzle',
    category: 'math',
    subcategory: 'Sequence Puzzle',
    difficulty: 'medium',
    questionText: 'Find the missing Fibonacci number: 1, 1, 2, 3, 5, 8, 13, ___',
    options: ['18', '20', '21', '26'],
    correctOption: 2,
    explanation: 'Each term is the sum of the two preceding ones: 8 + 13 = 21.',
  },
  {
    id: 'puz_m2',
    gameId: 'solve_the_puzzle',
    category: 'gk',
    subcategory: 'Logic Riddle',
    difficulty: 'medium',
    questionText: 'You are running a race and overtake the person in 2nd place. What place are you in now?',
    options: ['1st place', '2nd place', '3rd place', 'Tied for 1st'],
    correctOption: 1,
    explanation: 'When you pass the 2nd-place runner, you take their position — 2nd place!',
  },
  {
    id: 'puz_m3',
    gameId: 'solve_the_puzzle',
    category: 'math',
    subcategory: 'Number Puzzle',
    difficulty: 'medium',
    questionText: 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?',
    options: ['$0.10', '$0.05', '$0.15', '$0.01'],
    correctOption: 1,
    explanation: 'If the ball is $0.05, the bat is $1.05 ($1.00 more), and $0.05 + $1.05 = $1.10.',
  },
  {
    id: 'puz_m4',
    gameId: 'solve_the_puzzle',
    category: 'gk',
    subcategory: 'Pattern Recognition',
    difficulty: 'medium',
    questionText: 'What letter comes next in this first-letter sequence: O, T, T, F, F, S, S, E, ___?',
    options: ['N', 'T', 'I', 'L'],
    correctOption: 0,
    explanation: 'They are the first letters of One, Two, Three, Four, Five, Six, Seven, Eight, Nine (N)!',
  },
  {
    id: 'puz_m5',
    gameId: 'solve_the_puzzle',
    category: 'math',
    subcategory: 'Number Puzzle',
    difficulty: 'medium',
    questionText: 'I am an odd number. Take away one letter and I become "even". What number am I?',
    options: ['Three', 'Nine', 'Eleven', 'Seven'],
    correctOption: 3,
    explanation: 'Remove the letter "S" from SEVEN and it spells EVEN!',
  },
  {
    id: 'puz_h1',
    gameId: 'solve_the_puzzle',
    category: 'math',
    subcategory: 'Number Puzzle',
    difficulty: 'hard',
    questionText: 'A lily pad doubles in size every day. If it takes 48 days to cover the entire pond, how many days to cover half the pond?',
    options: ['24 days', '46 days', '47 days', '45 days'],
    correctOption: 2,
    explanation: 'Since the patch doubles every day, it was half the size of the pond on Day 47.',
  },
  {
    id: 'puz_h2',
    gameId: 'solve_the_puzzle',
    category: 'math',
    subcategory: 'Sequence Puzzle',
    difficulty: 'hard',
    questionText: 'Find the next number in the prime-gap pattern: 2, 3, 5, 7, 11, 13, 17, ___',
    options: ['18', '19', '21', '23'],
    correctOption: 1,
    explanation: 'This is the sequence of prime numbers; the next prime after 17 is 19.',
  },
  {
    id: 'puz_h3',
    gameId: 'solve_the_puzzle',
    category: 'math',
    subcategory: 'Number Puzzle',
    difficulty: 'hard',
    questionText: 'In a room of 5 sisters, each sister is doing an activity: 1st reads, 2nd cooks, 3rd plays chess, 4th gardens. What is the 5th sister doing?',
    options: [
      'Playing chess with the 3rd sister',
      'Sleeping upstairs',
      'Watching television',
      'Setting the dining table',
    ],
    correctOption: 0,
    explanation: 'Chess requires two players, so the 5th sister is playing chess with the 3rd sister!',
  },

  // ===========================================================================
  // GAME 4: WORD SCRAMBLE (Curated Valid Word Race)
  // ===========================================================================
  {
    id: 'ws_e1',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Space & Sky',
    difficulty: 'easy',
    scrambledLetters: 'L A N P E T',
    questionText: 'Unscramble the 6-letter word (Hint: Orbits a star in space): L A N P E T',
    options: ['PLANET', 'PLATEN', 'PATENT', 'TALENT'],
    correctOption: 0,
    acceptedAnswers: ['PLANET'],
    explanation: 'L-A-N-P-E-T unscrambles to PLANET.',
  },
  {
    id: 'ws_e2',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Racing & Speed',
    difficulty: 'easy',
    scrambledLetters: 'P O R T H Y',
    questionText: 'Unscramble the 6-letter word (Hint: Winner’s golden cup): P O R T H Y',
    options: ['THEORY', 'TROPHY', 'THORNY', 'POETRY'],
    correctOption: 1,
    acceptedAnswers: ['TROPHY'],
    explanation: 'P-O-R-T-H-Y unscrambles to TROPHY.',
  },
  {
    id: 'ws_e3',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Games & Fun',
    difficulty: 'easy',
    scrambledLetters: 'Z L E P U Z',
    questionText: 'Unscramble the 6-letter word (Hint: A brain teaser to solve): Z L E P U Z',
    options: ['MUZZLE', 'DAZZLE', 'PUZZLE', 'FIZZLE'],
    correctOption: 2,
    acceptedAnswers: ['PUZZLE'],
    explanation: 'Z-L-E-P-U-Z unscrambles to PUZZLE.',
  },
  {
    id: 'ws_e4',
    gameId: 'word_scramble',
    category: 'science',
    subcategory: 'Technology',
    difficulty: 'easy',
    scrambledLetters: 'K E T R O C',
    questionText: 'Unscramble the 6-letter word (Hint: Launches astronauts into orbit): K E T R O C',
    options: ['POCKET', 'SOCKET', 'LOCKET', 'ROCKET'],
    correctOption: 3,
    acceptedAnswers: ['ROCKET'],
    explanation: 'K-E-T-R-O-C unscrambles to ROCKET.',
  },
  {
    id: 'ws_e5',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Nature',
    difficulty: 'easy',
    scrambledLetters: 'G N U J E L',
    questionText: 'Unscramble the 6-letter word (Hint: Dense tropical rainforest): G N U J E L',
    options: ['JUNGLE', 'JUGGLE', 'BUNGLE', 'TANGLE'],
    correctOption: 0,
    acceptedAnswers: ['JUNGLE'],
    explanation: 'G-N-U-J-E-L unscrambles to JUNGLE.',
  },
  {
    id: 'ws_e6',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Music & Arts',
    difficulty: 'easy',
    scrambledLetters: 'R A T I U G',
    questionText: 'Unscramble the 6-letter word (Hint: Six-string musical instrument): R A T I U G',
    options: ['PIANO', 'GUITAR', 'VIOLIN', 'CYMBAL'],
    correctOption: 1,
    acceptedAnswers: ['GUITAR'],
    explanation: 'R-A-T-I-U-G unscrambles to GUITAR.',
  },
  {
    id: 'ws_e7',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Travel',
    difficulty: 'easy',
    scrambledLetters: 'D G E B R I',
    questionText: 'Unscramble the 6-letter word (Hint: Structure built to cross a river): D G E B R I',
    options: ['TUNNEL', 'HARBOR', 'BRIDGE', 'CASTLE'],
    correctOption: 2,
    acceptedAnswers: ['BRIDGE'],
    explanation: 'D-G-E-B-R-I unscrambles to BRIDGE.',
  },
  {
    id: 'ws_m1',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Sports',
    difficulty: 'medium',
    scrambledLetters: 'M P I C H A O N',
    questionText: 'Unscramble the 8-letter word (Hint: First-place tournament winner): M P I C H A O N',
    options: ['CAMPAIGN', 'CHAMPION', 'COMPANION', 'MARATHON'],
    correctOption: 1,
    acceptedAnswers: ['CHAMPION'],
    explanation: 'M-P-I-C-H-A-O-N unscrambles to CHAMPION.',
  },
  {
    id: 'ws_m2',
    gameId: 'word_scramble',
    category: 'science',
    subcategory: 'Physics',
    difficulty: 'medium',
    scrambledLetters: 'V I T Y G R A',
    questionText: 'Unscramble the 7-letter word (Hint: Force that keeps planets in orbit): V I T Y G R A',
    options: ['CAVITY', 'CLARITY', 'GRAVITY', 'VARIETY'],
    correctOption: 2,
    acceptedAnswers: ['GRAVITY'],
    explanation: 'V-I-T-Y-G-R-A unscrambles to GRAVITY.',
  },
  {
    id: 'ws_m3',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Computers',
    difficulty: 'medium',
    scrambledLetters: 'W O R K N E T',
    questionText: 'Unscramble the 7-letter word (Hint: Connected computers sharing data): W O R K N E T',
    options: ['NETWORK', 'WORKOUT', 'KEYNOTE', 'BROWSER'],
    correctOption: 0,
    acceptedAnswers: ['NETWORK'],
    explanation: 'W-O-R-K-N-E-T unscrambles to NETWORK.',
  },
  {
    id: 'ws_m4',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Geography',
    difficulty: 'medium',
    scrambledLetters: 'C A N O V O L',
    questionText: 'Unscramble the 7-letter word (Hint: Mountain that erupts with lava): C A N O V O L',
    options: ['TORNADO', 'CYCLONE', 'GLACIER', 'VOLCANO'],
    correctOption: 3,
    acceptedAnswers: ['VOLCANO'],
    explanation: 'C-A-N-O-V-O-L unscrambles to VOLCANO.',
  },
  {
    id: 'ws_m5',
    gameId: 'word_scramble',
    category: 'science',
    subcategory: 'Weather',
    difficulty: 'medium',
    scrambledLetters: 'D E R T H U N',
    questionText: 'Unscramble the 7-letter word (Hint: Booming sound after lightning): D E R T H U N',
    options: ['HUNDRED', 'THUNDER', 'TORNADO', 'MONSOON'],
    correctOption: 1,
    acceptedAnswers: ['THUNDER'],
    explanation: 'D-E-R-T-H-U-N unscrambles to THUNDER.',
  },
  {
    id: 'ws_h1',
    gameId: 'word_scramble',
    category: 'science',
    subcategory: 'Computers',
    difficulty: 'hard',
    scrambledLetters: 'G O R I T H M A L',
    questionText: 'Unscramble the 9-letter word (Hint: Step-by-step coding procedure): G O R I T H M A L',
    options: ['ALGORITHM', 'HARMONICS', 'PROCESSOR', 'BANDWIDTH'],
    correctOption: 0,
    acceptedAnswers: ['ALGORITHM', 'LOGARITHM'],
    explanation: 'G-O-R-I-T-H-M-A-L unscrambles to ALGORITHM.',
  },
  {
    id: 'ws_h2',
    gameId: 'word_scramble',
    category: 'science',
    subcategory: 'Space',
    difficulty: 'hard',
    scrambledLetters: 'C O P E S T E L E',
    questionText: 'Unscramble the 9-letter word (Hint: Instrument used to observe distant galaxies): C O P E S T E L E',
    options: ['PERISCOPE', 'GYROSCOPE', 'TELESCOPE', 'SATELLITE'],
    correctOption: 2,
    acceptedAnswers: ['TELESCOPE'],
    explanation: 'C-O-P-E-S-T-E-L-E unscrambles to TELESCOPE.',
  },
  {
    id: 'ws_h3',
    gameId: 'word_scramble',
    category: 'gk',
    subcategory: 'Adventure',
    difficulty: 'hard',
    scrambledLetters: 'Y R I N T H L A B',
    questionText: 'Unscramble the 9-letter word (Hint: An intricate maze of passages): Y R I N T H L A B',
    options: ['SANCTUARY', 'LABYRINTH', 'PYRAMIDAL', 'CATACOMBS'],
    correctOption: 1,
    acceptedAnswers: ['LABYRINTH'],
    explanation: 'Y-R-I-N-T-H-L-A-B unscrambles to LABYRINTH.',
  },

  // ===========================================================================
  // GAME 5: EMOJI DECODE (Original Emoji Clues)
  // ===========================================================================
  {
    id: 'emo_e1',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Objects & Nature',
    difficulty: 'easy',
    emojiClue: '🌧️ + 🎀',
    questionText: 'Decode the emoji clue: 🌧️ + 🎀',
    options: ['Rainbow', 'Raincoat', 'Thunderstorm', 'Waterfall'],
    correctOption: 0,
    acceptedAnswers: ['RAINBOW'],
    explanation: 'Rain (🌧️) + Bow (🎀) = Rainbow!',
  },
  {
    id: 'emo_e2',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Objects & Food',
    difficulty: 'easy',
    emojiClue: '🍳 + 🎂',
    questionText: 'Decode this breakfast favorite: 🍳 + 🎂',
    options: ['Cupcake', 'Pancake', 'Waffle', 'Cheesecake'],
    correctOption: 1,
    acceptedAnswers: ['PANCAKE', 'PANCAKES'],
    explanation: 'Pan (🍳) + Cake (🎂) = Pancake!',
  },
  {
    id: 'emo_e3',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Ocean & Nature',
    difficulty: 'easy',
    emojiClue: '⭐ + 🐟',
    questionText: 'Decode the sea creature: ⭐ + 🐟',
    options: ['Jellyfish', 'Swordfish', 'Starfish', 'Clownfish'],
    correctOption: 2,
    acceptedAnswers: ['STARFISH'],
    explanation: 'Star (⭐) + Fish (🐟) = Starfish!',
  },
  {
    id: 'emo_e4',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Sports & Games',
    difficulty: 'easy',
    emojiClue: '🧺 + 🏀',
    questionText: 'Decode the sport: 🧺 + 🏀',
    options: ['Volleyball', 'Baseball', 'Handball', 'Basketball'],
    correctOption: 3,
    acceptedAnswers: ['BASKETBALL'],
    explanation: 'Basket (🧺) + Ball (🏀) = Basketball!',
  },
  {
    id: 'emo_e5',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Everyday Objects',
    difficulty: 'easy',
    emojiClue: '☀️ + 🕶️',
    questionText: 'Decode the summer accessory: ☀️ + 🕶️',
    options: ['Sunglasses', 'Sunscreen', 'Telescope', 'Binoculars'],
    correctOption: 0,
    acceptedAnswers: ['SUNGLASSES'],
    explanation: 'Sun (☀️) + Glasses (🕶️) = Sunglasses!',
  },
  {
    id: 'emo_e6',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Objects & Food',
    difficulty: 'easy',
    emojiClue: '🧈 + 🪰',
    questionText: 'Decode the winged insect: 🧈 + 🪰',
    options: ['Dragonfly', 'Butterfly', 'Firefly', 'Honeybee'],
    correctOption: 1,
    acceptedAnswers: ['BUTTERFLY'],
    explanation: 'Butter (🧈) + Fly (🪰) = Butterfly!',
  },
  {
    id: 'emo_m1',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Common Phrases',
    difficulty: 'medium',
    emojiClue: '🧊 + 🔨 + 💬',
    questionText: 'Decode the common expression: 🧊 + 🔨 + 💬',
    options: ['Cold shoulder', 'Break the ice', 'Freeze frame', 'On thin ice'],
    correctOption: 1,
    acceptedAnswers: ['BREAK THE ICE'],
    explanation: '🧊 + 🔨 represents the idiom "Break the ice".',
  },
  {
    id: 'emo_m2',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Common Phrases',
    difficulty: 'medium',
    emojiClue: '🍰 + 👌',
    questionText: 'Decode the idiom meaning "something very easy": 🍰 + 👌',
    options: ['Sweet tooth', 'Bake sale', 'Piece of cake', 'Icing on the cake'],
    correctOption: 2,
    acceptedAnswers: ['PIECE OF CAKE'],
    explanation: '"Piece of cake" means a task that is very easy to accomplish.',
  },
  {
    id: 'emo_m3',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Places & Landmarks',
    difficulty: 'medium',
    emojiClue: '🗽 + 🍎 + 🚕',
    questionText: 'Which famous world city do these emojis represent: 🗽 + 🍎 + 🚕?',
    options: ['New York City', 'London', 'Paris', 'Tokyo'],
    correctOption: 0,
    acceptedAnswers: ['NEW YORK', 'NEW YORK CITY', 'NYC'],
    explanation: 'Statue of Liberty (🗽), The Big Apple (🍎), and Yellow Cabs (🚕) represent New York City.',
  },
  {
    id: 'emo_m4',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Entertainment',
    difficulty: 'medium',
    emojiClue: '🦁 + 👑',
    questionText: 'Decode the classic animated story: 🦁 + 👑',
    options: ['Jungle Book', 'Madagascar', 'Finding Nemo', 'The Lion King'],
    correctOption: 3,
    acceptedAnswers: ['THE LION KING', 'LION KING'],
    explanation: 'Lion (🦁) + King’s Crown (👑) = The Lion King.',
  },
  {
    id: 'emo_m5',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Places & Landmarks',
    difficulty: 'medium',
    emojiClue: '🗼 + 🥐 + 🎨',
    questionText: 'Which famous capital city do these emojis represent: 🗼 + 🥐 + 🎨?',
    options: ['Rome', 'Paris', 'Vienna', 'Madrid'],
    correctOption: 1,
    acceptedAnswers: ['PARIS'],
    explanation: 'Eiffel Tower (🗼), Croissant (🥐), and Art (🎨) represent Paris!',
  },
  {
    id: 'emo_h1',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Familiar Expressions',
    difficulty: 'hard',
    emojiClue: '⏰ + ✈️',
    questionText: 'Decode the famous proverb: ⏰ + ✈️',
    options: ['Jet lag', 'Time flies', 'Early bird', 'Flight schedule'],
    correctOption: 1,
    acceptedAnswers: ['TIME FLIES'],
    explanation: 'Clock/Time (⏰) + Flying plane (✈️) = "Time flies".',
  },
  {
    id: 'emo_h2',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Familiar Expressions',
    difficulty: 'hard',
    emojiClue: '🌧️ + 🐱 + 🐶',
    questionText: 'Decode the weather idiom: 🌧️ + 🐱 + 🐶',
    options: [
      'Raining cats and dogs',
      'Pet shelter storm',
      'Every dog has its day',
      'Curiosity killed the cat',
    ],
    correctOption: 0,
    acceptedAnswers: ['RAINING CATS AND DOGS'],
    explanation: '"Raining cats and dogs" is a classic idiom for heavy rain.',
  },
  {
    id: 'emo_h3',
    gameId: 'emoji_decode',
    category: 'gk',
    subcategory: 'Familiar Expressions',
    difficulty: 'hard',
    emojiClue: '🫘 + 🫗 + 🗣️',
    questionText: 'Decode the idiom meaning "to reveal a secret": 🫘 + 🫗 + 🗣️',
    options: [
      'Full of beans',
      'Cool beans',
      'Spill the beans',
      'Count the beans',
    ],
    correctOption: 2,
    acceptedAnswers: ['SPILL THE BEANS'],
    explanation: '"Spill the beans" means to reveal secret information prematurely.',
  },

  // ===========================================================================
  // GAME 7: IQ RELAY CHALLENGE (7 Selectable Cognitive Fields)
  // ===========================================================================
  {
    id: 'iqr_num_e1',
    gameId: 'iq_relay',
    iqField: 'Numerical Reasoning',
    category: 'math',
    subcategory: 'Numerical Reasoning',
    difficulty: 'easy',
    questionText: 'Which number completes the ratio: 4 is to 12 as 7 is to ___?',
    options: ['14', '21', '24', '28'],
    correctOption: 1,
    explanation: '4 × 3 = 12, so 7 × 3 = 21.',
  },
  {
    id: 'iqr_num_m1',
    gameId: 'iq_relay',
    iqField: 'Numerical Reasoning',
    category: 'math',
    subcategory: 'Numerical Reasoning',
    difficulty: 'medium',
    questionText: 'A train travels 90 km in 1.5 hours. At the same constant speed, how far will it travel in 4 hours?',
    options: ['180 km', '210 km', '240 km', '270 km'],
    correctOption: 2,
    explanation: '90 km ÷ 1.5 hr = 60 km/h. In 4 hours: 60 × 4 = 240 km.',
  },
  {
    id: 'iqr_num_h1',
    gameId: 'iq_relay',
    iqField: 'Numerical Reasoning',
    category: 'math',
    subcategory: 'Numerical Reasoning',
    difficulty: 'hard',
    questionText: 'If 5 machines take 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?',
    options: ['5 minutes', '20 minutes', '50 minutes', '100 minutes'],
    correctOption: 0,
    explanation: 'Each machine makes 1 widget in 5 minutes, so 100 machines working simultaneously make 100 widgets in 5 minutes.',
  },
  {
    id: 'iqr_log_e1',
    gameId: 'iq_relay',
    iqField: 'Logical Reasoning',
    category: 'gk',
    subcategory: 'Logical Reasoning',
    difficulty: 'easy',
    questionText: 'All sprinters are athletes. Some athletes drink electrolytes. Which statement MUST be true?',
    options: [
      'Every athlete is a sprinter',
      'Every sprinter is an athlete',
      'No sprinters drink electrolytes',
      'All electrolyte drinkers are sprinters',
    ],
    correctOption: 1,
    explanation: 'Since all sprinters belong to the set of athletes, every sprinter is definitely an athlete.',
  },
  {
    id: 'iqr_log_m1',
    gameId: 'iq_relay',
    iqField: 'Logical Reasoning',
    category: 'gk',
    subcategory: 'Logical Reasoning',
    difficulty: 'medium',
    questionText: 'Asha is taller than Dev. Dev is taller than Kabir. Meera is shorter than Kabir. Who is the tallest?',
    options: ['Asha', 'Dev', 'Kabir', 'Meera'],
    correctOption: 0,
    explanation: 'Order from tallest to shortest: Asha > Dev > Kabir > Meera.',
  },
  {
    id: 'iqr_log_h1',
    gameId: 'iq_relay',
    iqField: 'Logical Reasoning',
    category: 'gk',
    subcategory: 'Logical Reasoning',
    difficulty: 'hard',
    questionText: 'If the day before yesterday was Tuesday, what day of the week will it be tomorrow?',
    options: ['Thursday', 'Friday', 'Saturday', 'Sunday'],
    correctOption: 1,
    explanation: 'If the day before yesterday was Tuesday, yesterday was Wednesday, today is Thursday, and tomorrow is Friday.',
  },
  {
    id: 'iqr_pat_e1',
    gameId: 'iq_relay',
    iqField: 'Pattern Recognition',
    category: 'math',
    subcategory: 'Pattern Recognition',
    difficulty: 'easy',
    questionText: 'What comes next in the alternating pattern: A1, B2, C3, D4, ___?',
    options: ['E5', 'E4', 'F5', 'D5'],
    correctOption: 0,
    explanation: 'Both the letter and the digit advance by 1 each step: E5.',
  },
  {
    id: 'iqr_pat_m1',
    gameId: 'iq_relay',
    iqField: 'Pattern Recognition',
    category: 'math',
    subcategory: 'Pattern Recognition',
    difficulty: 'medium',
    questionText: 'Identify the next term in the pattern: 3, 6, 11, 18, 27, ___',
    options: ['36', '38', '39', '42'],
    correctOption: 1,
    explanation: 'The differences increase by odd numbers (+3, +5, +7, +9, +11): 27 + 11 = 38.',
  },
  {
    id: 'iqr_pat_h1',
    gameId: 'iq_relay',
    iqField: 'Pattern Recognition',
    category: 'math',
    subcategory: 'Pattern Recognition',
    difficulty: 'hard',
    questionText: 'Find the missing number in the geometric-plus-one pattern: 1, 3, 7, 15, 31, ___',
    options: ['47', '59', '62', '63'],
    correctOption: 3,
    explanation: 'Each term is double the previous term plus 1: (31 × 2) + 1 = 63.',
  },
  {
    id: 'iqr_ver_e1',
    gameId: 'iq_relay',
    iqField: 'Verbal Reasoning',
    category: 'gk',
    subcategory: 'Verbal Reasoning',
    difficulty: 'easy',
    questionText: 'BOOK is to READING as FORK is to ___?',
    options: ['DRAWING', 'EATING', 'WRITING', 'SLEEPING'],
    correctOption: 1,
    explanation: 'A book is an object used for reading; a fork is an object used for eating.',
  },
  {
    id: 'iqr_ver_m1',
    gameId: 'iq_relay',
    iqField: 'Verbal Reasoning',
    category: 'gk',
    subcategory: 'Verbal Reasoning',
    difficulty: 'medium',
    questionText: 'Which word is the odd one out: SWIFT, RAPID, BRISK, SLUGGISH?',
    options: ['SWIFT', 'RAPID', 'BRISK', 'SLUGGISH'],
    correctOption: 3,
    explanation: 'Swift, Rapid, and Brisk all mean fast; Sluggish is an antonym meaning slow.',
  },
  {
    id: 'iqr_ver_h1',
    gameId: 'iq_relay',
    iqField: 'Verbal Reasoning',
    category: 'gk',
    subcategory: 'Verbal Reasoning',
    difficulty: 'hard',
    questionText: 'OASIS is to DESERT as ISLAND is to ___?',
    options: ['MOUNTAIN', 'OCEAN', 'FOREST', 'PENINSULA'],
    correctOption: 1,
    explanation: 'An oasis is an isolated patch of water surrounded by desert; an island is land surrounded by ocean.',
  },
  {
    id: 'iqr_mem_e1',
    gameId: 'iq_relay',
    iqField: 'Memory Challenge',
    category: 'gk',
    subcategory: 'Memory Challenge',
    difficulty: 'easy',
    memoryTarget: '🔵 🟢 🔴 🟡',
    questionText: 'Sequence Recall: In the pattern [Blue, Green, Red, Yellow], which color is 3rd from the left?',
    options: ['Blue', 'Green', 'Red', 'Yellow'],
    correctOption: 2,
    explanation: 'In [Blue, Green, Red, Yellow], the 3rd item is Red.',
  },
  {
    id: 'iqr_mem_m1',
    gameId: 'iq_relay',
    iqField: 'Memory Challenge',
    category: 'gk',
    subcategory: 'Memory Challenge',
    difficulty: 'medium',
    memoryTarget: '7 - 4 - 9 - 2 - 6',
    questionText: 'Working Memory: If you reverse the sequence [7, 4, 9, 2, 6], what is the 2nd number?',
    options: ['4', '2', '9', '6'],
    correctOption: 1,
    explanation: 'Reversed, the sequence is [6, 2, 9, 4, 7], so the 2nd number is 2.',
  },
  {
    id: 'iqr_mem_h1',
    gameId: 'iq_relay',
    iqField: 'Memory Challenge',
    category: 'gk',
    subcategory: 'Memory Challenge',
    difficulty: 'hard',
    memoryTarget: 'K - 8 - M - 3 - P - 9',
    questionText: 'Working Memory: In the code [K - 8 - M - 3 - P - 9], what is the sum of all the digits?',
    options: ['17', '19', '20', '21'],
    correctOption: 2,
    explanation: 'The digits in the code are 8, 3, and 9: 8 + 3 + 9 = 20.',
  },
  {
    id: 'iqr_spa_e1',
    gameId: 'iq_relay',
    iqField: 'Spatial Reasoning',
    category: 'math',
    subcategory: 'Spatial Reasoning',
    difficulty: 'easy',
    questionText: 'How many faces does a standard 3D cube have?',
    options: ['4 faces', '6 faces', '8 faces', '12 faces'],
    correctOption: 1,
    explanation: 'A cube has 6 square faces (top, bottom, front, back, left, right).',
  },
  {
    id: 'iqr_spa_m1',
    gameId: 'iq_relay',
    iqField: 'Spatial Reasoning',
    category: 'math',
    subcategory: 'Spatial Reasoning',
    difficulty: 'medium',
    questionText: 'You are facing North. You turn 90° clockwise, then 180° counterclockwise. Which direction are you facing now?',
    options: ['North', 'East', 'South', 'West'],
    correctOption: 3,
    explanation: 'North + 90° clockwise = East. Turning 180° from East points you due West.',
  },
  {
    id: 'iqr_spa_h1',
    gameId: 'iq_relay',
    iqField: 'Spatial Reasoning',
    category: 'math',
    subcategory: 'Spatial Reasoning',
    difficulty: 'hard',
    questionText: 'A 3×3×3 wooden cube is painted blue on the outside and cut into 27 small 1×1×1 cubes. How many small cubes have ZERO blue paint?',
    options: ['0 cubes', '1 cube', '3 cubes', '6 cubes'],
    correctOption: 1,
    explanation: 'Only the single center cube inside the 3×3×3 block has zero exterior faces.',
  },
  {
    id: 'iqr_qm_e1',
    gameId: 'iq_relay',
    iqField: 'Quick Maths',
    category: 'math',
    subcategory: 'Quick Maths',
    difficulty: 'easy',
    questionText: 'Quick Maths: What is (9 × 4) − 6?',
    options: ['28', '30', '32', '36'],
    correctOption: 1,
    explanation: '9 × 4 = 36, and 36 − 6 = 30.',
  },
  {
    id: 'iqr_qm_m1',
    gameId: 'iq_relay',
    iqField: 'Quick Maths',
    category: 'math',
    subcategory: 'Quick Maths',
    difficulty: 'medium',
    questionText: 'Quick Maths: What is 25% of 160?',
    options: ['30', '35', '40', '45'],
    correctOption: 2,
    explanation: '25% is one-fourth: 160 ÷ 4 = 40.',
  },
  {
    id: 'iqr_qm_h1',
    gameId: 'iq_relay',
    iqField: 'Quick Maths',
    category: 'math',
    subcategory: 'Quick Maths',
    difficulty: 'hard',
    questionText: 'Quick Maths: What is (15 × 12) ÷ 6 + 18?',
    options: ['42', '46', '48', '54'],
    correctOption: 2,
    explanation: '15 × 12 = 180; 180 ÷ 6 = 30; 30 + 18 = 48.',
  },
];

export const TROJO_GAME_QUESTIONS: QuestionItem[] = RAW_TROJO_QUESTIONS.map((q) => ({
  id: q.id,
  gameId: q.gameId,
  category: q.category,
  subcategory: q.subcategory,
  difficulty: q.difficulty,
  questionText: q.questionText,
  options: q.options,
  answerHash: computeAnswerHash(q.id, q.correctOption),
  sourceUrl: '',
  publishedAt: '2025-01-01',
  verifiedAt: '2025-01-15',
  expiresAt: '2029-12-31',
  isActive: true,
  correctOption: q.correctOption,
  explanation: q.explanation,
  acceptedAnswers: q.acceptedAnswers,
  scrambledLetters: q.scrambledLetters,
  emojiClue: q.emojiClue,
  memoryTarget: q.memoryTarget,
  iqField: q.iqField,
}));

export function findTrojoQuestionById(id: string): QuestionItem | null {
  const found = TROJO_GAME_QUESTIONS.find((q) => q.id === id);
  return found || null;
}

/**
 * Selects a verified, non-repeating sequence of questions for any of the 7 TROJO games.
 */
export function selectTrojoGameQuestions(
  gameId: TrojoGameId,
  pool: QuestionItem[],
  category: QuestionCategory,
  difficulty: QuestionDifficulty,
  count: number = 10,
  subcategories: string[] = [],
  iqFields: IqRelayField[] = [],
  seenIds: Set<string> = new Set()
): QuestionItem[] {
  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  if (gameId === 'iq_relay') {
    const activeFields =
      iqFields.length >= 2 ? iqFields : IQ_RELAY_ALL_FIELDS.slice(0, 4);
    const iqPool = TROJO_GAME_QUESTIONS.filter((q) => q.gameId === 'iq_relay');
    const generalPool = [...pool, ...SEED_QUESTIONS];
    const result: QuestionItem[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < count; i++) {
      const field = activeFields[i % activeFields.length];
      const fieldMatches = shuffle(
        iqPool.filter(
          (q) =>
            q.iqField === field &&
            !usedIds.has(q.id) &&
            !seenIds.has(q.id)
        )
      );
      const fallbackFieldMatches = shuffle(
        iqPool.filter((q) => q.iqField === field && !usedIds.has(q.id))
      );
      const picked = fieldMatches[0] || fallbackFieldMatches[0];
      if (picked) {
        usedIds.add(picked.id);
        result.push({ ...picked, iqField: field, subcategory: field });
      } else {
        // Supplement from math/science/gk pool tagged with the relay field
        const fallback = shuffle(
          generalPool.filter(
            (q) =>
              !usedIds.has(q.id) &&
              (field === 'Quick Maths' || field === 'Numerical Reasoning'
                ? q.category === 'math'
                : q.category !== 'current_affairs')
          )
        )[0];
        if (fallback) {
          usedIds.add(fallback.id);
          result.push({
            ...fallback,
            gameId: 'iq_relay',
            iqField: field,
            subcategory: field,
          });
        }
      }
    }
    return result;
  }

  if (
    gameId === 'cheat_your_friend' ||
    gameId === 'solve_the_puzzle' ||
    gameId === 'word_scramble' ||
    gameId === 'emoji_decode'
  ) {
    const dbGameSpecific = pool.filter((q) => q.gameId === gameId);
    const gameSpecific = [
      ...dbGameSpecific,
      ...TROJO_GAME_QUESTIONS.filter(
        (q) => q.gameId === gameId && !dbGameSpecific.some((d) => d.id === q.id)
      ),
    ];
    const diffFiltered = gameSpecific.filter((q) => q.difficulty === difficulty);
    const unseenDiff = shuffle(diffFiltered.filter((q) => !seenIds.has(q.id)));
    const unseenAll = shuffle(gameSpecific.filter((q) => !seenIds.has(q.id)));
    const allGame = shuffle(gameSpecific);

    const chosen: QuestionItem[] = [];
    const used = new Set<string>();

    for (const candidate of [...unseenDiff, ...unseenAll, ...allGame]) {
      if (chosen.length >= count) break;
      if (!used.has(candidate.id)) {
        used.add(candidate.id);
        chosen.push(candidate);
      }
    }

    // If user requested 15 or 20 questions, supplement with unique trivia/puzzle questions from pool
    if (chosen.length < count) {
      const supplementPool = shuffle(
        [...pool, ...SEED_QUESTIONS].filter(
          (q) =>
            !used.has(q.id) &&
            (gameId === 'solve_the_puzzle'
              ? q.category === 'math' || q.category === 'science'
              : q.category === 'gk' || q.category === 'science')
        )
      );
      for (const item of supplementPool) {
        if (chosen.length >= count) break;
        used.add(item.id);
        chosen.push({ ...item, gameId });
      }
    }

    return chosen.slice(0, count);
  }

  // For quick_quiz or calculation_racer, delegate to main pool
  const combined = [...pool, ...SEED_QUESTIONS].filter(
    (q) =>
      (gameId === 'quick_quiz' ? true : q.category === category) &&
      q.difficulty === difficulty &&
      (subcategories.length === 0 ||
        (q.subcategory && subcategories.includes(q.subcategory)))
  );
  const unseen = shuffle(combined.filter((q) => !seenIds.has(q.id)));
  const seen = shuffle(combined.filter((q) => seenIds.has(q.id)));
  const fallbackAll = shuffle([...pool, ...SEED_QUESTIONS]);

  const result: QuestionItem[] = [];
  const used = new Set<string>();
  for (const q of [...unseen, ...seen, ...fallbackAll]) {
    if (result.length >= count) break;
    if (!used.has(q.id)) {
      used.add(q.id);
      result.push({ ...q, gameId });
    }
  }
  return result;
}
