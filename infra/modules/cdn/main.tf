variable "project" {}
variable "environment" {}
variable "common_tags" { type = map(string) }
variable "assets_bucket" {}
variable "assets_bucket_arn" {}

data "aws_s3_bucket" "assets" {
  bucket = var.assets_bucket
}

resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "${var.project}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  tags                = var.common_tags

  origin {
    domain_name              = data.aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "S3-${var.assets_bucket}"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.assets_bucket}"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # Cache behavior for .splat files
  ordered_cache_behavior {
    path_pattern           = "outputs/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.assets_bucket}"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 604800
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "cloudfront" {
  bucket = var.assets_bucket

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontServicePrincipal"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${var.assets_bucket_arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
        }
      }
    }]
  })
}

output "distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "distribution_domain" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "cdn_url" {
  value = "https://${aws_cloudfront_distribution.main.domain_name}"
}
