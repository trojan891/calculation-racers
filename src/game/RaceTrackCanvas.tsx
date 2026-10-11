import React, { useEffect, useRef } from 'react';
import { CAR_PALETTE, CarColor } from './types';

export interface TrackRacer {
  playerId: string;
  nickname: string;
  carColor: CarColor;
  distance: number; // 0 to 100
  correctAnswers: number;
  wrongAnswers: number;
  finished: boolean;
  isCurrentUser?: boolean;
  lastAction?: 'accelerate' | 'brake' | 'idle';
}

interface RaceTrackCanvasProps {
  racers: TrackRacer[];
  maxLanes?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

export const RaceTrackCanvas: React.FC<RaceTrackCanvasProps> = ({
  racers,
  maxLanes = 4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animatedDistancesRef = useRef<Record<string, number>>({});
  const previousDistancesRef = useRef<Record<string, number>>({});
  const flashStateRef = useRef<Record<string, { type: 'boost' | 'brake'; until: number }>>({});
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const now = performance.now();
    racers.forEach((r) => {
      const prev = previousDistancesRef.current[r.playerId];
      if (prev !== undefined && prev !== r.distance) {
        if (r.distance > prev) {
          flashStateRef.current[r.playerId] = { type: 'boost', until: now + 700 };
        } else if (r.distance < prev) {
          flashStateRef.current[r.playerId] = { type: 'brake', until: now + 700 };
        }
      }
      previousDistancesRef.current[r.playerId] = r.distance;
      if (animatedDistancesRef.current[r.playerId] === undefined) {
        animatedDistancesRef.current[r.playerId] = r.distance;
      }
    });
  }, [racers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = (time: number) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(300, rect.width);
      const laneCount = Math.max(1, Math.min(8, Math.max(racers.length, maxLanes)));
      const laneHeight = laneCount === 1 ? 68 : laneCount === 2 ? 58 : laneCount <= 4 ? 50 : 40;
      const headerHeight = 28;
      const height = headerHeight + laneCount * laneHeight + 8;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Daylight Stadium Track Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      const startX = 64;
      const finishX = width - 64;
      const trackSpan = Math.max(120, finishX - startX);

      // 2. Top Distance Ruler Bar
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(0, 0, width, headerHeight);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, headerHeight);
      ctx.lineTo(width, headerHeight);
      ctx.stroke();

      // Distance markers every 10 units
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      for (let d = 0; d <= 100; d += 10) {
        const x = startX + (d / 100) * trackSpan;
        ctx.fillStyle = d === 100 ? '#059669' : d === 0 ? '#0284C7' : '#64748B';
        if (d % 20 === 0 || width > 620) {
          ctx.fillText(d === 100 ? 'FINISH' : `${d}m`, x, 18);
        }

        // Vertical grid guide across lanes
        ctx.strokeStyle =
          d === 0
            ? 'rgba(2, 132, 199, 0.35)'
            : d === 100
              ? 'rgba(5, 150, 105, 0.45)'
              : '#F1F5F9';
        ctx.lineWidth = d === 0 || d === 100 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, headerHeight);
        ctx.lineTo(x, height - 6);
        ctx.stroke();
      }

