-- ============================================================================
-- TROJO — A FUN NAGAR: Multiplayer Gaming Platform Upgrade Migration
-- Preserves all existing profiles, Calculation Racer records, rooms, and admin locks.
-- Adds support for 7 TROJO games, IQ Relay fields, Cheat Your Friend bluffs/votes,
-- and rematch / replay-with-same-players support.
-- ============================================================================

-- 1. Extend rooms table with game_id and iq_fields
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS game_id TEXT NOT NULL DEFAULT 'calculation_racer'
    CHECK (game_id IN (
      'calculation_racer',
      'cheat_your_friend',
      'solve_the_puzzle',
      'word_scramble',
      'emoji_decode',
      'quick_quiz',
      'iq_relay'
    )),
  ADD COLUMN IF NOT EXISTS iq_fields TEXT[] NOT NULL DEFAULT '{}';

-- 2. Extend room_players table with bluff_text and voted_option for Cheat Your Friend
ALTER TABLE public.room_players
  ADD COLUMN IF NOT EXISTS bluff_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS voted_option INTEGER NOT NULL DEFAULT -1;

-- 3. Extend race_results table with game_id and iq_breakdown
ALTER TABLE public.race_results
  ADD COLUMN IF NOT EXISTS game_id TEXT NOT NULL DEFAULT 'calculation_racer'
    CHECK (game_id IN (
      'calculation_racer',
      'cheat_your_friend',
      'solve_the_puzzle',
      'word_scramble',
      'emoji_decode',
      'quick_quiz',
      'iq_relay'
    )),
  ADD COLUMN IF NOT EXISTS iq_breakdown JSONB DEFAULT NULL;

-- 4. Index for game-specific leaderboards
CREATE INDEX IF NOT EXISTS idx_race_results_game_score
  ON public.race_results (game_id, score DESC, duration_ms ASC);
