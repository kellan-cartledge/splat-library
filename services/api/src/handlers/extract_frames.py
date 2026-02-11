import os
import subprocess
import boto3

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
BUCKET = os.environ['ASSETS_BUCKET']
TABLE = os.environ['SCENES_TABLE']

def handler(event, context):
    scene_id = event['sceneId']
    video_key = event['videoKey']
    
    # Update processing stage
    table = dynamodb.Table(TABLE)
    table.update_item(
        Key={'id': scene_id},
        UpdateExpression='SET processingStage = :stage',
        ExpressionAttributeValues={':stage': 'extracting_frames'}
    )
    
    local_video = f'/tmp/{scene_id}.mp4'
    s3.download_file(BUCKET, video_key, local_video)
    
    frames_dir = f'/tmp/{scene_id}_frames'
    os.makedirs(frames_dir, exist_ok=True)
    
    subprocess.run([
        '/opt/bin/ffmpeg', '-i', local_video,
        '-vf', 'fps=2',
        '-q:v', '2',
        f'{frames_dir}/frame_%04d.jpg'
    ], check=True)
    
    frame_count = 0
    for filename in os.listdir(frames_dir):
        s3.upload_file(
            f'{frames_dir}/{filename}',
            BUCKET,
            f'frames/{scene_id}/{filename}'
        )
        frame_count += 1
    
    return {
        'sceneId': scene_id,
        'framesPrefix': f'frames/{scene_id}/',
        'frameCount': frame_count
    }
