"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // The email link arrives as #access_token=…&refresh_token=… (or ?code=…)
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      const err = hash.get("error_description") || query.get("error_description");
      if (err) return setLinkError(err.replace(/\+/g, " "));

      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      const code = query.get("code");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) return setLinkError(error.message);
        window.history.replaceState(null, "", window.location.pathname);
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return setLinkError(error.message);
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return setLinkError("This link is missing its sign-in details. Request a new reset email.");
      }
      setReady(true);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setSaving(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (error) return setError(error.message);
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_20%_10%,var(--color-blush),transparent_40%),radial-gradient(circle_at_80%_90%,var(--color-sky),transparent_40%)] p-6">
      <div className="card w-full max-w-sm p-7 shadow-xl shadow-brand/5">
        <div className="mb-5 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand text-2xl">🔑</div>
          <h1 className="mt-4 text-2xl font-semibold">Set a new password</h1>
        </div>
        {linkError ? (
          <div className="space-y-4 text-center">
            <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{linkError}</p>
            <a href="/admin/login" className="btn-ghost w-full">Back to sign in</a>
          </div>
        ) : !ready ? (
          <p className="text-center text-sm text-muted">Checking your link…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input className="input" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-dark">{error}</p>}
            <button className="btn-primary w-full" disabled={saving}>{saving ? "Saving…" : "Save & sign in"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
