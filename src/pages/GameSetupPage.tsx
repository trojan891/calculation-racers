import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  Play,
  PlusCircle,
  User,
  Users,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  GameMode,
  IqRelayField,
  PlayerProfile,
  QuestionCategory,
  QuestionCountOption,
  QuestionDifficulty,
  QuestionTimeOption,
  RoomCapacityOption,
  SUBCATEGORIES_BY_CATEGORY,
  TROJO_GAMES,
  TROJO_GAME_MAP,
  TrojoGameId,
  isInteractivePuzzleGame,
} from '../game/types';
import { soundEngine } from '../lib/sound';
import { GameTileArtwork } from '../components/GameTileArtwork';

function loadSavedUnlockedLevel(gameId: TrojoGameId): number {
  try {
    const raw = localStorage.getItem(`trojo_unlocked_lvl_${gameId}`);
    if (raw) {
      const parsed = Number(raw);
      if (parsed >= 1 && parsed <= 20) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return 1;
}

interface GameSetupPageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  initialViewMode?: 'library' | 'configure';
  initialPlayerMode?: 'solo' | 'multiplayer';
  selectedGameId: TrojoGameId;
  selectedLevel?: number;
  selectedIqFields: IqRelayField[];
  selectedCategory: QuestionCategory;
  selectedSubcategories: string[];
  selectedDifficulty: QuestionDifficulty;
  questionCount: QuestionCountOption;
  questionTimeLimitSec: QuestionTimeOption;
  soundEnabled: boolean;
  onSelectGameId: (gameId: TrojoGameId) => void;
  onSelectLevel?: (level: number) => void;
  onSelectIqFields: (fields: IqRelayField[]) => void;
  onSelectCategory: (cat: QuestionCategory) => void;
  onSelectSubcategories: (subs: string[]) => void;
  onSelectDifficulty: (diff: QuestionDifficulty) => void;
  onSelectQuestionCount: (count: QuestionCountOption) => void;
  onSelectTimeLimit: (sec: QuestionTimeOption) => void;
  onToggleSound: (enabled: boolean) => void;
  onStartSolo: (mode: 'solo' | 'timed', level?: number) => void;
  onCreateRoom: (maxPlayers: RoomCapacityOption, level?: number) => void;
  onOpenJoinRoom: () => void;
  onBackHome: () => void;
  onSignIn: () => void;
}

const PARTICIPANT_OPTIONS: {
  value: RoomCapacityOption;
  label: string;
  badge: string;
}[] = [
  { value: 2, label: '2 Players', badge: '1v1' },
  { value: 3, label: '3 Players', badge: 'Trio' },
  { value: 4, label: '4 Players', badge: 'Quad' },
  { value: 8, label: '4+ Players', badge: 'Up to 8' },
];

export const GameSetupPage: React.FC<GameSetupPageProps> = ({
  initialViewMode = 'library',
  initialPlayerMode = 'solo',
  selectedGameId,
  selectedLevel = 1,
  selectedCategory,
  selectedSubcategories,
  selectedDifficulty,
  questionCount,
  questionTimeLimitSec,
  onSelectGameId,
  onSelectLevel,
  onSelectCategory,
  onSelectSubcategories,
  onSelectDifficulty,
  onSelectQuestionCount,
  onSelectTimeLimit,
  onStartSolo,
  onCreateRoom,
  onOpenJoinRoom,
  onBackHome,
}) => {
  const [stepMode, setStepMode] = useState<'library' | 'configure'>(initialViewMode);
  const [playerMode, setPlayerMode] = useState<'solo' | 'multiplayer'>(
    initialPlayerMode
  );
  const [roomSize, setRoomSize] = useState<RoomCapacityOption>(2);
  const [activeLevel, setActiveLevel] = useState<number>(selectedLevel);
  const [unlockedLevel, setUnlockedLevel] = useState<number>(() =>
    loadSavedUnlockedLevel(selectedGameId)
  );
  const [lockNotice, setLockNotice] = useState<string | null>(null);

  useEffect(() => {
    setStepMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    setPlayerMode(initialPlayerMode);
  }, [initialPlayerMode]);

  useEffect(() => {
    const maxUnlocked = loadSavedUnlockedLevel(selectedGameId);
    setUnlockedLevel(maxUnlocked);
    setLockNotice(null);
    setActiveLevel((prev) => {
      const next = prev > maxUnlocked ? maxUnlocked : prev;
      onSelectLevel?.(next);
      return next;
    });
  }, [selectedGameId, onSelectLevel]);

  const activeGame = TROJO_GAME_MAP[selectedGameId] || TROJO_GAMES[0];
  const isPuzzle = isInteractivePuzzleGame(selectedGameId);
  const availableSubcategories = SUBCATEGORIES_BY_CATEGORY[selectedCategory] || [];

  const handleToggleSubcategory = (sub: string) => {
    soundEngine.playClick();
    if (selectedSubcategories.includes(sub)) {
      if (selectedSubcategories.length > 1) {
        onSelectSubcategories(selectedSubcategories.filter((s) => s !== sub));
      }
    } else {
      onSelectSubcategories([...selectedSubcategories, sub]);
    }
  };

  const handlePickLevel = (lvl: number) => {
    const isLocked = playerMode === 'solo' && lvl > unlockedLevel;
    if (isLocked) {
      soundEngine.playBrakeWrong();
      setLockNotice(`Clear Level ${unlockedLevel} first to unlock Level ${lvl}`);
      return;
    }
    soundEngine.playClick();
    setLockNotice(null);
    setActiveLevel(lvl);
    onSelectLevel?.(lvl);
  };

  // ============================================================================
  // VIEW 1: ICON-FIRST GAME SELECTION GRID
  // ============================================================================
  if (stepMode === 'library') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBackHome();
            }}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Home</span>
          </button>

          <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Select a Game
          </h1>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onOpenJoinRoom();
            }}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-purple-700"
          >
            <KeyRound className="h-4 w-4" />
            <span>Join Room</span>
          </button>
        </div>

        {/* Clean Game Logo Selection Grid */}
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-5 sm:gap-6">
          {TROJO_GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onSelectGameId(game.id);
                setStepMode('configure');
              }}
              className="group flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-xs transition-all duration-200 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            >
              <div className="w-full max-w-[136px] overflow-hidden rounded-[26px] shadow-sm transition-transform duration-200 group-hover:scale-105">
                <GameTileArtwork gameId={game.id} />
              </div>
              <span className="mt-3.5 font-display text-sm font-extrabold text-slate-900 group-hover:text-[#2563EB] sm:text-base">
                {game.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: MODE SELECTION (PLAY SOLO vs MULTIPLAYER) & ROOM PARTICIPANTS
  // ============================================================================
  const selectedParticipantLabel =
    PARTICIPANT_OPTIONS.find((p) => p.value === roomSize)?.label || '2 Players';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Top Navigation & Quick Game Logo Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setStepMode('library');
          }}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>All Games</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onOpenJoinRoom();
          }}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-purple-700"
        >
          <KeyRound className="h-4 w-4" />
          <span>Join Game Room</span>
        </button>
      </div>

      {/* Horizontal Mini Logo Strip */}
      <div className="mt-4 grid grid-cols-5 gap-2.5 sm:gap-3">
        {TROJO_GAMES.map((game) => {
          const isCurrent = game.id === selectedGameId;
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onSelectGameId(game.id);
              }}
              className={`flex flex-col items-center rounded-2xl border p-2 text-center transition-all ${
                isCurrent
                  ? 'border-[#2563EB] bg-blue-50/70 ring-2 ring-[#2563EB]/20'
                  : 'border-slate-200 bg-white opacity-75 hover:opacity-100'
              }`}
            >
              <div className="h-11 w-11 overflow-hidden rounded-xl sm:h-13 sm:w-13">
                <GameTileArtwork gameId={game.id} />
              </div>
              <span className="mt-1.5 max-w-full truncate text-[11px] font-extrabold text-slate-900">
                {game.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Setup Card */}
      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
        {/* Selected Game Header */}
        <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl shadow-sm sm:h-20 sm:w-20">
            <GameTileArtwork gameId={activeGame.id} />
          </div>
          <div>
            <h1 className="font-display text-xl font-black text-slate-900 sm:text-2xl">
              {activeGame.name}
            </h1>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              {playerMode === 'solo'
                ? 'Play Solo'
                : `Multiplayer · ${selectedParticipantLabel}`}
            </p>
          </div>
        </div>

        {/* STEP 1: CHOOSE MODE (Play Solo vs Multiplayer) */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setPlayerMode('solo');
              if (activeLevel > unlockedLevel) {
                setActiveLevel(unlockedLevel);
                onSelectLevel?.(unlockedLevel);
              }
            }}
            className={`flex min-h-[54px] items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 font-display text-sm font-black transition-all sm:text-base ${
              playerMode === 'solo'
                ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Play Solo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setPlayerMode('multiplayer');
              setLockNotice(null);
            }}
            className={`flex min-h-[54px] items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 font-display text-sm font-black transition-all sm:text-base ${
              playerMode === 'multiplayer'
                ? 'border-[#16A34A] bg-[#16A34A] text-white shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Multiplayer</span>
          </button>
        </div>

        {/* STEP 2A: MULTIPLAYER PARTICIPANT COUNT SELECTOR (2, 3, 4, 4+) */}
        {playerMode === 'multiplayer' && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                Participants
              </span>
              <span className="font-mono text-xs font-bold text-[#16A34A]">
                {activeGame.name} · {selectedParticipantLabel}
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {PARTICIPANT_OPTIONS.map((opt) => {
                const selected = roomSize === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setRoomSize(opt.value);
                    }}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 px-3 py-3 text-center transition-all ${
                      selected
                        ? 'border-[#16A34A] bg-emerald-50 text-emerald-950 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span className="font-display text-base font-black">
                      {opt.value === 8 ? '4+' : opt.value}
                    </span>
                    <span className="mt-0.5 text-xs font-extrabold">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 text-[10px] font-semibold text-slate-500">
                      {opt.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2B: GAME-SPECIFIC OPTIONS (Visual Tiles — Zero Dropdowns) */}
        {isPuzzle ? (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                {playerMode === 'solo'
                  ? `Select Level (Unlocked: 1–${unlockedLevel})`
                  : 'Select Room Level (1–20)'}
              </span>
              <span className="font-mono text-xs font-black text-[#2563EB]">
                Level {activeLevel}
              </span>
            </div>

            {lockNotice && (
              <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
                {lockNotice}
              </div>
            )}

            <div className="mt-2.5 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => {
                const isLocked = playerMode === 'solo' && lvl > unlockedLevel;
                const isSelected = activeLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handlePickLevel(lvl)}
                    className={`flex h-11 flex-col items-center justify-center rounded-xl border-2 font-mono text-xs font-black transition-all ${
                      isSelected
                        ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-2xs'
                        : isLocked
                          ? 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400 opacity-60'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-300 hover:bg-white'
                    }`}
                  >
                    <span>{lvl}</span>
                    {isLocked && <Lock className="h-2.5 w-2.5 text-slate-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {/* Subject Selection Tiles */}
            <div>
              <span className="block text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                Category
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['math', 'gk', 'science', 'current_affairs'] as QuestionCategory[]).map(
                  (cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onSelectCategory(cat);
                        }}
                        className={`min-h-[42px] rounded-xl border-2 px-3 py-2 text-xs font-extrabold transition-all ${
                          active
                            ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                        }`}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Topic Chips */}
            <div>
              <span className="block text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                Topics
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {availableSubcategories.map((sub) => {
                  const active = selectedSubcategories.includes(sub);
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => handleToggleSubcategory(sub)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                        active
                          ? 'border-[#2563EB] bg-[#2563EB] text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                      }`}
                    >
                      {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>{sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty, Rounds & Timer Segmented Tiles */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <span className="block text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                  Difficulty
                </span>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {(['easy', 'medium', 'hard'] as QuestionDifficulty[]).map((diff) => {
                    const active = selectedDifficulty === diff;
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onSelectDifficulty(diff);
                        }}
                        className={`min-h-[38px] rounded-xl border px-2 py-1.5 text-xs font-extrabold transition-all ${
                          active
                            ? 'border-[#2563EB] bg-[#2563EB] text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {DIFFICULTY_LABELS[diff]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="block text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                  Questions
                </span>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {([10, 15, 20] as QuestionCountOption[]).map((cnt) => {
                    const active = questionCount === cnt;
                    return (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onSelectQuestionCount(cnt);
                        }}
                        className={`min-h-[38px] rounded-xl border font-mono text-xs font-extrabold transition-all ${
                          active
                            ? 'border-[#2563EB] bg-[#2563EB] text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {cnt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="block text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                  Timer
                </span>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {([10, 15, 20, 30] as QuestionTimeOption[]).map((sec) => {
                    const active = questionTimeLimitSec === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onSelectTimeLimit(sec);
                        }}
                        className={`min-h-[38px] rounded-xl border font-mono text-xs font-extrabold transition-all ${
                          active
                            ? 'border-[#2563EB] bg-[#2563EB] text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {sec}s
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRIMARY LAUNCH ACTION */}
        <div className="mt-7 pt-2">
          {playerMode === 'solo' ? (
            <button
              type="button"
              onClick={() => {
                const safeLvl = Math.min(unlockedLevel, Math.max(1, activeLevel));
                soundEngine.playClick();
                onStartSolo('solo', safeLvl);
              }}
              className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#2563EB] px-6 py-3.5 font-display text-base font-black text-white shadow-sm transition-all hover:bg-blue-700"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>
                Play Solo {isPuzzle ? `· Level ${Math.min(unlockedLevel, activeLevel)}` : ''}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onCreateRoom(roomSize, activeLevel);
              }}
              className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#16A34A] px-6 py-3.5 font-display text-base font-black text-white shadow-sm transition-all hover:bg-emerald-700"
            >
              <PlusCircle className="h-5 w-5" />
              <span>
                Create Game Room ({selectedParticipantLabel})
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
