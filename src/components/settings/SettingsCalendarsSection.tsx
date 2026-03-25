"use client";

import { Plus } from "lucide-react";
import type { getCalendarsWithHolidayCount } from "@/lib/calendarsClient";
import { IconButton, Panel, PanelSectionTitle } from "@/components/ui";
import { CalendarAccordionItem } from "@/components/CalendarAccordionItem";

type Calendars = Awaited<ReturnType<typeof getCalendarsWithHolidayCount>>;

export function SettingsCalendarsSection({
  calendars,
  onRefresh,
  onAddClick,
}: {
  calendars: Calendars;
  onRefresh: () => void;
  onAddClick: () => void;
}) {
  return (
    <Panel>
      <PanelSectionTitle
        action={
          <IconButton
            aria-label="Add calendar"
            onClick={onAddClick}
            className="text-text-muted hover:text-text-primary"
          >
            <Plus className="h-4 w-4" />
          </IconButton>
        }
      >
        CALENDARS
      </PanelSectionTitle>
      <div className="overflow-x-auto p-3 pt-0">
        <div className="space-y-0.5">
          {calendars.map((calendar) => (
            <CalendarAccordionItem
              key={calendar.id}
              calendar={calendar}
              onDelete={onRefresh}
              onUpdate={onRefresh}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}
