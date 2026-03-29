from __future__ import annotations

import random
from typing import Any

import gymnasium as gym
import numpy as np
import torch

from src.brain import BrainModel
from src.catalog import VideoCatalog, VideoEntry
from src.reward import DopamineReward


class DoomScrollSelectEnv(gym.Env):

    metadata = {"render_modes": []}

    def __init__(
        self,
        catalog: VideoCatalog,
        brain: BrainModel,
        session_duration: float = 300.0,
        feature_rate: float = 2.0,
        activation_history_len: int = 20,
        video_summary_dim: int = 64,
        reward_alpha: float = 1.0,
        reward_beta: float = 0.3,
        seed: int | None = None,
    ):
        super().__init__()
        self.catalog = catalog
        self.brain = brain
        self.session_duration = session_duration
        self.feature_rate = feature_rate
        self.dt = 1.0 / feature_rate
        self.max_steps = int(session_duration * feature_rate)
        self.hist_len = activation_history_len
        self.summary_dim = video_summary_dim
        self.n_clusters = catalog.n_clusters

        self.reward_fn = DopamineReward(alpha=reward_alpha, beta=reward_beta)
        self._rng = random.Random(seed)

        obs_dim = self.hist_len + self.summary_dim + 5 + self.n_clusters
        self.observation_space = gym.spaces.Box(
            low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32
        )
        self.action_space = gym.spaces.MultiDiscrete([2, self.n_clusters])

        self._step_count: int = 0
        self._video_step: int = 0
        self._activation_history = np.zeros(self.hist_len, dtype=np.float32)
        self._context_buffer: dict[str, list[torch.Tensor]] = {}
        self._cached_preds: torch.Tensor | None = None
        self._current_entry: VideoEntry | None = None
        self._cluster_counts: np.ndarray = np.zeros(self.n_clusters, dtype=np.float32)

    def reset(self, *, seed: int | None = None, options: dict | None = None) -> tuple[np.ndarray, dict]:
        if seed is not None:
            self._rng = random.Random(seed)

        self._step_count = 0
        self._activation_history = np.zeros(self.hist_len, dtype=np.float32)
        self._context_buffer = {}
        self._cluster_counts = np.zeros(self.n_clusters, dtype=np.float32)
        self.reward_fn.reset()

        first_cluster = self._rng.randrange(self.n_clusters)
        self._load_from_cluster(first_cluster)

        return self._obs(), {}

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool, bool, dict]:
        scroll = int(action[0])
        cluster_id = int(action[1])

        if scroll == 1:
            self._load_from_cluster(cluster_id)

        pred = self._get_current_prediction()
        reward = self.reward_fn(pred)
        self._push_history(reward)

        self._video_step += 1
        self._step_count += 1

        video_features = self._current_entry.load_features() if self._current_entry else {}
        video_T = self._video_length(video_features)
        if self._video_step >= video_T:
            fallback = self._rng.randrange(self.n_clusters)
            self._load_from_cluster(fallback)

        terminated = self._step_count >= self.max_steps
        truncated = False

        info = {
            "reward_raw": reward,
            "video_id": self._current_entry.video_id if self._current_entry else "",
            "cluster_id": cluster_id if scroll else -1,
            "step": self._step_count,
        }

        return self._obs(), reward, terminated, truncated, info

    def _load_from_cluster(self, cluster_id: int) -> None:
        cluster_id = cluster_id % self.n_clusters
        entry = self.catalog.sample_from_cluster(cluster_id, self._rng)
        self._current_entry = entry
        self._video_step = 0
        self._cluster_counts[cluster_id] += 1

        features = entry.load_features()
        combined = self._build_context_features(features)
        self._cached_preds = self.brain.predict(combined)
        self._update_context(features)

    def _build_context_features(self, new_features: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
        combined = {}
        for key, tensor in new_features.items():
            parts = []
            if key in self._context_buffer and self._context_buffer[key]:
                ctx = torch.cat(self._context_buffer[key], dim=-1)
                parts.append(ctx)
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
            return torch.zeros(self.brain.n_vertices)
        video_feats = self._current_entry.load_features() if self._current_entry else {}
        ctx_len = self._cached_preds.shape[0] - self._video_length(video_feats)
        idx = max(0, ctx_len + self._video_step)
        idx = min(idx, self._cached_preds.shape[0] - 1)
        return self._cached_preds[idx]

    def _video_length(self, features: dict[str, torch.Tensor]) -> int:
        if not features:
            return 0
        return next(iter(features.values())).shape[-1]

    def _push_history(self, reward: float) -> None:
        self._activation_history = np.roll(self._activation_history, -1)
        self._activation_history[-1] = reward

    def _obs(self) -> np.ndarray:
        parts = [self._activation_history]

        summary = np.zeros(self.summary_dim, dtype=np.float32)
        if self._current_entry is not None:
            feats = self._current_entry.load_features()
            if feats:
                ref = next(iter(feats.values())).float()
                mean_feat = ref.mean(dim=-1).flatten()
                n = min(len(mean_feat), self.summary_dim)
                summary[:n] = mean_feat[:n].numpy()
        parts.append(summary)

        video_T = 1.0
        if self._current_entry:
            video_T = max(self._video_length(self._current_entry.load_features()), 1)
        watch_frac = self._video_step / video_T

        meta = np.zeros(3, dtype=np.float32)
        if self._current_entry is not None:
            meta = self._current_entry.metadata_vec

        session_frac = self._step_count / max(self.max_steps, 1)
        cluster_dist = self._cluster_counts / max(self._cluster_counts.sum(), 1.0)

        parts.append(np.array([watch_frac, session_frac], dtype=np.float32))
        parts.append(meta)
        parts.append(cluster_dist)

        return np.concatenate(parts)
