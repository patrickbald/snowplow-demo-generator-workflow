# User Accounts (Login / Account Creation)

Every demo includes a simple email-based login/account creation flow. This is a demo-only flow — any email address works, no real authentication. The key purpose is to set the Snowplow `user_id` (via `setUserId()`) so that the prospect can see how Snowplow stitches anonymous and identified user behavior.

## How it works

1. User clicks "Login" / "Sign Up" in the header
2. Modal appears with an email input
3. User enters any email address and submits
4. Email is set as the Snowplow `user_id` via `setUserId()`
5. User state is persisted in localStorage so it survives page reloads
6. On logout, `setUserId(null)` clears the identifier

## User Context Provider (`src/contexts/user-context.tsx`)

This React context manages user state and integrates with Snowplow:

```typescript
"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { setUserForTracking, clearUserForTracking } from "@/src/lib/snowplow-config"

interface User {
  email: string
  isLoggedIn: boolean
}

interface UserContextType {
  user: User | null
  isLoading: boolean
  login: (email: string) => void
  logout: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const savedUser = localStorage.getItem("demo-user")
        if (savedUser) {
          const userData = JSON.parse(savedUser)
          if (userData && typeof userData.email === 'string' && typeof userData.isLoggedIn === 'boolean') {
            setUser(userData)
          } else {
            localStorage.removeItem("demo-user")
          }
        }
      } catch (error) {
        console.error("Error parsing saved user:", error)
        localStorage.removeItem("demo-user")
      } finally {
        setIsLoading(false)
      }
    }
    requestAnimationFrame(loadUser)
  }, [])

  const login = (email: string) => {
    const userData = { email, isLoggedIn: true }
    setUser(userData)
    localStorage.setItem("demo-user", JSON.stringify(userData))
    // Set email as Snowplow user_id
    setUserForTracking(email)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("demo-user")
    // Clear Snowplow user_id
    clearUserForTracking()
  }

  return (
    <UserContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
```

### Key details

- **localStorage key**: `"demo-user"` — stores `{ email, isLoggedIn }` as JSON
- **Loading state**: `isLoading` starts as `true` and becomes `false` after localStorage check, preventing flash of logged-out UI
- **`requestAnimationFrame`**: Ensures localStorage read happens after initial render to avoid hydration mismatches

## Snowplow Integration (`src/lib/snowplow-config.ts`)

Add these functions to the snowplow config module:

```typescript
import { setUserId } from '@snowplow/browser-tracker';

// Set user ID for tracking (called on login/account creation)
export function setUserForTracking(email: string) {
  setUserId(email);
}

// Clear user ID (called on logout)
export function clearUserForTracking() {
  setUserId(null);
}
```

Also restore the user ID on tracker initialization so it persists across page loads:

```typescript
function restoreUserFromStorage() {
  if (typeof window !== 'undefined') {
    const savedUser = localStorage.getItem("demo-user");
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        if (userData.email) {
          setUserId(userData.email);
        }
      } catch (error) {
        console.error("Error parsing saved user:", error);
        localStorage.removeItem("demo-user");
      }
    }
  }
}
```

Call `restoreUserFromStorage()` inside `initializeSnowplow()` after tracker setup.

## Login Modal (`src/components/login-modal.tsx`)

A simple modal with an email input. This serves as both login and account creation — any email works.

```tsx
"use client"

import { useState } from "react"
import { X, Mail } from "lucide-react"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLogin: (email: string) => void
}

export default function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    onLogin(email.trim())
    setIsLoading(false)
    setEmail("")
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Login</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Logging in...
              </div>
            ) : (
              "Login"
            )}
          </button>

          <p className="mt-4 text-xs text-gray-500 text-center">
            This is a demo site. Any email address will work for demonstration purposes.
          </p>
        </form>
      </div>
    </div>
  )
}
```

## Header Integration

The header should show a Login button when logged out, and the user's email + Logout button when logged in:

```tsx
import { useUser } from "@/src/contexts/user-context"
import LoginModal from "./login-modal"

// Inside the header component:
const { user, login, logout } = useUser()
const [showLoginModal, setShowLoginModal] = useState(false)

// In the JSX:
{user?.isLoggedIn ? (
  <div className="flex items-center gap-3">
    <span className="text-sm text-gray-600">{user.email}</span>
    <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
      Logout
    </button>
  </div>
) : (
  <button
    onClick={() => setShowLoginModal(true)}
    className="text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover px-4 py-2 rounded-md transition-colors"
  >
    Login
  </button>
)}

<LoginModal
  isOpen={showLoginModal}
  onClose={() => setShowLoginModal(false)}
  onLogin={(email) => {
    login(email)
    setShowLoginModal(false)
  }}
/>
```

## Layout Wiring

The `UserProvider` wraps the app inside the `SnowplowInit`:

```tsx
// app/layout.tsx
<SnowplowInit>
  <UserProvider>
    {children}
  </UserProvider>
</SnowplowInit>
```

The `UserProvider` must be inside `SnowplowInit` because login calls `setUserForTracking()`, which requires the tracker to be initialized.

## What this demonstrates to prospects

- **User identification**: Before login, Snowplow tracks with anonymous `domain_userid`. After login, events include the `user_id` field, enabling identity stitching.
- **Cross-device stitching**: The same email used on different devices links those sessions together in the warehouse.
- **Consent + identity**: If the user denied analytics consent, anonymous tracking with server anonymisation is active. When they log in, the `user_id` is still set but IP/cookie identifiers remain anonymised — showing that Snowplow respects consent even for identified users.
