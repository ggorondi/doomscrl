# brainrotmaxxer

RL policies trained to maximize simulated dopamine during doomscrolling, using Meta's TRIBE v2 brain model as the reward signal.

Built for Silly Hacks 2026.

## What this does

Two PPO-trained RL agents learn to doomscroll through a feed of ~878 TikTok videos, optimizing for maximum brain activation as predicted by [TRIBE v2](https://huggingface.co/facebook/tribev2):

- **Policy 1 (scroll timing)**: learns WHEN to scroll to the next video in a pre-ordered feed
- **Policy 2 (scroll + select)**: learns when to scroll AND what TYPE of video to watch next

The "dopamine proxy" reward is the mean absolute activation across ~20,000 cortical surface vertices predicted by the brain model.

## Architecture

```
TikTok videos -> V-JEPA2 + W2V-BERT (precomputed on GPU)
                         |
                  backbone features
                         |
              FmriEncoder (8-layer transformer, runs at RL time)
                         |
                brain activation predictions
                         |
                   dopamine reward
                         |
                    PPO-Clip agent
```

Backbone features are precomputed once on a rented GPU. The small FmriEncoder brain model runs during RL training, maintaining temporal context across video transitions so the agent can learn cross-video brain dynamics.

## Setup

Requires Python 3.10-3.12 (PyTorch compatibility).

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

## GPU precompute (vast.ai or similar)

Copy the repo + downloaded videos to a GPU instance, then:

```bash
bash scripts/gpu_setup.sh
bash scripts/run_precompute.sh
```

Copy artifacts back:
```bash
rsync -avz remote:brainrotmaxxer/artifacts/features/ artifacts/features/
rsync -avz remote:brainrotmaxxer/models/tribev2/fmri_encoder.pt models/tribev2/
rsync -avz remote:brainrotmaxxer/artifacts/video_catalog.json artifacts/
```

## Training

```bash
# Policy 1: scroll timing only
python -m src.train --policy scroll

# Policy 2: scroll + video selection
python -m src.train --policy select

# Run baselines for comparison
python -m src.train --baselines
```

Monitor with TensorBoard:
```bash
tensorboard --logdir runs/
```

## Project structure

```
scripts/
  precompute_features.py    GPU: extract V-JEPA2 + W2V-BERT features
  export_brain_model.py     GPU: export FmriEncoder from tribev2 checkpoint
  cluster_videos.py         cluster videos for Policy 2 action space
  sample_tiktok_videos.py   sample and download TikTok videos
  gpu_setup.sh              vast.ai setup
  run_precompute.sh         full precompute pipeline

src/
  brain.py                  FmriEncoder wrapper (brain model)
  reward.py                 dopamine proxy reward computation
  catalog.py                video catalog with clusters
  train.py                  PPO training entrypoint
  env/
    scroll_env.py           Gymnasium env for Policy 1
    scroll_select_env.py    Gymnasium env for Policy 2
```
