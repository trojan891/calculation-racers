/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDocs, collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Car,
  ChevronDown,
  Home,
  LogOut,
  Play,
  Shield,
  Trophy,
  User as UserIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { auth, db, googleProvider } from './lib/firebase';
import {
  CAR_PALETTE,
  GameMode,
  PlayerProfile,
  QuestionCategory,
  QuestionCountOption,
  QuestionDifficulty,
  QuestionItem,
  RaceResultRecord,
  RoomPlayerRecord,
  RoomRecord,
} from './game/types';
import {
  checkUserIsAdmin,
  createMultiplayerRoom,
  ensureOwnerAdminBootstrap,
  ensurePlayerProfile,
  fetchActiveQuestions,
  joinMultiplayerRoom,
  resolveRoomQuestionSequence,
  seedStarterQuestionsToFirestore,
  selectUniqueQuestionsForPlayer,
} from './lib/gameService';
import { SEED_QUESTIONS } from './lib/seedQuestions';
import { soundEngine } from './lib/sound';
import { HomePage } from './pages/HomePage';
import { GameSetupPage } from './pages/GameSetupPage';
import { JoinRoomPage } from './pages/JoinRoomPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { RoomLobbyPage } from './pages/RoomLobbyPage';
import { RaceArenaPage } from './pages/RaceArenaPage';
import { ProfileAndScoresPage } from './pages/ProfileAndScoresPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

type ActiveView =
  | 'home'
  | 'setup'
  | 'join'
  | 'leaderboard'
  | 'lobby'
  | 'race'
  | 'profile'
  | 'admin';

