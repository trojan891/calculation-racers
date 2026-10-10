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
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Flag,
  MessageCircle,
  RotateCcw,
  Send,
  Share2,
  SlidersHorizontal,
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
  OperationType,
  PlayerProfile,
  QuestionCategory,
  QuestionDifficulty,
  QuestionItem,
  RoomPlayerRecord,
  RoomRecord,
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
  onSaveLocalGuestResult?: (result: {
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
  onChangeSettings: () => void;
  onOpenLeaderboard: () => void;
  onExitToHome: () => void;
}

export const RaceArenaPage: React.FC<RaceArenaPageProps> = ({
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
  onChangeSettings,
  onOpenLeaderboard,
  onExitToHome,
}) => {
  const isMultiplayer = (mode === '2p' || mode === '4p') && Boolean(roomCode);
  const totalQuestions = Math.max(1, questions.length);

  // Solo / local state
  const [questionIndex, setQuestionIndex] = useState(0);
  const [distance, setDistance] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [raceFinished, setRaceFinished] = useState(false);
  const [raceStartTimeMs] = useState<number>(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const effectiveTimeLimitSec = Math.max(5, Number(questionTimeLimitSec) || 20);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(effectiveTimeLimitSec);
  const [questionTimeProgressPct, setQuestionTimeProgressPct] = useState(100);

  // Per-question submission feedback state
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    selectedOption: number;
    correctOption: number;
    isCorrect: boolean;
    delta: -5 | 0 | 10;
    pointsDelta: number;
    explanation: string;
  } | null>(null);

  // Multiplayer synchronized state
  const [room, setRoom] = useState<RoomRecord | null>(initialRoom || null);
  const [mpPlayers, setMpPlayers] = useState<RoomPlayerRecord[]>(initialPlayers);

  // Report question modal state
  const [reportingQuestion, setReportingQuestion] = useState<QuestionItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportStatusMsg, setReportStatusMsg] = useState<string | null>(null);

  // Share Score modal & visual card state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [scoreCardDataUrl, setScoreCardDataUrl] = useState<string>('');
  const [scoreCardBlob, setScoreCardBlob] = useState<Blob | null>(null);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const savedResultRef = useRef(false);
  const questionStartMsRef = useRef<number>(Date.now());
  const remainingMsRef = useRef<number>(effectiveTimeLimitSec * 1000);
  const lastTickMsRef = useRef<number>(performance.now());
  const lastBeepSecRef = useRef<number>(-1);
  const lockedQuestionIdxRef = useRef<number>(-1);

  // Subscribe to Multiplayer Room & Players if in 2P/4P mode
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
        setMpPlayers(list);
        const me = list.find((p) => p.playerId === profile.uid);
        if (me) {
          setDistance(me.distance);
          if (me.score !== undefined) setScore(me.score);
          setCorrectCount(me.correctAnswers);
          setWrongCount(me.wrongAnswers);
          if (me.currentQuestionIndex > questionIndex && !feedback) {
            setQuestionIndex(me.currentQuestionIndex);
          }
          if (me.finished) {
            setRaceFinished(true);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `rooms/${roomCode}/players`)
    );

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [isMultiplayer, roomCode, profile.uid, questionIndex, feedback]);

  // Overall race elapsed timer
  useEffect(() => {
    if (raceFinished) return;
    const timer = setInterval(() => {
      const baseStart =
        isMultiplayer && room?.raceStartedAtMs ? room.raceStartedAtMs : raceStartTimeMs;
      setElapsedMs(Math.max(0, Date.now() - baseStart));
    }, 100);
    return () => clearInterval(timer);
  }, [raceFinished, isMultiplayer, room?.raceStartedAtMs, raceStartTimeMs]);

  const currentQuestion = questions[questionIndex] || null;

  // Handle Answer Submission (or -1 for timeout)
  const handleSelectOption = useCallback(
    async (selectedOption: number) => {
      if (
        raceFinished ||
        submitting ||
        feedback !== null ||
        !currentQuestion ||
        lockedQuestionIdxRef.current === questionIndex
      ) {
        return;
      }

      lockedQuestionIdxRef.current = questionIndex;
      setSubmitting(true);
      const timeTakenMs = Math.max(0, Date.now() - questionStartMsRef.current);
      const remainingSecAtSubmit = Math.max(
        0,
        questionTimeLimitSec - timeTakenMs / 1000
      );

      try {
        const evaluation = await resolveQuestionAnswer(currentQuestion, selectedOption);
        const nextDistance = Math.min(100, Math.max(0, distance + evaluation.distanceDelta));
        const speedBonus = evaluation.isCorrect
          ? Math.max(
              0,
              Math.min(
                5,
                Math.ceil((remainingSecAtSubmit / Math.max(1, questionTimeLimitSec)) * 5)
              )
            )
          : 0;
        const pointsDelta = evaluation.isCorrect
          ? 10 + speedBonus
          : selectedOption === -1
            ? 0
            : -2;
        const nextScore = Math.min(200, Math.max(0, score + pointsDelta));

        const nextCorrect = correctCount + (evaluation.isCorrect ? 1 : 0);
        const nextWrong = wrongCount + (!evaluation.isCorrect ? 1 : 0);
        const nextQuestionIndex = questionIndex + 1;
        const reachedFinish = nextDistance >= 100 || nextQuestionIndex >= totalQuestions;

        if (evaluation.isCorrect) {
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
          correctOption: evaluation.correctOption,
          isCorrect: evaluation.isCorrect,
          delta: evaluation.distanceDelta,
          pointsDelta,
          explanation: evaluation.explanation,
        });

        // If Multiplayer, write immutable submission + update RoomPlayer
        if (isMultiplayer && roomCode) {
          const submissionId = `${profile.uid}_q${questionIndex}`;
          await setDoc(doc(db, 'rooms', roomCode, 'submissions', submissionId), {
            roomCode,
            playerId: profile.uid,
            questionId: currentQuestion.id,
            questionIndex,
            selectedOption,
            isCorrect: evaluation.isCorrect,
            distanceDelta: evaluation.distanceDelta,
            timeTakenMs: Math.min(120000, timeTakenMs),
            createdAt: serverTimestamp(),
          }).catch(() => {});

          const baseStart = room?.raceStartedAtMs || raceStartTimeMs;
          const finishDuration = Math.max(0, Date.now() - baseStart);

          await updateDoc(doc(db, 'rooms', roomCode, 'players', profile.uid), {
            distance: nextDistance,
            score: nextScore,
            correctAnswers: nextCorrect,
            wrongAnswers: nextWrong,
            currentQuestionIndex: nextQuestionIndex,
            finished: reachedFinish,
            finishTimeMs: reachedFinish ? finishDuration : 0,
            placement: nextDistance >= 100 && !room?.winnerId ? 1 : 0,
            connected: true,
            lastSeenAtMs: Date.now(),
            updatedAt: serverTimestamp(),
          });

          // If this player crossed the 100m finish line first, mark the room finished!
          if (nextDistance >= 100 && room && room.status === 'racing' && !room.winnerId) {
            await updateDoc(doc(db, 'rooms', roomCode), {
              status: 'finished',
              raceFinishedAtMs: Date.now(),
              winnerId: profile.uid,
              winnerNickname: profile.nickname,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }

        // Advance to next question or conclude race after brief feedback pause
        setTimeout(() => {
          setFeedback(null);
          setSubmitting(false);
          if (reachedFinish) {
            setRaceFinished(true);
            soundEngine.playVictory();
          } else {
            questionStartMsRef.current = Date.now();
            remainingMsRef.current = effectiveTimeLimitSec * 1000;
            lastTickMsRef.current = performance.now();
            lastBeepSecRef.current = -1;
            setQuestionTimeLeft(effectiveTimeLimitSec);
            setQuestionTimeProgressPct(100);
            setQuestionIndex(nextQuestionIndex);
          }
        }, 1250);
      } catch (err) {
        setSubmitting(false);
        lockedQuestionIdxRef.current = -1;
        console.error(err);
      }
    },
    [
      raceFinished,
      submitting,
      feedback,
      currentQuestion,
      questionIndex,
      distance,
      score,
      correctCount,
      wrongCount,
      totalQuestions,
      isMultiplayer,
      roomCode,
      profile.uid,
      profile.nickname,
      room,
      raceStartTimeMs,
      questionTimeLimitSec,
    ]
  );

  const handleSelectOptionRef = useRef(handleSelectOption);
  useEffect(() => {
    handleSelectOptionRef.current = handleSelectOption;
  }, [handleSelectOption]);

  // Reset question timer state whenever questionIndex or effectiveTimeLimitSec changes
  useEffect(() => {
    questionStartMsRef.current = Date.now();
    remainingMsRef.current = effectiveTimeLimitSec * 1000;
    lastTickMsRef.current = performance.now();
    lastBeepSecRef.current = -1;
    setQuestionTimeLeft(effectiveTimeLimitSec);
    setQuestionTimeProgressPct(100);
  }, [questionIndex, effectiveTimeLimitSec, questions]);

  // Per-question countdown timer (ticks smoothly every 100ms, pauses when reportingQuestion modal is open)
  useEffect(() => {
    if (
      raceFinished ||
      feedback !== null ||
      submitting ||
      reportingQuestion !== null
    ) {
      return;
    }

    lastTickMsRef.current = performance.now();

    const interval = setInterval(() => {
      const now = performance.now();
      const deltaMs = Math.max(0, Math.min(500, now - lastTickMsRef.current));
      lastTickMsRef.current = now;

      remainingMsRef.current = Math.max(0, remainingMsRef.current - deltaMs);
      const remainingExactSec = remainingMsRef.current / 1000;
      const remainingWholeSec = Math.max(0, Math.ceil(remainingExactSec));

      setQuestionTimeLeft(remainingWholeSec);
      setQuestionTimeProgressPct(
        Math.max(
          0,
          Math.min(100, (remainingExactSec / effectiveTimeLimitSec) * 100)
        )
      );

      if (
        remainingWholeSec > 0 &&
        remainingWholeSec <= 3 &&
        lastBeepSecRef.current !== remainingWholeSec
      ) {
        lastBeepSecRef.current = remainingWholeSec;
        soundEngine.playCountdownTick();
      }

      if (remainingMsRef.current <= 0) {
        clearInterval(interval);
        handleSelectOptionRef.current(-1);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [
    questionIndex,
    raceFinished,
    feedback,
    submitting,
    reportingQuestion,
    effectiveTimeLimitSec,
  ]);

  // Keyboard shortcuts (1-4 or A-D)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (raceFinished || feedback !== null || submitting || reportingQuestion) return;
      const key = e.key.toUpperCase();
      if (key === '1' || key === 'A') handleSelectOption(0);
      if (key === '2' || key === 'B') handleSelectOption(1);
      if (key === '3' || key === 'C') handleSelectOption(2);
      if (key === '4' || key === 'D') handleSelectOption(3);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [raceFinished, feedback, submitting, reportingQuestion, handleSelectOption]);

  // Compute sorted standings
  const standings = useMemo(() => {
    if (!isMultiplayer) {
      return [
        {
          playerId: profile.uid,
          nickname: profile.nickname,
          carColor: profile.carColor,
          distance,
          score,
          correctAnswers: correctCount,
          wrongAnswers: wrongCount,
          finishTimeMs: elapsedMs,
          placement: 1,
        },
      ];
    }

    const sorted = [...mpPlayers].sort((a, b) => {
      const aFinished100 = a.distance >= 100;
      const bFinished100 = b.distance >= 100;
      if (aFinished100 && bFinished100) {
        return (
          (a.finishTimeMs || Number.MAX_SAFE_INTEGER) -
          (b.finishTimeMs || Number.MAX_SAFE_INTEGER)
        );
      }
      if (aFinished100 !== bFinished100) {
        return aFinished100 ? -1 : 1;
      }
      if (b.distance !== a.distance) {
        return b.distance - a.distance;
      }
      if (b.correctAnswers !== a.correctAnswers) {
        return b.correctAnswers - a.correctAnswers;
      }
      return (a.finishTimeMs || elapsedMs) - (b.finishTimeMs || elapsedMs);
    });

    return sorted.map((p, idx) => ({
      ...p,
      score: p.score ?? p.correctAnswers * 10,
      placement: idx + 1,
    }));
  }, [isMultiplayer, mpPlayers, profile, distance, score, correctCount, wrongCount, elapsedMs]);

  // Save completed race result ONCE when race finishes
  useEffect(() => {
    if (!raceFinished || savedResultRef.current) return;
    savedResultRef.current = true;

    const totalAnswered = Math.max(1, correctCount + wrongCount);
    const accuracy = Math.round((correctCount / totalAnswered) * 100);
    const myStanding =
      standings.find((s) => s.playerId === profile.uid)?.placement || 1;
    const resultRoomCode = roomCode || `solo_${Date.now()}`;

    if (isGuest) {
      onSaveLocalGuestResult?.({
        category,
        difficulty,
        mode,
        score,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        accuracy,
        distance,
        durationMs: elapsedMs,
        completedAtMs: Date.now(),
      });
    } else {
      recordRaceCompletionAndStats(profile, {
        roomCode: resultRoomCode,
        playerId: profile.uid,
        nickname: profile.nickname,
        carColor: profile.carColor,
        mode,
        category,
        difficulty,
        placement: myStanding,
        score,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        accuracy,
        distance,
        durationMs: elapsedMs,
        isPublic: true,
        completedAtMs: Date.now(),
      }).catch((err) => console.error('Error saving race result:', err));
    }
  }, [
    raceFinished,
    score,
    correctCount,
    wrongCount,
    standings,
    profile,
    roomCode,
    isGuest,
    onSaveLocalGuestResult,
    category,
    difficulty,
    mode,
    distance,
    elapsedMs,
  ]);

  const trackRacers: TrackRacer[] = useMemo(() => {
    if (!isMultiplayer) {
      return [
        {
          playerId: profile.uid,
          nickname: profile.nickname,
          carColor: profile.carColor,
          distance,
          correctAnswers: correctCount,
          wrongAnswers: wrongCount,
          finished: raceFinished,
          isCurrentUser: true,
        },
      ];
    }
    return mpPlayers.map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      carColor: p.carColor,
      distance: p.distance,
      correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers,
      finished: p.finished,
      isCurrentUser: p.playerId === profile.uid,
    }));
  }, [isMultiplayer, mpPlayers, profile, distance, correctCount, wrongCount, raceFinished]);

  const formatDuration = (ms: number) => {
    const totalSec = ms / 1000;
    return `${totalSec.toFixed(1)}s`;
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingQuestion || !reportReason.trim()) return;
    if (isGuest) {
      setReportStatusMsg('Sign in with Google to submit question reports.');
      return;
    }
    try {
      await submitQuestionReport(profile, reportingQuestion, reportReason);
      setReportStatusMsg('Thank you! Report sent to administrators.');
      setReportReason('');
      setTimeout(() => {
        setReportingQuestion(null);
        setReportStatusMsg(null);
      }, 1400);
    } catch {
      setReportStatusMsg('Could not submit report. Please try again.');
    }
  };

  const totalAttempted = correctCount + wrongCount;
  const accuracyPct =
    totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;

  const myStanding = standings.find((r) => r.playerId === profile.uid);
  const myPlacement = myStanding?.placement || 1;
  const durationSecStr = (elapsedMs / 1000).toFixed(1);

  const scoreSharePayload = useMemo(
    () => ({
      nickname: profile.nickname,
      carColor: profile.carColor,
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
    }),
    [
      profile.nickname,
      profile.carColor,
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
    ]
  );

  const shareText = useMemo(
    () => buildScoreShareText(scoreSharePayload),
    [scoreSharePayload]
  );
  const publicGameUrl = getPublicGameUrl();
  const socialLinks = useMemo(
    () => getSocialShareLinks(shareText, publicGameUrl),
    [shareText, publicGameUrl]
  );

  const triggerShareToast = (msg: string) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(null), 2800);
  };

  const handleOpenShareModal = async () => {
    soundEngine.playClick();
    setShareModalOpen(true);
    setGeneratingCard(true);
    try {
      const { dataUrl, blob } = await generateScoreCardImage(scoreSharePayload);
      setScoreCardDataUrl(dataUrl);
      setScoreCardBlob(blob);
    } catch {
      // ignore canvas errors
    } finally {
      setGeneratingCard(false);
    }
  };

  const handleDownloadScoreCard = () => {
    soundEngine.playClick();
    if (!scoreCardDataUrl) return;
    const link = document.createElement('a');
    link.href = scoreCardDataUrl;
    link.download = `calculation-racer-${profile.nickname.toLowerCase()}-${score}pts.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerShareToast('Downloaded Score Card PNG!');
  };

  const handleCopyScoreSummary = async () => {
    soundEngine.playClick();
    await copyToClipboard(shareText);
    triggerShareToast('Copied score summary & public game link!');
  };

  const handleInstagramScoreShare = async () => {
    soundEngine.playClick();
    await copyToClipboard(shareText);
    if (scoreCardDataUrl) {
      const link = document.createElement('a');
      link.href = scoreCardDataUrl;
      link.download = `calculation-racer-${profile.nickname.toLowerCase()}-${score}pts.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    triggerShareToast('Downloaded Score Card PNG & copied caption for Instagram!');
  };

  const handleNativeScoreShare = async () => {
    soundEngine.playClick();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        if (scoreCardBlob && typeof navigator.canShare === 'function') {
          const file = new File(
            [scoreCardBlob],
            `calculation-racer-${score}pts.png`,
            { type: 'image/png' }
          );
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'My Calculation Racer Score!',
              text: shareText,
              files: [file],
            });
            return;
          }
        }
        await navigator.share({
          title: 'My Calculation Racer Score!',
          text: shareText,
          url: publicGameUrl,
        });
        return;
      } catch {
        // Fallback if user cancels
      }
    }
    await copyToClipboard(shareText);
    triggerShareToast('Copied score summary & link to clipboard!');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Top Race HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-sky-800">
            {isMultiplayer ? `Room ${roomCode}` : mode === 'timed' ? 'Speed Blitz' : 'Solo Race'}
          </span>
          <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-purple-800">
            {CATEGORY_LABELS[category]}
          </span>
          <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-emerald-800">
            {DIFFICULTY_LABELS[difficulty]}
          </span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-slate-700 tabular-nums">
            Question {Math.min(totalQuestions, questionIndex + 1)} of {totalQuestions}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-5 font-mono text-xs tabular-nums">
          <div>
            <span className="text-slate-500">Score: </span>
            <span className="font-bold text-purple-600">{score} pts</span>
          </div>
          <div>
            <span className="text-slate-500">Distance: </span>
            <span className="font-bold text-sky-600">{distance} / 100m</span>
          </div>
          <div>
            <span className="text-slate-500">Accuracy: </span>
            <span className="font-bold text-emerald-600">{accuracyPct}%</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-800">
            <Clock className="h-3.5 w-3.5 text-sky-600" />
            <span>{formatDuration(elapsedMs)}</span>
          </div>
        </div>
      </div>

      {/* Live Racing Track Canvas */}
      <div className="mt-4">
        <RaceTrackCanvas
          racers={trackRacers}
          maxLanes={isMultiplayer ? room?.maxPlayers || 2 : 1}
        />
      </div>

      {/* Active Question Card OR Post-Race Summary Card */}
      {!raceFinished && currentQuestion ? (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          {/* Question Timer Bar */}
          <div className="mb-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
              <span className="text-slate-500">
                {currentQuestion.subcategory
                  ? `Topic: ${currentQuestion.subcategory} · `
                  : ''}
                Correct: <strong className="text-emerald-600">+10m Forward</strong> · Wrong:{' '}
                <strong className="text-rose-600">-5m Backward</strong>
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 font-mono text-xs font-extrabold tabular-nums ${
                  questionTimeLeft <= 5
                    ? 'bg-rose-100 text-rose-700 animate-pulse'
                    : 'bg-sky-50 text-sky-700'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{questionTimeLeft}s left</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
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

          {/* Question Header & Text */}
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-xl font-extrabold leading-snug text-slate-900 sm:text-2xl">
              {currentQuestion.questionText}
            </h2>
            <button
              type="button"
              onClick={() => setReportingQuestion(currentQuestion)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
              title="Report an issue with this question"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>Report</span>
            </button>
          </div>

          {/* 4 Multiple-Choice Option Cards */}
          <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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
                } else if (idx === feedback.selectedOption && !feedback.isCorrect) {
                  btnStyle =
                    'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/20';
                } else {
                  btnStyle = 'border-slate-200 bg-slate-50/40 text-slate-400 opacity-75';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={feedback !== null || submitting}
                  onClick={() => handleSelectOption(idx)}
                  className={`flex min-h-[60px] items-center justify-between gap-4 rounded-2xl border-2 px-5 py-3.5 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 ${btnStyle}`}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-mono text-xs font-bold ${badgeThemes[idx]}`}
                    >
                      {optionLetters[idx]}
                    </span>
                    <span className="text-base font-bold leading-snug">{optText}</span>
                  </div>

                  {feedback !== null && idx === feedback.correctOption && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  )}
                  {feedback !== null &&
                    idx === feedback.selectedOption &&
                    !feedback.isCorrect && (
                      <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
                    )}
                </button>
              );
            })}
          </div>

          {/* Live Feedback Banner */}
          {feedback && (
            <div
              className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-sm ${
                feedback.isCorrect
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-rose-300 bg-rose-50 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {feedback.isCorrect ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      Awesome! +10m forward & +{feedback.pointsDelta} pts!
                    </span>
                  </>
                ) : feedback.selectedOption === -1 ? (
                  <>
                    <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>Time expired! 0m movement.</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>Oops! Car moved -5m backward.</span>
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
        /* ==================== RACE RESULTS & FINAL SUMMARY ==================== */
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                <Flag className="h-3.5 w-3.5" />
                <span>Race Complete</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {standings[0]?.playerId === profile.uid && distance >= 100
                  ? 'Victory! You Crossed the Finish Line!'
                  : standings[0]
                    ? `Winner: ${standings[0].nickname}`
                    : 'Race Finished!'}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleOpenShareModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-xs font-extrabold text-white shadow-xs transition-colors hover:bg-purple-500"
              >
                <Share2 className="h-4 w-4" />
                <span>Share Score</span>
              </button>
              <button
                type="button"
                onClick={onPlayAgain}
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-sky-500"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Play Again</span>
              </button>
              <button
                type="button"
                onClick={onChangeSettings}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Change Settings</span>
              </button>
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100"
              >
                <Trophy className="h-4 w-4" />
                <span>Leaderboard</span>
              </button>
              <button
                type="button"
                onClick={onExitToHome}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Home
              </button>
            </div>
          </div>

          {/* Personal Summary Cards */}
          <div className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-5">
            <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4">
              <p className="text-xs font-bold text-purple-700">Total Score</p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-purple-900 tabular-nums">
                {score} pts
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
              <p className="text-xs font-bold text-sky-700">Distance</p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-sky-900 tabular-nums">
                {distance} / 100m
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-xs font-bold text-emerald-700">Accuracy</p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-emerald-900 tabular-nums">
                {accuracyPct}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-600">Correct / Wrong</p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                {correctCount} / {wrongCount}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-xs font-bold text-amber-800">Finish Time</p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-amber-900 tabular-nums">
                {formatDuration(elapsedMs)}
              </p>
            </div>
          </div>

          {/* Final Standings Table */}
          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-800">Final Standings</h3>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Distance</th>
                    <th className="px-4 py-3">Correct</th>
                    <th className="px-4 py-3">Wrong</th>
                    <th className="px-4 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
                  {standings.map((racer) => {
                    const carInfo = CAR_PALETTE[racer.carColor] || CAR_PALETTE.blue;
                    return (
                      <tr
                        key={racer.playerId}
                        className={
                          racer.playerId === profile.uid ? 'bg-sky-50/80' : 'hover:bg-slate-50'
                        }
                      >
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <span className="inline-flex items-center gap-1.5">
                            {racer.placement === 1 && (
                              <Award className="h-4 w-4 text-amber-500" />
                            )}
                            #{racer.placement}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans font-bold text-slate-900">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-sm"
                              style={{ backgroundColor: carInfo.primary }}
                            />
                            <span>{racer.nickname}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-purple-600">
                          {racer.score ?? racer.correctAnswers * 10} pts
                        </td>
                        <td className="px-4 py-3 font-bold text-sky-600">{racer.distance}m</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">
                          {racer.correctAnswers}
                        </td>
                        <td className="px-4 py-3 font-bold text-rose-600">
                          {racer.wrongAnswers}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-700">
                          {formatDuration(racer.finishTimeMs || elapsedMs)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Share Score & Visual Score Card Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-xs">
          <div className="my-8 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-800">
                  <Sparkles className="h-3 w-3" />
                  <span>Challenge Your Friends</span>
                </span>
                <h3 className="mt-1 font-display text-xl font-extrabold text-slate-900">
                  Share Your Race Score Card
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

            {/* Visual Score Card Preview */}
            <div className="mt-4 flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {generatingCard ? (
                <div className="flex h-64 items-center justify-center text-xs font-bold text-slate-500">
                  Generating high-resolution Score Card...
                </div>
              ) : scoreCardDataUrl ? (
                <img
                  src={scoreCardDataUrl}
                  alt="Calculation Racer Score Card"
                  className="max-h-80 w-auto rounded-xl border border-slate-200 shadow-sm"
                />
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadScoreCard}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Score Card (PNG)</span>
                </button>
                <button
                  type="button"
                  onClick={handleNativeScoreShare}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-purple-500"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share Image / Link</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyScoreSummary}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                >
                  <Copy className="h-3.5 w-3.5 text-sky-600" />
                  <span>Copy Score & Link</span>
                </button>
              </div>
            </div>

            {/* Social Platform Share Buttons */}
            <div className="mt-5">
              <p className="mb-2.5 text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                Share Directly On Social Media
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                <a
                  href={socialLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => soundEngine.playClick()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-500"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={socialLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => soundEngine.playClick()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-sky-400"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Telegram</span>
                </a>

                <button
                  type="button"
                  onClick={handleInstagramScoreShare}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-rose-500"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Instagram</span>
                </button>

                <a
                  href={socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => soundEngine.playClick()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-blue-500"
                >
                  <span>Facebook</span>
                </a>

                <a
                  href={socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => soundEngine.playClick()}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-slate-800"
                >
                  <span>X / Twitter</span>
                </a>
              </div>
            </div>

            {shareToast && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800">
                <Check className="h-4 w-4 text-emerald-600" />
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
                  required
                  rows={3}
                  maxLength={500}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Tell us what needs fixing..."
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none"
                />
              </div>
              {reportStatusMsg && (
                <p className="text-xs font-bold text-sky-700">{reportStatusMsg}</p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReportingQuestion(null);
                    setReportStatusMsg(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
