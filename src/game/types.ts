export type QuestionCategory = 'math' | 'gk' | 'science' | 'current_affairs';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type CarColor = 'blue' | 'red' | 'green' | 'purple';
export type RoomCapacityOption = 2 | 3 | 4 | 8;
export type GameMode = 'solo' | '2p' | '3p' | '4p' | '8p' | 'timed';
export type RoomStatus = 'waiting' | 'countdown' | 'racing' | 'finished' | 'abandoned';
export type QuestionCountOption = 5 | 6 | 8 | 10 | 12 | 15 | 20;
export type QuestionTimeOption = 10 | 15 | 20 | 30;

export type TrojoGameId =
  | 'calculation_racer'
  | 'circular_racer'
  | 'water_sort'
  | 'word_finder'
  | 'game_2048'
  | 'mahjong_solitaire'
  | 'ludo'
  // Legacy IDs kept for backward compatibility with older saved records
  | 'cheat_your_friend'
  | 'solve_the_puzzle'
  | 'word_scramble'
  | 'emoji_decode'
  | 'quick_quiz'
  | 'iq_relay';

export type IqRelayField =
  | 'Numerical Reasoning'
  | 'Logical Reasoning'
  | 'Pattern Recognition'
  | 'Verbal Reasoning'
  | 'Memory Challenge'
  | 'Spatial Reasoning'
  | 'Quick Maths';

export const IQ_RELAY_ALL_FIELDS: IqRelayField[] = [
  'Numerical Reasoning',
  'Logical Reasoning',
  'Pattern Recognition',
  'Verbal Reasoning',
  'Memory Challenge',
  'Spatial Reasoning',
  'Quick Maths',
];

export interface TrojoGameCatalogItem {
  id: TrojoGameId;
  name: string;
  tagline: string;
  shortDescription: string;
  emoji: string;
  accentColor: 'blue' | 'green' | 'purple' | 'orange';
  badgeText: string;
  supportsSolo: boolean;
  supportsMultiplayer: boolean;
  isInteractivePuzzle: boolean;
  totalLevels: number;
  defaultQuestionCount: QuestionCountOption;
  defaultTimeLimitSec: QuestionTimeOption;
}

export const TROJO_GAMES: TrojoGameCatalogItem[] = [
  {
    id: 'calculation_racer',
    name: 'Calculation Racer',
    tagline: 'Race with your brain to the 100m finish line!',
    shortDescription:
      'Solve fast Math, GK, Science & Current Affairs questions to boost your race car +10m forward.',
    emoji: '🏎️',
    accentColor: 'blue',
    badgeText: '100m Brain Race',
    supportsSolo: true,
    supportsMultiplayer: true,
    isInteractivePuzzle: false,
    totalLevels: 20,
    defaultQuestionCount: 10,
    defaultTimeLimitSec: 20,
  },
  {
    id: 'circular_racer',
    name: 'Circular Racer',
    tagline: 'Steer, drift & speed across 2D circular circuits!',
    shortDescription:
      'Control your race car with steering and acceleration across 20 circular and curved tracks with AI opponents and drift physics.',
    emoji: '🏁',
    accentColor: 'blue',
    badgeText: '2D Circuit Racing · 20 Tracks',
    supportsSolo: true,
    supportsMultiplayer: true,
    isInteractivePuzzle: true,
    totalLevels: 20,
    defaultQuestionCount: 10,
    defaultTimeLimitSec: 20,
  },
  {
    id: 'water_sort',
    name: 'Water Sort',
    tagline: 'Pour & sort colorful liquids into matching test tubes!',
    shortDescription:
      'Tap glass test tubes to pour matching top liquid layers until every tube holds a single pure color across 20 levels.',
    emoji: '🧪',
    accentColor: 'purple',
    badgeText: 'Liquid Puzzle · 20 Levels',
    supportsSolo: true,
    supportsMultiplayer: true,
    isInteractivePuzzle: true,
    totalLevels: 20,
    defaultQuestionCount: 10,
    defaultTimeLimitSec: 20,
  },
  {
    id: 'word_finder',
    name: 'Word Finder',
    tagline: 'Connect letters on the wheel to fill the crossword grid!',
    shortDescription:
      'Tap & link letters on the golden wheel to discover intersecting crossword words and bonus words across 20 levels.',
    emoji: '🔤',
    accentColor: 'purple',
    badgeText: 'Crossword Wheel · 20 Levels',
    supportsSolo: true,
    supportsMultiplayer: true,
    isInteractivePuzzle: true,
    totalLevels: 20,
    defaultQuestionCount: 10,
    defaultTimeLimitSec: 20,
  },
  {
    id: 'game_2048',
    name: '2048 / 2028',
    tagline: 'Slide & merge number tiles to reach the target tile!',
    shortDescription:
      'Swipe or use arrow keys to slide and merge matching power-of-two tiles across 20 progressive level goals.',
    emoji: '🟨',
    accentColor: 'orange',
    badgeText: 'Number Merge · 20 Levels',
    supportsSolo: true,
    supportsMultiplayer: true,
    isInteractivePuzzle: true,
    totalLevels: 20,
    defaultQuestionCount: 10,
    defaultTimeLimitSec: 20,
  },
  {
    id: 'mahjong_solitaire',
    name: 'Mahjong Solitaire',
    tagline: 'Match open 3D Mahjong tiles to clear the layered board!',
    shortDescription:
      'Pair matching free Dragon, Wind, Bamboo & Circle Mahjong tiles with combo multipliers across 20 classic board layouts.',
    emoji: '🀄',
    accentColor: 'green',
    badgeText: 'Tile Match · 20 Levels',
    supportsSolo: true,
    supportsMultiplayer: true,
    isInteractivePuzzle: true,
    totalLevels: 20,
    defaultQuestionCount: 10,
    defaultTimeLimitSec: 20,
  },
  {
    id: 'ludo',
    name: 'Ludo Master',
    tagline: 'Roll the dice, race your tokens home & conquer the board!',
    shortDescription:
      'Classic board game for solo vs AI bots or 2 to 6 players (solo, duo, trio, squad, five, six) with full-screen dynamic board and dice sound effects.',
    emoji: '🎲',
    accentColor: 'orange',
    badgeText: 'Board Game · 2-6 Players',
    supportsSolo: true,
    supportsMultiplayer: true,
    isInteractivePuzzle: true,
    totalLevels: 1,
    defaultQuestionCount: 10,
    defaultTimeLimitSec: 20,
  },
];

