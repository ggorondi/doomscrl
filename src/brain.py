from __future__ import annotations

import logging
import math
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)

N_VERTICES_FSAVG5 = 20484


class ScaleNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-5):
        super().__init__()
        self.scale = nn.Parameter(torch.ones(1) * dim**0.5)
        self.eps = eps

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(x, dim=-1, eps=self.eps) * self.scale


class RotaryEmbedding(nn.Module):
    def __init__(self, dim: int, max_seq_len: int = 2048):
        super().__init__()
        inv_freq = 1.0 / (10000 ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)
        self._build_cache(max_seq_len)

    def _build_cache(self, seq_len: int) -> None:
        t = torch.arange(seq_len, dtype=self.inv_freq.dtype)
        freqs = torch.outer(t, self.inv_freq)
        emb = torch.cat([freqs, freqs], dim=-1)
        self.register_buffer("cos_cached", emb.cos(), persistent=False)
        self.register_buffer("sin_cached", emb.sin(), persistent=False)

    def forward(self, seq_len: int) -> tuple[torch.Tensor, torch.Tensor]:
        if seq_len > self.cos_cached.size(0):
            self._build_cache(seq_len)
        return self.cos_cached[:seq_len], self.sin_cached[:seq_len]


def _rotate_half(x: torch.Tensor) -> torch.Tensor:
    x1, x2 = x.chunk(2, dim=-1)
    return torch.cat([-x2, x1], dim=-1)


def _apply_rotary(x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor) -> torch.Tensor:
    return x * cos + _rotate_half(x) * sin


class Attention(nn.Module):
    def __init__(self, dim: int, heads: int, rotary: RotaryEmbedding | None = None):
        super().__init__()
        self.heads = heads
        self.head_dim = dim // heads
        self.to_qkv = nn.Linear(dim, dim * 3, bias=False)
        self.to_out = nn.Linear(dim, dim, bias=False)
        self.rotary = rotary

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, _ = x.shape
        qkv = self.to_qkv(x).reshape(B, T, 3, self.heads, self.head_dim)
        q, k, v = qkv.unbind(dim=2)

        if self.rotary is not None:
            cos, sin = self.rotary(T)
            cos = cos.unsqueeze(0).unsqueeze(2)
            sin = sin.unsqueeze(0).unsqueeze(2)
            q = _apply_rotary(q, cos, sin)
            k = _apply_rotary(k, cos, sin)

        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)
        out = F.scaled_dot_product_attention(q, k, v)
        out = out.transpose(1, 2).reshape(B, T, -1)
        return self.to_out(out)


