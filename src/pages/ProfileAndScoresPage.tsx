import React, { useEffect, useMemo, useState } from 'react';
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
  ArrowLeft,
  Check,
  Clock,
  Gamepad2,
  Save,
  Shield,
  Sparkles,
  Target,
  Trophy,
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
  TROJO_GAME_MAP,
  TrojoGameId,
} from '../game/types';
import { soundEngine } from '../lib/sound';

const GUEST_PROFILE_STORAGE_KEY = 'trojo_guest_profile_v1';
const GUEST_HISTORY_STORAGE_KEY = 'trojo_guest_history_v1';

function loadGuestHistory(): RaceResultRecord[] {
  try {
    const raw = localStorage.getItem(GUEST_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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

interface ProfileAndScoresPageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  onUpdateProfileState: (next: PlayerProfile) => void;
  onSignInGoogle: () => void;
  onBackHome: () => void;
}

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'RC';
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export const ProfileAndScoresPage: React.FC<ProfileAndScoresPageProps> = ({
  profile,
  isGuest,
  onUpdateProfileState,
  onSignInGoogle,
  onBackHome,
}) => {
  const [nickname, setNickname] = useState(profile.nickname);
  const [carColor, setCarColor] = useState<CarColor>(profile.carColor);
  const [isPublicProfile, setIsPublicProfile] = useState<boolean>(
    profile.isPublicProfile ?? true
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [history, setHistory] = useState<RaceResultRecord[]>([]);

  useEffect(() => {
    setNickname(profile.nickname);
    setCarColor(profile.carColor);
    setIsPublicProfile(profile.isPublicProfile ?? true);
  }, [profile.nickname, profile.carColor, profile.isPublicProfile]);

  useEffect(() => {
    if (isGuest) {
      setHistory(loadGuestHistory());
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = nickname.trim().slice(0, 20) || 'Player';
    setSaving(true);
    soundEngine.playClick();

    try {
      const updated: PlayerProfile = {
        ...profile,
        nickname: cleanedName,
        carColor,
        isPublicProfile,
        updatedAt: Date.now(),
      };

      if (isGuest) {
        saveGuestProfile(updated);
      } else {
        await updateDoc(doc(db, 'profiles', profile.uid), {
          nickname: cleanedName,
          carColor,
          isPublicProfile,
          updatedAt: serverTimestamp(),
        });
      }

      onUpdateProfileState(updated);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const categoryStats = useMemo(() => {
    const categories: QuestionCategory[] = ['math', 'gk', 'science', 'current_affairs'];
    return categories.map((cat) => {
      const catRaces = history.filter((r) => r.category === cat);
      const totalRaces = catRaces.length;
      const wins = catRaces.filter((r) => r.placement === 1).length;
      const avgAccuracy =
        totalRaces > 0
          ? Math.round(
              catRaces.reduce((acc, r) => acc + r.accuracy, 0) / totalRaces
            )
          : 0;
      const bestTime = catRaces.reduce((best, r) => {
        if (r.distance < 100) return best;
        if (best === 0 || r.durationMs < best) return r.durationMs;
        return best;
      }, 0);

      return {
        category: cat,
        label: CATEGORY_LABELS[cat],
        totalRaces,
        wins,
        avgAccuracy,
        bestTime,
      };
    });
  }, [history]);

  const overallAccuracy = useMemo(() => {
    const totalAnswered = (profile.totalCorrect || 0) + (profile.totalWrong || 0);
    if (totalAnswered === 0) return 100;
    return Math.round(((profile.totalCorrect || 0) / totalAnswered) * 100);
  }, [profile.totalCorrect, profile.totalWrong]);

  const activeCarInfo = CAR_PALETTE[carColor] || CAR_PALETTE.blue;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Top Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBackHome();
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </button>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-slate-900">
            Gaming Profile &amp; Scores
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Customize your TROJO player nickname, avatar color, and inspect your match history across all 7 games.
          </p>
        </div>

        {isGuest && (
          <button
            type="button"
            onClick={onSignInGoogle}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#F97316] px-5 py-3 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
            <Sparkles className="h-4 w-4" />
            <span>Create a Gaming Profile (Google Sign-In)</span>
          </button>
        )}
      </div>

      {/* Top 4 Stat Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Total Wins</span>
            <Trophy className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-emerald-950 tabular-nums">
            {profile.wins}
          </p>
        </div>

        <div className="rounded-3xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800">Games Played</span>
            <Zap className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-blue-950 tabular-nums">
            {profile.totalRaces}
          </p>
        </div>

        <div className="rounded-3xl border border-purple-200 bg-purple-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-800">Fastest Finish</span>
            <Clock className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-purple-950 tabular-nums">
            {profile.bestTimeMs > 0
              ? `${(profile.bestTimeMs / 1000).toFixed(1)}s`
              : '—'}
          </p>
        </div>

        <div className="rounded-3xl border border-orange-200 bg-orange-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-800">Accuracy</span>
            <Target className="h-4 w-4 text-orange-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-orange-950 tabular-nums">
            {overallAccuracy}%
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Profile Preferences Form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-2xs"
              style={{ backgroundColor: activeCarInfo.primary }}
            >
              {getInitials(nickname)}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Gaming Profile Settings
              </h2>
              <p className="text-xs text-slate-500">
                {isGuest ? 'Guest Profile (saved on device)' : 'Cloud Gaming Profile (synced)'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="mt-5 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Nickname (2–20 characters)
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Avatar &amp; Car Color
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                {(['blue', 'red', 'green', 'purple'] as CarColor[]).map((color) => {
                  const info = CAR_PALETTE[color];
                  const selected = carColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCarColor(color)}
                      className={`flex min-h-[44px] items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all ${
                        selected
                          ? 'border-blue-500 bg-blue-50 text-slate-900 shadow-2xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-md"
                        style={{ backgroundColor: info.primary }}
                      />
                      <span className="truncate">{info.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!isGuest && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isPublicProfile}
                    onChange={(e) => setIsPublicProfile(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600">
                    <strong className="block text-slate-900">
                      Show on Public Leaderboard
                    </strong>
                    Display my nickname, wins, and best scores on the TROJO global leaderboard.
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-3 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {savedNotice ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Gaming Profile Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Gaming Profile</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right 2 Columns: Category Breakdown & Game History */}
        <div className="space-y-6 lg:col-span-2">
          {/* Category Performance */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Subject Performance
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {categoryStats.map((stat) => (
                <div
                  key={stat.category}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{stat.label}</span>
                    <span className="rounded-lg bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-800 tabular-nums">
                      {stat.totalRaces} games
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between font-mono text-xs text-slate-600 tabular-nums">
                    <span>
                      Wins: <strong className="text-emerald-700">{stat.wins}</strong>
                    </span>
                    <span>
                      Accuracy:{' '}
                      <strong className="text-purple-700">{stat.avgAccuracy}%</strong>
                    </span>
                    <span>
                      Best:{' '}
                      <strong className="text-slate-900">
                        {stat.bestTime > 0 ? `${(stat.bestTime / 1000).toFixed(1)}s` : '—'}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Personal Game History Table */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Recent Game History
              </h2>
              <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                {history.length} recorded
              </span>
            </div>

            {history.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
                <Shield className="mx-auto h-7 w-7 text-slate-400" />
                <p className="mt-2 text-sm font-bold text-slate-800">
                  No completed games yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Play any of the 7 TROJO games in Single Player or Multiplayer to see your history here!
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Game</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Accuracy</th>
                      <th className="px-4 py-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
                    {history.slice(0, 25).map((item, idx) => {
                      const gId: TrojoGameId = item.gameId || 'calculation_racer';
                      const gMeta = TROJO_GAME_MAP[gId] || TROJO_GAME_MAP.calculation_racer;
                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(item.completedAtMs).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 font-sans font-bold text-slate-900">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{gMeta.emoji}</span>
                              <span>{gMeta.name}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold uppercase text-slate-700">
                            {item.mode}
                          </td>
                          <td className="px-4 py-3 font-sans font-semibold text-slate-900">
                            {CATEGORY_LABELS[item.category]} ({DIFFICULTY_LABELS[item.difficulty]})
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            #{item.placement}
                          </td>
                          <td className="px-4 py-3 font-bold text-purple-600">
                            {item.score ?? item.correctAnswers * 10} pts
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600">
                            {item.accuracy}% ({item.correctAnswers}/
                            {item.correctAnswers + item.wrongAnswers})
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600">
                            {(item.durationMs / 1000).toFixed(1)}s
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
      </div>
    </div>
  );
};
