/**
 * XtraFresh Cakes — Backend
 * Google Apps Script, bound to the Orders spreadsheet.
 *
 * Handles: reading the Notion catalogue/blog/settings, saving orders and
 * customers to Sheets, and enforcing the August promo slot limit.
 *
 * SETUP: fill in the SETTINGS block below, then run setupHealthCheck.
 *
 * Deploy as: Web app · Execute as ME · Who has access: ANYONE
 * Re-deploy as a NEW VERSION every time you edit this file, or your
 * changes will not go live.
 */

// ============================================================
// CONFIG
// ============================================================

/**
 * ┌──────────────────────────────────────────────────────────────┐
 * │  PASTE YOUR DETAILS HERE                                     │
 * │                                                              │
 * │  Fill these four in and everything works. Keep the quotes.   │
 * │                                                              │
 * │  At domain launch, move them to Script Properties (see the   │
 * │  note under SECRETS below) so they are not sitting in the    │
 * │  file. Until then, this is fine.                             │
 * └──────────────────────────────────────────────────────────────┘
 */
var SETTINGS = {
  NOTION_TOKEN:   'PASTE_YOUR_NOTION_TOKEN_HERE',
  CATALOG_DB_ID:  'PASTE_YOUR_CATALOG_DATABASE_ID_HERE',
  BLOG_DB_ID:     'PASTE_YOUR_BLOG_DATABASE_ID_HERE',
  SETTINGS_DB_ID: 'PASTE_YOUR_SITE_SETTINGS_DATABASE_ID_HERE'
};

/**
 * SECRETS
 * If a Script Property exists with the same name, it wins over the value
 * above. So to move a secret out of this file later, just add the Script
 * Property — no code change needed.
 */
function setting(name) {
  var fromProperties = PropertiesService.getScriptProperties().getProperty(name);
  if (fromProperties && String(fromProperties).trim()) return String(fromProperties).trim();

  var fromFile = SETTINGS[name];
  if (fromFile && String(fromFile).indexOf('PASTE_') !== 0) return String(fromFile).trim();

  return null;   // not set in either place
}

function cfg() {
  return {
    notionToken:   setting('NOTION_TOKEN'),
    catalogDbId:   setting('CATALOG_DB_ID'),
    blogDbId:      setting('BLOG_DB_ID'),
    settingsDbId:  setting('SETTINGS_DB_ID'),
    notionVersion: '2022-06-28',
    timezone:      'Africa/Lagos'
  };
}

var CACHE_SECONDS = 300;        // 5 minutes
var IDEMPOTENCY_SECONDS = 900;  // 15 minutes
var LOCK_TIMEOUT_MS = 25000;

// ============================================================
// GET — the website reads everything from here
// ============================================================

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAll';

    switch (action) {
      case 'getAll':
        // One round-trip instead of three. This is what the site calls.
        return json({
          status: 'success',
          settings: safely(getSettings, {}),
          cakes:    safely(getCakes, []),
          blog:     safely(getBlog, []),
          serverTime: nowLagos()
        });

      case 'getSettings': return json({ status: 'success', data: getSettings() });
      case 'getCakes':    return json({ status: 'success', data: getCakes() });
      case 'getBlog':     return json({ status: 'success', data: getBlog() });
      case 'getSlots':    return json({ status: 'success', data: slotStatus() });

      // Full article text, read from the body of the Notion page itself.
      case 'getPost':
        return json({ status: 'success', data: getPostText(e.parameter.id) });

      // Published customer reviews, for the testimonials section.
      case 'getTestimonials':
        return json({ status: 'success', data: getTestimonials() });

      // Confirms an order number exists, so the feedback form can greet
      // the customer by name instead of asking them to retype everything.
      case 'lookupOrder':
        return json({ status: 'success', data: lookupOrder(e.parameter.id) });

      default:
        return json({ status: 'error', code: 'UNKNOWN_ACTION' });
    }
  } catch (err) {
    log('doGet failed', err);
    // Never leak internals to a customer's browser.
    return json({ status: 'error', code: 'SERVER_ERROR' });
  }
}

/** Runs fn, and returns fallback instead of throwing. One dead section must
 *  never take down the whole page. */
function safely(fn, fallback) {
  try { return fn(); } catch (err) { log('section failed', err); return fallback; }
}

