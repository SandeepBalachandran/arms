// ISO timestamp for "N hours ago", for range filters in server components.
export function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
