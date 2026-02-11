variable "project" {
  default = "splat-library"
}

variable "environment" {
  default = "dev"
}

variable "aws_region" {
  default = "us-west-2"
}

variable "gpu_min_vcpus" {
  description = "Minimum vCPUs to keep running for GPU compute environment (reduces cold start time)"
  type        = number
  default     = 8
}
