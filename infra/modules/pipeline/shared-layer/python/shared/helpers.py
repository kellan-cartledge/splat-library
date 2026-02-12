import os
import boto3

dynamodb = boto3.resource('dynamodb')

def update_processing_stage(scene_id: str, stage: str, table_name: str = None):
    """Update the processing stage for a scene in DynamoDB."""
    table_name = table_name or os.environ.get('SCENES_TABLE')
    table = dynamodb.Table(table_name)
    table.update_item(
        Key={'id': scene_id},
        UpdateExpression='SET processingStage = :stage',
        ExpressionAttributeValues={':stage': stage}
    )
