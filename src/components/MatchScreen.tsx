import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { isSoundMuted, setSoundMuted } from '../game/sound.ts';
import { useTokenAnimation } from '../hooks/useTokenAnimation.ts';
import { PLAYER_COLOR_THEMES } from '../shared/boardConfig.ts';
import type { MatchState } from '../shared/types.ts';
import { DicePad } from './DicePad.tsx';
import { FullscreenButton } from './FullscreenButton.tsx';
import { GameBoard } from './GameBoard.tsx';

interface MatchScreenProps {
  state: MatchState;
  myPlayerId: string | null;
  connectionLostBanner?: string | null;
  onRollDice: () => void;
  onPlayAgain: () => void;
  onReturnDashboard: () => void;
}

export const MatchScreen: React.FC<MatchScreenProps> = ({
  state,
  myPlayerId,
  connectionLostBanner,
  onRollDice,
  onPlayAgain,
  onReturnDashboard,
}) => {
  const [muted, setMuted] = useState<boolean>(isSoundMuted());
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const lastRolledTurnSeqRef = useRef<number>(-1);

  const {
    visualPositions,
    isAnimating,
    isDiceSpinning,
    displayDieFace,
    activeTransitionType,
    winnerReadyToShow,
  } = useTokenAnimation(state);

  const hasDisconnected = state.players.some(
    (p) => p.status === 'disconnected' && p.graceDeadline
  );
  useEffect(() => {
    if (!hasDisconnected) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasDisconnected]);

  useEffect(() => {
    if (lastRolledTurnSeqRef.current !== state.turnSeq) {
      lastRolledTurnSeqRef.current = -1;
    }
  }, [state.turnSeq]);

  const activePlayer = state.players[state.currentTurnIndex];
  const me = state.players.find((p) => p.id === myPlayerId);
  const isMyTurn =
    state.phase === 'playing' &&
    Boolean(activePlayer) &&
    activePlayer.id === myPlayerId &&
    !activePlayer.isBot &&
    activePlayer.status === 'connected';

  const canRoll =
    isMyTurn && !isAnimating && lastRolledTurnSeqRef.current !== state.turnSeq;

  const handleRollTap = () => {
    if (!canRoll) return;
    lastRolledTurnSeqRef.current = state.turnSeq;
    onRollDice();
  };

  const toggleMute = () => {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
  };

  const winner = state.winnerId
    ? state.players.find((p) => p.id === state.winnerId)
    : null;

  const activeOnlinePlayers = state.players.filter((p) => p.status !== 'abandoned');
  const readyRematchCount = activeOnlinePlayers.filter(
    (p) => p.readyForRematch
  ).length;
  const iVotedRematch = Boolean(me?.readyForRematch);
  const canRematchOnline =
    state.mode === 'vs_bot' || activeOnlinePlayers.length >= 2;

  return (
    <div className="h-dvh w-full overflow-hidden game-table-bg text-white flex flex-col pt-safe pb-safe touch-game-surface">
      {/* Compact Header */}
      <header className="w-full max-w-6xl mx-auto px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={onReturnDashboard}
          className="min-h-[40px] px-3 rounded-xl bg-[#072619]/90 border border-emerald-200/20 flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-50 hover:bg-[#0b3524] active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#fcf8ee] p-0.5 border border-amber-200/70 shadow-sm flex items-center justify-center shrink-0">
            <img
              src="/assets/aistudio/image_e4645869.png"
              alt=""
              className="w-full h-full object-contain mix-blend-multiply"
            />
          </div>
          <div className="font-display text-sm sm:text-base font-black text-white leading-tight truncate drop-shadow">
            {state.mode === 'vs_bot'
              ? 'VS Bot Match'
              : `Room ${state.roomCode ?? ''}`}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <FullscreenButton />
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute game audio' : 'Mute game audio'}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-[#072619]/90 border border-emerald-200/20 flex items-center justify-center text-white hover:bg-[#0b3524] active:scale-[0.98]"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-emerald-200/60" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-300" />
            )}
          </button>
        </div>
      </header>

      {connectionLostBanner && (
        <div className="w-full max-w-6xl mx-auto px-3 pb-1 shrink-0">
          <div className="rounded-xl bg-amber-400/20 border border-amber-300/50 px-3 py-1.5 text-xs font-bold text-amber-100 text-center">
            {connectionLostBanner}
          </div>
        </div>
      )}

      {/* Main Responsive Arena (Portrait: stacked; Landscape/Desktop: 2-column) */}
      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-2.5 sm:px-4 pb-2 flex flex-col landscape:flex-row lg:flex-row items-center justify-center gap-2 sm:gap-4">
        <div className="w-full max-w-[min(94vw,calc(100dvh-290px))] landscape:w-[min(78dvh,52vw)] landscape:max-w-[540px] lg:w-[min(78dvh,560px)] lg:max-w-[560px] shrink-0 flex flex-col items-center">
          <GameBoard
            players={state.players}
            visualPositions={visualPositions}
            activePlayerId={activePlayer?.id ?? null}
            activeTransitionType={activeTransitionType}
          />
        </div>

        <div className="w-full max-w-[min(94vw,460px)] landscape:flex-1 landscape:max-w-md lg:max-w-sm flex flex-col justify-between gap-2 min-h-0 shrink-0">
          {/* Player Turn Roster */}
          <div
            className={`grid gap-1.5 ${
              state.players.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'
            }`}
          >
            {state.players.map((player, idx) => {
              const theme = PLAYER_COLOR_THEMES[player.color];
              const isTurn =
                state.phase === 'playing' && idx === state.currentTurnIndex;
              const isMe = player.id === myPlayerId;
              const shownPos = visualPositions[player.id] ?? player.position;
              const graceSec =
                player.status === 'disconnected' && player.graceDeadline
                  ? Math.max(0, Math.ceil((player.graceDeadline - nowMs) / 1000))
                  : 0;

              return (
                <div
                  key={player.id}
                  className={`rounded-xl px-2.5 py-1.5 border transition-all flex items-center justify-between gap-1.5 min-w-0 ${
                    isTurn
                      ? 'bg-[#124932] border-amber-300 shadow-[0_0_0_1px_rgba(252,211,77,0.45),0_6px_14px_rgba(0,0,0,0.3)]'
                      : 'bg-[#072619]/85 border-emerald-200/15'
                  } ${player.status === 'abandoned' ? 'opacity-45' : ''}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      style={{
                        background: `radial-gradient(circle at 30% 26%, #fff 0%, ${theme.hex} 35%, ${theme.darkHex} 100%)`,
                      }}
                      className="w-5 h-5 rounded-full border border-white shadow-sm text-[9px] font-black text-white flex items-center justify-center shrink-0"
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] sm:text-xs font-bold text-white truncate leading-tight">
                        {player.name}
                        {isMe && state.mode === 'online' ? ' (You)' : ''}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-100/70 leading-tight truncate">
                        {player.status === 'abandoned'
                          ? 'Left'
                          : player.status === 'disconnected'
                            ? `Wait ${graceSec}s`
                            : isTurn
                              ? 'Active'
                              : theme.label}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-black tabular-nums text-amber-300 shrink-0">
                    {shownPos === 0 ? 'Start' : shownPos}
                  </span>
                </div>
              );
            })}
          </div>

          <DicePad
            activePlayer={activePlayer}
            isMyTurn={isMyTurn}
            canRoll={canRoll}
            isAnimating={isAnimating}
            isDiceSpinning={isDiceSpinning}
            displayDieFace={displayDieFace}
            lastTurn={state.lastTurn}
            notice={state.notice}
            onRoll={handleRollTap}
          />
        </div>
      </main>

      {/* Celebratory End-of-Match Victory Modal */}
      {state.phase === 'finished' && winnerReadyToShow && winner && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5"
        >
          <div className="relative w-full max-w-sm rounded-3xl bg-[#fffaf0] border-4 border-[#8c5223] pt-14 pb-6 px-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
            <img
              src="/assets/sprites/winner_badge.png"
              alt="Winner!"
              className="w-28 h-32 mx-auto -mt-28 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
            />

            <div className="mt-2 flex items-center justify-center gap-2">
              <span
                style={{
                  background: `radial-gradient(circle at 30% 26%, #fff 0%, ${PLAYER_COLOR_THEMES[winner.color].hex} 35%, ${PLAYER_COLOR_THEMES[winner.color].darkHex} 100%)`,
                }}
                className="w-5 h-5 rounded-full border-2 border-white shadow"
              />
              <h2 className="font-display text-2xl font-black text-[#2b1d12] text-balance">
                {winner.id === myPlayerId
                  ? 'You Won!'
                  : `${winner.name} Wins!`}
              </h2>
            </div>

            <p className="mt-1.5 text-sm font-semibold text-[#6b4f31]">
              {state.winReason === 'abandonment'
                ? 'All other participants left the match.'
                : 'Exact roll landed squarely on 100!'}
            </p>

            {state.mode === 'online' && (
              <div className="mt-4 rounded-xl bg-[#f4ebd9] border border-[#c8ae82] px-3 py-2.5 text-xs text-[#4a3219]">
                {canRematchOnline ? (
                  <>
                    <div className="font-bold">
                      Play Again agreement: {readyRematchCount}/
                      {activeOnlinePlayers.length} ready
                    </div>
                    <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                      {activeOnlinePlayers.map((p) => (
                        <span
                          key={p.id}
                          className={`text-[11px] font-bold ${
                            p.readyForRematch
                              ? 'text-emerald-700'
                              : 'text-[#8d7456]'
                          }`}
                        >
                          {p.name}: {p.readyForRematch ? 'Ready' : 'Pending'}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <span className="font-semibold">
                    Not enough players remain for an online rematch.
                  </span>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3">
              {canRematchOnline && (
                <button
                  type="button"
                  onClick={onPlayAgain}
                  disabled={state.mode === 'online' && iVotedRematch}
                  className={`w-full min-h-[54px] rounded-2xl font-display text-base font-black tracking-tight transition-all ${
                    state.mode === 'online' && iVotedRematch
                      ? 'bg-[#dcfce7] text-[#166534] border-2 border-[#86efac] cursor-default'
                      : 'bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 hover:brightness-105 active:scale-[0.98] text-white border border-emerald-200/40 btn-3d-shine shadow-[0_5px_0_#065f46]'
                  }`}
                >
                  {state.mode === 'online'
                    ? iVotedRematch
                      ? 'WAITING FOR PLAYERS...'
                      : 'PLAY AGAIN'
                    : 'PLAY AGAIN'}
                </button>
              )}

              <button
                type="button"
                onClick={onReturnDashboard}
                className="w-full min-h-[52px] rounded-2xl bg-[#f1e4cb] hover:bg-[#e7d4b2] active:scale-[0.98] border-2 border-[#c8ae82] text-[#2b1d12] font-display text-base font-extrabold"
              >
                DASHBOARD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
