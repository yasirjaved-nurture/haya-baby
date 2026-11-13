import Anthropic from "@anthropic-ai/sdk";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
let _client: Anthropic | null = null;
const client = () => (_client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

// ───────────── types ─────────────
export type TargetRef = {
  product_refs: string[]; // catalogue refs like "P12", most likely first
  product_hint: string; // what the owner called it, in English keywords
  size?: string;
  color?: string;
};

export type StockItem = TargetRef & { mode: "change" | "set"; quantity: number };

export type DraftProduct = {
  name?: string;
  description?: string;
  ai_description?: string;
  category?: string;
  price?: number;
  compare_at_price?: number;
  tags?: string[];
  variants?: { size?: string; color?: string; stock?: number }[];
};

export type ParsedIntent = {
  intent:
    | "create_product"
    | "stock"
    | "set_status"
    | "set_price"
    | "attach_media"
    | "update_order"
    | "query"
    | "undo"
    | "cancel"
    | "help"
    | "unclear";
  reply?: string;
  missing?: string[];
  product?: DraftProduct;
  items?: StockItem[];
  target?: TargetRef;
  status?: "active" | "sold_out" | "hidden";
  price?: number;
  compare_at_price?: number;
  order?: { order_number: number; status?: string; payment_status?: string };
  query?: { kind: "low_stock" | "today_sales" | "recent_orders" | "product_info" | "stock_summary" };
};

// ───────────── tool schema ─────────────
const target = {
  type: "object",
  properties: {
    product_refs: {
      type: "array",
      items: { type: "string" },
      description: "Catalogue refs (e.g. 'P12') that could be this product, most likely first, max 5. Empty if none fit.",
    },
    product_hint: { type: "string", description: "Short English keywords for the product, e.g. 'blue bunny romper'" },
    size: { type: "string", description: "Size if mentioned, normalised like '0-3m', '3-6m', '1-2y', 'NB'" },
    color: { type: "string" },
  },
  required: ["product_refs", "product_hint"],
};

const TOOL: Anthropic.Tool = {
  name: "record_intent",
  description: "Record what the shop owner wants to do.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: [
          "create_product",
          "stock",
          "set_status",
          "set_price",
          "attach_media",
          "update_order",
          "query",
          "undo",
          "cancel",
          "help",
          "unclear",
        ],
      },
      reply: {
        type: "string",
        description:
          "For 'unclear', or when info is missing: one short friendly question back to the owner, in the same language/style they used (English or Roman Urdu).",
      },
      missing: {
        type: "array",
        items: { type: "string" },
        description: "For create_product: required fields still unknown — any of 'price', 'stock', 'name'.",
      },
      product: {
        type: "object",
        description: "For create_product (merge with the unfinished draft if one is given).",
        properties: {
          name: { type: "string", description: "Short shop-style product name in English, e.g. 'Bunny Print Cotton Romper'" },
          description: { type: "string", description: "1–2 sentence customer-facing description" },
          ai_description: {
            type: "string",
            description: "Plain visual description from the photos for future matching: type, colours, pattern, material, details",
          },
          category: { type: "string", description: "Best fitting category name from the list given" },
          price: { type: "integer", description: "PKR. '1.5k' = 1500" },
          compare_at_price: { type: "integer", description: "Original price if the owner mentions a discount" },
          tags: { type: "array", items: { type: "string" } },
          variants: {
            type: "array",
            items: {
              type: "object",
              properties: { size: { type: "string" }, color: { type: "string" }, stock: { type: "integer" } },
            },
            description: "One entry per size/colour with its quantity. If no sizes, one entry with just stock.",
          },
        },
      },
      items: {
        type: "array",
        description: "For 'stock': one entry per product/size line.",
        items: {
          type: "object",
          properties: {
            ...target.properties,
            mode: {
              type: "string",
              enum: ["change", "set"],
              description: "'change' = add/remove units (sold, arrived). 'set' = stock is now exactly N.",
            },
            quantity: { type: "integer", description: "For change: negative when sold/removed, positive when added." },
          },
          required: ["product_refs", "product_hint", "mode", "quantity"],
        },
      },
      target: { ...target, description: "For set_status / set_price / attach_media / query product_info." },
      status: { type: "string", enum: ["active", "sold_out", "hidden"] },
      price: { type: "integer" },
      compare_at_price: { type: "integer" },
      order: {
        type: "object",
        properties: {
          order_number: { type: "integer" },
          status: { type: "string", enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"] },
          payment_status: { type: "string", enum: ["unpaid", "paid", "refunded"] },
        },
        required: ["order_number"],
      },
      query: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["low_stock", "today_sales", "recent_orders", "product_info", "stock_summary"] },
        },
        required: ["kind"],
      },
    },
    required: ["intent"],
  },
};

