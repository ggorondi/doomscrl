#!/usr/bin/env python3
"""Cluster videos by tier and content features for Policy 2 action space."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from src.catalog import VideoCatalog


def load_metadata(artifacts_dir: Path) -> pd.DataFrame:
    tier_map = {
        "tiktok-final-top200": "top",
        "tiktok-final-high300": "high",
        "tiktok-final-random500": "random",
    }
    dfs = []
    for subdir, tier in tier_map.items():
        meta_path = artifacts_dir / subdir / "metadata.csv"
        if not meta_path.exists():
            continue
        df = pd.read_csv(meta_path)
        df["tier"] = tier
        dfs.append(df)
    return pd.concat(dfs, ignore_index=True)


def get_video_embedding(features_path: Path) -> np.ndarray | None:
    if not features_path.exists():
        return None
    data = torch.load(features_path, map_location="cpu", weights_only=True)
    video_feat = data.get("video")
    if video_feat is None:
        return None
    return video_feat.float().mean(dim=(0, -1)).numpy()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts-dir", type=Path, default=Path("artifacts"))
    parser.add_argument("--features-dir", type=Path, default=Path("artifacts/features"))
    parser.add_argument("--sub-clusters", type=int, default=3)
    parser.add_argument("--output", type=Path, default=Path("artifacts/video_catalog.json"))
    args = parser.parse_args()

    df = load_metadata(args.artifacts_dir)
    print(f"Loaded metadata for {len(df)} videos")

    tier_to_base = {"top": 0, "high": args.sub_clusters, "random": args.sub_clusters * 2}
    tiers = df["tier"].unique()

    assignments: dict[str, int] = {}
    for tier in tiers:
        tier_df = df[df["tier"] == tier].copy()
        embeddings = []
        valid_ids = []

        for _, row in tier_df.iterrows():
            vid_id = str(int(row["id"]))
            emb = get_video_embedding(args.features_dir / f"{vid_id}.pt")
            if emb is None:
                continue
            meta = np.array([
                np.log1p(row.get("play_count", 0)),
                np.log1p(row.get("digg_count", 0)),
                row.get("duration", 0),
            ], dtype=np.float32)
            embeddings.append(np.concatenate([emb, meta]))
            valid_ids.append(vid_id)

        if len(embeddings) < args.sub_clusters:
            for vid_id in valid_ids:
                assignments[vid_id] = tier_to_base.get(tier, 0)
            continue

        X = StandardScaler().fit_transform(np.stack(embeddings))
        k = min(args.sub_clusters, len(X))
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X)

        base = tier_to_base.get(tier, 0)
        for vid_id, label in zip(valid_ids, labels):
            assignments[vid_id] = base + int(label)

        print(f"  {tier}: {len(valid_ids)} videos -> {k} sub-clusters (ids {base}-{base+k-1})")

    catalog = VideoCatalog.build_from_artifacts(
        artifacts_dir=args.artifacts_dir,
        features_dir=args.features_dir,
        cluster_assignments=assignments,
        output_path=args.output,
    )
    print(f"Catalog saved to {args.output} with {len(catalog.entries)} videos, {catalog.n_clusters} clusters")


if __name__ == "__main__":
    main()
