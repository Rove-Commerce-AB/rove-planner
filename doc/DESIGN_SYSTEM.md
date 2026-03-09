# Rove – Design System (Contract)
This document is the highest-priority binding contract for all UI development.

> Priority order:
> 1. DESIGN_SYSTEM.md (this file – always wins)
> 2. UI_PATTERNS.md (binding patterns and composition rules)
> 3. Components in `src/components/ui/` (source of truth for implementation)

---

## Language
- All user-facing UI text must be **English** (titles, buttons, placeholders, labels).
- Swedish is allowed only in internal comments or commit messages.

---

## Theming

### How theming works
- All colors are defined as CSS custom properties (variables) in `styles/tokens.css`.
- Dark mode is applied by adding the class `dark` to the `<html>` element.
- Light mode is the default (no class needed).
- Tailwind reads color tokens via `tailwind.config` – never hardcode hex in components.
- `prefers-color-scheme` may be used to set the initial value, but the class always wins.

### Token structure in tokens.css
Tokens are defined in two blocks:

```css
:root {
  /* light mode values */
}

.dark {
  /* dark mode overrides – same variable names, different values */
}
```

Only `tokens.css` may define or change color values.
No other file may introduce new color values.

### Dark theme token values (reference)
Use these exact values when implementing dark mode:

| Token                    | Dark value                   |
|--------------------------|------------------------------|
| --color-bg-default       | #0f1117                      |
| --color-bg-muted         | #171b26                      |
| --color-bg-elevated      | #1e2333                      |
| --color-bg-subtle        | #252b3b                      |
| --color-border-default   | rgba(255,255,255,0.07)        |
| --color-border-strong    | rgba(255,255,255,0.13)        |
| --color-text-default     | #e8eaf0                      |
| --color-text-secondary   | #9ca3af                      |
| --color-text-muted       | #6b7280                      |
| --color-status-ok        | #10b981                      |
| --color-status-ok-bg     | rgba(16,185,129,0.12)         |
| --color-status-warn      | #f59e0b                      |
| --color-status-warn-bg   | rgba(245,158,11,0.12)         |
| --color-status-over      | #ef4444                       |
| --color-status-over-bg   | rgba(239,68,68,0.13)          |
| --color-accent           | #6366f1                      |
| --color-accent-dim       | rgba(99,102,241,0.15)         |

`brand.signal` (#FF6136) is **not** affected by theming – it stays identical in both modes.

---

## Colors

### brand.signal (#FF6136)
Used ONLY for:
- Primary CTA buttons
- Critical highlights

This color does not change between light and dark mode.

### Accent colors (brand.lilac, brand.blue, --color-accent)
Used only for:
- Subtle backgrounds
- Sections, cards, badges
- Active/selected states in navigation

### Neutral colors
Default for all text, borders, and backgrounds.
Always reference via tokens – never hardcode.

### Hard rule
❌ Hardcoded hex values are forbidden everywhere except `styles/tokens.css`.
❌ Do not introduce new colors not listed in this document.

---

## Typography

### Fonts
- **Primary font: GTF Ekstra** – already imported in the project. Do not re-import or change the import.
- **Secondary font: Instrument Sans** – already imported. Do not re-import or change the import.
- If a font is unavailable, fall back to `system-ui` – never substitute another web font.

### Usage
- Primary font: body text, UI labels, button text.
- Secondary font: metadata, table headers, helper text.

### Compact typography scale
| Use                        | Size      | Weight   | Font      |
|----------------------------|-----------|----------|-----------|
| Default body / UI text     | text-sm   | normal   | Primary   |
| Section titles             | text-sm   | medium   | Primary   |
| Table body                 | text-sm   | normal   | Primary   |
| Table headers              | text-xs   | medium   | Secondary |
| Metadata / helper / labels | text-xs   | normal   | Secondary |
| Numbers / monospace values | text-sm   | normal   | DM Mono   |

Secondary text must always be visually de-emphasized (use `--color-text-secondary` or `--color-text-muted`).

---

## Density (mandatory)

Rove defaults to **compact dashboard density**.
This is never overridden globally – comfortable density is opt-in per view only.

### Compact spacing rules
| Element                          | Value       |
|----------------------------------|-------------|
| Panel content padding            | 8px         |
| PanelHeader padding              | 6px 12px    |
| PanelToolbar / SectionTitle      | 4px 12px    |
| PanelSection padding             | 6px 12px    |
| Gap between major sections       | 12px        |
| Gap between fields in a section  | 4–8px       |
| Label-to-value spacing           | 4px         |
| Default table row density        | compact     |

Comfortable density is opt-in only for text-heavy views.
Do not increase padding or row height on overview/dashboard pages.

---

## Border radius

Use Tailwind tokens only: `rounded`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-panel`, `rounded-full`.
- `rounded-panel` = outer container radius for dashboard views.
- Tables inside a panel use square corners (the panel provides radius).

### Form element borders
- All form controls (inputs, selects, secondary/outline buttons) use **`border-form`** (`--color-border-form`) so borders stay light and consistent.
- Do not use harsher borders on form elements.

### Form element recognition (accessibility & logic)
- **Input**: Use `label`, `id`, and `error` when in a form; the component wires `aria-invalid` and `aria-describedby` to the error message when `error` and `id` are set.
- **Select**: Same as Input: optional `label`, `id`, `error`; `aria-invalid` and `aria-describedby` are set when `error` is present.
- **Switch**: Use `label` and `id` so the label is associated with the control.
- Always provide a visible label (or `aria-label`) for every form field so the purpose is clear.

---

## Panel & dashboard layout (mandatory)

All overview and detail views must use the Panel system.

- **Main content area** (right): `--color-bg-default`
- **Sidebar** (left): `--color-bg-muted`
- **Panel**: uses `--panel-bg`, `--panel-border`, `--radius-panel`. Panel background must differ from main content background.
- Panels are lightweight sections. Hierarchy comes from spacing and typography – not heavy borders or excessive padding.
- **Borders**: use `--color-border-default` (soft, low contrast). Never black or high-contrast borders.
- **PanelHeader**: title + optional subtitle/metrics + primary action (right-aligned).
- **PanelToolbar**: filters/search (left) + primary CTA (right). Always inside the panel.
- **PanelSection**: sections separated by `border-t` using `--section-divider`.

No standalone controls floating outside the panel.

---

## Component policy

- All reusable UI components live in `src/components/ui/`.
- Always reuse existing components before creating new ones.
- If a new component is needed:
  1. Create it in `src/components/ui/`
  2. Follow all tokens and color rules
  3. No inline styles (exception: user-defined colors from DB)
  4. Must be generic – not feature-specific

---

## Forbidden (hard rules)

- ❌ Inline styles (exception: user-defined colors from DB, e.g. customer/project color)
- ❌ Hardcoded hex values outside `styles/tokens.css`
- ❌ New colors not defined in this document
- ❌ Ad hoc CSS written directly in pages or feature files
- ❌ Raw `<table>` markup in pages or features (use DataTable)
- ❌ Copying layout/design directly into JSX without going through components
- ❌ Changing font imports or substituting fonts

---

## Allowed

- Tailwind utility classes that reference design tokens
- Small token value adjustments when needed (document the change as a comment in tokens.css)
- Inline styles **only** for user-defined colors from the database
