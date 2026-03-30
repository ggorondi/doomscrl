from __future__ import annotations

import gymnasium as gym
import numpy as np

from src.brain import BrainModel
from src.catalog import VideoCatalog
from src.env.base import DoomScrollBaseEnv
from src.reward import RewardModel


class DoomScrollSelectEnv(DoomScrollBaseEnv):

    def __init__(
        self,
        catalog: VideoCatalog,
        brain: BrainModel,
        reward_model: RewardModel,
        session_duration: float = 300.0,
        feature_rate: float = 2.0,
        activation_history_len: int = 20,
        video_summary_dim: int = 64,
        include_region_stats: bool = False,
        seed: int | None = None,
    ):
        super().__init__(
            catalog=catalog,
            brain=brain,
            reward_model=reward_model,
            session_duration=session_duration,
            feature_rate=feature_rate,
            activation_history_len=activation_history_len,
            video_summary_dim=video_summary_dim,
            include_cluster_dist=True,
            include_region_stats=include_region_stats,
            seed=seed,
        )
        self.action_space = gym.spaces.MultiDiscrete([2, self.n_clusters])

    def reset(self, *, seed: int | None = None, options: dict | None = None) -> tuple[np.ndarray, dict]:
        del options
        self._reset_common(seed)
        self._load_from_cluster(self._rng.randrange(self.n_clusters))
        return self._obs(), {}

    def _load_from_cluster(self, cluster_id: int) -> None:
        cluster_id = cluster_id % self.n_clusters
        self._load_entry(self.catalog.sample_from_cluster(cluster_id, self._rng))

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool, bool, dict]:
        action = np.asarray(action).reshape(-1)
        scroll = int(action[0])
        target_cluster = int(action[1])

        manual_switch = scroll == 1 and self._current_entry is not None
        ended_watch_steps = 0
        if manual_switch:
            ended_watch_steps = self._video_step
            self._load_from_cluster(target_cluster)

        pred = self._get_current_prediction()
        entry_used = self._current_entry
        video_step_used = self._video_step
        breakdown = self.reward_fn.step(
            pred,
            manual_switch=manual_switch,
            watched_steps=ended_watch_steps,
        )
        self._set_region_state(breakdown)
        self._push_history(breakdown.reward)

        self._video_step += 1
        self._step_count += 1

        auto_advanced = False
        if entry_used is not None:
            video_T = self._video_length(entry_used.load_features())
            if self._video_step >= video_T:
                if not ended_watch_steps:
                    ended_watch_steps = video_T
                self._load_from_cluster(self._rng.randrange(self.n_clusters))
                auto_advanced = True

        terminated = self._step_count >= self.max_steps
        truncated = False
        info = self._build_info(
            entry_used=entry_used,
            breakdown=breakdown,
            manual_switch=manual_switch,
            auto_advanced=auto_advanced,
            watched_steps_before_manual_switch=video_step_used,
            ended_video_watch_steps=ended_watch_steps,
            target_cluster_id=target_cluster if manual_switch else -1,
        )
        return self._obs(), breakdown.reward, terminated, truncated, info

