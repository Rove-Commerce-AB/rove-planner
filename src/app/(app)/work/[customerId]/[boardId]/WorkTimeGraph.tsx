import {
  formatWorkHoursPair,
  hasWorkTimeToShow,
  workTimeBarPercents,
} from "@/lib/workTime";

type Props = {
  estimateHours: number | null;
  loggedHours: number;
  size?: "card" | "drawer";
};

export function WorkTimeGraph({
  estimateHours,
  loggedHours,
  size = "card",
}: Props) {
  if (!hasWorkTimeToShow(estimateHours, loggedHours) && size === "card") {
    return null;
  }

  const { loggedPct, estimatePct, over } = workTimeBarPercents(
    loggedHours,
    estimateHours
  );
  const pair = formatWorkHoursPair(loggedHours, estimateHours);
  const loggedFill = over ? "bg-warning" : "bg-brand-signal";

  if (size === "card") {
    return (
      <div
        className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
        title={`Logged ${pair}`}
        aria-label={`Logged ${pair}`}
      >
        <WorkTimeBar
          estimatePct={estimatePct}
          loggedPct={loggedPct}
          loggedFill={loggedFill}
          showEstimateTrack={estimateHours != null && estimateHours > 0}
        />
      </div>
    );
  }

  if (!hasWorkTimeToShow(estimateHours, loggedHours)) {
    return null;
  }

  return (
    <div className="relative h-1 overflow-hidden rounded-full bg-bg-muted" title={pair}>
      <WorkTimeBar
        estimatePct={estimatePct}
        loggedPct={loggedPct}
        loggedFill={loggedFill}
        showEstimateTrack={false}
      />
    </div>
  );
}

function WorkTimeBar({
  estimatePct,
  loggedPct,
  loggedFill,
  showEstimateTrack,
}: {
  estimatePct: number;
  loggedPct: number;
  loggedFill: string;
  showEstimateTrack: boolean;
}) {
  return (
    <>
      {showEstimateTrack ? (
        <span
          className="absolute inset-y-0 left-0 bg-border-subtle"
          style={{ width: `${estimatePct}%` }}
          aria-hidden
        />
      ) : null}
      <span
        className={`absolute inset-y-0 left-0 ${loggedFill}`}
        style={{ width: `${loggedPct}%` }}
        aria-hidden
      />
    </>
  );
}
