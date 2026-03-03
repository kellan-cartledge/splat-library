# Splat Library - Container Specifications

## COLMAP Container (using pycolmap Python bindings)

COLMAP provides official Python bindings via `pycolmap` (now part of main COLMAP repo, v3.13.0+).

**Note:** Pre-built wheels do NOT include CUDA support. For GPU-accelerated feature extraction, build from source or use the CLI fallback.

**containers/colmap/Dockerfile**
```dockerfile
FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install pycolmap from PyPI (pre-built wheel, no CUDA)
# For CUDA support, build COLMAP from source instead
RUN pip install --no-cache-dir \
    pycolmap>=3.10.0 \
    boto3>=1.34.0 \
    numpy>=1.24.0

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
```

**containers/colmap/run.py**
```python
"""COLMAP processing using pycolmap Python bindings (v3.10+) with Step Functions Task Token support."""
import os
import sys
import json
import boto3
import pycolmap
from pathlib import Path

s3 = boto3.client('s3')
sfn = boto3.client('stepfunctions')

BUCKET = os.environ['BUCKET']
SCENE_ID = os.environ['SCENE_ID']
TASK_TOKEN = os.environ.get('SFN_TASK_TOKEN')

def send_success(output: dict):
    """Send success to Step Functions if task token is present."""
    if TASK_TOKEN:
        sfn.send_task_success(taskToken=TASK_TOKEN, output=json.dumps(output))

def send_failure(error: str):
    """Send failure to Step Functions if task token is present."""
    if TASK_TOKEN:
        sfn.send_task_failure(
            taskToken=TASK_TOKEN,
            error='COLMAPError',
            cause=error
        )

def main():
    work_dir = Path(f'/tmp/{SCENE_ID}')
    image_dir = work_dir / 'images'
    output_dir = work_dir / 'sparse'
    database_path = work_dir / 'database.db'
    
    image_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Download frames from S3
        print(f"Downloading frames for scene {SCENE_ID}...")
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f'frames/{SCENE_ID}/'):
            for obj in page.get('Contents', []):
                key = obj['Key']
                filename = os.path.basename(key)
                if filename:  # Skip directory entries
                    s3.download_file(BUCKET, key, str(image_dir / filename))
        
        num_images = len(list(image_dir.glob('*.jpg')))
        print(f"Downloaded {num_images} frames to {image_dir}")
        
        if num_images < 3:
            raise RuntimeError(f"Not enough images for reconstruction: {num_images}")
        
        # Feature extraction using pycolmap (v3.10+ API)
        print("Running feature extraction...")
        pycolmap.extract_features(
            database_path=database_path,
            image_path=image_dir
        )
        
        # Feature matching
        print("Running exhaustive feature matching...")
        pycolmap.match_exhaustive(database_path=database_path)
        
        # Sparse reconstruction (incremental mapping)
        print("Running incremental mapping...")
        reconstructions = pycolmap.incremental_mapping(
            database_path=database_path,
            image_path=image_dir,
            output_path=output_dir
        )
        
        if not reconstructions:
            raise RuntimeError("COLMAP reconstruction failed - no valid reconstruction produced")
        
        print(f"Reconstruction complete: {len(reconstructions)} model(s)")
        print(f"  - Cameras: {len(reconstructions[0].cameras)}")
        print(f"  - Images: {len(reconstructions[0].images)}")
        print(f"  - Points3D: {len(reconstructions[0].points3D)}")
        
        # Upload results to S3
        print("Uploading COLMAP output...")
        for file_path in work_dir.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(work_dir)
                s3_key = f'colmap/{SCENE_ID}/{relative_path}'
                s3.upload_file(str(file_path), BUCKET, s3_key)
        
        print(f"COLMAP complete for scene {SCENE_ID}")
        send_success({
            'sceneId': SCENE_ID, 
            'status': 'colmap_complete',
            'numImages': len(reconstructions[0].images),
            'numPoints': len(reconstructions[0].points3D)
        })
        
    except Exception as e:
        error_msg = str(e)
        print(f"COLMAP failed: {error_msg}", file=sys.stderr)
        send_failure(error_msg)
        sys.exit(1)

if __name__ == '__main__':
    main()
```

---

## 3D Gaussian Splatting Container

