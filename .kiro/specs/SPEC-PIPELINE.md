# Splat Library - Pipeline Specification

## Step Functions State Machine (with Task Tokens)

The pipeline uses Task Tokens to wait for Batch job completion. This ensures Step Functions properly waits for long-running container jobs.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Extract    │───▶│   COLMAP    │───▶│    3DGS     │───▶│   Convert   │
│  Frames     │    │   (Batch)   │    │   (Batch)   │    │  + Notify   │
│  (Lambda)   │    │ Task Token  │    │ Task Token  │    │  (Lambda)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Terraform - Pipeline Module

**infra/modules/pipeline/variables.tf**
```hcl
variable "project" {}
variable "environment" {}
variable "common_tags" {
  type = map(string)
}
variable "assets_bucket" {}
variable "assets_bucket_arn" {}
variable "scenes_table" {}
variable "scenes_table_arn" {}
```

**infra/modules/pipeline/main.tf**
```hcl
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
}

# Step Functions State Machine with Task Tokens
resource "aws_sfn_state_machine" "pipeline" {
  name     = "${var.project}-pipeline"
  role_arn = aws_iam_role.sfn.arn
  tags     = var.common_tags

  definition = jsonencode({
    Comment = "3DGS Processing Pipeline"
    StartAt = "ExtractFrames"
    States = {
      ExtractFrames = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.extract_frames.arn
          Payload = {
            "sceneId.$"  = "$.sceneId"
            "videoKey.$" = "$.videoKey"
          }
        }
        ResultPath = "$.extractResult"
        Next       = "RunCOLMAP"
        Catch = [{
          ErrorEquals = ["States.ALL"]
          Next        = "HandleFailure"
          ResultPath  = "$.error"
        }]
      }
      RunCOLMAP = {
        Type     = "Task"
        Resource = "arn:aws:states:::batch:submitJob.sync"
        Parameters = {
          JobName       = "colmap"
          JobDefinition = aws_batch_job_definition.colmap.arn
          JobQueue      = aws_batch_job_queue.cpu.arn
          ContainerOverrides = {
            Environment = [
              { Name = "SCENE_ID", "Value.$" = "$.sceneId" },
              { Name = "BUCKET", Value = var.assets_bucket },
              { Name = "SFN_TASK_TOKEN", "Value.$" = "$$.Task.Token" }
            ]
          }
        }
        ResultPath = "$.colmapResult"
        Next       = "Run3DGS"
        Catch = [{
          ErrorEquals = ["States.ALL"]
          Next        = "HandleFailure"
          ResultPath  = "$.error"
        }]
      }
      Run3DGS = {
        Type     = "Task"
        Resource = "arn:aws:states:::batch:submitJob.sync"
        Parameters = {
          JobName       = "gaussian-splatting"
          JobDefinition = aws_batch_job_definition.gaussian_splatting.arn
          JobQueue      = aws_batch_job_queue.gpu.arn
          ContainerOverrides = {
            Environment = [
              { Name = "SCENE_ID", "Value.$" = "$.sceneId" },
              { Name = "BUCKET", Value = var.assets_bucket },
              { Name = "SFN_TASK_TOKEN", "Value.$" = "$$.Task.Token" }
            ]
          }
        }
        ResultPath = "$.trainingResult"
        Next       = "ConvertAndNotify"
        Catch = [{
          ErrorEquals = ["States.ALL"]
          Next        = "HandleFailure"
          ResultPath  = "$.error"
        }]
      }
      ConvertAndNotify = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.convert.arn
          Payload = {
            "sceneId.$" = "$.sceneId"
          }
        }
        End = true
      }
      HandleFailure = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.handle_failure.arn
          Payload = {
            "sceneId.$" = "$.sceneId"
            "error.$"   = "$.error"
          }
        }
        End = true
      }
    }
  })
}

# ECR Repositories
resource "aws_ecr_repository" "colmap" {
  name = "${var.project}-colmap"
  tags = var.common_tags

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "gaussian_splatting" {
  name = "${var.project}-gaussian-splatting"
  tags = var.common_tags

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Batch Compute Environments
resource "aws_batch_compute_environment" "cpu" {
  compute_environment_name = "${var.project}-cpu"
  type                     = "MANAGED"
  service_role             = aws_iam_role.batch_service.arn
  tags                     = var.common_tags

  compute_resources {
    type                = "SPOT"
    allocation_strategy = "SPOT_PRICE_CAPACITY_OPTIMIZED"
    min_vcpus           = 0
    max_vcpus           = 16
    instance_type       = ["c6i.2xlarge", "c6i.4xlarge"]
    subnets             = aws_subnet.private[*].id
    security_group_ids  = [aws_security_group.batch.id]
    instance_role       = aws_iam_instance_profile.batch.arn

    tags = var.common_tags
  }
}

resource "aws_batch_compute_environment" "gpu" {
  compute_environment_name = "${var.project}-gpu"
  type                     = "MANAGED"
  service_role             = aws_iam_role.batch_service.arn
  tags                     = var.common_tags

  compute_resources {
    type                = "SPOT"
    allocation_strategy = "SPOT_PRICE_CAPACITY_OPTIMIZED"
    min_vcpus           = 0
    max_vcpus           = 8
    instance_type       = ["g5.xlarge", "g6.xlarge"]
    subnets             = aws_subnet.private[*].id
    security_group_ids  = [aws_security_group.batch.id]
    instance_role       = aws_iam_instance_profile.batch.arn

    tags = var.common_tags
  }
}

# Job Queues
resource "aws_batch_job_queue" "cpu" {
  name     = "${var.project}-cpu-queue"
  state    = "ENABLED"
  priority = 1
  tags     = var.common_tags

  compute_environment_order {
    order               = 1
    compute_environment = aws_batch_compute_environment.cpu.arn
  }
}

resource "aws_batch_job_queue" "gpu" {
  name     = "${var.project}-gpu-queue"
  state    = "ENABLED"
  priority = 1
  tags     = var.common_tags

  compute_environment_order {
    order               = 1
    compute_environment = aws_batch_compute_environment.gpu.arn
  }
}

# Job Definitions
resource "aws_batch_job_definition" "colmap" {
  name = "${var.project}-colmap"
  type = "container"
  tags = var.common_tags

  container_properties = jsonencode({
    image      = "${aws_ecr_repository.colmap.repository_url}:latest"
    vcpus      = 8
    memory     = 16384
    command    = ["python", "run.py"]
    jobRoleArn = aws_iam_role.batch_job.arn
    environment = [
      { name = "BUCKET", value = var.assets_bucket }
    ]
  })
}

resource "aws_batch_job_definition" "gaussian_splatting" {
  name = "${var.project}-gaussian-splatting"
  type = "container"
  tags = var.common_tags

  container_properties = jsonencode({
    image      = "${aws_ecr_repository.gaussian_splatting.repository_url}:latest"
    vcpus      = 4
    memory     = 16384
    command    = ["python", "run.py"]
    jobRoleArn = aws_iam_role.batch_job.arn
    resourceRequirements = [
      { type = "GPU", value = "1" }
    ]
    environment = [
      { name = "BUCKET", value = var.assets_bucket }
    ]
  })
}

# Lambda Functions (Python 3.13)
resource "aws_lambda_function" "extract_frames" {
  filename         = data.archive_file.lambda_extract.output_path
  function_name    = "${var.project}-extract-frames"
  role             = aws_iam_role.lambda.arn
  handler          = "extract_frames.handler"
  runtime          = "python3.13"
  timeout          = 300
  memory_size      = 1024
  source_code_hash = data.archive_file.lambda_extract.output_base64sha256
  tags             = var.common_tags

  layers = [var.ffmpeg_layer_arn]

  environment {
    variables = {
      ASSETS_BUCKET = var.assets_bucket
    }
  }
}

resource "aws_lambda_function" "convert" {
  filename         = data.archive_file.lambda_convert.output_path
  function_name    = "${var.project}-convert"
  role             = aws_iam_role.lambda.arn
  handler          = "convert.handler"
  runtime          = "python3.13"
  timeout          = 300
  memory_size      = 1024
  source_code_hash = data.archive_file.lambda_convert.output_base64sha256
  tags             = var.common_tags

  environment {
    variables = {
      ASSETS_BUCKET = var.assets_bucket
      SCENES_TABLE  = var.scenes_table
    }
  }
}

resource "aws_lambda_function" "handle_failure" {
  filename         = data.archive_file.lambda_failure.output_path
  function_name    = "${var.project}-handle-failure"
  role             = aws_iam_role.lambda.arn
  handler          = "handle_failure.handler"
  runtime          = "python3.13"
  timeout          = 30
  source_code_hash = data.archive_file.lambda_failure.output_base64sha256
  tags             = var.common_tags

  environment {
    variables = {
      SCENES_TABLE = var.scenes_table
    }
  }
}
```

