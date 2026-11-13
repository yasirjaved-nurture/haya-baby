# 🍼 Haya Baby — Storefront + Dashboard + WhatsApp Inventory Bot

One Next.js app, one Supabase database, three ways in:

| Who | Where | What |
|---|---|---|
| Customers | `/` | Browse, add to bag, checkout (COD / JazzCash / Easypaisa / bank) |
| Owner | WhatsApp | Add products from photos, update stock by text/photo/voice, orders & reports |
| Owner / staff | `/admin` | Full dashboard — products, orders, stock log, settings |

```
Owner WhatsApp ─► Meta Cloud API ─► /api/whatsapp/webhook ─► Claude (reads text + photos)
                                                              │
                                              confirm buttons ✅ / ❌ on WhatsApp
                                                              │
       /admin dashboard ◄──────────► Supabase (Postgres + Storage) ◄──────────► Storefront
```

---

## 1. Supabase (≈10 min)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of `supabase/migrations/0001_init.sql` → **Run**.
   This creates every table, the stock/checkout functions, security rules and the `product-images` storage bucket.
3. **Authentication → Users → Add user** → create the owner's dashboard login (email + password).
4. Give that user dashboard access (SQL Editor):
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'owner@example.com';
   ```
5. **Authentication → Sign In / Providers → Email** → turn **off** "Allow new users to sign up".
6. **Project Settings → API** → copy the URL, `anon` key and `service_role` key for step 4.

## 2. WhatsApp Cloud API (≈20 min to test, a few days to go live)

1. Go to [developers.facebook.com](https://developers.facebook.com) → **Create app** → type **Business** → add the **WhatsApp** product.
2. **WhatsApp → API Setup** gives you a free **test number**. Copy:
   - **Phone number ID** → `WA_PHONE_NUMBER_ID`
   - **Temporary access token** → `WA_ACCESS_TOKEN` (expires in 24h — fine for testing)
   - Under "To", add the owner's personal WhatsApp number as a test recipient.
3. **App settings → Basic → App secret** → `WA_APP_SECRET`.
4. After deploying (step 4): **WhatsApp → Configuration → Webhook**
   - Callback URL: `https://YOUR-SITE/api/whatsapp/webhook`
   - Verify token: the same random string as `WA_VERIFY_TOKEN`
   - Click **Manage** → subscribe to **messages**.
5. Send "help" from the owner's phone to the test number. The bot should reply.

**Going live** (when testing works):
- Add a real phone number in WhatsApp Manager. It must be a number **not** registered on the regular WhatsApp/WhatsApp Business app, unless you use Meta's "coexistence" onboarding.
- Complete **Business Verification** in Meta Business Settings and get the display name approved.
- Create a **permanent token**: Business Settings → Users → System users → Add → Generate token with `whatsapp_business_messaging` + `whatsapp_business_management` → put it in `WA_ACCESS_TOKEN`.

**Order alerts template (recommended).** WhatsApp only allows free-form messages within 24h of the owner's last message to the bot. To make order alerts arrive at any time, create a template in **WhatsApp Manager → Message templates**:
- Name: `new_order` · Category: **Utility** · Language: English
- Body: `🛍️ New order #{{1}} from {{2}} — {{3}} ({{4}}). Open your dashboard to confirm.`
- Once approved, set `WA_ORDER_TEMPLATE=new_order`.

## 3. AI keys

- **Claude**: [console.anthropic.com](https://console.anthropic.com) → API key → `ANTHROPIC_API_KEY`. It reads the owner's messages and photos and matches them to products.
- **Voice notes** (optional): Claude doesn't transcribe audio, so voice notes use Whisper. Add an OpenAI key as `TRANSCRIBE_API_KEY`. Any OpenAI-compatible Whisper endpoint works, e.g. Groq: `TRANSCRIBE_BASE_URL=https://api.groq.com/openai/v1`, `TRANSCRIBE_MODEL=whisper-large-v3`. Leave it blank and the bot asks the owner to type instead.

## 4. Deploy on Vercel

1. Push this folder to a GitHub repo → [vercel.com](https://vercel.com) → **Import**.
2. Add every variable from `.env.example` under **Settings → Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL (or your custom domain).
3. Deploy → finish the webhook step in 2.4.
4. Open `/admin`, sign in, then go to **Settings**:
   - Add the owner's (and staff's) WhatsApp numbers under **WhatsApp bot access**.
   - Fill in the shop name, Instagram, customer WhatsApp, delivery fee and payment accounts.

### Run locally
```bash
npm install
cp .env.example .env.local   # fill it in
npm run dev                  # http://localhost:3000
```
To test the bot locally, expose your machine with `npx cloudflared tunnel --url http://localhost:3000` and use that URL as the webhook.

---

## 📱 Owner's WhatsApp cheat sheet

| Want to… | Send |
|---|---|
| Add a product | Photos + `new, 1450, 0-3m 5, 3-6m 5` |
| Mark sold | `sold 2 blue romper 3-6m` · `2 bik gaye` with a photo |
| Restock | `starter set 10 aa gaye` |
| Set exact count | `romper stock 6 hai` |
| Many at once | Photo of the register / supplier bill |
| Out of stock / hide / show | `pink frock khatam` · `hide blanket` · `show blanket` |
| Change price | `romper price 1300` |
| Add photos/video to a product | Media + `add to blue romper` |
| Orders | `orders` · `order 1023 shipped` · `order 1023 paid` |
| Reports | `low stock` · `aaj ki sale` · `kitna stock hai romper` |
| Fix a mistake | `undo` |
| Start over | `cancel` |

Voice notes work too ("blue romper do bik gaye"). Every change is confirmed with a ✅ button first, and **undo** reverses the last change.

---

## How it works

- **Nothing changes without a tap.** Each request becomes a *pending action* (`bot_actions`) with ✅ / ❌ buttons. Applying it stores an `undo` payload.
- **Photo matching.** Claude sees the owner's photo plus the catalogue text. When it isn't sure which product it is, it compares the photo with the cover photos of up to 8 candidates. If it's still unsure, the owner picks from a tappable list.
- **Albums.** WhatsApp sends each photo separately. The bot waits a few seconds after a captioned photo to collect the rest, and attaches any late photos to the open confirmation.
- **Stock can't go wrong silently.** All changes go through the `adjust_stock` / `set_stock` database functions, which log each change in `stock_movements` (who, from where, why). Products switch between *active* and *sold out* automatically.
- **No overselling.** Checkout runs `place_order()` in a single transaction that locks each variant, checks stock, uses server-side prices and deducts stock. Cancelling an order restocks it.
- **Instagram sales.** When something sells through Instagram DMs, the owner sends `sold 1 …` and the website stock stays correct.
- **Strangers.** Anyone not on the allowed list who messages the bot gets one friendly reply with the shop link (at most every 12h). Turn this off with `WA_CUSTOMER_AUTOREPLY=false`.

## File map

```
supabase/migrations/0001_init.sql   schema, RLS, stock + checkout functions, storage
src/lib/bot/handler.ts              the WhatsApp brain: routing, confirm/undo, queries
src/lib/ai.ts                       Claude prompts (intent parsing, photo matching)
src/lib/whatsapp.ts                 send/receive helpers, signature check
src/lib/inventory.ts                catalogue loading, product creation, variant matching
src/app/api/whatsapp/webhook        webhook endpoint
src/app/api/orders                  checkout endpoint
src/app/admin/…                     dashboard
src/app/(store)/…                   storefront
```
