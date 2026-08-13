# Phase 11 — Watchdog, Recovery and Failover

The watchdog detects expired session leases, applies a bounded recovery policy, fences the old generation, releases old capacity, records the recovery attempt, and queues a recovery job.

The old worker cannot continue ownership because every heartbeat is generation + lease-token-hash scoped. A recovered generation is allocated through the normal Phase 9 allocator and routed to a worker-specific queue.
