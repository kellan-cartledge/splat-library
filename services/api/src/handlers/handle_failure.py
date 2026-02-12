import os
import json
import boto3

dynamodb = boto3.resource('dynamodb')
TABLE = os.environ['SCENES_TABLE']

def extract_error_message(error):
    """Extract a human-readable error message from Step Functions error."""
    if not error:
        return 'Unknown error'
    
    # If it's a string, return it
    if isinstance(error, str):
        return error
    
    # Try to get the Cause field (contains Batch job details)
    cause = error.get('Cause', '')
    if cause:
        try:
            cause_obj = json.loads(cause)
            # Get status reason from Batch
            status_reason = cause_obj.get('StatusReason', '')
            # Get container exit code
            container = cause_obj.get('Container', {})
            exit_code = container.get('ExitCode')
            log_stream = container.get('LogStreamName', '')
            
            if status_reason:
                msg = status_reason
                if exit_code:
                    msg += f' (exit code {exit_code})'
                if log_stream:
                    msg += f'. Check logs: {log_stream}'
                return msg
        except (json.JSONDecodeError, TypeError):
            pass
    
    # Fallback to Error field
    return error.get('Error', str(error)[:200])

def handler(event, context):
    scene_id = event['sceneId']
    error = event.get('error', {})
    
    error_message = extract_error_message(error)
    
    table = dynamodb.Table(TABLE)
    table.update_item(
        Key={'id': scene_id},
        UpdateExpression='SET #s = :status, processingStage = :stage, #e = :error',
        ExpressionAttributeNames={'#s': 'status', '#e': 'error'},
        ExpressionAttributeValues={
            ':status': 'failed',
            ':stage': 'failed',
            ':error': error_message
        }
    )
    
    return {'sceneId': scene_id, 'status': 'failed', 'error': error_message}
