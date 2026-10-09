"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { sendMagicLink, signIn, signUp } from "../actions";

type Mode = "signin" | "signup" | "magic";

const ACTIONS = { signin: signIn, signup: signUp, magic: sendMagicLink };
const TITLES = { signin: "Sign in", signup: "Create your account", magic: "Email me a link" };

export function LoginForm({ next, initialMode }: { next: string; initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  // Re-key per mode so each form keeps its own action state.
  return <ModeForm key={mode} mode={mode} next={next} onModeChange={setMode} />;
}

function ModeForm({ mode, next, onModeChange }: { mode: Mode; next: string; onModeChange: (m: Mode) => void }) {
  const [state, action, pending] = useActionState(ACTIONS[mode], undefined);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{TITLES[mode]}</h1>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <Field label="Full name">
            <Input name="full_name" autoComplete="name" required />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        {mode !== "magic" && (
          <Field label="Password">
            <Input
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </Field>
        )}
        <FormError message={state?.error} />
        {state?.message && <p className="text-sm text-muted">{state.message}</p>}
        <Button className="w-full" disabled={pending}>
          {pending ? "Please wait…" : TITLES[mode]}
        </Button>
      </form>
      <div className="flex flex-col gap-1 text-sm text-muted">
        {mode !== "signin" && (
          <button className="text-left hover:underline" onClick={() => onModeChange("signin")}>
            Have an account? Sign in
          </button>
        )}
        {mode !== "signup" && (
          <button className="text-left hover:underline" onClick={() => onModeChange("signup")}>
            New here? Create an account
          </button>
        )}
        {mode !== "magic" && (
          <button className="text-left hover:underline" onClick={() => onModeChange("magic")}>
            Sign in with an email link instead
          </button>
        )}
      </div>
    </div>
  );
}
