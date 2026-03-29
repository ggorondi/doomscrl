#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import json
import random
import shutil
import subprocess
import time
from pathlib import Path

import pandas as pd


DEFAULT_COLUMNS = [
    "id",
    "url",
    "duration",
    "desc",
    "play_count",
    "digg_count",
    "comment_count",
    "share_count",
    "music_play_url",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sample TikTok rows from a parquet shard and optionally download videos."
    )
    parser.add_argument(
        "--parquet",
        type=Path,
        default=Path("datasets/tiktok-10M/train-00000-of-00010.parquet"),
    )
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument(
        "--sample-mode",
        choices=["sequential", "random"],
        default="sequential",
    )
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument(
        "--sort-by",
        choices=["none", "play_count", "digg_count", "duration"],
        default="none",
    )
    parser.add_argument("--min-duration", type=int, default=1)
    parser.add_argument("--max-duration", type=int, default=300)
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("artifacts/tiktok-sample"),
    )
    parser.add_argument("--download", action="store_true")
    parser.add_argument(
        "--yt-dlp-bin",
        type=Path,
        default=Path(".venv/bin/yt-dlp"),
    )
    parser.add_argument(
        "--max-height",
        type=int,
        default=None,
        help="If set, prefer formats at or below this video height.",
    )
    parser.add_argument("--sleep-min", type=float, default=0.0)
    parser.add_argument("--sleep-max", type=float, default=0.0)
    return parser.parse_args()


def load_rows(args: argparse.Namespace) -> pd.DataFrame:
    df = pd.read_parquet(args.parquet, columns=DEFAULT_COLUMNS)
    df = df[df["url"].notna()].copy()
    df = df[df["duration"].between(args.min_duration, args.max_duration)]
    if args.sort_by != "none":
        df = df.sort_values(args.sort_by, ascending=False)
    if args.sample_mode == "random":
        sample_n = min(args.limit, len(df))
        df = df.sample(n=sample_n, random_state=args.seed)
        return df.reset_index(drop=True)
    return df.iloc[args.offset : args.offset + args.limit].reset_index(drop=True)


def write_metadata(df: pd.DataFrame, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = out_dir / "metadata.csv"
    df.to_csv(metadata_path, index=False, quoting=csv.QUOTE_MINIMAL)
    return metadata_path


def write_urls(df: pd.DataFrame, out_dir: Path) -> Path:
    urls_path = out_dir / "urls.txt"
    urls_path.write_text("\n".join(df["url"].astype(str)) + "\n")
    return urls_path

def run_yt_dlp(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, text=True, capture_output=True)


def pick_format_id(yt_dlp_bin: str, url: str, max_height: int) -> str:
    cmd = [yt_dlp_bin, "--skip-download", "--dump-single-json", url]
    result = run_yt_dlp(cmd)
    info = json.loads(result.stdout)
    formats = info.get("formats", [])

    candidates = []
    for fmt in formats:
        height = fmt.get("height")
        if not height or height > max_height:
            continue
        if fmt.get("vcodec") in (None, "none") or fmt.get("acodec") in (None, "none"):
            continue
        candidates.append(fmt)

    if not candidates:
        return "b"

    candidates.sort(
        key=lambda fmt: (
            int(fmt.get("height") or 0),
            float(fmt.get("filesize") or 0),
            float(fmt.get("tbr") or 0),
            str(fmt.get("format_id") or ""),
        )
    )
    return str(candidates[-1]["format_id"])


def download_one_video(yt_dlp_bin: str, url: str, out_template: str, format_selector: str) -> None:
    cmd = [
        yt_dlp_bin,
        "--newline",
        "--ignore-errors",
        "--no-playlist",
        "--restrict-filenames",
        "-f",
        format_selector,
        "-o",
        out_template,
        url,
    ]
    subprocess.run(cmd, check=True)


def append_failure(out_dir: Path, video_id: int, url: str, error: str) -> None:
    failures_path = out_dir / "failures.csv"
    write_header = not failures_path.exists()
    with failures_path.open("a", newline="") as handle:
        writer = csv.writer(handle)
        if write_header:
            writer.writerow(["id", "url", "error"])
        writer.writerow([video_id, url, error])


def maybe_sleep(args: argparse.Namespace) -> None:
    if args.sleep_max <= 0:
        return
    sleep_min = max(0.0, args.sleep_min)
    sleep_max = max(sleep_min, args.sleep_max)
    delay = random.uniform(sleep_min, sleep_max)
    print(f"sleeping {delay:.2f}s")
    time.sleep(delay)


def download_videos(args: argparse.Namespace, df: pd.DataFrame, urls_path: Path, out_dir: Path) -> None:
    yt_dlp_bin = shutil.which(str(args.yt_dlp_bin)) or str(args.yt_dlp_bin)
    videos_dir = out_dir / "videos"
    videos_dir.mkdir(parents=True, exist_ok=True)
    if args.max_height or args.sleep_max > 0:
        rows = list(df.to_dict("records"))
        for index, row in enumerate(rows):
            output_path = videos_dir / f"{int(row['id'])}.mp4"
            if output_path.exists():
                print(f"skipping existing {output_path.name}")
                continue
            url = str(row["url"])
            format_selector = "b"
            if args.max_height:
                format_selector = pick_format_id(yt_dlp_bin, url, args.max_height)
            try:
                download_one_video(
                    yt_dlp_bin,
                    url,
                    str(videos_dir / "%(id)s.%(ext)s"),
                    format_selector,
                )
            except subprocess.CalledProcessError as exc:
                error = f"exit_code={exc.returncode}"
                print(f"failed {row['id']}: {error}")
                append_failure(out_dir, int(row["id"]), url, error)
            if index < len(rows) - 1:
                maybe_sleep(args)
        return

    cmd = [
        yt_dlp_bin,
        "--newline",
        "--ignore-errors",
        "--no-playlist",
        "--restrict-filenames",
        "-o",
        str(videos_dir / "%(id)s.%(ext)s"),
        "-a",
        str(urls_path),
    ]
    subprocess.run(cmd, check=True)


def main() -> None:
    args = parse_args()
    if args.sleep_min > args.sleep_max:
        raise SystemExit("--sleep-min cannot be greater than --sleep-max.")
    df = load_rows(args)
    if df.empty:
        raise SystemExit("No rows matched the requested filters.")

    out_dir = args.out_dir
    metadata_path = write_metadata(df, out_dir)
    urls_path = write_urls(df, out_dir)

    print(f"wrote metadata: {metadata_path}")
    print(f"wrote urls: {urls_path}")
    print()
    print(df[["id", "duration", "play_count", "url"]].to_string(index=False))

    if args.download:
        download_videos(args, df, urls_path, out_dir)
        print()
        print(f"downloaded videos to: {out_dir / 'videos'}")


if __name__ == "__main__":
    main()
