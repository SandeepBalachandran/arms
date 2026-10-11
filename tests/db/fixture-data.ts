// Plain test data shared by the database and browser tests (no Vitest imports).

// Open all day, every day.
export const HOURS_ALWAYS = Object.fromEntries(
  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, { morning: ["00:00", "23:59"] }]),
);
// One short session six hours from now (gym time zone is Asia/Kolkata), so the
// gym is closed now even counting the 15 minutes' early check-in.
export function hoursClosedNow() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const start = (hour + 6) % 24;
  const pad = (n: number) => String(n).padStart(2, "0");
  return Object.fromEntries(
    ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, { morning: [`${pad(start)}:00`, `${pad(start)}:30`] }]),
  );
}
