# Splat Library - Technical Specification

A scalable 3D Gaussian Splatting creation pipeline and viewer library on AWS.

## Overview

Splat Library enables users to upload videos, automatically process them through COLMAP and 3DGS training, and view/share the resulting 3D scenes in a web-based gallery.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  React App (S3 + CloudFront)                                           │  │
│  │  - Cognito Auth                                                        │  │
│  │  - Video Upload                                                        │  │
│  │  - Scene Gallery                                                       │  │
│  │  - Spark Viewer (sparkjsdev/spark)                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                   API                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │
│  │ API Gateway     │  │ Lambda          │  │ S3 Presigned    │               │
│  │ (REST)          │──│ (Python 3.13)   │──│ URLs            │               │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘               │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              PIPELINE                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Step Functions (with Task Tokens for Batch)                             │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐            │ │
│  │  │ Extract   │─▶│ COLMAP    │─▶│ 3DGS      │─▶│ Convert   │            │ │
│  │  │ Frames    │  │ (Batch)   │  │ (Batch)   │  │ to .splat │            │ │
│  │  │ (Lambda)  │  │ CPU       │  │ GPU       │  │ (Lambda)  │            │ │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              STORAGE                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │
│  │ S3              │  │ DynamoDB        │  │ CloudFront      │               │
│  │ - videos/       │  │ - scenes        │  │ - .splat CDN    │               │
│  │ - frames/       │  │ - jobs          │  │ - thumbnails    │               │
│  │ - outputs/      │  │                 │  │                 │               │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Spark (sparkjsdev/spark), TailwindCSS |
| Auth | Amazon Cognito |
| API | API Gateway + Lambda (Python 3.13) |
| Pipeline | Step Functions, AWS Batch |
| Containers | Python (pycolmap), ECR |
| Storage | S3, DynamoDB |
| CDN | CloudFront |
| IaC | Terraform |
| Monorepo | Nx + pnpm |
| Region | us-west-2 |

## Project Structure

```
splat-library/
├── .gitignore
├── nx.json
├── pnpm-workspace.yaml
├── package.json
├── apps/
│   ├── web/                    # React frontend
│   │   ├── .gitignore
│   │   ├── src/
│   │   │   ├── styles/         # Modular Tailwind CSS
│   │   │   │   ├── base.css
│   │   │   │   ├── components.css
│   │   │   │   └── utilities.css
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   └── main.tsx
│   │   ├── project.json
│   │   └── vite.config.ts
│   └── api/                    # Lambda functions
│       ├── .gitignore
│       ├── src/
│       │   ├── handlers/
│       │   └── shared/
│       ├── requirements.txt
│       └── project.json
├── containers/
│   ├── .gitignore
│   ├── colmap/
│   │   ├── Dockerfile
│   │   └── run.py              # Uses pycolmap bindings
│   └── gaussian-splatting/
│       ├── Dockerfile
│       └── run.py
├── infra/
│   ├── .gitignore
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── locals.tf               # Common tags
│   ├── modules/
│   │   ├── cognito/
│   │   ├── api/
│   │   ├── storage/
│   │   ├── pipeline/
│   │   └── cdn/
│   └── terraform.tfvars
└── docs/
    └── specs/
```

---

## Phase 1: Foundation (Infrastructure + Auth)

### 1.1 Monorepo Setup

**nx.json**
```json
{
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*"],
    "production": ["default", "!{projectRoot}/**/*.spec.ts"]
  },
  "targetDefaults": {
    "build": { "dependsOn": ["^build"], "cache": true },
    "test": { "cache": true }
  }
}
```

**pnpm-workspace.yaml**
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**package.json**
```json
{
  "name": "splat-library",
  "private": true,
  "scripts": {
    "dev": "nx run web:dev",
    "build": "nx run-many -t build",
    "deploy:infra": "cd infra && terraform apply",
    "deploy:containers": "nx run-many -t docker-push"
  },
  "devDependencies": {
    "nx": "^19.0.0",
    "typescript": "^5.4.0"
  }
}
```

### 1.2 Terraform Foundation

**infra/locals.tf**
```hcl
locals {
  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

**infra/main.tf**
```hcl
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

module "storage" {
  source      = "./modules/storage"
  project     = var.project
  environment = var.environment
  common_tags = local.common_tags
}

module "cognito" {
  source      = "./modules/cognito"
  project     = var.project
  environment = var.environment
  common_tags = local.common_tags
}

