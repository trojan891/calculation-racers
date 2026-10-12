import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Flame,
  Gauge,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { CarColor, CAR_PALETTE } from '../types';
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
  playerColor?: CarColor;
  playerNickname?: string;
  isMultiplayer?: boolean;
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

export const CircularRacerCanvas: React.FC<CircularRacerCanvasProps> = ({
  level,
  playerColor = 'blue',
  playerNickname = 'You',
  isMultiplayer = false,
  onFinish,
  onProgressUpdate,
  onExitRequest,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const track = CIRCULAR_TRACKS[(level - 1) % CIRCULAR_TRACKS.length] || CIRCULAR_TRACKS[0];

  // 360° Virtual Joystick State (Bottom-Left Corner)
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 }); // offset in px [-radius, radius]
  const joystickVectorRef = useRef({ x: 0, y: 0, magnitude: 0, active: false });

  // Brake Button State (Bottom-Right Corner)
  const [isBraking, setIsBraking] = useState(false);
  const isBrakingRef = useRef(false);

  // Keyboard controls
  const keysRef = useRef<{ left: boolean; right: boolean; up: boolean; down: boolean }>({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  // HUD stats for React display
  const [currentLap, setCurrentLap] = useState(1);
  const [playerPosition, setPlayerPosition] = useState(1);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [lapElapsedMs, setLapElapsedMs] = useState(0);
  const [bestLapMs, setBestLapMs] = useState(0);
  const [raceFinished, setRaceFinished] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);

  // Keep refs in sync for the requestAnimationFrame loop
  useEffect(() => {
    isBrakingRef.current = isBraking;
  }, [isBraking]);

  // Orientation & Fullscreen Handler
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
        setShowRotatePrompt(isPortrait);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    // Try requesting landscape if screen.orientation is supported (user-friendly progressive enhancement)
    try {
      const orientation = (screen as any).orientation;
      if (orientation && typeof orientation.lock === 'function') {
        orientation.lock('landscape').catch(() => {
          // Graceful fallback: some browsers require full-screen first or block orientation locking
        });
      }
    } catch {
      // ignore
    }

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
            // ignore
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

  // Track parametric math helpers (elliptical curve with chicanes)
  const getTrackPoint = useCallback(
    (t: number, cx: number, cy: number) => {
      // t is in [0, 1]
      const angle = t * Math.PI * 2 - Math.PI / 2;
      const rMod = 1 + (Math.sin(angle * 2) * track.curvature) / 360;
      const x = cx + Math.cos(angle) * track.rx * rMod;
      const y = cy + Math.sin(angle) * track.ry * rMod;
      return { x, y, angle };
    },
    [track]
  );

  // Virtual Joystick Pointer Handlers (Pointer Capture Enabled)
  const JOYSTICK_RADIUS = 50; // max knob travel distance in pixels

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const clampedDist = Math.min(distance, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);

    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    setJoystickActive(true);
    setJoystickPos({ x: clampedX, y: clampedY });
    joystickVectorRef.current = {
      x: clampedDist > 6 ? clampedX / JOYSTICK_RADIUS : 0,
      y: clampedDist > 6 ? clampedY / JOYSTICK_RADIUS : 0,
      magnitude: clampedDist / JOYSTICK_RADIUS,
      active: true,
    };
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!joystickVectorRef.current.active && !joystickActive) return;
    e.preventDefault();
    e.stopPropagation();

    const baseEl = joystickBaseRef.current;
    if (!baseEl) return;
    const rect = baseEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const clampedDist = Math.min(distance, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);

    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    setJoystickPos({ x: clampedX, y: clampedY });
    joystickVectorRef.current = {
      x: clampedDist > 6 ? clampedX / JOYSTICK_RADIUS : 0,
      y: clampedDist > 6 ? clampedY / JOYSTICK_RADIUS : 0,
      magnitude: clampedDist / JOYSTICK_RADIUS,
      active: true,
    };
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    joystickVectorRef.current = { x: 0, y: 0, magnitude: 0, active: false };
  };

  // Main 60FPS Game Loop with Camera Following & Smooth Driving Physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    const raceStartTime = performance.now();

    // Resize canvas internal buffer to match real viewport container size
    const updateCanvasResolution = () => {
      const container = containerRef.current;
      if (container && canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = container.clientWidth || 960;
        const h = container.clientHeight || 540;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
      }
    };
    updateCanvasResolution();
    window.addEventListener('resize', updateCanvasResolution);

    // Track center in world coordinates
    const worldCx = 0;
    const worldCy = 0;

    const CHECKPOINT_COUNT = 12;
    const TOTAL_LAPS = track.laps;
    const playerPalette = CAR_PALETTE[playerColor] || CAR_PALETTE.blue;

    // Camera State (smooth following)
    const camera = { x: 0, y: 0 };

    // Initialize Racers (1 Player + 3 AI Opponents)
    const initialPlayerPt = getTrackPoint(0, worldCx, worldCy);
    const initialAI1Pt = getTrackPoint(0.018, worldCx, worldCy);
    const initialAI2Pt = getTrackPoint(0.036, worldCx, worldCy);
    const initialAI3Pt = getTrackPoint(0.054, worldCx, worldCy);

    const racers: RacerState[] = [
      {
        id: 'player',
        isPlayer: true,
        nickname: playerNickname,
        colorHex: playerPalette.primary,
        x: initialPlayerPt.x,
        y: initialPlayerPt.y,
        angle: initialPlayerPt.angle,
        speed: 0,
        targetSpeed: 0,
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
        id: 'ai-1',
        isPlayer: false,
        nickname: 'Apex Mia',
        colorHex: '#EF4444',
        x: initialAI1Pt.x,
        y: initialAI1Pt.y,
        angle: initialAI1Pt.angle,
        speed: 0,
        targetSpeed: 5.0 + Math.random() * 0.6,
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
        id: 'ai-2',
        isPlayer: false,
        nickname: 'Turbo Rex',
        colorHex: '#10B981',
        x: initialAI2Pt.x,
        y: initialAI2Pt.y,
        angle: initialAI2Pt.angle,
        speed: 0,
        targetSpeed: 4.8 + Math.random() * 0.6,
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
        id: 'ai-3',
        isPlayer: false,
        nickname: 'Volt Sam',
        colorHex: '#A855F7',
        x: initialAI3Pt.x,
        y: initialAI3Pt.y,
        angle: initialAI3Pt.angle,
        speed: 0,
        targetSpeed: 4.6 + Math.random() * 0.6,
        lap: 1,
        checkpoint: 0,
        lapStartTime: performance.now(),
        bestLapMs: 0,
        finished: false,
        finishTimeMs: 0,
        placement: 4,
        progressScore: 0,
      },
    ];

    // Orient initial angles tangentially along the race line
    racers.forEach((r, idx) => {
      const p1 = getTrackPoint((idx * 0.018) % 1, worldCx, worldCy);
      const p2 = getTrackPoint(((idx * 0.018) + 0.01) % 1, worldCx, worldCy);
      r.angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    });

    camera.x = racers[0].x;
    camera.y = racers[0].y;

    const particles: Particle[] = [];
    const skidmarks: SkidSegment[] = [];

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
    // MAIN 60 FPS TICK LOOP
    // ========================================================================
    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const player = racers[0];

      // ----------------------------------------------------------------------
      // 1. PLAYER DRIVING PHYSICS & 360° JOYSTICK INTEGRATION
      // ----------------------------------------------------------------------
      if (!player.finished) {
        const joy = joystickVectorRef.current;
        const braking = isBrakingRef.current || keysRef.current.down;
        player.isBraking = braking;

        // Base Auto-Forward Cruise Speed + Natural Acceleration
        const NORMAL_MAX_SPEED = 6.2;
        const ACCEL_RATE = 5.2 * dt;
        const BRAKE_DECEL = 10.5 * dt;
        const MIN_BRAKE_SPEED = 0.6; // Controlled slow roll under hard braking

        if (braking) {
          // Smooth deceleration when holding the Brake button
          if (player.speed > MIN_BRAKE_SPEED) {
            player.speed = Math.max(MIN_BRAKE_SPEED, player.speed - BRAKE_DECEL);
          }
        } else {
          // Automatic forward driving motion, accelerating towards full top speed
          if (player.speed < NORMAL_MAX_SPEED) {
            player.speed = Math.min(NORMAL_MAX_SPEED, player.speed + ACCEL_RATE);
          }
        }

        // 360° Steering Control via Joystick or Keyboard
        let targetAngle = player.angle;
        let hasDirectionInput = false;

        if (joy.active && joy.magnitude > 0.12) {
          // Continuous 360° virtual joystick angle
          targetAngle = Math.atan2(joy.y, joy.x);
          hasDirectionInput = true;
        } else if (keysRef.current.left || keysRef.current.right || keysRef.current.up) {
          // Desktop Arrow/WASD fallback
          const steerRate = 3.6 * dt;
          if (keysRef.current.left) player.angle -= steerRate;
          if (keysRef.current.right) player.angle += steerRate;
        }

        if (hasDirectionInput) {
          // Smooth angle interpolation towards desired joystick heading
          let diff = targetAngle - player.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;

          // Responsive turning (high responsiveness so car immediately steers to joystick direction)
          const turnSens = 5.2 * dt * Math.min(1.4, Math.max(0.7, joy.magnitude));
          player.angle += diff * Math.min(1, turnSens);
        }

        // Distance from track centerline
        const angleFromCenter = Math.atan2(player.y - worldCy, player.x - worldCx);
        const normAngle = ((angleFromCenter + Math.PI / 2 + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2);
        const centerPt = getTrackPoint(normAngle, worldCx, worldCy);
        const distFromCenter = Math.hypot(player.x - centerPt.x, player.y - centerPt.y);

        const halfTrack = track.trackWidth / 2;

        // Off-road Grass / Sand Friction Check
        if (distFromCenter > halfTrack) {
          player.speed = Math.min(player.speed, 2.8); // off-track slowdown
          if (Math.random() < 0.45) {
            particles.push({
              x: player.x,
              y: player.y,
              vx: (Math.random() - 0.5) * 2.0,
              vy: (Math.random() - 0.5) * 2.0,
              alpha: 0.65,
              size: 3 + Math.random() * 3,
              color: track.theme === 'desert' ? '#F59E0B' : '#10B981',
            });
          }
        }

        // Tire Skid Marks when cornering at speed or braking
        const isTurningHard = Math.abs(joy.x) > 0.5 || keysRef.current.left || keysRef.current.right;
        if ((isTurningHard && player.speed > 3.8) || (braking && player.speed > 3.0)) {
          const rearX = player.x - Math.cos(player.angle) * 14;
          const rearY = player.y - Math.sin(player.angle) * 14;
          skidmarks.push({
            x1: rearX,
            y1: rearY,
            x2: rearX - Math.cos(player.angle) * 4,
            y2: rearY - Math.sin(player.angle) * 4,
            alpha: braking ? 0.65 : 0.4,
          });
          if (skidmarks.length > 150) skidmarks.shift();

          if (Math.random() < 0.4) {
            particles.push({
              x: rearX,
              y: rearY,
              vx: (Math.random() - 0.5) * 1.5,
              vy: (Math.random() - 0.5) * 1.5,
              alpha: 0.55,
              size: 4 + Math.random() * 4,
              color: '#CBD5E1',
            });
          }
        }

        // Move Player Forward along current heading
        const prevX = player.x;
        const prevY = player.y;
        player.x += Math.cos(player.angle) * player.speed;
        player.y += Math.sin(player.angle) * player.speed;

        // Track Hard Barrier Collision Restraint
        const maxDist = halfTrack + 26;
        if (distFromCenter > maxDist) {
          player.x = prevX;
          player.y = prevY;
          player.speed *= -0.25; // bounce back into track
          soundEngine.playBarrierBump();
        }

        // Live HUD updates
        setLapElapsedMs(Math.round(now - player.lapStartTime));
        setCurrentSpeedKmh(Math.round(player.speed * 32));

        // Checkpoint & Finish Line Detection
        const nextCheck = (player.checkpoint + 1) % CHECKPOINT_COUNT;
        const checkPointTarget = getTrackPoint(nextCheck / CHECKPOINT_COUNT, worldCx, worldCy);
        const distToCheck = Math.hypot(player.x - checkPointTarget.x, player.y - checkPointTarget.y);

        if (distToCheck < track.trackWidth * 0.95) {
          player.checkpoint = nextCheck;
          if (nextCheck === 0) {
            // Lap complete!
            const lapDuration = now - player.lapStartTime;
            if (player.bestLapMs === 0 || lapDuration < player.bestLapMs) {
              player.bestLapMs = Math.round(lapDuration);
              setBestLapMs(player.bestLapMs);
            }
            soundEngine.playSuccess();

            if (player.lap >= TOTAL_LAPS) {
              // Race Finish!
              player.finished = true;
              player.finishTimeMs = Math.round(now - raceStartTime);
              soundEngine.playRaceFinish();
              setRaceFinished(true);

              const finalPlacement = player.placement;
              const placeBaseScore =
                finalPlacement === 1 ? 2600 : finalPlacement === 2 ? 1900 : finalPlacement === 3 ? 1300 : 850;
              const timeBonus = Math.max(0, 1000 - Math.floor(player.finishTimeMs / 100));
              const totalScore = placeBaseScore + timeBonus;

              onFinish({
                placement: finalPlacement,
                finalTimeMs: player.finishTimeMs,
                bestLapMs: player.bestLapMs,
                score: totalScore,
                lapsCompleted: TOTAL_LAPS,
              });
            } else {
              player.lap += 1;
              player.lapStartTime = now;
              setCurrentLap(player.lap);
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // 2. AI COMPETITOR PHYSICS & PATH FOLLOWING
      // ----------------------------------------------------------------------
      racers.forEach((r) => {
        if (r.isPlayer || r.finished) return;

        const curNormAngle =
          ((Math.atan2(r.y - worldCy, r.x - worldCx) + Math.PI / 2 + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2);
        const targetT = (curNormAngle + 0.022) % 1;
        const targetPt = getTrackPoint(targetT, worldCx, worldCy);

        const desiredAngle = Math.atan2(targetPt.y - r.y, targetPt.x - r.x);
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

      // ----------------------------------------------------------------------
      // 3. RANKINGS & MULTIPLAYER LEADERBOARD STATS
      // ----------------------------------------------------------------------
      racers.forEach((r) => {
        r.progressScore = r.lap * 1000 + r.checkpoint * 60 + (200 - Math.hypot(r.x - worldCx, r.y - worldCy) / 10);
      });
      const sorted = [...racers].sort((a, b) => b.progressScore - a.progressScore);
      sorted.forEach((r, rankIdx) => {
        r.placement = rankIdx + 1;
      });
      const curPlayerRank = racers[0].placement;
      setPlayerPosition(curPlayerRank);

      if (onProgressUpdate && !player.finished) {
        const racePct = Math.min(
          100,
          Math.round(((player.lap - 1 + player.checkpoint / CHECKPOINT_COUNT) / TOTAL_LAPS) * 100)
        );
        const liveScore = Math.max(10, (5 - curPlayerRank) * 200 + racePct * 10);
        onProgressUpdate(racePct, liveScore);
      }

      // ----------------------------------------------------------------------
      // 4. CAMERA SMOOTH CENTERING ON PLAYER
      // ----------------------------------------------------------------------
      const camLerp = 0.12;
      camera.x += (player.x - camera.x) * camLerp;
      camera.y += (player.y - camera.y) * camLerp;

      // ----------------------------------------------------------------------
      // 5. CANVAS 2D RENDERING WITH DYNAMIC CAMERA
      // ----------------------------------------------------------------------
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewW = canvas.width / dpr;
      const viewH = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, viewW, viewH);

      // Camera World Transform (Centered on Player Car)
      ctx.save();
      ctx.translate(viewW / 2 - camera.x, viewH / 2 - camera.y);

      // Background Field / Terrain
      let bgGrad: CanvasGradient;
      if (track.theme === 'neon' || track.theme === 'cyber') {
        bgGrad = ctx.createRadialGradient(worldCx, worldCy, 100, worldCx, worldCy, 900);
        bgGrad.addColorStop(0, '#0B0F19');
        bgGrad.addColorStop(1, '#030712');
      } else if (track.theme === 'desert') {
        bgGrad = ctx.createRadialGradient(worldCx, worldCy, 100, worldCx, worldCy, 900);
        bgGrad.addColorStop(0, '#D97706');
        bgGrad.addColorStop(1, '#92400E');
      } else if (track.theme === 'midnight') {
        bgGrad = ctx.createRadialGradient(worldCx, worldCy, 100, worldCx, worldCy, 900);
        bgGrad.addColorStop(0, '#0F172A');
        bgGrad.addColorStop(1, '#020617');
      } else {
        bgGrad = ctx.createRadialGradient(worldCx, worldCy, 100, worldCx, worldCy, 900);
        bgGrad.addColorStop(0, '#16A34A');
        bgGrad.addColorStop(1, '#14532D');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(worldCx - 1400, worldCy - 1100, 2800, 2200);

      // Track Skid Marks
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = track.theme === 'desert' ? 'rgba(120,53,15,0.35)' : 'rgba(15,23,42,0.4)';
      skidmarks.forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      });

      // Track Path
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const pt = getTrackPoint(i / 100, worldCx, worldCy);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();

      // Outer Kerb / Boundary Line
      ctx.lineWidth = track.trackWidth + 16;
      ctx.strokeStyle = track.theme === 'cyber' ? '#0284C7' : track.theme === 'neon' ? '#EC4899' : '#DC2626';
      ctx.stroke();

      // Asphalt Road Surface
      ctx.lineWidth = track.trackWidth;
      ctx.strokeStyle =
        track.theme === 'neon' ? '#1E1B4B' : track.theme === 'cyber' ? '#0F172A' : '#1E293B';
      ctx.stroke();

      // Center Dashed Racing Guide
      ctx.setLineDash([14, 12]);
      ctx.lineWidth = 3;
      ctx.strokeStyle =
        track.theme === 'neon' ? '#F43F5E' : track.theme === 'cyber' ? '#38BDF8' : '#FACC15';
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner Infield Island Fill
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const pt = getTrackPoint(i / 80, worldCx, worldCy);
        const inPtX = worldCx + (pt.x - worldCx) * (1 - (track.trackWidth * 0.48) / track.rx);
        const inPtY = worldCy + (pt.y - worldCy) * (1 - (track.trackWidth * 0.48) / track.ry);
        if (i === 0) ctx.moveTo(inPtX, inPtY);
        else ctx.lineTo(inPtX, inPtY);
      }
      ctx.closePath();
      ctx.fillStyle =
        track.theme === 'desert'
          ? '#B45309'
          : track.theme === 'cyber'
            ? '#020617'
            : track.theme === 'neon'
              ? '#0B0F19'
              : '#15803D';
      ctx.fill();

      // Checkered Start / Finish Line
      const finishPt = getTrackPoint(0, worldCx, worldCy);
      ctx.save();
      ctx.translate(finishPt.x, finishPt.y);
      const angleAtFinish = finishPt.angle + Math.PI / 2;
      ctx.rotate(angleAtFinish);
      for (let sq = -track.trackWidth / 2; sq < track.trackWidth / 2; sq += 10) {
        ctx.fillStyle = Math.floor(sq / 10) % 2 === 0 ? '#FFFFFF' : '#000000';
        ctx.fillRect(-6, sq, 12, 10);
      }
      ctx.restore();

      // Checkpoint Glowing Dots
      for (let c = 1; c < CHECKPOINT_COUNT; c++) {
        const cp = getTrackPoint(c / CHECKPOINT_COUNT, worldCx, worldCy);
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
      }

      // Particles (Dust, Smoke, Sparks)
      for (let pIdx = particles.length - 1; pIdx >= 0; pIdx--) {
        const p = particles[pIdx];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.025;
        if (p.alpha <= 0) {
          particles.splice(pIdx, 1);
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

        // Outline
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Racing Stripe
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-14, -2, 28, 4);

        // Cockpit
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

        // Player Name Banner
        if (r.isPlayer) {
          ctx.restore();
          ctx.save();
          ctx.translate(r.x, r.y - 24);
          ctx.fillStyle = '#2563EB';
          ctx.beginPath();
          ctx.roundRect(-22, -12, 44, 16, 7);
          ctx.fill();
          ctx.strokeStyle = '#93C5FD';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`YOU`, 0, 0);
        }

        ctx.restore();
      });

      ctx.restore(); // Restore world transform

      // ----------------------------------------------------------------------
      // 6. MINIMAP OVERLAY IN TOP-RIGHT CORNER (Screen Space)
      // ----------------------------------------------------------------------
      const mmW = 105;
      const mmH = 68;
      const mmX = viewW - mmW - 14;
      const mmY = 14;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(mmX, mmY, mmW, mmH, 12);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.stroke();

      // Mini-map circuit outline
      ctx.beginPath();
      for (let m = 0; m <= 50; m++) {
        const pt = getTrackPoint(m / 50, worldCx, worldCy);
        const mapX = mmX + mmW / 2 + (pt.x - worldCx) * (mmW / 2 / (track.rx + 60));
        const mapY = mmY + mmH / 2 + (pt.y - worldCy) * (mmH / 2 / (track.ry + 60));
        if (m === 0) ctx.moveTo(mapX, mapY);
        else ctx.lineTo(mapX, mapY);
      }
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#94A3B8';
      ctx.stroke();

      // Mini-map Racer Dots
      racers.forEach((r) => {
        const mapX = mmX + mmW / 2 + (r.x - worldCx) * (mmW / 2 / (track.rx + 60));
        const mapY = mmY + mmH / 2 + (r.y - worldCy) * (mmH / 2 / (track.ry + 60));
        ctx.beginPath();
        ctx.arc(mapX, mapY, r.isPlayer ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = r.isPlayer ? '#FACC15' : r.colorHex;
        ctx.fill();
      });

      ctx.restore(); // Restore screen space
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
    track,
    level,
    playerColor,
    playerNickname,
    getTrackPoint,
    onFinish,
    onProgressUpdate,
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
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* TOP HUD BAR: Minimal, compact, clean, inspired by battle-royale racing HUD */}
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
                    ? 'bg-amber-700 text-amber-100'
                    : 'bg-slate-800 text-slate-200 border border-white/10'
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>
              {playerPosition === 1
                ? '1st'
                : playerPosition === 2
                  ? '2nd'
                  : playerPosition === 3
                    ? '3rd'
                    : `${playerPosition}th`}
            </span>
          </div>
        </div>

        {/* Right: Speedometer, Lap Timer & Fullscreen Toggle */}
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

      {/* Celebration Finish Overlay */}
      {raceFinished && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/80 p-4 text-center backdrop-blur-sm">
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between p-4 sm:p-7">
        {/* LEFT CORNER: 360° VIRTUAL JOYSTICK */}
        <div className="relative flex flex-col items-center">
          <div
            ref={joystickBaseRef}
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerUp}
            className={`pointer-events-auto relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-white/30 bg-slate-900/60 shadow-2xl backdrop-blur-md transition-colors select-none sm:h-36 sm:w-36 ${
              joystickActive
                ? 'border-blue-400 bg-blue-950/50 ring-4 ring-blue-500/20'
                : 'hover:border-white/50'
            }`}
            style={{ touchAction: 'none' }}
            aria-label="Virtual Joystick (Steer in any 360 direction)"
          >
            {/* Center Crosshair Guides */}
            <div className="pointer-events-none absolute h-full w-0.5 bg-white/10" />
            <div className="pointer-events-none absolute h-0.5 w-full bg-white/10" />

            {/* Inner Movable Circular Knob */}
            <div
              className={`pointer-events-none flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-radial from-blue-400 to-blue-600 text-white shadow-xl transition-transform sm:h-16 sm:w-16 ${
                joystickActive ? 'scale-110 shadow-blue-500/50' : 'opacity-90'
              }`}
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                transition: joystickActive ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              <Compass className="h-6 w-6 stroke-[2.5]" />
            </div>
          </div>
          <span className="mt-1 text-[11px] font-black tracking-wider text-slate-300/80 uppercase">
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
            className={`pointer-events-auto flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 border-rose-500/80 bg-gradient-to-b from-rose-600 to-rose-800 text-white shadow-2xl backdrop-blur-md active:scale-95 sm:h-32 sm:w-32 ${
              isBraking
                ? 'border-rose-300 from-rose-500 to-rose-700 ring-4 ring-rose-400/50 scale-95'
                : 'hover:brightness-110'
            }`}
            style={{ touchAction: 'none' }}
            aria-label="Hold to Brake"
          >
            <Flame className="h-7 w-7 text-amber-200 fill-amber-300 sm:h-8 sm:w-8" />
            <span className="font-display text-xs font-black tracking-wider sm:text-sm">
              BRAKE
            </span>
          </button>
          <span className="mt-1 text-[11px] font-black tracking-wider text-slate-300/80 uppercase">
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
