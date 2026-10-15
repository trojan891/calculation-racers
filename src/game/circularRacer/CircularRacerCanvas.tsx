import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Flame,
  Gauge,
  Maximize2,
  Minimize2,
  Trophy,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CarColor, CAR_PALETTE, RoomPlayerRecord } from '../types';
import { soundEngine } from '../../lib/sound';

export interface CircularRacerFinishData {
  placement: number;
  finalTimeMs: number;
  bestLapMs: number;
  score: number;
  lapsCompleted: number;
}

interface CircularRacerCanvasProps {
  level: number;
  playerId?: string;
  playerColor?: CarColor;
  playerNickname?: string;
  isMultiplayer?: boolean;
  roomPlayers?: RoomPlayerRecord[];
  roomCode?: string;
  onFinish: (data: CircularRacerFinishData) => void;
  onProgressUpdate?: (progressPct: number, score: number) => void;
  onExitRequest?: () => void;
  onLevelChange?: (level: number) => void;
}

// 8 Distinct Circuits with progressively complex curves, all unlocked
export interface TrackDefinition {
  level: number;
  name: string;
  subtitle: string;
  theme: 'neon' | 'asphalt' | 'cyber' | 'desert' | 'midnight';
  difficulty: 'Easy' | 'Medium' | 'Challenging' | 'Expert';
  trackWidth: number;
  laps: number;
  // Parametric function returning (x, y) for t in [0, 1)
  getPoint: (t: number) => { x: number; y: number };
}

