'use strict';
class YoutubeQuotaRepository{
 constructor(pool){this.pool=pool;}
 async consume({workspaceId,connectionId=null,operation,units,correlationId=null,dailyLimit}){const client=await this.pool.connect();try{await client.query('BEGIN');const usage=await client.query(`SELECT COALESCE(SUM(units),0)::int AS used FROM youtube_quota_usage WHERE workspace_id=$1 AND quota_day=CURRENT_DATE FOR UPDATE`,[workspaceId]);const used=usage.rows[0]?.used||0;if(Number.isFinite(dailyLimit)&&used+units>dailyLimit){const error=new Error('YouTube quota budget exceeded');error.code='YOUTUBE_QUOTA_BUDGET_EXCEEDED';throw error;}await client.query(`INSERT INTO youtube_quota_usage(workspace_id,connection_id,operation,units,correlation_id) VALUES($1,$2,$3,$4,$5)`,[workspaceId,connectionId,operation,units,correlationId]);await client.query('COMMIT');return{used:used+units,remaining:Number.isFinite(dailyLimit)?Math.max(0,dailyLimit-used-units):null};}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}}
}
module.exports={YoutubeQuotaRepository};
