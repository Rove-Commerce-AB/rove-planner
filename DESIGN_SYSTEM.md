# Rove – Design System (Contract)

Detta dokument är bindande för all UI-utveckling i projektet.

## Färger
- `brand.signal` (#FF6136) används ENDAST för:
  - Primära CTA-knappar
  - Kritiska highlights
- Accentfärger (`brand.lilac`, `brand.blue`) används endast som:
  - Subtila bakgrunder
  - Sektioner, kort, badges
- Neutrala färger är default.

❌ Hårdkodade hex-färger är förbjudna utanför `styles/tokens.css` och `src/lib/constants.ts`.

## Typografi
- Primär font: **GTF Ekstra**
- Sekundär font: **Instrument Sans**
- Brödtext och UI-text använder primär font.
- Sekundär font får användas för metadata, labels eller visuella variationer.

## Komponentpolicy
- Alla UI-komponenter ska ligga i `src/components/ui/`
- Återanvänd alltid existerande komponenter
- Om ny komponent behövs:
  1. Skapa i `components/ui`
  2. Följ tokens och färgregler
  3. Undvik inline-styling (undantag nedan)

## Förbjudet
- Inline styles (undantag: användardefinierade färger)
- Nya färger
- Ad hoc CSS i sidor
- Kopiera design direkt i JSX

## Tillåtet
- Tailwind-klasser baserade på tokens
- Små justeringar i tokens vid behov (dokumentera ändringen)
- Inline styles för användardefinierade färger (t.ex. kundfärg, projektfärg) – färgen kommer från databasen

