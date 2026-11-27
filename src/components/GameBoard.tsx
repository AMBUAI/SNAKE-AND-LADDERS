import React, { useMemo } from 'react';
import { LADDERS, PLAYER_COLOR_THEMES, SNAKES } from '../shared/boardConfig.ts';
import type { VisualBoardTransition } from '../shared/boardConfig.ts';
import {
  getMultiTokenOffset,
  getSquareCenterPercent,
  getSquareCoords,
  getVisualGridSquares,
} from '../shared/boardGeometry.ts';
import type { Player } from '../shared/types.ts';

interface GameBoardProps {
  players: Player[];
  visualPositions: Record<string, number>;
  activePlayerId?: string | null;
  activeTransitionType?: 'snake' | 'ladder' | null;
  compactPreview?: boolean;
}

function getTileColorClass(square: number): string {
  if (square === 100) {
    return 'bg-[#fde047] text-[#422006] font-black';
  }
  if (square === 1) {
    return 'bg-[#bbf7d0] text-[#052e16] font-black';
  }
  const { visualRow, col } = getSquareCoords(square);
  // Crisp classic 2-tone warm parchment & soft sage checkerboard
  // so numbers, snakes, ladders, and player tokens remain ultra-legible
  const isAlt = (visualRow + col) % 2 === 1;
  return isAlt
    ? 'bg-[#edf4ea] text-[#1e3124]'
    : 'bg-[#fffdf6] text-[#2b1d12]';
}

