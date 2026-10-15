import React from 'react';
import { LudoColor, LUDO_COLOR_INFO } from './types';

interface LudoDiceProps {
  value: number | null;
  isRolling: boolean;
  canRoll: boolean;
  playerColor: LudoColor;
  onRoll: () => void;
  consecutiveSixes?: number;
}

export const LudoDice: React.FC<LudoDiceProps> = ({
  value,
  isRolling,
  canRoll,
  playerColor,
  onRoll,
  consecutiveSixes = 0,
}) => {
  const colorInfo = LUDO_COLOR_INFO[playerColor] || LUDO_COLOR_INFO.red;

  // Dot patterns for values 1 to 6
  const renderDots = (val: number) => {
    switch (val) {
      case 1:
        return (
          <div className="flex h-full w-full items-center justify-center">
            <span className="h-4 w-4 rounded-full bg-slate-900 shadow-xs sm:h-5 sm:w-5" />
          </div>
        );
      case 2:
        return (
          <div className="flex h-full w-full justify-between p-2">
            <span className="h-3.5 w-3.5 rounded-full bg-slate-900 shadow-xs sm:h-4 sm:w-4" />
            <span className="self-end h-3.5 w-3.5 rounded-full bg-slate-900 shadow-xs sm:h-4 sm:w-4" />
          </div>
        );
      case 3:
        return (
          <div className="flex h-full w-full justify-between p-2">
            <span className="h-3 w-3 rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="self-center h-3 w-3 rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="self-end h-3 w-3 rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
          </div>
        );
      case 4:
        return (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 p-2">
            <span className="h-3.5 w-3.5 justify-self-start rounded-full bg-slate-900 shadow-xs sm:h-4 sm:w-4" />
            <span className="h-3.5 w-3.5 justify-self-end rounded-full bg-slate-900 shadow-xs sm:h-4 sm:w-4" />
            <span className="self-end h-3.5 w-3.5 justify-self-start rounded-full bg-slate-900 shadow-xs sm:h-4 sm:w-4" />
            <span className="self-end h-3.5 w-3.5 justify-self-end rounded-full bg-slate-900 shadow-xs sm:h-4 sm:w-4" />
          </div>
        );
      case 5:
        return (
          <div className="relative h-full w-full p-2">
            <span className="absolute top-2 left-2 h-3 w-3 rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="absolute top-2 right-2 h-3 w-3 rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 shadow-xs sm:h-4 sm:w-4" />
            <span className="absolute bottom-2 left-2 h-3 w-3 rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
          </div>
        );
      case 6:
        return (
          <div className="grid h-full w-full grid-cols-2 grid-rows-3 p-2">
            <span className="h-3 w-3 justify-self-start rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="h-3 w-3 justify-self-end rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="h-3 w-3 justify-self-start self-center rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="h-3 w-3 justify-self-end self-center rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="h-3 w-3 justify-self-start self-end rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
            <span className="h-3 w-3 justify-self-end self-end rounded-full bg-slate-900 shadow-xs sm:h-3.5 sm:w-3.5" />
          </div>
        );
      default:
        return (
          <div className="flex h-full w-full items-center justify-center font-black text-slate-400 text-lg">
            ?
          </div>
        );
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* 3D Dice Box */}
      <button
        type="button"
        onClick={() => {
          if (canRoll && !isRolling) onRoll();
        }}
        disabled={!canRoll || isRolling}
        className={`relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 border-slate-300 bg-linear-to-b from-white via-slate-50 to-slate-200 shadow-xl transition-all select-none ${
          canRoll && !isRolling
            ? 'cursor-pointer hover:scale-105 active:scale-95 ring-4 ring-amber-400 ring-offset-2 animate-bounce'
            : 'opacity-90'
        } ${isRolling ? 'animate-spin' : ''}`}
        style={{
          boxShadow: `0 10px 25px -5px ${colorInfo.glow}, 0 4px 6px -2px rgba(0, 0, 0, 0.1)`,
        }}
        aria-label="Roll Dice"
      >
        {renderDots(value || 6)}

        {/* Lucky 6 Flame Badge */}
        {value === 6 && !isRolling && (
          <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-slate-950 shadow-md ring-2 ring-white">
            ★
          </span>
        )}
      </button>

      {/* Roll Action Button */}
      {canRoll && (
        <button
          type="button"
          onClick={() => {
            if (!isRolling) onRoll();
          }}
          disabled={isRolling}
          className="flex h-12 sm:h-14 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 sm:px-5 font-display text-xs sm:text-sm font-black text-slate-950 shadow-lg hover:bg-amber-300 active:scale-95 transition-all"
        >
          <span>🎲 ROLL</span>
        </button>
      )}
    </div>
  );
};
