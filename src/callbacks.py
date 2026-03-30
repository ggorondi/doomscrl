from __future__ import annotations

from collections import defaultdict

import numpy as np
from stable_baselines3.common.callbacks import BaseCallback


class RolloutMetricsCallback(BaseCallback):

    def __init__(self, n_clusters: int, feature_rate_hz: float, verbose: int = 0):
        super().__init__(verbose=verbose)
        self.n_clusters = n_clusters
        self.feature_rate_hz = feature_rate_hz
        self._reset()

    def _reset(self) -> None:
        self.scalar_values: dict[str, list[float]] = defaultdict(list)
        self.cluster_counts = np.zeros(self.n_clusters, dtype=np.float64)
        self.tier_counts: dict[str, float] = defaultdict(float)
        self.watch_durations_steps: list[float] = []

    def _on_step(self) -> bool:
        infos = self.locals.get("infos", [])
        for info in infos:
            for key in (
                "reward_total",
                "reward_activation",
                "reward_delta",
                "reward_weighted_activation",
                "reward_weighted_delta",
                "reward_switch_penalty",
                "reward_short_dwell_penalty",
                "video_play_count",
                "video_digg_count",
                "video_duration",
                "manual_switch",
                "auto_advanced",
                "watch_frac",
            ):
                if key in info:
                    self.scalar_values[key].append(float(info[key]))

            for key, value in info.items():
                if key.startswith("region_activation/") or key.startswith("region_delta/"):
                    self.scalar_values[key].append(float(value))

            if float(info.get("manual_switch", 0.0)) > 0.5:
                cluster_id = int(info.get("video_cluster_id", -1))
                if 0 <= cluster_id < self.n_clusters:
                    self.cluster_counts[cluster_id] += 1.0
                tier = str(info.get("video_tier", ""))
                if tier:
                    self.tier_counts[tier] += 1.0

            ended = float(info.get("ended_video_watch_steps", 0.0))
            if ended > 0:
                self.watch_durations_steps.append(ended)
        return True

    def _on_rollout_end(self) -> None:
        for key, values in self.scalar_values.items():
            if values:
                self.logger.record(f"custom/{key}", float(np.mean(values)))

        if self.watch_durations_steps:
            mean_steps = float(np.mean(self.watch_durations_steps))
            self.logger.record("custom/mean_watch_steps_per_video", mean_steps)
            self.logger.record("custom/mean_watch_seconds_per_video", mean_steps / self.feature_rate_hz)

        selection_total = float(self.cluster_counts.sum())
        if selection_total > 0:
            for idx, count in enumerate(self.cluster_counts.tolist()):
                self.logger.record(f"selection/cluster_{idx}_frac", count / selection_total)
            for tier, count in sorted(self.tier_counts.items()):
                self.logger.record(f"selection/tier_{tier}_frac", count / selection_total)

        self._reset()

