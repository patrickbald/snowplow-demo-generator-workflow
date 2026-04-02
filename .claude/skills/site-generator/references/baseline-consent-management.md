# Consent Management

Consent management is a table stakes feature for every demo. It demonstrates Snowplow's privacy-first approach with the Enhanced Consent Plugin and anonymous tracking.

## Consent Utilities (`src/lib/consent.ts`)

This module manages consent state in localStorage. It has no Snowplow dependencies — it's pure state management.

```typescript
export interface ConsentPreferences {
  necessary: boolean    // Always true, cannot be disabled
  analytics: boolean    // Controls Snowplow full vs anonymous tracking
  marketing: boolean    // Controls ad personalization (if applicable)
  preferences: boolean  // Controls preference persistence
}

// localStorage keys used:
// - "consent-given"       → "true" if any consent recorded
// - "consent-preferences" → JSON stringified ConsentPreferences
// - "consent-date"        → ISO timestamp of last consent action

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  const consentGiven = localStorage.getItem("consent-given")
  if (!consentGiven) return false
  const savedPreferences = localStorage.getItem("consent-preferences")
  if (!savedPreferences) return false
  try {
    const preferences = JSON.parse(savedPreferences)
    return preferences.analytics === true
  } catch {
    return false
  }
}

export function hasMarketingConsent(): boolean {
  if (typeof window === 'undefined') return false
  const consentGiven = localStorage.getItem("consent-given")
  if (!consentGiven) return false
  const savedPreferences = localStorage.getItem("consent-preferences")
  if (!savedPreferences) return false
  try {
    const preferences = JSON.parse(savedPreferences)
    return preferences.marketing === true
  } catch {
    return false
  }
}

export function getConsentPreferences(): ConsentPreferences | null {
  if (typeof window === 'undefined') return null
  const savedPreferences = localStorage.getItem("consent-preferences")
  if (!savedPreferences) return null
  try {
    return JSON.parse(savedPreferences)
  } catch {
    return null
  }
}

export function saveConsentPreferences(preferences: ConsentPreferences): void {
  if (typeof window === 'undefined') return
  localStorage.setItem("consent-given", "true")
  localStorage.setItem("consent-preferences", JSON.stringify(preferences))
  localStorage.setItem("consent-date", new Date().toISOString())
}

export function hasConsentBeenGiven(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem("consent-given") === "true"
}

export function clearConsentData(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem("consent-given")
  localStorage.removeItem("consent-preferences")
  localStorage.removeItem("consent-date")
}
```

## Enhanced Consent Plugin Tracking Functions (in `src/lib/snowplow-config.ts`)

These wrapper functions standardize the consent event payload:

```typescript
import {
  EnhancedConsentPlugin,
  trackConsentAllow,
  trackConsentDeny,
  trackConsentSelected,
  trackConsentWithdrawn,
  trackCmpVisible
} from '@snowplow/browser-plugin-enhanced-consent';

export function trackConsentAllowEvent(consentScopes: string[]) {
  trackConsentAllow({
    consentScopes,
    basisForProcessing: "consent",
    consentUrl: window.location.origin + "/privacy-policy",
    consentVersion: "1.0",
    domainsApplied: [window.location.hostname],
    gdprApplies: true
  });
}

export function trackConsentDenyEvent(consentScopes: string[]) {
  trackConsentDeny({
    consentScopes,
    basisForProcessing: "consent",
    consentUrl: window.location.origin + "/privacy-policy",
    consentVersion: "1.0",
    domainsApplied: [window.location.hostname],
    gdprApplies: true
  });
}

export function trackConsentSelectedEvent(consentScopes: string[]) {
  trackConsentSelected({
    consentScopes,
    basisForProcessing: "consent",
    consentUrl: window.location.origin + "/privacy-policy",
    consentVersion: "1.0",
    domainsApplied: [window.location.hostname],
    gdprApplies: true
  });
}

export function trackConsentWithdrawnEvent(consentScopes: string[]) {
  trackConsentWithdrawn({
    consentScopes,
    basisForProcessing: "consent",
    consentUrl: window.location.origin + "/privacy-policy",
    consentVersion: "1.0",
    domainsApplied: [window.location.hostname],
    gdprApplies: true
  });
}

export function trackCmpVisibleEvent() {
  trackCmpVisible({
    elapsedTime: performance.now(),
  });
}
```

## Consent Manager Component (`src/components/consent-manager.tsx`)