      // 3. Lanes & Cars
      for (let i = 0; i < laneCount; i++) {
        const laneTop = headerHeight + i * laneHeight;
        const laneCenterY = laneTop + laneHeight / 2;

        // Alternating soft pastel lane shading
        ctx.fillStyle = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        ctx.fillRect(0, laneTop, width, laneHeight);

        // Lane divider line
        if (i > 0) {
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(12, laneTop);
          ctx.lineTo(width - 12, laneTop);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Lane number badge on left
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.roundRect(12, laneCenterY - 12, 34, 24, 6);
        ctx.fill();

        ctx.fillStyle = '#475569';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`L${i + 1}`, 29, laneCenterY + 4);

        const racer = racers[i];
        if (!racer) {
          ctx.fillStyle = '#94A3B8';
          ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('Waiting for player...', startX + 12, laneCenterY + 4);
          continue;
        }

        // Smoothly interpolate car distance
        const currentAnim = animatedDistancesRef.current[racer.playerId] ?? racer.distance;
        const diff = racer.distance - currentAnim;
        const nextAnim = Math.abs(diff) < 0.08 ? racer.distance : currentAnim + diff * 0.14;
        animatedDistancesRef.current[racer.playerId] = nextAnim;

        const carX = startX + (Math.max(0, Math.min(100, nextAnim)) / 100) * trackSpan;
        const palette = CAR_PALETTE[racer.carColor] || CAR_PALETTE.blue;
        const flash = flashStateRef.current[racer.playerId];
        const isBoosting = flash && flash.type === 'boost' && flash.until > time;
        const isBraking = flash && flash.type === 'brake' && flash.until > time;

        // Soft progress trail bar behind car
        const trailWidth = Math.max(0, carX - startX);
        if (trailWidth > 2) {
          const trailGradient = ctx.createLinearGradient(startX, 0, carX, 0);
          trailGradient.addColorStop(0, 'rgba(226, 232, 240, 0.2)');
          trailGradient.addColorStop(1, palette.glow);
          ctx.fillStyle = trailGradient;
          ctx.beginPath();
          ctx.roundRect(startX, laneCenterY - 7, trailWidth, 14, 7);
          ctx.fill();
        }

        // Emit boost particles when accelerating
        if (isBoosting && Math.random() < 0.65) {
          particlesRef.current.push({
            x: carX - 24,
            y: laneCenterY + (Math.random() - 0.5) * 10,
            vx: -2.4 - Math.random() * 2.2,
            vy: (Math.random() - 0.5) * 0.8,
            radius: 2.5 + Math.random() * 2.5,
            color: '#10B981',
            alpha: 0.9,
          });
        }

        // Draw Top-Down Aerodynamic Race Car
        ctx.save();
        ctx.translate(carX, laneCenterY);

        // Soft drop shadow / feedback glow
        ctx.shadowColor = isBoosting
          ? 'rgba(16, 185, 129, 0.55)'
          : isBraking
            ? 'rgba(244, 63, 94, 0.55)'
            : 'rgba(15, 23, 42, 0.16)';
        ctx.shadowBlur = isBoosting || isBraking ? 14 : 8;
        ctx.shadowOffsetY = 2;

        // 4 Wheels
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.roundRect(-18, -13, 9, 4, 1.5);
        ctx.roundRect(-18, 9, 9, 4, 1.5);
        ctx.roundRect(8, -13, 9, 4, 1.5);
        ctx.roundRect(8, 9, 9, 4, 1.5);
        ctx.fill();

        // Car Chassis Body
        ctx.fillStyle = palette.primary;
        ctx.beginPath();
        ctx.roundRect(-22, -9.5, 44, 19, [6, 11, 11, 6]);
        ctx.fill();

        // Racing Stripe
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-16, -2, 34, 4);

        // Cockpit Canopy Glass
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.roundRect(-6, -6, 15, 12, 4);
        ctx.fill();

        // Rear Spoiler
        ctx.fillStyle = palette.secondary;
        ctx.beginPath();
        ctx.roundRect(-24, -11, 4, 22, 2);
        ctx.fill();

        // Brake Lights (glow bright rose when wrong answer)
        if (isBraking) {
          ctx.fillStyle = '#F43F5E';
          ctx.fillRect(-26, -8, 3, 5);
          ctx.fillRect(-26, 3, 3, 5);
        }

        // Boost Exhaust Flame (glow bright emerald when correct answer)
        if (isBoosting) {
          ctx.fillStyle = '#10B981';
          ctx.beginPath();
          ctx.moveTo(-24, -4);
          ctx.lineTo(-36 - Math.random() * 6, 0);
          ctx.lineTo(-24, 4);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();

        // Player Label & Distance Tag above car
        ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = racer.isCurrentUser ? '#0F172A' : '#334155';
        ctx.textAlign = 'left';
        const labelText = `${racer.nickname}${racer.isCurrentUser ? ' (You)' : ''}`;
        const labelX = Math.min(width - 145, Math.max(startX + 4, carX - 22));
        ctx.fillText(labelText, labelX, laneTop + 16);

        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillStyle = isBoosting
          ? '#059669'
          : isBraking
            ? '#E11D48'
            : palette.primary;
        const distLabel = isBoosting
          ? `${Math.round(racer.distance)}m (+10)`
          : isBraking
            ? `${Math.round(racer.distance)}m (-5)`
            : `${Math.round(racer.distance)}m`;
        ctx.fillText(
          distLabel,
          labelX + ctx.measureText(labelText).width + 8,
          laneTop + 16
        );
      }

      // 4. Checkered Finish Line Pattern at 100m (drawn on top of lane backgrounds)
      const squareSize = 7;
      const rows = Math.floor((height - headerHeight - 6) / squareSize);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#0F172A' : '#FFFFFF';
          ctx.fillRect(
            finishX + c * squareSize,
            headerHeight + r * squareSize,
            squareSize,
            squareSize
          );
        }
      }

      // 5. Update and Render Exhaust Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.04;
        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [racers, maxLanes]);

  const laneCount = Math.max(1, Math.min(8, Math.max(racers.length, maxLanes)));
  const laneHeight = laneCount === 1 ? 68 : laneCount === 2 ? 58 : laneCount <= 4 ? 50 : 40;
  const computedHeight = 28 + laneCount * laneHeight + 8;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <canvas
        ref={canvasRef}
        style={{ height: `${computedHeight}px` }}
        className="block w-full"
        aria-label="Live Calculation Racer Track"
      />
    </div>
  );
};
