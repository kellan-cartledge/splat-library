"""3D Gaussian Splatting training."""
import os
import sys
import json
import subprocess
import boto3
from pathlib import Path

s3 = boto3.client('s3')
sfn = boto3.client('stepfunctions')

BUCKET = os.environ['BUCKET']
SCENE_ID = os.environ['SCENE_ID']
TASK_TOKEN = os.environ.get('SFN_TASK_TOKEN')

def send_success(output: dict):
    if TASK_TOKEN:
        sfn.send_task_success(taskToken=TASK_TOKEN, output=json.dumps(output))

def send_failure(error: str):
    if TASK_TOKEN:
        sfn.send_task_failure(taskToken=TASK_TOKEN, error='TrainingError', cause=error)

def main():
    work_dir = Path(f'/tmp/{SCENE_ID}')
    input_dir = work_dir / 'input'
    output_dir = work_dir / 'output'
    
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        print(f"Downloading COLMAP output for scene {SCENE_ID}...")
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f'colmap/{SCENE_ID}/'):
            for obj in page.get('Contents', []):
                key = obj['Key']
                relative_path = key.replace(f'colmap/{SCENE_ID}/', '')
                local_path = input_dir / relative_path
                local_path.parent.mkdir(parents=True, exist_ok=True)
                s3.download_file(BUCKET, key, str(local_path))
        
        print("Starting 3DGS training...")
        subprocess.run([
            'python', '/opt/gaussian-splatting/train.py',
            '-s', str(input_dir), '-m', str(output_dir),
            '--iterations', '30000', '--save_iterations', '30000', '--test_iterations', '30000'
        ], check=True)
        
        print("Uploading 3DGS output...")
        for file_path in output_dir.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(output_dir)
                s3.upload_file(str(file_path), BUCKET, f'outputs/{SCENE_ID}/{relative_path}')
        
        send_success({'sceneId': SCENE_ID, 'status': 'training_complete'})
        
    except subprocess.CalledProcessError as e:
        send_failure(f"Training failed: {e}")
        sys.exit(1)
    except Exception as e:
        send_failure(str(e))
        sys.exit(1)

if __name__ == '__main__':
    main()
