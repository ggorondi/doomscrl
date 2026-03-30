from __future__ import annotations

import argparse
import copy
import os
from pathlib import Path

import torch
import yaml
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import CallbackList, EvalCallback
from stable_baselines3.common.monitor import Monitor

try:
    from sb3_contrib import RecurrentPPO
except ImportError:  # pragma: no cover - optional dependency for variant d
    RecurrentPPO = None

from src.brain import BrainModel
from src.callbacks import RolloutMetricsCallback
from src.catalog import VideoCatalog
from src.env.scroll_env import DoomScrollEnv
from src.env.scroll_select_env import DoomScrollSelectEnv
from src.reward import CortisolReward, DopamineReward

VARIANT_NAMES = {
    "a": "select_baseline",
    "b": "scroll_random_feed",
    "c": "select_switch_penalty",
    "d": "select_recurrent_lstm",
    "e": "select_cortisol",
}


def deep_merge(base: dict, updates: dict) -> dict:
    merged = copy.deepcopy(base)
    for key, value in updates.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def resolve_variant_cfg(cfg: dict, variant: str) -> tuple[str, dict]:
    if variant not in VARIANT_NAMES:
        raise KeyError(f"Unknown variant '{variant}'")
    preset_name = VARIANT_NAMES[variant]
    variant_cfg = cfg["variants"][preset_name]
    return preset_name, deep_merge(cfg, variant_cfg)


def apply_smoke_test(cfg: dict) -> dict:
    merged = copy.deepcopy(cfg)
    smoke = merged.get("smoke_test", {})
    merged["env"] = deep_merge(merged["env"], smoke.get("env", {}))
    merged["training"] = deep_merge(merged["training"], smoke.get("training", {}))
    return merged


def resolve_device(raw_device: str) -> str:
    if raw_device == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return raw_device


def configure_torch_threads(device: str, cfg: dict) -> None:
    thread_cfg = cfg.get("runtime", {})
    cpu_count = os.cpu_count() or 1
    num_threads = int(thread_cfg.get("cpu_threads_gpu" if device == "cuda" else "cpu_threads_cpu", min(cpu_count, 8)))
    interop_threads = int(thread_cfg.get("interop_threads", min(cpu_count, 4)))
    try:
        torch.set_num_threads(max(1, min(num_threads, cpu_count)))
    except RuntimeError:
        pass
    try:
        torch.set_num_interop_threads(max(1, min(interop_threads, cpu_count)))
    except RuntimeError:
        pass


def build_reward_model(cfg: dict):
    reward_cfg = cfg["reward"]
    common_kwargs = dict(
        alpha=reward_cfg["alpha"],
        beta=reward_cfg["beta"],
        switch_penalty=reward_cfg.get("switch_penalty", 0.0),
        min_dwell_seconds=reward_cfg.get("min_dwell_seconds", 0.0),
        short_dwell_penalty=reward_cfg.get("short_dwell_penalty", 0.0),
        feature_rate_hz=cfg["env"]["feature_rate_hz"],
    )
    if reward_cfg.get("mode", "dopamine") == "cortisol":
        return CortisolReward(
            **common_kwargs,
            region_weights=reward_cfg.get("cortisol_region_weights"),
            global_delta_scale=reward_cfg.get("cortisol_delta_scale", 0.35),
        )
    return DopamineReward(**common_kwargs)


def make_env(cfg: dict, catalog: VideoCatalog, brain: BrainModel, seed: int):
    env_type = cfg["agent"]["env_type"]
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
    if env_type == "scroll":
        env = DoomScrollEnv(**env_kwargs)
    else:
        env = DoomScrollSelectEnv(**env_kwargs)
    return Monitor(env)


def build_model(model_cls, policy_name: str, env, cfg: dict, device: str):
    ppo_cfg = cfg["ppo"]
    policy_cfg = cfg["policy"]
    log_dir = Path(cfg["training"]["log_dir"]) / cfg["_run_name"]
    common_kwargs = dict(
        env=env,
        learning_rate=ppo_cfg["learning_rate"],
        n_steps=ppo_cfg["n_steps"],
        batch_size=ppo_cfg["batch_size"],
        n_epochs=ppo_cfg["n_epochs"],
        clip_range=ppo_cfg["clip_range"],
        gamma=ppo_cfg["gamma"],
        gae_lambda=ppo_cfg["gae_lambda"],
        ent_coef=ppo_cfg["ent_coef"],
        vf_coef=ppo_cfg["vf_coef"],
        max_grad_norm=ppo_cfg["max_grad_norm"],
        tensorboard_log=str(log_dir / "tb"),
        seed=cfg["training"]["seed"],
        verbose=1,
        device=device,
    )
    if model_cls is PPO:
        return PPO(
            policy_name,
            policy_kwargs={"net_arch": policy_cfg["net_arch"]},
            **common_kwargs,
        )
    lstm_cfg = cfg.get("recurrent", {})
    return model_cls(
        policy_name,
        policy_kwargs=dict(
            net_arch=policy_cfg["net_arch"],
            lstm_hidden_size=lstm_cfg.get("hidden_size", 256),
            n_lstm_layers=lstm_cfg.get("n_lstm_layers", 1),
            shared_lstm=lstm_cfg.get("shared_lstm", False),
            enable_critic_lstm=lstm_cfg.get("enable_critic_lstm", True),
        ),
        **common_kwargs,
    )


