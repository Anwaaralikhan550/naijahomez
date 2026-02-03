# Remaining Bugs Fix Summary (BUG-007 & BUG-014)

**Branch**: `fix/qa-remaining-bugs`
**Date**: 2026-02-03
**Verified with**: Playwright MCP (headed browser), API evaluation, `npx next build`

---

## BUG-007: Excessive Fast Refresh Rebuilds and Long Task Warnings

### Root Cause
1. **Long Task warnings**: Logger singleton (`src/utils/logger.js`) created a `PerformanceObserver` monitoring tasks >50ms. In dev mode, Turbopack HMR rebuilds regularly exceed this threshold, generating excessive "Long Task detected" console warnings.
2. **Duplicate observers**: On Fast Refresh module re-evaluation, `initializeErrorHandling()` and `startPerformanceMonitoring()` were called again without cleanup, creating duplicate event listeners and observers.
3. **Fast Refresh messages**: `[Fast Refresh] rebuilding` messages are internal to Next.js 15 Turbopack — cannot be suppressed from app code.

### Fix Applied
**File**: `src/utils/logger.js`

1. Added `window.__loggerErrorHandlersInstalled` guard to prevent duplicate error event listeners
2. Added `window.__loggerPerfMonitorInstalled` guard to prevent duplicate PerformanceObservers
3. Made Long Task monitoring **production-only** (`process.env.NODE_ENV === 'production'`)

### Before / After

| Metric | Before | After |
|--------|--------|-------|
| Long Task warnings (property page) | 2 | 0 |
| Duplicate observers on HMR | Yes | No (guarded) |
| Fast Refresh messages | ~28 per page cycle | ~28 (Turbopack-internal, unchanged) |

### Evidence
- Before: `logs/remaining/bug-007-before.txt`
- After: `logs/remaining/bug-007-after.txt`

---

## BUG-014: Garbled Unicode Emoji in Listing Addresses

### Root Cause
UTF-8 mojibake in Firestore document data. Nigerian flag emoji 🇳🇬 (UTF-8 bytes: `F0 9F 87 B3 F0 9F 87 AC`) was stored as individual Latin-1/ISO-8859-1 characters during data import, resulting in garbled display like `ð🇳ð🇬` instead of proper emoji.

### Fix Applied

**New file**: `src/utils/fixEncoding.js`
- `hasMojibake(str)`: Detects Latin-1 sequences matching UTF-8 leading byte patterns
- `fixMojibakeString(str)`: Re-encodes Latin-1 chars → UTF-8 bytes via `TextDecoder`
- `fixListingEncoding(listing)`: Applies fix to `location`, `title`, `originalDescription`, `address` fields

**Modified API routes** (applied `fixListingEncoding()` to response data):
- `src/app/api/properties/route.js` — main property list
- `src/app/api/properties/[id]/route.js` — single property by ID
- `src/app/api/properties/slug/[slug]/route.js` — property by slug + similar properties

**New migration script**: `scripts/fix-encoding.js`
- Scans all Firestore collections and repairs mojibake permanently
- Supports `--dry-run` mode for preview
- Usage: `node scripts/fix-encoding.js --dry-run`

### Before / After

| Metric | Before | After |
|--------|--------|-------|
| API `hasGarbled` test | true | false |
| Flag emoji display | `ð🇳ð🇬` (garbled) | 🇳🇬 (correct) |
| Entries with proper emoji | 0 | 4+ |
| Example location | "Ajah Lekki Lagosð🇳ð🇬" | "Ajah Lekki Lagos🇳🇬" |

### Evidence
- Before screenshot: `evidence/remaining/bug-014-before.png`
- After screenshot: `evidence/remaining/bug-014-after.png`
- API verification: `logs/remaining/bug-014-after.txt`

---

## Remaining Open Item

| ID | Status | Note |
|----|--------|------|
| BUG-011 | SKIPPED | Hub admin page access control — excluded per instructions (admin scope) |

All other 15 bugs are **FIXED** and verified.
