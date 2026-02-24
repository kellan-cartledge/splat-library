# Pipeline Performance Optimization

## Problem

The splat creation pipeline takes 30–50 minutes for a typical 30-second video, which is longer than users expect. The three biggest bottlenecks are COLMAP feature matching, NerfStudio training iterations, and full-resolution image training.

## Current Pipeline Profile

| Stage | Duration (90 frames) | Bottleneck |
|---|---|---|
| Frame extraction (Lambda) | ~30s | — |
| COLMAP feature extraction | ~2–3 min | GPU-accelerated, reasonable |
| COLMAP exhaustive matching | ~5–10 min | O(n²) pair comparisons |
| COLMAP mapper | ~2–5 min | CPU-bound, reasonable |
| NerfStudio splatfacto (30k iter) | ~20–30 min | Excessive iterations for web viewing |
| NerfStudio export | ~1–2 min | — |
| **Total** | **~30–50 min** | |

## Optimizations

### OPT-1: Sequential matcher for video input

**Problem:** `exhaustive_matcher` compares every image pair. For n frames, that's n(n-1)/2 pairs. At 90 frames = 4,005 pairs. At 180 frames = 16,110 pairs. This is the single biggest COLMAP bottleneck.

**Solution:** Use `sequential_matcher` for video input. Video frames are temporally ordered, so only nearby frames need matching. With `--SequentialMatching.overlap 10`, each frame matches against its 10 nearest neighbors — O(n × overlap) instead of O(n²).

For image uploads (unordered photos), switch to `vocab_tree_matcher` which uses a visual vocabulary to identify likely matching pairs without brute-force comparison. COLMAP ships a pre-trained vocab tree that can be downloaded.

**Expected impact:** Matching time drops from ~5–10 min to ~30s–1 min.

**Files changed:**
- `containers/colmap/run.py` — Select matcher based on `INPUT_TYPE` env var; download vocab tree for image input
- `infra/modules/pipeline/main.tf` — Pass `INPUT_TYPE` env var to COLMAP Batch job

**Acceptance criteria:**
- [ ] Video input uses `sequential_matcher` with `--SequentialMatching.overlap 10`
- [ ] Image input uses `vocab_tree_matcher` with a pre-trained vocabulary tree
- [ ] Vocab tree is downloaded at container build time or cached in S3
- [ ] Existing reconstruction quality is not degraded (verified by test upload)

---

### OPT-2: Reduce default training iterations from 30,000 to 7,000

**Problem:** 30,000 iterations is the benchmark-quality setting from the original 3DGS paper (SIGGRAPH 2023). NerfStudio's splatfacto converges quickly — most visual quality is achieved by ~7,000 iterations. The remaining 23,000 iterations yield diminishing returns, especially for web-based splat viewers where the viewing resolution is limited.

**Solution:** Change default iterations to 7,000. Scale densification parameters proportionally:
- `iterations`: 30,000 → 7,000
- `densifyUntilIter`: 15,000 → 5,000
- `densificationInterval`: 100 (unchanged)

Offer a "High Quality" option in the upload form that uses 30,000 iterations for users who want maximum fidelity.

**Expected impact:** Training time drops from ~20–30 min to ~5–8 min.

**Files changed:**
- `services/api/src/handlers/jobs.py` — Update `DEFAULTS` dict
- `packages/web/src/components/Upload/UploadForm.tsx` — Add quality preset selector (Fast / High Quality) if not already present

**Acceptance criteria:**
- [ ] Default iterations is 7,000 with densifyUntilIter 5,000
- [ ] Upload form exposes a quality toggle (Fast: 7k, High Quality: 30k)
- [ ] Existing scenes are unaffected (iterations stored per-scene in DynamoDB)
- [ ] Visual quality at 7k iterations is acceptable (verified by test upload)

---

### OPT-3: Auto-downscale large images for training

