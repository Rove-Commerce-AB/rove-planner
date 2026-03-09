/**
 * Shared inline-edit behavior: when to save vs just close.
 * Used across detail pages and settings so all inline-editable fields
 * behave the same (Enter = save, Escape = cancel, blur = save only if changed).
 *
 * Single-line (input): Enter = save, Escape = cancel, blur = save only if changed.
 * Multiline (textarea): Escape = cancel, blur = save only if changed.
 * Enter does NOT save in textarea so that newlines can be typed.
 */

/**
 * Returns whether the edited value is considered changed from the original.
 * For text: compares trimmed by default so "  x  " vs "x" does not trigger save.
 * Pass trim: false only when leading/trailing whitespace is meaningful.
 */
export function isInlineEditValueChanged(
  original: string,
  current: string,
  options?: { trim?: boolean }
): boolean {
  const trim = options?.trim ?? true;
  const a = trim ? original.trim() : original;
  const b = trim ? current.trim() : current;
  return a !== b;
}
