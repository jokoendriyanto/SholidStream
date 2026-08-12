# Phase 4 — Workspace Multi-Tenancy

## Objective

Move ownership semantics from `user_id owns everything` toward `workspace_id owns every SaaS resource` while preserving legacy user-scoped routes until their repositories are migrated.

## Implemented

- `workspaces` and `workspace_members` PostgreSQL schema.
- Roles: owner, admin, operator, viewer.
- Reusable immutable workspace context and role hierarchy.
- Workspace resolution middleware using explicit header or active session workspace.
- Workspace repository for membership lookup and transactional personal-workspace creation.
- A workspace-scoped repository base that requires `workspace_id` in resource lookup/delete queries.
- Cross-tenant isolation contract tests.

## Mandatory rule for new modules

Every new customer-owned table must contain `workspace_id`. Every repository operation must receive workspace context explicitly; no new module may infer resource ownership only from an object id.

## Cutover rule

Legacy models remain user-scoped until individually ported. During migration, route adapters will translate the legacy logged-in user to that user's personal workspace before calling new repositories.
