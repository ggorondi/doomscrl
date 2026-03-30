from __future__ import annotations

import random
from typing import Any

import gymnasium as gym
import numpy as np
import torch

from src.brain import BrainModel
from src.catalog import VideoCatalog, VideoEntry
from src.brain_regions import REGION_SHORT_NAMES
from src.reward import RewardBreakdown, RewardModel


class DoomScrollBaseEnv(gym.Env):

    metadata = {"render_modes": []}

    def __init__(
        self,
        catalog: VideoCatalog,
        brain: BrainModel,
        reward_model: RewardModel,
        *,
        session_duration: float = 300.0,
        feature_rate: float = 2.0,
        activation_history_len: int = 20,
        video_summary_dim: int = 64,
        include_cluster_dist: bool = False,
        include_region_stats: bool = False,
        seed: int | None = None,
    ):
        super().__init__()
        self.catalog = catalog
        self.brain = brain
        self.reward_fn = reward_model
        self.session_duration = session_duration
        self.feature_rate = feature_rate
        self.dt = 1.0 / feature_rate
        self.max_steps = int(session_duration * feature_rate)
        self.hist_len = activation_history_len
        self.summary_dim = video_summary_dim
        self.include_cluster_dist = include_cluster_dist
        self.include_region_stats = include_region_stats
        self.n_clusters = catalog.n_clusters
        self._rng = random.Random(seed)

        obs_dim = self.hist_len + self.summary_dim + 5
        if self.include_region_stats:
            obs_dim += self.reward_fn.region_projector.n_regions * 2
        if self.include_cluster_dist:
            obs_dim += self.n_clusters

        self.observation_space = gym.spaces.Box(
            low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32
        )

        self._step_count = 0
        self._video_step = 0
        self._activation_history = np.zeros(self.hist_len, dtype=np.float32)
        self._context_buffer: dict[str, list[torch.Tensor]] = {}
        self._cached_preds: torch.Tensor | None = None
        self._current_entry: VideoEntry | None = None
        self._cluster_counts = np.zeros(self.n_clusters, dtype=np.float32)
        self._current_region_activation = np.zeros(
            self.reward_fn.region_projector.n_regions,
            dtype=np.float32,
        )
        self._current_region_delta = np.zeros(
            self.reward_fn.region_projector.n_regions,
            dtype=np.float32,
        )

    def _reset_common(self, seed: int | None = None) -> None:
        if seed is not None:
            self._rng = random.Random(seed)
        self._step_count = 0
        self._video_step = 0
        self._activation_history = np.zeros(self.hist_len, dtype=np.float32)
        self._context_buffer = {}
        self._cached_preds = None
        self._current_entry = None
        self._cluster_counts = np.zeros(self.n_clusters, dtype=np.float32)
        self._current_region_activation.fill(0.0)
        self._current_region_delta.fill(0.0)
        self.reward_fn.reset()

    def _load_entry(self, entry: VideoEntry) -> None:
        self._current_entry = entry
        self._video_step = 0
        self._cluster_counts[entry.cluster_id] += 1

        features = entry.load_features()
        combined = self._build_context_features(features)
        self._cached_preds = self.brain.predict(combined)
        self._update_context(features)

    def _build_context_features(self, new_features: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
        combined: dict[str, torch.Tensor] = {}
        for key, tensor in new_features.items():
            parts = []
            if key in self._context_buffer and self._context_buffer[key]:
                parts.append(torch.cat(self._context_buffer[key], dim=-1))
            parts.append(tensor)
            combined[key] = torch.cat(parts, dim=-1)
        return combined

    def _update_context(self, features: dict[str, torch.Tensor]) -> None:
        max_ctx = self.brain.context_window // 2
        for key, tensor in features.items():
            if key not in self._context_buffer:
                self._context_buffer[key] = []
            self._context_buffer[key].append(tensor)
            total = sum(t.shape[-1] for t in self._context_buffer[key])
            while total > max_ctx and len(self._context_buffer[key]) > 1:
                removed = self._context_buffer[key].pop(0)
                total -= removed.shape[-1]

    def _get_current_prediction(self) -> torch.Tensor:
        if self._cached_preds is None:
            return torch.zeros(self.brain.n_vertices, device=self.brain.device)
        video_feats = self._current_entry.load_features() if self._current_entry else {}
        ctx_len = self._cached_preds.shape[0] - self._video_length(video_feats)
        idx = max(0, ctx_len + self._video_step)
        idx = min(idx, self._cached_preds.shape[0] - 1)
        return self._cached_preds[idx]

    def _video_length(self, features: dict[str, torch.Tensor]) -> int:
        if not features:
            return 0
        return int(next(iter(features.values())).shape[-1])

    def _push_history(self, reward: float) -> None:
        self._activation_history = np.roll(self._activation_history, -1)
        self._activation_history[-1] = reward

    def _video_summary(self, entry: VideoEntry | None) -> np.ndarray:
        summary = np.zeros(self.summary_dim, dtype=np.float32)
        if entry is None:
            return summary
        feats = entry.load_features()
        if not feats:
            return summary
        ref = next(iter(feats.values())).float()
        mean_feat = ref.mean(dim=-1).flatten().cpu().numpy()
        n = min(len(mean_feat), self.summary_dim)
        summary[:n] = mean_feat[:n]
        return summary

    def _meta_vec(self, entry: VideoEntry | None) -> np.ndarray:
        if entry is None:
            return np.zeros(3, dtype=np.float32)
        return entry.metadata_vec

    def _obs(self) -> np.ndarray:
        parts = [
            self._activation_history,
            self._video_summary(self._current_entry),
        ]

        video_T = 1.0
        if self._current_entry is not None:
            video_T = max(self._video_length(self._current_entry.load_features()), 1)
        watch_frac = self._video_step / video_T
        session_frac = self._step_count / max(self.max_steps, 1)
        parts.append(np.array([watch_frac, session_frac], dtype=np.float32))
        parts.append(self._meta_vec(self._current_entry))

        if self.include_region_stats:
            parts.append(self._current_region_activation)
            parts.append(self._current_region_delta)

        if self.include_cluster_dist:
            cluster_dist = self._cluster_counts / max(self._cluster_counts.sum(), 1.0)
            parts.append(cluster_dist.astype(np.float32, copy=False))

        return np.concatenate(parts, dtype=np.float32)

    def _set_region_state(self, breakdown: RewardBreakdown) -> None:
        self._current_region_activation = breakdown.region_activation.astype(np.float32, copy=True)
        self._current_region_delta = breakdown.region_delta.astype(np.float32, copy=True)

    def _build_info(
        self,
        *,
        entry_used: VideoEntry | None,
        breakdown: RewardBreakdown,
        manual_switch: bool,
        auto_advanced: bool,
        watched_steps_before_manual_switch: int,
        ended_video_watch_steps: int,
        target_cluster_id: int = -1,
    ) -> dict[str, Any]:
        entry = entry_used
        video_length_steps = 0
        watch_frac = 0.0
        if entry is not None:
            video_length_steps = self._video_length(entry.load_features())
            watch_frac = watched_steps_before_manual_switch / max(video_length_steps, 1)

        info: dict[str, Any] = {
            "reward_total": breakdown.reward,
            "reward_activation": breakdown.activation,
            "reward_delta": breakdown.delta,
            "reward_weighted_activation": breakdown.weighted_activation,
            "reward_weighted_delta": breakdown.weighted_delta,
            "reward_switch_penalty": breakdown.switch_penalty,
            "reward_short_dwell_penalty": breakdown.short_dwell_penalty,
            "manual_switch": float(manual_switch),
            "auto_advanced": float(auto_advanced),
            "ended_video_watch_steps": float(ended_video_watch_steps),
            "watch_frac": watch_frac,
            "session_frac": self._step_count / max(self.max_steps, 1),
            "step": self._step_count,
            "video_step": watched_steps_before_manual_switch,
            "video_length_steps": video_length_steps,
            "target_cluster_id": float(target_cluster_id),
        }

        if entry is None:
            return info

        info.update(
            {
                "video_id": entry.video_id,
                "video_tier": entry.tier,
                "video_cluster_id": float(entry.cluster_id),
                "video_duration": float(entry.duration),
                "video_play_count": float(entry.play_count),
                "video_digg_count": float(entry.digg_count),
            }
        )

        for name, value in zip(REGION_SHORT_NAMES, breakdown.region_activation.tolist(), strict=False):
            info[f"region_activation/{name}"] = float(value)
        for name, value in zip(REGION_SHORT_NAMES, breakdown.region_delta.tolist(), strict=False):
            info[f"region_delta/{name}"] = float(value)
        return info
