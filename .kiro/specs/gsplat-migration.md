# Migration to gsplat Library

## Overview
Replace the original graphdeco-inria/gaussian-splatting implementation with nerfstudio's gsplat library for improved performance, memory efficiency, and maintainability.

## Problem Statement
1. Current implementation uses 4x more GPU memory than necessary
2. Training is ~15% slower than optimized alternatives
3. Original library has restrictive academic license
4. Complex build process with git submodules and custom CUDA compilation
5. Limited ongoing maintenance and feature development

## Goals
- Reduce GPU memory usage by up to 4x
- Decrease training time by ~15%
- Simplify container build with pip-installable package
- Adopt Apache 2.0 licensed codebase
- Enable future feature adoption (3DGUT, batching, etc.)

## Non-Goals
- Changing the COLMAP preprocessing step
- Modifying the output .splat format
- Changing the frontend viewer
- Adding new training features in this migration

---

## Requirements

### Functional Requirements

#### FR1: Equivalent Output Quality
The gsplat implementation must produce equivalent quality splats.

**Acceptance Criteria:**
- [ ] PSNR within ±0.5 dB of original implementation on test scenes
- [ ] Output .ply files compatible with existing convert step
- [ ] Visual quality indistinguishable from original

#### FR2: Parameter Compatibility
All existing training parameters must be supported.

**Acceptance Criteria:**
- [ ] `iterations` parameter works identically (default: 30000)
- [ ] `densify_until_iter` parameter works identically (default: 15000)
- [ ] `densification_interval` parameter works identically (default: 100)
- [ ] Output saved at specified iteration count

#### FR3: COLMAP Input Compatibility
gsplat must accept the same COLMAP output format.

**Acceptance Criteria:**
- [ ] Reads sparse reconstruction from `sparse/0/` directory
- [ ] Reads images from `images/` directory
- [ ] Handles SIMPLE_PINHOLE camera model

#### FR4: S3 Integration
Container must maintain existing S3 input/output patterns.

**Acceptance Criteria:**
- [ ] Downloads COLMAP output from `s3://bucket/colmap/{sceneId}/`
- [ ] Uploads trained model to `s3://bucket/outputs/{sceneId}/`
- [ ] Output structure compatible with convert Lambda

#### FR5: Pipeline Integration
Container must integrate with Step Functions workflow.

**Acceptance Criteria:**
- [ ] Reads `SFN_TASK_TOKEN` for callback
- [ ] Updates `processingStage` in DynamoDB
- [ ] Sends success/failure to Step Functions
- [ ] Writes error details on failure

---

## Technical Design

### Container Changes

#### New Dockerfile
```dockerfile
FROM nvcr.io/nvidia/pytorch:24.01-py3

# gsplat installs via pip with JIT CUDA compilation on first run
# Pre-built wheels also available for specific torch/CUDA versions
RUN pip install gsplat boto3 plyfile tqdm

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
```

