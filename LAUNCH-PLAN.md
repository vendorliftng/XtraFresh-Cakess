# XtraFresh Cakes — August Promo Launch Plan

**Goal:** launch the website for the first time with an August promo running, then revert to a normal storefront on Sept 1 without a rebuild.

**Architecture (unchanged):** static `index.html` + `store.html` → Google Apps Script `/exec` → Notion (catalog, blog, settings) + Google Sheets (orders, customers) → WhatsApp handoff.

---

## THE PROMO — final specification

> This replaces everything currently in the code. The existing banner ("Free Birthday Cakes & 30% Off Events"), the `2026-08-15` date cap, and the separate checkout "Claim August Promo?" dropdown are all **wrong** and get removed.

### The offer
**Your cake, free — for the first 10 orders only.**

One offer. Not three. Any cake in the catalogue or built in the configurator, at no cost, for the first 10 claimants.

### What's included

| Order type | Included free |
|---|---|
| Wedding | Up to **2 tiers** |
| Everything else | **6" to 12"**, single tier, sized to the celebrant |

Anything beyond that is still welcome — the full free-cake value comes off as credit and the customer pays only the difference. Nobody gets turned away, and your maximum exposure is 10 cakes at known sizes.

### Timing

- **Claims open now**, and close when the 10th slot is taken.
- **The event must fall between Aug 1 and Aug 31, 2026.**
- **Lead time:** order at least **7 days** before the event — **14 days** for weddings.

Which means the real deadlines are:

| | Last day to claim |
|---|---|
| Weddings | **Aug 17** (14-day lead → Aug 31 event) |
| All other cakes | **Aug 24** (7-day lead → Aug 31 event) |

The date picker must enforce this dynamically: minimum selectable date = `max(Aug 1, today + leadDays)`, maximum = Aug 31. `leadDays` flips to 14 the moment "Wedding" is chosen as the occasion. The current hardcoded `min="2026-08-01" max="2026-08-15"` is wrong on both ends.

⚠️ **Build this early.** After Aug 24 the promo form is dead even if slots remain — the site must detect that and switch to the waitlist state on its own.

### Delivery
- **Free** within **Ogba, Ikeja, and Ojodu**.
- Outside those areas: customer pays delivery, or picks up free.

Make pickup a visible, equal-weight option in the form — not fine print. It keeps out-of-zone claimants from dropping off.

### Conditions — the marketing engine

Every claimant agrees to:

1. **Honest feedback** — a short voice note or 3-question form after delivery. *Framed as:* "you're helping us perfect our recipes."
2. **Photo & video rights** — you may photograph the cake and use the images on the website and social media. *Framed as:* "our photographer captures your cake and you get the professional photos free."
3. **A testimonial** — a short quote, usable on the site with their first name.
4. **One tag** — a single post or story tagging XtraFresh on delivery day.
5. **Two referral codes** — they receive two 15%-off codes to pass to friends. *This is a gift, not a condition* — but it's what turns 10 claimants into a wider funnel.

**Fine print (state it plainly, keep it short):** one claim per phone number · not transferable · not combinable with other offers · subject to date availability.

### Why this framing matters
Read the conditions again as a customer would: professional photos, a gift for two friends, and a say in the recipe. Nothing on that list feels like a price being extracted — it reads as being let in on something. That's deliberate. The moment conditions feel transactional, claim rates fall and the people who do claim resent the follow-up, which is exactly where you'd lose the testimonials you're doing this for.

### What you actually get from 10 free cakes
10 portfolio-quality photo sets · 10 testimonials · 10 honest product reviews · 10 tagged posts · 20 referral codes in circulation · a customer database with real order history. That's the return — not the cakes.

---

## Phase 0 — Blocking fixes (do before anything else)

These are correctness and security problems in the current code. Nothing else matters if these ship.

### 0.1 Rotate the Notion token — urgent
The token `ntn_3715...` is hardcoded in `Code.gs` and has been shared in plaintext. Anyone holding it can read and write your catalog and blog.

1. Notion → Settings → Connections → your integration → **Rotate secret**
2. In Apps Script: **Project Settings → Script Properties** → add `NOTION_TOKEN` = new value
3. In code: `const NOTION_TOKEN = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN');`
4. Never paste the new token into a chat, a commit, or the frontend.

