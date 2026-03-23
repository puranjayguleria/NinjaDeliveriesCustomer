import React, { createContext, useContext, useState } from 'react';

type ToggleMode = 'grocery' | 'service' | 'food';

type ToggleContextType = {
  activeMode: ToggleMode;
  setActiveMode: (mode: ToggleMode) => void;
};

const ToggleContext = createContext<ToggleContextType | undefined>(undefined);

export const ToggleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMode, setActiveMode] = useState<ToggleMode>('grocery');

  return (
    <ToggleContext.Provider value={{ activeMode, setActiveMode }}>
      {children}
    </ToggleContext.Provider>
  );
};

export const useToggleContext = () => {
  const ctx = useContext(ToggleContext);
  if (!ctx) throw new Error('Must be used inside <ToggleProvider>');
  return ctx;
};
