from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np
import torch

REGION_NAMES = [
    "left_anterior_dorsal",
    "left_anterior_ventral",
    "left_posterior_dorsal",
    "left_posterior_ventral",
    "right_anterior_dorsal",
    "right_anterior_ventral",
    "right_posterior_dorsal",
    "right_posterior_ventral",
]

REGION_SHORT_NAMES = [
    "LAD",
    "LAV",
    "LPD",
    "LPV",
    "RAD",
    "RAV",
    "RPD",
    "RPV",
]


def _default_mesh_path() -> Path:
    return Path(__file__).resolve().parents[1] / "web" / "public" / "brain_mesh.json"


@lru_cache(maxsize=4)
def _load_mesh_vertices(mesh_path: str) -> np.ndarray:
    path = Path(mesh_path)
    with path.open() as f:
        data = json.load(f)
    return np.asarray(data["vertices"], dtype=np.float32)


class BrainRegionProjector:

    def __init__(self, mesh_path: str | Path | None = None):
        self.mesh_path = str(Path(mesh_path) if mesh_path else _default_mesh_path())
        vertices = _load_mesh_vertices(self.mesh_path)
        self.vertices = vertices
        self.n_vertices = vertices.shape[0]
        self.region_ids_np = self._build_region_ids(vertices)
        self.n_regions = len(REGION_NAMES)
        self._region_ids_torch: dict[str, torch.Tensor] = {}

    def _build_region_ids(self, vertices: np.ndarray) -> np.ndarray:
        x = vertices[:, 0]
        y = vertices[:, 1]
        z = vertices[:, 2]
        y_mid = float(np.median(y))
        z_mid = float(np.median(z))

        is_left = x < 0.0
        is_anterior = y >= y_mid
        is_dorsal = z >= z_mid

        ids = np.zeros(vertices.shape[0], dtype=np.int64)
        for idx, name in enumerate(REGION_NAMES):
            side, ap, dv = name.split("_", 2)
            mask = np.ones(vertices.shape[0], dtype=bool)
            mask &= is_left if side == "left" else ~is_left
            mask &= is_anterior if ap == "anterior" else ~is_anterior
            mask &= is_dorsal if dv == "dorsal" else ~is_dorsal
            ids[mask] = idx
        return ids

    def _region_ids_for_device(self, device: torch.device) -> torch.Tensor:
        key = str(device)
        cached = self._region_ids_torch.get(key)
        if cached is None:
            cached = torch.as_tensor(self.region_ids_np, device=device, dtype=torch.long)
            self._region_ids_torch[key] = cached
        return cached

    def summarize(
        self,
        values: torch.Tensor | np.ndarray,
        absolute: bool = True,
    ) -> torch.Tensor | np.ndarray:
        if isinstance(values, np.ndarray):
            arr = np.abs(values) if absolute else values
            out = np.zeros(self.n_regions, dtype=np.float32)
            for idx in range(self.n_regions):
                mask = self.region_ids_np == idx
                if mask.any():
                    out[idx] = float(arr[mask].mean())
            return out

        tensor = values.abs() if absolute else values
        if tensor.ndim != 1:
            raise ValueError(f"Expected 1D activation vector, got shape {tuple(tensor.shape)}")
        region_ids = self._region_ids_for_device(tensor.device)
        out = torch.zeros(self.n_regions, dtype=tensor.dtype, device=tensor.device)
        counts = torch.zeros(self.n_regions, dtype=tensor.dtype, device=tensor.device)
        out.scatter_add_(0, region_ids, tensor)
        counts.scatter_add_(0, region_ids, torch.ones_like(tensor))
        return out / counts.clamp_min(1.0)

    def delta_summary(
        self,
        current: torch.Tensor | np.ndarray,
        previous: torch.Tensor | np.ndarray | None,
    ) -> torch.Tensor | np.ndarray:
        if previous is None:
            if isinstance(current, np.ndarray):
                return np.zeros(self.n_regions, dtype=np.float32)
            return torch.zeros(self.n_regions, dtype=current.dtype, device=current.device)
        delta = current - previous
        return self.summarize(delta, absolute=True)
