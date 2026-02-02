output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "assets_bucket" {
  value = module.storage.assets_bucket
}

output "api_url" {
  value = module.api.api_url
}

output "cdn_url" {
  value = module.cdn.cdn_url
}

output "state_machine_arn" {
  value = module.pipeline.state_machine_arn
}

output "colmap_ecr_url" {
  value = module.pipeline.colmap_ecr_url
}

output "gaussian_splatting_ecr_url" {
  value = module.pipeline.gaussian_splatting_ecr_url
}
