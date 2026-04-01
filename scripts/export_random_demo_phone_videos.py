#!/usr/bin/env python3
"""Replace website demo phone videos with random top200 TikTok clips.

This keeps the existing demo session JSON and activation traces intact and only
rebuilds the stitched phone videos shown inside the iPhone frame on the site.
"""

from __future__ import annotations

import random
import subprocess
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_ROOT / "artifacts" / "prepared-videos-pre-resize" / "tiktok-final-top200" / "videos"
OUT_DIR = PROJECT_ROOT / "web" / "public" / "demo"

CLIP_COUNT = 60
CLIP_SECONDS = 0.5
FPS = 24
OUTPUT_SIZE = (360, 720)
MAX_RATE = "550k"
BUF_SIZE = "1100k"
CRF = "33"

VARIANTS = {
    "baseline": 42,
    "cortisol": 48,
}


def probe_duration(path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return max(float(result.stdout.strip() or 0.0), 0.0)


def build_segment(src: Path, start: float, out_path: Path) -> None:
    width, height = OUTPUT_SIZE
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},fps={FPS},setsar=1"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-ss",
        f"{start:.3f}",
        "-t",
        f"{CLIP_SECONDS:.3f}",
        "-i",
        str(src),
        "-vf",
        vf,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        CRF,
        "-maxrate",
        MAX_RATE,
        "-bufsize",
        BUF_SIZE,
        "-pix_fmt",
        "yuv420p",
        str(out_path),
    ]
    subprocess.run(cmd, check=True)


def concat_segments(segment_paths: list[Path], out_path: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="demo_concat_") as tmpdir:
        concat_list = Path(tmpdir) / "segments.txt"
        concat_list.write_text("".join(f"file '{path.as_posix()}'\n" for path in segment_paths))
        cmd = [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            CRF,
            "-maxrate",
            MAX_RATE,
            "-bufsize",
            BUF_SIZE,
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out_path),
        ]
        subprocess.run(cmd, check=True)


def export_variant(slug: str, seed: int, sources: list[Path]) -> None:
    rng = random.Random(seed)
    selected = rng.sample(sources, CLIP_COUNT)

    with tempfile.TemporaryDirectory(prefix=f"demo_{slug}_") as tmpdir:
        tmpdir_path = Path(tmpdir)
        segment_paths: list[Path] = []
        for idx, src in enumerate(selected):
            duration = probe_duration(src)
            max_start = max(0.0, duration - CLIP_SECONDS - 0.05)
            start = rng.uniform(0.0, max_start) if max_start > 0.0 else 0.0
            seg_path = tmpdir_path / f"seg_{idx:03d}.mp4"
            build_segment(src, start, seg_path)
            segment_paths.append(seg_path)

        out_path = OUT_DIR / f"{slug}.mp4"
        concat_segments(segment_paths, out_path)

    print(f"Wrote {out_path}")


def main() -> None:
    if not SOURCE_DIR.exists():
        raise FileNotFoundError(f"Source directory not found: {SOURCE_DIR}")

    sources = sorted(SOURCE_DIR.glob("*.mp4"))
    if len(sources) < CLIP_COUNT:
        raise RuntimeError(
            f"Need at least {CLIP_COUNT} source videos, found {len(sources)} in {SOURCE_DIR}"
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for slug, seed in VARIANTS.items():
        export_variant(slug, seed, sources)


if __name__ == "__main__":
    main()
