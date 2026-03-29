from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
import torch


@dataclass
class VideoEntry:
    video_id: str
    tier: str
    cluster_id: int
    duration: float
    play_count: int
    digg_count: int
    features_path: str
    _features_cache: dict | None = field(default=None, repr=False)

    def load_features(self) -> dict[str, torch.Tensor]:
        if self._features_cache is None:
            self._features_cache = torch.load(
                self.features_path, map_location="cpu", weights_only=True
            )
        return self._features_cache

    @property
    def metadata_vec(self) -> np.ndarray:
        return np.array([
            np.log1p(self.play_count),
            np.log1p(self.digg_count),
            self.duration,
        ], dtype=np.float32)


class VideoCatalog:

    def __init__(self, catalog_path: str | Path):
        catalog_path = Path(catalog_path)
        with open(catalog_path) as f:
            raw = json.load(f)

        self.entries: dict[str, VideoEntry] = {}
        self.clusters: dict[int, list[str]] = {}

        for vid_id, info in raw.items():
            entry = VideoEntry(
                video_id=vid_id,
                tier=info["tier"],
                cluster_id=info["cluster_id"],
                duration=info["duration"],
                play_count=info["play_count"],
                digg_count=info["digg_count"],
                features_path=info["features_path"],
            )
            self.entries[vid_id] = entry
            self.clusters.setdefault(entry.cluster_id, []).append(vid_id)

    @property
    def n_clusters(self) -> int:
        return len(self.clusters)

    @property
    def video_ids(self) -> list[str]:
        return list(self.entries.keys())

    def get(self, video_id: str) -> VideoEntry:
        return self.entries[video_id]

    def sample_from_cluster(self, cluster_id: int, rng: random.Random) -> VideoEntry:
        vid_id = rng.choice(self.clusters[cluster_id])
        return self.entries[vid_id]

    def shuffled_feed(self, rng: random.Random) -> list[VideoEntry]:
        ids = list(self.entries.keys())
        rng.shuffle(ids)
        return [self.entries[vid_id] for vid_id in ids]

    @classmethod
    def build_from_artifacts(
        cls,
        artifacts_dir: str | Path,
        features_dir: str | Path,
        cluster_assignments: dict[str, int] | None = None,
        output_path: str | Path = "artifacts/video_catalog.json",
    ) -> "VideoCatalog":
        artifacts_dir = Path(artifacts_dir)
        features_dir = Path(features_dir)
        output_path = Path(output_path)

        tier_map = {
            "tiktok-final-top200": "top",
            "tiktok-final-high300": "high",
            "tiktok-final-random500": "random",
        }

        catalog = {}
        for subdir_name, tier in tier_map.items():
            meta_path = artifacts_dir / subdir_name / "metadata.csv"
            if not meta_path.exists():
                continue
            df = pd.read_csv(meta_path)
            for _, row in df.iterrows():
                vid_id = str(int(row["id"]))
                feat_path = features_dir / f"{vid_id}.pt"
                if not feat_path.exists():
                    continue
                cid = 0
                if cluster_assignments and vid_id in cluster_assignments:
                    cid = cluster_assignments[vid_id]
                catalog[vid_id] = {
                    "tier": tier,
                    "cluster_id": cid,
                    "duration": float(row["duration"]),
                    "play_count": int(row.get("play_count", 0)),
                    "digg_count": int(row.get("digg_count", 0)),
                    "features_path": str(feat_path),
                }

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(catalog, f, indent=2)

        return cls(output_path)
