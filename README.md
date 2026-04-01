# doomscRL

`doomscRL` is a weekend AI research project made for the Silly Hacks 2026 Hackathon: A Reinforcement Learning algorithm learns how to doomscroll optimally, by maximizing a brain-activation reward simulated by Meta's TRIBE v2 fMRI Transformer model (released last week).

The repo contains three main pieces:

- `src/`: the RL environments, reward code, training entrypoint, and brain-model wrapper
- `scripts/`: data prep, feature precompute, replay/export, and utility scripts
- `web/`: the public Next.js site and interactive demo

## Included artifacts

The repo includes the trained PPO run outputs under [`doomscollmaxxer_rl_20260330/doomscollmaxxer_rl_runs_20260330`](/Users/gaborgorondi/Documents/CodeThings/doomscollmaxxer/doomscollmaxxer_rl_20260330/doomscollmaxxer_rl_runs_20260330):

- `best_model.zip` and `final_model.zip` checkpoints
- `evaluations.npz` eval logs
- TensorBoard event files

Large precomputed feature embeddings and prepared dataset artifacts are intentionally not tracked. The video and audio embeddings were precomputed on 3x4090 GPUs, and the RL training runs were done on 5xRTX Pro 4500 pods on runpod.

## Missing pretrained weights

This public repo does **not** include the large pretrained backbone/model checkpoints used during preprocessing and reward prediction.

To reproduce the full pipeline you will need to obtain separately:

- TRIBE v2 / FmriEncoder weights: https://ai.meta.com/blog/tribe-v2-brain-predictive-foundation-model/
- V-JEPA 2 weights: https://huggingface.co/facebook/vjepa2-vitg-fpc64-256
- Wav2Vec-BERT 2.0 weights: https://huggingface.co/facebook/w2v-bert-2.0

The codebase already points at the expected local paths in `models/` and in the training/precompute scripts.

## Quick start

Install:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

Run the website locally:

```bash
cd web
npm install
npm run dev
```

Train or inspect policies:

```bash
python -m src.train
python scripts/render_policy_replay.py
python scripts/export_demo_sessions.py
```

## Notes

- The project is hacky and optimized for a fast demo rather than a clean research release. Use accordingly. Thanks!
