import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Crown,
  FastForward,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  COLOR_START_INDEX_4P,
  STAR_INDICES_4P,
} from './boardCoordinates4P';
import {
  COLOR_START_INDEX_6P,
  STAR_INDICES_6P,
} from './boardCoordinates6P';
import { LudoBoard4P } from './LudoBoard4P';
import { LudoBoard6P } from './LudoBoard6P';
import { LudoDice } from './LudoDice';
import { ludoSound } from './sound';
import {
  LUDO_COLOR_INFO,
  LudoBoardType,
  LudoColor,
  LudoGameMode,
  LudoPlayer,
  LudoPlayerCount,
  LudoToken,
} from './types';

interface LudoArenaProps {
  initialCount?: LudoPlayerCount;
  initialMode?: LudoGameMode;
  userNickname?: string;
  onExit?: () => void;
  onMatchFinish?: (winnerColor: LudoColor, winnerName: string) => void;
}

export type LudoGameSpeed = 'normal' | 'fast' | 'turbo';

const SPEED_CONFIG: Record<
  LudoGameSpeed,
  {
    botRollDelay: number;
    diceRollDuration: number;
    botMoveDelay: number;
    moveFinishDelay: number;
    passTurnDelay: number;
    autoMoveDelay: number;
  }
> = {
  normal: {
    botRollDelay: 320,
    diceRollDuration: 350,
    botMoveDelay: 280,
    moveFinishDelay: 260,
    passTurnDelay: 450,
    autoMoveDelay: 200,
  },
  fast: {
    botRollDelay: 120,
    diceRollDuration: 180,
    botMoveDelay: 110,
    moveFinishDelay: 140,
    passTurnDelay: 220,
    autoMoveDelay: 100,
  },
  turbo: {
    botRollDelay: 50,
    diceRollDuration: 90,
    botMoveDelay: 50,
    moveFinishDelay: 80,
    passTurnDelay: 140,
    autoMoveDelay: 50,
  },
};

