'use strict'; const crypto=require('crypto');
function signWebhook({secret,timestamp,deliveryId,body}){if(!secret||!timestamp||!deliveryId)throw new TypeError('Webhook signing inputs are required');const serialized=typeof body==='string'?body:JSON.stringify(body);return crypto.createHmac('sha256',secret).update(`${timestamp}.${deliveryId}.${serialized}`,'utf8').digest('hex');}
function verifyWebhook({secret,timestamp,deliveryId,body,signature}){const expected=Buffer.from(signWebhook({secret,timestamp,deliveryId,body}),'hex');let received;try{received=Buffer.from(signature,'hex');}catch{return false;}return expected.length===received.length&&crypto.timingSafeEqual(expected,received);}
module.exports={signWebhook,verifyWebhook};
