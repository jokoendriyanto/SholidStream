'use strict';

const { STREAM_STATE, TERMINAL_STATES, TRANSITIONS } = require('./stream-state');

class InvalidStreamTransitionError extends Error {
  constructor(from, to) {
    super(`Invalid stream transition: ${from} -> ${to}`);
    this.name = 'InvalidStreamTransitionError';
    this.code = 'INVALID_STREAM_TRANSITION';
    this.from = from;
    this.to = to;
  }
}

function isKnownState(state) {
  return Object.prototype.hasOwnProperty.call(STREAM_STATE, state);
}

function canTransition(from, to) {
  if (!isKnownState(from) || !isKnownState(to)) return false;
  return TRANSITIONS[from].has(to);
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) throw new InvalidStreamTransitionError(from, to);
  return true;
}

function isTerminal(state) {
  return TERMINAL_STATES.has(state);
}

module.exports = { InvalidStreamTransitionError, isKnownState, canTransition, assertTransition, isTerminal };
