'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSystemController } = require('../../src/http/controllers/system.controller');

function createResponseRecorder() {
  return {
    payload: undefined,
    json(value) {
      this.payload = value;
      return this;
    }
  };
}

test('getServerTime preserves legacy response shape', () => {
  const fixedDate = new Date('2026-08-12T13:27:05.000Z');
  const controller = createSystemController({
    axios: { get: async () => ({ data: [] }) },
    now: () => fixedDate
  });
  const res = createResponseRecorder();

  controller.getServerTime({}, res);

  assert.equal(res.payload.serverTime, fixedDate.toISOString());
  assert.equal(typeof res.payload.formattedTime, 'string');
  assert.equal(res.payload.timezoneOffset, fixedDate.getTimezoneOffset());
});

test('getDonators returns upstream payload', async () => {
  const expected = [{ name: 'Supporter' }];
  const controller = createSystemController({
    axios: {
      get: async (url, options) => {
        assert.equal(url, 'https://donate.youtube101.id/api/donators');
        assert.deepEqual(options, { params: { limit: 20 } });
        return { data: expected };
      }
    }
  });
  const res = createResponseRecorder();

  await controller.getDonators({}, res);
  assert.deepEqual(res.payload, expected);
});

test('getDonators degrades to an empty array on upstream failure', async () => {
  const controller = createSystemController({
    axios: { get: async () => { throw new Error('offline'); } }
  });
  const res = createResponseRecorder();

  await controller.getDonators({}, res);
  assert.deepEqual(res.payload, []);
});
