import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Gamepad2,
  KeyRound,
  Play,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  CAR_PALETTE,
  OperationType,
  PlayerProfile,
  RaceResultRecord,
  TROJO_GAMES,
  TrojoGameId,
} from '../game/types';
import { soundEngine } from '../lib/sound';
import { GameTileArtwork } from '../components/GameTileArtwork';

interface HomePageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  onOpenLibrary: () => void;
  onSelectGame: (gameId: TrojoGameId, mode: 'solo' | 'multiplayer') => void;
  onQuickPlayGame?: (gameId: TrojoGameId) => void;
  onOpenJoinRoom: () => void;
  onOpenLeaderboard: () => void;
  onOpenProfile: () => void;
  onSignIn: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  profile,
  isGuest,
  onOpenLibrary,
  onSelectGame,
  onQuickPlayGame,
  onOpenJoinRoom,
  onOpenLeaderboard,
  onOpenProfile,
  onSignIn,
}) => {
  const [publicProfiles, setPublicProfiles] = useState<PlayerProfile[]>([]);
  const [raceResults, setRaceResults] = useState<RaceResultRecord[]>([]);

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

    const unsubResults = onSnapshot(
      collection(db, 'race_results'),
      (snap) => {
        setRaceResults(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as RaceResultRecord) }))
        );
      },
      () => {}
    );

    return () => {
      unsubProfiles();
      unsubResults();
    };
  }, []);

  // Top 5 Highest Points Players for the compact homepage Leaderboard Preview
  const top5Players = useMemo(() => {
    const scoreByPlayer = new Map<string, number>();
    for (const r of raceResults) {
      const pts = r.score ?? r.correctAnswers * 10;
      const prev = scoreByPlayer.get(r.playerId) || 0;
      if (pts > prev) {
        scoreByPlayer.set(r.playerId, pts);
      }
    }

    const eligible = publicProfiles
      .filter((p) => !p.isBanned && (p.totalRaces > 0 || (scoreByPlayer.get(p.uid) || 0) > 0))
      .map((p) => ({
        ...p,
        highestPoints: Math.max(
          p.bestScore || 0,
          scoreByPlayer.get(p.uid) || 0,
          (p.wins || 0) * 100
        ),
      }));

    const sorted = [...eligible].sort((a, b) => {
      if (b.highestPoints !== a.highestPoints) {
        return b.highestPoints - a.highestPoints;
      }
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aTime = a.bestTimeMs > 0 ? a.bestTimeMs : Number.MAX_SAFE_INTEGER;
      const bTime = b.bestTimeMs > 0 ? b.bestTimeMs : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
    return sorted.slice(0, 5);
  }, [publicProfiles, raceResults]);

  const getInitials = (name: string) => {
    const clean = name.trim();
    if (!clean) return 'T';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {/* HERO SECTION — ATTRACTIVE AND MINIMAL */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs sm:p-10">
        {/* Lightweight floating decorative game tokens */}
        <div
          aria-hidden="true"
          className="pointer-events-none mb-4 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
        >
          {['🏎️', '🧪', '🔤', '🟨', '🀄'].map((token, idx) => (
            <span
              key={token}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-xl shadow-2xs motion-safe:animate-bounce"
              style={{
                animationDuration: `${2.4 + (idx % 3) * 0.4}s`,
                animationDelay: `${idx * 0.15}s`,
              }}
            >
              {token}
            </span>
          ))}
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1 text-xs font-extrabold tracking-wider text-purple-800 uppercase">
            <Gamepad2 className="h-3.5 w-3.5 text-purple-700" />
            <span>TROJO — A Fun Nagar</span>
          </div>

          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            LET&rsquo;S PLAY!
          </h1>

          <p className="mt-2.5 text-sm font-medium text-slate-600 sm:text-base">
            Play Calculation Racer, Water Sort, Word Finder, 2048, and Mahjong Solitaire — solo across 20 levels or live with friends!
          </p>
        </div>

        {/* THREE LARGE COLORFUL SOLID BUTTONS */}
        <div className="mx-auto mt-7 grid max-w-3xl grid-cols-1 gap-3.5 sm:grid-cols-3 sm:gap-4">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenLibrary();
            }}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#2563EB] px-6 py-4 font-display text-base font-extrabold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Play className="h-5 w-5 fill-current shrink-0" />
            <span>Play Games</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onSelectGame('calculation_racer', 'multiplayer');
            }}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#16A34A] px-6 py-4 font-display text-base font-extrabold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-emerald-700 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <Users className="h-5 w-5 shrink-0" />
            <span>Create Game Room</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenJoinRoom();
            }}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#7C3AED] px-6 py-4 font-display text-base font-extrabold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-purple-700 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <KeyRound className="h-5 w-5 shrink-0" />
            <span>Join Game Room</span>
          </button>
        </div>
      </section>

      {/* GAME LIST — ROUNDED SQUARE APP TILES ARRANGED LIKE REFERENCE IMAGE */}
      <section className="mt-8 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-slate-900">
              Game List
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Tap any game icon to play solo levels or create a live multiplayer room
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenLibrary();
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-blue-700"
          >
            <span>All Games &amp; Levels</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Clean Icon Grid Matching Reference Screenshot */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {TROJO_GAMES.map((game) => (
            <div
              key={game.id}
              className="group flex flex-col items-center justify-between rounded-3xl border border-slate-200/90 bg-slate-50/60 p-4 text-center transition-all hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  if (onQuickPlayGame && game.isInteractivePuzzle) {
                    onQuickPlayGame(game.id);
                  } else {
                    onSelectGame(game.id, 'solo');
                  }
                }}
                className="flex flex-col items-center focus:outline-none"
              >
                <GameTileArtwork
                  gameId={game.id}
                  className="h-32 w-32 sm:h-36 sm:w-36 transition-transform duration-200 group-hover:scale-105"
                />
                <h3 className="mt-3 font-display text-base font-extrabold text-slate-900 sm:text-lg">
                  {game.name}
                </h3>
                <span className="mt-0.5 inline-block rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-700">
                  {game.badgeText}
                </span>
              </button>

              <div className="mt-3.5 flex w-full items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    if (onQuickPlayGame && game.isInteractivePuzzle) {
                      onQuickPlayGame(game.id);
                    } else {
                      onSelectGame(game.id, 'solo');
                    }
                  }}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-xl bg-[#2563EB] px-3 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-blue-700"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Play</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onSelectGame(game.id, 'multiplayer');
                  }}
                  title={`Multiplayer Room for ${game.name}`}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl bg-[#16A34A] px-2.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-emerald-700"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>2P/4P</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GAMING PROFILE CALLOUT SECTION */}
      {isGuest && (
        <section className="mt-8 rounded-3xl border-2 border-orange-200 bg-orange-50/60 p-6 shadow-xs sm:p-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-orange-100 px-3 py-1 text-xs font-extrabold text-orange-800">
                <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                <span>Level Up Your Experience</span>
              </div>
              <h2 className="mt-2 font-display text-xl font-extrabold text-slate-900 sm:text-2xl">
                Create a Gaming Profile
              </h2>
              <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                Currently playing as <strong>{profile.nickname}</strong> (Guest progress is saved locally on this device only).
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-700 sm:grid-cols-4">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Compete on leaderboards</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Save scores &amp; level progress</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Access results across devices</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Host live multiplayer rooms</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row shrink-0">
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 py-3 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-orange-600"
              >
                <UserCheck className="h-4 w-4" />
                <span>Create a Gaming Profile</span>
              </button>

              <button
                type="button"
                onClick={onOpenProfile}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs font-extrabold text-slate-800 transition-colors hover:bg-slate-50"
              >
                <span>Access My Profile</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* COMPACT LEADERBOARD PREVIEW (TOP 5 HIGHEST POINTS) */}
      <section className="mt-8 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900">
                Top 5 Highest Points
              </h2>
              <p className="text-xs text-slate-500">
                Top 5 highest points across TROJO — A Fun Nagar sections
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenLeaderboard();
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-blue-700"
          >
            <span>View All Top 5 Sections</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {top5Players.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center">
            <Award className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-2.5 text-sm font-bold text-slate-800">
              No Verified Scores Yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              Create a Gaming Profile and complete a match to claim a Top 5 spot on TROJO!
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {top5Players.map((entry, idx) => {
              const carInfo = CAR_PALETTE[entry.carColor] || CAR_PALETTE.blue;
              const isMe = entry.uid === profile.uid && !isGuest;
              const rankBadgeClass =
                idx === 0
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : idx === 1
                    ? 'bg-slate-200 text-slate-800 border-slate-300'
                    : idx === 2
                      ? 'bg-orange-100 text-orange-800 border-orange-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200';

              return (
                <div
                  key={entry.uid}
                  className={`flex items-center justify-between gap-4 py-3.5 px-3 rounded-xl transition-colors ${
                    isMe ? 'bg-sky-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-xs font-bold shrink-0 ${rankBadgeClass}`}
                    >
                      #{idx + 1}
                    </span>

                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white shadow-2xs shrink-0"
                      style={{ backgroundColor: carInfo.primary }}
                    >
                      {getInitials(entry.nickname)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {entry.nickname}{' '}
                        {isMe && (
                          <span className="ml-1 rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.totalRaces} {entry.totalRaces === 1 ? 'game' : 'games'} · {entry.wins} {entry.wins === 1 ? 'win' : 'wins'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right font-mono text-xs tabular-nums shrink-0">
                    <span className="rounded-xl bg-purple-50 px-3 py-1.5 font-extrabold text-purple-700">
                      {entry.highestPoints} pts
                    </span>
                    {entry.bestTimeMs > 0 && (
                      <div className="hidden sm:flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 font-semibold">
                        <Clock className="h-3.5 w-3.5 text-sky-600" />
                        <span>{(entry.bestTimeMs / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
