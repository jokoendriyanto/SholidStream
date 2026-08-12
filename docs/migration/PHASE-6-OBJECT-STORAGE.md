# Phase 6 — Object Storage Foundation

## Objective

Make media persistence independent of the web/worker node filesystem so workers can be disposable and horizontally scalable.

## Implemented

- Storage provider contract with normalized, traversal-safe object keys.
- Development local provider with put/read/delete/exists behavior.
- S3-compatible provider built on AWS SDK v3, suitable for S3/R2/MinIO/B2-compatible endpoints.
- Presigned read URLs for S3-compatible storage.
- Workspace storage wrapper that forces every customer object under `workspaces/<workspaceId>/...`.
- PostgreSQL media asset/upload schema carrying authoritative object keys and metadata.
- Local lifecycle and tenant-key isolation tests.

## Authority rule

Object storage becomes the authoritative binary store. Worker-local files are caches only and may be deleted at any time. PostgreSQL stores object keys/metadata, never a node-specific absolute path.

## Migration rule

Legacy `public/uploads` remains readable until an importer has copied each asset, calculated/verified its checksum, created a `media_assets` row and switched the corresponding domain read path.
