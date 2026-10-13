import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Flame,
  Gauge,
  Maximize2,
  Minimize2,
  Trophy,
  X,
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
}

// 20 Progressive Circuits with diverse shapes, lengths and themes
export interface TrackDefinition {
  level: number;
  name: string;
  theme: 'asphalt' | 'neon' | 'desert' | 'midnight' | 'cyber';
  rx: number; // outer track radius X
  ry: number; // outer track radius Y
  trackWidth: number;
  curvature: number; // chicane bend intensity
  laps: number;
}

export const CIRCULAR_TRACKS: TrackDefinition[] = [
  { level: 1, name: 'Sunlight Oval', theme: 'asphalt', rx: 360, ry: 210, trackWidth: 78, curvature: 0, laps: 3 },
  { level: 2, name: 'Twin Ring Speedway', theme: 'asphalt', rx: 375, ry: 210, trackWidth: 76, curvature: 14, laps: 3 },
  { level: 3, name: 'Neon City Loop', theme: 'neon', rx: 385, ry: 215, trackWidth: 74, curvature: 20, laps: 3 },
  { level: 4, name: 'Desert Dune Ring', theme: 'desert', rx: 390, ry: 215, trackWidth: 72, curvature: 24, laps: 3 },
  { level: 5, name: 'Midnight Grand Prix', theme: 'midnight', rx: 400, ry: 220, trackWidth: 70, curvature: 28, laps: 3 },
  { level: 6, name: 'Cyber Turbo Speedway', theme: 'cyber', rx: 405, ry: 220, trackWidth: 68, curvature: 32, laps: 3 },
  { level: 7, name: 'Tokyo Drift Apex', theme: 'neon', rx: 410, ry: 225, trackWidth: 68, curvature: 36, laps: 3 },
  { level: 8, name: 'Alpine Serpentine', theme: 'asphalt', rx: 415, ry: 225, trackWidth: 66, curvature: 42, laps: 3 },
  { level: 9, name: 'Red Rock Canyon', theme: 'desert', rx: 420, ry: 230, trackWidth: 64, curvature: 45, laps: 3 },
  { level: 10, name: 'Neon Horizon Loop', theme: 'cyber', rx: 425, ry: 230, trackWidth: 64, curvature: 48, laps: 3 },
  { level: 11, name: 'Emerald Speedway', theme: 'asphalt', rx: 430, ry: 230, trackWidth: 62, curvature: 50, laps: 3 },
  { level: 12, name: 'Sunset Ridge Loop', theme: 'desert', rx: 435, ry: 235, trackWidth: 62, curvature: 52, laps: 3 },
  { level: 13, name: 'Midnight Velocity', theme: 'midnight', rx: 440, ry: 235, trackWidth: 60, curvature: 55, laps: 3 },
  { level: 14, name: 'Cyber Pulse Ring', theme: 'cyber', rx: 445, ry: 240, trackWidth: 60, curvature: 58, laps: 3 },
  { level: 15, name: 'Golden Sands Oval', theme: 'desert', rx: 450, ry: 240, trackWidth: 58, curvature: 60, laps: 3 },
  { level: 16, name: 'Hyperdrive Apex', theme: 'neon', rx: 455, ry: 240, trackWidth: 58, curvature: 62, laps: 3 },
  { level: 17, name: 'Thunder Valley Ring', theme: 'midnight', rx: 460, ry: 245, trackWidth: 56, curvature: 64, laps: 3 },
  { level: 18, name: 'Neon Vortex Loop', theme: 'cyber', rx: 465, ry: 245, trackWidth: 56, curvature: 66, laps: 3 },
  { level: 19, name: 'Apex Predator Circuit', theme: 'asphalt', rx: 470, ry: 250, trackWidth: 54, curvature: 68, laps: 3 },
  { level: 20, name: 'Championship Grand Ring', theme: 'neon', rx: 480, ry: 250, trackWidth: 54, curvature: 70, laps: 3 },
];

