"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function forgot() {
    if (!email) return setError("Type your email first, then tap “Forgot password”.");
    setError("");
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    if (error) return setError(error.message);
    setNotice("Check your inbox for a reset link 📬");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.replace(params.get("next") || "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7 shadow-xl shadow-brand/5">
      <div className="mb-2 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand text-2xl">🍼</div>
        <h1 className="mt-4 text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted">Sign in to manage your shop</p>
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{error}</p>}
      {notice && <p className="rounded-xl bg-sage px-3 py-2 text-sm font-semibold text-sage-deep">{notice}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <button type="button" onClick={forgot} className="w-full text-center text-sm font-bold text-muted hover:text-ink">
        Forgot password?
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_20%_10%,var(--color-blush),transparent_40%),radial-gradient(circle_at_80%_90%,var(--color-sky),transparent_40%)] p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
