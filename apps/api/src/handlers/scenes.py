import json
import os
import time
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['SCENES_TABLE'])

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
        'videoKey': body['videoKey'],
        'createdAt': int(time.time())
    }
    table.put_item(Item=item)
    
    return {
        'statusCode': 201,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(item)
    }
