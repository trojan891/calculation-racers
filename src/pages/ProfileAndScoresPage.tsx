import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Camera,
  Check,
  Clock,
  LogIn,
  Pencil,
  Shield,
  Target,
  Trash2,
  Trophy,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  CAR_PALETTE,
  CATEGORY_LABELS,
  CarColor,
  DIFFICULTY_LABELS,
  PlayerProfile,
  QuestionCategory,
  RaceResultRecord,
  TROJO_GAMES,
  TROJO_GAME_MAP,
  TrojoGameId,
} from '../game/types';
import { soundEngine } from '../lib/sound';

const GUEST_PROFILE_STORAGE_KEY = 'trojo_guest_profile_v1';
const GUEST_HISTORY_STORAGE_KEY = 'trojo_guest_history_v1';

function loadGuestHistory(guestUid: string): RaceResultRecord[] {
  try {
    const raw = localStorage.getItem(GUEST_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r: RaceResultRecord) => !r.playerId || r.playerId === guestUid);
  } catch {
    return [];
  }
}

function saveGuestProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'TR';
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function createSvgAvatarDataUrl(emoji: string, bgHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="${bgHex}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="64">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PRESET_AVATARS = [
  { id: 'racer', emoji: '🏎️', bg: '#2563EB', label: 'Speed Racer' },
  { id: 'crown', emoji: '👑', bg: '#7C3AED', label: 'Champion' },
  { id: 'wizard', emoji: '⚡', bg: '#16A34A', label: 'Puzzle Spark' },
  { id: 'tiger', emoji: '🐯', bg: '#F97316', label: 'Tiger Ace' },
  { id: 'rocket', emoji: '🚀', bg: '#0284C7', label: 'Star Pilot' },
  { id: 'dragon', emoji: '🐉', bg: '#059669', label: 'Mahjong Master' },
];

async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

interface ProfileAndScoresPageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  onUpdateProfileState: (next: PlayerProfile) => void;
  onSignInGoogle: () => void;
  onBackHome: () => void;
}

type PerfGameFilter = 'all' | TrojoGameId;
type PerfCategoryFilter = 'all' | QuestionCategory;
type PerfSortOrder = 'recent' | 'highest_score' | 'fastest_time';

