variable "project" {}
variable "environment" {}
variable "common_tags" { type = map(string) }
variable "assets_bucket" {}
variable "assets_bucket_arn" {}
variable "scenes_table" {}
variable "scenes_table_arn" {}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" { state = "available" }

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
}

# VPC
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

resource "aws_security_group" "batch" {
  name        = "${var.project}-batch-sg"
  description = "Security group for Batch compute"
  vpc_id      = aws_vpc.main.id
  tags        = var.common_tags

  ingress {
    description = "Allow traffic from within VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = var.common_tags
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = var.common_tags
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public.id
  tags          = var.common_tags
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

# ECR
resource "aws_ecr_repository" "colmap" {
  name = "${var.project}-colmap"
  tags = var.common_tags
  image_scanning_configuration { scan_on_push = true }
}

resource "aws_ecr_repository" "gaussian_splatting" {
  name = "${var.project}-gaussian-splatting"
  tags = var.common_tags
  image_scanning_configuration { scan_on_push = true }
}

# Batch
resource "aws_batch_compute_environment" "cpu" {
  name         = "${var.project}-cpu"
  type         = "MANAGED"
  service_role = aws_iam_role.batch_service.arn
  tags         = var.common_tags

  compute_resources {
    type                = "SPOT"
    allocation_strategy = "SPOT_PRICE_CAPACITY_OPTIMIZED"
    min_vcpus           = 0
    max_vcpus           = 16
    instance_type       = ["c6i.2xlarge", "c6i.4xlarge"]
    subnets             = aws_subnet.private[*].id
    security_group_ids  = [aws_security_group.batch.id]
    instance_role       = aws_iam_instance_profile.batch.arn
    spot_iam_fleet_role = aws_iam_role.spot_fleet.arn
    tags                = var.common_tags
  }

  depends_on = [aws_iam_role_policy_attachment.batch_service]
}

resource "aws_batch_compute_environment" "gpu" {
  name         = "${var.project}-gpu"
  type         = "MANAGED"
  service_role = aws_iam_role.batch_service.arn
  tags         = var.common_tags

  compute_resources {
    type                = "SPOT"
    allocation_strategy = "SPOT_PRICE_CAPACITY_OPTIMIZED"
    min_vcpus           = 0
    max_vcpus           = 8
    instance_type       = ["g5.xlarge", "g6.xlarge"]
    subnets             = aws_subnet.private[*].id
    security_group_ids  = [aws_security_group.batch.id]
    instance_role       = aws_iam_instance_profile.batch.arn
    spot_iam_fleet_role = aws_iam_role.spot_fleet.arn
    tags                = var.common_tags
  }

  depends_on = [aws_iam_role_policy_attachment.batch_service]
}

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
    environment = [{ name = "BUCKET", value = var.assets_bucket }]
  })
}

resource "aws_batch_job_definition" "gaussian_splatting" {
  name = "${var.project}-gaussian-splatting"
  type = "container"
  tags = var.common_tags

  container_properties = jsonencode({
    image                = "${aws_ecr_repository.gaussian_splatting.repository_url}:latest"
    vcpus                = 4
    memory               = 16384
    command              = ["python", "run.py"]
    jobRoleArn           = aws_iam_role.batch_job.arn
    resourceRequirements = [{ type = "GPU", value = "1" }]
    environment          = [{ name = "BUCKET", value = var.assets_bucket }]
  })
}

# Lambda Functions for Pipeline
data "archive_file" "extract_frames" {
  type        = "zip"
  source_file = "${path.module}/../../../apps/api/src/handlers/extract_frames.py"
  output_path = "${path.module}/extract_frames.zip"
}

data "archive_file" "convert" {
  type        = "zip"
  source_file = "${path.module}/../../../apps/api/src/handlers/convert.py"
  output_path = "${path.module}/convert.zip"
}

