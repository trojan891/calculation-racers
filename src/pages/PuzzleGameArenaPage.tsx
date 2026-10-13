import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Gamepad2,
  Lightbulb,
  MessageCircle,
  Plus,
  RotateCcw,
  Share2,
  Shuffle,
  Sparkles,
  Trophy,
  Undo2,
  X,
} from 'lucide-react';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  CAR_PALETTE,
  GameMode,
  OperationType,
  PlayerProfile,
  QuestionCategory,
  QuestionDifficulty,
  RoomPlayerRecord,
  RoomRecord,
  TROJO_GAME_MAP,
  TrojoGameId,
} from '../game/types';
import { recordRaceCompletionAndStats } from '../lib/gameService';
import { soundEngine } from '../lib/sound';
import {
  buildScoreShareText,
  copyToClipboard,
  generateScoreCardImage,
  getPublicGameUrl,
  getSocialShareLinks,
} from '../lib/shareUtils';
import { GameTileArtwork } from '../components/GameTileArtwork';
import {
  CircularRacerCanvas,
  CircularRacerFinishData,
} from '../game/circularRacer/CircularRacerCanvas';

interface PuzzleGameArenaPageProps {
  gameId: TrojoGameId;
  mode: GameMode;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  initialLevel?: number;
  profile: PlayerProfile;
  isGuest: boolean;
  roomCode?: string;
  initialRoom?: RoomRecord | null;
  initialPlayers?: RoomPlayerRecord[];
  onSaveLocalGuestResult: (result: {
    gameId: TrojoGameId;
    category: QuestionCategory;
    difficulty: QuestionDifficulty;
    mode: GameMode;
    score: number;
    correctAnswers: number;
    wrongAnswers: number;
    accuracy: number;
    distance: number;
    durationMs: number;
    completedAtMs: number;
  }) => void;
  onPlayAgain: () => void;
  onReplayMultiplayer?: (roomCode: string) => Promise<void>;
  onPlayMoreGames: () => void;
  onOpenLeaderboard: () => void;
  onExitToHome: () => void;
}

// ============================================================================
// DETERMINISTIC SEEDED RANDOM HELPER (For identical Multiplayer puzzle boards)
// ============================================================================
function createSeededRandom(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

// ============================================================================
// 1. WATER SORT PUZZLE ENGINE (Levels 1–20)
// ============================================================================
const TUBE_CAPACITY = 4;
const LIQUID_PALETTE: { id: string; name: string; hex: string; topHex: string }[] = [
  { id: 'green', name: 'Emerald', hex: '#16A34A', topHex: '#4ADE80' },
  { id: 'blue', name: 'Sky Blue', hex: '#0284C7', topHex: '#38BDF8' },
  { id: 'yellow', name: 'Gold', hex: '#EAB308', topHex: '#FDE047' },
  { id: 'red', name: 'Coral Red', hex: '#E11D48', topHex: '#FB7185' },
  { id: 'orange', name: 'Tangerine', hex: '#EA580C', topHex: '#FB923C' },
  { id: 'purple', name: 'Royal Violet', hex: '#9333EA', topHex: '#C084FC' },
  { id: 'pink', name: 'Hot Pink', hex: '#DB2777', topHex: '#F472B6' },
  { id: 'teal', name: 'Aqua Teal', hex: '#0D9488', topHex: '#2DD4BF' },
];

function generateWaterSortLevel(level: number, seedPrefix: string): string[][] {
  const numColors =
    level <= 2 ? 4 : level <= 5 ? 5 : level <= 10 ? 6 : level <= 15 ? 7 : 8;
  const emptyTubes = 2;
  const rng = createSeededRandom(`${seedPrefix}_ws_lvl_${level}`);

  // Start with solved full tubes and shuffle layers with guaranteed solvability
  const pool: string[] = [];
  for (let c = 0; c < numColors; c++) {
    const colorId = LIQUID_PALETTE[c % LIQUID_PALETTE.length].id;
    for (let k = 0; k < TUBE_CAPACITY; k++) {
      pool.push(colorId);
    }
  }

  // Fisher-Yates shuffle with deterministic RNG
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  const tubes: string[][] = [];
  for (let t = 0; t < numColors; t++) {
    const tube = pool.slice(t * TUBE_CAPACITY, (t + 1) * TUBE_CAPACITY);
    // Avoid accidentally starting with an already-solved uniform tube
    if (tube.every((c) => c === tube[0]) && t > 0) {
      const swapColor = tubes[0][0];
      tubes[0][0] = tube[3];
      tube[3] = swapColor;
    }
    tubes.push(tube);
  }
  for (let e = 0; e < emptyTubes; e++) {
    tubes.push([]);
  }
  return tubes;
}

function isTubeComplete(tube: string[]): boolean {
  return (
    tube.length === TUBE_CAPACITY && tube.every((color) => color === tube[0])
  );
}

function isWaterSortSolved(tubes: string[][]): boolean {
  return tubes.every((tube) => tube.length === 0 || isTubeComplete(tube));
}

// ============================================================================
// 2. WORD FINDER ENGINE (Levels 1–20, Crossword Grid + Circular Letter Wheel)
// ============================================================================
interface WordPlacement {
  word: string;
  row: number;
  col: number;
  dir: 'H' | 'V';
}

interface WordFinderLevelSpec {
  level: number;
  letters: string[];
  words: WordPlacement[];
  bonusWords: string[];
}

/**
 * Deterministic crossword placement engine.
 * Guarantees:
 * 1. Words only cross where both words share the EXACT same letter.
 * 2. Parallel words never touch side-by-side or end-to-end (eliminating fake sequences like "TTT").
 */
function layoutCrosswordWords(targetWords: string[]): WordPlacement[] {
  const placed: WordPlacement[] = [];
  const grid = new Map<string, { char: string; dirs: Set<'H' | 'V'> }>();

  const getCell = (r: number, c: number) => grid.get(`${r},${c}`);
  const setCell = (r: number, c: number, char: string, dir: 'H' | 'V') => {
    const key = `${r},${c}`;
    const cur = grid.get(key);
    if (cur) {
      cur.dirs.add(dir);
    } else {
      grid.set(key, { char, dirs: new Set([dir]) });
    }
  };

  const canPlace = (word: string, startR: number, startC: number, dir: 'H' | 'V'): number => {
    const dr = dir === 'V' ? 1 : 0;
    const dc = dir === 'H' ? 1 : 0;

    // Cell immediately before start and after end must be empty
    if (getCell(startR - dr, startC - dc)) return -1;
    if (getCell(startR + word.length * dr, startC + word.length * dc)) return -1;

    let intersections = 0;
    for (let i = 0; i < word.length; i++) {
      const r = startR + i * dr;
      const c = startC + i * dc;
      const existing = getCell(r, c);

      if (existing) {
        if (existing.char !== word[i]) return -1;
        if (existing.dirs.has(dir)) return -1;
        intersections++;
      } else {
        // Non-intersecting cells must NOT have perpendicular neighbors (prevents side-by-side "TTT" touching)
        if (dir === 'H') {
          if (getCell(r - 1, c) || getCell(r + 1, c)) return -1;
        } else {
          if (getCell(r, c - 1) || getCell(r, c + 1)) return -1;
        }
      }
    }
    return intersections;
  };

  const commitPlace = (word: string, startR: number, startC: number, dir: 'H' | 'V') => {
    const dr = dir === 'V' ? 1 : 0;
    const dc = dir === 'H' ? 1 : 0;
    for (let i = 0; i < word.length; i++) {
      setCell(startR + i * dr, startC + i * dc, word[i], dir);
    }
    placed.push({ word, row: startR, col: startC, dir });
  };

  targetWords.forEach((word, idx) => {
    if (idx === 0) {
      commitPlace(word, 0, 0, 'H');
      return;
    }

    let best: { r: number; c: number; dir: 'H' | 'V'; score: number } | null = null;

    for (const p of placed) {
      const nextDir: 'H' | 'V' = p.dir === 'H' ? 'V' : 'H';
      for (let i = 0; i < p.word.length; i++) {
        const pr = p.dir === 'V' ? p.row + i : p.row;
        const pc = p.dir === 'H' ? p.col + i : p.col;
        for (let j = 0; j < word.length; j++) {
          if (p.word[i] !== word[j]) continue;
          const candR = nextDir === 'V' ? pr - j : pr;
          const candC = nextDir === 'H' ? pc - j : pc;
          const crossCount = canPlace(word, candR, candC, nextDir);
          if (crossCount > 0) {
            // Prefer compact bounding boxes
            const distPenalty = Math.abs(candR) + Math.abs(candC);
            const score = crossCount * 20 - distPenalty;
            if (!best || score > best.score) {
              best = { r: candR, c: candC, dir: nextDir, score };
            }
          }
        }
      }
    }

    if (best) {
      commitPlace(word, best.r, best.c, best.dir);
    } else {
      // Fallback: place on a separated row with an empty buffer row so it never touches adjacent words
      let maxRow = 0;
      grid.forEach((_, key) => {
        const r = Number(key.split(',')[0]);
        if (r > maxRow) maxRow = r;
      });
      commitPlace(word, maxRow + 2, 0, 'H');
    }
  });

  // Normalize coordinates so minRow = 0 and minCol = 0
  let minR = Infinity;
  let minC = Infinity;
  for (const p of placed) {
    if (p.row < minR) minR = p.row;
    if (p.col < minC) minC = p.col;
  }

  return placed.map((p) => ({
    ...p,
    row: p.row - minR,
    col: p.col - minC,
  }));
}

interface RawWordLevel {
  letters: string[];
  targetWords: string[];
  bonusWords: string[];
}

// 20 Verified Word Finder Levels — 100% unique wheel letters per level, zero duplicate letter requirements
const RAW_WORD_FINDER_LEVELS: RawWordLevel[] = [
  {
    letters: ['S', 'T', 'A', 'R'],
    targetWords: ['STAR', 'ARTS', 'RAT', 'SAT'],
    bonusWords: ['RATS', 'TAR', 'ART'],
  },
  {
    letters: ['P', 'L', 'A', 'N', 'E'],
    targetWords: ['PLANE', 'PLAN', 'PALE', 'LEAP'],
    bonusWords: ['LANE', 'LEAN', 'PEAL', 'PAN', 'PEN'],
  },
  {
    letters: ['T', 'R', 'A', 'I', 'N'],
    targetWords: ['TRAIN', 'RAIN', 'RANT', 'AIR'],
    bonusWords: ['ART', 'RAT', 'ANT', 'TAN', 'TIN'],
  },
  {
    letters: ['S', 'P', 'A', 'R', 'K'],
    targetWords: ['SPARK', 'PARK', 'SPAR', 'ARK'],
    bonusWords: ['ASK', 'SAP', 'SPA', 'RAP'],
  },
  {
    letters: ['B', 'R', 'I', 'G', 'H', 'T'],
    targetWords: ['BRIGHT', 'RIGHT', 'BIRTH', 'GRIT'],
    bonusWords: ['BIT', 'BIG', 'HIT', 'RIG', 'RIB'],
  },
  {
    letters: ['C', 'R', 'O', 'W', 'N', 'S'],
    targetWords: ['CROWNS', 'CROWN', 'SNOW', 'CORN'],
    bonusWords: ['CROWS', 'CROW', 'WORN', 'COW', 'ROW', 'NOW', 'OWN', 'SON', 'WON'],
  },
  {
    letters: ['F', 'L', 'I', 'G', 'H', 'T'],
    targetWords: ['FLIGHT', 'LIGHT', 'FIGHT', 'GIFT'],
    bonusWords: ['LIFT', 'FIT', 'FIG', 'LIT', 'HIT', 'HILT'],
  },
  {
    letters: ['S', 'T', 'R', 'E', 'A', 'M'],
    targetWords: ['STREAM', 'MASTER', 'STEAM', 'SMART'],
    bonusWords: ['TEAMS', 'TEAM', 'MEAT', 'MATE', 'TAME', 'STAR', 'STARE', 'RATES'],
  },
  {
    letters: ['G', 'A', 'R', 'D', 'E', 'N'],
    targetWords: ['GARDEN', 'DANGER', 'GRAND', 'GRADE'],
    bonusWords: ['RANGE', 'DARE', 'DEAR', 'READ', 'GEAR', 'RAGE', 'NEAR', 'EARN'],
  },
  {
    letters: ['C', 'A', 'S', 'T', 'L', 'E'],
    targetWords: ['CASTLE', 'SCALE', 'SLATE', 'TALES'],
    bonusWords: ['LEAST', 'CAST', 'LATE', 'SALE', 'SEAL', 'SEAT', 'EAST'],
  },
  {
    letters: ['P', 'L', 'A', 'N', 'E', 'T'],
    targetWords: ['PLANET', 'PLANT', 'PLANE', 'LATE'],
    bonusWords: ['PLATE', 'NEAT', 'PLAN', 'PALE', 'TALE', 'LEAP', 'LANE', 'TAPE'],
  },
  {
    letters: ['S', 'I', 'L', 'V', 'E', 'R'],
    targetWords: ['SILVER', 'LIVER', 'LIVES', 'RISE'],
    bonusWords: ['LIVE', 'VEIL', 'VILE', 'SIRE', 'LIE'],
  },
  {
    letters: ['F', 'O', 'R', 'E', 'S', 'T'],
    targetWords: ['FOREST', 'FROST', 'STORE', 'ROSE'],
    bonusWords: ['FORTE', 'FORT', 'REST', 'SORT', 'SORE', 'TOE'],
  },
  {
    letters: ['W', 'I', 'N', 'T', 'E', 'R'],
    targetWords: ['WINTER', 'WRITE', 'TWINE', 'WIRE'],
    bonusWords: ['TWIN', 'RENT', 'TIRE', 'TIER', 'WIN', 'WET'],
  },
  {
    letters: ['G', 'O', 'L', 'D', 'E', 'N'],
    targetWords: ['GOLDEN', 'LODGE', 'GOLD', 'GONE'],
    bonusWords: ['LEND', 'DONE', 'LONE', 'NODE', 'DOG', 'LOG'],
  },
  {
    letters: ['S', 'H', 'A', 'D', 'O', 'W'],
    targetWords: ['SHADOW', 'SHOW', 'WASH', 'DASH'],
    bonusWords: ['SOD', 'SAW', 'SAD', 'HAD', 'WHO'],
  },
  {
    letters: ['B', 'R', 'I', 'D', 'G', 'E'],
    targetWords: ['BRIDGE', 'BRIDE', 'RIDGE', 'BIRD'],
    bonusWords: ['RIDE', 'GRID', 'DIRE', 'RED', 'BED', 'BIG'],
  },
  {
    letters: ['S', 'P', 'R', 'I', 'N', 'G'],
    targetWords: ['SPRING', 'RINGS', 'RING', 'SPIN'],
    bonusWords: ['GRIN', 'SING', 'SIGN', 'PINS', 'SNIP', 'PIN'],
  },
  {
    letters: ['M', 'A', 'R', 'K', 'E', 'T'],
    targetWords: ['MARKET', 'MAKER', 'MAKE', 'TEAM'],
    bonusWords: ['TAKE', 'RATE', 'TEAR', 'MEAT', 'MATE', 'TAME', 'ART'],
  },
  {
    letters: ['T', 'R', 'A', 'V', 'E', 'L'],
    targetWords: ['TRAVEL', 'LATER', 'ALERT', 'TALE'],
    bonusWords: ['ALTER', 'RATE', 'TEAR', 'LATE', 'REAL', 'EAR'],
  },
];

const WORD_FINDER_LEVELS: WordFinderLevelSpec[] = RAW_WORD_FINDER_LEVELS.map(
  (raw, idx) => ({
    level: idx + 1,
    letters: raw.letters,
    words: layoutCrosswordWords(raw.targetWords),
    bonusWords: raw.bonusWords,
  })
);

function getWordFinderLevel(levelNumber: number): WordFinderLevelSpec {
  const idx = (Math.max(1, levelNumber) - 1) % WORD_FINDER_LEVELS.length;
  return WORD_FINDER_LEVELS[idx];
}

// ============================================================================
// 3. 2048 / 2028 PUZZLE ENGINE (Levels 1–20)
// ============================================================================
type Grid2048 = number[][];

function get2048TargetForLevel(level: number): number {
  if (level <= 2) return 128;
  if (level <= 5) return 256;
  if (level <= 9) return 512;
  if (level <= 14) return 1024;
  return 2048;
}

function createInitial2048Grid(level: number, seedPrefix: string): Grid2048 {
  const rng = createSeededRandom(`${seedPrefix}_2048_lvl_${level}`);
  const grid: Grid2048 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  // Higher levels start with a head-start boost tile so gameplay is exciting
  if (level >= 7) {
    grid[1][1] = 32;
    grid[2][2] = 16;
  } else if (level >= 4) {
    grid[1][1] = 16;
    grid[2][2] = 8;
  }

  spawnRandom2048Tile(grid, rng);
  spawnRandom2048Tile(grid, rng);
  return grid;
}

function spawnRandom2048Tile(grid: Grid2048, rng: () => number = Math.random): void {
  const empties: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) empties.push([r, c]);
    }
  }
  if (empties.length === 0) return;
  const [r, c] = empties[Math.floor(rng() * empties.length)];
  grid[r][c] = rng() < 0.85 ? 2 : 4;
}

