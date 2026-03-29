#!/usr/bin/env python3
"""Export the FmriEncoder weights from a tribev2 checkpoint.

Run on a GPU machine with tribev2 installed. Produces a clean checkpoint
that can be loaded by src.brain.BrainModel without tribev2 dependencies.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
import yaml


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=None,
        help="Path to tribev2 .ckpt file. If not given, downloads from HuggingFace.",
    )
    parser.add_argument("--output", type=Path, default=Path("models/tribev2/fmri_encoder.pt"))
    parser.add_argument("--repo-id", type=str, default="facebook/tribev2")
    args = parser.parse_args()

    if args.checkpoint and args.checkpoint.exists():
        ckpt_path = args.checkpoint
    else:
        from huggingface_hub import hf_hub_download
        ckpt_path = hf_hub_download(args.repo_id, "best.ckpt")

    print(f"Loading checkpoint from {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=True, mmap=True)

    build_args = ckpt["model_build_args"]
    state_dict = {
        k.removeprefix("model."): v
        for k, v in ckpt["state_dict"].items()
    }

    feature_dims = build_args["feature_dims"]
    n_outputs = build_args["n_outputs"]
    n_output_timesteps = build_args["n_output_timesteps"]

    print(f"Feature dims: {feature_dims}")
    print(f"Outputs: {n_outputs} vertices, {n_output_timesteps} timesteps")
    print(f"State dict keys: {len(state_dict)}")

    export = {
        "feature_dims": feature_dims,
        "config": {
            "n_outputs": n_outputs,
            "n_output_timesteps": n_output_timesteps,
            "hidden": 1152,
            "n_heads": 8,
            "n_layers": 8,
            "max_seq_len": 1024,
            "low_rank": 2048,
            "n_subjects": 25,
        },
        "state_dict": state_dict,
        "build_args": build_args,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.save(export, args.output)
    print(f"Exported to {args.output}")
    print("Note: weight key mapping may need adjustment in src/brain.py")


if __name__ == "__main__":
    main()
