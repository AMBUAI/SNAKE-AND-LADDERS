import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import { PLAYER_COLOR_ORDER } from '../shared/boardConfig.ts';
import {
  computeTurnResolution,
  getNextActivePlayerIndex,
  isValidRoomCodeFormat,
  MAX_MULTIPLAYER_PLAYERS,
  MIN_MULTIPLAYER_PLAYERS,
  normalizeRoomCode,
  RECONNECT_GRACE_MS,
  sanitizePlayerName,
} from '../shared/rules.ts';
import type {
  ClientWsMessage,
  LastTurnEvent,
  MatchState,
  Player,
  PlayerColor,
  RoomPhase,
  ServerWsMessage,
  WinReason,
} from '../shared/types.ts';

interface ServerPlayer extends Player {
  sessionToken: string;
  socket: WebSocket | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
}

interface RoomRecord {
  roomCode: string;
  targetPlayerCount: number;
  phase: RoomPhase;
  players: ServerPlayer[];
  currentTurnIndex: number;
  turnSeq: number;
  lastTurn: LastTurnEvent | null;
  winnerId: string | null;
  winReason: WinReason | null;
  notice: string | null;
  createdAt: number;
  lastActivityAt: number;
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_IDLE_TTL_MS = 15 * 60 * 1000;
const FINISHED_ROOM_TTL_MS = 10 * 60 * 1000;

export class RoomManager {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly socketIndex = new Map<
    WebSocket,
    { roomCode: string; sessionToken: string }
  >();
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.sweepExpiredRooms(), 60_000);
  }

  public dispose(): void {
    clearInterval(this.cleanupInterval);
    for (const room of this.rooms.values()) {
      for (const player of room.players) {
        if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
      }
    }
    this.rooms.clear();
    this.socketIndex.clear();
  }

  public getRoomSummary(rawCode: string): {
    exists: boolean;
    phase?: RoomPhase;
    seatsFilled?: number;
    targetPlayerCount?: number;
  } {
    const code = normalizeRoomCode(rawCode);
    if (!isValidRoomCodeFormat(code)) {
      return { exists: false };
    }
    const room = this.rooms.get(code);
    if (!room) {
      return { exists: false };
    }
    return {
      exists: true,
      phase: room.phase,
      seatsFilled: room.players.filter((p) => p.status !== 'abandoned').length,
      targetPlayerCount: room.targetPlayerCount,
    };
  }

  public handleMessage(ws: WebSocket, rawData: string): void {
    let msg: ClientWsMessage;
    try {
      msg = JSON.parse(rawData) as ClientWsMessage;
    } catch {
      this.send(ws, {
        type: 'error',
        code: 'INVALID_PAYLOAD',
        message: 'Invalid message format.',
      });
      return;
    }

    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      this.send(ws, {
        type: 'error',
        code: 'INVALID_PAYLOAD',
        message: 'Unsupported message.',
      });
      return;
    }

    switch (msg.type) {
      case 'ping':
        this.send(ws, { type: 'pong' });
        return;
      case 'create_room':
        this.onCreateRoom(ws, msg);
        return;
      case 'join_room':
        this.onJoinRoom(ws, msg);
        return;
      case 'reconnect_room':
        this.onReconnectRoom(ws, msg);
        return;
      case 'start_match':
        this.onStartMatch(ws, msg);
        return;
      case 'roll_dice':
        this.onRollDice(ws, msg);
        return;
      case 'rematch_vote':
        this.onRematchVote(ws, msg);
        return;
      case 'leave_room':
        this.onLeaveRoom(ws, msg);
        return;
      default:
        this.send(ws, {
          type: 'error',
          code: 'UNKNOWN_ACTION',
          message: 'Unknown game action.',
        });
    }
  }

  public handleDisconnect(ws: WebSocket): void {
    const binding = this.socketIndex.get(ws);
    if (!binding) return;
    this.socketIndex.delete(ws);

    const room = this.rooms.get(binding.roomCode);
    if (!room) return;

    const player = room.players.find(
      (p) => p.sessionToken === binding.sessionToken && p.socket === ws
    );
    if (!player) return;

    player.socket = null;
    if (player.status === 'abandoned') return;

    player.status = 'disconnected';
    player.graceDeadline = Date.now() + RECONNECT_GRACE_MS;
    room.lastActivityAt = Date.now();
    room.notice = `${player.name} disconnected. Waiting up to ${Math.round(
      RECONNECT_GRACE_MS / 1000
    )}s to reconnect.`;

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
    }
    player.disconnectTimer = setTimeout(() => {
      this.handleGraceTimeout(room.roomCode, player.sessionToken);
    }, RECONNECT_GRACE_MS);

    this.broadcastState(room);
  }

  private onCreateRoom(
    ws: WebSocket,
    msg: Extract<ClientWsMessage, { type: 'create_room' }>
  ): void {
    const count = Number(msg.targetPlayerCount);
    if (
      !Number.isInteger(count) ||
      count < MIN_MULTIPLAYER_PLAYERS ||
      count > MAX_MULTIPLAYER_PLAYERS
    ) {
      this.send(ws, {
        type: 'error',
        code: 'INVALID_PLAYER_COUNT',
        message: 'Player count must be between 2 and 6.',
      });
      return;
    }

    if (!msg.sessionToken || typeof msg.sessionToken !== 'string') {
      this.send(ws, {
        type: 'error',
        code: 'INVALID_SESSION',
        message: 'Missing player session token.',
      });
      return;
    }

    // Cleanly detach socket from any previous room
    this.detachSocketIfBound(ws);

    const roomCode = this.generateUniqueRoomCode();
    const hostPlayer: ServerPlayer = {
      id: crypto.randomUUID(),
      name: sanitizePlayerName(msg.playerName ?? '', 'Player 1'),
      color: PLAYER_COLOR_ORDER[0],
      position: 0,
      isBot: false,
      isHost: true,
      status: 'connected',
      graceDeadline: null,
      readyForRematch: false,
      sessionToken: msg.sessionToken,
      socket: ws,
      disconnectTimer: null,
    };

    const room: RoomRecord = {
      roomCode,
      targetPlayerCount: count,
      phase: 'lobby',
      players: [hostPlayer],
      currentTurnIndex: 0,
      turnSeq: 0,
      lastTurn: null,
      winnerId: null,
      winReason: null,
      notice: null,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.rooms.set(roomCode, room);
    this.socketIndex.set(ws, { roomCode, sessionToken: hostPlayer.sessionToken });

    this.send(ws, {
      type: 'room_joined',
      roomCode,
      playerId: hostPlayer.id,
      state: this.toPublicState(room),
    });
  }

  private onJoinRoom(
    ws: WebSocket,
    msg: Extract<ClientWsMessage, { type: 'join_room' }>
  ): void {
    const roomCode = normalizeRoomCode(msg.roomCode ?? '');
    if (!isValidRoomCodeFormat(roomCode)) {
      this.send(ws, {
        type: 'error',
        code: 'INVALID_CODE',
        message: 'Enter a valid 6-character alphanumeric room code.',
      });
      return;
    }

    if (!msg.sessionToken || typeof msg.sessionToken !== 'string') {
      this.send(ws, {
        type: 'error',
        code: 'INVALID_SESSION',
        message: 'Missing player session token.',
      });
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.send(ws, {
        type: 'error',
        code: 'ROOM_NOT_FOUND',
        message: `Room ${roomCode} was not found or has expired.`,
      });
      return;
    }

    // If this exact sessionToken is already in this room, reattach instead of duplicating
    const existing = room.players.find(
      (p) => p.sessionToken === msg.sessionToken && p.status !== 'abandoned'
    );
    if (existing) {
      this.reattachPlayerSocket(ws, room, existing);
      return;
    }

    if (room.phase !== 'lobby') {
      this.send(ws, {
        type: 'error',
        code: 'ROOM_ALREADY_STARTED',
        message: `Room ${roomCode} has already started its match.`,
      });
      return;
    }

    const activePlayers = room.players.filter((p) => p.status !== 'abandoned');
    if (activePlayers.length >= room.targetPlayerCount) {
      this.send(ws, {
        type: 'error',
        code: 'ROOM_FULL',
        message: `Room ${roomCode} is already full (${room.targetPlayerCount}/${room.targetPlayerCount}).`,
      });
      return;
    }

    const usedColors = new Set(activePlayers.map((p) => p.color));
    const nextColor: PlayerColor | undefined = PLAYER_COLOR_ORDER.find(
      (c) => !usedColors.has(c)
    );
    if (!nextColor) {
      this.send(ws, {
        type: 'error',
        code: 'ROOM_FULL',
        message: 'No player colors remaining in this room.',
      });
      return;
    }

    this.detachSocketIfBound(ws);

    const seatNumber = activePlayers.length + 1;
    const joinedPlayer: ServerPlayer = {
      id: crypto.randomUUID(),
      name: sanitizePlayerName(msg.playerName ?? '', `Player ${seatNumber}`),
      color: nextColor,
      position: 0,
      isBot: false,
      isHost: false,
      status: 'connected',
      graceDeadline: null,
      readyForRematch: false,
      sessionToken: msg.sessionToken,
      socket: ws,
      disconnectTimer: null,
    };

    room.players.push(joinedPlayer);
    room.lastActivityAt = Date.now();
    room.notice = `${joinedPlayer.name} joined the room.`;
    this.socketIndex.set(ws, {
      roomCode,
      sessionToken: joinedPlayer.sessionToken,
    });

    this.send(ws, {
      type: 'room_joined',
      roomCode,
      playerId: joinedPlayer.id,
      state: this.toPublicState(room),
    });
    this.broadcastState(room);
  }

  private onReconnectRoom(
    ws: WebSocket,
    msg: Extract<ClientWsMessage, { type: 'reconnect_room' }>
  ): void {
    const roomCode = normalizeRoomCode(msg.roomCode ?? '');
    if (!isValidRoomCodeFormat(roomCode)) {
      this.send(ws, {
        type: 'error',
        code: 'INVALID_CODE',
        message: 'Invalid room code.',
      });
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.send(ws, {
        type: 'error',
        code: 'ROOM_NOT_FOUND',
        message: 'That room has expired or closed.',
      });
      return;
    }

    const existing = room.players.find((p) => p.sessionToken === msg.sessionToken);
    if (!existing) {
      this.send(ws, {
        type: 'error',
        code: 'SESSION_NOT_FOUND',
        message: 'Your seat in this room could not be found.',
      });
      return;
    }

    if (existing.status === 'abandoned') {
      this.send(ws, {
        type: 'error',
        code: 'RECONNECT_EXPIRED',
        message: 'Reconnection window expired and your seat was closed.',
      });
      return;
    }

    this.reattachPlayerSocket(ws, room, existing);
  }

  private reattachPlayerSocket(
    ws: WebSocket,
    room: RoomRecord,
    player: ServerPlayer
  ): void {
    this.detachSocketIfBound(ws);

    if (player.socket && player.socket !== ws) {
      this.socketIndex.delete(player.socket);
      try {
        player.socket.close(4001, 'Replaced by reconnected session');
      } catch {
        // Ignore already-closed sockets
      }
    }

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }

    const wasDisconnected = player.status === 'disconnected';
    player.socket = ws;
    player.status = 'connected';
    player.graceDeadline = null;
    room.lastActivityAt = Date.now();
    if (wasDisconnected) {
      room.notice = `${player.name} reconnected.`;
    }

    this.socketIndex.set(ws, {
      roomCode: room.roomCode,
      sessionToken: player.sessionToken,
    });

    this.send(ws, {
      type: 'room_joined',
      roomCode: room.roomCode,
      playerId: player.id,
      state: this.toPublicState(room),
    });
    this.broadcastState(room);
  }

  private onStartMatch(
    ws: WebSocket,
    msg: Extract<ClientWsMessage, { type: 'start_match' }>
  ): void {
    const room = this.getAuthorizedRoom(ws, msg.roomCode, msg.sessionToken);
    if (!room) return;

    const caller = room.players.find((p) => p.sessionToken === msg.sessionToken);
    if (!caller || !caller.isHost) {
      this.send(ws, {
        type: 'error',
        code: 'NOT_HOST',
        message: 'Only the host can start the match.',
      });
      return;
    }

    if (room.phase !== 'lobby') {
      this.send(ws, {
        type: 'error',
        code: 'ALREADY_STARTED',
        message: 'Match has already started.',
      });
      return;
    }

    const activePlayers = room.players.filter((p) => p.status !== 'abandoned');
    if (activePlayers.length !== room.targetPlayerCount) {
      this.send(ws, {
        type: 'error',
        code: 'SEATS_UNFILLED',
        message: `Waiting for all ${room.targetPlayerCount} players to join before starting.`,
      });
      return;
    }

    if (activePlayers.some((p) => p.status !== 'connected')) {
      this.send(ws, {
        type: 'error',
        code: 'PLAYER_DISCONNECTED',
        message: 'All players must be connected to start.',
      });
      return;
    }

    room.phase = 'playing';
    room.currentTurnIndex = 0;
    room.turnSeq = 1;
    room.lastTurn = null;
    room.winnerId = null;
    room.winReason = null;
    room.notice = `Match started! ${room.players[0].name} rolls first.`;
    room.lastActivityAt = Date.now();

    this.broadcastState(room);
  }

  private onRollDice(
    ws: WebSocket,
    msg: Extract<ClientWsMessage, { type: 'roll_dice' }>
  ): void {
    const room = this.getAuthorizedRoom(ws, msg.roomCode, msg.sessionToken);
    if (!room) return;

    if (room.phase !== 'playing') {
      this.send(ws, {
        type: 'error',
        code: 'MATCH_NOT_ACTIVE',
        message: 'Match is not currently active.',
      });
      return;
    }

    const activePlayer = room.players[room.currentTurnIndex];
    if (!activePlayer || activePlayer.sessionToken !== msg.sessionToken) {
      this.send(ws, {
        type: 'error',
        code: 'NOT_YOUR_TURN',
        message: 'Wait for your turn before rolling.',
      });
      return;
    }

    if (activePlayer.status !== 'connected') {
      this.send(ws, {
        type: 'error',
        code: 'PLAYER_DISCONNECTED',
        message: 'Reconnect required to roll.',
      });
      return;
    }

    // Prevent duplicate dice rolls from double-taps or stale requests
    if (msg.expectedTurnSeq !== room.turnSeq) {
      this.send(ws, {
        type: 'state_sync',
        state: this.toPublicState(room),
      });
      return;
    }

    // Cryptographically fair server-side 1..6 roll
    const roll = crypto.randomInt(1, 7);
    const resolution = computeTurnResolution(activePlayer.position, roll);

    activePlayer.position = resolution.finalPos;
    room.turnSeq += 1;
    room.lastActivityAt = Date.now();

    const event: LastTurnEvent = {
      eventId: crypto.randomUUID(),
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
    room.lastTurn = event;

    if (resolution.won) {
      room.phase = 'finished';
      room.winnerId = activePlayer.id;
      room.winReason = 'exact_100';
      room.notice = `${activePlayer.name} reached square 100 and won!`;
    } else {
      room.currentTurnIndex = getNextActivePlayerIndex(
        room.players,
        room.currentTurnIndex
      );
      if (resolution.overshot) {
        room.notice = `${activePlayer.name} rolled ${roll} and needed ${
          100 - resolution.startPos
        } to reach 100.`;
      } else if (resolution.transition?.type === 'ladder') {
        room.notice = `${activePlayer.name} climbed a ladder from ${resolution.transition.from} to ${resolution.transition.to}!`;
      } else if (resolution.transition?.type === 'snake') {
        room.notice = `${activePlayer.name} slid down a snake from ${resolution.transition.from} to ${resolution.transition.to}!`;
      } else {
        room.notice = null;
      }
    }

    this.broadcastState(room);
  }

  private onRematchVote(
    ws: WebSocket,
    msg: Extract<ClientWsMessage, { type: 'rematch_vote' }>
  ): void {
    const room = this.getAuthorizedRoom(ws, msg.roomCode, msg.sessionToken);
    if (!room) return;

    if (room.phase !== 'finished') {
      return;
    }

    const player = room.players.find((p) => p.sessionToken === msg.sessionToken);
    if (!player || player.status === 'abandoned') return;

    player.readyForRematch = true;
    room.lastActivityAt = Date.now();

    const remainingPlayers = room.players.filter((p) => p.status !== 'abandoned');
    if (remainingPlayers.length < 2) {
      this.send(ws, {
        type: 'error',
        code: 'NOT_ENOUGH_PLAYERS',
        message: 'At least 2 active players are required to play again.',
      });
      this.broadcastState(room);
      return;
    }

    const allAgreed = remainingPlayers.every(
      (p) => p.readyForRematch && p.status === 'connected'
    );

    if (allAgreed) {
      // Prune abandoned seats on fresh match reset
      room.players = remainingPlayers.map((p, index) => ({
        ...p,
        position: 0,
        readyForRematch: false,
        isHost: index === 0 ? room.players.every((rp) => !rp.isHost || rp.status === 'abandoned') || p.isHost : p.isHost,
      }));
      // Ensure exactly one host
      if (!room.players.some((p) => p.isHost)) {
        room.players[0].isHost = true;
      }
      room.phase = 'playing';
      room.currentTurnIndex = 0;
      room.turnSeq += 1;
      room.lastTurn = null;
      room.winnerId = null;
      room.winReason = null;
      room.notice = `Fresh match started! ${room.players[0].name} rolls first.`;
    } else {
      const readyCount = remainingPlayers.filter((p) => p.readyForRematch).length;
      room.notice = `${player.name} wants to play again (${readyCount}/${remainingPlayers.length} ready).`;
    }

    this.broadcastState(room);
  }

  private onLeaveRoom(
    ws: WebSocket,
    msg: Extract<ClientWsMessage, { type: 'leave_room' }>
  ): void {
    const room = this.getAuthorizedRoom(ws, msg.roomCode, msg.sessionToken);
    if (!room) return;

    const playerIdx = room.players.findIndex(
      (p) => p.sessionToken === msg.sessionToken
    );
    if (playerIdx === -1) return;

    const player = room.players[playerIdx];
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }
    this.socketIndex.delete(ws);
    player.socket = null;

    this.removeOrAbandonPlayer(room, playerIdx, `${player.name} left the room.`);
  }

  private handleGraceTimeout(roomCode: string, sessionToken: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const playerIdx = room.players.findIndex((p) => p.sessionToken === sessionToken);
    if (playerIdx === -1) return;

    const player = room.players[playerIdx];
    if (player.status !== 'disconnected') return;

    player.disconnectTimer = null;
    this.removeOrAbandonPlayer(
      room,
      playerIdx,
      `${player.name} did not reconnect in time and left the match.`
    );
  }

  private removeOrAbandonPlayer(
    room: RoomRecord,
    playerIdx: number,
    noticeText: string
  ): void {
    const leavingPlayer = room.players[playerIdx];
    const wasHost = leavingPlayer.isHost;

    if (room.phase === 'lobby') {
      room.players.splice(playerIdx, 1);
      if (room.players.length === 0) {
        this.rooms.delete(room.roomCode);
        return;
      }
      if (wasHost) {
        room.players[0].isHost = true;
      }
      room.notice = noticeText;
      room.lastActivityAt = Date.now();
      this.broadcastState(room);
      return;
    }

    // Playing or finished phase: preserve seat record as abandoned (never substitute bots)
    leavingPlayer.status = 'abandoned';
    leavingPlayer.isHost = false;
    leavingPlayer.graceDeadline = null;
    leavingPlayer.readyForRematch = false;

    const remainingActive = room.players.filter((p) => p.status !== 'abandoned');
    const connectedActive = remainingActive.filter((p) => p.status === 'connected');

    if (remainingActive.length === 0 || connectedActive.length === 0) {
      if (remainingActive.length === 0) {
        this.rooms.delete(room.roomCode);
      }
      return;
    }

    if (wasHost) {
      const nextHost = connectedActive[0] ?? remainingActive[0];
      nextHost.isHost = true;
    }

    room.notice = noticeText;
    room.lastActivityAt = Date.now();

    if (room.phase === 'playing') {
      if (remainingActive.length === 1) {
        const lastSurvivor = remainingActive[0];
        room.phase = 'finished';
        room.winnerId = lastSurvivor.id;
        room.winReason = 'abandonment';
        room.notice = `${lastSurvivor.name} wins because all other players left.`;
      } else if (room.currentTurnIndex === playerIdx) {
        room.currentTurnIndex = getNextActivePlayerIndex(room.players, playerIdx);
        room.turnSeq += 1;
      }
    }

    this.broadcastState(room);
  }

  private getAuthorizedRoom(
    ws: WebSocket,
    rawRoomCode: string,
    sessionToken: string
  ): RoomRecord | null {
    const code = normalizeRoomCode(rawRoomCode ?? '');
    const room = this.rooms.get(code);
    if (!room) {
      this.send(ws, {
        type: 'error',
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found or expired.',
      });
      return null;
    }

    const binding = this.socketIndex.get(ws);
    if (
      !binding ||
      binding.roomCode !== code ||
      binding.sessionToken !== sessionToken
    ) {
      this.send(ws, {
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Socket is not joined to this room.',
      });
      return null;
    }

    return room;
  }

  private detachSocketIfBound(ws: WebSocket): void {
    const existing = this.socketIndex.get(ws);
    if (!existing) return;
    this.handleDisconnect(ws);
  }

  private generateUniqueRoomCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) {
        return code;
      }
    }
    throw new Error('Failed to generate unique room code.');
  }

  private toPublicState(room: RoomRecord): MatchState {
    return {
      mode: 'online',
      roomCode: room.roomCode,
      targetPlayerCount: room.targetPlayerCount,
      phase: room.phase,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        position: p.position,
        isBot: false,
        isHost: p.isHost,
        status: p.status,
        graceDeadline: p.graceDeadline ?? null,
        readyForRematch: p.readyForRematch,
      })),
      currentTurnIndex: room.currentTurnIndex,
      turnSeq: room.turnSeq,
      lastTurn: room.lastTurn,
      winnerId: room.winnerId,
      winReason: room.winReason,
      gracePeriodMs: RECONNECT_GRACE_MS,
      notice: room.notice,
    };
  }

  private broadcastState(room: RoomRecord): void {
    const payload: ServerWsMessage = {
      type: 'state_sync',
      state: this.toPublicState(room),
    };
    const json = JSON.stringify(payload);
    for (const player of room.players) {
      if (player.socket && player.socket.readyState === 1) {
        player.socket.send(json);
      }
    }
  }

  private send(ws: WebSocket, message: ServerWsMessage): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }

  private sweepExpiredRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      const ttl = room.phase === 'finished' ? FINISHED_ROOM_TTL_MS : ROOM_IDLE_TTL_MS;
      const anyConnected = room.players.some((p) => p.status === 'connected');
      if (now - room.lastActivityAt > ttl || (!anyConnected && now - room.lastActivityAt > RECONNECT_GRACE_MS + 10_000)) {
        for (const p of room.players) {
          if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
          if (p.socket && p.socket.readyState === 1) {
            this.send(p.socket, {
              type: 'room_closed',
              message: 'Room expired due to inactivity.',
            });
            this.socketIndex.delete(p.socket);
            p.socket.close(4000, 'Room expired');
          }
        }
        this.rooms.delete(code);
      }
    }
  }
}
