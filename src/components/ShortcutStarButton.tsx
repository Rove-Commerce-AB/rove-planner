"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
import { IconButton } from "@/components/ui";
import { useShortcuts } from "@/components/ShortcutsProvider";

export function ShortcutStarButton({
  defaultName,
}: {
  /** Suggested name when adding (usually last breadcrumb label). */
  defaultName: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { matchingShortcut, addShortcut, removeMatchingShortcuts, isPending } =
    useShortcuts();

  const match = matchingShortcut(pathname, search);
  const isStarred = match != null;

  const [promptOpen, setPromptOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (!promptOpen) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [promptOpen]);

  useEffect(() => {
    if (!promptOpen) return;

    function onPointerDown(event: MouseEvent | PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setPromptOpen(false);
        setError(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPromptOpen(false);
        setError(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [promptOpen]);

  async function handleStarClick() {
    if (isStarred) {
      setSaving(true);
      setError(null);
      try {
        await removeMatchingShortcuts(pathname, search);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove shortcut");
      } finally {
        setSaving(false);
      }
      return;
    }

    setName(defaultName.trim() || "Shortcut");
    setError(null);
    setPromptOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addShortcut(trimmed, pathname, search);
      setPromptOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save shortcut");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center">
      <IconButton
        aria-label={isStarred ? "Remove shortcut" : "Add shortcut"}
        aria-expanded={promptOpen}
        aria-controls={promptOpen ? inputId : undefined}
        title={isStarred ? "Remove shortcut" : "Add shortcut"}
        disabled={saving || isPending}
        onClick={() => void handleStarClick()}
        className={isStarred ? "opacity-100 text-text-primary" : undefined}
      >
        <Star
          className={`h-4 w-4 ${isStarred ? "fill-current" : ""}`}
          aria-hidden
        />
      </IconButton>

      {promptOpen ? (
        <form
          onSubmit={handleSave}
          className="absolute left-full top-1/2 z-40 ml-1 flex -translate-y-1/2 items-center gap-1 rounded-md border border-border-subtle bg-bg-default px-1.5 py-1 shadow-md"
        >
          <label htmlFor={inputId} className="sr-only">
            Shortcut name
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            disabled={saving}
            placeholder="Name"
            className="w-36 rounded border-0 bg-transparent px-1.5 py-0.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-0"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-text-primary opacity-70 transition-opacity hover:bg-bg-muted hover:opacity-100 disabled:opacity-40"
          >
            {saving ? "…" : "Save"}
          </button>
          {error ? (
            <span className="absolute left-0 top-full mt-1 whitespace-nowrap text-[10px] text-danger">
              {error}
            </span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
