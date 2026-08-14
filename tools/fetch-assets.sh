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

echo "→ fonts (SIL OFL 1.1), only the weights the CSS uses"
mkdir -p fonts
for f in zillaslab/ZillaSlab-SemiBold.ttf zillaslab/ZillaSlab-Bold.ttf \
         ibmplexmono/IBMPlexMono-Regular.ttf ibmplexmono/IBMPlexMono-SemiBold.ttf \
         zillaslab/OFL.txt ibmplexmono/OFL.txt; do
  curl -sfo "fonts/$(basename "$(dirname "$f")")-$(basename "$f")" \
    "https://raw.githubusercontent.com/google/fonts/main/ofl/$f"
done

echo "→ NNUE network for the eval engine (Stockfish project, GPL-3.0, 6.5 MB)"
# Used only by tools/build-evals.mjs (build-time; nothing from it ships in the
# page). Version-pinned by content: the filename embeds the hash prefix and the
# full SHA-256 is verified below, so a changed upstream file fails loudly.
mkdir -p nnue
curl -sfLo nnue/nn-ecb35f70ff2a.nnue "https://tests.stockfishchess.org/api/nn/nn-ecb35f70ff2a.nnue"
echo "ecb35f70ff2aa4492caec6b552a1628e24319fbe1cc2aaf95eaebabdd92a1e37  nnue/nn-ecb35f70ff2a.nnue" | sha256sum -c -

echo "→ puzzle database (CC0, ~300 MB)"
curl -f -o puzzles.csv.zst "https://database.lichess.org/lichess_db_puzzle.csv.zst"
echo "→ filtering to the openings in this repertoire"
zstd -dc puzzles.csv.zst \
  | awk -F, 'NR==1 || $10 ~ /Colle|Zukertort|Hippopotamus|Modern_Defense|Pirc_Defense|Kings_Indian_Attack/' \
  > puzzles-filtered.csv
wc -l puzzles-filtered.csv
