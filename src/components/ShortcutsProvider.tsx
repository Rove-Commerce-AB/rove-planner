"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createShortcut as createShortcutAction,
  deleteShortcutsMatchingHref,
  type AppUserShortcut,
} from "@/lib/shortcuts";
import {
  buildCurrentPageHref,
  shortcutMatchKey,
} from "@/lib/shortcutHref";

type ShortcutsContextValue = {
  shortcuts: AppUserShortcut[];
  isPending: boolean;
  matchingShortcut: (pathname: string, search: string) => AppUserShortcut | null;
  addShortcut: (name: string, pathname: string, search: string) => Promise<void>;
  removeMatchingShortcuts: (pathname: string, search: string) => Promise<void>;
};

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function ShortcutsProvider({
  initialShortcuts,
  children,
}: {
  initialShortcuts: AppUserShortcut[];
  children: ReactNode;
}) {
  // Local list is the source of truth after mount. Do not sync from
  // `initialShortcuts` on later layout renders — a stale RSC/cache payload
  // was wiping newly saved shortcuts (and clearing the star) right after add.
  const [shortcuts, setShortcuts] = useState(initialShortcuts);
  const [pendingCount, setPendingCount] = useState(0);

  const matchingShortcut = useCallback(
    (pathname: string, search: string) => {
      const key = shortcutMatchKey(buildCurrentPageHref(pathname, search));
      return (
        shortcuts.find((row) => shortcutMatchKey(row.href) === key) ?? null
      );
    },
    [shortcuts]
  );

  const addShortcut = useCallback(
    async (name: string, pathname: string, search: string) => {
      const href = buildCurrentPageHref(pathname, search);
      const tempId = `temp-${Date.now()}`;
      const temp: AppUserShortcut = {
        id: tempId,
        name: name.trim(),
        href,
        created_at: new Date().toISOString(),
      };

      setPendingCount((n) => n + 1);
      setShortcuts((prev) => [...prev, temp]);

      try {
        const next = await createShortcutAction({ name, href });
        setShortcuts(next);
      } catch (e) {
        setShortcuts((prev) => prev.filter((row) => row.id !== tempId));
        throw e;
      } finally {
        setPendingCount((n) => Math.max(0, n - 1));
      }
    },
    []
  );

  const removeMatchingShortcuts = useCallback(
    async (pathname: string, search: string) => {
      const href = buildCurrentPageHref(pathname, search);
      const key = shortcutMatchKey(href);
      let previous: AppUserShortcut[] = [];

      setPendingCount((n) => n + 1);
      setShortcuts((prev) => {
        previous = prev;
        return prev.filter((row) => shortcutMatchKey(row.href) !== key);
      });

      try {
        const next = await deleteShortcutsMatchingHref(href);
        setShortcuts(next);
      } catch (e) {
        setShortcuts(previous);
        throw e;
      } finally {
        setPendingCount((n) => Math.max(0, n - 1));
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      shortcuts,
      isPending: pendingCount > 0,
      matchingShortcut,
      addShortcut,
      removeMatchingShortcuts,
    }),
    [
      shortcuts,
      pendingCount,
      matchingShortcut,
      addShortcut,
      removeMatchingShortcuts,
    ]
  );

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts(): ShortcutsContextValue {
  const ctx = useContext(ShortcutsContext);
  if (!ctx) {
    throw new Error("useShortcuts must be used within ShortcutsProvider");
  }
  return ctx;
}
