# STUDEE E2E Audit Report (Phase-1 Public Surface)

Date: 2026-04-20
Target: https://studee.akhee.ai
Scope: Unauthenticated black-box audit via HTTP + route inventory extraction from Next.js build manifest.

## Executive Summary
- Route inventory discovered: 103 total published routes.
- Role areas discovered: Student (44), Teacher (39), Admin (9), Other/Auth/Public (11 incl system routes).
- Verified high-risk gap: most pages return HTTP 200 unauthenticated at edge level and appear to rely on client-side auth checks.
- Verified hardening gaps: key security headers missing on web and API responses; wildcard CORS on web pages.
- Verified API behavior issue: /api/health responds 200 to GET/POST/PUT/DELETE/OPTIONS.

## Key Findings
- [High] Client-side access control reliance risk: /admin, /teacher, /student and sub-routes return 200 with loading shell instead of server-side 401/403 redirect.
- [Medium] Missing response security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy not present on checked pages and /api/health.
- [Medium] CORS posture inconsistency: Access-Control-Allow-Origin: * present on pages (/ /login /admin).
- [Low-Medium] API method hardening: /api/health returns 200 with JSON body for all tested methods.
- [Info] robots.txt and sitemap.xml unavailable (custom 404 response).

## Evidence (Selected)
- Header sample (/): HTTP 200, Strict-Transport-Security present, Access-Control-Allow-Origin: *.
- Header sample (/admin): HTTP 200, body shows loading screen HTML and JS bundle references.
- /api/health body: {"status":"ok","timestamp":"..."} on all tested methods.
- Route status scan completed across all manifest routes with dynamic placeholders replaced by test IDs.

## Route Status Snapshots
- / -> 200
- /_error -> 404
- /initial-setup -> 404
- /login -> 200
- /signup -> 200
- /pending-approval -> 200
- /unauthorized -> 200
- /api/health -> 200
- /api -> 404

## Full Function Inventory (from build manifest)

### Admin Routes
- /admin
- /admin/analytics
- /admin/analytics-test
- /admin/classes
- /admin/education-intelligence
- /admin/enhanced-analytics
- /admin/moderation
- /admin/staff-management
- /admin/student-management

### Teacher Routes
- /teacher
- /teacher/activity-project-generator
- /teacher/analysis
- /teacher/ar-models
- /teacher/ar-models/[id]
- /teacher/ar-models/[id]/edit
- /teacher/assessments
- /teacher/assignments/[id]
- /teacher/assistant
- /teacher/classes
- /teacher/classes/[classId]/content
- /teacher/classes/[classId]/students
- /teacher/concept-explainer
- /teacher/concept-mastery-coach
- /teacher/creative-resource-generator
- /teacher/document-chat
- /teacher/doubt-solver
- /teacher/event-planner
- /teacher/lessons
- /teacher/lessons/[id]
- /teacher/lessons/[id]/edit
- /teacher/lessons/create
- /teacher/live-quiz-poll-generator
- /teacher/live-quiz-poll-generator/[sessionId]
- /teacher/materials
- /teacher/materials/[materialId]
- /teacher/modules
- /teacher/modules/[id]
- /teacher/modules/create
- /teacher/notes-generator
- /teacher/profile
- /teacher/public/[teacherId]
- /teacher/resources
- /teacher/submissions
- /teacher/text-analyzer-enhancer
- /teacher/text-translator
- /teacher/web-search-assistant
- /teacher/writing-assistant
- /teacher/youtube-analyzer

### Student Routes
- /student
- /student/activity-project-generator
- /student/ar-learning-hub
- /student/ar-learning-hub/math
- /student/ar-learning-hub/science
- /student/ar-models
- /student/ar-models/[id]
- /student/assessments
- /student/assessments/[id]
- /student/assignments/[id]
- /student/chat
- /student/classes
- /student/classes/[classId]/ar-models
- /student/classes/[classId]/assessments
- /student/classes/[classId]/modules
- /student/concept-explainer
- /student/concept-mastery-coach
- /student/creative-resource-generator
- /student/document-chat
- /student/doubt-solver
- /student/event-planner
- /student/exam-preparation
- /student/lessons
- /student/lessons/[id]
- /student/live-quiz-poll-generator
- /student/live-quiz-poll-generator/[sessionId]
- /student/materials
- /student/materials/[materialId]
- /student/modules
- /student/modules/[moduleId]
- /student/modules/ModuleConsumptionView
- /student/profile
- /student/progress
- /student/quiz-worksheet-generator
- /student/results
- /student/results/[id]
- /student/saved-conversations
- /student/saved-conversations/[id]
- /student/text-analyzer-enhancer
- /student/text-translator
- /student/vocabulary
- /student/web-search-assistant
- /student/writing-assistant
- /student/youtube-analyzer

### Other/Public/Auth Routes
- /
- /_app
- /_error
- /ai-search
- /initial-setup
- /live-quiz/[token]
- /login
- /pending-approval
- /signup
- /themes
- /unauthorized

## Limitations
- No authenticated test accounts were provided (Student/Teacher/Admin), so in-app workflows (create class, submit assessment, content generation, grading) could not be executed end-to-end yet.
- This phase validates exposure, route coverage, headers, and public endpoint behavior only.

## Next Phase Required for Full E2E
- Provide 3 test accounts: student, teacher, admin.
- Execute functional matrix: class creation -> lesson generation -> assignment/quiz -> submission -> grading -> analytics.
- Execute role-violation tests with authenticated sessions and token tampering checks.
- Execute AI safety tests in chat/document/youtube/web-search tools with prompt-injection and harmful-input scenarios.
