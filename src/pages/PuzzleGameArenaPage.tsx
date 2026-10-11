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

const WORD_FINDER_LEVELS: WordFinderLevelSpec[] = [
  {
    level: 1,
    letters: ['P', 'U', 'R', 'E', 'E'],
    words: [
      { word: 'PUREE', row: 0, col: 0, dir: 'V' },
      { word: 'PURE', row: 2, col: 0, dir: 'H' },
      { word: 'PEER', row: 0, col: 0, dir: 'H' },
    ],
    bonusWords: ['PER', 'REP', 'PEE', 'RUE', 'ERE'],
  },
  {
    level: 2,
    letters: ['S', 'T', 'A', 'R', 'T'],
    words: [
      { word: 'START', row: 0, col: 1, dir: 'V' },
      { word: 'STAR', row: 0, col: 1, dir: 'H' },
      { word: 'TART', row: 1, col: 1, dir: 'H' },
      { word: 'ARTS', row: 2, col: 1, dir: 'H' },
      { word: 'RATS', row: 3, col: 1, dir: 'H' },
    ],
    bonusWords: ['SAT', 'RAT', 'TAR', 'ART', 'STAT'],
  },
  {
    level: 3,
    letters: ['P', 'L', 'A', 'N', 'E', 'T'],
    words: [
      { word: 'PLANET', row: 0, col: 0, dir: 'H' },
      { word: 'PLANT', row: 0, col: 0, dir: 'V' },
      { word: 'PLANE', row: 2, col: 0, dir: 'H' },
      { word: 'PLATE', row: 4, col: 0, dir: 'H' },
      { word: 'LATE', row: 0, col: 1, dir: 'V' },
      { word: 'NEAT', row: 0, col: 3, dir: 'V' },
    ],
    bonusWords: ['PLAN', 'PALE', 'TALE', 'LEAP', 'PEAL', 'LANE', 'LEAN', 'TAPE', 'PEAT'],
  },
  {
    level: 4,
    letters: ['S', 'P', 'A', 'R', 'K', 'S'],
    words: [
      { word: 'SPARKS', row: 0, col: 0, dir: 'H' },
      { word: 'SPARK', row: 0, col: 0, dir: 'V' },
      { word: 'PARKS', row: 1, col: 0, dir: 'H' },
      { word: 'PARK', row: 2, col: 0, dir: 'H' },
      { word: 'ARK', row: 3, col: 0, dir: 'H' },
      { word: 'PASS', row: 1, col: 0, dir: 'V' },
    ],
    bonusWords: ['ASK', 'ASKS', 'SAP', 'SPA', 'RAP', 'RAPS', 'SPAR'],
  },
  {
    level: 5,
    letters: ['B', 'R', 'I', 'G', 'H', 'T'],
    words: [
      { word: 'BRIGHT', row: 0, col: 0, dir: 'H' },
      { word: 'RIGHT', row: 1, col: 1, dir: 'H' },
      { word: 'BIRTH', row: 0, col: 0, dir: 'V' },
      { word: 'GRIT', row: 0, col: 3, dir: 'V' },
      { word: 'HIGH', row: 0, col: 4, dir: 'V' },
    ],
    bonusWords: ['BIT', 'BIG', 'HIT', 'RIG', 'RIB', 'GIRT', 'TRIG'],
  },
  {
    level: 6,
    letters: ['C', 'R', 'O', 'W', 'N', 'S'],
    words: [
      { word: 'CROWNS', row: 0, col: 0, dir: 'H' },
      { word: 'CROWN', row: 0, col: 0, dir: 'V' },
      { word: 'CROWS', row: 2, col: 0, dir: 'H' },
      { word: 'CORN', row: 0, col: 0, dir: 'H' },
      { word: 'SNOW', row: 0, col: 5, dir: 'V' },
      { word: 'WORN', row: 3, col: 0, dir: 'H' },
    ],
    bonusWords: ['CROW', 'COW', 'COWS', 'ROW', 'ROWS', 'NOW', 'OWN', 'OWNS', 'SON', 'WON'],
  },
  {
    level: 7,
    letters: ['F', 'L', 'I', 'G', 'H', 'T'],
    words: [
      { word: 'FLIGHT', row: 0, col: 0, dir: 'H' },
      { word: 'LIGHT', row: 0, col: 1, dir: 'V' },
      { word: 'FIGHT', row: 0, col: 0, dir: 'V' },
      { word: 'GIFT', row: 3, col: 0, dir: 'H' },
      { word: 'LIFT', row: 0, col: 1, dir: 'H' },
    ],
    bonusWords: ['FIT', 'FIG', 'LIT', 'HIT', 'HILT', 'GILT', 'FLIT'],
  },
  {
    level: 8,
    letters: ['S', 'T', 'R', 'E', 'A', 'M'],
    words: [
      { word: 'STREAM', row: 0, col: 0, dir: 'H' },
      { word: 'MASTER', row: 0, col: 5, dir: 'V' },
      { word: 'STEAM', row: 0, col: 0, dir: 'V' },
      { word: 'SMART', row: 4, col: 0, dir: 'H' },
      { word: 'TEAMS', row: 1, col: 0, dir: 'H' },
    ],
    bonusWords: ['TEAM', 'MEAT', 'MATE', 'TAME', 'STAR', 'STARE', 'RATES', 'TEARS', 'MARES'],
  },
  {
    level: 9,
    letters: ['G', 'A', 'R', 'D', 'E', 'N'],
    words: [
      { word: 'GARDEN', row: 0, col: 0, dir: 'H' },
      { word: 'DANGER', row: 0, col: 3, dir: 'V' },
      { word: 'GRAND', row: 0, col: 0, dir: 'V' },
      { word: 'GRADE', row: 2, col: 0, dir: 'H' },
      { word: 'RANGE', row: 1, col: 0, dir: 'H' },
    ],
    bonusWords: ['DARE', 'DEAR', 'READ', 'GEAR', 'RAGE', 'NEAR', 'EARN', 'AGED', 'DRAG'],
  },
  {
    level: 10,
    letters: ['C', 'A', 'S', 'T', 'L', 'E'],
    words: [
      { word: 'CASTLE', row: 0, col: 0, dir: 'H' },
      { word: 'SCALE', row: 0, col: 2, dir: 'V' },
      { word: 'SLATE', row: 2, col: 0, dir: 'H' },
      { word: 'LEAST', row: 4, col: 0, dir: 'H' },
      { word: 'TALES', row: 0, col: 3, dir: 'V' },
    ],
    bonusWords: ['CAST', 'LATE', 'SALE', 'SEAL', 'SEAT', 'EAST', 'CATS', 'ACTS', 'LACE'],
  },
];

