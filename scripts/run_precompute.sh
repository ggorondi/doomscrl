#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -x .venv/bin/python ]; then
    echo "Missing .venv. Run: bash scripts/gpu_setup.sh"
    exit 1
fi

source .venv/bin/activate

echo "=== Step 1: Extract backbone features ==="
PRECOMPUTE_WORKERS="${PRECOMPUTE_WORKERS:-1}"
VJEPA_BATCH_SIZE="${VJEPA_BATCH_SIZE:-1}"
RAW_VIDEO_DIRS=(
    artifacts/tiktok-final-top200/videos
    artifacts/tiktok-final-high300/videos
    artifacts/tiktok-final-random500/videos
)
PREPARED_VIDEO_DIRS=(
    artifacts/prepared-videos/tiktok-final-top200/videos
    artifacts/prepared-videos/tiktok-final-high300/videos
    artifacts/prepared-videos/tiktok-final-random500/videos
)

count_mp4s() {
    find "$1" -maxdepth 1 -type f -name '*.mp4' | wc -l | tr -d ' '
}

VIDEO_DIRS=("${RAW_VIDEO_DIRS[@]}")
VIDEO_FLAGS=()
USE_PREPARED=true
for idx in "${!PREPARED_VIDEO_DIRS[@]}"; do
    prepared_dir="${PREPARED_VIDEO_DIRS[$idx]}"
    raw_dir="${RAW_VIDEO_DIRS[$idx]}"
    if [ ! -d "$prepared_dir" ]; then
        USE_PREPARED=false
        break
    fi

    prepared_count="$(count_mp4s "$prepared_dir")"
    if [ -d "$raw_dir" ]; then
        raw_count="$(count_mp4s "$raw_dir")"
        if [ "$prepared_count" -ne "$raw_count" ]; then
            echo "Prepared corpus incomplete in $prepared_dir ($prepared_count/$raw_count); falling back to raw videos."
            USE_PREPARED=false
            break
        fi
    elif [ "$prepared_count" -eq 0 ]; then
        USE_PREPARED=false
        break
    fi
done

if [ "$USE_PREPARED" = true ]; then
    echo "Using prepared videos from artifacts/prepared-videos/"
    VIDEO_DIRS=("${PREPARED_VIDEO_DIRS[@]}")
    VIDEO_FLAGS+=(--videos-already-preprocessed)
fi

mkdir -p artifacts/logs

if [ "$PRECOMPUTE_WORKERS" -le 1 ]; then
    PYTHONUNBUFFERED=1 python -u scripts/precompute_features.py \
        --videos-dir "${VIDEO_DIRS[@]}" \
        --output-dir artifacts/features \
        --device cuda \
        --skip-existing \
        --vjepa-batch-size "$VJEPA_BATCH_SIZE" \
        "${VIDEO_FLAGS[@]}"
else
    echo "Launching $PRECOMPUTE_WORKERS shard workers with V-JEPA batch size $VJEPA_BATCH_SIZE"
    pids=()
    for worker_idx in $(seq 0 $((PRECOMPUTE_WORKERS - 1))); do
        log_path="artifacts/logs/precompute-worker-${worker_idx}.log"
        echo "Worker $worker_idx -> $log_path"
        CUDA_VISIBLE_DEVICES="$worker_idx" PYTHONUNBUFFERED=1 python -u scripts/precompute_features.py \
            --videos-dir "${VIDEO_DIRS[@]}" \
            --output-dir artifacts/features \
            --device cuda \
            --skip-existing \
            --vjepa-batch-size "$VJEPA_BATCH_SIZE" \
            --num-shards "$PRECOMPUTE_WORKERS" \
            --shard-index "$worker_idx" \
            "${VIDEO_FLAGS[@]}" >"$log_path" 2>&1 &
        pids+=("$!")
    done

    worker_failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            worker_failed=1
        fi
    done

    if [ "$worker_failed" -ne 0 ]; then
        echo "One or more precompute workers failed. Check artifacts/logs/precompute-worker-*.log"
        exit 1
    fi
fi

echo ""
echo "=== Step 2: Export brain model weights ==="
PYTHONUNBUFFERED=1 python -u scripts/export_brain_model.py \
    --checkpoint models/tribev2/best.ckpt \
    --output models/tribev2/fmri_encoder.pt

echo ""
echo "=== Step 3: Cluster videos ==="
PYTHONUNBUFFERED=1 python -u scripts/cluster_videos.py \
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
