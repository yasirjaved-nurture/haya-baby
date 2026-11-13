import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoreSettings } from "./types";

export const DEFAULT_SETTINGS: StoreSettings = {
  shop_name: "Haya Baby",
  tagline: "Soft, safe & sweet things for your little one",
  instagram: "",
  whatsapp_contact: "",
  delivery_fee: 250,
  free_delivery_over: 5000,
  low_stock_threshold: 2,
  payment: {
    cod: true,
    jazzcash: { enabled: false, title: "", number: "" },
    easypaisa: { enabled: false, title: "", number: "" },
    bank: { enabled: false, bank_name: "", title: "", account: "", iban: "" },
  },
};

export function mergeSettings(value: Partial<StoreSettings> | null | undefined): StoreSettings {
  const v = value ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...v,
    payment: {
      ...DEFAULT_SETTINGS.payment,
      ...(v.payment ?? {}),
      jazzcash: { ...DEFAULT_SETTINGS.payment.jazzcash, ...(v.payment?.jazzcash ?? {}) },
      easypaisa: { ...DEFAULT_SETTINGS.payment.easypaisa, ...(v.payment?.easypaisa ?? {}) },
      bank: { ...DEFAULT_SETTINGS.payment.bank, ...(v.payment?.bank ?? {}) },
    },
  };
}

export async function getStoreSettings(db: SupabaseClient): Promise<StoreSettings> {
  const { data } = await db.from("settings").select("value").eq("key", "store").maybeSingle();
  return mergeSettings(data?.value);
}