// Upgrade Level 1 so all 4 words intersect cleanly on a 5x5 grid
WORD_FINDER_LEVELS[0] = {
  level: 1,
  letters: ['P', 'U', 'R', 'E', 'E'],
  words: [
    { word: 'PUREE', row: 0, col: 0, dir: 'V' },
    { word: 'PEE', row: 0, col: 0, dir: 'H' },
    { word: 'PURE', row: 2, col: 0, dir: 'H' },
    { word: 'PEER', row: 4, col: 0, dir: 'H' },
  ],
  bonusWords: ['PER', 'REP', 'RUE', 'ERE'],
};

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
  const isMultiplayer = (mode === '2p' || mode === '4p') && Boolean(roomCode);
  const [room, setRoom] = useState<RoomRecord | null>(initialRoom || null);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayerRecord[]>(initialPlayers);

  const gameInfo = TROJO_GAME_MAP[gameId] || TROJO_GAME_MAP.water_sort;
  const seedBase = roomCode || 'SOLO_TROJO';

  // Level & Score State
  const [currentLevel, setCurrentLevel] = useState<number>(() => {
    if (isMultiplayer) {
      return difficulty === 'hard' ? 8 : difficulty === 'medium' ? 4 : 1;
    }
    return Math.max(1, Math.min(20, initialLevel));
  });
  const [unlockedLevel, setUnlockedLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`trojo_unlocked_lvl_${gameId}`);
      return saved ? Math.max(1, Number(saved)) : 3;
    } catch {
      return 3;
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
  const savedResultRef = useRef(false);

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareImageDataUrl, setShareImageDataUrl] = useState<string | null>(null);
  const [shareGenerating, setShareGenerating] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

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
        placement = Math.min(4, higher + 1);
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
    const sortedPlayers = [...roomPlayers].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0)
    );

    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center text-center">
            <GameTileArtwork gameId={gameId} className="h-24 w-24" />
            <span className="mt-3 text-xs font-extrabold tracking-wider text-[#2563EB] uppercase">
              TROJO — A Fun Nagar · {gameInfo.name}
            </span>
            <h1 className="mt-1 font-display text-3xl font-extrabold text-slate-900">
              {levelSolved ? `Level ${currentLevel} Complete!` : 'Game Summary'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Great job, <strong>{profile.nickname}</strong>!
            </p>
          </div>

          {/* Score Metrics */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 text-center">
              <span className="text-xs font-bold text-purple-800">Total Points</span>
              <p className="mt-1 font-mono text-2xl font-black text-purple-950 tabular-nums sm:text-3xl">
                {score}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center">
              <span className="text-xs font-bold text-emerald-800">Level Reached</span>
              <p className="mt-1 font-mono text-2xl font-black text-emerald-950 tabular-nums sm:text-3xl">
                Lv.{currentLevel}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-center">
              <span className="text-xs font-bold text-blue-800">Time</span>
              <p className="mt-1 font-mono text-2xl font-black text-blue-950 tabular-nums sm:text-3xl">
                {(elapsedMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>

          {/* Multiplayer Standings if 2P / 4P */}
          {isMultiplayer && sortedPlayers.length > 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                Multiplayer Room Standings ({roomCode})
              </h3>
              <div className="mt-3 space-y-2">
                {sortedPlayers.map((p, idx) => (
                  <div
                    key={p.playerId}
                    className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-black text-slate-700">
                        #{idx + 1}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {p.nickname}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-extrabold text-purple-700 tabular-nums">
                      {p.score ?? 0} pts ({p.distance}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3 Mandatory Solid Action Buttons */}
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleOpenShareModal}
              className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-purple-700"
            >
              <Share2 className="h-4 w-4" />
              <span>Share Score</span>
            </button>

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
                <span>Replay Same Players</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  savedResultRef.current = false;
                  setMatchFinished(false);
                  const nextLvl = levelSolved ? Math.min(20, currentLevel + 1) : currentLevel;
                  setCurrentLevel(nextLvl);
                  initLevelBoard(nextLvl);
                }}
                className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#16A34A] px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <RotateCcw className="h-4 w-4" />
                <span>{levelSolved ? `Play Level ${Math.min(20, currentLevel + 1)}` : 'Replay Level'}</span>
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
              <span>Play More Games</span>
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

  return (
    <div className="mx-auto max-w-4xl px-3 py-5 sm:px-6">
      {/* Top Bar: Game Name, Level Selector, Points, and Exit */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-xs sm:px-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onExitToHome();
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="font-display text-lg font-extrabold text-slate-900 sm:text-xl">
              {gameInfo.name}
            </h1>
            <p className="text-xs font-bold text-slate-500">
              Level {currentLevel} of 20 · {isMultiplayer ? `Room ${roomCode}` : 'Solo Puzzle'}
            </p>
          </div>
        </div>

        {/* Level Selector (Solo) & Score Display */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!isMultiplayer && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-500">Level:</label>
              <select
                value={currentLevel}
                onChange={(e) => {
                  soundEngine.playClick();
                  setCurrentLevel(Number(e.target.value));
                }}
                className="min-h-[38px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-900"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Level {lvl} {lvl <= unlockedLevel ? '🔓' : '⭐'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-xl bg-purple-50 px-3.5 py-2 text-xs font-extrabold text-purple-900">
            Score: <span className="font-mono tabular-nums">{score} pts</span>
          </div>

          <button
            type="button"
            onClick={() => handleFinalizeMatch(score)}
            className="min-h-[38px] rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
          >
            Finish &amp; Save
          </button>
        </div>
      </div>

      {/* Live Multiplayer Opponent Race Strip */}
      {isMultiplayer && roomPlayers.length > 0 && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="mb-2 flex items-center justify-between text-xs font-extrabold text-slate-600">
            <span>LIVE MULTIPLAYER PUZZLE RACE ({roomCode})</span>
            <span>First to 100% or Highest Score Wins!</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {roomPlayers.map((p) => {
              const cInfo = CAR_PALETTE[p.carColor] || CAR_PALETTE.blue;
              return (
                <div
                  key={p.playerId}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-900">
                      {p.nickname} {p.playerId === profile.uid ? '(You)' : ''}
                    </span>
                    <span className="font-mono text-purple-700 tabular-nums">
                      {p.score ?? 0} pts · {p.distance}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
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

      {/* Toast Feedback Banner */}
      {statusToast && (
        <div className="mb-3 rounded-2xl bg-slate-900 px-4 py-2.5 text-center text-xs font-bold text-white shadow-md">
          {statusToast}
        </div>
      )}

      {/* Level Cleared Celebration Banner (Solo Mode) */}
      {levelSolved && !isMultiplayer && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-5 shadow-md">
          <div>
            <span className="text-xs font-extrabold tracking-wider text-emerald-700 uppercase">
              Puzzle Solved!
            </span>
            <h2 className="font-display text-2xl font-black text-emerald-950">
              Level {currentLevel} Complete! 🎉
            </h2>
            <p className="text-xs font-semibold text-emerald-800">
              Current Score: <strong>{score} pts</strong> · Continue to Level{' '}
              {Math.min(20, currentLevel + 1)} or save your score to the leaderboard!
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {currentLevel < 20 && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setCurrentLevel((l) => Math.min(20, l + 1));
                }}
                className="min-h-[46px] rounded-2xl bg-[#16A34A] px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-700"
              >
                Next Level (Level {currentLevel + 1}) →
              </button>
            )}
            <button
              type="button"
              onClick={() => handleFinalizeMatch(score)}
              className="min-h-[46px] rounded-2xl bg-[#7C3AED] px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-purple-700"
            >
              Finish &amp; Share Score
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. WATER SORT PUZZLE BOARD                                           */}
      {/* ==================================================================== */}
      {gameId === 'water_sort' && (
        <div className="rounded-[32px] bg-[#221238] p-5 text-white shadow-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-xs font-extrabold tracking-wider text-amber-300 uppercase">
                WATER SORT · LEVEL {currentLevel}
              </span>
              <p className="mt-0.5 text-xs text-purple-200">
                Tap a tube to pick it up, then tap another tube with the same top color or an empty tube to pour!
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleWaterSortUndo}
                disabled={tubeHistory.length === 0}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={handleWaterSortHint}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-300"
              >
                <Lightbulb className="h-4 w-4" />
                <span>Hint</span>
              </button>
              <button
                type="button"
                onClick={handleWaterSortAddTube}
                disabled={extraTubeUsed}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-emerald-400 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                <span>+1 Tube</span>
              </button>
              <button
                type="button"
                onClick={() => initLevelBoard(currentLevel)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Glass Test Tubes Grid */}
          <div className="mt-10 grid grid-cols-3 place-items-center gap-y-10 sm:grid-cols-4 md:grid-cols-5">
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
                  className={`group relative flex flex-col items-center focus:outline-none transition-transform duration-200 ${
                    isSelected || isPouringFrom
                      ? '-translate-y-5 scale-105'
                      : 'hover:-translate-y-1.5'
                  }`}
                >
                  {/* Completed Star Badge */}
                  {complete && (
                    <span className=" -top-7 absolute rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-sm">
                      ★ DONE
                    </span>
                  )}

                  {/* Pouring Stream Effect */}
                  {isPouringTo && pouringAnim && (
                    <div
                      className="-top-8 absolute h-10 w-2 animate-pulse rounded-full"
                      style={{ backgroundColor: pouringAnim.color }}
                    />
                  )}

                  {/* Flared Glass Tube Lip */}
                  <div
                    className={`h-2.5 w-16 rounded-full border-2 transition-colors ${
                      isSelected
                        ? 'border-amber-300 bg-amber-200/40'
                        : isHinted
                          ? 'border-emerald-300 bg-emerald-200/30'
                          : 'border-white/80 bg-white/15'
                    }`}
                  />

                  {/* Glass Tube Body */}
                  <div
                    className={`relative flex h-44 w-14 flex-col-reverse overflow-hidden rounded-b-[28px] border-[3px] bg-[#180C29]/90 p-1 transition-all ${
                      isSelected
                        ? 'border-amber-300 shadow-[0_0_20px_rgba(250,204,21,0.55)]'
                        : isHinted
                          ? 'border-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.5)]'
                          : complete
                            ? 'border-emerald-400'
                            : 'border-white/80'
                    }`}
                  >
                    {/* Glass Vertical Highlight Reflection */}
                    <div className="pointer-events-none absolute top-2 bottom-4 left-1.5 z-10 w-1.5 rounded-full bg-white/25" />

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
                          className={`relative w-full transition-all duration-200 ${
                            isBottom ? 'rounded-b-[22px]' : ''
                          }`}
                          style={{
                            height: '25%',
                            backgroundColor: cObj.hex,
                          }}
                        >
                          {isTop && (
                            <div
                              className="h-1.5 w-full rounded-full opacity-80"
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
      {/* 2. WORD FINDER BOARD (Crossword Grid + Letter Wheel)                 */}
      {/* ==================================================================== */}
      {gameId === 'word_finder' && (
        <div className="rounded-[32px] bg-[#7E4798] p-5 text-white shadow-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
            <div>
              <span className="text-xs font-extrabold tracking-wider text-amber-300 uppercase">
                WORD FINDER · LEVEL {currentLevel}
              </span>
              <p className="text-xs text-purple-100">
                Words Found: <strong>{solvedWords.length}</strong> /{' '}
                {wfSpec.words.length} · Bonus Words: {foundBonusWords.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => initLevelBoard(currentLevel)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Level</span>
            </button>
          </div>

          {/* Top Crossword Grid */}
          <div className="my-6 flex justify-center overflow-x-auto py-2">
            <div
              className="inline-grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${crosswordBounds.cols}, minmax(40px, 48px))`,
              }}
            >
              {Array.from({ length: crosswordBounds.rows }).map((_, r) =>
                Array.from({ length: crosswordBounds.cols }).map((__, c) => {
                  const key = `${r},${c}`;
                  const cell = crosswordBounds.cellMap.get(key);
                  if (!cell) {
                    return <div key={key} className="h-11 w-11 sm:h-12 sm:w-12" />;
                  }
                  const isSolved = cell.words.some((w) => solvedWords.includes(w));
                  const isHintRevealed = revealedCells.includes(key);
                  const showChar = isSolved || isHintRevealed;

                  return (
                    <div
                      key={key}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl font-display text-xl font-black shadow-sm transition-all sm:h-12 sm:w-12 ${
                        showChar
                          ? 'bg-[#68CC35] text-[#194D14] scale-100'
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

          {/* Middle Row: Shuffle Button + Yellow Word Preview Pill + Hint Button */}
          <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-2">
            <button
              type="button"
              onClick={handleShuffleWheel}
              title="Shuffle Letters"
              className="flex h-13 w-13 items-center justify-center rounded-full bg-[#DA6295] text-white shadow-md transition-transform hover:scale-105 active:scale-95"
            >
              <Shuffle className="h-6 w-6" />
            </button>

            <div className="flex min-h-[44px] min-w-[140px] items-center justify-center rounded-xl bg-[#F5C23B] px-5 py-2 font-display text-xl font-black tracking-wider text-[#2B2133] shadow-md">
              {currentFormedWord || 'TAP LETTERS'}
            </div>

            <button
              type="button"
              onClick={handleWordFinderHint}
              disabled={hintsLeft <= 0}
              title="Reveal a Letter Hint"
              className="relative flex h-13 w-13 items-center justify-center rounded-full bg-[#DA6295] text-white shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-45"
            >
              <Lightbulb className="h-6 w-6" />
              <span className="-right-1 -bottom-1 absolute flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-slate-900 shadow-xs">
                {hintsLeft}
              </span>
            </button>
          </div>

          {/* Circular Letter Wheel */}
          <div className="mt-6 flex flex-col items-center">
            <div className="relative h-64 w-64 rounded-full bg-[#C98CC9]/45 shadow-inner">
              {/* SVG Connecting Lines between selected wheel nodes */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {selectedWheelIndices.length > 1 && (
                  <polyline
                    points={selectedWheelIndices
                      .map((origIdx) => {
                        const posIdx = wheelOrder.indexOf(origIdx);
                        const angle =
                          (posIdx / wheelOrder.length) * Math.PI * 2 - Math.PI / 2;
                        const cx = 128 + Math.cos(angle) * 82;
                        const cy = 128 + Math.sin(angle) * 82;
                        return `${cx},${cy}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#F5C23B"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>

              {/* Circular Letter Buttons */}
              {wheelOrder.map((origIdx, posIdx) => {
                const angle =
                  (posIdx / wheelOrder.length) * Math.PI * 2 - Math.PI / 2;
                const x = 128 + Math.cos(angle) * 82;
                const y = 128 + Math.sin(angle) * 82;
                const selected = selectedWheelIndices.includes(origIdx);

                return (
                  <button
                    key={origIdx}
                    type="button"
                    onClick={() => handleToggleWheelLetter(origIdx)}
                    style={{
                      left: `${x - 28}px`,
                      top: `${y - 28}px`,
                    }}
                    className={`absolute flex h-14 w-14 items-center justify-center rounded-full font-display text-2xl font-black shadow-md transition-transform ${
                      selected
                        ? 'scale-110 bg-[#F5C23B] text-[#2B2133] ring-4 ring-white'
                        : 'bg-white/90 text-[#2B2133] hover:scale-105'
                    }`}
                  >
                    {wfSpec.letters[origIdx]}
                  </button>
                );
              })}
            </div>

            {/* Submit Word & Clear Buttons */}
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedWheelIndices([])}
                disabled={selectedWheelIndices.length === 0}
                className="min-h-[44px] rounded-2xl bg-white/15 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-white/25 disabled:opacity-40"
              >
                Clear Word
              </button>
              <button
                type="button"
                onClick={handleSubmitWordFinder}
                disabled={selectedWheelIndices.length < 3}
                className="min-h-[44px] rounded-2xl bg-[#68CC35] px-6 py-2.5 text-xs font-extrabold text-[#194D14] shadow-md hover:bg-lime-400 disabled:opacity-40"
              >
                Check Word ({currentFormedWord.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. 2048 / 2028 NUMBER MERGE PUZZLE                                   */}
      {/* ==================================================================== */}
      {gameId === 'game_2048' && (
        <div className="rounded-[32px] border border-amber-200 bg-[#FAF8EF] p-5 shadow-md sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5B800] font-display text-lg font-black text-white shadow-sm">
                2048
              </div>
              <div>
                <h2 className="font-display text-xl font-extrabold text-[#776E65]">
                  Level {currentLevel} Goal: Reach{' '}
                  <span className="rounded-lg bg-[#F5B800] px-2 py-0.5 text-white">
                    {target2048}
                  </span>{' '}
                  Tile
                </h2>
                <p className="text-xs font-semibold text-[#776E65]/80">
                  Swipe on mobile, use Arrow Keys / WASD, or tap the directional buttons below!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handle2048Undo}
                disabled={history2048.length === 0}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#8F7A66] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#776E65] disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={() => initLevelBoard(currentLevel)}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#8F7A66] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#776E65]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>New Board</span>
              </button>
            </div>
          </div>

          {/* 4x4 2048 Board with Touch Swipe Support */}
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
              if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
              if (Math.abs(dx) > Math.abs(dy)) {
                handle2048Move(dx > 0 ? 'right' : 'left');
              } else {
                handle2048Move(dy > 0 ? 'down' : 'up');
              }
            }}
            className="mx-auto mt-6 max-w-[360px] rounded-3xl bg-[#BBADA0] p-3.5 shadow-inner select-none"
          >
            <div className="grid grid-cols-4 gap-3">
              {grid2048.map((row, rIdx) =>
                row.map((val, cIdx) => (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={`flex aspect-square items-center justify-center rounded-2xl font-display text-2xl font-black transition-all duration-150 sm:text-3xl ${get2048TileStyle(
                      val
                    )}`}
                  >
                    {val > 0 ? val : ''}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* On-Screen Directional Pad for Easy One-Hand Phone/Mouse Play */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => handle2048Move('up')}
              className="flex h-12 w-16 items-center justify-center rounded-2xl bg-[#8F7A66] text-white shadow-sm hover:bg-[#776E65] active:scale-95"
            >
              <ArrowUp className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handle2048Move('left')}
                className="flex h-12 w-16 items-center justify-center rounded-2xl bg-[#8F7A66] text-white shadow-sm hover:bg-[#776E65] active:scale-95"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => handle2048Move('down')}
                className="flex h-12 w-16 items-center justify-center rounded-2xl bg-[#8F7A66] text-white shadow-sm hover:bg-[#776E65] active:scale-95"
              >
                <ArrowDown className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => handle2048Move('right')}
                className="flex h-12 w-16 items-center justify-center rounded-2xl bg-[#8F7A66] text-white shadow-sm hover:bg-[#776E65] active:scale-95"
              >
                <ArrowRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. MAHJONG SOLITAIRE 3D LAYERED BOARD                                */}
      {/* ==================================================================== */}
      {gameId === 'mahjong_solitaire' && (
        <div className="rounded-[32px] bg-[#064E27] p-5 text-white shadow-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
            <div>
              <span className="text-xs font-extrabold tracking-wider text-amber-300 uppercase">
                MAHJONG SOLITAIRE · LEVEL {currentLevel} · COMBO ×{mahjongCombo}
              </span>
              <p className="mt-0.5 text-xs text-emerald-100">
                Match pairs of identical free tiles (unblocked on top and open on left or right). Remaining:{' '}
                <strong>{mahjongTiles.filter((t) => !t.removed).length}</strong> tiles
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setHighlightFreeTiles((v) => !v)}
                className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold ${
                  highlightFreeTiles
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-white/10 text-white'
                }`}
              >
                {highlightFreeTiles ? 'Free Tiles Highlighted' : 'Highlight Free'}
              </button>
              <button
                type="button"
                onClick={handleMahjongHint}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300"
              >
                <Lightbulb className="h-4 w-4" />
                <span>Hint</span>
              </button>
              <button
                type="button"
                onClick={handleMahjongShuffle}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25"
              >
                <Shuffle className="h-4 w-4" />
                <span>Shuffle</span>
              </button>
              <button
                type="button"
                onClick={handleMahjongUndo}
                disabled={mahjongHistory.length === 0}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25 disabled:opacity-40"
              >
                <Undo2 className="h-4 w-4" />
                <span>Undo</span>
              </button>
            </div>
          </div>

          {/* 3D Layered Mahjong Felt Table */}
          <div className="relative mx-auto my-6 flex min-h-[390px] items-center justify-center overflow-x-auto py-4">
            <div className="relative h-[350px] w-[360px] sm:h-[380px] sm:w-[460px]">
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

                    // Position math with 3D layer offset
                    const leftPx = tile.col * 68 - layer * 6 + 16;
                    const topPx = tile.row * 86 - layer * 8 + 16;

                    return (
                      <button
                        key={tile.uid}
                        type="button"
                        onClick={() => handleMahjongTileClick(tile)}
                        style={{
                          left: `${leftPx}px`,
                          top: `${topPx}px`,
                          zIndex: layer * 10 + tile.row,
                        }}
                        className={`absolute flex h-20 w-15 flex-col items-center justify-between rounded-xl border-r-4 border-b-[6px] p-1.5 transition-all duration-150 select-none ${
                          isSelected
                            ? '-translate-y-2 border-amber-500 bg-amber-50 ring-3 ring-amber-300 shadow-xl'
                            : isHinted
                              ? '-translate-y-1.5 border-emerald-500 bg-emerald-50 ring-3 ring-emerald-300 shadow-lg'
                              : !isFree && highlightFreeTiles
                                ? 'border-[#074221] bg-[#D6D1C4] opacity-65'
                                : 'border-[#0D7A3E] bg-[#FFFDF6] hover:-translate-y-1 shadow-md'
                        }`}
                      >
                        <span className="self-start text-[9px] font-bold text-slate-400">
                          L{layer + 1}
                        </span>
                        <span
                          className="font-serif text-2xl font-black leading-none"
                          style={{ color: tile.kind.color }}
                        >
                          {tile.kind.symbol}
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-600">
                          {tile.kind.subLabel}
                        </span>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
