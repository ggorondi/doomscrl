#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "=== Step 1: Extract backbone features ==="
python scripts/precompute_features.py \
    --videos-dir \
        artifacts/tiktok-final-top200/videos \
        artifacts/tiktok-final-high300/videos \
        artifacts/tiktok-final-random500/videos \
    --output-dir artifacts/features \
    --device cuda \
    --skip-existing

echo ""
echo "=== Step 2: Export brain model weights ==="
python scripts/export_brain_model.py \
    --output models/tribev2/fmri_encoder.pt

echo ""
echo "=== Step 3: Cluster videos ==="
python scripts/cluster_videos.py \
    --artifacts-dir artifacts \
    --features-dir artifacts/features \
    --sub-clusters 3 \
    --output artifacts/video_catalog.json

echo ""
echo "=== Done ==="
echo "Copy these back to your local machine:"
echo "  rsync -avz artifacts/features/ local:brainrotmaxxer/artifacts/features/"
echo "  rsync -avz models/tribev2/fmri_encoder.pt local:brainrotmaxxer/models/tribev2/"
echo "  rsync -avz artifacts/video_catalog.json local:brainrotmaxxer/artifacts/"
