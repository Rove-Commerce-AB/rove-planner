"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

/** Splits label by query (case-insensitive) and returns React nodes with matches wrapped in <strong>. */
function renderLabelWithHighlight(label: string, query: string): React.ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return label;
  const lower = label.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let pos = 0;
  let keyIndex = 0;
  while ((pos = lower.indexOf(q, lastIndex)) !== -1) {
    if (lastIndex < pos) {
      parts.push(<span key={`${keyIndex++}`}>{label.slice(lastIndex, pos)}</span>);
    }
    parts.push(<strong key={`${keyIndex++}`}>{label.slice(pos, pos + q.length)}</strong>);
    lastIndex = pos + q.length;
  }
  if (lastIndex < label.length) {
    parts.push(<span key={`${keyIndex++}`}>{label.slice(lastIndex)}</span>);
  }
  return parts.length > 0 ? parts : label;
}

export type ComboboxOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Filter variant to match Select filter style */
  variant?: "default" | "filter";
  className?: string;
  inputClassName?: string;
  /** Placeholder when options list is empty (e.g. "No Jira/DevOps") */
  emptyOptionsPlaceholder?: string;
};

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Type to search...",
  disabled = false,
  size = "md",
  variant = "default",
  className = "",
  inputClassName = "",
  emptyOptionsPlaceholder,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [listStyle, setListStyle] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayWhenClosed = selectedOption ? selectedOption.label : "";

  useEffect(() => {
    if (!isOpen && value) {
      setInputValue(selectedOption ? selectedOption.label : "");
    }
    if (value === "") {
      setInputValue("");
    }
  }, [value, isOpen, selectedOption?.label]);

  const query = inputValue.trim().toLowerCase();
  const filtered =
    query === ""
      ? options
      : options.filter((o) =>
          o.label.toLowerCase().includes(query)
        );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.("[data-combobox-list]")) return;
      setIsOpen(false);
      setInputValue(displayWhenClosed);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, displayWhenClosed]);

  const isFilter = variant === "filter";
  const inputSize = isFilter ? "py-1 px-2.5 text-xs" : size === "sm" ? "py-1.5 px-3 text-sm" : "py-2 px-3 text-sm";
  const inputShape = isFilter
    ? "rounded-[14px] border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)] placeholder:opacity-70 focus:border-[var(--color-border-form)] focus:ring-1 focus:ring-[var(--color-border-form)] focus:outline-none"
    : "rounded-lg border border-form bg-bg-default text-text-primary placeholder-text-muted focus:border-brand-signal focus:ring-2 focus:ring-brand-signal/20 focus:ring-inset focus:outline-none";

  const handleFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setInputValue(selectedOption ? selectedOption.label : inputValue || "");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = (opt: ComboboxOption) => {
    onValueChange(opt.value);
    setInputValue(opt.label || "");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setInputValue(displayWhenClosed);
      (e.target as HTMLInputElement).blur();
    }
  };

  const showList = isOpen && !disabled;
  const listContent = options.length === 0 ? [] : filtered;

  const updateListPosition = () => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setListStyle({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
    });
  };

  useEffect(() => {
    if (!showList) {
      setListStyle(null);
      return;
    }
    updateListPosition();
    const onScrollOrResize = () => updateListPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    const input = inputRef.current;
    let scrollParent: Element | null = null;
    if (input) {
      let el: HTMLElement | null = input.parentElement;
      while (el) {
        const { overflowX, overflowY, overflow } = getComputedStyle(el);
        if (/(auto|scroll|overlay)/.test(overflow + overflowX + overflowY)) {
          scrollParent = el;
          break;
        }
        el = el.parentElement;
      }
      if (scrollParent) {
        scrollParent.addEventListener("scroll", onScrollOrResize);
      }
    }
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      scrollParent?.removeEventListener("scroll", onScrollOrResize);
    };
  }, [showList]);

  const dropdownList = showList && listStyle && typeof document !== "undefined" && (
    createPortal(
      <ul
        id="combobox-list"
        role="listbox"
        data-combobox-list
        className="max-h-60 overflow-auto rounded-lg border border-form bg-bg-default py-1 shadow-lg z-[9999]"
        style={{
          position: "fixed",
          top: listStyle.top,
          left: listStyle.left,
          minWidth: listStyle.minWidth,
        }}
      >
        {listContent.length === 0 ? (
          <li className="px-3 py-2 text-sm text-text-muted">
            {options.length === 0
              ? emptyOptionsPlaceholder ?? "No options"
              : "No matches"}
          </li>
        ) : (
          listContent.map((opt) => (
            <li
              key={opt.value === "" ? "__empty__" : opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => handleSelect(opt)}
              className={`px-3 py-1.5 text-sm outline-none ${
                opt.value === ""
                  ? "cursor-default text-text-muted"
                  : "cursor-pointer text-text-primary hover:bg-bg-muted"
              } ${opt.value === value ? "bg-brand-lilac/30" : ""}`}
            >
              {renderLabelWithHighlight(opt.label, query)}
            </li>
          ))
        )}
      </ul>,
      document.body
    )
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? inputValue : displayWhenClosed}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-controls={showList ? "combobox-list" : undefined}
          id={showList ? "combobox-list" : undefined}
          className={`w-full pr-8 ${inputSize} ${inputShape} disabled:cursor-not-allowed disabled:opacity-50 ${inputClassName}`}
        />
        <span
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
          aria-hidden
        >
          <ChevronDown className={isFilter ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
      </div>
      {dropdownList}
    </div>
  );
}
