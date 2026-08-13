#!/usr/bin/env bash
# Downloads the third-party sources used to regenerate src/data/*.
# Everything here is CC0 except the Cburnett pieces (CC BY-SA 3.0, attribution is in the footer).
set -euo pipefail
mkdir -p data-src/pieces
cd data-src

echo "→ Cburnett piece SVGs (CC BY-SA 3.0)"
for f in wK wQ wR wB wN wP bK bQ bR bB bN bP; do
  curl -sfo "pieces/$f.svg" \
    "https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/$f.svg"
done

echo "→ opening names (CC0)"
for f in a b c d e; do
  curl -sfo "eco_$f.tsv" "https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv"
done

echo "→ puzzle database (CC0, ~300 MB)"
curl -f -o puzzles.csv.zst "https://database.lichess.org/lichess_db_puzzle.csv.zst"
echo "→ filtering to the openings in this repertoire"
zstd -dc puzzles.csv.zst \
  | awk -F, 'NR==1 || $10 ~ /Colle|Zukertort|Hippopotamus|Modern_Defense|Pirc_Defense|Kings_Indian_Attack/' \
  > puzzles-filtered.csv
wc -l puzzles-filtered.csv
