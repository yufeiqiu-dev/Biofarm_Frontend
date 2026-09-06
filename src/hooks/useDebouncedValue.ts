import { useEffect, useState } from "react";

/**
 * A value that only settles once it has stopped changing.
 *
 * For the admin order search, which now queries the server: without this, every
 * keystroke is a request, and the answers can arrive out of order so the list
 * ends up showing results for a prefix of what was typed.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
