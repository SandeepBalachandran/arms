import { formatDate, type MembershipState } from "@gymos/shared";
import { Tooltip } from "@/components/tooltip";
import { Badge } from "@/components/ui";

type Dates = { status: "active" | "cancelled" | "expired"; starts_on: string; ends_on: string; plan_name?: string };

// One-line membership status used in the members list and member page; the
// tooltip gives the exact dates.
export function MembershipBadge({ state, warnDays }: { state: MembershipState<Dates>; warnDays: number }) {
  const [badge, detail] = (() => {
    switch (state.kind) {
      case "active": {
        const end = state.next?.ends_on ?? state.current.ends_on;
        return [
          <Badge key="b" tone={state.daysLeft <= warnDays ? "warn" : "good"}>Active · {state.daysLeft}d left</Badge>,
          `Valid till ${formatDate(end)}${state.next ? " (renewal paid)" : ""}`,
        ] as const;
      }
      case "upcoming":
        return [<Badge key="b">Starts {formatDate(state.next.starts_on)}</Badge>, `Runs ${formatDate(state.next.starts_on)} – ${formatDate(state.next.ends_on)}`] as const;
      case "expired":
        return [<Badge key="b" tone="bad">Expired {formatDate(state.last.ends_on)}</Badge>, `Ended ${state.daysAgo} days ago. Renew from the member page.`] as const;
      case "none":
        return [<Badge key="b">No plan</Badge>, "No membership yet. Record a payment to start one."] as const;
    }
  })();
  return (
    <Tooltip content={detail}>
      <span tabIndex={0} className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {badge}
      </span>
    </Tooltip>
  );
}
