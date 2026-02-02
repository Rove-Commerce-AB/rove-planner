# UI Patterns (Contract)
This document is binding. If it conflicts with other docs, DESIGN_SYSTEM.md wins.

## 1) Overview list page (mandatory structure)

### Structure
- `Panel`
  - `PanelHeader` (title, subtitle, right-aligned primary action)
  - `PanelToolbar` (left: search/filters, right: CTA)
  - `PanelContent`
    - `DataTable`
    - optional: `Pagination` (rare), otherwise scroll
- If you need grouping (e.g. Internal/External):
  - Use `PanelSection` per group with section header + its table.

### Do
- Keep search inside PanelToolbar (not above the panel).
- Prefer one primary CTA in brand.signal.
- Use secondary controls as ghost/secondary.

### Don’t
- Do not place a search input floating outside the panel.
- Do not create multiple different table styles across pages.

---

## 2) DataTable (required component)
All tables must use `DataTable`. No raw table markup in pages/features.

### Required API (recommendation)
- `columns`: configuration describing header, alignment, and cell renderer
- `rows`: array of typed rows
- `getRowId(row)`
- Optional `rowHref(row)` OR `onRowClick(row)` (choose one pattern per table)
- `emptyState`: config (title, description, action)
- `loading`: boolean (shows skeleton)
- `density`: "compact" | "comfortable" (default "compact")
- `stickyHeader`: boolean (default true inside panel)

### Visual behavior
- Sticky header
- Subtle dividers
- Hover and focus-visible
- Actions column is fixed width (icons)

### Table typography rules
- Header: secondary font, smaller, slightly higher contrast than body background.
- Primary cell: name/title (primary font)
- Secondary cell text: smaller, lower contrast, secondary font allowed.

---

## 3) Consultant list (example composition)
### Columns
- Name: avatar + name (primary) + optional meta (team)
- Role: single line
- Email: secondary style
- Calendar: secondary style
- Week allocation: compact status (badge/progress)
- Projects: secondary style, truncated with tooltip if needed
- Actions: icon button (edit)

### Interaction choice
Prefer: row navigates to detail, actions for edit. Do not add both "row click" and many clickable items inside the row unless clearly styled.

---

## 4) Density defaults
- Default to "compact" on dashboards.
- Use "comfortable" only for text-heavy tables.

---

## 5) Empty state copy
- Title: what’s missing
- Description: why it matters / what to do
- CTA: brand.signal button

Example:
- Title: "No consultants yet"
- Description: "Add your first consultant to start planning allocations."
- CTA: "Add consultant"
