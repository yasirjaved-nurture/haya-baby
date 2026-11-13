import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/settings";
import { Sidebar } from "@/components/admin/sidebar";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="card max-w-md p-8 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-3 text-xl font-semibold">Not an admin yet</h1>
          <p className="mt-2 text-sm text-muted">
            <b>{user.email}</b> is signed in but doesn&apos;t have dashboard access. Run this in the Supabase SQL editor:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-3 text-left text-xs text-white">
            {`insert into admins (user_id)\nvalues ('${user.id}');`}
          </pre>
          <form action={signOut} className="mt-5">
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </div>
    );
  }

  const [settings, { count }] = await Promise.all([
    getStoreSettings(supabase),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar shopName={settings.shop_name} pendingOrders={count ?? 0} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