**infra/modules/pipeline/vpc.tf**
```hcl
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = merge(var.common_tags, { Name = "${var.project}-vpc" })
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = merge(var.common_tags, { Name = "${var.project}-private-${count.index + 1}" })
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.100.0/24"
  map_public_ip_on_launch = true
  tags = merge(var.common_tags, { Name = "${var.project}-public" })
}

# Security Group for AWS Batch
# AWS Batch requires outbound access to: ECR, S3, CloudWatch Logs, Step Functions
resource "aws_security_group" "batch" {
  name        = "${var.project}-batch-sg"
  description = "Security group for Batch compute environments"
  vpc_id      = aws_vpc.main.id
  tags        = var.common_tags

  # Allow inbound traffic only from within the VPC
  ingress {
    description = "Allow all traffic from within VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  # Allow all outbound traffic (required for AWS Batch)
  egress {
    description = "Allow all outbound traffic for AWS service access"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Optional: VPC Endpoints for enhanced security (reduces NAT Gateway costs too)
# Uncomment for production to restrict egress to specific AWS services
# resource "aws_vpc_endpoint" "s3" {
#   vpc_id       = aws_vpc.main.id
#   service_name = "com.amazonaws.${local.region}.s3"
#   vpc_endpoint_type = "Gateway"
#   route_table_ids = [aws_route_table.private.id]
#   tags = var.common_tags
# }
# 
# resource "aws_vpc_endpoint" "ecr_api" {
#   vpc_id              = aws_vpc.main.id
#   service_name        = "com.amazonaws.${local.region}.ecr.api"
#   vpc_endpoint_type   = "Interface"
#   subnet_ids          = aws_subnet.private[*].id
#   security_group_ids  = [aws_security_group.vpc_endpoints.id]
#   private_dns_enabled = true
#   tags = var.common_tags
# }
# 
# resource "aws_vpc_endpoint" "ecr_dkr" {
#   vpc_id              = aws_vpc.main.id
#   service_name        = "com.amazonaws.${local.region}.ecr.dkr"
#   vpc_endpoint_type   = "Interface"
#   subnet_ids          = aws_subnet.private[*].id
#   security_group_ids  = [aws_security_group.vpc_endpoints.id]
#   private_dns_enabled = true
#   tags = var.common_tags
# }
# 
# resource "aws_vpc_endpoint" "logs" {
#   vpc_id              = aws_vpc.main.id
#   service_name        = "com.amazonaws.${local.region}.logs"
#   vpc_endpoint_type   = "Interface"
#   subnet_ids          = aws_subnet.private[*].id
#   security_group_ids  = [aws_security_group.vpc_endpoints.id]
#   private_dns_enabled = true
#   tags = var.common_tags
# }

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = var.common_tags
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public.id
  tags          = var.common_tags
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = var.common_tags
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.common_tags, { Name = "${var.project}-public-rt" })

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = merge(var.common_tags, { Name = "${var.project}-private-rt" })

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
```

