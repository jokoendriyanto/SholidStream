# Phase 2 — Application Modularization

## Objective

Reduce the responsibilities of the legacy `app.js` without changing user-visible behavior. This phase establishes reusable HTTP middleware/controllers/routes that can later be wired into the bootstrap incrementally.

## Rules

- Preserve existing URLs and response payloads.
- Preserve existing authentication/authorization behavior.
- Do not change SQLite, streaming runtime, FFmpeg process ownership, scheduler behavior, storage, or UI in this phase.
- Extract first, wire second, delete legacy code last.
- Every extracted behavior requires a contract test before the legacy implementation is removed.

## Initial extracted modules

- `src/http/middleware/auth.js`
  - `isAuthenticated`
  - `createAdminMiddleware`
- `src/http/controllers/system.controller.js`
  - donator proxy behavior
  - server time response behavior
- `src/http/routes/system.routes.js`

## Planned extraction order

1. Authentication middleware
2. Public/system utility routes
3. Playlist routes/controllers
4. Rotation routes/controllers
5. Media/upload routes/controllers
6. Stream CRUD routes/controllers
7. Stream runtime actions
8. YouTube routes/controllers
9. Bootstrap/server lifecycle

## Wiring strategy

The legacy `app.js` is intentionally left untouched until the new modules are covered by tests. Wiring will then happen in small steps:

```text
legacy inline handler
    ↓
module with contract test
    ↓
mount module from app.js
    ↓
run CI/regression
    ↓
remove legacy inline handler
```

## Exit criteria

Phase 2 is complete when:

- route registration is separated from controllers for the prioritized domains;
- authentication middleware is reusable and no longer defined inline;
- `app.js` is primarily bootstrap/composition rather than business logic;
- all baseline and modularization tests pass;
- no HTTP route or response contract intentionally changes.
