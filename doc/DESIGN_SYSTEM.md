# Rove – Design System (Contract)
Detta dokument är bindande för all UI-utveckling i projektet.

> Priority order:
> 1) DESIGN_SYSTEM.md (this doc)
> 2) UI_PATTERNS.md (bindande patterns + exempel)
> 3) Components in src/components/ui (source of truth for implementation)

---

## Language
- All user-facing UI text must be English (titles, buttons, placeholders, labels).
- Swedish is allowed only in internal comments or commit messages.

---

## Colors
- `brand.signal` (#FF6136) används ENDAST för:
  - Primära CTA-knappar
  - Kritiska highlights
- Accentfärger (`brand.lilac`, `brand.blue`) används endast som:
  - Subtila bakgrunder
  - Sektioner, kort, badges
- Neutrala färger är default.

❌ Hårdkodade hex-färger är förbjudna utanför `styles/tokens.css` och `src/lib/constants.ts`.

---

## Typography
- Primary font: **GTF Ekstra**
- Secondary font: **Instrument Sans**
- Primary is used for body + UI text.
- Secondary may be used for metadata (labels, table header text, helper text).

Rules:
- Table headers use secondary font + smaller size than body.
- Secondary text in cells must be visually de-emphasized (lower contrast token).

---

## Component policy
- All reusable UI components live in `src/components/ui/`.
- Always reuse existing components.
- If a new UI component is needed:
  1) Create in `src/components/ui/`
  2) Follow tokens and color rules
  3) Avoid inline styles (exception below)
  4) Must be generic (not feature-specific)

---

## Forbidden
- Inline styles (exception: user-defined colors from DB)
- New colors
- Ad hoc CSS in pages
- Copying design directly in JSX
- Building raw tables in pages/features

---

## Radius (border radius)
- Use design tokens via Tailwind classes: `rounded`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-panel`, `rounded-full`.
- `rounded-panel` defines the outer container radius for dashboard-like views.
- Tables inside a panel generally keep square corners; the panel provides the radius.

---

## Panel & dashboard layout (mandatory)
All overview/detail views must use the Panel system:
- **Main content area** (right): white (`--color-bg-default`). **Sidebar** (left): keeps its own background (`--color-bg-muted`).
- **Panel**: a single container with `--panel-bg` (slightly gray, e.g. `--color-gray-100`) so panels stand out from the white content area; `--panel-border`, `--radius-panel`. Panel background must differ from main content background.
- **Borders**: use `--color-border-default` (soft gray, low contrast – never black or harsh).
- **PanelHeader**: title + optional subtitle/metrics + primary action area.
- **PanelToolbar**: search/filter controls (left) + primary CTA (right). Toolbar is inside the panel.
- **PanelSection**: sections separated via `border-t` (`--section-divider`).

No standalone controls floating outside the panel.

---

## Tables & list views (mandatory)
### Hard rules
- ❗ Tables must be rendered using `DataTable` from `src/components/ui/` (no raw `<table>` in pages/features).
- List pages must follow the pattern: `PageHeader` (optional) + `Panel` + `PanelHeader` + `PanelToolbar` + `DataTable`.
- A table must be "dumb": it receives fully prepared data (no business logic, no calculations, no Supabase calls).

### Visual rules
- Avoid heavy gridlines. Use subtle row dividers (token-based).
- Always provide row hover (subtle) and focus-visible states.
- Table header must be sticky when content scrolls within a panel.
- Use consistent alignment:
  - Primary identity column (e.g. name) left-aligned.
  - Numeric/time columns right-aligned.
  - Actions column fixed width, aligned right.

### Density & spacing
- Default density is "dashboard compact":
  - tighter row height
  - consistent cell padding
  - secondary text smaller and lower-contrast

### States (required)
- Loading: skeleton rows (not a spinner in the corner).
- Empty: `EmptyState` component inside the panel with a clear CTA.
- Error: inline Callout/Alert inside the panel (not a toast-only error).

### Interaction (choose one and be consistent)
- Either:
  A) Whole row navigates to detail (preferred), actions optional, OR
  B) Explicit actions column, row is not clickable.
- Do not mix unclear click targets.

---

## Allowed
- Tailwind classes based on tokens
- Small token adjustments if needed (document the change)
- Inline styles ONLY for user-defined colors coming from the DB (e.g. customer/project color)
