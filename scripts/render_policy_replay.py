#!/usr/bin/env python3
"""Render policy rollouts as real video+audio composites with a 3D brain panel."""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from io import BytesIO
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.cm as cm
import matplotlib.pyplot as plt
import numpy as np
import torch
import yaml
from matplotlib.figure import Figure
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from PIL import Image, ImageDraw, ImageFont
from stable_baselines3 import PPO

try:
    from sb3_contrib import RecurrentPPO
except ImportError:  # pragma: no cover - optional for recurrent replay
    RecurrentPPO = None

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.brain import BrainModel
from src.brain_regions import REGION_NAMES
from src.catalog import VideoCatalog, VideoEntry
from src.env.scroll_env import DoomScrollEnv
from src.env.scroll_select_env import DoomScrollSelectEnv
from src.train import VARIANT_NAMES, build_reward_model, resolve_variant_cfg

RESAMPLE = getattr(Image, "Resampling", Image).BICUBIC
TIER_DIRS = {
    "top": "tiktok-final-top200",
    "high": "tiktok-final-high300",
    "random": "tiktok-final-random500",
}


@dataclass
class StepTrace:
    step_idx: int
    video_id: str
    video_path: str
    cluster_id: int
    target_cluster: int
    scroll: bool
    auto_advanced: bool
    video_step: int
    video_length_steps: int
    watch_frac: float
    session_frac: float
    reward: float
    activation: float
    delta: float
    weighted_activation: float
    weighted_delta: float
    switch_penalty: float
    short_dwell_penalty: float
    play_count: float
    digg_count: float
    duration: float
    tier: str
    region_activation: list[float]
    region_delta: list[float]
    prediction: np.ndarray


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("configs/train.yaml"))
    parser.add_argument("--variant", choices=sorted(VARIANT_NAMES), default="a")
    parser.add_argument("--policy-path", type=Path, default=Path("runs/select_baseline/best_model/best_model.zip"))
    parser.add_argument("--prepared-root", type=Path, default=None)
    parser.add_argument("--fallback-prepared-root", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--seconds", type=float, default=30.0)
    parser.add_argument("--seeds", type=int, nargs="+", default=[42, 43, 44])
    parser.add_argument("--fps", type=int, default=None)
    parser.add_argument("--brain-render", choices=["mesh3d"], default="mesh3d")
    parser.add_argument("--include-audio", dest="include_audio", action="store_true")
    parser.add_argument("--no-audio", dest="include_audio", action="store_false")
    parser.set_defaults(include_audio=None)
    return parser.parse_args()


def load_cfg(path: Path) -> dict:
    with path.open() as f:
        return yaml.safe_load(f)


def make_env(cfg: dict, catalog: VideoCatalog, brain: BrainModel, seed: int):
    env_kwargs = dict(
        catalog=catalog,
        brain=brain,
        reward_model=build_reward_model(cfg),
        session_duration=cfg["env"]["session_duration_s"],
        feature_rate=cfg["env"]["feature_rate_hz"],
        activation_history_len=cfg["env"]["activation_history_len"],
        video_summary_dim=cfg["env"]["video_summary_dim"],
        include_region_stats=cfg["observation"].get("include_region_stats", False),
        seed=seed,
    )
    if cfg["agent"]["env_type"] == "scroll":
        return DoomScrollEnv(**env_kwargs)
    return DoomScrollSelectEnv(**env_kwargs)


def video_path_for_entry(entry: VideoEntry, prepared_root: Path, fallback_root: Path) -> Path:
    subdir = TIER_DIRS[entry.tier]
    primary = prepared_root / subdir / "videos" / f"{entry.video_id}.mp4"
    if primary.exists():
        return primary
    secondary = fallback_root / subdir / "videos" / f"{entry.video_id}.mp4"
    if secondary.exists():
        return secondary
    raw = PROJECT_ROOT / "artifacts" / subdir / "videos" / f"{entry.video_id}.mp4"
    return raw


def trace_scroll_step(env: DoomScrollEnv, action: int, prepared_root: Path, fallback_root: Path) -> tuple[np.ndarray, bool, StepTrace]:
    manual_switch = int(action) == 1 and env._current_entry is not None
    ended_watch_steps = 0
    if manual_switch:
        ended_watch_steps = env._video_step
        env._advance_feed()

    pred = env._get_current_prediction()
    entry = env._current_entry
    assert entry is not None
    video_step_used = env._video_step
    breakdown = env.reward_fn.step(pred, manual_switch=manual_switch, watched_steps=ended_watch_steps)
    env._set_region_state(breakdown)
    env._push_history(breakdown.reward)

    video_T = env._video_length(entry.load_features())
    trace = StepTrace(
        step_idx=env._step_count,
        video_id=entry.video_id,
        video_path=str(video_path_for_entry(entry, prepared_root, fallback_root)),
        cluster_id=entry.cluster_id,
        target_cluster=entry.cluster_id if manual_switch else -1,
        scroll=manual_switch,
        auto_advanced=False,
        video_step=video_step_used,
        video_length_steps=video_T,
        watch_frac=video_step_used / max(video_T, 1),
        session_frac=env._step_count / max(env.max_steps, 1),
        reward=breakdown.reward,
        activation=breakdown.activation,
        delta=breakdown.delta,
        weighted_activation=breakdown.weighted_activation,
        weighted_delta=breakdown.weighted_delta,
        switch_penalty=breakdown.switch_penalty,
        short_dwell_penalty=breakdown.short_dwell_penalty,
        play_count=float(entry.play_count),
        digg_count=float(entry.digg_count),
        duration=float(entry.duration),
        tier=entry.tier,
        region_activation=breakdown.region_activation.tolist(),
        region_delta=breakdown.region_delta.tolist(),
        prediction=pred.detach().cpu().numpy().astype(np.float32, copy=False),
    )

    env._video_step += 1
    env._step_count += 1
    if env._video_step >= video_T:
        env._advance_feed()
        trace.auto_advanced = True

    done = env._step_count >= env.max_steps or (env._current_entry is None and env._feed_idx >= len(env._feed))
    return env._obs(), done, trace


def trace_select_step(
    env: DoomScrollSelectEnv,
    action: np.ndarray,
    prepared_root: Path,
    fallback_root: Path,
) -> tuple[np.ndarray, bool, StepTrace]:
    action = np.asarray(action).reshape(-1)
    scroll = int(action[0])
    target_cluster = int(action[1])
    manual_switch = scroll == 1 and env._current_entry is not None
    ended_watch_steps = 0
    if manual_switch:
        ended_watch_steps = env._video_step
        env._load_from_cluster(target_cluster)

    pred = env._get_current_prediction()
    entry = env._current_entry
    assert entry is not None
    video_step_used = env._video_step
    breakdown = env.reward_fn.step(pred, manual_switch=manual_switch, watched_steps=ended_watch_steps)
    env._set_region_state(breakdown)
    env._push_history(breakdown.reward)

    video_T = env._video_length(entry.load_features())
    trace = StepTrace(
        step_idx=env._step_count,
        video_id=entry.video_id,
        video_path=str(video_path_for_entry(entry, prepared_root, fallback_root)),
        cluster_id=entry.cluster_id,
        target_cluster=target_cluster if manual_switch else -1,
        scroll=manual_switch,
        auto_advanced=False,
        video_step=video_step_used,
        video_length_steps=video_T,
        watch_frac=video_step_used / max(video_T, 1),
        session_frac=env._step_count / max(env.max_steps, 1),
        reward=breakdown.reward,
        activation=breakdown.activation,
        delta=breakdown.delta,
        weighted_activation=breakdown.weighted_activation,
        weighted_delta=breakdown.weighted_delta,
        switch_penalty=breakdown.switch_penalty,
        short_dwell_penalty=breakdown.short_dwell_penalty,
        play_count=float(entry.play_count),
        digg_count=float(entry.digg_count),
        duration=float(entry.duration),
        tier=entry.tier,
        region_activation=breakdown.region_activation.tolist(),
        region_delta=breakdown.region_delta.tolist(),
        prediction=pred.detach().cpu().numpy().astype(np.float32, copy=False),
    )

    env._video_step += 1
    env._step_count += 1
    if env._video_step >= video_T:
        env._load_from_cluster(env._rng.randrange(env.n_clusters))
        trace.auto_advanced = True

    done = env._step_count >= env.max_steps
    return env._obs(), done, trace


def rollout_traces(model, env, cfg: dict, seed: int, seconds: float, prepared_root: Path, fallback_root: Path) -> list[StepTrace]:
    n_steps = int(seconds * cfg["env"]["feature_rate_hz"])
    obs, _ = env.reset(seed=seed)
    traces: list[StepTrace] = []
    lstm_state = None
    episode_start = np.ones((1,), dtype=bool)
    recurrent = cfg["agent"].get("recurrent", False)

    for _ in range(n_steps):
        if recurrent:
            action, lstm_state = model.predict(obs, state=lstm_state, episode_start=episode_start, deterministic=True)
        else:
            action, _ = model.predict(obs, deterministic=True)

        if cfg["agent"]["env_type"] == "scroll":
            obs, done, trace = trace_scroll_step(env, int(action), prepared_root, fallback_root)
        else:
            obs, done, trace = trace_select_step(env, np.asarray(action), prepared_root, fallback_root)
        traces.append(trace)
        episode_start[:] = done
        if done:
            break
    return traces


def ffmpeg_extract_frame(video_path: str, t_sec: float) -> Image.Image:
    placeholder = Image.new("RGB", (128, 128), "white")
    if not video_path or not Path(video_path).exists():
        return placeholder
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-ss",
        f"{t_sec:.3f}",
        "-i",
        video_path,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "pipe:1",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, check=True)
        return Image.open(BytesIO(result.stdout)).convert("RGB")
    except Exception:
        return placeholder


