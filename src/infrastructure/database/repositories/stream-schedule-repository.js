'use strict';
const crypto=require('crypto');
class StreamScheduleRepository{
  constructor(pool){if(!pool||typeof pool.connect!=='function')throw new TypeError('PostgreSQL pool with connect() is required');this.pool=pool;}
  async claimDue({limit=50,claimTtlMs=60000}={}){const client=await this.pool.connect();const token=crypto.randomUUID();try{await client.query('BEGIN');const staleBefore=new Date(Date.now()-claimTtlMs).toISOString();const result=await client.query(`SELECT * FROM stream_schedules WHERE enabled=TRUE AND next_run_at<=NOW() AND (claimed_at IS NULL OR claimed_at<$1) ORDER BY next_run_at ASC FOR UPDATE SKIP LOCKED LIMIT $2`,[staleBefore,limit]);const ids=result.rows.map(r=>r.id);if(ids.length){await client.query(`UPDATE stream_schedules SET claim_token=$1,claimed_at=NOW(),updated_at=NOW() WHERE id=ANY($2::uuid[])`,[token,ids]);}await client.query('COMMIT');return result.rows.map(r=>({...r,claim_token:token}));}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}}
  async completeClaim({scheduleId,claimToken,nextRunAt,lastRunAt}){const result=await this.pool.query(`UPDATE stream_schedules SET next_run_at=COALESCE($3,next_run_at),last_run_at=$4,enabled=CASE WHEN $3 IS NULL THEN FALSE ELSE enabled END,claim_token=NULL,claimed_at=NULL,version=version+1,updated_at=NOW() WHERE id=$1 AND claim_token=$2 RETURNING *`,[scheduleId,claimToken,nextRunAt,lastRunAt]);return result.rows[0]||null;}
  async releaseClaim({scheduleId,claimToken}){await this.pool.query('UPDATE stream_schedules SET claim_token=NULL,claimed_at=NULL,updated_at=NOW() WHERE id=$1 AND claim_token=$2',[scheduleId,claimToken]);}
}
module.exports={StreamScheduleRepository};
