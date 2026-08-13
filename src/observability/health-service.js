'use strict';
class HealthService{constructor({pool,redis}={}){this.pool=pool;this.redis=redis;}live(){return{status:'ok',service:'sholidstream-control-plane',time:new Date().toISOString()};}async ready(){const checks={database:false,redis:false};try{await this.pool.query('SELECT 1');checks.database=true;}catch{}try{checks.redis=(await this.redis.ping())==='PONG';}catch{}return{status:checks.database&&checks.redis?'ok':'degraded',checks};}}
module.exports={HealthService};