def merge_video_segments(traces: list[StepTrace], env_fps: float) -> list[tuple[str, float, float]]:
    merged: list[tuple[str, float, float]] = []
    for trace in traces:
        start = trace.video_step / env_fps
        duration = 1.0 / env_fps
        if merged:
            prev_path, prev_start, prev_dur = merged[-1]
            prev_end = prev_start + prev_dur
            if prev_path == trace.video_path and abs(prev_end - start) < 1e-4:
                merged[-1] = (prev_path, prev_start, prev_dur + duration)
                continue
        merged.append((trace.video_path, start, duration))
    return merged


def build_left_panel_video(
    traces: list[StepTrace],
    env_fps: float,
    size: tuple[int, int],
    fps: int,
    include_audio: bool,
    out_path: Path,
) -> None:
    segments = merge_video_segments(traces, env_fps)
    width, height = size
    with tempfile.TemporaryDirectory(prefix="replay_left_segments_") as tmpdir:
        tmpdir = Path(tmpdir)
        segment_paths: list[Path] = []
        for idx, (video_path, start, duration) in enumerate(segments):
            seg_path = tmpdir / f"seg_{idx:04d}.mp4"
            cmd = [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-ss",
                f"{start:.3f}",
                "-t",
                f"{duration:.3f}",
                "-i",
                video_path,
                "-vf",
                f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:white,fps={fps},setsar=1",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
            ]
            if include_audio:
                cmd += ["-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest"]
            else:
                cmd += ["-an"]
            cmd.append(str(seg_path))
            subprocess.run(cmd, check=True)
            segment_paths.append(seg_path)

        concat_list = tmpdir / "segments.txt"
        concat_list.write_text("".join(f"file '{path.as_posix()}'\n" for path in segment_paths))
        concat_cmd = [
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
            "-c",
            "copy",
            str(out_path),
        ]
        subprocess.run(concat_cmd, check=True)


