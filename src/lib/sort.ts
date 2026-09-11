const svCollator = new Intl.Collator("sv", { sensitivity: "base" });

/** Stable name sort for SSR + browser (avoids hydration mismatches on å/ä/ö). */
export function compareTextSv(a: string, b: string): number {
  return svCollator.compare(a, b);
}
