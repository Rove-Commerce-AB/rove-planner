"use client";

import type { ComponentProps } from "react";
import { TimeReportPageClient } from "./TimeReportPageClient";

/** Wrapper kept for stable page import path; column hover is CSS-only now. */
export function TimeReportWithColumnHighlight(
  props: ComponentProps<typeof TimeReportPageClient>
) {
  return <TimeReportPageClient {...props} />;
}