class BrainFrameRenderer:

    def __init__(self, mesh_path: Path, image_size: tuple[int, int]):
        with mesh_path.open() as f:
            mesh = json.load(f)
        self.vertices = np.asarray(mesh["vertices"], dtype=np.float32)
        self.faces = np.asarray(mesh["faces"], dtype=np.int32)
        self.image_size = image_size
        self.face_vertices = self.vertices[self.faces]
        self.fig = Figure(figsize=(image_size[0] / 100, image_size[1] / 100), dpi=100)
        self.ax = self.fig.add_subplot(111, projection="3d")
        self.ax.set_axis_off()
        self.ax.set_facecolor("white")
        self.fig.patch.set_facecolor("white")
        self.collection = Poly3DCollection(
            self.face_vertices,
            linewidths=0.0,
            edgecolors="none",
        )
        self.ax.add_collection3d(self.collection)
        lim = float(np.abs(self.vertices).max()) * 1.05
        self.ax.set_xlim(-lim, lim)
        self.ax.set_ylim(-lim, lim)
        self.ax.set_zlim(-lim, lim)
        self.ax.set_box_aspect((1.3, 1.0, 0.8))

    def render(self, prediction: np.ndarray, vmax: float, azim: float) -> Image.Image:
        norm = np.clip(np.abs(prediction) / max(vmax, 1e-6), 0.0, 1.0)
        colors = cm.get_cmap("inferno")(norm)
        face_colors = colors[self.faces].mean(axis=1)
        self.collection.set_facecolors(face_colors)
        self.ax.view_init(elev=18.0, azim=azim)
        buf = BytesIO()
        self.fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.0, facecolor="white")
        buf.seek(0)
        return Image.open(buf).convert("RGB").resize(self.image_size, RESAMPLE)


