#!/usr/bin/env python3
"""Audit which artifacts are still missing before RL training can start."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

TIER_DIRS = [
    "tiktok-final-top200",
    "tiktok-final-high300",
    "tiktok-final-random500",
]


def count_metadata_rows(path: Path) -> int:
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        return sum(1 for _ in reader)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts-dir", type=Path, default=Path("artifacts"))
    parser.add_argument("--prepared-root", type=Path, default=Path("artifacts/prepared-videos"))
    parser.add_argument("--features-dir", type=Path, default=Path("artifacts/features"))
    parser.add_argument("--catalog-path", type=Path, default=Path("artifacts/video_catalog.json"))
    parser.add_argument(
        "--brain-checkpoint",
        type=Path,
        default=Path("models/tribev2/fmri_encoder.pt"),
    )
    args = parser.parse_args()

    metadata_total = 0
    available_videos = 0
    prepared_complete = True
    print("Video corpus:")
    for tier in TIER_DIRS:
        meta_path = args.artifacts_dir / tier / "metadata.csv"
        raw_dir = args.artifacts_dir / tier / "videos"
        prepared_dir = args.prepared_root / tier / "videos"
        meta_rows = count_metadata_rows(meta_path) if meta_path.exists() else 0
        raw_count = len(list(raw_dir.glob("*.mp4"))) if raw_dir.exists() else 0
        prepared_count = len(list(prepared_dir.glob("*.mp4"))) if prepared_dir.exists() else 0
        metadata_total += meta_rows
        available_videos += max(raw_count, prepared_count)
        if prepared_count not in (0, raw_count):
            prepared_complete = False
        print(
            f"  {tier}: metadata={meta_rows}, raw_videos={raw_count}, prepared_videos={prepared_count}"
        )

    print("")
    feature_count = len(list(args.features_dir.glob("*.pt"))) if args.features_dir.exists() else 0
    catalog_entries = 0
    if args.catalog_path.exists():
        with args.catalog_path.open() as f:
            catalog_entries = len(json.load(f))

    print("Training artifacts:")
    print(f"  metadata_rows={metadata_total}")
    print(f"  available_source_videos={available_videos}")
    print(f"  features={feature_count} ({args.features_dir})")
    print(f"  brain_checkpoint={'yes' if args.brain_checkpoint.exists() else 'no'} ({args.brain_checkpoint})")
    print(f"  catalog_entries={catalog_entries} ({args.catalog_path})")
    print("")

    next_steps: list[str] = []
    if any(
        not (args.prepared_root / tier / "videos").exists() or
        len(list((args.prepared_root / tier / "videos").glob("*.mp4"))) == 0
        for tier in TIER_DIRS
    ):
        next_steps.append(
            "Optional but recommended: run scripts/prepare_videos.py to create the transfer-friendly 256x256/16fps corpus."
        )
    elif not prepared_complete:
        next_steps.append(
            "Prepared videos exist but are incomplete; finish or remove artifacts/prepared-videos before relying on them."
        )
    if not args.brain_checkpoint.exists():
        next_steps.append(
            "Export the standalone brain model: python3 scripts/export_brain_model.py --output models/tribev2/fmri_encoder.pt"
        )
    if feature_count < available_videos:
        next_steps.append(
            "Run GPU feature extraction: bash scripts/run_precompute.sh"
        )
    if catalog_entries < available_videos:
        next_steps.append(
            "Regenerate the catalog after features exist: python3 scripts/cluster_videos.py --artifacts-dir artifacts --features-dir artifacts/features --output artifacts/video_catalog.json"
        )

    if next_steps:
        print("Outstanding:")
        for step in next_steps:
            print(f"  - {step}")
        return 1

    print("Ready: all required artifacts for training are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
