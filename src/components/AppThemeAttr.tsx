"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

function appFromPath(_pathname: string): "planner" | "work" | "future" | null {
  // The existing application is migrating as one Rove Work surface.
  return "work";
}

/** Sets html[data-app] so accent tokens follow the active Rove Apps product. */
export function AppThemeAttr() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const app = appFromPath(pathname);
    const root = document.documentElement;
    if (app) root.dataset.app = app;
    else delete root.dataset.app;
  }, [pathname]);

  return null;
}