def interpolate_prediction(traces: list[StepTrace], t_sec: float, env_fps: float) -> tuple[np.ndarray, StepTrace]:
    step_f = t_sec * env_fps
    idx0 = min(int(math.floor(step_f)), len(traces) - 1)
    idx1 = min(idx0 + 1, len(traces) - 1)
    frac = float(np.clip(step_f - idx0, 0.0, 1.0))
    pred0 = traces[idx0].prediction
    pred1 = traces[idx1].prediction
    pred = pred0 * (1.0 - frac) + pred1 * frac
    trace = traces[idx0]
    return pred.astype(np.float32, copy=False), trace


def draw_bar(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], label: str, value: float, scale: float, color: tuple[int, int, int]) -> None:
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=8, fill=(245, 245, 245), outline=(220, 220, 220), width=2)
    frac = np.clip(value / max(scale, 1e-6), 0.0, 1.0)
    fill_x = x0 + int((x1 - x0) * frac)
    if fill_x > x0 + 1:
        draw.rounded_rectangle((x0 + 1, y0 + 1, fill_x, y1 - 1), radius=8, fill=color)
    draw.text((x0, y0 - 18), f"{label}: {value:.3f}", fill=(35, 35, 35))


def build_timeline_base(traces: list[StepTrace], size: tuple[int, int], env_fps: float) -> Image.Image:
    width, height = size
    canvas = Image.new("RGB", size, "white")
    n = len(traces)
    for idx, trace in enumerate(traces):
        x0 = int(idx * width / n)
        x1 = int((idx + 1) * width / n)
        thumb = ffmpeg_extract_frame(trace.video_path, trace.video_step / env_fps).resize((max(1, x1 - x0), height - 10), RESAMPLE)
        canvas.paste(thumb, (x0, 5))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, width - 1, height - 1), outline=(220, 220, 220), width=2)
    return canvas


