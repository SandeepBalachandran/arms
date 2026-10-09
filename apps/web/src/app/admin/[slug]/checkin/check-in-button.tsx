"use client";

import { useActionState } from "react";
import { checkInMember } from "./actions";
import { CheckinResultBanner } from "./checkin-result";

// Manual check-in for one member, with the result shown inline.
export function CheckInButton({ slug, memberId, showResult = false }: {
  slug: string;
  memberId: string;
  showResult?: boolean;
}) {
  const [state, action, pending] = useActionState(checkInMember, undefined);

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="member_id" value={memberId} />
        <button
          disabled={pending}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-border/40 disabled:opacity-50"
        >
          {pending ? "Checking in…" : state?.result ? "Checked in ✓" : "Check in"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {showResult && <CheckinResultBanner result={state?.result} />}
    </div>
  );
}
