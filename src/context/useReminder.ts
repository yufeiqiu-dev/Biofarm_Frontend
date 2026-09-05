import { createContext, useContext } from "react";

export type ReminderOptions = {
  message: string;
  duration?: number;
};

export type ReminderContextValue = {
  message: string | null;
  visible: boolean;
  showReminder: (options: ReminderOptions) => void;
  hideReminder: () => void;
};

// Split from the provider so that file exports only components - see the note
// in auth/useAuth.ts for why that matters to Fast Refresh.
export const ReminderContext = createContext<ReminderContextValue | undefined>(undefined);

export function useReminder() {
  const context = useContext(ReminderContext);

  if (!context) {
    throw new Error("useReminder must be used within a ReminderProvider");
  }

  return context;
}
