import json
import os
import boto3

sfn = boto3.client('stepfunctions')
dynamodb = boto3.resource('dynamodb')

STATE_MACHINE_ARN = os.environ['STATE_MACHINE_ARN']
TABLE = os.environ['SCENES_TABLE']

# Quality-focused defaults
DEFAULTS = {
    'fps': 3,
    'iterations': 30000,
    'densifyUntilIter': 15000,
    'densificationInterval': 100
}

def handler(event, context):
    body = json.loads(event.get('body', '{}'))
    scene_id = body['sceneId']
    
    # Extract settings with defaults
    settings = {
        'fps': body.get('fps', DEFAULTS['fps']),
        'iterations': body.get('iterations', DEFAULTS['iterations']),
        'densifyUntilIter': body.get('densifyUntilIter', DEFAULTS['densifyUntilIter']),
        'densificationInterval': body.get('densificationInterval', DEFAULTS['densificationInterval'])
    }
    
    table = dynamodb.Table(TABLE)
    table.update_item(
        Key={'id': scene_id},
        UpdateExpression='SET #s = :status, settings = :settings',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':status': 'processing', ':settings': settings}
    )
    
    response = sfn.start_execution(
        stateMachineArn=STATE_MACHINE_ARN,
        name=f'scene-{scene_id}',
        input=json.dumps({
            'sceneId': scene_id,
            'videoKey': body['videoKey'],
            **settings
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