**infra/modules/pipeline/iam.tf**
```hcl
# Step Functions Role
resource "aws_iam_role" "sfn" {
  name = "${var.project}-sfn-role"
  tags = var.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "states.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "sfn" {
  name = "${var.project}-sfn-policy"
  role = aws_iam_role.sfn.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = [
          aws_lambda_function.extract_frames.arn,
          aws_lambda_function.convert.arn,
          aws_lambda_function.handle_failure.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "batch:SubmitJob",
          "batch:DescribeJobs",
          "batch:TerminateJob"
        ]
        Resource = [
          aws_batch_job_definition.colmap.arn,
          aws_batch_job_definition.gaussian_splatting.arn,
          aws_batch_job_queue.cpu.arn,
          aws_batch_job_queue.gpu.arn,
          "arn:aws:batch:${local.region}:${local.account_id}:job/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutTargets",
          "events:PutRule",
          "events:DescribeRule"
        ]
        Resource = "arn:aws:events:${local.region}:${local.account_id}:rule/StepFunctions*"
      }
    ]
  })
}

# Lambda Role
resource "aws_iam_role" "lambda" {
  name = "${var.project}-lambda-role"
  tags = var.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${var.project}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/lambda/${var.project}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.assets_bucket_arn,
          "${var.assets_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          var.scenes_table_arn,
          "${var.scenes_table_arn}/index/*"
        ]
      }
    ]
  })
}

# Batch Service Role
resource "aws_iam_role" "batch_service" {
  name = "${var.project}-batch-service-role"
  tags = var.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "batch.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "batch_service" {
  role       = aws_iam_role.batch_service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBatchServiceRole"
}

# Batch Instance Role
resource "aws_iam_role" "batch_instance" {
  name = "${var.project}-batch-instance-role"
  tags = var.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "batch_instance_ecs" {
  role       = aws_iam_role.batch_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "batch" {
  name = "${var.project}-batch-instance-profile"
  role = aws_iam_role.batch_instance.name
  tags = var.common_tags
}

# Batch Job Role (for containers)
resource "aws_iam_role" "batch_job" {
  name = "${var.project}-batch-job-role"
  tags = var.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "batch_job" {
  name = "${var.project}-batch-job-policy"
  role = aws_iam_role.batch_job.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.assets_bucket_arn,
          "${var.assets_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "states:SendTaskSuccess",
          "states:SendTaskFailure",
          "states:SendTaskHeartbeat"
        ]
        Resource = aws_sfn_state_machine.pipeline.arn
      }
    ]
  })
}
```

