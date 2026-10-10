"use client";

import { Printer, RefreshCw } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui";
import { rotatePoster } from "./actions";

export function PosterActions({ slug, canRotate }: { slug: string; canRotate: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canRotate && (
        <ActionForm
          action={rotatePoster}
          success="New code made. Print the poster again."
          confirm="Make a new code? Posters you've already printed stop working."
        >
          <input type="hidden" name="slug" value={slug} />
          <Button variant="secondary">
            <RefreshCw className="size-4" /> New code
          </Button>
        </ActionForm>
      )}
      <Button onClick={() => window.print()}>
        <Printer className="size-4" /> Print
      </Button>
    </div>
  );
}
