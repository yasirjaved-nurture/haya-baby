import { createClient } from "@/lib/supabase/server";
import { getStoreSettings } from "@/lib/settings";
import { BotUsers, Categories, StoreSettingsForm } from "@/components/admin/settings-forms";
import { PageHeader } from "@/components/admin/ui";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [settings, { data: users }, { data: categories }] = await Promise.all([
    getStoreSettings(supabase),
    supabase.from("bot_users").select("*").order("created_at"),
    supabase.from("categories").select("*").order("sort"),
  ]);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <BotUsers users={users ?? []} />
        <StoreSettingsForm initial={settings} />
        <Categories categories={categories ?? []} />
      </div>
    </>
  );
}
