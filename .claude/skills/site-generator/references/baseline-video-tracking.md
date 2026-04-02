# Embedded Video with Media Tracking

Every demo includes a dedicated video page at `/video` with an embedded YouTube video tracked via Snowplow's YouTube Tracking Plugin. Always use this specific video:

- **YouTube URL**: https://www.youtube.com/watch?v=4ClPw87tiV0
- **YouTube Video ID**: `4ClPw87tiV0`
- **Always mute by default**

## Dependencies

```bash
npm install @snowplow/browser-plugin-youtube-tracking
```

Note: The YouTube Tracking Plugin uses the Snowplow Media Plugin under the hood, so `@snowplow/browser-plugin-media` is still needed as a peer dependency (already installed for other table stakes features).

## Plugin Setup

Register the `YouTubeTrackingPlugin` during tracker initialization in `src/lib/snowplow-config.ts`:

```typescript
import { YouTubeTrackingPlugin } from '@snowplow/browser-plugin-youtube-tracking';

newTracker('sp1', '...', {
  // ...other config
  plugins: [
    LinkClickTrackingPlugin(),
    EnhancedConsentPlugin(),
    SnowplowMediaPlugin(),
    YouTubeTrackingPlugin(),   // <-- Add this
    SignalsPlugin()
  ]
});
```

## Video Tracking Functions (`src/lib/snowplow-config.ts`)

```typescript
import {
  startYouTubeTracking,
  endYouTubeTracking
} from '@snowplow/browser-plugin-youtube-tracking';

// Start tracking a YouTube embed
export function initializeYouTubeTracking(elementId: string): string {
  const sessionId = crypto.randomUUID();
  startYouTubeTracking({
    id: sessionId,
    video: elementId,
    boundaries: [25, 50, 75, 100],
    captureEvents: ['DefaultEvents'],
  });
  return sessionId;
}

// Stop tracking (call on component unmount)
export function stopYouTubeTracking(sessionId: string) {
  endYouTubeTracking(sessionId);
}
```

## Video Page (`app/video/page.tsx`)

The video page embeds the YouTube video via an iframe. The YouTube Tracking Plugin automatically hooks into the YouTube IFrame API to track all playback events — no manual event listeners needed.

### Full implementation

```tsx
"use client"

import { useEffect, useRef } from "react"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  initializeYouTubeTracking,
  stopYouTubeTracking
} from "@/src/lib/snowplow-config"

const YOUTUBE_VIDEO_ID = "4ClPw87tiV0"
const VIDEO_TITLE = "Snowplow: Know Your Customer"
const PLAYER_ELEMENT_ID = "yt-player"

export default function VideoPage() {
  const router = useRouter()
  const trackingSessionId = useRef<string | null>(null)

  useEffect(() => {
    // Start YouTube tracking — the plugin hooks into the iframe automatically
    trackingSessionId.current = initializeYouTubeTracking(PLAYER_ELEMENT_ID)

    return () => {
      // Clean up tracking on unmount
      if (trackingSessionId.current) {
        stopYouTubeTracking(trackingSessionId.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with back button */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push('/')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Home
            </button>
            <h1 className="text-lg font-semibold text-gray-900">{VIDEO_TITLE}</h1>
            <div className="w-20" />
          </div>
        </div>
      </div>

      {/* Video container with 16:9 aspect ratio */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              id={PLAYER_ELEMENT_ID}
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?enablejsapi=1&mute=1`}
              className="absolute top-0 left-0 w-full h-full"
              title={VIDEO_TITLE}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Video Description */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">About This Video</h2>
          <p className="text-gray-600">
            Learn how Snowplow helps you truly know your customers through behavioral data collection
            and real-time insights.
          </p>
        </div>
      </div>
    </div>
  )
}
```

### Critical iframe parameters

- **`enablejsapi=1`**: Required — allows the YouTube Tracking Plugin to hook into the player via the IFrame API
- **`mute=1`**: Always mute by default

## Events tracked automatically

The YouTube Tracking Plugin handles all of this automatically — no manual event listeners:

| Event | Trigger |
|-------|---------|
| `ready` | Player loaded and ready |
| `play` | User clicks play |
| `pause` | User clicks pause |
| `end` | Video finishes |
| `seek_start` / `seek_end` | User scrubs the timeline |
| `volume_change` | User adjusts volume |
| `playback_rate_change` | User changes speed |
| `percent_progress` | Automatic at 25%, 50%, 75%, 100% boundaries |
| `buffer_start` / `buffer_end` | Buffering events |
| `quality_change` | Video quality changes |
| `ping` | Periodic heartbeat (every 30s by default) |

## Key implementation details

1. **No manual event listeners**: Unlike HTML5 `<video>`, the YouTube plugin handles everything through the YouTube IFrame API. Just call `startYouTubeTracking` with the iframe's element ID.

2. **`enablejsapi=1` is mandatory**: Without this URL parameter on the iframe src, the YouTube IFrame API won't load and tracking will silently fail.

3. **`mute=1` always**: The video must be muted by default for all demos.

4. **Session ID**: `startYouTubeTracking` takes a unique session ID (use `crypto.randomUUID()`). Pass the same ID to `endYouTubeTracking` on cleanup.

5. **16:9 aspect ratio**: Use `paddingBottom: '56.25%'` on a relative container with the iframe absolutely positioned inside.

6. **Cleanup on unmount**: Always call `endYouTubeTracking()` when the component unmounts to prevent memory leaks and stale tracking.

## Footer button

```tsx
<button
  onClick={() => router.push('/video')}
  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
  title="Watch our demo video"
>
  <Play className="h-3 w-3 mr-1.5" />
  Watch Video
</button>
```
