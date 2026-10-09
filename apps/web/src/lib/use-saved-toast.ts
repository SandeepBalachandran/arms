"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

type SaveState = { saved?: boolean; message?: string; error?: string } | undefined;

// Shows a success toast (and runs onSaved, e.g. to close a modal) each time a
// useActionState form returns a new successful result. Errors stay inline.
export function useSavedToast(state: SaveState, message: string, onSaved?: () => void) {
  const handled = useRef(state);
  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state?.saved || state?.message) {
      toast.success(state.message ?? message);
      onSaved?.();
    }
  }, [state, message, onSaved]);
}