module "api" {
  source            = "./modules/api"
  project           = var.project
  environment       = var.environment
  common_tags       = local.common_tags
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
  assets_bucket     = module.storage.assets_bucket
  assets_bucket_arn = module.storage.assets_bucket_arn
  scenes_table      = module.storage.scenes_table
  scenes_table_arn  = module.storage.scenes_table_arn
}

module "pipeline" {
  source            = "./modules/pipeline"
  project           = var.project
  environment       = var.environment
  common_tags       = local.common_tags
  assets_bucket     = module.storage.assets_bucket
  assets_bucket_arn = module.storage.assets_bucket_arn
  scenes_table      = module.storage.scenes_table
  scenes_table_arn  = module.storage.scenes_table_arn
}

module "cdn" {
  source        = "./modules/cdn"
  project       = var.project
  environment   = var.environment
  common_tags   = local.common_tags
  assets_bucket = module.storage.assets_bucket
}
```

**infra/variables.tf**
```hcl
variable "project" {
  default = "splat-library"
}

variable "environment" {
  default = "dev"
}

variable "aws_region" {
  default = "us-west-2"
}
```

### 1.3 Cognito Module

**infra/modules/cognito/main.tf**
```hcl
variable "project" {}
variable "environment" {}
variable "common_tags" {
  type = map(string)
}

resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-${var.environment}"

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  tags = var.common_tags
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]
}

output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}

output "client_id" {
  value = aws_cognito_user_pool_client.web.id
}
```

### 1.4 Storage Module

**infra/modules/storage/main.tf**
```hcl
variable "project" {}
variable "environment" {}
variable "common_tags" {
  type = map(string)
}

resource "aws_s3_bucket" "assets" {
  bucket = "${var.project}-assets-${var.environment}"
  tags   = var.common_tags
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

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
    allowed_origins = ["*"]  # Restrict in production
    max_age_seconds = 3000
  }
}

resource "aws_dynamodb_table" "scenes" {
  name         = "${var.project}-scenes-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

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

  tags = var.common_tags
}

output "assets_bucket" {
  value = aws_s3_bucket.assets.id
}

output "assets_bucket_arn" {
  value = aws_s3_bucket.assets.arn
}

output "scenes_table" {
  value = aws_dynamodb_table.scenes.name
}

output "scenes_table_arn" {
  value = aws_dynamodb_table.scenes.arn
}
```

---

## Phase 2: API Layer

See [SPEC-PIPELINE.md](./SPEC-PIPELINE.md) for API and Lambda specifications.

---

## Phase 3: Processing Pipeline

See [SPEC-PIPELINE.md](./SPEC-PIPELINE.md) for detailed pipeline specification.

---

## Phase 4: Frontend

See [SPEC-FRONTEND.md](./SPEC-FRONTEND.md) for detailed frontend specification.

---

## Phase 5: Containers

See [SPEC-CONTAINERS.md](./SPEC-CONTAINERS.md) for container specifications.

---

## Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 1. Foundation | 2 days | Terraform modules, Cognito, S3, DynamoDB |
| 2. API | 2 days | Lambda handlers, API Gateway routes |
| 3. Pipeline | 3 days | Step Functions, Batch jobs, containers |
| 4. Frontend | 3 days | React app, gallery, viewer |
| 5. Integration | 2 days | End-to-end testing, deployment |

**Total: ~12 days**

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /upload | Yes | Get presigned URL for video upload |
| POST | /scenes | Yes | Create scene and start pipeline |
| GET | /scenes | No | List public completed scenes |
| GET | /scenes/{id} | No | Get scene details |
| GET | /scenes/{id}/status | Yes | Get processing status |

---

## Data Models

### Scene (DynamoDB)
```json
{
  "id": "uuid",
  "userId": "cognito-sub",
  "name": "My Scene",
  "description": "Optional description",
  "status": "pending|processing|completed|failed",
  "videoKey": "uploads/{id}/video.mp4",
  "splatKey": "outputs/{id}/scene.splat",
  "thumbnailKey": "outputs/{id}/thumbnail.jpg",
  "frameCount": 150,
  "gaussianCount": 500000,
  "createdAt": 1706832000,
  "completedAt": 1706835600,
  "error": null
}
```

---

## Next Steps

1. Initialize git repo and monorepo with `pnpm` and Nx
2. Deploy Phase 1 infrastructure
3. Build and test API handlers locally
4. Create container images
5. Implement Step Functions workflow
6. Build React frontend
7. End-to-end integration testing
