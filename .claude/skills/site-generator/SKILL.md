---
name: site-generator
description: Create Snowplow demo websites with all baseline functionality. Use this skill when the user asks to build a new demo website, create a demo for a prospect, scaffold a Snowplow demo site, or build a demo for any industry vertical (e.g., ecommerce, travel, gaming, fintech, healthcare). Also triggers when someone says "new demo", "build a demo site", "create a demo for [company/vertical]", "scaffold a demo", or "demo website". This skill ensures every demo includes UTM generation, consent management, Snowplow Signals toggle, embedded video with media tracking, and cross-domain linking — implemented consistently using proven patterns.
---

# Snowplow Demo Website Creator

This skill guides the creation of Snowplow demo websites. Every demo must include all baseline functionality implemented consistently, plus basic Snowplow tracking out of the box.

---

## Prerequisites Check

Before starting the conversation flow, check whether the `frontend-design` skill is available. If it is NOT listed in your available skills, inform the user:

> **Recommended skill missing:** This demo creator works best with the `frontend-design` skill, which ensures polished, distinctive UI design. Without it, the generated interfaces may look generic. Please install the `frontend-design` skill and restart the conversation for best results.

Then continue with the conversation flow — do not block on this, but remind the user again when you reach the design/build phase.

---

## Collaborative Build Process

This skill uses a phased, collaborative approach rather than asking all questions upfront. Work through three phases, checking in with the user at each stage. If the user's initial prompt already covers some of these topics, skip those questions. Use multiple choice options where possible to make it easy to respond.

---

### Phase 1: Discovery (gather essentials before any work)

Ask these questions ONE AT A TIME. Wait for each answer before asking the next.

**Question 1: Industry / Subject**
> What industry and (optionally) company should the demo be modeled after?
>
> Examples:
> - A) Media & Publishing (e.g., Bloomberg, NYT)
> - B) Retail / Ecommerce (e.g., Nordstrom, Nike)
> - C) Travel & Hospitality (e.g., Booking.com, Airbnb)
> - D) Gaming (e.g., Steam, Epic Games)
> - E) Financial Services (e.g., Fidelity, Stripe)
> - F) Healthcare / Pharma
> - G) Other (please describe)

**Question 2: Use Cases**
> What Snowplow capabilities should the demo showcase?
>
> Pick one or more:
> - A) Content / engagement analytics
> - B) Ecommerce funnel optimization
> - C) Real-time personalization with Signals
> - D) Dynamic paywall or gating
> - E) Marketing attribution & campaign analysis
> - F) Consent & privacy compliance
> - G) Other (please describe)

---

### Phase 2: Planning (propose a plan, refine together)

Once you have the industry and use cases, **propose a site plan** to the user. This should include:

- **Suggested pages** — A list of pages the demo will have (e.g., Home, Product Listing, Product Detail, Checkout, Video). Identify which are baseline pages (every demo has them) and which are vertical-specific.
- **Suggested demo flow** — A recommended user journey through the site that showcases the selected use cases. If the user mentioned a specific demo flow in their initial prompt, incorporate it.
- **Vertical-specific features** — Call out each feature that goes beyond basic Snowplow tracking (e.g., mortgage calculator, checkout flow, betting slip, subscription paywall).

Present the plan and ask:
> Here's what I'm thinking for the site structure and demo flow. Does this look right? Anything you'd add, remove, or change?

Once the user approves (or adjusts) the plan, ask about **functionality depth** for each vertical-specific feature:

> For each of these features, how deep should the functionality go?
>
> - A) **Surface level** — Looks realistic but static/decorative (e.g., a checkout page that looks real but doesn't process anything). Best when the demo focus is on Snowplow tracking, not the site functionality.
> - B) **Semi-functional** — Key interactions work with mock data (e.g., add items to a cart and see a total, but no real backend). Good for walking through a user journey live.
> - C) **Fully functional** — Works end-to-end with local state or mock APIs (e.g., working search with filters, multi-step checkout with validation). Best when the prospect needs to interact hands-on.

List out the specific features and let the user assign a depth to each one. Different features can have different depths.

---

### Phase 3: Design & Build (ask as you go)

Begin building the project scaffolding and baseline features (these don't need user input — they're the same every time). As you reach design and content decisions, check in with the user:

**Style / Theme** — Ask before building the first page:
> How should the website look? Pick one:
> - A) I'll describe it (provide a written description)
> - B) Here's a screenshot to reference (attach an image)
> - C) Here's a URL to use as inspiration (provide a link)
> - D) Surprise me — just make it look good for the vertical

If the user picks **B or C**, ask ONE follow-up:
> How closely should I match this reference?
> - A) Copy it as closely as possible
> - B) Use the same layout/structure but with a different aesthetic
> - C) Just take inspiration from the color palette and general feel