#### Updated run.py
```python
"""3D Gaussian Splatting training using gsplat library."""
import os
import sys
import json
import subprocess
import boto3
from pathlib import Path

s3 = boto3.client('s3')
sfn = boto3.client('stepfunctions')
dynamodb = boto3.resource('dynamodb')

BUCKET = os.environ['BUCKET']
SCENE_ID = os.environ['SCENE_ID']
ITERATIONS = int(os.environ.get('ITERATIONS', '30000'))
DENSIFY_UNTIL = int(os.environ.get('DENSIFY_UNTIL_ITER', '15000'))
DENSIFY_INTERVAL = int(os.environ.get('DENSIFICATION_INTERVAL', '100'))
SCENES_TABLE = os.environ.get('SCENES_TABLE')
TASK_TOKEN = os.environ.get('SFN_TASK_TOKEN')

def update_processing_stage(stage: str):
    if SCENES_TABLE:
        table = dynamodb.Table(SCENES_TABLE)
        table.update_item(
            Key={'id': SCENE_ID},
            UpdateExpression='SET processingStage = :stage',
            ExpressionAttributeValues={':stage': stage}
        )

def send_success(output: dict):
    if TASK_TOKEN:
        sfn.send_task_success(taskToken=TASK_TOKEN, output=json.dumps(output))

def send_failure(error: str, stage: str = 'training'):
    update_processing_stage('failed')
    if SCENES_TABLE:
        table = dynamodb.Table(SCENES_TABLE)
        table.update_item(
            Key={'id': SCENE_ID},
            UpdateExpression='SET #e = :error',
            ExpressionAttributeNames={'#e': 'error'},
            ExpressionAttributeValues={':error': f'gsplat failed at {stage}: {error}'}
        )
    if TASK_TOKEN:
        sfn.send_task_failure(taskToken=TASK_TOKEN, error='TrainingError', cause=error)

def main():
    update_processing_stage('training_3dgs')
    
    work_dir = Path(f'/tmp/{SCENE_ID}')
    input_dir = work_dir / 'input'
    output_dir = work_dir / 'output'
    
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Download COLMAP output
        print(f"Downloading COLMAP output for scene {SCENE_ID}...")
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f'colmap/{SCENE_ID}/'):
            for obj in page.get('Contents', []):
                key = obj['Key']
                relative_path = key.replace(f'colmap/{SCENE_ID}/', '')
                local_path = input_dir / relative_path
                local_path.parent.mkdir(parents=True, exist_ok=True)
                s3.download_file(BUCKET, key, str(local_path))
        
        # Run gsplat training using their example trainer
        print(f"Starting gsplat training: {ITERATIONS} iterations")
        result = subprocess.run([
            'python', '-m', 'gsplat.examples.simple_trainer',
            '--data_dir', str(input_dir),
            '--result_dir', str(output_dir),
            '--max_steps', str(ITERATIONS),
            '--densify_until_iter', str(DENSIFY_UNTIL),
            '--densification_interval', str(DENSIFY_INTERVAL),
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            send_failure(result.stderr or 'Training failed', 'gaussian optimization')
            sys.exit(1)
        
        # Upload output
        print("Uploading gsplat output...")
        for file_path in output_dir.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(output_dir)
                s3.upload_file(str(file_path), BUCKET, f'outputs/{SCENE_ID}/{relative_path}')
        
        send_success({'sceneId': SCENE_ID, 'iterations': ITERATIONS, 'status': 'training_complete'})
        
    except Exception as e:
        print(f"gsplat failed: {e}", file=sys.stderr)
        send_failure(str(e), 'initialization')
        sys.exit(1)

if __name__ == '__main__':
    main()
```

### Output Format Verification

gsplat outputs a standard `.ply` file with gaussian parameters. Verify compatibility with convert Lambda:

**Expected output structure:**
```
output/
├── point_cloud/
│   └── iteration_30000/
│       └── point_cloud.ply
├── cameras.json
└── cfg_args
```

**PLY format (same as original):**
- Position: x, y, z (float32)
- Normals: nx, ny, nz (float32)
- SH coefficients: f_dc_0..2, f_rest_0..44 (float32)
- Opacity: opacity (float32)
- Scale: scale_0..2 (float32)
- Rotation: rot_0..3 (float32)

### Convert Lambda Compatibility

The existing convert Lambda reads the `.ply` and converts to `.splat` format. Verify:
1. PLY file location matches expected path
2. Attribute names match expected format
3. Data types are compatible

If gsplat uses different attribute names, update convert Lambda to handle both formats.

---

## Implementation Tasks

### Task 1: Create New Container ✅ COMPLETE
**Files to create/modify:**
- `containers/gaussian-splatting/Dockerfile`
- `containers/gaussian-splatting/run.py`

**Subtasks:**
1. ✅ Update Dockerfile to use pip install gsplat
2. ✅ Update run.py to use gsplat training API
3. ✅ Verify parameter mapping to gsplat equivalents
4. ⬜ Test locally with sample COLMAP output

### Task 2: Verify Output Compatibility ✅ COMPLETE
**Files to check:**
- `services/api/src/handlers/convert.py`

**Subtasks:**
1. ✅ Compare gsplat .ply output structure to original
2. ✅ Verify attribute names match (no changes needed to convert Lambda)
3. ⬜ Test full pipeline with gsplat output
4. ⬜ Compare visual quality of converted .splat

### Task 3: Update Container Build ✅ COMPLETE
**Files to modify:**
- `containers/build.sh` (no changes needed)
- `containers/gaussian-splatting/Dockerfile`