**containers/gaussian-splatting/Dockerfile**
```dockerfile
FROM nvcr.io/nvidia/pytorch:24.01-py3

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    cmake \
    ninja-build \
    && rm -rf /var/lib/apt/lists/*

# Clone and build gaussian-splatting
WORKDIR /opt
RUN git clone https://github.com/graphdeco-inria/gaussian-splatting.git --recursive

WORKDIR /opt/gaussian-splatting
RUN pip install -r requirements.txt
RUN pip install submodules/diff-gaussian-rasterization
RUN pip install submodules/simple-knn

# Install boto3 for S3 and Step Functions access
RUN pip install boto3>=1.34.0

WORKDIR /app
COPY run.py .

CMD ["python", "run.py"]
```

**containers/gaussian-splatting/run.py**
```python
"""3D Gaussian Splatting training with Step Functions Task Token support."""
import os
import sys
import subprocess
import boto3
from pathlib import Path

s3 = boto3.client('s3')
sfn = boto3.client('stepfunctions')

BUCKET = os.environ['BUCKET']
SCENE_ID = os.environ['SCENE_ID']
TASK_TOKEN = os.environ.get('SFN_TASK_TOKEN')

def send_success(output: dict):
    """Send success to Step Functions if task token is present."""
    if TASK_TOKEN:
        sfn.send_task_success(taskToken=TASK_TOKEN, output=str(output))

def send_failure(error: str):
    """Send failure to Step Functions if task token is present."""
    if TASK_TOKEN:
        sfn.send_task_failure(
            taskToken=TASK_TOKEN,
            error='TrainingError',
            cause=error
        )

def main():
    work_dir = Path(f'/tmp/{SCENE_ID}')
    input_dir = work_dir / 'input'
    output_dir = work_dir / 'output'
    
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Download COLMAP output from S3
        print(f"Downloading COLMAP output for scene {SCENE_ID}...")
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f'colmap/{SCENE_ID}/'):
            for obj in page.get('Contents', []):
                key = obj['Key']
                relative_path = key.replace(f'colmap/{SCENE_ID}/', '')
                local_path = input_dir / relative_path
                local_path.parent.mkdir(parents=True, exist_ok=True)
                s3.download_file(BUCKET, key, str(local_path))
        
        print(f"Downloaded COLMAP output to {input_dir}")
        
        # Run 3DGS training
        print("Starting 3DGS training...")
        result = subprocess.run([
            'python', '/opt/gaussian-splatting/train.py',
            '-s', str(input_dir),
            '-m', str(output_dir),
            '--iterations', '30000',
            '--save_iterations', '30000',
            '--test_iterations', '30000'
        ], check=True, capture_output=True, text=True)
        
        print(result.stdout)
        
        # Upload results to S3
        print("Uploading 3DGS output...")
        for file_path in output_dir.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(output_dir)
                s3_key = f'outputs/{SCENE_ID}/{relative_path}'
                s3.upload_file(str(file_path), BUCKET, s3_key)
        
        print(f"3DGS training complete for scene {SCENE_ID}")
        send_success({'sceneId': SCENE_ID, 'status': 'training_complete'})
        
    except subprocess.CalledProcessError as e:
        error_msg = f"Training failed: {e.stderr}"
        print(error_msg, file=sys.stderr)
        send_failure(error_msg)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        send_failure(str(e))
        sys.exit(1)

if __name__ == '__main__':
    main()
```

---

## Build and Push Scripts

**containers/build.sh**
```bash
#!/bin/bash
set -e

AWS_REGION=${AWS_REGION:-us-west-2}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_BASE

echo "Building COLMAP container..."
docker build -t splat-library-colmap ./colmap
docker tag splat-library-colmap:latest ${ECR_BASE}/splat-library-colmap:latest
docker push ${ECR_BASE}/splat-library-colmap:latest

echo "Building Gaussian Splatting container..."
docker build -t splat-library-gaussian-splatting ./gaussian-splatting
docker tag splat-library-gaussian-splatting:latest ${ECR_BASE}/splat-library-gaussian-splatting:latest
docker push ${ECR_BASE}/splat-library-gaussian-splatting:latest

echo "Done!"
```

---

## Container Requirements

**containers/colmap/requirements.txt**
```
pycolmap>=3.10.0
boto3>=1.34.0
numpy>=1.24.0
```

**containers/gaussian-splatting/requirements.txt**
```
boto3>=1.34.0
plyfile>=1.0.0
```

---

## .gitignore for containers

**containers/.gitignore**
```
# Test data
test-data/

# Docker
*.tar

# Python
__pycache__/
*.pyc
.venv/
```
