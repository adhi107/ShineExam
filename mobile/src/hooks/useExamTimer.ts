import { useState, useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";

interface UseExamTimerOptions {
  initialSeconds: number;
  isActive: boolean;
  onTimeExpired: () => void;
  onTick?: (remainingSeconds: number) => void;
}

export function useExamTimer({
  initialSeconds,
  isActive,
  onTimeExpired,
  onTick,
}: UseExamTimerOptions) {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const backgroundTimeRef = useRef<number | null>(null);
  const onTimeExpiredRef = useRef(onTimeExpired);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTimeExpiredRef.current = onTimeExpired;
    onTickRef.current = onTick;
  }, [onTimeExpired, onTick]);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  // Main 1-second countdown interval
  useEffect(() => {
    if (!isActive || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          onTimeExpiredRef.current();
          return 0;
        }
        if (onTickRef.current) {
          onTickRef.current(next);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  // Wall-clock AppState synchronizer (prevents timer manipulation or freezing when app is in background)
  useEffect(() => {
    if (!isActive) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundTimeRef.current = Date.now();
      } else if (nextState === "active" && backgroundTimeRef.current) {
        const elapsedSeconds = Math.floor((Date.now() - backgroundTimeRef.current) / 1000);
        backgroundTimeRef.current = null;

        if (elapsedSeconds > 0) {
          setSecondsLeft((prev) => {
            const next = Math.max(0, prev - elapsedSeconds);
            if (next <= 0) {
              onTimeExpiredRef.current();
              return 0;
            }
            return next;
          });
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [isActive]);

  const formattedTime = useCallback(() => {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [secondsLeft]);

  return {
    secondsLeft,
    setSecondsLeft,
    formattedTime: formattedTime(),
    isUrgent: secondsLeft < 300, // < 5 mins
    isWarning: secondsLeft < 600, // < 10 mins
  };
}
