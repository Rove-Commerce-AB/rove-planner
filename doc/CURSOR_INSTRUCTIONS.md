# Cursor-instruktioner: implementera mörkt tema

Följ stegen i ordning. Vänta på godkännande mellan varje steg.

---

## Steg 1 – Uppdatera styrdokumenten

Ersätt de befintliga filerna med de uppdaterade versionerna:
- `DESIGN_SYSTEM.md`
- `UI_PATTERNS.md`

Committa dem separat: `docs: update design system with dark theme token contract`

---

## Steg 2 – Prompt till Cursor: tokens.css

Använd denna prompt exakt:

---

Read DESIGN_SYSTEM.md carefully before starting.

Task: add dark mode token values to `styles/tokens.css`.

Rules:
- Do NOT change any existing light mode values.
- Add a `.dark { }` block with overrides for all tokens
  listed in the "Dark theme token values" table in
  DESIGN_SYSTEM.md.
- brand.signal (#FF6136) must NOT appear in the dark block.
  It does not change between modes.
- Do not touch any file other than `styles/tokens.css`.
- Do not change any component, page, or config file.

Show me the complete updated tokens.css when done.
I will approve before you continue.

---

Granska outputen. Kontrollera:
- [ ] Ingen hex-färg utanför tokens.css
- [ ] brand.signal saknas i .dark-blocket (det ska inte vara där)
- [ ] Alla tokens från tabellen finns med
- [ ] Inga andra filer har rörts

---

## Steg 3 – Prompt till Cursor: Tailwind-config

---

Read DESIGN_SYSTEM.md before starting.

Task: register the new dark-mode tokens in `tailwind.config`
so they are accessible as Tailwind utility classes.

Rules:
- Only update `tailwind.config`.
- Map the CSS variables from tokens.css to Tailwind color names.
- Do not add any colors that are not already in tokens.css.
- Do not touch any component or page file.

Show me only the changed section of tailwind.config.
I will approve before you continue.

---

## Steg 4 – Prompt till Cursor: dark mode toggle

---

Read DESIGN_SYSTEM.md before starting.

Task: implement dark mode toggling via a `dark` class
on the `<html>` element.

Rules:
- Add a `ThemeProvider` or equivalent that:
  1. Reads the user's saved preference from localStorage
     (key: "theme", values: "light" | "dark")
  2. Falls back to `prefers-color-scheme` if no saved value
  3. Applies the `dark` class to `<html>` immediately on load
     (before paint, to avoid flash)
  4. Exposes a `useTheme()` hook or context for toggling
- Add a toggle button component in `src/components/ui/ThemeToggle.tsx`
- Do not hardcode any colors in these files.
- Do not change any page layout or existing component.

Show me the new files only. I will approve before you continue.

---

## Steg 5 – Prompt till Cursor: Panel-komponenten

---

Read DESIGN_SYSTEM.md and UI_PATTERNS.md before starting.

Task: update the Panel component family so it respects
the dark mode tokens.

Components to update (in src/components/ui/):
- Panel
- PanelHeader
- PanelToolbar
- PanelSection
- PanelContent

Rules:
- Only change Tailwind class names that reference color tokens.
- Do NOT change component structure, props, or logic.
- Do NOT change spacing or density (compact stays compact).
- All colors must come from Tailwind token classes,
  not inline styles or hardcoded values.
- Do not touch any page or feature file.

Show me the diff for each file. I will approve before you continue.

---

## Steg 6 – Prompt till Cursor: DataTable-komponenten

---

Read DESIGN_SYSTEM.md and UI_PATTERNS.md before starting.

Task: update DataTable (src/components/ui/DataTable.tsx)
so it respects dark mode tokens.

Rules:
- Only change color-related Tailwind classes.
- Allocation pills must follow the color rules in
  UI_PATTERNS.md section 6 (status ok/warn/over/muted).
- Current week column highlight: use --color-accent-dim bg.
- Sticky header background must update in dark mode.
- Do NOT change component API, props, logic, or structure.
- Do NOT change density or row height.
- Do not touch any page or feature file.

Show me the diff. I will approve before you continue.

---

## Steg 7 – Prompt till Cursor: övriga UI-komponenter

---

Read DESIGN_SYSTEM.md before starting.

Task: audit all remaining components in src/components/ui/
and update any that have hardcoded colors or light-only
Tailwind classes.

For each component:
- Replace hardcoded colors with token-based Tailwind classes.
- Do NOT change structure, props, or logic.
- Skip components that already use only token-based classes.

List every file you change and show the diff.
I will approve before you continue.

---

## Steg 8 – Prompt till Cursor: slutkontroll

---

Audit the entire codebase for dark mode compliance.
Check:
1. Any hardcoded hex values outside styles/tokens.css
   (exception: brand.signal in CTA buttons is allowed
   since it does not change between modes)
2. Any inline styles that are not user-defined DB colors
3. Any component that uses bg-white, text-black,
   border-gray-* or similar non-token Tailwind classes
   that will break in dark mode

Report every violation with file + line number.
Do not fix anything yet. I will review the list first.

---

När du fått listan: fixa en fil i taget och granska resultatet
innan du fortsätter till nästa.

---

## Om Cursor börjar göra för mycket

Avbryt och använd:

"Stop. Undo all changes from this session.
I will restart this step with a narrower scope."

---

## Commit-ordning

1. `docs: update design system with dark theme token contract`
2. `style: add dark mode tokens to tokens.css`
3. `style: register dark tokens in tailwind.config`
4. `feat: add ThemeProvider and ThemeToggle`
5. `style: update Panel components for dark mode`
6. `style: update DataTable for dark mode`
7. `style: update remaining ui components for dark mode`
8. `fix: resolve dark mode audit violations`
