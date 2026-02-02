variable "project" {}
variable "environment" {}
variable "common_tags" { type = map(string) }
variable "cognito_user_pool_id" {}
variable "cognito_client_id" {}
variable "assets_bucket" {}
variable "assets_bucket_arn" {}
variable "scenes_table" {}
variable "scenes_table_arn" {}
variable "state_machine_arn" {}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
}

# API Gateway
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"
  tags          = var.common_tags

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
  tags        = var.common_tags
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${local.region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# Lambda Role
resource "aws_iam_role" "lambda" {
  name = "${var.project}-api-lambda-role"
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
  name = "${var.project}-api-lambda-policy"
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
        Action   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = [var.assets_bucket_arn, "${var.assets_bucket_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query", "dynamodb:Scan"]
        Resource = [var.scenes_table_arn, "${var.scenes_table_arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["states:StartExecution"]
        Resource = var.state_machine_arn
      }
    ]
  })
}

# Lambda Functions
data "archive_file" "upload" {
  type        = "zip"
  source_file = "${path.module}/../../../apps/api/src/handlers/upload.py"
  output_path = "${path.module}/upload.zip"
}

data "archive_file" "scenes" {
  type        = "zip"
  source_file = "${path.module}/../../../apps/api/src/handlers/scenes.py"
  output_path = "${path.module}/scenes.zip"
}

data "archive_file" "jobs" {
  type        = "zip"
  source_file = "${path.module}/../../../apps/api/src/handlers/jobs.py"
  output_path = "${path.module}/jobs.zip"
}

resource "aws_lambda_function" "upload" {
  filename         = data.archive_file.upload.output_path
  function_name    = "${var.project}-upload"
  role             = aws_iam_role.lambda.arn
  handler          = "upload.handler"
  runtime          = "python3.13"
  timeout          = 30
  source_code_hash = data.archive_file.upload.output_base64sha256
  tags             = var.common_tags

  environment {
    variables = {
      ASSETS_BUCKET = var.assets_bucket
    }
  }
}

resource "aws_lambda_function" "scenes" {
  filename         = data.archive_file.scenes.output_path
  function_name    = "${var.project}-scenes"
  role             = aws_iam_role.lambda.arn
  handler          = "scenes.handler"
  runtime          = "python3.13"
  timeout          = 30
  source_code_hash = data.archive_file.scenes.output_base64sha256
  tags             = var.common_tags

  environment {
    variables = {
      SCENES_TABLE  = var.scenes_table
      ASSETS_BUCKET = var.assets_bucket
    }
  }
}

resource "aws_lambda_function" "jobs" {
  filename         = data.archive_file.jobs.output_path
  function_name    = "${var.project}-jobs"
  role             = aws_iam_role.lambda.arn
  handler          = "jobs.handler"
  runtime          = "python3.13"
  timeout          = 30
  source_code_hash = data.archive_file.jobs.output_base64sha256
  tags             = var.common_tags

  environment {
    variables = {
      SCENES_TABLE      = var.scenes_table
      STATE_MACHINE_ARN = var.state_machine_arn
    }
  }
}

# Lambda Permissions
resource "aws_lambda_permission" "upload" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "scenes" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scenes.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "jobs" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.jobs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# API Routes
resource "aws_apigatewayv2_integration" "upload" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.upload.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "scenes" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.scenes.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "jobs" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.jobs.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "upload" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /upload"
  target             = "integrations/${aws_apigatewayv2_integration.upload.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "scenes_list" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /scenes"
  target    = "integrations/${aws_apigatewayv2_integration.scenes.id}"
}

resource "aws_apigatewayv2_route" "scenes_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /scenes/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.scenes.id}"
}

resource "aws_apigatewayv2_route" "scenes_create" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /scenes"
  target             = "integrations/${aws_apigatewayv2_integration.scenes.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "jobs" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /jobs"
  target             = "integrations/${aws_apigatewayv2_integration.jobs.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

output "api_url" {
  value = aws_apigatewayv2_api.main.api_endpoint
}
