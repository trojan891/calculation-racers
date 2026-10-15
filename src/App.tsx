import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  AlertTriangle,
  Gamepad2,
  KeyRound,
  LogIn,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  googleProvider,
} from './lib/firebase';
import {
  CAR_PALETTE,
  GameMode,
  IQ_RELAY_ALL_FIELDS,
  IqRelayField,
  isInteractivePuzzleGame,
  PlayerProfile,
  QuestionCategory,
  QuestionCountOption,
  QuestionDifficulty,
  QuestionItem,
  QuestionTimeOption,
  RaceResultRecord,
  RoomCapacityOption,
  RoomPlayerRecord,
  RoomRecord,
  SUBCATEGORIES_BY_CATEGORY,
  TrojoGameId,
} from './game/types';
import {
  checkUserIsAdmin,
  createMultiplayerRoom,
  ensureOwnerAdminBootstrap,
  ensurePlayerProfile,
  fetchActiveQuestions,
  joinMultiplayerRoom,
  resetMultiplayerRoomForRematch,
  resolveRoomQuestionSequence,
  selectUniqueQuestionsForPlayer,
} from './lib/gameService';
import { soundEngine } from './lib/sound';
import { HomePage } from './pages/HomePage';
import { GameSetupPage } from './pages/GameSetupPage';
import { JoinRoomPage } from './pages/JoinRoomPage';
import { RoomLobbyPage } from './pages/RoomLobbyPage';
import { RaceArenaPage } from './pages/RaceArenaPage';
import { PuzzleGameArenaPage } from './pages/PuzzleGameArenaPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfileAndScoresPage } from './pages/ProfileAndScoresPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AuthModal } from './components/AuthModal';

const GUEST_PROFILE_STORAGE_KEY = 'trojo_guest_profile_v1';
const GUEST_HISTORY_STORAGE_KEY = 'trojo_guest_history_v1';

function loadGuestProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerProfile;
      if (parsed && parsed.uid && parsed.nickname) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  const randomId = Math.floor(1000 + Math.random() * 9000);
  const fallback: PlayerProfile = {
    uid: `guest_${randomId}`,
    nickname: `Player${randomId}`,
    carColor: 'blue',
    wins: 0,
    totalRaces: 0,
    bestTimeMs: 0,
    bestScore: 0,
    totalCorrect: 0,
    totalWrong: 0,
    isPublicProfile: false,
    isBanned: false,
    banReason: '',
  };
  try {
    localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(fallback));
  } catch {
    // ignore storage errors
  }
  return fallback;
}

function saveGuestProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application Error Boundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
          <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 shadow-lg">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
              <h1 className="font-display text-xl font-extrabold">
                Something went wrong
              </h1>
            </div>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-600 break-all">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 w-full rounded-2xl bg-[#2563EB] py-3 text-sm font-extrabold text-white hover:bg-blue-700"
            >
              Reload TROJO
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type AppView =
  | 'home'
  | 'setup'
  | 'join'
  | 'lobby'
  | 'arena'
  | 'leaderboard'
  | 'profile'
  | 'admin';

