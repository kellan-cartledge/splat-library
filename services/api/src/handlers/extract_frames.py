import os
import subprocess
import boto3
from shared.helpers import update_processing_stage

s3 = boto3.client('s3')
BUCKET = os.environ['ASSETS_BUCKET']

def handler(event, context):
    scene_id = event['sceneId']
    video_key = event['videoKey']
    fps = event.get('fps', 3)
    
    update_processing_stage(scene_id, 'extracting_frames')
    
    local_video = f'/tmp/{scene_id}.mp4'
    s3.download_file(BUCKET, video_key, local_video)
    
    frames_dir = f'/tmp/{scene_id}_frames'
    os.makedirs(frames_dir, exist_ok=True)
    
    subprocess.run([
        '/opt/bin/ffmpeg', '-i', local_video,
        '-vf', f'fps={fps}',
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
        'frameCount': frame_count,
        'fps': fps,
        'iterations': event.get('iterations', 30000),
        'densifyUntilIter': event.get('densifyUntilIter', 15000),
        'densificationInterval': event.get('densificationInterval', 100)
    }
