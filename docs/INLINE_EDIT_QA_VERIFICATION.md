# QA-verifiering: Inline-edit UX

Verifiering genomförd genom kodgenomgång (inga manuella körningar). Alla påståenden baserade på faktisk kod.

---

## 1. Verifieringsmatris

| Vy/sida | Fälttyp | Editor-typ | Gemensam standard? | Layout shift display/edit? | Textposition ändras? | Hover affordance? | Enter | Escape | Blur save | Save only if changed? | saving/saved/error? | Kommentar |
|---------|---------|-------------|--------------------|----------------------------|----------------------|-------------------|-------|--------|-----------|------------------------|---------------------|-----------|
| **Customer detail** | Company name | text input | ja (Container) | nej | nej | ja (Pencil) | ja | ja | ja | ja | ja | — |
| Customer detail | Account Manager | native select | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Customer detail | Color | color + text input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Customer detail | Logo URL | url input | ja | nej | nej | ja | ja | ja (fixat under QA) | ja | ja | ja | Escape lades till under QA. |
| **Project detail** | Project name | text input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Project detail | Jira/DevOps project | Select | ja | nej | nej | ja | ej relevant (select) | ja (close) | ja | ja | ja | Select: val = commit. |
| Project detail | Budget (hours) | number input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Project detail | Budget (SEK) | number input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Project detail | Start date | date input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Project detail | End date | date input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Project detail | Probability | Select | ja | nej | nej | ja | ej relevant | ja | ja | ja | ja | — |
| **Consultant detail** | Name | text input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Consultant detail | Email | email input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Consultant detail | Default role | Select | ja | nej | nej | ja | ej relevant | ja | ja | ja | ja | — |
| Consultant detail | Team | Select | ja | nej | nej | ja | ej relevant | ja | ja | ja | ja | — |
| Consultant detail | Capacity | Select | ja | nej | nej | ja | ej relevant | ja | ja | ja | ja | — |
| Consultant detail | Overhead (%) | Select | ja | nej | nej | ja | ej relevant | ja | ja | ja | ja | — |
| Consultant detail | Start date | date input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Consultant detail | End date | date input | ja | nej | nej | ja | ja | ja | ja | ja | ja | — |
| Consultant detail | Calendar | Select | ja | nej | nej | ja | ej relevant | ja | ja | ja | ja | — |
| **Settings** | Roles (rad) | text input | nej (egen struktur) | nej | nej | ja (button hover) | ja | ja | ja | ja | ja | Listrad: stabil value+status-rad. |
| Settings | Teams (rad) | text input | nej | nej | nej | ja | ja | ja | ja | ja | ja | Samma mönster som roles. |
| Settings | Feature requests (rad) | textarea | nej | nej | nej | ja (Pencil-knapp) | ej relevant | ja | ja | ja | ja | Enter sparar inte (multiline). |
| **CustomerRatesTab** | Rate (SEK/h) per rad | number input | nej | — | — | nej | nej | nej | ja | ja (handleUpdateEdit) | nej | Hela listan i edit-läge; ingen per-rad display/edit-växling med trigger. |
| **ProjectRatesTab** | Rate (SEK/h) per rad | number input | nej | ej relevant | ej relevant | nej | nej | nej | ja | ja (handleUpdate) | nej | Input alltid synlig; ingen display-state. |
| **AllocationPageClient** | Timmar (cell) | number input | nej | ej verifierad | ej verifierad | nej | ja | ja | ja | ej verifierad | nej | Tabellcell; ingen InlineEditFieldContainer eller status-feedback. |

**Editor-typer som finns i appen:** text input, number input, textarea, native select, Radix Select, date input, color input (+ text), url input.  
**Combobox/searchable select:** finns ej i appen.  
**Datetime/date picker (icke-native):** endast `type="date"` används; ingen separat date-picker-komponent.

---

## 2. No-layout-shift (verifieringskriterier)

För **Customer, Project, Consultant detail** och **Settings (roles, teams, feature requests)**:

- **Label flyttar sig inte:** Label sitter ovanför containern; containern har fast struktur (värderad + statusrad) → ja, verifierat i kod.
- **Nästa rad/fält flyttar sig inte:** Samma containerhöjd (value row min-h + status row min-h) och alltid statusrad (tom eller innehåll) → ja.
- **Textens vertikala position:** Value row använder `items-center`; input/trigger delar samma `editInputClass` / `editTriggerClass` med samma min-h och padding → ja.
- **Textens horisontella position:** Ingen onödig ändring; samma padding (px-3 py-2) i trigger och input → ja.
- **Popup/dropdown:** Select använder Radix Portal; påverkar inte layouten → ja.
- **Save/saved/error-indikator:** Statusraden har fast min-h (1rem); idle = tom spacer med samma min-h → ja.

**Rates-tabbar och Allocation:** Använder inte den gemensamma containern; layout shift har inte verifierats systematiskt (rates: annorlunda mönster; allocation: cellredigering).

---

## 3. Avvikelser under verifieringen

| Avvikelse | Åtgärd |
|-----------|--------|
| Customer detail – Logo URL: Escape avbröt inte redigering (endast Enter hanterades i onKeyDown). | Escape-hantering tillagd: `cancelEdit()` vid Escape. |

---

## 4. Filer ändrade under QA-rundan

- `src/components/CustomerDetailClient.tsx` – Escape för Logo URL-fältet.
- `docs/INLINE_EDIT_QA_VERIFICATION.md` – ny fil (denna verifieringsrapport).

---

## 5. Kvarvarande undantag (specificerade)

1. **CustomerRatesTab**  
   - Använder inte InlineEditFieldContainer eller InlineEditTrigger.  
   - Mode "edit" visar inputs för alla rader; ingen per-rad display → edit med gemensam trigger.  
   - Ingen saving/saved/error-feedback per fält.  
   - Enter/Escape har inte verifierats (input onBlur sparar).

2. **ProjectRatesTab**  
   - Samma som ovan; input är alltid synlig (ingen display-state per rad).  
   - Ingen status-feedback.

3. **AllocationPageClient (tabellceller)**  
   - Inline-redigering av timmar i celler.  
   - Använder inte InlineEditFieldContainer eller InlineEditStatus.  
   - Har inte verifierats för layout shift eller "save only if changed".  
   - Enter/Blur används för att spara (kod finns); Escape har inte kontrollerats i denna QA.

---

## 6. Slutsats – faktisk standard för inline edit

**Gemensam standard i appen:**

- **Detail-sidor (Customer, Project, Consultant):**  
  - **InlineEditFieldContainer** (värderad med fast min-h + statusrad med fast min-h).  
  - **InlineEditTrigger** (display) med hover (Pencil).  
  - **editInputClass** / **editTriggerClass** för samma box (min-h, padding, leading).  
  - **InlineEditStatus** (saving/saved/error) under fältet.  
  - Beteende: Enter = spara, Escape = avbryt, blur = spara endast om värdet ändrats (`isInlineEditValueChanged`), med showSaved + timeout innan edit stängs.

- **Settings (listrader):**  
  - Samma princip utan komponenten: alltid value-rad + status-rad (min-h) per rad; Enter/Escape/blur; save only if changed; InlineEditStatus vid redigering.

- **Delad logik:**  
  - `isInlineEditValueChanged` (lib/inlineEdit.ts).  
  - `SAVED_DURATION_MS`, InlineEditStatus, stilar från `inlineEditStyles.ts`.

**Undantag (inte del av standarden):** CustomerRatesTab, ProjectRatesTab, AllocationPageClient cellredigering – andra mönster, ingen status-feedback, ej genomgångna för alla kriterier i denna matris.
