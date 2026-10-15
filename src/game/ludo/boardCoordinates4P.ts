import { LudoColor } from './types';

export interface GridCoord {
  col: number; // 0..14
  row: number; // 0..14
}

// 52 Perimeter Track cells in clockwise order
// 0 is Red Start, 13 is Green Start, 26 is Yellow Start, 39 is Blue Start
export const TRACK_COORDS_4P: GridCoord[] = [
  // 0..4: Red exit going right along row 6 (directly under Top-Left RED base)
  { col: 1, row: 6 }, // 0: Red Start (Safe) - Doorway right outside Red Base!
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },

  // 5..10: Going up left arm to top-left corner
  { col: 6, row: 5 },
  { col: 6, row: 4 },
  { col: 6, row: 3 },
  { col: 6, row: 2 }, // 8: Star (Safe)
  { col: 6, row: 1 },
  { col: 6, row: 0 },

  // 11..12: Across top edge
  { col: 7, row: 0 },
  { col: 8, row: 0 },

  // 13..17: Green exit going down along col 8 (directly left of Top-Right GREEN base)
  { col: 8, row: 1 }, // 13: Green Start (Safe) - Doorway right outside Green Base!
  { col: 8, row: 2 },
  { col: 8, row: 3 },
  { col: 8, row: 4 },
  { col: 8, row: 5 },

  // 18..23: Going right across top-right arm
  { col: 9, row: 6 },
  { col: 10, row: 6 },
  { col: 11, row: 6 },
  { col: 12, row: 6 }, // 21: Star (Safe)
  { col: 13, row: 6 },
  { col: 14, row: 6 },

  // 24..25: Across right edge
  { col: 14, row: 7 },
  { col: 14, row: 8 },

  // 26..30: Yellow exit going left along row 8 (directly above Bottom-Right YELLOW base)
  { col: 13, row: 8 }, // 26: Yellow Start (Safe) - Doorway right outside Yellow Base!
  { col: 12, row: 8 },
  { col: 11, row: 8 },
  { col: 10, row: 8 },
  { col: 9, row: 8 },

  // 31..36: Going down right arm to bottom-right corner
  { col: 8, row: 9 },
  { col: 8, row: 10 },
  { col: 8, row: 11 },
  { col: 8, row: 12 }, // 34: Star (Safe)
  { col: 8, row: 13 },
  { col: 8, row: 14 },

  // 37..38: Across bottom edge
  { col: 7, row: 14 },
  { col: 6, row: 14 },

  // 39..43: Blue exit going up along col 6 (directly right of Bottom-Left BLUE base)
  { col: 6, row: 13 }, // 39: Blue Start (Safe) - Doorway right outside Blue Base!
  { col: 6, row: 12 },
  { col: 6, row: 11 },
  { col: 6, row: 10 },
  { col: 6, row: 9 },

  // 44..49: Going left across bottom-left arm
  { col: 5, row: 8 },
  { col: 4, row: 8 },
  { col: 3, row: 8 },
  { col: 2, row: 8 }, // 47: Star (Safe)
  { col: 1, row: 8 },
  { col: 0, row: 8 },

  // 50..51: Up left outer edge to complete the circuit
  { col: 0, row: 7 },
  { col: 0, row: 6 },
];

// Safe Star Indices on outer track
export const STAR_INDICES_4P = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Start track index for each color
export const COLOR_START_INDEX_4P: Record<LudoColor, number> = {
  red: 0,     // Doorway at col 1, row 6
  green: 13,  // Doorway at col 8, row 1
  yellow: 26, // Doorway at col 13, row 8
  blue: 39,   // Doorway at col 6, row 13
  orange: 0,
  purple: 0,
};

// Home Runway (5 steps before center) for each color
export const HOME_STRETCH_COORDS_4P: Record<LudoColor, GridCoord[]> = {
  red: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
  ],
  green: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
  ],
  yellow: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
  ],
  blue: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
  ],
  orange: [],
  purple: [],
};

// Center triangle apex points (Center Home is cols 6..8, rows 6..8)
export const HOME_CENTER_COORDS_4P: Record<LudoColor, { x: number; y: number }> = {
  red: { x: 670, y: 750 },
  green: { x: 750, y: 670 },
  yellow: { x: 830, y: 750 },
  blue: { x: 750, y: 830 },
  orange: { x: 750, y: 750 },
  purple: { x: 750, y: 750 },
};

// Base slots for each color (4 token positions inside their respective base room)
export const BASE_SLOTS_4P: Record<LudoColor, { x: number; y: number }[]> = {
  // RED: Top-Left Base (cols 0..5, rows 0..5) -> x: 0..600, y: 0..600
  red: [
    { x: 200, y: 200 },
    { x: 400, y: 200 },
    { x: 200, y: 400 },
    { x: 400, y: 400 },
  ],
  // GREEN: Top-Right Base (cols 9..14, rows 0..5) -> x: 900..1500, y: 0..600
  green: [
    { x: 1100, y: 200 },
    { x: 1300, y: 200 },
    { x: 1100, y: 400 },
    { x: 1300, y: 400 },
  ],
  // YELLOW: Bottom-Right Base (cols 9..14, rows 9..14) -> x: 900..1500, y: 900..1500
  yellow: [
    { x: 1100, y: 1100 },
    { x: 1300, y: 1100 },
    { x: 1100, y: 1300 },
    { x: 1300, y: 1300 },
  ],
  // BLUE: Bottom-Left Base (cols 0..5, rows 9..14) -> x: 0..600, y: 900..1500
  blue: [
    { x: 200, y: 1100 },
    { x: 400, y: 1100 },
    { x: 200, y: 1300 },
    { x: 400, y: 1300 },
  ],
  orange: [],
  purple: [],
};
