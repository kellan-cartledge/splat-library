import os
import boto3

dynamodb = boto3.resource('dynamodb')
TABLE = os.environ['SCENES_TABLE']

def handler(event, context):
    scene_id = event['sceneId']
    error = event.get('error', {})
    
    table = dynamodb.Table(TABLE)
    table.update_item(
        Key={'id': scene_id},
        UpdateExpression='SET #s = :status, #e = :error',
        ExpressionAttributeNames={'#s': 'status', '#e': 'error'},
        ExpressionAttributeValues={
            ':status': 'failed',
            ':error': str(error)
        }
    )
    
    return {'sceneId': scene_id, 'status': 'failed', 'error': str(error)}
