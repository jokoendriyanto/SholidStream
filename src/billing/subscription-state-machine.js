'use strict';
const TRANSITIONS=Object.freeze({TRIAL:new Set(['ACTIVE','EXPIRED','CANCELLED']),ACTIVE:new Set(['PAST_DUE','CANCELLED','EXPIRED']),PAST_DUE:new Set(['ACTIVE','GRACE','SUSPENDED','CANCELLED']),GRACE:new Set(['ACTIVE','SUSPENDED','CANCELLED','EXPIRED']),SUSPENDED:new Set(['ACTIVE','CANCELLED','EXPIRED']),CANCELLED:new Set([]),EXPIRED:new Set([])});
function canTransitionSubscription(from,to){return !!TRANSITIONS[from]?.has(to);}function assertSubscriptionTransition(from,to){if(!canTransitionSubscription(from,to)){const e=new Error(`Invalid subscription transition: ${from} -> ${to}`);e.code='INVALID_SUBSCRIPTION_TRANSITION';throw e;}return true;}
module.exports={TRANSITIONS,canTransitionSubscription,assertSubscriptionTransition};
