# Nijahomzs QA E2E Test Plan

## Project Summary
- **App**: Nijahomzs — Property, Marketplace, Housemate, Tradespeople & Community Hub platform
- **Stack**: Next.js 15 (App Router) + Firebase (Auth + Firestore) + AWS S3 + Tailwind CSS
- **Base URL**: http://localhost:3000
- **Environment**: Local development

---

## Feature Inventory

### 1. Public Pages (No Auth Required)

| # | Page | Route | Features | Related API | Status |
|---|------|-------|----------|-------------|--------|
| 1.1 | Home | `/` | Hero, category cards, featured listings | Multiple | OK |
| 1.2 | Property Listings | `/property` | Browse, filter, pagination | `GET /api/properties` | OK |
| 1.3 | Property Detail | `/property/[slug]` | Images, details, contact info | `GET /api/properties/slug/[slug]` | TBD |
| 1.4 | Housemate Listings | `/housemate` | Browse, filter | `GET /api/housemates` | OK |
| 1.5 | Housemate Detail | `/housemate/[slug]` | Details, contact | `GET /api/housemates/slug/[slug]` | TBD |
| 1.6 | Marketplace | `/marketplace` | Browse, filter | `GET /api/marketplace` | OK |
| 1.7 | Marketplace Detail | `/marketplace/[slug]` | Item details, contact | `GET /api/marketplace/slug/[slug]` | TBD |
| 1.8 | Tradespeople | `/tradespeople` | Browse, filter | `GET /api/tradespeople` | OK |
| 1.9 | Tradespeople Detail | `/tradespeople/[slug]` | Provider details | `GET /api/tradespeople/slug/[slug]` | TBD |
| 1.10 | Noticeboard | `/noticeboard` | Browse notices | `GET /api/noticeboard` | OK |
| 1.11 | Noticeboard Detail | `/noticeboard/[slug]` | Notice details | `GET /api/noticeboard/slug/[slug]` | TBD |
| 1.12 | Search | `/search` | Multi-category search, filters | Frontend filtering | OK |
| 1.13 | About | `/about` | Static content | None | OK |
| 1.14 | Contact | `/contact` | Contact form | TBD | OK |
| 1.15 | Privacy | `/privacy` | Static content | None | OK |
| 1.16 | Terms | `/terms` | Static content | None | OK |

### 2. Authentication

| # | Feature | Route | Related API | Status |
|---|---------|-------|-------------|--------|
| 2.1 | Login (Email/Password) | `/login` | Firebase Auth Client SDK | TBD |
| 2.2 | Login (Google OAuth) | `/login` | Firebase Auth Client SDK | TBD |
| 2.3 | Register | `/register` | Firebase Auth Client SDK | TBD |
| 2.4 | Email Verification | `/verify-email` | Firebase Auth | TBD |
| 2.5 | Forgot Password | `/forgot-password` | Firebase Auth | TBD |
| 2.6 | Logout | Header button | Firebase Auth Client SDK | TBD |
| 2.7 | Session Persistence | All pages | AuthContext | TBD |

### 3. User Dashboard (Auth Required)

| # | Feature | Route | Related API | Status |
|---|---------|-------|-------------|--------|
| 3.1 | Dashboard Home | `/dashboard` | Multiple | TBD |
| 3.2 | My Ads | `/dashboard/my-ads` | `GET /api/user/listings` | TBD |
| 3.3 | Profile | `/profile` | `GET/POST /api/user` | TBD |
| 3.4 | Post Ad | `/post-ad` | `POST /api/properties`, etc. | TBD |

### 4. Listing CRUD (Auth Required)

| # | Feature | API | Method | Status |
|---|---------|-----|--------|--------|
| 4.1 | Create Property | `/api/properties` | POST | TBD |
| 4.2 | Update Property | `/api/properties/[id]` | PUT | TBD |
| 4.3 | Create Housemate | `/api/housemates` | POST | TBD |
| 4.4 | Create Marketplace Item | `/api/marketplace` | POST | TBD |
| 4.5 | Create Tradespeople | `/api/tradespeople` | POST | TBD |
| 4.6 | Create Notice | `/api/noticeboard` | POST | TBD |
| 4.7 | Image Upload | `/api/upload` | POST | TBD |
| 4.8 | Delete Image | `/api/delete-image` | DELETE | TBD |

### 5. The Hub (Community Features, Auth + Membership Required)

