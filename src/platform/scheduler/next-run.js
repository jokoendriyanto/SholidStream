'use strict';
function calculateNextRun(schedule,scheduledFor){if(schedule.schedule_kind==='once')return null;if(schedule.schedule_kind==='interval'){const minutes=Number(schedule.trigger_spec?.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>525600)throw new TypeError('interval schedule requires trigger_spec.minutes between 1 and 525600');return new Date(new Date(scheduledFor).getTime()+minutes*60000).toISOString();}throw new TypeError(`Unsupported schedule kind: ${schedule.schedule_kind}`);}
module.exports={calculateNextRun};
