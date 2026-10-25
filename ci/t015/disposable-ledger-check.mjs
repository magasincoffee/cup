/**
 * T015 disposable-only journal integrity evaluator.
 * Pure offline JS. Never connects to Google, never prints customer or actor data.
 * This validates table consistency, not real Apps Script runtime fault recovery.
 */
export const REQUIRED_HEADERS = {
  idempotency:['request_id','operation','actor_id','body_hash_sha256','processing_state','entity_id','result_json','started_at_utc','finished_at_utc','error_code'],
  audit:['audit_id','entity_type','entity_id','event_type','actor_id','before_json','after_json','request_id','source','created_at_utc'],
  movements:['movement_id','sku','movement_type','quantity','unit','source_document_id','order_line_id','posting_status','approved_by_actor_id','posted_at_utc','request_id'],
  reservations:['reservation_id','order_line_id','sku','unit','reserved_qty','released_qty','status','revision','request_id']
};
function rowsFrom(grid,expected,table,errors){
  if(!Array.isArray(grid)||!Array.isArray(grid[0])){errors.push(table+'_MISSING');return []}
  const hdr=grid[0].map(String);
  const missing=expected.filter(x=>!hdr.includes(x));
  if(missing.length){errors.push(table+'_SCHEMA_DRIFT');return []}
  const unique=new Set(hdr);if(unique.size!==hdr.length){errors.push(table+'_DUPLICATE_HEADER');return []}
  return grid.slice(1).filter(row=>Array.isArray(row)&&row.some(x=>x!==''&&x!==null&&x!==undefined))
    .map(row=>Object.fromEntries(hdr.map((h,i)=>[h,row[i]??''])));
}
function numeric(v){const n=Number(v);return v!==''&&v!==null&&v!==undefined&&Number.isSafeInteger(n)?n:null}
const uniqueKey=(rows,key,tag,errors)=>{
  const ids=new Set();
  for(const row of rows){
    const id=String(row[key]||'');
    if(!id){errors.push(tag+'_EMPTY_ID');continue}
    if(ids.has(id))errors.push(tag+'_DUPLICATE_ID');
    ids.add(id);
  }
};
export function evaluateSnapshot(grids) {
  const errors=[];
  const ids=rowsFrom(grids.idempotency,REQUIRED_HEADERS.idempotency,'IDEMPOTENCY',errors);
  const audit=rowsFrom(grids.audit,REQUIRED_HEADERS.audit,'AUDIT',errors);
  const moves=rowsFrom(grids.movements,REQUIRED_HEADERS.movements,'MOVEMENTS',errors);
  const holds=rowsFrom(grids.reservations,REQUIRED_HEADERS.reservations,'RESERVATIONS',errors);
  if(errors.length)return {ok:false,blockers:[...new Set(errors)].sort(),counts:{},runtimeVerified:false};
  uniqueKey(ids,'request_id','JOURNAL',errors);
  uniqueKey(audit,'audit_id','AUDIT',errors);
  uniqueKey(moves,'movement_id','MOVEMENT',errors);
  uniqueKey(holds,'reservation_id','RESERVATION',errors);
  const byId=new Map(ids.map(r=>[String(r.request_id),r]));
  const auditedIds=new Set(audit.map(a=>String(a.request_id)));
  const unresolved=ids.filter(r=>r.processing_state!=='COMMITTED');
  if(unresolved.length)errors.push('UNRESOLVED_REQUESTS');
  for(const row of ids){
    if(row.processing_state==='COMMITTED'){
      if(!row.finished_at_utc)errors.push('COMMITTED_NO_FINISH_TIMESTAMP');
      if(!auditedIds.has(String(row.request_id)))errors.push('COMMITTED_WITHOUT_AUDIT');
    }
    if(!row.body_hash_sha256||String(row.body_hash_sha256).length!==64)errors.push('INVALID_JOURNAL_HASH');
  }
  for(const m of moves) {
    if(m.posting_status!=='POSTED')errors.push('STOCK_MOVEMENT_NOT_POSTED');
    if(!['RECEIPT','ISSUE'].includes(String(m.movement_type)))errors.push('UNSUPPORTED_MOVEMENT_TYPE_REQUIRES_REVIEW');
    const q=numeric(m.quantity);
    if(q===null||q<=0)errors.push('INVALID_MOVEMENT_QUANTITY');
    if(!byId.has(String(m.request_id)))errors.push('STOCK_MOVEMENT_ORPHAN_JOURNAL');
    else if(byId.get(String(m.request_id)).processing_state!=='COMMITTED')errors.push('STOCK_MOVEMENT_PENDING_JOURNAL');
    if(!auditedIds.has(String(m.request_id)))errors.push('STOCK_MOVEMENT_MISSING_AUDIT');
  }
  for(const r of holds){
    const held=numeric(r.reserved_qty),released=numeric(r.released_qty);
    if(held===null||released===null||held<0||released<0||released>held)
      errors.push('INVALID_RESERVATION_QUANTITY');
    if(!['ACTIVE','RELEASED'].includes(String(r.status)))errors.push('RESERVATION_STATE_REQUIRES_REVIEW');
    if(r.status==='RELEASED'&&held!==released)errors.push('RELEASED_RESERVATION_NOT_SETTLED');
    if(!byId.has(String(r.request_id)))errors.push('RESERVATION_ORPHAN_JOURNAL');
    else if(byId.get(String(r.request_id)).processing_state!=='COMMITTED')errors.push('RESERVATION_PENDING_JOURNAL');
    if(!auditedIds.has(String(r.request_id)))errors.push('RESERVATION_MISSING_AUDIT');
  }
  return {ok:errors.length===0,blockers:[...new Set(errors)].sort(),
    counts:{requests:ids.length,unresolved:unresolved.length,auditEvents:audit.length,
      stockMovements:moves.length,reservations:holds.length},
    runtimeVerified:false,
    note:'Snapshot evidence only: does not approve writing, deployment or fault injection'};
}
