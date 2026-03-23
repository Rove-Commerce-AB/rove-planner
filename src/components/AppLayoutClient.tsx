"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ConsultantsSidePanel } from "@/components/ConsultantsSidePanel";
import { CustomersSidePanel } from "@/components/CustomersSidePanel";
import { FeatureRequestFab } from "@/components/FeatureRequestFab";
import {
  SidePanelProvider,
  useSidePanel,
  type SidePanelType,
} from "@/contexts/SidePanelContext";

const PANEL_WIDTH = "16.8rem"; /* ~20% wider than original 14rem */
const PANEL_TRANSITION_MS = 200;

function PanelSlot({
  visiblePanel,
  isOpen,
  onTransitionEnd,
}: {
  visiblePanel: SidePanelType;
  isOpen: boolean;
  onTransitionEnd: () => void;
}) {
  return (
    <div
      className="flex h-screen flex-shrink-0 overflow-hidden transition-[width] ease-out"
      style={{
        width: isOpen ? PANEL_WIDTH : 0,
        transitionDuration: `${PANEL_TRANSITION_MS}ms`,
      }}
      onTransitionEnd={onTransitionEnd}
    >
      <div className="flex h-full" style={{ minWidth: PANEL_WIDTH, width: PANEL_WIDTH }}>
        {visiblePanel === "customers" && <CustomersSidePanel />}
        {visiblePanel === "consultants" && <ConsultantsSidePanel />}
      </div>
    </div>
  );
}

function LayoutContent({
  children,
  isAdmin,
  canSeeTimeReportProjectManager,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  canSeeTimeReportProjectManager: boolean;
}) {
  const pathname = usePathname();
  const { panel, closingPanel, openPanel, finishClosingPanel } = useSidePanel();
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/consultants/") && pathname !== "/consultants") {
      openPanel("consultants");
    } else if (pathname.startsWith("/customers/") && pathname !== "/customers") {
      openPanel("customers");
    }
  }, [pathname, openPanel]);

  const isClosing = closingPanel !== null;
  const visiblePanel = closingPanel ?? panel;
  const showSlot = panel !== null || closingPanel !== null;

  useEffect(() => {
    if (isClosing) {
      setOpen(false);
    } else if (panel !== null) {
      const id = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id);
    }
  }, [panel, isClosing]);

  const handlePanelTransitionEnd = () => {
    if (isClosing) {
      finishClosingPanel();
      if (panel !== null) {
        setOpen(false);
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        isAdmin={isAdmin}
        canSeeTimeReportProjectManager={canSeeTimeReportProjectManager}
      />
      {showSlot && visiblePanel !== null && (
        <PanelSlot
          visiblePanel={visiblePanel}
          isOpen={isOpen}
          onTransitionEnd={handlePanelTransitionEnd}
        />
      )}
      <main
        className="min-h-0 flex-1 overflow-auto p-8"
        style={{ backgroundColor: "var(--color-bg-content)" }}
      >
        {children}
      </main>
      <FeatureRequestFab />
    </div>
  );
}

export function AppLayoutClient({
  children,
  isAdmin = false,
  canSeeTimeReportProjectManager = false,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  canSeeTimeReportProjectManager?: boolean;
}) {
  return (
    <SidePanelProvider>
      <LayoutContent
        isAdmin={isAdmin}
        canSeeTimeReportProjectManager={canSeeTimeReportProjectManager}
      >
        {children}
      </LayoutContent>
    </SidePanelProvider>
  );
}
