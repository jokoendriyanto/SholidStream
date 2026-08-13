'use strict';

const SUPPORTED_COMMAND_VERSION = 1;
const START_SESSION = 'START_SESSION';
const STOP_SESSION = 'STOP_SESSION';

function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
    throw new TypeError(`${name} must be a non-empty safe string`);
  }
}

function assertBaseCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) throw new TypeError('Worker command must be an object');
  if (command.version !== SUPPORTED_COMMAND_VERSION) throw new TypeError(`Unsupported worker command version: ${command.version}`);
  assertNonEmptyString(command.sessionId, 'sessionId');
  assertNonEmptyString(command.workspaceId, 'workspaceId');
  if (!Number.isInteger(command.generation) || command.generation < 1) throw new TypeError('generation must be a positive integer');
  assertNonEmptyString(command.leaseToken, 'leaseToken');
}

function validateSource(source, index) {
  if (!source || typeof source !== 'object') throw new TypeError(`sources[${index}] must be an object`);
  if (!['file', 'url'].includes(source.kind)) throw new TypeError(`sources[${index}].kind must be file or url`);
  assertNonEmptyString(source.uri, `sources[${index}].uri`);
}

function validateOutput(output, index) {
  if (!output || typeof output !== 'object') throw new TypeError(`outputs[${index}] must be an object`);
  assertNonEmptyString(output.url, `outputs[${index}].url`);
  if (!/^rtmps?:\/\//i.test(output.url)) throw new TypeError(`outputs[${index}].url must use RTMP/RTMPS`);
}

function validateStartSessionCommand(command) {
  assertBaseCommand(command);
  if (command.command !== START_SESSION) throw new TypeError('Expected START_SESSION command');
  assertNonEmptyString(command.definitionId, 'definitionId');
  if (!Array.isArray(command.sources) || command.sources.length < 1) throw new TypeError('START_SESSION requires at least one source');
  if (!Array.isArray(command.outputs) || command.outputs.length < 1) throw new TypeError('START_SESSION requires at least one output');
  command.sources.forEach(validateSource);
  command.outputs.forEach(validateOutput);
  if (command.encodingProfile != null && typeof command.encodingProfile !== 'object') throw new TypeError('encodingProfile must be an object');
  if (command.runtimePolicy != null && typeof command.runtimePolicy !== 'object') throw new TypeError('runtimePolicy must be an object');
  return command;
}

function validateStopSessionCommand(command) {
  assertBaseCommand(command);
  if (command.command !== STOP_SESSION) throw new TypeError('Expected STOP_SESSION command');
  return command;
}

function validateWorkerCommand(command) {
  if (!command || typeof command !== 'object') throw new TypeError('Worker command must be an object');
  if (command.command === START_SESSION) return validateStartSessionCommand(command);
  if (command.command === STOP_SESSION) return validateStopSessionCommand(command);
  throw new TypeError(`Unsupported worker command: ${command.command}`);
}

module.exports = {
  SUPPORTED_COMMAND_VERSION,
  START_SESSION,
  STOP_SESSION,
  validateStartSessionCommand,
  validateStopSessionCommand,
  validateWorkerCommand
};
