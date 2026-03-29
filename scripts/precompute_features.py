#!/usr/bin/env python3
"""Extract backbone features for all videos using V-JEPA2 and W2V-BERT.

Run on a GPU machine. Saves per-video .pt files containing feature tensors
shaped (n_layer_groups, feature_dim, n_timesteps) for each modality.
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import torch
import torchaudio
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


def load_video_frames(video_path: str, fps: float) -> torch.Tensor:
    from torchcodec.decoders import VideoDecoder

    decoder = VideoDecoder(video_path)
    metadata = decoder.metadata
    total_frames = metadata.num_frames
    duration = metadata.duration_seconds

    frame_indices = np.arange(0, total_frames, max(1, int(metadata.average_fps / fps)))
    frames = decoder.get_frames_at(indices=frame_indices.tolist()).data
    return frames, duration


def extract_audio(video_path: str, sample_rate: int = AUDIO_SAMPLE_RATE) -> torch.Tensor:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name

    subprocess.run(
        [
            "ffmpeg", "-y", "-i", video_path,
            "-ac", "1", "-ar", str(sample_rate),
            "-vn", tmp_path,
        ],
        capture_output=True,
        check=True,
    )
    waveform, sr = torchaudio.load(tmp_path)
    Path(tmp_path).unlink(missing_ok=True)

    if sr != sample_rate:
        waveform = torchaudio.functional.resample(waveform, sr, sample_rate)

    return waveform.squeeze(0)


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
) -> torch.Tensor:
    frames, duration = load_video_frames(video_path, fps=VJEPA_FRAMES_PER_CLIP / VJEPA_CLIP_DURATION)

    n_timesteps = max(1, int(duration * FEATURE_RATE_HZ))
    total_frames = frames.shape[0]
    all_features = []

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
        clip = frames[indices]

        inputs = processor(clip, return_tensors="pt").to(device)
        with torch.no_grad():
            outputs = model(**inputs, output_hidden_states=True)

        grouped = group_hidden_states(
            outputs.hidden_states, VJEPA_N_LAYERS, VJEPA_CACHE_N, N_LAYER_GROUPS
        )
        pooled = grouped.mean(dim=2)
        all_features.append(pooled.cpu())

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
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    device = torch.device(args.device)

    print("Loading V-JEPA2...")
    vjepa_model = AutoModel.from_pretrained(VJEPA_REPO, trust_remote_code=True).to(device).eval()
    vjepa_processor = AutoVideoProcessor.from_pretrained(VJEPA_REPO, trust_remote_code=True)

    print("Loading W2V-BERT 2.0...")
    w2v_model = Wav2Vec2BertModel.from_pretrained(W2V_REPO).to(device).eval()
    w2v_extractor = AutoFeatureExtractor.from_pretrained(W2V_REPO)

    video_paths = []
    for d in args.videos_dir:
        video_paths.extend(sorted(d.glob("*.mp4")))
    print(f"Found {len(video_paths)} videos")

    for vpath in tqdm(video_paths, desc="Extracting features"):
        vid_id = vpath.stem
        out_path = args.output_dir / f"{vid_id}.pt"

        if args.skip_existing and out_path.exists():
            continue

        try:
            video_feats = extract_vjepa_features(str(vpath), vjepa_model, vjepa_processor, device)
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

        except Exception as e:
            print(f"FAILED {vid_id}: {e}")
            continue

    print(f"Done. Features saved to {args.output_dir}")


if __name__ == "__main__":
    main()
