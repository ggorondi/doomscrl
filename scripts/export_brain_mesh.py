#!/usr/bin/env python3
"""Export fsaverage5 brain mesh as a JSON file for the web viewer.

Produces left + right hemisphere meshes (half-inflated) with sulcal depth.
"""

from __future__ import annotations

import json
from pathlib import Path

import nibabel as nib
import numpy as np
from nilearn import datasets


def main():
    out_path = Path("web/public/brain_mesh.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fs = datasets.fetch_surf_fsaverage("fsaverage5")

    hemispheres = {}
    for hemi in ("left", "right"):
        infl_data = nib.load(getattr(fs, f"infl_{hemi}"))
        pial_data = nib.load(getattr(fs, f"pial_{hemi}"))
        sulc_data = nib.load(getattr(fs, f"sulc_{hemi}"))

        infl_verts = infl_data.darrays[0].data
        pial_verts = pial_data.darrays[0].data
        faces = pial_data.darrays[1].data
        sulc = sulc_data.darrays[0].data

        coords = infl_verts * 0.5 + pial_verts * 0.5

        if hemi == "left":
            coords[:, 0] = coords[:, 0] - coords[:, 0].max() - 1.0
        else:
            coords[:, 0] = coords[:, 0] - coords[:, 0].min() + 1.0

        hemispheres[hemi] = {
            "vertices": coords,
            "faces": faces,
            "sulcalDepth": sulc,
        }

    all_verts = np.concatenate([hemispheres["left"]["vertices"], hemispheres["right"]["vertices"]])
    all_faces = np.concatenate([
        hemispheres["left"]["faces"],
        hemispheres["right"]["faces"] + len(hemispheres["left"]["vertices"]),
    ])
    all_sulc = np.concatenate([hemispheres["left"]["sulcalDepth"], hemispheres["right"]["sulcalDepth"]])

    scale = 1.0 / max(abs(all_verts.max()), abs(all_verts.min()))
    all_verts *= scale * 2.5

    mesh_data = {
        "vertices": all_verts.astype(np.float32).tolist(),
        "faces": all_faces.astype(np.int32).tolist(),
        "sulcalDepth": all_sulc.astype(np.float32).tolist(),
        "nVertices": len(all_verts),
        "nFaces": len(all_faces),
    }

    with open(out_path, "w") as f:
        json.dump(mesh_data, f)

    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"Exported {len(all_verts)} vertices, {len(all_faces)} faces")
    print(f"Saved to {out_path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