const SYSTEM = `You are the inventory assistant for a small baby-products shop in Pakistan (clothes, starter sets, blankets, feeding, toys).
The owner is not technical. They message on WhatsApp in English, Roman Urdu, Urdu or a mix, often with typos, voice-note transcripts and photos.
Turn each message into exactly one record_intent call.

Meaning of common phrases:
- "bik gaya/gaye", "sold", "nikal gaya", "-2" → stock change, negative quantity
- "aa gaye", "arrived", "new stock", "add 5", "+5", "aur 5" → stock change, positive quantity
- "stock 10 hai", "10 bache hain", "set 10", "remaining 10" → stock mode "set"
- "khatam", "finish", "out of stock", "sold out" → set_status sold_out (unless a number of units sold is given → stock change)
- "hide", "hata do", "band karo" → set_status hidden; "wapas lagao", "show", "available" → set_status active
- "price 1300", "rate 1300", "1300 kar do" → set_price
- "1.5k" = 1500, "2k" = 2000. Prices are PKR.
- "undo", "galti", "wapas karo pichla" → undo; "cancel", "chhoro" → cancel; "help", "?" → help
- "order 1023 shipped/deliver/confirm/cancel/paid" → update_order
- "low stock", "kya khatam ho raha", "kam stock" → query low_stock; "aaj ki sale", "today sales" → query today_sales; "orders" → query recent_orders; "kitna stock hai <product>" → query product_info with target; "total stock" → stock_summary

Photos:
- Photo(s) of a product with price/quantity/"new"/"naya" and no matching catalogue item → create_product. Fill name, description, ai_description and category from the photo.
- Photo(s) + "sold 2"/"5 aa gaye"/"khatam"/"price ..." → that operation on the pictured product. Put catalogue refs that could match (by name, colour, type) in product_refs; the system will compare photos to decide. If nothing in the catalogue fits, leave product_refs empty.
- Photo of a handwritten register, stock list, receipt or supplier invoice → 'stock' with one item per line.
- Photo(s) with "add photo", "ye bhi lagao", "pic for <product>" → attach_media.
- A photo with no instruction at all → 'unclear' and ask what to do (new product? stock update?).

create_product needs name, price and stock. If price or stock is unknown, still return create_product with everything you know, list the gaps in 'missing', and put a short question in 'reply'.
Sizes: normalise like 0-3m, 3-6m, 6-9m, 9-12m, 12-18m, 18-24m, 2-3y, NB. "har size 5"/"5 each" means every listed size gets 5.
If an unfinished draft is provided, the new message most likely completes or corrects it — merge them and return the full create_product.
Never invent prices or quantities.`;

type Img = { url: string };

export async function parseMessage(opts: {
  text: string;
  images: Img[];
  videos: number;
  catalog: string;
  categories: string[];
  draft?: unknown;
}): Promise<ParsedIntent> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of opts.images.slice(0, 6)) content.push({ type: "image", source: { type: "url", url: img.url } });
  const parts = [
    `CATEGORIES: ${opts.categories.join(", ") || "(none)"}`,
    `CATALOGUE (ref | name | category | price | status | variants size/colour:stock | look):\n${opts.catalog || "(empty — no products yet)"}`,
    opts.draft ? `UNFINISHED DRAFT FROM PREVIOUS MESSAGE:\n${JSON.stringify(opts.draft)}` : "",
    opts.images.length ? `The owner attached ${opts.images.length} photo(s) (shown above).` : "",
    opts.videos ? `The owner attached ${opts.videos} video(s) (not shown).` : "",
    `OWNER MESSAGE: ${opts.text?.trim() || "(no text)"}`,
  ].filter(Boolean);
  content.push({ type: "text", text: parts.join("\n\n") });

  const res = await client().messages.create({
    model: MODEL(),
    max_tokens: 2000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "record_intent" },
    messages: [{ role: "user", content }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return { intent: "unclear", reply: "Sorry, I didn't get that. Type *help* for examples." };
  return block.input as ParsedIntent;
}

/** Compare the owner's photo(s) with candidate products' photos and pick the matching one. */
export async function pickProductByPhoto(
  ownerImages: Img[],
  candidates: { ref: string; name: string; imageUrl: string }[],
): Promise<{ ref: string | null; confidence: "high" | "medium" | "low" }> {
  if (!candidates.length || !ownerImages.length) return { ref: null, confidence: "low" };
  const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: "OWNER'S PHOTO(S):" }];
  for (const img of ownerImages.slice(0, 3)) content.push({ type: "image", source: { type: "url", url: img.url } });
  content.push({ type: "text", text: "CANDIDATE PRODUCTS FROM THE CATALOGUE:" });
  for (const c of candidates.slice(0, 8)) {
    content.push({ type: "text", text: `${c.ref} — ${c.name}` });
    content.push({ type: "image", source: { type: "url", url: c.imageUrl } });
  }
  content.push({
    type: "text",
    text: "Which candidate is the same product as in the owner's photo (same item, colour and print — ignore background, folding, lighting)? Answer with the pick tool. Use ref null if none is the same product.",
  });

  const res = await client().messages.create({
    model: MODEL(),
    max_tokens: 300,
    tools: [
      {
        name: "pick",
        description: "Pick the matching product",
        input_schema: {
          type: "object",
          properties: {
            ref: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["ref", "confidence"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "pick" },
    messages: [{ role: "user", content }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return { ref: null, confidence: "low" };
  return block.input as { ref: string | null; confidence: "high" | "medium" | "low" };
}
