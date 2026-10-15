import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Gamepad2,
  MessageCircle,
  RotateCcw,
  Share2,
  Sparkles,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  CAR_PALETTE,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  GameMode,
  IQ_RELAY_ALL_FIELDS,
  IqFieldPerformance,
  IqRelayField,
  OperationType,
  PlayerProfile,
  QuestionCategory,
  QuestionDifficulty,
  QuestionItem,
  RoomPlayerRecord,
  RoomRecord,
  TROJO_GAME_MAP,
  TrojoGameId,
} from '../game/types';
import { RaceTrackCanvas, TrackRacer } from '../game/RaceTrackCanvas';
import {
  recordRaceCompletionAndStats,
  resolveQuestionAnswer,
  submitQuestionReport,
} from '../lib/gameService';
import { soundEngine } from '../lib/sound';
import {
  buildScoreShareText,
  copyToClipboard,
  generateScoreCardImage,
  getPublicGameUrl,
  getSocialShareLinks,
} from '../lib/shareUtils';

interface RaceArenaPageProps {
  gameId?: TrojoGameId;
  mode: GameMode;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  questionTimeLimitSec: number;
  questions: QuestionItem[];
  profile: PlayerProfile;
  isGuest: boolean;
  roomCode?: string;
  initialRoom?: RoomRecord | null;
  initialPlayers?: RoomPlayerRecord[];
  onSaveLocalGuestResult: (result: {
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
  }) => void;
  onPlayAgain: () => void;
  onReplayMultiplayer?: (roomCode: string) => Promise<void>;
  onPlayMoreGames: () => void;
  onChangeSettings: () => void;
  onOpenLeaderboard: () => void;
  onExitToHome: () => void;
}

