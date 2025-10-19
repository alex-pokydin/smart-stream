# Real-Time Camera Preview Feature

## Overview

This document describes the implementation of the real-time camera preview feature for the smart-stream application. This feature allows users to view live camera feeds directly on the Cameras page.

## Implementation Details

### Backend Changes

#### 1. New Snapshot Endpoint (`apps/backend/src/routes/cameras.ts`)

Added a new endpoint to serve camera snapshots:

```
GET /api/v1/cameras/:hostname/snapshot
```

**Features:**
- Retrieves snapshot URI from camera via ONVIF protocol
- Proxies the image through the backend (avoids CORS issues)
- Adds cache-control headers to prevent stale images
- Handles errors gracefully with proper error messages

**How it works:**
1. Validates the hostname parameter
2. Retrieves camera credentials from database
3. Connects to camera via ONVIF service
4. Gets the snapshot URI using `onvif.getCameraSnapshot()`
5. Fetches the image using axios with authentication
6. Proxies the image back to the frontend

### Frontend Changes

#### 1. API Service Update (`apps/frontend/src/services/api.ts`)

Added new method to the camera service:

```typescript
getSnapshotUrl(hostname: string): string
```

Returns the full URL for fetching camera snapshots, handling Home Assistant ingress paths correctly.

#### 2. CameraPreview Component (`apps/frontend/src/components/CameraPreview.tsx`)

A new React component that displays live camera feeds.

**Features:**
- **Auto-refresh**: Automatically fetches new snapshots at configurable intervals (default: 1000ms / 1 FPS)
- **Pause/Resume**: Users can pause the live feed
- **Fullscreen**: Supports fullscreen viewing
- **Error Handling**: Displays error messages and retry button if snapshot fails
- **Live Indicator**: Shows "Live" badge and timestamp
- **Loading State**: Shows spinner while loading images
- **Responsive**: Maintains 16:9 aspect ratio

**Props:**
- `hostname`: Camera hostname to display
- `refreshInterval`: Milliseconds between snapshot updates (default: 1000)
- `className`: Additional CSS classes
- `showControls`: Show/hide control overlay (default: true)

#### 3. Cameras Page Update (`apps/frontend/src/pages/Cameras.tsx`)

Integrated the preview feature into the cameras list:

**Changes:**
- Added `Video` and `VideoOff` icons from lucide-react
- Added state to track which cameras are showing preview
- Added preview toggle button for each camera
- Displays `CameraPreview` component when toggled on

**User Experience:**
1. Click the video icon button on any camera card
2. Preview expands below the camera information
3. Live feed updates automatically (1 FPS)
4. Click video-off icon to hide preview

## Usage

### For End Users

1. **View Camera Preview:**
   - Navigate to the Cameras page
   - Click the video camera icon (📹) on any configured camera
   - The live preview will appear below the camera details

2. **Control Preview:**
   - **Pause/Resume**: Click the refresh icon in the preview overlay
   - **Fullscreen**: Click the maximize icon in the preview overlay
   - **Hide Preview**: Click the video-off icon (📹̷) in the camera card header

3. **Multiple Previews:**
   - You can show multiple camera previews simultaneously
   - Each preview updates independently

### For Developers

#### Adding Preview to Other Pages

```tsx
import CameraPreview from '@/components/CameraPreview';

// In your component:
<CameraPreview 
  hostname="192.168.1.100"
  refreshInterval={1000}  // 1 FPS
  showControls={true}
/>
```

#### Adjusting Refresh Rate

For higher quality (more frequent updates):
```tsx
<CameraPreview refreshInterval={500} />  // 2 FPS
```

For lower bandwidth usage:
```tsx
<CameraPreview refreshInterval={2000} />  // 0.5 FPS
```

#### Customizing Appearance

```tsx
<CameraPreview 
  hostname="camera1"
  className="max-w-md shadow-lg"
  showControls={false}  // Hide controls for cleaner look
/>
```

## Technical Considerations

### Performance

- **Bandwidth**: Each camera uses approximately 100-500 KB/s depending on image quality and refresh rate
- **Multiple Cameras**: Showing 4 cameras simultaneously at 1 FPS uses ~400-2000 KB/s total
- **Backend Load**: Minimal - acts as a simple proxy

### Limitations

- **Frame Rate**: Limited to snapshot-based updates (not true streaming)
- **Latency**: Typically 1-2 seconds behind real-time
- **ONVIF Requirement**: Camera must support ONVIF snapshot URI

### Future Enhancements

Potential improvements for future versions:

1. **MJPEG Streaming**: Implement true MJPEG stream for smoother playback
2. **HLS Streaming**: Add HLS support for lower latency and better quality
3. **WebRTC**: Real-time streaming with sub-second latency
4. **Motion Detection**: Highlight when motion is detected
5. **PTZ Controls**: Pan, tilt, zoom controls for supported cameras
6. **Recording**: Save snapshots or video clips
7. **Grid View**: Display multiple cameras in a grid layout
8. **Audio**: Add audio support for cameras with microphones

## API Reference

### Backend Endpoint

```
GET /api/v1/cameras/:hostname/snapshot
```

**Parameters:**
- `hostname` (path): Camera hostname or IP address

**Response:**
- Success: Image binary data (image/jpeg)
- Error: JSON with error details

**Example:**
```bash
curl http://localhost:8080/api/v1/cameras/192.168.1.100/snapshot \
  -o snapshot.jpg
```

### Frontend API

```typescript
// Get snapshot URL
const snapshotUrl = cameraService.getSnapshotUrl('192.168.1.100');

// Use in img tag with auto-refresh
<img src={`${snapshotUrl}?t=${Date.now()}`} />
```

## Testing

### Manual Testing Steps

1. **Test Single Preview:**
   - Add a camera
   - Click preview button
   - Verify image loads and updates

2. **Test Multiple Previews:**
   - Show previews for 2-3 cameras
   - Verify all update independently
   - Check performance remains acceptable

3. **Test Controls:**
   - Pause preview - verify it stops updating
   - Resume preview - verify it starts updating again
   - Fullscreen - verify it displays correctly

4. **Test Error Handling:**
   - Stop camera or disconnect network
   - Verify error message displays
   - Click retry - verify it attempts to reconnect

5. **Test Responsiveness:**
   - Resize browser window
   - Verify preview maintains aspect ratio
   - Test on mobile viewport

## Troubleshooting

### Preview Not Loading

1. **Check Camera Connection:**
   - Click "Test Connection" button
   - Verify camera is accessible

2. **Check ONVIF Support:**
   - Ensure camera supports ONVIF protocol
   - Verify snapshot URI is available

3. **Check Browser Console:**
   - Open developer tools
   - Look for network errors or CORS issues

4. **Check Backend Logs:**
   - Look for ONVIF connection errors
   - Check for snapshot URI retrieval failures

### Poor Performance

1. **Reduce Refresh Rate:**
   - Lower `refreshInterval` to 2000ms or higher

2. **Limit Concurrent Previews:**
   - Close previews you're not actively watching

3. **Check Network Bandwidth:**
   - Verify adequate network capacity
   - Consider lower resolution settings on camera

## Security Considerations

- **Authentication**: Snapshot endpoint uses existing camera credentials
- **Proxy**: Backend proxies images to avoid exposing camera URLs to frontend
- **CORS**: No CORS issues as images are served from same origin
- **Rate Limiting**: Consider adding rate limiting to prevent abuse

## Conclusion

The real-time camera preview feature provides a convenient way to monitor cameras directly from the web interface. It uses a simple snapshot-based approach that works reliably across different camera models while maintaining good performance and user experience.