The consent manager renders as a modal overlay. It is NOT shown on mount by default — it's triggered via a custom DOM event.

### How it's triggered

From the footer's "Manage Consent" button:
```typescript
window.dispatchEvent(new CustomEvent('showConsentManager'))
```

### Component structure

The component has two views:
1. **Initial view**: Simple banner with Accept All, Reject All, Customize buttons
2. **Settings view**: Granular toggles for each consent category

### Key behaviors

- **Accept All**: Sets all preferences to true, disables anonymous tracking, tracks `trackConsentAllow` with all scopes
- **Reject All**: Sets only necessary to true, enables anonymous tracking with server anonymisation, tracks `trackConsentDeny` with only "necessary"
- **Save Preferences**: Saves custom selection, enables/disables anonymous tracking based on analytics consent, tracks `trackConsentSelected` with selected scopes
- **CMP Visible**: Tracked when the consent modal is shown via `trackCmpVisible` with `elapsedTime: performance.now()`

### Implementation

```tsx
"use client"

import { useState, useEffect } from "react"
import { X, Settings, Shield, Target, Cookie, BarChart3 } from "lucide-react"
import {
  trackConsentAllowEvent,
  trackConsentDenyEvent,
  trackConsentSelectedEvent,
  trackCmpVisibleEvent,
  enableAnonymousTrackingMode,
  disableAnonymousTrackingMode
} from "@/src/lib/snowplow-config"
import {
  ConsentPreferences,
  getConsentPreferences,
  saveConsentPreferences
} from "@/src/lib/consent"

export default function ConsentManager() {
  const [showConsent, setShowConsent] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false
  })

  useEffect(() => {
    const savedPreferences = getConsentPreferences()
    if (savedPreferences) {
      setPreferences(savedPreferences)
    }

    const handleShowConsentManager = () => {
      setShowConsent(true)
      trackCmpVisibleEvent()
    }

    window.addEventListener('showConsentManager', handleShowConsentManager)
    return () => {
      window.removeEventListener('showConsentManager', handleShowConsentManager)
    }
  }, [])

  const handleAcceptAll = () => {
    const allAccepted: ConsentPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true
    }
    setPreferences(allAccepted)
    saveConsentPreferences(allAccepted)
    setShowConsent(false)
    disableAnonymousTrackingMode()
    trackConsentAllowEvent(["necessary", "analytics", "marketing", "preferences"])
  }

  const handleRejectAll = () => {
    const minimalConsent: ConsentPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false
    }
    setPreferences(minimalConsent)
    saveConsentPreferences(minimalConsent)
    setShowConsent(false)
    enableAnonymousTrackingMode()
    trackConsentDenyEvent(["necessary"])
  }

  const handleSavePreferences = () => {
    saveConsentPreferences(preferences)
    setShowConsent(false)
    setShowSettings(false)
    if (preferences.analytics) {
      disableAnonymousTrackingMode()
    } else {
      enableAnonymousTrackingMode()
    }
    const consentScopes = Object.entries(preferences)
      .filter(([, value]) => value)
      .map(([key]) => key)
    trackConsentSelectedEvent(consentScopes)
  }

  const handlePreferenceChange = (key: keyof ConsentPreferences, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  if (!showConsent && !showSettings) return null

  // Render modal with backdrop blur
  // Two views: initial consent banner and detailed settings
  // Use brand-primary color for Accept/Save buttons
  // Necessary checkbox is always checked and disabled
}
```

### Where to place it

The `ConsentManager` component should be rendered globally, either:
- In the root layout (as a sibling to the page content)
- Inside a `PageLayout` component that wraps all pages

It should be accessible from every page via the footer's "Manage Consent" button.

## Anonymous Tracking Integration

The consent state directly controls Snowplow's anonymous tracking mode:

| Consent State | Tracking Mode | Effect |
|--------------|---------------|--------|
| Analytics accepted | Full tracking | network_userid cookie set, IP captured |
| Analytics denied | Anonymous + server anonymisation | No network_userid, no IP, session tracking preserved |
| No consent given yet | Anonymous + server anonymisation | Default safe state |

This is configured in `snowplow-config.ts`:

```typescript
function configureAnonymousTracking() {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent()) {
    enableAnonymousTracking({
      options: { withServerAnonymisation: true, withSessionTracking: true }
    });
  } else {
    disableAnonymousTracking();
  }
}
```
