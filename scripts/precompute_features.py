#!/usr/bin/env python3
"""Extract backbone features for all videos using V-JEPA2 and W2V-BERT.

Run on a GPU machine. Saves per-video .pt files containing feature tensors
shaped (n_layer_groups, feature_dim, n_timesteps) for each modality.
"""

from __future__ import annotations

import argparse
import json
import sys
import subprocess
from pathlib import Path

import numpy as np
import torch
from tqdm import tqdm
from transformers import (
    AutoModel,
    AutoVideoProcessor,
    Wav2Vec2BertModel,
    AutoFeatureExtractor,
)

FEATURE_RATE_HZ = 2.0
VJEPA_CLIP_DURATION = 4.0
VJEPA_FRAMES_PER_CLIP = 64
VJEPA_REPO = "facebook/vjepa2-vitg-fpc64-256"
W2V_REPO = "facebook/w2v-bert-2.0"
AUDIO_SAMPLE_RATE = 16000

VJEPA_N_LAYERS = 40
VJEPA_CACHE_N = 20
W2V_N_LAYERS = 24
W2V_CACHE_N = 20
N_LAYER_GROUPS = 3

DEFAULT_LOCAL_VJEPA = Path("models/vjepa-")
DEFAULT_LOCAL_W2V = Path("models/w2v-bert-2.0")


def probe_video_metadata(video_path: str) -> tuple[int, int, float]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-show_entries", "format=duration",
            "-of", "json",
            video_path,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(result.stdout)
    stream = payload["streams"][0]
    duration = float(payload["format"]["duration"])
    return int(stream["width"]), int(stream["height"]), duration


def load_video_frames_ffmpeg(video_path: str, fps: float) -> tuple[torch.Tensor, float]:
    width, height, duration = probe_video_metadata(video_path)
    result = subprocess.run(
        [
            "ffmpeg",
            "-v", "error",
            "-i", video_path,
            "-vf", f"fps={fps}",
            "-f", "rawvideo",
            "-pix_fmt", "rgb24",
            "pipe:1",
        ],
        capture_output=True,
        check=True,
    )

    frame_size = width * height * 3
    raw = result.stdout
    if len(raw) == 0 or len(raw) % frame_size != 0:
        raise RuntimeError(f"ffmpeg produced an unexpected raw frame buffer for {video_path}")

    frame_count = len(raw) // frame_size
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(frame_count, height, width, 3)
    return torch.from_numpy(frames.copy()), duration


def load_video_frames(video_path: str, fps: float) -> tuple[torch.Tensor, float]:
    return load_video_frames_ffmpeg(video_path, fps)


def resolve_model_source(local_path: Path, repo_id: str) -> str:
    if local_path.exists():
        return str(local_path)
    return repo_id


def extract_audio(video_path: str, sample_rate: int = AUDIO_SAMPLE_RATE) -> torch.Tensor:
    result = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", video_path,
            "-ac", "1", "-ar", str(sample_rate),
            "-vn",
            "-f", "f32le",
            "pipe:1",
        ],
        capture_output=True,
        check=True,
    )

    audio = np.frombuffer(result.stdout, dtype=np.float32)
    if audio.size == 0:
        raise RuntimeError(f"ffmpeg produced no audio samples for {video_path}")

    return torch.from_numpy(audio.copy())


def group_hidden_states(
    hidden_states: tuple[torch.Tensor, ...],
    total_layers: int,
    cache_n: int,
    n_groups: int,
) -> torch.Tensor:
    start = total_layers - cache_n
    cached = [hidden_states[i + 1] for i in range(start, total_layers)]

    group_size = cache_n // n_groups
    groups = []
    for g in range(n_groups):
        s = g * group_size
        e = s + group_size if g < n_groups - 1 else cache_n
        group_tensors = cached[s:e]
        groups.append(torch.stack(group_tensors).mean(dim=0))

    return torch.stack(groups)