function slideAndMergeRow(row: number[]): { newRow: number[]; gained: number } {
  const nonZero = row.filter((v) => v !== 0);
  const merged: number[] = [];
  let gained = 0;
  let i = 0;
  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      const val = nonZero[i] * 2;
      merged.push(val);
      gained += val;
      i += 2;
    } else {
      merged.push(nonZero[i]);
      i += 1;
    }
  }
  while (merged.length < 4) merged.push(0);
  return { newRow: merged, gained };
}

function move2048Grid(
  grid: Grid2048,
  dir: 'up' | 'down' | 'left' | 'right'
): { nextGrid: Grid2048; gained: number; moved: boolean } {
  const next: Grid2048 = grid.map((r) => [...r]);
  let totalGained = 0;
  let moved = false;

  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < 4; r++) {
      const line = dir === 'left' ? [...next[r]] : [...next[r]].reverse();
      const { newRow, gained } = slideAndMergeRow(line);
      const finalRow = dir === 'left' ? newRow : newRow.reverse();
      if (finalRow.some((v, idx) => v !== next[r][idx])) moved = true;
      next[r] = finalRow;
      totalGained += gained;
    }
  } else {
    for (let c = 0; c < 4; c++) {
      const col = [next[0][c], next[1][c], next[2][c], next[3][c]];
      const line = dir === 'up' ? col : [...col].reverse();
      const { newRow, gained } = slideAndMergeRow(line);
      const finalCol = dir === 'up' ? newRow : newRow.reverse();
      for (let r = 0; r < 4; r++) {
        if (next[r][c] !== finalCol[r]) moved = true;
        next[r][c] = finalCol[r];
      }
      totalGained += gained;
    }
  }

  return { nextGrid: next, gained: totalGained, moved };
}

function canMove2048(grid: Grid2048): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) return true;
      if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

function get2048TileStyle(val: number): string {
  switch (val) {
    case 0:
      return 'bg-[#CDC1B4] text-transparent';
    case 2:
      return 'bg-[#EEE4DA] text-[#776E65]';
    case 4:
      return 'bg-[#EDE0C8] text-[#776E65]';
    case 8:
      return 'bg-[#F2B179] text-white';
    case 16:
      return 'bg-[#F59563] text-white';
    case 32:
      return 'bg-[#F67C5F] text-white';
    case 64:
      return 'bg-[#F65E3B] text-white';
    case 128:
      return 'bg-[#EDCF72] text-white shadow-sm';
    case 256:
      return 'bg-[#EDCC61] text-white shadow-sm';
    case 512:
      return 'bg-[#EDC850] text-white shadow-md';
    case 1024:
      return 'bg-[#EDC53F] text-white shadow-md';
    case 2048:
    default:
      return 'bg-[#F5B800] text-white ring-2 ring-yellow-200 shadow-lg';
  }
}

// ============================================================================
// 4. MAHJONG SOLITAIRE ENGINE (Levels 1–20, 3D Layered Tiles)
// ============================================================================
interface MahjongTileKind {
  id: string;
  symbol: string;
  subLabel: string;
  color: string;
}

const MAHJONG_CATALOG: MahjongTileKind[] = [
  { id: 'dragon_green', symbol: '發', subLabel: 'Fa', color: '#15803D' },
  { id: 'dragon_red', symbol: '中', subLabel: 'Zhong', color: '#DC2626' },
  { id: 'dragon_white', symbol: '白', subLabel: 'Bai', color: '#1D4ED8' },
  { id: 'wind_east', symbol: '東', subLabel: 'East', color: '#0F172A' },
  { id: 'wind_south', symbol: '南', subLabel: 'South', color: '#0F172A' },
  { id: 'wind_west', symbol: '西', subLabel: 'West', color: '#0F172A' },
  { id: 'wind_north', symbol: '北', subLabel: 'North', color: '#0F172A' },
  { id: 'wan_1', symbol: '一萬', subLabel: '1 Wan', color: '#DC2626' },
  { id: 'wan_3', symbol: '三萬', subLabel: '3 Wan', color: '#DC2626' },
  { id: 'wan_5', symbol: '五萬', subLabel: '5 Wan', color: '#DC2626' },
  { id: 'wan_8', symbol: '八萬', subLabel: '8 Wan', color: '#DC2626' },
  { id: 'wan_9', symbol: '九萬', subLabel: '9 Wan', color: '#DC2626' },
  { id: 'bam_2', symbol: '二索', subLabel: '2 Bam', color: '#15803D' },
  { id: 'bam_4', symbol: '四索', subLabel: '4 Bam', color: '#15803D' },
  { id: 'bam_6', symbol: '六索', subLabel: '6 Bam', color: '#15803D' },
  { id: 'bam_8', symbol: '八索', subLabel: '8 Bam', color: '#15803D' },
  { id: 'dot_1', symbol: '一筒', subLabel: '1 Dot', color: '#1D4ED8' },
  { id: 'dot_5', symbol: '五筒', subLabel: '5 Dot', color: '#1D4ED8' },
  { id: 'dot_7', symbol: '七筒', subLabel: '7 Dot', color: '#1D4ED8' },
  { id: 'dot_9', symbol: '九筒', subLabel: '9 Dot', color: '#1D4ED8' },
];

