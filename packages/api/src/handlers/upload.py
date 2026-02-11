import json
import os
import uuid
import boto3

s3 = boto3.client('s3')
BUCKET = os.environ['ASSETS_BUCKET']

def handler(event, context):
    body = json.loads(event.get('body', '{}'))
    filename = body.get('filename', 'video.mp4')
    content_type = body.get('contentType', 'video/mp4')
    
    scene_id = str(uuid.uuid4())
    key = f"uploads/{scene_id}/{filename}"
    
    presigned = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': BUCKET,
            'Key': key,
            'ContentType': content_type
        },
        ExpiresIn=3600
    )
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'sceneId': scene_id,
            'uploadUrl': presigned,
            'key': key
        })
    }
