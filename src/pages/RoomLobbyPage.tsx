import React, { useEffect, useState } from 'react';
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
  Check,
  Copy,
  Crown,
  Link2,
  LogOut,
  MessageCircle,
  Play,
  Share2,
  ShieldAlert,
  Sparkles,
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
  RoomPlayerRecord,
  RoomRecord,
  TROJO_GAME_MAP,
} from '../game/types';
import { leaveMultiplayerRoomAndTransferHost } from '../lib/gameService';
import { soundEngine } from '../lib/sound';
import {
  buildRoomInviteText,
  copyToClipboard,
  getRoomInviteUrl,
  getSocialShareLinks,
} from '../lib/shareUtils';
import { RaceTrackCanvas } from '../game/RaceTrackCanvas';

interface RoomLobbyPageProps {
  roomCode: string;
  profile: PlayerProfile;
  onStartActiveRace: (room: RoomRecord, players: RoomPlayerRecord[]) => void;
  onLeaveRoom: () => void;
}

export const RoomLobbyPage: React.FC<RoomLobbyPageProps> = ({
  roomCode,
  profile,
  onStartActiveRace,
  onLeaveRoom,
}) => {
  const [room, setRoom] = useState<RoomRecord | null>(null);
  const [players, setPlayers] = useState<RoomPlayerRecord[]>([]);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Subscribe to Room document and Players subcollection in real time
  useEffect(() => {
    const roomPath = `rooms/${roomCode}`;
    const unsubRoom = onSnapshot(
      doc(db, 'rooms', roomCode),
      (snap) => {
        if (!snap.exists()) {
          setErrorMsg('Room no longer exists.');
          return;
        }
        setRoom(snap.data() as RoomRecord);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, roomPath);
      }
    );

    const playersPath = `rooms/${roomCode}/players`;
    const qPlayers = query(
      collection(db, 'rooms', roomCode, 'players'),
      where('roomCode', '==', roomCode)
    );
    const unsubPlayers = onSnapshot(
      qPlayers,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as RoomPlayerRecord);
        list.sort((a, b) => a.nickname.localeCompare(b.nickname));
        setPlayers(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, playersPath);
      }
    );

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomCode]);

  // Consistent Host Transfer if host disconnected/left while waiting
  useEffect(() => {
    if (!room || room.status !== 'waiting' || players.length === 0) return;
    const hostStillPresent = players.some((p) => p.playerId === room.hostId);
    if (!hostStillPresent && players[0]?.playerId === profile.uid) {
      updateDoc(doc(db, 'rooms', roomCode), {
        hostId: profile.uid,
        hostNickname: profile.nickname,
        playerCount: players.length,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  }, [room, players, profile.uid, profile.nickname, roomCode]);

  // Synchronized 3, 2, 1, GO! countdown & transition into the selected game
  useEffect(() => {
    if (!room) return;
    if (room.status === 'racing') {
      onStartActiveRace(room, players);
      return;
    }
    if (room.status === 'countdown' && room.countdownStartedAtMs > 0) {
      let lastBeep = -1;
      const interval = setInterval(() => {
        const elapsed = Date.now() - room.countdownStartedAtMs;
        const remaining = Math.ceil((3500 - elapsed) / 1000);
        if (remaining > 0) {
          setCountdownSec(remaining);
          if (remaining !== lastBeep) {
            lastBeep = remaining;
            soundEngine.playCountdownBeep(false);
          }
        } else {
          setCountdownSec(0);
          if (lastBeep !== 0) {
            lastBeep = 0;
            soundEngine.playCountdownBeep(true);
          }
          clearInterval(interval);
          if (room.hostId === profile.uid && room.status === 'countdown') {
            updateDoc(doc(db, 'rooms', roomCode), {
              status: 'racing',
              raceStartedAtMs: Date.now(),
              updatedAt: serverTimestamp(),
            }).catch((err) =>
              handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomCode}`)
            );
          }
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [room, players, profile.uid, roomCode, onStartActiveRace]);

  const myPlayer = players.find((p) => p.playerId === profile.uid);
  const isHost = room?.hostId === profile.uid;
  const readyPlayersCount = players.filter((p) => p.ready).length;
  const everyoneReady =
    players.length >= 2 &&
    readyPlayersCount === players.length &&
    players.every((p) => p.ready);
  const canHostStart = isHost && everyoneReady && room?.status === 'waiting';

  const showToast = (msg: string) => {
    setShareFeedback(msg);
    setTimeout(() => setShareFeedback(null), 2800);
  };

  const gameId = room?.gameId || 'calculation_racer';
  const gameInfo = TROJO_GAME_MAP[gameId];
  const totalQ = room ? room.questionCount || room.questionIds.length || 10 : 10;
  const joinUrl = getRoomInviteUrl(roomCode, gameId);
  const inviteText = room
    ? buildRoomInviteText({
        roomCode: room.roomCode,
        hostNickname: room.hostNickname,
        gameId,
        category: room.category,
        difficulty: room.difficulty,
        questionCount: totalQ,
        questionTimeLimitSec: room.questionTimeLimitSec,
        maxPlayers: room.maxPlayers,
      })
    : '';
  const socialLinks = getSocialShareLinks(inviteText, joinUrl);

  const handleCopyCode = async () => {
    soundEngine.playClick();
    await copyToClipboard(roomCode);
    showToast(`Copied room code ${roomCode}!`);
  };

  const handleCopyLink = async () => {
    soundEngine.playClick();
    await copyToClipboard(joinUrl);
    showToast('Copied invitation link!');
  };

  const handleShareRoom = async () => {
    soundEngine.playClick();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `TROJO — A Fun Nagar · Join ${gameInfo.name} (${roomCode})`,
          text: inviteText,
          url: joinUrl,
        });
        return;
      } catch {
        // Fallback if user cancels or share fails
      }
    }
    await copyToClipboard(inviteText);
    showToast('Copied room invitation message & link!');
  };

  const handleInstagramInvite = async () => {
    soundEngine.playClick();
    await copyToClipboard(inviteText);
    showToast('Copied invite message & link! Paste it in Instagram DM or Story.');
  };

  const handleToggleReady = async () => {
    if (!myPlayer || !room || room.status !== 'waiting') return;
    setBusy(true);
    soundEngine.playClick();
    try {
      await updateDoc(doc(db, 'rooms', roomCode, 'players', profile.uid), {
        ready: !myPlayer.ready,
        carColor: myPlayer.carColor,
        connected: true,
        lastSeenAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `rooms/${roomCode}/players/${profile.uid}`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSelectCarColor = async (color: CarColor) => {
    if (!myPlayer || !room || room.status !== 'waiting') return;
    soundEngine.playClick();
    try {
      await updateDoc(doc(db, 'rooms', roomCode, 'players', profile.uid), {
        ready: myPlayer.ready,
        carColor: color,
        connected: true,
        lastSeenAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `rooms/${roomCode}/players/${profile.uid}`
      );
    }
  };

  const handleLaunchCountdown = async () => {
    if (!room || !canHostStart) return;
    setBusy(true);
    setErrorMsg(null);
    soundEngine.playClick();
    try {
      await updateDoc(doc(db, 'rooms', roomCode), {
        status: 'countdown',
        countdownStartedAtMs: Date.now(),
        raceStartedAtMs: Date.now() + 3500,
        questionIds: room.questionIds,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomCode}`);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    soundEngine.playClick();
    await leaveMultiplayerRoomAndTransferHost(roomCode, profile);
    onLeaveRoom();
  };

  const getInitials = (name: string) => {
    const clean = name.trim();
    if (!clean) return 'P';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  if (!room) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="font-bold text-slate-600">Loading TROJO waiting room...</p>
      </div>
    );
  }

  const myPalette = CAR_PALETTE[myPlayer?.carColor || profile.carColor] || CAR_PALETTE.blue;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Synchronized 3, 2, 1, GO! Countdown Overlay */}
      {room.status === 'countdown' && countdownSec !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md">
          <span className="rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-extrabold tracking-wider text-emerald-800 uppercase">
            Everyone&rsquo;s ready! · {gameInfo.emoji} {gameInfo.name}
          </span>
          <div className="mt-6 font-display text-8xl font-extrabold tracking-tight text-slate-900 tabular-nums sm:text-9xl">
            {countdownSec > 0 ? countdownSec : 'GO!'}
          </div>
          <p className="mt-4 text-sm font-bold text-slate-600">
            {totalQ} Rounds · {room.questionTimeLimitSec}s Timer · Synchronized Room
          </p>
        </div>
      )}

      {/* ANIMATED WAITING ROOM HERO CARD */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        {/* Top Room Badges & Leave Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
            <span className="rounded-xl bg-sky-100 px-3 py-1.5 text-sky-900">
              {gameInfo.emoji} {gameInfo.name}
            </span>
            <span className="rounded-xl bg-purple-100 px-3 py-1.5 font-mono text-purple-900">
              Code: {room.roomCode}
            </span>
            <span className="rounded-xl bg-emerald-100 px-3 py-1.5 text-emerald-900">
              {DIFFICULTY_LABELS[room.difficulty]} · {totalQ} Rounds
            </span>
            {(gameId === 'calculation_racer' || gameId === 'quick_quiz') && (
              <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-slate-700">
                {CATEGORY_LABELS[room.category]}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleLeave}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-extrabold text-rose-700 transition-colors hover:bg-rose-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Leave Room</span>
          </button>
        </div>

        {/* LARGE CIRCULAR ANIMATED PLAYER EMBLEM & LIVE PLAYER COUNT */}
        <div className="mt-7 flex flex-col items-center text-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            {/* Outer rotating/pulsing ring (respects reduced motion) */}
            <div
              className={`absolute inset-0 rounded-full border-4 border-dashed ${
                everyoneReady
                  ? 'border-emerald-500 motion-safe:animate-spin'
                  : 'border-sky-400 motion-safe:animate-spin'
              }`}
              style={{ animationDuration: '9s' }}
            />
            <div
              className="absolute inset-2 rounded-full opacity-20 motion-safe:animate-ping"
              style={{
                backgroundColor: everyoneReady ? '#10B981' : myPalette.primary,
                animationDuration: '2.5s',
              }}
            />
            {/* Center Avatar & Game Icon */}
            <div
              className="relative z-10 flex h-20 w-20 flex-col items-center justify-center rounded-full text-white shadow-md"
              style={{ backgroundColor: myPalette.primary }}
            >
              <span className="text-2xl leading-none">{gameInfo.emoji}</span>
              <span className="mt-1 font-mono text-xs font-extrabold">
                {getInitials(profile.nickname)}
              </span>
            </div>
          </div>

          <p className="mt-3 font-display text-lg font-extrabold text-slate-900">
            {profile.nickname}
          </p>

          <div className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-xs font-extrabold text-slate-700">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                everyoneReady
                  ? 'bg-emerald-500'
                  : 'bg-amber-500 motion-safe:animate-pulse'
              }`}
            />
            <span>
              {everyoneReady
                ? 'Everyone’s ready!'
                : 'Waiting for other players…'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-purple-700">
              {players.length}/{room.maxPlayers} players
            </span>
          </div>
        </div>

        {/* CIRCULAR PLAYER SLOTS (2 OR 4 CIRCLES) */}
        <div
          className={`mx-auto mt-8 grid max-w-3xl gap-4 ${
            room.maxPlayers === 4
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'max-w-md grid-cols-2'
          }`}
        >
          {Array.from({ length: room.maxPlayers }).map((_, idx) => {
            const slotPlayer = players[idx];
            if (!slotPlayer) {
              return (
                <div
                  key={`empty-circle-${idx}`}
                  className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 text-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-3 border-dashed border-slate-300 bg-white text-slate-400 motion-safe:animate-pulse">
                    <User className="h-8 w-8" />
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-500">
                    Slot {idx + 1} · Open
                  </p>
                  <span className="mt-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    Waiting to join…
                  </span>
                </div>
              );
            }

            const slotPalette =
              CAR_PALETTE[slotPlayer.carColor] || CAR_PALETTE.blue;
            const isSlotHost = slotPlayer.playerId === room.hostId;
            const isMe = slotPlayer.playerId === profile.uid;

            return (
              <div
                key={slotPlayer.playerId}
                className={`flex flex-col items-center rounded-2xl border-2 p-4 text-center transition-all duration-300 ${
                  slotPlayer.ready
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : isMe
                      ? 'border-sky-300 bg-sky-50/40'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className="relative">
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white text-lg font-extrabold text-white shadow-sm transition-transform duration-300 scale-100"
                    style={{ backgroundColor: slotPalette.primary }}
                  >
                    {getInitials(slotPlayer.nickname)}
                  </div>
                  {isSlotHost && (
                    <span
                      className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-xs"
                      title="Room Host"
                    >
                      <Crown className="h-4 w-4" />
                    </span>
                  )}
                </div>

                <p className="mt-3 max-w-full truncate text-sm font-extrabold text-slate-900">
                  {slotPlayer.nickname} {isMe ? '(You)' : ''}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
                  {isSlotHost && (
                    <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-800">
                      Host
                    </span>
                  )}
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                      slotPlayer.ready
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {slotPlayer.ready ? '✓ Ready' : 'Not Ready'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* READY / START ACTION BAR & COLOR PICKER */}
        <div className="mt-8 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 md:grid-cols-2">
          {/* Player Color Selector */}
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Your Player Color
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {(['blue', 'red', 'green', 'purple'] as CarColor[]).map((c) => {
                const info = CAR_PALETTE[c];
                const active = myPlayer?.carColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleSelectCarColor(c)}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-xs font-extrabold transition-all ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/50"
                      style={{ backgroundColor: info.primary }}
                    />
                    <span className="truncate">{info.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ready & Host Start Buttons */}
          <div className="flex flex-col justify-end gap-2.5 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={handleToggleReady}
              className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xs transition-all ${
                myPlayer?.ready
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              <span>
                {myPlayer?.ready ? '✓ Ready (Tap to Unready)' : 'Mark as Ready'}
              </span>
            </button>

            {isHost && (
              <button
                type="button"
                disabled={!canHostStart || busy}
                onClick={handleLaunchCountdown}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-extrabold text-white shadow-xs transition-all hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>
                  {players.length < 2
                    ? 'Need 2+ Players'
                    : !everyoneReady
                      ? 'Wait for Ready'
                      : 'Start Game!'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ROOM INVITATIONS BAR (Copy Code, Copy Invitation Link, Share Room) */}
        <div className="mt-6 rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-purple-900">
                Invite Friends to Room {room.roomCode}
              </p>
              <p className="text-xs text-slate-600">
                Friends opening your link automatically join{' '}
                <strong>{gameInfo.name}</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-purple-500"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Room Code</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-sky-500"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>Copy Invitation Link</span>
              </button>

              <button
                type="button"
                onClick={handleShareRoom}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-orange-600"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Room</span>
              </button>

              <a
                href={socialLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundEngine.playClick()}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-emerald-500"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={handleInstagramInvite}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-pink-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-pink-500"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Instagram</span>
              </button>
            </div>
          </div>

          {shareFeedback && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>{shareFeedback}</span>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Starting Grid Preview for Calculation Racer */}
      {gameId === 'calculation_racer' && (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Calculation Racer Starting Grid
            </h2>
            <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
              {players.length} / {room.maxPlayers} Racers
            </span>
          </div>
          <RaceTrackCanvas
            maxLanes={room.maxPlayers}
            racers={players.map((p) => ({
              playerId: p.playerId,
              nickname: p.nickname,
              carColor: p.carColor,
              distance: p.distance,
              correctAnswers: p.correctAnswers,
              wrongAnswers: p.wrongAnswers,
              finished: p.finished,
              isCurrentUser: p.playerId === profile.uid,
            }))}
          />
        </div>
      )}
    </div>
  );
};
