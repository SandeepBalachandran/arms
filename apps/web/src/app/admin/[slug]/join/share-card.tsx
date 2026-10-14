"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { CopyJoinLink } from "../copy-join-link";
import { BRAND } from "@gymos/shared";

// The link, plus a message to send with it. The message is only edited here;
// it isn't saved.
export function ShareCard({ path, url, defaultMessage }: { path: string; url: string; defaultMessage: string }) {
  const [message, setMessage] = useState(defaultMessage);
  const text = `${message.trim()}\n\n${url}`;

  return (
    <Card>
      <h2 className="font-medium">Your join link</h2>
      <p className="mt-1 text-sm text-muted">Share this with new members. It opens the {BRAND.name} app, or offers the install first.</p>
      <CopyJoinLink path={path} />
      <label className="mt-5 block text-sm font-medium" htmlFor="join-message">Message to send with it</label>
      <textarea
        id="join-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={400}
        className="mt-1 w-full rounded-lg border border-border bg-surface p-3 text-sm"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          <Button type="button">
            <MessageCircle className="size-4" /> Send on WhatsApp
          </Button>
        </a>
        <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(text)}>
          Copy message
        </Button>
      </div>
    </Card>
  );
}
