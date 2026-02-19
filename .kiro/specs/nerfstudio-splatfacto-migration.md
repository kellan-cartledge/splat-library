# NerfStudio Splatfacto Migration Spec

## Problem

Two issues with the current container pipeline:

1. **COLMAP container broken** — `colmap/colmap:latest` updated to COLMAP 3.13.0, which renamed GPU flags from `--SiftExtraction.use_gpu` / `--SiftMatching.use_gpu` to `--FeatureExtraction.use_gpu` / `--FeatureMatching.use_gpu`. The COLMAP container fails immediately with: `Failed to parse options - unrecognised option '--SiftExtraction.use_gpu'`. (CloudWatch log: `splat-library-colmap/default/ac65c4c008b640a7be8a032479a71c2c`)

2. **Gaussian splatting container fragile** — Uses a custom ~300-line training loop built directly on the gsplat library. Reimplements scene normalization, COLMAP binary parsing, SH coefficient handling, densification strategy, SSIM loss, PLY export, and KNN initialization — all of which NerfStudio's `splatfacto` model already handles. The custom code has already hit OOM issues (the N×N `torch.cdist` fix) and lacks image undistortion, disk caching for large scenes, and checkpoint saving.

## Solution

1. Fix the COLMAP container GPU flags for 3.13.0 compatibility and pin the image tag to avoid future breakage.
2. Replace the custom gsplat training loop with NerfStudio's `ns-train splatfacto` CLI, following the [AWS reference implementation](https://github.com/aws-solutions-library-samples/guidance-for-open-source-3d-reconstruction-toolbox-for-gaussian-splats-on-aws).

## Current Flow

```
COLMAP container:
  1. Downloads frames from s3://BUCKET/frames/{sceneId}/
  2. Runs COLMAP (feature_extractor → exhaustive_matcher → mapper)
     *** BROKEN: --SiftExtraction.use_gpu unrecognized in COLMAP 3.13.0 ***
  3. Uploads everything to s3://BUCKET/colmap/{sceneId}/
     ├── images/          (copies of the frames)
     ├── sparse/0/        (cameras.bin, images.bin, points3D.bin)
     └── database.db

GS container (run.py):
  1. Downloads from s3://BUCKET/colmap/{sceneId}/ into /tmp/{sceneId}/input/
  2. Parses COLMAP binary files manually (read_colmap_binary)
  3. Runs custom gsplat training loop (~300 lines)
  4. Exports PLY manually (export_ply)
  5. Uploads to s3://BUCKET/outputs/{sceneId}/point_cloud/iteration_N/point_cloud.ply
```

## Proposed Flow

```
COLMAP container (fixed):
  1. Downloads frames from s3://BUCKET/frames/{sceneId}/
  2. Runs COLMAP with corrected 3.13.0 flags:
     --FeatureExtraction.use_gpu 1  (was --SiftExtraction.use_gpu 1)
     --FeatureMatching.use_gpu 1    (was --SiftMatching.use_gpu 1)
  3. Uploads to s3://BUCKET/colmap/{sceneId}/ (unchanged)

GS container (run.py, rewritten):
  1. Downloads from s3://BUCKET/colmap/{sceneId}/ into /tmp/{sceneId}/
  2. Restructures into NerfStudio colmap dataparser layout:
       /tmp/{sceneId}/
       ├── images/                    (from colmap/{sceneId}/images/)
       └── colmap/
           └── sparse/
               └── 0/                 (from colmap/{sceneId}/sparse/0/)
                   ├── cameras.bin
                   ├── images.bin
                   └── points3D.bin
  3. Runs: ns-train splatfacto ... colmap --data /tmp/{sceneId}/ --downscale-factor 1
  4. Runs: ns-export gaussian-splat --load-config <config.yml> --output-dir <export_dir>
  5. Uploads splat.ply to s3://BUCKET/outputs/{sceneId}/point_cloud/iteration_N/point_cloud.ply
```

The key restructuring for the GS container is moving `sparse/0/` under a `colmap/` subdirectory, since NerfStudio's `colmap` dataparser expects `{data}/colmap/sparse/0/` not `{data}/sparse/0/`.

## Changes Required

### 1. `containers/colmap/run.py` — Fix GPU flags

Update the two COLMAP CLI calls that use the renamed flags:

