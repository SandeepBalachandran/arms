"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, Input } from "@/components/ui";

const subscribe = () => () => {};

export function CopyJoinLink({ path }: { path: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const url = origin + path;

  return (
    <div className="mt-3 flex gap-2">
      <Input readOnly value={url} onFocus={(e) => e.target.select()} />
      <Button
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