| # | Feature | Route | Related API | Status |
|---|---------|-------|-------------|--------|
| 5.1 | Hub Landing | `/the-hub` | Hub auth check | TBD |
| 5.2 | Communities | `/the-hub/communities` | `GET /api/hub/communities` | OK (200) |
| 5.3 | Social Feed | `/the-hub/feed` | `GET/POST /api/hub/social-feed` | TBD |
| 5.4 | Events | `/the-hub/events` | `GET/POST /api/hub/events` | TBD |
| 5.5 | Forum | `/the-hub/forum` | `GET/POST /api/hub/forum/discussions` | TBD |
| 5.6 | Chat | `/the-hub/messages` | `GET/POST /api/hub/chat/messages` | TBD |
| 5.7 | Notifications | `/the-hub/notifications` | `GET /api/hub/notifications` | TBD |
| 5.8 | Amenity Booking | `/the-hub/amenities` | `GET/POST /api/hub/amenities` | TBD |
| 5.9 | Visitor Management | `/the-hub/visitors` | TBD | TBD |
| 5.10 | Issue Reporting | `/the-hub/issues` | `POST /api/hub/issues` | TBD |
| 5.11 | Alerts | `/the-hub/alerts` | `GET /api/hub/alerts` | TBD |
| 5.12 | Dashboard Stats | Hub dashboard | `GET /api/hub/dashboard-stats` | TBD |

### 6. Hub Admin Panel (Admin Role Required)

| # | Feature | Route | Related API | Status |
|---|---------|-------|-------------|--------|
| 6.1 | Member Management | `/the-hub/admin` | `GET/POST /api/hub/admin/members` | TBD |
| 6.2 | Access Code Generator | `/the-hub/admin` | `GET/POST /api/hub/access-codes` | TBD |
| 6.3 | Amenity Management | `/the-hub/admin` | `GET/POST /api/hub/amenities` | TBD |
| 6.4 | Emergency Alerts | `/the-hub/admin` | `POST /api/hub/emergency-alerts` | TBD |
| 6.5 | Issue Management | `/the-hub/admin` | `GET /api/hub/issues` | TBD |
| 6.6 | Notification Sender | `/the-hub/admin` | `POST /api/hub/notifications` | TBD |

### 7. Legacy Admin Tools

| # | Feature | Route | Related API | Status |
|---|---------|-------|-------------|--------|
| 7.1 | Fix Slugs | `/admin/fix-slugs` | `POST /api/admin/fix-slugs` | TBD |
| 7.2 | Check Listing Types | `/admin/` | `GET /api/admin/check-listing-types` | TBD |
| 7.3 | Check Rent | `/admin/` | `GET /api/admin/check-rent` | TBD |
| 7.4 | Duplicate Slugs | `/admin/` | `GET /api/admin/duplicate-slugs` | TBD |

### 8. Messaging

| # | Feature | Route | Related API | Status |
|---|---------|-------|-------------|--------|
| 8.1 | Send Message | Listing detail pages | `POST /api/messages` | TBD |
| 8.2 | View Messages | `/dashboard` or `/the-hub/messages` | `GET /api/messages` | TBD |
| 8.3 | Read/Forward | Message detail | `POST /api/messages/[id]/read`, `/forward` | TBD |

---

## Test Coverage Checklist

### Phase 1: Auth & Roles
- [ ] Register new user with email/password
- [ ] Verify email verification flow triggers
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (wrong password)
- [ ] Login with non-existent email
- [ ] Forgot password flow
- [ ] Logout and session clearing
- [ ] Session persistence across page reload
- [ ] Normal user cannot access `/the-hub/admin`
- [ ] Normal user cannot access `/api/admin/*` endpoints
- [ ] Unauthenticated access to protected pages redirects to login

### Phase 2: Core Features (User Side)
- [ ] Browse property listings (pagination, filtering)
- [ ] View property detail page
- [ ] Browse marketplace items
- [ ] View marketplace detail page
- [ ] Browse housemate listings
- [ ] View housemate detail page
- [ ] Browse tradespeople
- [ ] View tradespeople detail page
- [ ] Browse noticeboard
- [ ] View noticeboard detail page
- [ ] Search across categories
- [ ] Post a new ad (property)
- [ ] Post a new marketplace item
- [ ] View dashboard and my ads
- [ ] Edit/update a listing
- [ ] Image upload functionality
- [ ] Geolocation feature (nearby listings)
- [ ] Empty input validation
- [ ] Max length input handling
- [ ] Data persistence after page reload

### Phase 3: Admin Panel
- [ ] Admin access control (non-admin denied)
- [ ] Admin API endpoints require admin role
- [ ] Hub admin member management
- [ ] Access code generation
- [ ] Emergency alert sending (if safe)

### Phase 4: APIs & Data Integrity
- [ ] All public GET endpoints return proper JSON
- [ ] All protected endpoints return 401 without auth
- [ ] POST endpoints require auth token
- [ ] Error responses have consistent format
- [ ] Pagination works correctly
- [ ] Slug-based lookups work
- [ ] Data created via POST appears in GET

---

## Pre-existing Issues Found During Discovery

| ID | Title | Severity | File | Details |
|----|-------|----------|------|---------|
| BUG-001 | Broken `db` import in user/listings API | Blocker | `src/app/api/user/listings/route.js` | Imports `{ db }` which doesn't exist in firebase-admin.js. Should be `getAdminFirestore()`. **FIXED** |
| BUG-002 | Broken `db` import in user/messages/count API | Blocker | `src/app/api/user/messages/count/route.js` | Same issue as BUG-001. **FIXED** |
