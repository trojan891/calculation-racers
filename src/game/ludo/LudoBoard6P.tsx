import React, { useMemo } from 'react';
import {
  ARM_ANGLES_RAD,
  BASE_ROOM_CENTERS_6P,
  BASE_SLOTS_6P,
  COLOR_START_INDEX_6P,
  CX,
  CY,
  HOME_CENTER_COORDS_6P,
  HOME_STRETCH_COORDS_6P,
  LUDO_6P_ORDER,
  STAR_INDICES_6P,
  TRACK_COORDS_6P,
} from './boardCoordinates6P';
import { LUDO_COLOR_INFO, LudoColor, LudoPlayer, LudoToken } from './types';

interface LudoBoard6PProps {
  players: LudoPlayer[];
  currentTurnColor: LudoColor;
  canMoveTokenIds: Set<string>;
  onSelectToken: (token: LudoToken) => void;
  animatingTokenId?: string | null;
}

export const LudoBoard6P: React.FC<LudoBoard6PProps> = ({
  players,
  currentTurnColor,
  canMoveTokenIds,
  onSelectToken,
  animatingTokenId,
}) => {
  const activeColors = useMemo(() => new Set(players.map((p) => p.color)), [players]);

  // Map all tokens by position to handle stacking
  const tokenPositionMap = new Map<string, { token: LudoToken; player: LudoPlayer }[]>();

  players.forEach((player) => {
    player.tokens.forEach((token) => {
      let key = '';
      if (token.state === 'base') {
        key = `base-${token.color}-${token.tokenIndex}`;
      } else if (token.state === 'finished') {
        key = `home-${token.color}`;
      } else if (token.state === 'home_stretch') {
        const step = token.stepCount - 72; // 0..4
        key = `stretch-${token.color}-${step}`;
      } else {
        const startIdx = COLOR_START_INDEX_6P[token.color] ?? 0;
        const trackIdx = (startIdx + token.stepCount) % 72;
        key = `track-${trackIdx}`;
      }

      const existing = tokenPositionMap.get(key) || [];
      existing.push({ token, player });
      tokenPositionMap.set(key, existing);
    });
  });

  // Calculate coordinates for token
  const getTokenCoords = (
    token: LudoToken,
    stackIndex: number,
    stackTotal: number
  ): { x: number; y: number } => {
    let baseX = 0;
    let baseY = 0;

    if (token.state === 'base') {
      const slot = BASE_SLOTS_6P[token.color][token.tokenIndex];
      baseX = slot.x;
      baseY = slot.y;
    } else if (token.state === 'finished') {
      const center = HOME_CENTER_COORDS_6P[token.color];
      baseX = center.x;
      baseY = center.y;
    } else if (token.state === 'home_stretch') {
      const step = Math.min(4, Math.max(0, token.stepCount - 72));
      const pt = HOME_STRETCH_COORDS_6P[token.color][step];
      baseX = pt.x;
      baseY = pt.y;
    } else {
      const startIdx = COLOR_START_INDEX_6P[token.color] ?? 0;
      const trackIdx = (startIdx + token.stepCount) % 72;
      const pt = TRACK_COORDS_6P[trackIdx];
      baseX = pt.x;
      baseY = pt.y;
    }

    if (stackTotal <= 1) {
      return { x: baseX, y: baseY };
    }

    const angle = (stackIndex / stackTotal) * 2 * Math.PI;
    const r = 14;
    return {
      x: baseX + Math.round(r * Math.cos(angle)),
      y: baseY + Math.round(r * Math.sin(angle)),
    };
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center p-0.5 sm:p-2">
      <svg
        viewBox="0 0 1500 1500"
        className="max-h-full max-w-full drop-shadow-2xl select-none"
        style={{ aspectRatio: '1 / 1' }}
      >
        <defs>
          <filter id="board-card-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodOpacity="0.32" />
          </filter>
          <filter id="pawn-3d-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodOpacity="0.5" />
          </filter>
          <radialGradient id="pawn-gloss-6p" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
          </radialGradient>
          <radialGradient id="gold-hex-pedestal" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#78350F" />
          </radialGradient>
        </defs>

        {/* Board Background Hexagonal Outer Frame */}
        <polygon
          points={(() => {
            const pts: string[] = [];
            for (let i = 0; i < 6; i++) {
              const a = (i * 60) * (Math.PI / 180);
              pts.push(`${Math.round(CX + 735 * Math.cos(a))},${Math.round(CY + 735 * Math.sin(a))}`);
            }
            return pts.join(' ');
          })()}
          fill="#0F172A"
          stroke="#1E293B"
          strokeWidth="12"
        />

        {/* Inner Playing Canvas Hexagon */}
        <polygon
          points={(() => {
            const pts: string[] = [];
            for (let i = 0; i < 6; i++) {
              const a = (i * 60) * (Math.PI / 180);
              pts.push(`${Math.round(CX + 710 * Math.cos(a))},${Math.round(CY + 710 * Math.sin(a))}`);
            }
            return pts.join(' ');
          })()}
          fill="#F8FAFC"
        />

        {/* Track Ring Guide Background */}
        <circle cx={CX} cy={CY} r="490" fill="#1E293B" stroke="#334155" strokeWidth="4" />
        <circle cx={CX} cy={CY} r="325" fill="#0F172A" stroke="#334155" strokeWidth="3" />

        {/* =================================================================== */}
        {/* 1. SIX DISTINCT REALISTIC BASE ROOMS WITH CONNECTED DOORWAYS        */}
        {/* =================================================================== */}
        {LUDO_6P_ORDER.map((col) => {
          const isActive = activeColors.has(col);
          const info = LUDO_COLOR_INFO[col];
          const center = BASE_ROOM_CENTERS_6P[col];
          const angle = ARM_ANGLES_RAD[col];
          const roomW = 240;
          const roomH = 240;
          const rx = center.x - roomW / 2;
          const ry = center.y - roomH / 2;

          // Doorway corridor point toward center
          const doorX = center.x + Math.round(115 * Math.cos(angle + Math.PI)); // toward center
          const doorY = center.y + Math.round(115 * Math.sin(angle + Math.PI));
          const startPt = TRACK_COORDS_6P[COLOR_START_INDEX_6P[col]];

          return (
            <g
              key={`base-room-${col}`}
              opacity={isActive ? 1 : 0.4}
              filter="url(#board-card-shadow)"
            >
              {/* Outer Room Wall */}
              <rect
                x={rx}
                y={ry}
                width={roomW}
                height={roomH}
                rx="22"
                fill={isActive ? info.primary : '#334155'}
                stroke="#FFFFFF"
                strokeWidth="4"
              />

              {/* Inner Room Floor (White Card) */}
              <rect
                x={rx + 14}
                y={ry + 14}
                width={roomW - 28}
                height={roomH - 28}
                rx="16"
                fill={isActive ? '#FFFFFF' : '#1E293B'}
              />

              {/* Room Header Banner */}
              <rect
                x={rx + 20}
                y={ry + 18}
                width={roomW - 40}
                height="32"
                rx="8"
                fill={isActive ? info.light : '#334155'}
              />
              <text
                x={center.x}
                y={ry + 40}
                textAnchor="middle"
                fill={isActive ? info.dark : '#94A3B8'}
                fontSize="15"
                fontWeight="900"
                fontFamily="system-ui, sans-serif"
                letterSpacing="1"
              >
                {isActive ? `${info.name.toUpperCase()} BASE` : 'EMPTY BASE'}
              </text>

              {/* 4 Token Slots Inside the Room */}
              {BASE_SLOTS_6P[col].map((slot, sIdx) => (
                <g key={`slot-${col}-${sIdx}`}>
                  <circle
                    cx={slot.x}
                    cy={slot.y}
                    r="30"
                    fill={isActive ? info.light : '#0F172A'}
                    stroke={isActive ? info.primary : '#475569'}
                    strokeWidth="3.5"
                  />
                  {isActive && (
                    <circle
                      cx={slot.x}
                      cy={slot.y}
                      r="10"
                      fill={info.primary}
                      opacity="0.3"
                    />
                  )}
                </g>
              ))}

              {/* EXPLICIT REALISTIC DOORWAY GATE: connects room interior directly to start tile */}
              {isActive && (
                <g id={`doorway-${col}`}>
                  {/* Gate bridge line */}
                  <line
                    x1={doorX}
                    y1={doorY}
                    x2={startPt.x}
                    y2={startPt.y}
                    stroke={info.primary}
                    strokeWidth="12"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  <line
                    x1={doorX}
                    y1={doorY}
                    x2={startPt.x}
                    y2={startPt.y}
                    stroke="#FFFFFF"
                    strokeWidth="4"
                    strokeDasharray="4 4"
                  />
                  {/* Exit archway badge at the doorstep */}
                  <circle
                    cx={doorX}
                    cy={doorY}
                    r="12"
                    fill={info.primary}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* =================================================================== */}
        {/* 2. 72 TRACK CELLS WITH ROTATED DIRECTIONAL ARROWS                   */}
        {/* =================================================================== */}
        {TRACK_COORDS_6P.map((pt, i) => {
          const isStar = STAR_INDICES_6P.has(i);

          // Find if this is a starting cell of any player
          const startingColor = LUDO_6P_ORDER.find(
            (c) => COLOR_START_INDEX_6P[c] === i
          );
          const isStart = Boolean(startingColor);
          const startInfo = startingColor ? LUDO_COLOR_INFO[startingColor] : null;
          const isStartActive = startingColor ? activeColors.has(startingColor) : false;

          // Next cell for tangent orientation
          const nextPt = TRACK_COORDS_6P[(i + 1) % 72];
          const tangentAngleDeg =
            (Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x) * 180) / Math.PI;

          return (
            <g key={`track-6p-${i}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isStart ? 24 : 19}
                fill={
                  isStart && startInfo && isStartActive
                    ? startInfo.primary
                    : isStar
                      ? '#FEF08A'
                      : '#FFFFFF'
                }
                stroke={
                  isStart && startInfo && isStartActive
                    ? '#FFFFFF'
                    : isStar
                      ? '#CA8A04'
                      : '#64748B'
                }
                strokeWidth={isStart ? 3.5 : 2}
                filter="url(#board-card-shadow)"
              />

              {/* Start Cell Exit Arrow: rotated along EXACT clockwise track tangent */}
              {isStart && startInfo && isStartActive && (
                <g transform={`translate(${pt.x}, ${pt.y}) rotate(${tangentAngleDeg})`}>
                  <polygon
                    points="6,0 -5,-6 -2,0 -5,6"
                    fill="#FFFFFF"
                  />
                </g>
              )}

              {/* Safe Star icon */}
              {isStar && !isStart && (
                <text
                  x={pt.x}
                  y={pt.y + 7}
                  textAnchor="middle"
                  fontSize="20"
                  fill="#CA8A04"
                  fontWeight="bold"
                >
                  ★
                </text>
              )}
            </g>
          );
        })}

        {/* =================================================================== */}
        {/* 3. HOME RUNWAYS (5 CELLS TOWARDS CENTER PER COLOR)                  */}
        {/* =================================================================== */}
        {LUDO_6P_ORDER.map((col) => {
          const info = LUDO_COLOR_INFO[col];
          const steps = HOME_STRETCH_COORDS_6P[col];
          const isActive = activeColors.has(col);

          return (
            <g key={`runway-${col}`} opacity={isActive ? 1 : 0.3}>
              {steps.map((st, sIdx) => (
                <g key={`step-${col}-${sIdx}`}>
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r="19"
                    fill={info.primary}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    filter="url(#board-card-shadow)"
                  />
                  <text
                    x={st.x}
                    y={st.y + 5}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="13"
                    fontWeight="900"
                    opacity="0.85"
                  >
                    {sIdx + 1}
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {/* =================================================================== */}
        {/* 4. CENTRAL HOME HEXAGON PODIUM                                      */}
        {/* =================================================================== */}
        <polygon
          points={(() => {
            const pts: string[] = [];
            for (let i = 0; i < 6; i++) {
              const a = (i * 60 + 30) * (Math.PI / 180);
              pts.push(`${Math.round(CX + 130 * Math.cos(a))},${Math.round(CY + 130 * Math.sin(a))}`);
            }
            return pts.join(' ');
          })()}
          fill="#1E293B"
          stroke="#0F172A"
          strokeWidth="6"
        />

        {/* 6 Triangular Destination Wedges into Central Home */}
        {LUDO_6P_ORDER.map((col, idx) => {
          const a1 = (idx * 60) * (Math.PI / 180);
          const a2 = ((idx + 1) * 60) * (Math.PI / 180);
          const x1 = Math.round(CX + 120 * Math.cos(a1));
          const y1 = Math.round(CY + 120 * Math.sin(a1));
          const x2 = Math.round(CX + 120 * Math.cos(a2));
          const y2 = Math.round(CY + 120 * Math.sin(a2));
          const info = LUDO_COLOR_INFO[col];

          return (
            <polygon
              key={`home-wedge-${col}`}
              points={`${CX},${CY} ${x1},${y1} ${x2},${y2}`}
              fill={info.primary}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          );
        })}

        {/* Central Golden Crown Circle */}
        <circle
          cx={CX}
          cy={CY}
          r="46"
          fill="url(#gold-hex-pedestal)"
          stroke="#78350F"
          strokeWidth="4.5"
          filter="url(#board-card-shadow)"
        />
        <text
          x={CX}
          y={CY + 12}
          textAnchor="middle"
          fontSize="30"
          fill="#78350F"
          fontWeight="900"
        >
          👑
        </text>

        {/* =================================================================== */}
        {/* 5. TOKENS LAYER (SNAPPY, FAST ANIMATION & GLOW)                   */}
        {/* =================================================================== */}
        {players.map((player) =>
          player.tokens.map((token) => {
            const isCanMove = canMoveTokenIds.has(token.id);
            const colorInfo = LUDO_COLOR_INFO[token.color];

            let stackKey = '';
            if (token.state === 'base') {
              stackKey = `base-${token.color}-${token.tokenIndex}`;
            } else if (token.state === 'finished') {
              stackKey = `home-${token.color}`;
            } else if (token.state === 'home_stretch') {
              stackKey = `stretch-${token.color}-${token.stepCount - 72}`;
            } else {
              const startIdx = COLOR_START_INDEX_6P[token.color] ?? 0;
              const trackIdx = (startIdx + token.stepCount) % 72;
              stackKey = `track-${trackIdx}`;
            }

            const stack = tokenPositionMap.get(stackKey) || [];
            const stackIdx = stack.findIndex((item) => item.token.id === token.id);
            const stackTotal = stack.length;

            const { x, y } = getTokenCoords(token, stackIdx >= 0 ? stackIdx : 0, stackTotal);

            return (
              <g
                key={token.id}
                transform={`translate(${x}, ${y})`}
                onClick={() => {
                  if (isCanMove) onSelectToken(token);
                }}
                className={isCanMove ? 'cursor-pointer' : ''}
                style={{
                  transition: 'transform 0.16s cubic-bezier(0.2, 0.9, 0.35, 1.1)',
                  filter: 'url(#pawn-3d-shadow)',
                }}
              >
                {/* Glowing ring when eligible */}
                {isCanMove && (
                  <>
                    <circle
                      cx="0"
                      cy="0"
                      r="40"
                      fill="none"
                      stroke="#FACC15"
                      strokeWidth="5"
                      opacity="0.9"
                      className="animate-ping"
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r="36"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="3.5"
                      strokeDasharray="6 4"
                      className="animate-spin"
                    />
                  </>
                )}

                {/* Outer Token Rim */}
                <circle
                  cx="0"
                  cy="0"
                  r="27"
                  fill={colorInfo.primary}
                  stroke="#FFFFFF"
                  strokeWidth="4"
                />

                {/* Token Gloss */}
                <circle cx="0" cy="0" r="23" fill="url(#pawn-gloss-6p)" />

                {/* Center Cap */}
                <circle cx="0" cy="0" r="14" fill="#FFFFFF" opacity="0.95" />
                <circle cx="0" cy="0" r="8" fill={colorInfo.dark} />

                {/* Star on Finished */}
                {token.state === 'finished' && (
                  <text
                    x="0"
                    y="6"
                    textAnchor="middle"
                    fontSize="15"
                    fill="#F59E0B"
                    fontWeight="bold"
                  >
                    ★
                  </text>
                )}

                {/* Stack indicator count badge */}
                {stackTotal > 1 && stackIdx === stackTotal - 1 && (
                  <g transform="translate(15, -15)">
                    <circle cx="0" cy="0" r="10" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="900"
                      fill="#FFFFFF"
                    >
                      {stackTotal}
                    </text>
                  </g>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
};