function normalizeDeg(deg: number): number {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

function buildLadderTransform(ladder: VisualBoardTransition): string {
  const p1 = getSquareCenterPercent(ladder.from);
  const p2 = getSquareCenterPercent(ladder.to);
  const { w, h, fromAnchor, toAnchor } = ladder.sprite;

  const ax = fromAnchor.x * w;
  const ay = fromAnchor.y * h;
  const bx = toAnchor.x * w;
  const by = toAnchor.y * h;

  const ux = p2.x - p1.x;
  const uy = p2.y - p1.y;
  const lb = Math.hypot(ux, uy);

  const vx = bx - ax;
  const vy = by - ay;
  const ls = Math.hypot(vx, vy);

  const scaleY = lb / Math.max(1, ls);
  const scaleX = Math.min(0.112, Math.max(0.082, scaleY * 0.85));

  const thetaB = Math.atan2(uy, ux);
  const thetaS = Math.atan2(vy, vx);
  const deg = normalizeDeg(((thetaB - thetaS) * 180) / Math.PI);

  return `translate(${p1.x.toFixed(2)} ${p1.y.toFixed(2)}) rotate(${deg.toFixed(
    2
  )}) scale(${scaleX.toFixed(4)} ${scaleY.toFixed(4)}) translate(${(-ax).toFixed(
    2
  )} ${(-ay).toFixed(2)})`;
}

function buildSnakeTransform(snake: VisualBoardTransition): string {
  const p1 = getSquareCenterPercent(snake.from);
  const p2 = getSquareCenterPercent(snake.to);
  const { w, h, fromAnchor, toAnchor } = snake.sprite;

  const ax = fromAnchor.x * w;
  const ay = fromAnchor.y * h;
  const bx = toAnchor.x * w;
  const by = toAnchor.y * h;

  const ux = p2.x - p1.x;
  const uy = p2.y - p1.y;
  const lb = Math.hypot(ux, uy);

  const vx = bx - ax;
  const vy = by - ay;
  const ls = Math.hypot(vx, vy);
  const s = lb / Math.max(1, ls);

  const thetaB = Math.atan2(uy, ux);
  const degNormal = normalizeDeg(
    ((thetaB - Math.atan2(vy, vx)) * 180) / Math.PI
  );
  const degFlipped = normalizeDeg(
    ((thetaB - Math.atan2(vy, -vx)) * 180) / Math.PI
  );

  const useFlip = Math.abs(degFlipped) < Math.abs(degNormal);
  const fx = useFlip ? -1 : 1;
  const deg = useFlip ? degFlipped : degNormal;

  return `translate(${p1.x.toFixed(2)} ${p1.y.toFixed(2)}) rotate(${deg.toFixed(
    2
  )}) scale(${(fx * s).toFixed(4)} ${s.toFixed(4)}) translate(${(-ax).toFixed(
    2
  )} ${(-ay).toFixed(2)})`;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  players,
  visualPositions,
  activePlayerId,
  activeTransitionType,
  compactPreview = false,
}) => {
  const squares = useMemo(() => getVisualGridSquares(), []);
  const ladderBaseSet = useMemo(() => new Set(LADDERS.map((l) => l.from)), []);
  const snakeHeadSet = useMemo(() => new Set(SNAKES.map((s) => s.from)), []);

  const tokensBySquare = useMemo(() => {
    const map = new Map<number, Player[]>();
    for (const player of players) {
      if (player.status === 'abandoned') continue;
      const pos = visualPositions[player.id] ?? player.position;
      const list = map.get(pos) ?? [];
      list.push(player);
      map.set(pos, list);
    }
    return map;
  }, [players, visualPositions]);

  const startPlayers = tokensBySquare.get(0) ?? [];
  const activeVisualPos = activePlayerId ? visualPositions[activePlayerId] : undefined;

  return (
    <div className="flex flex-col items-center w-full select-none touch-game-surface">
      {/* Carved Mahogany Board Frame */}
      <div className="relative w-full aspect-square rounded-2xl p-2 bg-gradient-to-br from-[#885022] via-[#623612] to-[#3f1f07] shadow-[0_16px_36px_rgba(0,0,0,0.48)] ring-1 ring-amber-200/30">
        <div className="relative w-full h-full rounded-lg overflow-hidden bg-[#fffdf6] ring-2 ring-[#ecd098]">
          {/* 10x10 Classic Numbered Grid */}
          <div className="grid grid-cols-10 grid-rows-10 w-full h-full">
            {squares.map((sq) => {
              const isLadderBase = ladderBaseSet.has(sq);
              const isSnakeHead = snakeHeadSet.has(sq);
              const isActiveSquare = activeVisualPos === sq;

              return (
                <div
                  key={sq}
                  className={`relative border-[0.5px] border-[#b7a588]/45 flex items-start justify-start p-[2px] sm:p-1 ${getTileColorClass(
                    sq
                  )} ${isActiveSquare ? 'ring-2 ring-inset ring-amber-500 z-10' : ''}`}
                >
                  <span
                    className={`leading-none tabular-nums font-bold tracking-tight ${
                      compactPreview
                        ? 'text-[8px] sm:text-[9px]'
                        : 'text-[9px] min-[380px]:text-[10px] sm:text-xs'
                    }`}
                  >
                    {sq}
                  </span>

                  {sq === 100 && (
                    <img
                      src="/assets/sprites/winner_badge.png"
                      alt="Finish Square 100"
                      className="absolute bottom-[1px] right-[1px] w-[62%] h-[62%] object-contain pointer-events-none"
                    />
                  )}

                  {sq !== 100 && isLadderBase && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-[1px] right-[2px] text-[7px] sm:text-[9px] font-extrabold text-emerald-700 leading-none"
                    >
                      ↑
                    </span>
                  )}
                  {sq !== 100 && isSnakeHead && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-[1px] right-[2px] text-[7px] sm:text-[9px] font-extrabold text-rose-600 leading-none"
                    >
                      ↓
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Illustrated Ladder & Snake PNG Sprites */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            preserveAspectRatio="none"
          >
            {LADDERS.map((ladder) => (
              <image
                key={ladder.id}
                href={ladder.sprite.src}
                width={ladder.sprite.w}
                height={ladder.sprite.h}
                transform={buildLadderTransform(ladder)}
                preserveAspectRatio="none"
                style={{ filter: 'drop-shadow(0.3px 0.6px 0.6px rgba(35,20,6,0.34))' }}
              />
            ))}

            {SNAKES.map((snake) => (
              <image
                key={snake.id}
                href={snake.sprite.src}
                width={snake.sprite.w}
                height={snake.sprite.h}
                transform={buildSnakeTransform(snake)}
                preserveAspectRatio="none"
                style={{ filter: 'drop-shadow(0.35px 0.7px 0.7px rgba(25,15,6,0.36))' }}
              />
            ))}
          </svg>

          {/* Animated Glossy Player Tokens */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {players.map((player, playerIndex) => {
              if (player.status === 'abandoned') return null;
              const pos = visualPositions[player.id] ?? player.position;
              if (pos <= 0 || pos > 100) return null;

              const { col, visualRow } = getSquareCoords(pos);
              const group = tokensBySquare.get(pos) ?? [player];
              const idxInSquare = group.findIndex((p) => p.id === player.id);
              const { dx, dy, scale } = getMultiTokenOffset(
                Math.max(0, idxInSquare),
                group.length
              );

              const theme = PLAYER_COLOR_THEMES[player.color];
              const isActive = player.id === activePlayerId;
              const isGliding = isActive && activeTransitionType !== null;

              const translateX = col * 100 + dx * 10;
              const translateY = visualRow * 100 + dy * 10;

              return (
                <div
                  key={player.id}
                  style={{
                    width: '10%',
                    height: '10%',
                    transform: `translate3d(${translateX}%, ${translateY}%, 0)`,
                    transitionProperty: 'transform',
                    transitionDuration: isGliding ? '420ms' : '145ms',
                    transitionTimingFunction: isGliding
                      ? 'cubic-bezier(0.22, 1, 0.36, 1)'
                      : 'ease-out',
                    zIndex: isActive ? 30 : 20 + playerIndex,
                  }}
                  className="absolute top-0 left-0 flex items-center justify-center"
                >
                  <div
                    style={{
                      transform: `scale(${isActive ? scale * 1.16 : scale})`,
                      background: `radial-gradient(circle at 30% 26%, #ffffff 0%, ${theme.hex} 34%, ${theme.darkHex} 100%)`,
                    }}
                    className={`w-[78%] h-[78%] rounded-full border-2 border-white shadow-[0_3px_7px_rgba(0,0,0,0.45)] flex items-center justify-center transition-transform duration-150 ${
                      isActive ? 'ring-2 ring-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.9)]' : ''
                    } ${player.status === 'disconnected' ? 'opacity-50 grayscale-[40%]' : ''}`}
                    title={`${player.name} (Square ${pos})`}
                  >
                    <span className="text-[8px] sm:text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-none">
                      {playerIndex + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Start Dock (Before Square 1) */}
      <div className="w-full mt-1.5 px-3 py-1.5 rounded-xl bg-[#072619]/90 border border-emerald-200/15 flex items-center justify-between gap-2 min-h-[36px]">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-amber-300">
            Start Dock
          </span>
          <span className="text-[10px] text-emerald-100/60">Before Sq 1</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {startPlayers.length === 0 ? (
            <span className="text-[11px] text-emerald-100/45">
              All tokens on board
            </span>
          ) : (
            startPlayers.map((player) => {
              const playerIdx = players.findIndex((p) => p.id === player.id);
              const theme = PLAYER_COLOR_THEMES[player.color];
              const isActive = player.id === activePlayerId;
              return (
                <div
                  key={player.id}
                  style={{
                    background: `radial-gradient(circle at 30% 26%, #ffffff 0%, ${theme.hex} 34%, ${theme.darkHex} 100%)`,
                  }}
                  className={`w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform ${
                    isActive ? 'ring-2 ring-amber-300 scale-110' : ''
                  }`}
                  title={`${player.name} at Start`}
                >
                  <span className="text-[10px] font-black text-white drop-shadow">
                    {playerIdx + 1}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
