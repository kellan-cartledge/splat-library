# COLMAP GPU Acceleration Spec

## Problem

The COLMAP container uses `pycolmap` Python bindings installed via pip, which ships a CPU-only bundled build. Despite running on g6e GPU instances, feature extraction and matching run entirely on CPU. This is the primary bottleneck for large image sets.

## Solution

Replace `pycolmap` Python bindings with subprocess calls to the COLMAP CLI binary already present in the `colmap/colmap:latest` base image, which is compiled with full CUDA support.

## Current Implementation

```python
pycolmap.extract_features(database_path=..., image_path=..., camera_model='SIMPLE_PINHOLE')
pycolmap.match_exhaustive(database_path=...)
pycolmap.incremental_mapping(database_path=..., image_path=..., output_path=...)
```

## Proposed Implementation

Replace the three pycolmap calls in `containers/colmap/run.py` with:

### 1. Feature Extraction
```
colmap feature_extractor \
  --database_path <db> \
  --image_path <images> \
  --ImageReader.camera_model SIMPLE_PINHOLE \
  --SiftExtraction.use_gpu 1
```

### 2. Exhaustive Matching
```
colmap exhaustive_matcher \
  --database_path <db> \
  --SiftMatching.use_gpu 1
```

### 3. Incremental Mapping (CPU-bound, no GPU flag needed)
```
colmap mapper \
  --database_path <db> \
  --image_path <images> \
  --output_path <output>
```

## Changes Required

### `containers/colmap/run.py`
- Remove `import pycolmap`
- Add `import subprocess`
- Replace three pycolmap calls with `subprocess.run(['colmap', ...], check=True)`
- Replace reconstruction result logging (`reconstructions[0].images`, `reconstructions[0].points3D`) with a success message — CLI mapper writes binary files to `output_path/0/`, no easy introspection without re-parsing
- Fix image count check to include both `.jpg` and `.png` (currently only counts `.jpg`, which undercounts when users upload PNG via multi-image upload)
- Keep all existing S3 download/upload, DynamoDB updates, and error handling logic

### `containers/colmap/Dockerfile`
- Remove `pycolmap` from pip install (no longer needed)

### Infrastructure (no changes needed)
- Batch job definition already requests `resourceRequirements = [{ type = "GPU", value = "1" }]`
- COLMAP job runs on the GPU queue with g6e instances
- Compute environment uses `ECS_AL2023_NVIDIA` AMI which provides host-side NVIDIA drivers
- `colmap/colmap:latest` base image includes CUDA toolkit for container-side GPU access

## Expected Impact

- Feature extraction: ~5-10x faster (SIFT GPU vs CPU)
- Exhaustive matching: ~10-20x faster (largest improvement, scales quadratically with image count)
- Incremental mapping: no change (CPU-bound)
- Overall: large scenes that took 30+ minutes should complete in under 10 minutes

## Out of Scope

- Switching to sequential/spatial matching strategies
- Tuning SIFT parameters
- Multi-GPU support
