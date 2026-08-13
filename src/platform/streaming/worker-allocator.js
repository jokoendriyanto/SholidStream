'use strict';

function scoreWorker(worker, preferredRegion = null) {
  const cpu = Number(worker.cpu_percent ?? 0);
  const memory = Number(worker.memory_percent ?? 0);
  const reliability = Number(worker.reliability_score ?? 1);
  const freeSlots = Math.max(0, Number(worker.max_streams) - Number(worker.active_streams) - Number(worker.reserved_streams));
  const regionBonus = preferredRegion && worker.region === preferredRegion ? 150 : 0;
  return (reliability * 200) + (freeSlots * 40) + regionBonus - (cpu * 2.5) - (memory * 1.5);
}

class WorkerAllocator {
  constructor({ workerRepository, reservationRepository, heartbeatTtlMs = 60000 } = {}) {
    if (!workerRepository || !reservationRepository) throw new TypeError('WorkerAllocator dependencies are required');
    this.workerRepository = workerRepository;
    this.reservationRepository = reservationRepository;
    this.heartbeatTtlMs = heartbeatTtlMs;
  }

  async allocate({ sessionId, generation, preferredRegion = null, reservationTtlMs = 30000 }) {
    const candidates = await this.workerRepository.listCandidates({
      heartbeatAfter: new Date(Date.now() - this.heartbeatTtlMs).toISOString(),
      region: preferredRegion
    });
    const ranked = [...candidates].sort((a, b) => scoreWorker(b, preferredRegion) - scoreWorker(a, preferredRegion));
    for (const worker of ranked) {
      try {
        const reservation = await this.reservationRepository.reserve({
          workerId: worker.id,
          sessionId,
          generation,
          ttlMs: reservationTtlMs
        });
        return { worker, reservation, score: scoreWorker(worker, preferredRegion) };
      } catch (error) {
        if (error.code !== 'WORKER_CAPACITY_UNAVAILABLE' && error.code !== '23505') throw error;
      }
    }
    const error = new Error('No healthy stream worker has available capacity');
    error.code = 'NO_WORKER_CAPACITY';
    throw error;
  }
}

module.exports = { WorkerAllocator, scoreWorker };
