# Phase 13 — Entitlements and Billing

Plans define feature entitlements. Workspace subscriptions select a plan. Runtime checks depend on feature keys and numeric limits rather than plan-name conditionals. Usage is idempotently metered in a ledger, while billing transactions are provider-neutral and deduplicated by provider transaction ID.
