#!/usr/bin/env python3
"""Download and unpack uncropped prepared TikTok videos from Google Drive."""

from __future__ import annotations

import argparse
import shutil
import zipfile
from pathlib import Path

import gdown


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--url",
        default="https://drive.google.com/drive/folders/1bZogWvlDTWm5dV6A-QoS_UYjUasmap-Z?usp=drive_link",
    )
    parser.add_argument("--filename", default="prepared-videos-pre-resize.zip")
    parser.add_argument("--download-dir", type=Path, default=Path("artifacts/downloads"))
    parser.add_argument("--output-root", type=Path, default=Path("artifacts/prepared-videos-pre-resize"))
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.output_root.exists() and any(args.output_root.rglob("videos/*.mp4")) and not args.force:
        print(f"already present: {args.output_root}")
        return

    args.download_dir.mkdir(parents=True, exist_ok=True)
    zip_path = args.download_dir / args.filename

    if not zip_path.exists() or args.force:
        downloaded = gdown.download_folder(url=args.url, output=str(args.download_dir), quiet=False, use_cookies=False)
        if not downloaded:
            raise RuntimeError(f"Failed to download folder from {args.url}")
        candidates = list(args.download_dir.rglob(args.filename))
        if not candidates:
            raise FileNotFoundError(f"Could not find {args.filename} in {args.download_dir}")
        zip_path = candidates[0]

    if args.force and args.output_root.exists():
        shutil.rmtree(args.output_root)
    args.output_root.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(args.output_root.parent)

    extracted_root = args.output_root.parent / zip_path.stem
    if extracted_root.exists() and extracted_root != args.output_root:
        if args.output_root.exists():
            shutil.rmtree(args.output_root)
        extracted_root.rename(args.output_root)

    print(f"uncropped videos ready at: {args.output_root}")


if __name__ == "__main__":
    main()

