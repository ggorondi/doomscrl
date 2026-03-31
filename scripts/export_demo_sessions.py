#!/usr/bin/env python3
"""Export real agent demo assets for the website.

Generates:
1. A stitched phone video for each selected policy rollout.
2. A compact JSON trace with per-step activations, regions, and video choices.
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.render_policy_replay import (
    StepTrace,
    build_left_panel_video,
    load_cfg,
    load_model,
    make_env,
    rollout_traces,
)
from src.brain import BrainModel
from src.catalog import VideoCatalog
from src.train import VARIANT_NAMES, resolve_variant_cfg
ARCHIVE_ROOT = PROJECT_ROOT / "doomscollmaxxer_rl_20260330"
ARCHIVE_ARTIFACTS = ARCHIVE_ROOT / "doomscollmaxxer_rl_artifacts_20260330"
ARCHIVE_RUNS = ARCHIVE_ROOT / "doomscollmaxxer_rl_runs_20260330"

OUT_DIR = PROJECT_ROOT / "web" / "public" / "demo"
OUT_DATA = PROJECT_ROOT / "web" / "public" / "data" / "demo_sessions.json"

FEATURES_ROOT = ARCHIVE_ARTIFACTS / "features"
CATALOG_IN = ARCHIVE_ARTIFACTS / "video_catalog.json"
PREPARED_ROOT = PROJECT_ROOT / "artifacts" / "prepared-videos-pre-resize"
FALLBACK_ROOT = PROJECT_ROOT / "artifacts" / "prepared-videos"
BRAIN_CKPT = PROJECT_ROOT / "models" / "tribev2" / "fmri_encoder.pt"

SECONDS = 30.0
SEED = 42
ENV_FPS = 2.0
VIDEO_FPS = 24
PHONE_SIZE = (288, 624)

VARIANTS = {
    "baseline": {
        "variant": "a",
        "policy_path": ARCHIVE_RUNS / "select_baseline" / "best_model" / "best_model.zip",
        "title": "Baseline",
    },
    "cortisol": {
        "variant": "e",
        "policy_path": ARCHIVE_RUNS / "select_cortisol" / "best_model" / "best_model.zip",
        "title": "Cortisol",
    },
}


def build_catalog_copy(out_path: Path) -> Path:
    raw = json.loads(CATALOG_IN.read_text())
    rewritten = {}
    for video_id, info in raw.items():
        feat_name = Path(info["features_path"]).name
        rewritten[video_id] = {
            **info,
            "features_path": str(FEATURES_ROOT / feat_name),
        }
    out_path.write_text(json.dumps(rewritten, indent=2))
    return out_path


def encode_video_public_path(video_path: str) -> str:
    path = Path(video_path)
    rel = path.relative_to(PROJECT_ROOT / "artifacts")
    return f"/demo-source/{rel.as_posix()}"


def trace_to_payload(trace: StepTrace) -> dict:
    return {
        "step_idx": trace.step_idx,
        "time_seconds": trace.step_idx / ENV_FPS,
        "video_id": trace.video_id,
        "video_path": encode_video_public_path(trace.video_path),
        "cluster_id": trace.cluster_id,
        "target_cluster": trace.target_cluster,
        "scroll": trace.scroll,
        "auto_advanced": trace.auto_advanced,
        "video_step": trace.video_step,
        "video_length_steps": trace.video_length_steps,
        "watch_frac": trace.watch_frac,
        "session_frac": trace.session_frac,
        "reward": trace.reward,
        "activation": trace.activation,
        "delta": trace.delta,
        "weighted_activation": trace.weighted_activation,
        "weighted_delta": trace.weighted_delta,
        "switch_penalty": trace.switch_penalty,
        "short_dwell_penalty": trace.short_dwell_penalty,
        "tier": trace.tier,
        "play_count": trace.play_count,
        "digg_count": trace.digg_count,
        "duration": trace.duration,
        "region_activation": trace.region_activation,
        "region_delta": trace.region_delta,
    }


def export_variant(shared_cfg: dict, catalog_path: Path, slug: str, spec: dict) -> dict:
    _, cfg = resolve_variant_cfg(shared_cfg, spec["variant"])

    catalog = VideoCatalog(catalog_path)
    brain = BrainModel(
        checkpoint_path=BRAIN_CKPT,
        device=cfg["brain"]["device"],
        context_window=cfg["brain"].get("max_seq_len", 1024),
    )
    model = load_model(spec["policy_path"], recurrent=cfg["agent"].get("recurrent", False))
    env = make_env(cfg, catalog, brain, seed=SEED)
    traces = rollout_traces(model, env, cfg, SEED, SECONDS, PREPARED_ROOT, FALLBACK_ROOT)

    video_name = f"{slug}.mp4"
    video_out = OUT_DIR / video_name
    build_left_panel_video(
        traces,
        cfg["env"]["feature_rate_hz"],
        PHONE_SIZE,
        VIDEO_FPS,
        include_audio=False,
        out_path=video_out,
    )

    return {
        "title": spec["title"],
        "variant": VARIANT_NAMES[spec["variant"]],
        "seed": SEED,
        "duration_seconds": len(traces) / ENV_FPS,
        "feature_rate_hz": ENV_FPS,
        "video_fps": VIDEO_FPS,
        "phone_video": f"/demo/{video_name}",
        "steps": [trace_to_payload(trace) for trace in traces],
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DATA.parent.mkdir(parents=True, exist_ok=True)

    shared_cfg = load_cfg(PROJECT_ROOT / "configs" / "train.yaml")

    with tempfile.TemporaryDirectory(prefix="demo_catalog_") as tmpdir:
        catalog_path = build_catalog_copy(Path(tmpdir) / "video_catalog.json")
        payload = {
            slug: export_variant(shared_cfg, catalog_path, slug, spec)
            for slug, spec in VARIANTS.items()
        }

    OUT_DATA.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {OUT_DATA}")
    print(f"Wrote videos to {OUT_DIR}")


if __name__ == "__main__":
    main()
