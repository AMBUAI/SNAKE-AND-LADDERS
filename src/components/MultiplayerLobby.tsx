import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Copy, LogIn, Plus, Share2 } from 'lucide-react';
import type { SocketConnectionStatus } from '../hooks/useMultiplayerClient.ts';
import { PLAYER_COLOR_ORDER, PLAYER_COLOR_THEMES } from '../shared/boardConfig.ts';
import { isValidRoomCodeFormat, normalizeRoomCode } from '../shared/rules.ts';
import type { MatchState, Player } from '../shared/types.ts';
import { FullscreenButton } from './FullscreenButton.tsx';
import { GameBoard } from './GameBoard.tsx';

type LobbyTab = 'select' | 'host_setup' | 'join_form';

interface MultiplayerLobbyProps {
  matchState: MatchState | null;
  myPlayerId: string | null;
  connectionStatus: SocketConnectionStatus;
  errorMessage: string | null;
  isBusy: boolean;
  onBackToDashboard: () => void;
  onCreateRoom: (playerCount: number, playerName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onClearError: () => void;
}

const PLAYER_COUNTS = [2, 3, 4, 5, 6] as const;

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  matchState,
  myPlayerId,
  connectionStatus,
  errorMessage,
  isBusy,
  onBackToDashboard,
  onCreateRoom,
  onJoinRoom,
  onStartMatch,
  onLeaveRoom,
  onClearError,
}) => {
  const [tab, setTab] = useState<LobbyTab>('select');
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [playerName, setPlayerName] = useState<string>('');
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  const previewPlayers: Player[] = useMemo(() => {
    return Array.from({ length: playerCount }, (_, idx) => ({
      id: `preview-${idx}`,
      name: `Player ${idx + 1}`,
      color: PLAYER_COLOR_ORDER[idx],
      position: 0,
      isBot: false,
      isHost: idx === 0,
      status: 'connected',
      readyForRematch: false,
    }));
  }, [playerCount]);

  const previewVisualPositions = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of previewPlayers) map[p.id] = 0;
    return map;
  }, [previewPlayers]);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleShareCode = async (code: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Snakes & Ladders room',
          text: `Join my Snakes & Ladders match with room code: ${code}`,
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyCode(code);
  };

  if (matchState && matchState.phase === 'lobby') {
    const me = matchState.players.find((p) => p.id === myPlayerId);
    const isHost = Boolean(me?.isHost);
    const activePlayers = matchState.players.filter((p) => p.status !== 'abandoned');
    const allConnected =
      activePlayers.length === matchState.targetPlayerCount &&
      activePlayers.every((p) => p.status === 'connected');
    const remainingSeats = Math.max(
      0,
      matchState.targetPlayerCount - activePlayers.length
    );

    const lobbyVisualPositions: Record<string, number> = {};
    for (const p of activePlayers) lobbyVisualPositions[p.id] = 0;

    return (
      <div className="min-h-dvh w-full game-table-bg text-white flex flex-col px-4 py-4 pb-safe touch-game-surface">
        <header className="w-full max-w-4xl mx-auto flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#072619]/90 border border-emerald-200/20 flex items-center gap-2 text-sm font-bold text-emerald-50 hover:bg-[#0b3524] active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Leave Room
          </button>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-amber-300 tabular-nums">
              {activePlayers.length}/{matchState.targetPlayerCount} Players Joined
            </span>
            <FullscreenButton />
          </div>
        </header>

        <div className="w-full max-w-4xl mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* Ticket-Style Room Code Card */}
            <div className="rounded-2xl bg-[#072619]/90 border border-amber-300/35 p-4 text-center shadow-[0_12px_28px_rgba(0,0,0,0.4)]">
              <p className="text-xs font-semibold text-emerald-100/70">
                Share Room Code
              </p>
              <div className="mt-1 font-mono-code text-3xl sm:text-4xl font-bold tracking-[0.22em] text-amber-300 select-all drop-shadow">
                {matchState.roomCode}
              </div>

              <div className="mt-3 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleCopyCode(matchState.roomCode ?? '')}
                  className="min-h-[44px] px-4 rounded-xl bg-[#0d3524] border border-emerald-200/25 text-sm font-bold text-white flex items-center gap-2 hover:bg-[#134731] active:scale-[0.98]"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-amber-300" />
                      Copy Code
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleShareCode(matchState.roomCode ?? '')}
                  className="min-h-[44px] px-4 rounded-xl bg-[#0d3524] border border-emerald-200/25 text-sm font-bold text-white flex items-center gap-2 hover:bg-[#134731] active:scale-[0.98]"
                >
                  <Share2 className="w-4 h-4 text-amber-300" />
                  Share
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-rose-950/90 border border-rose-400/40 px-4 py-3 text-xs font-semibold text-rose-100">
                {errorMessage}
              </div>
            )}

            <div className="rounded-2xl bg-[#072619]/90 border border-emerald-200/20 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-base font-extrabold text-white">
                  Match Seats ({matchState.targetPlayerCount} Players)
                </h2>
                <span className="text-xs font-semibold text-emerald-100/75">
                  {remainingSeats === 0
                    ? 'All seats filled'
                    : `${remainingSeats} seat${remainingSeats > 1 ? 's' : ''} open`}
                </span>
              </div>

              <div className="divide-y divide-emerald-200/10">
                {Array.from({ length: matchState.targetPlayerCount }, (_, seatIdx) => {
                  const player = activePlayers[seatIdx];
                  if (!player) {
                    const seatColor = PLAYER_COLOR_THEMES[PLAYER_COLOR_ORDER[seatIdx]];
                    return (
                      <div
                        key={`empty-${seatIdx}`}
                        className="py-2.5 flex items-center justify-between gap-3 opacity-60"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            style={{ borderColor: seatColor.hex }}
                            className="w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-[11px] font-bold text-emerald-100"
                          >
                            {seatIdx + 1}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-emerald-50">
                              Open Seat · {seatColor.label}
                            </div>
                            <div className="text-[11px] text-emerald-100/60">
                              Waiting for human player
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const theme = PLAYER_COLOR_THEMES[player.color];
                  const isMe = player.id === myPlayerId;
                  return (
                    <div
                      key={player.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          style={{
                            background: `radial-gradient(circle at 30% 26%, #fff 0%, ${theme.hex} 35%, ${theme.darkHex} 100%)`,
                          }}
                          className="w-7 h-7 rounded-full border-2 border-white shadow flex items-center justify-center text-[11px] font-black text-white shrink-0"
                        >
                          {seatIdx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {player.name} {isMe ? '(You)' : ''}
                          </div>
                          <div className="text-[11px] font-medium text-emerald-100/75">
                            {theme.label}
                            {player.isHost ? ' · Host' : ''}
                            {player.status === 'disconnected' ? ' · Reconnecting...' : ''}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          player.status === 'connected'
                            ? 'text-emerald-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {player.status === 'connected' ? 'Ready' : 'Reconnecting'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {isHost ? (
              <button
                type="button"
                onClick={onStartMatch}
                disabled={!allConnected}
                className={`w-full min-h-[58px] rounded-2xl font-display text-lg font-black tracking-tight transition-all ${
                  allConnected
                    ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 active:scale-[0.98] text-[#291704] border border-amber-200/80 btn-3d-shine shadow-[0_6px_0_#92400e]'
                    : 'bg-[#0b2b1d] text-emerald-100/40 border border-emerald-200/15 cursor-not-allowed'
                }`}
              >
                {allConnected
                  ? 'START MATCH'
                  : `Waiting for ${remainingSeats} more player${
                      remainingSeats > 1 ? 's' : ''
                    }...`}
              </button>
            ) : (
              <div className="w-full min-h-[56px] rounded-2xl bg-[#072619]/90 border border-emerald-200/20 px-4 flex items-center justify-center text-sm font-bold text-emerald-100 text-center">
                {allConnected
                  ? 'All players joined — waiting for host to start...'
                  : `Waiting for ${remainingSeats} more player${
                      remainingSeats > 1 ? 's' : ''
                    } and host to start...`}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-[#072619]/80 border border-emerald-200/20 p-3 shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
            <p className="text-xs font-bold text-emerald-100/80 mb-2 text-center">
              Board Preview (1–100 · {matchState.targetPlayerCount} Tokens)
            </p>
            <div className="max-w-[300px] mx-auto">
              <GameBoard
                players={activePlayers}
                visualPositions={lobbyVisualPositions}
                compactPreview
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full game-table-bg text-white flex flex-col px-4 py-4 pb-safe touch-game-surface">
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => {
            onClearError();
            if (tab === 'select') {
              onBackToDashboard();
            } else {
              setTab('select');
            }
          }}
          className="min-h-[44px] px-3.5 rounded-xl bg-[#072619]/90 border border-emerald-200/20 flex items-center gap-2 text-sm font-bold text-emerald-50 hover:bg-[#0b3524] active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="font-display text-lg sm:text-xl font-black tracking-tight text-white">
          Online Multiplayer
        </h1>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-200/80 text-right">
            {connectionStatus === 'connecting' ? 'Connecting' : 'Live'}
          </span>
          <FullscreenButton />
        </div>
      </header>

      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-center">
        {errorMessage && (
          <div className="w-full max-w-md mx-auto mb-4 rounded-xl bg-rose-950/90 border border-rose-400/40 px-4 py-3 text-xs sm:text-sm font-semibold text-rose-100 shadow-lg">
            {errorMessage}
          </div>
        )}

        {tab === 'select' && (
          <div className="w-full max-w-md mx-auto flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                onClearError();
                setTab('host_setup');
              }}
              className="group w-full min-h-[82px] rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 active:scale-[0.98] text-[#291704] px-5 py-4 border border-amber-200/80 btn-3d-shine shadow-[0_7px_0_#92400e,0_14px_26px_rgba(0,0,0,0.35)] transition-all flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-white/55 border border-amber-700/20 flex items-center justify-center shrink-0">
                <Plus className="w-6 h-6 text-[#78350f]" strokeWidth={2.6} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-black leading-tight">
                  HOST MATCH
                </div>
                <div className="text-xs font-semibold text-[#5c3008] mt-0.5">
                  Choose 2–6 players and get a 6-character code
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#78350f]/75 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                onClearError();
                setTab('join_form');
              }}
              className="group w-full min-h-[82px] rounded-2xl bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 hover:brightness-105 active:scale-[0.98] text-white px-5 py-4 border border-emerald-200/50 btn-3d-shine shadow-[0_7px_0_#065f46,0_14px_26px_rgba(0,0,0,0.35)] transition-all flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                <LogIn className="w-6 h-6 text-white" strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-black leading-tight">
                  JOIN MATCH
                </div>
                <div className="text-xs font-semibold text-emerald-50/90 mt-0.5">
                  Enter a 6-character room code from a friend
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
            </button>
          </div>
        )}

        {tab === 'host_setup' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-6 rounded-2xl bg-[#072619]/90 border border-emerald-200/20 p-4 sm:p-5 flex flex-col gap-4 shadow-[0_14px_30px_rgba(0,0,0,0.4)]">
              <div>
                <label
                  htmlFor="host-name"
                  className="block text-xs font-bold text-emerald-100/80 mb-1.5"
                >
                  Your Display Name (optional)
                </label>
                <input
                  id="host-name"
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Player 1"
                  className="w-full min-h-[48px] px-3.5 rounded-xl bg-[#041a10] border border-emerald-200/25 text-base font-semibold text-white placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <p className="text-xs font-bold text-emerald-100/80 mb-2">
                  Total Human Players
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {PLAYER_COUNTS.map((count) => {
                    const selected = playerCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setPlayerCount(count)}
                        className={`min-h-[52px] rounded-xl font-display text-lg font-black tabular-nums transition-all ${
                          selected
                            ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-[#291704] border border-amber-200 shadow-[0_4px_0_#92400e]'
                            : 'bg-[#041a10] text-emerald-100 border border-emerald-200/20 hover:bg-[#0b3322]'
                        }`}
                      >
                        {count}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-bold text-emerald-100/75">
                  Player Colors
                </span>
                <div className="flex items-center gap-1.5">
                  {previewPlayers.map((p, idx) => (
                    <span
                      key={p.id}
                      style={{ backgroundColor: PLAYER_COLOR_THEMES[p.color].hex }}
                      className="w-6 h-6 rounded-full border-2 border-white shadow text-[10px] font-black text-white flex items-center justify-center"
                      title={PLAYER_COLOR_THEMES[p.color].label}
                    >
                      {idx + 1}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => onCreateRoom(playerCount, playerName || 'Player 1')}
                className="w-full min-h-[56px] rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 active:scale-[0.98] disabled:opacity-60 text-[#291704] border border-amber-200/80 btn-3d-shine font-display text-lg font-black shadow-[0_6px_0_#92400e] transition-all"
              >
                {isBusy ? 'Creating Room...' : 'CREATE ROOM'}
              </button>
            </div>

            <div className="lg:col-span-6 rounded-2xl bg-[#072619]/80 border border-emerald-200/20 p-3.5 shadow-[0_14px_30px_rgba(0,0,0,0.4)]">
              <p className="text-xs font-bold text-emerald-100/80 mb-2 text-center">
                Board Preview · {playerCount} Players (Squares 1–100)
              </p>
              <div className="max-w-[320px] mx-auto">
                <GameBoard
                  players={previewPlayers}
                  visualPositions={previewVisualPositions}
                  compactPreview
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'join_form' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const normalized = normalizeRoomCode(roomCodeInput);
              if (!isValidRoomCodeFormat(normalized)) return;
              onJoinRoom(normalized, playerName);
            }}
            className="w-full max-w-md mx-auto rounded-2xl bg-[#072619]/90 border border-emerald-200/20 p-5 flex flex-col gap-4 shadow-[0_14px_30px_rgba(0,0,0,0.4)]"
          >
            <div>
              <label
                htmlFor="join-code"
                className="block text-xs font-bold text-emerald-100/80 mb-1.5"
              >
                6-Character Room Code
              </label>
              <input
                id="join-code"
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={8}
                value={roomCodeInput}
                onChange={(e) => {
                  onClearError();
                  setRoomCodeInput(e.target.value.toUpperCase());
                }}
                placeholder="e.g. K7M4P2"
                className="w-full min-h-[56px] px-4 rounded-xl bg-[#041a10] border border-emerald-200/25 font-mono-code text-2xl font-bold tracking-[0.22em] text-center text-amber-300 placeholder:text-emerald-100/30 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label
                htmlFor="join-name"
                className="block text-xs font-bold text-emerald-100/80 mb-1.5"
              >
                Your Display Name (optional)
              </label>
              <input
                id="join-name"
                type="text"
                maxLength={16}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Player"
                className="w-full min-h-[48px] px-3.5 rounded-xl bg-[#041a10] border border-emerald-200/25 text-base font-semibold text-white placeholder:text-emerald-100/35 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={isBusy || !isValidRoomCodeFormat(normalizeRoomCode(roomCodeInput))}
              className="w-full min-h-[56px] rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 active:scale-[0.98] disabled:bg-none disabled:bg-[#0d3524] disabled:text-emerald-100/40 disabled:border-emerald-200/10 disabled:shadow-none text-[#291704] border border-amber-200/80 font-display text-lg font-black shadow-[0_6px_0_#92400e] transition-all"
            >
              {isBusy ? 'Joining Room...' : 'JOIN ROOM'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
