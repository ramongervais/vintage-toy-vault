# The Vault — Vintage Toy Watch

A personal portal that tracks new **vintage Star Wars** (original Kenner) and **Teenage Mutant Ninja Turtles** (vintage Playmates) listings on [Marktplaats](https://www.marktplaats.nl).

**Live:** https://ramongervais.github.io/vintage-toy-vault/

## What it does

- **Image-led feed** of vintage listings across two channels (Star Wars / Turtles).
- **NEW** flags for anything posted since the last sync.
- **Seller read** — flags dealer/collector accounts (many, varied ads) vs. **Private find** one-offs, where the underpriced buys usually are. Toggle *Opportunities only* to hide the pros.
- **Market benchmark** — a rough eBay loose/complete range per item, with an *Onder markt / Marktconform / Boven markt* verdict against the asking price.
- **Completeness scan** — weapons and accessories check. `FOTO` = read from the listing photo, `LISTING` = from the seller's own text.
- Price bands (≤ €50 / > €50 / Bieden), title search, sorting (incl. *Best vs market*), light/dark themes.

## How it stays fresh

The feed is a synced snapshot (a static page can't call Marktplaats live). A daily cloud agent re-pulls both searches, re-scores sellers, re-checks photos, updates `LAST_SYNC` and the `LISTINGS` array in `index.html`, and pushes — GitHub Pages redeploys automatically.

To sync by hand, ask Claude to *"refresh the vault."*

## Notes

Seller classifications and market estimates are guidance, not official data. Always confirm price, condition, and completeness on Marktplaats before buying. Not affiliated with Marktplaats or eBay.
