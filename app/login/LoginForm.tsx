"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MOCK_COOKIE = "mock_admin_session";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("admin@niural.com");
  const [password, setPassword] = useState("demo");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    document.cookie = `${MOCK_COOKIE}=1; path=/; max-age=${60 * 60 * 8}`;
    // Hard navigation so the new cookie is sent on the next request and
    // middleware re-runs. router.push would use the App Router cache and can
    // hit a stale RSC response captured before the cookie was set, forcing
    // the user to refresh manually.
    window.location.assign(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
