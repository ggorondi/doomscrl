---
license: other
tags:
- dataset
- video
- social-media
- tiktok
- multimodal
- audio-visual
dataset_info:
  features:
  - name: id
    dtype: int64
  - name: collected_time
    dtype: string
  - name: create_time
    dtype: int64
  - name: desc
    dtype: string
  - name: duet_display
    dtype: int64
  - name: duet_enabled
    dtype: string
  - name: duet_info_duet_from_id
    dtype: float64
  - name: is_ad
    dtype: string
  - name: item_comment_status
    dtype: int64
  - name: item_mute
    dtype: string
  - name: item_control_can_repost
    dtype: string
  - name: official_item
    dtype: string
  - name: original_item
    dtype: string
  - name: share_enabled
    dtype: string
  - name: playlist_id
    dtype: float64
  - name: stitch_display
    dtype: int64
  - name: stitch_enabled
    dtype: string
  - name: diversification_id
    dtype: float64
  - name: stats_time
    dtype: string
  - name: collect_count
    dtype: int64
  - name: comment_count
    dtype: int64
  - name: digg_count
    dtype: int64
  - name: play_count
    dtype: int64
  - name: share_count
    dtype: int64
  - name: vq_score
    dtype: float64
  - name: duration
    dtype: int64
  - name: share_cover
    dtype: string
  - name: poi_id
    dtype: int64
  - name: poi_name
    dtype: string
  - name: address
    dtype: string
  - name: city
    dtype: string
  - name: city_code
    dtype: float64
  - name: country_code
    dtype: int64
  - name: poi_category
    dtype: string
  - name: father_poi_id
    dtype: string
  - name: father_poi_name
    dtype: string
  - name: poi_tt_type_code
    dtype: string
  - name: poi_tt_type_name_medium
    dtype: string
  - name: poi_tt_type_name_super
    dtype: string
  - name: poi_tt_type_name_tiny
    dtype: string
  - name: user_id
    dtype: int64
  - name: user_avatar_larger
    dtype: string
  - name: user_avatar_medium
    dtype: string
  - name: user_avatar_thumb
    dtype: string
  - name: user_tt_seller
    dtype: string
  - name: user_verified
    dtype: string
  - name: challenges
    dtype: string
  - name: music_id
    dtype: float64
  - name: music_title
    dtype: string
  - name: music_album
    dtype: string
  - name: music_author_name
    dtype: string
  - name: music_duration
    dtype: float64
  - name: music_original
    dtype: string
  - name: music_play_url
    dtype: string
  - name: url
    dtype: string
  splits:
  - name: train
    num_examples: 10000000
---

# TikTok-10M Dataset

## Dataset Description

TikTok-10M is a large-scale dataset containing 10 million short-form posts from TikTok, designed for video understanding, multimodal learning, and social media content analysis. The dataset was curated to bridge the gap between academic video datasets and actual user-generated content, providing researchers with authentic patterns and characteristics of modern short-form video content that dominates social media platforms.

## Request for granular highly curated data

Please fill out this form if you are training models and want additional curated datasets: [Google Form](https://forms.gle/1dT6RsKsRKxbuupw8)

## Dataset Structure

Each data instance contains:

- Post metadata (`id`, `url`, `desc`, `challenges`, `create_time`, etc)
- Post statistics (`digg_count`, `comment_count`, `play_count`, etc)
- Point of interest data (`poi_name`, `address`, `poi_category`, etc)
- Music data (`music_name`,`music_album`, etc) 
- Video data (`vq_score`, `duration`, etc)

## Usage Examples

```python
from datasets import load_dataset

# Load the full dataset
dataset = load_dataset("The-data-company/TikTok-10M")

# Access training split
train_dataset = dataset["train"]

# Access a sample
sample = train_dataset[0]
print(f"description: {sample['desc']}")
print(f"likes: {sample['digg_count']}")
print(f"url: {sample['url']}")
```

## Dataset Statistics

- **Total Videos:** 10,000,000
- **Total Duration:** [To be calculated]
- **Average Video Length:** [To be calculated]
- **Category Distribution:** [To be calculated]

## Limitations and Biases

- **Temporal Bias:** Dataset reflects trending TikTok content during Spring 2025
- **Geographic Bias:** Dataset contains only content with US-based points of interest
- **Content Bias:** Dataset focuses on trending content
- **Quality Variation:** User-generated content varies significantly in production quality

## Data Access

The dataset is available through the Hugging Face datasets library. Due to its large size (10M videos), consider using streaming or downloading specific splits based on your needs.

## Ethical Considerations

- **Public Data Only**: Only publicly available data is included
- **Privacy Protection**: No personally identifiable information beyond what was publicly shared
- **Content Moderation**: Users should implement appropriate content filtering for their use cases
- **Responsible Use**: This dataset should be used in accordance with TikTok's terms of service and applicable laws

## Citation

```bibtex
@dataset{tiktok_10m_2025,
  title={TikTok-10M: A Large-Scale Short Video Dataset for Video Understanding},
  author={The Data Company},
  year={2025},
  url={https://huggingface.co/datasets/The-data-company/TikTok-10M},
  note={A dataset of 10 million TikTok posts for multimodal learning and social media analysis}
}
```