class FeedForward(nn.Module):
    def __init__(self, dim: int, mult: int = 4):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, dim * mult),
            nn.GELU(),
            nn.Linear(dim * mult, dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class TransformerBlock(nn.Module):
    def __init__(
        self,
        dim: int,
        heads: int,
        ff_mult: int = 4,
        scale_residual: bool = True,
        rotary: RotaryEmbedding | None = None,
    ):
        super().__init__()
        self.attn_norm = ScaleNorm(dim)
        self.attn = Attention(dim, heads, rotary)
        self.ff_norm = ScaleNorm(dim)
        self.ff = FeedForward(dim, ff_mult)
        self.scale_residual = scale_residual
        if scale_residual:
            self.res_scale = nn.Parameter(torch.ones(1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        scale = self.res_scale if self.scale_residual else 1.0
        x = x * scale + self.attn(self.attn_norm(x))
        x = x * scale + self.ff(self.ff_norm(x))
        return x


class Projector(nn.Module):
    def __init__(self, in_dim: int, out_dim: int):
        super().__init__()
        self.norm = nn.LayerNorm(in_dim)
        self.linear = nn.Linear(in_dim, out_dim)
        self.act = nn.GELU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.act(self.linear(self.norm(x)))


class AveragedSubjectLayers(nn.Module):
    def __init__(self, in_channels: int, out_channels: int, n_subjects: int):
        super().__init__()
        self.weights = nn.Parameter(torch.randn(n_subjects, out_channels, in_channels) * 0.01)
        self.biases = nn.Parameter(torch.zeros(n_subjects, 1, out_channels))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        weight = self.weights.mean(dim=0)
        bias = self.biases.mean(dim=0)
        return F.linear(x.transpose(1, 2), weight, bias.squeeze(0)).transpose(1, 2)


class FmriEncoderStandalone(nn.Module):

    def __init__(
        self,
        feature_dims: dict[str, tuple[int, int]],
        n_outputs: int = N_VERTICES_FSAVG5,
        hidden: int = 1152,
        n_heads: int = 8,
        n_layers: int = 8,
        ff_mult: int = 4,
        max_seq_len: int = 1024,
        low_rank: int | None = 2048,
        n_subjects: int = 25,
        layer_agg: str = "cat",
        ext_agg: str = "cat",
    ):
        super().__init__()
        self.feature_dims = feature_dims
        self.hidden = hidden
        self.layer_agg = layer_agg
        self.ext_agg = ext_agg
        n_modalities = len(feature_dims)

        self.projectors = nn.ModuleDict()
        for name, (n_layer_groups, feat_dim) in feature_dims.items():
            in_dim = feat_dim * n_layer_groups if layer_agg == "cat" else feat_dim
            out_dim = hidden // n_modalities if ext_agg == "cat" else hidden
            self.projectors[name] = Projector(in_dim, out_dim)

        combiner_in = (hidden // n_modalities) * n_modalities if ext_agg == "cat" else hidden
        self.combiner = Projector(combiner_in, hidden)
        self.time_pos_embed = nn.Parameter(torch.randn(1, max_seq_len, hidden) * 0.02)

        rotary = RotaryEmbedding(hidden // n_heads, max_seq_len)
        self.encoder = nn.ModuleList([
            TransformerBlock(hidden, n_heads, ff_mult, scale_residual=True, rotary=rotary)
            for _ in range(n_layers)
        ])

        self.low_rank_head = nn.Linear(hidden, low_rank, bias=False) if low_rank else None
        pred_in = low_rank if low_rank else hidden
        self.predictor = AveragedSubjectLayers(pred_in, n_outputs, n_subjects)

    def forward(self, features: dict[str, torch.Tensor]) -> torch.Tensor:
        B = 1
        T = None
        parts = []

        for name in self.feature_dims:
            if name not in features:
                raise KeyError(f"Missing modality: {name}")
            x = features[name]
            if x.ndim == 3:
                x = x.unsqueeze(0)
            if T is None:
                T = x.shape[-1]
            if self.layer_agg == "cat":
                x = x.reshape(x.shape[0], -1, x.shape[-1])
            else:
                x = x.mean(dim=1)
            x = x.transpose(1, 2)
            x = self.projectors[name](x)
            parts.append(x)

        if self.ext_agg == "cat":
            x = torch.cat(parts, dim=-1)
        else:
            x = sum(parts)

        x = self.combiner(x)
        x = x + self.time_pos_embed[:, :x.size(1)]

        for block in self.encoder:
            x = block(x)

        if self.low_rank_head is not None:
            x = self.low_rank_head(x)

        out = self.predictor(x.transpose(1, 2))
        return out.transpose(1, 2)


class BrainModel:

    def __init__(
        self,
        checkpoint_path: str | Path | None = None,
        device: str = "cpu",
        context_window: int = 100,
    ):
        self.device = torch.device(device)
        self.context_window = context_window
        self.n_vertices = N_VERTICES_FSAVG5
        self.model: FmriEncoderStandalone | None = None
        self._feature_dims: dict[str, tuple[int, int]] | None = None

        if checkpoint_path is not None:
            self._load(checkpoint_path)

    def _load(self, path: str | Path) -> None:
        path = Path(path)
        if not path.exists():
            logger.warning("Checkpoint %s not found, using mock mode", path)
            return

        ckpt = torch.load(path, map_location="cpu", weights_only=False)

        if "feature_dims" in ckpt:
            self._feature_dims = ckpt["feature_dims"]
            config = ckpt.get("config", {})
            self.model = FmriEncoderStandalone(
                feature_dims=self._feature_dims,
                n_outputs=config.get("n_outputs", N_VERTICES_FSAVG5),
                hidden=config.get("hidden", 1152),
                n_heads=config.get("n_heads", 8),
                n_layers=config.get("n_layers", 8),
                max_seq_len=config.get("max_seq_len", 1024),
                low_rank=config.get("low_rank", 2048),
                n_subjects=config.get("n_subjects", 25),
            )
            self.model.load_state_dict(ckpt["state_dict"])
        else:
            logger.warning("Unrecognized checkpoint format, using mock mode")
            return

        self.model.to(self.device)
        self.model.eval()
        logger.info("Loaded brain model on %s", self.device)

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    @torch.inference_mode()
    def predict(self, features: dict[str, torch.Tensor]) -> torch.Tensor:
        if self.model is None:
            return self._mock_predict(features)

        trimmed = {}
        for k, v in features.items():
            v = v.to(self.device)
            if v.shape[-1] > self.context_window:
                v = v[..., -self.context_window:]
            trimmed[k] = v

        preds = self.model(trimmed)
        return preds.squeeze(0)

    def _mock_predict(self, features: dict[str, torch.Tensor]) -> torch.Tensor:
        ref = next(iter(features.values()))
        T = ref.shape[-1]
        if T > self.context_window:
            T = self.context_window

        activation = torch.zeros(T, self.n_vertices)
        for v in features.values():
            energy = v.float().norm(dim=tuple(range(v.ndim - 1)))
            if energy.shape[0] > T:
                energy = energy[-T:]
            activation += 0.01 * energy.unsqueeze(1)
        activation += torch.randn_like(activation) * 0.005
        return activation
