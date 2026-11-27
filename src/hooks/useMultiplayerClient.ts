import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeRoomCode } from '../shared/rules.ts';
import type { ClientWsMessage, MatchState, ServerWsMessage } from '../shared/types.ts';

const SESSION_TOKEN_KEY = 'sl_session_token_v1';
const ACTIVE_ROOM_KEY = 'sl_active_room_v1';

function getOrCreateSessionToken(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_TOKEN_KEY, created);
    return created;
  } catch {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function saveActiveRoom(roomCode: string | null): void {
  try {
    if (roomCode) {
      sessionStorage.setItem(ACTIVE_ROOM_KEY, roomCode);
    } else {
      sessionStorage.removeItem(ACTIVE_ROOM_KEY);
    }
  } catch {
    // Ignore storage restriction
  }
}

export function getSavedActiveRoom(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_ROOM_KEY);
  } catch {
    return null;
  }
}

export type SocketConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export function useMultiplayerClient() {
  const [connectionStatus, setConnectionStatus] =
    useState<SocketConnectionStatus>('disconnected');
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionTokenRef = useRef<string>(getOrCreateSessionToken());
  const pendingMessagesRef = useRef<ClientWsMessage[]>([]);
  const activeRoomRef = useRef<string | null>(null);
  const manualLeaveRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const connectSocket = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    setConnectionStatus('connecting');

    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttemptRef.current = 0;

      // Flush queued messages
      const queued = [...pendingMessagesRef.current];
      pendingMessagesRef.current = [];

      // If we were already in an active room and lost connection, auto-reconnect to seat
      if (activeRoomRef.current && !manualLeaveRef.current) {
        const hasReconnectAlready = queued.some((m) => m.type === 'reconnect_room');
        if (!hasReconnectAlready) {
          socket.send(
            JSON.stringify({
              type: 'reconnect_room',
              roomCode: activeRoomRef.current,
              sessionToken: sessionTokenRef.current,
            } satisfies ClientWsMessage)
          );
        }
      }

      for (const msg of queued) {
        socket.send(JSON.stringify(msg));
      }

      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' } satisfies ClientWsMessage));
        }
      }, 15_000);
    };

    socket.onmessage = (event) => {
      let data: ServerWsMessage;
      try {
        data = JSON.parse(String(event.data)) as ServerWsMessage;
      } catch {
        return;
      }

      switch (data.type) {
        case 'room_joined':
          activeRoomRef.current = data.roomCode;
          saveActiveRoom(data.roomCode);
          setMyPlayerId(data.playerId);
          setMatchState(data.state);
          setErrorMessage(null);
          setIsBusy(false);
          break;
        case 'state_sync':
          setMatchState(data.state);
          setErrorMessage(null);
          setIsBusy(false);
          break;
        case 'error':
          setErrorMessage(data.message);
          setIsBusy(false);
          if (
            data.code === 'ROOM_NOT_FOUND' ||
            data.code === 'RECONNECT_EXPIRED' ||
            data.code === 'SESSION_NOT_FOUND'
          ) {
            activeRoomRef.current = null;
            saveActiveRoom(null);
          }
          break;
        case 'room_closed':
          activeRoomRef.current = null;
          saveActiveRoom(null);
          setMatchState(null);
          setMyPlayerId(null);
          setErrorMessage(data.message);
          setIsBusy(false);
          break;
        case 'pong':
          break;
      }
    };

    socket.onclose = () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      wsRef.current = null;
      setConnectionStatus('disconnected');

      // Auto-reconnect if user is still in an active room
      if (activeRoomRef.current && !manualLeaveRef.current) {
        const delay = Math.min(4000, 600 * Math.pow(1.6, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          connectSocket();
        }, delay);
      }
    };

    socket.onerror = () => {
      // onclose handles retry
    };
  }, []);

  const sendMessage = useCallback(
    (msg: ClientWsMessage) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
        return;
      }
      pendingMessagesRef.current.push(msg);
      connectSocket();
    },
    [connectSocket]
  );

  // Mobile backgrounding / visibility recovery & network online recovery
  useEffect(() => {
    const handleRecover = () => {
      if (document.visibilityState === 'visible' && activeRoomRef.current && !manualLeaveRef.current) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connectSocket();
        } else {
          wsRef.current.send(
            JSON.stringify({
              type: 'reconnect_room',
              roomCode: activeRoomRef.current,
              sessionToken: sessionTokenRef.current,
            } satisfies ClientWsMessage)
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleRecover);
    window.addEventListener('online', handleRecover);
    return () => {
      document.removeEventListener('visibilitychange', handleRecover);
      window.removeEventListener('online', handleRecover);
    };
  }, [connectSocket]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const createRoom = useCallback(
    (targetPlayerCount: number, playerName: string) => {
      manualLeaveRef.current = false;
      setErrorMessage(null);
      setIsBusy(true);
      sendMessage({
        type: 'create_room',
        targetPlayerCount,
        playerName,
        sessionToken: sessionTokenRef.current,
      });
    },
    [sendMessage]
  );

  const joinRoom = useCallback(
    (rawCode: string, playerName: string) => {
      const normalized = normalizeRoomCode(rawCode);
      manualLeaveRef.current = false;
      setErrorMessage(null);
      setIsBusy(true);
      sendMessage({
        type: 'join_room',
        roomCode: normalized,
        playerName,
        sessionToken: sessionTokenRef.current,
      });
    },
    [sendMessage]
  );

  const reconnectSavedRoom = useCallback(
    (rawCode: string) => {
      const normalized = normalizeRoomCode(rawCode);
      manualLeaveRef.current = false;
      activeRoomRef.current = normalized;
      setErrorMessage(null);
      setIsBusy(true);
      sendMessage({
        type: 'reconnect_room',
        roomCode: normalized,
        sessionToken: sessionTokenRef.current,
      });
    },
    [sendMessage]
  );

  const startMatch = useCallback(() => {
    if (!matchState?.roomCode) return;
    setErrorMessage(null);
    sendMessage({
      type: 'start_match',
      roomCode: matchState.roomCode,
      sessionToken: sessionTokenRef.current,
    });
  }, [matchState?.roomCode, sendMessage]);

  const rollDice = useCallback(() => {
    if (!matchState?.roomCode) return;
    sendMessage({
      type: 'roll_dice',
      roomCode: matchState.roomCode,
      sessionToken: sessionTokenRef.current,
      expectedTurnSeq: matchState.turnSeq,
    });
  }, [matchState?.roomCode, matchState?.turnSeq, sendMessage]);

  const voteRematch = useCallback(() => {
    if (!matchState?.roomCode) return;
    sendMessage({
      type: 'rematch_vote',
      roomCode: matchState.roomCode,
      sessionToken: sessionTokenRef.current,
    });
  }, [matchState?.roomCode, sendMessage]);

  const leaveRoom = useCallback(() => {
    manualLeaveRef.current = true;
    const code = matchState?.roomCode || activeRoomRef.current;
    if (code && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'leave_room',
          roomCode: code,
          sessionToken: sessionTokenRef.current,
        } satisfies ClientWsMessage)
      );
    }
    activeRoomRef.current = null;
    saveActiveRoom(null);
    pendingMessagesRef.current = [];
    setMatchState(null);
    setMyPlayerId(null);
    setErrorMessage(null);
    setIsBusy(false);
  }, [matchState?.roomCode]);

  const clearError = useCallback(() => setErrorMessage(null), []);

  return {
    connectionStatus,
    matchState,
    myPlayerId,
    errorMessage,
    isBusy,
    connectSocket,
    createRoom,
    joinRoom,
    reconnectSavedRoom,
    startMatch,
    rollDice,
    voteRematch,
    leaveRoom,
    clearError,
  };
}
