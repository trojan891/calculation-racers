/**
 * Supabase Edge Function: submit-answer
 * Server-authoritative answer validation, car movement calculation (+10 / -5 / 0 timeout),
 * duplicate submission prevention, and final placement resolution.
 */

export interface SubmitAnswerInput {
  roomCode: string;
  questionIndex: number;
  selectedOption: number; // 0..3 or -1 for timeout
  timeTakenMs: number;
}

export function computeMovementDelta(selectedOption: number, correctOption: number): {
  isCorrect: boolean;
  distanceDelta: -5 | 0 | 10;
} {
  if (selectedOption === -1) {
    return { isCorrect: false, distanceDelta: 0 };
  }
  if (selectedOption === correctOption) {
    return { isCorrect: true, distanceDelta: 10 };
  }
  return { isCorrect: false, distanceDelta: -5 };
}