// ============================================================
// POST — orders come in here
// ============================================================

function doPost(e) {
  var lock = LockService.getScriptLock();

  try {
    var data = JSON.parse(e.postData.contents);

    // Feedback posts to the same URL — route it before any order logic runs.
    if (data.type === 'feedback') return json(saveFeedback(data));

    // --- Idempotency: same submission twice returns the first result -------
    var cache = CacheService.getScriptCache();
    var reqId = String(data.clientRequestId || '');
    if (reqId) {
      var seen = cache.get('req_' + reqId);
      if (seen) return json(JSON.parse(seen));   // duplicate — replay the answer
    }

    // --- Validate before touching anything --------------------------------
    var v = validateOrder(data);
    if (!v.ok) return json({ status: 'error', code: v.code, message: v.message });

    var isPromo = (data.promoClaimed === true || data.promoClaimed === 'Yes');

    // --- Everything below writes, so serialise it -------------------------
    if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
      return json({ status: 'error', code: 'BUSY', message: 'Please try again in a moment.' });
    }

    // Promo slots are checked INSIDE the lock, so two people cannot both
    // take slot 10.
    var slots = null;
    if (isPromo) {
      slots = slotStatus();
      if (!slots.promoActive)   return json({ status: 'error', code: 'PROMO_INACTIVE' });
      if (slots.remaining <= 0) return json({ status: 'full',  code: 'PROMO_FULL', data: slots });
    }

    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var customerId = upsertCustomer(doc, data);
    var orderId    = nextOrderId();

    appendOrder(doc, orderId, customerId, data, isPromo);

    if (isPromo) {
      incrementPromoSlots();          // only after the order is safely written
      cache.remove('slots');
    }

    var result = {
      status: 'success',
      orderId: orderId,
      customerId: customerId,
      isPromo: isPromo,
      slotsRemaining: isPromo ? Math.max(0, slots.remaining - 1) : null
    };

    if (reqId) cache.put('req_' + reqId, JSON.stringify(result), IDEMPOTENCY_SECONDS);
    return json(result);

  } catch (err) {
    log('doPost failed', err);
    return json({ status: 'error', code: 'SERVER_ERROR',
                  message: 'We could not save your order. Please try again.' });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

// ============================================================
// VALIDATION  (server-side — the browser checks are only a courtesy)
// ============================================================

function validateOrder(d) {
  if (!d.customerName || String(d.customerName).trim().length < 2)
    return bad('NAME_REQUIRED', 'Please enter your name.');

  var phone = normalisePhone(d.customerPhone);
  if (!phone) return bad('PHONE_INVALID', 'Please enter a valid Nigerian phone number.');
  d.customerPhone = phone;   // store the canonical form

  if (!d.deliveryDate) return bad('DATE_REQUIRED', 'Please choose a date.');

  var wantsDelivery = (d.fulfilment !== 'pickup');
  if (wantsDelivery && (!d.deliveryAddress || String(d.deliveryAddress).trim().length < 8))
    return bad('ADDRESS_REQUIRED', 'Please enter your full delivery address.');

  var isPromo = (d.promoClaimed === true || d.promoClaimed === 'Yes');
  if (isPromo) {
    var s = getSettings();
    var event = parseDate(d.deliveryDate);
    if (!event) return bad('DATE_INVALID', 'That date is not valid.');

    var isWedding = /wedding/i.test(String(d.occasion || '') + String(d.orderDetails || ''));
    var leadDays  = isWedding ? (s.leadDaysWedding || 14) : (s.leadDaysDefault || 7);

    var earliest = addDays(startOfToday(), leadDays);
    if (event < earliest) {
      return bad('LEAD_TIME', isWedding
        ? 'Wedding cakes need at least 2 weeks. Please choose a later date.'
        : 'We need at least 1 week to bake. Please choose a later date.');
    }

    var from = parseDate(s.promoStart), to = parseDate(s.promoEnd);
    if (from && event < from) return bad('OUT_OF_WINDOW', 'The free cake offer only covers events in August 2026.');
    if (to   && event > to)   return bad('OUT_OF_WINDOW', 'The free cake offer only covers events in August 2026.');
  }

  return { ok: true };
}

function bad(code, message) { return { ok: false, code: code, message: message }; }

/** 0801..., +234801..., 234801..., 801... → 234801... */
function normalisePhone(raw) {
  var s = String(raw || '').replace(/[^0-9]/g, '');
  if (s.indexOf('234') === 0) s = s.substring(3);
  else if (s.indexOf('0') === 0) s = s.substring(1);
  if (s.length !== 10) return null;      // Nigerian mobiles are 10 digits after the prefix
  if (s.charAt(0) !== '7' && s.charAt(0) !== '8' && s.charAt(0) !== '9') return null;
  return '234' + s;
}

// ============================================================
// SHEETS
// ============================================================

/**
 * Customers tab:
 * A Customer ID · B Name · C Phone · D Date Joined · E Total Orders · F Last Order
 */
function upsertCustomer(doc, d) {
  var sheet = doc.getSheetByName('Customers');
  var rows  = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (normalisePhone(rows[i][2]) === d.customerPhone) {
      var total = Number(rows[i][4]) || 0;
      sheet.getRange(i + 1, 5).setValue(total + 1);
      sheet.getRange(i + 1, 6).setValue(new Date());
      return rows[i][0];
    }
  }

  var id = 'CUST-' + Utilities.getUuid().substring(0, 5).toUpperCase();
  sheet.appendRow([id, d.customerName, d.customerPhone, new Date(), 1, new Date()]);
  return id;
}

