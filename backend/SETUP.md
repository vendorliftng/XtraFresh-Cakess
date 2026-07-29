# Backend Setup

Do these in order. Should take about 30 minutes. The new `Code.gs` will not run until steps 1–4 are done.

---

## 1. Notion — create the `Site Settings` database

New database, **one row only**. This is the switch that turns the promo on and off.

| Property name | Type | Value to enter now |
|---|---|---|
| `Name` | Title | `live` |
| `promoActive` | Checkbox | ☐ *(leave OFF until you're ready)* |
| `promoHeadline` | Text | `FREE CAKE — first 10 people only.` |
| `promoSubtext` | Text | `Any cake, fully free, for August celebrations.` |
| `promoStart` | Date | `2026-08-01` |
| `promoEnd` | Date | `2026-08-31` |
| `promoSlots` | Number | `10` |
| `promoSlotsUsed` | Number | `0` |
| `leadDaysDefault` | Number | `7` |
| `leadDaysWedding` | Number | `14` |
| `promoZones` | Multi-select | `Ogba`, `Ikeja`, `Ojodu` |
| `whatsappNumber` | Phone | `+2349060009541` |
| `announcementBar` | Text | `Baked fresh in Lagos every morning. Free delivery in Ogba, Ikeja & Ojodu.` |

⚠️ **Spelling matters.** The code reads these names exactly as written — `promoActive`, not `Promo Active`.

Then: **⋯ menu → Connections → add your integration.** Without this, Notion returns "object not found" even though the database exists. Do the same for your Catalog and Blog databases if you haven't.

Copy the database ID from the URL:
`notion.so/workspace/`**`48f0ef98397f4fd98b4123ccf40d9681`**`?v=...`

---

## 2. Notion — add price properties to the Catalog database

Replace the single `Price` property with:

| Property | Type | Example |
|---|---|---|
| `Price From` | Number | `55000` |
| `Price To` | Number | `72000` |
| `Typical` | Text | `Most 8-inch orders come to about ₦60,000` |
| `Price Note` | Text | `Depends on design and finish` |
| `Serves` | Text | `10–12 people` |

Fill these using the recommended table in `LAUNCH-PLAN.md`. Keep the old `Price` column until the new site is live, then delete it.

---

## 3. Google Sheets — update your tabs

### `Orders` — replace row 1 with these 20 headers

```
Order ID | Order Date | Customer ID | Customer Name | Phone | Event Date |
Fulfilment | Address | Order Details | Occasion | Size | Flavour |
Inscription | Allergies | Source | Promo | Est. Price | Final Price |
Payment Link | Status
```

**Columns I–M are the fix for the biggest problem in the old system** — until now the sheet never recorded what anyone actually ordered.

`Final Price` is yours to fill in after you quote on WhatsApp. Without it you cannot review margins after August.

### `Customers` — add one column

```
Customer ID | Name | Phone | Date Joined | Total Orders | Last Order
```

`Last Order` (column F) is new.

### `Feedback` — the script creates this automatically

Leave it; it appears with the right headers on the first submission.

> **Back up first.** Duplicate the whole spreadsheet before changing headers.

---

## 4. Apps Script — Script Properties

Open the script → **⚙ Project Settings** → scroll to **Script Properties** → **Add script property**:

| Property | Value |
|---|---|
| `NOTION_TOKEN` | your Notion secret |
| `CATALOG_DB_ID` | `48f0ef98397f4fd98b4123ccf40d9681` |
| `BLOG_DB_ID` | `9fe1eff143d14eb48dca35d97e4f73a1` |
| `SETTINGS_DB_ID` | *(from step 1)* |
| `ORDER_COUNTER` | `0` |

The token is no longer written in the code. When you rotate it at domain launch, you change it here — nothing else.

Also set the timezone: **Project Settings → Time zone → (GMT+01:00) Lagos**. Order dates will be wrong otherwise.

---

## 5. Paste in the new code

Replace everything in `Code.gs` with the contents of `backend/Code.gs`, then save.

---

## 6. Run the setup functions

In the editor's function dropdown:

1. **`setupAuthorise`** → Run → accept the Google permission prompts (the "unverified app" warning is expected — it's your own script; choose *Advanced → Go to project*).
2. **`setupHealthCheck`** → Run → open **Execution log**.

You want:

```
✅ All checks passed.
Settings OK. promoActive=false slots=0/10
Cakes found: 12
Blog posts found: 4
```

If you see ❌, the message names the exact missing property or tab. Fix and re-run.

---

## 7. Deploy

**Deploy → New deployment → Web app**

- Execute as: **Me**
- Who has access: **Anyone**

Copy the `/exec` URL. If it differs from the one in `index.html`, update `API_URL` there.

> **Every time you edit `Code.gs`, you must Deploy → *Manage deployments* → edit → Version: *New version*.** Saving alone changes nothing on the live site. This catches everyone at least once.

---

## Testing before launch

Run through this properly — it's the difference between a launch and an incident.

| # | Test | Expected |
|---|---|---|
| 1 | Submit a normal order | New row in Orders, **with cake details in column I** |
| 2 | Submit again, same phone | Customers row updates — no duplicate |
| 3 | Enter phone as `0801...` then `+234801...` | Both match the same customer |
| 4 | Double-tap submit | **One** order row, not two |
| 5 | Promo order, event 3 days away | Rejected: needs 1 week |
| 6 | Wedding, event 10 days away | Rejected: needs 2 weeks |
| 7 | Promo order, event in September | Rejected: outside August |
| 8 | Submit 10 promo orders, then an 11th | 11th returns `PROMO_FULL` |
| 9 | Uncheck `promoActive` | Promo submissions rejected |
| 10 | Wrong `CATALOG_DB_ID` on purpose | Site still loads; blog and settings unaffected |
| 11 | Load the page ~10 times quickly | Fast after the first — caching working |

**After testing, run `setupResetPromoCounter`.** Your test orders will otherwise have consumed real promo slots — and delete the test rows from the Orders sheet.

---

## Day-to-day

| To do this | Do this |
|---|---|
| Turn the promo on | Tick `promoActive` in Notion |
| Turn the promo off | Untick it — or just let `promoEnd` pass, it's automatic |
| Publish a catalogue change immediately | Run `setupClearCache` (otherwise it appears within 5 minutes) |
| Change the WhatsApp number | Edit `whatsappNumber` in Notion — no code change |
| Change the announcement bar | Edit `announcementBar` in Notion |
| Check slots remaining | Look at `promoSlotsUsed` in Notion |

---

## Two things to be careful about

**Don't set a `Content-Type` header on the frontend `fetch`.** Apps Script cannot answer CORS preflight requests. The current code sends the body without an explicit content type, which keeps it a "simple request" and avoids preflight entirely. Adding `'Content-Type': 'application/json'` will break every order with a CORS error that looks like a network fault.

**Apps Script allows 20,000 URL fetches per day.** Caching is what keeps a good launch day from exhausting that quota. Don't reduce `CACHE_SECONDS` below 300 without a reason.
