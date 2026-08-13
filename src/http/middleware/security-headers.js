'use strict'; const crypto=require('crypto');
function requestId(req,res,next){const incoming=req.headers['x-request-id'];req.requestId=typeof incoming==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(incoming)?incoming:crypto.randomUUID();res.setHeader('X-Request-Id',req.requestId);next();}
function securityHeaders(req,res,next){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'");next();}
module.exports={requestId,securityHeaders};