def train(cfg: dict, variant: str) -> None:
    preset_name, cfg = resolve_variant_cfg(cfg, variant)
    if cfg.get("_smoke_test", False):
        cfg = apply_smoke_test(cfg)
    cfg["_run_name"] = preset_name if not cfg.get("_smoke_test") else f"smoke/{preset_name}"

    device = resolve_device(cfg["training"].get("device", "auto"))
    configure_torch_threads(device, cfg)

    catalog = VideoCatalog(cfg["catalog"]["path"])
    brain = BrainModel(
        checkpoint_path=cfg["brain"]["checkpoint_path"],
        device=cfg["brain"]["device"],
        context_window=cfg["brain"].get("max_seq_len", 1024),
    )

    log_dir = Path(cfg["training"]["log_dir"]) / cfg["_run_name"]
    log_dir.mkdir(parents=True, exist_ok=True)

    env = make_env(cfg, catalog, brain, seed=cfg["training"]["seed"])
    eval_env = make_env(cfg, catalog, brain, seed=cfg["training"]["seed"] + 1000)

    recurrent = cfg["agent"].get("recurrent", False)
    if recurrent:
        if RecurrentPPO is None:
            raise RuntimeError("Variant d requires sb3-contrib to be installed.")
        model = build_model(RecurrentPPO, "MlpLstmPolicy", env, cfg, device=device)
    else:
        model = build_model(PPO, "MlpPolicy", env, cfg, device=device)

    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=str(log_dir / "best_model"),
        log_path=str(log_dir / "eval_logs"),
        eval_freq=cfg["training"]["eval_freq"],
        n_eval_episodes=cfg["training"]["n_eval_episodes"],
        deterministic=True,
    )
    metrics_callback = RolloutMetricsCallback(
        n_clusters=catalog.n_clusters,
        feature_rate_hz=cfg["env"]["feature_rate_hz"],
    )

    model.learn(
        total_timesteps=cfg["training"]["total_timesteps"],
        callback=CallbackList([metrics_callback, eval_callback]),
    )
    model.save(str(log_dir / "final_model"))
    print(f"Training complete. Model saved to {log_dir}")


def evaluate_baselines(cfg: dict) -> None:
    import numpy as np

    cfg = copy.deepcopy(cfg)
    preset_name, cfg = resolve_variant_cfg(cfg, "b")
    cfg["_run_name"] = preset_name
    catalog = VideoCatalog(cfg["catalog"]["path"])
    brain = BrainModel(
        checkpoint_path=cfg["brain"]["checkpoint_path"],
        device=cfg["brain"]["device"],
        context_window=cfg["brain"].get("max_seq_len", 1024),
    )

    baselines = {
        "never_scroll": lambda obs, env: 0,
        "always_scroll": lambda obs, env: 1,
        "random_scroll": lambda obs, env: np.random.randint(2),
    }

    for name, policy_fn in baselines.items():
        rewards = []
        for ep in range(10):
            env = DoomScrollEnv(
                catalog=catalog,
                brain=brain,
                reward_model=build_reward_model(cfg),
                session_duration=cfg["env"]["session_duration_s"],
                feature_rate=cfg["env"]["feature_rate_hz"],
                activation_history_len=cfg["env"]["activation_history_len"],
                video_summary_dim=cfg["env"]["video_summary_dim"],
                seed=ep,
            )
            obs, _ = env.reset()
            total = 0.0
            done = False
            while not done:
                action = policy_fn(obs, env)
                obs, reward, terminated, truncated, _ = env.step(action)
                total += reward
                done = terminated or truncated
            rewards.append(total)
        print(f"{name}: {np.mean(rewards):.2f} +/- {np.std(rewards):.2f}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("configs/train.yaml"))
    parser.add_argument("--policy", choices=["scroll", "select"], default=None)
    parser.add_argument("--variant", choices=sorted(VARIANT_NAMES), default="a")
    parser.add_argument("--smoke-test", action="store_true")
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default=None)
    parser.add_argument("--baselines", action="store_true")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    if args.device is not None:
        cfg.setdefault("training", {})["device"] = args.device
    if args.smoke_test:
        cfg["_smoke_test"] = True

    if args.baselines:
        evaluate_baselines(cfg)
        return

    if args.policy == "scroll" and args.variant == "a":
        args.variant = "b"
    train(cfg, args.variant)


if __name__ == "__main__":
    main()
