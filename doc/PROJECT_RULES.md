IMPORTANT:
This document defines mandatory rules for this project.
All AI-generated code must follow these rules.

Release notes (MANDATORY on code changes):
When you as AI make code changes in the project, you must also update the release notes. Add a new row at the top of the releaseNotes array in src/app/(app)/settings/release-notes/page.tsx. Date and time must be when you write the row (current time at that moment), format "YYYY-MM-DD HH:mm". The description should briefly state what was changed. Newest entry must be first in the array.

Rove Planner – Architecture & Development Guidelines

Detta dokument beskriver arkitekturprinciper, struktur och regler för utvecklingen av Rove Planner.
Syftet är att hålla koden enkel, konsekvent och lätt att vidareutveckla, även för icke-tekniska utvecklare med AI-stöd (Cursor).

1. Övergripande mål
Enkel att förstå
Låg komplexitet
Förutsägbar struktur
Skalbar till ~50 användare utan ombyggnad
AI-vänlig kodbas (Cursor, Copilot m.fl.)

2. Teknikstack
Frontend: Next.js (App Router)
UI: React + TypeScript
Styling: Tailwind CSS
Backend: Supabase
Databas: PostgreSQL (via Supabase)
Auth: Supabase Auth (senare)
Hosting: Vercel
Versionering: Git + GitHub

3. Arkitekturprinciper
3.1 Separation of concerns
UI-komponenter innehåller ingen affärslogik
Datakommunikation sker via lib/
Pages ansvarar för:
datahämtning
state
rendering

3.2 Server vs Client Components
Server Components (default):
listing
read-only vyer
Client Components ("use client"):
formulär
modaler
interaktivitet
Använd Client Components endast när det krävs.

3.3 Ingen affärslogik i UI
Ingen beräkning av beläggning i komponenter
Ingen SQL i pages
Ingen komplex logik i JSX

4. Mappstruktur (principer)
src/
  app/            → routing & pages
  components/     → återanvändbara UI-komponenter
  lib/            → datalager, clients, helpers
  types/          → TypeScript-typer

Regler:
Ingen “dump”-mapp
En fil = ett tydligt ansvar
Undvik djupa nästlade strukturer

5. Datamodell – grundprinciper
Kärnentiteter:
clients
projects (tillhör client)
consultants
allocations
roles
calendars
holidays

Relationer:
client → många projects
consultant → många allocations
allocation → exakt en consultant + ett project + en role
consultant → exakt en calendar

6. Databasprinciper (Supabase)
PostgreSQL är source of truth
Alla tabeller:
id (uuid)
created_at
updated_at
Soft deletes används vid behov (is_active)
Säkerhet
Row Level Security (RLS) aktiveras
Första versionen: single-tenant
Senare: org_id på alla tabeller

7. Dataåtkomst
Alla Supabase-anrop sker via lib/.
Exempel:
lib/clients.ts
lib/projects.ts
lib/allocations.ts
Pages får inte prata direkt med Supabase utanför lib.

8. UI-principer
Dashboard är read-only
CRUD sker via formulär och modaler
Tabellen är “dum” → får färdig data
Accordion & scroll prioriteras framför pagination

9. Allokering & tid
Allokering lagras per vecka
Vecka representeras som:
year
week
Veckointervall skapas via batch-insert
Historik raderas aldrig

10. Kodkonventioner
TypeScript överallt
Inga any
Namn:
tabeller: plural, snake_case
filer: camelCase
komponenter: PascalCase
Hellre tydlig kod än “smart” kod

11. AI-arbetsprincip (Cursor)
Små förändringar per prompt
En feature i taget
Be alltid om:
full fil
inte diff
Bekräfta efter varje större steg

12. Utvecklingsordning (rekommenderad)
Clients (CRUD)
Projects (kopplade till client)
Consultants
Roles
Calendars
Allocations
Dashboard aggregation
Auth & rättigheter

13. Medvetna förenklingar (MVP)
Ingen real-time sync
Ingen offline-support
Ingen avancerad rättighetsmodell
Ingen fakturering i v1

14. Princip att alltid följa
“Make it boring, predictable and easy to change.”

15. Språk
Hela sajten skall vara på engelska. Det är endast skärmdumparna som är på svenska, men dessa ska översättas. Även kod och all namnstandard ska vara engelska.
Använd "customer" och inte "client"