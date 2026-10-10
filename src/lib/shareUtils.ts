import {
  CAR_PALETTE,
  CATEGORY_LABELS,
  CarColor,
  DIFFICULTY_LABELS,
  GameMode,
  QuestionCategory,
  QuestionDifficulty,
} from '../game/types';

const DEFAULT_DEPLOYED_PUBLIC_URL =
  'https://ais-pre-b57bbbqsnj7ly6zg3datum-967948510079.asia-east1.run.app';

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
      !origin.includes('127.0.0.1')
    ) {
      return origin.replace(/\/+$/, '');
    }
  }
  return DEFAULT_DEPLOYED_PUBLIC_URL;
}

export function getRoomInviteUrl(roomCode: string): string {
  const cleanCode = roomCode.trim().toUpperCase();
  return `${getPublicGameUrl()}/?room=${encodeURIComponent(cleanCode)}`;
}

export interface RoomInviteSharePayload {
  roomCode: string;
  hostNickname: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  questionCount: number;
  questionTimeLimitSec: number;
  maxPlayers: number;
}

export function buildRoomInviteText(payload: RoomInviteSharePayload): string {
  const catLabel = CATEGORY_LABELS[payload.category];
  const diffLabel = DIFFICULTY_LABELS[payload.difficulty];
  const joinUrl = getRoomInviteUrl(payload.roomCode);
  return `🏎️ Join my Calculation Racer multiplayer room!\n\n🔑 Room Code: ${payload.roomCode}\n📚 Category: ${catLabel} (${diffLabel})\n⚡ Format: ${payload.questionCount} Questions · ${payload.questionTimeLimitSec}s timer\n\n👉 Play now: ${joinUrl}`;
}

export interface ScoreSharePayload {
  nickname: string;
  carColor: CarColor;
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
}

export function buildScoreShareText(payload: ScoreSharePayload): string {
  const catLabel = CATEGORY_LABELS[payload.category];
  const diffLabel = DIFFICULTY_LABELS[payload.difficulty];
  const gameUrl = getPublicGameUrl();
  const modeText =
    payload.mode === '2p' || payload.mode === '4p'
      ? `Multiplayer (#${payload.placement || 1} Place)`
      : 'Single-Player Race';

  return `🏁 I scored ${payload.score} pts (${payload.correctAnswers}/${payload.totalQuestions} correct · ${payload.accuracy}% accuracy) in ${payload.durationSec}s on Calculation Racer!\n\n🏎️ ${catLabel} · ${diffLabel} · ${modeText}\n🔥 Can you beat my score? Play free: ${gameUrl}`;
}