def extract_vjepa_features(
    video_path: str,
    model: torch.nn.Module,
    processor: AutoVideoProcessor,
    device: torch.device,
    skip_spatial_preprocess: bool = False,
    batch_size: int = 1,
) -> torch.Tensor:
    frames, duration = load_video_frames(video_path, fps=VJEPA_FRAMES_PER_CLIP / VJEPA_CLIP_DURATION)

    n_timesteps = max(1, int(duration * FEATURE_RATE_HZ))
    total_frames = frames.shape[0]
    clips = []

    for t in range(n_timesteps):
        center_sec = t / FEATURE_RATE_HZ
        center_frame = int(center_sec * total_frames / duration) if duration > 0 else 0

        half_clip = VJEPA_FRAMES_PER_CLIP // 2
        start_f = max(0, center_frame - half_clip)
        end_f = start_f + VJEPA_FRAMES_PER_CLIP

        if end_f > total_frames:
            end_f = total_frames
            start_f = max(0, end_f - VJEPA_FRAMES_PER_CLIP)

        indices = np.linspace(start_f, max(start_f, end_f - 1), VJEPA_FRAMES_PER_CLIP, dtype=int)
        clips.append(frames[indices].numpy())

    processor_kwargs = {"return_tensors": "pt"}
    if skip_spatial_preprocess:
        processor_kwargs.update(
            do_resize=False,
            do_center_crop=False,
        )

    all_features = []
    for start in range(0, len(clips), batch_size):
        batch_clips = clips[start : start + batch_size]
        inputs = processor(batch_clips, **processor_kwargs).to(device)
        with torch.inference_mode():
            outputs = model(**inputs, output_hidden_states=True)

        grouped = group_hidden_states(
            outputs.hidden_states, VJEPA_N_LAYERS, VJEPA_CACHE_N, N_LAYER_GROUPS
        )
        pooled = grouped.mean(dim=2)
        if pooled.ndim == 2:
            pooled = pooled.unsqueeze(0)
        elif pooled.ndim == 3:
            pooled = pooled.permute(1, 0, 2)
        else:
            raise RuntimeError(f"Unexpected V-JEPA pooled feature shape: {tuple(pooled.shape)}")

        all_features.extend(pooled.cpu())

    features = torch.stack(all_features, dim=-1)
    return features


