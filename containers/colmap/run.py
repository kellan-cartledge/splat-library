"""COLMAP processing using pycolmap Python bindings."""
import os
import sys
import json
import boto3
import pycolmap
from pathlib import Path

s3 = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'us-west-2'))
sfn = boto3.client('stepfunctions', region_name=os.environ.get('AWS_REGION', 'us-west-2'))
dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-west-2'))

BUCKET = os.environ['BUCKET']
SCENE_ID = os.environ['SCENE_ID']
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

def send_failure(error: str, stage: str = 'running_colmap'):
    update_processing_stage('failed')
    if SCENES_TABLE:
        table = dynamodb.Table(SCENES_TABLE)
        table.update_item(
            Key={'id': SCENE_ID},
            UpdateExpression='SET #e = :error',
            ExpressionAttributeNames={'#e': 'error'},
            ExpressionAttributeValues={':error': f'COLMAP failed at {stage}: {error}'}
        )
    if TASK_TOKEN:
        sfn.send_task_failure(taskToken=TASK_TOKEN, error='COLMAPError', cause=error)

def main():
    update_processing_stage('running_colmap')
    
    work_dir = Path(f'/tmp/{SCENE_ID}')
    image_dir = work_dir / 'images'
    output_dir = work_dir / 'sparse'
    database_path = work_dir / 'database.db'
    
    image_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        print(f"Downloading frames for scene {SCENE_ID}...")
        paginator = s3.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=BUCKET, Prefix=f'frames/{SCENE_ID}/'):
            for obj in page.get('Contents', []):
                key = obj['Key']
                filename = os.path.basename(key)
                if filename:
                    s3.download_file(BUCKET, key, str(image_dir / filename))
        
        num_images = len(list(image_dir.glob('*.jpg')))
        print(f"Downloaded {num_images} frames")
        
        if num_images < 3:
            raise RuntimeError(f"Not enough images: {num_images}")
        
        print("Running feature extraction...")
        try:
            pycolmap.extract_features(
                database_path=database_path,
                image_path=image_dir,
                camera_model='SIMPLE_PINHOLE'
            )
        except Exception as e:
            send_failure(str(e), 'feature extraction')
            sys.exit(1)
        
        print("Running feature matching...")
        try:
            pycolmap.match_exhaustive(database_path=database_path)
        except Exception as e:
            send_failure(str(e), 'feature matching')
            sys.exit(1)
        
        print("Running incremental mapping...")
        try:
            reconstructions = pycolmap.incremental_mapping(
                database_path=database_path, image_path=image_dir, output_path=output_dir
            )
            if not reconstructions:
                raise RuntimeError("No valid reconstruction produced")
        except Exception as e:
            send_failure(str(e), 'structure from motion')
            sys.exit(1)
        
        print(f"Reconstruction complete: {len(reconstructions[0].images)} images, {len(reconstructions[0].points3D)} points")
        
        print("Uploading COLMAP output...")
        for file_path in work_dir.rglob('*'):
            if file_path.is_file():
                relative_path = file_path.relative_to(work_dir)
                s3.upload_file(str(file_path), BUCKET, f'colmap/{SCENE_ID}/{relative_path}')
        
        send_success({'sceneId': SCENE_ID, 'status': 'colmap_complete'})
        
    except Exception as e:
        print(f"COLMAP failed: {e}", file=sys.stderr)
        send_failure(str(e), 'initialization')
        sys.exit(1)

if __name__ == '__main__':
    main()
