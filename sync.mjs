// Refresh The Vault.
//
// Reads the two saved searches off Marktplaats, pulls the structured listing
// data the page already ships in __NEXT_DATA__, and rewrites the LISTINGS array
// and LAST_SYNC in index.html.
//
// Why a script rather than doing it by hand each time. The feed sat six weeks
// stale because the refresh was a conversation, not a command: nothing failed
// loudly, the page just kept showing July. A script fails loudly, runs the same
// way twice, and can be pointed at by a scheduled job.
//
// It asks for two pages per search with a pause between requests, identifies
// itself in the User-Agent, and reads only the public search page. Nothing here
// works around a block, because there is no block: the pages answer 200.

import fs from "node:fs";

const UA = "TheVault/1.0 (personal vintage-toy watch; +https://ramongervais.github.io/vintage-toy-vault/)";
const PAUSE_MS = 2500;
const PAGES = 2;

const SEARCHES = [
  { brand: "sw",   q: "star wars kenner vintage" },
  { brand: "tmnt", q: "tmnt playmates vintage" },
];

// The searches pull in modern reissues that are not what this page is for.
// Hasbro's line is literally called "The Vintage Collection", so the word
// "vintage" in a title proves nothing and these have to go by name.
const REJECT = /vintage collection|black series|hasbro 20\d\d|the mandalorian|retro collection|funko|pop!|lego/i;
const NOISE  = /gezocht|gevraagd|op zoek naar|wie helpt/i;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function page(q, p) {
  const url = `https://www.marktplaats.nl/q/${encodeURIComponent(q).replace(/%20/g, "+")}/` + (p > 1 ? `p/${p}/` : "");
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9" } });
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  const html = await res.text();
  const m = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no __NEXT_DATA__ on ${url}. The page shape changed, or this is not a results page.`);
  const data = JSON.parse(m[1]);
  const rows = data?.props?.pageProps?.searchRequestAndResponse?.listings;
  if (!Array.isArray(rows)) throw new Error(`no listings array on ${url}`);
  return rows;
}

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim();

function imgId(l) {
  const u = l.imageUrls?.[0] || l.pictures?.[0]?.url || "";
  const m = u.match(/images\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

function priceOf(l) {
  const p = l.priceInfo || {};
  // MIN_BID and its friends are auctions: the page shows "Bieden" for those,
  // and a number there would read as an asking price it is not.
  if (p.priceType && p.priceType !== "FIXED") return null;
  return typeof p.priceCents === "number" && p.priceCents > 0 ? Math.round(p.priceCents / 100) : null;
}

const raw = [];
for (const s of SEARCHES) {
  for (let p = 1; p <= PAGES; p++) {
    process.stdout.write(`  ${s.brand} page ${p} ... `);
    const rows = await page(s.q, p);
    console.log(`${rows.length} rows`);
    rows.forEach(l => raw.push({ brand: s.brand, l }));
    await sleep(PAUSE_MS);
  }
}

// One seller can hold several of the ads we pulled. Counting them is how the
// page tells a dealer from somebody clearing a loft, so it is counted across
// everything we saw rather than per search.
const adCount = new Map();
for (const { l } of raw) {
  const id = l.sellerInformation?.sellerId;
  if (id) adCount.set(id, (adCount.get(id) || 0) + 1);
}

const seen = new Set();
const out = [];
for (const { brand, l } of raw) {
  if (seen.has(l.itemId)) continue;
  seen.add(l.itemId);
  const title = l.title || "";
  if (REJECT.test(title) || NOISE.test(title)) continue;
  const img = imgId(l);
  if (!img) continue;

  const si = l.sellerInformation || {};
  const ads = adCount.get(si.sellerId) || 1;
  const cond = (l.extendedAttributes || l.attributes || []).find(a => a.key === "condition")?.value || null;

  out.push({
    brand,
    title: esc(title),
    price: priceOf(l),
    loc: esc(l.location?.cityName || l.location?.countryName || ""),
    posted: esc(l.date || ""),
    img,
    itemId: l.itemId,
    url: l.vipUrl ? (l.vipUrl.startsWith("http") ? l.vipUrl : "https://www.marktplaats.nl" + l.vipUrl) : null,
    seller: esc(si.sellerName || ""),
    pro: ads >= 3 || si.showWebsiteUrl === true,
    ads,
    cond: cond ? esc(cond) : null,
    // Left for a human or a vision pass. Writing a completeness verdict we did
    // not actually check would be the one thing this page must not do.
    scan: null,
  });
}

const line = (r) => "    { brand:\"" + r.brand + "\", title:\"" + r.title + "\""
  + ", price:" + (r.price === null ? "null" : r.price)
  + ", loc:\"" + r.loc + "\", posted:\"" + r.posted + "\", img:\"" + r.img + "\""
  + (r.url ? ", url:\"" + r.url + "\"" : "")
  + ", seller:\"" + r.seller + "\", pro:" + r.pro + ", ads:" + r.ads
  + (r.cond ? ", cond:\"" + r.cond + "\"" : "")
  + ", mLo:null, mHi:null"
  + ", scan:" + (r.scan ? "\"" + r.scan + "\"" : "null")
  + ", sflag:\"info\", ssrc:\"LISTING\" },";

const sw = out.filter(r => r.brand === "sw");
const tmnt = out.filter(r => r.brand === "tmnt");

const body = [
  "    // ---------- STAR WARS (vintage Kenner) ----------",
  ...sw.map(line),
  "    // ---------- TMNT (vintage Playmates) ----------",
  ...tmnt.map(line),
].join("\n");

const stamp = new Date().toISOString().slice(0, 19);
let html = fs.readFileSync("index.html", "utf8");

const before = html;
html = html.replace(/const LAST_SYNC = "[^"]*";/, `const LAST_SYNC = "${stamp}";`);
html = html.replace(/(const LISTINGS = \[)[\s\S]*?(\n  \];)/, `$1\n${body}$2`);
if (html === before) throw new Error("nothing was replaced: index.html does not have the shape this script expects");

fs.writeFileSync("index.html", html);
console.log(`\nwrote ${out.length} listings (${sw.length} star wars, ${tmnt.length} tmnt), LAST_SYNC ${stamp}`);
console.log(`dealers flagged: ${out.filter(r => r.pro).length}`);
