'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const { scoreWorker, WorkerAllocator }=require('../../src/platform/streaming/worker-allocator');
const { workerQueueName }=require('../../src/platform/streaming/worker-routing');

test('allocator prefers same-region low-load reliable workers',()=>{
  const a={region:'sg',cpu_percent:20,memory_percent:30,reliability_score:0.99,max_streams:4,active_streams:1,reserved_streams:0};
  const b={region:'us',cpu_percent:10,memory_percent:20,reliability_score:1,max_streams:4,active_streams:1,reserved_streams:0};
  assert.ok(scoreWorker(a,'sg')>scoreWorker(b,'sg'));
});

test('allocator reserves the highest-ranked available candidate',async()=>{
  const workers=[{id:'w1',region:'sg',cpu_percent:80,memory_percent:80,reliability_score:1,max_streams:2,active_streams:0,reserved_streams:0},{id:'w2',region:'sg',cpu_percent:10,memory_percent:20,reliability_score:1,max_streams:4,active_streams:0,reserved_streams:0}];
  const calls=[]; const allocator=new WorkerAllocator({workerRepository:{listCandidates:async()=>workers},reservationRepository:{reserve:async(input)=>{calls.push(input);return{id:'r1',worker_id:input.workerId};}}});
  const result=await allocator.allocate({sessionId:'s1',generation:1,preferredRegion:'sg'}); assert.equal(result.worker.id,'w2'); assert.equal(calls[0].workerId,'w2');
});

test('worker queue names are deterministic and isolated',()=>{ assert.equal(workerQueueName('11111111-1111-1111-1111-111111111111'),'stream.worker.11111111-1111-1111-1111-111111111111'); });