/**
 * Orders tab:
 * A Order ID · B Order Date · C Customer ID · D Customer Name · E Phone
 * F Event Date · G Fulfilment · H Address · I Order Details · J Occasion
 * K Size · L Flavour · M Inscription · N Allergies · O Source
 * P Promo · Q Est. Price · R Final Price · S Payment Link · T Status
 *
 * Order Details is the column the old version was missing entirely — without
 * it the sheet could not tell you what anyone had actually ordered.
 */
function appendOrder(doc, orderId, customerId, d, isPromo) {
  doc.getSheetByName('Orders').appendRow([
    orderId,
    new Date(),
    customerId,
    d.customerName,
    d.customerPhone,
    d.deliveryDate,
    d.fulfilment || 'delivery',
    d.deliveryAddress || '',
    d.orderDetails || '',
    d.occasion || '',
    d.size || '',
    d.flavour || '',
    d.inscription || '',
    d.allergies || 'None',
    d.source || 'website',
    isPromo ? 'FREE CAKE PROMO' : 'None',
    d.estPrice || '',
    '',                    // Final Price — you fill this after quoting
    '',                    // Payment Link
    'Pending'
  ]);
}

/** ORD-260727-001 — sequential, readable, no collisions. */
function nextOrderId() {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty('ORDER_COUNTER') || 0) + 1;
  props.setProperty('ORDER_COUNTER', String(n));
  var stamp = Utilities.formatDate(new Date(), cfg().timezone, 'yyMMdd');
  return 'ORD-' + stamp + '-' + padLeft(n, 3);
}

// ============================================================
// PROMO SLOTS
// ============================================================

function slotStatus() {
  var s = getSettings();
  var total = Number(s.promoSlots) || 0;
  var used  = Number(s.promoSlotsUsed) || 0;

  var active = !!s.promoActive;
  var end = parseDate(s.promoEnd);
  if (end && startOfToday() > end) active = false;   // auto-revert after August

  return {
    promoActive: active,
    total: total,
    used: used,
    remaining: Math.max(0, total - used)
  };
}

function incrementPromoSlots() {
  var s = getSettings();
  var used = (Number(s.promoSlotsUsed) || 0) + 1;
  updateNotionNumber(s._pageId, 'promoSlotsUsed', used);
  CacheService.getScriptCache().remove('settings');
}

// ============================================================
// NOTION
// ============================================================

function getSettings() {
  var cached = CacheService.getScriptCache().get('settings');
  if (cached) return JSON.parse(cached);

  var rows = queryNotion(cfg().settingsDbId, true);
  var s = rows.length ? rows[0] : {};
  CacheService.getScriptCache().put('settings', JSON.stringify(s), 60); // short — slots change
  return s;
}

function getCakes() { return cachedQuery('cakes_v2', cfg().catalogDbId, false); }

// Blog rows carry their page id so the site can fetch the full article.
// NOTE: the _v2 suffix matters. Changing the key throws away cache written by
// an older version of this file — otherwise rows saved before the page-id
// change keep being served and "Read more" finds nothing to open.
function getBlog()  { return cachedQuery('blog_v2',  cfg().blogDbId, true); }