export const TROJO_GAME_MAP: Record<TrojoGameId, TrojoGameCatalogItem> = {
  calculation_racer: TROJO_GAMES[0],
  circular_racer: TROJO_GAMES[1],
  water_sort: TROJO_GAMES[2],
  word_finder: TROJO_GAMES[3],
  game_2048: TROJO_GAMES[4],
  mahjong_solitaire: TROJO_GAMES[5],
  ludo: TROJO_GAMES[6],
  // Fallback mappings for legacy records
  cheat_your_friend: TROJO_GAMES[2],
  solve_the_puzzle: TROJO_GAMES[4],
  word_scramble: TROJO_GAMES[3],
  emoji_decode: TROJO_GAMES[5],
  quick_quiz: TROJO_GAMES[0],
  iq_relay: TROJO_GAMES[4],
};

export function isInteractivePuzzleGame(gameId?: TrojoGameId): boolean {
  return (
    gameId === 'circular_racer' ||
    gameId === 'water_sort' ||
    gameId === 'word_finder' ||
    gameId === 'game_2048' ||
    gameId === 'mahjong_solitaire' ||
    gameId === 'ludo'
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface PlayerProfile {
  uid: string;
  nickname: string;
  carColor: CarColor;
  avatarUrl?: string;
  wins: number;
  totalRaces: number;
  bestTimeMs: number;
  bestScore?: number;
  totalCorrect: number;
  totalWrong: number;
  isPublicProfile: boolean;
  isBanned: boolean;
  banReason: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface QuestionItem {
  id: string;
  gameId?: TrojoGameId;
  category: QuestionCategory;
  subcategory?: string;
  difficulty: QuestionDifficulty;
  questionText: string;
  options: [string, string, string, string];
  answerHash: string;
  sourceUrl: string;
  publishedAt: string;
  verifiedAt: string;
  expiresAt?: string;
  isActive: boolean;
  correctOption?: number;
  explanation?: string;
  acceptedAnswers?: string[];
  scrambledLetters?: string;
  emojiClue?: string;
  memoryTarget?: string;
  iqField?: IqRelayField;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface QuestionKeyItem {
  questionId: string;
  correctOption: number;
  explanation: string;
  updatedAt?: unknown;
}

export interface QuestionHistoryRecord {
  id: string;
  playerId: string;
  questionId: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  lastShownAtMs: number;
  timesShown: number;
  updatedAt?: unknown;
}

export interface AdminBootstrapLockRecord {
  id: 'admin_bootstrap';
  ownerUid: string;
  bootstrapped: boolean;
  createdAt?: unknown;
}

export interface RoomRecord {
  roomCode: string;
  hostId: string;
  hostNickname: string;
  maxPlayers: RoomCapacityOption;
  gameId?: TrojoGameId;
  iqFields?: IqRelayField[];
  category: QuestionCategory;
  subcategories?: string[];
  difficulty: QuestionDifficulty;
  questionCount?: QuestionCountOption;
  questionTimeLimitSec: number;
  status: RoomStatus;
  questionIds: string[];
  playerCount: number;
  countdownStartedAtMs: number;
  raceStartedAtMs: number;
  raceFinishedAtMs: number;
  winnerId: string;
  winnerNickname: string;
  isPublic: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoomPlayerRecord {
  roomCode: string;
  playerId: string;
  nickname: string;
  carColor: CarColor;
  ready: boolean;
  distance: number;
  score?: number;
  bluffText?: string;
  votedOption?: number;
  correctAnswers: number;
  wrongAnswers: number;
  currentQuestionIndex: number;
  finished: boolean;
  finishTimeMs: number;
  placement: number;
  connected: boolean;
  lastSeenAtMs: number;
  joinedAt?: unknown;
  updatedAt?: unknown;
}

export interface AnswerSubmissionRecord {
  roomCode: string;
  playerId: string;
  questionId: string;
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  distanceDelta: number;
  timeTakenMs: number;
  createdAt?: unknown;
}

export interface IqFieldPerformance {
  field: IqRelayField;
  correct: number;
  total: number;
  avgTimeMs: number;
}

export interface RaceResultRecord {
  id?: string;
  roomCode: string;
  playerId: string;
  nickname: string;
  carColor: CarColor;
  mode: GameMode;
  gameId?: TrojoGameId;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  placement: number;
  score?: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
  distance: number;
  durationMs: number;
  isPublic: boolean;
  completedAtMs: number;
  createdAt?: unknown;
}

export interface QuestionReportRecord {
  id: string;
  questionId: string;
  questionText: string;
  reporterId: string;
  reporterNickname: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminAuditLogRecord {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: 'question' | 'player' | 'room' | 'leaderboard' | 'report' | 'system';
  targetId: string;
  details: string;
  createdAt?: unknown;
}

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  math: 'Mathematics',
  gk: 'General Knowledge',
  science: 'Science',
  current_affairs: 'Current Affairs',
};

export const CATEGORY_DESCRIPTIONS: Record<QuestionCategory, string> = {
  math: 'Fast mental calculations, arithmetic operations, percentages, powers, and number puzzles.',
  gk: 'World geography, historical milestones, sports championships, computers, and everyday trivia.',
  science: 'Physics laws, chemical elements, human biology, and space exploration facts.',
  current_affairs: 'Verified global events, science breakthroughs, sports achievements, and world news.',
};

export const SUBCATEGORIES_BY_CATEGORY: Record<QuestionCategory, string[]> = {
  math: ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Mixed Operations'],
  gk: ['Geography', 'History', 'Sports', 'Computers', 'General Facts'],
  science: ['Physics', 'Chemistry', 'Biology', 'Space'],
  current_affairs: ['India', 'World', 'Science and Technology', 'Sports'],
};

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const CAR_PALETTE: Record<
  CarColor,
  {
    label: string;
    primary: string;
    secondary: string;
    glow: string;
    textClass: string;
    bgSoftClass: string;
    borderClass: string;
  }
> = {
  blue: {
    label: 'Electric Blue',
    primary: '#0284C7',
    secondary: '#38BDF8',
    glow: 'rgba(2, 132, 199, 0.28)',
    textClass: 'text-sky-600',
    bgSoftClass: 'bg-sky-50',
    borderClass: 'border-sky-300',
  },
  red: {
    label: 'Coral Pink',
    primary: '#E11D48',
    secondary: '#FB7185',
    glow: 'rgba(225, 29, 72, 0.28)',
    textClass: 'text-rose-600',
    bgSoftClass: 'bg-rose-50',
    borderClass: 'border-rose-300',
  },
  green: {
    label: 'Mint Velocity',
    primary: '#059669',
    secondary: '#34D399',
    glow: 'rgba(5, 150, 105, 0.28)',
    textClass: 'text-emerald-600',
    bgSoftClass: 'bg-emerald-50',
    borderClass: 'border-emerald-300',
  },
  purple: {
    label: 'Violet Dash',
    primary: '#7C3AED',
    secondary: '#A78BFA',
    glow: 'rgba(124, 58, 237, 0.28)',
    textClass: 'text-purple-600',
    bgSoftClass: 'bg-purple-50',
    borderClass: 'border-purple-300',
  },
};
