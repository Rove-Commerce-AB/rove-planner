# UI Patterns (Contract)
This document is binding. If it conflicts with other docs, DESIGN_SYSTEM.md wins.

---

## 1) Overview list page (mandatory structure)

```
Panel
  PanelHeader     (title, optional subtitle/metrics, right-aligned CTA)
  PanelToolbar    (left: search + filters, right: primary CTA)
  PanelContent
    DataTable
    optional: Pagination (rare – prefer scroll)
```

If grouping is needed (e.g. Internal / External):
- Use `PanelSection` per group with a section header + its own DataTable.

### Do
- Keep search inside PanelToolbar, never floating above the panel.
- One primary CTA in `brand.signal`.
- Secondary controls use ghost or secondary variant.

### Don't
- Do not place inputs or controls outside the panel.
- Do not create multiple different table styles across pages.

---

## 2) DataTable (required component)

All tables must use `DataTable` from `src/components/ui/`.
No raw `<table>` markup in pages or features.

### Required props
| Prop          | Type                                  | Notes                                  |
|---------------|---------------------------------------|----------------------------------------|
| `columns`     | column config array                   | header, alignment, cell renderer       |
| `rows`        | typed array                           | fully prepared – no logic in the table |
| `getRowId`    | `(row) => string`                     |                                        |
| `rowHref`     | `(row) => string` (optional)          | use OR onRowClick, not both            |
| `onRowClick`  | `(row) => void` (optional)            | use OR rowHref, not both               |
| `emptyState`  | `{ title, description, action }`      |                                        |
| `loading`     | boolean                               | shows skeleton rows                    |
| `density`     | `"compact"` \| `"comfortable"`        | default: `"compact"`                   |
| `stickyHeader`| boolean                               | default: `true` inside panel           |

### DataTable is "dumb"
- No business logic
- No calculations
- No Supabase calls
- Receives fully prepared data only

### Visual behavior
- Sticky header
- Subtle row dividers (token-based, not heavy gridlines)
- Row hover (subtle background shift)
- Focus-visible state on rows
- Actions column: fixed width, right-aligned, icon buttons only

### Table typography
- Header: secondary font, `text-xs`, slightly elevated background
- Primary cell (name/title): primary font, `text-sm`
- Secondary cell text: `text-xs` or `text-sm`, `--color-text-secondary`, secondary font allowed

---

## 3) States (required for all tables and list views)

| State   | Implementation                                              |
|---------|-------------------------------------------------------------|
| Loading | Skeleton rows (not a spinner in the corner)                 |
| Empty   | `EmptyState` component inside the panel, with CTA          |
| Error   | Inline Callout/Alert inside the panel (not toast-only)      |

---

## 4) Row interaction (choose one per table, be consistent)

**Option A (preferred):** Whole row navigates to detail. Optional icon-button actions on the right.
**Option B:** Explicit actions column only. Row itself is not clickable.

Do not mix unclear click targets. If a row has clickable sub-elements, use Option B.

---

## 5) Empty state copy pattern

```
Title:       What is missing (noun phrase)
Description: Why it matters or what to do next (one sentence)
CTA:         brand.signal button ("Add [thing]")
```

Example:
- Title: "No consultants yet"
- Description: "Add your first consultant to start planning allocations."
- CTA: "Add consultant"

---

## 6) Allocation / planning table (special case)

The allocation grid (week columns × consultant rows) is a specialized DataTable variant.
It follows all DataTable rules plus:

- **Week columns**: fixed minimum width, center-aligned values.
- **Current week column**: visually highlighted using `--color-accent-dim` background. Header cell uses accent color text and a bottom border in `--color-accent`.
- **Month group headers**: span multiple week columns, separated by a visible column divider using `--color-border-strong`.
- **Allocation pills**: small rounded cells (not raw text). Color-coded:
  - 100%: `--color-status-ok` text on `--color-status-ok-bg`
  - >100%: `--color-status-over` text on `--color-status-over-bg`
  - 75–99%: `--color-status-warn` text on `--color-status-warn-bg`
  - <75%: `--color-text-muted` on subtle neutral background
  - Empty: transparent, no text
- **Consultant name column**: sticky left. Contains avatar (initials circle) + name + team (secondary text).
- **Sticky header**: both the month row and the week-number row must be sticky.
- **Summary row** (week total / revenue total): uses `--color-bg-elevated` background, secondary font, monospace numbers.

---

## 7) Consultant list (example composition)

### Columns
| Column           | Style                                           |
|------------------|-------------------------------------------------|
| Name             | Avatar (initials) + name (primary) + team (secondary) |
| Role             | Single line, primary text                       |
| Email            | Secondary style                                 |
| Calendar         | Secondary style                                 |
| Week allocation  | Compact badge or progress indicator             |
| Projects         | Secondary style, truncated with tooltip         |
| Actions          | Icon button (edit), fixed-width column          |

### Interaction
Prefer Option A: row navigates to detail, icon button for edit.

---

## 8) Density defaults (mandatory)

- **Compact is the default** for all dashboard and overview pages.
- Follow the compact spacing rules in DESIGN_SYSTEM.md exactly.
- Do not increase row height, toolbar padding, or panel padding on overview pages.
- **Comfortable density** is opt-in only, for text-heavy views where readability outweighs density.
