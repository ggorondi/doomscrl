from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import torch

from src.brain_regions import BrainRegionProjector, REGION_NAMES


@dataclass
class RewardBreakdown:
    reward: float
    activation: float
    delta: float
    weighted_activation: float
    weighted_delta: float
    switch_penalty: float
    short_dwell_penalty: float
    region_activation: np.ndarray
    region_delta: np.ndarray


class RewardModel:

    def __init__(
        self,
        alpha: float = 1.0,
        beta: float = 0.3,
        switch_penalty: float = 0.0,
        min_dwell_seconds: float = 0.0,
        short_dwell_penalty: float = 0.0,
        feature_rate_hz: float = 2.0,
        region_projector: BrainRegionProjector | None = None,
    ):
        self.alpha = alpha
        self.beta = beta
        self.switch_penalty = switch_penalty
        self.min_dwell_seconds = min_dwell_seconds
        self.short_dwell_penalty = short_dwell_penalty
        self.feature_rate_hz = feature_rate_hz
        self.region_projector = region_projector or BrainRegionProjector()
        self._prev: torch.Tensor | None = None

    def reset(self) -> None:
        self._prev = None

    def _dwell_penalties(self, manual_switch: bool, watched_steps: int) -> tuple[float, float]:
        if not manual_switch:
            return 0.0, 0.0
        switch_pen = self.switch_penalty
        min_steps = max(int(round(self.min_dwell_seconds * self.feature_rate_hz)), 0)
        if min_steps <= 0:
            return switch_pen, 0.0
        dwell_frac = min(watched_steps / max(min_steps, 1), 1.0)
        short_pen = self.short_dwell_penalty * max(0.0, 1.0 - dwell_frac)
        return switch_pen, short_pen

    def _region_arrays(
        self,
        prediction: torch.Tensor,
        previous: torch.Tensor | None,
    ) -> tuple[np.ndarray, np.ndarray]:
        region_act = self.region_projector.summarize(prediction, absolute=True)
        region_delta = self.region_projector.delta_summary(prediction, previous)
        return (
            region_act.detach().cpu().numpy().astype(np.float32, copy=False),
            region_delta.detach().cpu().numpy().astype(np.float32, copy=False),
        )

    def _base_components(self, prediction: torch.Tensor) -> tuple[float, float]:
        activation = prediction.abs().mean().item()
        delta = 0.0
        if self._prev is not None:
            delta = (prediction - self._prev).norm().item()
        return activation, delta

    def _weighted_components(
        self,
        prediction: torch.Tensor,
        region_activation: np.ndarray,
        region_delta: np.ndarray,
    ) -> tuple[float, float]:
        del region_activation, region_delta
        activation, delta = self._base_components(prediction)
        return activation, delta

    def step(
        self,
        prediction: torch.Tensor,
        *,
        manual_switch: bool = False,
        watched_steps: int = 0,
    ) -> RewardBreakdown:
        prev = self._prev
        activation, delta = self._base_components(prediction)
        region_activation, region_delta = self._region_arrays(prediction, prev)
        weighted_activation, weighted_delta = self._weighted_components(
            prediction,
            region_activation,
            region_delta,
        )
        switch_pen, short_pen = self._dwell_penalties(manual_switch, watched_steps)
        reward = self.alpha * weighted_activation + self.beta * weighted_delta - switch_pen - short_pen
        self._prev = prediction.clone()
        return RewardBreakdown(
            reward=reward,
            activation=activation,
            delta=delta,
            weighted_activation=weighted_activation,
            weighted_delta=weighted_delta,
            switch_penalty=switch_pen,
            short_dwell_penalty=short_pen,
            region_activation=region_activation,
            region_delta=region_delta,
        )

    def __call__(self, prediction: torch.Tensor) -> float:
        return self.step(prediction).reward


class DopamineReward(RewardModel):
    pass


class CortisolReward(RewardModel):

    def __init__(
        self,
        alpha: float = 1.0,
        beta: float = 0.15,
        switch_penalty: float = 0.0,
        min_dwell_seconds: float = 0.0,
        short_dwell_penalty: float = 0.0,
        feature_rate_hz: float = 2.0,
        region_projector: BrainRegionProjector | None = None,
        region_weights: dict[str, float] | None = None,
        global_delta_scale: float = 0.35,
    ):
        super().__init__(
            alpha=alpha,
            beta=beta,
            switch_penalty=switch_penalty,
            min_dwell_seconds=min_dwell_seconds,
            short_dwell_penalty=short_dwell_penalty,
            feature_rate_hz=feature_rate_hz,
            region_projector=region_projector,
        )
        default_weights = {
            "left_anterior_dorsal": 1.2,
            "left_anterior_ventral": 2.2,
            "left_posterior_dorsal": 0.8,
            "left_posterior_ventral": 0.7,
            "right_anterior_dorsal": 1.2,
            "right_anterior_ventral": 2.2,
            "right_posterior_dorsal": 0.8,
            "right_posterior_ventral": 0.7,
        }
        self.region_weights = np.asarray(
            [float((region_weights or default_weights).get(name, 1.0)) for name in REGION_NAMES],
            dtype=np.float32,
        )
        self.global_delta_scale = global_delta_scale

    def _weighted_components(
        self,
        prediction: torch.Tensor,
        region_activation: np.ndarray,
        region_delta: np.ndarray,
    ) -> tuple[float, float]:
        del region_delta
        weighted_activation = float(np.average(region_activation, weights=self.region_weights))
        global_delta = 0.0
        if self._prev is not None:
            global_delta = (prediction - self._prev).norm().item()
        return weighted_activation, global_delta * self.global_delta_scale
