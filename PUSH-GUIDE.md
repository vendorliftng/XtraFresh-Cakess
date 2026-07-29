# How to Push Your Changes to GitHub

Your repo is already connected — branch `main`, remote `vendorliftng/XtraFresh-Cakess`. You just need to send the changes up.

Two ways. **Pick option A unless you already use the command line.**

---

## ⛔ Before you push — 10 seconds

**Never let your Notion token reach GitHub.** Your repo is public; bots scrape it for secrets within minutes.

Open `backend/Code.gs` and confirm line ~31 still reads:

```javascript
NOTION_TOKEN:   'PASTE_YOUR_NOTION_TOKEN_HERE',
```

If your real token is there, replace it with the placeholder before pushing. Your credentials live in Apps Script Script Properties now, so the site keeps working.

*(I've already checked every other file — they're clean.)*

---

# OPTION A — GitHub Desktop (recommended)

No commands, and it shows you exactly what's changing before it goes out.

### First time only
1. Download **GitHub Desktop** from [desktop.github.com](https://desktop.github.com) and install
2. Open it → **Sign in to GitHub.com** → sign in with the `vendorliftng` account
3. **File → Add local repository**
4. Choose: `C:\Users\HomePC\Documents\XtraFresh Cakes\XtraFresh 3.0\XtraFresh-Cakess`
5. Click **Add repository**

### Every time you want to push
1. Open GitHub Desktop — changed files are listed on the left
2. **Click through a few** and read the coloured diff. Green is added, red is removed. Worth 30 seconds.
3. Bottom left, type a summary, e.g.:
   `New backend, Lagos copy, store filters, SEO`
4. Click **Commit to main**
5. Click **Push origin** (top bar)

Done. Refresh your GitHub page and the files are there.

---

# OPTION B — Command line

### First time only: authentication
GitHub stopped accepting passwords. You need a **Personal Access Token**:

1. GitHub → your avatar → **Settings**
2. Bottom left: **Developer settings**
3. **Personal access tokens → Tokens (classic)** → **Generate new token (classic)**
4. Note: `XtraFresh laptop` · Expiration: 90 days · Tick **`repo`**
5. **Generate token** and copy it — it's shown once
6. When git asks for a password, paste this token instead

### Every time
Open **Command Prompt** or **PowerShell**:

```bash
cd "C:\Users\HomePC\Documents\XtraFresh Cakes\XtraFresh 3.0\XtraFresh-Cakess"
```

*(The quotes are required — the path has spaces.)*

**1. See what changed**

```bash
git status
```

**2. Review the actual edits** *(optional but wise)*

```bash
git diff index.html
```

Press `q` to exit.

**3. Stage everything**

```bash
git add -A
```

**4. Commit with a message**

```bash
git commit -m "New backend, Lagos copy, store filters, SEO and link previews"
```

**5. Push**

```bash
git push
```

Username: `vendorliftng` · Password: **paste your token**, not your password.

---

## What will be uploaded

**Changed**
- `index.html` — Lagos copy, promo mode, price switch, blog reader, SEO
- `store.html` — filters, search, quick view, SEO

**New**
- `backend/Code.gs` — the Apps Script (reference copy)
- `backend/SETUP.md`, `NOTION-SETUP.md`, `NOTION-FIXES.md`
- `LAUNCH-PLAN.md`, `COPY.md`, `NEXT-STEPS.md`, `PUSH-GUIDE.md`
- `og-image.jpg`, `robots.txt`, `sitemap.xml`

You may also see mode changes on `package.json`, `server.ts` and similar. That's a file-permission quirk, not a content change. Harmless. To silence it:

```bash
git config core.fileMode false
```

---

## Then: turn on GitHub Pages

Since your domain is `xtrafreshcakes.com` and every SEO tag already points there:

1. GitHub → your repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** · Folder: **/ (root)** → **Save**
4. Wait 1–2 minutes → live at `vendorliftng.github.io/XtraFresh-Cakess/`

### Connect your domain
1. Same Pages screen → **Custom domain** → enter `xtrafreshcakes.com` → **Save**
2. At your domain registrar, add these DNS records:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `vendorliftng.github.io` |

3. DNS takes 10 minutes to a few hours
4. Back on the Pages screen, tick **Enforce HTTPS** once it's available

> GitHub Pages adds a `CNAME` file to your repo when you set the custom domain. Leave it alone — deleting it unlinks the domain.

---

## Common problems

| Message | Meaning | Fix |
|---|---|---|
| `Authentication failed` | Used your password | Use the token as the password |
| `rejected — fetch first` | Repo changed elsewhere | `git pull` then push again |
| `nothing to commit` | No changes detected | You're already up to date |
| `not a git repository` | Wrong folder | Re-run the `cd` command with quotes |
| Push blocked, secret detected | A token is in a file | Remove it, commit again |

---

## After it's live — test the link preview

1. Open [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug/)
2. Paste `https://xtrafreshcakes.com` → **Debug**
3. You should see the XtraFresh card
4. Send the link to yourself on WhatsApp to confirm

**WhatsApp caches previews hard.** If it looks wrong, click **Scrape Again** in the debugger — otherwise the wrong version can stick around for days.
