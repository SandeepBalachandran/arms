"use client";

import { useState } from "react";
import { HOURS_DAY_LABELS, HOURS_DAYS, SESSIONS, type OpeningHours, type SessionName } from "@gymos/shared";
import clsx from "clsx";

const DEFAULT_RANGE: Record<SessionName, [string, string]> = { morning: ["05:00", "10:00"], evening: ["16:00", "21:00"] };
const SESSION_LABELS: Record<SessionName, string> = { morning: "Morning", evening: "Evening" };

const timeInput =
  "w-[6.5rem] rounded-lg border border-border bg-surface px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand disabled:opacity-40";

// Week editor for opening hours: each day has an optional morning and evening
// session. Posts the whole week as JSON in `opening_hours`.
export function HoursEditor({ defaultValue }: { defaultValue: OpeningHours }) {
  const [hours, setHours] = useState(defaultValue);

  function setSession(day: keyof OpeningHours, session: SessionName, value: [string, string] | null) {
    setHours((h) => ({ ...h, [day]: { ...h[day], [session]: value } }));
  }
  function copyMonday(days: readonly (keyof OpeningHours)[]) {
    setHours((h) => ({ ...h, ...Object.fromEntries(days.map((d) => [d, { ...h.mon }])) }));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="opening_hours" value={JSON.stringify(hours)} />
      <div className="divide-y divide-border rounded-lg border border-border">
        {HOURS_DAYS.map((day) => {
          const closed = SESSIONS.every((s) => !hours[day][s]);
          return (
            <div key={day} className="grid gap-2 p-3 sm:grid-cols-[6rem_1fr] sm:items-center">
              <p className={clsx("text-sm font-medium", closed && "text-muted")}>
                {HOURS_DAY_LABELS[day]}
                {closed && <span className="ml-2 text-xs font-normal">Closed</span>}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {SESSIONS.map((session) => {
                  const range = hours[day][session];
                  return (
                    <div key={session} className="flex items-center gap-2">
                      <label className="flex w-20 items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={!!range}
                          onChange={(e) => setSession(day, session, e.target.checked ? DEFAULT_RANGE[session] : null)}
                          className="size-4 accent-brand"
                        />
                        {SESSION_LABELS[session]}
                      </label>
                      <input
                        type="time"
                        aria-label={`${HOURS_DAY_LABELS[day]} ${session} opens`}
                        value={range?.[0] ?? DEFAULT_RANGE[session][0]}
                        disabled={!range}
                        onChange={(e) => range && setSession(day, session, [e.target.value, range[1]])}
                        className={timeInput}
                      />
                      <span className="text-muted">–</span>
                      <input
                        type="time"
                        aria-label={`${HOURS_DAY_LABELS[day]} ${session} closes`}
                        value={range?.[1] ?? DEFAULT_RANGE[session][1]}
                        disabled={!range}
                        onChange={(e) => range && setSession(day, session, [range[0], e.target.value])}
                        className={timeInput}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <button type="button" onClick={() => copyMonday(["tue", "wed", "thu", "fri"])} className="rounded-lg border border-border px-3 py-1.5 hover:bg-border/40">
          Copy Monday to Tue–Fri
        </button>
        <button type="button" onClick={() => copyMonday(["tue", "wed", "thu", "fri", "sat", "sun"])} className="rounded-lg border border-border px-3 py-1.5 hover:bg-border/40">
          Copy Monday to all days
        </button>
      </div>
    </div>
  );
}
