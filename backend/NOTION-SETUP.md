# Creating the Notion Databases — Step by Step

Written for someone who has used Notion but never set up a database for an API. Takes about 25 minutes.

Two jobs here:

- **Part A** — build the new `Site Settings` database *(the promo on/off switch)*
- **Part B** — add price properties to your existing `Catalog` database

---

# PART A — The `Site Settings` database

## Step 1 — Create a new page

1. In the Notion sidebar, hover over your workspace name and click **+**
2. A blank page opens with the cursor on the title
3. Type: **`XtraFresh Site Settings`**
4. Press **Enter** to move into the page body

## Step 2 — Turn it into a database

1. Type **`/database`**
2. A menu appears. Choose **`Database - Full page`**

   ⚠️ **Full page, not inline.** Inline databases make the ID much harder to copy in Step 6.

3. The page becomes a table with two columns: **`Name`** and **`Tags`**, and three empty rows.

## Step 3 — Clean up the defaults

**Delete the empty rows:**

1. Hover over the first row — a **⋮⋮** handle appears on the left
2. Click it → **Delete**
3. Repeat until **no rows remain**

**Delete the `Tags` column:**

1. Click the word **`Tags`** in the header
2. Click **Delete property** → confirm

Leave **`Name`** exactly as it is. It's the title property and cannot be removed.

## Step 4 — Add the 12 properties

For each one:

1. Click the **`+`** at the far right of the column headers
2. Type the property name **exactly** as shown below
3. Click **Type** and choose the type listed
4. Press **Esc** to close

> ### ⚠️ The single most important thing on this page
>
> **Names must match exactly, including capital letters.**
>
> `promoActive` ✅ — `PromoActive` ❌ — `Promo Active` ❌ — `promoactive` ❌
>
> The code looks for these strings letter for letter. A capital letter in the wrong place means the promo silently never switches on, with no error message telling you why. Copy and paste them rather than typing.

| # | Property name | Type |
|---|---|---|
| 1 | `promoActive` | Checkbox |
| 2 | `promoHeadline` | Text |
| 3 | `promoSubtext` | Text |
| 4 | `promoStart` | Date |
| 5 | `promoEnd` | Date |
| 6 | `promoSlots` | Number |
| 7 | `promoSlotsUsed` | Number |
| 8 | `leadDaysDefault` | Number |
| 9 | `leadDaysWedding` | Number |
| 10 | `promoZones` | Multi-select |
| 11 | `whatsappNumber` | Phone |
| 12 | `announcementBar` | Text |

**Notes:**

- "Text" appears in Notion's menu as **Text** (the API calls it `rich_text` — same thing)
- For **`promoZones`**, you create the options while filling the row in Step 5
- **Number** properties: leave the format as **Number**. Do *not* set it to Naira or currency — currency formatting can make the API return a string instead of a number, and the slot counter then stops working.

## Step 5 — Add your one and only row

Click **`+ New`** at the bottom of the table, then fill in every column:

| Property | Value |
|---|---|
| `Name` | `live` |
| `promoActive` | **Leave unchecked** ☐ |
| `promoHeadline` | `FREE CAKE — first 10 people only.` |
| `promoSubtext` | `Any cake, fully free, for August celebrations.` |
| `promoStart` | `August 1, 2026` |
| `promoEnd` | `August 31, 2026` |
| `promoSlots` | `10` |
| `promoSlotsUsed` | `0` |
| `leadDaysDefault` | `7` |
| `leadDaysWedding` | `14` |
| `promoZones` | `Ogba` `Ikeja` `Ojodu` |
| `whatsappNumber` | `+2349060009541` |
| `announcementBar` | `Baked fresh in Lagos every morning. Free delivery in Ogba, Ikeja & Ojodu.` |

**For `promoZones`:** click the cell, type `Ogba`, press **Enter** to create it. Then `Ikeja`, Enter. Then `Ojodu`, Enter. Press **Esc**.

**For the dates:** click the cell, pick the date in the calendar. Leave "End date" and "Include time" **off**.

> ### Leave `promoActive` unchecked for now
> The switch stays off until you've finished testing. If it's on while you test, your test orders consume real promo slots — and if the site is already live, real customers can claim cakes before you're ready.

> ### Only ever one row
> The code reads the **first** row and ignores everything else. If you add a second row to "try something", you won't get an error — you'll get behaviour from whichever row Notion happens to return first, which is maddening to debug.

## Step 6 — Connect your integration

**This is the step everyone forgets.** The database exists, but your script cannot see it until you do this. The error you'd get is "Could not find database with ID", which sounds like a wrong ID and sends you hunting in the wrong place.

1. Click the **`•••`** at the top right of the page
2. Scroll to **Connections**
3. Click **`+ Add connections`**
4. Find and select your integration *(the one whose token is in Script Properties)*
5. Confirm **Yes** if asked

Success looks like your integration's name now listed under Connections.

## Step 7 — Copy the database ID

1. Click **`•••`** at the top right → **Copy link**
2. Paste it somewhere you can read it. It looks like:

