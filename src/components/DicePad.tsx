import React from 'react';
import { PLAYER_COLOR_THEMES } from '../shared/boardConfig.ts';
import type { LastTurnEvent, Player } from '../shared/types.ts';

interface DicePadProps {
  activePlayer: Player | undefined;
  isMyTurn: boolean;
  canRoll: boolean;
  isAnimating: boolean;
  isDiceSpinning: boolean;
  displayDieFace: number;
  lastTurn: LastTurnEvent | null;
  notice: string | null;
  onRoll: () => void;
}

const PIP_POSITIONS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 25],
    [72, 25],
    [28, 50],
    [72, 50],
    [28, 75],
    [72, 75],
  ],
};

function DieFaceSvg({ value, spinning }: { value: number; spinning: boolean }) {
  const pips = PIP_POSITIONS[value] ?? PIP_POSITIONS[1];
  return (
    <svg
      viewBox="0 0 100 100"
      className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)] transition-transform duration-150 ${
        spinning ? 'rotate-12 scale-105' : 'rotate-0 scale-100'
      }`}
      aria-label={`Die showing ${value}`}
    >
      <defs>
        <linearGradient id="die-face-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#efe4cf" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="22"
        fill="url(#die-face-grad)"
        stroke="#c9b289"
        strokeWidth="4"
      />
      {pips.map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r="9.2"
          fill={value === 1 ? '#dc2626' : '#1f160e'}
        />
      ))}
    </svg>
  );
}

export const DicePad: React.FC<DicePadProps> = ({
  activePlayer,
  isMyTurn,
  canRoll,
  isAnimating,
  isDiceSpinning,
  displayDieFace,
  lastTurn,
  notice,
  onRoll,
}) => {
  const activeTheme = activePlayer
    ? PLAYER_COLOR_THEMES[activePlayer.color]
    : PLAYER_COLOR_THEMES.red;

  let statusHeadline = 'Waiting for match...';
  if (activePlayer) {
    if (isAnimating && lastTurn) {
      statusHeadline = `${lastTurn.playerName} rolled ${lastTurn.roll}`;
    } else if (isMyTurn) {
      statusHeadline = 'Your Turn — Tap to Roll';
    } else if (activePlayer.isBot) {
      statusHeadline = `${activePlayer.name} is rolling...`;
    } else if (activePlayer.status === 'disconnected') {
      statusHeadline = `${activePlayer.name} disconnected — waiting`;
    } else {
      statusHeadline = `Waiting for ${activePlayer.name}`;
    }
  }

  return (
    <div className="w-full rounded-2xl bg-[#072619]/90 border border-emerald-200/20 p-2.5 sm:p-3 shadow-[0_12px_28px_rgba(0,0,0,0.4)] touch-game-surface">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            style={{ backgroundColor: activeTheme.hex }}
            className="w-3.5 h-3.5 rounded-full ring-2 ring-white/80 shrink-0 shadow"
          />
          <p className="text-sm font-bold text-white truncate">
            {statusHeadline}
          </p>
        </div>
        {lastTurn && (
          <span className="text-xs font-bold text-amber-300 tabular-nums shrink-0">
            Last: {lastTurn.roll}
          </span>
        )}
      </div>

      {notice && (
        <p className="text-xs font-medium text-emerald-100/80 mb-2 leading-snug line-clamp-2">
          {notice}
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center p-1.5 rounded-xl bg-[#041a10] border border-emerald-200/15 shadow-inner">
          <DieFaceSvg value={displayDieFace} spinning={isDiceSpinning} />
        </div>

        <button
          type="button"
          onClick={onRoll}
          disabled={!canRoll}
          className={`flex-1 min-h-[56px] px-5 rounded-xl font-display font-black text-base sm:text-lg tracking-tight transition-all duration-150 flex items-center justify-center whitespace-nowrap ${
            canRoll
              ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 active:scale-[0.97] text-[#291704] border border-amber-200/80 btn-3d-shine shadow-[0_5px_0_#92400e,0_10px_20px_rgba(0,0,0,0.3)] active:shadow-[0_2px_0_#92400e] active:translate-y-[3px]'
              : 'bg-[#0d3524] text-emerald-100/40 border border-emerald-200/10 cursor-not-allowed'
          }`}
        >
          {isAnimating
            ? 'Moving...'
            : isMyTurn
              ? 'ROLL DICE'
              : activePlayer?.isBot
                ? 'BOT TURN'
                : 'WAIT TURN'}
        </button>
      </div>
    </div>
  );
};
