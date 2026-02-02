# Splat Library

A scalable 3D Gaussian Splatting creation pipeline and viewer library on AWS.

## Overview

Splat Library enables users to upload videos, automatically process them through COLMAP and 3D Gaussian Splatting training, and view/share the resulting 3D scenes in a web-based gallery.

### Features

- **Video Upload** - Upload videos and automatically extract frames
- **COLMAP Processing** - Structure-from-Motion camera pose estimation
- **3DGS Training** - GPU-accelerated Gaussian Splatting training
- **Web Viewer** - Interactive 3D scene viewing in the browser
- **Scene Gallery** - Browse and share public scenes
- **Authentication** - Secure user authentication with AWS Cognito

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
| Frontend | React 18, TypeScript, TailwindCSS, Vite |
| Auth | Amazon Cognito |
| API | API Gateway + Lambda (Python 3.13) |
| Pipeline | Step Functions, AWS Batch |
| Containers | Python, pycolmap, ECR |
| Storage | S3, DynamoDB |
| CDN | CloudFront |
| IaC | Terraform |
| Monorepo | Nx + pnpm |

## Prerequisites

- Node.js 18+
- pnpm 8+
- Python 3.11+
- Docker
- AWS CLI configured
- Terraform 1.5+

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd splat-library
pnpm install
```

### 2. Build

```bash
pnpm build
```

### 3. Deploy Infrastructure

```bash
cd infra
terraform init
terraform plan
terraform apply
```

### 4. Build and Push Containers

```bash
cd containers
./build.sh
```

### 5. Configure Environment

Create `apps/web/.env.local`:

```env
VITE_API_URL=https://<api-gateway-url>
VITE_CDN_URL=https://<cloudfront-url>
VITE_COGNITO_USER_POOL_ID=<user-pool-id>
VITE_COGNITO_CLIENT_ID=<client-id>
```

### 6. Run Development Server

```bash
pnpm dev
```

## Project Structure

```
splat-library/
├── apps/
│   ├── web/                 # React frontend
│   └── api/                 # Lambda handlers
├── containers/
│   ├── colmap/              # COLMAP container
│   └── gaussian-splatting/  # 3DGS training container
├── infra/                   # Terraform infrastructure
│   └── modules/
│       ├── cognito/
│       ├── storage/
│       └── pipeline/
└── docs/
    └── specs/               # Technical specifications
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web development server |
| `pnpm build` | Build all packages |
| `pnpm nx show projects` | List all projects |
| `pnpm deploy:infra` | Deploy Terraform infrastructure |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /upload | Yes | Get presigned URL for video upload |
| POST | /scenes | Yes | Create scene and start pipeline |
| GET | /scenes | No | List public completed scenes |
| GET | /scenes/{id} | No | Get scene details |

## Configuration

### AWS Region

Default: `us-west-2`

Configure in `infra/variables.tf`:

```hcl
variable "aws_region" {
  default = "us-west-2"
}
```

### Batch Instance Types

- **CPU (COLMAP)**: c6i.2xlarge, c6i.4xlarge
- **GPU (3DGS)**: g5.xlarge, g6.xlarge

## Cost Estimates

| Component | Estimated Cost |
|-----------|----------------|
| COLMAP processing | ~$0.10-0.30/scene |
| 3DGS training | ~$0.25-0.50/scene |
| Storage | ~$0.02/month/scene |
| **Total per scene** | **~$0.40-0.80** |

*Using Spot instances for Batch compute.*

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [3D Gaussian Splatting](https://github.com/graphdeco-inria/gaussian-splatting) - Original 3DGS implementation
- [COLMAP](https://colmap.github.io/) - Structure-from-Motion pipeline
- [pycolmap](https://github.com/colmap/colmap) - Python bindings for COLMAP
