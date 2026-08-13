'use strict';
class EntitlementService{
 constructor(pool){if(!pool||typeof pool.query!=='function')throw new TypeError('PostgreSQL pool is required');this.pool=pool;}
 async snapshot(workspaceId){const result=await this.pool.query(`SELECT pe.feature_key,pe.enabled,pe.limit_value FROM subscriptions s JOIN plan_entitlements pe ON pe.plan_id=s.plan_id WHERE s.workspace_id=$1 AND s.status IN ('TRIAL','ACTIVE','GRACE') ORDER BY s.created_at DESC`,[workspaceId]);const map=new Map();for(const row of result.rows){if(!map.has(row.feature_key))map.set(row.feature_key,{enabled:row.enabled,limit:row.limit_value===null?null:Number(row.limit_value)});}return map;}
 async assertFeature(workspaceId,featureKey){const ent=await this.snapshot(workspaceId);const value=ent.get(featureKey);if(!value?.enabled){const e=new Error(`Feature ${featureKey} is not entitled`);e.code='ENTITLEMENT_REQUIRED';throw e;}return value;}
 async assertLimit(workspaceId,featureKey,currentUsage,increment=1){const value=await this.assertFeature(workspaceId,featureKey);if(value.limit!==null&&currentUsage+increment>value.limit){const e=new Error(`Entitlement limit exceeded for ${featureKey}`);e.code='ENTITLEMENT_LIMIT_EXCEEDED';e.limit=value.limit;throw e;}return value;}
}
module.exports={EntitlementService};
