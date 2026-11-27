import {
  computeTurnResolution,
  getNextActivePlayerIndex,
  RECONNECT_GRACE_MS,
  rollFairDie,
} from '../shared/rules.ts';
import type { BotPersonality, LastTurnEvent, MatchState, Player } from '../shared/types.ts';

function fairCryptoRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / 0x100000000;
  }
  return Math.random();
}

export function createVsBotInitialState(): MatchState {
  const players: Player[] = [
    {
      id: 'human-1',
      name: 'You',
      color: 'red',
      position: 0,
      isBot: false,
      isHost: true,
      status: 'connected',
      graceDeadline: null,
      readyForRematch: false,
    },
    {
      id: 'bot-1',
      name: 'Bot 1 · Balanced',
      color: 'blue',
      position: 0,
      isBot: true,
      botPersonality: 'balanced',
      isHost: false,
      status: 'connected',
      graceDeadline: null,
      readyForRematch: false,
    },
    {
      id: 'bot-2',
      name: 'Bot 2 · Fast',
      color: 'green',
      position: 0,
      isBot: true,
      botPersonality: 'fast',
      isHost: false,
      status: 'connected',
      graceDeadline: null,
      readyForRematch: false,
    },
    {
      id: 'bot-3',
      name: 'Bot 3 · Wild',
      color: 'yellow',
      position: 0,
      isBot: true,
      botPersonality: 'unpredictable',
      isHost: false,
      status: 'connected',
      graceDeadline: null,
      readyForRematch: false,
    },
  ];

  return {
    mode: 'vs_bot',
    roomCode: null,
    targetPlayerCount: 4,
    phase: 'playing',
    players,
    currentTurnIndex: 0,
    turnSeq: 1,
    lastTurn: null,
    winnerId: null,
    winReason: null,
    gracePeriodMs: RECONNECT_GRACE_MS,
    notice: 'Your turn! Tap Roll Dice to begin.',
  };
}

export function getBotDecisionDelayMs(personality?: BotPersonality): number {
  switch (personality) {
    case 'fast':
      return 380;
    case 'unpredictable':
      return 420 + Math.floor(Math.random() * 880);
    case 'balanced':
    default:
      return 720;
  }
}

export function executeVsBotTurn(state: MatchState): MatchState {
  if (state.phase !== 'playing') return state;

  const activePlayer = state.players[state.currentTurnIndex];
  if (!activePlayer) return state;

  const roll = rollFairDie(fairCryptoRandom);
  const resolution = computeTurnResolution(activePlayer.position, roll);

  const updatedPlayers = state.players.map((p, idx) =>
    idx === state.currentTurnIndex ? { ...p, position: resolution.finalPos } : p
  );

  const event: LastTurnEvent = {
    eventId: `local-${state.turnSeq}-${Date.now()}`,
    playerId: activePlayer.id,
    playerName: activePlayer.name,
    playerColor: activePlayer.color,
    roll: resolution.roll,
    startPos: resolution.startPos,
    landedPos: resolution.landedPos,
    finalPos: resolution.finalPos,
    steps: resolution.steps,
    transition: resolution.transition,
    overshot: resolution.overshot,
    won: resolution.won,
  };

  let nextNotice: string | null = null;
  if (resolution.won) {
    nextNotice = `${activePlayer.name} reached square 100 and won!`;
  } else if (resolution.overshot) {
    nextNotice = `${activePlayer.name} rolled ${roll} and needed ${
      100 - resolution.startPos
    } to reach 100.`;
  } else if (resolution.transition?.type === 'ladder') {
    nextNotice = `${activePlayer.name} climbed a ladder (${resolution.transition.from} → ${resolution.transition.to})!`;
  } else if (resolution.transition?.type === 'snake') {
    nextNotice = `${activePlayer.name} slid down a snake (${resolution.transition.from} → ${resolution.transition.to})!`;
  }

  return {
    ...state,
    players: updatedPlayers,
    phase: resolution.won ? 'finished' : 'playing',
    currentTurnIndex: resolution.won
      ? state.currentTurnIndex
      : getNextActivePlayerIndex(updatedPlayers, state.currentTurnIndex),
    turnSeq: state.turnSeq + 1,
    lastTurn: event,
    winnerId: resolution.won ? activePlayer.id : null,
    winReason: resolution.won ? 'exact_100' : null,
    notice: nextNotice,
  };
}
