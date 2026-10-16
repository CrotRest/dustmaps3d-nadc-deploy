#!/bin/sh
# Join the 8 parts of the DPR 3D grid back into grid3d.parquet and check SHA-256.
#
#   sh assemble_grid3d.sh <dir with grid3d.parquet.part*of8 + SHA256SUMS> <output grid3d.parquet>
#
# The parts are split only so each stays under GitHub's 100 MB file limit.
set -eu
SRC="${1:?usage: assemble_grid3d.sh <parts dir> <output file>}"
OUT="${2:?usage: assemble_grid3d.sh <parts dir> <output file>}"
cd "$SRC"
if command -v sha256sum >/dev/null 2>&1; then SUM="sha256sum"; else SUM="shasum -a 256"; fi
grep 'part' SHA256SUMS | $SUM -c -
cat grid3d.parquet.part1of8 grid3d.parquet.part2of8 grid3d.parquet.part3of8 grid3d.parquet.part4of8 \
    grid3d.parquet.part5of8 grid3d.parquet.part6of8 grid3d.parquet.part7of8 grid3d.parquet.part8of8 > "$OUT.tmp"
want=$(grep ' grid3d.parquet$' SHA256SUMS | cut -d' ' -f1)
got=$($SUM "$OUT.tmp" | cut -d' ' -f1)
if [ "$want" != "$got" ]; then rm -f "$OUT.tmp"; echo "FAIL  checksum of the joined file"; exit 1; fi
mv "$OUT.tmp" "$OUT"
echo "wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes, SHA-256 OK)"
