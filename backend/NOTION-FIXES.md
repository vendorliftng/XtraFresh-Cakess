# Notion Fixes — Your To-Do List

All of these are content changes inside Notion, so they're yours to make — I can't reach your workspace. None require code changes; the site picks them up within 5 minutes.

About 15 minutes total.

---

## Who does what

| Task | Who |
|---|---|
| Renaming cakes, editing descriptions, fixing prices | **You** — it's your content, in your Notion |
| Property names, page layout, how data is displayed | **Me** — that's code |

The rule of thumb: **if you can see it and edit it in Notion, it's yours. If it's about how the website reads or shows it, it's mine.**

---

# FIX 1 — Rename "tier" to "layer" ⭐ most important

We agreed the whole site says *layer*, not *tier* — that's the word Lagos customers actually use. But your cake names still say "Tier", and those come straight from Notion onto the page. Right now the site contradicts itself.

## Steps

1. Open your **Catalog** database in Notion
2. Look down the **`Cake Name`** column for anything containing "Tier"
3. Click each one and retype it

| Change this | To this |
|---|---|
| `Two-Tier Grandeur` | `Two-Layer Grandeur` |
| *(any other "Tier" name)* | *"Layer"* |

4. **Also check these columns for the word "tier":**
   - `Short Description`
   - `Long Description`

   Your Two-Layer Grandeur long description mentions *"two-tier celebration cake"* — change it to *"two-layer celebration cake"*.

5. Same for **Occasions** or any select option using "tier"

> **Quick way to catch them all:** press `Ctrl+F` inside the database and search `tier`. Notion highlights every match.

---

# FIX 2 — Swap `Typical` and `Price Note`

These two are the wrong way round. Both display, so nothing is broken — but they read oddly.

**What you have now:**

| Property | Current value |
|---|---|
| `Typical` | *(empty)* |
| `Price Note` | `Most 8-inch orders come to about ₦60,000` |

**What it should be:**

| Property | Correct value |
|---|---|
| `Typical` | `Most 8-inch orders come to about ₦60,000` |
| `Price Note` | `Depends on design and finish` |

## Why the order matters

`Price Note` explains *why* the price is a range — it goes directly under the price and answers the customer's first question.

`Typical` is the **anchor** — one concrete number people can react to. It does more for conversion than the range itself, because a range alone reads as *we'll decide when we see you*.

## Steps

1. For each cake, cut the text out of `Price Note` and paste it into `Typical`
2. Type into `Price Note`: **`Depends on design and finish`**
3. For a 2-layer or 3-layer cake, use: **`Depends on design, finish and structure`**

Do this for every cake. The `Typical` sentence should name the actual size — a 10-inch cake shouldn't say *"most 8-inch orders…"*.

---

# FIX 3 — Two things about photos

## 3a. Use `Photo URL`, not `Cake Photo`

Your Two-Layer Grandeur is using a file uploaded into Notion. Its link looks like:

```
https://prod-files-secure.s3.us-west-2.amazonaws.com/...&x-id=GetObject
```

**Those links expire after about an hour.** Notion generates a temporary signed URL each time the API is called. The site re-fetches every 5 minutes so it mostly keeps up, but if someone leaves your page open, the cake photos turn into broken images.

**Do this instead:** put a permanent link in the **`Photo URL`** column.

Where to get permanent links:
- **Your own Instagram/website images** — right-click → *Copy image address*
- **Cloudinary or imgkit** — free, built for this
- **Unsplash** — fine as a placeholder before your real photos exist

I've already set the code to prefer `Photo URL` and fall back to `Cake Photo`, so nothing breaks either way. But every cake should have a `Photo URL`.

## 3b. Delete the old `Price` column — but not yet

You still have `Price` (₦65,000) sitting beside `Price From` (₦55,000) and `Price To` (₦72,000). The code ignores it in favour of the range.

**Leave it until the new site is live and confirmed working.** Then delete it, so nobody edits the wrong one in six months' time.

---

# FIX 4 — The blog

Blog posts *are* loading — the diagnostic found 4 of them. The problem is I don't know what your blog's property names are, so I guessed.

## Steps

1. Refresh the site
2. Press **F12** → **Console**
3. Type `xtraCheck()` and press **Enter**
4. Find the line that says:

```
Blog property names Notion is sending: ... | ... | ...
```

5. **Send me that line.** I'll map the blog properly in one edit.

---

# When you're done

1. Wait 5 minutes *(the site caches Notion data)* — or run `setupClearCache` in Apps Script to see it instantly
2. Refresh the site
3. Check that:
   - [ ] No cake name or description says "tier"
   - [ ] Prices show as a range, with the "most X-inch orders…" line beneath
   - [ ] Cake photos load and stay loaded
   - [ ] Blog posts show titles and images

---

# Still to come, so you're not surprised

| | What | Who |
|---|---|---|
| 1 | Map the blog properly | Me — once you send the property names |
| 2 | Rewrite `store.html` — still has the old copy, prices and "tier" | Me |
| 3 | Fill `Price From` / `Price To` / `Serves` for **every** cake, not just one | You |
| 4 | Test order end-to-end, then `setupResetPromoCounter` | Both |
| 5 | Put the site on real hosting — `file://` isn't a fair test | Me to advise, you to click |
| 6 | Tick `promoActive` and launch | You |

**Don't tick `promoActive` until step 4 is done.** Test orders will otherwise eat real promo slots, and if the site is already public, people can claim cakes before you're ready.
