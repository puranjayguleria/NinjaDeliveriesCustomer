import React, { createContext, useContext, useState } from 'react';

type ToggleMode = 'grocery' | 'service' | 'food';

type ToggleContextType = {
  activeMode: ToggleMode;
  setActiveMode: (mode: ToggleMode) => void;
  previousMode: ToggleMode | null;
  switchedToFood: boolean;
  clearSwitchedToFood: () => void;
};

const ToggleContext = createContext<ToggleContextType | undefined>(undefined);

export const ToggleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMode, setActiveMode] = useState<ToggleMode>('grocery');
  const [previousMode, setPreviousMode] = useState<ToggleMode | null>(null);
  const [switchedToFood, setSwitchedToFood] = useState(false);

  const handleSetActiveMode = (mode: ToggleMode) => {
    // If switching TO food FROM a non-food mode, set the flag
    if (mode === 'food' && activeMode !== 'food') {
      setSwitchedToFood(true);
    }
    setPreviousMode(activeMode);
    setActiveMode(mode);
  };

  const clearSwitchedToFood = () => setSwitchedToFood(false);

  return (
    <ToggleContext.Provider value={{ activeMode, setActiveMode: handleSetActiveMode, previousMode, switchedToFood, clearSwitchedToFood }}>
      {children}
    </ToggleContext.Provider>
  );
};

export const useToggleContext = () => {
  const ctx = useContext(ToggleContext);
  if (!ctx) throw new Error('Must be used inside <ToggleProvider>');
  return ctx;
};