function cachedQuery(key, dbId, withPageId) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var rows = queryNotion(dbId, !!withPageId);
  try {
    cache.put(key, JSON.stringify(rows), CACHE_SECONDS);
  } catch (err) {
    log('cache too large for ' + key, err);   // >100KB — still return the data
  }
  return rows;
}

function queryNotion(databaseId, includePageId) {
  if (!databaseId) throw new Error('Missing database id');

  var res = UrlFetchApp.fetch(
    'https://api.notion.com/v1/databases/' + databaseId + '/query',
    {
      method: 'post',
      headers: {
        'Authorization':  'Bearer ' + cfg().notionToken,
        'Notion-Version': cfg().notionVersion,
        'Content-Type':   'application/json'
      },
      payload: JSON.stringify({ page_size: 100 }),
      muteHttpExceptions: true
    }
  );

  var body = JSON.parse(res.getContentText());
  if (body.object === 'error') throw new Error('Notion: ' + body.message);

  return (body.results || []).map(function (page) {
    var row = simplify(page.properties);
    if (includePageId) row._pageId = page.id;
    return row;
  });
}

function updateNotionNumber(pageId, propertyName, value) {
  if (!pageId) throw new Error('No page id — cannot update ' + propertyName);

  var payload = { properties: {} };
  payload.properties[propertyName] = { number: value };

  var res = UrlFetchApp.fetch('https://api.notion.com/v1/pages/' + pageId, {
    method: 'patch',
    headers: {
      'Authorization':  'Bearer ' + cfg().notionToken,
      'Notion-Version': cfg().notionVersion,
      'Content-Type':   'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var body = JSON.parse(res.getContentText());
  if (body.object === 'error') throw new Error('Notion update: ' + body.message);
}

/**
 * Reads the body of a Notion page and returns it as simple blocks the site
 * can render. This is where blog articles actually live — page content is
 * not exposed as a database property.
 */
function getPostText(pageId) {
  if (!pageId) throw new Error('No page id supplied');

  var key = 'post_' + String(pageId).replace(/-/g, '').substring(0, 24);
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var res = UrlFetchApp.fetch(
    'https://api.notion.com/v1/blocks/' + pageId + '/children?page_size=100',
    {
      method: 'get',
      headers: {
        'Authorization':  'Bearer ' + cfg().notionToken,
        'Notion-Version': cfg().notionVersion
      },
      muteHttpExceptions: true
    }
  );

  var body = JSON.parse(res.getContentText());
  if (body.object === 'error') throw new Error('Notion: ' + body.message);

  var blocks = [];
  (body.results || []).forEach(function (b) {
    var type = b.type;
    var node = b[type];
    if (!node) return;

    // Images carry a URL rather than text.
    if (type === 'image') {
      var url = node.type === 'file' ? node.file.url : node.external.url;
      if (url) blocks.push({ type: 'image', text: url });
      return;
    }

    if (type === 'divider') { blocks.push({ type: 'divider', text: '' }); return; }

    var rich = node.rich_text;
    if (!rich || !rich.length) return;
    var text = rich.map(function (t) { return t.plain_text; }).join('');
    if (!text.trim()) return;

    switch (type) {
      case 'heading_1': blocks.push({ type: 'h1', text: text }); break;
      case 'heading_2': blocks.push({ type: 'h2', text: text }); break;
      case 'heading_3': blocks.push({ type: 'h3', text: text }); break;
      case 'bulleted_list_item': blocks.push({ type: 'li', text: text }); break;
      case 'numbered_list_item': blocks.push({ type: 'ol', text: text }); break;
      case 'to_do': blocks.push({ type: 'todo', text: text, checked: !!node.checked }); break;
      case 'quote':
      case 'callout': blocks.push({ type: 'quote', text: text }); break;
      case 'code': blocks.push({ type: 'p', text: text }); break;
      case 'toggle': blocks.push({ type: 'h3', text: text }); break;
      default: blocks.push({ type: 'p', text: text });
    }
  });

  try { cache.put(key, JSON.stringify(blocks), CACHE_SECONDS); } catch (err) { log('post cache', err); }
  return blocks;
}

/** Notion's nested property format → a flat object the website can use. */
function simplify(properties) {
  var out = {};
  for (var key in properties) {
    var p = properties[key];
    switch (p.type) {
      case 'title':
        out[key] = p.title.length ? p.title.map(t => t.plain_text).join('') : '';
        break;
      case 'rich_text':
        out[key] = p.rich_text.length ? p.rich_text.map(t => t.plain_text).join('') : '';
        break;
      case 'number':   out[key] = p.number; break;
      case 'checkbox': out[key] = p.checkbox; break;
      case 'select':   out[key] = p.select ? p.select.name : ''; break;
      case 'status':   out[key] = p.status ? p.status.name : ''; break;
      case 'phone_number': out[key] = p.phone_number || ''; break;
      case 'url':      out[key] = p.url || ''; break;
      case 'email':    out[key] = p.email || ''; break;
      case 'multi_select':
        out[key] = p.multi_select.map(s => s.name);
        break;
      case 'date':
        out[key] = p.date ? p.date.start : '';
        break;
      case 'files':
        out[key] = p.files.length
          ? (p.files[0].type === 'file' ? p.files[0].file.url : p.files[0].external.url)
          : '';
        break;
    }
  }
  return out;
}

// ============================================================
// FEEDBACK  (promo condition #1 — see LAUNCH-PLAN.md)
// ============================================================

function saveFeedback(d) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName('Feedback');
  if (!sheet) sheet = doc.insertSheet('Feedback');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp','Order ID','Name','Overall','Taste','Appearance',
                     'Value','Improve','Testimonial','May Publish']);
  }

  if (!d.overall) return { status: 'error', code: 'RATING_REQUIRED' };

  sheet.appendRow([
    new Date(), d.orderId || '', d.name || '',
    d.overall || '', d.taste || '', d.appearance || '', d.value || '',
    d.improve || '', d.testimonial || '', d.mayPublish ? 'Yes' : 'No'
  ]);

  CacheService.getScriptCache().remove('testimonials');
  return { status: 'success' };
}