def build_right_and_timeline_videos(
    traces: list[StepTrace],
    cfg: dict,
    seconds: float,
    fps: int,
    right_panel_path: Path,
    timeline_path: Path,
) -> None:
    replay_cfg = cfg["replay"]
    total_w = replay_cfg["canvas_width"]
    total_h = replay_cfg["canvas_height"]
    timeline_h = replay_cfg["timeline_height"]
    content_h = total_h - timeline_h
    right_w = total_w - replay_cfg["video_panel_width"]

    panel_size = (right_w, content_h)
    timeline_size = (total_w, timeline_h)
    mesh_path = PROJECT_ROOT / "web" / "public" / "brain_mesh.json"
    renderer = BrainFrameRenderer(mesh_path, (right_w - 48, content_h - 250))
    env_fps = cfg["env"]["feature_rate_hz"]
    vmax = max(float(np.max(np.abs(t.prediction))) for t in traces)
    reward_scale = max(float(max(t.reward for t in traces)), 1e-6)
    delta_scale = max(float(max(t.delta for t in traces)), 1e-6)
    act_scale = max(float(max(t.weighted_activation for t in traces)), 1e-6)
    timeline_base = build_timeline_base(traces, timeline_size, env_fps)
    n_frames = max(1, int(round(seconds * fps)))

    with tempfile.TemporaryDirectory(prefix="replay_rhs_") as tmpdir:
        tmpdir = Path(tmpdir)
        rhs_dir = tmpdir / "rhs"
        tl_dir = tmpdir / "timeline"
        rhs_dir.mkdir()
        tl_dir.mkdir()
        for frame_idx in range(n_frames):
            t_sec = frame_idx / fps
            pred, trace = interpolate_prediction(traces, t_sec, env_fps)
            brain = renderer.render(pred, vmax=vmax, azim=112.0 + t_sec * 8.0)

            panel = Image.new("RGB", panel_size, "white")
            panel.paste(brain, (24, 24))
            draw = ImageDraw.Draw(panel)
            draw.text((24, 20), f"Brain Response  t={t_sec:04.1f}s", fill=(25, 25, 25))
            draw.text(
                (24, content_h - 210),
                f"video={trace.video_id}  tier={trace.tier}  cluster={trace.cluster_id}  scroll={int(trace.scroll)}",
                fill=(45, 45, 45),
            )
            draw.text(
                (24, content_h - 188),
                f"views={int(trace.play_count):,}  diggs={int(trace.digg_count):,}  duration={trace.duration:.1f}s",
                fill=(60, 60, 60),
            )
            draw_bar(draw, (24, content_h - 150, right_w - 24, content_h - 120), "weighted activation", trace.weighted_activation, act_scale, (245, 158, 11))
            draw_bar(draw, (24, content_h - 102, right_w - 24, content_h - 72), "delta", trace.delta, delta_scale, (59, 130, 246))
            draw_bar(draw, (24, content_h - 54, right_w - 24, content_h - 24), "reward", trace.reward, reward_scale, (34, 197, 94))
            panel.save(rhs_dir / f"frame_{frame_idx:05d}.png")

            timeline = timeline_base.copy()
            tl_draw = ImageDraw.Draw(timeline)
            marker_x = int(np.clip(t_sec / max(seconds, 1e-6), 0.0, 1.0) * (timeline_size[0] - 1))
            tl_draw.line((marker_x, 0, marker_x, timeline_size[1] - 1), fill=(220, 38, 38), width=3)
            tl_draw.text((12, 10), "Video timeline", fill=(25, 25, 25))
            timeline.save(tl_dir / f"frame_{frame_idx:05d}.png")

        rhs_cmd = [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-framerate",
            str(fps),
            "-i",
            str(rhs_dir / "frame_%05d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(right_panel_path),
        ]
        subprocess.run(rhs_cmd, check=True)

        tl_cmd = [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-framerate",
            str(fps),
            "-i",
            str(tl_dir / "frame_%05d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(timeline_path),
        ]
        subprocess.run(tl_cmd, check=True)


def compose_final_video(left_path: Path, right_path: Path, timeline_path: Path, include_audio: bool, out_path: Path) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-i",
        str(left_path),
        "-i",
        str(right_path),
        "-i",
        str(timeline_path),
        "-filter_complex",
        "[0:v][1:v]hstack=inputs=2[top];[top][2:v]vstack=inputs=2[v]",
        "-map",
        "[v]",
    ]
    if include_audio:
        cmd += ["-map", "0:a?"]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out_path)]
    subprocess.run(cmd, check=True)


