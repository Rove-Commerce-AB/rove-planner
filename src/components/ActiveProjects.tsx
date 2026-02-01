import type { Project } from "@/types";


type Props = {
  projects: Project[];
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ActiveProjects({ projects }: Props) {
  return (
    <div className="rounded-lg border border-border bg-bg-default p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">
        Active projects
      </h2>
      <div className="space-y-3">
        {projects.map((p, i) => (
          <div
            key={p.id}
            className="rounded-lg border border-border p-3 transition-colors hover:border-brand-lilac/50"
          >
            <div className="flex items-start gap-2">
              <div
                className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: p.color || DEFAULT_CUSTOMER_COLOR }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary">{p.name}</p>
                <p className="text-sm text-text-primary opacity-70">
                  {p.customerName}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-primary opacity-60">
                  <span>{p.consultantCount} consultants</span>
                  <span>Total: {p.totalHours}h allocated</span>
                </div>
                <p className="mt-1 text-xs text-text-primary opacity-60">
                  {formatDate(p.startDate)} – {formatDate(p.endDate)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