```python
# Feature extraction: --SiftExtraction.use_gpu → --FeatureExtraction.use_gpu
run_colmap([
    'feature_extractor',
    '--database_path', str(database_path),
    '--image_path', str(image_dir),
    '--ImageReader.camera_model', 'SIMPLE_PINHOLE',
    '--FeatureExtraction.use_gpu', '1'
], 'feature extraction')

# Exhaustive matching: --SiftMatching.use_gpu → --FeatureMatching.use_gpu
run_colmap([
    'exhaustive_matcher',
    '--database_path', str(database_path),
    '--FeatureMatching.use_gpu', '1'
], 'feature matching')
```

Note: COLMAP 3.13.0 defaults `FeatureExtraction.use_gpu` and `FeatureMatching.use_gpu` to `1`, so the flags are technically redundant. We keep them explicit for clarity.

The `mapper` call is unaffected — it has no GPU flags.

### 2. `containers/colmap/Dockerfile` — Pin COLMAP version

Change `colmap/colmap:latest` to a pinned tag to prevent future breakage from upstream updates. The reference implementation pins COLMAP 3.12.0 built from source; we'll pin the Docker tag instead:

```dockerfile
FROM --platform=linux/amd64 colmap/colmap:3.13.0
```

If `3.13.0` tag doesn't exist on Docker Hub, use the current `latest` digest as a pin. The important thing is to stop floating on `latest`.

### 3. `containers/gaussian-splatting/run.py` — Rewrite

Delete all custom training code. The new file will contain:

- `update_processing_stage()`, `send_success()`, `send_failure()` — keep as-is (DynamoDB + Step Functions integration)
- `download_colmap_output()` — download from S3 and restructure into NerfStudio layout:
  - `colmap/{sceneId}/images/*` → `/tmp/{sceneId}/images/`
  - `colmap/{sceneId}/sparse/0/*` → `/tmp/{sceneId}/colmap/sparse/0/`
  - Skip `database.db` (not needed for training)
- `run_training()` — subprocess call to `ns-train`:
  ```
  ns-train splatfacto \
    --timestamp {sceneId} \
    --output-dir /tmp/{sceneId}/nerfstudio_output \
    --viewer.quit-on-train-completion True \
    --logging.local-writer.enable False \
    --logging.profiler none \
    --max-num-iterations {ITERATIONS} \
    --pipeline.model.use_scale_regularization True \
    colmap \
    --data /tmp/{sceneId} \
    --downscale-factor 1
  ```
- `run_export()` — subprocess call to `ns-export`:
  ```
  ns-export gaussian-splat \
    --load-config /tmp/{sceneId}/nerfstudio_output/unnamed/splatfacto/{sceneId}/config.yml \
    --output-dir /tmp/{sceneId}/export
  ```
- `upload_output()` — upload `export/splat.ply` to `s3://BUCKET/outputs/{sceneId}/point_cloud/iteration_{N}/point_cloud.ply`
- `main()` — orchestrates the above in sequence with error handling

**Removed code** (~250 lines):
- `read_colmap_binary()` — NerfStudio reads COLMAP natively
- `qvec_to_rotmat()` — handled by NerfStudio
- `_fused_ssim()` — NerfStudio has its own
- `export_ply()` — `ns-export` handles this
- `train_gsplat()` — the entire custom training loop
- Batched KNN initialization — NerfStudio initializes from SfM points with its own method

### 4. `containers/gaussian-splatting/Dockerfile` — Rebuild

```dockerfile
FROM --platform=linux/amd64 nvcr.io/nvidia/pytorch:24.12-py3

# NerfStudio + gsplat (gsplat compiles CUDA kernels during install)
RUN pip install nerfstudio boto3

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
```

Key changes:
- Replace `pip install gsplat@v1.5.3` + manual deps with `pip install nerfstudio` (which pulls gsplat as a dependency)
- Remove `plyfile`, `jaxtyping`, `rich`, `tqdm`, `pillow` — all included transitively via nerfstudio
- Image will be larger (~8-10 GB vs ~4 GB) due to NerfStudio's full dependency tree, but this is acceptable for a Batch job container

### 5. Infrastructure — No changes

- Batch job definition: no changes needed. The `ITERATIONS` env var is still used (passed to `--max-num-iterations`). `DENSIFY_UNTIL_ITER` and `DENSIFICATION_INTERVAL` env vars become unused — NerfStudio manages densification internally with well-tuned defaults.
- Step Functions: no changes. The Run3DGS state still passes the same environment variables.
- ECR repositories: same repos (`splat-library-colmap` and `splat-library-gaussian-splatting`), just new image pushes.

### 6. S3 Output Path — Preserve compatibility

