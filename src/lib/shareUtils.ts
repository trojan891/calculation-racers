import {
  CAR_PALETTE,
  CATEGORY_LABELS,
  CarColor,
  DIFFICULTY_LABELS,
  GameMode,
  QuestionCategory,
  QuestionDifficulty,
  TROJO_GAME_MAP,
  TrojoGameId,
} from '../game/types';

const DEFAULT_DEPLOYED_PUBLIC_URL = 'https://calculation-racers.vercel.app';

/**
 * Resolves the real public game URL for social sharing and room invites.
 * Never returns localhost or 127.0.0.1 so shared links always work on phones and other devices.
 */
export function getPublicGameUrl(): string {
  const envUrl = import.meta.env.VITE_PUBLIC_GAME_URL;
  if (typeof envUrl === 'string' && envUrl.trim().startsWith('http')) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (
      origin &&
      !origin.includes('localhost') &&
      !origin.includes('127.0.0.1') &&
      !origin.includes('.run.app')
    ) {
      return origin.replace(/\/+$/, '');
    }
  }
  return DEFAULT_DEPLOYED_PUBLIC_URL;
}

export function getRoomInviteUrl(roomCode: string, gameId?: TrojoGameId): string {
  const cleanCode = roomCode.trim().toUpperCase();
  const base = `${getPublicGameUrl()}/?room=${encodeURIComponent(cleanCode)}`;
  return gameId ? `${base}&game=${encodeURIComponent(gameId)}` : base;
}

export interface RoomInviteSharePayload {
  roomCode: string;
  hostNickname: string;
  gameId?: TrojoGameId;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  questionCount: number;
  questionTimeLimitSec: number;
  maxPlayers: number;
}

export function buildRoomInviteText(payload: RoomInviteSharePayload): string {
  const gameInfo = TROJO_GAME_MAP[payload.gameId || 'calculation_racer'];
  const diffLabel = DIFFICULTY_LABELS[payload.difficulty];
  const joinUrl = getRoomInviteUrl(payload.roomCode, payload.gameId);
  return `TROJO — A Fun Nagar 🎮\n\n${gameInfo.emoji} Join my ${gameInfo.name} room (${payload.maxPlayers}P)!\n🔑 Room Code: ${payload.roomCode}\n⚡ Difficulty: ${diffLabel} · ${payload.questionCount} Rounds · ${payload.questionTimeLimitSec}s timer\n\nPlay here: ${joinUrl}`;
}

export interface ScoreSharePayload {
  nickname: string;
  carColor: CarColor;
  gameId?: TrojoGameId;
  mode: GameMode;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
  distance: number;
  durationSec: string;
  placement?: number;
  totalPlayers?: number;
  reactionTitle?: string;
}

export function buildScoreShareText(payload: ScoreSharePayload): string {
  const gameInfo = TROJO_GAME_MAP[payload.gameId || 'calculation_racer'];
  const gameUrl = getPublicGameUrl();

  return `TROJO — A Fun Nagar 🎮\n\nI scored ${payload.score} pts in ${gameInfo.name}!\n\nThink you can beat me? Challenge accepted? 😎\n\nPlay here: ${gameUrl}`;
}