def build_contact_sheet(traces: list[StepTrace], out_path: Path, env_fps: float) -> None:
    idxs = np.linspace(0, len(traces) - 1, 6, dtype=int).tolist()
    sheet = Image.new("RGB", (1260, 472), "white")
    for n, idx in enumerate(idxs):
        trace = traces[idx]
        frame = ffmpeg_extract_frame(trace.video_path, trace.video_step / env_fps).resize((420, 236), RESAMPLE)
        draw = ImageDraw.Draw(frame)
        draw.rectangle((0, 0, 420, 28), fill=(255, 255, 255))
        draw.text((8, 7), f"{idx / 2:.1f}s  {trace.video_id}", fill=(20, 20, 20))
        sheet.paste(frame, ((n % 3) * 420, (n // 3) * 236))
    sheet.save(out_path)


def load_model(policy_path: Path, recurrent: bool):
    if recurrent:
        if RecurrentPPO is None:
            raise RuntimeError("Replay for recurrent models requires sb3-contrib.")
        return RecurrentPPO.load(str(policy_path), device="cpu")
    return PPO.load(str(policy_path), device="cpu")


def main() -> None:
    args = parse_args()
    cfg = load_cfg(args.config)
    _, cfg = resolve_variant_cfg(cfg, args.variant)

    replay_cfg = cfg["replay"]
    prepared_root = args.prepared_root or Path(replay_cfg["prepared_root"])
    fallback_root = args.fallback_prepared_root or Path(replay_cfg["fallback_prepared_root"])
    output_dir = args.output_dir or Path(replay_cfg["output_dir"])
    fps = args.fps or int(replay_cfg["fps"])
    include_audio = replay_cfg["include_audio"] if args.include_audio is None else args.include_audio

    catalog = VideoCatalog(cfg["catalog"]["path"])
    brain = BrainModel(
        checkpoint_path=cfg["brain"]["checkpoint_path"],
        device=cfg["brain"]["device"],
        context_window=cfg["brain"].get("max_seq_len", 1024),
    )
    model = load_model(args.policy_path, recurrent=cfg["agent"].get("recurrent", False))
    output_dir.mkdir(parents=True, exist_ok=True)

    summaries = []
    total_w = replay_cfg["canvas_width"]
    total_h = replay_cfg["canvas_height"]
    timeline_h = replay_cfg["timeline_height"]
    content_h = total_h - timeline_h
    left_size = (replay_cfg["video_panel_width"], content_h)

    for seed in args.seeds:
        env = make_env(cfg, catalog, brain, seed=seed)
        traces = rollout_traces(model, env, cfg, seed, args.seconds, prepared_root, fallback_root)
        clip_stem = f"{VARIANT_NAMES[args.variant]}_seed{seed}_{int(args.seconds)}s"
        mp4_path = output_dir / f"{clip_stem}.mp4"
        preview_path = output_dir / f"{clip_stem}_preview.png"
        trace_path = output_dir / f"{clip_stem}.json"

        with tempfile.TemporaryDirectory(prefix=f"{clip_stem}_") as tmpdir:
            tmpdir = Path(tmpdir)
            left_path = tmpdir / "left.mp4"
            right_path = tmpdir / "right.mp4"
            timeline_path = tmpdir / "timeline.mp4"
            build_left_panel_video(traces, cfg["env"]["feature_rate_hz"], left_size, fps, include_audio, left_path)
            build_right_and_timeline_videos(traces, cfg, args.seconds, fps, right_path, timeline_path)
            compose_final_video(left_path, right_path, timeline_path, include_audio, mp4_path)

        build_contact_sheet(traces, preview_path, cfg["env"]["feature_rate_hz"])
        with trace_path.open("w") as f:
            json.dump(
                [
                    {
                        **asdict(trace),
                        "prediction": {
                            "mean_abs": float(np.abs(trace.prediction).mean()),
                            "max_abs": float(np.abs(trace.prediction).max()),
                        },
                    }
                    for trace in traces
                ],
                f,
                indent=2,
            )

        summaries.append(
            {
                "seed": seed,
                "frames": len(traces),
                "switches": int(sum(1 for t in traces if t.scroll or t.auto_advanced)),
                "mean_reward": float(np.mean([t.reward for t in traces])),
                "mp4": str(mp4_path),
                "preview": str(preview_path),
                "trace": str(trace_path),
            }
        )

    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    main()
