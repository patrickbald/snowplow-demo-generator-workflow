# Snowplow Tracker Setup

## Tracker Initialization (`src/lib/snowplow-config.ts`)

The tracker is initialized once via the `SnowplowInit` component. It must NOT track a page view during initialization — page views are handled separately by the `useSnowplowTracking` hook.

### Core initialization function

```typescript
import {
  newTracker,
  trackPageView,
  enableActivityTracking,
  setUserId,
  enableAnonymousTracking,
  disableAnonymousTracking
} from '@snowplow/browser-tracker';
import { LinkClickTrackingPlugin, enableLinkClickTracking } from '@snowplow/browser-plugin-link-click-tracking';
import {
  EnhancedConsentPlugin,
  trackConsentAllow,
  trackConsentDeny,
  trackConsentSelected,
  trackConsentWithdrawn,
  trackCmpVisible
} from '@snowplow/browser-plugin-enhanced-consent';
import { SnowplowMediaPlugin } from '@snowplow/browser-plugin-media';
import { YouTubeTrackingPlugin } from '@snowplow/browser-plugin-youtube-tracking';
import {
  SignalsPlugin,
  addInterventionHandlers,
  subscribeToInterventions
} from '@snowplow/signals-browser-plugin';
import { hasAnalyticsConsent, isSignalsEnabled } from './consent';

export function initializeSnowplow() {
  newTracker('sp1', 'https://com-snplow-sales-aws-prod1.collector.snplow.net', {
    // 127.0.0.1:9090 - Localhost
    // https://6fe5577d-d544-473f-93a8-eedd9c07b288.apps.snowplowanalytics.com - Hosted Micro
    // https://com-snplow-sales-aws-prod1.collector.snplow.net - Prod
    appId: 'demo-[VERTICAL]-[PLATFORM]',    // UPDATE per demo
    appVersion: '1.0.0',
    cookieSameSite: 'Lax',
    eventMethod: 'post',
    bufferSize: 1,
    contexts: {
      webPage: true
    },
    plugins: [
      LinkClickTrackingPlugin(),
      EnhancedConsentPlugin(),
      SnowplowMediaPlugin(),
      YouTubeTrackingPlugin(),
      SignalsPlugin()
    ],
    crossDomainLinker: function (linkElement) {
      return linkElement.hostname === 'snowplow.io';
    }
  });

  // Enable activity tracking (page pings) — MUST be before first trackPageView
  enableActivityTracking({
    minimumVisitLength: 20,
    heartbeatDelay: 10
  });

  // Enable link click tracking
  enableLinkClickTracking({
    trackContent: true
  });

  // Configure anonymous tracking based on consent
  configureAnonymousTracking();

  // Set up Signals intervention handlers
  setupSignalsInterventions();
}

// Initialize tracker only (no page view) — called by SnowplowInit
export function initializeSnowplowOnly() {
  initializeSnowplow();
}
```

### Key rules

1. **Plugin registration**: Plugins are passed in the `plugins` array during `newTracker()`. They cannot be added later.
2. **Activity tracking before page views**: `enableActivityTracking()` must be called before the first `trackPageView()`.
3. **`webPage: true`**: Always enable this context. It provides the `web_page` entity with a unique page view ID, essential for joining events to page views in the warehouse.
4. **`bufferSize: 1`**: Send events immediately for demo purposes. In production you might increase this.
5. **`eventMethod: 'post'`**: Use POST to avoid URL length limits and batch events.

## Page View Tracking Hook (`src/hooks/use-snowplow-tracking.ts`)

This hook automatically tracks page views on route changes in Next.js App Router:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageViewEvent } from '@/src/lib/snowplow-config';

export function useSnowplowTracking() {
  const pathname = usePathname();
  const lastPathnameRef = useRef<string>('');
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    if (pathname && (isInitialMount.current || pathname !== lastPathnameRef.current)) {
      trackPageViewEvent();
      lastPathnameRef.current = pathname;
      isInitialMount.current = false;
    }
  }, [pathname]);
}
```

### Why refs?

- `lastPathnameRef` prevents duplicate page views if the effect re-runs with the same pathname
- `isInitialMount` ensures the first page view fires on mount (not just on subsequent route changes)

## Page View Function

The `trackPageViewEvent()` function handles page view tracking and `_sp` parameter cleanup:

```typescript
export function trackPageViewEvent() {
  trackPageView();

  // Clean up _sp parameter from URL after page view is tracked
  if (typeof window !== 'undefined' && /[?&]_sp=/.test(window.location.href)) {
    const cleanUrl = window.location.href.replace(/&?_sp=[^&]+/, '');
    history.replaceState(history.state, "", cleanUrl);
  }
}
```

If the demo has content entities (like articles), you can extend this to attach context:

```typescript
export function trackPageViewEvent() {
  // Optionally attach entity context based on current page
  const context = getPageContext(); // vertical-specific logic

  if (context) {
    trackPageView({ context: [context] });
  } else {
    trackPageView();
  }

  // Clean up _sp parameter
  if (typeof window !== 'undefined' && /[?&]_sp=/.test(window.location.href)) {
    const cleanUrl = window.location.href.replace(/&?_sp=[^&]+/, '');
    history.replaceState(history.state, "", cleanUrl);
  }
}
```

## SnowplowInit Component (`src/components/snowplow-provider.tsx`)

```typescript
'use client';

import { useEffect } from 'react';
import { initializeSnowplowOnly, enableCrossDomainLinking } from '@/src/lib/snowplow-config';
import { useSnowplowTracking } from '@/src/hooks/use-snowplow-tracking';

interface SnowplowInitProps {
  children: React.ReactNode;
}

export default function SnowplowInit({ children }: SnowplowInitProps) {
  useEffect(() => {
    initializeSnowplowOnly();
    enableCrossDomainLinking();
  }, []);

  // Track page views on route changes
  useSnowplowTracking();

  return <>{children}</>;
}
```

### Provider responsibilities:
1. Initialize tracker (once, on mount)
2. Enable cross-domain linking for dynamic links
3. Track page views on route changes via the hook

### Provider does NOT:
- Track page views during initialization
- Render any UI
- Manage state

## Root Layout Integration (`app/layout.tsx`)

```tsx
import SnowplowInit from "@/src/components/snowplow-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SnowplowInit>
          {children}
        </SnowplowInit>
      </body>
    </html>
  );
}
```

The layout is a server component. Only the `SnowplowInit` is a client component (marked with `'use client'`).

## User ID Management

If the demo includes login/user accounts:

```typescript
export function setUserForTracking(email: string) {
  setUserId(email);
}

export function clearUserForTracking() {
  setUserId(null);
}
```

Store user state in localStorage and restore on initialization if needed.

## Anonymous Tracking (Consent Integration)

```typescript
function configureAnonymousTracking() {
  if (typeof window === 'undefined') return;

  if (!hasAnalyticsConsent()) {
    enableAnonymousTracking({
      options: {
        withServerAnonymisation: true,
        withSessionTracking: true
      }
    });
  } else {
    disableAnonymousTracking();
  }
}

export function enableAnonymousTrackingMode() {
  enableAnonymousTracking({
    options: {
      withServerAnonymisation: true,
      withSessionTracking: true
    }
  });
}

export function disableAnonymousTrackingMode() {
  disableAnonymousTracking();
}
```

- `withServerAnonymisation: true` prevents the collector from setting network_userid cookie and capturing IP
- `withSessionTracking: true` keeps session tracking for basic page flow even in anonymous mode
