type Props = {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
};

/**
 * Filter pill for list toolbars.
 * Selected: inverse surface. Default: muted fill (Figma).
 */
export function FilterChip({ selected, onClick, children, count }: Props) {
  const label = count == null ? children : (
    <>
      {children} ({count})
    </>
  );

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        selected
          ? "inline-flex cursor-pointer items-center rounded-full bg-surface-inverse px-3 py-1.5 text-[12px] font-medium text-text-inverse transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2"
          : "inline-flex cursor-pointer items-center rounded-full bg-surface-subtle px-3 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-interactive-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2"
      }
    >
      {label}
    </button>
  );
}
