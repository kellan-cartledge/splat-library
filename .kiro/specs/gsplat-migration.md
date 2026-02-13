# Migration to gsplat Library

## Status: ✅ COMPLETE

## Overview
Replaced the original graphdeco-inria/gaussian-splatting implementation with nerfstudio's gsplat library for improved performance, memory efficiency, and maintainability.

## Problem Statement
1. Current implementation uses 4x more GPU memory than necessary
2. Training is ~15% slower than optimized alternatives
3. Original library has restrictive academic license
4. Complex build process with git submodules and custom CUDA compilation
5. Limited ongoing maintenance and feature development

## Solution Summary

After extensive testing of pre-built wheels (which failed due to CUDA/PyTorch/Python version mismatches), we implemented **building gsplat from source** in the container.

### Final Container Configuration

```dockerfile
FROM --platform=linux/amd64 nvcr.io/nvidia/pytorch:24.12-py3

RUN pip install ninja numpy jaxtyping rich boto3 plyfile tqdm pillow
RUN pip install git+https://github.com/nerfstudio-project/gsplat.git@v1.5.3

WORKDIR /app
COPY run.py .
CMD ["python", "run.py"]
```

**Key Details:**
- **Base Image**: `nvcr.io/nvidia/pytorch:24.12-py3` (PyTorch 2.6 + CUDA 12.6 + Python 3.12)
- **gsplat Version**: 1.5.3 built from source
- **CUDA Kernels**: JIT compiled on first Batch job run (~2-3 min overhead)

### Why Build from Source?

Pre-built wheels failed due to compatibility issues:

| Approach | Issue |
|----------|-------|
| `gsplat-1.5.3+pt24cu121` wheel | ABI mismatch with container's PyTorch 2.2 |
| `gsplat-1.5.3+pt24cu124` wheel | Only Python 3.10 wheels available, container has Python 3.12 |
| NVIDIA 24.01 container | CUDA 12.1, but gsplat uses `cg::labeled_partition` requiring newer CUDA |
| NVIDIA 26.01 container | CUDA 13.1, no gsplat wheels available |

Building from source ensures CUDA kernels compile against the exact PyTorch/CUDA versions in the container.

---

## Implementation Details

### Custom Training Script (`run.py`)

Instead of using gsplat's example trainer, we implemented a custom training loop that:

1. **Parses COLMAP binary files** directly (cameras.bin, images.bin, points3D.bin)
2. **Normalizes the scene** for stable training
3. **Uses gsplat's rasterization API** for rendering
4. **Implements DefaultStrategy** for adaptive densification
5. **Exports PLY** in standard 3DGS format (compatible with existing convert Lambda)

### Key Training Parameters

| Parameter | Default | Environment Variable |
|-----------|---------|---------------------|
| Iterations | 30,000 | `ITERATIONS` |
| Densify Until | 15,000 | `DENSIFY_UNTIL_ITER` |
| Densification Interval | 100 | `DENSIFICATION_INTERVAL` |
| SH Degree | 3 | Hardcoded |

### Output Format

The PLY output matches the original 3DGS format:
- Position: x, y, z
- Normals: nx, ny, nz (zeros)
- SH coefficients: f_dc_0..2, f_rest_0..44
- Opacity: opacity (logit space)
- Scale: scale_0..2 (log space)
- Rotation: rot_0..3 (quaternion, normalized)

---

## Compatibility Issues Encountered

### Issue 1: Pre-built Wheel ABI Mismatch
**Symptom**: `undefined symbol: _ZN2at4_ops10zeros_like4callE...`
**Cause**: Wheel compiled against different PyTorch version
**Solution**: Build from source

### Issue 2: `cg::labeled_partition` Not Found
**Symptom**: CUDA compilation error during JIT
**Cause**: gsplat 1.5.3 uses CUDA cooperative groups feature requiring CUDA 11.6+
**Solution**: Use newer NVIDIA container (24.12 with CUDA 12.6)

### Issue 3: Python Version Mismatch
**Symptom**: No matching wheel for Python 3.12
**Cause**: gsplat only publishes wheels for Python 3.10
**Solution**: Build from source (works with any Python version)

### Issue 4: Cannot Pre-compile CUDA Kernels in Docker Build
**Symptom**: `RuntimeError: Found no NVIDIA driver`
**Cause**: Docker build doesn't have GPU access
**Solution**: Remove pre-compilation step; kernels compile on first Batch run

---

## Completed Tasks

- [x] Update Dockerfile to build gsplat from source
- [x] Implement custom training script with COLMAP parser
- [x] Implement PLY export in 3DGS format
- [x] Test container build
- [x] Push to ECR
- [x] Verify pipeline integration (Step Functions, DynamoDB updates)

## Pending Validation

- [ ] Run full pipeline test with video upload
- [ ] Compare output quality (PSNR) with original implementation
- [ ] Measure training time improvement
- [ ] Measure GPU memory reduction
- [ ] Document performance metrics

---

## Future Enhancements

After successful validation, consider:

1. **Pre-compile CUDA kernels** in a GPU-enabled CI/CD pipeline to eliminate first-run overhead
2. **NVIDIA 3DGUT Integration**: Improved training with uncertainty estimation
3. **Batch multiple scenes**: Train multiple scenes simultaneously
4. **Custom densification**: Tune densification strategy for video-based inputs

---

## References

- [gsplat GitHub](https://github.com/nerfstudio-project/gsplat)
- [gsplat Documentation](https://docs.gsplat.studio/)
- [gsplat Pre-built Wheels](https://docs.gsplat.studio/whl/)
- [NVIDIA PyTorch Containers](https://catalog.ngc.nvidia.com/orgs/nvidia/containers/pytorch)
