#!/usr/bin/env bash
set -euo pipefail

apt-get update && apt-get install -y ffmpeg git-lfs

python3 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
PYTORCH_INDEX_URL="${PYTORCH_INDEX_URL:-https://download.pytorch.org/whl/nightly/cu129}"
python -m pip install --upgrade --pre torch torchvision torchaudio --index-url "$PYTORCH_INDEX_URL"
python -m pip install ".[gpu]"

echo ""
echo "Setup complete. Run: bash scripts/run_precompute.sh"
echo "If the local model snapshots are present under models/, precompute can run without downloading them again."
