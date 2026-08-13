# Phase 9 — Worker Registry and Allocator

Phase 9 makes worker selection a control-plane responsibility.

## Added
- durable `worker_nodes` registry and heartbeat health
- capacity reservations with transactional slot accounting
- region/load/reliability-aware allocator
- worker-specific BullMQ queue names
- worker node agent for registration, heartbeat, drain and offline states
- `assigned_worker_id` + reservation assignment on stream sessions
- Worker V1 no longer accepts `QUEUED` self-allocation

## Safety invariants
- a reservation is created before a START_SESSION command is routed
- only HEALTHY workers with heartbeat inside the TTL can be selected
- workers in DRAINING or MAINTENANCE are never new allocation candidates
- queue routing is deterministic by worker UUID
- generation + lease fencing from Phase 8 remains mandatory
