import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock,
  Gamepad2,
  Hash,
  KeyRound,
  Layers,
  Lock,
  Play,
  Sparkles,
  Star,
  Users,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  IqRelayField,
  isInteractivePuzzleGame,
  PlayerProfile,
  QuestionCategory,
  QuestionCountOption,
  QuestionDifficulty,
  QuestionItem,
  QuestionTimeOption,
  SUBCATEGORIES_BY_CATEGORY,
  TROJO_GAME_MAP,
  TROJO_GAMES,
  TrojoGameId,
} from '../game/types';
import {
  fetchActiveQuestions,
  generateFreshAiQuestionsForSection,
} from '../lib/gameService';
import { countAvailableQuestions, SEED_QUESTIONS } from '../lib/seedQuestions';
import { soundEngine } from '../lib/sound';
import { GameTileArtwork } from '../components/GameTileArtwork';

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
  questionTimeLimitSec: number;
  soundEnabled: boolean;
  onSelectGameId: (gameId: TrojoGameId) => void;
  onSelectLevel?: (level: number) => void;
  onSelectIqFields: (fields: IqRelayField[]) => void;
  onSelectCategory: (cat: QuestionCategory) => void;
  onSelectSubcategories: (subs: string[]) => void;
  onSelectDifficulty: (diff: QuestionDifficulty) => void;
  onSelectQuestionCount: (count: QuestionCountOption) => void;
  onSelectTimeLimit: (sec: number) => void;
  onToggleSound: (enabled: boolean) => void;
  onStartSolo: (mode: 'solo' | 'timed', level?: number) => Promise<void>;
  onCreateRoom: (maxPlayers: 2 | 4, level?: number) => Promise<void>;
  onOpenJoinRoom: () => void;
  onBackHome: () => void;
  onSignIn: () => void;
}

const QUESTION_COUNT_OPTIONS: QuestionCountOption[] = [10, 15, 20];
const QUESTION_TIME_OPTIONS: QuestionTimeOption[] = [10, 15, 20, 30];

function loadSavedUnlockedLevel(gameId: TrojoGameId): number {
  try {
    const raw = localStorage.getItem(`trojo_unlocked_lvl_${gameId}`);
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 20) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return 1;
}

