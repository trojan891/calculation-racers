import React from 'react';
import { TrojoGameId } from '../game/types';

interface GameTileArtworkProps {
  gameId: TrojoGameId;
  className?: string;
}

export const GameTileArtwork: React.FC<GameTileArtworkProps> = ({
  gameId,
  className = 'h-36 w-36 sm:h-40 sm:w-40',
}) => {
  switch (gameId) {
    case 'circular_racer':
      return (
        <div
          className={`relative overflow-hidden rounded-[28px] bg-[#0A1329] shadow-md select-none ${className}`}
        >
          <svg
            viewBox="0 0 200 200"
            className="h-full w-full"
            aria-label="Circular Racer"
          >
            {/* Outer Circuit Asphalt Loop */}
            <circle cx="100" cy="100" r="88" fill="#1E293B" />
            <circle cx="100" cy="100" r="84" fill="#0F172A" />

            {/* Red & White Outer Kerbs */}
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="#EF4444"
              strokeWidth="5"
              strokeDasharray="16 16"
            />
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="5"
              strokeDasharray="16 16"
              strokeDashoffset="16"
            />

            {/* Asphalt Track Surface */}
            <circle
              cx="100"
              cy="100"
              r="60"
              fill="none"
              stroke="#1E293B"
              strokeWidth="38"
            />

            {/* Center Dashed White Racing Line */}
            <circle
              cx="100"
              cy="100"
              r="60"
              fill="none"
              stroke="#FACC15"
              strokeWidth="2.5"
              strokeDasharray="12 12"
              opacity="0.9"
            />

            {/* Inner Green Island */}
            <circle cx="100" cy="100" r="39" fill="#047857" />
            {/* Inner Red & White Kerbs */}
            <circle
              cx="100"
              cy="100"
              r="40"
              fill="none"
              stroke="#EF4444"
              strokeWidth="4"
              strokeDasharray="10 10"
            />
            <circle
              cx="100"
              cy="100"
              r="40"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeDasharray="10 10"
              strokeDashoffset="10"
            />

            {/* Center Trophy Emblem */}
            <circle cx="100" cy="100" r="22" fill="#065F46" />
            <text
              x="100"
              y="108"
              textAnchor="middle"
              fill="#FDE047"
              fontSize="24"
              fontWeight="900"
            >
              🏁
            </text>

            {/* Start / Finish Line Checkered Strip */}
            <line
              x1="60"
              y1="98"
              x2="100"
              y2="98"
              stroke="#FFFFFF"
              strokeWidth="6"
              strokeDasharray="6 6"
            />
            <line
              x1="60"
              y1="102"
              x2="100"
              y2="102"
              stroke="#000000"
              strokeWidth="6"
              strokeDasharray="6 6"
            />

            {/* Drifting Sports Car on the Lower Curve */}
            <g transform="translate(100, 158) rotate(-18)">
              {/* Tire Skid Smoke Particles */}
              <circle cx="-28" cy="6" r="4.5" fill="#E2E8F0" opacity="0.6" />
              <circle cx="-34" cy="9" r="6" fill="#CBD5E1" opacity="0.4" />
              {/* Drift Skid Marks */}
              <path
                d="M-36 12 Q-18 8 0 8"
                fill="none"
                stroke="#020617"
                strokeWidth="3.5"
                opacity="0.75"
              />

              {/* Rear Spoiler */}
              <rect x="-24" y="-7" width="6" height="14" rx="2" fill="#0F172A" />
              {/* Car Body (Streamlined Aerodynamic GT Racer) */}
              <path
                d="M-20 -7 L14 -6 L26 0 L14 6 L-20 7 Z"
                fill="#EF4444"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              {/* Yellow Racing Stripe */}
              <path d="M-18 -1.5 L24 -0.5 L24 0.5 L-18 1.5 Z" fill="#FACC15" />
              {/* Cockpit / Windshield */}
              <path
                d="M-4 -4.5 L8 -3.5 L12 0 L8 3.5 L-4 4.5 Z"
                fill="#0F172A"
                stroke="#38BDF8"
                strokeWidth="1.2"
              />
              {/* Wheels */}
              <rect x="-14" y="-9" width="8" height="3" rx="1.5" fill="#020617" />
              <rect x="-14" y="6" width="8" height="3" rx="1.5" fill="#020617" />
              <rect x="8" y="-9" width="8" height="3" rx="1.5" fill="#020617" />
              <rect x="8" y="6" width="8" height="3" rx="1.5" fill="#020617" />
              {/* Headlights beam */}
              <polygon
                points="24,-4 52,-14 52,14 24,4"
                fill="#FEF08A"
                opacity="0.3"
              />
            </g>
          </svg>
        </div>
      );

    case 'water_sort':
      return (
        <div
          className={`relative overflow-hidden rounded-[28px] bg-[#231138] shadow-md select-none ${className}`}
        >
          <svg
            viewBox="0 0 200 200"
            className="h-full w-full"
            aria-label="Water Sort Puzzle"
          >
            {/* Background subtle glow */}
            <circle cx="100" cy="100" r="85" fill="#321952" opacity="0.55" />

            {/* Left Standing Tube */}
            <g transform="translate(26, 28)">
              <rect x="-3" y="0" width="34" height="5" rx="2.5" fill="#E2E8F0" />
              <rect
                x="0"
                y="4"
                width="28"
                height="66"
                rx="14"
                fill="#1E1030"
                stroke="#E2E8F0"
                strokeWidth="2.5"
              />
              <clipPath id="wsTube1">
                <rect x="2" y="6" width="24" height="62" rx="12" />
              </clipPath>
              <g clipPath="url(#wsTube1)">
                <rect x="0" y="16" width="28" height="13" fill="#22C55E" />
                <rect x="0" y="29" width="28" height="13" fill="#0EA5E9" />
                <rect x="0" y="42" width="28" height="13" fill="#16A34A" />
                <rect x="0" y="55" width="28" height="15" fill="#F97316" />
              </g>
            </g>

            {/* Right Standing Tube */}
            <g transform="translate(144, 28)">
              <rect x="-3" y="0" width="34" height="5" rx="2.5" fill="#E2E8F0" />
              <rect
                x="0"
                y="4"
                width="28"
                height="66"
                rx="14"
                fill="#1E1030"
                stroke="#E2E8F0"
                strokeWidth="2.5"
              />
              <clipPath id="wsTube2">
                <rect x="2" y="6" width="24" height="62" rx="12" />
              </clipPath>
              <g clipPath="url(#wsTube2)">
                <rect x="0" y="29" width="28" height="15" fill="#EF4444" />
                <rect x="0" y="44" width="28" height="26" fill="#0EA5E9" />
              </g>
            </g>

            {/* Bottom Target Tube receiving Yellow Liquid */}
            <g transform="translate(68, 108)">
              <rect x="-3" y="0" width="36" height="5" rx="2.5" fill="#E2E8F0" />
              <rect
                x="0"
                y="4"
                width="30"
                height="68"
                rx="15"
                fill="#1E1030"
                stroke="#E2E8F0"
                strokeWidth="2.5"
              />
              <clipPath id="wsTubeBottom">
                <rect x="2" y="6" width="26" height="64" rx="13" />
              </clipPath>
              <g clipPath="url(#wsTubeBottom)">
                <rect x="0" y="30" width="30" height="42" fill="#FACC15" />
                <ellipse cx="15" cy="30" rx="13" ry="3.5" fill="#FDE047" />
              </g>
            </g>

            {/* Bottom Empty Tube */}
            <g transform="translate(118, 108)">
              <rect x="-3" y="0" width="34" height="5" rx="2.5" fill="#CBD5E1" />
              <rect
                x="0"
                y="4"
                width="28"
                height="68"
                rx="14"
                fill="#2D1B46"
                stroke="#CBD5E1"
                strokeWidth="2"
                opacity="0.85"
              />
            </g>

            {/* Pouring Stream of Yellow Liquid */}
            <rect x="81" y="68" width="5" height="72" rx="2.5" fill="#FACC15" />
            {/* Sparkles */}
            <circle cx="72" cy="96" r="2.5" fill="#FDE047" />
            <circle cx="93" cy="100" r="3" fill="#FDE047" />
            <circle cx="76" cy="126" r="2" fill="#FEF08A" />

            {/* Tilted Pouring Tube */}
            <g transform="translate(82, 66) rotate(-52)">
              <rect x="-3" y="0" width="34" height="5" rx="2.5" fill="#FFFFFF" />
              <rect
                x="0"
                y="4"
                width="28"
                height="68"
                rx="14"
                fill="#1E1030"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
              <clipPath id="wsTubePour">
                <rect x="2" y="6" width="24" height="64" rx="12" />
              </clipPath>
              <g clipPath="url(#wsTubePour)">
                <rect x="0" y="12" width="28" height="14" fill="#FACC15" />
                <rect x="0" y="26" width="28" height="15" fill="#EF4444" />
                <rect x="0" y="41" width="28" height="15" fill="#16A34A" />
                <rect x="0" y="56" width="28" height="16" fill="#F97316" />
              </g>
            </g>
          </svg>
        </div>
      );

    case 'word_finder':
      return (
        <div
          className={`relative overflow-hidden rounded-[28px] bg-[#7E4798] shadow-md select-none ${className}`}
        >
          <svg
            viewBox="0 0 200 200"
            className="h-full w-full"
            aria-label="Word Finder Puzzle"
          >
            {/* Top Crossword Grid */}
            {/* Vertical Green Column P U R E E */}
            {[
              { y: 12, ch: 'P' },
              { y: 31, ch: 'U' },
              { y: 50, ch: 'R' },
              { y: 69, ch: 'E' },
              { y: 88, ch: 'E' },
            ].map((cell, i) => (
              <g key={i} transform={`translate(22, ${cell.y})`}>
                <rect width="17" height="17" rx="3.5" fill="#68CC35" />
                <text
                  x="8.5"
                  y="12.5"
                  textAnchor="middle"
                  fill="#194D14"
                  fontSize="11"
                  fontWeight="900"
                  fontFamily="sans-serif"
                >
                  {cell.ch}
                </text>
              </g>
            ))}

            {/* Intersecting Top Row: [P] [ ] [E] */}
            <rect x="41" y="12" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <g transform="translate(60, 12)">
              <rect width="17" height="17" rx="3.5" fill="#68CC35" />
              <text
                x="8.5"
                y="12.5"
                textAnchor="middle"
                fill="#194D14"
                fontSize="11"
                fontWeight="900"
                fontFamily="sans-serif"
              >
                E
              </text>
            </g>

            {/* Intersecting White Empty Crossword Boxes */}
            <rect x="41" y="50" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="60" y="50" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="60" y="69" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="60" y="88" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="79" y="88" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="98" y="88" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="117" y="88" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="136" y="88" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="136" y="69" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="136" y="50" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="136" y="31" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="117" y="50" width="17" height="17" rx="3.5" fill="#FFFFFF" />
            <rect x="155" y="50" width="17" height="17" rx="3.5" fill="#FFFFFF" />

            {/* Yellow Word Pill "PURE" */}
            <rect x="76" y="110" width="48" height="16" rx="5" fill="#F5C23B" />
            <text
              x="100"
              y="121.5"
              textAnchor="middle"
              fill="#332838"
              fontSize="10"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              PURE
            </text>

            {/* Bottom Letter Wheel */}
            <circle cx="100" cy="160" r="34" fill="#C98CC9" opacity="0.55" />
            {/* Connecting Yellow Lines P -> U -> R -> E */}
            <polyline
              points="83,178 117,178 74,154 126,154"
              fill="none"
              stroke="#F5C23B"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Top E node */}
            <text
              x="100"
              y="141"
              textAnchor="middle"
              fill="#2B2133"
              fontSize="13"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              E
            </text>
            {/* Left R node */}
            <circle cx="74" cy="154" r="10.5" fill="#F5C23B" />
            <text
              x="74"
              y="158"
              textAnchor="middle"
              fill="#2B2133"
              fontSize="12"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              R
            </text>
            {/* Right E node */}
            <circle cx="126" cy="154" r="10.5" fill="#F5C23B" />
            <text
              x="126"
              y="158"
              textAnchor="middle"
              fill="#2B2133"
              fontSize="12"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              E
            </text>
            {/* Bottom-Left P node */}
            <circle cx="83" cy="178" r="10.5" fill="#F5C23B" />
            <text
              x="83"
              y="182"
              textAnchor="middle"
              fill="#2B2133"
              fontSize="12"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              P
            </text>
            {/* Bottom-Right U node */}
            <circle cx="117" cy="178" r="10.5" fill="#F5C23B" />
            <text
              x="117"
              y="182"
              textAnchor="middle"
              fill="#2B2133"
              fontSize="12"
              fontWeight="900"
              fontFamily="sans-serif"
            >
              U
            </text>
          </svg>
        </div>
      );

    case 'game_2048':
      return (
        <div
          className={`relative flex items-center justify-center overflow-hidden rounded-[28px] bg-[#F5B800] shadow-md select-none ${className}`}
        >
          <div className="pointer-events-none absolute inset-1.5 rounded-[22px] border border-white/25" />
          <span className="font-display text-4xl font-black tracking-tight text-white drop-shadow-xs sm:text-5xl">
            2048
          </span>
        </div>
      );

    case 'mahjong_solitaire':
      return (
        <div
          className={`relative overflow-hidden rounded-[28px] bg-[#064E27] shadow-md select-none ${className}`}
        >
          <svg
            viewBox="0 0 200 200"
            className="h-full w-full"
            aria-label="Mahjong Solitaire"
          >
            {/* Subtle radial felt highlight */}
            <circle cx="100" cy="100" r="85" fill="#0A6836" opacity="0.5" />

            {/* Left Tile: Green Dragon 發 */}
            <g transform="translate(26, 48) rotate(-8)">
              {/* 3D Green Base */}
              <rect
                x="-6"
                y="6"
                width="76"
                height="102"
                rx="12"
                fill="#0D7A3E"
              />
              {/* Ivory Face */}
              <rect
                x="0"
                y="0"
                width="74"
                height="98"
                rx="11"
                fill="#FCF8EC"
                stroke="#E2D9C5"
                strokeWidth="2"
              />
              <text
                x="37"
                y="67"
                textAnchor="middle"
                fill="#15803D"
                fontSize="52"
                fontWeight="900"
                fontFamily="serif"
              >
                發
              </text>
            </g>

            {/* Right Tile: Red Dragon 中 */}
            <g transform="translate(98, 32) rotate(9)">
              {/* 3D Green Base */}
              <rect
                x="-7"
                y="7"
                width="82"
                height="112"
                rx="13"
                fill="#108946"
              />
              {/* Ivory Face */}
              <rect
                x="0"
                y="0"
                width="80"
                height="108"
                rx="12"
                fill="#FFFDF6"
                stroke="#E5DEC9"
                strokeWidth="2"
              />
              <text
                x="40"
                y="74"
                textAnchor="middle"
                fill="#DC2626"
                fontSize="58"
                fontWeight="900"
                fontFamily="serif"
              >
                中
              </text>
            </g>
          </svg>
        </div>
      );

    case 'calculation_racer':
    default:
      return (
        <div
          className={`relative overflow-hidden rounded-[28px] bg-[#1D4ED8] shadow-md select-none ${className}`}
        >
          <svg
            viewBox="0 0 200 200"
            className="h-full w-full"
            aria-label="Calculation Racer"
          >
            {/* Sky & Track Backdrop */}
            <circle cx="100" cy="90" r="82" fill="#2563EB" />
            {/* Math Operators Floating Badges */}
            <circle cx="44" cy="48" r="18" fill="#38BDF8" />
            <text
              x="44"
              y="55"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="22"
              fontWeight="900"
            >
              +
            </text>
            <circle cx="154" cy="46" r="18" fill="#FACC15" />
            <text
              x="154"
              y="53"
              textAnchor="middle"
              fill="#1E293B"
              fontSize="20"
              fontWeight="900"
            >
              ×
            </text>
            <circle cx="100" cy="36" r="16" fill="#22C55E" />
            <text
              x="100"
              y="42"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="18"
              fontWeight="900"
            >
              ÷
            </text>

            {/* Road Surface */}
            <rect x="14" y="128" width="172" height="44" rx="14" fill="#0F172A" />
            <line
              x1="28"
              y1="150"
              x2="172"
              y2="150"
              stroke="#FACC15"
              strokeWidth="4"
              strokeDasharray="14 10"
            />

            {/* Formula Race Car */}
            <g transform="translate(42, 92)">
              {/* Rear spoiler */}
              <rect x="4" y="14" width="12" height="18" rx="3" fill="#EF4444" />
              {/* Car body */}
              <path
                d="M14 22 L82 18 L112 30 L114 42 L12 42 Z"
                fill="#F97316"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
              {/* Cockpit */}
              <path d="M44 18 L68 10 L82 22 L44 22 Z" fill="#38BDF8" />
              {/* Wheels */}
              <circle
                cx="32"
                cy="44"
                r="13"
                fill="#1E293B"
                stroke="#E2E8F0"
                strokeWidth="4"
              />
              <circle
                cx="92"
                cy="44"
                r="13"
                fill="#1E293B"
                stroke="#E2E8F0"
                strokeWidth="4"
              />
            </g>
          </svg>
        </div>
      );
  }
};
