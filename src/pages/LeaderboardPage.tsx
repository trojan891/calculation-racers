import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Award,
  Clock,
  Medal,
  Play,
  Trophy,
} from 'lucide-react';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  CAR_PALETTE,
  CATEGORY_LABELS,
  OperationType,
  PlayerProfile,
  QuestionCategory,
  RaceResultRecord,
} from '../game/types';
import { soundEngine } from '../lib/sound';

interface LeaderboardPageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  onBackHome: () => void;
  onOpenSetup: () => void;
}

type LeaderboardPeriod = 'all' | 'weekly' | 'daily';
type LeaderboardMetric = 'wins' | 'score' | 'fastest';

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  profile,
  isGuest,
  onBackHome,
  onOpenSetup,
}) => {
  const [publicProfiles, setPublicProfiles] = useState<PlayerProfile[]>([]);
  const [publicResults, setPublicResults] = useState<RaceResultRecord[]>([]);
  const [lbPeriod, setLbPeriod] = useState<LeaderboardPeriod>('all');
  const [lbMetric, setLbMetric] = useState<LeaderboardMetric>('wins');
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | 'all'>('all');

  useEffect(() => {
    const qProfiles = query(
      collection(db, 'profiles'),
      where('isPublicProfile', '==', true)
    );
    const unsubProfiles = onSnapshot(
      qProfiles,
      (snap) => {
        setPublicProfiles(snap.docs.map((d) => d.data() as PlayerProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'profiles')
    );

    const qResults = query(
      collection(db, 'race_results'),
      where('isPublic', '==', true)
    );
    const unsubResults = onSnapshot(
      qResults,
      (snap) => {
        setPublicResults(snap.docs.map((d) => d.data() as RaceResultRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'race_results')
    );

    return () => {
      unsubProfiles();
      unsubResults();
    };
  }, []);

  const leaderboardEntries = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      lbPeriod === 'daily'
        ? now - 24 * 60 * 60 * 1000
        : lbPeriod === 'weekly'
          ? now - 7 * 24 * 60 * 60 * 1000
          : 0;

    if (lbPeriod === 'all' && categoryFilter === 'all') {
      const eligible = publicProfiles.filter((p) => !p.isBanned && p.totalRaces > 0);
      const sorted = [...eligible].map((p) => ({
        uid: p.uid,
        nickname: p.nickname,
        carColor: p.carColor,
        wins: p.wins,
        totalRaces: p.totalRaces,
        bestTimeMs: p.bestTimeMs,
        bestScore: p.bestScore || p.totalCorrect * 10,
      }));

      sorted.sort((a, b) => {
        if (lbMetric === 'fastest') {
          const aTime = a.bestTimeMs > 0 ? a.bestTimeMs : Number.MAX_SAFE_INTEGER;
          const bTime = b.bestTimeMs > 0 ? b.bestTimeMs : Number.MAX_SAFE_INTEGER;
          if (aTime !== bTime) return aTime - bTime;
          return b.wins - a.wins;
        }
        if (lbMetric === 'score') {
          if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
          return b.wins - a.wins;
        }
        if (b.wins !== a.wins) return b.wins - a.wins;
        const aTime = a.bestTimeMs > 0 ? a.bestTimeMs : Number.MAX_SAFE_INTEGER;
        const bTime = b.bestTimeMs > 0 ? b.bestTimeMs : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return b.totalRaces - a.totalRaces;
      });
      return sorted.slice(0, 25);
    }

    const filteredResults = publicResults.filter((r) => {
      if (cutoffMs > 0 && r.completedAtMs < cutoffMs) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      return true;
    });

    const mapByPlayer = new Map<
      string,
      {
        uid: string;
        nickname: string;
        carColor: PlayerProfile['carColor'];
        wins: number;
        totalRaces: number;
        bestTimeMs: number;
        bestScore: number;
      }
    >();

    filteredResults.forEach((r) => {
      const current = mapByPlayer.get(r.playerId) || {
        uid: r.playerId,
        nickname: r.nickname,
        carColor: r.carColor,
        wins: 0,
        totalRaces: 0,
        bestTimeMs: 0,
        bestScore: 0,
      };
      current.totalRaces += 1;
      if (r.placement === 1 && r.distance >= 100) {
        current.wins += 1;
      }
      const raceScore = r.score ?? r.correctAnswers * 10;
      if (raceScore > current.bestScore) {
        current.bestScore = raceScore;
      }
      if (r.distance >= 100 && r.durationMs > 0) {
        current.bestTimeMs =
          current.bestTimeMs === 0
            ? r.durationMs
            : Math.min(current.bestTimeMs, r.durationMs);
      }
      mapByPlayer.set(r.playerId, current);
    });

    const list = Array.from(mapByPlayer.values());
    list.sort((a, b) => {
      if (lbMetric === 'fastest') {
        const aTime = a.bestTimeMs > 0 ? a.bestTimeMs : Number.MAX_SAFE_INTEGER;
        const bTime = b.bestTimeMs > 0 ? b.bestTimeMs : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return b.wins - a.wins;
      }
      if (lbMetric === 'score') {
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        return b.wins - a.wins;
      }
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aTime = a.bestTimeMs > 0 ? a.bestTimeMs : Number.MAX_SAFE_INTEGER;
      const bTime = b.bestTimeMs > 0 ? b.bestTimeMs : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return b.totalRaces - a.totalRaces;
    });

    return list.slice(0, 25);
  }, [publicProfiles, publicResults, lbPeriod, lbMetric, categoryFilter]);

  const getInitials = (name: string) => {
    const clean = name.trim();
    if (!clean) return 'R';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBackHome();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </button>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-slate-900">
            Global Leaderboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Top Calculation Racer drivers ranked by verified wins, scores, and fastest 100m finish times.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onOpenSetup();
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-sky-500"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Play a Race</span>
        </button>
      </div>

      {/* Filters Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Time Period Filter */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100 p-1.5">
            {(
              [
                { id: 'all', label: 'All-Time' },
                { id: 'weekly', label: 'This Week' },
                { id: 'daily', label: 'Today' },
              ] as { id: LeaderboardPeriod; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setLbPeriod(tab.id);
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  lbPeriod === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Metric Filter */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100 p-1.5">
            {(
              [
                { id: 'wins', label: 'Most Wins' },
                { id: 'score', label: 'Best Score' },
                { id: 'fastest', label: 'Fastest Time' },
              ] as { id: LeaderboardMetric; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setLbMetric(m.id);
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  lbMetric === m.id
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="text-xs font-bold text-slate-500">Subject:</span>
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Subjects
          </button>
          {(['math', 'gk', 'science', 'current_affairs'] as QuestionCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                categoryFilter === cat
                  ? 'bg-sky-100 text-sky-800 border border-sky-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Leaderboard Table / Cards */}
        {leaderboardEntries.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-14 text-center">
            <Award className="mx-auto h-10 w-10 text-amber-500" />
            <p className="mt-3 font-display text-base font-bold text-slate-900">
              No Race Records Found for This Filter
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              Complete a race in this category or time period while signed in to appear on the leaderboard!
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Rank</th>
                  <th className="px-5 py-3.5">Player</th>
                  <th className="px-5 py-3.5">Wins</th>
                  <th className="px-5 py-3.5">Best Score</th>
                  <th className="px-5 py-3.5">Races</th>
                  <th className="px-5 py-3.5 text-right">Best 100m Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
                {leaderboardEntries.map((entry, idx) => {
                  const carInfo = CAR_PALETTE[entry.carColor] || CAR_PALETTE.blue;
                  const isMe = entry.uid === profile.uid && !isGuest;
                  return (
                    <tr
                      key={entry.uid}
                      className={
                        isMe
                          ? 'bg-sky-50/90'
                          : idx < 3
                            ? 'bg-amber-50/20 hover:bg-slate-50'
                            : 'hover:bg-slate-50'
                      }
                    >
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        <span className="inline-flex items-center gap-2">
                          {idx === 0 ? (
                            <Trophy className="h-4 w-4 text-amber-500" />
                          ) : idx === 1 ? (
                            <Medal className="h-4 w-4 text-slate-400" />
                          ) : idx === 2 ? (
                            <Medal className="h-4 w-4 text-orange-500" />
                          ) : null}
                          <span>#{idx + 1}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-sans font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white shadow-2xs shrink-0"
                            style={{ backgroundColor: carInfo.primary }}
                          >
                            {getInitials(entry.nickname)}
                          </div>
                          <span>{entry.nickname}</span>
                          {isMe && (
                            <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-700">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-emerald-600">
                        {entry.wins}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-purple-600">
                        {entry.bestScore} pts
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {entry.totalRaces}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-sky-600">
                        {entry.bestTimeMs > 0 ? (
                          <span className="inline-flex items-center justify-end gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{(entry.bestTimeMs / 1000).toFixed(1)}s</span>
                          </span>
                        ) : (
                          '—'
                        )}
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
