"use client";

import { useState } from "react";
import { ArrowLeft, KeyRound, Phone } from "lucide-react";
import { PIN_LENGTH } from "@gymos/shared";
import { AuthField, AuthHeading, AuthInput } from "@/components/auth-shell";
import { Button, FormError } from "@/components/ui";

// Phone number + PIN, for members the gym added without an email; the front
// desk gives them the PIN. Checked by /api/auth/pin, which sets the session.
export function PinForm({ next, onBack }: { next: string; onBack: () => void }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't sign in. Try again.");
      window.location.assign(next || "/go");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <AuthHeading title="Sign in with your phone" subtitle="Use the phone number your gym has and the PIN they gave you." />
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Phone number" icon={Phone}>
          <AuthInput type="tel" inputMode="tel" autoComplete="tel" placeholder="98470 12345" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </AuthField>
        <AuthField label={`${PIN_LENGTH}-digit PIN`} icon={KeyRound}>
          <AuthInput
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
            required
          />
        </AuthField>
        <FormError message={error} />
        <Button className="h-11 w-full rounded-xl text-base" loading={pending} disabled={pin.length < PIN_LENGTH}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-sm text-muted">Forgot your PIN? Ask at the front desk for a new one.</p>
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Sign in with email instead
      </button>
    </div>
  );
}
