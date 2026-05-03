"use client";

import type { ComponentProps } from "react";
import { TimeGridColumnHighlightProvider } from "@/components/TimeGridColumnHighlight";
import { TimeReportPageClient } from "./TimeReportPageClient";

export function TimeReportWithColumnHighlight(
  props: ComponentProps<typeof TimeReportPageClient>
) {
  return (
    <TimeGridColumnHighlightProvider>
      <TimeReportPageClient {...props} />
    </TimeGridColumnHighlightProvider>
  );
}
