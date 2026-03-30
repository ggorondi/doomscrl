#!/usr/bin/env python3
"""Prepare videos for offline transfer and feature extraction.

This transcodes the TikTok corpus into the exact spatial shape expected by the
current V-JEPA2 preprocessing path: resize the short edge to 292 px, then
center-crop to 256x256. The output also drops the frame rate to 16 fps and
audio to mono 16 kHz so the GPU box does not need to do that work on the fly.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import os
import subprocess
import time
from pathlib import Path

PREPARED_FPS = 16
PREPARED_SIDE = 256
PREPARED_RESIZE_EDGE = 292
PREPARED_AUDIO_SAMPLE_RATE = 16000


def prepared_output_dir(output_root: Path, videos_dir: Path) -> Path:
    if videos_dir.name == "videos" and len(videos_dir.parts) >= 2:
        return output_root / videos_dir.parent.name / videos_dir.name
    return output_root / videos_dir.name


def transcode_video(
    src: Path,
    dst: Path,
    crf: int,
    preset: str,
    overwrite: bool,
) -> tuple[bool, str]:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and not overwrite:
        return True, "skipped"

    vf = (
        f"fps={PREPARED_FPS},"
        f"scale='if(lt(iw,ih),{PREPARED_RESIZE_EDGE},-2)':'if(lt(iw,ih),-2,{PREPARED_RESIZE_EDGE})':flags=bilinear,"
        f"crop={PREPARED_SIDE}:{PREPARED_SIDE}"
    )
    cmd = [
        "ffmpeg",
        "-y" if overwrite else "-n",
        "-i", str(src),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", preset,
        "-crf", str(crf),
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-ac", "1",
        "-ar", str(PREPARED_AUDIO_SAMPLE_RATE),
        "-b:a", "64k",
        str(dst),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr.strip().splitlines()[-1] if result.stderr else "ffmpeg failed"
    return True, "ok"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--videos-dir", type=Path, nargs="+", required=True)
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("artifacts/prepared-videos"),
        help="Root directory for prepared videos.",
    )
    parser.add_argument("--workers", type=int, default=max(1, min(8, os.cpu_count() or 1)))
    parser.add_argument("--crf", type=int, default=30)
    parser.add_argument("--preset", type=str, default="fast")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    jobs: list[tuple[Path, Path]] = []
    for videos_dir in args.videos_dir:
        output_dir = prepared_output_dir(args.output_root, videos_dir)
        for src in sorted(videos_dir.glob("*.mp4")):
            jobs.append((src, output_dir / src.name))

    if args.limit is not None:
        jobs = jobs[:args.limit]

    total = len(jobs)
    if total == 0:
        print("No input videos found.")
        return 1

    print(f"Preparing {total} videos into {args.output_root}")
    start = time.time()
    ok = 0
    skipped = 0
    failed: list[tuple[Path, str]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        future_to_job = {
            pool.submit(transcode_video, src, dst, args.crf, args.preset, args.overwrite): (src, dst)
            for src, dst in jobs
        }
        for idx, future in enumerate(concurrent.futures.as_completed(future_to_job), start=1):
            src, dst = future_to_job[future]
            success, message = future.result()
            if success:
                if message == "skipped":
                    skipped += 1
                else:
                    ok += 1
            else:
                failed.append((src, message))
            if idx == total or idx % 25 == 0:
                elapsed = time.time() - start
                rate = idx / elapsed if elapsed > 0 else 0.0
                print(
                    f"[{idx}/{total}] ok={ok} skipped={skipped} failed={len(failed)} "
                    f"({rate:.2f} videos/s)"
                )

    elapsed = time.time() - start
    print(
        f"Done in {elapsed / 60:.1f} min: ok={ok}, skipped={skipped}, failed={len(failed)}"
    )
    if failed:
        print("Failures:")
        for src, message in failed[:20]:
            print(f"  {src}: {message}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
