import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  PlusCircle,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  DIFFICULTY_LABELS,
  PlayerProfile,
  RoomRecord,
  TROJO_GAME_MAP,
} from '../game/types';
import { soundEngine } from '../lib/sound';

interface JoinRoomPageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  initialRoomCode?: string;
  onJoinRoom: (code: string) => Promise<void>;
  onOpenCreateRoom: () => void;
  onBackHome: () => void;
  onSignIn: () => void;
}

export const JoinRoomPage: React.FC<JoinRoomPageProps> = ({
  profile,
  isGuest,
  initialRoomCode = '',
  onJoinRoom,
  onOpenCreateRoom,
  onBackHome,
  onSignIn,
}) => {
  const [joinCode, setJoinCode] = useState(
    initialRoomCode ? initialRoomCode.trim().toUpperCase().slice(0, 6) : ''
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<RoomRecord[]>([]);

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCode(initialRoomCode.trim().toUpperCase().slice(0, 6));
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (isGuest) return;
    const q = query(
      collection(db, 'rooms'),
      where('isPublic', '==', true),
      where('status', '==', 'waiting')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as RoomRecord)
          .filter((r) => r.playerCount < r.maxPlayers);
        setOpenRooms(list.slice(0, 6));
      },
      () => {}
    );
    return () => unsub();
  }, [isGuest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    await attemptJoin(joinCode);
  };

  const attemptJoin = async (rawCode: string) => {
    if (isGuest) {
      setErrorMsg('Please Create a Gaming Profile to join live multiplayer rooms.');
      return;
    }
    if (profile.isBanned) {
      setErrorMsg(
        `Account suspended: ${profile.banReason || 'Contact administrator'}`
      );
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await onJoinRoom(rawCode);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not join room.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
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

      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-2xs">
          <KeyRound className="h-6 w-6" />
        </div>

        <h1 className="mt-4 font-display text-3xl font-extrabold text-slate-900">
          Join Game Room
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Enter the 6-character code shared by your friend to join their TROJO game room.
        </p>

        {initialRoomCode && (
          <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-xs font-bold text-purple-900">
            Room invitation detected for code{' '}
            <span className="font-mono underline">{initialRoomCode.toUpperCase()}</span>!{' '}
            {isGuest
              ? 'Create a Gaming Profile below, then tap Join Game Room.'
              : 'Tap Join Game Room below to enter the waiting room.'}
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
            <span>{errorMsg}</span>
            {isGuest && (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-orange-600"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Create a Gaming Profile</span>
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="room-code-input"
              className="block text-xs font-bold tracking-wider text-slate-600 uppercase"
            >
              6-Character Room Code
            </label>
            <input
              id="room-code-input"
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="AB12CD"
              className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-center font-mono text-2xl font-bold tracking-widest text-slate-900 uppercase placeholder-slate-400 transition-colors focus:border-purple-500 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={busy || joinCode.trim().length !== 6}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-6 py-4 font-display text-base font-extrabold text-white shadow-xs transition-colors hover:bg-purple-500 disabled:opacity-40"
          >
            <span>{busy ? 'Validating & Joining Room...' : 'Join Game Room'}</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>

        {/* Open Waiting Rooms List (if any) */}
        {!isGuest && openRooms.length > 0 && (
          <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>Open TROJO Lobbies Waiting for Players</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {openRooms.map((r) => {
                const gInfo = TROJO_GAME_MAP[r.gameId || 'calculation_racer'];
                return (
                  <div
                    key={r.roomCode}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-purple-100 px-2.5 py-0.5 font-mono text-xs font-extrabold text-purple-800">
                          {r.roomCode}
                        </span>
                        <span className="rounded-lg bg-sky-100 px-2.5 py-0.5 text-xs font-extrabold text-sky-800">
                          {gInfo.emoji} {gInfo.name}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {r.hostNickname}’s Room
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {DIFFICULTY_LABELS[r.difficulty]} · {r.playerCount}/{r.maxPlayers} Players
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => attemptJoin(r.roomCode)}
                      className="min-h-[40px] rounded-xl bg-purple-600 px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-purple-500"
                    >
                      Join Room
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 text-xs text-slate-600">
          <span>Want to host your own room instead?</span>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenCreateRoom();
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-extrabold text-white hover:bg-emerald-500"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Game Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
