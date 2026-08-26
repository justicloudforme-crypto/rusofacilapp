@AGENTS.md

## Dev server cache

If a newly added route/page returns 404 on the running dev server, this is almost
always a stale `.next` route manifest, not a code bug. Run `npm run dev:clean`
(or `rm -rf .next` and restart `next dev`) before spending time debugging routing
code, then re-check the route.

## Mobile-first rules

**Capacitor is confirmed, not planned** — `capacitor.config.ts`, `android/`,
`ios/`, `capacitor-shell/`, `@capacitor/android`/`@capacitor/ios`/`@capacitor/core`
in `package.json`, and `npm run cap:ios`/`cap:android` scripts all exist and
are in active use (see `MOBILE.md` for the full build/run setup). It wraps a
**remote URL** in a native WebView (not a static export) — the app is a thin
native shell loading the real Next.js server, so almost all UI code here
already doubles as the mobile app's UI.

All UI work follows these rules:

- Mobile-first: design/lay out any screen at 375px first, then check 768px and
  1280px. Don't design desktop-first and hope it degrades.
- Minimum touch target: 44×44px for any tappable element (buttons, links,
  icon buttons, filter chips, form controls).
- No action may be available only via hover. Every hover effect must have a
  working tap/click equivalent. Hover does not exist as an interaction class
  on the Capacitor build (no cursor, no mouse) — treat any `hover:`-gated
  affordance as broken by default, not just suboptimal.
- `viewport-fit=cover` + safe-area-inset for every fixed/sticky element.
  `viewportFit: "cover"` is already set (`src/app/[lang]/layout.tsx:63`) and
  safe-area insets are already used in `src/app/globals.css`,
  `src/app/[lang]/layout.tsx`, and `src/components/stories/StoryText.tsx` —
  follow that existing pattern for any new fixed/sticky/bottom-sheet element
  (bottom nav, sticky headers, modals) rather than hardcoding padding that
  ignores the notch/home-indicator area.
- Android hardware back button: already handled by
  `src/components/NativeBackButtonHandler.tsx` — any new full-screen
  overlay/modal/sheet must register with it (or otherwise cooperate with it)
  instead of only listening for a close button/Escape, or Android's back
  gesture will exit the app instead of closing the UI.
- `100dvh`, never `100vh`, for any full-viewport-height container (browser
  chrome inside the WebView still shifts the visual viewport). The current
  baseline (`AUDIT.md`) already found no offending `100vh`/`h-screen` usage
  in scope — keep it that way.
- `position: fixed` is not allowed on text inputs or any element that can
  receive focus and open the keyboard — on Android/iOS WebViews a fixed
  input can be mispositioned or covered when the on-screen keyboard resizes
  the viewport. Use `sticky` within a scrolling container instead, or accept
  the input scrolling with the page.
- Do not change business logic, routing, or the Stripe integration without an
  explicit request — visual/UI work should not touch `src/lib/stripe.ts`,
  `src/app/api/checkout/`, `src/app/api/webhooks/`, or `src/app/api/subscription/`.
- Any visual change goes through design tokens (`src/app/globals.css`), not
  new one-off hex colors, arbitrary Tailwind bracket values, or ad hoc inline
  styles. If a needed token doesn't exist yet, add it to `globals.css` rather
  than hardcoding a value at the call site.
- Each step is its own commit — don't bundle unrelated changes.
- Before any large change, present a plan and wait for confirmation before
  implementing.

See `AUDIT.md` for the current baseline (visual inconsistencies, mobile-
readiness gaps, missing states, confirmed bugs) this work is meant to fix.