The `frontend-design` skill should be used for **all options** to ensure polished, distinctive interfaces that avoid generic AI aesthetics. The difference is creative latitude:
- **A)** Pass the user's written description as design direction to the skill
- **B)** Pass the screenshot as a visual reference to guide the skill's output
- **C)** Pass the URL as inspiration for the skill to interpret
- **D)** Give the skill full creative freedom to design something appropriate for the vertical

**Image Generation** — Ask when you're ready to add visual content:
> Will you need images for this demo (product photos, hero banners, thumbnails, etc.)?
> - A) Yes, I'll generate them manually in Gemini
> - B) Yes, I want to generate them programmatically via API
> - C) No, I'll provide my own images
> - D) No, use placeholders for now

If the user picks **B**, ask:
> Do you have a `GOOGLE_AI_API_KEY` set up in your shell environment (`~/.zshrc`)? If not, you'll need to create one at aistudio.google.com and add `export GOOGLE_AI_API_KEY="your-key"` to your `~/.zshrc`. Billing must be enabled on your Google Cloud project for image output.

See `references/image-generation.md` for the full workflow and prompting tips.

**Continuous building** — Once the user has approved the plan (Phase 2) and answered the style question, **build the entire demo end-to-end without stopping**. Work through every page and feature in the agreed plan. Do NOT pause after each page and wait for the user to say "continue" or "what next."

**Build checkpoints** are status updates, NOT stopping points. After completing each major page or feature, give a brief one-line summary of what was just built (e.g., "Homepage done — hero, search bar, destination grid.") and immediately continue to the next item. The user can interrupt at any time if they want changes, but the default is to keep building until the full demo is complete.

When the entire demo is built, present a summary of everything that was created and ask the user to review.

---

For detailed implementation patterns and code for each feature, read the appropriate reference file:

| Topic | File | When to read |
|-------|------|-------------|
| Project setup & scaffolding | `references/project-setup.md` | Starting a new demo from scratch |
| Consent management | `references/baseline-consent-management.md` | Implementing the consent banner, anonymous tracking, and Enhanced Consent Plugin |
| UTM generation | `references/baseline-utm-generation.md` | Implementing the UTM reload button and marketing attribution |
| Signals toggle | `references/baseline-signals-toggle.md` | Implementing the Signals on/off toggle and intervention handlers |
| Embedded video with tracking | `references/baseline-video-tracking.md` | Implementing the video page with Snowplow Media Plugin |
| Cross-domain linking | `references/baseline-cross-domain-linking.md` | Implementing cross-domain tracking to snowplow.io |
| Snowplow tracker setup | `references/snowplow-setup.md` | Initializing the tracker, plugins, page views, and activity tracking |
| User accounts (login) | `references/baseline-user-accounts.md` | Implementing login/account creation and Snowplow user_id |
| Image generation | `references/image-generation.md` | Generating demo images with Google Nano Banana |

---

## Tech Stack (Non-negotiable)

- **Framework**: Next.js 15+ with App Router (not Pages Router)
- **Language**: TypeScript
- **UI Library**: React 19+
- **Styling**: Tailwind CSS v4 with `tailwind-merge` and `clsx` via a `cn()` utility
- **Icons**: Lucide React
- **Frontend Design**: Use the `frontend-design` skill from Anthropic for all UI work — produces polished, distinctive interfaces that avoid generic AI aesthetics
- **Package Manager**: npm

---

## Baseline Functionality Checklist

Every demo website MUST include all six of these features. Do not skip any.

### 1. Consent Management
- Consent banner/modal with Accept All, Reject All, and Customize options
- Four consent categories: Necessary (always on), Analytics, Marketing, Preferences
- localStorage persistence of consent state
- Snowplow Enhanced Consent Plugin integration (trackConsentAllow, trackConsentDeny, trackConsentSelected, trackCmpVisible)
- Anonymous tracking with server anonymisation when analytics consent is denied
- "Manage Consent" button in the footer to reopen the consent manager
- Read `references/baseline-consent-management.md` for full implementation

### 2. UTM Generation
- "UTM Reload" button in the footer
- Configurable source/medium pairs and campaign names in `lib/config.ts`
- `buildUrlWithUtm()` utility function supporting utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, msclkid, dclid
- Calls `newSession()` before reloading to reset the Snowplow session
- Read `references/baseline-utm-generation.md` for full implementation

### 3. Snowplow Signals Toggle
- Signals dropdown menu in the footer with on/off toggle
- Signals Plugin loaded in tracker initialization
- `isSignalsEnabled()` / `setSignalsEnabled()` utility functions using localStorage
- Intervention handler that respects the toggle state (use-case-specific logic)
- Read `references/baseline-signals-toggle.md` for full implementation

