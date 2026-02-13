# Splat Library - TODO

## High Priority

### Pipeline Validation
- [ ] Test full pipeline end-to-end with video upload
- [ ] Validate gsplat output quality (PSNR comparison)
- [ ] Measure training time and GPU memory improvements

### Infrastructure
- [ ] Add CloudWatch alarms for pipeline failures
- [ ] Configure S3 lifecycle rules for cost optimization

## Medium Priority

### Features
- [ ] Add scene search/filter in Gallery
- [ ] Implement scene sharing with public links
- [ ] Add download button for .ply/.splat files
- [ ] Scene metadata editing (name, description)

### UX Improvements
- [ ] Add skeleton loaders for better perceived performance
- [ ] Implement toast notifications for actions
- [ ] Mobile navigation menu (hamburger)

### Infrastructure
- [ ] Set up CI/CD pipeline for frontend deployment
- [ ] Add staging environment
- [ ] Configure custom domain with Route53
- [ ] Enable CloudFront caching for API responses

## Low Priority

### Nice to Have
- [ ] Scene comments/annotations
- [ ] Scene versioning
- [ ] Batch upload multiple videos
- [ ] Video preview before upload
- [ ] Processing time estimates
- [ ] Pre-compile CUDA kernels in GPU-enabled CI/CD

### Technical Debt
- [ ] Add unit tests for API handlers
- [ ] Add E2E tests with Playwright
- [ ] Set up error tracking (Sentry)
- [ ] Add analytics (usage metrics)

## Completed ✓

### Infrastructure
- [x] Deploy infrastructure with Terraform
- [x] Create Cognito user pool and demo admin user
- [x] Build and push Docker images to ECR (COLMAP, Gaussian Splatting)
- [x] Migrate to gsplat library (built from source)

### Frontend
- [x] Modernize UI with dark theme
- [x] Add UI design guidelines documentation
- [x] Implement drag-drop upload
- [x] Add loading/error/empty states to all pages
- [x] Implement real-time job status polling (6-stage pipeline stepper)
- [x] Add scene deletion functionality with ownership verification
- [x] Add advanced upload settings (fps, iterations, densification params)

### Backend
- [x] Add processing status endpoint
- [x] Improve error handling with stage-specific messages
- [x] Add DynamoDB UpdateItem permission to Batch job role

### Documentation
- [x] Update README with current architecture
- [x] Document gsplat migration (compatibility issues, final solution)
- [x] Add git workflow steering document