**Problem:** `--downscale-factor 1` trains on full-resolution images. A 4K image has 4x the pixels of 1080p, making each training step proportionally slower. Web splat viewers don't benefit from 4K-trained splats.

**Solution:** In the gaussian-splatting container, detect the input image resolution and set `--downscale-factor 2` when images exceed 1600px on their longest edge. This halves each dimension, reducing pixel count by 4x.

**Expected impact:** Training ~2x faster for high-resolution inputs. No change for already-small images.

**Files changed:**
- `containers/gaussian-splatting/run.py` — Detect max image dimension after download, set downscale factor accordingly

**Acceptance criteria:**
- [ ] Images > 1600px longest edge use `--downscale-factor 2`
- [ ] Images ≤ 1600px use `--downscale-factor 1`
- [ ] Resolution detection uses PIL/Pillow or image header parsing (no heavy dependencies)
- [ ] Downscale factor is logged for debugging

---

### OPT-4: COLMAP single camera mode for video

**Problem:** COLMAP estimates separate camera intrinsics for each frame by default. For video, all frames come from the same camera, so this is redundant work that slows bundle adjustment.

**Solution:** Add `--ImageReader.single_camera 1` to the feature extractor for video input. This tells COLMAP all images share one camera model, reducing the parameter space in bundle adjustment.

**Expected impact:** Modest speedup in mapper stage (~10–20%).

**Files changed:**
- `containers/colmap/run.py` — Add flag when `INPUT_TYPE == 'video'`

**Acceptance criteria:**
- [ ] Video input uses `--ImageReader.single_camera 1`
- [ ] Image input does not use this flag (different cameras possible)

---

### OPT-5: Cap maximum extracted frames

**Problem:** At 3 fps, a 2-minute video produces 360 frames. More frames means quadratically more matching time (even with sequential matcher, more frames = more total work) and linearly more training time.

**Solution:** Cap extracted frames at 150. If the video would produce more frames at the configured fps, reduce fps proportionally. For example, a 2-minute video at 3fps = 360 frames → auto-reduce to ~1.25fps to get 150 frames.

**Expected impact:** Prevents pathologically slow processing for long videos.

**Files changed:**
- `services/api/src/handlers/extract_frames.py` — Calculate expected frame count from video duration, cap fps if needed

**Acceptance criteria:**
- [ ] Frame count is capped at 150
- [ ] FPS is reduced proportionally for long videos (not by dropping frames randomly)
- [ ] Actual frame count and adjusted fps are logged and returned in the output

---

## Implementation Order

1. **OPT-2** (reduce iterations) — Largest impact, simplest change, backend-only
2. **OPT-1** (sequential matcher) — Largest COLMAP impact, requires container rebuild
3. **OPT-3** (auto-downscale) — Requires container rebuild, can batch with OPT-1
4. **OPT-4** (single camera) — Small change, bundle with OPT-1 container rebuild
5. **OPT-5** (cap frames) — Lambda change, independent of containers

OPT-1, OPT-3, and OPT-4 all modify containers and should be deployed together in one container rebuild + ECR push.

## Projected Results

| Stage | Current | Optimized | Speedup |
|---|---|---|---|
| Frame extraction | ~30s | ~30s | — |
| COLMAP matching | ~5–10 min | ~30s–1 min | ~10x |
| COLMAP other | ~4–8 min | ~3–5 min | ~1.5x |
| NerfStudio training | ~20–30 min | ~3–5 min | ~5x |
| NerfStudio export | ~1–2 min | ~1–2 min | — |
| **Total** | **~30–50 min** | **~8–13 min** | **~3–4x** |

## Testing Plan

1. Upload a 30s video with default (fast) settings — verify processing completes in ~10–15 min
2. Upload a 30s video with high quality settings — verify 30k iterations still works
3. Upload 20+ images — verify vocab_tree_matcher produces valid reconstruction
4. Upload a 2-min video — verify frame cap kicks in and processing doesn't exceed ~15 min
5. Compare visual quality of 7k vs 30k iteration splats side-by-side