Same applies to `CATALOG_DB_ID` / `BLOG_DB_ID` — less sensitive, but move them too for consistency.

### 0.2 Orders sheet doesn't record what was ordered
This is the biggest functional gap. `doPost` appends:

```
[Order ID, Order Date, Customer ID, Delivery Date, Address, Allergies, Promo, Payment Link, Status]
```

The cake — occasion, flavor, size, inscription, notes, quoted price — exists only in the WhatsApp message. If a customer never sends that message, or you lose the chat, **the order is unrecoverable from the sheet.**

Fix: add columns `Order Details`, `Source` (`builder` / `catalog` / `promo`), `Est. Price`, and send `currentOrderDetails` in the POST body from both submit functions.

### 0.3 Race conditions on concurrent orders
`doPost` reads the whole Customers sheet, then writes. Two orders arriving within the same second can both read `Total Orders = 3` and both write `4`, or both create a duplicate customer row.

Fix: wrap the customer upsert + order append in `LockService.getScriptLock()` with a 20s timeout.

### 0.4 Order ID collisions
`"ORD-" + Math.floor(10000 + Math.random() * 90000)` gives 90,000 possible IDs with no uniqueness check. Rare, but a collision silently merges two customers' orders in your head.

Fix: `"ORD-" + Utilities.formatDate(new Date(), "Africa/Lagos", "yyMMdd") + "-" + counter` using a Script Property counter inside the same lock.

### 0.5 Backend errors shown to customers
```js
`Backend says: ${cakeData.message}`
```
renders raw Notion/Apps Script errors into the page. Customers see internal error text; it also leaks database structure.

Fix: log the real error to console, show a friendly fallback in the UI.

---

## Phase 1 — The promo switch (Notion-controlled)

A **Site Settings** database in Notion, one row, that the site reads on load. You flip promo mode from your phone; the site changes with no code edit and no redeploy.

### Notion database: `Site Settings`

| Property | Type | Purpose |
|---|---|---|
| `Name` | Title | Always `"live"` (single row) |
| `promoActive` | Checkbox | Master switch. Off → normal site |
| `promoHeadline` | Rich text | Banner copy |
| `promoSubtext` | Rich text | Modal intro copy |
| `promoStart` / `promoEnd` | Date | Event window (Aug 1 – Aug 31) |
| `leadDaysDefault` | Number | `7` |
| `leadDaysWedding` | Number | `14` |
| `promoSlots` | Number | Total slots (e.g. 10) |
| `promoSlotsUsed` | Number | Incremented server-side per claim |
| `promoZones` | Multi-select | Free-delivery areas (Ogba, Ikeja, Ojodu) |
| `whatsappNumber` | Phone | So you can change it without a deploy |
| `announcementBar` | Rich text | Reused after August for normal-mode notices |

### Behaviour

- **`promoActive` = true** → banner, promo modal, "Claim August Promo?" checkout field, urgency counter, promo hero.
- **`promoActive` = false**, or today > `promoEnd` → all promo UI removed from the DOM. Normal storefront: catalog, configurator, blog, standard checkout. **Sept 1 requires zero work from you.**
- **Slots exhausted** (`promoSlotsUsed >= promoSlots`) → banner switches to "Promo fully claimed — join the waitlist", form still captures leads but stops promising a free cake.

Add `action=getSettings` to `doGet`. Frontend gates rendering on it.

### Failsafe
If settings can't be fetched, **default to normal mode**. Better to under-promise than to advertise a promo you can't honour.

---

## Phase 2 — Speed & reliability

Currently the page fires two sequential, uncached Notion queries through an Apps Script cold start. Expect **3–8 seconds of empty grids** on first load — on Lagos mobile data, worse. First impression risk on launch day.

| Change | Effect |
|---|---|
| `CacheService.getScriptCache()`, 5-min TTL on catalog & blog | Cold path once per 5 min instead of every visitor |
| Single `action=getAll` returning settings + cakes + blog | 3 round-trips → 1 |
| Skeleton cards while loading | Page never looks broken |
| Static JSON fallback baked into the page | Notion down ≠ empty site |
| `Promise.allSettled` | Blog failure doesn't kill the catalog |
| Preconnect to `script.google.com`, lazy-load cake images | Faster first paint |
| Cache-bust param you can bump from Notion | Publish catalog changes instantly when needed |