export const GameSetupPage: React.FC<GameSetupPageProps> = ({
  isGuest,
  initialViewMode = 'library',
  initialPlayerMode = 'solo',
  selectedGameId,
  selectedLevel = 1,
  selectedCategory,
  selectedSubcategories,
  selectedDifficulty,
  questionCount,
  questionTimeLimitSec,
  soundEnabled = soundEngine.isEnabled(),
  onSelectGameId,
  onSelectLevel,
  onSelectCategory,
  onSelectSubcategories,
  onSelectDifficulty,
  onSelectQuestionCount,
  onSelectTimeLimit,
  onToggleSound = (val: boolean) => {
    soundEngine.setEnabled(val);
  },
  onStartSolo,
  onCreateRoom,
  onOpenJoinRoom,
  onBackHome,
  onSignIn,
}) => {
  const [stepMode, setStepMode] = useState<'library' | 'configure'>(
    initialViewMode
  );
  const [playerMode, setPlayerMode] = useState<'solo' | 'multiplayer'>(
    initialPlayerMode
  );
  const [multiplayerSize, setMultiplayerSize] = useState<2 | 4>(2);
  const [puzzleLevel, setPuzzleLevel] = useState<number>(selectedLevel);
  const [questionPool, setQuestionPool] = useState<QuestionItem[]>(SEED_QUESTIONS);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setStepMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    setPlayerMode(initialPlayerMode);
  }, [initialPlayerMode]);

  useEffect(() => {
    setPuzzleLevel(selectedLevel);
  }, [selectedLevel]);

  useEffect(() => {
    fetchActiveQuestions()
      .then((q) => setQuestionPool(q))
      .catch(() => {});
  }, []);

  const activeGame = TROJO_GAME_MAP[selectedGameId] || TROJO_GAMES[0];
  const isPuzzleGame = isInteractivePuzzleGame(selectedGameId);
  const unlockedLevel = useMemo(
    () => loadSavedUnlockedLevel(selectedGameId),
    [selectedGameId]
  );

  useEffect(() => {
    if (playerMode === 'solo' && puzzleLevel > unlockedLevel) {
      setPuzzleLevel(unlockedLevel);
      if (onSelectLevel) {
        onSelectLevel(unlockedLevel);
      }
    }
  }, [playerMode, puzzleLevel, unlockedLevel, onSelectLevel]);

  const handleSelectPuzzleLevel = (lvl: number) => {
    if (playerMode === 'solo' && lvl > unlockedLevel) {
      soundEngine.playBrakeWrong();
      setErrorMsg(
        `Level ${lvl} is locked! Complete Level ${unlockedLevel} first to unlock it.`
      );
      return;
    }
    setErrorMsg(null);
    soundEngine.playClick();
    setPuzzleLevel(lvl);
    if (onSelectLevel) {
      onSelectLevel(lvl);
    }
  };

  const availableSubcategories = useMemo(() => {
    const list = SUBCATEGORIES_BY_CATEGORY[selectedCategory] || [];
    if (selectedCategory === 'math' && selectedDifficulty === 'easy') {
      return list.filter((item) => item !== 'Mixed Operations');
    }
    return list;
  }, [selectedCategory, selectedDifficulty]);

  const currentSubcategoryValue = useMemo(() => {
    if (selectedSubcategories.length === 0) {
      return 'ALL';
    }
    const first = selectedSubcategories[0];
    if (availableSubcategories.includes(first)) {
      return first;
    }
    return 'ALL';
  }, [selectedSubcategories, availableSubcategories]);

  useEffect(() => {
    if (
      selectedSubcategories.length > 0 &&
      !availableSubcategories.includes(selectedSubcategories[0])
    ) {
      onSelectSubcategories([]);
    }
  }, [availableSubcategories, selectedSubcategories, onSelectSubcategories]);

  const handleCategoryChange = (cat: QuestionCategory) => {
    soundEngine.playClick();
    onSelectCategory(cat);
    onSelectSubcategories([]);
    setErrorMsg(null);
    setAiSuccessMsg(null);
  };

  const handleDifficultyChange = (diff: QuestionDifficulty) => {
    soundEngine.playClick();
    onSelectDifficulty(diff);
    if (
      selectedCategory === 'math' &&
      diff === 'easy' &&
      selectedSubcategories.includes('Mixed Operations')
    ) {
      onSelectSubcategories([]);
    }
    setErrorMsg(null);
    setAiSuccessMsg(null);
  };

  const handleSubcategoryDropdownChange = (val: string) => {
    soundEngine.playClick();
    if (val === 'ALL') {
      onSelectSubcategories([]);
    } else {
      onSelectSubcategories([val]);
    }
    setErrorMsg(null);
    setAiSuccessMsg(null);
  };

  const availableQuestionCount = useMemo(() => {
    if (selectedGameId !== 'calculation_racer') {
      return 30;
    }
    return countAvailableQuestions(
      questionPool,
      selectedCategory,
      selectedDifficulty,
      selectedSubcategories
    );
  }, [
    selectedGameId,
    questionPool,
    selectedCategory,
    selectedDifficulty,
    selectedSubcategories,
  ]);

  const handleGenerateAiQuestions = async () => {
    soundEngine.playClick();
    setAiBusy(true);
    setErrorMsg(null);
    setAiSuccessMsg(null);
    try {
      const added = await generateFreshAiQuestionsForSection(
        selectedCategory,
        selectedDifficulty,
        currentSubcategoryValue,
        8
      );
      const refreshed = await fetchActiveQuestions();
      setQuestionPool(refreshed);
      setAiSuccessMsg(
        `Added ${added.length} fresh AI-generated ${CATEGORY_LABELS[selectedCategory]} (${DIFFICULTY_LABELS[selectedDifficulty]}) questions!`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not generate AI questions right now. Built-in question bank is ready!'
      );
    } finally {
      setAiBusy(false);
    }
  };

  const handleStartSinglePlayer = async () => {
    soundEngine.playClick();
    setErrorMsg(null);

    if (
      selectedGameId === 'calculation_racer' &&
      availableQuestionCount < questionCount
    ) {
      setErrorMsg(
        `Not enough questions available (${availableQuestionCount} found, ${questionCount} required). Click "Add Fresh AI Questions" or select All Topics.`
      );
      return;
    }

    setBusy(true);
    try {
      await onStartSolo('solo', puzzleLevel);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to start game. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateMultiplayer = async () => {
    soundEngine.playClick();
    setErrorMsg(null);

    if (isGuest) {
      setErrorMsg(
        'Please Create a Gaming Profile (Sign In) to host a live multiplayer room.'
      );
      return;
    }

    setBusy(true);
    try {
      await onCreateRoom(multiplayerSize, puzzleLevel);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not create multiplayer room.'
      );
    } finally {
      setBusy(false);
    }
  };

  const allTopicsLabel =
    selectedCategory === 'math'
      ? selectedDifficulty === 'easy'
        ? 'All Basic Operations (+, −, ×, ÷)'
        : 'Mixed Operations (All Types)'
      : selectedCategory === 'science'
        ? 'All Science Topics'
        : selectedCategory === 'gk'
          ? 'All General Knowledge Topics'
          : 'All Verified Current Affairs';

  // ============================================================================
  // VIEW 1: DEDICATED "PLAY GAMES" LIBRARY (ROUNDED SQUARE ICON LIST)
  // ============================================================================
  if (stepMode === 'library') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Top Bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBackHome();
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setPlayerMode('multiplayer');
                setStepMode('configure');
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-emerald-700"
            >
              <Users className="h-4 w-4" />
              <span>Create Game Room</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenJoinRoom();
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-purple-700"
            >
              <KeyRound className="h-4 w-4" />
              <span>Join Game Room</span>
            </button>
          </div>
        </div>

        {/* Library Header & Visual Tile Grid */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold text-sky-800">
                <Gamepad2 className="h-3.5 w-3.5 text-sky-700" />
                <span>TROJO — A Fun Nagar Game Library</span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Choose a Puzzle or Race Game
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Each game features unique interactive mechanics, 20 progressive levels, and real-time 2P/4P multiplayer!
              </p>
            </div>
          </div>

          {/* 5 Games Arranged in Clean Visual Tile Cards */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TROJO_GAMES.map((game) => {
              const savedLvl = loadSavedUnlockedLevel(game.id);
              return (
                <div
                  key={game.id}
                  className="group flex flex-col justify-between rounded-3xl border-2 border-slate-200/90 bg-slate-50/50 p-5 transition-all hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-md"
                >
                  <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onSelectGameId(game.id);
                        setPlayerMode('solo');
                        setStepMode('configure');
                      }}
                      className="shrink-0 focus:outline-none"
                    >
                      <GameTileArtwork
                        gameId={game.id}
                        className="h-28 w-28 sm:h-32 sm:w-32 transition-transform duration-200 group-hover:scale-105"
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                        <span className="inline-block rounded-lg bg-blue-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
                          {game.badgeText}
                        </span>
                        {game.isInteractivePuzzle && (
                          <span className="inline-block rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                            ★ Lv.{savedLvl}/20
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1.5 font-display text-xl font-extrabold text-slate-900">
                        {game.name}
                      </h2>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {game.tagline}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {game.shortDescription}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-slate-200/70 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onSelectGameId(game.id);
                        setPlayerMode('solo');
                        setStepMode('configure');
                      }}
                      className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-2.5 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>
                        {game.isInteractivePuzzle
                          ? 'Play Levels (1–20)'
                          : 'Play Solo Race'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onSelectGameId(game.id);
                        setPlayerMode('multiplayer');
                        setStepMode('configure');
                      }}
                      className="inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl bg-[#16A34A] px-4 py-2.5 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-emerald-700"
                    >
                      <Users className="h-4 w-4" />
                      <span>Multiplayer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: SINGLE-PLAYER SETUP SCREEN
  // ============================================================================
  if (playerMode === 'solo') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
        {/* Top Compact Navigation Bar */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setStepMode('library');
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>All Games (Library)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setPlayerMode('multiplayer');
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#16A34A] px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-emerald-700"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Switch to Multiplayer Room</span>
          </button>
        </div>

        {/* Single-Player Setup Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3.5">
              <GameTileArtwork
                gameId={selectedGameId}
                className="h-16 w-16 shrink-0"
              />
              <div>
                <span className="inline-block rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-800">
                  {activeGame.badgeText}
                </span>
                <h1 className="mt-0.5 font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                  {activeGame.name}
                </h1>
                <p className="text-xs text-slate-500">{activeGame.tagline}</p>
              </div>
            </div>

            {selectedGameId === 'calculation_racer' && (
              <button
                type="button"
                disabled={aiBusy}
                onClick={handleGenerateAiQuestions}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-extrabold text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                <span>
                  {aiBusy ? 'Generating AI Questions...' : 'Add Fresh AI Questions'}
                </span>
              </button>
            )}
          </div>

          {/* INTERACTIVE PUZZLE LEVEL SELECTOR (Levels 1 to 20) */}
          {isPuzzleGame ? (
            <div className="space-y-5">
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-extrabold tracking-wider text-slate-700 uppercase">
                    Select Puzzle Level (1 – 20)
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    Unlocked up to Level {unlockedLevel}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => {
                    const isSelected = puzzleLevel === lvl;
                    const isUnlocked = lvl <= unlockedLevel;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => handleSelectPuzzleLevel(lvl)}
                        title={
                          isUnlocked
                            ? `Play Level ${lvl}`
                            : `Locked — Complete Level ${unlockedLevel} first`
                        }
                        className={`flex flex-col items-center justify-center rounded-2xl border-2 py-2 transition-all ${
                          isSelected && isUnlocked
                            ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm scale-105'
                            : isUnlocked
                              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 hover:border-emerald-400'
                              : 'cursor-not-allowed border-slate-200 bg-slate-100/80 text-slate-400 opacity-65'
                        }`}
                      >
                        <span className="font-mono text-xs font-black">{lvl}</span>
                        {isUnlocked ? (
                          <Star
                            className={`h-3 w-3 ${
                              isSelected
                                ? 'fill-amber-300 text-amber-300'
                                : 'fill-amber-400 text-amber-400'
                            }`}
                          />
                        ) : (
                          <Lock className="h-3 w-3 opacity-60" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="puzzle-difficulty-select"
                    className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>Difficulty Bonus</span>
                  </label>
                  <div className="relative">
                    <select
                      id="puzzle-difficulty-select"
                      value={selectedDifficulty}
                      onChange={(e) =>
                        handleDifficultyChange(e.target.value as QuestionDifficulty)
                      }
                      className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                    >
                      <option value="easy">Easy (Standard Relaxed)</option>
                      <option value="medium">Medium (+25% Score Bonus)</option>
                      <option value="hard">Hard (+50% Score Bonus)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="puzzle-sound-select"
                    className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-sky-600" />
                    <span>Sound Effects</span>
                  </label>
                  <div className="relative">
                    <select
                      id="puzzle-sound-select"
                      value={soundEnabled ? 'on' : 'off'}
                      onChange={(e) => {
                        const nextVal = e.target.value === 'on';
                        onToggleSound(nextVal);
                        if (nextVal) soundEngine.playClick();
                      }}
                      className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                    >
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* CALCULATION RACER DROPDOWNS GRID */
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {/* 1. Game Category */}
              <div>
                <label
                  htmlFor="solo-category-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                >
                  <Calculator className="h-3.5 w-3.5 text-sky-600" />
                  <span>1. Game Category</span>
                </label>
                <div className="relative">
                  <select
                    id="solo-category-select"
                    value={selectedCategory}
                    onChange={(e) =>
                      handleCategoryChange(e.target.value as QuestionCategory)
                    }
                    className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                  >
                    <option value="math">Mathematics</option>
                    <option value="gk">General Knowledge</option>
                    <option value="science">Science</option>
                    <option value="current_affairs">Current Affairs</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* 2. Difficulty */}
              <div>
                <label
                  htmlFor="solo-difficulty-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span>Difficulty</span>
                </label>
                <div className="relative">
                  <select
                    id="solo-difficulty-select"
                    value={selectedDifficulty}
                    onChange={(e) =>
                      handleDifficultyChange(e.target.value as QuestionDifficulty)
                    }
                    className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* 3. Question Selection */}
              <div>
                <label
                  htmlFor="solo-subcategory-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                >
                  <Layers className="h-3.5 w-3.5 text-purple-600" />
                  <span>
                    Question Selection ({CATEGORY_LABELS[selectedCategory]})
                  </span>
                </label>
                <div className="relative">
                  <select
                    id="solo-subcategory-select"
                    value={currentSubcategoryValue}
                    onChange={(e) => handleSubcategoryDropdownChange(e.target.value)}
                    className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                  >
                    <option value="ALL">{allTopicsLabel}</option>
                    {availableSubcategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* 4. Number of Questions */}
              <div>
                <label
                  htmlFor="solo-count-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                >
                  <Hash className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Number of Questions</span>
                </label>
                <div className="relative">
                  <select
                    id="solo-count-select"
                    value={questionCount}
                    onChange={(e) => {
                      soundEngine.playClick();
                      onSelectQuestionCount(
                        Number(e.target.value) as QuestionCountOption
                      );
                    }}
                    className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                  >
                    {QUESTION_COUNT_OPTIONS.map((cnt) => (
                      <option key={cnt} value={cnt}>
                        {cnt} Questions
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* 5. Time per Question */}
              <div>
                <label
                  htmlFor="solo-timer-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                >
                  <Clock className="h-3.5 w-3.5 text-rose-500" />
                  <span>Time per Question</span>
                </label>
                <div className="relative">
                  <select
                    id="solo-timer-select"
                    value={questionTimeLimitSec}
                    onChange={(e) => {
                      soundEngine.playClick();
                      onSelectTimeLimit(Number(e.target.value));
                    }}
                    className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                  >
                    {QUESTION_TIME_OPTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec} seconds per question
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* 6. Sound Effects */}
              <div>
                <label
                  htmlFor="solo-sound-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                >
                  <Volume2 className="h-3.5 w-3.5 text-sky-600" />
                  <span>Sound Effects</span>
                </label>
                <div className="relative">
                  <select
                    id="solo-sound-select"
                    value={soundEnabled ? 'on' : 'off'}
                    onChange={(e) => {
                      const nextVal = e.target.value === 'on';
                      onToggleSound(nextVal);
                      if (nextVal) soundEngine.playClick();
                    }}
                    className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            </div>
          )}

          {aiSuccessMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{aiSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
              {errorMsg}
            </div>
          )}

          {/* Prominent Full-Color Start Game Button */}
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-700">
                {DIFFICULTY_LABELS[selectedDifficulty]}
              </span>
              {isPuzzleGame ? (
                <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono font-bold text-blue-800">
                  Level {puzzleLevel} of 20
                </span>
              ) : (
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono font-bold text-slate-700">
                  {questionCount} Qs · {questionTimeLimitSec}s
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleStartSinglePlayer}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] px-7 py-3.5 font-display text-base font-extrabold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>
                {busy
                  ? 'Starting...'
                  : isPuzzleGame
                    ? `Play Level ${puzzleLevel}`
                    : 'Start Race'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: MULTIPLAYER ROOM CREATION SCREEN (Shared Room System Across All 5 Games)
  // ============================================================================
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
      {/* Top Action Bar */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setStepMode('library');
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
          <span>Back to Game Library</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onOpenJoinRoom();
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-purple-700"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Have a Room Code? Join Room</span>
        </button>
      </div>

      {/* Host Multiplayer Room Card */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3.5">
            <GameTileArtwork
              gameId={selectedGameId}
              className="h-14 w-14 shrink-0"
            />
            <div>
              <h1 className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                Create Multiplayer Room
              </h1>
              <p className="text-xs text-slate-500">
                Host a live 2P or 4P room — all players compete on the exact same board or race!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
            {([2, 4] as (2 | 4)[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setMultiplayerSize(size);
                }}
                className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                  multiplayerSize === size
                    ? 'bg-[#16A34A] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {size} Players
              </button>
            ))}
          </div>
        </div>

        {/* Select Which of the 5 TROJO Games to Host */}
        <div className="mb-4">
          <label
            htmlFor="multi-game-select"
            className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
          >
            <Gamepad2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Select Game for This Room</span>
          </label>
          <div className="relative">
            <select
              id="multi-game-select"
              value={selectedGameId}
              onChange={(e) => {
                soundEngine.playClick();
                onSelectGameId(e.target.value as TrojoGameId);
                setErrorMsg(null);
              }}
              className="min-h-[46px] w-full appearance-none rounded-xl border-2 border-emerald-200 bg-emerald-50/50 px-3.5 py-2.5 pr-9 text-sm font-extrabold text-slate-900 transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none"
            >
              {TROJO_GAMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.name} — {g.tagline}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        {/* Puzzle Level Selector for Multiplayer Puzzle Rooms */}
        {isPuzzleGame ? (
          <div className="mb-4 space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-extrabold tracking-wider text-slate-600 uppercase">
                Select Shared Puzzle Level (1 – 20)
              </label>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleSelectPuzzleLevel(lvl)}
                    className={`rounded-xl border py-2 font-mono text-xs font-black transition-all ${
                      puzzleLevel === lvl
                        ? 'border-[#16A34A] bg-[#16A34A] text-white shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Lv.{lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="multi-puzzle-diff"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span>Difficulty</span>
                </label>
                <div className="relative">
                  <select
                    id="multi-puzzle-diff"
                    value={selectedDifficulty}
                    onChange={(e) =>
                      handleDifficultyChange(e.target.value as QuestionDifficulty)
                    }
                    className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="multi-puzzle-sound"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
                >
                  <Volume2 className="h-3.5 w-3.5 text-sky-600" />
                  <span>Sound Effects</span>
                </label>
                <div className="relative">
                  <select
                    id="multi-puzzle-sound"
                    value={soundEnabled ? 'on' : 'off'}
                    onChange={(e) => {
                      const nextVal = e.target.value === 'on';
                      onToggleSound(nextVal);
                      if (nextVal) soundEngine.playClick();
                    }}
                    className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900"
                  >
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Room Settings Dropdowns Grid for Calculation Racer */
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="multi-category-select"
                className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
              >
                <Calculator className="h-3.5 w-3.5 text-purple-600" />
                <span>Category</span>
              </label>
              <div className="relative">
                <select
                  id="multi-category-select"
                  value={selectedCategory}
                  onChange={(e) =>
                    handleCategoryChange(e.target.value as QuestionCategory)
                  }
                  className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                >
                  <option value="math">Mathematics</option>
                  <option value="gk">General Knowledge</option>
                  <option value="science">Science</option>
                  <option value="current_affairs">Current Affairs</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div>
              <label
                htmlFor="multi-difficulty-select"
                className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Difficulty</span>
              </label>
              <div className="relative">
                <select
                  id="multi-difficulty-select"
                  value={selectedDifficulty}
                  onChange={(e) =>
                    handleDifficultyChange(e.target.value as QuestionDifficulty)
                  }
                  className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div>
              <label
                htmlFor="multi-subcategory-select"
                className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
              >
                <Layers className="h-3.5 w-3.5 text-purple-600" />
                <span>Topic ({CATEGORY_LABELS[selectedCategory]})</span>
              </label>
              <div className="relative">
                <select
                  id="multi-subcategory-select"
                  value={currentSubcategoryValue}
                  onChange={(e) => handleSubcategoryDropdownChange(e.target.value)}
                  className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                >
                  <option value="ALL">{allTopicsLabel}</option>
                  {availableSubcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div>
              <label
                htmlFor="multi-count-select"
                className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
              >
                <Hash className="h-3.5 w-3.5 text-emerald-600" />
                <span>Questions</span>
              </label>
              <div className="relative">
                <select
                  id="multi-count-select"
                  value={questionCount}
                  onChange={(e) => {
                    soundEngine.playClick();
                    onSelectQuestionCount(
                      Number(e.target.value) as QuestionCountOption
                    );
                  }}
                  className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                >
                  {QUESTION_COUNT_OPTIONS.map((cnt) => (
                    <option key={cnt} value={cnt}>
                      {cnt} Questions
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div>
              <label
                htmlFor="multi-timer-select"
                className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
              >
                <Clock className="h-3.5 w-3.5 text-rose-500" />
                <span>Time per Question</span>
              </label>
              <div className="relative">
                <select
                  id="multi-timer-select"
                  value={questionTimeLimitSec}
                  onChange={(e) => {
                    soundEngine.playClick();
                    onSelectTimeLimit(Number(e.target.value));
                  }}
                  className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                >
                  {QUESTION_TIME_OPTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec} seconds
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div>
              <label
                htmlFor="multi-sound-select"
                className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
              >
                <Volume2 className="h-3.5 w-3.5 text-sky-600" />
                <span>Sound Effects</span>
              </label>
              <div className="relative">
                <select
                  id="multi-sound-select"
                  value={soundEnabled ? 'on' : 'off'}
                  onChange={(e) => {
                    const nextVal = e.target.value === 'on';
                    onToggleSound(nextVal);
                    if (nextVal) soundEngine.playClick();
                  }}
                  className="min-h-[44px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                >
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>
        )}

        {isGuest && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-900">
            <span className="font-medium">
              Create a Gaming Profile to host live multiplayer rooms &amp; share room codes.
            </span>
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-xl bg-amber-500 px-3.5 py-2 font-bold text-white shadow-2xs hover:bg-amber-600"
            >
              Create a Gaming Profile
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-slate-500">
            Generates a unique 6-character code for{' '}
            <strong className="text-slate-800">
              {activeGame.name} {isPuzzleGame ? `(Level ${puzzleLevel})` : ''}
            </strong>
            .
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={handleCreateMultiplayer}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#16A34A] px-7 py-3.5 font-display text-base font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
          >
            <Users className="h-5 w-5" />
            <span>
              {busy
                ? 'Creating Room...'
                : `Create ${multiplayerSize}-Player Room`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
