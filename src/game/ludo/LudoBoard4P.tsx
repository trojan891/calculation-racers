import React, { useMemo } from 'react';
import {
  BASE_SLOTS_4P,
  COLOR_START_INDEX_4P,
  HOME_CENTER_COORDS_4P,
  HOME_STRETCH_COORDS_4P,
  STAR_INDICES_4P,
  TRACK_COORDS_4P,
} from './boardCoordinates4P';
import { LUDO_COLOR_INFO, LudoColor, LudoPlayer, LudoToken } from './types';

interface LudoBoard4PProps {
  players: LudoPlayer[];
  currentTurnColor: LudoColor;
  canMoveTokenIds: Set<string>;
  onSelectToken: (token: LudoToken) => void;
  animatingTokenId?: string | null;
}

export const LudoBoard4P: React.FC<LudoBoard4PProps> = ({
  players,
  currentTurnColor,
  canMoveTokenIds,
  onSelectToken,
  animatingTokenId,
}) => {
  // Active player colors
  const activeColors = useMemo(() => new Set(players.map((p) => p.color)), [players]);

  // Map all tokens by position to handle stacking
  // Key format: 'track-INDEX', 'base-COLOR-INDEX', 'stretch-COLOR-STEP', 'home-COLOR'
  const tokenPositionMap = new Map<string, { token: LudoToken; player: LudoPlayer }[]>();

  players.forEach((player) => {
    player.tokens.forEach((token) => {
      let key = '';
      if (token.state === 'base') {
        key = `base-${token.color}-${token.tokenIndex}`;
      } else if (token.state === 'finished') {
        key = `home-${token.color}`;
      } else if (token.state === 'home_stretch') {
        const step = token.stepCount - 51; // 0..4
        key = `stretch-${token.color}-${step}`;
      } else {
        // On track
        const startIdx = COLOR_START_INDEX_4P[token.color];
        const trackIdx = (startIdx + token.stepCount) % 52;
        key = `track-${trackIdx}`;
      }

      const existing = tokenPositionMap.get(key) || [];
      existing.push({ token, player });
      tokenPositionMap.set(key, existing);
    });
  });

  // Helper to compute token coordinate
  const getTokenCoords = (
    token: LudoToken,
    stackIndex: number,
    stackTotal: number
  ): { x: number; y: number } => {
    let baseX = 0;
    let baseY = 0;

    if (token.state === 'base') {
      const slot = BASE_SLOTS_4P[token.color][token.tokenIndex];
      baseX = slot.x;
      baseY = slot.y;
    } else if (token.state === 'finished') {
      const center = HOME_CENTER_COORDS_4P[token.color];
      baseX = center.x;
      baseY = center.y;
    } else if (token.state === 'home_stretch') {
      const step = Math.min(4, Math.max(0, token.stepCount - 51));
      const coord = HOME_STRETCH_COORDS_4P[token.color][step];
      baseX = coord.col * 100 + 50;
      baseY = coord.row * 100 + 50;
    } else {
      const startIdx = COLOR_START_INDEX_4P[token.color];
      const trackIdx = (startIdx + token.stepCount) % 52;
      const coord = TRACK_COORDS_4P[trackIdx];
      baseX = coord.col * 100 + 50;
      baseY = coord.row * 100 + 50;
    }

    if (stackTotal <= 1) {
      return { x: baseX, y: baseY };
    }

    // Offset stacked tokens cleanly so all are visible
    const offsets = [
      { dx: -16, dy: -16 },
      { dx: 16, dy: -16 },
      { dx: -16, dy: 16 },
      { dx: 16, dy: 16 },
    ];
    const off = offsets[stackIndex % offsets.length];
    return { x: baseX + off.dx, y: baseY + off.dy };
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center p-0.5 sm:p-2">
      <svg
        viewBox="0 0 1500 1500"
        className="max-h-full max-w-full drop-shadow-2xl select-none"
        style={{ aspectRatio: '1 / 1' }}
      >
        <defs>
          <filter id="shadow-card" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.28" />
          </filter>
          <filter id="shadow-token" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity="0.45" />
          </filter>
          <radialGradient id="token-gloss" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="gold-pedestal" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="60%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#854D0E" />
          </radialGradient>
        </defs>

        {/* Board Background Frame */}
        <rect
          x="0"
          y="0"
          width="1500"
          height="1500"
          rx="32"
          fill="#0F172A"
          stroke="#1E293B"
          strokeWidth="12"
        />

        {/* Inner Playing Canvas */}
        <rect x="20" y="20" width="1460" height="1460" rx="24" fill="#F8FAFC" />

        {/* ================================================================= */}
        {/* 1. QUADRANT BASE ROOMS WITH REALISTIC DOORWAY OPENINGS            */}
        {/* ================================================================= */}

        {/* Top-Left Base: RED BASE (cols 0..5, rows 0..5 -> 0..600 x 0..600) */}
        {/* Doorway opens at bottom edge into Red Start Cell { col: 1, row: 6 } */}
        <g id="base-red" opacity={activeColors.has('red') ? 1 : 0.45}>
          <rect x="20" y="20" width="580" height="580" rx="24" fill="#EF4444" stroke="#B91C1C" strokeWidth="4" />
          <rect x="80" y="80" width="460" height="460" rx="20" fill="#FFFFFF" filter="url(#shadow-card)" />
          
          {/* Base Room Header */}
          <rect x="160" y="98" width="300" height="44" rx="10" fill="#FEE2E2" />
          <text
            x="310"
            y="128"
            textAnchor="middle"
            fill="#B91C1C"
            fontSize="24"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            letterSpacing="1.5"
          >
            {activeColors.has('red') ? 'RED BASE' : 'EMPTY BASE'}
          </text>

          {/* 4 Token Base Slots */}
          {BASE_SLOTS_4P.red.map((slot, i) => (
            <circle
              key={i}
              cx={slot.x}
              cy={slot.y}
              r="54"
              fill="#FEE2E2"
              stroke="#EF4444"
              strokeWidth="6"
            />
          ))}

          {/* DOORWAY OPENING: Red Base bottom wall opens directly into Red Start (col 1, row 6) */}
          {activeColors.has('red') && (
            <g id="red-doorway">
              {/* Doorway passage corridor connecting room to track */}
              <rect x="110" y="540" width="80" height="60" fill="#EF4444" />
              <rect x="120" y="540" width="60" height="60" fill="#FEE2E2" />
              {/* Doorway exit chevron pointing down into cell (1, 6) */}
              <polygon points="135,550 165,550 150,575" fill="#EF4444" />
            </g>
          )}
        </g>

        {/* Top-Right Base: GREEN BASE (cols 9..14, rows 0..5 -> 900..1500 x 0..600) */}
        {/* Doorway opens at left edge into Green Start Cell { col: 8, row: 1 } */}
        <g id="base-green" opacity={activeColors.has('green') ? 1 : 0.45}>
          <rect x="900" y="20" width="580" height="580" rx="24" fill="#10B981" stroke="#047857" strokeWidth="4" />
          <rect x="960" y="80" width="460" height="460" rx="20" fill="#FFFFFF" filter="url(#shadow-card)" />

          {/* Base Room Header */}
          <rect x="1040" y="98" width="300" height="44" rx="10" fill="#D1FAE5" />
          <text
            x="1190"
            y="128"
            textAnchor="middle"
            fill="#047857"
            fontSize="24"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            letterSpacing="1.5"
          >
            {activeColors.has('green') ? 'GREEN BASE' : 'EMPTY BASE'}
          </text>

          {/* 4 Token Base Slots */}
          {BASE_SLOTS_4P.green.map((slot, i) => (
            <circle
              key={i}
              cx={slot.x}
              cy={slot.y}
              r="54"
              fill="#D1FAE5"
              stroke="#10B981"
              strokeWidth="6"
            />
          ))}

          {/* DOORWAY OPENING: Green Base left wall opens directly into Green Start (col 8, row 1) */}
          {activeColors.has('green') && (
            <g id="green-doorway">
              {/* Doorway passage corridor connecting room to track */}
              <rect x="900" y="110" width="60" height="80" fill="#10B981" />
              <rect x="900" y="120" width="60" height="60" fill="#D1FAE5" />
              {/* Doorway exit chevron pointing left into cell (8, 1) */}
              <polygon points="950,135 950,165 925,150" fill="#10B981" />
            </g>
          )}
        </g>

        {/* Bottom-Right Base: YELLOW BASE (cols 9..14, rows 9..14 -> 900..1500 x 900..1500) */}
        {/* Doorway opens at top edge into Yellow Start Cell { col: 13, row: 8 } */}
        <g id="base-yellow" opacity={activeColors.has('yellow') ? 1 : 0.45}>
          <rect x="900" y="900" width="580" height="580" rx="24" fill="#F59E0B" stroke="#B45309" strokeWidth="4" />
          <rect x="960" y="960" width="460" height="460" rx="20" fill="#FFFFFF" filter="url(#shadow-card)" />

          {/* Base Room Header */}
          <rect x="1040" y="978" width="300" height="44" rx="10" fill="#FEF3C7" />
          <text
            x="1190"
            y="1008"
            textAnchor="middle"
            fill="#B45309"
            fontSize="24"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            letterSpacing="1.5"
          >
            {activeColors.has('yellow') ? 'YELLOW BASE' : 'EMPTY BASE'}
          </text>

          {/* 4 Token Base Slots */}
          {BASE_SLOTS_4P.yellow.map((slot, i) => (
            <circle
              key={i}
              cx={slot.x}
              cy={slot.y}
              r="54"
              fill="#FEF3C7"
              stroke="#F59E0B"
              strokeWidth="6"
            />
          ))}

          {/* DOORWAY OPENING: Yellow Base top wall opens directly into Yellow Start (col 13, row 8) */}
          {activeColors.has('yellow') && (
            <g id="yellow-doorway">
              {/* Doorway passage corridor connecting room to track */}
              <rect x="1310" y="900" width="80" height="60" fill="#F59E0B" />
              <rect x="1320" y="900" width="60" height="60" fill="#FEF3C7" />
              {/* Doorway exit chevron pointing up into cell (13, 8) */}
              <polygon points="1335,950 1365,950 1350,925" fill="#F59E0B" />
            </g>
          )}
        </g>

        {/* Bottom-Left Base: BLUE BASE (cols 0..5, rows 9..14 -> 0..600 x 900..1500) */}
        {/* Doorway opens at right edge into Blue Start Cell { col: 6, row: 13 } */}
        <g id="base-blue" opacity={activeColors.has('blue') ? 1 : 0.45}>
          <rect x="20" y="900" width="580" height="580" rx="24" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="4" />
          <rect x="80" y="960" width="460" height="460" rx="20" fill="#FFFFFF" filter="url(#shadow-card)" />

          {/* Base Room Header */}
          <rect x="160" y="978" width="300" height="44" rx="10" fill="#DBEAFE" />
          <text
            x="310"
            y="1008"
            textAnchor="middle"
            fill="#1D4ED8"
            fontSize="24"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            letterSpacing="1.5"
          >
            {activeColors.has('blue') ? 'BLUE BASE' : 'EMPTY BASE'}
          </text>

          {/* 4 Token Base Slots */}
          {BASE_SLOTS_4P.blue.map((slot, i) => (
            <circle
              key={i}
              cx={slot.x}
              cy={slot.y}
              r="54"
              fill="#DBEAFE"
              stroke="#3B82F6"
              strokeWidth="6"
            />
          ))}

          {/* DOORWAY OPENING: Blue Base right wall opens directly into Blue Start (col 6, row 13) */}
          {activeColors.has('blue') && (
            <g id="blue-doorway">
              {/* Doorway passage corridor connecting room to track */}
              <rect x="540" y="1310" width="60" height="80" fill="#3B82F6" />
              <rect x="540" y="1320" width="60" height="60" fill="#DBEAFE" />
              {/* Doorway exit chevron pointing right into cell (6, 13) */}
              <polygon points="550,1335 550,1365 575,1350" fill="#3B82F6" />
            </g>
          )}
        </g>

        {/* ================================================================= */}
        {/* 2. 52 TRACK CELLS & HOME RUNWAYS                                 */}
        {/* ================================================================= */}
        {TRACK_COORDS_4P.map((c, i) => {
          const x = c.col * 100;
          const y = c.row * 100;
          const isStar = STAR_INDICES_4P.has(i);

          let cellFill = '#FFFFFF';
          let borderStroke = '#CBD5E1';

          // Starting cells colored in player color
          if (i === 0) {
            cellFill = '#EF4444';
            borderStroke = '#B91C1C';
          } else if (i === 13) {
            cellFill = '#10B981';
            borderStroke = '#047857';
          } else if (i === 26) {
            cellFill = '#F59E0B';
            borderStroke = '#D97706';
          } else if (i === 39) {
            cellFill = '#3B82F6';
            borderStroke = '#1D4ED8';
          } else if (isStar) {
            cellFill = '#FEF9C3';
            borderStroke = '#CA8A04';
          }

          return (
            <g key={`track-cell-${i}`}>
              <rect
                x={x}
                y={y}
                width="100"
                height="100"
                fill={cellFill}
                stroke={borderStroke}
                strokeWidth="2.5"
              />

              {/* Start Cell Arrow Directions along Clockwise Track */}
              {/* Red Start (0): points East along row 6 */}
              {i === 0 && (
                <polygon
                  points={`${x + 35},${y + 25} ${x + 75},${y + 50} ${x + 35},${y + 75}`}
                  fill="#FFFFFF"
                />
              )}
              {/* Green Start (13): points South along col 8 */}
              {i === 13 && (
                <polygon
                  points={`${x + 25},${y + 35} ${x + 50},${y + 75} ${x + 75},${y + 35}`}
                  fill="#FFFFFF"
                />
              )}
              {/* Yellow Start (26): points West along row 8 */}
              {i === 26 && (
                <polygon
                  points={`${x + 65},${y + 25} ${x + 25},${y + 50} ${x + 65},${y + 75}`}
                  fill="#FFFFFF"
                />
              )}
              {/* Blue Start (39): points North along col 6 */}
              {i === 39 && (
                <polygon
                  points={`${x + 25},${y + 65} ${x + 50},${y + 25} ${x + 75},${y + 65}`}
                  fill="#FFFFFF"
                />
              )}

              {/* Safe Star Icon on outer track */}
              {isStar && i !== 0 && i !== 13 && i !== 26 && i !== 39 && (
                <g transform={`translate(${x + 20}, ${y + 20}) scale(0.6)`}>
                  <polygon
                    points="50,5 64,36 98,38 72,61 80,95 50,75 20,95 28,61 2,38 36,36"
                    fill="#EAB308"
                    stroke="#CA8A04"
                    strokeWidth="3"
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* 4 Colored Home Runways (5 cells each leading to center) */}
        {HOME_STRETCH_COORDS_4P.red.map((c, i) => (
          <g key={`red-stretch-${i}`}>
            <rect
              x={c.col * 100}
              y={c.row * 100}
              width="100"
              height="100"
              fill="#EF4444"
              stroke="#DC2626"
              strokeWidth="2"
            />
            <text
              x={c.col * 100 + 50}
              y={c.row * 100 + 62}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="24"
              fontWeight="900"
              opacity="0.8"
            >
              {i + 1}
            </text>
          </g>
        ))}
        {HOME_STRETCH_COORDS_4P.green.map((c, i) => (
          <g key={`green-stretch-${i}`}>
            <rect
              x={c.col * 100}
              y={c.row * 100}
              width="100"
              height="100"
              fill="#10B981"
              stroke="#059669"
              strokeWidth="2"
            />
            <text
              x={c.col * 100 + 50}
              y={c.row * 100 + 62}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="24"
              fontWeight="900"
              opacity="0.8"
            >
              {i + 1}
            </text>
          </g>
        ))}
        {HOME_STRETCH_COORDS_4P.yellow.map((c, i) => (
          <g key={`yellow-stretch-${i}`}>
            <rect
              x={c.col * 100}
              y={c.row * 100}
              width="100"
              height="100"
              fill="#F59E0B"
              stroke="#D97706"
              strokeWidth="2"
            />
            <text
              x={c.col * 100 + 50}
              y={c.row * 100 + 62}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="24"
              fontWeight="900"
              opacity="0.8"
            >
              {i + 1}
            </text>
          </g>
        ))}
        {HOME_STRETCH_COORDS_4P.blue.map((c, i) => (
          <g key={`blue-stretch-${i}`}>
            <rect
              x={c.col * 100}
              y={c.row * 100}
              width="100"
              height="100"
              fill="#3B82F6"
              stroke="#2563EB"
              strokeWidth="2"
            />
            <text
              x={c.col * 100 + 50}
              y={c.row * 100 + 62}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="24"
              fontWeight="900"
              opacity="0.8"
            >
              {i + 1}
            </text>
          </g>
        ))}

        {/* ================================================================= */}
        {/* 3. CENTER HOME TRIANGULAR JUNCTION                               */}
        {/* ================================================================= */}
        {/* Left triangle (Red Home) */}
        <polygon points="600,600 750,750 600,900" fill="#EF4444" stroke="#B91C1C" strokeWidth="2" />
        {/* Top triangle (Green Home) */}
        <polygon points="600,600 750,750 900,600" fill="#10B981" stroke="#047857" strokeWidth="2" />
        {/* Right triangle (Yellow Home) */}
        <polygon points="900,600 750,750 900,900" fill="#F59E0B" stroke="#B45309" strokeWidth="2" />
        {/* Bottom triangle (Blue Home) */}
        <polygon points="600,900 750,750 900,900" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="2" />

        {/* Center Golden Circle & Crown */}
        <circle cx="750" cy="750" r="54" fill="url(#gold-pedestal)" stroke="#78350F" strokeWidth="6" />
        <text
          x="750"
          y="764"
          textAnchor="middle"
          fontSize="36"
          fill="#78350F"
          fontWeight="900"
        >
          👑
        </text>

        {/* ================================================================= */}
        {/* 4. TOKENS LAYER (SNAPPY, FAST ANIMATION & GLOW)                   */}
        {/* ================================================================= */}
        {players.map((player) =>
          player.tokens.map((token) => {
            const isCanMove = canMoveTokenIds.has(token.id);
            const colorInfo = LUDO_COLOR_INFO[token.color];

            // Determine stack index
            let stackKey = '';
            if (token.state === 'base') {
              stackKey = `base-${token.color}-${token.tokenIndex}`;
            } else if (token.state === 'finished') {
              stackKey = `home-${token.color}`;
            } else if (token.state === 'home_stretch') {
              stackKey = `stretch-${token.color}-${token.stepCount - 51}`;
            } else {
              const startIdx = COLOR_START_INDEX_4P[token.color];
              const trackIdx = (startIdx + token.stepCount) % 52;
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
                  filter: 'url(#shadow-token)',
                }}
              >
                {/* Highlight Pulse Ring when Eligible to Move */}
                {isCanMove && (
                  <>
                    <circle
                      cx="0"
                      cy="0"
                      r="48"
                      fill="none"
                      stroke="#FACC15"
                      strokeWidth="6"
                      opacity="0.9"
                      className="animate-ping"
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r="45"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="4"
                      strokeDasharray="8 6"
                      className="animate-spin"
                    />
                  </>
                )}

                {/* Token Outer Rim */}
                <circle
                  cx="0"
                  cy="0"
                  r="34"
                  fill={colorInfo.primary}
                  stroke="#FFFFFF"
                  strokeWidth="5"
                />

                {/* Token Inner Gloss Gradient */}
                <circle cx="0" cy="0" r="30" fill="url(#token-gloss)" />

                {/* Token Center Cap */}
                <circle cx="0" cy="0" r="18" fill="#FFFFFF" opacity="0.95" />
                <circle cx="0" cy="0" r="11" fill={colorInfo.dark} />

                {/* Crown / Star when Finished */}
                {token.state === 'finished' && (
                  <text
                    x="0"
                    y="7"
                    textAnchor="middle"
                    fontSize="18"
                    fill="#F59E0B"
                    fontWeight="bold"
                  >
                    ★
                  </text>
                )}

                {/* Stack indicator count badge if 2 or more on same slot */}
                {stackTotal > 1 && stackIdx === stackTotal - 1 && (
                  <g transform="translate(18, -18)">
                    <circle cx="0" cy="0" r="12" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fontSize="10"
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
