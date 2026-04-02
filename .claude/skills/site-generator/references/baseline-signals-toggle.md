# Snowplow Signals Toggle

The Signals toggle allows demo presenters to turn Snowplow Signals personalization on and off during a demo, showing the difference between personalized and non-personalized experiences.

## Signals State Management (`src/lib/consent.ts`)

Signals preference is stored in localStorage, separate from consent:

```typescript
export function isSignalsEnabled(): boolean {
  if (typeof window === 'undefined') return true // Default to enabled on server
  const signalsPreference = localStorage.getItem("signals-enabled")
  return signalsPreference === null || signalsPreference === "true"
}

export function setSignalsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem("signals-enabled", enabled.toString())

  // Notify components of the change
  window.dispatchEvent(new CustomEvent('signalsPreferenceChanged', {
    detail: { enabled }
  }))
}
```

## Signals Plugin Setup (`src/lib/snowplow-config.ts`)

### Plugin registration

The Signals Plugin is registered during tracker initialization:

```typescript
plugins: [
  LinkClickTrackingPlugin(),
  EnhancedConsentPlugin(),
  SnowplowMediaPlugin(),
  SignalsPlugin()    // <-- Include in every demo
]
```

### Intervention handlers

After tracker initialization, set up Signals intervention handlers. The specific handler logic depends on the demo's use case (e.g., paywall, product recommendations, discount offers):

```typescript
function setupSignalsInterventions() {
  addInterventionHandlers({
    myHandler(intervention) {
      // Respect the Signals toggle
      if (!isSignalsEnabled()) return;

      // Handle the intervention based on the demo's use case
      // e.g., show a banner, update recommendations, trigger a modal
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('signalsIntervention', {
          detail: { intervention }
        }));
      }
    }
  });

  // Subscribe to Signals endpoint
  subscribeToInterventions({
    endpoint: "https://7f9742b834d7.signals.snowplowanalytics.com"
  });
}
```

## Footer Integration

The Signals toggle renders as a dropdown menu in the footer:

```tsx
import { Sparkles, ChevronDown } from "lucide-react"
import { isSignalsEnabled, setSignalsEnabled } from "@/src/lib/consent"

// State
const [signalsEnabled, setSignalsEnabledState] = useState(true)
const [showSignalsMenu, setShowSignalsMenu] = useState(false)
const menuRef = useRef<HTMLDivElement>(null)

// Load preference on mount
useEffect(() => {
  setSignalsEnabledState(isSignalsEnabled())
}, [])

// Close menu on outside click
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setShowSignalsMenu(false)
    }
  }
  if (showSignalsMenu) {
    document.addEventListener('mousedown', handleClickOutside)
  }
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [showSignalsMenu])

// Handlers
const handleToggleSignals = () => {
  const newValue = !signalsEnabled
  setSignalsEnabledState(newValue)
  setSignalsEnabled(newValue)
  setShowSignalsMenu(false)
}
```

### Rendering

```tsx
<div className="relative" ref={menuRef}>
  <button
    onClick={() => setShowSignalsMenu(!showSignalsMenu)}
    className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      signalsEnabled
        ? 'text-white bg-brand-primary hover:bg-brand-primary-dark'
        : 'text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700'
    }`}
    title="Signals configuration"
  >
    <Sparkles className="h-3 w-3 mr-1.5" />
    Signals
    <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showSignalsMenu ? 'rotate-180' : ''}`} />
  </button>

  {showSignalsMenu && (
    <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden z-50">
      {/* Toggle */}
      <button
        onClick={handleToggleSignals}
        className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center">
          <Sparkles className="h-4 w-4 mr-2" />
          <span>Signals Personalization</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded ${
          signalsEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
        }`}>
          {signalsEnabled ? 'On' : 'Off'}
        </span>
      </button>
    </div>
  )}
</div>
```

## Visual states

- **Signals ON**: Button has `bg-brand-primary` background, white text
- **Signals OFF**: Button has `bg-gray-800` background, gray text
- **Dropdown opens upward** (`bottom-full`) since it's in the footer

## What Signals controls

When disabled:
- Intervention handlers return early (no personalization actions taken)
- Personalized experiences fall back to defaults (if implemented)
- Analytics tracking continues normally — Signals only affects personalization features
