# AI UI Checklist (Cursor Contract)

Mandatory workflow for any UI change.

## Step 0 — Read contracts
Before editing any UI:
- Read DESIGN_SYSTEM.md (tokens, type, radius, shadows, app accents)
- Read UI_PATTERNS.md
- Identify which pattern applies (List Page, Detail Page, Form Modal, etc.)
- Identify which accent applies (`data-app`: none, `planner`, `work`, `future`)

## Step 1 — Propose structure (NO CODE)
Write a short plan:
- Which components in src/components/ui will be used/created
- What the page hierarchy will look like
- Which interaction model is chosen (row-click vs actions-only)
- Which semantic tokens will be used (no primitives in components)
If any rule is violated by current code, list violations.

## Step 2 — Minimal refactor
If the current UI violates contracts:
- Refactor first (minimal changes)
- Do not add features during refactor

## Step 3 — Implement
Only after Step 1–2:
- Implement using the agreed components
- No inline styles (exception: DB user colors)
- No hex, rgba, or new colors — only tokens from DESIGN_SYSTEM.md
- No type sizes, radii, or shadows outside the documented scale
- Keep table dumb (prepared data)
- English UI copy; product name is Rove Apps

## Step 4 — Final validation checklist
Confirm:
- English UI copy
- Uses DataTable component where there is a table
- Has loading/empty/error states
- List pages: `PageHeader` on the canvas, `SegmentedControl` + `DataTable` (no Panel frame)
- Overview tables: Figma sage `table/header` (`#c4d7c1`), white body, rounded top corners, sort in column headers, `border/default` row dividers
- Segmented control (`SegmentedControl`): selected `interactive/primary`, default `interactive/secondary-hover`
- No heavy gridlines, has hover/focus states
- Comfortable density on overview lists; compact only on operational grids
- Colors/type/radius/shadow only from DESIGN_SYSTEM.md
- Retired tokens unused (`brand.signal`, old gray ramps, DM Mono)
