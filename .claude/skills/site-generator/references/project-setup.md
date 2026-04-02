# Project Setup & Scaffolding

## Create the Next.js project

```bash
npx create-next-app@latest demo-[vertical]-web --typescript --tailwind --eslint --app --src-dir --no-turbopack --import-alias "@/*"
cd demo-[vertical]-web
```

## Install Snowplow dependencies

```bash
# Core tracker
npm install @snowplow/browser-tracker

# Table stakes plugins
npm install @snowplow/browser-plugin-link-click-tracking
npm install @snowplow/browser-plugin-enhanced-consent
npm install @snowplow/browser-plugin-media
npm install @snowplow/browser-plugin-youtube-tracking

# Signals
npm install @snowplow/signals-browser-plugin

# UI utilities
npm install lucide-react class-variance-authority clsx tailwind-merge
```

## Optional dependencies (only install when requested)

```bash
# Form tracking (if demo has forms)
npm install @snowplow/browser-plugin-form-tracking

# Web vitals (if core web vitals are relevant)
npm install @snowplow/browser-plugin-web-vitals

# Signals server-side (if server-side personalization is needed)
npm install @snowplow/signals-node

# Snowtype (if using data products / custom schemas)
npm install --save-dev @snowplow/snowtype
```

## Directory structure to create

```bash
mkdir -p src/components src/hooks src/lib src/styles src/contexts src/types
mkdir -p public/videos public/images/logos
mkdir -p app/video
```

## Required files to create

These files implement the table stakes features. Create them in this order:

1. `src/lib/utils.ts` — cn() utility + buildUrlWithUtm()
2. `src/lib/config.ts` — SiteConfig with brand, navigation, UTM, features
3. `src/lib/consent.ts` — Consent state management utilities
4. `src/lib/snowplow-config.ts` — Tracker initialization and all tracking functions
5. `src/hooks/use-snowplow-tracking.ts` — Page view tracking hook
6. `src/components/snowplow-init.tsx` — Client-side provider component
7. `src/components/consent-manager.tsx` — Consent modal component
8. `src/components/footer.tsx` — Footer with UTM, Consent, Signals, Video buttons
9. `src/components/header.tsx` — Site header (vertical-specific)
10. `app/layout.tsx` — Root layout with SnowplowInit
11. `app/video/page.tsx` — Video page with media tracking
12. `app/page.tsx` — Home page (vertical-specific)

## .env.example

Create a `.env.example` with:

```env
# Snowplow Console API (only needed if using Snowtype)
SNOWPLOW_CONSOLE_API_KEY=YOUR-CONSOLE-API-KEY
SNOWPLOW_CONSOLE_API_KEY_ID=YOUR-CONSOLE-API-KEY-ID
```

## Brand CSS Variables

In `src/styles/globals.css`, after the Tailwind imports, define brand colors as CSS custom properties. Choose colors that fit the demo vertical — do NOT default to Snowplow purple.

```css
@import "tailwindcss";

@theme {
  --color-brand-primary: #XXXXXX;
  --color-brand-primary-hover: #XXXXXX;
  --color-brand-primary-dark: #XXXXXX;
  --color-brand-primary-light: #XXXXXX;
}
```

Always keep the `brand-primary` variable name for consistency across demos — the components reference it — but pick colors appropriate to the vertical (e.g., greens for fintech, warm tones for travel, etc.).

## postcss.config.mjs

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

## Video file

Place a demo video in `public/videos/`. The default Snowplow demo video is:
- Filename: `snowplow_customer_data_infrastructure_1080p.mp4`
- This can be any .mp4 file — swap it for something relevant to the vertical if available

## Package.json scripts

Ensure these scripts are present:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```
