"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type SidePanelType = "customers" | "consultants" | null;

type SidePanelContextValue = {
  panel: SidePanelType;
  /** Panel that is currently animating out (keep slot mounted until transition ends). */
  closingPanel: SidePanelType | null;
  openPanel: (type: SidePanelType) => void;
  closePanel: () => void;
  togglePanel: (type: "customers" | "consultants") => void;
  /** Call when close/switch transition has finished so we can clear closingPanel. */
  finishClosingPanel: () => void;
  registerRefreshCustomers: (fn: () => void) => void;
  refreshCustomers: () => void;
  registerRefreshConsultants: (fn: () => void) => void;
  refreshConsultants: () => void;
};

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<SidePanelType>(null);
  const [closingPanel, setClosingPanel] = useState<SidePanelType | null>(null);
  const refreshCustomersRef = useRef<(() => void) | null>(null);
  const refreshConsultantsRef = useRef<(() => void) | null>(null);

  const openPanel = useCallback((type: SidePanelType) => {
    setClosingPanel(null);
    setPanel(type);
  }, []);

  const closePanel = useCallback(() => {
    setPanel((prev) => {
      if (prev !== null) setClosingPanel(prev);
      return null;
    });
  }, []);

  const togglePanel = useCallback((type: "customers" | "consultants") => {
    setPanel((prev) => {
      if (prev === type) {
        if (prev !== null) setClosingPanel(prev);
        return null;
      }
      if (prev !== null) setClosingPanel(prev);
      return type;
    });
  }, []);

  const finishClosingPanel = useCallback(() => {
    setClosingPanel(null);
  }, []);

  const registerRefreshCustomers = useCallback((fn: () => void) => {
    refreshCustomersRef.current = fn;
  }, []);

  const refreshCustomers = useCallback(() => {
    refreshCustomersRef.current?.();
  }, []);

  const registerRefreshConsultants = useCallback((fn: () => void) => {
    refreshConsultantsRef.current = fn;
  }, []);

  const refreshConsultants = useCallback(() => {
    refreshConsultantsRef.current?.();
  }, []);

  return (
    <SidePanelContext.Provider
      value={{
        panel,
        closingPanel,
        openPanel,
        closePanel,
        togglePanel,
        finishClosingPanel,
        registerRefreshCustomers,
        refreshCustomers,
        registerRefreshConsultants,
        refreshConsultants,
      }}
    >
      {children}
    </SidePanelContext.Provider>
  );
}

export function useSidePanel() {
  const ctx = useContext(SidePanelContext);
  if (!ctx) throw new Error("useSidePanel must be used within SidePanelProvider");
  return ctx;
}
