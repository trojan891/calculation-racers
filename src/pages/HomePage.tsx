import React from 'react';
import { Trophy } from 'lucide-react';
import {
  PlayerProfile,
  TROJO_GAMES,
  TrojoGameId,
} from '../game/types';
import { soundEngine } from '../lib/sound';
import { GameTileArtwork } from '../components/GameTileArtwork';

interface HomePageProps {
  profile: PlayerProfile;
  isGuest: boolean;
  onOpenLibrary: () => void;
  onSelectGame: (gameId: TrojoGameId, mode: 'solo' | 'multiplayer') => void;
  onQuickPlayGame: (gameId: TrojoGameId) => void;
  onOpenJoinRoom: () => void;
  onOpenLeaderboard: () => void;
  onOpenProfile: () => void;
  onSignIn: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectGame,
  onOpenLeaderboard,
}) => {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] max-w-5xl flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
      {/* Main Heading Only — Minimal & Icon-First */}
      <h1 className="font-display text-center text-4xl font-black tracking-tight text-slate-900 sm:text-5xl md:text-6xl motion-safe:animate-[fadeIn_0.45s_ease-out]">
        LET&rsquo;S PLAY
      </h1>

      {/* Responsive Game Logos Grid */}
      <div className="mt-10 grid w-full max-w-5xl grid-cols-2 gap-4 sm:mt-12 sm:grid-cols-3 md:grid-cols-6 sm:gap-5">
        {TROJO_GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onSelectGame(game.id, 'solo');
            }}
            className="group flex flex-col items-center rounded-3xl border border-slate-200/80 bg-white p-4 text-center shadow-xs transition-all duration-200 hover:-translate-y-1.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            <div className="w-full max-w-[136px] overflow-hidden rounded-[26px] shadow-sm transition-transform duration-200 group-hover:scale-105">
              <GameTileArtwork gameId={game.id} />
            </div>
            <span className="mt-3.5 font-display text-sm font-extrabold text-slate-900 transition-colors group-hover:text-[#2563EB] sm:text-base">
              {game.name}
            </span>
          </button>
        ))}
      </div>

      {/* Single Leaderboard Button at Bottom of Main Content */}
      <div className="mt-12 sm:mt-14">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onOpenLeaderboard();
          }}
          className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-[#2563EB] px-8 py-3.5 font-display text-base font-extrabold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Trophy className="h-5 w-5" />
          <span>Leaderboard</span>
        </button>
      </div>
    </div>
  );
};
