#!/bin/sh
# End-to-end check of a deployed 3D Dust Map website, through nginx, exactly as a browser uses it.
#
#   sh smoke_test.sh https://nadc.china-vo.org/data/dustmaps3d
#   sh smoke_test.sh http://127.0.0.1:58123 --backend-only     # the backend alone, before nginx
#
# Needs curl and python3. Prints PASS/FAIL per check and exits non-zero on any FAIL.
# Takes about 40 s (it draws two small maps, one oblique slice and one bubble analysis).
set -u
BASE="${1:?usage: smoke_test.sh <site URL without trailing slash> [--backend-only]}"
BASE="${BASE%/}"
MODE="${2:-}"
FAILS=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILS=$((FAILS + 1)); }

post() { # post <path> <json> -> body in $TMP/out, prints HTTP status
  curl -s -o "$TMP/out" -w '%{http_code}' -X POST "$BASE$1" -H 'Content-Type: application/json' -d "$2" --max-time 300
}

json() { # json <python expression on d> -> value
  python3 -c "import json,sys; d=json.load(open('$TMP/out')); print($1)" 2>/dev/null
}

png_at() { # png_at <url path from the backend, e.g. /files/x.png>
  curl -s -o "$TMP/img" --max-time 60 "$BASE$1" && head -c 8 "$TMP/img" | od -An -tx1 | tr -d ' \n' | grep -q '^89504e470d0a1a0a$'
}

if [ "$MODE" != "--backend-only" ]; then
  code=$(curl -s -o "$TMP/page" -w '%{http_code}' "$BASE/")
  if [ "$code" = 200 ] && grep -q 'assets/' "$TMP/page"; then pass "website page $BASE/"; else fail "website page $BASE/ (HTTP $code)"; fi
  asset=$(grep -o 'assets/index-[^"]*\.js' "$TMP/page" | head -1)
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$asset")
  if [ "$code" = 200 ]; then pass "static asset $asset"; else fail "static asset $asset (HTTP $code) — check the nginx alias path"; fi
fi

code=$(post /api/v2/dust/query '{"coord_system":"galactic","coord1":209.0,"coord2":-19.4,"d":0.4}')
ebv=$(json "d['EBV']")
if [ "$code" = 200 ] && python3 -c "import sys; sys.exit(0 if abs($ebv-0.02950)<2e-4 else 1)" 2>/dev/null; then
  pass "point query l=209 b=-19.4 d=0.4 -> E(B-V)=$ebv (expected 0.0295)"
else fail "point query (HTTP $code, body: $(head -c 200 "$TMP/out"))"; fi

code=$(post /api/v2/dust/query '{"coord_system":"equatorial","coord1":83.82,"coord2":-5.39,"d":null}')
maxd=$(json "d['max_distance']")
if [ "$code" = 200 ] && python3 -c "import sys; sys.exit(0 if abs($maxd-5.75)<0.01 else 1)" 2>/dev/null; then
  pass "equatorial query, blank d -> max reliable distance $maxd kpc (expected 5.75)"
else fail "equatorial query (HTTP $code, body: $(head -c 200 "$TMP/out"))"; fi

code=$(curl -s -o "$TMP/tpl" -w '%{http_code}' "$BASE/api/v2/dust/templates?coords=galactic&file_format=csv")
if [ "$code" = 200 ] && head -1 "$TMP/tpl" | grep -q '^l,b,d'; then pass "batch template download"; else fail "batch template (HTTP $code)"; fi

printf 'l,b,d\n209.0,-19.4,0.4\n30.0,2.0,\n' > "$TMP/in.csv"
code=$(curl -s -o "$TMP/batch.csv" -w '%{http_code}' -F "file=@$TMP/in.csv;filename=in.csv" -F output_format=csv "$BASE/api/v2/dust/batch")
if [ "$code" = 200 ] && head -1 "$TMP/batch.csv" | grep -q 'E(B-V)_mag' && [ "$(wc -l < "$TMP/batch.csv" | tr -d ' ')" = 3 ]; then
  pass "batch upload (CSV in, CSV out)"
