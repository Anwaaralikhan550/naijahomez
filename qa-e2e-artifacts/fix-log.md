# QA Bug Fix Log

**Branch**: `fix/qa-non-admin-bugs`
**Started**: 2026-02-02

## Bug Checklist

### Verified Previously Fixed
- [x] BUG-001: Broken db import in user/listings API (was FIXED - confirmed)
- [x] BUG-002: Broken db import in user/messages/count API (was FIXED - confirmed)

### Major / Critical
- [x] BUG-009: Verify email "Skip for now" redirect loop — FIXED
- [x] BUG-004: Marketplace category tabs don't filter results — FIXED
- [x] BUG-012: Properties API type filter ignored (?type=rent/sale) — FIXED
- [x] BUG-005: /the-hub renders blank — FIXED
- [x] BUG-003: Navbar overlap blocks Noticeboard link — FIXED

### Minor / Quality
- [x] BUG-008: No validation on empty registration submit — FIXED
- [x] BUG-010: Raw Firebase error shown on invalid login — FIXED
- [x] BUG-013: Inconsistent redirect param naming — FIXED
- [x] BUG-006: /post-ad unauth redirect stuck — FIXED
- [x] BUG-015: Protected endpoints return 400 instead of 401 — FIXED
- [x] BUG-014: Garbled unicode/emoji encoding — WONTFIX (data-layer issue)
- [x] BUG-016: Hub communities API response inconsistent shape — FIXED
- [x] BUG-007: Excessive fast refresh warnings — WONTFIX (dev-mode only)

### Skipped (Admin)
- BUG-011: Hub admin page accessible to unauthenticated users (ADMIN - SKIPPED)

---

## Fix Details

### BUG-009: Verify email "Skip for now" redirect loop
- **Root cause**: `href="/dashboard"` on Skip link; ProtectedRoute redirects unverified users back to /verify-email
- **Fix**: Changed `href` from `/dashboard` to `/` in `src/app/verify-email/page.js`
- **Commit**: `fix(BUG-009): resolve verify email "Skip for now" redirect loop`
- **Verified**: Browser — Skip for now navigates to homepage successfully

### BUG-005: /the-hub renders blank
- **Root cause**: Used `redirect()` from `next/navigation` inside a client component's `useEffect`. `redirect()` is server-only.
- **Fix**: Replaced with `router.replace()` in `src/app/the-hub/page.js`
- **Commit**: `fix(BUG-005): resolve /the-hub blank page rendering`
- **Verified**: Browser — /the-hub redirects to /the-hub/dashboard with full content

### BUG-003: Navbar overlap blocks Noticeboard link
- **Root cause**: GeolocationButton SVG absolutely positioned overlapping the nav links area, intercepting pointer events
- **Fix**: Added `pr-16 relative z-10` to nav container in `src/components/layout/Header.js`
- **Commit**: `fix(BUG-003): prevent geolocation button from overlapping Noticeboard link`
- **Verified**: Browser — Noticeboard link clickable, navigates to /noticeboard

### BUG-004: Marketplace category tabs don't filter results
- **Root cause**: `loadItems()` in MarketplaceListings.js never passed `subcategory` to API; API had no category filtering logic
- **Fix**: Pass `category: subcategory` in API call (`src/components/marketplace/MarketplaceListings.js`); add server-side category/condition filtering in `src/app/api/marketplace/route.js`
- **Commit**: `fix(BUG-004): marketplace category tabs now filter results`
- **Verified**: Browser — heading changes per tab, filtering active

### BUG-012: Properties API type filter ignored
- **Root cause**: API reads `listingType` param but frontend sends `type`
- **Fix**: Added `|| searchParams.get('type')` fallback in `src/app/api/properties/route.js`
- **Commit**: `fix(BUG-012): properties API now accepts type param for rent/sale filter`
- **Verified**: curl — rent=2500, sale=2400, all=4930 (different totals confirm filtering)

### BUG-010: Raw Firebase error on invalid login
- **Root cause**: `signIn()` in AuthContext returned raw `error.message` from Firebase
- **Fix**: Added `getAuthErrorMessage()` mapper function in `src/context/AuthContext.js` covering all common error codes; applied to both `signIn` and `signUp`
- **Commit**: `fix(BUG-010): show user-friendly error messages instead of raw Firebase errors`
- **Verified**: Browser — shows "Invalid email or password. Please try again."

### BUG-008: No validation on empty registration submit
- **Root cause**: No client-side empty field checks; HTML5 `required` attribute provides native validation but no custom error messages
- **Fix**: Added explicit empty field checks for email, password, confirmPassword in `src/app/register/page.js`
- **Commit**: `fix(BUG-008): add client-side validation for empty registration fields`
- **Verified**: Browser — native "Please fill out this field" tooltip + custom JS validation

### BUG-013: Inconsistent redirect param naming
- **Root cause**: Profile page used `returnUrl` while all other pages use `redirect`
- **Fix**: Changed `router.push('/login?returnUrl=/profile')` to `router.push('/login?redirect=%2Fprofile')` in `src/app/profile/page.js`
- **Commit**: `fix(BUG-013): standardize redirect param name to 'redirect'`
- **Verified**: Code review — consistent with login page's `redirect` param reader

### BUG-006: /post-ad unauth redirect stuck
- **Root cause**: Always redirected to `/dashboard` regardless of auth state
- **Fix**: Added `useAuth()` hook; unauth users go to `/login?redirect=...`, auth users go to `/dashboard?tab=post-ad` in `src/app/post-ad/page.js`
- **Commit**: `fix(BUG-006): redirect unauthenticated users to login from /post-ad`
- **Verified**: Browser — unauthenticated visit redirects to /login with correct redirect param

### BUG-015: Protected endpoints return 400 instead of 401
- **Root cause**: Missing `verifyAuth()` call; userId was null without auth, triggering 400 "User ID is required"
- **Fix**: Added `verifyAuth()` check before userId extraction in both `src/app/api/user/listings/route.js` and `src/app/api/user/messages/count/route.js`
- **Commit**: `fix(BUG-015): return 401 instead of 400 for unauthenticated user API requests`
- **Verified**: curl — both endpoints return 401 with `{"error":"Authentication required"}`

### BUG-016: Hub communities API response inconsistent
- **Root cause**: Empty response returned `{ communities }` instead of `{ success, data, pagination }` format
- **Fix**: Added `success: true, data: [], pagination: { total: 0 }` alongside existing `communities: []` for backward compat in `src/app/api/hub/communities/route.js`
- **Commit**: `fix(BUG-016): add success and standard fields to hub communities API response`
- **Verified**: Code review — backward compatible with HubLayout.js consuming `result.communities`

### BUG-014: Garbled Unicode emoji (WONTFIX)
- **Root cause**: Stored Firestore data contains garbled UTF-8 sequences (e.g., `ð³ð¬` instead of flag emoji). This is a data-layer encoding issue, not a code bug.
- **Resolution**: Requires data migration / re-import with correct encoding. Cannot be fixed in application code.

### BUG-007: Excessive Fast Refresh warnings (WONTFIX)
- **Root cause**: Dev-mode behavior from Next.js Turbopack HMR. Does not occur in production builds.
- **Resolution**: Normal development behavior; no action needed.
