import { useEffect, useRef, useState } from 'react';
import { Dashboard } from './components/Dashboard.tsx';
import { MatchScreen } from './components/MatchScreen.tsx';
import { MultiplayerLobby } from './components/MultiplayerLobby.tsx';
import {
  createVsBotInitialState,
  executeVsBotTurn,
  getBotDecisionDelayMs,
} from './game/botController.ts';
import {
  getSavedActiveRoom,
  useMultiplayerClient,
} from './hooks/useMultiplayerClient.ts';
import type { MatchState } from './shared/types.ts';

type ScreenView = 'dashboard' | 'online_lobby' | 'vs_bot_match';

export default function App() {
  const [screen, setScreen] = useState<ScreenView>('dashboard');
  const [botState, setBotState] = useState<MatchState | null>(null);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mp = useMultiplayerClient();

  // Attempt seamless room recovery if mobile browser reloaded during an active online session
  useEffect(() => {
    const savedRoom = getSavedActiveRoom();
    if (savedRoom) {
      mp.reconnectSavedRoom(savedRoom);
      setScreen('online_lobby');
    }
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatically execute AI bot turns with distinct fair decision timing
  useEffect(() => {
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }

    if (screen !== 'vs_bot_match' || !botState || botState.phase !== 'playing') {
      return;
    }

    const activePlayer = botState.players[botState.currentTurnIndex];
    if (!activePlayer || !activePlayer.isBot) {
      return;
    }

    // Account for preceding turn animation time so bots never overlap visually
    const stepsCount = botState.lastTurn?.steps.length ?? 0;
    const transitionMs = botState.lastTurn?.transition ? 520 : 0;
    const animBufferMs = botState.lastTurn
      ? 350 + stepsCount * 165 + transitionMs
      : 0;
    const botDelay = animBufferMs + getBotDecisionDelayMs(activePlayer.botPersonality);

    botTimerRef.current = setTimeout(() => {
      setBotState((prev) => (prev ? executeVsBotTurn(prev) : prev));
    }, botDelay);

    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
    };
  }, [screen, botState?.phase, botState?.currentTurnIndex, botState?.turnSeq]);

  const handleStartVsBot = () => {
    mp.clearError();
    setBotState(createVsBotInitialState());
    setScreen('vs_bot_match');
  };

  const handleOpenOnline = () => {
    mp.clearError();
    mp.connectSocket();
    setScreen('online_lobby');
  };

  const handleReturnDashboardFromBot = () => {
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
    setBotState(null);
    setScreen('dashboard');
  };

  const handleReturnDashboardFromOnline = () => {
    mp.leaveRoom();
    setScreen('dashboard');
  };

  // Online active or finished match screen
  if (
    screen === 'online_lobby' &&
    mp.matchState &&
    (mp.matchState.phase === 'playing' || mp.matchState.phase === 'finished')
  ) {
    const connectionLostBanner =
      mp.connectionStatus !== 'connected'
        ? 'Connection interrupted — reconnecting to your seat...'
        : mp.errorMessage;

    return (
      <MatchScreen
        state={mp.matchState}
        myPlayerId={mp.myPlayerId}
        connectionLostBanner={connectionLostBanner}
        onRollDice={mp.rollDice}
        onPlayAgain={mp.voteRematch}
        onReturnDashboard={handleReturnDashboardFromOnline}
      />
    );
  }

  // Online lobby (HOST / JOIN / Waiting Room)
  if (screen === 'online_lobby') {
    return (
      <MultiplayerLobby
        matchState={mp.matchState}
        myPlayerId={mp.myPlayerId}
        connectionStatus={mp.connectionStatus}
        errorMessage={mp.errorMessage}
        isBusy={mp.isBusy}
        onBackToDashboard={handleReturnDashboardFromOnline}
        onCreateRoom={mp.createRoom}
        onJoinRoom={mp.joinRoom}
        onStartMatch={mp.startMatch}
        onLeaveRoom={mp.leaveRoom}
        onClearError={mp.clearError}
      />
    );
  }

  // VS Bot Match Screen
  if (screen === 'vs_bot_match' && botState) {
    return (
      <MatchScreen
        state={botState}
        myPlayerId="human-1"
        onRollDice={() =>
          setBotState((prev) => {
            if (!prev || prev.phase !== 'playing') return prev;
            const active = prev.players[prev.currentTurnIndex];
            if (!active || active.isBot || active.id !== 'human-1') return prev;
            return executeVsBotTurn(prev);
          })
        }
        onPlayAgain={() => setBotState(createVsBotInitialState())}
        onReturnDashboard={handleReturnDashboardFromBot}
      />
    );
  }

  // Main Dashboard
  return (
    <Dashboard
      onSelectOnline={handleOpenOnline}
      onSelectVsBot={handleStartVsBot}
      rejoinError={mp.errorMessage}
      onDismissError={mp.clearError}
    />
  );
}