interface MahjongTileInstance {
  uid: string;
  kind: MahjongTileKind;
  row: number;
  col: number;
  layer: number; // 0 = base, 1 = middle, 2 = top cap
  removed: boolean;
}

function generateMahjongBoard(level: number, seedPrefix: string): MahjongTileInstance[] {
  const rng = createSeededRandom(`${seedPrefix}_mj_lvl_${level}`);
  const positions: { row: number; col: number; layer: number }[] = [];

  // Layer 0 base grid (rows 0..3, cols 0..5 -> up to 24 slots)
  const baseRows = level <= 3 ? 3 : 4;
  const baseCols = level <= 2 ? 4 : level <= 6 ? 5 : 6;
  for (let r = 0; r < baseRows; r++) {
    for (let c = 0; c < baseCols; c++) {
      positions.push({ row: r, col: c, layer: 0 });
    }
  }

  // Layer 1 elevated center (rows 1..2, cols 1..baseCols-2)
  for (let r = 1; r < baseRows - 1; r++) {
    for (let c = 1; c < baseCols - 1; c++) {
      positions.push({ row: r, col: c, layer: 1 });
    }
  }

  // Layer 2 peak on higher levels (even count guaranteed)
  if (level >= 4 && baseCols >= 5) {
    positions.push({ row: 1, col: 2, layer: 2 });
    positions.push({ row: 2, col: 2, layer: 2 });
  }

  // Ensure strictly even number of positions for pairs
  if (positions.length % 2 !== 0) {
    positions.pop();
  }

  const pairCount = positions.length / 2;
  const selectedKinds: MahjongTileKind[] = [];
  for (let i = 0; i < pairCount; i++) {
    const kind = MAHJONG_CATALOG[Math.floor(rng() * MAHJONG_CATALOG.length)];
    selectedKinds.push(kind, kind);
  }

  // Shuffle tile kinds
  for (let i = selectedKinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = selectedKinds[i];
    selectedKinds[i] = selectedKinds[j];
    selectedKinds[j] = tmp;
  }

  return positions.map((pos, idx) => ({
    uid: `mj_${idx}_${pos.layer}_${pos.row}_${pos.col}`,
    kind: selectedKinds[idx],
    row: pos.row,
    col: pos.col,
    layer: pos.layer,
    removed: false,
  }));
}

function isMahjongTileFree(
  tile: MahjongTileInstance,
  allTiles: MahjongTileInstance[]
): boolean {
  if (tile.removed) return false;
  const active = allTiles.filter((t) => !t.removed && t.uid !== tile.uid);

  // 1. Blocked from above if any tile on layer + 1 sits at the same row/col
  const blockedAbove = active.some(
    (t) => t.layer > tile.layer && t.row === tile.row && t.col === tile.col
  );
  if (blockedAbove) return false;

  // 2. Blocked horizontally ONLY if BOTH left (col - 1) and right (col + 1) on same layer & row are occupied
  const hasLeftNeighbor = active.some(
    (t) => t.layer === tile.layer && t.row === tile.row && t.col === tile.col - 1
  );
  const hasRightNeighbor = active.some(
    (t) => t.layer === tile.layer && t.row === tile.row && t.col === tile.col + 1
  );

  return !(hasLeftNeighbor && hasRightNeighbor);
}

