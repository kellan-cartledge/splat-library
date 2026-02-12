import json
import os
import time
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
table = dynamodb.Table(os.environ['SCENES_TABLE'])
BUCKET = os.environ.get('ASSETS_BUCKET')

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

def handler(event, context):
    method = event['requestContext']['http']['method']
    path = event['rawPath']
    
    if method == 'GET' and path == '/scenes':
        return list_scenes(event)
    elif method == 'GET' and path.startswith('/scenes/'):
        return get_scene(event)
    elif method == 'POST' and path == '/scenes':
        return create_scene(event)
    elif method == 'DELETE' and path.startswith('/scenes/'):
        return delete_scene(event)
    
    return {'statusCode': 404, 'body': 'Not found'}

def list_scenes(event):
    response = table.scan(
        FilterExpression='#s = :status',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':status': 'completed'}
    )
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(response['Items'], cls=DecimalEncoder)
    }

def get_scene(event):
    scene_id = event['pathParameters']['id']
    response = table.get_item(Key={'id': scene_id})
    if 'Item' not in response:
        return {'statusCode': 404, 'body': 'Scene not found'}
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(response['Item'], cls=DecimalEncoder)
    }

def create_scene(event):
    body = json.loads(event.get('body', '{}'))
    user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    
    item = {
        'id': body['sceneId'],
        'userId': user_id,
        'name': body.get('name', 'Untitled'),
        'status': 'pending',
        'processingStage': 'pending',
        'videoKey': body['videoKey'],
        'createdAt': int(time.time())
    }
    table.put_item(Item=item)
    
    return {
        'statusCode': 201,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(item)
    }


def delete_scene(event):
    scene_id = event['pathParameters']['id']
    user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    
    # Get scene and verify ownership
    response = table.get_item(Key={'id': scene_id})
    if 'Item' not in response:
        return {'statusCode': 404, 'body': 'Scene not found'}
    
    scene = response['Item']
    if scene.get('userId') != user_id:
        return {'statusCode': 403, 'body': 'Not authorized'}
    
    # Delete S3 objects
    if BUCKET:
        prefixes = [f'uploads/{scene_id}/', f'frames/{scene_id}/', f'colmap/{scene_id}/', f'outputs/{scene_id}/']
        for prefix in prefixes:
            paginator = s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
                for obj in page.get('Contents', []):
                    s3.delete_object(Bucket=BUCKET, Key=obj['Key'])
    
    # Delete DynamoDB record
    table.delete_item(Key={'id': scene_id})
    
    return {'statusCode': 204, 'body': ''}
