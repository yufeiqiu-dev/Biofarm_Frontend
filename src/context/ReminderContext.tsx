import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReminderContext, type ReminderOptions } from "./useReminder";

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Without this, a toast dismissed by unmounting - navigating away while it is
  // still showing - leaves its timer to fire against a component that is gone.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const hideReminder = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  const showReminder = useCallback(({ message, duration = 2200 }: ReminderOptions) => {
    setMessage(message);
    setVisible(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      timeoutRef.current = null;
    }, duration);
  }, []);

  // The two callbacks are memoized so this memo is honest. Previously they were
  // rebuilt every render and left out of the dependency list, so the value
  // object changed identity on every render regardless - the useMemo did
  // nothing, and every consumer re-rendered with it.
  const value = useMemo(
    () => ({ message, visible, showReminder, hideReminder }),
    [message, visible, showReminder, hideReminder]
  );

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}
