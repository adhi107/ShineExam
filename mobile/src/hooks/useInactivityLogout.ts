import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useSecurity } from "../context/SecurityContext";

interface UseInactivityOptions {
  isLoggedIn: boolean;
  onLogout: () => void;
  isExamActive?: boolean;
}

export function useInactivityLogout({ isLoggedIn, onLogout, isExamActive = false }: UseInactivityOptions) {
  const { config } = useSecurity();
  const lastActiveTimestamp = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = () => {
    lastActiveTimestamp.current = Date.now();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!isLoggedIn || !config.autoLogoutEnabled) return;

    // During active exam, we don't accidentally logout candidate on temporary touch idle unless configured
    const idleMinutes = config.autoLogoutMinutes || 15;
    const timeoutMs = idleMinutes * 60 * 1000;

    timerRef.current = setTimeout(() => {
      if (isLoggedIn && !isExamActive) {
        onLogout();
      }
    }, timeoutMs);
  };

  useEffect(() => {
    if (!isLoggedIn) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    resetTimer();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        const elapsedMinutes = (Date.now() - lastActiveTimestamp.current) / (1000 * 60);
        if (elapsedMinutes >= (config.autoLogoutMinutes || 15) && !isExamActive) {
          onLogout();
        } else {
          resetTimer();
        }
      } else if (nextAppState === "background") {
        lastActiveTimestamp.current = Date.now();
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoggedIn, config.autoLogoutMinutes, config.autoLogoutEnabled, isExamActive]);

  return { resetTimer };
}
