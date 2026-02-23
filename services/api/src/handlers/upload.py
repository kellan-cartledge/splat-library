import json
import os
import uuid
import boto3

s3 = boto3.client('s3')
BUCKET = os.environ['ASSETS_BUCKET']
MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50MB

def handler(event, context):
    body = json.loads(event.get('body', '{}'))
    input_type = body.get('inputType', 'video')
    scene_id = str(uuid.uuid4())

    if input_type == 'images':
        files = body.get('files', [])
        if not files:
            return _error(400, 'No files provided')

        uploads = []
        for f in files:
            key = f"frames/{scene_id}/{f['filename']}"
            url = s3.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': BUCKET,
                    'Key': key,
                    'ContentType': f.get('contentType', 'image/jpeg')
                },
                ExpiresIn=3600
            )
            uploads.append({'filename': f['filename'], 'uploadUrl': url, 'key': key})

        return _json(200, {'sceneId': scene_id, 'uploads': uploads})

    # Default: single video upload
    filename = body.get('filename', 'video.mp4')
    content_type = body.get('contentType', 'video/mp4')
    key = f"uploads/{scene_id}/{filename}"

    presigned = s3.generate_presigned_url(
        'put_object',
        Params={'Bucket': BUCKET, 'Key': key, 'ContentType': content_type},
        ExpiresIn=3600
    )

    return _json(200, {'sceneId': scene_id, 'uploadUrl': presigned, 'key': key})


def _json(status, body):
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(body)
    }

def _error(status, msg):
    return _json(status, {'error': msg})