## Lambda Handlers (Python 3.13)

**apps/api/src/handlers/extract_frames.py**
```python
import json
import os
import subprocess
import boto3

s3 = boto3.client('s3')
BUCKET = os.environ['ASSETS_BUCKET']

def handler(event, context):
    scene_id = event['sceneId']
    video_key = event['videoKey']
    
    local_video = f'/tmp/{scene_id}.mp4'
    s3.download_file(BUCKET, video_key, local_video)
    
    frames_dir = f'/tmp/{scene_id}_frames'
    os.makedirs(frames_dir, exist_ok=True)
    
    subprocess.run([
        'ffmpeg', '-i', local_video,
        '-vf', 'fps=2',
        '-q:v', '2',
        f'{frames_dir}/frame_%04d.jpg'
    ], check=True)
    
    frame_count = 0
    for filename in os.listdir(frames_dir):
        s3.upload_file(
            f'{frames_dir}/{filename}',
            BUCKET,
            f'frames/{scene_id}/{filename}'
        )
        frame_count += 1
    
    return {
        'sceneId': scene_id,
        'framesPrefix': f'frames/{scene_id}/',
        'frameCount': frame_count
    }
```

**apps/api/src/handlers/convert.py**
```python
import json
import os
import boto3
import time

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
BUCKET = os.environ['ASSETS_BUCKET']
TABLE = os.environ['SCENES_TABLE']

def handler(event, context):
    scene_id = event['sceneId']
    table = dynamodb.Table(TABLE)
    
    ply_key = f'outputs/{scene_id}/point_cloud/iteration_30000/point_cloud.ply'
    local_ply = f'/tmp/{scene_id}.ply'
    s3.download_file(BUCKET, ply_key, local_ply)
    
    local_splat = f'/tmp/{scene_id}.splat'
    convert_ply_to_splat(local_ply, local_splat)
    
    splat_key = f'outputs/{scene_id}/scene.splat'
    s3.upload_file(local_splat, BUCKET, splat_key)
    
    thumbnail_key = f'outputs/{scene_id}/thumbnail.jpg'
    s3.copy_object(
        Bucket=BUCKET,
        CopySource=f'{BUCKET}/frames/{scene_id}/frame_0001.jpg',
        Key=thumbnail_key
    )
    
    table.update_item(
        Key={'id': scene_id},
        UpdateExpression='SET #s = :status, splatKey = :splat, thumbnailKey = :thumb, completedAt = :time',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={
            ':status': 'completed',
            ':splat': splat_key,
            ':thumb': thumbnail_key,
            ':time': int(time.time())
        }
    )
    
    return {'sceneId': scene_id, 'status': 'completed', 'splatKey': splat_key}

def convert_ply_to_splat(input_path: str, output_path: str):
    import struct
    import numpy as np
    from plyfile import PlyData
    
    plydata = PlyData.read(input_path)
    vertex = plydata['vertex']
    
    positions = np.stack([vertex['x'], vertex['y'], vertex['z']], axis=-1)
    scales = np.stack([vertex['scale_0'], vertex['scale_1'], vertex['scale_2']], axis=-1)
    rotations = np.stack([vertex['rot_0'], vertex['rot_1'], vertex['rot_2'], vertex['rot_3']], axis=-1)
    opacity = vertex['opacity']
    sh_dc = np.stack([vertex['f_dc_0'], vertex['f_dc_1'], vertex['f_dc_2']], axis=-1)
    
    scales_sum = np.exp(scales).sum(axis=-1)
    sort_indices = np.argsort(-scales_sum)
    
    with open(output_path, 'wb') as f:
        for idx in sort_indices:
            f.write(struct.pack('fff', *positions[idx]))
            f.write(struct.pack('fff', *np.exp(scales[idx])))
            color = (sh_dc[idx] * 0.28209479177387814 + 0.5).clip(0, 1)
            alpha = 1 / (1 + np.exp(-opacity[idx]))
            f.write(struct.pack('BBBB', int(color[0]*255), int(color[1]*255), int(color[2]*255), int(alpha*255)))
            rot = rotations[idx] / np.linalg.norm(rotations[idx])
            f.write(struct.pack('BBBB', *[int((r*0.5+0.5)*255) for r in rot]))
```

**apps/api/src/handlers/handle_failure.py**
```python
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
```
