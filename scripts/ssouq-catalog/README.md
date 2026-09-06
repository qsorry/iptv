# ssouq.com catalog scraper

Pipeline that scrapes every public product on https://ssouq.com (Salla storefront),
cleans it into structured JSON, turns descriptions into icon-tagged bullet points
(Material Design Icons via `@mdi/js`) and renders a single self-contained HTML preview.

```
cd scripts/ssouq-catalog
pip install beautifulsoup4 lxml && npm install @mdi/js   # one-time
./fetch.sh          # sitemap -> pages/<id>.html (skips already-downloaded pages)
python3 parse.py    # pages/*.html -> raw_products.json
python3 clean.py    # raw_products.json -> products.json (categories, bullets, icons)
python3 build.py    # products.json -> catalog.html
```

Outputs are committed under `docs/ssouq-catalog/`:

- `catalog.html` — single-file preview (embedded CSS/JS/data, inline SVG icon sprite, Google Fonts).
- `products.json` — cleaned structured data (one object per product with `groups[].items[]` bullets).

Notes
- The storefront rate-limits its homepage aggressively; removed products redirect (302) there,
  so the fetcher never follows redirects and records those IDs in `removed.txt`.
- `build.py` expects `@mdi/js` to be installed in a `mdi/` sub-folder (`cd mdi && npm i @mdi/js`),
  or adjust the `cwd` passed to `node` in `build.py`.

## Digital subscriptions only (`subs_*`)

```
python3 subs_clean.py               # subs/subs_raw.json + subs/pages_parsed.json + subs/image_manifest.json -> subscriptions.json
python3 subs_build.py standalone    # -> subscriptions.html (images served from https://com.ssouq.net/media/subscriptions/, CDN fallback)
python3 subs_build.py embed         # -> subscriptions-embed.html (resized WebP data URIs, for the hosted preview)
```

Inputs: the storefront category listing (`api.salla.dev/store/v1/products?source=product.index&source_value=993357185`,
header `Store-Identifier`), the admin product records (Salla MCP `products_list`), and the scraped product pages.
Images are downloaded once into `public/media/subscriptions/<product-id>/gallery-N.ext` (product gallery) and
`public/media/subscriptions/shared/<hash>.ext` (setup screenshots embedded in descriptions, shared across products).