```
https://www.notion.so/myworkspace/24f0ef98397f4fd98b4123ccf40d9681?v=8b1c...
                                  └──────────── this part ────────────┘
```

3. **Take the 32 characters between the last `/` and the `?`.**

> ### The mistake almost everyone makes
> The `?v=...` at the end is the **view ID**, not the database ID. They look nearly identical. If you copy the wrong one you get "Could not find database" and will assume the connection failed — when actually the ID is just wrong.
>
> Rule: **everything before the `?`.**

If your link has dashes (`24f0ef98-397f-4fd9-8b41-23ccf40d9681`), that's fine — dashes work either way.

4. Save this as **`SETTINGS_DB_ID`** in Apps Script → Project Settings → Script Properties.

---

# PART B — Add prices to the `Catalog` database

Open your existing cake catalogue database.

## Step 1 — Add five properties

Same method: click **`+`** at the right of the headers.

| Property name | Type |
|---|---|
| `Price From` | Number |
| `Price To` | Number |
| `Typical` | Text |
| `Price Note` | Text |
| `Serves` | Text |

Again — leave Number format as plain **Number**, not currency.

## Step 2 — Fill in every cake

Using the researched pricing from `LAUNCH-PLAN.md`:

| Size | Price From | Price To | Typical | Serves |
|---|---|---|---|---|
| 6-inch | `35000` | `48000` | `Most 6-inch orders come to about ₦40,000` | `4–8 people` |
| 8-inch | `55000` | `72000` | `Most 8-inch orders come to about ₦60,000` | `10–12 people` |
| 10-inch | `85000` | `115000` | `Most 10-inch orders come to about ₦95,000` | `18–22 people` |
| 12-inch | `125000` | `165000` | `Most 12-inch orders come to about ₦140,000` | `30–35 people` |
| 2-layer | `140000` | `195000` | `Most 2-layer cakes come to about ₦160,000` | `40–60 people` |
| 3-layer | `220000` | `300000` | `Most 3-layer cakes come to about ₦250,000` | `70–100 people` |

`Price Note` for most cakes: **`Depends on design and finish`**

**Numbers only** in Price From / Price To — `55000`, not `₦55,000` and not `55,000`. Commas and symbols make Notion store it as text, and the site can't compare or display it properly.

## Step 3 — Keep the old `Price` column

Don't delete it yet. Leave it until the new site is live and confirmed working, then remove it.

## Step 4 — Confirm the connection

Same as Part A Step 6: **`•••` → Connections → + Add connections**. Do this for the **Blog** database too if you've never checked it.

---

# Check that it worked

In the Apps Script editor, choose **`setupHealthCheck`** from the function dropdown and click **Run**. Open the **Execution log**.

You want:

```
✅ All checks passed.
Settings OK. promoActive=false slots=0/10
Cakes found: 12
Blog posts found: 4
```

## If something's wrong

| Message | What it means | Fix |
|---|---|---|
| `Could not find database with ID` | The integration isn't connected, **or** you copied the view ID | Redo Part A Step 6, then re-check Step 7 |
| `Missing Script Property for: settingsDbId` | The property isn't saved in Apps Script | Project Settings → Script Properties |
| `Cakes found: 0` | Connected, but the database is empty or the ID points elsewhere | Check `CATALOG_DB_ID` |
| `promoActive=undefined` | Property name misspelled | Compare letter by letter against the table in Step 4 |
| `Unauthorized` | Token is wrong or was rotated | Re-copy the secret from Notion → Integrations |

---

# Three things that will break this later

**1. Never click "Add data source" on these databases.**
Notion changed its data model in September 2025 — a database can now hold multiple data sources. Our script uses the older API, which works fine with single-source databases but **immediately loses access** to any database with a second source added. The failure looks like "Could not find database" on a database you can plainly see. Don't add sources to Settings, Catalog, or Blog.

**2. Don't rename properties once the site is live.**
Renaming `promoSlots` to `Promo Slots` breaks the promo instantly and silently. If you need a friendlier label, change the *view's* column display, not the property name.

**3. Don't edit `promoSlotsUsed` by hand during the promo.**
The script writes to it after each claim. If you edit it at the same moment, one of the writes is lost and your count drifts. To read the count, just look. To reset it, use `setupResetPromoCounter` after testing.

---

# Once you're live

| To do this | Do this |
|---|---|
| **Start the promo** | Tick `promoActive` |
| **Stop it early** | Untick `promoActive` |
| **Let it end by itself** | Nothing — it stops after `promoEnd` |
| **Check slots left** | `promoSlots` − `promoSlotsUsed` |
| **Change the banner text** | Edit `promoHeadline` |
| **Change the WhatsApp number** | Edit `whatsappNumber` |
| **Post-August message** | Edit `announcementBar` |

All of it from your phone, in the Notion app. No code, no re-deploy.

---

**Sources:** [Notion API upgrade guide](https://developers.notion.com/docs/upgrade-faqs-2025-09-03) · [Notion databases and data sources explained](https://thomasjfrank.com/notion-databases-can-now-have-multiple-data-sources/)