export const LudoArena: React.FC<LudoArenaProps> = ({
  initialCount = 4,
  initialMode = 'solo',
  userNickname = 'You',
  onExit,
  onMatchFinish,
}) => {
  const [playerCount, setPlayerCount] = useState<LudoPlayerCount>(initialCount);
  const [gameMode, setGameMode] = useState<LudoGameMode>(initialMode);
  const [speed, setSpeed] = useState<LudoGameSpeed>('fast');
  const [autoRollHuman, setAutoRollHuman] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Speed timings
  const timing = SPEED_CONFIG[speed];

  // Bot action guard ref to prevent duplicate/stale async operations
  const botActionPendingRef = useRef(false);

  // Sound sync
  useEffect(() => {
    ludoSound.enabled = soundOn;
  }, [soundOn]);

  // Initialize players
  const createInitialPlayers = useCallback(
    (count: LudoPlayerCount, mode: LudoGameMode): LudoPlayer[] => {
      let colors: LudoColor[] = [];
      if (count === 2) {
        // Red (Top-Left) and Yellow (Bottom-Right) are true diagonal opposites
        colors = ['red', 'yellow'];
      } else if (count === 3) {
        colors = ['red', 'green', 'yellow'];
      } else if (count === 4) {
        colors = ['red', 'green', 'yellow', 'blue'];
      } else if (count === 5) {
        colors = ['red', 'green', 'yellow', 'blue', 'orange'];
      } else {
        colors = ['red', 'green', 'yellow', 'blue', 'orange', 'purple'];
      }

      return colors.map((col, idx) => {
        const isHuman = mode === 'local' ? true : idx === 0;
        const name =
          idx === 0
            ? userNickname || 'You'
            : isHuman
              ? `Player ${idx + 1}`
              : `Bot ${LUDO_COLOR_INFO[col].name}`;

        const tokens: LudoToken[] = Array.from({ length: 4 }, (_, tIdx) => ({
          id: `${col}-${tIdx}`,
          color: col,
          tokenIndex: tIdx,
          state: 'base',
          stepCount: -1,
        }));

        return {
          color: col,
          name,
          isBot: !isHuman,
          tokens,
          rank: 0,
          homeCount: 0,
        };
      });
    },
    [userNickname]
  );

  const [players, setPlayers] = useState<LudoPlayer[]>(() =>
    createInitialPlayers(initialCount, initialMode)
  );
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [consecutiveSixes, setConsecutiveSixes] = useState(0);
  const [winner, setWinner] = useState<LudoPlayer | null>(null);
  const [lastAction, setLastAction] = useState<string>('Match ready. Roll the dice to begin!');
  const [animatingTokenId, setAnimatingTokenId] = useState<string | null>(null);

  // Board layout type
  const activeBoardType: LudoBoardType = playerCount <= 4 ? '4P' : '6P';
  const finishStepCount = activeBoardType === '4P' ? 56 : 77;
  const maxTrackSteps = activeBoardType === '4P' ? 50 : 71;

  const currentPlayer = players[currentTurnIndex] || players[0];

  // Reset match handler
  const handleResetMatch = useCallback(
    (newCount = playerCount, newMode = gameMode) => {
      setPlayerCount(newCount);
      setGameMode(newMode);
      setPlayers(createInitialPlayers(newCount, newMode));
      setCurrentTurnIndex(0);
      setDiceValue(null);
      setIsRolling(false);
      setConsecutiveSixes(0);
      setWinner(null);
      setAnimatingTokenId(null);
      botActionPendingRef.current = false;
      setLastAction(`New ${newCount}-Player match started!`);
      ludoSound.playClick();
    },
    [playerCount, gameMode, createInitialPlayers]
  );

  // Compute movable tokens for current player based on rolled dice
  const canMoveTokenIds = useMemo(() => {
    if (diceValue === null || isRolling || winner) return new Set<string>();

    const validIds = new Set<string>();
    currentPlayer.tokens.forEach((token) => {
      if (token.state === 'finished') return;

      if (token.state === 'base') {
        if (diceValue === 6) validIds.add(token.id);
      } else {
        const nextStep = token.stepCount + diceValue;
        if (nextStep <= finishStepCount) {
          validIds.add(token.id);
        }
      }
    });

    return validIds;
  }, [diceValue, isRolling, winner, currentPlayer, finishStepCount]);

  // Turn advance helper
  const nextTurn = useCallback(() => {
    botActionPendingRef.current = false;
    setDiceValue(null);
    setConsecutiveSixes(0);
    setAnimatingTokenId(null);
    setCurrentTurnIndex((prev) => (prev + 1) % players.length);
  }, [players.length]);

  // Apply move logic
  const applyMove = useCallback(
    (token: LudoToken, rolled: number) => {
      setAnimatingTokenId(token.id);
      let didCapture = false;
      let didReachHome = false;
      let earnedBonusRoll = rolled === 6;

      setPlayers((prevPlayers) => {
        let nextStep = token.stepCount;
        let nextState = token.state;

        if (token.state === 'base') {
          if (rolled === 6) {
            nextState = 'track';
            nextStep = 0;
            ludoSound.playTokenStep(0);
          }
        } else {
          nextStep = token.stepCount + rolled;
          ludoSound.playTokenStep(nextStep);

          if (nextStep === finishStepCount) {
            nextState = 'finished';
            didReachHome = true;
            earnedBonusRoll = true;
            ludoSound.playTokenHome();
          } else if (nextStep > maxTrackSteps) {
            nextState = 'home_stretch';
          } else {
            nextState = 'track';
          }
        }

        // Clone and update players
        const updated = prevPlayers.map((p) => {
          if (p.color !== token.color) return p;

          const updatedTokens = p.tokens.map((t) => {
            if (t.id !== token.id) return t;
            return {
              ...t,
              state: nextState,
              stepCount: nextStep,
            };
          });

          const homeCount = updatedTokens.filter((t) => t.state === 'finished').length;
          return {
            ...p,
            tokens: updatedTokens,
            homeCount,
          };
        });

        // Check track captures on opponent tokens
        if (nextState === 'track') {
          const modTrack = activeBoardType === '4P' ? 52 : 72;
          const myStartIdx =
            activeBoardType === '4P'
              ? (COLOR_START_INDEX_4P[token.color] ?? 0)
              : (COLOR_START_INDEX_6P[token.color] ?? 0);
          const worldTrackIndex = (myStartIdx + nextStep) % modTrack;

          const isSafeStar =
            activeBoardType === '4P'
              ? STAR_INDICES_4P.has(worldTrackIndex)
              : STAR_INDICES_6P.has(worldTrackIndex);

          if (!isSafeStar) {
            updated.forEach((opp) => {
              if (opp.color === token.color) return;

              opp.tokens = opp.tokens.map((oppToken) => {
                if (oppToken.state !== 'track') return oppToken;

                const oppStart =
                  activeBoardType === '4P'
                    ? (COLOR_START_INDEX_4P[opp.color] ?? 0)
                    : (COLOR_START_INDEX_6P[opp.color] ?? 0);
                const oppWorld = (oppStart + oppToken.stepCount) % modTrack;

                if (oppWorld === worldTrackIndex) {
                  didCapture = true;
                  earnedBonusRoll = true;
                  ludoSound.playCapture();
                  return {
                    ...oppToken,
                    state: 'base' as const,
                    stepCount: -1,
                  };
                }
                return oppToken;
              });
            });
          }
        }

        // Check win condition
        const matchWinner = updated.find((p) => p.homeCount === 4);
        if (matchWinner) {
          setWinner(matchWinner);
          ludoSound.playWinner();
          onMatchFinish?.(matchWinner.color, matchWinner.name);
          setLastAction(`🏆 ${matchWinner.name} has won the match!`);
          return updated;
        }

        return updated;
      });

      // Update action log text
      if (didCapture) {
        setLastAction(`💥 ${currentPlayer.name} captured an opponent! Bonus roll earned!`);
      } else if (didReachHome) {
        setLastAction(`🎉 ${currentPlayer.name}'s token entered HOME! Bonus roll earned!`);
      } else if (rolled === 6) {
        setLastAction(`${currentPlayer.name} rolled a 6! Extra roll granted.`);
      }

      // Fast transition
      setTimeout(() => {
        setAnimatingTokenId(null);
        if (earnedBonusRoll) {
          setDiceValue(null);
          botActionPendingRef.current = false;
        } else {
          nextTurn();
        }
      }, timing.moveFinishDelay);
    },
    [
      activeBoardType,
      currentPlayer.name,
      currentPlayer.color,
      finishStepCount,
      maxTrackSteps,
      nextTurn,
      onMatchFinish,
      timing.moveFinishDelay,
    ]
  );

  // Handle rolling the dice (Human or Bot)
  const handleRollDice = useCallback(() => {
    if (isRolling || diceValue !== null || winner) return;

    setIsRolling(true);
    ludoSound.playDiceRoll();

    setTimeout(() => {
      const rolled = Math.floor(Math.random() * 6) + 1;
      setDiceValue(rolled);
      setIsRolling(false);

      if (rolled === 6) {
        ludoSound.playRollSix();
        const nextSixes = consecutiveSixes + 1;
        setConsecutiveSixes(nextSixes);

        if (nextSixes === 3) {
          setLastAction('Three consecutive 6s! Turn forfeited.');
          setTimeout(nextTurn, timing.passTurnDelay);
          return;
        } else {
          setLastAction(`${currentPlayer.name} rolled a 6! Extra roll.`);
        }
      } else {
        setConsecutiveSixes(0);
        setLastAction(`${currentPlayer.name} rolled a ${rolled}.`);
      }

      // Check legal moves
      let hasValidMove = false;
      currentPlayer.tokens.forEach((token) => {
        if (token.state === 'finished') return;
        if (token.state === 'base') {
          if (rolled === 6) hasValidMove = true;
        } else if (token.stepCount + rolled <= finishStepCount) {
          hasValidMove = true;
        }
      });

      if (!hasValidMove) {
        setLastAction(`${currentPlayer.name} rolled a ${rolled} — no moves possible.`);
        setTimeout(nextTurn, timing.passTurnDelay);
      }
    }, timing.diceRollDuration);
  }, [
    isRolling,
    diceValue,
    winner,
    consecutiveSixes,
    currentPlayer,
    finishStepCount,
    nextTurn,
    timing.diceRollDuration,
    timing.passTurnDelay,
  ]);

  // Handle manual token selection by Human player
  const handleSelectToken = useCallback(
    (token: LudoToken) => {
      if (diceValue === null || isRolling || winner) return;
      if (!canMoveTokenIds.has(token.id)) return;
      applyMove(token, diceValue);
    },
    [applyMove, canMoveTokenIds, diceValue, isRolling, winner]
  );

  // =========================================================================
  // BLAZING FAST AUTO-MOVE FOR SINGLE CHOICE (HUMAN OR BOT)
  // When only 1 move is possible, execute without redundant delay!
  // =========================================================================
  useEffect(() => {
    if (diceValue === null || isRolling || winner) return;

    // Only 1 legal move exists
    if (canMoveTokenIds.size === 1) {
      const singleTokenId = Array.from(canMoveTokenIds)[0];
      const singleToken = currentPlayer.tokens.find((t) => t.id === singleTokenId);
      if (!singleToken) return;

      // In fast/turbo modes, auto-execute for both Bot and Human
      // In normal mode, auto-execute for Bot
      const shouldAutoMove = currentPlayer.isBot || speed !== 'normal';

      if (shouldAutoMove) {
        const timer = setTimeout(() => {
          applyMove(singleToken, diceValue);
        }, timing.autoMoveDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [
    canMoveTokenIds,
    currentPlayer,
    diceValue,
    isRolling,
    winner,
    speed,
    timing.autoMoveDelay,
    applyMove,
  ]);

  // Human Auto-Roll feature
  useEffect(() => {
    if (
      autoRollHuman &&
      !currentPlayer.isBot &&
      diceValue === null &&
      !isRolling &&
      !winner
    ) {
      const timer = setTimeout(() => {
        handleRollDice();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoRollHuman, currentPlayer.isBot, diceValue, isRolling, winner, handleRollDice]);

  // =========================================================================
  // ROBUST & FAST AI BOT AUTOMATION LOOP
  // =========================================================================
  useEffect(() => {
    if (winner || !currentPlayer.isBot) return;

    let timer: NodeJS.Timeout;

    // Phase 1: Bot rolls the dice
    if (diceValue === null && !isRolling && !botActionPendingRef.current) {
      botActionPendingRef.current = true;
      timer = setTimeout(() => {
        handleRollDice();
      }, timing.botRollDelay);
    }
    // Phase 2: Bot picks best legal move (when multiple moves exist)
    else if (diceValue !== null && !isRolling && canMoveTokenIds.size > 1) {
      timer = setTimeout(() => {
        const eligibleTokens = currentPlayer.tokens.filter((t) => canMoveTokenIds.has(t.id));
        if (eligibleTokens.length === 0) {
          nextTurn();
          return;
        }

        // Smart scoring: 1) Reaching home, 2) Capture, 3) Deploy from base, 4) Highest progress
        let chosen = eligibleTokens[0];
        let bestScore = -100;

        eligibleTokens.forEach((t) => {
          let score = 0;
          if (t.state === 'base') {
            score = 75; // Bring piece out on 6
          } else {
            const nextStep = t.stepCount + diceValue;
            if (nextStep === finishStepCount) {
              score = 120; // Entering home
            } else if (nextStep <= maxTrackSteps) {
              const startIdx =
                activeBoardType === '4P'
                  ? (COLOR_START_INDEX_4P[currentPlayer.color] ?? 0)
                  : (COLOR_START_INDEX_6P[currentPlayer.color] ?? 0);
              const modTrack = activeBoardType === '4P' ? 52 : 72;
              const targetWorld = (startIdx + nextStep) % modTrack;
              const isStar =
                activeBoardType === '4P'
                  ? STAR_INDICES_4P.has(targetWorld)
                  : STAR_INDICES_6P.has(targetWorld);

              if (!isStar) {
                // Check if landing captures an opponent
                const canCaptureOpponent = players.some(
                  (p) =>
                    p.color !== currentPlayer.color &&
                    p.tokens.some((ot) => {
                      if (ot.state !== 'track') return false;
                      const oppStart =
                        activeBoardType === '4P'
                          ? (COLOR_START_INDEX_4P[p.color] ?? 0)
                          : (COLOR_START_INDEX_6P[p.color] ?? 0);
                      return (oppStart + ot.stepCount) % modTrack === targetWorld;
                    })
                );
                if (canCaptureOpponent) score = 100;
              } else {
                score = 65; // Safe star
              }

              if (score === 0) {
                score = 30 + Math.floor(nextStep / 2); // Prefer furthest token
              }
            } else {
              score = 80 + (nextStep - maxTrackSteps) * 5; // In home stretch
            }
          }

          if (score > bestScore) {
            bestScore = score;
            chosen = t;
          }
        });

        applyMove(chosen, diceValue);
      }, timing.botMoveDelay);
    }

    return () => clearTimeout(timer);
  }, [
    currentPlayer,
    diceValue,
    isRolling,
    canMoveTokenIds,
    winner,
    handleRollDice,
    applyMove,
    nextTurn,
    activeBoardType,
    finishStepCount,
    maxTrackSteps,
    players,
    timing.botRollDelay,
    timing.botMoveDelay,
  ]);

  // Watchdog timer: If a bot turn ever takes too long, auto-advance
  useEffect(() => {
    if (!currentPlayer.isBot || winner) return;

    const watchdog = setTimeout(() => {
      if (currentPlayer.isBot && !isRolling) {
        botActionPendingRef.current = false;
        nextTurn();
      }
    }, 2800);

    return () => clearTimeout(watchdog);
  }, [currentPlayer, isRolling, winner, nextTurn]);

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore
    }
  };

  const currentPlayerInfo = LUDO_COLOR_INFO[currentPlayer.color];
  const isHumanTurn = !currentPlayer.isBot;

  return (
    <div
      ref={containerRef}
      className="relative flex h-[100dvh] w-[100dvw] flex-col overflow-hidden bg-slate-950 font-sans text-slate-100 select-none"
    >
      {/* =================================================================== */}
      {/* TOP HEADER: DIRECT CONTROLS & SPEED CONTROLS                        */}
      {/* =================================================================== */}
      <header className="z-30 flex min-h-[56px] w-full shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/95 px-2.5 sm:px-4 py-1.5 shadow-md backdrop-blur-md">
        {/* Left: Back / Exit & Brand */}
        <div className="flex items-center gap-2">
          {onExit && (
            <button
              type="button"
              onClick={() => {
                ludoSound.playClick();
                onExit();
              }}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              title="Exit Ludo"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="hidden md:flex items-center gap-1.5">
            <span className="font-display text-base sm:text-lg font-black tracking-wider text-amber-400">
              TROJO
            </span>
            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-black text-amber-300">
              LUDO
            </span>
          </div>
        </div>

        {/* Center: DIRECT MODE, PLAYERS & SPEED SELECTION */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {/* Game Mode: Bot vs Play & Pass */}
          <div className="flex rounded-xl bg-slate-950/80 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => handleResetMatch(playerCount, 'solo')}
              className={`flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-black transition-all ${
                gameMode === 'solo'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Bot</span>
            </button>
            <button
              type="button"
              onClick={() => handleResetMatch(playerCount, 'local')}
              className={`flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-xs font-black transition-all ${
                gameMode === 'local'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Pass & Play</span>
            </button>
          </div>

          {/* Number of Players: 2, 3, 4, 5, 6 directly on screen */}
          <div className="flex rounded-xl bg-slate-950/80 p-0.5 border border-slate-800">
            {([2, 3, 4, 5, 6] as LudoPlayerCount[]).map((count) => {
              const isSelected = playerCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleResetMatch(count, gameMode)}
                  className={`rounded-lg px-1.5 sm:px-2.5 py-1 text-xs font-black transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {count}P
                </button>
              );
            })}
          </div>

          {/* Speed Selector: Normal (1x), Fast (2x - Default), Turbo (3x) */}
          <div className="flex rounded-xl bg-slate-950/80 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSpeed('normal');
                ludoSound.playClick();
              }}
              className={`rounded-lg px-2 py-1 text-[11px] font-black transition-all ${
                speed === 'normal'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Normal Speed"
            >
              1x
            </button>
            <button
              type="button"
              onClick={() => {
                setSpeed('fast');
                ludoSound.playClick();
              }}
              className={`flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-black transition-all ${
                speed === 'fast'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Fast Speed (Snappy 2x)"
            >
              <Zap className="h-3 w-3" />
              <span>2x</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSpeed('turbo');
                ludoSound.playClick();
              }}
              className={`flex items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-black transition-all ${
                speed === 'turbo'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Turbo Speed (Blazing 3x)"
            >
              <FastForward className="h-3 w-3" />
              <span>3x</span>
            </button>
          </div>
        </div>

        {/* Right: Sound, Reset & Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSoundOn((prev) => !prev);
              ludoSound.playClick();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            title={soundOn ? 'Mute Audio' : 'Enable Audio'}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-red-400" />}
          </button>

          <button
            type="button"
            onClick={() => handleResetMatch()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Reset Match"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* PLAYERS MINI SCORE HUD: TOKENS HOME STATUS CHIPS                    */}
      {/* =================================================================== */}
      <div className="z-20 flex w-full shrink-0 items-center justify-center gap-1.5 sm:gap-3 bg-slate-900/60 px-2 py-1 border-b border-slate-800/80">
        {players.map((p, idx) => {
          const isTurn = idx === currentTurnIndex;
          const info = LUDO_COLOR_INFO[p.color];
          return (
            <div
              key={p.color}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition-all ${
                isTurn
                  ? 'ring-2 ring-white shadow-md'
                  : 'opacity-70'
              }`}
              style={{ backgroundColor: `${info.dark}DD` }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full border border-white"
                style={{ backgroundColor: info.primary }}
              />
              <span className="text-[11px] font-black text-white">{p.name}</span>
              <span className="rounded-full bg-slate-950/70 px-1.5 py-0.2 text-[10px] font-extrabold text-amber-300">
                {p.homeCount}/4
              </span>
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* MAIN GAMEPLAY AREA: FULL-SCREEN ADAPTIVE BOARD                      */}
      {/* =================================================================== */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-1 sm:p-2">
        <div className="relative flex h-full w-full max-h-[calc(100dvh-155px)] max-w-[calc(100dvh-155px)] items-center justify-center">
          {activeBoardType === '4P' ? (
            <LudoBoard4P
              players={players}
              currentTurnColor={currentPlayer.color}
              canMoveTokenIds={canMoveTokenIds}
              onSelectToken={handleSelectToken}
              animatingTokenId={animatingTokenId}
            />
          ) : (
            <LudoBoard6P
              players={players}
              currentTurnColor={currentPlayer.color}
              canMoveTokenIds={canMoveTokenIds}
              onSelectToken={handleSelectToken}
              animatingTokenId={animatingTokenId}
            />
          )}
        </div>
      </main>

      {/* =================================================================== */}
      {/* BOTTOM ACTION BAR: TURN BANNER, 3D DICE & STATUS                    */}
      {/* =================================================================== */}
      <footer className="z-30 flex min-h-[66px] w-full shrink-0 items-center justify-between border-t border-slate-800 bg-slate-900/95 px-3 sm:px-6 py-2 backdrop-blur-md">
        {/* Left: Active Player Banner */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div
            className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl shadow-lg border-2 border-white/30 transition-transform"
            style={{
              backgroundColor: currentPlayerInfo.primary,
              boxShadow: `0 0 18px ${currentPlayerInfo.primary}80`,
            }}
          >
            {currentPlayer.isBot ? (
              <Bot className="h-6 w-6 text-white" />
            ) : (
              <Crown className="h-6 w-6 text-white" />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm sm:text-base font-black text-white">
                {currentPlayer.name}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white"
                style={{ backgroundColor: currentPlayerInfo.dark }}
              >
                {currentPlayerInfo.name}
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-300">
              {currentPlayer.isBot
                ? isRolling
                  ? 'Rolling dice...'
                  : diceValue !== null
                    ? 'Choosing token...'
                    : 'Thinking...'
                : isRolling
                  ? 'Rolling dice...'
                  : diceValue === null
                    ? 'Your turn! Tap dice to roll.'
                    : canMoveTokenIds.size > 0
                      ? 'Tap a glowing token to move.'
                      : 'No moves. Passing turn...'}
            </span>
          </div>
        </div>

        {/* Center: Action Log Ticker */}
        <div className="hidden lg:flex max-w-md items-center justify-center rounded-xl bg-slate-950/80 px-4 py-2 text-center text-xs font-semibold text-slate-300 border border-slate-800">
          <Sparkles className="mr-2 h-4 w-4 shrink-0 text-amber-400" />
          <span className="truncate">{lastAction}</span>
        </div>

        {/* Right: Auto-Roll Toggle & Interactive 3D Dice */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Auto-Roll Button for Solo Human */}
          {!currentPlayer.isBot && gameMode === 'solo' && (
            <button
              type="button"
              onClick={() => setAutoRollHuman((prev) => !prev)}
              className={`hidden sm:flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-black transition-all border ${
                autoRollHuman
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Automatically roll dice on your turn"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Auto Roll: {autoRollHuman ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <LudoDice
            value={diceValue}
            isRolling={isRolling}
            canRoll={isHumanTurn && diceValue === null && !winner}
            playerColor={currentPlayer.color}
            onRoll={handleRollDice}
            consecutiveSixes={consecutiveSixes}
          />
        </div>
      </footer>

      {/* =================================================================== */}
      {/* WINNER CELEBRATION MODAL                                            */}
      {/* =================================================================== */}
      {winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-500/40 bg-slate-900 p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 ring-8 ring-amber-500/10">
              <Trophy className="h-10 w-10 animate-bounce" />
            </div>

            <h2 className="mt-4 font-display text-2xl font-black text-white sm:text-3xl">
              VICTORY!
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-300">
              <span
                className="font-black"
                style={{ color: LUDO_COLOR_INFO[winner.color].primary }}
              >
                {winner.name}
              </span>{' '}
              has brought all 4 tokens HOME and won the match!
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => handleResetMatch()}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 font-display text-sm font-black text-slate-950 shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Play Again</span>
              </button>

              {onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="flex min-h-[48px] items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-6 py-3 font-display text-sm font-black text-white hover:bg-slate-700"
                >
                  Exit to Home
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
