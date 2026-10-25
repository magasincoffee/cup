import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSnapshot,REQUIRED_HEADERS} from './disposable-ledger-check.mjs';
const sha='a'.repeat(64);
const auditId=x=>'AU-'+x;
function fixture(){
  const g=Object.fromEntries(Object.entries(REQUIRED_HEADERS).map(([t,h])=>[t,[h]]));
  const obj=(table,row)=>g[table].push(REQUIRED_HEADERS[table].map(k=>row[k]??''));
  const committed=(id,op='STOCK_RECEIVE')=>obj('idempotency',{
    request_id:id,operation:op,actor_id:'QA_OWNER',body_hash_sha256:sha,
    processing_state:'COMMITTED',entity_id:'TEST',result_json:'{}',
    started_at_utc:'2026-10-25T00:00:00Z',finished_at_utc:'2026-10-25T00:00:01Z'
  });
  const aud=(id,name='STOCK_RECEIPT')=>obj('audit',{
    audit_id:auditId(id),entity_type:'STOCK',entity_id:'TEST',event_type:name,
    actor_id:'QA_OWNER',before_json:'{}',after_json:'{}',request_id:id,
    source:'T015-QA',created_at_utc:'2026-10-25T00:00:01Z'
  });
  committed('REQ-R');aud('REQ-R');
  obj('movements',{movement_id:'SM-R',sku:'SKU-TEST',movement_type:'RECEIPT',
    quantity:3,unit:'thùng',source_document_id:'T015_FAKE',posting_status:'POSTED',
    approved_by_actor_id:'QA_OWNER',posted_at_utc:'2026-10-25T00:00:01Z',request_id:'REQ-R'});
  committed('REQ-H','STOCK_RESERVE');aud('REQ-H','STOCK_HOLD');
  obj('reservations',{reservation_id:'SR-H',order_line_id:'DL-TEST',sku:'SKU-TEST',
    unit:'thùng',reserved_qty:2,released_qty:2,status:'RELEASED',revision:3,request_id:'REQ-H'});
  return {g,obj,committed,aud};
}
function evaluate(change){const f=fixture();if(change)change(f);return evaluateSnapshot(f.g)}
function has(code,change){const r=evaluate(change);assert.equal(r.ok,false);assert.ok(r.blockers.includes(code),JSON.stringify(r));}
test('all tab schemas present and synthetic 2 commits accepted',()=>{
 const r=evaluate();assert.equal(r.ok,true);assert.deepEqual(r.counts,{requests:2,unresolved:0,auditEvents:2,stockMovements:1,reservations:1});assert.equal(r.runtimeVerified,false);
});
test('empty snapshot must fail closed',()=>assert.equal(evaluateSnapshot({}).ok,false));
test('schema drift on request state column must block',()=>has('IDEMPOTENCY_SCHEMA_DRIFT',({g})=>{g.idempotency[0][4]='transaction_state'}));
test('duplicate request IDs must block',()=>has('JOURNAL_DUPLICATE_ID',({g})=>g.idempotency.push([...g.idempotency[1]])));
test('request with pending state must block',()=>has('UNRESOLVED_REQUESTS',({g})=>{g.idempotency[1][4]='PREPARED'}));
test('committed missing audit must block',()=>has('COMMITTED_WITHOUT_AUDIT',({g})=>{g.audit=g.audit.slice(0,2)}));
test('movement without journal ID must block',()=>has('STOCK_MOVEMENT_ORPHAN_JOURNAL',({g})=>{g.movements[1][10]='REQ-NOT-FOUND'}));
test('movement without audit must block',()=>has('STOCK_MOVEMENT_MISSING_AUDIT',({g})=>{g.audit[1][7]='REQ-NONE'}));
test('movement must have valid nonnegative integer',()=>has('INVALID_MOVEMENT_QUANTITY',({g})=>{g.movements[1][3]=-4}));
test('movement cannot be queued in an accepted snapshot',()=>has('STOCK_MOVEMENT_NOT_POSTED',({g})=>{g.movements[1][7]='PENDING'}));
test('reservation must belong to a journal request',()=>has('RESERVATION_ORPHAN_JOURNAL',({g})=>{g.reservations[1][8]='REQ-UNKNOWN'}));
test('released quantity must not exceed reserved',()=>has('INVALID_RESERVATION_QUANTITY',({g})=>{g.reservations[1][5]=3}));
test('released reservation with remainder must be reviewed',()=>has('RELEASED_RESERVATION_NOT_SETTLED',({g})=>{g.reservations[1][5]=1}));
test('duplicate movement ID is denied',()=>has('MOVEMENT_DUPLICATE_ID',({g})=>{g.movements.push([...g.movements[1]])}));
test('audit ID duplication denied',()=>has('AUDIT_DUPLICATE_ID',({g})=>{g.audit.push([...g.audit[1]])}));
test('unrecognized reservation state requires review',()=>has('RESERVATION_STATE_REQUIRES_REVIEW',({g})=>{g.reservations[1][6]='FROZEN'}));
test('unrecognized movement type requires review',()=>has('UNSUPPORTED_MOVEMENT_TYPE_REQUIRES_REVIEW',({g})=>{g.movements[1][2]='REVERSAL'}));
test('invalid hash blocks journal',()=>has('INVALID_JOURNAL_HASH',({g})=>{g.idempotency[1][3]='wrong'}));
test('missing commit timestamp blocks',()=>has('COMMITTED_NO_FINISH_TIMESTAMP',({g})=>{g.idempotency[1][8]=''}));
test('no request payload, actor, or customer data logged by evaluator',()=>{
 const r=evaluate();const output=JSON.stringify(r);assert.ok(!output.includes('QA_OWNER'));assert.ok(!output.includes('DL-TEST'));
});
