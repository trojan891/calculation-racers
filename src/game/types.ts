export type QuestionCategory = 'math' | 'gk' | 'science' | 'current_affairs';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type CarColor = 'blue' | 'red' | 'green' | 'purple';
export type GameMode = 'solo' | '2p' | '4p' | 'timed';
export type RoomStatus = 'waiting' | 'countdown' | 'racing' | 'finished' | 'abandoned';
export type QuestionCountOption = 10 | 15 | 20;
export type QuestionTimeOption = 10 | 15 | 20 | 30;

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
  maxPlayers: 2 | 4;
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

export interface RaceResultRecord {
  id?: string;
  roomCode: string;
  playerId: string;
  nickname: string;
  carColor: CarColor;
  mode: GameMode;
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