export function getSocialShareLinks(shareText: string, _shareUrl?: string) {
  const encodedText = encodeURIComponent(shareText);
  return {
    whatsapp: `https://wa.me/?text=${encodedText}`,
  };
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Generates a vertical 9:16 (1080x1920) Score Image suitable for Instagram Stories
 * and WhatsApp sharing using actual TROJO — A Fun Nagar result data.
 */
export async function generateScoreCardImage(
  payload: ScoreSharePayload
): Promise<{ dataUrl: string; blob: Blob | null }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', blob: null };
  }

  const gameInfo = TROJO_GAME_MAP[payload.gameId || 'calculation_racer'];
  const palette = CAR_PALETTE[payload.carColor] || CAR_PALETTE.blue;
  const catLabel = CATEGORY_LABELS[payload.category];
  const diffLabel = DIFFICULTY_LABELS[payload.difficulty];
  const publicUrl = getPublicGameUrl();
  const reaction =
    payload.reactionTitle ||
    (payload.accuracy >= 80
      ? 'BEAST MODE!'
      : payload.accuracy >= 50
        ? 'NICE RUN!'
        : 'NEXT TIME!');

  // 1. Soft Light Pastel 9:16 Story Background
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
  bgGrad.addColorStop(0, '#EFF6FF');
  bgGrad.addColorStop(0.5, '#F8FAFC');
  bgGrad.addColorStop(1, '#F3E8FF');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Decorative top colorful bar
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(0, 0, 270, 22);
  ctx.fillStyle = '#10B981';
  ctx.fillRect(270, 0, 270, 22);
  ctx.fillStyle = '#8B5CF6';
  ctx.fillRect(540, 0, 270, 22);
  ctx.fillStyle = '#F97316';
  ctx.fillRect(810, 0, 270, 22);

  // 2. Main Story Card
  drawRoundedRect(ctx, 64, 96, 952, 1728, 56);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  // 3. TROJO — A Fun Nagar Header Bar
  drawRoundedRect(ctx, 116, 152, 848, 136, 36);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();

  drawRoundedRect(ctx, 148, 178, 84, 84, 24);
  ctx.fillStyle = '#0284C7';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 44px "Outfit", "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('T', 190, 236);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 46px "Outfit", "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TROJO', 256, 214);

  ctx.fillStyle = '#7C3AED';
  ctx.font = '800 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('A Fun Nagar', 256, 252);

  // Game Mode Pill on Right
  const isMulti = payload.mode === '2p' || payload.mode === '4p';
  const modeLabel = isMulti
    ? `RANK #${payload.placement || 1}`
    : 'SOLO RUN';
  drawRoundedRect(ctx, 690, 188, 240, 64, 22);
  ctx.fillStyle = isMulti ? '#F3E8FF' : '#E0F2FE';
  ctx.fill();
  ctx.fillStyle = isMulti ? '#6D28D9' : '#0369A1';
  ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(modeLabel, 810, 229);

  // 4. Game Title & Player Badge
  ctx.textAlign = 'center';
  ctx.font = '800 84px sans-serif';
  ctx.fillText(gameInfo.emoji, 540, 410);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 50px "Outfit", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(gameInfo.name, 540, 485);

  ctx.fillStyle = '#475569';
  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `PLAYER: ${payload.nickname.toUpperCase()}  •  ${diffLabel.toUpperCase()}`,
    540,
    538
  );

  // 5. Big Bold Score Hero Box
  drawRoundedRect(ctx, 116, 584, 848, 420, 44);
  ctx.fillStyle = palette.primary;
  ctx.fill();

  ctx.fillStyle = '#FEF08A';
  ctx.font = '800 34px "Outfit", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(reaction, 540, 662);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 168px "Outfit", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${payload.score}`, 540, 845);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    payload.gameId === 'iq_relay'
      ? 'IQ RELAY PERFORMANCE SCORE'
      : 'FINAL GAME SCORE (POINTS)',
    540,
    920
  );

  // 6. Four Clean Stat Boxes (2x2 Grid)
  const stats = [
    {
      label: 'CORRECT ROUNDS',
      value: `${payload.correctAnswers} / ${payload.totalQuestions}`,
      bg: '#ECFDF5',
      border: '#A7F3D0',
      text: '#047857',
    },
    {
      label: 'ACCURACY',
      value: `${payload.accuracy}%`,
      bg: '#F0F9FF',
      border: '#BAE6FD',
      text: '#0369A1',
    },
    {
      label: 'COMPLETION TIME',
      value: `${payload.durationSec}s`,
      bg: '#FFF7ED',
      border: '#FED7AA',
      text: '#C2410C',
    },
    {
      label:
        payload.gameId === 'calculation_racer' ? 'RACE DISTANCE' : 'CATEGORY',
      value:
        payload.gameId === 'calculation_racer'
          ? `${payload.distance}m / 100m`
          : catLabel,
      bg: '#FAF5FF',
      border: '#E9D5FF',
      text: '#6D28D9',
    },
  ];

  stats.forEach((st, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 116 + col * 440;
    const y = 1054 + row * 226;
    const w = 408;
    const h = 196;

    drawRoundedRect(ctx, x, y, w, h, 32);
    ctx.fillStyle = st.bg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = st.border;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(st.label, x + 34, y + 66);

    ctx.fillStyle = st.text;
    ctx.font =
      st.value.length > 10
        ? '800 36px "Plus Jakarta Sans", sans-serif'
        : '800 54px "JetBrains Mono", monospace';
    ctx.fillText(st.value, x + 34, y + 146);
  });

  // 7. Challenge Call-To-Action Footer
  drawRoundedRect(ctx, 116, 1536, 848, 224, 36);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 38px "Outfit", "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Think you can beat me? Challenge accepted? 😎', 540, 1622);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 30px "JetBrains Mono", monospace';
  ctx.fillText(publicUrl, 540, 1696);

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );

  return { dataUrl, blob };
}
