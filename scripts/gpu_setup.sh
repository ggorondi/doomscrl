#!/usr/bin/env bash
set -euo pipefail

apt-get update && apt-get install -y ffmpeg git-lfs

pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install transformers>=4.50 torchcodec>=0.2 huggingface-hub>=0.25
pip install numpy pandas scikit-learn tqdm pyyaml

if [ ! -d "tribev2" ]; then
    git clone https://github.com/facebookresearch/tribev2.git
    cd tribev2 && pip install -e . && cd ..
fi

echo ""
echo "Setup complete. Run: bash scripts/run_precompute.sh"
echo "Make sure to set HF_TOKEN if you need LLaMA access:"
echo "  export HF_TOKEN=hf_..."
echo "  huggingface-cli login --token \$HF_TOKEN"
