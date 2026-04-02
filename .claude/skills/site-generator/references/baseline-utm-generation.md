# UTM Generation

UTM generation simulates marketing campaign traffic for demos. It's controlled by a "UTM Reload" button in the footer that generates random UTM parameters and reloads the page, creating a new Snowplow session.

## How it works

1. User clicks "UTM Reload" in footer
2. `newSession()` is called to reset the Snowplow session
3. Random source/medium pair and campaign are selected from config
4. Current URL is rebuilt with UTM parameters
5. Page reloads with new URL — Snowplow's Campaign Attribution Enrichment captures the UTMs

## UTM Configuration (`src/lib/config.ts`)

The UTM config has two parts:
- **Sources**: Pairs of source + medium that represent traffic channels. These are generic and should NOT change between demos.
- **Campaigns**: Campaign names themed to the demo vertical. UPDATE these for each new demo.

```typescript
marketing: {
  utmParameters: {
    // Generic source/medium pairs — DO NOT modify per demo
    sources: [
      { source: "google", medium: "cpc", name: "Google Ads" },
      { source: "google", medium: "organic", name: "Google Search" },
      { source: "facebook", medium: "paid_social", name: "Facebook Ads" },
      { source: "facebook", medium: "social", name: "Facebook Shares" },
      { source: "linkedin", medium: "paid_social", name: "LinkedIn Ads" },
      { source: "linkedin", medium: "social", name: "LinkedIn Shares" },
      { source: "twitter", medium: "social", name: "Twitter" },
      { source: "newsletter", medium: "email", name: "Email Newsletter" },
      { source: "slack", medium: "referral", name: "Slack" },
      { source: "direct", medium: "", name: "Direct" },
      { source: "substack", medium: "email", name: "Substack" },
      { source: "reddit", medium: "social", name: "Reddit" },
      { source: "medium_com", medium: "referral", name: "Medium" }
    ],

    // UPDATE these per demo to match the vertical theme
    campaigns: [
      "spring_sale_2025",
      "new_collection_launch",
      "loyalty_program_promo",
      "holiday_gift_guide",
      "clearance_event",
      "vip_early_access"
    ]
  }
}
```

## Random UTM Selection (`src/lib/config.ts`)

```typescript
export function getRandomUtmParameters() {
  const sources = siteConfig.marketing.utmParameters.sources
  const campaigns = siteConfig.marketing.utmParameters.campaigns

  const randomSource = sources[Math.floor(Math.random() * sources.length)]
  const randomCampaign = campaigns[Math.floor(Math.random() * campaigns.length)]

  return {
    source: randomSource.source,
    medium: randomSource.medium,
    campaign: randomCampaign,
    sourceName: randomSource.name
  }
}
```

## URL Builder (`src/lib/utils.ts`)

The `buildUrlWithUtm()` function constructs URLs with UTM parameters. It supports all parameters that Snowplow's Campaign Attribution Enrichment can capture, including click IDs.

```typescript
export function buildUrlWithUtm(url: string, utmParams: {
  source: string
  medium: string
  campaign: string
  term?: string
  content?: string
  gclid?: string      // Google Click ID
  msclkid?: string    // Microsoft Click ID
  dclid?: string      // DoubleClick Click ID
}): string {
  const urlObj = new URL(url, window.location.origin)

  urlObj.searchParams.set('utm_source', utmParams.source)
  urlObj.searchParams.set('utm_medium', utmParams.medium)
  urlObj.searchParams.set('utm_campaign', utmParams.campaign)

  if (utmParams.term) urlObj.searchParams.set('utm_term', utmParams.term)
  if (utmParams.content) urlObj.searchParams.set('utm_content', utmParams.content)
  if (utmParams.gclid) urlObj.searchParams.set('gclid', utmParams.gclid)
  if (utmParams.msclkid) urlObj.searchParams.set('msclkid', utmParams.msclkid)
  if (utmParams.dclid) urlObj.searchParams.set('dclid', utmParams.dclid)

  return urlObj.toString()
}
```

## Footer Integration

The UTM Reload button in the footer:

```tsx
import { newSession } from "@snowplow/browser-tracker"
import { getRandomUtmParameters } from "@/src/lib/config"
import { buildUrlWithUtm } from "@/src/lib/utils"

const handleUtmReload = () => {
  // Reset the Snowplow session so the new UTMs start a fresh session
  newSession()

  const currentUrl = window.location.href
  const utmParams = getRandomUtmParameters()
  const urlWithUtm = buildUrlWithUtm(currentUrl, utmParams)
  window.location.href = urlWithUtm
}
```

Button rendering (inside the footer's bottom bar):

```tsx
<button
  onClick={handleUtmReload}
  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
  title="Reload with UTM parameters for marketing tracking"
>
  <RefreshCw className="h-3 w-3 mr-1.5" />
  UTM Reload
</button>
```

## How Snowplow captures UTMs

Snowplow's Campaign Attribution Enrichment automatically extracts UTM parameters from the page URL referer. The enrichment maps:

| URL Parameter | Snowplow Field |
|--------------|----------------|
| utm_source | mkt_source |
| utm_medium | mkt_medium |
| utm_campaign | mkt_campaign |
| utm_term | mkt_term |
| utm_content | mkt_content |
| gclid | mkt_clickid (mkt_network = "Google") |
| msclkid | mkt_clickid (mkt_network = "Microsoft") |
| dclid | mkt_clickid (mkt_network = "DoubleClick") |

No additional tracker configuration is needed — the enrichment handles everything server-side.

## Feature flag

The UTM Reload button should be gated by the `features.utmParameters` flag in the site config:

```tsx
{siteConfig.features.utmParameters && (
  <button onClick={handleUtmReload}>...</button>
)}
```