interface RacerState {
  id: string;
  isPlayer: boolean;
  nickname: string;
  colorHex: string;
  x: number;
  y: number;
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
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const track = CIRCULAR_TRACKS[(level - 1) % CIRCULAR_TRACKS.length] || CIRCULAR_TRACKS[0];

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
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);

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

  // Screen orientation management & check
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === 'undefined') return;
      const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
      setShowRotatePrompt(isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
          try {
            const orientation = (screen as any).orientation;
            if (orientation && typeof orientation.lock === 'function') {
              await orientation.lock('landscape');
            }
          } catch {
            // ignore orientation lock error if unsupported
          }
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

  // Track parametric math helper (elliptical curve with chicanes)
  const getTrackPoint = useCallback(
    (t: number, cx = 0, cy = 0) => {
      const normT = ((t % 1) + 1) % 1;
      const angle = normT * Math.PI * 2 - Math.PI / 2;
      const rMod = 1 + (Math.sin(angle * 2) * track.curvature) / 360;
      const x = cx + Math.cos(angle) * track.rx * rMod;
      const y = cy + Math.sin(angle) * track.ry * rMod;
      return { x, y, angle };
    },
    [track]
  );

  // Precomputed dense centerline sample points for accurate collision & navigation
  const SAMPLE_COUNT = 180;
  const trackSamples = useMemo<TrackSamplePoint[]>(() => {
    const samples: TrackSamplePoint[] = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const t = i / SAMPLE_COUNT;
      const pt = getTrackPoint(t, 0, 0);
      const ptNext = getTrackPoint((t + 0.005) % 1, 0, 0);
      const heading = Math.atan2(ptNext.y - pt.y, ptNext.x - pt.x);
      const nx = -Math.sin(heading);
      const ny = Math.cos(heading);
      samples.push({ x: pt.x, y: pt.y, heading, nx, ny, t });
    }
    return samples;
  }, [getTrackPoint]);

  // Track outer bounding dimension for viewport scaling
  const trackBounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const margin = track.trackWidth / 2 + 32;

    trackSamples.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    });

    const totalWidth = (maxX - minX) + margin * 2;
    const totalHeight = (maxY - minY) + margin * 2;
    return {
      totalWidth,
      totalHeight,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [track, trackSamples]);

  // Virtual Joystick Pointer Handlers (Fail-Safe Pointer Capture + Global Reset)
  const JOYSTICK_RADIUS = 50;

  const resetJoystick = useCallback(() => {
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    joystickVectorRef.current = { x: 0, y: 0, magnitude: 0, active: false };
  }, []);

  const updateJoystickFromPointer = useCallback((clientX: number, clientY: number) => {
    const baseEl = joystickBaseRef.current;
    if (!baseEl) return;
    const rect = baseEl.getBoundingClientRect();
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

    // Deadzone of 6px prevents accidental drift
    const mag = clampedDist > 6 ? clampedDist / JOYSTICK_RADIUS : 0;
    joystickVectorRef.current = {
      x: clampedDist > 6 ? clampedX / JOYSTICK_RADIUS : 0,
      y: clampedDist > 6 ? clampedY / JOYSTICK_RADIUS : 0,
      magnitude: mag,
      active: clampedDist > 6,
    };
  }, []);

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setJoystickActive(true);
    updateJoystickFromPointer(e.clientX, e.clientY);
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joystickActive && !joystickVectorRef.current.active) return;
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

  // Global window fail-safe: any pointer release or window blur resets joystick and brake
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (joystickVectorRef.current.active) {
        resetJoystick();
      }
      if (isBrakingRef.current) {
        setIsBraking(false);
      }
    };

    const handleWindowBlur = () => {
      resetJoystick();
      setIsBraking(false);
      keysRef.current = { up: false, down: false, left: false, right: false };
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [resetJoystick]);

  // ==========================================================================
  // MAIN RACING ENGINE (Persistent Ref State + Responsive Viewport Scaling)
  // ==========================================================================
  const racersRef = useRef<RacerState[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let raceStartTime = 0;
    let lastHudSyncTime = 0;
    let lastProgressReportTime = 0;

    const worldCx = 0;
    const worldCy = 0;

    const CHECKPOINT_COUNT = 12;
    const TOTAL_LAPS = track.laps;
    const playerPalette = CAR_PALETTE[playerColor] || CAR_PALETTE.blue;

    // Resize canvas buffer crisp & sharp without flickering
    const updateCanvasResolution = () => {
      const container = containerRef.current;
      if (container && canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = container.clientWidth || 960;
        const h = container.clientHeight || 540;
        const targetW = Math.round(w * dpr);
        const targetH = Math.round(h * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      }
    };
    updateCanvasResolution();
    window.addEventListener('resize', updateCanvasResolution);

    // ------------------------------------------------------------------------
    // STARTING GRID CALCULATION (Grand Prix Side-by-Side Grid)
    // ------------------------------------------------------------------------
    const tBase = 0.988;
    const ptA = getTrackPoint(tBase, worldCx, worldCy);
    const ptB = getTrackPoint((tBase + 0.005) % 1, worldCx, worldCy);
    const headingAngle = Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x);
    const unitTanX = Math.cos(headingAngle);
    const unitTanY = Math.sin(headingAngle);
    const unitNormX = -unitTanY;
    const unitNormY = unitTanX;

    const getSlotCoords = (slotIndex: number, totalRacers: number) => {
      let lat = 0;
      let long = 0;

      if (totalRacers <= 2) {
        lat = slotIndex === 0 ? -15 : 15;
        long = 0;
      } else if (totalRacers === 3) {
        if (slotIndex === 0) {
          lat = -15;
          long = 0;
        } else if (slotIndex === 1) {
          lat = 15;
          long = 0;
        } else {
          lat = 0;
          long = -28;
        }
      } else if (totalRacers === 4) {
        if (slotIndex === 0) {
          lat = -15;
          long = 0;
        } else if (slotIndex === 1) {
          lat = 15;
          long = 0;
        } else if (slotIndex === 2) {
          lat = -15;
          long = -28;
        } else {
          lat = 15;
          long = -28;
        }
      } else {
        // 5 racers: 1 Human + 4 AI Bots
        if (slotIndex === 0) {
          lat = -15;
          long = 0;
        } else if (slotIndex === 1) {
          lat = 15;
          long = 0;
        } else if (slotIndex === 2) {
          lat = -15;
          long = -28;
        } else if (slotIndex === 3) {
          lat = 15;
          long = -28;
        } else {
          lat = 0;
          long = -56;
        }
      }

      return {
        x: ptA.x + unitNormX * lat + unitTanX * long,
        y: ptA.y + unitNormY * lat + unitTanY * long,
        angle: headingAngle,
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
          angle: slot1.angle,
          speed: 0,
          targetSpeed: 5.1 + Math.random() * 0.4,
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
          angle: slot2.angle,
          speed: 0,
          targetSpeed: 4.9 + Math.random() * 0.4,
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
          nickname: 'Volt Sam',
          colorHex: '#A855F7',
          x: slot3.x,
          y: slot3.y,
          angle: slot3.angle,
          speed: 0,
          targetSpeed: 4.7 + Math.random() * 0.4,
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
          nickname: 'Blaze Drift',
          colorHex: '#F59E0B',
          x: slot4.x,
          y: slot4.y,
          angle: slot4.angle,
          speed: 0,
          targetSpeed: 4.5 + Math.random() * 0.4,
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
      // MULTIPLAYER MODE: SHOW ONLY ACTUAL JOINED PLAYERS (2 players = 2 cars, 3 = 3 cars, etc.)
      // NEVER spawn AI bots.
      const currentList = roomPlayersRef.current;
      const joinedList =
        currentList && currentList.length > 0
          ? [...currentList].filter((p) => p && p.playerId)
          : [
              {
                playerId: playerId || 'player',
                nickname: playerNickname,
                carColor: playerColor,
                distance: 0,
                connected: true,
                score: 0,
                finished: false,
                finishTimeMs: 0,
                placement: 1,
                roomCode: roomCode || 'ROOM',
                ready: true,
                correctAnswers: 0,
                wrongAnswers: 0,
                currentQuestionIndex: 0,
                lastSeenAtMs: Date.now(),
              },
            ];

      joinedList.sort((a, b) => a.playerId.localeCompare(b.playerId));
      const totalParticipants = Math.max(1, joinedList.length);

      initialRacers = joinedList.map((p, idx) => {
        const slot = getSlotCoords(idx, totalParticipants);
        const isCurrent = p.playerId === playerId;
        const color =
          isCurrent
            ? playerPalette.primary
            : CAR_PALETTE[p.carColor]?.primary || '#3B82F6';

        return {
          id: p.playerId,
          isPlayer: isCurrent,
          nickname: isCurrent ? playerNickname : p.nickname || 'Racer',
          colorHex: color,
          x: slot.x,
          y: slot.y,
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
    let countdownRemainingMs = 3200; // 3 seconds count: 3 -> 2 -> 1 -> GO!
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
      // 0. PRE-RACE COUNTDOWN LOGIC (Cars remain 100% stationary)
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
      // 1. HUMAN PLAYER PHYSICS & 360° STEERING
      // Cars MUST NOT turn automatically. Steering follows ONLY actual player input.
      // Releasing controls leaves the car travelling straight in its current heading.
      // ----------------------------------------------------------------------
      if (player && raceStarted && !player.finished) {
        const joy = joystickVectorRef.current;
        const braking =
          isBrakingRef.current || keysRef.current.down || (joy.active && joy.y > 0.45);
        player.isBraking = braking;

        // Acceleration and braking speeds
        const NORMAL_MAX_SPEED = 5.8;
        const BOOST_MAX_SPEED = 6.4;
        const ACCEL_RATE = 4.8 * dt;
        const BRAKE_DECEL = 9.8 * dt;
        const MIN_BRAKE_SPEED = 0.5;

        if (braking) {
          if (player.speed > MIN_BRAKE_SPEED) {
            player.speed = Math.max(MIN_BRAKE_SPEED, player.speed - BRAKE_DECEL);
          }
        } else {
          const targetSpeed =
            keysRef.current.up || (joy.active && joy.y < -0.3)
              ? BOOST_MAX_SPEED
              : NORMAL_MAX_SPEED;

          if (player.speed < targetSpeed) {
            player.speed = Math.min(targetSpeed, player.speed + ACCEL_RATE);
          } else if (player.speed > targetSpeed) {
            player.speed = Math.max(targetSpeed, player.speed - 1.5 * dt);
          }
        }

        // --------------------------------------------------------------------
        // GENUINE RESPONSIVE STEERING:
        // Left steers left, Right steers right.
        // Joy horizontal axis + diagonal transitions are smoothly handled.
        // No input = 0 rotation added!
        // --------------------------------------------------------------------
        let steerAmount = 0;

        if (joy.active && joy.magnitude > 0.08) {
          // Continuous 360° virtual joystick:
          // X-axis provides primary proportional steering left/right
          // Diagonal deflections scale steering smoothly
          steerAmount = joy.x * (1 + Math.abs(joy.y) * 0.2);
        } else if (keysRef.current.left || keysRef.current.right) {
          if (keysRef.current.left) steerAmount -= 1.0;
          if (keysRef.current.right) steerAmount += 1.0;
        }

        // Apply turning strictly when player applies steering input
        if (Math.abs(steerAmount) > 0.02) {
          const MAX_STEER_RATE = 3.6; // radians per second
          player.angle += steerAmount * MAX_STEER_RATE * dt;
        }

        // --------------------------------------------------------------------
        // MOVE PLAYER FORWARD ALONG EXACT CURRENT HEADING
        // (No automatic orbiting, waypoint following, or distance-based turning!)
        // --------------------------------------------------------------------
        player.x += Math.cos(player.angle) * player.speed;
        player.y += Math.sin(player.angle) * player.speed;

        // --------------------------------------------------------------------
        // ACCURATE GEOMETRIC TRACK BOUNDARY & BARRIER DETECTION
        // Uses dense sample points to find exact closest centerline point
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

        // Off-track grass runoff slows the car slightly and creates dust particles
        if (distFromCenter > halfTrack) {
          player.speed = Math.min(player.speed, 3.2);
          if (Math.random() < 0.35) {
            particles.push({
              x: player.x,
              y: player.y,
              vx: (Math.random() - 0.5) * 1.8,
              vy: (Math.random() - 0.5) * 1.8,
              alpha: 0.55,
              size: 3 + Math.random() * 3,
              color: track.theme === 'desert' ? '#F59E0B' : '#10B981',
            });
          }
        }

        // Outer / Inner barrier collision: gently push car back inward
        // Car slides along barrier without spinning or reversing uncontrollably
        const maxBarrierDist = halfTrack + 16;
        if (distFromCenter > maxBarrierDist && distFromCenter > 0.01) {
          const vx = player.x - closestPt.x;
          const vy = player.y - closestPt.y;
          const len = Math.hypot(vx, vy) || 1;
          player.x = closestPt.x + (vx / len) * maxBarrierDist;
          player.y = closestPt.y + (vy / len) * maxBarrierDist;

          // Dampen speed on impact & trigger bump sound
          if (player.speed > 2.5) {
            soundEngine.playBarrierBump();
          }
          player.speed = Math.max(0.6, player.speed * 0.75);

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
        const isTurningHard = Math.abs(steerAmount) > 0.45;
        if ((isTurningHard && player.speed > 3.6) || (braking && player.speed > 2.8)) {
          const rearX = player.x - Math.cos(player.angle) * 14;
          const rearY = player.y - Math.sin(player.angle) * 14;
          skidmarks.push({
            x1: rearX,
            y1: rearY,
            x2: rearX - Math.cos(player.angle) * 4,
            y2: rearY - Math.sin(player.angle) * 4,
            alpha: braking ? 0.6 : 0.35,
          });
          if (skidmarks.length > 180) skidmarks.shift();
        }

        // Checkpoints & Laps Detection
        const nextCheck = (player.checkpoint + 1) % CHECKPOINT_COUNT;
        const checkPointTarget = getTrackPoint(nextCheck / CHECKPOINT_COUNT, worldCx, worldCy);
        const distToCheck = Math.hypot(player.x - checkPointTarget.x, player.y - checkPointTarget.y);

        if (distToCheck < track.trackWidth * 1.1) {
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
                finalPlacement === 1 ? 2600 : finalPlacement === 2 ? 1900 : finalPlacement === 3 ? 1300 : 850;
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
      // 2. SOLO AI BOTS SIMULATION (ONLY IN SOLO MODE, NEVER IN MULTIPLAYER)
      // Strictly skips the player car so AI logic NEVER alters player state
      // ----------------------------------------------------------------------
      if (!isMultiplayer && raceStarted) {
        racers.forEach((r) => {
          if (r.isPlayer || r.id === playerId || r.id === 'player' || r.finished) return;

          // AI bots smoothly follow the track along their designated lane offset
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

          // Target point slightly ahead on track
          const aheadIdx = (bIdx + 8) % SAMPLE_COUNT;
          const aheadPt = trackSamples[aheadIdx];
          const targetX = aheadPt.x + aheadPt.nx * r.laneOffset;
          const targetY = aheadPt.y + aheadPt.ny * r.laneOffset;

          const desiredAngle = Math.atan2(targetY - r.y, targetX - r.x);
          let angleDiff = desiredAngle - r.angle;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

          r.angle += angleDiff * Math.min(1, 3.8 * dt);

          if (r.speed < r.targetSpeed) {
            r.speed += 3.2 * dt;
          }

          r.x += Math.cos(r.angle) * r.speed;
          r.y += Math.sin(r.angle) * r.speed;

          const nextCheck = (r.checkpoint + 1) % CHECKPOINT_COUNT;
          const checkPt = getTrackPoint(nextCheck / CHECKPOINT_COUNT, worldCx, worldCy);
          if (Math.hypot(r.x - checkPt.x, r.y - checkPt.y) < track.trackWidth * 1.1) {
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
      // 3. MULTIPLAYER REMOTE OPPONENT SMOOTH SYNC (ONLY IN MULTIPLAYER)
      // Interpolates remote player cars smoothly from validated room state
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

              const centerPt = getTrackPoint(t, worldCx, worldCy);
              const pNext = getTrackPoint((t + 0.005) % 1, worldCx, worldCy);
              const hAngle = Math.atan2(pNext.y - centerPt.y, pNext.x - centerPt.x);
              const nX = -Math.sin(hAngle);
              const nY = Math.cos(hAngle);

              const targetX = centerPt.x + nX * r.laneOffset;
              const targetY = centerPt.y + nY * r.laneOffset;

              // Smooth lerp to prevent teleports
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
      // 4. CAR-TO-CAR ELASTIC BUMPING (Prevents cars overlapping or getting stuck)
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
      // 5. RANKINGS CALCULATION & PLACEMENT
      // ----------------------------------------------------------------------
      racers.forEach((r) => {
        r.progressScore =
          (r.finished ? 100000 : 0) +
          r.lap * 1000 +
          r.checkpoint * 60 +
          (300 - Math.hypot(r.x - worldCx, r.y - worldCy) / 10);
      });
      const sorted = [...racers].sort((a, b) => b.progressScore - a.progressScore);
      sorted.forEach((r, rankIdx) => {
        r.placement = rankIdx + 1;
      });

      // ----------------------------------------------------------------------
      // 6. THROTTLED REACT HUD SYNC (Every ~120ms to prevent React re-renders)
      // ----------------------------------------------------------------------
      if (now - lastHudSyncTime > 120 && player) {
        lastHudSyncTime = now;
        if (raceStarted) {
          setLapElapsedMs(Math.round(now - player.lapStartTime));
        }
        setCurrentSpeedKmh(Math.round(player.speed * 32));
        setPlayerPosition(player.placement);
      }

      // ----------------------------------------------------------------------
      // 7. THROTTLED PROGRESS REPORTING TO PARENT (Every ~400ms)
      // ----------------------------------------------------------------------
      if (now - lastProgressReportTime > 400 && player && !player.finished && raceStarted) {
        lastProgressReportTime = now;
        if (onProgressUpdateRef.current) {
          const racePct = Math.min(
            100,
            Math.round(((player.lap - 1 + player.checkpoint / CHECKPOINT_COUNT) / TOTAL_LAPS) * 100)
          );
          const liveScore = Math.max(10, (racers.length + 1 - player.placement) * 200 + racePct * 10);
          onProgressUpdateRef.current(racePct, liveScore);
        }
      }

      // ----------------------------------------------------------------------
      // 8. CANVAS RENDERING WITH RESPONSIVE VIEWPORT FIT
      // The ENTIRE racing circuit fits cleanly inside the available viewport.
      // Proportions are preserved. No cropping of start line, track edges or corners.
      // ----------------------------------------------------------------------
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewW = canvas.width / dpr;
      const viewH = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, viewW, viewH);

      // Dedicated padding accounting for top HUD (56px) and corner controls (48px)
      const topHudPadding = 56;
      const bottomControlsPadding = 32;
      const horizontalPadding = 36;

      const availW = Math.max(200, viewW - horizontalPadding * 2);
      const availH = Math.max(150, viewH - topHudPadding - bottomControlsPadding);

      // Uniform scale factor guarantees track proportions are 100% preserved
      const scaleX = availW / trackBounds.totalWidth;
      const scaleY = availH / trackBounds.totalHeight;
      const fitScale = Math.min(scaleX, scaleY);

      // Center the circuit in the designated playable area
      const screenCenterX = viewW / 2;
      const screenCenterY = topHudPadding + availH / 2;

      ctx.save();
      ctx.translate(screenCenterX, screenCenterY);
      ctx.scale(fitScale, fitScale);

      // Background Terrain (World Space)
      const terrainMargin = 120;
      const terrainW = trackBounds.totalWidth + terrainMargin * 2;
      const terrainH = trackBounds.totalHeight + terrainMargin * 2;
      ctx.fillStyle =
        track.theme === 'desert'
          ? '#92400E'
          : track.theme === 'neon'
            ? '#050814'
            : track.theme === 'midnight'
              ? '#0B0F19'
              : track.theme === 'cyber'
                ? '#0A0E1A'
                : '#064E3B';
      ctx.fillRect(-terrainW / 2, -terrainH / 2, terrainW, terrainH);

      // Inner field grass/ground
      ctx.fillStyle =
        track.theme === 'desert'
          ? '#B45309'
          : track.theme === 'neon'
            ? '#0F172A'
            : track.theme === 'midnight'
              ? '#111827'
              : track.theme === 'cyber'
                ? '#0D1527'
                : '#047857';
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
        const px = pt.x + pt.nx * (halfW + 8);
        const py = pt.y + pt.ny * (halfW + 8);
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
      const startPt = getTrackPoint(0, worldCx, worldCy);
      const startPtNext = getTrackPoint(0.005, worldCx, worldCy);
      const startAngle = Math.atan2(startPtNext.y - startPt.y, startPtNext.x - startPt.x);

      ctx.save();
      ctx.translate(startPt.x, startPt.y);
      ctx.rotate(startAngle);

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

      // STARTING GRID BOX BRACKETS (Markings on Track)
      racers.forEach((r, idx) => {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.angle);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-18, -12, 36, 24);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`[${idx + 1}]`, -24, 3);
        ctx.restore();
      });

      // Draw Skid Marks
      skidmarks.forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(15, 23, 42, ${s.alpha})`;
        ctx.stroke();
      });

      // Draw Particles (Dust, smoke, sparks)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.025;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Draw All Cars
      racers.forEach((r) => {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.angle);

        // Ground shadow under car
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.ellipse(-2, 4, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4 Racing Wheels
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-14, -11, 9, 4);
        ctx.fillRect(-14, 7, 9, 4);
        ctx.fillRect(7, -11, 9, 4);
        ctx.fillRect(7, 7, 9, 4);

        // Aerodynamic Sports Car Body
        ctx.fillStyle = r.colorHex;
        ctx.beginPath();
        ctx.moveTo(-16, -8);
        ctx.lineTo(13, -7);
        ctx.lineTo(21, 0);
        ctx.lineTo(13, 7);
        ctx.lineTo(-16, 8);
        ctx.closePath();
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
        ctx.fillRect(18, -5, 3, 3);
        ctx.fillRect(18, 2, 3, 3);

        // Tail brake lights glow when braking
        if (r.isBraking) {
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(-17, -5, 3.5, 0, Math.PI * 2);
          ctx.arc(-17, 5, 3.5, 0, Math.PI * 2);
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
    level,
    track,
    isMultiplayer,
    playerId,
    playerColor,
    playerNickname,
    getTrackPoint,
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

      {/* TOP HUD BAR: Minimal, compact, clean */}
      <div className="pointer-events-none relative z-20 flex w-full items-center justify-between px-3 pt-2 sm:px-6 sm:pt-3">
        {/* Left: Exit & Circuit Info */}
        <div className="flex items-center gap-2">
          {onExitRequest && (
            <button
              type="button"
              onClick={onExitRequest}
              className="pointer-events-auto flex h-9 items-center gap-1 rounded-xl border border-white/20 bg-slate-900/80 px-2.5 text-xs font-black text-white shadow-md backdrop-blur-md active:scale-95"
              aria-label="Exit Game"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-1.5 shadow-md backdrop-blur-md">
            <span className="font-display text-xs font-black text-amber-400">
              LAP {currentLap}/{track.laps}
            </span>
            <span className="hidden text-xs font-bold text-slate-300 md:inline">
              · {track.name}
            </span>
          </div>
        </div>

        {/* Center: Position Rank Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`flex h-9 items-center gap-1.5 rounded-xl px-3.5 font-display text-sm font-black shadow-lg backdrop-blur-md ${
              playerPosition === 1
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                : playerPosition === 2
                  ? 'bg-slate-200 text-slate-900'
                  : playerPosition === 3
                    ? 'bg-orange-400 text-slate-950'
                    : 'bg-slate-900/80 text-white border border-white/20'
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>POS #{playerPosition}</span>
          </div>
        </div>

        {/* Right: Speedometer & Fullscreen Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-1.5 font-mono text-xs font-extrabold shadow-md backdrop-blur-md">
            <div className="flex items-center gap-1 text-sky-400">
              <Gauge className="h-3.5 w-3.5" />
              <span>{currentSpeedKmh} KM/H</span>
            </div>
            <span className="text-slate-400">
              {(lapElapsedMs / 1000).toFixed(1)}s
            </span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-slate-900/80 text-white shadow-md backdrop-blur-md active:scale-95"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* PRE-RACE COUNTDOWN OVERLAY */}
      {countdownText && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center">
          <div
            key={countdownText}
            className={`flex h-28 w-28 items-center justify-center rounded-full border-4 shadow-2xl backdrop-blur-md animate-pulse sm:h-36 sm:w-36 ${
              countdownText === 'GO!'
                ? 'border-emerald-300 bg-emerald-500/90 text-white ring-8 ring-emerald-400/50 scale-125'
                : 'border-amber-300 bg-slate-900/90 text-amber-300 ring-8 ring-amber-400/30'
            }`}
          >
            <span className="font-display text-4xl font-black tracking-widest sm:text-6xl">
              {countdownText}
            </span>
          </div>
          <p className="mt-4 font-display text-sm font-black tracking-wider text-white uppercase drop-shadow-md sm:text-base">
            {countdownText === 'GO!' ? 'RACE IS ON!' : 'GET READY ON THE GRID'}
          </p>
        </div>
      )}

      {/* Celebration Finish Overlay */}
      {raceFinished && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/80 p-4 text-center backdrop-blur-sm animate-fade-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-400 text-4xl shadow-2xl animate-bounce">
            🏁
          </div>
          <h2 className="mt-3 font-display text-2xl font-black text-white sm:text-3xl">
            RACE COMPLETE!
          </h2>
          <p className="mt-1 text-sm font-bold text-amber-300">
            Finished #{playerPosition} · Best Lap: {(bestLapMs / 1000).toFixed(2)}s
          </p>
        </div>
      )}

      {/* LANDSCAPE CONTROLS OVERLAY:
          - Bottom-Left: Large 360-degree Virtual Joystick (Outer Ring + Inner Follow Knob)
          - Bottom-Right: Large BRAKE Button (Press and Hold) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between p-3 sm:p-6">
        {/* LEFT CORNER: 360° VIRTUAL JOYSTICK */}
        <div className="relative flex flex-col items-center">
          <div
            ref={joystickBaseRef}
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            className={`pointer-events-auto relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-white/30 bg-slate-900/60 shadow-2xl backdrop-blur-md transition-colors select-none sm:h-34 sm:w-34 ${
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
                transition: joystickActive ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              <Compass className="h-5 w-5 stroke-[2.5] sm:h-6 sm:w-6" />
            </div>
          </div>
          <span className="mt-1 text-[10px] font-black tracking-wider text-slate-300/80 uppercase sm:text-xs">
            Steer 360°
          </span>
        </div>

        {/* RIGHT CORNER: LARGE BRAKE BUTTON */}
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
            onPointerLeave={() => setIsBraking(false)}
            onPointerCancel={() => setIsBraking(false)}
            className={`pointer-events-auto flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-rose-500/80 bg-gradient-to-b from-rose-600 to-rose-800 text-white shadow-2xl backdrop-blur-md active:scale-95 sm:h-30 sm:w-30 ${
              isBraking
                ? 'border-rose-300 from-rose-500 to-rose-700 ring-4 ring-rose-400/50 scale-95'
                : 'hover:brightness-110'
            }`}
            style={{ touchAction: 'none' }}
            aria-label="Hold to Brake"
          >
            <Flame className="h-6 w-6 text-amber-200 fill-amber-300 sm:h-8 sm:w-8" />
            <span className="font-display text-[11px] font-black tracking-wider sm:text-xs">
              BRAKE
            </span>
          </button>
          <span className="mt-1 text-[10px] font-black tracking-wider text-slate-300/80 uppercase sm:text-xs">
            Hold to Slow
          </span>
        </div>
      </div>

      {/* Gentle Mobile Rotate Prompt (Visible on phones when in portrait mode) */}
      {showRotatePrompt && (
        <div className="pointer-events-auto absolute inset-x-2 top-14 z-50 flex items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur-md sm:hidden animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950 font-black text-lg">
              📱
            </div>
            <div>
              <p className="text-xs font-extrabold text-amber-300">
                Rotate Phone for Landscape View
              </p>
              <p className="text-[10px] font-semibold text-slate-400">
                Circular Racer plays best in full horizontal screen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRotatePrompt(false)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-300 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
