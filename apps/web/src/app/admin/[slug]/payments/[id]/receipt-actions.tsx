"use client";

import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui";

// Print (or "Save as PDF" in the print dialog), and send on WhatsApp.
export function ReceiptActions({ whatsappUrl }: { whatsappUrl: string | null }) {
  return (
    <div className="flex gap-2">
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-border/40"
        >
          <MessageCircle className="size-4" /> Send on WhatsApp
        </a>
      )}
      <Button onClick={() => window.print()}>
        <Printer className="size-4" /> Print / Save PDF
      </Button>
    </div>
  );
}