// Helper to precompute an SVG path string from any parametric track function
function buildSvgPathFromFunction(fn: (t: number) => { x: number; y: number }, samples = 36): string {
  const pts: { x: number; y: number }[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < samples; i++) {
    const p = fn(i / samples);
    pts.push(p);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const targetW = 38;
  const targetH = 22;
  const padX = 3;
  const padY = 3;

  return (
    pts
      .map((p, i) => {
        const nx = padX + ((p.x - minX) / w) * targetW;
        const ny = padY + ((p.y - minY) / h) * targetH;
        return `${i === 0 ? 'M' : 'L'}${nx.toFixed(1)},${ny.toFixed(1)}`;
      })
      .join(' ') + ' Z'
  );
}

// ============================================================================
// 8 UNIQUE CIRUITS WITH PROGRESSIVE CURVE COMPLEXITY (ALL UNLOCKED)
// ============================================================================
export const CIRCULAR_TRACKS: TrackDefinition[] = [
  // 1. Neon Oval (Smooth, pure high-speed 2-turn speedway)
  {
    level: 1,
    name: 'Neon Oval',
    subtitle: 'High-Speed Speedway',
    theme: 'neon',
    difficulty: 'Easy',
    trackWidth: 76,
    laps: 3,
    getPoint: (t: number) => {
      const th = t * Math.PI * 2 - Math.PI / 2;
      return {
        x: 420 * Math.cos(th),
        y: 220 * Math.sin(th),
      };
    },
  },
  // 2. Delta Tri-Oval (3 distinct corners with sweeping straights and hairpin)
  {
    level: 2,
    name: 'Delta Tri-Oval',
    subtitle: 'Tri-Corner Speedway',
    theme: 'asphalt',
    difficulty: 'Easy',
    trackWidth: 74,
    laps: 3,
    getPoint: (t: number) => {
      const th = t * Math.PI * 2 - Math.PI / 2;
      const r = 320 + 65 * Math.cos(3 * th + Math.PI / 2);
      return {
        x: r * Math.cos(th) * 1.25,
        y: r * Math.sin(th),
      };
    },
  },
  // 3. Twin Loop / Hourglass (Dual-lobe circuit with central waist chicane)
  {
    level: 3,
    name: 'Twin Loop',
    subtitle: 'Hourglass Chicanes',
    theme: 'cyber',
    difficulty: 'Medium',
    trackWidth: 72,
    laps: 3,
    getPoint: (t: number) => {
      const th = t * Math.PI * 2 - Math.PI / 2;
      return {
        x: 430 * Math.cos(th),
        y: 220 * (Math.sin(th) - 0.25 * Math.sin(3 * th)),
      };
    },
  },
  // 4. Canyon Kidney (Asymmetric GP circuit: long outer sweeper + inward chicane)
  {
    level: 4,
    name: 'Canyon Kidney',
    subtitle: 'Red Rock Curva Grande',
    theme: 'desert',
    difficulty: 'Medium',
    trackWidth: 70,
    laps: 3,
    getPoint: (t: number) => {
      const th = t * Math.PI * 2 - Math.PI / 2;
      return {
        x: 420 * Math.cos(th) + 40 * Math.cos(2 * th + Math.PI / 2),
        y: 220 * Math.sin(th) + 60 * Math.sin(2 * th),
      };
    },
  },
  // 5. Desert Clover (4 rhythmic corners with varying entry radii)
  {
    level: 5,
    name: 'Desert Clover',
    subtitle: 'Quad Apex Rhythm',
    theme: 'midnight',
    difficulty: 'Challenging',
    trackWidth: 68,
    laps: 3,
    getPoint: (t: number) => {
      const th = t * Math.PI * 2 - Math.PI / 2;
      const r = 310 + 65 * Math.cos(4 * th);
      return {
        x: r * Math.cos(th) * 1.4,
        y: r * Math.sin(th) * 0.95,
      };
    },
  },
  // 6. Serpentine S-Twist (Flowing high-speed S-curves and alternating chicanes)
  {
    level: 6,
    name: 'Serpentine Esses',
    subtitle: 'Technical S-Curves',
    theme: 'asphalt',
    difficulty: 'Challenging',
    trackWidth: 66,
    laps: 3,
    getPoint: (t: number) => {
      const th = t * Math.PI * 2 - Math.PI / 2;
      return {
        x: 400 * Math.cos(th) + 65 * Math.sin(3 * th),
        y: 230 * Math.sin(th) + 45 * Math.sin(2 * th),
      };
    },
  },
  // 7. Thunderbolt Circuit (Tight hairpin, technical chicane complex, long DRS straights)
  {
    level: 7,
    name: 'Thunderbolt GP',
    subtitle: 'Apex Hairpin Circuit',
    theme: 'neon',
    difficulty: 'Expert',
    trackWidth: 64,
    laps: 3,
    getPoint: (t: number) => {
      const th = t * Math.PI * 2 - Math.PI / 2;
      const r = 300 + 65 * Math.cos(3 * th + Math.PI / 2) + 30 * Math.cos(5 * th - Math.PI / 2);
      return {
        x: r * Math.cos(th) * 1.5,
        y: r * Math.sin(th) * 0.95,
      };
    },
  },
  // 8. The Apex Omega (Master-tier circuit with iconic Omega loop & technical switchbacks)
  {
    level: 8,
    name: 'The Apex Omega',
    subtitle: 'Championship Grand Prix',
    theme: 'cyber',
    difficulty: 'Expert',
    trackWidth: 62,
    laps: 3,
    getPoint: (t: number) => {
      const th = t * Math.PI * 2 - Math.PI / 2;
      return {
        x: 410 * Math.cos(th) + 65 * Math.sin(3 * th) - 25 * Math.cos(5 * th),
        y: 235 * Math.sin(th) + 45 * Math.cos(2 * th) - 30 * Math.sin(4 * th),
      };
    },
  },
];

// Precompute SVG thumbnail paths for each of the 8 tracks
const TRACK_SVG_PATHS = CIRCULAR_TRACKS.map((tr) => ({
  level: tr.level,
  name: tr.name,
  svgPath: buildSvgPathFromFunction(tr.getPoint),
}));

interface RacerState {
  id: string;
  isPlayer: boolean;
  nickname: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // radians
  speed: number;
  targetSpeed: number;
  laneOffset: number;
  lap: number;
  checkpoint: number;
  lapStartTime: number;
  bestLapMs: number;
  finished: boolean;
  finishTimeMs: number;
  placement: number;
  progressScore: number;
  isBraking?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

interface SkidSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

interface TrackSamplePoint {
  x: number;
  y: number;
  heading: number;
  nx: number;
  ny: number;
  t: number;
}

export const CircularRacerCanvas: React.FC<CircularRacerCanvasProps> = ({
  level,
  playerId = 'player',
  playerColor = 'blue',
  playerNickname = 'You',
  isMultiplayer = false,
  roomPlayers = [],
  roomCode,
  onFinish,
  onProgressUpdate,
  onExitRequest,
  onLevelChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active track index (1..8)
  const activeLevel = Math.max(1, Math.min(8, level || 1));
  const track = CIRCULAR_TRACKS[activeLevel - 1] || CIRCULAR_TRACKS[0];

  // Callback refs to decouple from requestAnimationFrame loop & prevent unneeded resets
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const onProgressUpdateRef = useRef(onProgressUpdate);
  onProgressUpdateRef.current = onProgressUpdate;
  const roomPlayersRef = useRef<RoomPlayerRecord[]>(roomPlayers);
  roomPlayersRef.current = roomPlayers;

  // 360° Virtual Joystick State (Bottom-Left Corner)
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickVectorRef = useRef({ x: 0, y: 0, magnitude: 0, active: false });
  const isPointerDownRef = useRef(false);

  // Brake Button State (Bottom-Right Corner)
  const [isBraking, setIsBraking] = useState(false);
  const isBrakingRef = useRef(false);

  // Keyboard controls ref
  const keysRef = useRef({ up: false, down: false, left: false, right: false });

  // UI state for compact HUD
  const [currentLap, setCurrentLap] = useState(1);
  const [playerPosition, setPlayerPosition] = useState(1);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [lapElapsedMs, setLapElapsedMs] = useState(0);
  const [bestLapMs, setBestLapMs] = useState(0);
  const [countdownText, setCountdownText] = useState<string | null>('3');
  const [raceFinished, setRaceFinished] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sync brake ref
  useEffect(() => {
    isBrakingRef.current = isBraking;
  }, [isBraking]);

  // Lock body scroll during racing
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch {
      // ignore
    }
  };

  // Precomputed dense centerline sample points for accurate collision & navigation
  const SAMPLE_COUNT = 360;
  const trackSamples = useMemo<TrackSamplePoint[]>(() => {
    const samples: TrackSamplePoint[] = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const t = i / SAMPLE_COUNT;
      const pt = track.getPoint(t);
      const ptNext = track.getPoint((t + 0.002) % 1);
      const heading = Math.atan2(ptNext.y - pt.y, ptNext.x - pt.x);
      const nx = -Math.sin(heading);
      const ny = Math.cos(heading);
      samples.push({ x: pt.x, y: pt.y, heading, nx, ny, t });
    }
    return samples;
  }, [track]);

  // Track outer bounding dimension for viewport scaling
  const trackBounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const margin = track.trackWidth / 2 + 36;

    trackSamples.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    });

    const totalWidth = maxX - minX + margin * 2;
    const totalHeight = maxY - minY + margin * 2;
    return {
      totalWidth,
      totalHeight,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [trackSamples, track.trackWidth]);

  // ==========================================================================
  // INTUITIVE 360-DEGREE VIRTUAL JOYSTICK (POINTER CAPTURE & GLOBAL LISTENERS)
  // ==========================================================================
  const JOYSTICK_RADIUS = 46;

  const updateJoystickFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!joystickBaseRef.current) return;
      const rect = joystickBaseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);
      const clampedDist = Math.min(distance, JOYSTICK_RADIUS);
      const angle = Math.atan2(dy, dx);

      const clampedX = Math.cos(angle) * clampedDist;
      const clampedY = Math.sin(angle) * clampedDist;

      setJoystickPos({ x: clampedX, y: clampedY });

      // Small deadzone (5px) prevents accidental micro-drift
      const isMoved = clampedDist > 5;
      const mag = isMoved ? clampedDist / JOYSTICK_RADIUS : 0;

      joystickVectorRef.current = {
        x: isMoved ? clampedX / JOYSTICK_RADIUS : 0,
        y: isMoved ? clampedY / JOYSTICK_RADIUS : 0,
        magnitude: mag,
        active: isMoved,
      };
    },
    [JOYSTICK_RADIUS]
  );

  const resetJoystick = useCallback(() => {
    isPointerDownRef.current = false;
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    joystickVectorRef.current = { x: 0, y: 0, magnitude: 0, active: false };
  }, []);

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isPointerDownRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setJoystickActive(true);
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current && !joystickActive) return;
    e.preventDefault();
    e.stopPropagation();
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    resetJoystick();
  };

  // Global window listeners so dragging outside joystick base never drops input
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (isPointerDownRef.current) {
        updateJoystickFromPointer(e.clientX, e.clientY);
      }
    };
    const handleGlobalPointerUp = () => {
      if (isPointerDownRef.current) {
        resetJoystick();
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [updateJoystickFromPointer, resetJoystick]);

  // Racer State Ref
  const racersRef = useRef<RacerState[]>([]);

  // ==========================================================================
  // MAIN PHYSICS LOOP & CANVAS RENDERING
  // ==========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let raceStartTime = performance.now();

    const TOTAL_LAPS = track.laps;
    const CHECKPOINT_COUNT = 48;
    const playerPalette = CAR_PALETTE[playerColor] || CAR_PALETTE.blue;

    // Reset UI counters for the track
    setCurrentLap(1);
    setPlayerPosition(1);
    setCurrentSpeedKmh(0);
    setLapElapsedMs(0);
    setRaceFinished(false);
    setCountdownText('3');

    // Resize Canvas to device pixel ratio
    const updateCanvasResolution = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
    };

    updateCanvasResolution();
    window.addEventListener('resize', updateCanvasResolution);

    // Starting slot coordinates at t = 0
    const startPt = trackSamples[0];
    const unitTanX = Math.cos(startPt.heading);
    const unitTanY = Math.sin(startPt.heading);
    const unitNormX = -Math.sin(startPt.heading);
    const unitNormY = Math.cos(startPt.heading);

    const getSlotCoords = (slotIndex: number, totalSlots: number) => {
      let lat = 0;
      let long = 0;
      if (totalSlots === 2) {
        if (slotIndex === 0) {
          lat = -14;
          long = 0;
        } else {
          lat = 14;
          long = -26;
        }
      } else {
        // 5 slots: 1 Human + 4 AI Bots
        if (slotIndex === 0) {
          lat = -14;
          long = 0;
        } else if (slotIndex === 1) {
          lat = 14;
          long = 0;
        } else if (slotIndex === 2) {
          lat = -14;
          long = -28;
        } else if (slotIndex === 3) {
          lat = 14;
          long = -28;
        } else {
          lat = 0;
          long = -56;
        }
      }

      return {
        x: startPt.x + unitNormX * lat + unitTanX * long,
        y: startPt.y + unitNormY * lat + unitTanY * long,
        angle: startPt.heading,
        laneOffset: lat,
      };
    };

    // ------------------------------------------------------------------------
    // INITIALIZE RACERS ARRAY (Strict Separation: Solo vs Multiplayer)
    // ------------------------------------------------------------------------
    let initialRacers: RacerState[] = [];

    if (!isMultiplayer) {
      // SOLO MODE: EXACTLY FIVE CARS (1 Human Player + 4 AI Bots)
      const slot0 = getSlotCoords(0, 5);
      const slot1 = getSlotCoords(1, 5);
      const slot2 = getSlotCoords(2, 5);
      const slot3 = getSlotCoords(3, 5);
      const slot4 = getSlotCoords(4, 5);

      initialRacers = [
        {
          id: playerId || 'player',
          isPlayer: true,
          nickname: playerNickname,
          colorHex: playerPalette.primary,
          x: slot0.x,
          y: slot0.y,
          vx: 0,
          vy: 0,
          angle: slot0.angle,
          speed: 0,
          targetSpeed: 0,
          laneOffset: slot0.laneOffset,
          lap: 1,
          checkpoint: 0,
          lapStartTime: performance.now(),
          bestLapMs: 0,
          finished: false,
          finishTimeMs: 0,
          placement: 1,
          progressScore: 0,
        },
        {
          id: 'bot-1',
          isPlayer: false,
          nickname: 'Apex Mia',
          colorHex: '#EF4444',
          x: slot1.x,
          y: slot1.y,
          vx: 0,
          vy: 0,
          angle: slot1.angle,
          speed: 0,
          targetSpeed: 5.4 + Math.random() * 0.3,
          laneOffset: slot1.laneOffset,
          lap: 1,
          checkpoint: 0,
          lapStartTime: performance.now(),
          bestLapMs: 0,
          finished: false,
          finishTimeMs: 0,
          placement: 2,
          progressScore: 0,
        },
        {
          id: 'bot-2',
          isPlayer: false,
          nickname: 'Turbo Rex',
          colorHex: '#10B981',
          x: slot2.x,
          y: slot2.y,
          vx: 0,
          vy: 0,
          angle: slot2.angle,
          speed: 0,
          targetSpeed: 5.1 + Math.random() * 0.35,
          laneOffset: slot2.laneOffset,
          lap: 1,
          checkpoint: 0,
          lapStartTime: performance.now(),
          bestLapMs: 0,
          finished: false,
          finishTimeMs: 0,
          placement: 3,
          progressScore: 0,
        },
        {
          id: 'bot-3',
          isPlayer: false,
          nickname: 'Velocity Kai',
          colorHex: '#F59E0B',
          x: slot3.x,
          y: slot3.y,
          vx: 0,
          vy: 0,
          angle: slot3.angle,
          speed: 0,
          targetSpeed: 4.8 + Math.random() * 0.3,
          laneOffset: slot3.laneOffset,
          lap: 1,
          checkpoint: 0,
          lapStartTime: performance.now(),
          bestLapMs: 0,
          finished: false,
          finishTimeMs: 0,
          placement: 4,
          progressScore: 0,
        },
        {
          id: 'bot-4',
          isPlayer: false,
          nickname: 'Phantom Zane',
          colorHex: '#8B5CF6',
          x: slot4.x,
          y: slot4.y,
          vx: 0,
          vy: 0,
          angle: slot4.angle,
          speed: 0,
          targetSpeed: 4.6 + Math.random() * 0.3,
          laneOffset: slot4.laneOffset,
          lap: 1,
          checkpoint: 0,
          lapStartTime: performance.now(),
          bestLapMs: 0,
          finished: false,
          finishTimeMs: 0,
          placement: 5,
          progressScore: 0,
        },
      ];
    } else {
      // MULTIPLAYER MODE: EXACTLY ONE CAR PER JOINED PLAYER
      const joinedList = (roomPlayersRef.current || []).filter((p) => p && p.playerId);
      const effectiveList: RoomPlayerRecord[] =
        joinedList.length > 0
          ? joinedList
          : [
              {
                roomCode: roomCode || 'ROOM',
                playerId: playerId || 'player',
                nickname: playerNickname || 'You',
                carColor: playerColor || 'blue',
                ready: true,
                distance: 0,
                score: 0,
                correctAnswers: 0,
                wrongAnswers: 0,
                currentQuestionIndex: 0,
                finished: false,
                finishTimeMs: 0,
                placement: 1,
                connected: true,
                lastSeenAtMs: Date.now(),
              },
            ];

      initialRacers = effectiveList.map((p, idx) => {
        const slot = getSlotCoords(idx, effectiveList.length);
        const isCurrent = p.playerId === playerId || (idx === 0 && !playerId);
        const colInfo = CAR_PALETTE[p.carColor] || CAR_PALETTE.blue;
        return {
          id: p.playerId,
          isPlayer: isCurrent,
          nickname: p.nickname || (isCurrent ? 'You' : `Player ${idx + 1}`),
          colorHex: colInfo.primary,
          x: slot.x,
          y: slot.y,
          vx: 0,
          vy: 0,
          angle: slot.angle,
          speed: 0,
          targetSpeed: 0,
          laneOffset: slot.laneOffset,
          lap: 1,
          checkpoint: 0,
          lapStartTime: performance.now(),
          bestLapMs: 0,
          finished: Boolean(p.finished),
          finishTimeMs: p.finishTimeMs || 0,
          placement: p.placement || idx + 1,
          progressScore: 0,
        };
      });
    }

    racersRef.current = initialRacers;

    const particles: Particle[] = [];
    const skidmarks: SkidSegment[] = [];

    // Pre-race countdown tracking
    let countdownRemainingMs = 3200; // 3 -> 2 -> 1 -> GO!
    let raceStarted = false;
    let lastPlayedCountdownNumber = 4;

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) keysRef.current.up = true;
      if (['ArrowDown', 'KeyS', 'Space'].includes(e.code)) keysRef.current.down = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keysRef.current.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) keysRef.current.right = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) keysRef.current.up = false;
      if (['ArrowDown', 'KeyS', 'Space'].includes(e.code)) keysRef.current.down = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) keysRef.current.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) keysRef.current.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // ========================================================================
    // 60 FPS SIMULATION & RENDER TICK
    // ========================================================================
    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const racers = racersRef.current;
      const player = racers.find((r) => r.isPlayer) || racers[0];

      // ----------------------------------------------------------------------
      // 0. PRE-RACE COUNTDOWN LOGIC (Cars remain stationary)
      // ----------------------------------------------------------------------
      if (!raceStarted) {
        countdownRemainingMs -= dt * 1000;

        if (countdownRemainingMs > 2200) {
          if (lastPlayedCountdownNumber !== 3) {
            lastPlayedCountdownNumber = 3;
            soundEngine.playCountdownBeep(false);
            setCountdownText('3');
          }
        } else if (countdownRemainingMs > 1200) {
          if (lastPlayedCountdownNumber !== 2) {
            lastPlayedCountdownNumber = 2;
            soundEngine.playCountdownBeep(false);
            setCountdownText('2');
          }
        } else if (countdownRemainingMs > 200) {
          if (lastPlayedCountdownNumber !== 1) {
            lastPlayedCountdownNumber = 1;
            soundEngine.playCountdownBeep(false);
            setCountdownText('1');
          }
        } else if (countdownRemainingMs > -600) {
          if (lastPlayedCountdownNumber !== 0) {
            lastPlayedCountdownNumber = 0;
            soundEngine.playCountdownBeep(true);
            setCountdownText('GO!');
            raceStarted = true;
            raceStartTime = now;
            racers.forEach((r) => {
              r.lapStartTime = now;
            });
          }
        } else {
          setCountdownText(null);
        }
      }

      // ----------------------------------------------------------------------
      // 1. INTUITIVE 360-DEGREE STEERING & VEHICLE PHYSICS
      // Joystick vector directly controls target heading.
      // Releasing controls leaves the car travelling straight in its current heading.
      // ----------------------------------------------------------------------
      if (player && raceStarted && !player.finished) {
        const joy = joystickVectorRef.current;

        // Realistic acceleration and braking speeds
        const isJoyBoosting = joy.active && joy.y < -0.25;
        const isJoyBraking = joy.active && joy.y > 0.25;
        const braking =
          isBrakingRef.current || keysRef.current.down || isJoyBraking;
        player.isBraking = braking;

        const CRUISE_SPEED = 5.8;
        const BOOST_SPEED = 7.4;
        const ACCEL_RATE = 6.0 * dt;
        const BRAKE_DECEL = 11.0 * dt;
        const MIN_BRAKE_SPEED = 0.6;

        // Handle Acceleration & Braking
        if (braking) {
          if (player.speed > MIN_BRAKE_SPEED) {
            player.speed = Math.max(MIN_BRAKE_SPEED, player.speed - BRAKE_DECEL);
          }
        } else {
          const isBoosting = keysRef.current.up || isJoyBoosting;
          const targetSpeed = isBoosting ? BOOST_SPEED : CRUISE_SPEED;

          if (player.speed < targetSpeed) {
            player.speed = Math.min(targetSpeed, player.speed + ACCEL_RATE);
          } else if (player.speed > targetSpeed) {
            player.speed = Math.max(targetSpeed, player.speed - 2.5 * dt);
          }
        }

        // --------------------------------------------------------------------
        // INTUITIVE JOYSTICK & KEYBOARD STEERING:
        // Left/Right stick tilt (joy.x) steers the car smoothly left or right.
        // Full deflection = sharp turn/drift; small tilt = gentle correction.
        // When released, ZERO artificial turn is applied — car glides straight!
        // --------------------------------------------------------------------
        if (joy.active && Math.abs(joy.x) > 0.06) {
          const steerSensitivity = 4.4; // radians per second at full deflection
          player.angle += joy.x * steerSensitivity * dt;
        } else if (keysRef.current.left || keysRef.current.right) {
          // Keyboard left/right steering
          const keyTurnRate = 4.2;
          if (keysRef.current.left) player.angle -= keyTurnRate * dt;
          if (keysRef.current.right) player.angle += keyTurnRate * dt;
        }

        // --------------------------------------------------------------------
        // VEHICLE DYNAMICS: HIGH-GRIP ARCADE PHYSICS WITH SLIGHT DRIFT
        // --------------------------------------------------------------------
        const desiredVx = Math.cos(player.angle) * player.speed;
        const desiredVy = Math.sin(player.angle) * player.speed;

        // Grip interpolation (82% instantaneous response, 18% lateral slip)
        player.vx = (player.vx ?? desiredVx) * 0.18 + desiredVx * 0.82;
        player.vy = (player.vy ?? desiredVy) * 0.18 + desiredVy * 0.82;

        player.x += player.vx;
        player.y += player.vy;

        // --------------------------------------------------------------------
        // ACCURATE GEOMETRIC TRACK BOUNDARY & BARRIER DETECTION
        // --------------------------------------------------------------------
        let minDistSq = Infinity;
        let closestIdx = 0;
        for (let i = 0; i < SAMPLE_COUNT; i++) {
          const s = trackSamples[i];
          const d2 = (player.x - s.x) * (player.x - s.x) + (player.y - s.y) * (player.y - s.y);
          if (d2 < minDistSq) {
            minDistSq = d2;
            closestIdx = i;
          }
        }

        const closestPt = trackSamples[closestIdx];
        const distFromCenter = Math.sqrt(minDistSq);
        const halfTrack = track.trackWidth / 2;

        // Off-track grass/sand runoff slows the car slightly
        if (distFromCenter > halfTrack) {
          player.speed = Math.min(player.speed, 3.4);
          if (Math.random() < 0.35) {
            particles.push({
              x: player.x,
              y: player.y,
              vx: (Math.random() - 0.5) * 1.8,
              vy: (Math.random() - 0.5) * 1.8,
              alpha: 0.5,
              size: 3 + Math.random() * 3,
              color: track.theme === 'desert' ? '#F59E0B' : '#10B981',
            });
          }
        }

        // Barrier collision: smoothly slide along the barrier wall without spinning
        const maxBarrierDist = halfTrack + 12;
        if (distFromCenter > maxBarrierDist && distFromCenter > 0.01) {
          const vx = player.x - closestPt.x;
          const vy = player.y - closestPt.y;
          const len = Math.hypot(vx, vy) || 1;
          player.x = closestPt.x + (vx / len) * maxBarrierDist;
          player.y = closestPt.y + (vy / len) * maxBarrierDist;

          if (player.speed > 2.8) {
            soundEngine.playBarrierBump();
          }
          player.speed = Math.max(1.0, player.speed * 0.82);

          // Sparks on barrier brush
          for (let sp = 0; sp < 2; sp++) {
            particles.push({
              x: player.x,
              y: player.y,
              vx: (Math.random() - 0.5) * 3.5,
              vy: (Math.random() - 0.5) * 3.5,
              alpha: 0.8,
              size: 2 + Math.random() * 2,
              color: '#FACC15',
            });
          }
        }

        // Tire Skid Marks when cornering hard or braking
        const isTurningHard = joy.active && joy.magnitude > 0.4;
        if ((isTurningHard && player.speed > 3.8) || (braking && player.speed > 2.8)) {
          const rearX = player.x - Math.cos(player.angle) * 14;
          const rearY = player.y - Math.sin(player.angle) * 14;
          skidmarks.push({
            x1: rearX,
            y1: rearY,
            x2: rearX - Math.cos(player.angle) * 4,
            y2: rearY - Math.sin(player.angle) * 4,
            alpha: braking ? 0.6 : 0.35,
          });
          if (skidmarks.length > 200) skidmarks.shift();
        }

        // Checkpoints & Laps Detection
        const nextCheck = (player.checkpoint + 1) % CHECKPOINT_COUNT;
        const checkPointT = nextCheck / CHECKPOINT_COUNT;
        const checkPointTarget = track.getPoint(checkPointT);
        const distToCheck = Math.hypot(
          player.x - checkPointTarget.x,
          player.y - checkPointTarget.y
        );

        if (distToCheck < track.trackWidth * 1.15) {
          player.checkpoint = nextCheck;
          if (nextCheck === 0) {
            const lapDuration = now - player.lapStartTime;
            if (player.bestLapMs === 0 || lapDuration < player.bestLapMs) {
              player.bestLapMs = Math.round(lapDuration);
              setBestLapMs(player.bestLapMs);
            }
            soundEngine.playSuccess();

            if (player.lap >= TOTAL_LAPS) {
              player.finished = true;
              player.finishTimeMs = Math.round(now - raceStartTime);
              soundEngine.playRaceFinish();
              setRaceFinished(true);

              const finalPlacement = player.placement;
              const placeBaseScore =
                finalPlacement === 1
                  ? 2600
                  : finalPlacement === 2
                    ? 1900
                    : finalPlacement === 3
                      ? 1300
                      : 850;
              const timeBonus = Math.max(0, 1000 - Math.floor(player.finishTimeMs / 100));
              const totalScore = placeBaseScore + timeBonus;

              if (onFinishRef.current) {
                onFinishRef.current({
                  placement: finalPlacement,
                  finalTimeMs: player.finishTimeMs,
                  bestLapMs: player.bestLapMs,
                  score: totalScore,
                  lapsCompleted: TOTAL_LAPS,
                });
              }
            } else {
              player.lap += 1;
              player.lapStartTime = now;
              setCurrentLap(player.lap);
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // 2. SOLO AI BOTS SIMULATION (ONLY IN SOLO MODE)
      // ----------------------------------------------------------------------
      if (!isMultiplayer && raceStarted) {
        racers.forEach((r) => {
          if (r.isPlayer || r.id === playerId || r.id === 'player' || r.finished) return;

          let bMinDist = Infinity;
          let bIdx = 0;
          for (let i = 0; i < SAMPLE_COUNT; i++) {
            const s = trackSamples[i];
            const d2 = (r.x - s.x) * (r.x - s.x) + (r.y - s.y) * (r.y - s.y);
            if (d2 < bMinDist) {
              bMinDist = d2;
              bIdx = i;
            }
          }

          // Aim at track waypoint ahead
          const aheadIdx = (bIdx + 12) % SAMPLE_COUNT;
          const aheadPt = trackSamples[aheadIdx];
          const targetX = aheadPt.x + aheadPt.nx * r.laneOffset;
          const targetY = aheadPt.y + aheadPt.ny * r.laneOffset;

          const desiredAngle = Math.atan2(targetY - r.y, targetX - r.x);
          let angleDiff = desiredAngle - r.angle;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

          r.angle += angleDiff * Math.min(1, 4.0 * dt);

          if (r.speed < r.targetSpeed) {
            r.speed += 3.4 * dt;
          }

          r.x += Math.cos(r.angle) * r.speed;
          r.y += Math.sin(r.angle) * r.speed;

          const nextCheck = (r.checkpoint + 1) % CHECKPOINT_COUNT;
          const checkPt = track.getPoint(nextCheck / CHECKPOINT_COUNT);
          if (Math.hypot(r.x - checkPt.x, r.y - checkPt.y) < track.trackWidth * 1.15) {
            r.checkpoint = nextCheck;
            if (nextCheck === 0) {
              r.lap += 1;
              if (r.lap > TOTAL_LAPS) {
                r.finished = true;
                r.finishTimeMs = Math.round(now - raceStartTime);
              }
            }
          }
        });
      }

      // ----------------------------------------------------------------------
      // 3. MULTIPLAYER REMOTE OPPONENT SYNC (ONLY IN MULTIPLAYER)
      // ----------------------------------------------------------------------
      if (isMultiplayer && raceStarted) {
        const livePlayers = roomPlayersRef.current;
        if (livePlayers && livePlayers.length > 0) {
          racers.forEach((r) => {
            if (r.isPlayer || r.id === playerId) return;
            const remoteDoc = livePlayers.find((p) => p.playerId === r.id);
            if (remoteDoc) {
              const pct = Math.max(0, Math.min(100, remoteDoc.distance || 0));
              const fractionalLap = (pct / 100) * TOTAL_LAPS;
              const t = fractionalLap % 1;

              const centerPt = track.getPoint(t);
              const pNext = track.getPoint((t + 0.005) % 1);
              const hAngle = Math.atan2(pNext.y - centerPt.y, pNext.x - centerPt.x);
              const nX = -Math.sin(hAngle);
              const nY = Math.cos(hAngle);

              const targetX = centerPt.x + nX * r.laneOffset;
              const targetY = centerPt.y + nY * r.laneOffset;

              r.x += (targetX - r.x) * 0.12;
              r.y += (targetY - r.y) * 0.12;
              r.angle = hAngle;
              r.finished = Boolean(remoteDoc.finished);
              r.finishTimeMs = remoteDoc.finishTimeMs || 0;
              r.placement = remoteDoc.placement || r.placement;
              r.speed = pct > 0 ? 5.2 : 0;
            }
          });
        }
      }

      // ----------------------------------------------------------------------
      // 4. CAR-TO-CAR ELASTIC BUMPING (Prevents cars overlapping)
      // ----------------------------------------------------------------------
      const CAR_RADIUS = 12;
      for (let i = 0; i < racers.length; i++) {
        for (let j = i + 1; j < racers.length; j++) {
          const c1 = racers[i];
          const c2 = racers[j];
          const cdx = c2.x - c1.x;
          const cdy = c2.y - c1.y;
          const cdist = Math.hypot(cdx, cdy);
          const minSep = CAR_RADIUS * 2;
          if (cdist < minSep && cdist > 0.001) {
            const overlap = (minSep - cdist) / 2;
            const nx = cdx / cdist;
            const ny = cdy / cdist;
            c1.x -= nx * overlap;
            c1.y -= ny * overlap;
            c2.x += nx * overlap;
            c2.y += ny * overlap;
          }
        }
      }

      // ----------------------------------------------------------------------
      // 5. UPDATE PROGRESS & LIVE PLACEMENT RANKING
      // ----------------------------------------------------------------------
      racers.forEach((r) => {
        const completedFraction =
          (Math.max(0, r.lap - 1) + r.checkpoint / CHECKPOINT_COUNT) / TOTAL_LAPS;
        r.progressScore = r.finished ? 1000 + (TOTAL_LAPS - r.placement) : completedFraction * 100;
      });

      const sortedRacers = [...racers].sort((a, b) => b.progressScore - a.progressScore);
      sortedRacers.forEach((r, idx) => {
        r.placement = idx + 1;
      });

      if (player) {
        setPlayerPosition(player.placement);
        const kmh = Math.round(player.speed * 24);
        setCurrentSpeedKmh(kmh);
        if (raceStarted && !player.finished) {
          setLapElapsedMs(Math.round(now - player.lapStartTime));
        }

        if (onProgressUpdateRef.current && raceStarted) {
          const pct = Math.min(100, Math.round(player.progressScore));
          const liveScore = Math.round(player.progressScore * 20);
          onProgressUpdateRef.current(pct, liveScore);
        }
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.035;
        if (p.alpha <= 0) particles.splice(i, 1);
      }

      // Fade skidmarks
      for (let i = skidmarks.length - 1; i >= 0; i--) {
        const s = skidmarks[i];
        s.alpha -= 0.0018;
        if (s.alpha <= 0) skidmarks.splice(i, 1);
      }

      // ----------------------------------------------------------------------
      // 6. 2D CANVAS DRAWING (FULL SCREEN, NO EMPTY SPACES)
      // ----------------------------------------------------------------------
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewW = canvas.width / dpr;
      const viewH = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      // FULL SCREEN BACKGROUND FILL
      const bgGrad = ctx.createLinearGradient(0, 0, viewW, viewH);
      if (track.theme === 'neon') {
        bgGrad.addColorStop(0, '#050716');
        bgGrad.addColorStop(0.5, '#0B0D2A');
        bgGrad.addColorStop(1, '#050716');
      } else if (track.theme === 'desert') {
        bgGrad.addColorStop(0, '#451A03');
        bgGrad.addColorStop(0.5, '#78350F');
        bgGrad.addColorStop(1, '#451A03');
      } else if (track.theme === 'cyber') {
        bgGrad.addColorStop(0, '#04091A');
        bgGrad.addColorStop(0.5, '#091533');
        bgGrad.addColorStop(1, '#04091A');
      } else if (track.theme === 'midnight') {
        bgGrad.addColorStop(0, '#090D1A');
        bgGrad.addColorStop(0.5, '#111827');
        bgGrad.addColorStop(1, '#0B0F19');
      } else {
        // Asphalt / GP
        bgGrad.addColorStop(0, '#062B1D');
        bgGrad.addColorStop(0.5, '#0F3826');
        bgGrad.addColorStop(1, '#062B1D');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, viewW, viewH);

      // Responsive track scale calculation (maximize track size on screen)
      const topHudPadding = 64;
      const bottomControlsPadding = 24;
      const horizontalPadding = 18;

      const availW = Math.max(200, viewW - horizontalPadding * 2);
      const availH = Math.max(150, viewH - topHudPadding - bottomControlsPadding);

      const scaleX = availW / trackBounds.totalWidth;
      const scaleY = availH / trackBounds.totalHeight;
      const fitScale = Math.min(scaleX, scaleY);

      // Center the circuit in view
      const screenCenterX = viewW / 2;
      const screenCenterY = topHudPadding + availH / 2;

      ctx.save();
      ctx.translate(screenCenterX, screenCenterY);
      ctx.scale(fitScale, fitScale);

      // Inner field grass/ground
      ctx.fillStyle =
        track.theme === 'desert'
          ? '#9A3412'
          : track.theme === 'neon'
            ? '#0F172A'
            : track.theme === 'midnight'
              ? '#1E293B'
              : track.theme === 'cyber'
                ? '#0F1E36'
                : '#065F46';
      ctx.beginPath();
      for (let i = 0; i <= SAMPLE_COUNT; i++) {
        const pt = trackSamples[i % SAMPLE_COUNT];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.fill();

      // Outer Red-and-White Kerb Barrier Line
      const halfW = track.trackWidth / 2;
      ctx.beginPath();
      for (let i = 0; i <= SAMPLE_COUNT; i++) {
        const pt = trackSamples[i % SAMPLE_COUNT];
        const px = pt.x + pt.nx * (halfW + 7);
        const py = pt.y + pt.ny * (halfW + 7);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.lineWidth = 14;
      ctx.strokeStyle = track.theme === 'neon' ? '#E11D48' : '#DC2626';
      ctx.stroke();

      // Main Racing Asphalt Surface
      ctx.beginPath();
      for (let i = 0; i <= SAMPLE_COUNT; i++) {
        const pt = trackSamples[i % SAMPLE_COUNT];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.lineWidth = track.trackWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle =
        track.theme === 'neon'
          ? '#1E1B4B'
          : track.theme === 'cyber'
            ? '#0F172A'
            : '#1E293B';
      ctx.stroke();

      // Inner Kerb / Edge Glow
      ctx.beginPath();
      for (let i = 0; i <= SAMPLE_COUNT; i++) {
        const pt = trackSamples[i % SAMPLE_COUNT];
        const px = pt.x - pt.nx * (halfW - 2);
        const py = pt.y - pt.ny * (halfW - 2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.lineWidth = 5;
      ctx.strokeStyle =
        track.theme === 'neon'
          ? '#06B6D4'
          : track.theme === 'cyber'
            ? '#38BDF8'
            : '#F8FAFC';
      ctx.stroke();

      // Dashed Track Centerline
      ctx.beginPath();
      for (let i = 0; i <= SAMPLE_COUNT; i++) {
        const pt = trackSamples[i % SAMPLE_COUNT];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 12]);
      ctx.strokeStyle =
        track.theme === 'neon' ? '#F43F5E' : 'rgba(255, 255, 255, 0.45)';
      ctx.stroke();
      ctx.setLineDash([]);

      // START / FINISH Checkered Line at t = 0
      ctx.save();
      ctx.translate(startPt.x, startPt.y);
      ctx.rotate(startPt.heading);

      const checkBlockSize = 8;
      const checkCols = 3;
      const checkRows = Math.floor(track.trackWidth / checkBlockSize);
      for (let c = 0; c < checkCols; c++) {
        for (let r = 0; r < checkRows; r++) {
          const isWhite = (c + r) % 2 === 0;
          ctx.fillStyle = isWhite ? '#FFFFFF' : '#0F172A';
          ctx.fillRect(
            c * checkBlockSize - (checkCols * checkBlockSize) / 2,
            r * checkBlockSize - (checkRows * checkBlockSize) / 2,
            checkBlockSize,
            checkBlockSize
          );
        }
      }
      ctx.restore();

      // Draw Tire Skidmarks
      skidmarks.forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.strokeStyle = `rgba(15, 23, 42, ${s.alpha.toFixed(2)})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      });

      // Draw Particles (Dust, Sparks, Smoke)
      particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // Draw All Cars
      racers.forEach((r) => {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.angle);

        // Ground Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 3, 17, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wheels
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-13, -11, 7, 4); // Front Left
        ctx.fillRect(-13, 7, 7, 4); // Front Right
        ctx.fillRect(7, -11, 7, 4); // Rear Left
        ctx.fillRect(7, 7, 7, 4); // Rear Right

        // Car Main Chassis
        ctx.fillStyle = r.colorHex;
        ctx.beginPath();
        ctx.roundRect(-16, -8, 32, 16, 5);
        ctx.fill();

        // White Body Outline
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Racing Stripe
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-14, -2, 28, 4);

        // Cockpit Glass
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.ellipse(2, 0, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Headlights
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(14, -5, 3, 3);
        ctx.fillRect(14, 2, 3, 3);

        // Tail brake lights glow when braking
        if (r.isBraking) {
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(-16, -5, 3.5, 0, Math.PI * 2);
          ctx.arc(-16, 5, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Car Nickname & Rank Overhead Badge
        ctx.restore();
        ctx.save();
        ctx.translate(r.x, r.y - 24);

        const badgeBg = r.isPlayer ? '#2563EB' : 'rgba(15, 23, 42, 0.85)';
        const badgeBorder = r.isPlayer ? '#93C5FD' : '#64748B';
        const labelText = r.isPlayer ? 'YOU' : r.nickname;

        ctx.font = 'bold 10px sans-serif';
        const textWidth = ctx.measureText(labelText).width;
        const boxWidth = Math.max(34, textWidth + 14);

        ctx.fillStyle = badgeBg;
        ctx.beginPath();
        ctx.roundRect(-boxWidth / 2, -12, boxWidth, 16, 7);
        ctx.fill();
        ctx.strokeStyle = badgeBorder;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, 0, -4);

        ctx.restore();
      });

      ctx.restore(); // Restore world transform
      ctx.restore(); // Restore dpr scale

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', updateCanvasResolution);
    };
  }, [
    activeLevel,
    track,
    isMultiplayer,
    playerId,
    playerColor,
    playerNickname,
    trackSamples,
    trackBounds,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full select-none flex-col overflow-hidden bg-slate-950 font-sans text-white touch-none"
      style={{ touchAction: 'none' }}
    >
      {/* 2D Canvas Viewport (Fills entire screen) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-contain"
      />

      {/* TOP HUD BAR: Compact, clean, with 8 Unlocked Miniature Map Selector Icons */}
      <div className="pointer-events-none relative z-20 flex w-full items-center justify-between px-2 pt-1.5 sm:px-4 sm:pt-2">
        {/* Left: Exit + Lap Count */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onExitRequest && (
            <button
              type="button"
              onClick={onExitRequest}
              className="pointer-events-auto flex h-8 items-center gap-1 rounded-xl border border-white/20 bg-slate-900/80 px-2 text-xs font-black text-white shadow-md backdrop-blur-md active:scale-95"
              aria-label="Exit Game"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 px-2.5 py-1 shadow-md backdrop-blur-md">
            <span className="font-display text-xs font-black text-amber-400">
              LAP {currentLap}/{track.laps}
            </span>
            <span className="hidden text-xs font-bold text-slate-300 md:inline">
              · {track.name}
            </span>
          </div>
        </div>

        {/* Center: 8 MAP SELECTOR ICONS (All Unlocked, Tap to Play!) */}
        <div className="pointer-events-auto flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/15 bg-slate-900/85 p-1 shadow-xl backdrop-blur-md max-w-[55vw] sm:max-w-none scrollbar-none">
          {TRACK_SVG_PATHS.map((item) => {
            const isSelected = item.level === activeLevel;
            return (
              <button
                key={item.level}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onLevelChange?.(item.level);
                }}
                className={`group relative flex flex-col items-center justify-center rounded-xl px-1.5 py-1 transition-all active:scale-95 ${
                  isSelected
                    ? 'border border-amber-300 bg-amber-400/20 text-amber-300 ring-2 ring-amber-400/50'
                    : 'border border-transparent bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10 hover:text-white'
                }`}
                title={`Map ${item.level}: ${item.name} (Unlocked)`}
              >
                {/* Miniature SVG Track Outline */}
                <svg
                  viewBox="0 0 44 28"
                  className={`h-4 w-7 sm:h-5 sm:w-8 transition-transform ${
                    isSelected ? 'scale-110' : 'opacity-70 group-hover:opacity-100'
                  }`}
                >
                  <path
                    d={item.svgPath}
                    fill="none"
                    stroke={isSelected ? '#F59E0B' : '#94A3B8'}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="mt-0.5 text-[9px] font-black tracking-tight sm:text-[10px]">
                  M{item.level}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Rank + Speedometer + Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Position Rank */}
          <div
            className={`flex h-8 items-center gap-1 rounded-xl px-2.5 font-display text-xs font-black shadow-lg backdrop-blur-md ${
              playerPosition === 1
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                : playerPosition === 2
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-slate-900/80 text-white border border-white/20'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>#{playerPosition}</span>
          </div>

          {/* Speedometer */}
          <div className="hidden items-center gap-1 rounded-xl border border-white/10 bg-slate-900/80 px-2.5 py-1 font-mono text-xs font-extrabold text-sky-400 shadow-md backdrop-blur-md sm:flex">
            <Gauge className="h-3 w-3" />
            <span>{currentSpeedKmh} KM/H</span>
          </div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-slate-900/80 text-white shadow-md backdrop-blur-md active:scale-95"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* PRE-RACE COUNTDOWN OVERLAY */}
      {countdownText && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center">
          <div
            key={countdownText}
            className={`flex h-24 w-24 items-center justify-center rounded-full border-4 shadow-2xl backdrop-blur-md animate-pulse sm:h-32 sm:w-32 ${
              countdownText === 'GO!'
                ? 'border-emerald-300 bg-emerald-500/90 text-white ring-8 ring-emerald-400/50 scale-125'
                : 'border-amber-300 bg-slate-900/90 text-amber-300 ring-8 ring-amber-400/30'
            }`}
          >
            <span className="font-display text-4xl font-black tracking-widest sm:text-5xl">
              {countdownText}
            </span>
          </div>
          <p className="mt-3 font-display text-xs font-black tracking-wider text-white uppercase drop-shadow-md sm:text-sm">
            {countdownText === 'GO!' ? 'RACE IS ON!' : 'GET READY ON THE GRID'}
          </p>
        </div>
      )}

      {/* CELEBRATION FINISH OVERLAY */}
      {raceFinished && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/85 p-4 text-center backdrop-blur-sm animate-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400 text-3xl shadow-2xl animate-bounce">
            🏁
          </div>
          <h2 className="mt-3 font-display text-2xl font-black text-white sm:text-3xl">
            RACE COMPLETE!
          </h2>
          <p className="mt-1 text-sm font-bold text-amber-300">
            Finished #{playerPosition} · Best Lap: {(bestLapMs / 1000).toFixed(2)}s
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const nextLvl = (activeLevel % 8) + 1;
                onLevelChange?.(nextLvl);
              }}
              className="rounded-xl bg-amber-400 px-4 py-2 font-display text-xs font-black text-slate-950 shadow-md hover:bg-amber-300 active:scale-95"
            >
              Next Map (M{(activeLevel % 8) + 1}) →
            </button>
          </div>
        </div>
      )}

      {/* LANDSCAPE CONTROLS OVERLAY:
          - Bottom-Left: Large 360° Virtual Joystick (Outer Ring + Inner Follow Knob)
          - Bottom-Right: Large BRAKE Button (Press and Hold) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between p-3 sm:p-5">
        {/* LEFT CORNER: 360° VIRTUAL JOYSTICK */}
        <div className="relative flex flex-col items-center">
          <div
            ref={joystickBaseRef}
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            className={`pointer-events-auto relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-white/30 bg-slate-900/60 shadow-2xl backdrop-blur-md transition-colors select-none sm:h-32 sm:w-32 ${
              joystickActive
                ? 'border-blue-400 bg-blue-950/50 ring-4 ring-blue-500/20'
                : 'hover:border-white/50'
            }`}
            style={{ touchAction: 'none' }}
            aria-label="Virtual Joystick (Steer left/right and 360 directions)"
          >
            {/* Center Crosshair Guides */}
            <div className="pointer-events-none absolute h-full w-0.5 bg-white/10" />
            <div className="pointer-events-none absolute h-0.5 w-full bg-white/10" />

            {/* Inner Movable Circular Knob */}
            <div
              className={`pointer-events-none flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-radial from-blue-400 to-blue-600 text-white shadow-xl transition-transform sm:h-14 sm:w-14 ${
                joystickActive ? 'scale-110 shadow-blue-500/50' : 'opacity-90'
              }`}
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              }}
            >
              <Compass className="h-5 w-5 opacity-90 sm:h-6 sm:w-6" />
            </div>
          </div>
          <span className="mt-1 font-mono text-[10px] font-extrabold tracking-wider text-slate-400 uppercase drop-shadow-sm">
            360° STEER
          </span>
        </div>

        {/* RIGHT CORNER: BRAKE BUTTON (PRESS AND HOLD) */}
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setIsBraking(true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              setIsBraking(false);
            }}
            onPointerCancel={(e) => {
              e.preventDefault();
              setIsBraking(false);
            }}
            onPointerLeave={() => setIsBraking(false)}
            className={`pointer-events-auto flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-white/30 shadow-2xl backdrop-blur-md select-none transition-all active:scale-90 sm:h-28 sm:w-28 ${
              isBraking
                ? 'border-red-400 bg-red-600/90 text-white ring-4 ring-red-500/40 shadow-red-500/50 scale-95'
                : 'bg-slate-900/70 text-slate-200 hover:border-white/50'
            }`}
            style={{ touchAction: 'none' }}
            aria-label="Hold to Brake"
          >
            <Flame
              className={`h-6 w-6 sm:h-7 sm:w-7 ${
                isBraking ? 'text-amber-300 animate-pulse' : 'text-red-400'
              }`}
            />
            <span className="mt-0.5 font-display text-xs font-black tracking-wider uppercase sm:text-sm">
              BRAKE
            </span>
          </button>
          <span className="mt-1 font-mono text-[10px] font-extrabold tracking-wider text-slate-400 uppercase drop-shadow-sm">
            HOLD TO SLOW
          </span>
        </div>
      </div>
    </div>
  );
};