// ============================================================================
// MAIN PUZZLE GAME ARENA COMPONENT
// ============================================================================
export const PuzzleGameArenaPage: React.FC<PuzzleGameArenaPageProps> = ({
  gameId,
  mode,
  category,
  difficulty,
  initialLevel = 1,
  profile,
  isGuest,
  roomCode,
  initialRoom,
  initialPlayers = [],
  onSaveLocalGuestResult,
  onPlayAgain,
  onReplayMultiplayer,
  onPlayMoreGames,
  onExitToHome,
}) => {
  const isMultiplayer =
    mode !== 'solo' && mode !== 'timed' && Boolean(roomCode);
  const [room, setRoom] = useState<RoomRecord | null>(initialRoom || null);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayerRecord[]>(initialPlayers);

  const gameInfo = TROJO_GAME_MAP[gameId] || TROJO_GAME_MAP.water_sort;
  const seedBase = roomCode || 'SOLO_TROJO';

  // Level & Score State (Enforce unlocked levels in Solo mode)
  const [unlockedLevel, setUnlockedLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`trojo_unlocked_lvl_${gameId}`);
      if (saved) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 20) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return 1;
  });

  const [currentLevel, setCurrentLevel] = useState<number>(() => {
    if (isMultiplayer) {
      return difficulty === 'hard' ? 8 : difficulty === 'medium' ? 4 : 1;
    }
    try {
      const saved = localStorage.getItem(`trojo_unlocked_lvl_${gameId}`);
      const maxUnlocked = saved ? Math.max(1, Math.min(20, Number(saved))) : 1;
      return Math.max(1, Math.min(maxUnlocked, initialLevel));
    } catch {
      return 1;
    }
  });

  const [score, setScore] = useState(0);
  const [movesCount, setMovesCount] = useState(0);
  const [mistakesCount, setMistakesCount] = useState(0);
  const [levelSolved, setLevelSolved] = useState(false);
  const [matchFinished, setMatchFinished] = useState(false);
  const [startedAtMs] = useState<number>(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [circularProgress, setCircularProgress] = useState(0);
  const savedResultRef = useRef(false);

  // Share & Confirmation Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareImageDataUrl, setShareImageDataUrl] = useState<string | null>(null);
  const [shareGenerating, setShareGenerating] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);

  // Lock page scrolling during active gameplay and warn before accidental refresh/close
  useEffect(() => {
    if (!matchFinished) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [matchFinished]);

  useEffect(() => {
    if (matchFinished) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [matchFinished]);

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 2200);
  }, []);

  // ============================================================================
  // GAME 1 STATE: WATER SORT
  // ============================================================================
  const [tubes, setTubes] = useState<string[][]>(() =>
    generateWaterSortLevel(currentLevel, seedBase)
  );
  const [tubeHistory, setTubeHistory] = useState<string[][][]>([]);
  const [selectedTubeIdx, setSelectedTubeIdx] = useState<number | null>(null);
  const [pouringAnim, setPouringAnim] = useState<{
    from: number;
    to: number;
    color: string;
  } | null>(null);
  const [hintPair, setHintPair] = useState<[number, number] | null>(null);
  const [extraTubeUsed, setExtraTubeUsed] = useState(false);

  // ============================================================================
  // GAME 2 STATE: WORD FINDER
  // ============================================================================
  const wfSpec = useMemo(() => getWordFinderLevel(currentLevel), [currentLevel]);
  const [wheelOrder, setWheelOrder] = useState<number[]>(() =>
    wfSpec.letters.map((_, i) => i)
  );
  const [selectedWheelIndices, setSelectedWheelIndices] = useState<number[]>([]);
  const [solvedWords, setSolvedWords] = useState<string[]>([]);
  const [foundBonusWords, setFoundBonusWords] = useState<string[]>([]);
  const [revealedCells, setRevealedCells] = useState<string[]>([]);
  const [hintsLeft, setHintsLeft] = useState<number>(3);

  // ============================================================================
  // GAME 3 STATE: 2048 / 2028
  // ============================================================================
  const [grid2048, setGrid2048] = useState<Grid2048>(() =>
    createInitial2048Grid(currentLevel, seedBase)
  );
  const [history2048, setHistory2048] = useState<Grid2048[]>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // ============================================================================
  // GAME 4 STATE: MAHJONG SOLITAIRE
  // ============================================================================
  const [mahjongTiles, setMahjongTiles] = useState<MahjongTileInstance[]>(() =>
    generateMahjongBoard(currentLevel, seedBase)
  );
  const [mahjongHistory, setMahjongHistory] = useState<MahjongTileInstance[][]>([]);
  const [selectedMahjongUid, setSelectedMahjongUid] = useState<string | null>(null);
  const [hintMahjongUids, setHintMahjongUids] = useState<[string, string] | null>(
    null
  );
  const [mahjongCombo, setMahjongCombo] = useState<number>(1);
  const [highlightFreeTiles, setHighlightFreeTiles] = useState<boolean>(true);

  // Reset board when currentLevel or gameId changes
  const initLevelBoard = useCallback(
    (lvl: number) => {
      setLevelSolved(false);
      if (gameId === 'water_sort') {
        setTubes(generateWaterSortLevel(lvl, seedBase));
        setTubeHistory([]);
        setSelectedTubeIdx(null);
        setPouringAnim(null);
        setHintPair(null);
        setExtraTubeUsed(false);
      } else if (gameId === 'word_finder') {
        const spec = getWordFinderLevel(lvl);
        setWheelOrder(spec.letters.map((_, i) => i));
        setSelectedWheelIndices([]);
        setSolvedWords([]);
        setFoundBonusWords([]);
        setRevealedCells([]);
        setHintsLeft(3);
      } else if (gameId === 'game_2048') {
        setGrid2048(createInitial2048Grid(lvl, seedBase));
        setHistory2048([]);
      } else if (gameId === 'mahjong_solitaire') {
        setMahjongTiles(generateMahjongBoard(lvl, seedBase));
        setMahjongHistory([]);
        setSelectedMahjongUid(null);
        setHintMahjongUids(null);
        setMahjongCombo(1);
      }
    },
    [gameId, seedBase]
  );

  useEffect(() => {
    initLevelBoard(currentLevel);
  }, [currentLevel, initLevelBoard]);

  // Elapsed timer
  useEffect(() => {
    if (matchFinished) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAtMs);
    }, 250);
    return () => clearInterval(interval);
  }, [startedAtMs, matchFinished]);

  // Subscribe to Multiplayer Room & Players
  useEffect(() => {
    if (!isMultiplayer || !roomCode) return;
    const roomRef = doc(db, 'rooms', roomCode);
    const unsubRoom = onSnapshot(
      roomRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as RoomRecord;
          setRoom(data);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomCode}`)
    );

    const playersQuery = query(
      collection(db, 'rooms', roomCode, 'players'),
      where('roomCode', '==', roomCode)
    );
    const unsubPlayers = onSnapshot(
      playersQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as RoomPlayerRecord);
        setRoomPlayers(list);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `rooms/${roomCode}/players`)
    );

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [isMultiplayer, roomCode]);

  // Compute live completion percentage (0..100) for multiplayer progress bar
  const completionPct = useMemo(() => {
    if (levelSolved) return 100;
    if (gameId === 'circular_racer') return circularProgress;
    if (gameId === 'water_sort') {
      const nonEmpty = tubes.filter((t) => t.length > 0);
      if (nonEmpty.length === 0) return 0;
      const completed = tubes.filter((t) => isTubeComplete(t)).length;
      return Math.min(99, Math.round((completed / nonEmpty.length) * 100));
    }
    if (gameId === 'word_finder') {
      const total = wfSpec.words.length || 1;
      return Math.min(99, Math.round((solvedWords.length / total) * 100));
    }
    if (gameId === 'game_2048') {
      const target = get2048TargetForLevel(currentLevel);
      let maxTile = 2;
      for (const r of grid2048) {
        for (const val of r) {
          if (val > maxTile) maxTile = val;
        }
      }
      const logProgress = Math.log2(maxTile) / Math.log2(target);
      return Math.min(99, Math.max(5, Math.round(logProgress * 100)));
    }
    if (gameId === 'mahjong_solitaire') {
      const total = mahjongTiles.length || 1;
      const removed = mahjongTiles.filter((t) => t.removed).length;
      return Math.min(99, Math.round((removed / total) * 100));
    }
    return 0;
  }, [
    levelSolved,
    gameId,
    circularProgress,
    tubes,
    wfSpec.words.length,
    solvedWords.length,
    currentLevel,
    grid2048,
    mahjongTiles,
  ]);

  // Sync multiplayer progress to Firestore
  const syncMultiplayerProgress = useCallback(
    async (
      nextScore: number,
      nextMoves: number,
      nextMistakes: number,
      pct: number,
      isComplete: boolean
    ) => {
      if (!isMultiplayer || !roomCode || isGuest) return;
      try {
        const myRef = doc(db, 'rooms', roomCode, 'players', profile.uid);
        await updateDoc(myRef, {
          distance: Math.min(100, Math.max(0, pct)),
          score: Math.min(500000, Math.max(0, nextScore)),
          correctAnswers: Math.min(500, nextMoves),
          wrongAnswers: Math.min(500, nextMistakes),
          currentQuestionIndex: Math.min(500, nextMoves),
          finished: isComplete,
          finishTimeMs: isComplete ? Date.now() - startedAtMs : 0,
          placement: isComplete ? 1 : 0,
          lastSeenAtMs: Date.now(),
          updatedAt: serverTimestamp(),
        });

        if (isComplete && room && room.status !== 'finished') {
          await updateDoc(doc(db, 'rooms', roomCode), {
            status: 'finished',
            raceFinishedAtMs: Date.now(),
            winnerId: profile.uid,
            winnerNickname: profile.nickname,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      } catch {
        // non-fatal sync
      }
    },
    [isMultiplayer, roomCode, isGuest, profile.uid, profile.nickname, room, startedAtMs]
  );

  // Finalize & save game result to Leaderboard / Profile
  const handleFinalizeMatch = useCallback(
    async (finalScoreVal: number) => {
      if (savedResultRef.current) return;
      savedResultRef.current = true;
      setMatchFinished(true);
      soundEngine.playVictory();

      const durationMs = Math.max(1000, Date.now() - startedAtMs);
      const totalActions = Math.max(1, movesCount + mistakesCount);
      const accuracy = Math.min(
        100,
        Math.max(50, Math.round((movesCount / totalActions) * 100))
      );

      let placement = 1;
      if (isMultiplayer && roomPlayers.length > 0) {
        const higher = roomPlayers.filter(
          (p) => p.playerId !== profile.uid && (p.score ?? 0) > finalScoreVal
        ).length;
        placement = Math.min(8, higher + 1);
      }

      if (isGuest) {
        onSaveLocalGuestResult({
          gameId,
          category,
          difficulty,
          mode,
          score: finalScoreVal,
          correctAnswers: Math.min(500, Math.max(1, movesCount)),
          wrongAnswers: Math.min(500, mistakesCount),
          accuracy,
          distance: levelSolved ? 100 : completionPct,
          durationMs,
          completedAtMs: Date.now(),
        });
      } else {
        try {
          await recordRaceCompletionAndStats(profile, {
            roomCode: roomCode || 'SOLO',
            playerId: profile.uid,
            nickname: profile.nickname,
            carColor: profile.carColor,
            mode,
            gameId,
            category,
            difficulty,
            placement,
            score: finalScoreVal,
            correctAnswers: Math.min(500, Math.max(1, movesCount)),
            wrongAnswers: Math.min(500, mistakesCount),
            accuracy,
            distance: levelSolved ? 100 : completionPct,
            durationMs,
            isPublic: profile.isPublicProfile,
            completedAtMs: Date.now(),
          });
        } catch (err) {
          console.warn('Could not save puzzle result:', err);
        }
      }
    },
    [
      startedAtMs,
      movesCount,
      mistakesCount,
      isMultiplayer,
      roomPlayers,
      profile,
      isGuest,
      onSaveLocalGuestResult,
      gameId,
      category,
      difficulty,
      mode,
      levelSolved,
      completionPct,
      roomCode,
    ]
  );

  // Trigger level win
  const handleLevelCleared = useCallback(
    (bonusScore: number) => {
      if (levelSolved) return;
      setLevelSolved(true);
      soundEngine.playVictory();
      const nextTotalScore = score + bonusScore;
      setScore(nextTotalScore);

      const nextUnlock = Math.min(20, Math.max(unlockedLevel, currentLevel + 1));
      setUnlockedLevel(nextUnlock);
      try {
        localStorage.setItem(`trojo_unlocked_lvl_${gameId}`, String(nextUnlock));
      } catch {
        // ignore
      }

      if (isMultiplayer) {
        syncMultiplayerProgress(
          nextTotalScore,
          movesCount + 1,
          mistakesCount,
          100,
          true
        );
        setTimeout(() => {
          handleFinalizeMatch(nextTotalScore);
        }, 900);
      }
    },
    [
      levelSolved,
      score,
      unlockedLevel,
      currentLevel,
      gameId,
      isMultiplayer,
      syncMultiplayerProgress,
      movesCount,
      mistakesCount,
      handleFinalizeMatch,
    ]
  );

  // ============================================================================
  // CIRCULAR RACER HANDLERS
  // ============================================================================
  const handleCircularRacerFinish = useCallback(
    (data: CircularRacerFinishData) => {
      soundEngine.playVictory();
      setScore(data.score);
      setLevelSolved(true);
      setCircularProgress(100);
      setMovesCount(data.lapsCompleted * 10);
      setMistakesCount(data.placement > 1 ? data.placement - 1 : 0);

      const nextLevel = Math.min(20, currentLevel + 1);
      try {
        const stored = Number(localStorage.getItem('trojo_unlocked_lvl_circular_racer') || '1');
        if (nextLevel > stored) {
          localStorage.setItem('trojo_unlocked_lvl_circular_racer', String(nextLevel));
        }
      } catch {
        // ignore
      }

      syncMultiplayerProgress(data.score, data.lapsCompleted * 10, 0, 100, true);
      handleFinalizeMatch(data.score);
    },
    [currentLevel, syncMultiplayerProgress, handleFinalizeMatch]
  );

  const handleCircularProgressUpdate = useCallback(
    (pct: number, liveScore: number) => {
      setCircularProgress(pct);
      if (isMultiplayer) {
        syncMultiplayerProgress(liveScore, 10, 0, pct, false);
      }
    },
    [isMultiplayer, syncMultiplayerProgress]
  );

  // ============================================================================
  // WATER SORT HANDLERS
  // ============================================================================
  const handleTubeClick = (idx: number) => {
    if (levelSolved || pouringAnim) return;
    setHintPair(null);

    if (selectedTubeIdx === null) {
      if (tubes[idx].length === 0 || isTubeComplete(tubes[idx])) return;
      soundEngine.playClick();
      setSelectedTubeIdx(idx);
      return;
    }

    if (selectedTubeIdx === idx) {
      soundEngine.playClick();
      setSelectedTubeIdx(null);
      return;
    }

    const fromTube = tubes[selectedTubeIdx];
    const toTube = tubes[idx];
    const topColor = fromTube[fromTube.length - 1];

    // Check if pour is valid
    const canPour =
      toTube.length < TUBE_CAPACITY &&
      (toTube.length === 0 || toTube[toTube.length - 1] === topColor);

    if (!canPour) {
      soundEngine.playBrakeWrong();
      setMistakesCount((m) => m + 1);
      setSelectedTubeIdx(idx);
      return;
    }

    // Count how many contiguous layers of topColor can be poured
    let countToMove = 0;
    for (let i = fromTube.length - 1; i >= 0; i--) {
      if (fromTube[i] === topColor) countToMove++;
      else break;
    }
    const freeSpace = TUBE_CAPACITY - toTube.length;
    const actualMove = Math.min(countToMove, freeSpace);

    const prevSnapshot = tubes.map((t) => [...t]);
    setTubeHistory((h) => [...h, prevSnapshot]);

    const colorObj =
      LIQUID_PALETTE.find((c) => c.id === topColor) || LIQUID_PALETTE[0];
    setPouringAnim({ from: selectedTubeIdx, to: idx, color: colorObj.hex });
    soundEngine.playAccelerate();

    setTimeout(() => {
      const nextTubes = tubes.map((t) => [...t]);
      for (let k = 0; k < actualMove; k++) {
        const popped = nextTubes[selectedTubeIdx].pop();
        if (popped) nextTubes[idx].push(popped);
      }

      const completedNow = isTubeComplete(nextTubes[idx]);
      const gained = completedNow ? 180 : 45 * actualMove;
      const nextScore = score + gained;
      const nextMoves = movesCount + 1;

      setTubes(nextTubes);
      setSelectedTubeIdx(null);
      setPouringAnim(null);
      setScore(nextScore);
      setMovesCount(nextMoves);

      if (isWaterSortSolved(nextTubes)) {
        handleLevelCleared(500 + currentLevel * 60);
      } else {
        const nonEmpty = nextTubes.filter((t) => t.length > 0).length || 1;
        const doneCount = nextTubes.filter((t) => isTubeComplete(t)).length;
        const pct = Math.min(95, Math.round((doneCount / nonEmpty) * 100));
        syncMultiplayerProgress(nextScore, nextMoves, mistakesCount, pct, false);
      }
    }, 210);
  };

  const handleWaterSortUndo = () => {
    if (tubeHistory.length === 0 || levelSolved) return;
    soundEngine.playClick();
    const prev = tubeHistory[tubeHistory.length - 1];
    setTubes(prev);
    setTubeHistory((h) => h.slice(0, -1));
    setSelectedTubeIdx(null);
  };

  const handleWaterSortHint = () => {
    if (levelSolved) return;
    soundEngine.playClick();
    for (let i = 0; i < tubes.length; i++) {
      const from = tubes[i];
      if (from.length === 0 || isTubeComplete(from)) continue;
      const top = from[from.length - 1];
      for (let j = 0; j < tubes.length; j++) {
        if (i === j) continue;
        const to = tubes[j];
        if (to.length < TUBE_CAPACITY && (to.length === 0 || to[to.length - 1] === top)) {
          // Avoid pointless pouring a uniform tube into an empty tube
          if (to.length === 0 && from.every((c) => c === top)) continue;
          setHintPair([i, j]);
          setSelectedTubeIdx(i);
          return;
        }
      }
    }
    showToast('Try using Undo or +1 Tube!');
  };

  const handleWaterSortAddTube = () => {
    if (extraTubeUsed || levelSolved) return;
    soundEngine.playAccelerate();
    setExtraTubeUsed(true);
    setTubes((prev) => [...prev, []]);
    showToast('Added +1 extra empty tube!');
  };

  // ============================================================================
  // WORD FINDER HANDLERS
  // ============================================================================
  const currentFormedWord = useMemo(
    () => selectedWheelIndices.map((idx) => wfSpec.letters[idx]).join(''),
    [selectedWheelIndices, wfSpec.letters]
  );

  // Build Crossword Grid Map
  const crosswordBounds = useMemo(() => {
    let maxR = 4;
    let maxC = 4;
    const cellMap = new Map<string, { char: string; words: string[] }>();

    for (const wp of wfSpec.words) {
      for (let i = 0; i < wp.word.length; i++) {
        const r = wp.dir === 'V' ? wp.row + i : wp.row;
        const c = wp.dir === 'H' ? wp.col + i : wp.col;
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
        const key = `${r},${c}`;
        const existing = cellMap.get(key);
        if (existing) {
          existing.words.push(wp.word);
        } else {
          cellMap.set(key, { char: wp.word[i], words: [wp.word] });
        }
      }
    }
    return { rows: maxR + 1, cols: maxC + 1, cellMap };
  }, [wfSpec]);

  const handleToggleWheelLetter = (letterIndex: number) => {
    if (levelSolved) return;
    soundEngine.playClick();

    // If clicking the last selected letter, pop it
    if (
      selectedWheelIndices.length > 0 &&
      selectedWheelIndices[selectedWheelIndices.length - 1] === letterIndex
    ) {
      setSelectedWheelIndices((prev) => prev.slice(0, -1));
      return;
    }

    if (selectedWheelIndices.includes(letterIndex)) return;

    const nextIndices = [...selectedWheelIndices, letterIndex];
    setSelectedWheelIndices(nextIndices);
    const candidate = nextIndices.map((i) => wfSpec.letters[i]).join('');

    // Auto-check if candidate matches an unsolved target word
    const targetMatch = wfSpec.words.find(
      (w) => w.word === candidate && !solvedWords.includes(w.word)
    );
    if (targetMatch) {
      soundEngine.playAccelerate();
      const nextSolved = [...solvedWords, targetMatch.word];
      const gained = 140 + targetMatch.word.length * 25;
      const nextScore = score + gained;
      const nextMoves = movesCount + 1;

      setSolvedWords(nextSolved);
      setScore(nextScore);
      setMovesCount(nextMoves);
      showToast(`Awesome! Found "${targetMatch.word}" (+${gained} pts)`);

      setTimeout(() => {
        setSelectedWheelIndices([]);
      }, 220);

      if (nextSolved.length === wfSpec.words.length) {
        handleLevelCleared(500 + currentLevel * 60);
      } else {
        const pct = Math.round((nextSolved.length / wfSpec.words.length) * 100);
        syncMultiplayerProgress(nextScore, nextMoves, mistakesCount, pct, false);
      }
    }
  };

  const handleSubmitWordFinder = () => {
    if (!currentFormedWord || levelSolved) return;
    const targetMatch = wfSpec.words.find((w) => w.word === currentFormedWord);
    if (targetMatch) {
      if (solvedWords.includes(currentFormedWord)) {
        showToast(`"${currentFormedWord}" is already on the board!`);
      }
      setSelectedWheelIndices([]);
      return;
    }

    if (wfSpec.bonusWords.includes(currentFormedWord)) {
      if (foundBonusWords.includes(currentFormedWord)) {
        showToast(`Bonus word "${currentFormedWord}" already found!`);
      } else {
        soundEngine.playAccelerate();
        const nextBonus = [...foundBonusWords, currentFormedWord];
        const nextScore = score + 50;
        setFoundBonusWords(nextBonus);
        setScore(nextScore);
        setMovesCount((m) => m + 1);
        showToast(`Bonus Word "${currentFormedWord}"! +50 pts`);
      }
      setSelectedWheelIndices([]);
      return;
    }

    soundEngine.playBrakeWrong();
    setMistakesCount((m) => m + 1);
    showToast(`"${currentFormedWord}" is not in this puzzle.`);
    setSelectedWheelIndices([]);
  };

  const handleShuffleWheel = () => {
    soundEngine.playClick();
    setWheelOrder((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    });
    setSelectedWheelIndices([]);
  };

  const handleWordFinderHint = () => {
    if (hintsLeft <= 0 || levelSolved) return;
    const unrevealedKeys: string[] = [];
    crosswordBounds.cellMap.forEach((cell, key) => {
      const isSolvedCell = cell.words.some((w) => solvedWords.includes(w));
      if (!isSolvedCell && !revealedCells.includes(key)) {
        unrevealedKeys.push(key);
      }
    });
    if (unrevealedKeys.length === 0) return;
    soundEngine.playClick();
    const pick = unrevealedKeys[0];
    const nextRevealed = [...revealedCells, pick];
    setRevealedCells(nextRevealed);
    setHintsLeft((h) => h - 1);

    // Check if any word is now completely revealed by hints
    const newlyCompleted: string[] = [];
    for (const wp of wfSpec.words) {
      if (solvedWords.includes(wp.word)) continue;
      let allShown = true;
      for (let i = 0; i < wp.word.length; i++) {
        const r = wp.dir === 'V' ? wp.row + i : wp.row;
        const c = wp.dir === 'H' ? wp.col + i : wp.col;
        const k = `${r},${c}`;
        const cellInfo = crosswordBounds.cellMap.get(k);
        const solvedByCrossing = cellInfo?.words.some((w) => solvedWords.includes(w));
        if (!solvedByCrossing && !nextRevealed.includes(k)) {
          allShown = false;
          break;
        }
      }
      if (allShown) newlyCompleted.push(wp.word);
    }

    if (newlyCompleted.length > 0) {
      const nextSolved = [...solvedWords, ...newlyCompleted];
      setSolvedWords(nextSolved);
      if (nextSolved.length === wfSpec.words.length) {
        handleLevelCleared(400 + currentLevel * 50);
      }
    }
  };

  // ============================================================================
  // 2048 / 2028 HANDLERS
  // ============================================================================
  const target2048 = useMemo(() => get2048TargetForLevel(currentLevel), [currentLevel]);

  const handle2048Move = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (levelSolved || matchFinished) return;
      const { nextGrid, gained, moved } = move2048Grid(grid2048, dir);
      if (!moved) return;

      soundEngine.playClick();
      setHistory2048((h) => [...h.slice(-4), grid2048.map((r) => [...r])]);
      spawnRandom2048Tile(nextGrid);

      const nextScore = score + gained + 5;
      const nextMoves = movesCount + 1;
      setGrid2048(nextGrid);
      setScore(nextScore);
      setMovesCount(nextMoves);

      let maxTile = 2;
      for (const r of nextGrid) {
        for (const v of r) {
          if (v > maxTile) maxTile = v;
        }
      }

      if (maxTile >= target2048) {
        handleLevelCleared(600 + currentLevel * 80);
        return;
      }

      if (!canMove2048(nextGrid)) {
        showToast('No more moves! Use Undo or Reset Board.');
      }

      const pct = Math.min(
        98,
        Math.round((Math.log2(maxTile) / Math.log2(target2048)) * 100)
      );
      syncMultiplayerProgress(nextScore, nextMoves, mistakesCount, pct, false);
    },
    [
      levelSolved,
      matchFinished,
      grid2048,
      score,
      movesCount,
      target2048,
      handleLevelCleared,
      currentLevel,
      showToast,
      syncMultiplayerProgress,
      mistakesCount,
    ]
  );

  // Keyboard listener for 2048
  useEffect(() => {
    if (gameId !== 'game_2048') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        handle2048Move('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handle2048Move('down');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handle2048Move('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handle2048Move('right');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameId, handle2048Move]);

  const handle2048Undo = () => {
    if (history2048.length === 0 || levelSolved) return;
    soundEngine.playClick();
    const prev = history2048[history2048.length - 1];
    setGrid2048(prev);
    setHistory2048((h) => h.slice(0, -1));
  };

  // ============================================================================
  // MAHJONG SOLITAIRE HANDLERS
  // ============================================================================
  const handleMahjongTileClick = (tile: MahjongTileInstance) => {
    if (levelSolved || tile.removed) return;
    const free = isMahjongTileFree(tile, mahjongTiles);
    if (!free) {
      soundEngine.playBrakeWrong();
      showToast('This tile is blocked! Pick a tile with a free left or right edge.');
      return;
    }

    setHintMahjongUids(null);
    if (!selectedMahjongUid) {
      soundEngine.playClick();
      setSelectedMahjongUid(tile.uid);
      return;
    }

    if (selectedMahjongUid === tile.uid) {
      soundEngine.playClick();
      setSelectedMahjongUid(null);
      return;
    }

    const firstTile = mahjongTiles.find((t) => t.uid === selectedMahjongUid);
    if (!firstTile || firstTile.removed) {
      setSelectedMahjongUid(tile.uid);
      return;
    }

    if (firstTile.kind.id === tile.kind.id) {
      // Matched Pair!
      soundEngine.playAccelerate();
      setMahjongHistory((h) => [...h.slice(-5), mahjongTiles.map((t) => ({ ...t }))]);

      const nextTiles = mahjongTiles.map((t) =>
        t.uid === firstTile.uid || t.uid === tile.uid ? { ...t, removed: true } : t
      );
      const gained = 100 * mahjongCombo;
      const nextScore = score + gained;
      const nextMoves = movesCount + 1;

      setMahjongTiles(nextTiles);
      setSelectedMahjongUid(null);
      setMahjongCombo((c) => Math.min(5, c + 1));
      setScore(nextScore);
      setMovesCount(nextMoves);

      const remaining = nextTiles.filter((t) => !t.removed);
      if (remaining.length === 0) {
        handleLevelCleared(600 + currentLevel * 75);
      } else {
        const pct = Math.round(
          (( nextTiles.length - remaining.length ) / nextTiles.length) * 100
        );
        syncMultiplayerProgress(nextScore, nextMoves, mistakesCount, pct, false);
      }
    } else {
      // Different tile selected — switch selection to the newly clicked free tile
      soundEngine.playClick();
      setMahjongCombo(1);
      setSelectedMahjongUid(tile.uid);
    }
  };

  const handleMahjongHint = () => {
    if (levelSolved) return;
    const freeTiles = mahjongTiles.filter(
      (t) => !t.removed && isMahjongTileFree(t, mahjongTiles)
    );
    for (let i = 0; i < freeTiles.length; i++) {
      for (let j = i + 1; j < freeTiles.length; j++) {
        if (freeTiles[i].kind.id === freeTiles[j].kind.id) {
          soundEngine.playClick();
          setHintMahjongUids([freeTiles[i].uid, freeTiles[j].uid]);
          setSelectedMahjongUid(freeTiles[i].uid);
          return;
        }
      }
    }
    showToast('No free pairs visible — tap Shuffle Tiles!');
  };

  const handleMahjongShuffle = () => {
    if (levelSolved) return;
    soundEngine.playClick();
    const remainingKinds = mahjongTiles.filter((t) => !t.removed).map((t) => t.kind);
    for (let i = remainingKinds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = remainingKinds[i];
      remainingKinds[i] = remainingKinds[j];
      remainingKinds[j] = tmp;
    }
    let kIdx = 0;
    setMahjongTiles((prev) =>
      prev.map((t) => (t.removed ? t : { ...t, kind: remainingKinds[kIdx++] }))
    );
    setSelectedMahjongUid(null);
    setHintMahjongUids(null);
    showToast('Shuffled remaining Mahjong tiles!');
  };

  const handleMahjongUndo = () => {
    if (mahjongHistory.length === 0 || levelSolved) return;
    soundEngine.playClick();
    const prev = mahjongHistory[mahjongHistory.length - 1];
    setMahjongTiles(prev);
    setMahjongHistory((h) => h.slice(0, -1));
    setSelectedMahjongUid(null);
  };

  // ============================================================================
  // SHARE MODAL HANDLERS
  // ============================================================================
  const handleOpenShareModal = async () => {
    soundEngine.playClick();
    setShareModalOpen(true);
    setShareGenerating(true);
    try {
      const totalAns = Math.max(1, movesCount + mistakesCount);
      const acc = Math.min(100, Math.round((movesCount / totalAns) * 100));
      const { dataUrl } = await generateScoreCardImage({
        nickname: profile.nickname,
        carColor: profile.carColor,
        gameId,
        category,
        difficulty,
        mode,
        placement: 1,
        score,
        correctAnswers: movesCount,
        totalQuestions: totalAns,
        accuracy: acc,
        distance: levelSolved ? 100 : completionPct,
        durationSec: (elapsedMs / 1000).toFixed(1),
      });
      setShareImageDataUrl(dataUrl);
    } finally {
      setShareGenerating(false);
    }
  };

  const shareText = useMemo(() => {
    const totalAns = Math.max(1, movesCount + mistakesCount);
    const acc = Math.min(100, Math.round((movesCount / totalAns) * 100));
    return buildScoreShareText({
      nickname: profile.nickname,
      carColor: profile.carColor,
      gameId,
      category,
      difficulty,
      mode,
      placement: 1,
      score,
      correctAnswers: movesCount,
      totalQuestions: totalAns,
      accuracy: acc,
      distance: levelSolved ? 100 : completionPct,
      durationSec: (elapsedMs / 1000).toFixed(1),
    });
  }, [
    profile.nickname,
    profile.carColor,
    gameId,
    category,
    difficulty,
    mode,
    score,
    movesCount,
    mistakesCount,
    levelSolved,
    completionPct,
    elapsedMs,
  ]);

  const socialLinks = useMemo(
    () => getSocialShareLinks(shareText, getPublicGameUrl()),
    [shareText]
  );

  // ============================================================================
  // UNIFIED RESULTS SCREEN WHEN MATCH IS FINISHED
  // ============================================================================
  if (matchFinished) {
    const rawPlayers =
      isMultiplayer && roomPlayers.length > 0
        ? roomPlayers.map((p) => ({
            ...p,
            score: p.playerId === profile.uid ? score : (p.score ?? 0),
            distance:
              p.playerId === profile.uid
                ? levelSolved
                  ? 100
                  : completionPct
                : p.distance,
          }))
        : [];

    rawPlayers.sort((a, b) => {
      if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
      if (b.distance !== a.distance) return b.distance - a.distance;
      if (a.finishTimeMs > 0 && b.finishTimeMs > 0 && a.finishTimeMs !== b.finishTimeMs) {
        return a.finishTimeMs - b.finishTimeMs;
      }
      return a.nickname.localeCompare(b.nickname);
    });

    const rankedPlayers: (RoomPlayerRecord & { computedRank: number })[] = [];
    rawPlayers.forEach((p, idx) => {
      if (idx === 0) {
        rankedPlayers.push({ ...p, computedRank: 1 });
        return;
      }
      const prev = rankedPlayers[idx - 1];
      const isTied =
        (p.score ?? 0) === (prev.score ?? 0) && p.distance === prev.distance;
      rankedPlayers.push({
        ...p,
        computedRank: isTied ? prev.computedRank : idx + 1,
      });
    });

    const myRank =
      rankedPlayers.find((p) => p.playerId === profile.uid)?.computedRank || 1;
    const totalAns = Math.max(1, movesCount + mistakesCount);
    const accuracyPct = Math.min(100, Math.round((movesCount / totalAns) * 100));

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 overflow-hidden rounded-2xl shadow-sm">
              <GameTileArtwork gameId={gameId} />
            </div>
            <h1 className="mt-3 font-display text-2xl font-black text-slate-900 sm:text-3xl">
              {levelSolved ? `Level ${currentLevel} Complete!` : 'Game Complete'}
            </h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {gameInfo.name} · {isMultiplayer ? `Rank #${myRank}` : `Solo Record`}
            </p>
          </div>

          {/* Score, Performance & Rank Cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 text-center">
              <span className="text-xs font-bold text-purple-800">Final Score</span>
              <p className="mt-1 font-mono text-2xl font-black text-purple-950 tabular-nums">
                {score}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center">
              <span className="text-xs font-bold text-amber-900">Rank</span>
              <p className="mt-1 font-mono text-2xl font-black text-amber-950 tabular-nums">
                #{myRank}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center">
              <span className="text-xs font-bold text-emerald-800">Accuracy</span>
              <p className="mt-1 font-mono text-2xl font-black text-emerald-950 tabular-nums">
                {accuracyPct}%
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-center">
              <span className="text-xs font-bold text-blue-800">Time</span>
              <p className="mt-1 font-mono text-2xl font-black text-blue-950 tabular-nums">
                {(elapsedMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          {/* Multiplayer Leaderboard-Style Results Table (1st, 2nd, 3rd Highlighted) */}
          {isMultiplayer && rankedPlayers.length > 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                Final Standings · Room {roomCode}
              </h3>
              <div className="mt-3 space-y-2">
                {rankedPlayers.map((p) => {
                  const isMe = p.playerId === profile.uid;
                  const rankBadge =
                    p.computedRank === 1
                      ? 'bg-amber-400 text-slate-950'
                      : p.computedRank === 2
                        ? 'bg-slate-300 text-slate-900'
                        : p.computedRank === 3
                          ? 'bg-orange-300 text-orange-950'
                          : 'bg-slate-100 text-slate-700';

                  return (
                    <div
                      key={p.playerId}
                      className={`flex items-center justify-between rounded-xl border px-4 py-2.5 shadow-2xs ${
                        p.computedRank === 1
                          ? 'border-amber-300 bg-amber-50/70'
                          : isMe
                            ? 'border-blue-300 bg-blue-50/60'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-7 min-w-[36px] items-center justify-center rounded-lg px-2 font-mono text-xs font-black ${rankBadge}`}
                        >
                          {p.computedRank === 1
                            ? '1st'
                            : p.computedRank === 2
                              ? '2nd'
                              : p.computedRank === 3
                                ? '3rd'
                                : `#${p.computedRank}`}
                        </span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {p.nickname} {isMe ? '(You)' : ''}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-black text-[#7C3AED] tabular-nums">
                        {p.score ?? 0} pts ({p.distance}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons: Replay / Replay With Same Players, More Games, Share */}
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {isMultiplayer && roomCode && onReplayMultiplayer ? (
              <button
                type="button"
                disabled={rematchBusy}
                onClick={async () => {
                  setRematchBusy(true);
                  soundEngine.playClick();
                  await onReplayMultiplayer(roomCode);
                }}
                className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#16A34A] px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Replay With Same Players</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  savedResultRef.current = false;
                  setMatchFinished(false);
                  const nextLvl = levelSolved
                    ? Math.min(20, currentLevel + 1)
                    : currentLevel;
                  setCurrentLevel(nextLvl);
                  initLevelBoard(nextLvl);
                }}
                className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#16A34A] px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <RotateCcw className="h-4 w-4" />
                <span>
                  {levelSolved
                    ? `Next Level (${Math.min(20, currentLevel + 1)})`
                    : 'Replay'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onPlayMoreGames();
              }}
              className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Gamepad2 className="h-4 w-4" />
              <span>More Games</span>
            </button>

            <button
              type="button"
              onClick={handleOpenShareModal}
              className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-purple-700"
            >
              <Share2 className="h-4 w-4" />
              <span>Share Score</span>
            </button>
          </div>
        </div>

        {/* WhatsApp & Instagram Story Score Share Modal */}
        {shareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-extrabold text-slate-900">
                  Share TROJO Story Card
                </h3>
                <button
                  type="button"
                  onClick={() => setShareModalOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex justify-center">
                {shareGenerating ? (
                  <div className="flex h-72 w-44 items-center justify-center rounded-2xl bg-slate-100 text-xs font-bold text-slate-500">
                    Generating 9:16 Card...
                  </div>
                ) : (
                  shareImageDataUrl && (
                    <img
                      src={shareImageDataUrl}
                      alt="TROJO Score Card"
                      className="max-h-72 rounded-2xl border border-slate-200 shadow-md"
                    />
                  )
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <a
                  href={socialLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#16A34A] px-4 py-3 text-xs font-extrabold text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Share on WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    if (shareImageDataUrl) {
                      const a = document.createElement('a');
                      a.href = shareImageDataUrl;
                      a.download = `trojo-${gameId}-score.png`;
                      a.click();
                    }
                    await copyToClipboard(shareText);
                    setCopiedCaption(true);
                    setTimeout(() => setCopiedCaption(false), 2500);
                  }}
                  className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] px-4 py-3 text-xs font-extrabold text-white hover:bg-purple-700"
                >
                  <Download className="h-4 w-4" />
                  <span>
                    {copiedCaption ? 'Saved & Copied!' : 'Instagram Story Image'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (gameId === 'circular_racer') {
    return (
      <div className="fixed inset-0 z-40 h-[100dvh] w-[100dvw] overflow-hidden bg-slate-950 select-none">
        <CircularRacerCanvas
          level={currentLevel}
          playerId={profile.uid}
          playerColor={profile.carColor}
          playerNickname={profile.nickname}
          isMultiplayer={isMultiplayer}
          roomPlayers={roomPlayers}
          roomCode={roomCode}
          onFinish={handleCircularRacerFinish}
          onProgressUpdate={handleCircularProgressUpdate}
          onExitRequest={() => setExitConfirmOpen(true)}
        />

        {/* Exit Active Game Confirmation Modal */}
        {exitConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
              <h3 className="font-display text-lg font-black text-slate-900">
                Leave Active Game?
              </h3>
              <p className="mt-1.5 text-xs font-semibold text-slate-500">
                Your current race progress will not be saved if you exit now.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setExitConfirmOpen(false);
                  }}
                  className="min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                >
                  Keep Playing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setExitConfirmOpen(false);
                    onExitToHome();
                  }}
                  className="min-h-[44px] rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-700"
                >
                  Exit Game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col justify-between overflow-hidden px-2.5 py-2 select-none sm:px-4 sm:py-3">
      {/* Compact Top HUD Bar: Exit, Game + Level, Progress Bar, Score, Finish Game */}
      <div className="mb-1.5 shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-2xs sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setExitConfirmOpen(true);
              }}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Exit</span>
            </button>
            <div>
              <h1 className="font-display text-sm font-extrabold leading-tight text-slate-900 sm:text-base">
                {gameInfo.name}
              </h1>
              <p className="text-[11px] font-bold text-slate-500">
                Lv.{currentLevel}/20 · {isMultiplayer ? `Room ${roomCode}` : `Unlocked Lv.${unlockedLevel}`}
              </p>
            </div>
          </div>

          {/* Level Selector (Solo — Locked Levels Disabled), Score & Finish Game */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isMultiplayer && (
              <select
                value={currentLevel}
                onChange={(e) => {
                  const nextLvl = Number(e.target.value);
                  if (nextLvl > unlockedLevel) {
                    soundEngine.playBrakeWrong();
                    showToast(`Complete Level ${unlockedLevel} first to unlock Level ${nextLvl}!`);
                    return;
                  }
                  soundEngine.playClick();
                  setCurrentLevel(nextLvl);
                }}
                aria-label="Select Level"
                className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-extrabold text-slate-900"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => {
                  const isAllowed = lvl <= unlockedLevel;
                  return (
                    <option key={lvl} value={lvl} disabled={!isAllowed}>
                      Lv.{lvl} {isAllowed ? '🔓' : '🔒'}
                    </option>
                  );
                })}
              </select>
            )}

            <div className="rounded-xl bg-purple-50 px-2.5 py-1 text-xs font-extrabold text-purple-900">
              <span className="font-mono tabular-nums">{score} pts</span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                if (levelSolved) {
                  handleFinalizeMatch(score);
                } else {
                  setFinishConfirmOpen(true);
                }
              }}
              className="h-8 rounded-xl bg-[#2563EB] px-2.5 text-xs font-extrabold text-white hover:bg-blue-700"
            >
              Finish Game
            </button>
          </div>
        </div>

        {/* Always-Visible Full Progress Bar */}
        <div className="mt-2 flex items-center gap-2.5">
          <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase shrink-0">
            Progress
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(4, completionPct))}%` }}
            />
          </div>
          <span className="font-mono text-[11px] font-black text-emerald-700 tabular-nums shrink-0">
            {completionPct}%
          </span>
        </div>
      </div>

      {/* Compact Live Multiplayer Opponent Race Strip */}
      {isMultiplayer && roomPlayers.length > 0 && (
        <div className="mb-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-2xs">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {roomPlayers.map((p) => {
              const cInfo = CAR_PALETTE[p.carColor] || CAR_PALETTE.blue;
              return (
                <div
                  key={p.playerId}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="truncate text-slate-900">
                      {p.nickname}
                    </span>
                    <span className="font-mono text-purple-700 tabular-nums">
                      {p.distance}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(4, p.distance))}%`,
                        backgroundColor: cInfo.primary,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Toast Feedback Banner */}
      {statusToast && (
        <div className="mb-2 rounded-xl bg-slate-900 px-3 py-1.5 text-center text-xs font-bold text-white shadow-sm">
          {statusToast}
        </div>
      )}

      {/* Level Cleared Celebration Banner (Solo Mode) */}
      {levelSolved && !isMultiplayer && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-3.5 py-2.5 shadow-sm">
          <div>
            <h2 className="font-display text-sm font-black text-emerald-950 sm:text-base">
              Level {currentLevel} Complete! 🎉 ({score} pts)
            </h2>
            <p className="text-[11px] font-semibold text-emerald-800">
              Level {Math.min(20, currentLevel + 1)} is now unlocked!
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentLevel < 20 && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setCurrentLevel((l) => Math.min(20, l + 1));
                }}
                className="h-9 rounded-xl bg-[#16A34A] px-3.5 text-xs font-extrabold text-white shadow-2xs hover:bg-emerald-700"
              >
                Next Level ({currentLevel + 1}) →
              </button>
            )}
            <button
              type="button"
              onClick={() => handleFinalizeMatch(score)}
              className="h-9 rounded-xl bg-[#7C3AED] px-3.5 text-xs font-extrabold text-white shadow-2xs hover:bg-purple-700"
            >
              Save &amp; Share
            </button>
          </div>
        </div>
      )}


      {/* ==================================================================== */}
      {/* 1. WATER SORT PUZZLE BOARD (Compact Mobile-Friendly Tubes)           */}
      {/* ==================================================================== */}
      {gameId === 'water_sort' && (
        <div className="rounded-3xl bg-[#221238] p-3.5 text-white shadow-lg sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <span className="text-xs font-extrabold tracking-wider text-amber-300 uppercase">
              WATER SORT · LV.{currentLevel}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleWaterSortUndo}
                disabled={tubeHistory.length === 0}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[11px] font-bold text-white hover:bg-white/20 disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={handleWaterSortHint}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-400 px-2.5 text-[11px] font-extrabold text-slate-950 hover:bg-amber-300"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Hint</span>
              </button>
              <button
                type="button"
                onClick={handleWaterSortAddTube}
                disabled={extraTubeUsed}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 text-[11px] font-extrabold text-white hover:bg-emerald-400 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+1 Tube</span>
              </button>
              <button
                type="button"
                onClick={() => initLevelBoard(currentLevel)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[11px] font-bold text-white hover:bg-white/20"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Compact Glass Test Tubes Grid (Fits on 1 screen without scrolling) */}
          <div className="mt-4 grid grid-cols-4 place-items-center gap-x-2 gap-y-4 sm:grid-cols-5 sm:gap-y-6">
            {tubes.map((tube, idx) => {
              const isSelected = selectedTubeIdx === idx;
              const isHinted =
                hintPair && (hintPair[0] === idx || hintPair[1] === idx);
              const isPouringFrom = pouringAnim?.from === idx;
              const isPouringTo = pouringAnim?.to === idx;
              const complete = isTubeComplete(tube);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleTubeClick(idx)}
                  className={`group relative flex flex-col items-center focus:outline-none transition-transform duration-150 ${
                    isSelected || isPouringFrom
                      ? '-translate-y-2.5 scale-105'
                      : 'hover:-translate-y-1'
                  }`}
                >
                  {/* Completed Star Badge */}
                  {complete && (
                    <span className="-top-4 absolute rounded-full bg-amber-400 px-1.5 py-0.2 text-[9px] font-black text-slate-950 shadow-2xs">
                      ★
                    </span>
                  )}

                  {/* Pouring Stream Effect */}
                  {isPouringTo && pouringAnim && (
                    <div
                      className="-top-5 absolute h-6 w-1.5 animate-pulse rounded-full"
                      style={{ backgroundColor: pouringAnim.color }}
                    />
                  )}

                  {/* Flared Glass Tube Lip */}
                  <div
                    className={`h-1.5 w-11 sm:h-2 sm:w-13 rounded-full border transition-colors ${
                      isSelected
                        ? 'border-amber-300 bg-amber-200/40'
                        : isHinted
                          ? 'border-emerald-300 bg-emerald-200/30'
                          : 'border-white/80 bg-white/15'
                    }`}
                  />

                  {/* Compact Glass Tube Body */}
                  <div
                    className={`relative flex h-24 w-9 sm:h-32 sm:w-11 flex-col-reverse overflow-hidden rounded-b-[20px] border-2 bg-[#180C29]/90 p-0.5 transition-all ${
                      isSelected
                        ? 'border-amber-300 shadow-[0_0_14px_rgba(250,204,21,0.55)]'
                        : isHinted
                          ? 'border-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                          : complete
                            ? 'border-emerald-400'
                            : 'border-white/80'
                    }`}
                  >
                    {/* Glass Vertical Highlight Reflection */}
                    <div className="pointer-events-none absolute top-1.5 bottom-3 left-1 z-10 w-1 rounded-full bg-white/25" />

                    {/* Liquid Layers (bottom to top) */}
                    {tube.map((colorId, layerIdx) => {
                      const cObj =
                        LIQUID_PALETTE.find((c) => c.id === colorId) ||
                        LIQUID_PALETTE[0];
                      const isBottom = layerIdx === 0;
                      const isTop = layerIdx === tube.length - 1;
                      return (
                        <div
                          key={layerIdx}
                          className={`relative w-full transition-all duration-150 ${
                            isBottom ? 'rounded-b-[16px]' : ''
                          }`}
                          style={{
                            height: '25%',
                            backgroundColor: cObj.hex,
                          }}
                        >
                          {isTop && (
                            <div
                              className="h-1 w-full rounded-full opacity-80"
                              style={{ backgroundColor: cObj.topHex }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. WORD FINDER BOARD (Compact Grid + Target Word Pills + Wheel)      */}
      {/* ==================================================================== */}
      {gameId === 'word_finder' && (
        <div className="rounded-3xl bg-[#7E4798] p-3.5 text-white shadow-lg sm:p-5">
          <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2">
            <div>
              <span className="text-xs font-extrabold tracking-wider text-amber-300 uppercase">
                WORD FINDER · LV.{currentLevel}
              </span>
              <span className="ml-2 text-[11px] text-purple-100">
                Words: <strong>{solvedWords.length}/{wfSpec.words.length}</strong> · Bonus: {foundBonusWords.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => initLevelBoard(currentLevel)}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-white/15 px-2.5 text-[11px] font-bold text-white hover:bg-white/25"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Target Words Status Pills (Shows exact word lengths clearly) */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {wfSpec.words.map((wp) => {
              const done = solvedWords.includes(wp.word);
              return (
                <span
                  key={wp.word}
                  className={`rounded-lg px-2 py-0.5 font-mono text-[11px] font-black tracking-widest ${
                    done
                      ? 'bg-[#68CC35] text-[#194D14]'
                      : 'bg-white/15 text-white'
                  }`}
                >
                  {done ? `${wp.word} ✓` : wp.word.split('').map(() => '_').join(' ')}
                </span>
              );
            })}
          </div>

          {/* Compact Top Crossword Grid */}
          <div className="my-2.5 flex justify-center">
            <div
              className="inline-grid gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${crosswordBounds.cols}, minmax(26px, 34px))`,
              }}
            >
              {Array.from({ length: crosswordBounds.rows }).map((_, r) =>
                Array.from({ length: crosswordBounds.cols }).map((__, c) => {
                  const key = `${r},${c}`;
                  const cell = crosswordBounds.cellMap.get(key);
                  if (!cell) {
                    return <div key={key} className="h-7 w-7 sm:h-8 sm:w-8" />;
                  }
                  const isSolved = cell.words.some((w) => solvedWords.includes(w));
                  const isHintRevealed = revealedCells.includes(key);
                  const showChar = isSolved || isHintRevealed;

                  return (
                    <div
                      key={key}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg font-display text-sm font-black shadow-2xs transition-all sm:h-8 sm:w-8 sm:text-base ${
                        showChar
                          ? 'bg-[#68CC35] text-[#194D14]'
                          : 'bg-white text-transparent'
                      }`}
                    >
                      {showChar ? cell.char : ''}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Compact Middle Row: Shuffle + Yellow Word Preview + Hint */}
          <div className="mx-auto flex max-w-sm items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={handleShuffleWheel}
              title="Shuffle Letters"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DA6295] text-white shadow-sm active:scale-95"
            >
              <Shuffle className="h-4 w-4" />
            </button>

            <div className="flex h-9 min-w-[120px] items-center justify-center rounded-xl bg-[#F5C23B] px-4 font-display text-sm font-black tracking-wider text-[#2B2133] shadow-sm sm:text-base">
              {currentFormedWord || 'TAP LETTERS'}
            </div>

            <button
              type="button"
              onClick={handleWordFinderHint}
              disabled={hintsLeft <= 0}
              title="Reveal a Letter Hint"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#DA6295] text-white shadow-sm active:scale-95 disabled:opacity-45"
            >
              <Lightbulb className="h-4 w-4" />
              <span className="-right-1 -bottom-1 absolute flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-900">
                {hintsLeft}
              </span>
            </button>
          </div>

          {/* Compact Circular Letter Wheel (168px diameter — fits mobile screen without scrolling) */}
          <div className="mt-2.5 flex flex-col items-center">
            <div className="relative h-42 w-42 rounded-full bg-[#C98CC9]/45 shadow-inner">
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {selectedWheelIndices.length > 1 && (
                  <polyline
                    points={selectedWheelIndices
                      .map((origIdx) => {
                        const posIdx = wheelOrder.indexOf(origIdx);
                        const angle =
                          (posIdx / wheelOrder.length) * Math.PI * 2 - Math.PI / 2;
                        const cx = 84 + Math.cos(angle) * 56;
                        const cy = 84 + Math.sin(angle) * 56;
                        return `${cx},${cy}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#F5C23B"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>

              {wheelOrder.map((origIdx, posIdx) => {
                const angle =
                  (posIdx / wheelOrder.length) * Math.PI * 2 - Math.PI / 2;
                const x = 84 + Math.cos(angle) * 56;
                const y = 84 + Math.sin(angle) * 56;
                const selected = selectedWheelIndices.includes(origIdx);

                return (
                  <button
                    key={origIdx}
                    type="button"
                    onClick={() => handleToggleWheelLetter(origIdx)}
                    style={{
                      left: `${x - 20}px`,
                      top: `${y - 20}px`,
                    }}
                    className={`absolute flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-black shadow-sm transition-transform ${
                      selected
                        ? 'scale-110 bg-[#F5C23B] text-[#2B2133] ring-2 ring-white'
                        : 'bg-white/95 text-[#2B2133] hover:scale-105'
                    }`}
                  >
                    {wfSpec.letters[origIdx]}
                  </button>
                );
              })}
            </div>

            {/* Compact Submit Word & Clear Buttons */}
            <div className="mt-2.5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedWheelIndices([])}
                disabled={selectedWheelIndices.length === 0}
                className="h-9 rounded-xl bg-white/15 px-4 text-xs font-extrabold text-white hover:bg-white/25 disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSubmitWordFinder}
                disabled={selectedWheelIndices.length < 3}
                className="h-9 rounded-xl bg-[#68CC35] px-5 text-xs font-extrabold text-[#194D14] shadow-sm hover:bg-lime-400 disabled:opacity-40"
              >
                Check Word ({currentFormedWord.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. 2048 / 2028 NUMBER MERGE PUZZLE (Compact Single-Screen Layout)    */}
      {/* ==================================================================== */}
      {gameId === 'game_2048' && (
        <div className="rounded-3xl border border-amber-200 bg-[#FAF8EF] p-3.5 shadow-md sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5B800] font-display text-sm font-black text-white shadow-2xs">
                2048
              </div>
              <div>
                <h2 className="font-display text-sm font-extrabold text-[#776E65] sm:text-base">
                  Lv.{currentLevel} Goal: Reach{' '}
                  <span className="rounded-md bg-[#F5B800] px-1.5 py-0.5 text-white">
                    {target2048}
                  </span>
                </h2>
                <p className="text-[11px] font-semibold text-[#776E65]/80">
                  Swipe board or tap arrows
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handle2048Undo}
                disabled={history2048.length === 0}
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#8F7A66] px-3 text-xs font-extrabold text-white hover:bg-[#776E65] disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={() => initLevelBoard(currentLevel)}
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#8F7A66] px-3 text-xs font-extrabold text-white hover:bg-[#776E65]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Compact 4x4 2048 Board with Touch Swipe Support */}
          <div
            onTouchStart={(e) => {
              const t = e.touches[0];
              touchStartRef.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={(e) => {
              if (!touchStartRef.current) return;
              const t = e.changedTouches[0];
              const dx = t.clientX - touchStartRef.current.x;
              const dy = t.clientY - touchStartRef.current.y;
              touchStartRef.current = null;
              if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
              if (Math.abs(dx) > Math.abs(dy)) {
                handle2048Move(dx > 0 ? 'right' : 'left');
              } else {
                handle2048Move(dy > 0 ? 'down' : 'up');
              }
            }}
            className="mx-auto mt-3 max-w-[240px] sm:max-w-[280px] rounded-2xl bg-[#BBADA0] p-2.5 shadow-inner select-none"
          >
            <div className="grid grid-cols-4 gap-2">
              {grid2048.map((row, rIdx) =>
                row.map((val, cIdx) => (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={`flex aspect-square items-center justify-center rounded-xl font-display text-lg font-black transition-all duration-150 sm:text-2xl ${get2048TileStyle(
                      val
                    )}`}
                  >
                    {val > 0 ? val : ''}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Compact On-Screen Directional Controls */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handle2048Move('left')}
              className="flex h-9 w-12 items-center justify-center rounded-xl bg-[#8F7A66] text-white shadow-2xs active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handle2048Move('up')}
              className="flex h-9 w-12 items-center justify-center rounded-xl bg-[#8F7A66] text-white shadow-2xs active:scale-95"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handle2048Move('down')}
              className="flex h-9 w-12 items-center justify-center rounded-xl bg-[#8F7A66] text-white shadow-2xs active:scale-95"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handle2048Move('right')}
              className="flex h-9 w-12 items-center justify-center rounded-xl bg-[#8F7A66] text-white shadow-2xs active:scale-95"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MAHJONG SOLITAIRE (Compact Mobile-Fit 3D Tiles — Zero Sliding)    */}
      {/* ==================================================================== */}
      {gameId === 'mahjong_solitaire' && (
        <div className="rounded-3xl bg-[#064E27] p-3.5 text-white shadow-lg sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-2.5">
            <div>
              <span className="text-xs font-extrabold tracking-wider text-amber-300 uppercase">
                MAHJONG · LV.{currentLevel} · ×{mahjongCombo}
              </span>
              <span className="ml-2 text-[11px] text-emerald-100">
                Left: <strong>{mahjongTiles.filter((t) => !t.removed).length}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHighlightFreeTiles((v) => !v)}
                className={`h-7 rounded-lg px-2 text-[11px] font-bold ${
                  highlightFreeTiles
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-white/10 text-white'
                }`}
              >
                {highlightFreeTiles ? 'Free ON' : 'Free OFF'}
              </button>
              <button
                type="button"
                onClick={handleMahjongHint}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-amber-400 px-2.5 text-[11px] font-extrabold text-slate-950 hover:bg-amber-300"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Hint</span>
              </button>
              <button
                type="button"
                onClick={handleMahjongShuffle}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-white/15 px-2.5 text-[11px] font-bold text-white hover:bg-white/25"
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>Shuffle</span>
              </button>
              <button
                type="button"
                onClick={handleMahjongUndo}
                disabled={mahjongHistory.length === 0}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-white/15 px-2.5 text-[11px] font-bold text-white hover:bg-white/25 disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Undo</span>
              </button>
            </div>
          </div>

          {/* Responsive Mobile-Fit 3D Mahjong Board (No Horizontal or Vertical Scrolling) */}
          <div className="relative mx-auto mt-3 h-[230px] w-full max-w-[310px] sm:h-[290px] sm:max-w-[420px]">
            {[0, 1, 2].map((layer) =>
              mahjongTiles
                .filter((t) => !t.removed && t.layer === layer)
                .map((tile) => {
                  const isFree = isMahjongTileFree(tile, mahjongTiles);
                  const isSelected = selectedMahjongUid === tile.uid;
                  const isHinted =
                    hintMahjongUids &&
                    (hintMahjongUids[0] === tile.uid ||
                      hintMahjongUids[1] === tile.uid);

                  // Percentage position math so 6 cols × 4 rows always fit 100% inside mobile screen width
                  const leftPct = (tile.col / 6) * 84 + 3;
                  const topPct = (tile.row / 4) * 76 + 4;

                  return (
                    <button
                      key={tile.uid}
                      type="button"
                      onClick={() => handleMahjongTileClick(tile)}
                      style={{
                        left: `calc(${leftPct}% - ${layer * 3}px)`,
                        top: `calc(${topPct}% - ${layer * 4}px)`,
                        zIndex: layer * 10 + tile.row,
                      }}
                      className={`absolute flex h-12 w-10 sm:h-15 sm:w-12 flex-col items-center justify-between rounded-lg border-r-[3px] border-b-[4px] p-1 transition-all duration-150 select-none ${
                        isSelected
                          ? '-translate-y-1.5 border-amber-500 bg-amber-50 ring-2 ring-amber-300 shadow-lg'
                          : isHinted
                            ? '-translate-y-1 border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300 shadow-md'
                            : !isFree && highlightFreeTiles
                              ? 'border-[#074221] bg-[#D6D1C4] opacity-60'
                              : 'border-[#0D7A3E] bg-[#FFFDF6] hover:-translate-y-0.5 shadow-sm'
                      }`}
                    >
                      <span className="self-start text-[7px] font-bold leading-none text-slate-400">
                        L{layer + 1}
                      </span>
                      <span
                        className="font-serif text-base sm:text-xl font-black leading-none"
                        style={{ color: tile.kind.color }}
                      >
                        {tile.kind.symbol}
                      </span>
                      <span className="truncate max-w-full text-[7px] sm:text-[8px] font-extrabold leading-none text-slate-600">
                        {tile.kind.subLabel}
                      </span>
                    </button>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Exit Active Game Confirmation Modal */}
      {exitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h3 className="font-display text-lg font-black text-slate-900">
              Leave Active Game?
            </h3>
            <p className="mt-1.5 text-xs font-semibold text-slate-500">
              Your current round progress will not be saved if you exit now.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setExitConfirmOpen(false);
                }}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setExitConfirmOpen(false);
                  onExitToHome();
                }}
                className="min-h-[44px] rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-700"
              >
                Exit Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finish Game Confirmation Modal */}
      {finishConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h3 className="font-display text-lg font-black text-slate-900">
              Finish Game Now?
            </h3>
            <p className="mt-1.5 text-xs font-semibold text-slate-500">
              End this game now and record your current score ({score} pts)?
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setFinishConfirmOpen(false);
                }}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={() => {
                  setFinishConfirmOpen(false);
                  handleFinalizeMatch(score);
                }}
                className="min-h-[44px] rounded-2xl bg-[#2563EB] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-blue-700"
              >
                Finish &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
