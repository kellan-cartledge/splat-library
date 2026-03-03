# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Splat Library is a serverless 3D Gaussian Splatting pipeline on AWS. Users upload videos, which are processed through an automated pipeline (frame extraction → COLMAP SfM → gsplat training → .splat conversion) and viewed in a web-based 3D viewer.

## Commands

```bash
# Development
pnpm dev                    # Run web frontend (Vite dev server)
pnpm build                  # Build all packages (nx run-many -t build)
pnpm lint                   # Lint all packages

# Web frontend only
cd packages/web
pnpm dev                    # Vite dev server
pnpm build                  # TypeScript check + Vite build
pnpm lint                   # ESLint on src/

# API (Lambda handlers)
nx build api                # Zips services/api/src/ into dist/lambda.zip

# Infrastructure
pnpm deploy:infra           # terraform apply in infra/
pnpm deploy:containers      # Build & push Docker images to ECR

# Container builds
cd containers && AWS_REGION=us-west-2 ./build.sh
```

## Architecture

**Monorepo (Nx + pnpm)** with three main packages:

- **`packages/web/`** — React 18 SPA (TypeScript, Vite, TailwindCSS v4, Amplify UI for Cognito auth, TanStack Query, Three.js). Routes: `/`, `/gallery`, `/scene/:id`, `/upload`, `/jobs`, `/jobs/:id`.
- **`services/api/`** — Python 3.13 Lambda handlers (boto3, plyfile). Three handlers: `scenes` (CRUD), `upload` (presigned URLs), `jobs` (pipeline status). Shared utilities in `src/shared/helpers.py`.
- **`containers/`** — Two Docker containers for AWS Batch:
  - `colmap/` — pycolmap-based SfM (CPU instances)
  - `gaussian-splatting/` — gsplat 1.5.3 training on NVIDIA PyTorch 24.12 (GPU Spot instances)
- **`infra/`** — Terraform modules: `storage` (S3 + DynamoDB), `cognito`, `api` (API Gateway + Lambda), `pipeline` (VPC + Batch + Step Functions), `cdn` (CloudFront).

**Pipeline flow (Step Functions):**
1. Extract Frames (Lambda + FFmpeg layer) → S3 `frames/`
2. COLMAP (Batch CPU) → S3 `colmap/`
3. gsplat Training (Batch GPU) → S3 `outputs/`
4. Convert PLY→.splat (Lambda) → mark complete in DynamoDB
5. Error handling via `handle_failure.py`

**Storage:** S3 prefixes: `videos/`, `frames/`, `colmap/`, `outputs/`. DynamoDB `scenes` table with `userId` GSI.

## Environment Setup

Web frontend requires `packages/web/.env.local`:
```
VITE_API_URL=https://<api-gateway-url>
VITE_CDN_URL=https://<cloudfront-url>
VITE_COGNITO_USER_POOL_ID=<pool-id>
VITE_COGNITO_CLIENT_ID=<client-id>
```

Lambda handlers use env vars: `SCENES_TABLE`, `ASSETS_BUCKET`, `AWS_REGION`, `STATE_MACHINE_ARN`.

## Git Conventions

- **Branch naming:** `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`
- **Commits:** Conventional format (`type: description`) with DCO sign-off (`git commit -s`)
- **Pre-commit hooks:** gitleaks (secret detection) + auto DCO sign-off
- **PRs required** — direct pushes to `main` are blocked; CI runs Checkov, Gitleaks, Trivy

## UI Design System

"Midnight Terminal" dark theme — IDE-inspired with specific design tokens:
- **Fonts:** Space Grotesk (headings), IBM Plex Sans (body), JetBrains Mono (code/data)
- **Colors:** Surface `#0a0e14`→`#151b23`, accents: cyan `#39bae6`, orange `#ff8f40`, green `#7fd962`, purple `#d2a6ff`, red `#f07178`
- **TailwindCSS v4:** Custom values in `@theme` block via CSS variables; animations via `--animate-*` variables
- **Motion:** Staggered fade-up (0.1s delays), 200-300ms transitions, hover lift with border glow
- Full guidelines in `.claude/steering/ui-design-guidelines.md`

## Key Constraints

- AWS default region: `us-west-2` (configurable in `infra/variables.tf`)
- Gaussian splatting container builds gsplat from source (~10-15 min); CUDA kernels JIT compile on first Batch run (~2-3 min)
- Batch GPU compute uses Spot instances — handle interruptions gracefully
- API auth: write operations require Cognito JWT; read operations are public
