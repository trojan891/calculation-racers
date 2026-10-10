import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, BOOTSTRAPPED_ADMIN_EMAIL } from './firebase';
import {
  AdminAuditLogRecord,
  CarColor,
  GameMode,
  OperationType,
  PlayerProfile,
  QuestionCategory,
  QuestionCountOption,
  QuestionDifficulty,
  QuestionHistoryRecord,
  QuestionItem,
  QuestionKeyItem,
  QuestionReportRecord,
  RaceResultRecord,
  RoomPlayerRecord,
  RoomRecord,
} from '../game/types';
import {
  SEED_QUESTIONS,
  computeAnswerHash,
  findCorrectOptionFromHash,
  getCachedAiQuestions,
  isQuestionValidAndUnexpired,
  reconstructQuestionById,
  saveCachedAiQuestions,
  selectRaceQuestions,
  verifyOptionWithHash,
} from './seedQuestions';

export function sanitizeNickname(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
  if (cleaned.length < 2) return `Racer${Math.floor(100 + Math.random() * 899)}`;
  return cleaned.slice(0, 20);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function ensurePlayerProfile(user: User): Promise<PlayerProfile> {
  const profilePath = `profiles/${user.uid}`;
  const privatePath = `users_private/${user.uid}`;
  try {
    const profileRef = doc(db, 'profiles', user.uid);
    const snap = await getDoc(profileRef);

    if (snap.exists()) {
      return snap.data() as PlayerProfile;
    }

    const defaultNickname = sanitizeNickname(
      user.displayName || user.email?.split('@')[0] || 'Racer'
    );
    const colors: CarColor[] = ['blue', 'red', 'green', 'purple'];
    const defaultColor = colors[user.uid.charCodeAt(0) % 4];

    const newProfile: PlayerProfile = {
      uid: user.uid,
      nickname: defaultNickname,
      carColor: defaultColor,
      wins: 0,
      totalRaces: 0,
      bestTimeMs: 0,
      bestScore: 0,
      totalCorrect: 0,
      totalWrong: 0,
      isPublicProfile: true,
      isBanned: false,
      banReason: '',
    };

    await setDoc(profileRef, {
      ...newProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (user.email) {
      await setDoc(doc(db, 'users_private', user.uid), {
        uid: user.uid,
        email: user.email.slice(0, 254),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${profilePath} | ${privatePath}`);
  }
}

export async function checkUserIsAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

/**
 * Ensures the owner's one-time admin bootstrap record is locked in /system_config/admin_bootstrap
 * and /admins/{uid} when the verified owner accesses the Admin Panel.
 */
export async function ensureOwnerAdminBootstrap(user: User | null): Promise<void> {
  if (!user || !user.emailVerified || user.email !== BOOTSTRAPPED_ADMIN_EMAIL) {
    return;
  }
  try {
    const lockRef = doc(db, 'system_config', 'admin_bootstrap');
    const lockSnap = await getDoc(lockRef);
    if (!lockSnap.exists()) {
      await setDoc(lockRef, {
        id: 'admin_bootstrap',
        ownerUid: user.uid,
        bootstrapped: true,
        createdAt: serverTimestamp(),
      });
    }
    const adminRef = doc(db, 'admins', user.uid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, {
        uid: user.uid,
        email: (user.email || BOOTSTRAPPED_ADMIN_EMAIL).slice(0, 254),
        role: 'admin',
        createdAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-fatal if already bootstrapped
  }
}

export async function updatePlayerPreferences(
  uid: string,
  nickname: string,
  carColor: CarColor,
  isPublicProfile: boolean
): Promise<void> {
  const path = `profiles/${uid}`;
  try {
    await updateDoc(doc(db, 'profiles', uid), {
      nickname: sanitizeNickname(nickname),
      carColor,
      isPublicProfile,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchActiveQuestions(): Promise<QuestionItem[]> {
  const aiQuestions = getCachedAiQuestions();
  const basePool = [...aiQuestions, ...SEED_QUESTIONS];
  try {
    const q = query(collection(db, 'questions'), where('isActive', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) {
      return basePool;
    }
    const dbQuestions = snap.docs
      .map((d) => d.data() as QuestionItem)
      .filter((item) => isQuestionValidAndUnexpired(item));

    const existingIds = new Set(dbQuestions.map((item) => item.id));
    const extras = basePool.filter((item) => !existingIds.has(item.id));
    return [...dbQuestions, ...extras];
  } catch {
    return basePool;
  }
}

export async function generateFreshAiQuestionsForSection(
  category: QuestionCategory,
  difficulty: QuestionDifficulty,
  subcategory: string = 'ALL',
  count: number = 8
): Promise<QuestionItem[]> {
  const currentPool = [...getCachedAiQuestions(), ...SEED_QUESTIONS].filter(
    (q) => q.category === category && q.difficulty === difficulty
  );
  const avoidPrompts = currentPool
    .slice(0, 35)
    .map((q) => q.questionText);

  const response = await fetch('/api/ai/generate-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category,
      difficulty,
      subcategory,
      count,
      avoidPrompts,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody?.error || 'Could not generate AI questions right now.'
    );
  }

  const data = await response.json();
  const rawList = Array.isArray(data?.questions) ? data.questions : [];
  const today = new Date().toISOString().slice(0, 10);

  const formatted: QuestionItem[] = rawList
    .filter(
      (item: Record<string, unknown>) =>
        typeof item?.questionText === 'string' &&
        Array.isArray(item?.options) &&
        item.options.length === 4
    )
    .map((item: Record<string, unknown>, idx: number) => {
      const id = `ai_${category}_${difficulty}_${Date.now()}_${idx}`;
      const rawCorrect = Number(item.correctOption);
      const correctOption =
        Number.isInteger(rawCorrect) && rawCorrect >= 0 && rawCorrect <= 3
          ? rawCorrect
          : 0;
      const options = (item.options as unknown[]).map((o) =>
        String(o).trim().slice(0, 180)
      ) as [string, string, string, string];

      return {
        id,
        category,
        subcategory: String(item.subcategory || '').trim() || undefined,
        difficulty,
        questionText: String(item.questionText).trim().slice(0, 400),
        options,
        answerHash: computeAnswerHash(id, correctOption),
        sourceUrl:
          category === 'current_affairs' ? 'https://news.google.com' : '',
        publishedAt: today,
        verifiedAt: today,
        expiresAt: '2029-12-31',
        isActive: true,
        correctOption,
        explanation: String(
          item.explanation || `Correct answer: ${options[correctOption]}.`
        )
          .trim()
          .slice(0, 500),
      };
    });

  if (formatted.length > 0) {
    saveCachedAiQuestions(formatted);
  }

  return formatted;
}

function getLocalSeenKey(playerId: string, category: QuestionCategory, difficulty: QuestionDifficulty): string {
  return `calc_racer_seen_${playerId}_${category}_${difficulty}`;
}

export async function fetchPlayerSeenQuestionIds(
  playerId: string,
  isGuest: boolean,
  category: QuestionCategory,
  difficulty: QuestionDifficulty
): Promise<Set<string>> {
  const seen = new Set<string>();
  const localKey = getLocalSeenKey(playerId, category, difficulty);
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => seen.add(id));
      }
    }
  } catch {
    // ignore storage errors
  }

  if (!isGuest && playerId && playerId !== 'guest_local_driver') {
    try {
      const q = query(
        collection(db, 'question_history'),
        where('playerId', '==', playerId)
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data() as QuestionHistoryRecord;
        if (data.category === category && data.difficulty === difficulty) {
          seen.add(data.questionId);
        }
      });
    } catch {
      // fallback to local seen set
    }
  }

  return seen;
}

export async function recordPlayerSeenQuestions(
  playerId: string,
  isGuest: boolean,
  category: QuestionCategory,
  difficulty: QuestionDifficulty,
  questions: QuestionItem[],
  resetPriorPool: boolean = false
): Promise<void> {
  const localKey = getLocalSeenKey(playerId, category, difficulty);
  try {
    const existingRaw = resetPriorPool ? null : localStorage.getItem(localKey);
    const existingList: string[] = existingRaw ? JSON.parse(existingRaw) : [];
    const merged = Array.from(
      new Set([...existingList, ...questions.map((q) => q.id)])
    ).slice(-120);
    localStorage.setItem(localKey, JSON.stringify(merged));
  } catch {
    // ignore localStorage errors
  }

  if (!isGuest && playerId && playerId !== 'guest_local_driver') {
    const now = Date.now();
    // Write question history records in background without blocking gameplay
    Promise.all(
      questions.map(async (q) => {
        const safeQId = q.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
        const safePId = playerId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 56);
        const historyId = `${safePId}_${safeQId}`;
        const ref = doc(db, 'question_history', historyId);
        try {
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const prev = snap.data() as QuestionHistoryRecord;
            await updateDoc(ref, {
              id: historyId,
              playerId,
              questionId: safeQId,
              category,
              difficulty,
              lastShownAtMs: now,
              timesShown: Math.min(99999, (prev.timesShown || 1) + 1),
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(ref, {
              id: historyId,
              playerId,
              questionId: safeQId,
              category,
              difficulty,
              lastShownAtMs: now,
              timesShown: 1,
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          // ignore background history sync errors
        }
      })
    ).catch(() => {});
  }
}

/**
 * Selects `count` unique questions for a player or room host, prioritizing unseen questions
 * and automatically recycling the pool if the unseen pool for that category/difficulty is exhausted.
 */
export async function selectUniqueQuestionsForPlayer(
  playerId: string,
  isGuest: boolean,
  category: QuestionCategory,
  difficulty: QuestionDifficulty,
  count: QuestionCountOption,
  subcategories: string[] = []
): Promise<QuestionItem[]> {
  const allQuestions = await fetchActiveQuestions();
  const seenIds = await fetchPlayerSeenQuestionIds(
    playerId,
    isGuest,
    category,
    difficulty
  );

  const chosen = selectRaceQuestions(
    allQuestions,
    category,
    difficulty,
    count,
    subcategories,
    seenIds
  );

  // Check if any chosen question had to be recycled from seenIds
  const recycledAny = chosen.some((q) => seenIds.has(q.id));

  await recordPlayerSeenQuestions(
    playerId,
    isGuest,
    category,
    difficulty,
    chosen,
    recycledAny
  );

  return chosen;
}

export function resolveRoomQuestionSequence(
  questionIds: string[],
  pool: QuestionItem[],
  fallbackCategory: QuestionCategory,
  fallbackDifficulty: QuestionDifficulty,
  fallbackCount: number = 10,
  fallbackSubcategories: string[] = []
): QuestionItem[] {
  const ordered: QuestionItem[] = [];
  const usedIds = new Set<string>();
  for (const id of questionIds) {
    if (usedIds.has(id)) continue;
    const item = reconstructQuestionById(id, pool);
    if (item) {
      usedIds.add(id);
      ordered.push(item);
    }
  }
  if (ordered.length > 0) {
    return ordered;
  }
  return selectRaceQuestions(
    pool,
    fallbackCategory,
    fallbackDifficulty,
    fallbackCount,
    fallbackSubcategories
  );
}

export async function seedStarterQuestionsToFirestore(): Promise<number> {
  let count = 0;
  for (const q of SEED_QUESTIONS) {
    const qRef = doc(db, 'questions', q.id);
    const existing = await getDoc(qRef);
    if (!existing.exists()) {
      const payload: Record<string, unknown> = {
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        questionText: q.questionText.slice(0, 500),
        options: q.options.map((o) => o.slice(0, 200)),
        answerHash: q.answerHash,
        sourceUrl: (q.sourceUrl || '').slice(0, 500),
        publishedAt: (q.publishedAt || '2025-01-01').slice(0, 40),
        verifiedAt: (q.verifiedAt || '2025-01-15').slice(0, 40),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (q.subcategory) {
        payload.subcategory = q.subcategory.slice(0, 60);
      }
      if (q.expiresAt) {
        payload.expiresAt = q.expiresAt.slice(0, 40);
      }

      await setDoc(qRef, payload);
      await setDoc(doc(db, 'question_keys', q.id), {
        questionId: q.id,
        correctOption: q.correctOption ?? 0,
        explanation: (q.explanation || '').slice(0, 1000),
        updatedAt: serverTimestamp(),
      });
      count++;
    }
  }
  return count;
}

export async function resolveQuestionAnswer(
  question: QuestionItem,
  selectedOption: number
): Promise<{
  isCorrect: boolean;
  correctOption: number;
  explanation: string;
  distanceDelta: -5 | 0 | 10;
}> {
  let correctOption = question.correctOption;
  let explanation = question.explanation || '';

  // 1. Fast synchronous local lookup first (0ms latency)
  if (correctOption === undefined) {
    const reconstructed = reconstructQuestionById(question.id, SEED_QUESTIONS);
    if (reconstructed && reconstructed.correctOption !== undefined) {
      correctOption = reconstructed.correctOption;
      explanation = explanation || reconstructed.explanation || '';
    }
  }

  // 2. Fast deterministic hash verification (0ms latency)
  if (correctOption === undefined && question.answerHash) {
    for (let i = 0; i < 4; i++) {
      if (verifyOptionWithHash(question.id, i, question.answerHash)) {
        correctOption = i;
        break;
      }
    }
  }

  // 3. Optional Firestore fallback only if still unresolved
  if (correctOption === undefined) {
    try {
      const keySnap = await getDoc(doc(db, 'question_keys', question.id));
      if (keySnap.exists()) {
        const keyData = keySnap.data() as QuestionKeyItem;
        correctOption = keyData.correctOption;
        explanation = explanation || keyData.explanation;
      }
    } catch {
      // Ignore permission or offline errors
    }
  }

  if (correctOption === undefined) {
    correctOption = findCorrectOptionFromHash(question.id, question.answerHash);
  }

  if (selectedOption === -1) {
    return {
      isCorrect: false,
      correctOption,
      explanation:
        explanation ||
        `Time's up! The correct answer was: ${question.options[correctOption]}`,
      distanceDelta: -5,
    };
  }

  const isCorrect =
    selectedOption === correctOption ||
    verifyOptionWithHash(question.id, selectedOption, question.answerHash);

  return {
    isCorrect,
    correctOption,
    explanation: explanation || `Correct answer: ${question.options[correctOption]}.`,
    distanceDelta: isCorrect ? 10 : -5,
  };
}

export async function createMultiplayerRoom(
  profile: PlayerProfile,
  maxPlayers: 2 | 4,
  category: QuestionCategory,
  difficulty: QuestionDifficulty,
  questionTimeLimitSec: number,
  questionCount: QuestionCountOption = 10,
  subcategories: string[] = []
): Promise<string> {
  const selected = await selectUniqueQuestionsForPlayer(
    profile.uid,
    false,
    category,
    difficulty,
    questionCount,
    subcategories
  );
  const questionIds = selected.map((q) => q.id);

  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();
    const roomRef = doc(db, 'rooms', roomCode);
    const existing = await getDoc(roomRef);
    if (existing.exists()) continue;

    const roomPath = `rooms/${roomCode}`;
    try {
      const roomData: RoomRecord = {
        roomCode,
        hostId: profile.uid,
        hostNickname: profile.nickname,
        maxPlayers,
        category,
        subcategories: subcategories.slice(0, 10),
        difficulty,
        questionCount,
        questionTimeLimitSec: Math.min(60, Math.max(5, questionTimeLimitSec)),
        status: 'waiting',
        questionIds,
        playerCount: 1,
        countdownStartedAtMs: 0,
        raceStartedAtMs: 0,
        raceFinishedAtMs: 0,
        winnerId: '',
        winnerNickname: '',
        isPublic: true,
      };

      await setDoc(roomRef, {
        ...roomData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const hostPlayer: RoomPlayerRecord = {
        roomCode,
        playerId: profile.uid,
        nickname: profile.nickname,
        carColor: profile.carColor,
        ready: true,
        distance: 0,
        score: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        currentQuestionIndex: 0,
        finished: false,
        finishTimeMs: 0,
        placement: 0,
        connected: true,
        lastSeenAtMs: Date.now(),
      };

      await setDoc(doc(db, 'rooms', roomCode, 'players', profile.uid), {
        ...hostPlayer,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return roomCode;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, roomPath);
    }
  }
  throw new Error('Could not generate a unique room code. Please try again.');
}

export async function joinMultiplayerRoom(
  rawCode: string,
  profile: PlayerProfile
): Promise<RoomRecord> {
  const roomCode = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
    throw new Error('Room code must be 6 characters (letters and numbers, e.g. AB12CD).');
  }

  const roomRef = doc(db, 'rooms', roomCode);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    throw new Error(`Room "${roomCode}" was not found. Please check the code and try again.`);
  }

  const room = roomSnap.data() as RoomRecord;
  const playerRef = doc(db, 'rooms', roomCode, 'players', profile.uid);
  const existingPlayerSnap = await getDoc(playerRef);

  // Allow reconnect if player is already a member of the room
  if (existingPlayerSnap.exists()) {
    const existingData = existingPlayerSnap.data() as RoomPlayerRecord;
    await updateDoc(playerRef, {
      ready: existingData.ready,
      carColor: existingData.carColor,
      connected: true,
      lastSeenAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    });
    return room;
  }

  if (room.status !== 'waiting') {
    throw new Error('This race has already started or finished.');
  }

  const playersQuery = query(
    collection(db, 'rooms', roomCode, 'players'),
    where('roomCode', '==', roomCode)
  );
  const playersSnap = await getDocs(playersQuery);
  if (playersSnap.size >= room.maxPlayers) {
    throw new Error(`Room ${roomCode} is full (${room.maxPlayers}/${room.maxPlayers} players).`);
  }

  // Assign a distinct car color if possible
  const takenColors = new Set(playersSnap.docs.map((d) => (d.data() as RoomPlayerRecord).carColor));
  const allColors: CarColor[] = ['blue', 'red', 'green', 'purple'];
  const assignedColor = takenColors.has(profile.carColor)
    ? allColors.find((c) => !takenColors.has(c)) || profile.carColor
    : profile.carColor;

  const newPlayer: RoomPlayerRecord = {
    roomCode,
    playerId: profile.uid,
    nickname: profile.nickname,
    carColor: assignedColor,
    ready: false,
    distance: 0,
    score: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    currentQuestionIndex: 0,
    finished: false,
    finishTimeMs: 0,
    placement: 0,
    connected: true,
    lastSeenAtMs: Date.now(),
  };

  try {
    await setDoc(playerRef, {
      ...newPlayer,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(roomRef, {
      playerCount: Math.min(room.maxPlayers, playersSnap.size + 1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${roomCode}/players/${profile.uid}`);
  }

  return room;
}

export async function recordRaceCompletionAndStats(
  profile: PlayerProfile,
  result: Omit<RaceResultRecord, 'createdAt'>
): Promise<void> {
  const resultId = `${result.roomCode}_${profile.uid}`;
  const resultRef = doc(db, 'race_results', resultId);

  try {
    const existing = await getDoc(resultRef);
    if (existing.exists()) {
      return;
    }

    await setDoc(resultRef, {
      ...result,
      score: result.score ?? result.correctAnswers * 10,
      createdAt: serverTimestamp(),
    });

    const profileRef = doc(db, 'profiles', profile.uid);
    const profSnap = await getDoc(profileRef);
    if (profSnap.exists()) {
      const current = profSnap.data() as PlayerProfile;
      const isWin =
        result.placement === 1 &&
        (result.distance >= 100 || (result.mode !== 'solo' && result.correctAnswers > 0));
      const newBestTime =
        result.distance >= 100
          ? current.bestTimeMs === 0
            ? result.durationMs
            : Math.min(current.bestTimeMs, result.durationMs)
          : current.bestTimeMs;
      const earnedScore = result.score ?? result.correctAnswers * 10;
      const newBestScore = Math.max(current.bestScore || 0, earnedScore);

      await updateDoc(profileRef, {
        wins: current.wins + (isWin ? 1 : 0),
        totalRaces: current.totalRaces + 1,
        bestTimeMs: newBestTime,
        bestScore: newBestScore,
        totalCorrect: current.totalCorrect + result.correctAnswers,
        totalWrong: current.totalWrong + result.wrongAnswers,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `race_results/${resultId}`);
  }
}

export async function submitQuestionReport(
  profile: PlayerProfile,
  question: QuestionItem,
  reason: string
): Promise<void> {
  const reportId = `rep_${Date.now()}_${profile.uid.slice(0, 6)}`;
  const path = `question_reports/${reportId}`;
  try {
    // Only submit to Firestore if the question exists in /questions (not an ephemeral mgen_ ID)
    const qSnap = await getDoc(doc(db, 'questions', question.id));
    if (!qSnap.exists()) {
      return;
    }
    const report: QuestionReportRecord = {
      id: reportId,
      questionId: question.id,
      questionText: question.questionText.slice(0, 500),
      reporterId: profile.uid,
      reporterNickname: profile.nickname,
      reason: reason.trim().slice(0, 500),
      status: 'open',
      adminNote: '',
    };
    await setDoc(doc(db, 'question_reports', reportId), {
      ...report,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function logAdminAction(
  adminUid: string,
  adminEmail: string,
  action: string,
  targetType: AdminAuditLogRecord['targetType'],
  targetId: string,
  details: string
): Promise<void> {
  const logId = `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const path = `admin_audit_logs/${logId}`;
  try {
    await setDoc(doc(db, 'admin_audit_logs', logId), {
      id: logId,
      adminId: adminUid,
      adminEmail: (adminEmail || 'admin@local').slice(0, 254),
      action: action.slice(0, 100),
      targetType,
      targetId: targetId.slice(0, 128),
      details: details.slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminSaveQuestion(
  adminUid: string,
  adminEmail: string,
  questionInput: {
    id?: string;
    category: QuestionCategory;
    subcategory?: string;
    difficulty: QuestionDifficulty;
    questionText: string;
    options: [string, string, string, string];
    correctOption: number;
    explanation: string;
    sourceUrl: string;
    publishedAt: string;
    verifiedAt: string;
    expiresAt?: string;
    isActive: boolean;
  }
): Promise<void> {
  const isNew = !questionInput.id;
  const qId = questionInput.id || `q_${Date.now()}_${Math.floor(100 + Math.random() * 899)}`;
  const answerHash = computeAnswerHash(qId, questionInput.correctOption);

  try {
    const qRef = doc(db, 'questions', qId);
    const keyRef = doc(db, 'question_keys', qId);

    const basePayload: Record<string, unknown> = {
      category: questionInput.category,
      difficulty: questionInput.difficulty,
      questionText: questionInput.questionText.trim().slice(0, 500),
      options: questionInput.options.map((o) => o.trim().slice(0, 200)),
      answerHash,
      sourceUrl: questionInput.sourceUrl.trim().slice(0, 500),
      publishedAt: (
        questionInput.publishedAt || new Date().toISOString().slice(0, 10)
      ).slice(0, 40),
      verifiedAt: (
        questionInput.verifiedAt || new Date().toISOString().slice(0, 10)
      ).slice(0, 40),
      isActive: questionInput.isActive,
      updatedAt: serverTimestamp(),
    };

    if (questionInput.subcategory !== undefined) {
      basePayload.subcategory = questionInput.subcategory.trim().slice(0, 60);
    }
    if (questionInput.expiresAt !== undefined) {
      basePayload.expiresAt = questionInput.expiresAt.trim().slice(0, 40);
    }

    if (isNew) {
      await setDoc(qRef, {
        id: qId,
        ...basePayload,
        createdAt: serverTimestamp(),
      });
      await setDoc(keyRef, {
        questionId: qId,
        correctOption: questionInput.correctOption,
        explanation: questionInput.explanation.trim().slice(0, 1000),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(qRef, basePayload);
      const keySnap = await getDoc(keyRef);
      if (keySnap.exists()) {
        await updateDoc(keyRef, {
          correctOption: questionInput.correctOption,
          explanation: questionInput.explanation.trim().slice(0, 1000),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(keyRef, {
          questionId: qId,
          correctOption: questionInput.correctOption,
          explanation: questionInput.explanation.trim().slice(0, 1000),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await logAdminAction(
      adminUid,
      adminEmail,
      isNew ? 'Created Question' : 'Updated Question',
      'question',
      qId,
      `${questionInput.category.toUpperCase()} (${questionInput.difficulty}): "${questionInput.questionText.slice(0, 60)}"`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `questions/${qId}`);
  }
}

export async function adminDeleteQuestion(
  adminUid: string,
  adminEmail: string,
  questionId: string,
  questionText: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'question_keys', questionId)).catch(() => {});
    await deleteDoc(doc(db, 'questions', questionId));
    await logAdminAction(
      adminUid,
      adminEmail,
      'Deleted Question',
      'question',
      questionId,
      `Deleted question: "${questionText.slice(0, 80)}"`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `questions/${questionId}`);
  }
}
