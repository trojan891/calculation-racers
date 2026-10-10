import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock,
  Hash,
  KeyRound,
  Layers,
  Play,
  Sparkles,
  Users,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  PlayerProfile,
  QuestionCategory,
  QuestionCountOption,
  QuestionDifficulty,
  QuestionItem,
  QuestionTimeOption,
  SUBCATEGORIES_BY_CATEGORY,
} from '../game/types';
import {
  fetchActiveQuestions,
  generateFreshAiQuestionsForSection,
} from '../lib/gameService';
import { countAvailableQuestions, SEED_QUESTIONS } from '../lib/seedQuestions';
import { soundEngine } from '../lib/sound';

interface GameSetupPageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  initialPlayerMode?: 'solo' | 'multiplayer';
  selectedCategory: QuestionCategory;
  selectedSubcategories: string[];
  selectedDifficulty: QuestionDifficulty;
  questionCount: QuestionCountOption;
  questionTimeLimitSec: number;
  soundEnabled: boolean;
  onSelectCategory: (cat: QuestionCategory) => void;
  onSelectSubcategories: (subs: string[]) => void;
  onSelectDifficulty: (diff: QuestionDifficulty) => void;
  onSelectQuestionCount: (count: QuestionCountOption) => void;
  onSelectTimeLimit: (sec: number) => void;
  onToggleSound: (enabled: boolean) => void;
  onStartSolo: (mode: 'solo' | 'timed') => Promise<void>;
  onCreateRoom: (maxPlayers: 2 | 4) => Promise<void>;
  onOpenJoinRoom: () => void;
  onBackHome: () => void;
  onSignIn: () => void;
}

const QUESTION_COUNT_OPTIONS: QuestionCountOption[] = [10, 15, 20];
const QUESTION_TIME_OPTIONS: QuestionTimeOption[] = [10, 15, 20, 30];

