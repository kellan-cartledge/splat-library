import os
import boto3

dynamodb = boto3.resource('dynamodb')
TABLE = os.environ['SCENES_TABLE']

def handler(event, context):
    scene_id = event['sceneId']
    stage = event['stage']
    
    table = dynamodb.Table(TABLE)
    table.update_item(
        Key={'id': scene_id},
        UpdateExpression='SET processingStage = :stage',
        ExpressionAttributeValues={':stage': stage}
    )
    
    return event
