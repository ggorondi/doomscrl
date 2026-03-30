#!/usr/bin/env python3
"""Export the FmriEncoder weights from a tribev2 checkpoint.

Run on a GPU machine with tribev2 installed. Produces a clean checkpoint
that can be loaded by src.brain.BrainModel without tribev2 dependencies.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import torch

DEFAULT_LOCAL_CKPT = Path("models/tribev2/best.ckpt")


def infer_export_config(state_dict: dict[str, torch.Tensor]) -> dict[str, int]:
    hidden = state_dict["time_pos_embed"].shape[-1]
    max_seq_len = state_dict["time_pos_embed"].shape[1]
    low_rank_head = state_dict.get("low_rank_head.weight")
    low_rank = low_rank_head.shape[0] if low_rank_head is not None else 0
    predictor = state_dict["predictor.weights"]
    n_outputs = predictor.shape[-1]
    n_subjects = predictor.shape[0]
    layer_ids = {
        int(k.split(".")[2])
        for k in state_dict
        if k.startswith("encoder.layers.")
    }
    head_dim = state_dict["encoder.rotary_pos_emb.inv_freq"].shape[0] * 2
    return {
        "n_outputs": n_outputs,
        "hidden": hidden,
        "n_heads": hidden // head_dim,
        "n_layers": len(layer_ids),
        "max_seq_len": max_seq_len,
        "low_rank": low_rank,
        "n_subjects": n_subjects,
    }


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
    elif DEFAULT_LOCAL_CKPT.exists():
        ckpt_path = DEFAULT_LOCAL_CKPT
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

    config = infer_export_config(state_dict)
    config["n_output_timesteps"] = n_output_timesteps

    export = {
        "feature_dims": feature_dims,
        "config": config,
        "state_dict": state_dict,
        "build_args": build_args,
        "format": "tribev2-export",
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.save(export, args.output)
    print(f"Exported to {args.output}")


if __name__ == "__main__":
    main()
