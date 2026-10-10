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
  Flag,
  Link2,
  MessageCircle,
  Play,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  Users,
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
} from '../game/types';
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

  // Subscribe to Room document
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

  // Handle synchronized countdown & transition to racing
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
  const canHostStart =
    isHost &&
    players.length >= 2 &&
    readyPlayersCount >= 2 &&
    players.every((p) => p.ready) &&
    room?.status === 'waiting';

  const showToast = (msg: string) => {
    setShareFeedback(msg);
    setTimeout(() => setShareFeedback(null), 2800);
  };

  const totalQ = room ? room.questionCount || room.questionIds.length || 10 : 10;
  const joinUrl = getRoomInviteUrl(roomCode);
  const inviteText = room
    ? buildRoomInviteText({
        roomCode: room.roomCode,
        hostNickname: room.hostNickname,
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
    showToast('Copied direct room join link!');
  };

  const handleInstagramShare = async () => {
    soundEngine.playClick();
    await copyToClipboard(inviteText);
    showToast('Copied room invite message & link for Instagram DM / Story!');
  };

  const handleNativeShare = async () => {
    soundEngine.playClick();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Join my Calculation Racer Room (${roomCode})`,
          text: inviteText,
          url: joinUrl,
        });
        return;
      } catch {
        // Fallback if user cancels or share fails
      }
    }
    await copyToClipboard(inviteText);
    showToast('Copied full room invite message & join link!');
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

  if (!room) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="font-medium text-slate-600">Loading multiplayer room...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Countdown Overlay */}
      {room.status === 'countdown' && countdownSec !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md">
          <span className="rounded-xl bg-sky-100 px-4 py-1.5 text-xs font-bold tracking-wider text-sky-700 uppercase">
            Engines Ignited · Get Ready
          </span>
          <div className="mt-6 font-display text-8xl font-extrabold tracking-tight text-slate-900 tabular-nums">
            {countdownSec > 0 ? countdownSec : 'GO!'}
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-600">
            {totalQ} Questions · +10m Correct · -5m Wrong · First to 100m Wins
          </p>
        </div>
      )}

      {/* Room Header & Invite Sharing Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
              <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-purple-800">
                {room.maxPlayers}-Player Room
              </span>
              <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-sky-800">
                {CATEGORY_LABELS[room.category]}
              </span>
              <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-emerald-800">
                {DIFFICULTY_LABELS[room.difficulty]}
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-slate-700 tabular-nums">
                {totalQ} Qs · {room.questionTimeLimitSec}s Timer
              </span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-extrabold text-slate-900">
              Room Code:{' '}
              <span className="font-mono tracking-wider text-purple-700">
                {room.roomCode}
              </span>
            </h1>
            {room.subcategories && room.subcategories.length > 0 && (
              <p className="mt-1 text-xs font-medium text-slate-500">
                Topics: {room.subcategories.join(', ')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-purple-200 bg-purple-50 px-4 py-2.5 text-xs font-extrabold text-purple-800 transition-colors hover:border-purple-400 hover:bg-purple-100"
            >
              <Copy className="h-4 w-4 text-purple-600" />
              <span>Copy Code ({room.roomCode})</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-extrabold text-sky-800 transition-colors hover:bg-sky-100"
            >
              <Link2 className="h-4 w-4 text-sky-600" />
              <span>Copy Join Link</span>
            </button>

            <button
              type="button"
              onClick={onLeaveRoom}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Leave Lobby
            </button>
          </div>
        </div>

        {/* Social Invite Share Bar */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-slate-500 uppercase">
              <Share2 className="h-3.5 w-3.5 text-purple-600" />
              <span>Invite Friends to Join</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={socialLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundEngine.playClick()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-emerald-500"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>

              <a
                href={socialLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundEngine.playClick()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-sky-400"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Telegram</span>
              </a>

              <button
                type="button"
                onClick={handleInstagramShare}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-rose-500"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Instagram</span>
              </button>

              <a
                href={socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundEngine.playClick()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-blue-500"
              >
                <span>Facebook</span>
              </a>

              <a
                href={socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundEngine.playClick()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-slate-800"
              >
                <span>X / Twitter</span>
              </a>

              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-extrabold text-slate-700 transition-colors hover:bg-slate-100"
              >
                <Share2 className="h-3.5 w-3.5 text-purple-600" />
                <span>Share</span>
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
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Live Preview of Starting Grid */}
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Starting Grid Preview</h2>
          <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
            {players.length} / {room.maxPlayers} Racers Joined · {readyPlayersCount} Ready
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

      {/* Player Slots & Car Tuning */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Racers in Lobby ({players.length}/{room.maxPlayers})
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Share code{' '}
            <strong className="font-mono text-purple-700">{room.roomCode}</strong> with
            friends. At least 2 ready players are required to start the race.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: room.maxPlayers }).map((_, idx) => {
              const slotPlayer = players[idx];
              if (!slotPlayer) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="flex h-24 flex-col justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-5"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                      <Users className="h-4 w-4" />
                      <span>Lane {idx + 1} · Open Slot</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Waiting for player to join with code {room.roomCode}
                    </p>
                  </div>
                );
              }

              const carInfo = CAR_PALETTE[slotPlayer.carColor] || CAR_PALETTE.blue;
              const isSlotHost = slotPlayer.playerId === room.hostId;
              const isMe = slotPlayer.playerId === profile.uid;

              return (
                <div
                  key={slotPlayer.playerId}
                  className={`flex h-24 flex-col justify-between rounded-2xl border-2 p-4 ${
                    isMe
                      ? 'border-sky-300 bg-sky-50/60'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="inline-block h-3.5 w-3.5 shrink-0 rounded-md"
                        style={{ backgroundColor: carInfo.primary }}
                      />
                      <span className="truncate font-bold text-slate-900">
                        {slotPlayer.nickname}
                      </span>
                      {isMe && (
                        <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-700">
                          You
                        </span>
                      )}
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-0.5 text-xs font-bold ${
                        slotPlayer.ready
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {slotPlayer.ready ? 'Ready' : 'Not Ready'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <span>Lane {idx + 1}</span>
                    <span aria-hidden="true">·</span>
                    <span>{carInfo.label}</span>
                    {isSlotHost && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-purple-700">Host</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Car Color & Ready Controls */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Your Car & Ready Status
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Pick your car color and mark yourself Ready.
          </p>

          <div className="mt-5">
            <label className="block text-xs font-bold text-slate-700">
              Choose Car Color
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {(['blue', 'red', 'green', 'purple'] as CarColor[]).map((c) => {
                const info = CAR_PALETTE[c];
                const active = myPlayer?.carColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleSelectCarColor(c)}
                    className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all ${
                      active
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

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              disabled={busy}
              onClick={handleToggleReady}
              className={`w-full rounded-2xl px-4 py-3.5 text-sm font-bold transition-all ${
                myPlayer?.ready
                  ? 'border-2 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-sky-600 text-white shadow-xs hover:bg-sky-500'
              }`}
            >
              {myPlayer?.ready ? '✓ You Are Ready (Click to Change)' : 'Mark as Ready'}
            </button>

            {isHost ? (
              <button
                type="button"
                disabled={!canHostStart || busy}
                onClick={handleLaunchCountdown}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-xs transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>
                  {players.length < 2
                    ? 'Waiting for 2+ Players'
                    : !players.every((p) => p.ready)
                      ? 'Waiting for All Players Ready'
                      : 'Start Synchronized Race'}
                </span>
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-xs font-semibold text-slate-600">
                <Flag className="h-4 w-4 text-purple-600" />
                <span>Waiting for host ({room.hostNickname}) to start</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