export const GameSetupPage: React.FC<GameSetupPageProps> = ({
  isGuest,
  initialPlayerMode = 'solo',
  selectedCategory,
  selectedSubcategories,
  selectedDifficulty,
  questionCount,
  questionTimeLimitSec,
  soundEnabled = soundEngine.isEnabled(),
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
  const [multiplayerSize, setMultiplayerSize] = useState<2 | 4>(2);
  const [questionPool, setQuestionPool] = useState<QuestionItem[]>(SEED_QUESTIONS);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveQuestions()
      .then((q) => setQuestionPool(q))
      .catch(() => {});
  }, []);

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

  const availableQuestionCount = useMemo(
    () =>
      countAvailableQuestions(
        questionPool,
        selectedCategory,
        selectedDifficulty,
        selectedSubcategories
      ),
    [questionPool, selectedCategory, selectedDifficulty, selectedSubcategories]
  );

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

    if (availableQuestionCount < questionCount) {
      setErrorMsg(
        `Not enough questions available (${availableQuestionCount} found, ${questionCount} required). Click "Add AI Questions" or select All Topics.`
      );
      return;
    }

    setBusy(true);
    try {
      await onStartSolo('solo');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to start race. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreateMultiplayer = async () => {
    soundEngine.playClick();
    setErrorMsg(null);

    if (isGuest) {
      setErrorMsg('Please sign in with Google to host a live multiplayer room.');
      return;
    }

    if (availableQuestionCount < questionCount) {
      setErrorMsg(
        `Not enough questions available (${availableQuestionCount} found, ${questionCount} required).`
      );
      return;
    }

    setBusy(true);
    try {
      await onCreateRoom(multiplayerSize);
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
  // COMPACT, ZERO-WASTE SINGLE-PLAYER SETUP SCREEN ("Play Game")
  // ============================================================================
  if (initialPlayerMode === 'solo') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
        {/* Top Compact Action Bar */}
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Single-Player Mode</span>
            <span aria-hidden="true">·</span>
            <span className="font-bold text-sky-700">
              {selectedCategory === 'math' ? 'Unlimited' : `${availableQuestionCount}+`} Unique Questions
            </span>
          </div>
        </div>

        {/* Organized 2-Column Single-Player Setup Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-2xs">
                <Play className="h-5 w-5 fill-current" />
              </div>
              <div>
                <h1 className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                  Play Game
                </h1>
                <p className="text-xs text-slate-500">
                  Configure your race below — unseen questions are prioritized automatically.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={aiBusy}
              onClick={handleGenerateAiQuestions}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-extrabold text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
              title="Generate brand-new non-repeating questions for this category using Gemini AI"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              <span>{aiBusy ? 'Generating AI Questions...' : 'Add Fresh AI Questions'}</span>
            </button>
          </div>

          {/* 6 Compact Dropdowns Organized in a Clean 2x3 Grid */}
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
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                >
                  <option value="math">Mathematics (Arithmetic & Mental Math)</option>
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
                <span>2. Difficulty</span>
              </label>
              <div className="relative">
                <select
                  id="solo-difficulty-select"
                  value={selectedDifficulty}
                  onChange={(e) =>
                    handleDifficultyChange(e.target.value as QuestionDifficulty)
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                >
                  <option value="easy">Easy — Beginner-friendly</option>
                  <option value="medium">Medium — Standard challenge</option>
                  <option value="hard">Hard — Pro brain speed</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            {/* 3. Question Selection (Topic / Subcategory) */}
            <div>
              <label
                htmlFor="solo-subcategory-select"
                className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
              >
                <Layers className="h-3.5 w-3.5 text-purple-600" />
                <span>3. Question Selection ({CATEGORY_LABELS[selectedCategory]})</span>
              </label>
              <div className="relative">
                <select
                  id="solo-subcategory-select"
                  value={currentSubcategoryValue}
                  onChange={(e) => handleSubcategoryDropdownChange(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
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
                <span>4. Number of Questions</span>
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
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
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
                <Clock className="h-3.5 w-3.5 text-orange-500" />
                <span>5. Time per Question</span>
              </label>
              <div className="relative">
                <select
                  id="solo-timer-select"
                  value={
                    QUESTION_TIME_OPTIONS.includes(
                      questionTimeLimitSec as QuestionTimeOption
                    )
                      ? questionTimeLimitSec
                      : 20
                  }
                  onChange={(e) => {
                    soundEngine.playClick();
                    onSelectTimeLimit(Number(e.target.value));
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                >
                  {QUESTION_TIME_OPTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec} Seconds per Question
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
                <Volume2 className="h-3.5 w-3.5 text-rose-500" />
                <span>6. Sound Effects</span>
              </label>
              <div className="relative">
                <select
                  id="solo-sound-select"
                  value={soundEnabled ? 'on' : 'off'}
                  onChange={(e) => {
                    onToggleSound(e.target.value === 'on');
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none"
                >
                  <option value="on">On (Engine Revs & Beeps)</option>
                  <option value="off">Off (Silent Mode)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>

          {aiSuccessMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{aiSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Compact Footer Summary + Start Game Button */}
          <div className="mt-5 flex flex-col items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <div className="text-xs text-slate-500">
              <span className="font-bold text-slate-700">Race Rules:</span> Correct{' '}
              <span className="font-bold text-emerald-600">+10m</span> · Wrong or Timeout{' '}
              <span className="font-bold text-rose-600">-5m</span> · Target{' '}
              <span className="font-bold text-sky-600">100m</span>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleStartSinglePlayer}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-7 py-3.5 text-sm font-extrabold text-white shadow-sm transition-all hover:bg-sky-500 active:scale-[0.99] disabled:opacity-50 sm:w-auto"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{busy ? 'Starting Race...' : 'Start Game'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SEPARATE MULTIPLAYER ROOM CREATION SCREEN ("Create Room / Host Game")
  // ============================================================================
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
          <span>Back to Home</span>
        </button>

        <button
          type="button"
          onClick={onOpenJoinRoom}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-extrabold text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Have a Code? Join Room</span>
        </button>
      </div>

      <div className="rounded-3xl border border-purple-200/90 bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-2xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                Create Multiplayer Room
              </h1>
              <p className="text-xs text-slate-500">
                Host a live 2P or 4P race and share the 6-character invite code with friends.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={aiBusy}
            onClick={handleGenerateAiQuestions}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-extrabold text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
            <span>{aiBusy ? 'Generating...' : 'Add AI Questions'}</span>
          </button>
        </div>

        {isGuest && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
            <div className="text-xs font-medium text-amber-900">
              <p className="font-bold">Sign in required to host multiplayer rooms</p>
              <p className="text-amber-800">
                Sign in with Google so your room state and leaderboard wins sync in real time.
              </p>
            </div>
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-amber-500"
            >
              Sign In with Google
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Room Size */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-extrabold tracking-wider text-slate-600 uppercase">
              Room Size
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setMultiplayerSize(2);
                }}
                className={`rounded-xl border-2 px-3.5 py-2.5 text-left transition-all ${
                  multiplayerSize === 2
                    ? 'border-purple-600 bg-purple-50/70 text-purple-950'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <p className="font-display text-sm font-extrabold">2 Players (1v1 Duel)</p>
                <p className="text-[11px] text-slate-500">Head-to-head race</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setMultiplayerSize(4);
                }}
                className={`rounded-xl border-2 px-3.5 py-2.5 text-left transition-all ${
                  multiplayerSize === 4
                    ? 'border-purple-600 bg-purple-50/70 text-purple-950'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <p className="font-display text-sm font-extrabold">4 Players (Grand Prix)</p>
                <p className="text-[11px] text-slate-500">Up to 4 racers in room</p>
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="mp-category-select"
              className="mb-1 block text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
            >
              Game Category
            </label>
            <div className="relative">
              <select
                id="mp-category-select"
                value={selectedCategory}
                onChange={(e) =>
                  handleCategoryChange(e.target.value as QuestionCategory)
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none"
              >
                <option value="math">Mathematics</option>
                <option value="gk">General Knowledge</option>
                <option value="science">Science</option>
                <option value="current_affairs">Current Affairs</option>
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label
              htmlFor="mp-difficulty-select"
              className="mb-1 block text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
            >
              Difficulty
            </label>
            <div className="relative">
              <select
                id="mp-difficulty-select"
                value={selectedDifficulty}
                onChange={(e) =>
                  handleDifficultyChange(e.target.value as QuestionDifficulty)
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none"
              >
                <option value="easy">{DIFFICULTY_LABELS.easy}</option>
                <option value="medium">{DIFFICULTY_LABELS.medium}</option>
                <option value="hard">{DIFFICULTY_LABELS.hard}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Subcategory */}
          <div>
            <label
              htmlFor="mp-subcategory-select"
              className="mb-1 block text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
            >
              Question Selection
            </label>
            <div className="relative">
              <select
                id="mp-subcategory-select"
                value={currentSubcategoryValue}
                onChange={(e) => handleSubcategoryDropdownChange(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 pr-9 text-sm font-bold text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Topics / Mixed</option>
                {availableSubcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Question Count & Timer */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="mp-count-select"
                className="mb-1 block text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
              >
                Questions
              </label>
              <div className="relative">
                <select
                  id="mp-count-select"
                  value={questionCount}
                  onChange={(e) =>
                    onSelectQuestionCount(
                      Number(e.target.value) as QuestionCountOption
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-7 text-sm font-bold text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none"
                >
                  {QUESTION_COUNT_OPTIONS.map((cnt) => (
                    <option key={cnt} value={cnt}>
                      {cnt} Qs
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div>
              <label
                htmlFor="mp-timer-select"
                className="mb-1 block text-[11px] font-extrabold tracking-wider text-slate-600 uppercase"
              >
                Timer
              </label>
              <div className="relative">
                <select
                  id="mp-timer-select"
                  value={
                    QUESTION_TIME_OPTIONS.includes(
                      questionTimeLimitSec as QuestionTimeOption
                    )
                      ? questionTimeLimitSec
                      : 20
                  }
                  onChange={(e) => onSelectTimeLimit(Number(e.target.value))}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 pr-7 text-sm font-bold text-slate-900 focus:border-purple-500 focus:bg-white focus:outline-none"
                >
                  {QUESTION_TIME_OPTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}s
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>
        </div>

        {aiSuccessMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{aiSuccessMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
            {errorMsg}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={handleCreateMultiplayer}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-purple-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-sm transition-all hover:bg-purple-500 disabled:opacity-50"
          >
            <Users className="h-4 w-4" />
            <span>
              {busy
                ? 'Creating Room...'
                : `Create ${multiplayerSize}-Player Room`}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenJoinRoom}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-xs font-extrabold text-slate-700 transition-colors hover:bg-slate-100"
          >
            <KeyRound className="h-4 w-4 text-emerald-600" />
            <span>Join Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