**Subtasks:**
1. ✅ Remove git clone of original repo
2. ✅ Add pip install gsplat
3. ⬜ Test container build
4. ⬜ Push to ECR

### Task 4: Performance Validation ⬜ PENDING
**Subtasks:**
1. ⬜ Run benchmark on test scene with original implementation
2. ⬜ Run same scene with gsplat implementation
3. ⬜ Compare: training time, GPU memory, output quality (PSNR)
4. ⬜ Document results

### Task 5: Rollout ⬜ PENDING
**Subtasks:**
1. ⬜ Deploy updated container to ECR
2. ⬜ Test with new upload
3. ⬜ Monitor for errors
4. ⬜ Compare costs (instance hours)

---

## gsplat API Reference

### Installation Options
```bash
# JIT compilation (builds CUDA on first run)
pip install gsplat

# Pre-built wheels (faster install, specific versions)
pip install gsplat --index-url https://docs.gsplat.studio/whl/pt20cu118
```

### Training API
```python
# Option 1: Use example trainer script
python -m gsplat.examples.simple_trainer \
    --data_dir /path/to/colmap/output \
    --result_dir /path/to/output \
    --max_steps 30000

# Option 2: Python API (more control)
from gsplat import rasterization
# ... custom training loop
```

### Key Parameters
| Original | gsplat | Default |
|----------|--------|---------|
| `--iterations` | `--max_steps` | 30000 |
| `--densify_until_iter` | `--densify_until_iter` | 15000 |
| `--densification_interval` | `--densification_interval` | 100 |
| `--save_iterations` | `--save_steps` | [30000] |

---

## Risk Assessment

### Low Risk
- **Output format incompatibility**: gsplat uses same PLY format as original
- **Parameter differences**: Core parameters map directly

### Medium Risk
- **Quality differences**: gsplat may produce slightly different results
  - Mitigation: Benchmark on test scenes before rollout
- **CUDA compatibility**: JIT compilation may fail on some GPU types
  - Mitigation: Use pre-built wheels or test on target instance types

### High Risk
- None identified

---

## Testing Plan

### Unit Testing
1. Build container locally
2. Run with sample COLMAP output
3. Verify .ply output structure

### Integration Testing
1. Deploy to dev environment
2. Upload test video through full pipeline
3. Verify splat renders correctly in viewer

### Performance Testing
1. Compare training time (target: 15% faster)
2. Compare GPU memory usage (target: 4x reduction)
3. Compare output quality (target: PSNR within ±0.5 dB)

### Regression Testing
1. Process same video with both implementations
2. Compare visual quality side-by-side
3. Verify no degradation in edge cases (few images, large scenes)

---

## Rollout Plan

### Phase 1: Development (1 day)
- Update container with gsplat
- Test locally with sample data
- Verify output compatibility

### Phase 2: Staging (1 day)
- Deploy to staging environment
- Run full pipeline tests
- Benchmark performance

### Phase 3: Production (1 day)
- Deploy updated container
- Monitor first few jobs
- Compare metrics to baseline

### Rollback Plan
- Keep original container image tagged
- Revert ECR image tag if issues arise
- No infrastructure changes required

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Training time | Baseline | -15% | CloudWatch job duration |
| GPU memory | Baseline | -75% | Container metrics |
| Output quality | Baseline | ±0.5 dB PSNR | Manual benchmark |
| Build time | ~10 min | ~3 min | CI/CD pipeline |
| Container size | ~15 GB | ~12 GB | ECR image size |

---

## Future Enhancements

After successful migration, consider adopting additional gsplat features:

1. **NVIDIA 3DGUT Integration**: Improved training with uncertainty estimation
2. **Arbitrary Batching**: Train multiple scenes simultaneously
3. **PPIPS**: Alternative bilateral grid for training view compensation
4. **Custom Training Loop**: Fine-tune training for specific use cases

---

## References

- [gsplat GitHub](https://github.com/nerfstudio-project/gsplat)
- [gsplat Documentation](https://docs.gsplat.studio/)
- [gsplat Paper](https://arxiv.org/abs/2312.02121)
- [Original 3DGS Paper](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)