def extract_audio_features(
    video_path: str,
    model: Wav2Vec2BertModel,
    feature_extractor,
    device: torch.device,
    duration: float,
) -> torch.Tensor:
    try:
        waveform = extract_audio(video_path)
    except subprocess.CalledProcessError:
        n_timesteps = max(1, int(duration * FEATURE_RATE_HZ))
        return torch.zeros(N_LAYER_GROUPS, model.config.hidden_size, n_timesteps)

    inputs = feature_extractor(
        waveform.numpy(), sampling_rate=AUDIO_SAMPLE_RATE, return_tensors="pt"
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs, output_hidden_states=True)

    grouped = group_hidden_states(
        outputs.hidden_states, W2V_N_LAYERS, W2V_CACHE_N, N_LAYER_GROUPS
    )
    pooled = grouped.mean(dim=2)
    if pooled.ndim == 3 and pooled.shape[1] == 1:
        pooled = pooled.squeeze(1)

    n_timesteps = max(1, int(duration * FEATURE_RATE_HZ))
    T_audio = pooled.shape[-1] if pooled.ndim > 2 else 1
    if pooled.ndim == 2:
        pooled = pooled.unsqueeze(-1).expand(-1, -1, n_timesteps)
    elif T_audio != n_timesteps:
        pooled = torch.nn.functional.interpolate(
            pooled.unsqueeze(0), size=n_timesteps, mode="linear", align_corners=False
        ).squeeze(0)

    return pooled.cpu()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--videos-dir", type=Path, nargs="+", required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("artifacts/features"))
    parser.add_argument("--device", type=str, default="cuda")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--vjepa-batch-size", type=int, default=2)
    parser.add_argument("--num-shards", type=int, default=1)
    parser.add_argument("--shard-index", type=int, default=0)
    parser.add_argument(
        "--vjepa-source",
        type=str,
        default=None,
        help="Local model directory or Hugging Face repo id for V-JEPA2.",
    )
    parser.add_argument(
        "--w2v-source",
        type=str,
        default=None,
        help="Local model directory or Hugging Face repo id for W2V-BERT 2.0.",
    )
    parser.add_argument(
        "--videos-already-preprocessed",
        action="store_true",
        help="Skip V-JEPA spatial resize/crop because the input videos were already prepared to 256x256.",
    )
    args = parser.parse_args()

    if args.num_shards < 1:
        raise ValueError("--num-shards must be >= 1")
    if not 0 <= args.shard_index < args.num_shards:
        raise ValueError("--shard-index must be in [0, --num-shards)")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    device = torch.device(args.device)
    vjepa_source = args.vjepa_source or resolve_model_source(DEFAULT_LOCAL_VJEPA, VJEPA_REPO)
    w2v_source = args.w2v_source or resolve_model_source(DEFAULT_LOCAL_W2V, W2V_REPO)

    print(f"Loading V-JEPA2 from {vjepa_source}...", flush=True)
    vjepa_model = AutoModel.from_pretrained(vjepa_source, trust_remote_code=True).to(device).eval()
    vjepa_processor = AutoVideoProcessor.from_pretrained(vjepa_source, trust_remote_code=True)

    print(f"Loading W2V-BERT 2.0 from {w2v_source}...", flush=True)
    w2v_model = Wav2Vec2BertModel.from_pretrained(w2v_source).to(device).eval()
    w2v_extractor = AutoFeatureExtractor.from_pretrained(w2v_source)

    video_paths = []
    for d in args.videos_dir:
        video_paths.extend(sorted(d.glob("*.mp4")))
    if args.num_shards > 1:
        video_paths = video_paths[args.shard_index :: args.num_shards]
    if args.limit is not None:
        video_paths = video_paths[: args.limit]
    print(
        f"Found {len(video_paths)} videos for shard {args.shard_index + 1}/{args.num_shards}",
        flush=True,
    )

    progress = tqdm(
        video_paths,
        desc="Extracting features",
        unit="video",
        dynamic_ncols=True,
        mininterval=1.0,
        file=sys.stdout,
    )
    for vpath in progress:
        vid_id = vpath.stem
        out_path = args.output_dir / f"{vid_id}.pt"

        if args.skip_existing and out_path.exists():
            continue

        progress.set_postfix_str(vid_id)

        try:
            video_feats = extract_vjepa_features(
                str(vpath),
                vjepa_model,
                vjepa_processor,
                device,
                skip_spatial_preprocess=args.videos_already_preprocessed,
                batch_size=args.vjepa_batch_size,
            )
            n_timesteps = video_feats.shape[-1]
            duration = n_timesteps / FEATURE_RATE_HZ

            audio_feats = extract_audio_features(
                str(vpath), w2v_model, w2v_extractor, device, duration
            )

            if audio_feats.shape[-1] != n_timesteps:
                audio_feats = torch.nn.functional.interpolate(
                    audio_feats.unsqueeze(0), size=n_timesteps, mode="linear", align_corners=False
                ).squeeze(0)

            torch.save({"video": video_feats, "audio": audio_feats}, out_path)
            if progress.n < 5 or (progress.n + 1) % 50 == 0:
                tqdm.write(f"SAVED {vid_id} -> {out_path}", file=sys.stdout)

        except Exception as e:
            tqdm.write(f"FAILED {vid_id}: {e}", file=sys.stdout)
            continue

    print(f"Done. Features saved to {args.output_dir}", flush=True)


if __name__ == "__main__":
    main()
