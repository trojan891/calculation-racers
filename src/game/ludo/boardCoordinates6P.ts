import { LudoColor } from './types';

export interface Point2D {
  x: number;
  y: number;
}

// Clockwise order of players around the 6-player board
export const LUDO_6P_ORDER: LudoColor[] = [
  'red',    // 0: Bottom (South, 90°)
  'green',  // 1: Bottom-Left (SW, 150°)
  'yellow', // 2: Top-Left (NW, 210°)
  'blue',   // 3: Top (North, 270°)
  'orange', // 4: Top-Right (NE, 330°)
  'purple', // 5: Bottom-Right (SE, 30°)
];

export const CX = 750;
export const CY = 750;

// Angles in radians for each arm
export const ARM_ANGLES_RAD: Record<LudoColor, number> = {
  red: (90 * Math.PI) / 180,
  green: (150 * Math.PI) / 180,
  yellow: (210 * Math.PI) / 180,
  blue: (270 * Math.PI) / 180,
  orange: (330 * Math.PI) / 180,
  purple: (30 * Math.PI) / 180,
};

// Radius of base room centers from board center
export const R_BASE = 575;

// Exact center coordinates for each of the 6 Base Rooms
export const BASE_ROOM_CENTERS_6P: Record<LudoColor, Point2D> = (() => {
  const map: Record<LudoColor, Point2D> = {} as Record<LudoColor, Point2D>;
  LUDO_6P_ORDER.forEach((col) => {
    const angle = ARM_ANGLES_RAD[col];
    map[col] = {
      x: Math.round(CX + R_BASE * Math.cos(angle)),
      y: Math.round(CY + R_BASE * Math.sin(angle)),
    };
  });
  return map;
})();

// 4 Token slot circles inside each base room
export const BASE_SLOTS_6P: Record<LudoColor, Point2D[]> = (() => {
  const res: Record<LudoColor, Point2D[]> = {} as Record<LudoColor, Point2D[]>;
  LUDO_6P_ORDER.forEach((col) => {
    const center = BASE_ROOM_CENTERS_6P[col];
    res[col] = [
      { x: center.x - 48, y: center.y - 15 },
      { x: center.x + 48, y: center.y - 15 },
      { x: center.x - 48, y: center.y + 55 },
      { x: center.x + 48, y: center.y + 55 },
    ];
  });
  return res;
})();

// Starting track index for each color
export const COLOR_START_INDEX_6P: Record<LudoColor, number> = {
  red: 0,
  green: 12,
  yellow: 24,
  blue: 36,
  orange: 48,
  purple: 60,
};

// Safe star indices
export const STAR_INDICES_6P = new Set([
  0, 8, 12, 20, 24, 32, 36, 44, 48, 56, 60, 68,
]);

// 72 Track Cells around the board perimeter
// Each arm i spans cells [i*12 .. i*12 + 11].
// Cell i*12 is placed right at the doorway of Room i (start tile)!
export const TRACK_COORDS_6P: Point2D[] = (() => {
  const points: Point2D[] = [];
  const TOTAL_CELLS = 72;
  const CELLS_PER_ARM = 12;

  for (let arm = 0; arm < 6; arm++) {
    const startAngle = (90 + arm * 60) * (Math.PI / 180);
    const endAngle = (90 + (arm + 1) * 60) * (Math.PI / 180);

    for (let c = 0; c < CELLS_PER_ARM; c++) {
      const frac = c / CELLS_PER_ARM;
      const angle = startAngle + frac * (endAngle - startAngle);

      // Track radius smoothly contours between base rooms and corner notches
      // Near c=0 (doorway of base room), radius is ~410 (right at the doorstep of the room)
      // Along the corner turn, radius gently sweeps outward to ~430
      const r = 405 + 20 * Math.sin(frac * Math.PI);
      const px = CX + r * Math.cos(angle);
      const py = CY + r * Math.sin(angle);
      points.push({ x: Math.round(px), y: Math.round(py) });
    }
  }

  return points;
})();

// Home Runway (5 steps towards center along each arm's radial axis)
export const HOME_STRETCH_COORDS_6P: Record<LudoColor, Point2D[]> = (() => {
  const res: Record<LudoColor, Point2D[]> = {} as Record<LudoColor, Point2D[]>;

  LUDO_6P_ORDER.forEach((col) => {
    const angle = ARM_ANGLES_RAD[col];
    const steps: Point2D[] = [];
    // 5 steps from radius 350 down to 155 towards center
    for (let s = 1; s <= 5; s++) {
      const r = 350 - (s - 1) * 45;
      steps.push({
        x: Math.round(CX + r * Math.cos(angle)),
        y: Math.round(CY + r * Math.sin(angle)),
      });
    }
    res[col] = steps;
  });

  return res;
})();

// Center destination for each color (inner wedge point in the central home hexagon)
export const HOME_CENTER_COORDS_6P: Record<LudoColor, Point2D> = (() => {
  const res: Record<LudoColor, Point2D> = {} as Record<LudoColor, Point2D>;

  LUDO_6P_ORDER.forEach((col) => {
    const angle = ARM_ANGLES_RAD[col];
    res[col] = {
      x: Math.round(CX + 75 * Math.cos(angle)),
      y: Math.round(CY + 75 * Math.sin(angle)),
    };
  });

  return res;
})();
