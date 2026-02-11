import os
import struct
import time
import boto3
import numpy as np
from plyfile import PlyData

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
BUCKET = os.environ['ASSETS_BUCKET']
TABLE = os.environ['SCENES_TABLE']

def handler(event, context):
    scene_id = event['sceneId']
    iterations = event.get('iterations', 7000)
    table = dynamodb.Table(TABLE)
    
    ply_key = f'outputs/{scene_id}/point_cloud/iteration_{iterations}/point_cloud.ply'
    local_ply = f'/tmp/{scene_id}.ply'
    s3.download_file(BUCKET, ply_key, local_ply)
    
    local_splat = f'/tmp/{scene_id}.splat'
    convert_ply_to_splat(local_ply, local_splat)
    
    splat_key = f'outputs/{scene_id}/scene.splat'
    s3.upload_file(local_splat, BUCKET, splat_key)
    
    thumbnail_key = f'outputs/{scene_id}/thumbnail.jpg'
    s3.copy_object(
        Bucket=BUCKET,
        CopySource=f'{BUCKET}/frames/{scene_id}/frame_0001.jpg',
        Key=thumbnail_key
    )
    
    table.update_item(
        Key={'id': scene_id},
        UpdateExpression='SET #s = :status, splatKey = :splat, thumbnailKey = :thumb, completedAt = :time',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={
            ':status': 'completed',
            ':splat': splat_key,
            ':thumb': thumbnail_key,
            ':time': int(time.time())
        }
    )
    
    return {'sceneId': scene_id, 'status': 'completed', 'splatKey': splat_key}

def convert_ply_to_splat(input_path: str, output_path: str):
    plydata = PlyData.read(input_path)
    vertex = plydata['vertex']
    
    positions = np.stack([vertex['x'], vertex['y'], vertex['z']], axis=-1)
    scales = np.stack([vertex['scale_0'], vertex['scale_1'], vertex['scale_2']], axis=-1)
    rotations = np.stack([vertex['rot_0'], vertex['rot_1'], vertex['rot_2'], vertex['rot_3']], axis=-1)
    opacity = vertex['opacity']
    sh_dc = np.stack([vertex['f_dc_0'], vertex['f_dc_1'], vertex['f_dc_2']], axis=-1)
    
    scales_sum = np.exp(scales).sum(axis=-1)
    sort_indices = np.argsort(-scales_sum)
    
    with open(output_path, 'wb') as f:
        for idx in sort_indices:
            f.write(struct.pack('fff', *positions[idx]))
            f.write(struct.pack('fff', *np.exp(scales[idx])))
            color = (sh_dc[idx] * 0.28209479177387814 + 0.5).clip(0, 1)
            alpha = 1 / (1 + np.exp(-opacity[idx]))
            f.write(struct.pack('BBBB', int(color[0]*255), int(color[1]*255), int(color[2]*255), int(alpha*255)))
            rot = rotations[idx] / np.linalg.norm(rotations[idx])
            f.write(struct.pack('BBBB', *[int((r*0.5+0.5)*255) for r in rot]))
