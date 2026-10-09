import { formatDate, type MembershipState } from "@gymos/shared";
import { Badge } from "@/components/ui";

type Dates = { status: "active" | "cancelled" | "expired"; starts_on: string; ends_on: string };

// One-line membership status used in the members list and member page.
export function MembershipBadge({ state, warnDays }: { state: MembershipState<Dates>; warnDays: number }) {
  switch (state.kind) {
    case "active":
      return (
        <Badge tone={state.daysLeft <= warnDays ? "warn" : "good"}>
          Active · {state.daysLeft}d left
        </Badge>
      );
    case "upcoming":
      return <Badge tone="neutral">Starts {formatDate(state.next.starts_on)}</Badge>;
    case "expired":
      return <Badge tone="bad">Expired {formatDate(state.last.ends_on)}</Badge>;
    case "none":
      return <Badge>No plan</Badge>;
  }
}
