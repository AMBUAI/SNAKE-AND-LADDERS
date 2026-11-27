import { TRANSITION_BY_START } from './boardConfig.ts';
import type { Player } from './types.ts';

export const MIN_MULTIPLAYER_PLAYERS = 2;
export const MAX_MULTIPLAYER_PLAYERS = 6;
export const FINAL_SQUARE = 100;
export const RECONNECT_GRACE_MS = 45_000;

export interface TurnResolution {
  roll: number;
  startPos: number;
  landedPos: number;
  finalPos: number;
  steps: number[];
  transition: {
    type: 'snake' | 'ladder';
    from: number;
    to: number;
  } | null;
  overshot: boolean;
  won: boolean;
}

export function rollFairDie(randomFn: () => number = Math.random): number {
  const value = Math.floor(randomFn() * 6) + 1;
  return Math.min(6, Math.max(1, value));
}

export function computeTurnResolution(startPos: number, roll: number): TurnResolution {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
    throw new RangeError(`Invalid die roll: ${roll}`);
  }
  if (!Number.isInteger(startPos) || startPos < 0 || startPos >= FINAL_SQUARE) {
    throw new RangeError(`Invalid start position for turn: ${startPos}`);
  }

  const target = startPos + roll;
  if (target > FINAL_SQUARE) {
    return {
      roll,
      startPos,
      landedPos: startPos,
      finalPos: startPos,
      steps: [],
      transition: null,
      overshot: true,
      won: false,
    };
  }

  const steps: number[] = [];
  for (let sq = startPos + 1; sq <= target; sq++) {
    steps.push(sq);
  }

  const found = TRANSITION_BY_START.get(target);
  const transition = found
    ? { type: found.type, from: found.from, to: found.to }
    : null;
  const finalPos = transition ? transition.to : target;
  const won = finalPos === FINAL_SQUARE;

  return {
    roll,
    startPos,
    landedPos: target,
    finalPos,
    steps,
    transition,
    overshot: false,
    won,
  };
}

export function getNextActivePlayerIndex(players: Player[], fromIndex: number): number {
  if (players.length === 0) return 0;
  for (let offset = 1; offset <= players.length; offset++) {
    const candidate = (fromIndex + offset) % players.length;
    if (players[candidate].status !== 'abandoned') {
      return candidate;
    }
  }
  return 0;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRoomCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

export function sanitizePlayerName(input: string, fallback: string): string {
  const cleaned = input.replace(/[\r\n\t]/g, ' ').trim().slice(0, 16);
  return cleaned.length > 0 ? cleaned : fallback;
}