/**
 * Reviews the customer gave permission to publish.
 * Columns: A Timestamp · B Order ID · C Name · D Overall · … I Testimonial · J May Publish
 */
function getTestimonials() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('testimonials');
  if (hit) return JSON.parse(hit);

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Feedback');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var rows = sheet.getDataRange().getValues();
  var out = [];

  for (var i = 1; i < rows.length; i++) {
    var mayPublish = String(rows[i][9] || '').toLowerCase();
    var quote = String(rows[i][8] || '').trim();
    if (mayPublish !== 'yes' || !quote) continue;

    // First name only — never publish a full name without asking.
    var first = String(rows[i][2] || '').trim().split(/\s+/)[0] || 'A customer';

    out.push({ name: first, quote: quote, rating: Number(rows[i][3]) || 5 });
  }

  out.reverse();                    // newest first
  out = out.slice(0, 12);

  try { cache.put('testimonials', JSON.stringify(out), CACHE_SECONDS); } catch (err) { log('testimonial cache', err); }
  return out;
}

/** Looks up an order so the feedback form can confirm it and greet by name. */
function lookupOrder(orderId) {
  if (!orderId) return null;

  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var rows = doc.getSheetByName('Orders').getDataRange().getValues();
  var wanted = String(orderId).trim().toUpperCase();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === wanted) {
      return {
        orderId: rows[i][0],
        name:    rows[i][3],          // Customer Name
        details: rows[i][8],          // Order Details
        date:    rows[i][5] ? Utilities.formatDate(new Date(rows[i][5]), cfg().timezone, 'd MMMM yyyy') : ''
      };
    }
  }
  return null;
}

// ============================================================
// HELPERS
// ============================================================

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowLagos() {
  return Utilities.formatDate(new Date(), cfg().timezone, "yyyy-MM-dd'T'HH:mm:ss");
}

function startOfToday() {
  var s = Utilities.formatDate(new Date(), cfg().timezone, 'yyyy-MM-dd');
  return parseDate(s);
}

