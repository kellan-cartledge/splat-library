terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.30"
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

module "pipeline" {
  source            = "./modules/pipeline"
  project           = var.project
  environment       = var.environment
  common_tags       = local.common_tags
  assets_bucket     = module.storage.assets_bucket
  assets_bucket_arn = module.storage.assets_bucket_arn
  scenes_table      = module.storage.scenes_table
  scenes_table_arn  = module.storage.scenes_table_arn
  gpu_min_vcpus     = var.gpu_min_vcpus
}

module "api" {
  source               = "./modules/api"
  project              = var.project
  environment          = var.environment
  common_tags          = local.common_tags
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
  assets_bucket        = module.storage.assets_bucket
  assets_bucket_arn    = module.storage.assets_bucket_arn
  scenes_table         = module.storage.scenes_table
  scenes_table_arn     = module.storage.scenes_table_arn
  state_machine_arn    = module.pipeline.state_machine_arn
}

module "cdn" {
  source            = "./modules/cdn"
  project           = var.project
  environment       = var.environment
  common_tags       = local.common_tags
  assets_bucket     = module.storage.assets_bucket
  assets_bucket_arn = module.storage.assets_bucket_arn
}
