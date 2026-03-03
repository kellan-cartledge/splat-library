"""3D Gaussian Splatting training using NerfStudio's splatfacto model."""
import os
import sys
import json
import subprocess
import boto3
from pathlib import Path

s3 = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'us-west-2'))
sfn = boto3.client('stepfunctions', region_name=os.environ.get('AWS_REGION', 'us-west-2'))
dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-west-2'))

BUCKET = os.environ['BUCKET']
SCENE_ID = os.environ['SCENE_ID']
ITERATIONS = int(os.environ.get('ITERATIONS', '30000'))
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


def download_colmap_output(data_dir: Path):
    """Download COLMAP output from S3 and restructure for NerfStudio colmap dataparser.

    NerfStudio expects:  data_dir/images/  and  data_dir/colmap/sparse/0/
    S3 has:              colmap/{sceneId}/images/  and  colmap/{sceneId}/sparse/0/
    """
    colmap_sparse = data_dir / 'colmap' / 'sparse' / '0'
    images_dir = data_dir / 'images'
    colmap_sparse.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=BUCKET, Prefix=f'colmap/{SCENE_ID}/'):
        for obj in page.get('Contents', []):
            key = obj['Key']
            rel = key.replace(f'colmap/{SCENE_ID}/', '')
            if not rel or rel.endswith('/'):
                continue
            # Map S3 paths to NerfStudio layout
            if rel.startswith('images/'):
                local = images_dir / rel.replace('images/', '', 1)
            elif rel.startswith('sparse/0/'):
                local = colmap_sparse / rel.replace('sparse/0/', '', 1)
            else:
                continue  # skip database.db etc.
            local.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(BUCKET, key, str(local))

    num_images = len(list(images_dir.iterdir()))
    print(f"Downloaded {num_images} images, sparse files: {list(colmap_sparse.iterdir())}")
    return num_images


