import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

type ToggleMode = 'grocery' | 'service' | 'food';

type ToggleContextType = {
  activeMode: ToggleMode;
  setActiveMode: (mode: ToggleMode) => void;
};

const ToggleContext = createContext<ToggleContextType | undefined>(undefined);

export const ToggleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMode, setActiveModeState] = useState<ToggleMode>('grocery');

  // Memoize setActiveMode to prevent unnecessary re-renders
  const setActiveMode = useCallback((mode: ToggleMode) => {
    setActiveModeState(prevMode => {
      // Only update if mode actually changed
      if (prevMode === mode) return prevMode;
      return mode;
    });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ activeMode, setActiveMode }), [activeMode, setActiveMode]);

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
