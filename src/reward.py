from __future__ import annotations

import torch


class DopamineReward:

    def __init__(self, alpha: float = 1.0, beta: float = 0.3):
        self.alpha = alpha
        self.beta = beta
        self._prev: torch.Tensor | None = None

    def reset(self) -> None:
        self._prev = None

    def __call__(self, prediction: torch.Tensor) -> float:
        activation = prediction.abs().mean().item()
        delta = 0.0
        if self._prev is not None:
            delta = (prediction - self._prev).norm().item()
        self._prev = prediction.clone()
        return self.alpha * activation + self.beta * delta
