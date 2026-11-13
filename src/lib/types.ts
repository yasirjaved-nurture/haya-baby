export type ProductStatus = "draft" | "active" | "sold_out" | "hidden";

export interface Category {
  id: string;
  name: string;
  slug: string;
  sort: number;
}

export interface Variant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku: string | null;
  price: number | null;
  stock: number;
  sort: number;
}

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  url: string;
  sort: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  price: number;
  compare_at_price: number | null;
  status: ProductStatus;
  tags: string[];
  ai_description: string | null;
  instagram_url: string | null;
  video_url: string | null;
  featured: boolean;
  created_at: string;
  updated_at: string;
  variants?: Variant[];
  product_images?: ProductImage[];
  categories?: Pick<Category, "id" | "name" | "slug"> | null;
}

export interface StoreSettings {
  shop_name: string;
  tagline: string;
  instagram: string;
  whatsapp_contact: string;
  delivery_fee: number;
  free_delivery_over: number;
  low_stock_threshold: number;
  payment: {
    cod: boolean;
    jazzcash: { enabled: boolean; title: string; number: string };
    easypaisa: { enabled: boolean; title: string; number: string };
    bank: { enabled: boolean; bank_name: string; title: string; account: string; iban: string };
  };
}

export interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  city: string;
  address: string;
  notes: string | null;
  payment_method: "cod" | "jazzcash" | "easypaisa" | "bank";
  payment_ref: string | null;
  payment_status: "unpaid" | "paid" | "refunded";
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  size: string | null;
  color: string | null;
  price: number;
  qty: number;
  image_url: string | null;
}