function parseDate(str) {
  if (!str) return null;
  var m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function addDays(date, days) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function padLeft(n, width) {
  var s = String(n);
  while (s.length < width) s = '0' + s;
  return s;
}

function log(label, err) {
  console.error(label + ': ' + (err && err.stack ? err.stack : err));
}

/** Shows enough of a secret to confirm it's the right one, without printing it. */
function mask(value) {
  var s = String(value);
  if (s.length <= 10) return s;
  return s.substring(0, 6) + '…' + s.substring(s.length - 4) + ' (' + s.length + ' chars)';
}

// ============================================================
// RUN THESE ONCE, BY HAND, FROM THE APPS SCRIPT EDITOR
// ============================================================

/** Grants the script permission to call Notion. Run once, accept the prompt. */
function setupAuthorise() {
  UrlFetchApp.fetch('https://api.notion.com', { muteHttpExceptions: true });
  SpreadsheetApp.getActiveSpreadsheet().getName();
}

/** Checks your configuration. Run this before launch — read the log. */
function setupHealthCheck() {
  var problems = [];

  // --- Where is each value coming from? ---------------------------------
  var names = ['NOTION_TOKEN', 'CATALOG_DB_ID', 'BLOG_DB_ID', 'SETTINGS_DB_ID'];
  var props = PropertiesService.getScriptProperties().getProperties();

  console.log('--- Configuration ---');
  names.forEach(function (name) {
    var value = setting(name);
    if (!value) {
      problems.push('NOT SET: ' + name +
        '  → paste it into the SETTINGS block at the top of Code.gs,' +
        ' or add a Script Property named exactly ' + name);
      return;
    }
    var source = (props[name] && String(props[name]).trim())
      ? 'Script Property'
      : 'SETTINGS block in Code.gs';
    console.log(name + ' = ' + mask(value) + '   (from ' + source + ')');
  });

  // Show what Script Properties actually exist — catches typos in the name
  var existing = Object.keys(props);
  console.log('Script Properties found: ' +
              (existing.length ? existing.join(', ') : '(none)'));
  existing.forEach(function (key) {
    if (names.indexOf(key) === -1 && key !== 'ORDER_COUNTER') {
      console.log('⚠ Unrecognised property "' + key + '" — check the spelling. ' +
                  'Expected one of: ' + names.join(', '));
    }
  });

  var doc = SpreadsheetApp.getActiveSpreadsheet();
  ['Orders','Customers'].forEach(function (tab) {
    if (!doc.getSheetByName(tab)) problems.push('Missing sheet tab: ' + tab);
  });

  if (!problems.length) {
    try {
      var s = getSettings();
      console.log('Settings OK. promoActive=' + s.promoActive +
                  ' slots=' + s.promoSlotsUsed + '/' + s.promoSlots);
      console.log('Cakes found: ' + getCakes().length);
      console.log('Blog posts found: ' + getBlog().length);
    } catch (err) {
      problems.push('Notion call failed: ' + err.message);
    }
  }

  console.log(problems.length ? '❌ PROBLEMS:\n' + problems.join('\n') : '✅ All checks passed.');
  return problems;
}

/** Resets the promo counter to zero. Use after testing, before you go live. */
function setupResetPromoCounter() {
  var s = getSettings();
  updateNotionNumber(s._pageId, 'promoSlotsUsed', 0);
  CacheService.getScriptCache().remove('settings');
  console.log('promoSlotsUsed reset to 0');
}

/** Clears cached Notion data so catalogue edits appear immediately. */
function setupClearCache() {
  CacheService.getScriptCache().removeAll(
    ['cakes', 'blog', 'cakes_v2', 'blog_v2', 'settings', 'slots']);
  console.log('Cache cleared.');
}

/** Prints the article text for the first blog post. Use this to check that
 *  page content is being read correctly before blaming the website. */
function setupTestBlogPost() {
  var posts = getBlog();
  if (!posts.length) { console.log('No blog posts found.'); return; }

  var p = posts[0];
  console.log('Post: ' + (p.Title || '(untitled)'));
  console.log('Page id: ' + (p._pageId || 'MISSING — run setupClearCache and try again'));
  if (!p._pageId) return;

  var blocks = getPostText(p._pageId);
  console.log('Blocks found: ' + blocks.length);
  if (!blocks.length) {
    console.log('The Notion page body is empty, or the integration cannot read it.');
    return;
  }
  blocks.slice(0, 12).forEach(function (b) {
    console.log('[' + b.type + '] ' + String(b.text).substring(0, 80));
  });
}
