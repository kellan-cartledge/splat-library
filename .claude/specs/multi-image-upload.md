# Multi-Image Upload Feature Spec

## Overview

Add support for uploading image sets (multiple images) as an alternative to video upload. Users who already have extracted frames from other 3D reconstruction projects can upload them directly, skipping the Extract Frames pipeline stage.

## Current Flow (Video)

1. User selects a video file → `POST /upload` returns a single presigned URL
2. Frontend uploads video to `uploads/{sceneId}/` via presigned URL
3. `POST /scenes` creates the scene record
4. `POST /jobs` starts Step Functions with `{ sceneId, videoKey, fps, ... }`
5. Pipeline: ExtractFrames → RunCOLMAP → Run3DGS → ConvertAndNotify

## Proposed Flow (Image Set)

1. User selects multiple image files → `POST /upload` returns presigned URLs for each image
2. Frontend uploads images directly to `frames/{sceneId}/` via presigned URLs
3. `POST /scenes` creates the scene record with `inputType: "images"`
4. `POST /jobs` starts Step Functions with `{ sceneId, inputType: "images", ... }`
5. Pipeline: ~~ExtractFrames~~ → RunCOLMAP → Run3DGS → ConvertAndNotify

## Changes Required

### 1. Upload Lambda (`services/api/src/handlers/upload.py`)
- Accept `inputType` field: `"video"` (default) or `"images"`
- When `inputType: "images"`, accept a `files` array of `{ filename, contentType }` objects
- Return an array of presigned URLs targeting `frames/{sceneId}/{filename}`
- Current single-video response format remains unchanged for backward compatibility

### 2. API Client (`packages/web/src/api/client.ts`)
- Add `getImageUploadUrls()` function that sends the file list and receives multiple presigned URLs
- Update `createScene()` to accept `inputType` field
- Update `startProcessing()` to pass `inputType` through to the pipeline

### 3. Upload Form (`packages/web/src/components/Upload/UploadForm.tsx`)
- Add upload mode toggle: "Video" | "Images"
- In image mode: accept multiple image files (jpg, png) via file picker and drag-and-drop
- Show image count and total size instead of single file info
- Upload all images in parallel (with concurrency limit) using individual presigned URLs
- Hide the `fps` setting when in image mode (not applicable)

### 4. Scene Creation (`services/api/src/handlers/scenes.py`)
- Store `inputType` field on the scene record in DynamoDB

### 5. Jobs Lambda (`services/api/src/handlers/jobs.py`)
- Pass `inputType` to the Step Functions execution input

### 6. Step Functions State Machine (`infra/modules/pipeline/main.tf`)
- Add a Choice state at the start that checks `$.inputType`
- If `"images"` → skip ExtractFrames, go directly to RunCOLMAP
- If `"video"` (or absent) → proceed to ExtractFrames as before

### 7. Upload Page Tips
- Update tips section to show relevant guidance based on selected upload mode

## Open Questions

- [x] **Image format constraints** — JPEG/JPG and PNG only. TIFF not required.
- [x] **Image count limits** — Warn below 20 images but do not hard-block.
- [x] **File size limits** — 50MB per image.
- [x] **Image naming** — Preserve original filenames. No implications for COLMAP (it reads all images from a directory regardless of naming).
- [x] **Validation** — No pre-pipeline validation. Let COLMAP handle whatever it gets.
- [x] **Progress tracking** — Skip the "Extract" stage in the UI for image uploads (show 5 stages).

## Out of Scope

- Image preprocessing (resizing, format conversion)
- EXIF-based camera intrinsics extraction
- Drag-and-drop folder upload