export const ProfileAndScoresPage: React.FC<ProfileAndScoresPageProps> = ({
  profile,
  isGuest,
  onUpdateProfileState,
  onSignInGoogle,
}) => {
  const [nickname, setNickname] = useState(profile.nickname);
  const [editingName, setEditingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [carColor, setCarColor] = useState<CarColor>(profile.carColor);
  const [avatarUrl, setAvatarUrl] = useState<string>(profile.avatarUrl || '');
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [isPublicProfile, setIsPublicProfile] = useState<boolean>(
    profile.isPublicProfile ?? true
  );
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Performance Filters (preserved while viewing)
  const [gameFilter, setGameFilter] = useState<PerfGameFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<PerfCategoryFilter>('all');
  const [sortOrder, setSortOrder] = useState<PerfSortOrder>('recent');

  const [history, setHistory] = useState<RaceResultRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNickname(profile.nickname);
    setCarColor(profile.carColor);
    setAvatarUrl(profile.avatarUrl || '');
    setIsPublicProfile(profile.isPublicProfile ?? true);
  }, [profile.nickname, profile.carColor, profile.avatarUrl, profile.isPublicProfile]);

  useEffect(() => {
    if (isGuest) {
      setHistory(loadGuestHistory(profile.uid));
      return;
    }

    const q = query(
      collection(db, 'race_results'),
      where('playerId', '==', profile.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: RaceResultRecord[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as RaceResultRecord) });
        });
        list.sort((a, b) => b.completedAtMs - a.completedAtMs);
        setHistory(list);
      },
      (err) => {
        console.warn('Error loading personal game history:', err);
      }
    );
    return () => unsub();
  }, [isGuest, profile.uid]);

  const persistProfileChanges = async (
    nextName: string,
    nextColor: CarColor,
    nextAvatarUrl: string,
    nextPublic: boolean
  ) => {
    const trimmed = nextName.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      setNameError('Display name must be 2–20 characters.');
      return false;
    }
    setNameError(null);
    setSaving(true);
    soundEngine.playClick();

    try {
      const updated: PlayerProfile = {
        ...profile,
        nickname: trimmed,
        carColor: nextColor,
        avatarUrl: nextAvatarUrl,
        isPublicProfile: nextPublic,
        updatedAt: Date.now(),
      };

      if (isGuest) {
        saveGuestProfile(updated);
      } else {
        await updateDoc(doc(db, 'profiles', profile.uid), {
          nickname: trimmed,
          carColor: nextColor,
          avatarUrl: nextAvatarUrl,
          isPublicProfile: nextPublic,
          updatedAt: serverTimestamp(),
        });
      }

      onUpdateProfileState(updated);
      setSavedToast('Profile updated');
      setTimeout(() => setSavedToast(null), 2200);
      return true;
    } catch (err) {
      setNameError(
        err instanceof Error ? err.message : 'Could not save profile changes.'
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNameInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await persistProfileChanges(
      nickname,
      carColor,
      avatarUrl,
      isPublicProfile
    );
    if (ok) {
      setEditingName(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file);
      setAvatarUrl(compressedDataUrl);
      await persistProfileChanges(
        nickname,
        carColor,
        compressedDataUrl,
        isPublicProfile
      );
      setEditingAvatar(false);
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : 'Unable to process image.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Real Accumulated Progress Stats
  const progressSummary = useMemo(() => {
    const totalGames = Math.max(profile.totalRaces || 0, history.length);
    const historyWins = history.filter((r) => r.placement === 1).length;
    const totalWins = Math.max(profile.wins || 0, historyWins);
    const historyBestScore = history.reduce(
      (max, r) => Math.max(max, r.score ?? r.correctAnswers * 10),
      0
    );
    const bestScore = Math.max(profile.bestScore || 0, historyBestScore);
    const totalAccumulatedScore = history.reduce(
      (sum, r) => sum + (r.score ?? r.correctAnswers * 10),
      0
    );
    const displayTotalScore = Math.max(totalAccumulatedScore, bestScore);

    const totalAns = (profile.totalCorrect || 0) + (profile.totalWrong || 0);
    const overallAccuracy =
      totalAns > 0
        ? Math.round(((profile.totalCorrect || 0) / totalAns) * 100)
        : history.length > 0
          ? Math.round(
              history.reduce((s, r) => s + r.accuracy, 0) / history.length
            )
          : 0;

    return {
      totalGames,
      totalWins,
      bestScore,
      displayTotalScore,
      overallAccuracy,
    };
  }, [profile, history]);

  // Filtered & Sorted Performance Records
  const filteredRecords = useMemo(() => {
    const matching = history.filter((item) => {
      const itemGame = item.gameId || 'calculation_racer';
      if (gameFilter !== 'all' && itemGame !== gameFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      return true;
    });

    const copy = [...matching];
    copy.sort((a, b) => {
      const scoreA = a.score ?? a.correctAnswers * 10;
      const scoreB = b.score ?? b.correctAnswers * 10;
      if (sortOrder === 'highest_score') {
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.completedAtMs - a.completedAtMs;
      }
      if (sortOrder === 'fastest_time') {
        if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
        return scoreB - scoreA;
      }
      return b.completedAtMs - a.completedAtMs;
    });

    return copy;
  }, [history, gameFilter, categoryFilter, sortOrder]);

  const filteredMetrics = useMemo(() => {
    const count = filteredRecords.length;
    if (count === 0) {
      return {
        count: 0,
        wins: 0,
        bestScore: 0,
        avgScore: 0,
        avgAccuracy: 0,
        fastestTimeSec: '—',
      };
    }
    const wins = filteredRecords.filter((r) => r.placement === 1).length;
    const scores = filteredRecords.map((r) => r.score ?? r.correctAnswers * 10);
    const bestScore = Math.max(...scores);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / count);
    const avgAccuracy = Math.round(
      filteredRecords.reduce((a, r) => a + r.accuracy, 0) / count
    );
    const fastestMs = filteredRecords.reduce((best, r) => {
      if (r.durationMs <= 0) return best;
      return best === 0 || r.durationMs < best ? r.durationMs : best;
    }, 0);

    return {
      count,
      wins,
      bestScore,
      avgScore,
      avgAccuracy,
      fastestTimeSec: fastestMs > 0 ? `${(fastestMs / 1000).toFixed(1)}s` : '—',
    };
  }, [filteredRecords]);

  const activeCarInfo = CAR_PALETTE[carColor] || CAR_PALETTE.blue;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {/* ==================================================================== */}
      {/* 1. PROFILE HEADER (Circular Avatar + Corner Edit + Display Name Edit) */}
      {/* ==================================================================== */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
            {/* Large Circular Avatar with Corner Edit Button */}
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile.nickname}
                  className="h-24 w-24 rounded-full border-4 border-slate-100 object-cover shadow-sm"
                />
              ) : (
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-slate-100 font-display text-3xl font-black text-white shadow-sm"
                  style={{ backgroundColor: activeCarInfo.primary }}
                >
                  {getInitials(profile.nickname)}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setEditingAvatar((v) => !v);
                }}
                aria-label="Edit Avatar"
                title="Change Avatar"
                className="absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#2563EB] text-white shadow-sm transition-transform hover:scale-105 hover:bg-blue-700"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            {/* Display Name & Small Edit Button */}
            <div className="text-center sm:text-left">
              {editingName ? (
                <form
                  onSubmit={handleSaveNameInline}
                  className="flex flex-wrap items-center justify-center gap-2 sm:justify-start"
                >
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    minLength={2}
                    maxLength={20}
                    autoFocus
                    className="h-10 w-44 rounded-xl border-2 border-[#2563EB] bg-slate-50 px-3 font-display text-base font-extrabold text-slate-900 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    title="Save Display Name"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16A34A] text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNickname(profile.nickname);
                      setNameError(null);
                      setEditingName(false);
                    }}
                    title="Cancel"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <h1 className="font-display text-2xl font-black text-slate-900 sm:text-3xl">
                    {profile.nickname}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setEditingName(true);
                    }}
                    aria-label="Edit Display Name"
                    title="Edit Display Name"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {nameError && (
                <p className="mt-1 text-xs font-bold text-rose-600">
                  {nameError}
                </p>
              )}

              <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 sm:justify-start">
                <span>{isGuest ? 'Guest Account' : 'Verified Account'}</span>
                {savedToast && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-[#16A34A]">
                      ✓ {savedToast}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Action: Guest Sign-In or Leaderboard Visibility Toggle */}
          {isGuest ? (
            <button
              type="button"
              onClick={onSignInGoogle}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#2563EB] px-5 py-2.5 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-blue-700"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In with Google</span>
            </button>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={isPublicProfile}
                onChange={async (e) => {
                  const nextVal = e.target.checked;
                  setIsPublicProfile(nextVal);
                  await persistProfileChanges(
                    nickname,
                    carColor,
                    avatarUrl,
                    nextVal
                  );
                }}
                className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
              />
              <span>Public on Leaderboard</span>
            </label>
          )}
        </div>

        {/* Collapsible Avatar Picker / Upload Drawer */}
        {editingAvatar && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold tracking-wider text-slate-600 uppercase">
                Choose Avatar or Upload Photo
              </span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-700"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Image</span>
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      setAvatarUrl('');
                      await persistProfileChanges(
                        nickname,
                        carColor,
                        '',
                        isPublicProfile
                      );
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Use Initials</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingAvatar(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {avatarError && (
              <p className="mt-2 text-xs font-bold text-rose-600">
                {avatarError}
              </p>
            )}

            {/* Preset Gaming Avatars */}
            <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {PRESET_AVATARS.map((preset) => {
                const dataUrl = createSvgAvatarDataUrl(preset.emoji, preset.bg);
                const selected = avatarUrl === dataUrl;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={async () => {
                      setAvatarUrl(dataUrl);
                      await persistProfileChanges(
                        nickname,
                        carColor,
                        dataUrl,
                        isPublicProfile
                      );
                      setEditingAvatar(false);
                    }}
                    className={`flex flex-col items-center rounded-2xl border-2 p-2.5 transition-all ${
                      selected
                        ? 'border-[#2563EB] bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <img
                      src={dataUrl}
                      alt={preset.label}
                      className="h-11 w-11 rounded-full"
                    />
                    <span className="mt-1.5 text-[11px] font-bold text-slate-700">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Signature Color Theme Selector */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3">
              <span className="text-xs font-bold text-slate-500">
                Theme Color:
              </span>
              {(['blue', 'red', 'green', 'purple'] as CarColor[]).map((c) => {
                const info = CAR_PALETTE[c];
                const active = carColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={async () => {
                      setCarColor(c);
                      await persistProfileChanges(
                        nickname,
                        c,
                        avatarUrl,
                        isPublicProfile
                      );
                    }}
                    className={`inline-flex min-h-[34px] items-center gap-2 rounded-xl border-2 px-3 py-1 text-xs font-bold ${
                      active
                        ? 'border-slate-900 bg-white text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: info.primary }}
                    />
                    <span>{info.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 2. PROGRESS CARD (Real Accumulated Statistics)                       */}
      {/* ==================================================================== */}
      <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-3xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-blue-900">
              Games Played
            </span>
            <Zap className="h-4 w-4 text-[#2563EB]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-blue-950 tabular-nums sm:text-3xl">
            {progressSummary.totalGames}
          </p>
        </div>

        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-emerald-900">
              Total Wins
            </span>
            <Trophy className="h-4 w-4 text-[#16A34A]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-emerald-950 tabular-nums sm:text-3xl">
            {progressSummary.totalWins}
          </p>
        </div>

        <div className="rounded-3xl border border-purple-200 bg-purple-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-purple-900">
              Best Score
            </span>
            <Trophy className="h-4 w-4 text-[#7C3AED]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-purple-950 tabular-nums sm:text-3xl">
            {progressSummary.bestScore}
          </p>
        </div>

        <div className="rounded-3xl border border-orange-200 bg-orange-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-orange-900">
              Total Points
            </span>
            <Target className="h-4 w-4 text-[#F97316]" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-orange-950 tabular-nums sm:text-3xl">
            {progressSummary.displayTotalScore}
          </p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. PERFORMANCE BY GAME & CATEGORY                                    */}
      {/* ==================================================================== */}
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-black text-slate-900">
            Performance
          </h2>

          {/* Selection Controls: Game, Category & Sort */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Select Game"
              value={gameFilter}
              onChange={(e) => {
                soundEngine.playClick();
                setGameFilter(e.target.value as PerfGameFilter);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-900 focus:border-[#2563EB] focus:outline-none"
            >
              <option value="all">All Games</option>
              {TROJO_GAMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Select Category"
              value={categoryFilter}
              onChange={(e) => {
                soundEngine.playClick();
                setCategoryFilter(e.target.value as PerfCategoryFilter);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-900 focus:border-[#2563EB] focus:outline-none"
            >
              <option value="all">All Categories</option>
              {(
                ['math', 'gk', 'science', 'current_affairs'] as QuestionCategory[]
              ).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort Records"
              value={sortOrder}
              onChange={(e) => {
                soundEngine.playClick();
                setSortOrder(e.target.value as PerfSortOrder);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-900 focus:border-[#2563EB] focus:outline-none"
            >
              <option value="recent">Sort: Most Recent</option>
              <option value="highest_score">Sort: Highest Score</option>
              <option value="fastest_time">Sort: Fastest Time</option>
            </select>
          </div>
        </div>

        {/* Dynamic Filtered Summary Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-5">
          <div>
            <span className="block text-[11px] font-bold text-slate-500">
              Matches
            </span>
            <span className="mt-0.5 block font-mono text-base font-black text-slate-900 tabular-nums">
              {filteredMetrics.count}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500">
              Wins
            </span>
            <span className="mt-0.5 block font-mono text-base font-black text-[#16A34A] tabular-nums">
              {filteredMetrics.wins}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500">
              Best Score
            </span>
            <span className="mt-0.5 block font-mono text-base font-black text-[#7C3AED] tabular-nums">
              {filteredMetrics.bestScore} pts
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500">
              Avg Accuracy
            </span>
            <span className="mt-0.5 block font-mono text-base font-black text-[#2563EB] tabular-nums">
              {filteredMetrics.avgAccuracy}%
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-500">
              Fastest Time
            </span>
            <span className="mt-0.5 block font-mono text-base font-black text-slate-900 tabular-nums">
              {filteredMetrics.fastestTimeSec}
            </span>
          </div>
        </div>

        {/* Filtered Performance Records List */}
        {filteredRecords.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 py-10 text-center">
            <Shield className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 font-display text-sm font-extrabold text-slate-700">
              No recorded matches for this selection
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Game</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Accuracy</th>
                  <th className="px-4 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
                {filteredRecords.slice(0, 25).map((item, idx) => {
                  const gId: TrojoGameId = item.gameId || 'calculation_racer';
                  const gMeta =
                    TROJO_GAME_MAP[gId] || TROJO_GAME_MAP.calculation_racer;
                  const pts = item.score ?? item.correctAnswers * 10;
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-sans font-extrabold text-slate-900">
                        {gMeta.name}
                      </td>
                      <td className="px-4 py-3 font-sans font-semibold text-slate-600">
                        {CATEGORY_LABELS[item.category]} (
                        {DIFFICULTY_LABELS[item.difficulty]})
                      </td>
                      <td className="px-4 py-3 font-bold uppercase text-slate-600">
                        {item.mode}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">
                        #{item.placement}
                      </td>
                      <td className="px-4 py-3 font-black text-[#7C3AED]">
                        {pts} pts
                      </td>
                      <td className="px-4 py-3 font-bold text-[#16A34A]">
                        {item.accuracy}%
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {(item.durationMs / 1000).toFixed(1)}s
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
