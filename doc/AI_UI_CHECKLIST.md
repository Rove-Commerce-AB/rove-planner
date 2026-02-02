# AI UI Checklist (Cursor Contract)
Mandatory workflow for any UI change.

## Step 0 — Read contracts
Before editing any UI:
- Read DESIGN_SYSTEM.md
- Read UI_PATTERNS.md
- Identify which pattern applies (List Page, Detail Page, Form Modal, etc.)

## Step 1 — Propose structure (NO CODE)
Write a short plan:
- Which components in src/components/ui will be used/created
- What the page hierarchy will look like
- Which interaction model is chosen (row-click vs actions-only)
If any rule is violated by current code, list violations.

## Step 2 — Minimal refactor
If the current UI violates contracts:
- Refactor first (minimal changes)
- Do not add features during refactor

## Step 3 — Implement
Only after Step 1–2:
- Implement using the agreed components
- No inline styles
- No new colors
- Keep table dumb (prepared data)

## Step 4 — Final validation checklist
Confirm:
- English UI copy
- Uses Panel system
- Uses DataTable component
- Has loading/empty/error states
- No heavy gridlines, has hover/focus states
- Consistent density and alignment