export function getSocialShareLinks(shareText: string, shareUrl: string) {
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(shareUrl);
  const textWithoutUrl = encodeURIComponent(
    shareText.replace(shareUrl, '').trim()
  );

  return {
    whatsapp: `https://wa.me/?text=${encodedText}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${textWithoutUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${textWithoutUrl}`,
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
 * Generates a clean, vibrant 1080x1350 visual Score Card PNG Data URL & Blob
 * suitable for downloading or sharing on Instagram, WhatsApp, Telegram, X, and Facebook.
 */
export async function generateScoreCardImage(
  payload: ScoreSharePayload
): Promise<{ dataUrl: string; blob: Blob | null }> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', blob: null };
  }

  const palette = CAR_PALETTE[payload.carColor] || CAR_PALETTE.blue;
  const catLabel = CATEGORY_LABELS[payload.category];
  const diffLabel = DIFFICULTY_LABELS[payload.difficulty];
  const publicUrl = getPublicGameUrl();

  // 1. Soft Light Pastel Background
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1350);
  bgGrad.addColorStop(0, '#F0F9FF');
  bgGrad.addColorStop(0.5, '#F8FAFC');
  bgGrad.addColorStop(1, '#F5F3FF');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1350);

  // Decorative top racing stripe
  ctx.fillStyle = palette.primary;
  ctx.fillRect(0, 0, 1080, 18);

  // 2. Main Outer Card
  drawRoundedRect(ctx, 56, 64, 968, 1222, 44);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  // 3. Header Brand Bar
  drawRoundedRect(ctx, 104, 112, 872, 110, 28);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();

  drawRoundedRect(ctx, 128, 132, 70, 70, 20);
  ctx.fillStyle = '#0284C7';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 34px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CR', 163, 179);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Calculation Racer', 222, 166);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 22px "Inter", sans-serif';
  ctx.fillText('Multiplayer Brain Racing Game', 222, 198);

  // Mode Pill on Right
  const isMulti = payload.mode === '2p' || payload.mode === '4p';
  const modeLabel = isMulti
    ? `MULTIPLAYER · #${payload.placement || 1}`
    : 'SINGLE PLAYER';
  drawRoundedRect(ctx, 680, 140, 268, 54, 18);
  ctx.fillStyle = isMulti ? '#F3E8FF' : '#E0F2FE';
  ctx.fill();
  ctx.fillStyle = isMulti ? '#6D28D9' : '#0369A1';
  ctx.font = '800 20px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(modeLabel, 814, 174);

  // 4. Player Banner & Score Hero Box
  drawRoundedRect(ctx, 104, 254, 872, 340, 36);
  const heroGrad = ctx.createLinearGradient(104, 254, 976, 594);
  heroGrad.addColorStop(0, '#0284C7');
  heroGrad.addColorStop(1, '#4F46E5');
  ctx.fillStyle = heroGrad;
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#E0F2FE';
  ctx.font = '700 24px "Inter", sans-serif';
  ctx.fillText(
    `RACER: ${payload.nickname.toUpperCase()}  •  ${catLabel.toUpperCase()} (${diffLabel.toUpperCase()})`,
    540,
    318
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 124px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${payload.score}`, 540, 452);

  ctx.fillStyle = '#BAE6FD';
  ctx.font = '800 26px "Inter", sans-serif';
  ctx.fillText('FINAL RACE SCORE (POINTS)', 540, 500);

  // Mini progress track bar inside hero
  drawRoundedRect(ctx, 184, 530, 712, 26, 13);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();

  const fillW = Math.max(36, Math.round((Math.min(100, payload.distance) / 100) * 712));
  drawRoundedRect(ctx, 184, 530, fillW, 26, 13);
  ctx.fillStyle = '#34D399';
  ctx.fill();

  // 5. Four Stat Cards (2x2 Grid)
  const stats = [
    {
      label: 'CORRECT ANSWERS',
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
      label: 'RACE TIME',
      value: `${payload.durationSec}s`,
      bg: '#FFFBEB',
      border: '#FDE68A',
      text: '#B45309',
    },
    {
      label: 'DISTANCE REACHED',
      value: `${payload.distance}m / 100m`,
      bg: '#FAF5FF',
      border: '#E9D5FF',
      text: '#6D28D9',
    },
  ];

  stats.forEach((st, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 104 + col * 452;
    const y = 634 + row * 204;
    const w = 420;
    const h = 176;

    drawRoundedRect(ctx, x, y, w, h, 28);
    ctx.fillStyle = st.bg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = st.border;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = '700 20px "Inter", sans-serif';
    ctx.fillText(st.label, x + 32, y + 58);

    ctx.fillStyle = st.text;
    ctx.font = '800 52px "JetBrains Mono", monospace';
    ctx.fillText(st.value, x + 32, y + 132);
  });

  // 6. Challenge Call-To-Action Footer
  drawRoundedRect(ctx, 104, 1068, 872, 168, 28);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Can you beat my score? Race with your brain!', 540, 1128);

  ctx.fillStyle = '#0284C7';
  ctx.font = '700 24px "Inter", sans-serif';
  ctx.fillText(publicUrl, 540, 1178);

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );

  return { dataUrl, blob };
}
