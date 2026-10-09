import { formatDate, type CheckinResult } from "@gymos/shared";
import clsx from "clsx";

// Outcome of a check-in. Never blocking: an inactive membership is a warning.
export function CheckinResultBanner({ result, error }: { result?: CheckinResult; error?: string }) {
  if (error) {
    return <div className="rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger">{error}</div>;
  }
  if (!result) return null;

  const time = new Date(result.checked_in_at).toLocaleTimeString("en-IN", { timeStyle: "short" });
  return (
    <div
      className={clsx(
        "rounded-xl border p-4",
        result.membership_ok ? "border-green-500/50 bg-green-500/10" : "border-amber-500/50 bg-amber-500/10",
      )}
    >
      <p className="text-lg font-semibold">{result.full_name || "Member"}</p>
      <p className="text-sm">
        {result.duplicate ? `Already checked in at ${time}` : `Checked in at ${time}`}
      </p>
      <p className="mt-1 text-sm font-medium">
        {result.membership_ok
          ? `Membership active till ${formatDate(result.ends_on!)}`
          : result.ends_on
            ? `Membership expired on ${formatDate(result.ends_on)}. Remind them to renew.`
            : "No membership yet. Remind them to pick a plan."}
      </p>
    </div>
  );
}
