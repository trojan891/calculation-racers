import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AlertCircle, Crown, Medal, Trophy } from 'lucide-react';
import { db } from '../lib/firebase';
import {
  CAR_PALETTE,
  CarColor,
  PlayerProfile,
  RaceResultRecord,
  TROJO_GAMES,
  TrojoGameId,
} from '../game/types';
import { soundEngine } from '../lib/sound';

interface LeaderboardPageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  onBackHome: () => void;
  onOpenSetup: () => void;
}

type SortByMetric = 'overall_score' | 'best_score' | 'wins';
type GameFilterOption = 'all' | TrojoGameId;

interface RankedPlayerEntry {
  playerId: string;
  nickname: string;
  carColor: CarColor;
  avatarUrl?: string;
  overallScore: number;
  bestScore: number;
  wins: number;
  gamesPlayed: number;
  bestTimeMs: number;
  rank: number;
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

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  profile,
}) => {
  const [sortBy, setSortBy] = useState<SortByMetric>('overall_score');
  const [gameFilter, setGameFilter] = useState<GameFilterOption>('all');

  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [results, setResults] = useState<RaceResultRecord[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const qProfiles = query(
      collection(db, 'profiles'),
      where('isPublicProfile', '==', true)
    );
    const unsubProfiles = onSnapshot(
      qProfiles,
      (snap) => {
        const list: PlayerProfile[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as PlayerProfile;
          if (!data.isBanned) {
            list.push(data);
          }
        });
        setProfiles(list);
        setLoadingProfiles(false);
      },
      (err) => {
        console.warn('Leaderboard profiles listener error:', err);
        setLoadError('Unable to load player profiles right now.');
        setLoadingProfiles(false);
      }
    );

    const qResults = query(
      collection(db, 'race_results'),
      where('isPublic', '==', true)
    );
    const unsubResults = onSnapshot(
      qResults,
      (snap) => {
        const list: RaceResultRecord[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as RaceResultRecord) });
        });
        setResults(list);
        setLoadingResults(false);
      },
      (err) => {
        console.warn('Leaderboard results listener error:', err);
        setLoadError('Unable to load game results right now.');
        setLoadingResults(false);
      }
    );

    return () => {
      unsubProfiles();
      unsubResults();
    };
  }, []);

  const top10Players = useMemo<RankedPlayerEntry[]>(() => {
    const profileMap = new Map<string, PlayerProfile>();
    profiles.forEach((p) => {
      profileMap.set(p.uid, p);
    });

    const map = new Map<
      string,
      {
        playerId: string;
        nickname: string;
        carColor: CarColor;
        avatarUrl?: string;
        overallScore: number;
        bestScore: number;
        wins: number;
        gamesPlayed: number;
        bestTimeMs: number;
      }
    >();

    const relevantResults =
      gameFilter === 'all'
        ? results
        : results.filter((r) => (r.gameId || 'calculation_racer') === gameFilter);

    relevantResults.forEach((r) => {
      if (!r.playerId) return;
      const prof = profileMap.get(r.playerId);
      // Skip banned profiles
      if (prof?.isBanned) return;

      const pts = r.score ?? r.correctAnswers * 10;
      const isWin = r.placement === 1;
      const existing = map.get(r.playerId);

      if (!existing) {
        map.set(r.playerId, {
          playerId: r.playerId,
          nickname: prof?.nickname || r.nickname || 'Player',
          carColor: prof?.carColor || r.carColor || 'blue',
          avatarUrl: prof?.avatarUrl,
          overallScore: pts,
          bestScore: pts,
          wins: isWin ? 1 : 0,
          gamesPlayed: 1,
          bestTimeMs: r.distance >= 100 && r.durationMs > 0 ? r.durationMs : 0,
        });
      } else {
        existing.nickname = prof?.nickname || existing.nickname;
        existing.carColor = prof?.carColor || existing.carColor;
        if (prof?.avatarUrl) existing.avatarUrl = prof.avatarUrl;
        existing.overallScore += pts;
        if (pts > existing.bestScore) existing.bestScore = pts;
        if (isWin) existing.wins += 1;
        existing.gamesPlayed += 1;
        if (
          r.distance >= 100 &&
          r.durationMs > 0 &&
          (existing.bestTimeMs === 0 || r.durationMs < existing.bestTimeMs)
        ) {
          existing.bestTimeMs = r.durationMs;
        }
      }
    });

    // When viewing All Games, also merge any public profiles that have recorded stats
    if (gameFilter === 'all') {
      profiles.forEach((p) => {
        if (p.isBanned) return;
        const profBest = p.bestScore ?? (p.totalCorrect || 0) * 10;
        const existing = map.get(p.uid);
        if (!existing) {
          if (profBest > 0 || p.totalRaces > 0 || p.wins > 0) {
            map.set(p.uid, {
              playerId: p.uid,
              nickname: p.nickname,
              carColor: p.carColor || 'blue',
              avatarUrl: p.avatarUrl,
              overallScore: profBest,
              bestScore: profBest,
              wins: p.wins || 0,
              gamesPlayed: p.totalRaces || 0,
              bestTimeMs: p.bestTimeMs || 0,
            });
          }
        } else {
          existing.nickname = p.nickname || existing.nickname;
          existing.carColor = p.carColor || existing.carColor;
          if (p.avatarUrl) existing.avatarUrl = p.avatarUrl;
          existing.bestScore = Math.max(existing.bestScore, profBest);
          existing.overallScore = Math.max(existing.overallScore, profBest);
          existing.wins = Math.max(existing.wins, p.wins || 0);
          existing.gamesPlayed = Math.max(existing.gamesPlayed, p.totalRaces || 0);
          if (
            p.bestTimeMs > 0 &&
            (existing.bestTimeMs === 0 || p.bestTimeMs < existing.bestTimeMs)
          ) {
            existing.bestTimeMs = p.bestTimeMs;
          }
        }
      });
    }

    const eligible = Array.from(map.values()).filter(
      (item) => item.overallScore > 0 || item.bestScore > 0 || item.gamesPlayed > 0
    );

    eligible.sort((a, b) => {
      if (sortBy === 'overall_score') {
        if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        if (b.wins !== a.wins) return b.wins - a.wins;
      } else if (sortBy === 'best_score') {
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
        if (b.wins !== a.wins) return b.wins - a.wins;
      } else {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      }
      if (a.bestTimeMs > 0 && b.bestTimeMs > 0 && a.bestTimeMs !== b.bestTimeMs) {
        return a.bestTimeMs - b.bestTimeMs;
      }
      return a.nickname.localeCompare(b.nickname);
    });

    const sliced = eligible.slice(0, 10);
    const ranked: RankedPlayerEntry[] = [];

    sliced.forEach((item, idx) => {
      if (idx === 0) {
        ranked.push({ ...item, rank: 1 });
        return;
      }
      const prev = ranked[idx - 1];
      const isTied =
        sortBy === 'overall_score'
          ? item.overallScore === prev.overallScore && item.bestScore === prev.bestScore
          : sortBy === 'best_score'
            ? item.bestScore === prev.bestScore && item.overallScore === prev.overallScore
            : item.wins === prev.wins && item.overallScore === prev.overallScore;

      ranked.push({
        ...item,
        rank: isTied ? prev.rank : idx + 1,
      });
    });

    return ranked;
  }, [profiles, results, gameFilter, sortBy]);

  const isLoading = loadingProfiles || loadingResults;

  const formatMetricValue = (entry: RankedPlayerEntry) => {
    if (sortBy === 'overall_score') return `${entry.overallScore.toLocaleString()} pts`;
    if (sortBy === 'best_score') return `${entry.bestScore.toLocaleString()} pts`;
    return `${entry.wins} ${entry.wins === 1 ? 'win' : 'wins'}`;
  };

  const formatSubMetric = (entry: RankedPlayerEntry) => {
    if (sortBy === 'overall_score') {
      return `Best ${entry.bestScore} pts · ${entry.gamesPlayed} ${
        entry.gamesPlayed === 1 ? 'game' : 'games'
      }`;
    }
    if (sortBy === 'best_score') {
      return `Total ${entry.overallScore} pts · ${entry.wins} ${
        entry.wins === 1 ? 'win' : 'wins'
      }`;
    }
    return `${entry.overallScore} pts · Best ${entry.bestScore} pts`;
  };

  const topThree = top10Players.slice(0, 3);
  const remainingSeven = top10Players.slice(3, 10);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header & Two Compact Selection Controls */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-xs">
            <Trophy className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            All-Time Top 10
          </h1>
        </div>

        {/* 1. Sort By & 2. Game Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort By Control */}
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs">
            {(
              [
                { id: 'overall_score', label: 'Overall Score' },
                { id: 'best_score', label: 'Best Score' },
                { id: 'wins', label: 'Wins' },
              ] as { id: SortByMetric; label: string }[]
            ).map((opt) => {
              const active = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setSortBy(opt.id);
                  }}
                  className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${
                    active
                      ? 'bg-[#2563EB] text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Game Selection Control */}
          <select
            aria-label="Filter by Game"
            value={gameFilter}
            onChange={(e) => {
              soundEngine.playClick();
              setGameFilter(e.target.value as GameFilterOption);
            }}
            className="min-h-[46px] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-900 shadow-2xs focus:border-[#2563EB] focus:outline-none"
          >
            <option value="all">🏆 All Games (Platform Total)</option>
            {TROJO_GAMES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.emoji} {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Game Quick Switcher Pills */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setGameFilter('all');
          }}
          className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
            gameFilter === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          🏆 All Games
        </button>
        {TROJO_GAMES.map((g) => {
          const active = gameFilter === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setGameFilter(g.id);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
                active
                  ? 'bg-[#2563EB] text-white shadow-2xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{g.emoji}</span>
              <span>{g.name}</span>
            </button>
          );
        })}
      </div>

      {/* Metric Context Explainer */}
      <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-500">
        <span>
          {gameFilter === 'all'
            ? 'Ranking: Overall Verified Championship Points across all games played'
            : `Ranking: Top 10 players by best verified record in ${
                TROJO_GAMES.find((g) => g.id === gameFilter)?.name || 'Game'
              }`}
        </span>
        <span className="font-mono text-slate-400">Top 10 Only</span>
      </div>

      {/* Loading / Error / Empty / Top 10 List */}
      {isLoading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : loadError && top10Players.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
          <p className="mt-2 font-display text-base font-extrabold text-rose-950">
            {loadError}
          </p>
        </div>
      ) : top10Players.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
          <Trophy className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-display text-lg font-extrabold text-slate-900">
            No recorded scores yet
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {/* Visually Distinctive Top 3 Podium Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {topThree.map((entry) => {
              const cInfo = CAR_PALETTE[entry.carColor] || CAR_PALETTE.blue;
              const isMe = entry.playerId === profile.uid;
              const rankStyles =
                entry.rank === 1
                  ? {
                      card: 'border-amber-300 bg-amber-50/70',
                      badge: 'bg-amber-400 text-slate-950',
                      label: '1st Place',
                    }
                  : entry.rank === 2
                    ? {
                        card: 'border-slate-300 bg-slate-100/80',
                        badge: 'bg-slate-300 text-slate-900',
                        label: '2nd Place',
                      }
                    : {
                        card: 'border-orange-300 bg-orange-50/70',
                        badge: 'bg-orange-300 text-orange-950',
                        label: '3rd Place',
                      };

              return (
                <div
                  key={entry.playerId}
                  className={`relative flex flex-col items-center rounded-3xl border-2 p-5 text-center shadow-xs transition-transform ${
                    rankStyles.card
                  } ${isMe ? 'ring-2 ring-[#2563EB]' : ''}`}
                >
                  <div
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 font-mono text-xs font-black ${rankStyles.badge}`}
                  >
                    {entry.rank === 1 ? (
                      <Crown className="h-3.5 w-3.5" />
                    ) : (
                      <Medal className="h-3.5 w-3.5" />
                    )}
                    <span>#{entry.rank}</span>
                  </div>

                  {/* Player Avatar */}
                  <div className="mt-3.5">
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt={entry.nickname}
                        className="h-16 w-16 rounded-full border-2 border-white object-cover shadow-sm"
                      />
                    ) : (
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white font-display text-lg font-black text-white shadow-sm"
                        style={{ backgroundColor: cInfo.primary }}
                      >
                        {getInitials(entry.nickname)}
                      </div>
                    )}
                  </div>

                  <p className="mt-3 max-w-full truncate font-display text-base font-extrabold text-slate-900">
                    {entry.nickname}
                    {isMe ? ' (You)' : ''}
                  </p>

                  <p className="mt-1 font-mono text-xl font-black text-[#7C3AED] tabular-nums">
                    {formatMetricValue(entry)}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-600 tabular-nums">
                    {formatSubMetric(entry)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Remaining Ranks #4 – #10 Compact List */}
          {remainingSeven.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xs">
              <div className="divide-y divide-slate-100">
                {remainingSeven.map((entry) => {
                  const cInfo = CAR_PALETTE[entry.carColor] || CAR_PALETTE.blue;
                  const isMe = entry.playerId === profile.uid;
                  return (
                    <div
                      key={entry.playerId}
                      className={`flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 ${
                        isMe ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-mono text-xs font-black text-slate-700 tabular-nums">
                          #{entry.rank}
                        </span>

                        {entry.avatarUrl ? (
                          <img
                            src={entry.avatarUrl}
                            alt={entry.nickname}
                            className="h-10 w-10 shrink-0 rounded-full object-cover shadow-2xs"
                          />
                        ) : (
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black text-white shadow-2xs"
                            style={{ backgroundColor: cInfo.primary }}
                          >
                            {getInitials(entry.nickname)}
                          </span>
                        )}

                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-extrabold text-slate-900">
                            {entry.nickname}
                            {isMe ? ' (You)' : ''}
                          </p>
                          <p className="truncate text-xs text-slate-500 tabular-nums">
                            {formatSubMetric(entry)}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 font-mono text-sm font-black text-[#7C3AED] tabular-nums sm:text-base">
                        {formatMetricValue(entry)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
