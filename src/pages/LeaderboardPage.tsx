import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Award,
  Clock,
  Gamepad2,
  Medal,
  Play,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  CAR_PALETTE,
  CATEGORY_LABELS,
  CarColor,
  PlayerProfile,
  QuestionCategory,
  RaceResultRecord,
  TROJO_GAMES,
  TrojoGameId,
} from '../game/types';
import { soundEngine } from '../lib/sound';
import { GameTileArtwork } from '../components/GameTileArtwork';

type LeaderboardPeriod = 'all' | 'weekly' | 'daily';

interface LeaderboardPageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  onBackHome: () => void;
  onOpenSetup: () => void;
}

interface SectionTopEntry {
  uid: string;
  nickname: string;
  carColor: CarColor;
  highestPoints: number;
  wins: number;
  totalGames: number;
  bestTimeMs: number;
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

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  profile,
  isGuest,
  onBackHome,
  onOpenSetup,
}) => {
  const [lbPeriod, setLbPeriod] = useState<LeaderboardPeriod>('all');
  const [selectedSection, setSelectedSection] = useState<
    'all_sections' | TrojoGameId | QuestionCategory
  >('all_sections');

  const [publicProfiles, setPublicProfiles] = useState<PlayerProfile[]>([]);
  const [raceResults, setRaceResults] = useState<RaceResultRecord[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'profiles'), where('isPublicProfile', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PlayerProfile[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as PlayerProfile;
          if (!data.isBanned) {
            list.push(data);
          }
        });
        setPublicProfiles(list);
      },
      (err) => {
        console.warn('Leaderboard profiles subscription error:', err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'race_results'),
      (snap) => {
        const list: RaceResultRecord[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as RaceResultRecord) });
        });
        setRaceResults(list);
      },
      (err) => {
        console.warn('Race results subscription error:', err);
      }
    );
    return () => unsub();
  }, []);

  const bannedOrHiddenMap = useMemo(() => {
    const allowedMap = new Map<string, PlayerProfile>();
    for (const p of publicProfiles) {
      if (!p.isBanned) {
        allowedMap.set(p.uid, p);
      }
    }
    return allowedMap;
  }, [publicProfiles]);

  // Helper to compute strictly the TOP 5 HIGHEST POINTS for any filter predicate
  const computeTop5ForPredicate = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const cutoff =
      lbPeriod === 'daily' ? dayAgo : lbPeriod === 'weekly' ? weekAgo : 0;

    return (predicate: (r: RaceResultRecord) => boolean): SectionTopEntry[] => {
      const map = new Map<string, SectionTopEntry>();

      for (const r of raceResults) {
        if (cutoff > 0 && r.completedAtMs < cutoff) continue;
        if (r.playerId.startsWith('guest_')) continue;
        if (!predicate(r)) continue;

        const prof = bannedOrHiddenMap.get(r.playerId);
        // Include public verified records
        if (!r.isPublic && !prof) continue;

        const pts = r.score ?? r.correctAnswers * 10;
        const existing = map.get(r.playerId) || {
          uid: r.playerId,
          nickname: prof?.nickname || r.nickname,
          carColor: prof?.carColor || r.carColor || 'blue',
          highestPoints: 0,
          wins: 0,
          totalGames: 0,
          bestTimeMs: 0,
        };

        existing.totalGames += 1;
        if (r.placement === 1) {
          existing.wins += 1;
        }
        if (pts > existing.highestPoints) {
          existing.highestPoints = pts;
        }
        if (
          r.durationMs > 0 &&
          (existing.bestTimeMs === 0 || r.durationMs < existing.bestTimeMs)
        ) {
          existing.bestTimeMs = r.durationMs;
        }

        map.set(r.playerId, existing);
      }

      return Array.from(map.values())
        .filter((e) => e.highestPoints > 0)
        .sort((a, b) => {
          if (b.highestPoints !== a.highestPoints) {
            return b.highestPoints - a.highestPoints;
          }
          if (b.wins !== a.wins) return b.wins - a.wins;
          const aTime = a.bestTimeMs > 0 ? a.bestTimeMs : Number.MAX_SAFE_INTEGER;
          const bTime = b.bestTimeMs > 0 ? b.bestTimeMs : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        })
        .slice(0, 5);
    };
  }, [raceResults, lbPeriod, bannedOrHiddenMap]);

  // Top 5 Highest Points for each of the 5 TROJO Game Sections
  const gameSectionsTop5 = useMemo(() => {
    return TROJO_GAMES.map((game) => {
      const entries = computeTop5ForPredicate((r) => {
        const gId = r.gameId || 'calculation_racer';
        return gId === game.id;
      });
      return {
        game,
        entries,
      };
    });
  }, [computeTop5ForPredicate]);

  // Top 5 Highest Points for each Calculation Racer Subject Section
  const categorySectionsTop5 = useMemo(() => {
    const categories: QuestionCategory[] = [
      'math',
      'gk',
      'science',
      'current_affairs',
    ];
    return categories.map((cat) => {
      const entries = computeTop5ForPredicate((r) => {
        const gId = r.gameId || 'calculation_racer';
        return gId === 'calculation_racer' && r.category === cat;
      });
      return {
        category: cat,
        label: CATEGORY_LABELS[cat],
        entries,
      };
    });
  }, [computeTop5ForPredicate]);

  const renderTop5List = (entries: SectionTopEntry[], emptyLabel: string) => {
    if (entries.length === 0) {
      return (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-8 text-center">
          <Award className="mx-auto h-7 w-7 text-amber-500" />
          <p className="mt-2 text-xs font-bold text-slate-700">{emptyLabel}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Play this section to claim a Top 5 Highest Points spot!
          </p>
        </div>
      );
    }

    return (
      <div className="mt-4 divide-y divide-slate-100">
        {entries.slice(0, 5).map((entry, idx) => {
          const carInfo = CAR_PALETTE[entry.carColor] || CAR_PALETTE.blue;
          const isMe = entry.uid === profile.uid && !isGuest;
          return (
            <div
              key={entry.uid}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors ${
                isMe
                  ? 'bg-blue-50/90'
                  : idx === 0
                    ? 'bg-amber-50/40 hover:bg-slate-50'
                    : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-black ${
                    idx === 0
                      ? 'bg-amber-400 text-slate-950'
                      : idx === 1
                        ? 'bg-slate-300 text-slate-900'
                        : idx === 2
                          ? 'bg-orange-300 text-slate-950'
                          : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  #{idx + 1}
                </span>

                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-2xs"
                  style={{ backgroundColor: carInfo.primary }}
                >
                  {getInitials(entry.nickname)}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {entry.nickname}
                    {isMe && (
                      <span className="ml-1.5 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {entry.wins} {entry.wins === 1 ? 'Win' : 'Wins'} ·{' '}
                    {entry.totalGames} {entry.totalGames === 1 ? 'Game' : 'Games'}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5 text-right font-mono text-xs tabular-nums">
                <span className="rounded-xl bg-purple-100 px-3 py-1.5 font-extrabold text-purple-900">
                  {entry.highestPoints} pts
                </span>
                {entry.bestTimeMs > 0 && (
                  <span className="hidden items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 sm:inline-flex">
                    <Clock className="h-3 w-3 text-sky-600" />
                    {(entry.bestTimeMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header Row */}
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
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-900">
            <Trophy className="h-3.5 w-3.5 text-amber-600" />
            <span>TOP 5 HIGHEST POINTS PER SECTION</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-slate-900">
            TROJO — A Fun Nagar Leaderboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Showing exclusively the <strong>Top 5 Highest Points</strong> in each Game Section and Subject Section.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onOpenSetup();
          }}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#2563EB] px-5 py-3 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>Play Games</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Time Period Filter */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100 p-1.5">
            {(
              [
                { id: 'all', label: 'All-Time Top 5' },
                { id: 'weekly', label: 'This Week Top 5' },
                { id: 'daily', label: 'Today Top 5' },
              ] as { id: LeaderboardPeriod; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setLbPeriod(tab.id);
                }}
                className={`min-h-[38px] rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  lbPeriod === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-xl bg-purple-50 px-3.5 py-2 text-xs font-extrabold text-purple-800">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span>Ranked by Highest Points (Top 5 Only)</span>
          </div>
        </div>

        {/* Section Selector Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
            <Gamepad2 className="h-3.5 w-3.5" />
            <span>Section:</span>
          </span>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setSelectedSection('all_sections');
            }}
            className={`min-h-[36px] rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
              selectedSection === 'all_sections'
                ? 'bg-[#2563EB] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Sections (Top 5 Each)
          </button>
          {TROJO_GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setSelectedSection(game.id);
              }}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                selectedSection === game.id
                  ? 'border border-blue-300 bg-blue-50 text-blue-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{game.emoji}</span>
              <span>{game.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* GAME SECTIONS: TOP 5 HIGHEST POINTS IN EACH GAME */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl">
            Game Sections — Top 5 Highest Points
          </h2>
          <span className="text-xs font-bold text-slate-500">
            Top 5 per game
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {gameSectionsTop5
            .filter(
              (sec) =>
                selectedSection === 'all_sections' ||
                selectedSection === sec.game.id
            )
            .map(({ game, entries }) => (
              <div
                key={game.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3.5">
                    <GameTileArtwork
                      gameId={game.id}
                      className="h-14 w-14 shrink-0"
                    />
                    <div>
                      <span className="inline-block rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-800">
                        Top 5 Highest Points
                      </span>
                      <h3 className="mt-0.5 font-display text-lg font-extrabold text-slate-900">
                        {game.name}
                      </h3>
                      <p className="text-xs text-slate-500">{game.badgeText}</p>
                    </div>
                  </div>
                  <Medal className="h-6 w-6 text-amber-500 shrink-0" />
                </div>

                {renderTop5List(
                  entries,
                  `No ${game.name} scores recorded for this period yet.`
                )}
              </div>
            ))}
        </div>
      </div>

      {/* SUBJECT SECTIONS: TOP 5 HIGHEST POINTS IN EACH CALCULATION RACER SUBJECT */}
      {(selectedSection === 'all_sections' ||
        selectedSection === 'calculation_racer' ||
        selectedSection === 'math' ||
        selectedSection === 'gk' ||
        selectedSection === 'science' ||
        selectedSection === 'current_affairs') && (
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl">
                Calculation Racer Subject Sections — Top 5 Highest Points
              </h2>
              <p className="text-xs text-slate-500">
                Top 5 highest points in Mathematics, General Knowledge, Science, and Current Affairs
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {categorySectionsTop5.map(({ category, label, entries }) => (
              <div
                key={category}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                  <div>
                    <span className="inline-block rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
                      Subject Section · Top 5
                    </span>
                    <h3 className="mt-1 font-display text-lg font-extrabold text-slate-900">
                      {label}
                    </h3>
                  </div>
                  <Trophy className="h-5 w-5 text-amber-500" />
                </div>

                {renderTop5List(
                  entries,
                  `No ${label} scores recorded for this period yet.`
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
