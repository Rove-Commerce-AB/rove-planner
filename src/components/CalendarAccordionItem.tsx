"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus } from "lucide-react";
import { updateCalendar, deleteCalendar } from "@/lib/calendars";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, ConfirmModal } from "@/components/ui";
import {
  getCalendarHolidays,
  createCalendarHoliday,
  deleteCalendarHoliday,
} from "@/lib/calendarHolidays";

type CalendarWithCount = {
  id: string;
  name: string;
  country_code: string;
  hours_per_week: number;
  holiday_count: number;
};

type Props = {
  calendar: CalendarWithCount;
  onDelete: () => void;
  onUpdate: () => void;
};

function formatHolidayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  });
}

export function CalendarAccordionItem({
  calendar,
  onDelete,
  onUpdate,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [hoursPerWeek, setHoursPerWeek] = useState(
    String(calendar.hours_per_week)
  );
  const [holidays, setHolidays] = useState<
    { id: string; holiday_date: string; name: string }[]
  >([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setHoursPerWeek(String(calendar.hours_per_week));
  }, [calendar.hours_per_week]);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (expanded) {
      getCalendarHolidays(calendar.id)
        .then((h) =>
          setHolidays(
            h
              .filter((x) => x.holiday_date.startsWith(String(currentYear)))
              .map((x) => ({
                id: x.id,
                holiday_date: x.holiday_date,
                name: x.name,
              }))
          )
        )
        .catch(() => setHolidays([]));
    }
  }, [expanded, calendar.id, currentYear]);

  const handleSaveHours = async () => {
    const hours = parseFloat(hoursPerWeek.replace(",", "."));
    if (isNaN(hours) || hours <= 0) {
      setError("Hours must be a positive number");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateCalendar(calendar.id, { hours_per_week: hours });
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHolidayDate.trim() || !newHolidayName.trim()) {
      setError("Date and name are required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await createCalendarHoliday(
        calendar.id,
        newHolidayDate.trim(),
        newHolidayName.trim()
      );
      setHolidays((prev) => {
        const next =
          created.holiday_date.startsWith(String(currentYear))
            ? [...prev, created]
            : prev;
        return next.sort((a, b) =>
          a.holiday_date.localeCompare(b.holiday_date)
        );
      });
      setNewHolidayDate("");
      setNewHolidayName("");
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveHoliday = async (id: string) => {
    setError(null);
    try {
      await deleteCalendarHoliday(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove holiday");
    }
  };

  const handleDeleteCalendar = async () => {
    setError(null);
    try {
      await deleteCalendar(calendar.id);
      setShowDeleteConfirm(false);
      onDelete();
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete calendar");
    }
  };

  return (
    <>
    <Accordion
      type="single"
      collapsible
      value={expanded ? calendar.id : ""}
      onValueChange={(v) => setExpanded(v === calendar.id)}
    >
      <AccordionItem value={calendar.id}>
        <AccordionTrigger>
          <div className="flex items-center gap-3">
            <span className="font-medium text-text-primary">
              {calendar.name} ({calendar.country_code})
            </span>
            <span className="text-sm text-text-primary opacity-60">
              {calendar.hours_per_week}h/week
            </span>
            <span className="text-sm text-text-primary opacity-60">
              {calendar.holiday_count} holiday
              {calendar.holiday_count !== 1 ? "s" : ""}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-4">
          {error && (
            <p className="mb-4 text-sm text-danger">{error}</p>
          )}

          <div className="mb-4">
            <label
              htmlFor={`hours-${calendar.id}`}
              className="block text-sm font-medium text-text-primary"
            >
              Hours per week
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={`hours-${calendar.id}`}
                type="text"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                onBlur={handleSaveHours}
                className="w-24 rounded-lg border border-border px-3 py-2 text-text-primary focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
              <button
                type="button"
                onClick={handleSaveHours}
                disabled={saving}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-muted disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>

          <h4 className="mb-2 text-sm font-medium text-text-primary">Holidays</h4>
          <div className="mb-4 max-h-48 overflow-y-auto rounded border border-border">
            {holidays.length === 0 ? (
              <p className="p-4 text-sm text-text-primary opacity-60">No holidays</p>
            ) : (
              <ul className="divide-y divide-border">
                {holidays.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-4 px-4 py-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4 text-left">
                      <span className="w-24 shrink-0 text-sm text-text-primary">
                        {formatHolidayDate(h.holiday_date)}
                      </span>
                      <span className="text-sm text-text-primary">
                        {h.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveHoliday(h.id)}
                      className="rounded p-1 text-text-primary opacity-60 hover:bg-danger/10 hover:text-danger"
                      aria-label={`Remove ${h.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div>
              <label
                htmlFor={`holiday-date-${calendar.id}`}
                className="block text-xs font-medium text-text-primary opacity-70"
              >
                Date
              </label>
              <input
                id={`holiday-date-${calendar.id}`}
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="mt-1 rounded border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor={`holiday-name-${calendar.id}`}
                className="block text-xs font-medium text-text-primary opacity-70"
              >
                Name
              </label>
              <input
                id={`holiday-name-${calendar.id}`}
                type="text"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                placeholder="e.g. Midsummer"
                className="mt-1 rounded border border-border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleAddHoliday}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-signal px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Trash2 className="h-4 w-4" />
            Delete calendar
          </button>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete calendar"
        message={`Delete ${calendar.name} (${calendar.country_code})?`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteCalendar}
      />
    </>
  );
}