else fail "batch upload (HTTP $code) — check client_max_body_size / proxy"; fi

code=$(post /api/v2/extinction/coefficient '{"mode":"ext","band":"GAIA3.G","ebv":0.3,"teff":5500,"use_2023":false}')
res=$(json "d['result']")
if [ "$code" = 200 ] && python3 -c "import sys; sys.exit(0 if abs($res-0.743395)<1e-5 else 1)" 2>/dev/null; then
  pass "reddening, Zhang 2024: A(G) = $res (expected 0.743395)"
else fail "reddening 2024 (HTTP $code, body: $(head -c 200 "$TMP/out"))"; fi

code=$(post /api/v2/extinction/coefficient '{"mode":"reddening","color":"BP-RP","ebv":0.3,"teff":5500,"use_2023":true}')
res=$(json "d['result']")
if [ "$code" = 200 ] && python3 -c "import sys; sys.exit(0 if abs($res-1.1922259)<1e-6 else 1)" 2>/dev/null; then
  pass "reddening, Zhang 2023: R(BP-RP) = $res (expected 1.1922259)"
else fail "reddening 2023 (HTTP $code, body: $(head -c 200 "$TMP/out"))"; fi

code=$(post /api/v2/plots/car '{"coord_system":"galactic","lon_min":200,"lon_max":220,"lat_min":-30,"lat_max":-10,"d_min":0.3,"d_max":0.5,"vmin":0.01,"vmax":1,"norm":"log","colormap":"Spectral_r","smoothing_sigma":0.1}')
url=$(json "d['url']")
if [ "$code" = 200 ] && png_at "$url"; then pass "Cartesian map -> $url"; else fail "Cartesian map (HTTP $code, body: $(head -c 200 "$TMP/out"))"; fi

code=$(post /api/v2/plots/sin '{"coord_system":"galactic","lon_center":209,"lat_center":-19.4,"fov":10,"d_min":0.3,"d_max":0.5,"vmin":0.01,"vmax":1,"norm":"log","colormap":"Spectral_r","smoothing_sigma":0.1,"mark_region":true,"mark_color":"black"}')
url=$(json "d['url']")
if [ "$code" = 200 ] && png_at "$url"; then pass "orthographic map (STILTS) -> $url"
else fail "orthographic map (HTTP $code, body: $(head -c 300 "$TMP/out")) — 503 here usually means STILTS/java is not found"; fi

code=$(post /api/v2/plots/dpr '{"angle_degrees":60,"offset":0.3,"half_width":0.1,"s_range_min":-3,"s_range_max":3,"z_range_min":-0.5,"z_range_max":0.5,"norm":"log","vmin":0.05,"vmax":1,"colormap":"Spectral_r","show_markers":true,"show_superbubbles":true}')
url=$(json "d['url']")
if [ "$code" = 200 ] && png_at "$url"; then pass "oblique slice + superbubbles -> $url"
else fail "oblique slice (HTTP $code, body: $(head -c 300 "$TMP/out")) — 503 here means grid3d.parquet or the superbubble CSV is missing"; fi

code=$(post /api/v2/bubbles/analyze '{"l":209,"b":-19.4,"d":0.4,"d_low":0.3,"d_up":0.5,"diameter":4}')
url=$(json "d['url']")
if [ "$code" = 200 ] && png_at "$url"; then pass "bubble analysis -> $url"; else fail "bubble analysis (HTTP $code, body: $(head -c 200 "$TMP/out"))"; fi

if [ "$MODE" != "--backend-only" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v2/bubbles" -H 'Content-Type: application/json' -d '{}')
  if [ "$code" = 403 ]; then pass "public bubble saving is blocked (403)"
  else echo "WARN  POST $BASE/api/v2/bubbles answered $code, expected 403 — add the deny rule from nginx-dustmaps3d.conf"; fi
fi

echo
if [ "$FAILS" = 0 ]; then echo "ALL CHECKS PASSED"; else echo "$FAILS CHECK(S) FAILED"; fi
exit "$FAILS"