export const RaceArenaPage: React.FC<RaceArenaPageProps> = ({
  gameId: propGameId,
  mode,
  category,
  difficulty,
  questionTimeLimitSec,
  questions,
  profile,
  isGuest,
  roomCode,
  initialRoom,
  initialPlayers = [],
  onSaveLocalGuestResult,
  onPlayAgain,
  onReplayMultiplayer,
  onPlayMoreGames,
  onOpenLeaderboard,
  onExitToHome,
}) => {
  const isMultiplayer = mode !== 'solo' && Boolean(roomCode);
  const [room, setRoom] = useState<RoomRecord | null>(initialRoom || null);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayerRecord[]>(initialPlayers);

  const activeGameId: TrojoGameId =
    room?.gameId || propGameId || 'calculation_racer';
  const gameInfo = TROJO_GAME_MAP[activeGameId] || TROJO_GAME_MAP.calculation_racer;

  // Player game state
  const [questionIndex, setQuestionIndex] = useState(0);
  const [distance, setDistance] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [raceStartedAtMs] = useState<number>(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [raceFinished, setRaceFinished] = useState(false);

  // Per-question countdown timer (delta-time accurate)
  const effectiveTimeLimitSec = Math.max(5, Number(questionTimeLimitSec) || 20);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(effectiveTimeLimitSec);
  const [questionTimeProgressPct, setQuestionTimeProgressPct] = useState(100);
  const remainingMsRef = useRef<number>(effectiveTimeLimitSec * 1000);
  const lastTickBookmarkRef = useRef<number>(Date.now());
  const lastBeepSecRef = useRef<number>(-1);
  const questionStartMsRef = useRef<number>(Date.now());

  // Game-specific interactive states
  const [typedAnswer, setTypedAnswer] = useState('');
  const [bluffInput, setBluffInput] = useState('');
  const [bluffSubmitted, setBluffSubmitted] = useState(false);
  const [iqRoundHistory, setIqRoundHistory] = useState<
    { field: IqRelayField; isCorrect: boolean; timeTakenMs: number }[]
  >([]);

  // Answer feedback state
  const [feedback, setFeedback] = useState<{
    selectedOption: number;
    correctOption: number;
    isCorrect: boolean;
    explanation: string;
    pointsDelta: number;
    bluffBonus?: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);
  const savedResultRef = useRef(false);

  // Question Report Modal State
  const [reportingQuestion, setReportingQuestion] = useState<QuestionItem | null>(
    null
  );
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // Share Score Modal State (Strictly WhatsApp & Instagram)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [scoreCardDataUrl, setScoreCardDataUrl] = useState<string>('');
  const [scoreCardBlob, setScoreCardBlob] = useState<Blob | null>(null);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);

  // Lock page scrolling during active gameplay and warn before accidental refresh/close
  useEffect(() => {
    if (!raceFinished) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [raceFinished]);

  useEffect(() => {
    if (raceFinished) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [raceFinished]);

  const currentQuestion = questions[questionIndex] || null;
  const totalQuestions = questions.length;

  // Reset interactive inputs on each new question
  useEffect(() => {
    setTypedAnswer('');
    setBluffInput('');
    setBluffSubmitted(false);
  }, [questionIndex]);

  // Subscribe to multiplayer room & players
  useEffect(() => {
    if (!isMultiplayer || !roomCode) return;

    const unsubRoom = onSnapshot(
      doc(db, 'rooms', roomCode),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as RoomRecord;
          setRoom(data);
          if (data.status === 'finished') {
            setRaceFinished(true);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `rooms/${roomCode}`)
    );

    const qPlayers = query(
      collection(db, 'rooms', roomCode, 'players'),
      where('roomCode', '==', roomCode)
    );
    const unsubPlayers = onSnapshot(
      qPlayers,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as RoomPlayerRecord);
        setRoomPlayers(list);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, `rooms/${roomCode}/players`)
    );

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [isMultiplayer, roomCode]);

  // Elapsed race clock
  useEffect(() => {
    if (raceFinished) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - raceStartedAtMs;
      setElapsedMs(elapsed);

      if (mode === 'timed' && elapsed >= 60000) {
        setRaceFinished(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [raceFinished, raceStartedAtMs, mode]);

  const finishRaceSession = useCallback(
    async (
      finalDistance: number,
      finalScore: number,
      finalCorrect: number,
      finalWrong: number,
      finalDurationMs: number
    ) => {
      if (savedResultRef.current) return;
      savedResultRef.current = true;
      setRaceFinished(true);
      soundEngine.playVictory();

      const totalAnswered = finalCorrect + finalWrong;
      const accuracy =
        totalAnswered > 0 ? Math.round((finalCorrect / totalAnswered) * 100) : 0;

      let placement = 1;
      if (isMultiplayer && roomPlayers.length > 0) {
        const betterPlayers = roomPlayers.filter(
          (p) =>
            p.playerId !== profile.uid &&
            ((p.score || 0) > finalScore ||
              ((p.score || 0) === finalScore && p.distance > finalDistance))
        );
        placement = Math.min(8, betterPlayers.length + 1);
      }

      if (isGuest) {
        onSaveLocalGuestResult({
          gameId: activeGameId,
          category,
          difficulty,
          mode,
          score: finalScore,
          correctAnswers: finalCorrect,
          wrongAnswers: finalWrong,
          accuracy,
          distance: finalDistance,
          durationMs: finalDurationMs,
          completedAtMs: Date.now(),
        });
        return;
      }

      await recordRaceCompletionAndStats(profile, {
        roomCode: roomCode || `solo_${Date.now()}`,
        playerId: profile.uid,
        nickname: profile.nickname,
        carColor: profile.carColor,
        mode,
        gameId: activeGameId,
        category,
        difficulty,
        placement,
        score: finalScore,
        correctAnswers: finalCorrect,
        wrongAnswers: finalWrong,
        accuracy,
        distance: finalDistance,
        durationMs: finalDurationMs,
        isPublic: profile.isPublicProfile,
        completedAtMs: Date.now(),
      });
    },
    [
      isMultiplayer,
      roomPlayers,
      profile,
      isGuest,
      onSaveLocalGuestResult,
      activeGameId,
      category,
      difficulty,
      mode,
      roomCode,
    ]
  );

  // Trigger final result saving if multiplayer room finishes externally
  useEffect(() => {
    if (raceFinished && !savedResultRef.current) {
      finishRaceSession(
        distance,
        score,
        correctCount,
        wrongCount,
        Date.now() - raceStartedAtMs
      );
    }
  }, [
    raceFinished,
    distance,
    score,
    correctCount,
    wrongCount,
    raceStartedAtMs,
    finishRaceSession,
  ]);

  const handleSubmitBluff = async (customBluff?: string) => {
    const text = (customBluff ?? bluffInput).trim().slice(0, 80);
    if (!text) return;
    soundEngine.playClick();
    setBluffInput(text);
    setBluffSubmitted(true);
    if (isMultiplayer && roomCode) {
      updateDoc(doc(db, 'rooms', roomCode, 'players', profile.uid), {
        distance,
        score,
        bluffText: text,
        votedOption: -1,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        currentQuestionIndex: questionIndex,
        finished: false,
        finishTimeMs: 0,
        placement: 0,
        connected: true,
        lastSeenAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const handleSelectOption = async (selectedOption: number) => {
    if (!currentQuestion || submitting || feedback !== null || raceFinished) {
      return;
    }
    setSubmitting(true);

    const timeTakenMs = Math.min(
      120000,
      Math.max(0, Date.now() - questionStartMsRef.current)
    );

    const resolved = await resolveQuestionAnswer(currentQuestion, selectedOption);
    const isCorrect = resolved.isCorrect;

    // Calculate game-appropriate movement & score
    const distanceDelta: -5 | 0 | 10 = isCorrect ? 10 : -5;
    const nextDistance = Math.min(100, Math.max(0, distance + distanceDelta));

    // Modest capped speed bonus (+0 to +5 pts) for Solve the Puzzle, Word Scramble, Emoji Decode, and IQ Relay
    const supportsSpeedBonus =
      activeGameId === 'solve_the_puzzle' ||
      activeGameId === 'word_scramble' ||
      activeGameId === 'emoji_decode' ||
      activeGameId === 'iq_relay';
    const speedBonus =
      isCorrect && supportsSpeedBonus
        ? Math.min(
            5,
            Math.max(
              1,
              Math.round((questionTimeLeft / effectiveTimeLimitSec) * 5)
            )
          )
        : 0;

    // Bluff bonus (+5 pts) in Cheat Your Friend when player submits a plausible bluff
    const bluffBonus =
      activeGameId === 'cheat_your_friend' && bluffSubmitted ? 5 : 0;

    const pointsDelta = (isCorrect ? 10 + speedBonus : 0) + bluffBonus;
    const nextScore = score + pointsDelta;
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    const nextWrong = wrongCount + (isCorrect ? 0 : 1);
    const nextQuestionIndex = questionIndex + 1;

    // Track IQ Relay field performance
    if (activeGameId === 'iq_relay') {
      const activeField: IqRelayField =
        currentQuestion.iqField ||
        (currentQuestion.subcategory as IqRelayField) ||
        IQ_RELAY_ALL_FIELDS[questionIndex % IQ_RELAY_ALL_FIELDS.length];
      setIqRoundHistory((prev) => [
        ...prev,
        { field: activeField, isCorrect, timeTakenMs },
      ]);
    }

    if (isCorrect) {
      soundEngine.playAccelerate();
    } else {
      soundEngine.playBrakeWrong();
    }

    setDistance(nextDistance);
    setScore(nextScore);
    setCorrectCount(nextCorrect);
    setWrongCount(nextWrong);
    setFeedback({
      selectedOption,
      correctOption: resolved.correctOption,
      isCorrect,
      explanation: resolved.explanation,
      pointsDelta,
      bluffBonus,
    });

    const crossedFinishLine =
      activeGameId === 'calculation_racer' && nextDistance >= 100;
    const exhaustedQuestions = nextQuestionIndex >= totalQuestions;
    const nowFinished = crossedFinishLine || exhaustedQuestions;
    const finalDurationMs = Date.now() - raceStartedAtMs;

    // Sync multiplayer state to Firestore
    if (isMultiplayer && roomCode) {
      const submissionId = `${profile.uid}_q_${questionIndex}`;
      try {
        if (selectedOption >= -1 && selectedOption <= 3) {
          await setDoc(
            doc(db, 'rooms', roomCode, 'submissions', submissionId),
            {
              roomCode,
              playerId: profile.uid,
              questionId: currentQuestion.id,
              questionIndex,
              selectedOption,
              isCorrect,
              distanceDelta,
              timeTakenMs,
              createdAt: serverTimestamp(),
            }
          );
        }

        const finishedPeers = roomPlayers.filter(
          (p) => p.playerId !== profile.uid && p.finished
        ).length;
        const myPlacement = nowFinished ? Math.min(8, finishedPeers + 1) : 0;

        await updateDoc(doc(db, 'rooms', roomCode, 'players', profile.uid), {
          distance: nextDistance,
          score: nextScore,
          bluffText: bluffInput.slice(0, 80),
          votedOption: selectedOption,
          correctAnswers: nextCorrect,
          wrongAnswers: nextWrong,
          currentQuestionIndex: nextQuestionIndex,
          finished: nowFinished,
          finishTimeMs: nowFinished ? finalDurationMs : 0,
          placement: myPlacement,
          connected: true,
          lastSeenAtMs: Date.now(),
          updatedAt: serverTimestamp(),
        });

        if (
          (crossedFinishLine ||
            (nowFinished &&
              roomPlayers.every(
                (p) => p.playerId === profile.uid || p.finished
              ))) &&
          room &&
          room.status === 'racing'
        ) {
          await updateDoc(doc(db, 'rooms', roomCode), {
            status: 'finished',
            raceFinishedAtMs: Date.now(),
            winnerId: profile.uid,
            winnerNickname: profile.nickname,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `rooms/${roomCode}/players/${profile.uid}`
        );
      }
    }

    setTimeout(() => {
      setFeedback(null);
      setSubmitting(false);
      if (nowFinished) {
        finishRaceSession(
          nextDistance,
          nextScore,
          nextCorrect,
          nextWrong,
          finalDurationMs
        );
      } else {
        setQuestionIndex(nextQuestionIndex);
      }
    }, 1250);
  };

  const handleTypedAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion || feedback !== null || submitting) return;
    const cleanInput = typedAnswer.trim().toUpperCase();
    if (!cleanInput) return;

    const correctIdx = currentQuestion.correctOption ?? 0;
    const correctOptionText = (
      currentQuestion.options[correctIdx] || ''
    )
      .trim()
      .toUpperCase();
    const accepted = (currentQuestion.acceptedAnswers || []).map((a) =>
      a.trim().toUpperCase()
    );

    if (cleanInput === correctOptionText || accepted.includes(cleanInput)) {
      handleSelectOption(correctIdx);
      return;
    }

    const matchingIdx = currentQuestion.options.findIndex(
      (opt) => opt.trim().toUpperCase() === cleanInput
    );
    if (matchingIdx !== -1) {
      handleSelectOption(matchingIdx);
    } else {
      const wrongIdx = (correctIdx + 1) % 4;
      handleSelectOption(wrongIdx);
    }
  };

  // Keep latest handler ref for per-question timeout
  const handleSelectOptionRef = useRef(handleSelectOption);
  useEffect(() => {
    handleSelectOptionRef.current = handleSelectOption;
  });

  // Reset per-question timer when questionIndex changes
  useEffect(() => {
    const limitMs = effectiveTimeLimitSec * 1000;
    remainingMsRef.current = limitMs;
    lastTickBookmarkRef.current = Date.now();
    lastBeepSecRef.current = -1;
    questionStartMsRef.current = Date.now();
    setQuestionTimeLeft(effectiveTimeLimitSec);
    setQuestionTimeProgressPct(100);
  }, [questionIndex, effectiveTimeLimitSec]);

  // Active per-question countdown timer loop
  useEffect(() => {
    if (
      raceFinished ||
      feedback !== null ||
      submitting ||
      !currentQuestion ||
      reportingQuestion !== null
    ) {
      lastTickBookmarkRef.current = Date.now();
      return;
    }

    lastTickBookmarkRef.current = Date.now();
    const limitMs = effectiveTimeLimitSec * 1000;

    const timer = setInterval(() => {
      const now = Date.now();
      const deltaMs = Math.max(0, now - lastTickBookmarkRef.current);
      lastTickBookmarkRef.current = now;

      remainingMsRef.current = Math.max(0, remainingMsRef.current - deltaMs);
      const secLeft = Math.ceil(remainingMsRef.current / 1000);
      const pct = Math.max(
        0,
        Math.min(100, (remainingMsRef.current / limitMs) * 100)
      );

      setQuestionTimeLeft(secLeft);
      setQuestionTimeProgressPct(pct);

      if (secLeft > 0 && secLeft <= 3 && secLeft !== lastBeepSecRef.current) {
        lastBeepSecRef.current = secLeft;
        soundEngine.playCountdownBeep(false);
      }

      if (remainingMsRef.current <= 0) {
        clearInterval(timer);
        handleSelectOptionRef.current(-1);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [
    questionIndex,
    effectiveTimeLimitSec,
    raceFinished,
    feedback,
    submitting,
    currentQuestion,
    reportingQuestion,
  ]);

  // Build track racers list
  const trackRacers: TrackRacer[] = useMemo(() => {
    if (isMultiplayer && roomPlayers.length > 0) {
      return roomPlayers.map((p) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        carColor: p.carColor,
        distance: p.playerId === profile.uid ? distance : p.distance,
        correctAnswers:
          p.playerId === profile.uid ? correctCount : p.correctAnswers,
        wrongAnswers: p.playerId === profile.uid ? wrongCount : p.wrongAnswers,
        finished: p.playerId === profile.uid ? raceFinished : p.finished,
        placement: p.placement,
        isCurrentUser: p.playerId === profile.uid,
      }));
    }

    return [
      {
        playerId: profile.uid,
        nickname: profile.nickname,
        carColor: profile.carColor,
        distance,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        finished: raceFinished,
        placement: 1,
        isCurrentUser: true,
      },
    ];
  }, [
    isMultiplayer,
    roomPlayers,
    profile.uid,
    profile.nickname,
    profile.carColor,
    distance,
    correctCount,
    wrongCount,
    raceFinished,
  ]);

  // Final standings sorted by score and distance
  const standings = useMemo(() => {
    const list = trackRacers.map((r) => {
      const rp = roomPlayers.find((p) => p.playerId === r.playerId);
      return {
        ...r,
        score:
          r.playerId === profile.uid
            ? score
            : (rp?.score ?? r.correctAnswers * 10),
        finishTimeMs: rp?.finishTimeMs || elapsedMs,
      };
    });
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.distance !== a.distance) return b.distance - a.distance;
      return a.finishTimeMs - b.finishTimeMs;
    });
    const ranked: (typeof list[0] & { placement: number })[] = [];
    list.forEach((item, idx) => {
      if (idx === 0) {
        ranked.push({ ...item, placement: 1 });
        return;
      }
      const prev = ranked[idx - 1];
      const isTied = item.score === prev.score && item.distance === prev.distance;
      ranked.push({
        ...item,
        placement: isTied ? prev.placement : idx + 1,
      });
    });
    return ranked;
  }, [trackRacers, roomPlayers, profile.uid, score, elapsedMs]);

  const totalAnswered = correctCount + wrongCount;
  const accuracyPct =
    totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  const myStanding = standings.find((s) => s.playerId === profile.uid);
  const myPlacement = myStanding?.placement || 1;
  const durationSecStr = (elapsedMs / 1000).toFixed(1);

  const playfulReaction = useMemo(() => {
    if (accuracyPct >= 80 || (isMultiplayer && myPlacement === 1 && score > 0)) {
      return 'BEAST MODE!';
    }
    if (accuracyPct >= 50) {
      return 'NICE RUN!';
    }
    return 'NEXT TIME!';
  }, [accuracyPct, isMultiplayer, myPlacement, score]);

  // IQ Relay Field Breakdown Summary
  const iqBreakdown: IqFieldPerformance[] = useMemo(() => {
    if (activeGameId !== 'iq_relay') return [];
    const map = new Map<
      IqRelayField,
      { correct: number; total: number; totalTimeMs: number }
    >();
    iqRoundHistory.forEach((r) => {
      const cur = map.get(r.field) || { correct: 0, total: 0, totalTimeMs: 0 };
      cur.total += 1;
      if (r.isCorrect) cur.correct += 1;
      cur.totalTimeMs += r.timeTakenMs;
      map.set(r.field, cur);
    });
    return Array.from(map.entries()).map(([field, stats]) => ({
      field,
      correct: stats.correct,
      total: stats.total,
      avgTimeMs:
        stats.total > 0 ? Math.round(stats.totalTimeMs / stats.total) : 0,
    }));
  }, [activeGameId, iqRoundHistory]);

  const iqSummaryMeta = useMemo(() => {
    if (iqBreakdown.length === 0) {
      return {
        strongestField: 'Numerical Reasoning',
        practiceField: 'Pattern Recognition',
        title: 'All-Round Relay Ace',
      };
    }
    const sorted = [...iqBreakdown].sort((a, b) => {
      const accA = a.total > 0 ? a.correct / a.total : 0;
      const accB = b.total > 0 ? b.correct / b.total : 0;
      if (accB !== accA) return accB - accA;
      return a.avgTimeMs - b.avgTimeMs;
    });
    const strongest = sorted[0].field;
    const weakest = sorted[sorted.length - 1].field;

    const titleMap: Record<IqRelayField, string> = {
      'Numerical Reasoning': 'Number Ninja',
      'Logical Reasoning': 'Logic Legend',
      'Pattern Recognition': 'Pattern Pro',
      'Verbal Reasoning': 'Word Wizard',
      'Memory Challenge': 'Memory Maestro',
      'Spatial Reasoning': 'Spatial Architect',
      'Quick Maths': 'Math Sprinter',
    };

    return {
      strongestField: strongest,
      practiceField: weakest,
      title: titleMap[strongest] || 'Logic Legend',
    };
  }, [iqBreakdown]);

  const sharePayload = useMemo(
    () => ({
      nickname: profile.nickname,
      carColor: profile.carColor,
      gameId: activeGameId,
      mode,
      category,
      difficulty,
      score,
      correctAnswers: correctCount,
      totalQuestions,
      accuracy: accuracyPct,
      distance,
      durationSec: durationSecStr,
      placement: myPlacement,
      totalPlayers: standings.length,
      reactionTitle: playfulReaction,
    }),
    [
      profile.nickname,
      profile.carColor,
      activeGameId,
      mode,
      category,
      difficulty,
      score,
      correctCount,
      totalQuestions,
      accuracyPct,
      distance,
      durationSecStr,
      myPlacement,
      standings.length,
      playfulReaction,
    ]
  );

  const shareText = useMemo(
    () => buildScoreShareText(sharePayload),
    [sharePayload]
  );
  const socialLinks = useMemo(
    () => getSocialShareLinks(shareText, getPublicGameUrl()),
    [shareText]
  );

  const showShareFeedback = (msg: string) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(null), 3200);
  };

  const handleOpenShareModal = async () => {
    soundEngine.playClick();
    setShareModalOpen(true);
    setGeneratingCard(true);
    try {
      const { dataUrl, blob } = await generateScoreCardImage(sharePayload);
      setScoreCardDataUrl(dataUrl);
      setScoreCardBlob(blob);
    } finally {
      setGeneratingCard(false);
    }
  };

  const handleDownloadScoreCard = () => {
    soundEngine.playClick();
    if (!scoreCardDataUrl) return;
    const link = document.createElement('a');
    link.href = scoreCardDataUrl;
    link.download = `trojo-${activeGameId}-${score}pts.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showShareFeedback('Saved 9:16 Score Image to your device!');
  };

  const handleWhatsAppShare = async () => {
    soundEngine.playClick();
    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      scoreCardBlob &&
      navigator.canShare
    ) {
      const file = new File(
        [scoreCardBlob],
        `trojo-score-${score}.png`,
        { type: 'image/png' }
      );
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `TROJO — A Fun Nagar · ${score} pts`,
            text: shareText,
            files: [file],
          });
          return;
        } catch {
          // Fallback to WhatsApp link below
        }
      }
    }
    window.open(socialLinks.whatsapp, '_blank', 'noopener,noreferrer');
    showShareFeedback(
      'Opened WhatsApp with your challenge message! Tap "Save Score Image" to attach the picture too.'
    );
  };

  const handleInstagramShare = async () => {
    soundEngine.playClick();
    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      scoreCardBlob &&
      navigator.canShare
    ) {
      const file = new File(
        [scoreCardBlob],
        `trojo-story-${score}.png`,
        { type: 'image/png' }
      );
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `TROJO — A Fun Nagar Story`,
            text: shareText,
            files: [file],
          });
          return;
        } catch {
          // Fallback below
        }
      }
    }
    if (scoreCardDataUrl) {
      const link = document.createElement('a');
      link.href = scoreCardDataUrl;
      link.download = `trojo-story-${score}pts.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    await copyToClipboard(shareText);
    showShareFeedback(
      'Saved 9:16 Story image & copied challenge message! Open Instagram and select the saved image to post your Story manually.'
    );
  };

  const handleReplayClick = async () => {
    soundEngine.playClick();
    if (isMultiplayer && roomCode && onReplayMultiplayer) {
      setRematchBusy(true);
      setRematchError(null);
      try {
        await onReplayMultiplayer(roomCode);
      } catch (err) {
        setRematchError(
          err instanceof Error
            ? err.message
            : 'Room is no longer active. Opening room setup...'
        );
        onPlayAgain();
      } finally {
        setRematchBusy(false);
      }
      return;
    }
    onPlayAgain();
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingQuestion || !reportReason.trim()) return;
    await submitQuestionReport(profile, reportingQuestion, reportReason);
    setReportSubmitted(true);
    setTimeout(() => {
      setReportingQuestion(null);
      setReportReason('');
      setReportSubmitted(false);
    }, 1200);
  };

  const formatDuration = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  const otherPlayerBluffs = useMemo(() => {
    if (activeGameId !== 'cheat_your_friend' || !isMultiplayer) return [];
    return roomPlayers
      .filter((p) => p.playerId !== profile.uid && p.bluffText?.trim())
      .map((p) => ({ nickname: p.nickname, bluffText: p.bluffText!.trim() }));
  }, [activeGameId, isMultiplayer, roomPlayers, profile.uid]);

  return (
    <div
      className={`mx-auto w-full max-w-7xl px-2.5 py-2 sm:px-6 sm:py-3 ${
        !raceFinished
          ? 'flex h-[100dvh] w-full flex-col justify-between overflow-hidden select-none'
          : ''
      }`}
    >
      {/* Top Game HUD */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-2xs sm:px-5 sm:py-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold sm:gap-2 sm:text-xs">
          {!raceFinished && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setExitConfirmOpen(true);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Exit</span>
            </button>
          )}
          <span className="rounded-lg bg-sky-100 px-2 py-0.5 text-sky-900 sm:px-2.5 sm:py-1">
            {gameInfo.emoji} {gameInfo.name}
          </span>
          <span className="rounded-lg bg-purple-100 px-2 py-0.5 text-purple-800 sm:px-2.5 sm:py-1">
            {isMultiplayer ? `Room ${roomCode}` : 'Solo'}
          </span>
          <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-emerald-800 sm:px-2.5 sm:py-1">
            {DIFFICULTY_LABELS[difficulty]}
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-slate-700 tabular-nums sm:px-2.5 sm:py-1">
            Q{Math.min(totalQuestions, questionIndex + 1)}/{totalQuestions}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums sm:gap-3.5 sm:text-xs">
          <div>
            <span className="text-slate-500">Score: </span>
            <span className="font-extrabold text-purple-700">{score} pts</span>
          </div>
          {activeGameId === 'calculation_racer' && (
            <div>
              <span className="text-slate-500">Track: </span>
              <span className="font-extrabold text-sky-600">{distance}/100m</span>
            </div>
          )}
          <div>
            <span className="text-slate-500">Acc: </span>
            <span className="font-extrabold text-emerald-600">{accuracyPct}%</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 font-bold text-slate-800 sm:px-2.5 sm:py-1">
            <Clock className="h-3.5 w-3.5 text-sky-600" />
            <span>{formatDuration(elapsedMs)}</span>
          </div>
          {!raceFinished && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setFinishConfirmOpen(true);
              }}
              className="h-7 rounded-lg bg-[#2563EB] px-2.5 font-sans text-[11px] font-extrabold text-white hover:bg-blue-700"
            >
              Finish Game
            </button>
          )}
        </div>
      </div>

      {/* Calculation Racer Track OR Multiplayer Scoreboard Strip */}
      {activeGameId === 'calculation_racer' ? (
        <div className="mt-2 sm:mt-4">
          <RaceTrackCanvas
            racers={trackRacers}
            maxLanes={isMultiplayer ? room?.maxPlayers || 2 : 1}
          />
        </div>
      ) : (
        isMultiplayer &&
        standings.length > 1 && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4">
            {standings.map((p) => {
              const cInfo = CAR_PALETTE[p.carColor] || CAR_PALETTE.blue;
              return (
                <div
                  key={p.playerId}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                      style={{ backgroundColor: cInfo.primary }}
                    >
                      #{p.placement}
                    </span>
                    <span className="truncate text-xs font-extrabold text-slate-900">
                      {p.nickname}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-extrabold text-purple-700">
                    {p.score} pts
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ACTIVE GAME ROUND CARD OR UNIFIED FINAL RESULTS SCREEN */}
      {!raceFinished && currentQuestion ? (
        <div className="mt-2.5 rounded-3xl border border-slate-200 bg-white p-3.5 shadow-xs sm:mt-4 sm:p-6">
          {/* Synchronized Round Timer Bar */}
          <div className="mb-3 sm:mb-4">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
              <span className="text-slate-600">
                {activeGameId === 'iq_relay' && currentQuestion.iqField ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-100 px-2.5 py-1 text-orange-900">
                    <Brain className="h-3.5 w-3.5 text-orange-600" />
                    <span>Relay Field: {currentQuestion.iqField}</span>
                  </span>
                ) : currentQuestion.subcategory ? (
                  `Topic: ${currentQuestion.subcategory}`
                ) : (
                  gameInfo.tagline
                )}
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 font-mono text-xs font-extrabold tabular-nums ${
                  questionTimeLeft <= 5
                    ? 'bg-rose-100 text-rose-700 motion-safe:animate-pulse'
                    : 'bg-sky-50 text-sky-700'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{questionTimeLeft}s left</span>
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-100 ${
                  questionTimeLeft <= 5 ? 'bg-rose-500' : 'bg-sky-500'
                }`}
                style={{
                  width: `${questionTimeProgressPct}%`,
                }}
              />
            </div>
          </div>

          {/* GAME-SPECIFIC STAGE DISPLAYS */}
          {/* 1. Word Scramble Letter Tiles + Direct Word Input */}
          {activeGameId === 'word_scramble' && currentQuestion.scrambledLetters && (
            <div className="mb-4 rounded-2xl border-2 border-orange-200 bg-orange-50/60 p-4 text-center">
              <p className="text-xs font-extrabold uppercase tracking-wider text-orange-800">
                Unscramble These Letters
              </p>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                {currentQuestion.scrambledLetters
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((letter, idx) => (
                    <span
                      key={idx}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-orange-300 bg-white font-mono text-lg font-extrabold text-slate-900 shadow-2xs"
                    >
                      {letter}
                    </span>
                  ))}
              </div>

              <form
                onSubmit={handleTypedAnswerSubmit}
                className="mx-auto mt-3 flex max-w-md gap-2"
              >
                <input
                  type="text"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value.toUpperCase())}
                  placeholder="Type unscrambled word..."
                  disabled={feedback !== null || submitting}
                  className="min-h-[42px] flex-1 rounded-xl border-2 border-orange-200 bg-white px-3.5 py-1.5 font-mono text-sm font-extrabold uppercase text-slate-900 focus:border-orange-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={
                    feedback !== null || submitting || !typedAnswer.trim()
                  }
                  className="min-h-[42px] rounded-xl bg-orange-500 px-4 py-1.5 text-xs font-extrabold text-white shadow-2xs hover:bg-orange-600 disabled:opacity-40"
                >
                  Submit Word
                </button>
              </form>
            </div>
          )}

          {/* 2. Emoji Decode Clue Stage */}
          {activeGameId === 'emoji_decode' && currentQuestion.emojiClue && (
            <div className="mb-4 rounded-2xl border-2 border-purple-200 bg-purple-50/60 p-4 text-center">
              <p className="text-xs font-extrabold uppercase tracking-wider text-purple-800">
                Emoji Mystery Clue
              </p>
              <div className="mt-2 text-3xl sm:text-4xl">
                {currentQuestion.emojiClue}
              </div>

              <form
                onSubmit={handleTypedAnswerSubmit}
                className="mx-auto mt-3 flex max-w-md gap-2"
              >
                <input
                  type="text"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  placeholder="Type your decoded answer or pick below..."
                  disabled={feedback !== null || submitting}
                  className="min-h-[42px] flex-1 rounded-xl border-2 border-purple-200 bg-white px-3.5 py-1.5 text-sm font-bold text-slate-900 focus:border-purple-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={
                    feedback !== null || submitting || !typedAnswer.trim()
                  }
                  className="min-h-[42px] rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-extrabold text-white shadow-2xs hover:bg-purple-500 disabled:opacity-40"
                >
                  Submit
                </button>
              </form>
            </div>
          )}

          {/* 3. IQ Relay Memory Challenge Target */}
          {activeGameId === 'iq_relay' && currentQuestion.memoryTarget && (
            <div className="mb-4 rounded-2xl border-2 border-sky-200 bg-sky-50/70 p-3.5 text-center">
              <p className="text-xs font-extrabold uppercase tracking-wider text-sky-800">
                Memory Sequence Target
              </p>
              <p className="mt-1 font-mono text-xl font-extrabold tracking-widest text-slate-900">
                {currentQuestion.memoryTarget}
              </p>
            </div>
          )}

          {/* 4. Cheat Your Friend Bluff Input Stage */}
          {activeGameId === 'cheat_your_friend' && (
            <div className="mb-4 rounded-2xl border-2 border-purple-200 bg-purple-50/50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-purple-900">
                  🎭 Step 1: Plant a Fake Answer to Bluff the Room (+5 Bluff Bonus)
                </span>
                {bluffSubmitted && (
                  <span className="rounded-lg bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800">
                    ✓ Bluff Planted: &ldquo;{bluffInput}&rdquo;
                  </span>
                )}
              </div>

              {!bluffSubmitted && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <input
                    type="text"
                    maxLength={60}
                    value={bluffInput}
                    onChange={(e) => setBluffInput(e.target.value)}
                    placeholder="Write a believable fake answer..."
                    className="min-h-[40px] flex-1 rounded-xl border border-purple-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSubmitBluff()}
                    disabled={!bluffInput.trim()}
                    className="min-h-[40px] rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-extrabold text-white hover:bg-purple-500 disabled:opacity-40"
                  >
                    Submit Bluff
                  </button>
                </div>
              )}

              {otherPlayerBluffs.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-purple-200/60 pt-2 text-xs">
                  <span className="font-extrabold text-purple-800">
                    Room Bluffs:
                  </span>
                  {otherPlayerBluffs.map((b, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-white px-2.5 py-1 font-bold text-slate-700 shadow-2xs"
                    >
                      &ldquo;{b.bluffText}&rdquo;
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Question Header & Text */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-base font-extrabold leading-snug text-slate-900 sm:text-2xl">
              {currentQuestion.questionText}
            </h2>
            <button
              type="button"
              onClick={() => setReportingQuestion(currentQuestion)}
              className="flex min-h-[34px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
              title="Report an issue with this question"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>Report</span>
            </button>
          </div>

          {/* 4 Validated Multiple-Choice Option Buttons (2x2 Grid on Mobile for Zero-Scroll Fit) */}
          <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3.5">
            {currentQuestion.options.map((optText, idx) => {
              const optionLetters = ['A', 'B', 'C', 'D'];
              const badgeThemes = [
                'bg-sky-100 text-sky-700 border-sky-200',
                'bg-purple-100 text-purple-700 border-purple-200',
                'bg-emerald-100 text-emerald-700 border-emerald-200',
                'bg-amber-100 text-amber-800 border-amber-200',
              ];

              let btnStyle =
                'border-slate-200 bg-slate-50/70 text-slate-900 hover:border-sky-400 hover:bg-sky-50/60 hover:shadow-2xs';

              if (feedback !== null) {
                if (idx === feedback.correctOption) {
                  btnStyle =
                    'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20';
                } else if (
                  idx === feedback.selectedOption &&
                  !feedback.isCorrect
                ) {
                  btnStyle =
                    'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/20';
                } else {
                  btnStyle =
                    'border-slate-200 bg-slate-50/40 text-slate-400 opacity-75';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={feedback !== null || submitting}
                  onClick={() => handleSelectOption(idx)}
                  className={`flex min-h-[48px] items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2.5 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 sm:min-h-[60px] sm:gap-4 sm:px-5 sm:py-3.5 ${btnStyle}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold sm:h-8 sm:w-8 sm:rounded-xl ${badgeThemes[idx]}`}
                    >
                      {optionLetters[idx]}
                    </span>
                    <span className="text-sm font-bold leading-snug sm:text-base break-words">
                      {optText}
                    </span>
                  </div>

                  {feedback !== null && idx === feedback.correctOption && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 sm:h-5 sm:w-5" />
                  )}
                  {feedback !== null &&
                    idx === feedback.selectedOption &&
                    !feedback.isCorrect && (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600 sm:h-5 sm:w-5" />
                    )}
                </button>
              );
            })}
          </div>

          {/* Live Answer Feedback Banner */}
          {feedback && (
            <div
              className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-sm ${
                feedback.isCorrect
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-rose-300 bg-rose-50 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2 font-extrabold">
                {feedback.isCorrect ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      {activeGameId === 'cheat_your_friend'
                        ? `TRUTH SPOTTED! +${feedback.pointsDelta} pts!`
                        : activeGameId === 'calculation_racer'
                          ? `Awesome! +10m forward & +${feedback.pointsDelta} pts!`
                          : `Correct! +${feedback.pointsDelta} pts!`}
                    </span>
                  </>
                ) : feedback.selectedOption === -1 ? (
                  <>
                    <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      Time&rsquo;s up!{' '}
                      {activeGameId === 'calculation_racer' ? '-5m penalty.' : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>
                      {activeGameId === 'cheat_your_friend'
                        ? 'GOTCHA! That was a bluff!'
                        : activeGameId === 'calculation_racer'
                          ? 'Wrong answer! -5m backward.'
                          : 'Not quite!'}
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs font-medium text-slate-700">
                {feedback.explanation}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ==================== CONSISTENT RESULTS SCREEN AFTER EVERY GAME ==================== */
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          {/* Hero Score & Playful Reaction */}
          <div className="mx-auto max-w-xl text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50 text-4xl shadow-2xs">
              {gameInfo.emoji}
            </div>

            <div className="mt-3">
              <span className="inline-block rounded-full bg-orange-100 px-4 py-1 font-display text-xs font-extrabold tracking-wider text-orange-800 uppercase">
                {playfulReaction}
              </span>
            </div>

            <h2 className="mt-2 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {gameInfo.name} Complete!
            </h2>

            {/* Very Large Bold Final Score */}
            <div className="mt-4 rounded-3xl border-2 border-purple-200 bg-purple-50/60 px-6 py-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-purple-800">
                {activeGameId === 'iq_relay'
                  ? 'IQ Relay Performance Score'
                  : 'Final Score'}
              </p>
              <p className="mt-1 font-display text-6xl font-extrabold tracking-tight text-slate-900 tabular-nums sm:text-7xl">
                {score}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-600">
                {isMultiplayer && (
                  <span className="rounded-lg bg-amber-100 px-2.5 py-1 font-extrabold text-amber-900">
                    Rank #{myPlacement} of {standings.length}
                  </span>
                )}
                <span className="rounded-lg bg-white px-2.5 py-1">
                  {correctCount}/{totalQuestions} Correct ({accuracyPct}%)
                </span>
                <span className="rounded-lg bg-white px-2.5 py-1">
                  Time: {formatDuration(elapsedMs)}
                </span>
                <span className="rounded-lg bg-white px-2.5 py-1">
                  {DIFFICULTY_LABELS[difficulty]}
                </span>
              </div>
            </div>
          </div>

          {/* IQ Relay Performance Breakdown (Only when IQ Relay is played) */}
          {activeGameId === 'iq_relay' && (
            <div className="mt-6 rounded-2xl border-2 border-orange-200 bg-orange-50/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-200/70 pb-3">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-orange-800">
                    Relay Title Earned
                  </span>
                  <h3 className="font-display text-xl font-extrabold text-slate-900">
                    🏅 {iqSummaryMeta.title}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-xl bg-emerald-100 px-3 py-1.5 text-emerald-900">
                    Strongest: {iqSummaryMeta.strongestField}
                  </span>
                  <span className="rounded-xl bg-amber-100 px-3 py-1.5 text-amber-900">
                    To Practise: {iqSummaryMeta.practiceField}
                  </span>
                </div>
              </div>

              {iqBreakdown.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {iqBreakdown.map((item) => {
                    const pct =
                      item.total > 0
                        ? Math.round((item.correct / item.total) * 100)
                        : 0;
                    return (
                      <div
                        key={item.field}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800">{item.field}</span>
                          <span className="font-mono text-purple-700">
                            {item.correct}/{item.total} ({pct}%) ·{' '}
                            {(item.avgTimeMs / 1000).toFixed(1)}s avg
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-orange-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 text-[11px] font-medium text-slate-500">
                Note: IQ Relay Performance Score is a casual game score based on round accuracy and speed, not a standardized scientific IQ measurement.
              </p>
            </div>
          )}

          {/* Multiplayer Standings Leaderboard-Style Results (1st, 2nd, 3rd Highlighted) */}
          {standings.length > 1 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                Final Standings · Room {roomCode}
              </h3>
              <div className="mt-3 space-y-2">
                {standings.map((racer) => {
                  const carInfo =
                    CAR_PALETTE[racer.carColor] || CAR_PALETTE.blue;
                  const isMe = racer.playerId === profile.uid;
                  const rankBadge =
                    racer.placement === 1
                      ? 'bg-amber-400 text-slate-950'
                      : racer.placement === 2
                        ? 'bg-slate-300 text-slate-900'
                        : racer.placement === 3
                          ? 'bg-orange-300 text-orange-950'
                          : 'bg-slate-100 text-slate-700';

                  return (
                    <div
                      key={racer.playerId}
                      className={`flex items-center justify-between rounded-xl border px-4 py-2.5 shadow-2xs ${
                        racer.placement === 1
                          ? 'border-amber-300 bg-amber-50/70'
                          : isMe
                            ? 'border-sky-300 bg-sky-50/60'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`inline-flex h-7 min-w-[36px] shrink-0 items-center justify-center rounded-lg px-2 font-mono text-xs font-black ${rankBadge}`}
                        >
                          {racer.placement === 1
                            ? '1st'
                            : racer.placement === 2
                              ? '2nd'
                              : racer.placement === 3
                                ? '3rd'
                                : `#${racer.placement}`}
                        </span>
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: carInfo.primary }}
                        />
                        <span className="truncate text-sm font-extrabold text-slate-900">
                          {racer.nickname} {isMe ? '(You)' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs font-black tabular-nums">
                        <span className="text-[#7C3AED]">
                          {racer.score} pts
                        </span>
                        <span className="hidden text-emerald-600 sm:inline">
                          {racer.correctAnswers}✓
                        </span>
                        <span className="text-slate-600">
                          {formatDuration(racer.finishTimeMs || elapsedMs)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rematchError && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900">
              {rematchError}
            </div>
          )}

          {/* BOTTOM ACTION BAR — THREE SOLID-FILLED BUTTONS:
              1. Share Score — purple
              2. Replay / Replay With Same Players — green
              3. More Games — blue */}
          <div className="mt-7 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleOpenShareModal}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3.5 font-display text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-purple-500"
            >
              <Share2 className="h-4 w-4" />
              <span>Share Score</span>
            </button>

            <button
              type="button"
              disabled={rematchBusy}
              onClick={handleReplayClick}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 font-display text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              <span>
                {rematchBusy
                  ? 'Preparing Rematch...'
                  : isMultiplayer
                    ? 'Replay With Same Players'
                    : 'Replay'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onPlayMoreGames();
              }}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3.5 font-display text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-sky-500"
            >
              <Gamepad2 className="h-4 w-4" />
              <span>More Games</span>
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenLeaderboard();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-sky-600"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>View Global Leaderboard</span>
            </button>
          </div>
        </div>
      )}

      {/* SHARE SCORE MODAL — ONLY WHATSAPP AND INSTAGRAM */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-xs">
          <div className="my-8 w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-800">
                  <Sparkles className="h-3 w-3" />
                  <span>TROJO — A Fun Nagar</span>
                </span>
                <h3 className="mt-1 font-display text-xl font-extrabold text-slate-900">
                  Share Your Score
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 9:16 Story Score Card Image Preview */}
            <div className="mt-4 flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {generatingCard ? (
                <div className="flex h-64 items-center justify-center text-xs font-bold text-slate-500">
                  Generating 9:16 Score Image...
                </div>
              ) : scoreCardDataUrl ? (
                <img
                  src={scoreCardDataUrl}
                  alt="TROJO — A Fun Nagar Score Card"
                  className="max-h-72 w-auto rounded-xl border border-slate-200 shadow-sm"
                />
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadScoreCard}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Save Score Image</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    soundEngine.playClick();
                    await copyToClipboard(shareText);
                    showShareFeedback('Copied challenge message & link!');
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                >
                  <Copy className="h-3.5 w-3.5 text-purple-600" />
                  <span>Copy Challenge Text</span>
                </button>
              </div>
            </div>

            {/* Strictly Two Social Platforms: WhatsApp & Instagram */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-xs transition-colors hover:bg-emerald-500"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Share on WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleInstagramShare}
                className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-extrabold text-white shadow-xs transition-colors hover:bg-purple-500"
              >
                <Sparkles className="h-4 w-4" />
                <span>Share on Instagram</span>
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] font-medium text-slate-500">
              For Instagram Stories: save the 9:16 score image above, then select it inside Instagram to publish your Story.
            </p>

            {shareToast && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{shareToast}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Question Modal */}
      {reportingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Report Question Issue
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Question: &ldquo;{reportingQuestion.questionText}&rdquo;
            </p>
            <form onSubmit={handleReportSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Describe the issue (typo, unclear wording, or answer key check)
                </label>
                <textarea
                  rows={3}
                  required
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Please describe what seems wrong..."
                  className="mt-1.5 w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                />
              </div>
              {reportSubmitted ? (
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                  Thank you! Report sent to administrator review queue.
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReportingQuestion(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600"
                  >
                    Submit Report
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Exit Active Game Confirmation Modal */}
      {exitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h3 className="font-display text-lg font-black text-slate-900">
              Leave Active Game?
            </h3>
            <p className="mt-1.5 text-xs font-semibold text-slate-500">
              Your current race progress will not be saved if you exit now.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setExitConfirmOpen(false);
                }}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setExitConfirmOpen(false);
                  onExitToHome();
                }}
                className="min-h-[44px] rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-rose-700"
              >
                Exit Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finish Game Confirmation Modal */}
      {finishConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <h3 className="font-display text-lg font-black text-slate-900">
              Finish Game Now?
            </h3>
            <p className="mt-1.5 text-xs font-semibold text-slate-500">
              End this race now and record your current score ({score} pts)?
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setFinishConfirmOpen(false);
                }}
                className="min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={() => {
                  setFinishConfirmOpen(false);
                  finishRaceSession(
                    distance,
                    score,
                    correctCount,
                    wrongCount,
                    Date.now() - raceStartedAtMs
                  );
                }}
                className="min-h-[44px] rounded-2xl bg-[#2563EB] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-blue-700"
              >
                Finish &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