data "archive_file" "handle_failure" {
  type        = "zip"
  source_file = "${path.module}/../../../apps/api/src/handlers/handle_failure.py"
  output_path = "${path.module}/handle_failure.zip"
}

resource "aws_iam_role" "lambda" {
  name = "${var.project}-pipeline-lambda-role"
  tags = var.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${var.project}-pipeline-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/lambda/${var.project}-*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:CopyObject"]
        Resource = [var.assets_bucket_arn, "${var.assets_bucket_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]
        Resource = var.scenes_table_arn
      }
    ]
  })
}

resource "aws_lambda_function" "extract_frames" {
  filename         = data.archive_file.extract_frames.output_path
  function_name    = "${var.project}-extract-frames"
  role             = aws_iam_role.lambda.arn
  handler          = "extract_frames.handler"
  runtime          = "python3.13"
  timeout          = 300
  memory_size      = 1024
  source_code_hash = data.archive_file.extract_frames.output_base64sha256
  tags             = var.common_tags

  environment {
    variables = { ASSETS_BUCKET = var.assets_bucket }
  }
}

resource "aws_lambda_function" "convert" {
  filename         = data.archive_file.convert.output_path
  function_name    = "${var.project}-convert"
  role             = aws_iam_role.lambda.arn
  handler          = "convert.handler"
  runtime          = "python3.13"
  timeout          = 300
  memory_size      = 1024
  source_code_hash = data.archive_file.convert.output_base64sha256
  tags             = var.common_tags

  environment {
    variables = {
      ASSETS_BUCKET = var.assets_bucket
      SCENES_TABLE  = var.scenes_table
    }
  }
}

resource "aws_lambda_function" "handle_failure" {
  filename         = data.archive_file.handle_failure.output_path
  function_name    = "${var.project}-handle-failure"
  role             = aws_iam_role.lambda.arn
  handler          = "handle_failure.handler"
  runtime          = "python3.13"
  timeout          = 30
  source_code_hash = data.archive_file.handle_failure.output_base64sha256
  tags             = var.common_tags

  environment {
    variables = { SCENES_TABLE = var.scenes_table }
  }
}

# Step Functions
resource "aws_iam_role" "sfn" {
  name = "${var.project}-sfn-role"
  tags = var.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
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
        Effect   = "Allow"
        Action   = ["batch:SubmitJob", "batch:DescribeJobs", "batch:TerminateJob"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutTargets", "events:PutRule", "events:DescribeRule"]
        Resource = "arn:aws:events:${local.region}:${local.account_id}:rule/StepFunctions*"
      }
    ]
  })
}

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
          "Payload.$"  = "$"
        }
        ResultPath = "$.extractResult"
        Next       = "RunCOLMAP"
        Catch      = [{ ErrorEquals = ["States.ALL"], Next = "HandleFailure", ResultPath = "$.error" }]
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
              { Name = "BUCKET", Value = var.assets_bucket }
            ]
          }
        }
        ResultPath = "$.colmapResult"
        Next       = "Run3DGS"
        Catch      = [{ ErrorEquals = ["States.ALL"], Next = "HandleFailure", ResultPath = "$.error" }]
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
              { Name = "BUCKET", Value = var.assets_bucket }
            ]
          }
        }
        ResultPath = "$.trainingResult"
        Next       = "ConvertAndNotify"
        Catch      = [{ ErrorEquals = ["States.ALL"], Next = "HandleFailure", ResultPath = "$.error" }]
      }
      ConvertAndNotify = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.convert.arn
          "Payload.$"  = "$"
        }
        End = true
      }
      HandleFailure = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.handle_failure.arn
          "Payload.$"  = "$"
        }
        End = true
      }
    }
  })
}

output "state_machine_arn" {
  value = aws_sfn_state_machine.pipeline.arn
}

output "colmap_ecr_url" {
  value = aws_ecr_repository.colmap.repository_url
}

output "gaussian_splatting_ecr_url" {
  value = aws_ecr_repository.gaussian_splatting.repository_url
}
