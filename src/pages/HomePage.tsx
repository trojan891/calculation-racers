import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowRight,
  Award,
  Car,
  CheckCircle2,
  Clock,
  Flag,
  KeyRound,
  Play,
  Trophy,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  CAR_PALETTE,
  OperationType,
  PlayerProfile,
} from '../game/types';
import { RaceTrackCanvas } from '../game/RaceTrackCanvas';
import { soundEngine } from '../lib/sound';

interface HomePageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  onOpenSetup: (initialPlayerMode: 'solo' | 'multiplayer') => void;
  onOpenJoinRoom: () => void;
  onOpenLeaderboard: () => void;
  onSignIn: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  profile,
  isGuest,
  onOpenSetup,
  onOpenJoinRoom,
  onOpenLeaderboard,
  onSignIn,
}) => {
  const [publicProfiles, setPublicProfiles] = useState<PlayerProfile[]>([]);

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

    return () => unsubProfiles();
  }, []);

  // Top 5 players for the compact homepage Leaderboard Preview
  const top5Players = useMemo(() => {
    const eligible = publicProfiles.filter((p) => !p.isBanned && p.totalRaces > 0);
    const sorted = [...eligible].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aScore = a.bestScore || 0;
      const bScore = b.bestScore || 0;
      if (bScore !== aScore) return bScore - aScore;
      const aTime = a.bestTimeMs > 0 ? a.bestTimeMs : Number.MAX_SAFE_INTEGER;
      const bTime = b.bestTimeMs > 0 ? b.bestTimeMs : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return b.totalRaces - a.totalRaces;
    });
    return sorted.slice(0, 5);
  }, [publicProfiles]);

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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* MAIN WELCOME SECTION */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs sm:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-xl bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700">
            <Car className="h-4 w-4 text-sky-600" />
            <span>Brain-Powered Arcade Racing</span>
          </div>

          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Ready, Set, Solve!
          </h1>

          <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
            Answer questions fast to accelerate your car <strong className="font-bold text-emerald-600">+10m forward</strong>. Wrong answers move you <strong className="font-bold text-rose-600">-5m backward</strong>. First racer across the 100m finish line wins!
          </p>
        </div>

        {/* THREE PROMINENT ACTION CARDS */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {/* 1. Play Game */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenSetup('solo');
            }}
            className="group flex flex-col justify-between rounded-2xl border-2 border-sky-200 bg-sky-50/70 p-6 text-left transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-xs transition-transform group-hover:scale-105">
                <Play className="h-6 w-6 fill-current" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-slate-900">
                Play Game
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Choose your subject, difficulty, and topics to start a solo race or multiplayer match.
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 group-hover:text-sky-800">
              <span>Open Game Setup</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* 2. Create Room */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenSetup('multiplayer');
            }}
            className="group flex flex-col justify-between rounded-2xl border-2 border-purple-200 bg-purple-50/70 p-6 text-left transition-all hover:-translate-y-0.5 hover:border-purple-400 hover:bg-purple-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-xs transition-transform group-hover:scale-105">
                <Users className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-slate-900">
                Create Room
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Host a private 2-player or 4-player race room and share your 6-character code with friends.
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-purple-700 group-hover:text-purple-800">
              <span>Host Multiplayer</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* 3. Join Room */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenJoinRoom();
            }}
            className="group flex flex-col justify-between rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-6 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs transition-transform group-hover:scale-105">
                <KeyRound className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-slate-900">
                Join Room
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Have a room code from a friend? Enter the 6-character code to jump right into the lobby.
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 group-hover:text-emerald-800">
              <span>Enter Room Code</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>

        {/* Guest Play / Sign-In Notice Banner */}
        {isGuest && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-3.5 text-sm text-amber-900">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Playing as <strong>{profile.nickname}</strong> (Guest Play enabled). Sign in anytime to host multiplayer rooms & save scores to the global leaderboard.
              </span>
            </div>
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-amber-600 whitespace-nowrap shrink-0"
            >
              Sign In / Create Account
            </button>
          </div>
        )}
      </section>

      {/* LIVE RACE TRACK PREVIEW */}
      <section className="mt-8 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Flag className="h-4 w-4 text-sky-600" />
            <span>Live Race Track Preview</span>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
            +10m Correct · -5m Wrong · 100m Finish
          </span>
        </div>
        <RaceTrackCanvas
          maxLanes={2}
          racers={[
            {
              playerId: profile.uid,
              nickname: profile.nickname,
              carColor: profile.carColor,
              distance: 40,
              correctAnswers: 4,
              wrongAnswers: 0,
              finished: false,
              isCurrentUser: true,
            },
            {
              playerId: 'rival_preview',
              nickname: 'Rival Racer',
              carColor: profile.carColor === 'purple' ? 'red' : 'purple',
              distance: 25,
              correctAnswers: 3,
              wrongAnswers: 1,
              finished: false,
            },
          ]}
        />
      </section>

      {/* COMPACT LEADERBOARD PREVIEW (TOP 5 PLAYERS) */}
      <section className="mt-8 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Top Racers
              </h2>
              <p className="text-xs text-slate-500">
                Top 5 players ranked by verified race wins & scores
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenLeaderboard();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
          >
            <span>View Full Leaderboard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {top5Players.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center">
            <Award className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-2.5 text-sm font-bold text-slate-800">
              No Race Records Yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              Finish a race while signed in to claim the #1 spot on the leaderboard!
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
                        {entry.totalRaces} {entry.totalRaces === 1 ? 'race' : 'races'} completed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right font-mono text-xs tabular-nums shrink-0">
                    <div>
                      <span className="block font-bold text-emerald-600">
                        {entry.wins} {entry.wins === 1 ? 'Win' : 'Wins'}
                      </span>
                      {entry.bestScore !== undefined && entry.bestScore > 0 && (
                        <span className="text-[11px] text-slate-500">
                          Best: {entry.bestScore} pts
                        </span>
                      )}
                    </div>
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