Also worth knowing: Apps Script has a **20,000 URL-fetch calls/day** quota and gets slow under burst traffic. Caching is what keeps a successful launch from taking the site down.

---

## Phase 3 — Order capture & promo integrity

### 3.1 Enforce "First 10 Only" server-side
Right now this is **copy only** — nothing counts. Eleven people can claim, and you either eat the cost or disappoint someone publicly during your launch.

Fix: in `doPost`, when `promoClaimed = "Yes"`, inside the lock:
1. Read `promoSlotsUsed` from Notion Settings
2. If `>= promoSlots` → return `{status: "full"}`, frontend shows waitlist instead of confirmation
3. Otherwise increment and save

Also validate the delivery date against `promoStart`/`promoEnd` **server-side** — the current check is client-side only and trivially bypassed.

### 3.2 Duplicate protection
Frontend disables the button, but a network retry, a back-navigation, or an impatient double-tap on mobile can still double-submit.

Fix: frontend generates a `clientRequestId` (UUID) per form open; `doPost` stores recent IDs in `CacheService` (10 min) and returns the existing order for repeats.

### 3.3 Confirmation before WhatsApp
Today: order saves → immediate `window.location.href` to WhatsApp. If WhatsApp isn't installed, the redirect is blocked, or the user backs out — **they never see confirmation and assume it failed.** Many will re-submit.

Fix: show an in-page success panel with the Order ID and a *tappable* "Open WhatsApp" button (not an auto-redirect), plus a copyable fallback of the order text and your number.

### 3.4 Input validation
Phone numbers currently accept anything, including `"No Phone"` as a real stored value. Normalise Nigerian formats (`0801…` / `+234801…` / `234801…`) to one canonical form — otherwise the Customers upsert matches on phone and will create duplicate customer records for the same person.

Make name, phone, date, and address genuinely required rather than silently defaulting to `"No Name"`.

### 3.5 Payment path
Every order ends with *"let me know the total cost and your account details."* At 10+ promo orders plus normal traffic, that's a lot of identical WhatsApp messages during your busiest week.

Options, cheapest first:
- **Now:** include your account details directly in the WhatsApp message template + a price estimate from the configurator
- **Later:** Paystack payment link generated per order into the existing (currently empty) `Payment Link` column

---

## Phase 4 — Visual & conversion polish

Promo mode is a different page, not the normal page with a banner on top.

- **Promo hero** — replaces the standard hero while `promoActive`. Offer, deadline, live slots-remaining, single CTA.
- **Live slot counter** — "4 of 10 claimed" from Notion. Real scarcity, not a fake ticker. Only credible because Phase 3.1 makes it true.
- **Countdown to `promoEnd`.**
- **Social proof** — 3–4 real customer quotes. First-time visitors have no reason to trust a brand-new site.
- **Mobile-first pass** — assume ~90% mobile. Thumb-reachable CTAs, no zoom-on-focus, modals that scroll properly on small screens.
- **Trust row** — delivery zones, lead time, allergen handling, WhatsApp response time.
- **Sticky mobile CTA** during promo.

Everything here is inside the `promoActive` conditional, so it disappears cleanly on Sept 1.

---

## Phase 5 — Launch readiness

### Pre-launch checklist
- [ ] Notion token rotated and moved to Script Properties
- [ ] Test order end-to-end on a real phone (Android + iPhone)
- [ ] Test with WhatsApp *not* installed
- [ ] Submit 11 promo claims on a test copy — confirm #11 is refused
- [ ] Double-tap submit — confirm one order row, not two
- [ ] Flip `promoActive` off and on — confirm the site changes both ways
- [ ] Simulate Notion failure — confirm fallback catalog renders
- [ ] Verify Orders sheet contains the cake details (Phase 0.2)
- [ ] Confirm Lagos timezone on the Apps Script project
- [ ] Load-test: ~50 rapid loads, confirm caching holds