### 4. Embedded Video with Media Tracking
- Dedicated `/video` page with embedded YouTube iframe (video ID: `4ClPw87tiV0`)
- Always muted by default (`mute=1` on iframe src)
- Snowplow YouTube Tracking Plugin (`@snowplow/browser-plugin-youtube-tracking`) for automatic event tracking
- `enablejsapi=1` on iframe src (required for plugin to work)
- Progress boundary tracking at 25%, 50%, 75%, 100%
- `endYouTubeTracking()` cleanup on component unmount
- "Watch Video" button in the footer linking to `/video`
- Read `references/baseline-video-tracking.md` for full implementation

### 5. User Accounts (Login / Account Creation)
- Login modal triggered from the header with email input
- Any email works (demo-only, no real auth)
- On login: email is set as Snowplow `user_id` via `setUserId()`
- On logout: `user_id` is cleared via `setUserId(null)`
- User state persisted in localStorage (`"demo-user"` key)
- `UserProvider` context wraps the app inside `SnowplowInit`
- User ID restored from localStorage on tracker initialization
- Header shows email + Logout when logged in, Login button when logged out
- Read `references/baseline-user-accounts.md` for full implementation

### 6. Cross-Domain Linking
- `crossDomainLinker` function in tracker config targeting `snowplow.io`
- `enableCrossDomainLinking()` called after initialization for dynamic links
- `_sp` parameter cleanup from URL after page view is tracked (prevents sharing tracking params)
- Visual indicator on cross-domain links in the footer (hover tooltip + arrow icon)
- Read `references/baseline-cross-domain-linking.md` for full implementation

---

## Basic Snowplow Tracking (Out of the Box)

Unless the user specifies additional tracking, every demo starts with only these out-of-the-box events:

| Event Type | Method | Notes |
|-----------|--------|-------|
| Page Views | `trackPageView()` | Auto-tracked on route changes via `useSnowplowTracking` hook |
| Page Pings | `enableActivityTracking()` | 20s minimum visit, 10s heartbeat |
| Link Clicks | `enableLinkClickTracking()` | Via LinkClickTrackingPlugin, `trackContent: true` |
| Button Clicks | Via link click tracking | Buttons wrapped in links or tracked via link click plugin |
| Consent Events | Enhanced Consent Plugin | trackConsentAllow/Deny/Selected/Withdrawn, trackCmpVisible |
| Video Events | YouTube Tracking Plugin | play, pause, end, seek, volume, percent progress, quality change, buffering, pings |

Do NOT add form tracking, ecommerce tracking, custom self-describing events, or Snowtype data products unless the user specifically requests them.

---

## Project Structure

Every demo should follow this structure:

```
/app                          # Next.js App Router pages
├── layout.tsx               # Root layout with SnowplowInit + any other providers
├── page.tsx                 # Home page
├── video/page.tsx           # Video demo page (baseline)
└── [vertical-specific]/     # Pages specific to the demo vertical

/src
├── components/
│   ├── consent-manager.tsx  # Consent modal (baseline)
│   ├── snowplow-init.tsx # Tracker initialization wrapper (baseline)
│   ├── footer.tsx           # Footer with UTM, Consent, Signals, Video buttons (baseline)
│   ├── header.tsx           # Site header/navigation with login button
│   ├── login-modal.tsx      # Login/account creation modal (baseline)
│   └── [other components]   # Vertical-specific components
├── contexts/
│   └── user-context.tsx     # User auth state + Snowplow user_id (baseline)
├── hooks/
│   └── use-snowplow-tracking.ts  # Page view tracking on route changes (baseline)
├── lib/
│   ├── config.ts            # Site configuration (brand, navigation, UTM, features)
│   ├── consent.ts           # Consent utilities (baseline)
│   ├── snowplow-config.ts   # Snowplow initialization & tracking functions (baseline)
│   └── utils.ts             # Utility functions (cn, buildUrlWithUtm)
└── styles/
    └── globals.css          # Tailwind imports + brand CSS variables

/public
├── videos/                  # Demo video file(s)
└── images/                  # Logos, assets
```

---

## Configuration-Driven Design

All site-specific content should be centralized in `lib/config.ts` using a `SiteConfig` interface. This includes:

- **Brand**: name, tagline, logo, favicon
- **Navigation**: main menu items, footer links (including snowplow.io for cross-domain linking)
- **Features**: boolean flags for search, newsletter, userAccounts, advertising, utmParameters, consentManager
- **Marketing**: UTM source/medium pairs and campaign names (campaigns should match the demo vertical theme)
- **Business**: contact info, social links
- **SEO**: title, description, keywords, ogImage

The UTM sources list is generic and should NOT need updating between demos. Only the campaigns list needs to be themed to the vertical.

---

## Layout & Provider Pattern

The root layout (`app/layout.tsx`) must wrap all content in providers:

