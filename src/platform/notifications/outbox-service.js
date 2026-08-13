'use strict';
class NotificationOutboxService{constructor(pool){this.pool=pool;}async enqueue({workspaceId=null,channel,eventType,recipient=null,payload={}}){const result=await this.pool.query(`INSERT INTO notification_outbox(workspace_id,channel,event_type,recipient,payload) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *`,[workspaceId,channel,eventType,recipient,JSON.stringify(payload)]);return result.rows[0];}}
module.exports={NotificationOutboxService};
