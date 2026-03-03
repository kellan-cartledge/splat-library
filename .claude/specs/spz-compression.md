# SPZ Compressed Gaussian Splat Output

## Problem

The pipeline currently outputs uncompressed PLY files (~236 bytes per gaussian). For a typical scene with 500K–2M gaussians, output files range from 100–450 MB. These large files are slow to download over the network, expensive to serve via CloudFront, and costly to store in S3. Web-based splat viewers don't need full 32-bit float precision for every parameter — most visual quality is preserved at lower bit depths.

## SPZ Format Overview

[SPZ](https://github.com/nianticlabs/spz) is an open-source compressed file format for 3D Gaussian splats created by Niantic Labs. It achieves ~10x compression over PLY with virtually no perceptible quality loss.

**Compression techniques:**
- Fixed-point quantization: 24-bit positions (vs 32-bit float), 8-bit scales/colors/rotations/alphas
- Column-based data organization (groups similar parameter types for better gzip compression)
- Final gzip compression layer

**File structure:** 16-byte header (magic, version, numPoints, shDegree, fractionalBits, flags) followed by gaussian data organized by attribute: positions → alphas → colors → scales → rotations → spherical harmonics.

**Per-gaussian storage:** ~64 bytes (SPZ) vs ~236 bytes (PLY) = **3.7x** raw reduction, plus gzip yields **~10x** total compression.

| Metric | PLY | SPZ |
|---|---|---|
| Storage per gaussian | 236 bytes | ~25 bytes (after gzip) |
| Typical scene (1M gaussians) | ~225 MB | ~25 MB |
| Precision | 32-bit float | 8–24 bit quantized |
| Visual quality loss | — | Virtually imperceptible |

## Why a Separate Library?

NerfStudio's `ns-export gaussian-splat` only supports PLY output — there is no built-in `--output-format spz` option. The [nianticlabs/spz](https://github.com/nianticlabs/spz) Python library must be installed separately to convert PLY → SPZ. It builds from source via nanobind (C++ extension) and requires only libz as a dependency.

## Implementation Approach

Add SPZ conversion inside the **gaussian-splatting container** after NerfStudio's PLY export and before S3 upload. The container already has a full C++ toolchain (NVIDIA PyTorch base image) making it trivial to build the spz library from source. The conversion adds only seconds to an already multi-minute GPU job.

**Why not Lambda?** The spz library requires C++ compilation via nanobind. Building for Lambda's AL2023 runtime would require a pre-built wheel or Lambda layer — unnecessary complexity when the container already has everything needed.

**Why not a new pipeline step?** Adding a Step Functions state, new Lambda/container resource, and IAM permissions is overkill for a seconds-long conversion that logically belongs with the export step.

### Coordinate System Conversion

NerfStudio exports PLY in COLMAP/OpenCV convention (RDF: Right-Down-Forward, Z-up). The current viewer compensates with a `-90° X rotation` in `SplatViewer.tsx`. The SPZ library supports coordinate conversion during packing — by specifying `from_coord = RDF`, the library converts to its internal RUB convention (Right-Up-Back), which is the native Three.js coordinate system.

With SPZ, the viewer rotation hack is no longer needed and should be removed.

---

## Changes

### SPZ-1: Install spz library in gaussian-splatting container

**Files changed:**
- `containers/gaussian-splatting/Dockerfile` — Add `pip install git+https://github.com/nianticlabs/spz.git`

The NVIDIA PyTorch base image includes GCC 12+, cmake, and zlib — all dependencies the spz library needs. The nanobind C++ build adds ~1–2 minutes to Docker image build time (one-time cost; current build already takes 10+ minutes for nerfstudio).

**Acceptance criteria:**
- [ ] `pip install git+https://github.com/nianticlabs/spz.git` succeeds during Docker build
- [ ] `python -c "import spz"` succeeds in the built image
- [ ] Existing nerfstudio and boto3 packages are unaffected

---

### SPZ-2: Replace PLY upload with SPZ in training container

**Files changed:**
- `containers/gaussian-splatting/run.py` — Add `convert_to_spz()` function, modify `upload_output()` to convert and upload SPZ only

**New function:**
```python
def convert_to_spz(ply_path: Path) -> Path:
    import spz
    spz_path = ply_path.with_suffix('.spz')

    # Load PLY — NerfStudio exports in COLMAP/OpenCV convention (RDF)
    unpack_opts = spz.UnpackOptions()
    cloud = spz.load_splat_from_ply(str(ply_path), unpack_opts)

    # Save as SPZ with coordinate conversion: RDF → RUB (Three.js native)
    pack_opts = spz.PackOptions()
    pack_opts.from_coord = spz.CoordinateSystem.RDF
    spz.save_spz(cloud, pack_opts, str(spz_path))

    return spz_path
```

**Modified `upload_output()`:**
1. Convert PLY → SPZ via `convert_to_spz()`
2. Upload SPZ to `outputs/{sceneId}/point_cloud/iteration_{ITERATIONS}/point_cloud.spz`
3. Log gaussian count, file sizes, and compression ratio
4. PLY is no longer uploaded to S3

**Acceptance criteria:**
- [ ] After training + export, `point_cloud.spz` is uploaded to S3
- [ ] SPZ file is ~10x smaller than the source PLY
- [ ] Compression ratio and gaussian count are logged to stdout

---

### SPZ-3: Update convert Lambda for SPZ

**Files changed:**
- `services/api/src/handlers/convert.py` — Copy SPZ (not PLY) to final output path, update splatKey

**Logic:**
1. Copy SPZ from `outputs/{sceneId}/point_cloud/iteration_{iterations}/point_cloud.spz` to `outputs/{sceneId}/scene.spz` via `s3.copy_object()` (server-side copy, no Lambda disk usage)
2. Store `splatKey: outputs/{sceneId}/scene.spz` in DynamoDB
3. Remove the unused `convert_ply_to_splat()` function (dead code, lines 52–74)

**Acceptance criteria:**
- [ ] `splatKey` in DynamoDB is `outputs/{sceneId}/scene.spz`
- [ ] Uses `copy_object` (server-side copy, no download/upload)
- [ ] Dead `convert_ply_to_splat()` function is removed

---

### SPZ-4: Remove viewer rotation hack

**Files changed:**
- `packages/web/src/components/Viewer/SplatViewer.tsx` — Remove the `-90° X rotation`

The SPZ file already contains coordinates in RUB (Three.js native convention) thanks to the coordinate conversion in SPZ-2. The rotation line `splat.rotation.x = -Math.PI / 2` should be removed entirely.

**Acceptance criteria:**
- [ ] The `splat.rotation.x = -Math.PI / 2` line is removed
- [ ] SPZ scenes render with correct orientation without any rotation

---

## Files NOT Changed

- **`infra/`** — No new resources, IAM policies, or Step Functions states needed. The convert Lambda already has `s3:GetObject`, `s3:PutObject`, `s3:CopyObject` permissions on the assets bucket. CloudFront's `outputs/*` cache behavior serves any file extension.
- **`packages/web/src/api/`** — The `splatKey` field in the Scene interface is already a plain string, format-agnostic.

## Implementation Order

1. **SPZ-1** (Dockerfile) — Smallest change, validates spz builds in container
2. **SPZ-2** (run.py) — Core conversion logic, SPZ-only upload
3. **SPZ-3** (convert.py) — Lambda copies SPZ to final path
4. **SPZ-4** (SplatViewer.tsx) — Remove rotation hack

SPZ-1 and SPZ-2 modify the container and should be deployed together via `./containers/build.sh`. SPZ-3 deploys with `pnpm deploy:infra` (Terraform detects Lambda code change). SPZ-4 deploys with `pnpm build` + frontend upload to S3.

## Testing Plan

1. **Container build** — Build Docker image, verify `import spz` succeeds
2. **End-to-end pipeline** — Upload a test video, verify `.spz` appears in S3 at expected path
3. **Size validation** — Confirm SPZ is ~10x smaller than PLY (logged in container output)
4. **Viewer rendering** — Load a new SPZ scene in the web viewer, verify correct orientation and visual quality
5. **Visual comparison** — Compare rendered SPZ scene against a known-good reference for quality regression