### Launch day
Watch the Orders sheet directly. Keep a manual override ready: if something breaks, flip `promoActive` off and the site falls back to a working normal storefront rather than a broken promo.

### Post-August revert
1. Uncheck `promoActive` in Notion (or let `promoEnd` pass — it's automatic)
2. Set `announcementBar` to a normal message
3. Archive promo orders and review: claims, conversions to paid, cost per acquired customer

---

## Suggested sequencing

| | Work | Why this order |
|---|---|---|
| **1** | Phase 0 | Security and data loss. Non-negotiable. |
| **2** | Phase 1 + 2 | The switch and the caching are the foundation everything else sits on. |
| **3** | Phase 3 | Protects revenue and reputation during the promo. |
| **4** | Phase 4 | Polish — highest value, but only on a site that works. |
| **5** | Phase 5 | Test, launch, monitor. |

---

## Pricing display — no fixed prices

**Decision:** the site shows **price ranges only**. The firm quote is given in WhatsApp after the customer has confirmed the cake they want.

This is the right call for bespoke work — a 6" and a 12" of the "same" cake aren't the same product, and a single number either underquotes you or scares people off.

### The caveat that makes or breaks it
**A vague range is worse than no price at all.** "₦15,000 – ₦150,000" tells the customer nothing except that you might be expensive, and they leave. A range only works if it's *narrow and explained*.

So each cake shows:

- **A tight range** — "₦35,000 – ₦52,000" — not a 10× spread.
- **What the range depends on**, in one line: *"depends on size (6"–12") and finish."*
- **A concrete anchor:** *"most 8-inch orders land around ₦40,000."* This single line does more for conversion than the range itself — it gives people a number to react to.

If a cake genuinely spans 10× (weddings), split it into separate catalogue entries by tier rather than widening the range.

### Changes this requires

**Notion catalogue schema** — replace the single `Price` property with:

| Property | Type | Example |
|---|---|---|
| `Price From` | Number | `35000` |
| `Price To` | Number | `52000` |
| `Price Note` | Rich text | `depends on size and finish` |
| `Typical` | Rich text | `most 8" orders ≈ ₦40,000` |

**Frontend** — cake cards and the checkout modal render `From – To` plus the note. The line *"Final price confirmed on WhatsApp"* appears wherever a range does, so nobody feels baited.

**Configurator** — as the customer picks occasion, flavour and size, narrow the displayed range live. By the time they reach checkout the range should be tight, because you now know the size.

**Orders sheet** — store the quoted range in `Est. Price` (Phase 0.2), then a `Final Price` column you fill after the WhatsApp quote. Without this you have no record of what you actually charged, and no way to review margins after August.

### Trade-off, stated plainly
Ranges mean **more DMs per order**. That's the cost. During a 10-slot promo it's manageable and arguably good — every DM is a conversation. If August generates far more enquiries than you can answer, revisit this in September; it's a Notion schema change, not a rebuild.

---

## Resolved decisions

| Question | Answer |
|---|---|
| Fulfilment capacity | Workers available, cakes run simultaneously. **No per-week slot cap.** |
| Feedback collection | Form on the website → Apps Script → Sheets. Built so responses can later be surfaced on the site as testimonials. |
| Photography | **Both** — professional shoot before delivery, plus customer feedback/photos after. |
| Referral codes | Redeemed on the website (drives familiarity), **manual honouring for August**. Automation is post-launch. |
| Slot 10 reached | Waitlist form — captures the lead, offers early access to the next promo. |
| Prices | **Ranges only**, firm quote via WhatsApp. See above. |

### Feedback form — build note
Put it on the site (`/feedback` or a modal) rather than using Google Forms. Same Apps Script backend, posting to a `Feedback` sheet tab keyed by Order ID.

Fields: overall rating · taste · appearance · value · what would you improve · a testimonial quote · permission checkbox to publish quote + first name.

Why on-site rather than Google Forms: it's branded, it links back to the Order ID automatically, and the published-permission flag lives in the same system that renders testimonials — so Phase 4 social proof becomes a data pull instead of copy-paste.

---

## Researched price ranges (July 2026)

### What the Lagos market currently charges

| Size | Market range | Notes |
|---|---|---|
| 6" | ₦40,000 – ₦65,000 | Serves 4–8 |
| 8" | ₦70,000 – ₦100,000 | Serves 10–12. The most-ordered size. |
| 10" | ₦120,000 – ₦180,000 | Serves ~20 |
| 12" | from ₦180,000 | |
| 2-layer | ₦65,000 (budget) → ₦200,000+ | Huge spread by finish |
| 3-layer | ₦120,000 – ₦300,000 typical, up to ₦600,000 | |

Delivery across Lagos runs ₦3,000–₦12,000; same-day surcharges add ₦2,000–₦8,000.

**Important:** that upper band is Ikoyi/VI/Lekki premium-studio pricing. XtraFresh is a **new brand on the mainland** (Ogba/Ikeja/Ojodu) with no track record yet. Pricing at the premium band means competing on reputation you haven't built. Pricing at the ₦10–15k budget band means being read as low quality and never escaping it.

### Recommended XtraFresh pricing

Positioned roughly 20–25% under the premium studios — clearly good value, unmistakably not cheap.

| Size | Price From | Price To | Typical | Serves |
|---|---|---|---|---|
| **6"** | ₦35,000 | ₦48,000 | ₦40,000 | 4–8 |
| **8"** | ₦55,000 | ₦72,000 | ₦60,000 | 10–12 |
| **10"** | ₦85,000 | ₦115,000 | ₦95,000 | 18–22 |
| **12"** | ₦125,000 | ₦165,000 | ₦140,000 | 30–35 |
| **2-layer** | ₦140,000 | ₦195,000 | ₦160,000 | 40–60 |
| **3-layer** | ₦220,000 | ₦300,000 | ₦250,000 | 70–100 |

Ranges are tight (~35% spread), so they pass the "narrow and anchored" test above. Each still needs the one-line driver — *"depends on design detail and finish"* — plus the typical anchor.

**Delivery:** free in Ogba, Ikeja, Ojodu. Elsewhere in Lagos ₦4,000–₦10,000 by distance. Pickup always free.

### Raise these before you're tempted to discount
Nigerian food costs have moved sharply. Rebuild these numbers from *your* actual ingredient cost per cake and confirm your margin holds — the table above is market positioning, not your cost structure. If your true cost on an 8" exceeds ~₦25,000, the ₦60,000 anchor is too thin.

### Promo exposure at these prices
Your cap is 2 layers for weddings, 6"–12" otherwise. Worst realistic case — all 10 slots taken as 2-layer cakes — is roughly **₦1.6M at retail**, or about **₦500–600k in actual ingredient and labour cost**. A more likely mix (mostly 8"–10", one or two weddings) lands nearer **₦250–350k in real cost**.

**That number is your real marketing budget for August.** Decide now whether you're comfortable with it. If not, reduce slots from 10 to 6 — the scarcity works just as well and the story is identical.

---

## Remaining open questions

1. **Do the recommended prices match your costs?** Check against your real ingredient spend before these go live.
2. **Referral code format** — one shared code (`XTRA15`) is simple but untraceable; per-customer codes (`SARAH15`) tell you which claimant actually drove referrals. Recommend per-customer.
3. **Out-of-zone delivery** — is ₦4,000–₦10,000 by distance right, or do you want one flat fee? Flat is easier to display and easier to promise.

---

## Sources

- [Cake Prices In Lagos (2026 Guide) — Yefepere](https://www.yefepere.com/blog/cake-prices-in-lagos-2026-guide/)
- [Cake Prices In Nigeria: Updated 2026 Guide — Yefepere](https://www.yefepere.com/blog/cake-prices-in-nigeria-updated-2025-guide/)
- [Wedding Cake Prices in Nigeria 2026 — ElitePlanners.ng](https://eliteplanners.ng/blog/wedding-cake-prices-nigeria-2026)
- [Sizes of Cakes and Prices in Nigeria — Diva Cakes](https://divacakes.com.ng/sizes-cakes-prices-nigeria/)
- [Diva Cakes Price List & Addresses](https://divacakes.com.ng/price-list-addresses/)
- [Pay on Delivery Cakes in Ikeja — Yefepere](https://www.yefepere.com/locations/lagos/ikeja/cakes/)
