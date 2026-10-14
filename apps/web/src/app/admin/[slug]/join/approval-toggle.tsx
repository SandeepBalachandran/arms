"use client";

import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui";
import { setJoinApproval } from "./actions";

export function ApprovalToggle({ slug, on, locked }: { slug: string; on: boolean; locked: boolean }) {
  return (
    <ActionForm action={setJoinApproval} success={on ? "New members now join straight away" : "New members now wait for approval"}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="value" value={on ? "false" : "true"} />
      <p className="text-sm text-muted">
        {on
          ? "People who open your link wait until staff approve them on the Members page."
          : "People who open your link become members straight away."}
      </p>
      {locked ? (
        <p className="mt-3 text-xs text-muted">Only the owner, or someone they allow under Roles &amp; permissions, can change this.</p>
      ) : (
        <Button variant="secondary" className="mt-3">{on ? "Let people join straight away" : "Approve new members first"}</Button>
      )}
    </ActionForm>
  );
}
