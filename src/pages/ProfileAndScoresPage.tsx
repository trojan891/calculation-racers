import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Award,
  Check,
  Clock,
  Save,
  Shield,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  CAR_PALETTE,
  CATEGORY_LABELS,
  CarColor,
  DIFFICULTY_LABELS,
  OperationType,
  PlayerProfile,
  QuestionCategory,
  RaceResultRecord,
} from '../game/types';
import { updatePlayerPreferences } from '../lib/gameService';
import { soundEngine } from '../lib/sound';

interface ProfileAndScoresPageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  guestResults: RaceResultRecord[];
  onSignIn: () => void;
  onProfileUpdated: (updated: Partial<PlayerProfile>) => void;
  onBackHome?: () => void;
}

export const ProfileAndScoresPage: React.FC<ProfileAndScoresPageProps> = ({
  profile,
  isGuest,
  guestResults,
  onSignIn,
  onProfileUpdated,
  onBackHome,
}) => {
  const [nickname, setNickname] = useState(profile.nickname);
  const [carColor, setCarColor] = useState<CarColor>(profile.carColor);
  const [isPublicProfile, setIsPublicProfile] = useState<boolean>(profile.isPublicProfile);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [dbResults, setDbResults] = useState<RaceResultRecord[]>([]);

  useEffect(() => {
    setNickname(profile.nickname);
    setCarColor(profile.carColor);
    setIsPublicProfile(profile.isPublicProfile);
  }, [profile]);

  useEffect(() => {
    if (isGuest) return;
    const path = 'race_results';
    const q = query(
      collection(db, 'race_results'),
      where('playerId', '==', profile.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as RaceResultRecord),
        }));
        list.sort((a, b) => b.completedAtMs - a.completedAtMs);
        setDbResults(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [isGuest, profile.uid]);

  const history = isGuest ? guestResults : dbResults;

  const categoryStats = useMemo(() => {
    const categories: QuestionCategory[] = ['math', 'gk', 'science', 'current_affairs'];
    return categories.map((cat) => {
      const catRaces = history.filter((r) => r.category === cat);
      const totalRaces = catRaces.length;
      const wins = catRaces.filter((r) => r.placement === 1 && r.distance >= 100).length;
      const totalCorrect = catRaces.reduce((acc, r) => acc + r.correctAnswers, 0);
      const totalWrong = catRaces.reduce((acc, r) => acc + r.wrongAnswers, 0);
      const avgAccuracy =
        totalCorrect + totalWrong > 0
          ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
          : 0;
      const bestTime = catRaces
        .filter((r) => r.distance >= 100)
        .reduce(
          (min, r) => (min === 0 ? r.durationMs : Math.min(min, r.durationMs)),
          0
        );
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    if (isGuest) {
      onProfileUpdated({
        nickname: nickname.trim().slice(0, 20) || 'GuestRacer',
        carColor,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
      return;
    }

    setSaving(true);
    try {
      await updatePlayerPreferences(profile.uid, nickname, carColor, isPublicProfile);
      onProfileUpdated({ nickname, carColor, isPublicProfile });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const overallTotalAnswered = profile.totalCorrect + profile.totalWrong;
  const overallAccuracy =
    overallTotalAnswered > 0
      ? Math.round((profile.totalCorrect / overallTotalAnswered) * 100)
      : history.length > 0
        ? Math.round(history.reduce((s, r) => s + r.accuracy, 0) / history.length)
        : 0;

  const computedBestScore = useMemo(() => {
    const fromHistory = history.reduce(
      (max, r) => Math.max(max, r.score ?? r.correctAnswers * 10),
      0
    );
    return Math.max(profile.bestScore || 0, fromHistory);
  }, [history, profile.bestScore]);

  const getInitials = (name: string) => {
    const clean = name.trim();
    if (!clean) return 'R';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  const activeCarInfo = CAR_PALETTE[carColor] || CAR_PALETTE.blue;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          {onBackHome && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onBackHome();
              }}
              className="mb-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </button>
          )}
          <h1 className="font-display text-3xl font-extrabold text-slate-900">
            My Profile & Scores
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Customize your racer nickname, car color, and view your personal race history.
          </p>
        </div>

        {isGuest && (
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-2xl bg-sky-600 px-5 py-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-sky-500"
          >
            Sign In to Sync Cloud Scores
          </button>
        )}
      </div>

      {/* Top Colorful Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>Career Wins</span>
            <Trophy className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-amber-950 tabular-nums">
            {isGuest
              ? history.filter((r) => r.placement === 1 && r.distance >= 100).length
              : profile.wins}
          </p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/80 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-purple-800">
            <span>Best Score</span>
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-purple-950 tabular-nums">
            {computedBestScore}
          </p>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-sky-800">
            <span>Races Played</span>
            <Award className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-sky-950 tabular-nums">
            {isGuest ? history.length : profile.totalRaces}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>Best 100m Time</span>
            <Clock className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-emerald-950 tabular-nums">
            {profile.bestTimeMs > 0
              ? `${(profile.bestTimeMs / 1000).toFixed(1)}s`
              : '—'}
          </p>
        </div>

        <div className="col-span-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-5 lg:col-span-1">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800">
            <span>Accuracy</span>
            <User className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-extrabold text-rose-950 tabular-nums">
            {overallAccuracy}%
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Profile Preferences Form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-2xs shrink-0"
              style={{ backgroundColor: activeCarInfo.primary }}
            >
              {getInitials(nickname)}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Racer Settings
              </h2>
              <p className="text-xs text-slate-500">
                {isGuest ? 'Guest Profile (saved on device)' : 'Cloud Profile (synced)'}
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
                className="mt-1.5 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Car Color
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
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all ${
                        selected
                          ? 'border-sky-500 bg-sky-50 text-slate-900 shadow-2xs'
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
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-xs text-slate-600">
                    <strong className="block text-slate-900">
                      Show on Public Leaderboard
                    </strong>
                    Display my nickname, wins, and best scores on the global leaderboard.
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-sky-500 disabled:opacity-50"
            >
              {savedNotice ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Profile Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right 2 Columns: Category Breakdown & Race History */}
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
                    <span className="rounded-lg bg-sky-100 px-2 py-0.5 font-mono text-xs font-bold text-sky-800 tabular-nums">
                      {stat.totalRaces} races
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

          {/* Personal Race History Table */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Recent Race History
              </h2>
              <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                {history.length} recorded
              </span>
            </div>

            {history.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
                <Shield className="mx-auto h-7 w-7 text-slate-400" />
                <p className="mt-2 text-sm font-bold text-slate-800">
                  No completed races yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Play a Single Player or Multiplayer race to see your history here!
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Accuracy</th>
                      <th className="px-4 py-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
                    {history.slice(0, 25).map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(item.completedAtMs).toLocaleDateString()}
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
                        <td className="px-4 py-3 text-right font-bold text-sky-600">
                          {(item.durationMs / 1000).toFixed(1)}s
                        </td>
                      </tr>
                    ))}
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
