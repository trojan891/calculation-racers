export type LudoColor = 'red' | 'green' | 'yellow' | 'blue' | 'orange' | 'purple';

export type LudoPlayerCount = 2 | 3 | 4 | 5 | 6;

export type LudoGameMode = 'solo' | 'local';

export type LudoBoardType = '4P' | '6P';

export interface LudoColorConfig {
  id: LudoColor;
  name: string;
  primary: string;
  dark: string;
  light: string;
  glow: string;
  accent: string;
  startTrackIndex: number;
}

export const LUDO_COLORS_4P: LudoColor[] = ['red', 'green', 'yellow', 'blue'];
export const LUDO_COLORS_6P: LudoColor[] = [
  'red',
  'green',
  'yellow',
  'blue',
  'orange',
  'purple',
];

export const LUDO_COLOR_INFO: Record<LudoColor, LudoColorConfig> = {
  red: {
    id: 'red',
    name: 'Red',
    primary: '#EF4444',
    dark: '#B91C1C',
    light: '#FEE2E2',
    glow: 'rgba(239, 68, 68, 0.45)',
    accent: '#DC2626',
    startTrackIndex: 0,
  },
  green: {
    id: 'green',
    name: 'Green',
    primary: '#10B981',
    dark: '#047857',
    light: '#D1FAE5',
    glow: 'rgba(16, 185, 129, 0.45)',
    accent: '#059669',
    startTrackIndex: 13,
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    primary: '#F59E0B',
    dark: '#D97706',
    light: '#FEF3C7',
    glow: 'rgba(245, 158, 11, 0.45)',
    accent: '#B45309',
    startTrackIndex: 26,
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    primary: '#3B82F6',
    dark: '#1D4ED8',
    light: '#DBEAFE',
    glow: 'rgba(59, 130, 246, 0.45)',
    accent: '#2563EB',
    startTrackIndex: 39,
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    primary: '#F97316',
    dark: '#C2410C',
    light: '#FFEDD5',
    glow: 'rgba(249, 115, 22, 0.45)',
    accent: '#EA580C',
    startTrackIndex: 48,
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    primary: '#A855F7',
    dark: '#7E22CE',
    light: '#F3E8FF',
    glow: 'rgba(168, 85, 247, 0.45)',
    accent: '#9333EA',
    startTrackIndex: 60,
  },
};

export interface LudoToken {
  id: string; // e.g. 'red-0'
  color: LudoColor;
  tokenIndex: number; // 0..3
  state: 'base' | 'track' | 'home_stretch' | 'finished';
  // Step count from deployment:
  // -1: base
  // 0..50: on track (51 track steps total)
  // 51..55: on home stretch (5 steps)
  // 56: reached center Home!
  stepCount: number;
}

export interface LudoPlayer {
  color: LudoColor;
  name: string;
  isBot: boolean;
  tokens: LudoToken[];
  rank: number; // 0 if playing, 1, 2, 3.. when completed
  homeCount: number;
}
