import { CartProvider } from "@/components/store/cart";
import { StoreHeader } from "@/components/store/header";
import { StoreFooter } from "@/components/store/footer";
import { getStoreData } from "@/lib/store";

export const revalidate = 60;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { settings, categories } = await getStoreData();
  return (
    <CartProvider>
      <StoreHeader shopName={settings.shop_name} categories={categories} freeOver={settings.free_delivery_over} />
      <main>{children}</main>
      <StoreFooter settings={settings} categories={categories} />
    </CartProvider>
  );
}
