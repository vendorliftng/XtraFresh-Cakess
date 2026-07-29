# What's Left — Prioritised

The frontend is in good shape. What remains is mostly plumbing and testing — plus a few things that will bite you if nobody names them now.

---

## ⚠️ FIRST — stop re-entering your credentials

You're pasting them back every time I edit `Code.gs`. There's a permanent fix, and it also closes a real security hole.

### The hole
Your GitHub repo is **public**. If you paste your Notion token into `Code.gs` and push, the token is published to the internet. Bots scrape GitHub for exactly this within minutes. Whoever finds it can read and rewrite your entire catalogue and blog.

Right now `Code.gs` in your folder has placeholders, so nothing has leaked. Keep it that way.

### The fix — 3 minutes, once, and never again

The code already checks Script Properties *before* the file. So put the values there, leave the file as placeholders, and my edits stop touching your credentials entirely.

1. Apps Script → **⚙ Project Settings**
2. Scroll to **Script Properties** → **Edit script properties**
3. Add these four. **Names must be exactly this — capitals and underscores:**

| Property | Value |
|---|---|
| `NOTION_TOKEN` | *your Notion integration secret — never write it in this repo* |
| `CATALOG_DB_ID` | `48f0ef98397f4fd98b4123ccf40d9681` |
| `BLOG_DB_ID` | `9fe1eff143d14eb48dca35d97e4f73a1` |
| `SETTINGS_DB_ID` | `3aa8a6825ac48033b1bbc287d5641d6b` |

> The token lives in **two places only**: your Notion integration settings, and Apps Script Script Properties. Never in a file, never in this repo.

4. **Click "Save script properties".** ← This is what caught you last time. The values disappear if you navigate away without clicking it.
5. Run `setupHealthCheck`. You want to see:

```
NOTION_TOKEN = ntn_37…Ba5e (50 chars)   (from Script Property)
Script Properties found: NOTION_TOKEN, CATALOG_DB_ID, BLOG_DB_ID, SETTINGS_DB_ID
```

If it says *"from SETTINGS block in Code.gs"*, the properties didn't save — repeat step 4.

From then on: I send a new `Code.gs`, you paste the whole thing, nothing to re-enter.

> **Also rotate that token before launch.** It has now appeared in plaintext in our conversation several times. Rotating is one click in Notion, then one paste into Script Properties.

---

## 🔴 CRITICAL — do these before any test order

### 1. Update the Google Sheets headers
**This is the one most likely to be missed, and it silently corrupts every order.**

The new backend writes **20 columns** in a fixed order. If your `Orders` tab still has the old 9 headers, the data still gets written — into the wrong columns. Addresses land under "Allergies", dates under "Customer ID". You won't get an error. You'll just have a spreadsheet full of nonsense discovered mid-promo.

**`Orders` — row 1 must be exactly:**

```
Order ID | Order Date | Customer ID | Customer Name | Phone | Event Date |
Fulfilment | Address | Order Details | Occasion | Size | Flavour |
Inscription | Allergies | Source | Promo | Est. Price | Final Price |
Payment Link | Status
```

**`Customers` — row 1:**

```
Customer ID | Name | Phone | Date Joined | Total Orders | Last Order
```

Duplicate the spreadsheet first as a backup.

### 2. Set the script timezone
Project Settings → Time zone → **(GMT+01:00) Lagos**. Otherwise order timestamps and lead-time maths are hours off, and "1 week ahead" quietly becomes wrong near midnight.

### 3. Add the missing Notion properties

| Database | Property | Type | Why |
|---|---|---|---|
| Site Settings | `showPrices` | Checkbox | Prices stay hidden until ticked |
| Site Settings | `promoStart` | Date | **Currently 2026-06-28 — must be 2026-08-01** |

---

## 🟠 BEFORE LAUNCH

### 4. Test properly
Full table in `backend/SETUP.md`. The ones that matter most:

- Submit an order → check it lands in the **right columns**
- Double-tap submit → **one** row, not two
- Same phone twice as `0801…` then `+234801…` → one customer, not two
- Promo order 3 days out → rejected
- Wedding 10 days out → rejected
- Eleven promo claims → the eleventh is refused

**Then run `setupResetPromoCounter` and delete the test rows.** Otherwise your test orders have eaten real promo slots.

### 5. Put the site on real hosting
`file://` is not a fair test — different security rules, and you can't share it. Free options: **GitHub Pages** (you're already on GitHub — Settings → Pages → deploy from main), Netlify, or Cloudflare Pages. Point your new domain at it.

### 6. Real photographs
Your catalogue currently shows brides.com and publix.com stock images. That's legally risky and works against you — people ordering a cake want to see *your* cakes. Host them somewhere permanent (Cloudinary, imgbb — both free) and put the links in `Photo URL`.

### 7. WhatsApp link previews
When someone shares your site in a WhatsApp group — which is how this will actually spread in Lagos — the preview is currently blank. Add Open Graph tags and a 1200×630 preview image. **Small job, disproportionate effect on sharing.**

---

## 🟡 SOON AFTER

### 8. The feedback form
Every promo customer agreed to give feedback. The backend function (`saveFeedback`) exists; the form doesn't. Needed within a week of first delivery, while impressions are fresh.

### 9. Testimonials on the site
Feedback with "may publish" ticked should appear as social proof. This is the whole point of the giveaway — 10 free cakes buys you 10 testimonials, but only if they're visible.

### 10. Privacy policy and terms
You're collecting names, phone numbers and addresses. The footer links were removed rather than left pointing at `#`. Worth adding real pages.

### 11. Analytics
Without it you'll never know whether the promo worked. Google Analytics or Plausible, 10 minutes.

---

## Things you asked about that are already handled

- Promo on/off from Notion, with automatic revert after August
- "First 10" enforced server-side, not just claimed in copy
- Orders record what was actually ordered
- Duplicate submissions can't create two orders
- Lead times enforced on the server, not just the browser
- Phone numbers normalised so one customer isn't three records
- Prices hidden until you approve them
- Filters built from your real Notion data
- Blog reads the article from the Notion page body
- Images fall back gracefully when a link expires or is blocked

---

## Suggested order

1. Script Properties *(3 min — unblocks everything)*
2. Sheets headers + timezone *(10 min — prevents data corruption)*
3. Notion: `showPrices`, fix `promoStart` *(5 min)*
4. Test orders *(30 min)*
5. Reset promo counter, clear test rows *(2 min)*
6. Hosting + domain *(30 min)*
7. Real photos *(your time)*
8. WhatsApp preview tags *(I'll do it)*
9. **Tick `promoActive` — launch**
