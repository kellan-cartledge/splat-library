#!/bin/bash
set -e

AWS_REGION=${AWS_REGION:-us-west-2}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_BASE

echo "Building COLMAP container..."
docker build --platform linux/amd64 -t splat-library-colmap ./colmap
docker tag splat-library-colmap:latest ${ECR_BASE}/splat-library-colmap:latest
docker push ${ECR_BASE}/splat-library-colmap:latest

echo "Building Gaussian Splatting container..."
docker build --platform linux/amd64 -t splat-library-gaussian-splatting ./gaussian-splatting
docker tag splat-library-gaussian-splatting:latest ${ECR_BASE}/splat-library-gaussian-splatting:latest
docker push ${ECR_BASE}/splat-library-gaussian-splatting:latest

echo "Done!"
