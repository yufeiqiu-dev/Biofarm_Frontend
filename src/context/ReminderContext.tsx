import {
    createContext,
    useContext,
    useMemo,
    useState,
    useRef,
    type ReactNode,
  } from "react";
  
  type ReminderOptions = {
    message: string;
    duration?: number;
  };
  
  type ReminderContextValue = {
    message: string | null;
    visible: boolean;
    showReminder: (options: ReminderOptions) => void;
    hideReminder: () => void;
  };
  
  const ReminderContext = createContext<ReminderContextValue | undefined>(undefined);
  
  export function ReminderProvider({ children }: { children: ReactNode }) {
    const [message, setMessage] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<number | null>(null);
  
    const hideReminder = () => {
      setVisible(false);
    };
  
    const showReminder = ({ message, duration = 2200 }: ReminderOptions) => {
      setMessage(message);
      setVisible(true);
  
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
  
      timeoutRef.current = window.setTimeout(() => {
        setVisible(false);
      }, duration);
    };
  
    const value = useMemo(
      () => ({
        message,
        visible,
        showReminder,
        hideReminder,
      }),
      [message, visible]
    );
  
    return (
      <ReminderContext.Provider value={value}>
        {children}
      </ReminderContext.Provider>
    );
  }
  
  export function useReminder() {
    const context = useContext(ReminderContext);
  
    if (!context) {
      throw new Error("useReminder must be used within a ReminderProvider");
    }
  
    return context;
  }