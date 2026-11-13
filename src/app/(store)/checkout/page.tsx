import { getStoreData } from "@/lib/store";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata = { title: "Checkout" };

export default async function Checkout() {
  const { settings } = await getStoreData();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-4xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm settings={settings} />
    </div>
  );
}
