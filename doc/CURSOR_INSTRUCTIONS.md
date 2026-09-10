# Cursor instructions: implement the Rove Apps token contract

Follow DESIGN_SYSTEM.md. Do not use the retired palette (`brand.signal`, `#FF6136`, lilac, old gray ramps).

Wait for approval between steps.

---

## Step 1 – Docs (done when DESIGN_SYSTEM.md and UI_PATTERNS.md match the portal export)

Contract files:
- `doc/DESIGN_SYSTEM.md`
- `doc/UI_PATTERNS.md`
- `doc/AI_UI_CHECKLIST.md`

---

## Step 2 – tokens.css

Read DESIGN_SYSTEM.md carefully before starting.

Task: replace `styles/tokens.css` with primitives, semantic light/dark values, radius, and shadows from DESIGN_SYSTEM.md.

Rules:
- Primitives first; semantic tokens reference primitives.
- `:root` = light. `.dark` = dark semantic + accent overrides.
- `[data-app="planner"]`, `[data-app="work"]`, `[data-app="future"]` set accent tokens.
- Do not keep `brand.signal`, `brand.lilac`, or undocumented hex.
- Do not touch any file other than `styles/tokens.css`.

Show the complete updated tokens.css. Wait for approval.

Check:
- [ ] No hex outside tokens.css after this step (this file is the exception)
- [ ] Every semantic token in DESIGN_SYSTEM.md exists
- [ ] Light and dark values match the tables
- [ ] Radius and shadow tokens match the tables

---

## Step 3 – Tailwind

Read DESIGN_SYSTEM.md before starting.

Task: map the new CSS variables to Tailwind in the Tailwind config (or CSS `@theme` if that is what the repo uses).

Rules:
- Only token names from DESIGN_SYSTEM.md
- Do not add colors that are not in tokens.css
- Do not touch components or pages

Show only the changed config section. Wait for approval.

---

## Step 4 – Theme + app accent

Read DESIGN_SYSTEM.md before starting.

Task:
- Theme toggle: `dark` class on `<html>`, `localStorage` key `"theme"`, fallback `prefers-color-scheme`, no flash
- Set `data-app` from the active app only when that app has a dedicated theme (none today; omit on Planner, shell, and Time report)

Do not hardcode colors. Show new/changed files only. Wait for approval.

---

## Step 5 – Panel family

Read DESIGN_SYSTEM.md and UI_PATTERNS.md.

Update Panel, PanelHeader, PanelToolbar, PanelSection, PanelContent:
- Color, radius, shadow classes only
- Compact density unchanged
- No structure/prop/logic changes
- No page files

Show diffs. Wait for approval.

---

## Step 6 – DataTable

Read DESIGN_SYSTEM.md and UI_PATTERNS.md section 6.

- Token-based colors only
- Allocation pills: status success/warning/danger/muted as specified
- Current week: `accent/primary-subtle` and `accent/primary`
- Sticky header uses `table/header` (`blue/100`), comfortable lists round the top corners (`radius/lg`)
- Sort lives in column headers (`sort` prop); the table does not reorder rows

Show the diff. Wait for approval.

---

## Step 7 – Remaining `src/components/ui/`

Audit remaining UI components. Replace hardcoded or retired colors with tokens. Skip files that already comply. List every changed file and show diffs. Wait for approval.

---

## Step 8 – Audit

Report violations, do not fix yet:
1. Hex/rgba outside `styles/tokens.css` (exception: DB user colors)
2. Inline styles that are not DB colors
3. Retired tokens (`brand.signal`, `bg-white`, `text-black`, `border-gray-*`, DM Mono)
4. Type sizes, radii, or shadows not in DESIGN_SYSTEM.md

Then fix one file at a time after review.

---

If the agent scopes too wide:

"Stop. Undo all changes from this session. I will restart this step with a narrower scope."
