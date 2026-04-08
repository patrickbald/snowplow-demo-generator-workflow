import {
  newTracker,
  trackPageView,
  enableActivityTracking,
  setUserId,
  enableAnonymousTracking,
  disableAnonymousTracking,
  newSession,
  trackSelfDescribingEvent,
} from "@snowplow/browser-tracker";
import {
  LinkClickTrackingPlugin,
  enableLinkClickTracking,
} from "@snowplow/browser-plugin-link-click-tracking";
import {
  EnhancedConsentPlugin,
  trackConsentAllow,
  trackConsentDeny,
  trackConsentSelected,
  trackConsentWithdrawn,
  trackCmpVisible,
} from "@snowplow/browser-plugin-enhanced-consent";
import { SnowplowMediaPlugin } from "@snowplow/browser-plugin-media";
import {
  YouTubeTrackingPlugin,
  startYouTubeTracking,
  endYouTubeTracking,
} from "@snowplow/browser-plugin-youtube-tracking";
import {
  SignalsPlugin,
  addInterventionHandlers,
  subscribeToInterventions,
} from "@snowplow/signals-browser-plugin";
import { hasAnalyticsConsent, isSignalsEnabled } from "./consent";

export { newSession };

function restoreUserFromStorage() {
  if (typeof window !== "undefined") {
    const savedUser = localStorage.getItem("demo-user");
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        if (userData.email) setUserId(userData.email);
      } catch {
        localStorage.removeItem("demo-user");
      }
    }
  }
}

function configureAnonymousTracking() {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) {
    enableAnonymousTracking({
      options: { withServerAnonymisation: true, withSessionTracking: true },
    });
  } else {
    disableAnonymousTracking();
  }
}

function setupSignalsInterventions() {
  try {
    addInterventionHandlers({
      demoInterventionHandler(intervention) {
        if (!isSignalsEnabled()) return;
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("signalsIntervention", { detail: { intervention } })
          );
        }
      },
    });
    subscribeToInterventions({
      endpoint: "https://signals.snowplowanalytics.com",
    });
  } catch {
    // Signals not available in this environment — fail silently
  }
}

export function initializeSnowplowOnly() {
  newTracker("sp1", "localhost:9090", {
    // localhost:9090                                        — Snowplow Micro (local)
    // https://com-snplow-sales-aws-prod1.collector.snplow.net — Prod
    appId: "{{APP_ID}}",
    appVersion: "1.0.0",
    cookieSameSite: "Lax",
    eventMethod: "post",
    bufferSize: 1,
    contexts: { webPage: true },
    plugins: [
      LinkClickTrackingPlugin(),
      EnhancedConsentPlugin(),
      SnowplowMediaPlugin(),
      YouTubeTrackingPlugin(),
      SignalsPlugin(),
    ],
    crossDomainLinker: (linkElement) => linkElement.hostname === "snowplow.io",
  });

  // MUST be before first trackPageView
  enableActivityTracking({ minimumVisitLength: 20, heartbeatDelay: 10 });
  enableLinkClickTracking({ trackContent: true });
  configureAnonymousTracking();
  restoreUserFromStorage();
  setupSignalsInterventions();
}

export function enableCrossDomainLinking() {
  if (
    typeof window !== "undefined" &&
    (window as unknown as { snowplow?: Function }).snowplow
  ) {
    (window as unknown as { snowplow: Function }).snowplow(
      "crossDomainLinker",
      (linkElement: HTMLAnchorElement) =>
        linkElement.hostname === "snowplow.io"
    );
  }
}

export function trackPageViewEvent() {
  trackPageView();
  if (typeof window !== "undefined" && /[?&]_sp=/.test(window.location.href)) {
    const cleanUrl = window.location.href.replace(/&?_sp=[^&]+/, "");
    history.replaceState(history.state, "", cleanUrl);
  }
}

export function setUserForTracking(email: string) { setUserId(email); }
export function clearUserForTracking() { setUserId(null); }

export function enableAnonymousTrackingMode() {
  enableAnonymousTracking({
    options: { withServerAnonymisation: true, withSessionTracking: true },
  });
}
export function disableAnonymousTrackingMode() { disableAnonymousTracking(); }

export function trackConsentAllowEvent(consentScopes: string[]) {
  trackConsentAllow({
    consentScopes,
    basisForProcessing: "consent",
    consentUrl: window.location.origin + "/privacy-policy",
    consentVersion: "1.0",
    domainsApplied: [window.location.hostname],
    gdprApplies: true,
  });
}
export function trackConsentDenyEvent(consentScopes: string[]) {
  trackConsentDeny({
    consentScopes,
    basisForProcessing: "consent",
    consentUrl: window.location.origin + "/privacy-policy",
    consentVersion: "1.0",
    domainsApplied: [window.location.hostname],
    gdprApplies: true,
  });
}
export function trackConsentSelectedEvent(consentScopes: string[]) {
  trackConsentSelected({
    consentScopes,
    basisForProcessing: "consent",
    consentUrl: window.location.origin + "/privacy-policy",
    consentVersion: "1.0",
    domainsApplied: [window.location.hostname],
    gdprApplies: true,
  });
}
export function trackConsentWithdrawnEvent(consentScopes: string[]) {
  trackConsentWithdrawn({
    consentScopes,
    basisForProcessing: "consent",
    consentUrl: window.location.origin + "/privacy-policy",
    consentVersion: "1.0",
    domainsApplied: [window.location.hostname],
    gdprApplies: true,
  });
}
export function trackCmpVisibleEvent() {
  trackCmpVisible({ elapsedTime: performance.now() });
}

export function initializeYouTubeTracking(elementId: string): string {
  const sessionId = crypto.randomUUID();
  startYouTubeTracking({
    id: sessionId,
    video: elementId,
    boundaries: [25, 50, 75, 100],
    captureEvents: ["DefaultEvents"],
  });
  return sessionId;
}
export function stopYouTubeTracking(sessionId: string) {
  try {
    endYouTubeTracking({ id: sessionId });
  } catch {
    // player already unmounted on navigation — fail silently
  }
}

// ─── Custom event tracking functions ────────────────────────────────────────
// Added by events-agent after site build. Do not edit manually.
export { trackSelfDescribingEvent };
