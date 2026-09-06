#!/bin/bash
# Scrape ssouq.com product pages listed in the sitemap into ./pages/<id>.html
# - Does NOT follow redirects: a 302 to the homepage means the product was removed (logged to removed.txt)
# - Backs off on HTTP 429 (Cloudflare rate limit)
set -u
cd "$(dirname "$0")"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
mkdir -p pages
if [ ! -s id_url.txt ]; then
  curl -sSL -A "$UA" https://ssouq.com/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sed 's/<\/\?loc>//g' | while read sm; do
    curl -sSL -A "$UA" "$sm" | grep -o '<loc>[^<]*</loc>' | sed 's/<\/\?loc>//g'
  done | grep '/p[0-9]*$' | sort -u | awk -F'/p' '!seen[$NF]++ {print $NF" "$0}' > id_url.txt
fi
echo "$(wc -l < id_url.txt) unique product URLs"
while read id url; do
  [ -s "pages/$id.html" ] && continue
  grep -q "^$id " removed.txt 2>/dev/null && continue
  wait=15; code=0
  for attempt in 1 2 3 4 5; do
    code=$(curl -sS -A "$UA" --max-time 40 -o "pages/$id.html.tmp" -w "%{http_code}" "$url" </dev/null)
    if [ "$code" = "200" ]; then mv "pages/$id.html.tmp" "pages/$id.html"; break; fi
    rm -f "pages/$id.html.tmp"
    case "$code" in 301|302|404) echo "$id $code" >> removed.txt; break;; esac
    sleep $wait; wait=$((wait*2))
  done
  case "$code" in 200|301|302|404) ;; *) echo "$id $code" >> fetch_errors.txt;; esac
  sleep 0.5
done < id_url.txt
echo "done: $(ls pages/*.html 2>/dev/null | wc -l) pages, $(cat removed.txt 2>/dev/null | wc -l) removed, $(cat fetch_errors.txt 2>/dev/null | wc -l) errors"
