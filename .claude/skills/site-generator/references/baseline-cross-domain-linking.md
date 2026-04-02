# Cross-Domain Linking

Cross-domain linking demonstrates Snowplow's ability to stitch user journeys across domains. In demos, we link to `snowplow.io` with the Snowplow cross-domain parameter (`_sp`).

## How it works

1. User clicks a link to `snowplow.io` (e.g., Privacy Policy or Snowplow.io link in footer)
2. The `crossDomainLinker` function checks if the link hostname matches `snowplow.io`
3. If it matches, Snowplow appends a `_sp` parameter to the URL containing the `domain_userid` and a timestamp
4. When the user lands on `snowplow.io`, Snowplow's enrichment captures this as:
   - `refr_domain_userid` — the previous site's user ID
   - `refr_dvce_tstamp` — the previous site's device timestamp
5. This allows stitching the user's journey across both domains

## Tracker Configuration

Cross-domain linking is configured in two places:

### 1. Initial config (static links)

In `newTracker()`:

```typescript
newTracker('sp1', 'https://com-snplow-sales-aws-prod1.collector.snplow.net', {
  // ...other config
  crossDomainLinker: function (linkElement) {
    return linkElement.hostname === 'snowplow.io';
  }
});
```

### 2. Dynamic links (after initialization)

For links added to the DOM after tracker initialization:

```typescript
export function enableCrossDomainLinking() {
  if (typeof window !== 'undefined' && (window as any).snowplow) {
    (window as any).snowplow('crossDomainLinker', function (linkElement: HTMLAnchorElement) {
      return linkElement.hostname === 'snowplow.io';
    });
  }
}
```

This is called in the `SnowplowInit` after initialization:

```typescript
useEffect(() => {
  initializeSnowplowOnly();
  enableCrossDomainLinking();
}, []);
```

## _sp Parameter Cleanup

After tracking a page view, clean up the `_sp` parameter from the URL to prevent users from accidentally sharing tracking parameters:

```typescript
export function trackPageViewEvent() {
  trackPageView();

  // Clean up _sp parameter
  if (typeof window !== 'undefined' && /[?&]_sp=/.test(window.location.href)) {
    const cleanUrl = window.location.href.replace(/&?_sp=[^&]+/, '');
    history.replaceState(history.state, "", cleanUrl);
  }
}
```

## Footer Implementation

Cross-domain links in the footer should have a visual indicator:

```tsx
{siteConfig.navigation.footerLinks
  .filter(link => link.category === 'legal')
  .map((link) => (
    <a
      key={link.name}
      href={link.href}
      className={`text-gray-400 hover:text-white text-sm transition-colors ${
        link.href.includes('snowplow.io') ? 'relative group' : ''
      }`}
      title={link.href.includes('snowplow.io') ? 'Cross-domain tracking enabled' : undefined}
    >
      {link.name}
      {link.href.includes('snowplow.io') && (
        <span className="ml-1 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
          ↗
        </span>
      )}
    </a>
  ))}
```

## Site Config

Ensure footer links include at least one `snowplow.io` link:

```typescript
footerLinks: [
  // ...other links
  { name: "Privacy Policy", href: "https://snowplow.io/privacy-policy/", category: "legal" },
  { name: "Snowplow.io", href: "https://snowplow.io", category: "legal" }
]
```

## What to tell the prospect

During the demo, explain:
- "When you click this link to snowplow.io, notice how the `_sp` parameter is appended to the URL"
- "This parameter contains the user's domain_userid from this site"
- "Snowplow's enrichment on the receiving site captures this, allowing us to stitch the user journey across both domains"
- "The parameter is cleaned up from the URL after tracking, so users won't accidentally share tracking data"