def get_downscale_factor(images_dir: Path, colmap_sparse: Path) -> int:
    """Return 2 if images exceed 800px on longest edge, else 1.
    If factor is 2, pre-downscale images in-place and patch cameras.bin."""
    from PIL import Image
    factor = 1
    for img_path in images_dir.iterdir():
        if img_path.suffix.lower() in ('.jpg', '.jpeg', '.png'):
            with Image.open(img_path) as img:
                max_dim = max(img.size)
                factor = 2 if max_dim > 800 else 1
                print(f"Image resolution: {img.size[0]}x{img.size[1]}, downscale factor: {factor}")
            break
    if factor > 1:
        print(f"Pre-downscaling images by {factor}x...")
        for img_path in images_dir.iterdir():
            if img_path.suffix.lower() in ('.jpg', '.jpeg', '.png'):
                with Image.open(img_path) as img:
                    new_size = (img.size[0] // factor, img.size[1] // factor)
                    img.resize(new_size, Image.LANCZOS).save(img_path, quality=95)
        # Patch cameras.bin to match downscaled resolution
        import struct
        cameras_bin = colmap_sparse / 'cameras.bin'
        data = cameras_bin.read_bytes()
        num_cameras = struct.unpack('<Q', data[:8])[0]
        offset = 8
        # Model param counts: {0:3, 1:4, 2:4, 3:5, 4:4, 5:5, 6:4, 7:5, 8:12, 9:8}
        param_counts = {0:3, 1:4, 2:4, 3:5, 4:4, 5:5, 6:4, 7:5, 8:12, 9:8}
        out = bytearray(data[:8])
        for _ in range(num_cameras):
            cam_id, model_id = struct.unpack('<II', data[offset:offset+8])
            w, h = struct.unpack('<QQ', data[offset+8:offset+24])
            n_params = param_counts.get(model_id, 4)
            params = struct.unpack(f'<{n_params}d', data[offset+24:offset+24+n_params*8])
            # Scale width, height, and focal/principal point params
            w //= factor
            h //= factor
            params = tuple(p / factor for p in params)
            out += struct.pack('<II', cam_id, model_id)
            out += struct.pack('<QQ', w, h)
            out += struct.pack(f'<{n_params}d', *params)
            offset += 24 + n_params * 8
        cameras_bin.write_bytes(bytes(out))
        print(f"Patched cameras.bin: {num_cameras} cameras scaled by 1/{factor}")
    return factor


def run_training(data_dir: Path, output_dir: Path, num_images: int):
    """Run ns-train splatfacto."""
    get_downscale_factor(data_dir / 'images', data_dir / 'colmap' / 'sparse' / '0')
    args = [
        'ns-train', 'splatfacto',
        '--timestamp', SCENE_ID,
        '--output-dir', str(output_dir),
        '--viewer.quit-on-train-completion', 'True',
        '--logging.local-writer.enable', 'False',
        '--logging.profiler', 'none',
        '--max-num-iterations', str(ITERATIONS),
        '--pipeline.model.use_scale_regularization', 'True',
    ]
    if num_images > 500:
        args += ['--pipeline.datamanager.cache-images', 'disk']
    # Check if points3D.bin is empty (header-only = 8 bytes); use random init if so
    points_file = data_dir / 'colmap' / 'sparse' / '0' / 'points3D.bin'
    empty_points = points_file.exists() and points_file.stat().st_size <= 8
    if empty_points:
        print("WARNING: points3D.bin is empty, using random initialization")
    args += [
        'colmap',
        '--data', str(data_dir),
    ]
    if empty_points:
        args += ['--load-3D-points', 'False']
    print(f"Running: {' '.join(args)}")
    subprocess.run(args, check=True)


def run_export(output_dir: Path, export_dir: Path):
    """Run ns-export gaussian-splat."""
    # Find the config.yml produced by ns-train
    config = output_dir / 'unnamed' / 'splatfacto' / SCENE_ID / 'config.yml'
    if not config.exists():
        # Fallback: search for any config.yml
        configs = list(output_dir.rglob('config.yml'))
        if not configs:
            raise FileNotFoundError(f"No config.yml found under {output_dir}")
        config = configs[0]
        print(f"Using fallback config: {config}")

    args = [
        'ns-export', 'gaussian-splat',
        '--load-config', str(config),
        '--output-dir', str(export_dir),
    ]
    print(f"Running: {' '.join(args)}")
    subprocess.run(args, check=True)


def upload_output(export_dir: Path):
    """Upload splat.ply to the expected S3 path."""
    ply = export_dir / 'splat.ply'
    if not ply.exists():
        raise FileNotFoundError(f"Export did not produce splat.ply in {export_dir}")
    dest = f'outputs/{SCENE_ID}/point_cloud/iteration_{ITERATIONS}/point_cloud.ply'
    print(f"Uploading {ply} → s3://{BUCKET}/{dest}")
    s3.upload_file(str(ply), BUCKET, dest)


def main():
    update_processing_stage('training_3dgs')

    data_dir = Path(f'/tmp/{SCENE_ID}')
    output_dir = data_dir / 'nerfstudio_output'
    export_dir = data_dir / 'export'

    try:
        print(f"Downloading COLMAP output for scene {SCENE_ID}...")
        num_images = download_colmap_output(data_dir)

        print(f"Starting NerfStudio splatfacto training: {ITERATIONS} iterations")
        run_training(data_dir, output_dir, num_images)

        print("Exporting gaussian splat...")
        run_export(output_dir, export_dir)

        print("Uploading output...")
        upload_output(export_dir)

        send_success({'sceneId': SCENE_ID, 'iterations': ITERATIONS, 'status': 'training_complete'})

    except Exception as e:
        import traceback
        print(f"gsplat failed: {e}", file=sys.stderr)
        traceback.print_exc()
        send_failure(str(e), 'training')
        sys.exit(1)


if __name__ == '__main__':
    main()
