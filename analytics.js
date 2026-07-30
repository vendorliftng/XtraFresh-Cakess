/**
 * XtraFresh Cakes — Web Analytics
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  PASTE YOUR CLOUDFLARE WEB ANALYTICS TOKEN BELOW             │
 * │                                                              │
 * │  Cloudflare dashboard → Analytics & Logs → Web Analytics     │
 * │  → Add a site → xtrafreshcakes.com → Manual setup            │
 * │                                                              │
 * │  You will be shown a snippet containing:                     │
 * │      data-cf-beacon='{"token": "abc123..."}'                 │
 * │                                                              │
 * │  Copy ONLY the token value into the line below.              │
 * │  This is the only file you need to edit — all four pages     │
 * │  load it.                                                    │
 * └──────────────────────────────────────────────────────────────┘
 */
var CF_BEACON_TOKEN = "4f2e9df47f034b799f8bb2e27344cadd";

(function () {
  // Nothing happens until a real token is set, so the site never
  // requests a script that would 404.
  if (!CF_BEACON_TOKEN || CF_BEACON_TOKEN.indexOf("PASTE_") === 0) return;

  var s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token: CF_BEACON_TOKEN }));
  document.head.appendChild(s);
})();