const DEFAULT_GUEST_PROFILE: PlayerProfile = {
  uid: 'guest_local_driver',
  nickname: 'GuestRacer',
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

function getInitialInvitedRoomCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room') || params.get('code') || '';
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned.length === 6 ? cleaned : '';
  } catch {
    return '';
  }
}

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile>(() => {
    try {
      const saved = localStorage.getItem('calc_racer_guest_profile');
      if (saved) return { ...DEFAULT_GUEST_PROFILE, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
    return DEFAULT_GUEST_PROFILE;
  });

  const [guestResults, setGuestResults] = useState<RaceResultRecord[]>(() => {
    try {
      const saved = localStorage.getItem('calc_racer_guest_results');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const [invitedRoomCode, setInvitedRoomCode] = useState<string>(() =>
    getInitialInvitedRoomCode()
  );

  const [view, setView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.pathname.startsWith('/admin') ||
        window.location.hash === '#admin'
      ) {
        return 'admin';
      }
      if (getInitialInvitedRoomCode()) {
        return 'join';
      }
    }
    return 'home';
  });

  // Game setup state (Defaults: Mathematics, Easy, 10 questions, 20 seconds, Sound On)
  const [setupInitialPlayerMode, setSetupInitialPlayerMode] = useState<
    'solo' | 'multiplayer'
  >('solo');
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory>('math');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<QuestionDifficulty>('easy');
  const [questionCount, setQuestionCount] = useState<QuestionCountOption>(10);
  const [questionTimeLimitSec, setQuestionTimeLimitSec] = useState<number>(20);
  const [activeMode, setActiveMode] = useState<GameMode>('solo');
  const [raceQuestions, setRaceQuestions] = useState<QuestionItem[]>(
    SEED_QUESTIONS.slice(0, 10)
  );
  const [raceSessionId, setRaceSessionId] = useState<number>(1);

  // Multiplayer room state
  const [activeRoomCode, setActiveRoomCode] = useState<string>('');
  const [activeRoom, setActiveRoom] = useState<RoomRecord | null>(null);
  const [activeRoomPlayers, setActiveRoomPlayers] = useState<RoomPlayerRecord[]>([]);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    soundEngine.isEnabled()
  );
  const [authBanner, setAuthBanner] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close profile menu when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Listen to Firebase Auth state & auto-seed starter question bank if empty
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        try {
          const ensured = await ensurePlayerProfile(user);
          setProfile(ensured);
          const adminFlag = await checkUserIsAdmin(user);
          setIsAdmin(adminFlag);
          if (adminFlag) {
            ensureOwnerAdminBootstrap(user).catch(() => {});
          }

          // Automatically seed the starter question bank if Firestore /questions is empty
          const qSnap = await getDocs(
            query(collection(db, 'questions'), where('isActive', '==', true))
          );
          if (qSnap.empty) {
            seedStarterQuestionsToFirestore().catch(() => {});
          }
        } catch (err) {
          console.error('Profile initialization error:', err);
        }
      } else {
        setIsAdmin(false);
        try {
          const saved = localStorage.getItem('calc_racer_guest_profile');
          if (saved) {
            setProfile({ ...DEFAULT_GUEST_PROFILE, ...JSON.parse(saved) });
          } else {
            setProfile(DEFAULT_GUEST_PROFILE);
          }
        } catch {
          setProfile(DEFAULT_GUEST_PROFILE);
        }
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Keep authenticated user profile synchronized in real time
  useEffect(() => {
    if (!authUser || !authReady) return;
    const unsub = onSnapshot(
      doc(db, 'profiles', authUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as PlayerProfile);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [authUser, authReady]);

  const navigateTo = (target: ActiveView) => {
    soundEngine.playClick();
    setProfileMenuOpen(false);
    setView(target);
    if (typeof window !== 'undefined') {
      if (target === 'admin') {
        window.history.pushState({}, '', '/admin');
      } else if (
        window.location.pathname === '/admin' ||
        window.location.search.includes('room=')
      ) {
        window.history.pushState({}, '', '/');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenSetup = (playerMode: 'solo' | 'multiplayer') => {
    setSetupInitialPlayerMode(playerMode);
    navigateTo('setup');
  };

  const handleSetSoundEnabled = (enabled: boolean) => {
    const next = soundEngine.setEnabled(enabled);
    setSoundEnabled(next);
  };

  const handleSignIn = async () => {
    soundEngine.playClick();
    setProfileMenuOpen(false);
    setAuthBanner(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthBanner(
        err instanceof Error ? err.message : 'Sign-in popup was closed or blocked.'
      );
    }
  };

  const handleSignOut = async () => {
    soundEngine.playClick();
    setProfileMenuOpen(false);
    await signOut(auth);
    navigateTo('home');
  };

  const handleStartSoloOrTimed = async (mode: 'solo' | 'timed') => {
    const chosen = await selectUniqueQuestionsForPlayer(
      profile.uid,
      !authUser,
      selectedCategory,
      selectedDifficulty,
      questionCount,
      selectedSubcategories
    );
    setRaceQuestions(chosen);
    setRaceSessionId((prev) => prev + 1);
    setActiveMode(mode);
    if (mode === 'timed') {
      setQuestionTimeLimitSec(10);
    }
    setActiveRoomCode('');
    setActiveRoom(null);
    navigateTo('race');
  };

  const handleCreateRoom = async (maxPlayers: 2 | 4) => {
    const code = await createMultiplayerRoom(
      profile,
      maxPlayers,
      selectedCategory,
      selectedDifficulty,
      questionTimeLimitSec,
      questionCount,
      selectedSubcategories
    );
    setActiveRoomCode(code);
    setActiveMode(maxPlayers === 2 ? '2p' : '4p');
    navigateTo('lobby');
  };

  const handleJoinRoom = async (code: string) => {
    const room = await joinMultiplayerRoom(code, profile);
    setInvitedRoomCode('');
    setActiveRoomCode(room.roomCode);
    setActiveRoom(room);
    setSelectedCategory(room.category);
    setSelectedDifficulty(room.difficulty);
    setSelectedSubcategories(room.subcategories || []);
    if (room.questionCount) {
      setQuestionCount(room.questionCount);
    }
    setQuestionTimeLimitSec(room.questionTimeLimitSec);
    setActiveMode(room.maxPlayers === 2 ? '2p' : '4p');

    if (room.status === 'racing') {
      const allQ = await fetchActiveQuestions();
      const ordered = resolveRoomQuestionSequence(
        room.questionIds,
        allQ,
        room.category,
        room.difficulty,
        room.questionCount || 10,
        room.subcategories || []
      );
      setRaceQuestions(ordered);
      navigateTo('race');
    } else {
      navigateTo('lobby');
    }
  };

  const handleStartActiveMultiplayerRace = async (
    room: RoomRecord,
    players: RoomPlayerRecord[]
  ) => {
    const allQ = await fetchActiveQuestions();
    const ordered = resolveRoomQuestionSequence(
      room.questionIds,
      allQ,
      room.category,
      room.difficulty,
      room.questionCount || 10,
      room.subcategories || []
    );
    setRaceQuestions(ordered);
    setRaceSessionId((prev) => prev + 1);
    setActiveRoom(room);
    setActiveRoomPlayers(players);
    setSelectedCategory(room.category);
    setSelectedDifficulty(room.difficulty);
    setSelectedSubcategories(room.subcategories || []);
    if (room.questionCount) {
      setQuestionCount(room.questionCount);
    }
    setQuestionTimeLimitSec(room.questionTimeLimitSec);
    setActiveMode(room.maxPlayers === 2 ? '2p' : '4p');
    navigateTo('race');
  };

  const handleSaveGuestResult = (res: {
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
    const newRecord: RaceResultRecord = {
      id: `guest_${res.completedAtMs}`,
      roomCode: `solo_${res.completedAtMs}`,
      playerId: profile.uid,
      nickname: profile.nickname,
      carColor: profile.carColor,
      mode: res.mode,
      category: res.category,
      difficulty: res.difficulty,
      placement: 1,
      score: res.score,
      correctAnswers: res.correctAnswers,
      wrongAnswers: res.wrongAnswers,
      accuracy: res.accuracy,
      distance: res.distance,
      durationMs: res.durationMs,
      isPublic: false,
      completedAtMs: res.completedAtMs,
    };
    const nextResults = [newRecord, ...guestResults].slice(0, 50);
    setGuestResults(nextResults);

    // Update guest profile best stats
    const isWin = res.distance >= 100;
    const nextProfile: PlayerProfile = {
      ...profile,
      wins: profile.wins + (isWin ? 1 : 0),
      totalRaces: profile.totalRaces + 1,
      bestScore: Math.max(profile.bestScore || 0, res.score),
      bestTimeMs:
        res.distance >= 100
          ? profile.bestTimeMs === 0
            ? res.durationMs
            : Math.min(profile.bestTimeMs, res.durationMs)
          : profile.bestTimeMs,
      totalCorrect: profile.totalCorrect + res.correctAnswers,
      totalWrong: profile.totalWrong + res.wrongAnswers,
    };
    setProfile(nextProfile);

    try {
      localStorage.setItem('calc_racer_guest_results', JSON.stringify(nextResults));
      localStorage.setItem('calc_racer_guest_profile', JSON.stringify(nextProfile));
    } catch {
      // ignore
    }
  };

  const getInitials = (name: string) => {
    const clean = name.trim();
    if (!clean) return 'R';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  const carPalette = CAR_PALETTE[profile.carColor] || CAR_PALETTE.blue;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* CLEAN LIGHT-THEME TOP NAVIGATION */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          {/* Left: Game Logo & Name */}
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-2xs">
              <Car className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl whitespace-nowrap">
              Calculation Racer
            </span>
          </button>

          {/* Center: Home & Leaderboard Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                view === 'home'
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenSetup('solo')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                view === 'setup' && setupInitialPlayerMode === 'solo'
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Play className="h-4 w-4" />
              <span>Play Game</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('leaderboard')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                view === 'leaderboard'
                  ? 'bg-amber-50 text-amber-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>Leaderboard</span>
            </button>
          </nav>

          {/* Right: Sign In / Guest Play & Profile Menu */}
          <div className="flex items-center gap-2.5">
            {!authUser && (
              <button
                type="button"
                onClick={handleSignIn}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-sky-500 whitespace-nowrap"
              >
                <span>Sign In</span>
              </button>
            )}

            {/* Profile Avatar, Nickname & Dropdown Menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setProfileMenuOpen((prev) => !prev);
                }}
                className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/80 py-1.5 pr-3 pl-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-100"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-extrabold text-white shadow-2xs shrink-0"
                  style={{ backgroundColor: carPalette.primary }}
                >
                  {getInitials(profile.nickname)}
                </div>
                <div className="hidden sm:block max-w-[120px]">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {profile.nickname}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500">
                    {authUser ? 'Cloud Account' : 'Guest Play'}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {profile.nickname}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {authUser
                        ? authUser.email || 'Authenticated Player'
                        : 'Guest Play Mode'}
                    </p>
                  </div>

                  {/* Mobile Nav Items inside menu */}
                  <div className="mt-1 space-y-1 md:hidden border-b border-slate-100 pb-1">
                    <button
                      type="button"
                      onClick={() => navigateTo('home')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Home className="h-4 w-4 text-sky-600" />
                      <span>Home</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenSetup('solo')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Play className="h-4 w-4 text-sky-600" />
                      <span>Play Game</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('leaderboard')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <span>Leaderboard</span>
                    </button>
                  </div>

                  <div className="mt-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => navigateTo('profile')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <UserIcon className="h-4 w-4 text-purple-600" />
                      <span>My Profile & Scores</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSoundEnabled(soundEngine.toggle())}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <span className="flex items-center gap-2.5">
                        {soundEnabled ? (
                          <Volume2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <VolumeX className="h-4 w-4 text-slate-400" />
                        )}
                        <span>Sound Effects</span>
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                          soundEnabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {soundEnabled ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    {/* Admin Panel is strictly hidden from normal users & guests */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => navigateTo('admin')}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50"
                      >
                        <Shield className="h-4 w-4 text-sky-600" />
                        <span>Admin Panel</span>
                      </button>
                    )}
                  </div>

                  <div className="mt-1 border-t border-slate-100 pt-1">
                    {authUser ? (
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSignIn}
                        className="flex w-full items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500"
                      >
                        Sign In / Create Account
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {authBanner && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
            {authBanner}
          </div>
        </div>
      )}

      {/* MAIN VIEW ROUTER */}
      <main className="flex-1">
        {view === 'home' && (
          <HomePage
            profile={profile}
            isGuest={!authUser}
            onOpenSetup={handleOpenSetup}
            onOpenJoinRoom={() => navigateTo('join')}
            onOpenLeaderboard={() => navigateTo('leaderboard')}
            onSignIn={handleSignIn}
          />
        )}

        {view === 'setup' && (
          <GameSetupPage
            profile={profile}
            isGuest={!authUser}
            initialPlayerMode={setupInitialPlayerMode}
            selectedCategory={selectedCategory}
            selectedSubcategories={selectedSubcategories}
            selectedDifficulty={selectedDifficulty}
            questionCount={questionCount}
            questionTimeLimitSec={questionTimeLimitSec}
            soundEnabled={soundEnabled}
            onSelectCategory={setSelectedCategory}
            onSelectSubcategories={setSelectedSubcategories}
            onSelectDifficulty={setSelectedDifficulty}
            onSelectQuestionCount={setQuestionCount}
            onSelectTimeLimit={setQuestionTimeLimitSec}
            onToggleSound={handleSetSoundEnabled}
            onStartSolo={handleStartSoloOrTimed}
            onCreateRoom={handleCreateRoom}
            onOpenJoinRoom={() => navigateTo('join')}
            onBackHome={() => navigateTo('home')}
            onSignIn={handleSignIn}
          />
        )}

        {view === 'join' && (
          <JoinRoomPage
            profile={profile}
            isGuest={!authUser}
            initialRoomCode={invitedRoomCode}
            onJoinRoom={handleJoinRoom}
            onOpenCreateRoom={() => handleOpenSetup('multiplayer')}
            onBackHome={() => navigateTo('home')}
            onSignIn={handleSignIn}
          />
        )}

        {view === 'leaderboard' && (
          <LeaderboardPage
            profile={profile}
            isGuest={!authUser}
            onBackHome={() => navigateTo('home')}
            onOpenSetup={() => handleOpenSetup('solo')}
          />
        )}

        {view === 'lobby' && activeRoomCode && (
          <RoomLobbyPage
            roomCode={activeRoomCode}
            profile={profile}
            onStartActiveRace={handleStartActiveMultiplayerRace}
            onLeaveRoom={() => {
              setActiveRoomCode('');
              navigateTo('home');
            }}
          />
        )}

        {view === 'race' && (
          <RaceArenaPage
            key={`race_session_${raceSessionId}`}
            mode={activeMode}
            category={selectedCategory}
            difficulty={selectedDifficulty}
            questionTimeLimitSec={questionTimeLimitSec}
            questions={raceQuestions}
            profile={profile}
            isGuest={!authUser}
            roomCode={activeRoomCode || undefined}
            initialRoom={activeRoom}
            initialPlayers={activeRoomPlayers}
            onSaveLocalGuestResult={handleSaveGuestResult}
            onPlayAgain={() => {
              if (activeMode === '2p' || activeMode === '4p') {
                navigateTo('join');
              } else {
                handleStartSoloOrTimed(activeMode === 'timed' ? 'timed' : 'solo');
              }
            }}
            onChangeSettings={() =>
              handleOpenSetup(
                activeMode === '2p' || activeMode === '4p' ? 'multiplayer' : 'solo'
              )
            }
            onOpenLeaderboard={() => navigateTo('leaderboard')}
            onExitToHome={() => {
              setActiveRoomCode('');
              navigateTo('home');
            }}
          />
        )}

        {view === 'profile' && (
          <ProfileAndScoresPage
            profile={profile}
            isGuest={!authUser}
            guestResults={guestResults}
            onSignIn={handleSignIn}
            onBackHome={() => navigateTo('home')}
            onProfileUpdated={(updated) => {
              const next = { ...profile, ...updated };
              setProfile(next);
              if (!authUser) {
                try {
                  localStorage.setItem(
                    'calc_racer_guest_profile',
                    JSON.stringify(next)
                  );
                } catch {
                  // ignore
                }
              }
            }}
          />
        )}

        {view === 'admin' && (
          <AdminDashboardPage
            isAdmin={isAdmin}
            adminUid={authUser?.uid || ''}
            adminEmail={authUser?.email || ''}
            onExitAdmin={() => navigateTo('home')}
          />
        )}
      </main>

      {/* CLEAN LIGHT FOOTER (Admin link hidden from normal users & guests) */}
      <footer className="mt-12 border-t border-slate-200 bg-white px-4 py-6 text-xs text-slate-500 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <span className="font-semibold text-slate-600">
            Calculation Racer · Ready, Set, Solve!
          </span>
          <div className="flex items-center gap-6 font-semibold">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="hover:text-sky-600"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleOpenSetup('solo')}
              className="hover:text-sky-600"
            >
              Play Game
            </button>
            <button
              type="button"
              onClick={() => navigateTo('leaderboard')}
              className="hover:text-sky-600"
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => navigateTo('profile')}
              className="hover:text-sky-600"
            >
              My Profile
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigateTo('admin')}
                className="text-sky-700 hover:text-sky-800"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
