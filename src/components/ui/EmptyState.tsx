type Props = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-form bg-bg-muted/30 px-6 py-12 text-center">
      <h3 className="text-heading-s text-text-primary">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-text-primary opacity-70">
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 cursor-pointer rounded-lg bg-brand-signal px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-primary-hover active:bg-accent-primary-active"
      >
        {actionLabel}
      </button>
    </div>
  );
}
