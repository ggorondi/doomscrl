from __future__ import annotations

import argparse
from pathlib import Path

import yaml
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import EvalCallback
from stable_baselines3.common.monitor import Monitor

from src.brain import BrainModel
from src.catalog import VideoCatalog
from src.env.scroll_env import DoomScrollEnv
from src.env.scroll_select_env import DoomScrollSelectEnv


def make_env(cfg: dict, catalog: VideoCatalog, brain: BrainModel, policy_type: str, seed: int):
    env_cfg = cfg["env"]
    reward_cfg = cfg["reward"]

    if policy_type == "scroll":
        env = DoomScrollEnv(
            catalog=catalog,
            brain=brain,
            session_duration=env_cfg["session_duration_s"],
            feature_rate=env_cfg["feature_rate_hz"],
            activation_history_len=env_cfg["activation_history_len"],
            video_summary_dim=env_cfg["video_summary_dim"],
            reward_alpha=reward_cfg["alpha"],
            reward_beta=reward_cfg["beta"],
            seed=seed,
        )
    else:
        env = DoomScrollSelectEnv(
            catalog=catalog,
            brain=brain,
            session_duration=env_cfg["session_duration_s"],
            feature_rate=env_cfg["feature_rate_hz"],
            activation_history_len=env_cfg["activation_history_len"],
            video_summary_dim=env_cfg["video_summary_dim"],
            reward_alpha=reward_cfg["alpha"],
            reward_beta=reward_cfg["beta"],
            seed=seed,
        )
    return Monitor(env)


def train(cfg: dict, policy_type: str) -> None:
    train_cfg = cfg["training"]
    ppo_cfg = cfg["ppo"]
    policy_cfg = cfg["policy"]

    catalog = VideoCatalog(cfg["catalog"]["path"])
    brain = BrainModel(
        checkpoint_path=cfg["brain"]["checkpoint_path"],
        device=cfg["brain"]["device"],
        context_window=cfg["brain"].get("max_seq_len", 1024),
    )

    log_dir = Path(train_cfg["log_dir"]) / policy_type
    log_dir.mkdir(parents=True, exist_ok=True)

    env = make_env(cfg, catalog, brain, policy_type, seed=train_cfg["seed"])
    eval_env = make_env(cfg, catalog, brain, policy_type, seed=train_cfg["seed"] + 1000)

    model = PPO(
        "MlpPolicy",
        env,
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
        policy_kwargs={"net_arch": policy_cfg["net_arch"]},
        tensorboard_log=str(log_dir / "tb"),
        seed=train_cfg["seed"],
        verbose=1,
    )

    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=str(log_dir / "best_model"),
        log_path=str(log_dir / "eval_logs"),
        eval_freq=train_cfg["eval_freq"],
        n_eval_episodes=train_cfg["n_eval_episodes"],
        deterministic=True,
    )

    model.learn(
        total_timesteps=train_cfg["total_timesteps"],
        callback=eval_callback,
    )

    model.save(str(log_dir / "final_model"))
    print(f"Training complete. Model saved to {log_dir}")


def evaluate_baselines(cfg: dict) -> None:
    import numpy as np

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
                session_duration=cfg["env"]["session_duration_s"],
                feature_rate=cfg["env"]["feature_rate_hz"],
                reward_alpha=cfg["reward"]["alpha"],
                reward_beta=cfg["reward"]["beta"],
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
        mean_r = np.mean(rewards)
        std_r = np.std(rewards)
        print(f"{name}: {mean_r:.2f} +/- {std_r:.2f}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("configs/train.yaml"))
    parser.add_argument("--policy", choices=["scroll", "select"], default="scroll")
    parser.add_argument("--baselines", action="store_true")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    if args.baselines:
        evaluate_baselines(cfg)
    else:
        train(cfg, args.policy)


if __name__ == "__main__":
    main()
