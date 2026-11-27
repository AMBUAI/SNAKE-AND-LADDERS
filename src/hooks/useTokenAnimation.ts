import { useEffect, useRef, useState } from 'react';
import {
  playDiceRollSound,
  playLadderSound,
  playOvershootSound,
  playSnakeSound,
  playStepSound,
  playWinSound,
} from '../game/sound.ts';
import type { MatchState } from '../shared/types.ts';

export interface TokenAnimationState {
  visualPositions: Record<string, number>;
  isAnimating: boolean;
  isDiceSpinning: boolean;
  displayDieFace: number;
  activeTransitionType: 'snake' | 'ladder' | null;
  winnerReadyToShow: boolean;
}

export function useTokenAnimation(state: MatchState | null): TokenAnimationState {
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDiceSpinning, setIsDiceSpinning] = useState(false);
  const [displayDieFace, setDisplayDieFace] = useState(1);
  const [activeTransitionType, setActiveTransitionType] = useState<
    'snake' | 'ladder' | null
  >(null);
  const [winnerReadyToShow, setWinnerReadyToShow] = useState(false);

  const lastHandledEventIdRef = useRef<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = () => {
    for (const t of timersRef.current) {
      clearTimeout(t);
    }
    timersRef.current = [];
  };

  useEffect(() => {
    if (!state) {
      clearAllTimers();
      lastHandledEventIdRef.current = null;
      setVisualPositions({});
      setIsAnimating(false);
      setIsDiceSpinning(false);
      setActiveTransitionType(null);
      setWinnerReadyToShow(false);
      return;
    }

    const authoritativeMap: Record<string, number> = {};
    for (const p of state.players) {
      authoritativeMap[p.id] = p.position;
    }

    const lastTurn = state.lastTurn;

    // Fresh match or state with no lastTurn (e.g. Play Again or initial load)
    if (!lastTurn) {
      clearAllTimers();
      lastHandledEventIdRef.current = null;
      setVisualPositions(authoritativeMap);
      setIsAnimating(false);
      setIsDiceSpinning(false);
      setActiveTransitionType(null);
      setWinnerReadyToShow(state.phase === 'finished');
      return;
    }

    // Reconnect or already-handled event: sync positions directly
    if (lastHandledEventIdRef.current === lastTurn.eventId) {
      if (!isAnimating) {
        setVisualPositions(authoritativeMap);
        if (state.phase === 'finished') {
          setWinnerReadyToShow(true);
        }
      }
      return;
    }

    // New turn event arrived: run smooth presentation-only animation
    lastHandledEventIdRef.current = lastTurn.eventId;
    clearAllTimers();

    // Start the moving player visually at startPos, everyone else at authoritative pos
    const initialMap: Record<string, number> = { ...authoritativeMap };
    initialMap[lastTurn.playerId] = lastTurn.startPos;
    setVisualPositions(initialMap);
    setIsAnimating(true);
    setIsDiceSpinning(true);
    setActiveTransitionType(null);
    setWinnerReadyToShow(false);

    playDiceRollSound();

    // Quick die tumble cycle before revealing official roll
    const tumbleFrames = [1, 4, 2, 6, 3, 5];
    tumbleFrames.forEach((face, idx) => {
      const t = setTimeout(() => {
        setDisplayDieFace(face);
      }, idx * 45);
      timersRef.current.push(t);
    });

    const DICE_SETTLE_MS = 280;
    const STEP_INTERVAL_MS = 165;

    const settleTimer = setTimeout(() => {
      setIsDiceSpinning(false);
      setDisplayDieFace(lastTurn.roll);

      if (lastTurn.overshot || lastTurn.steps.length === 0) {
        playOvershootSound();
        const doneTimer = setTimeout(() => {
          setVisualPositions(authoritativeMap);
          setIsAnimating(false);
          if (state.phase === 'finished') {
            setWinnerReadyToShow(true);
          }
        }, 320);
        timersRef.current.push(doneTimer);
        return;
      }

      // Step square by square
      lastTurn.steps.forEach((sq, idx) => {
        const stepTimer = setTimeout(() => {
          playStepSound(idx);
          setVisualPositions((prev) => ({
            ...prev,
            [lastTurn.playerId]: sq,
          }));
        }, idx * STEP_INTERVAL_MS);
        timersRef.current.push(stepTimer);
      });

      const afterStepsMs = lastTurn.steps.length * STEP_INTERVAL_MS + 90;

      if (lastTurn.transition) {
        const transition = lastTurn.transition;
        const slideStartTimer = setTimeout(() => {
          setActiveTransitionType(transition.type);
          if (transition.type === 'ladder') {
            playLadderSound();
          } else {
            playSnakeSound();
          }
          setVisualPositions((prev) => ({
            ...prev,
            [lastTurn.playerId]: transition.to,
          }));
        }, afterStepsMs);
        timersRef.current.push(slideStartTimer);

        const slideEndTimer = setTimeout(() => {
          setActiveTransitionType(null);
          setVisualPositions(authoritativeMap);
          setIsAnimating(false);
          if (lastTurn.won || state.phase === 'finished') {
            playWinSound();
            setWinnerReadyToShow(true);
          }
        }, afterStepsMs + 480);
        timersRef.current.push(slideEndTimer);
      } else {
        const finishTimer = setTimeout(() => {
          setVisualPositions(authoritativeMap);
          setIsAnimating(false);
          if (lastTurn.won || state.phase === 'finished') {
            playWinSound();
            setWinnerReadyToShow(true);
          }
        }, afterStepsMs + 80);
        timersRef.current.push(finishTimer);
      }
    }, DICE_SETTLE_MS);

    timersRef.current.push(settleTimer);
  }, [state]);

  // If win happened via abandonment (no lastTurn win), show winner immediately
  useEffect(() => {
    if (state?.phase === 'finished' && state.winReason === 'abandonment') {
      setWinnerReadyToShow(true);
    }
  }, [state?.phase, state?.winReason]);

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  return {
    visualPositions,
    isAnimating,
    isDiceSpinning,
    displayDieFace,
    activeTransitionType,
    winnerReadyToShow,
  };
}
