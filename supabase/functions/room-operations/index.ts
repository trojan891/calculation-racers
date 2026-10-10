/**
 * Supabase Edge Function: room-operations
 * Handles server-authoritative room creation, 6-character alphanumeric code generation,
 * player readiness validation, and synchronized countdown initiation.
 */

export interface RoomActionPayload {
  action: 'create_room' | 'join_room' | 'toggle_ready' | 'start_countdown';
  roomCode?: string;
  maxPlayers?: 2 | 4;
  category?: 'math' | 'gk' | 'science' | 'current_affairs';
  difficulty?: 'easy' | 'medium' | 'hard';
  questionTimeLimitSec?: number;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  const randomBytes = new Uint8Array(6);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}
