# Jobs Dashboard

## Overview
A "My Jobs" section showing all of the authenticated user's scenes (processing, completed, failed) with live status updates, so users can navigate away from a processing scene and return to check progress.

## Problem Statement
Users must stay on the ScenePage to monitor processing progress. If they navigate away, there's no way to see which jobs are active or return to them without bookmarking the URL.

## Goals
- Authenticated users can see all their scenes in one place
- Active jobs show real-time processing stage with polling
- Users can click through to any scene's detail page
- Individual job detail page with progress tracker and metadata

## Non-Goals
- Job cancellation
- Filtering/sorting controls
- Pagination (scan is fine for per-user volume)
- Public access (auth required)

---

## Requirements

### FR1: Backend - User Scenes Endpoint
`GET /scenes/mine` (authenticated) returns all scenes for the current user, sorted by `createdAt` desc.

**Acceptance Criteria:**
- [x] Uses `userId-index` GSI to query by `userId` from JWT `sub` claim
- [x] Returns all scenes regardless of status (pending, processing, completed, failed)
- [x] Sorted by `createdAt` descending (newest first)

### FR2: Frontend - Jobs List Page (`/jobs`)
Table of all user scenes with live status.

**Acceptance Criteria:**
- [x] Each row shows: name, status badge, processing stage label, relative time
- [x] Relative time logic: active jobs show "Started X ago" (from `createdAt`), completed show "Completed X ago" (from `completedAt`), failed show "Failed X ago"
- [x] Click row navigates to `/jobs/{id}`
- [x] Polls every 10s if any scene has status `pending` or `processing`
- [x] Empty state prompts user to upload
- [x] Unauthenticated users see the Amplify sign-in form (same pattern as Upload page)

### FR3: Frontend - Job Detail Page (`/jobs/{id}`)
Individual job view with progress tracker and metadata.

