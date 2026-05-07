import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

type ToggleMode = 'grocery' | 'service' | 'food';

type ToggleContextType = {
  activeMode: ToggleMode;
  setActiveMode: (mode: ToggleMode) => void;
  /** True while any screen is showing its LoadingModal — used to block the native tab bar */
  screenLoading: boolean;
  setScreenLoading: (loading: boolean) => void;
};

const ToggleContext = createContext<ToggleContextType | undefined>(undefined);

export const ToggleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMode, setActiveModeState] = useState<ToggleMode>('grocery');
  const [screenLoading, setScreenLoadingState] = useState(false);

  // Memoize setActiveMode to prevent unnecessary re-renders
  const setActiveMode = useCallback((mode: ToggleMode) => {
    setActiveModeState(prevMode => {
      // Only update if mode actually changed
      if (prevMode === mode) return prevMode;
      return mode;
    });
  }, []);

  const setScreenLoading = useCallback((loading: boolean) => {
    setScreenLoadingState(loading);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({ activeMode, setActiveMode, screenLoading, setScreenLoading }),
    [activeMode, setActiveMode, screenLoading, setScreenLoading]
  );

  return (
    <ToggleContext.Provider value={value}>
      {children}
    </ToggleContext.Provider>
  );
};

export const useToggleContext = () => {
  const ctx = useContext(ToggleContext);
  if (!ctx) throw new Error('Must be used inside <ToggleProvider>');
  return ctx;
};