The current output path is `outputs/{sceneId}/point_cloud/iteration_{N}/point_cloud.ply`. The `convert.py` Lambda (ConvertAndNotify stage) reads from this path. `ns-export` outputs to `{output-dir}/splat.ply`, so the upload step must map this to the existing path to avoid breaking the downstream Lambda.

## NerfStudio Training Arguments Explained

| Argument | Value | Why |
|---|---|---|
| `splatfacto` | model name | NerfStudio's gaussian splatting model, uses gsplat rasterization |
| `--timestamp {sceneId}` | scene ID | Names the output subdirectory for this run |
| `--output-dir` | custom path | Keeps outputs in our working directory |
| `--viewer.quit-on-train-completion True` | — | Critical: exits process when training finishes (headless mode) |
| `--logging.local-writer.enable False` | — | Disables TensorBoard/local logging (unnecessary in Batch) |
| `--logging.profiler none` | — | Disables profiler overhead |
| `--max-num-iterations {N}` | from env | Training iterations (default 30000) |
| `--pipeline.model.use_scale_regularization True` | — | Prevents long spiky gaussians (recommended by NerfStudio docs) |
| `colmap` | dataparser | Tells NerfStudio to read COLMAP binary format |
| `--data /tmp/{sceneId}` | data root | Directory containing `images/` and `colmap/sparse/0/` |
| `--downscale-factor 1` | — | Use full resolution images (no downscaling) |

### Large Scene Handling

For scenes with >500 images, add `--pipeline.datamanager.cache-images disk` to avoid dataloader OOM. This can be determined at runtime by counting images before launching `ns-train`. The reference implementation uses a `GPU_MAX_IMAGES = 500` threshold for this.

## Environment Variables

| Variable | Status | Notes |
|---|---|---|
| `SCENE_ID` | Keep | Used for S3 paths and DynamoDB updates |
| `BUCKET` | Keep | S3 bucket name |
| `SCENES_TABLE` | Keep | DynamoDB table for status updates |
| `ITERATIONS` | Keep | Passed to `--max-num-iterations` |
| `DENSIFY_UNTIL_ITER` | Unused | NerfStudio manages densification internally |
| `DENSIFICATION_INTERVAL` | Unused | NerfStudio manages densification internally |
| `SFN_TASK_TOKEN` | Keep | Step Functions callback (injected by Batch integration) |

The unused env vars can remain in the Step Functions definition — they're harmless and can be cleaned up later.

## Expected Impact

- **Quality**: NerfStudio's splatfacto is benchmarked and tuned. Includes proper image undistortion, adaptive densification with gradient accumulation, and scale regularization. Should produce equal or better quality than the custom loop.
- **Reliability**: Eliminates the hand-rolled COLMAP parser, KNN initialization, SH export, and SSIM implementation — all common sources of subtle bugs.
- **OOM resilience**: The batched KNN fix is no longer needed. NerfStudio handles point initialization internally. Disk caching available for large scenes.
- **Maintainability**: ~50 lines of subprocess orchestration vs ~300 lines of custom training code. Future improvements come from upgrading the `nerfstudio` pip package.
- **Build time**: Docker image build will be slower (NerfStudio has many dependencies + CUDA compilation). Mitigated by ECR layer caching.

## Testing

### COLMAP container
1. Build and push the fixed COLMAP container to ECR
2. Run a pipeline job and verify COLMAP completes (feature extraction + matching + mapping)
3. Confirm `colmap/{sceneId}/sparse/0/` contains `cameras.bin`, `images.bin`, `points3D.bin`

### Gaussian splatting container
1. Build and push the new NerfStudio-based container to ECR
2. Run a pipeline job with a known scene (the same one used to test the COLMAP GPU + batched KNN fixes)
3. Verify:
   - `ns-train` completes without error
   - `ns-export` produces a valid `splat.ply`
   - PLY is uploaded to the correct S3 path
   - ConvertAndNotify Lambda succeeds downstream
   - Viewer renders the splat correctly
4. Compare visual quality against the previous custom gsplat output for the same scene

## Out of Scope

- Multi-GPU training (NerfStudio supports it but our Batch jobs request 1 GPU)
- SPZ compression (potential future addition — the reference impl does this)
- Switching to `splatfacto-big` or `splatfacto-mcmc` variants (can be parameterized later)
- Blur filtering or background removal preprocessing stages
- Switching COLMAP matching strategy (sequential/spatial/vocab — currently exhaustive)
- Adding glomap as an alternative SfM backend (reference impl supports this)
- Building COLMAP from source (reference impl does this for 3.12.0; we use the official Docker image)
