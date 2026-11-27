import React, { useMemo } from 'react';
import { Bot, ChevronRight, Users } from 'lucide-react';
import { PLAYER_COLOR_ORDER } from '../shared/boardConfig.ts';
import type { Player } from '../shared/types.ts';
import { FullscreenButton } from './FullscreenButton.tsx';
import { GameBoard } from './GameBoard.tsx';

interface DashboardProps {
  onSelectOnline: () => void;
  onSelectVsBot: () => void;
  rejoinError?: string | null;
  onDismissError?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectOnline,
  onSelectVsBot,
  rejoinError,
  onDismissError,
}) => {
  const showcasePlayers: Player[] = useMemo(
    () =>
      PLAYER_COLOR_ORDER.slice(0, 4).map((color, idx) => ({
        id: `showcase-${idx}`,
        name: `Player ${idx + 1}`,
        color,
        position: [0, 14, 25, 42][idx] ?? 0,
        isBot: false,
        isHost: idx === 0,
        status: 'connected',
        readyForRematch: false,
      })),
    []
  );

  const showcasePositions = useMemo(
    () => ({
      'showcase-0': 0,
      'showcase-1': 14,
      'showcase-2': 25,
      'showcase-3': 42,
    }),
    []
  );

  return (
    <main className="min-h-dvh w-full game-table-bg flex flex-col justify-between px-4 sm:px-6 py-3 pb-safe pt-safe touch-game-surface">
      {/* Clean Top Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4 py-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#fcf8ee] p-1 border border-amber-200/70 shadow-md flex items-center justify-center shrink-0">
            <img
              src="/assets/aistudio/image_e4645869.png"
              alt="Snakes and Ladders Icon"
              className="w-full h-full object-contain mix-blend-multiply"
            />
          </div>
          <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white whitespace-nowrap truncate">
            Snakes &amp; Ladders
          </span>
        </div>

        <FullscreenButton showLabel />
      </header>

      {/* Main Content: Single clean column on mobile, balanced 2-column showcase on lg+ */}
      <div className="w-full max-w-5xl mx-auto my-auto py-3 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        {/* Left/Top Column: Title + Emblem + Two Primary Modes */}
        <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left">
          {/* Crest Medallion (visible cleanly on mobile & desktop) */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-[#885022] to-[#4a260a] p-1.5 shadow-[0_14px_30px_rgba(0,0,0,0.45)] ring-1 ring-amber-200/45 mb-4">
            <div className="w-full h-full rounded-[18px] bg-[#fcf8ee] p-2 flex items-center justify-center ring-1 ring-[#e7c88a]">
              <img
                src="/assets/aistudio/image_e4645869.png"
                alt="Snakes and Ladders Emblem"
                className="w-full h-full object-contain mix-blend-multiply"
              />
            </div>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.08] text-balance">
            Snakes <span className="text-amber-300">&amp;</span> Ladders
          </h1>
          <p className="mt-2.5 text-sm sm:text-base font-medium text-emerald-100/80 max-w-md leading-relaxed">
            Classic 1–100 board rules. Climb ladders, dodge snakes, and roll exact to land on square 100.
          </p>

          {rejoinError && (
            <div className="w-full max-w-md mt-4 rounded-xl bg-rose-950/90 border border-rose-400/40 px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-rose-100 text-left leading-snug">
                {rejoinError}
              </p>
              {onDismissError && (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="text-xs font-bold text-rose-200 hover:text-white min-h-[36px] px-2 shrink-0"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {/* Exactly Two Primary Options */}
          <div className="w-full max-w-md mt-6 flex flex-col gap-3.5">
            <button
              type="button"
              onClick={onSelectOnline}
              className="group w-full min-h-[76px] rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 active:scale-[0.985] text-[#291704] px-5 py-3.5 border border-amber-200/80 btn-3d-shine shadow-[0_5px_0_#92400e,0_12px_24px_rgba(0,0,0,0.32)] active:shadow-[0_2px_0_#92400e] active:translate-y-[3px] transition-all flex items-center gap-4 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-white/55 border border-amber-700/20 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-[#78350f]" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base sm:text-lg font-black tracking-tight leading-tight">
                  ONLINE MULTIPLAYER
                </div>
                <div className="text-xs font-semibold text-[#5c3008] mt-0.5">
                  Host or join 2–6 players with a room code
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#78350f]/75 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={onSelectVsBot}
              className="group w-full min-h-[76px] rounded-2xl bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 hover:brightness-105 active:scale-[0.985] text-white px-5 py-3.5 border border-emerald-200/45 btn-3d-shine shadow-[0_5px_0_#065f46,0_12px_24px_rgba(0,0,0,0.32)] active:shadow-[0_2px_0_#065f46] active:translate-y-[3px] transition-all flex items-center gap-4 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base sm:text-lg font-black tracking-tight leading-tight">
                  VS BOT
                </div>
                <div className="text-xs font-semibold text-emerald-50/90 mt-0.5">
                  Play immediately against 3 AI opponents
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/80 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Right Column (Desktop / Tablet): Live Classic Board Preview */}
        <div className="hidden lg:flex lg:col-span-6 justify-center">
          <div className="w-full max-w-[420px]">
            <GameBoard
              players={showcasePlayers}
              visualPositions={showcasePositions}
              activePlayerId="showcase-3"
              compactPreview
            />
          </div>
        </div>
      </div>

      {/* Studio Attribution Footer */}
      <footer className="w-full max-w-5xl mx-auto pt-3 pb-1 border-t border-emerald-200/10 text-center">
        <p className="text-xs font-medium text-emerald-100/70 tracking-wide">
          Developed by{' '}
          <span className="font-display font-extrabold text-amber-300 tracking-wider">
            PRAKALP STUDIOS
          </span>
        </p>
      </footer>
    </main>
  );
};
