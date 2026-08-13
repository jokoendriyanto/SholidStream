# Phase 12 — YouTube Integration V2

YouTube is now modeled as a workspace-scoped integration connection rather than user-scoped fields in the legacy SQLite model. OAuth, client creation, channel access, live-resource creation and quota accounting are separate modules.

Credentials and stream keys are accepted only through an injected secret codec and are stored as ciphertext. API-operation quota costs are configuration, not credential/project rotation logic.
