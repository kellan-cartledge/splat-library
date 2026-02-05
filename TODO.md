# Splat Library - TODO

## High Priority

### Backend / Infrastructure
- [ ] Build and push Docker images to ECR (COLMAP, Gaussian Splatting)
- [ ] Test the full processing pipeline end-to-end
- [ ] Add CloudWatch alarms for pipeline failures
- [ ] Configure S3 lifecycle rules for cost optimization

### Frontend
- [ ] Implement real-time job status polling on UploadProgress
- [ ] Add SplatViewer component with actual 3DGS rendering
- [ ] Handle authentication errors gracefully
- [ ] Add scene deletion functionality

## Medium Priority

### Features
- [ ] Add scene search/filter in Gallery
- [ ] Implement scene sharing with public links
- [ ] Add download button for .ply/.splat files
- [ ] Scene metadata editing (name, description)

### UX Improvements
- [ ] Add skeleton loaders for better perceived performance
- [ ] Implement toast notifications for actions
- [ ] Add keyboard shortcuts for common actions
- [ ] Mobile navigation menu (hamburger)

### Infrastructure
- [ ] Set up CI/CD pipeline for frontend deployment
- [ ] Add staging environment
- [ ] Configure custom domain with Route53
- [ ] Enable CloudFront caching for API responses

## Low Priority

### Nice to Have
- [ ] Scene comments/annotations
- [ ] User profiles and scene ownership
- [ ] Scene versioning
- [ ] Batch upload multiple videos
- [ ] Video preview before upload
- [ ] Processing time estimates

### Technical Debt
- [ ] Add unit tests for API handlers
- [ ] Add E2E tests with Playwright
- [ ] Set up error tracking (Sentry)
- [ ] Add analytics (usage metrics)

## Completed ✓
- [x] Deploy infrastructure with Terraform
- [x] Create Cognito user pool and demo admin user
- [x] Modernize UI with dark theme
- [x] Add UI design guidelines documentation
- [x] Implement drag-drop upload
- [x] Add loading/error/empty states to all pages
