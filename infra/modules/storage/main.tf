variable "project" {}
variable "environment" {}
variable "common_tags" { type = map(string) }

resource "aws_s3_bucket" "assets" {
  bucket = "${var.project}-assets-${var.environment}"
  tags   = var.common_tags
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_dynamodb_table" "scenes" {
  name         = "${var.project}-scenes-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  tags         = var.common_tags

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }
}

output "assets_bucket" { value = aws_s3_bucket.assets.id }
output "assets_bucket_arn" { value = aws_s3_bucket.assets.arn }
output "scenes_table" { value = aws_dynamodb_table.scenes.name }
output "scenes_table_arn" { value = aws_dynamodb_table.scenes.arn }
