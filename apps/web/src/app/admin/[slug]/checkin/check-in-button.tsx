"use client";

import { useActionState, type ReactNode } from "react";
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
      <CheckInForm slug={slug} memberId={memberId} action={action} pending={pending} done={!!state?.result} />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {showResult && <CheckinResultBanner result={state?.result} photoUrl={state?.photoUrl} />}
    </div>
  );
}

// A search result: the member (children) and the button, then the result
// with their photo across the full width, so the desk can compare faces.
export function CheckInRow({ slug, memberId, children }: { slug: string; memberId: string; children: ReactNode }) {
  const [state, action, pending] = useActionState(checkInMember, undefined);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {children}
        <CheckInForm slug={slug} memberId={memberId} action={action} pending={pending} done={!!state?.result} />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <CheckinResultBanner result={state?.result} photoUrl={state?.photoUrl} />
    </div>
  );
}

function CheckInForm({ slug, memberId, action, pending, done }: {
  slug: string;
  memberId: string;
  action: (formData: FormData) => void;
  pending: boolean;
  done: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="member_id" value={memberId} />
      <button
        disabled={pending}
        data-loading={pending ? "" : undefined}
        className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-border/40 disabled:opacity-50"
      >
        {pending ? "Checking in…" : done ? "Checked in ✓" : "Check in"}
      </button>
    </form>
  );
}