function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'RC';
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function App() {
  const [view, setView] = useState<AppView>('home');
  const [setupViewMode, setSetupViewMode] = useState<'library' | 'configure'>('library');
  const [setupPlayerMode, setSetupPlayerMode] = useState<'solo' | 'multiplayer'>('solo');
  const [authReady, setAuthReady] = useState(false);
  const [isGuest, setIsGuest] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile>(() => loadGuestProfile());

  // Sound state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    soundEngine.isEnabled()
  );

  // Active Game / Room Config State
  const [activeRoomCode, setActiveRoomCode] = useState<string | undefined>(undefined);
  const [activeRoomRecord, setActiveRoomRecord] = useState<RoomRecord | null>(null);
  const [activeRoomPlayers, setActiveRoomPlayers] = useState<RoomPlayerRecord[]>([]);
  const [prefillJoinCode, setPrefillJoinCode] = useState<string>('');
  const [selectedGameId, setSelectedGameId] = useState<TrojoGameId>('calculation_racer');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [selectedIqFields, setSelectedIqFields] = useState<IqRelayField[]>([
    'Numerical Reasoning',
    'Logical Reasoning',
    'Pattern Recognition',
    'Quick Maths',
  ]);
  const [activeMode, setActiveMode] = useState<GameMode>('solo');
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory>('math');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([
    SUBCATEGORIES_BY_CATEGORY.math[0],
  ]);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<QuestionDifficulty>('easy');
  const [questionCount, setQuestionCount] = useState<QuestionCountOption>(10);
  const [questionTimeLimitSec, setQuestionTimeLimitSec] =
    useState<QuestionTimeOption>(20);
  const [activeQuestions, setActiveQuestions] = useState<QuestionItem[]>([]);
  const [authBannerError, setAuthBannerError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // Inspect URL query params (?room=CODE) or pathname (/admin)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const path = window.location.pathname.toLowerCase();

    if (path === '/admin' || params.get('admin') === '1') {
      setView('admin');
      return;
    }

    if (roomParam && roomParam.trim().length >= 4) {
      setPrefillJoinCode(roomParam.trim().toUpperCase());
      setView('join');
    }
  }, []);

  // Listen to Firebase Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsGuest(false);
        setUserEmail(user.email || '');
        try {
          const ensured = await ensurePlayerProfile(user);
          setProfile(ensured);
          if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) {
            await ensureOwnerAdminBootstrap(user);
          }
          const adminCheck = await checkUserIsAdmin(user);
          setIsAdmin(adminCheck);
        } catch (err) {
          console.error('Error loading user profile:', err);
        }
      } else {
        setIsGuest(true);
        setUserEmail('');
        setIsAdmin(false);
        setProfile(loadGuestProfile());
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handleToggleSound = () => {
    const next = soundEngine.toggle();
    setSoundEnabled(next);
  };

  const handleSetSoundEnabled = (enabled: boolean) => {
    const next = soundEngine.setEnabled(enabled);
    setSoundEnabled(next);
  };

  const handleGoogleSignIn = async () => {
    setAuthBannerError(null);
    soundEngine.playClick();
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthBannerError(
        err instanceof Error
          ? err.message
          : 'Google Sign-In could not be completed. You can still play immediately as a Guest!'
      );
    }
  };

  const handleSignOut = async () => {
    soundEngine.playClick();
    await signOut(auth);
    if (view === 'admin') {
      setView('home');
    }
  };

  const handleStartSolo = async (mode: 'solo' | 'timed', level?: number) => {
    if (level !== undefined) {
      setSelectedLevel(level);
    }
    if (!isInteractivePuzzleGame(selectedGameId)) {
      const questions = await selectUniqueQuestionsForPlayer(
        profile.uid,
        isGuest,
        selectedCategory,
        selectedDifficulty,
        questionCount,
        selectedSubcategories,
        selectedGameId,
        selectedIqFields
      );
      setActiveQuestions(questions);
    }
    setActiveMode(mode);
    setActiveRoomCode(undefined);
    setActiveRoomRecord(null);
    setActiveRoomPlayers([]);
    setView('arena');
  };

  const modeFromCapacity = (mp: number): GameMode =>
    mp === 8 ? '8p' : mp === 4 ? '4p' : mp === 3 ? '3p' : '2p';

  const handleCreateRoom = async (maxPlayers: RoomCapacityOption, level?: number) => {
    if (level !== undefined) {
      setSelectedLevel(level);
    }
    const code = await createMultiplayerRoom(
      profile,
      maxPlayers,
      selectedCategory,
      selectedDifficulty,
      questionTimeLimitSec,
      questionCount,
      selectedSubcategories,
      selectedGameId,
      selectedIqFields
    );
    setActiveMode(modeFromCapacity(maxPlayers));
    setActiveRoomCode(code);
    setView('lobby');
  };

  const handleJoinRoom = async (roomCode: string) => {
    const normalized = roomCode.trim().toUpperCase();
    const room = await joinMultiplayerRoom(normalized, profile);
    setSelectedGameId(room.gameId || 'calculation_racer');
    setSelectedIqFields(
      room.iqFields && room.iqFields.length > 0
        ? room.iqFields
        : IQ_RELAY_ALL_FIELDS.slice(0, 4)
    );
    setActiveMode(modeFromCapacity(room.maxPlayers));
    setSelectedCategory(room.category);
    setSelectedSubcategories(
      room.subcategories && room.subcategories.length > 0
        ? room.subcategories
        : [SUBCATEGORIES_BY_CATEGORY[room.category][0]]
    );
    setSelectedDifficulty(room.difficulty);
    setQuestionCount((room.questionCount as QuestionCountOption) || 10);
    setQuestionTimeLimitSec(
      (room.questionTimeLimitSec as QuestionTimeOption) || 20
    );
    setActiveRoomCode(normalized);
    setView('lobby');
  };

  const handleStartActiveRaceFromLobby = async (
    room: RoomRecord,
    players: RoomPlayerRecord[]
  ) => {
    const roomGameId = room.gameId || 'calculation_racer';
    if (!isInteractivePuzzleGame(roomGameId)) {
      const pool = await fetchActiveQuestions();
      const resolvedQuestions = resolveRoomQuestionSequence(
        room.questionIds || [],
        pool,
        room.category,
        room.difficulty,
        room.questionCount || 10,
        room.subcategories || [],
        roomGameId,
        room.iqFields || []
      );
      setActiveQuestions(resolvedQuestions);
    }
    setSelectedGameId(roomGameId);
    setSelectedCategory(room.category);
    setSelectedDifficulty(room.difficulty);
    setQuestionTimeLimitSec(
      (room.questionTimeLimitSec as QuestionTimeOption) || 20
    );
    setActiveMode(modeFromCapacity(room.maxPlayers));
    setActiveRoomRecord(room);
    setActiveRoomPlayers(players);
    setView('arena');
  };

  const handleSaveLocalGuestResult = (result: {
    gameId: TrojoGameId;
    category: QuestionCategory;
    difficulty: QuestionDifficulty;
    mode: GameMode;
    score: number;
    correctAnswers: number;
    wrongAnswers: number;
    accuracy: number;
    distance: number;
    durationMs: number;
    completedAtMs: number;
  }) => {
    const nextProfile: PlayerProfile = {
      ...profile,
      wins: result.distance >= 100 || result.score >= 50 ? profile.wins + 1 : profile.wins,
      totalRaces: profile.totalRaces + 1,
      bestTimeMs:
        result.distance >= 100 &&
        (profile.bestTimeMs === 0 || result.durationMs < profile.bestTimeMs)
          ? result.durationMs
          : profile.bestTimeMs,
      bestScore: Math.max(profile.bestScore || 0, result.score),
      totalCorrect: (profile.totalCorrect || 0) + result.correctAnswers,
      totalWrong: (profile.totalWrong || 0) + result.wrongAnswers,
    };
    setProfile(nextProfile);
    saveGuestProfile(nextProfile);

    try {
      const raw = localStorage.getItem(GUEST_HISTORY_STORAGE_KEY);
      const prev: RaceResultRecord[] = raw ? JSON.parse(raw) : [];
      const newRecord: RaceResultRecord = {
        id: `guest_res_${Date.now()}`,
        roomCode: 'SOLO',
        gameId: result.gameId,
        playerId: profile.uid,
        nickname: profile.nickname,
        carColor: profile.carColor,
        mode: result.mode,
        category: result.category,
        difficulty: result.difficulty,
        placement: 1,
        score: result.score,
        correctAnswers: result.correctAnswers,
        wrongAnswers: result.wrongAnswers,
        accuracy: result.accuracy,
        distance: result.distance,
        durationMs: result.durationMs,
        isPublic: false,
        completedAtMs: result.completedAtMs,
      };
      const updatedHistory = [newRecord, ...prev].slice(0, 50);
      localStorage.setItem(
        GUEST_HISTORY_STORAGE_KEY,
        JSON.stringify(updatedHistory)
      );
    } catch {
      // ignore storage errors
    }
  };

  const handleReplayMultiplayer = async (roomCode: string) => {
    try {
      await resetMultiplayerRoomForRematch(roomCode, profile);
      setActiveRoomCode(roomCode);
      setView('lobby');
    } catch (err) {
      setAuthBannerError(
        err instanceof Error ? err.message : 'Unable to start rematch.'
      );
      setView('lobby');
    }
  };

  const carInfo = CAR_PALETTE[profile.carColor] || CAR_PALETTE.blue;

  return (
    <AppErrorBoundary>
      <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
        {/* Top Navigation Header (Hidden during active immersive arena gameplay) */}
        {view !== 'arena' && (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
            {/* Brand Logo: TROJO — A Fun Nagar */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setView('home');
              }}
              className="group flex shrink-0 items-center gap-2.5 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-xs transition-transform group-hover:scale-105">
                <Gamepad2 className="h-5 w-5" />
              </div>
              <div>
                <span className="block font-display text-lg leading-none font-extrabold tracking-tight text-slate-900">
                  TROJO
                </span>
                <span className="mt-0.5 block text-[11px] font-extrabold text-[#2563EB]">
                  A Fun Nagar
                </span>
              </div>
            </button>

            {/* Primary Navigation Links */}
            <nav className="hidden items-center gap-1.5 md:flex">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setView('home');
                }}
                className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors ${
                  view === 'home'
                    ? 'bg-blue-50 text-[#2563EB]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setSetupViewMode('library');
                  setSetupPlayerMode('solo');
                  setView('setup');
                }}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors ${
                  view === 'setup' && setupPlayerMode === 'solo'
                    ? 'bg-[#2563EB] text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-blue-50 hover:text-[#2563EB]'
                }`}
              >
                <Gamepad2 className="h-3.5 w-3.5" />
                <span>Play Games</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setSetupViewMode('configure');
                  setSetupPlayerMode('multiplayer');
                  setView('setup');
                }}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors ${
                  view === 'setup' && setupPlayerMode === 'multiplayer'
                    ? 'bg-[#16A34A] text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-emerald-50 hover:text-[#16A34A]'
                }`}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Create Room</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setView('join');
                }}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors ${
                  view === 'join'
                    ? 'bg-[#7C3AED] text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-purple-50 hover:text-[#7C3AED]'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Join Room</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setView('leaderboard');
                }}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors ${
                  view === 'leaderboard'
                    ? 'bg-blue-50 text-[#2563EB]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Trophy className="h-3.5 w-3.5" />
                <span>Leaderboard</span>
              </button>
            </nav>

            {/* Right Controls: Sound, Profile, Auth, Private Admin */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleToggleSound}
                title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-[#2563EB]" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {/* Profile Pill */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setView('profile');
                }}
                className={`flex min-h-[40px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  view === 'profile'
                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.nickname}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                    style={{ backgroundColor: carInfo.primary }}
                  >
                    {getInitials(profile.nickname)}
                  </span>
                )}
                <span className="hidden max-w-[100px] truncate sm:inline">
                  {profile.nickname}
                </span>
              </button>

              {/* Private Admin Link: ONLY visible when signed in as rizveemanger@gmail.com */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setView('admin');
                  }}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                    view === 'admin'
                      ? 'border-blue-600 bg-[#2563EB] text-white'
                      : 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              )}

              {/* Sign-In / Sign-Out */}
              {authReady &&
                (isGuest ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setAuthModalOpen(true);
                    }}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-2xs transition-colors hover:bg-blue-700"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Sign In</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    title="Sign Out"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                ))}
            </div>
          </div>

          {/* Mobile Quick Bar */}
          <div className="flex items-center justify-around border-t border-slate-100 bg-slate-50/90 px-2 py-1.5 md:hidden">
            <button
              type="button"
              onClick={() => setView('home')}
              className={`min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                view === 'home' ? 'bg-blue-100 text-[#2563EB]' : 'text-slate-600'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => {
                setSetupViewMode('library');
                setSetupPlayerMode('solo');
                setView('setup');
              }}
              className={`min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                view === 'setup' && setupPlayerMode === 'solo'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-600'
              }`}
            >
              Play Games
            </button>
            <button
              type="button"
              onClick={() => {
                setSetupViewMode('configure');
                setSetupPlayerMode('multiplayer');
                setView('setup');
              }}
              className={`min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                view === 'setup' && setupPlayerMode === 'multiplayer'
                  ? 'bg-[#16A34A] text-white'
                  : 'text-slate-600'
              }`}
            >
              Create Room
            </button>
            <button
              type="button"
              onClick={() => setView('join')}
              className={`min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                view === 'join' ? 'bg-[#7C3AED] text-white' : 'text-slate-600'
              }`}
            >
              Join
            </button>
            <button
              type="button"
              onClick={() => setView('leaderboard')}
              className={`min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                view === 'leaderboard'
                  ? 'bg-blue-100 text-[#2563EB]'
                  : 'text-slate-600'
              }`}
            >
              Ranks
            </button>
          </div>
        </header>
        )}

        {/* Auth Error Notice Banner */}
        {authBannerError && (
          <div className="mx-auto mt-3 max-w-4xl px-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
              <span>{authBannerError}</span>
              <button
                type="button"
                onClick={() => setAuthBannerError(null)}
                className="font-bold underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Main Content Router */}
        <main className="flex-1">
          {view === 'home' && (
            <HomePage
              profile={profile}
              isGuest={isGuest}
              onOpenLibrary={() => {
                setSetupViewMode('library');
                setSetupPlayerMode('solo');
                setView('setup');
              }}
              onSelectGame={(gameId, mode) => {
                setSelectedGameId(gameId);
                if (gameId === 'ludo') {
                  setView('arena');
                  return;
                }
                setSetupViewMode('configure');
                setSetupPlayerMode(mode);
                setView('setup');
              }}
              onQuickPlayGame={(gameId) => {
                setSelectedGameId(gameId);
                if (gameId === 'ludo') {
                  setView('arena');
                  return;
                }
                setSetupViewMode('configure');
                setSetupPlayerMode('solo');
                setView('setup');
              }}
              onOpenJoinRoom={() => setView('join')}
              onOpenLeaderboard={() => setView('leaderboard')}
              onOpenProfile={() => setView('profile')}
              onSignIn={() => setAuthModalOpen(true)}
            />
          )}

          {view === 'setup' && (
            <GameSetupPage
              profile={profile}
              isGuest={isGuest}
              initialViewMode={setupViewMode}
              initialPlayerMode={setupPlayerMode}
              selectedGameId={selectedGameId}
              selectedLevel={selectedLevel}
              selectedIqFields={selectedIqFields}
              selectedCategory={selectedCategory}
              selectedSubcategories={selectedSubcategories}
              selectedDifficulty={selectedDifficulty}
              questionCount={questionCount}
              questionTimeLimitSec={questionTimeLimitSec}
              soundEnabled={soundEnabled}
              onSelectGameId={setSelectedGameId}
              onSelectLevel={setSelectedLevel}
              onSelectIqFields={setSelectedIqFields}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                setSelectedSubcategories([SUBCATEGORIES_BY_CATEGORY[cat][0]]);
              }}
              onSelectSubcategories={setSelectedSubcategories}
              onSelectDifficulty={setSelectedDifficulty}
              onSelectQuestionCount={setQuestionCount}
              onSelectTimeLimit={(sec) =>
                setQuestionTimeLimitSec(sec as QuestionTimeOption)
              }
              onToggleSound={handleSetSoundEnabled}
              onStartSolo={handleStartSolo}
              onCreateRoom={handleCreateRoom}
              onOpenJoinRoom={() => setView('join')}
              onBackHome={() => setView('home')}
              onSignIn={() => setAuthModalOpen(true)}
            />
          )}

          {view === 'join' && (
            <JoinRoomPage
              profile={profile}
              isGuest={isGuest}
              initialRoomCode={prefillJoinCode}
              onJoinRoom={handleJoinRoom}
              onOpenCreateRoom={() => {
                setSetupViewMode('configure');
                setSetupPlayerMode('multiplayer');
                setView('setup');
              }}
              onBackHome={() => setView('home')}
              onSignIn={() => setAuthModalOpen(true)}
            />
          )}

          {view === 'lobby' && activeRoomCode && (
            <RoomLobbyPage
              roomCode={activeRoomCode}
              profile={profile}
              onStartActiveRace={handleStartActiveRaceFromLobby}
              onLeaveRoom={() => {
                setActiveRoomCode(undefined);
                setView('home');
              }}
            />
          )}

          {view === 'arena' &&
            (isInteractivePuzzleGame(selectedGameId) ? (
              <PuzzleGameArenaPage
                gameId={selectedGameId}
                mode={activeMode}
                category={selectedCategory}
                difficulty={selectedDifficulty}
                initialLevel={selectedLevel}
                profile={profile}
                isGuest={isGuest}
                roomCode={activeRoomCode}
                initialRoom={activeRoomRecord}
                initialPlayers={activeRoomPlayers}
                onSaveLocalGuestResult={handleSaveLocalGuestResult}
                onPlayAgain={() => {
                  handleStartSolo('solo', selectedLevel);
                }}
                onReplayMultiplayer={handleReplayMultiplayer}
                onPlayMoreGames={() => {
                  setSetupViewMode('library');
                  setSetupPlayerMode('solo');
                  setView('setup');
                }}
                onOpenLeaderboard={() => setView('leaderboard')}
                onExitToHome={() => {
                  setActiveRoomCode(undefined);
                  setView('home');
                }}
              />
            ) : (
              <RaceArenaPage
                gameId={selectedGameId}
                mode={activeMode}
                category={selectedCategory}
                difficulty={selectedDifficulty}
                questionTimeLimitSec={questionTimeLimitSec}
                questions={activeQuestions}
                profile={profile}
                isGuest={isGuest}
                roomCode={activeRoomCode}
                initialRoom={activeRoomRecord}
                initialPlayers={activeRoomPlayers}
                onSaveLocalGuestResult={handleSaveLocalGuestResult}
                onPlayAgain={() => {
                  handleStartSolo('solo');
                }}
                onReplayMultiplayer={handleReplayMultiplayer}
                onPlayMoreGames={() => {
                  setSetupViewMode('library');
                  setSetupPlayerMode('solo');
                  setView('setup');
                }}
                onChangeSettings={() => {
                  setSetupViewMode('configure');
                  setSetupPlayerMode('solo');
                  setView('setup');
                }}
                onOpenLeaderboard={() => setView('leaderboard')}
                onExitToHome={() => {
                  setActiveRoomCode(undefined);
                  setView('home');
                }}
              />
            ))}

          {view === 'leaderboard' && (
            <LeaderboardPage
              profile={profile}
              isGuest={isGuest}
              onBackHome={() => setView('home')}
              onOpenSetup={() => {
                setSetupViewMode('library');
                setSetupPlayerMode('solo');
                setView('setup');
              }}
            />
          )}

          {view === 'profile' && (
            <ProfileAndScoresPage
              profile={profile}
              isGuest={isGuest}
              onUpdateProfileState={(next) => setProfile(next)}
              onSignInGoogle={() => setAuthModalOpen(true)}
              onBackHome={() => setView('home')}
            />
          )}

          {view === 'admin' && (
            <AdminDashboardPage
              isAdmin={isAdmin}
              adminUid={profile.uid}
              adminEmail={userEmail}
              onExitAdmin={() => setView('home')}
            />
          )}
        </main>

        {/* Minimal Elegant Footer (Hidden during active immersive arena gameplay) */}
        {view !== 'arena' && (
          <footer className="mt-auto border-t border-slate-200/80 bg-white py-4 text-center text-xs font-semibold text-slate-600">
            <div className="mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4">
              <span>
                Made with <span className="text-rose-500">♥</span> by{' '}
                <strong className="font-extrabold text-slate-900">Trojan</strong>
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span>
                Instagram:{' '}
                <a
                  href="https://www.instagram.com/rizvee.uk/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-extrabold text-[#2563EB] hover:underline"
                >
                  @rizvee.uk
                </a>
              </span>
            </div>
          </footer>
        )}

        {/* Universal Robust Auth Modal (Email/Password & Google) */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => setAuthModalOpen(false)}
        />
      </div>
    </AppErrorBoundary>
  );
}

export default App;