```tsx
<SnowplowInit>        {/* Initializes tracker, enables cross-domain, tracks page views */}
  <UserProvider>          {/* Manages login state, sets Snowplow user_id */}
    {children}
  </UserProvider>
</SnowplowInit>
```

The `SnowplowInit` component:
1. Calls `initializeSnowplowOnly()` on mount
2. Calls `enableCrossDomainLinking()` after initialization
3. Uses the `useSnowplowTracking()` hook for automatic page view tracking on route changes

---

## Collector Configuration

All demos should use the Snowplow Sales team's production collector. The tracker initialization should include comments with all available endpoints for easy switching:

```typescript
newTracker('sp1', 'https://com-snplow-sales-aws-prod1.collector.snplow.net', {
  // 127.0.0.1:9090 - Localhost
  // https://com-snplow-sales-aws-prod1.mini.snplow.net - Mini
  // https://com-snplow-sales-aws-prod1.collector.snplow.net - Prod
  ...
});
```

---

## Header Design

The header must include the brand logo/name, navigation, and the login/account button — but there is **no fixed layout or style**. The header design should match what's appropriate for the vertical and the chosen style reference. Avoid defaulting to the same plain horizontal nav bar with text links every time.

Consider the vertical and reference when choosing a header style. Examples of variety:
- A **news or publishing site** might use a dense, multi-row header with sections and a search bar
- A **travel booking site** might use a minimal header with a hamburger menu to keep focus on the search
- An **ecommerce site** might use a mega-menu with category dropdowns
- A **SaaS/fintech site** might use a clean sticky header with a prominent CTA button
- A **gaming platform** might use a dark, immersive header with icon-based navigation

The `frontend-design` skill should drive the header design as part of the overall page layout — don't treat it as a separate generic component.

**Required elements** (style is flexible, but these must be present):
- Brand logo or name
- Login/account button (shows email + Logout when logged in)

---

## Footer Pattern

The footer is the control center for demo tooling. It MUST include these buttons in the bottom bar (in this order):

1. **UTM Reload** — Generates random UTMs and reloads the page
2. **Manage Consent** — Opens the consent manager modal
3. **Signals** — Dropdown with toggle + reset paywall option
4. **Watch Video** — Links to `/video`
5. **Legal links** — Including a link to snowplow.io (for cross-domain linking demo)

---

## Step-by-Step Workflow

When creating a new demo, follow the collaborative build process (see above) and this execution order:

### Discovery & Planning
1. **Check prerequisites** — Verify the `frontend-design` skill is available; warn if missing
2. **Gather essentials (Phase 1)** — Ask about industry/subject and use cases
3. **Propose a site plan (Phase 2)** — Present suggested pages, demo flow, and vertical-specific features for the user to review and refine
4. **Agree on functionality depth** — For each vertical-specific feature, confirm whether it should be surface level, semi-functional, or fully functional

### Scaffolding & Baseline Functionality
5. **Ask about style/theme** — Get the user's design direction before building visible pages
6. **Scaffold the project** — Read `references/project-setup.md` and create the Next.js project structure
7. **Set up the Snowplow tracker** — Read `references/snowplow-setup.md`
8. **Implement baseline features** (read each reference file as you go):
   - Consent management — `references/baseline-consent-management.md`
   - UTM generation — `references/baseline-utm-generation.md`
   - Signals toggle — `references/baseline-signals-toggle.md`
   - Embedded video — `references/baseline-video-tracking.md`
   - Cross-domain linking — `references/baseline-cross-domain-linking.md`
   - User accounts — `references/baseline-user-accounts.md`

### Vertical-Specific Build
9. **Ask about image generation** — Determine how visual content will be sourced
10. **Build vertical-specific pages** — Use the `frontend-design` skill and the config-driven pattern, building to the agreed functionality depth for each feature
11. **Give one-line status updates** as each page/feature is completed, but keep building without stopping

### Wrap-Up
12. **Present a final summary** — List everything that was built and ask the user to review
13. **Test** that all six baseline features work correctly

---

## Common Mistakes to Avoid

- **Forgetting to call `enableActivityTracking()` before `trackPageView()`** — Activity tracking must be enabled first
- **Not cleaning up `_sp` parameter** — Always remove it from the URL after tracking the page view
- **Tracking page views in the provider AND the hook** — The provider should NOT track page views; only the `useSnowplowTracking` hook should
- **Not resetting the session on UTM reload** — Always call `newSession()` before reloading with new UTMs
- **Hardcoding consent state** — Always check localStorage, never assume consent
- **Not enabling `webPage: true`** in tracker contexts — This is essential for page view IDs
- **Using `"use client"` on the root layout** — The layout should be a server component; only the provider is a client component
- **Adding tracking beyond the basics** — Only add custom events, Snowtype, or additional plugins when explicitly requested
