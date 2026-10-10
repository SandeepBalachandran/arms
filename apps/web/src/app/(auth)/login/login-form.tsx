"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, UserRound } from "lucide-react";
import { AuthField, AuthHeading, AuthInput } from "@/components/auth-shell";
import { Button, FormError } from "@/components/ui";
import { sendMagicLink, signIn, signUp } from "../actions";

type Mode = "signin" | "signup" | "magic";

const ACTIONS = { signin: signIn, signup: signUp, magic: sendMagicLink };
const COPY = {
  signin: { title: "Welcome back", subtitle: "Sign in to manage your gym.", submit: "Sign in" },
  signup: { title: "Create your account", subtitle: "Then register your gym or open an invite.", submit: "Create account" },
  magic: { title: "Sign in with email", subtitle: "We'll email you a link. No password needed.", submit: "Email me a link" },
};

export function LoginForm({ next, initialMode, linkError }: { next: string; initialMode: Mode; linkError: boolean }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  // The email carries across modes so switching doesn't make you retype it.
  const [email, setEmail] = useState("");
  // Re-key per mode so each form keeps its own action state.
  return (
    <ModeForm
      key={mode}
      mode={mode}
      next={next}
      email={email}
      onEmailChange={setEmail}
      onModeChange={setMode}
      linkError={linkError && mode === initialMode}
    />
  );
}

function ModeForm({ mode, next, email, onEmailChange, onModeChange, linkError }: {
  mode: Mode;
  next: string;
  email: string;
  onEmailChange: (email: string) => void;
  onModeChange: (m: Mode) => void;
  linkError: boolean;
}) {
  const [state, action, pending] = useActionState(ACTIONS[mode], undefined);
  const [showPassword, setShowPassword] = useState(false);
  const copy = COPY[mode];

  if (state?.sent) {
    return (
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
          <MailCheck className="size-6" />
        </div>
        <AuthHeading
          title="Check your email"
          subtitle={
            <>
              {state.sent === "confirm" ? "We sent a confirmation link to " : "We sent a sign-in link to "}
              <span className="font-medium text-foreground">{email}</span>. Open it on this device to continue.
            </>
          }
        />
        <p className="text-sm text-muted">Nothing there? Check spam, or wait a minute and try again.</p>
        <Button variant="secondary" className="w-full" onClick={() => onModeChange("signin")}>
          <ArrowLeft className="size-4" /> Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeading title={copy.title} subtitle={copy.subtitle} />

      {mode !== "magic" && (
        <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-xl bg-border/50 p-1 text-sm font-medium">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => onModeChange(m)}
              className={clsx(
                "rounded-lg py-2 transition",
                mode === m ? "bg-surface shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      {linkError && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          That email link has expired or was already used. Sign in again, or ask for a new link.
        </p>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <AuthField label="Full name" icon={UserRound}>
            <AuthInput name="full_name" autoComplete="name" placeholder="Asha Sharma" required />
          </AuthField>
        )}
        <AuthField label="Email" icon={Mail}>
          <AuthInput
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
          />
        </AuthField>
        {mode !== "magic" && (
          <AuthField
            label="Password"
            icon={Lock}
            extra={
              mode === "signin" && (
                <button type="button" onClick={() => onModeChange("magic")} className="text-xs font-medium text-brand hover:underline">
                  Forgot password?
                </button>
              )
            }
            hint={mode === "signup" ? "At least 8 characters." : undefined}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="flex size-8 items-center justify-center rounded-md text-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          >
            <AuthInput
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              className="pr-11"
              required
            />
          </AuthField>
        )}
        <FormError message={state?.error} />
        <Button className="h-11 w-full rounded-xl text-base" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Please wait…" : copy.submit}
        </Button>
      </form>

      {mode === "magic" ? (
        <button
          type="button"
          onClick={() => onModeChange("signin")}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Sign in with a password
        </button>
      ) : (
        <>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="secondary" className="h-11 w-full rounded-xl" onClick={() => onModeChange("magic")}>
            <Mail className="size-4" /> Email me a sign-in link
          </Button>
        </>
      )}
    </div>
  );
}
