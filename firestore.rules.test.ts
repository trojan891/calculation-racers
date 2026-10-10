/**
 * Calculation Racer — Firestore Security Rules Verification Suite
 * Verifies that all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string;
    email?: string;
    email_verified?: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Unverified Admin Email Spoof on Question Write',
    operation: 'create',
    path: '/questions/q_spoof',
    auth: { uid: 'attacker_1', email: 'rizveemanger@gmail.com', email_verified: false },
    payload: { id: 'q_spoof', category: 'math', difficulty: 'easy', questionText: '2+2?', options: ['3', '4', '5', '6'], answerHash: 'abc', sourceUrl: '', publishedAt: '', verifiedAt: '', isActive: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'PII Lateral Read on users_private',
    operation: 'get',
    path: '/users_private/victim_uid',
    auth: { uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Profile',
    operation: 'update',
    path: '/profiles/user_1',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { nickname: 'RacerOne', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Self-Unban Escalation on Profile',
    operation: 'update',
    path: '/profiles/user_1',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { isBanned: false, banReason: '' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-Player Position Tampering in Room',
    operation: 'update',
    path: '/rooms/AB12CD/players/user_2',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { distance: 0 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Out-of-Bounds Car Distance (> 100 or < 0)',
    operation: 'update',
    path: '/rooms/AB12CD/players/user_1',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { distance: 250 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Duplicate Answer Submission Overwrite',
    operation: 'update',
    path: '/rooms/AB12CD/submissions/user_1_q0',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { isCorrect: true, distanceDelta: 10 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Terminal Room State Re-Opening',
    operation: 'update',
    path: '/rooms/AB12CD',
    auth: { uid: 'host_1', email: 'host1@example.com', email_verified: true },
    payload: { status: 'racing' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned Room Player Creation Without Parent Room',
    operation: 'create',
    path: '/rooms/ZZZZZZ/players/user_1',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { roomCode: 'ZZZZZZ', playerId: 'user_1', nickname: 'Racer1', carColor: 'blue', ready: false, distance: 0, correctAnswers: 0, wrongAnswers: 0, currentQuestionIndex: 0, finished: false, finishTimeMs: 0, placement: 0, connected: true, lastSeenAtMs: 1000 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Client Timestamp Forgery on Race Result',
    operation: 'create',
    path: '/race_results/AB12CD_user_1',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { roomCode: 'AB12CD', playerId: 'user_1', createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Resource Poisoning (Oversized String Payload)',
    operation: 'create',
    path: '/question_reports/rep_1',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    payload: { id: 'rep_1', questionId: 'q_1', questionText: '2+2?', reporterId: 'user_1', reporterNickname: 'Racer1', reason: 'X'.repeat(2000), status: 'open', adminNote: '' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unfiltered Answer Key List Dump by Non-Admin',
    operation: 'list',
    path: '/question_keys',
    auth: { uid: 'user_1', email: 'user1@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
