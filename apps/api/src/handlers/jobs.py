import json
import os
import boto3

sfn = boto3.client('stepfunctions')
dynamodb = boto3.resource('dynamodb')

STATE_MACHINE_ARN = os.environ['STATE_MACHINE_ARN']
TABLE = os.environ['SCENES_TABLE']

def handler(event, context):
    body = json.loads(event.get('body', '{}'))
    scene_id = body['sceneId']
    
    table = dynamodb.Table(TABLE)
    table.update_item(
        Key={'id': scene_id},
        UpdateExpression='SET #s = :status',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':status': 'processing'}
    )
    
    response = sfn.start_execution(
        stateMachineArn=STATE_MACHINE_ARN,
        name=f'scene-{scene_id}',
        input=json.dumps({
            'sceneId': scene_id,
            'videoKey': body['videoKey']
        })
    )
    
    return {
        'statusCode': 202,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'sceneId': scene_id,
            'executionArn': response['executionArn'],
            'status': 'processing'
        })
    }
