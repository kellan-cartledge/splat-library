# Splat Library

![Checkov](https://github.com/kellan-cartledge/splat-library/actions/workflows/checkov.yml/badge.svg)
![Gitleaks](https://github.com/kellan-cartledge/splat-library/actions/workflows/gitleaks.yml/badge.svg)
![Trivy](https://github.com/kellan-cartledge/splat-library/actions/workflows/trivy.yml/badge.svg)

A scalable 3D Gaussian Splatting creation pipeline and viewer library on AWS.

## Overview

Splat Library enables users to upload videos, automatically process them through COLMAP and 3D Gaussian Splatting training, and view/share the resulting 3D scenes in a web-based gallery.

### Features

- **Video Upload** - Upload videos with configurable frame extraction (fps)
- **COLMAP Processing** - Structure-from-Motion camera pose estimation
- **3DGS Training** - GPU-accelerated Gaussian Splatting using [gsplat](https://github.com/nerfstudio-project/gsplat)
- **Advanced Settings** - Configurable iterations, densification parameters
- **Real-time Status** - 6-stage pipeline progress tracking with live updates
- **Web Viewer** - Interactive 3D scene viewing in the browser
- **Scene Gallery** - Browse and share public scenes
- **Scene Management** - Delete scenes with ownership verification
- **Authentication** - Secure user authentication with AWS Cognito

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  React App (S3 + CloudFront)                                           │  │
│  │  - Cognito Auth                                                        │  │
│  │  - Video Upload with Advanced Settings                                 │  │
│  │  - Scene Gallery                                                       │  │
│  │  - Processing Status Viewer                                            │  │
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
│  │                                                                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ Extract  │─▶│ Analyze  │─▶│ Generate │─▶│ Convert  │─▶│ Complete │  │ │
│  │  │ Frames   │  │ (COLMAP) │  │ (gsplat) │  │ to .splat│  │          │  │ │
│  │  │ Lambda   │  │ Batch/CPU│  │ Batch/GPU│  │ Lambda   │  │          │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │
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
│  │ - colmap/       │  │                 │  │                 │               │
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
| 3DGS Engine | [gsplat](https://github.com/nerfstudio-project/gsplat) 1.5.3 |
| Containers | NVIDIA PyTorch 24.12, pycolmap, ECR |
| Storage | S3, DynamoDB |
| CDN | CloudFront |
| IaC | Terraform |
| Monorepo | Nx + pnpm |

## Processing Pipeline

The pipeline consists of 6 stages with real-time status updates:

| Stage | Description | Compute |
|-------|-------------|---------|
| **Upload** | Video uploaded to S3 | - |
| **Extract** | Extract frames at configured fps | Lambda |
| **Analyze** | COLMAP Structure-from-Motion | Batch (CPU) |
| **Generate** | gsplat 3DGS training | Batch (GPU) |
| **Convert** | Convert PLY to .splat format | Lambda |
| **Complete** | Scene ready for viewing | - |

### Training Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fps` | 3 | Frames per second to extract from video |
| `iterations` | 30,000 | Training iterations |
| `densifyUntilIter` | 15,000 | Densification cutoff iteration |
| `densificationInterval` | 100 | Iterations between densification |

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
AWS_REGION=us-west-2 ./build.sh
```

**Note:** The gaussian-splatting container builds gsplat from source (~10-15 min). CUDA kernels JIT compile on first Batch job run (~2-3 min additional).

### 5. Configure Environment

Create `packages/web/.env.local`:

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
├── packages/
│   └── web/                 # React frontend
├── services/
│   └── api/                 # Lambda handlers
│       └── src/handlers/
│           ├── scenes.py    # Scene CRUD operations
│           ├── jobs.py      # Job status endpoints
│           ├── extract_frames.py
│           ├── convert.py
│           └── handle_failure.py
├── containers/
│   ├── colmap/              # COLMAP container (pycolmap)
│   └── gaussian-splatting/  # gsplat training container
│       ├── Dockerfile       # NVIDIA PyTorch 24.12 + gsplat from source
│       └── run.py           # Training script
├── infra/                   # Terraform infrastructure
│   └── modules/
│       ├── cognito/
│       ├── storage/
│       ├── api/
│       └── pipeline/
└── .kiro/
    └── specs/               # Technical specifications
```

## Container Details

### COLMAP Container
- Base: `colmap/colmap:latest`
- Runs Structure-from-Motion to estimate camera poses
- Outputs sparse reconstruction to S3

### Gaussian Splatting Container
- Base: `nvcr.io/nvidia/pytorch:24.12-py3` (PyTorch 2.6 + CUDA 12.6)
- gsplat 1.5.3 built from source for compatibility
- Custom training loop with:
  - COLMAP binary file parsing
  - Scene normalization
  - Spherical harmonics (degree 3)
  - Adaptive densification strategy
  - PLY export in 3DGS format

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /upload | Yes | Get presigned URL for video upload |
| POST | /scenes | Yes | Create scene and start pipeline |
| GET | /scenes | No | List public completed scenes |
| GET | /scenes/{id} | No | Get scene details |
| DELETE | /scenes/{id} | Yes | Delete scene (owner only) |
| GET | /scenes/{id}/status | No | Get processing status |

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

- [gsplat](https://github.com/nerfstudio-project/gsplat) - High-performance 3DGS library by nerfstudio
- [COLMAP](https://colmap.github.io/) - Structure-from-Motion pipeline
- [pycolmap](https://github.com/colmap/colmap) - Python bindings for COLMAP
- [3D Gaussian Splatting](https://github.com/graphdeco-inria/gaussian-splatting) - Original 3DGS paper implementation
