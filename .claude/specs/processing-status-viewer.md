# Enhanced Processing Status Viewer

## Overview
Enhance the splat processing viewer to provide detailed, real-time status updates to users about where their splat is in the processing pipeline. Currently, users only see a generic "processing" state with no visibility into progress.

## Problem Statement
1. Users have no visibility into which stage of processing their splat is in
2. The frontend doesn't poll or receive updates when processing completes
3. Users must manually refresh to see if their splat is ready
4. No estimated time or progress indication

## Goals
- Show users the current processing stage (extracting frames, running COLMAP, training 3DGS, converting)
- Automatically update the UI when processing completes
- Provide a "View Splat" button when processing finishes
- Show meaningful progress indicators for each stage

## Non-Goals
- Real-time percentage progress within each stage (too complex for initial implementation)
- Push notifications (WebSocket/SSE) - will use polling for simplicity
- Cancellation of in-progress jobs

---

## Requirements

### Functional Requirements

#### FR1: Processing Stage Tracking
The system must track and expose the current processing stage for each scene.

**Acceptance Criteria:**
- [ ] Backend stores current processing stage in DynamoDB (`processingStage` field)
- [ ] Stage values: `pending`, `extracting_frames`, `running_colmap`, `training_3dgs`, `converting`, `completed`, `failed`
- [ ] Each pipeline step updates the stage before starting work
- [ ] API returns `processingStage` in scene response

#### FR2: Frontend Status Display
The frontend must display the current processing stage with visual indicators.

**Acceptance Criteria:**
- [ ] ScenePage shows a processing status component when `status !== 'completed'`
- [ ] Display a stepper/timeline showing all stages with current stage highlighted
- [ ] Show stage-specific descriptions (e.g., "Extracting frames from video...")
- [ ] Include a spinner/animation for the active stage

#### FR3: Automatic Status Polling
The frontend must automatically poll for status updates during processing.

**Acceptance Criteria:**
- [ ] Poll every 10 seconds while `status === 'processing'`
- [ ] Stop polling when status becomes `completed` or `failed`
- [ ] Use React Query's `refetchInterval` for polling

#### FR4: Completion Transition
The UI must smoothly transition when processing completes.

**Acceptance Criteria:**
- [ ] Show success animation/message when processing completes
- [ ] Display "View Splat" button that reveals the viewer
- [ ] Automatically show the splat viewer after a brief delay (2 seconds)

#### FR5: Error State Handling
The UI must handle failed processing gracefully.

**Acceptance Criteria:**
- [ ] Show error message with the failed stage
- [ ] Display error details if available from the backend
- [ ] Provide "Try Again" option (link to upload page)

---

## Technical Design

### Backend Changes

#### DynamoDB Schema Update
Add `processingStage` field to scenes table:
```
{
  id: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  processingStage: 'pending' | 'extracting_frames' | 'running_colmap' | 'training_3dgs' | 'converting' | 'completed' | 'failed',
  processingError?: string,
  ...existing fields
}
```

#### Lambda Handler Updates
Each pipeline Lambda must update `processingStage` at the start of execution:

1. **extract_frames.py**: Set stage to `extracting_frames`
2. **COLMAP container**: Set stage to `running_colmap` (via Lambda or direct DynamoDB)
3. **3DGS container**: Set stage to `training_3dgs`
4. **convert.py**: Set stage to `converting`, then `completed`
5. **handle_failure.py**: Set stage to `failed` with error message

#### Step Functions Updates
Add a Lambda task before each Batch job to update the processing stage, OR modify existing Lambdas to update stage.

### Frontend Changes

#### New Component: ProcessingStatus
```tsx
// apps/web/src/components/Viewer/ProcessingStatus.tsx
interface ProcessingStatusProps {
  stage: string;
  onComplete: () => void;
}
```

#### ScenePage Updates
- Add polling with `refetchInterval` when processing
- Conditionally render `ProcessingStatus` or `SplatViewer`
- Handle transition from processing to completed

#### API Client Updates
- Update `Scene` interface with `processingStage` field

---

## Implementation Tasks

### Task 1: Backend - Add Processing Stage Updates
**Files to modify:**
- `apps/api/src/handlers/extract_frames.py`
- `apps/api/src/handlers/convert.py`
- `apps/api/src/handlers/handle_failure.py`
- `infra/modules/pipeline/main.tf` (add stage update tasks)

**Subtasks:**
1. Create helper function to update processing stage in DynamoDB
2. Update extract_frames.py to set `extracting_frames` stage
3. Add Lambda to set `running_colmap` stage before COLMAP batch job
4. Add Lambda to set `training_3dgs` stage before 3DGS batch job
5. Update convert.py to set `converting` then `completed` stages
6. Update handle_failure.py to set `failed` stage with error details

### Task 2: Frontend - Create ProcessingStatus Component
**Files to create:**
- `apps/web/src/components/Viewer/ProcessingStatus.tsx`

**Subtasks:**
1. Create stepper UI showing all processing stages
2. Highlight current stage with animation
3. Show stage-specific descriptions
4. Add completion state with "View Splat" button

### Task 3: Frontend - Update ScenePage with Polling
**Files to modify:**
- `apps/web/src/pages/ScenePage.tsx`
- `apps/web/src/api/client.ts`

**Subtasks:**
1. Update Scene interface with `processingStage` field
2. Add conditional polling (refetchInterval) when processing
3. Conditionally render ProcessingStatus or SplatViewer
4. Handle smooth transition on completion

### Task 4: Infrastructure - Update Step Functions
**Files to modify:**
- `infra/modules/pipeline/main.tf`

**Subtasks:**
1. Add Lambda function for stage updates (or inline in existing)
2. Update state machine to call stage update before each major step
3. Deploy and test pipeline

---

## UI/UX Design

### Processing Status Stepper
```
┌─────────────────────────────────────────────────────────────┐
│                    Processing Your Scene                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✓ Upload        ●─────○ COLMAP ○─────○ Training ○─────○ Done│
│  Complete        Extracting                                  │
│                  frames...                                   │
│                                                              │
│                  [Spinner] Extracting frames from video...   │
│                  This may take a few minutes.                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Completion State
```
┌─────────────────────────────────────────────────────────────┐
│                    🎉 Processing Complete!                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✓ Upload ───── ✓ COLMAP ───── ✓ Training ───── ✓ Done      │
│                                                              │
│                  Your 3D Gaussian Splat is ready!            │
│                                                              │
│                      [ View Splat ]                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Plan

### Manual Testing
1. Upload a new video and verify stage updates appear
2. Verify polling stops when processing completes
3. Verify "View Splat" button works
4. Test error state by triggering a failure
5. Test page refresh during processing (should resume showing correct stage)

### Edge Cases
- User navigates away and returns during processing
- Multiple browser tabs open to same scene
- Processing fails at different stages
- Very fast processing (all stages complete quickly)

---

## Rollout Plan

1. Deploy backend changes first (backward compatible)
2. Deploy frontend changes
3. Test with new upload
4. Monitor for issues

## Future Enhancements
- WebSocket/SSE for real-time updates (eliminate polling)
- Estimated time remaining based on historical data
- Progress percentage within stages (especially training)
- Email notification when processing completes
