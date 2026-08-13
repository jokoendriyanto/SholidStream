# Phase 14 — Automation Platform

Automation campaigns materialize idempotent jobs instead of embedding timers in HTTP processes. Metadata rotation is deterministic, auto-upload/stream jobs dispatch through durable queues, notifications use an outbox, and webhooks use timestamp + delivery-ID HMAC signatures.
