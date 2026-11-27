export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export type BotPersonality = 'balanced' | 'fast' | 'unpredictable';

export type PlayerConnectionStatus = 'connected' | 'disconnected' | 'abandoned';

export type GameMode = 'vs_bot' | 'online';

export type RoomPhase = 'lobby' | 'playing' | 'finished';

export type WinReason = 'exact_100' | 'abandonment';

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  position: number; // 0 = before square 1 (Start), 1..100 = board squares
  isBot: boolean;
  botPersonality?: BotPersonality;
  isHost: boolean;
  status: PlayerConnectionStatus;
  graceDeadline?: number | null;
  readyForRematch: boolean;
}

export interface BoardTransition {
  id: string;
  type: 'snake' | 'ladder';
  from: number;
  to: number;
  accent: string;
}

export interface LastTurnEvent {
  eventId: string;
  playerId: string;
  playerName: string;
  playerColor: PlayerColor;
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

export interface MatchState {
  mode: GameMode;
  roomCode: string | null;
  targetPlayerCount: number;
  phase: RoomPhase;
  players: Player[];
  currentTurnIndex: number;
  turnSeq: number;
  lastTurn: LastTurnEvent | null;
  winnerId: string | null;
  winReason: WinReason | null;
  gracePeriodMs: number;
  notice: string | null;
}

// Client -> Server WebSocket messages
export type ClientWsMessage =
  | {
      type: 'create_room';
      targetPlayerCount: number;
      playerName: string;
      sessionToken: string;
    }
  | {
      type: 'join_room';
      roomCode: string;
      playerName: string;
      sessionToken: string;
    }
  | {
      type: 'reconnect_room';
      roomCode: string;
      sessionToken: string;
    }
  | {
      type: 'start_match';
      roomCode: string;
      sessionToken: string;
    }
  | {
      type: 'roll_dice';
      roomCode: string;
      sessionToken: string;
      expectedTurnSeq: number;
    }
  | {
      type: 'rematch_vote';
      roomCode: string;
      sessionToken: string;
    }
  | {
      type: 'leave_room';
      roomCode: string;
      sessionToken: string;
    }
  | {
      type: 'ping';
    };

// Server -> Client WebSocket messages
export type ServerWsMessage =
  | {
      type: 'room_joined';
      roomCode: string;
      playerId: string;
      state: MatchState;
    }
  | {
      type: 'state_sync';
      state: MatchState;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    }
  | {
      type: 'room_closed';
      message: string;
    }
  | {
      type: 'pong';
    };
