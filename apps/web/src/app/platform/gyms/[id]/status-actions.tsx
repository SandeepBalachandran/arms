"use client";

import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui";
import { setGymStatus } from "./actions";

export function StatusActions({ gymId, status, deleted }: { gymId: string; status: string; deleted: boolean }) {
  const live = status === "active" && !deleted;
  return (
    <ActionForm
      action={setGymStatus}
      success={live ? "Gym suspended" : deleted ? "Gym restored" : "Gym is active again"}
      confirm={live ? "Suspend this gym? Its team and members can't use it until you make it active again. Nothing is deleted." : undefined}
    >
      <input type="hidden" name="gym_id" value={gymId} />
      <input type="hidden" name="status" value={live ? "suspended" : "active"} />
      <Button variant="secondary">{live ? "Suspend gym" : deleted ? "Restore gym" : "Make active again"}</Button>
    </ActionForm>
  );
}
