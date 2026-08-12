'use strict';

const QUEUE_NAMES = Object.freeze({
  STREAM_START: 'stream.start',
  STREAM_STOP: 'stream.stop',
  STREAM_RECOVER: 'stream.recover',
  SCHEDULE_EXECUTE: 'schedule.execute',
  MEDIA_PROBE: 'media.probe',
  MEDIA_PROCESS: 'media.process',
  YOUTUBE_CREATE: 'youtube.create',
  YOUTUBE_UPLOAD: 'youtube.upload',
  NOTIFICATION_SEND: 'notification.send'
});

module.exports = { QUEUE_NAMES };