**Acceptance Criteria:**
- [x] "Back to My Jobs" breadcrumb link at top (same pattern as ScenePage's "Back to Gallery")
- [x] Shows the ProcessingStatus stepper component (reuse from ScenePage)
- [x] Displays job metadata: scene name, input type, created time, last updated time
- [x] Shows training parameters from `settings` (iterations, fps, densification params) when available
- [x] Scene name links to `/scene/{id}` when job is completed
- [x] Polls every 10s while processing
- [x] When completed, shows "View Splat" button linking to `/scene/{id}`
- [x] When failed, shows error details and "Try Again" link to upload

### FR4: Status Badges
Visual indicators per status.

**Acceptance Criteria:**
- [x] `pending` / `processing` → yellow pulsing badge with current stage label
- [x] `completed` → green badge
- [x] `failed` → red badge

### FR5: Navigation
Nav link visible only when authenticated, with active job count.

**Acceptance Criteria:**
- [x] "My Jobs" link in header between "Gallery" and "Upload"
- [x] Shows active job count badge when jobs are processing (e.g. "My Jobs (2)")
- [x] Active state styling matches existing nav pattern
- [x] Count reads from React Query cache (`['myScenes']` key) — no separate API call from Header. Count only appears after user has visited `/jobs` at least once in the session.

### FR6: Post-Upload Redirect
After uploading a scene, redirect to `/jobs` instead of `/scene/{id}`.

**Acceptance Criteria:**
- [x] Upload page redirects to `/jobs` after successful scene creation and pipeline start
- [x] Users can immediately start another upload from `/jobs` via the upload link

### FR7: TypeScript Interface Fix
Add missing `userId` field to `Scene` interface.

**Acceptance Criteria:**
- [x] `Scene` interface in `client.ts` includes `userId: string`
- [x] Resolves existing TS error in ScenePage where `scene.userId` is referenced

---

## Technical Design

### Backend Changes

**`services/api/src/handlers/scenes.py`** — Add route + handler:
```python
# In handler(), before the scenes/{id} match:
elif method == 'GET' and path == '/scenes/mine':
    return list_user_scenes(event)

# New function:
def list_user_scenes(event):
    user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
    response = table.query(
        IndexName='userId-index',
        KeyConditionExpression='userId = :uid',
        ExpressionAttributeValues={':uid': user_id},
        ScanIndexForward=False  # newest first
    )
    items = sorted(response['Items'], key=lambda x: x.get('createdAt', 0), reverse=True)
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(items, cls=DecimalEncoder)
    }
```

### Infrastructure Changes

**`infra/modules/api/main.tf`** — Add authenticated route:
```hcl
resource "aws_apigatewayv2_route" "scenes_mine" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /scenes/mine"
  target             = "integrations/${aws_apigatewayv2_integration.scenes.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
```

### Frontend Changes

**`packages/web/src/api/client.ts`**:
- Add `userId: string` to `Scene` interface
- Add `settings?: { iterations?: number; fps?: number; densifyUntilIter?: number; densificationInterval?: number }` to `Scene` interface
- Add fetch function:
```typescript
export async function fetchMyScenes(token: string): Promise<Scene[]> {
  const res = await fetch(`${API}/scenes/mine`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
}
```

**`packages/web/src/pages/JobsPage.tsx`** — Jobs list page:
- Uses `fetchMyScenes` with auth token from `fetchAuthSession`
- Polls every 10s if any scene is `pending` or `processing`
- Table rows with name, status badge, stage, relative time
- Click navigates to `/jobs/{id}`
- Empty state with link to upload
- Wraps content in `<Authenticator>` for unauthenticated users
- Follows Midnight Terminal theme from design guidelines

**`packages/web/src/pages/JobDetailPage.tsx`** — Job detail page:
- Fetches single scene via existing `fetchScene(id)`
- "Back to My Jobs" breadcrumb at top
- Reuses `ProcessingStatus` component for progress stepper
- Shows metadata: scene name (links to `/scene/{id}` when completed), input type, created/updated times
- Shows training parameters from `settings` when available
- Polls every 10s while processing
- "View Splat" button links to `/scene/{id}` when completed
- "Try Again" link to `/upload` when failed

**`packages/web/src/pages/UploadPage.tsx`** — Modify redirect:
- After successful upload + pipeline start, `navigate('/jobs')` instead of `/scene/{id}`

**`packages/web/src/App.tsx`** — Add routes:
```tsx
<Route path="/jobs" element={<JobsPage />} />
<Route path="/jobs/:id" element={<JobDetailPage />} />
```

**`packages/web/src/components/Layout/Header.tsx`** — Add nav link with count:
- "My Jobs" link between Gallery and Upload (auth-only)
- Reads active job count from React Query cache (`['myScenes']` key)
- Displays count badge only when cache is populated (i.e. user has visited `/jobs`)
- No separate API call from Header

### Existing Infrastructure (no changes needed)
- DynamoDB `userId-index` GSI already exists with `ALL` projection
- IAM policy already grants `index/*` access
- Scenes Lambda integration already handles all `/scenes*` routes
- JWT authorizer already configured

---

## Files Changed Summary

| File | Change |
|------|--------|
| `services/api/src/handlers/scenes.py` | Add `list_user_scenes` handler |
| `infra/modules/api/main.tf` | Add `GET /scenes/mine` route |
| `packages/web/src/api/client.ts` | Add `userId`, `settings` to interface; add `fetchMyScenes` |
| `packages/web/src/pages/JobsPage.tsx` | New file — jobs list |
| `packages/web/src/pages/JobDetailPage.tsx` | New file — job detail |
| `packages/web/src/pages/UploadPage.tsx` | Change redirect to `/jobs` |
| `packages/web/src/App.tsx` | Add `/jobs` and `/jobs/:id` routes |
| `packages/web/src/components/Layout/Header.tsx` | Add "My Jobs" nav link with count badge |

---

## Testing Plan

### Manual Testing
1. Sign in, verify "My Jobs" appears in nav
2. Upload a scene, verify redirect to `/jobs`
3. On `/jobs`, verify new scene appears with yellow pulsing badge and "Started X ago"
4. Click the row, verify `/jobs/{id}` shows progress tracker, metadata, and training params
5. Verify "Back to My Jobs" breadcrumb works
6. Verify polling updates the stage as processing progresses
7. Verify completed scenes show green badge, "Completed X ago", scene name links to viewer
8. Verify "View Splat" button on job detail navigates to `/scene/{id}`
9. Verify failed scenes show red badge, error details, and "Try Again" link
10. Verify active job count badge in nav updates after visiting `/jobs`
11. Sign out, verify "My Jobs" disappears from nav
12. Visit `/jobs` while signed out, verify sign-in form appears
