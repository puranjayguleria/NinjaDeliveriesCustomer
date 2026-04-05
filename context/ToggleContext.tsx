import React, { createContext, useContext, useState, useEffect } from 'react';

type ToggleMode = 'grocery' | 'service' | 'food';

type ToggleContextType = {
  activeMode: ToggleMode;
  setActiveMode: (mode: ToggleMode) => void;
  previousMode: ToggleMode | null;
};

const ToggleContext = createContext<ToggleContextType | undefined>(undefined);

export const ToggleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMode, setActiveMode] = useState<ToggleMode>('grocery');
  const [previousMode, setPreviousMode] = useState<ToggleMode | null>(null);

  useEffect(() => {
    // Track previous mode when active mode changes
    return () => {
      setPreviousMode(activeMode);
    };
  }, [activeMode]);

  const handleSetActiveMode = (mode: ToggleMode) => {
    setPreviousMode(activeMode);
    setActiveMode(mode);
  };

  return (
    <ToggleContext.Provider value={{ activeMode, setActiveMode: handleSetActiveMode, previousMode }}>
      {children}
    </ToggleContext.Provider>
  );
};

export const useToggleContext = () => {
  const ctx = useContext(ToggleContext);
  if (!ctx) throw new Error('Must be used inside <ToggleProvider>');
  return ctx;
};
