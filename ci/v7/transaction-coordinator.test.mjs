import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransactionCoordinator} from './transaction-coordinator.mjs';
const intent={type:'RECEIPT_INTENT_V1',requestKey:'payment-001',orderId:'order-001',amountVnd:100000};
const setup=({denied=false,effectThrows=false,finishThrows=false,prepareThrows=false}={})=>{
 const events=[],journal=new Map();let effects=0;
 const store={
  get:async key=>{events.push('get');return journal.get(key)},
  prepare:async row=>{events.push('prepare');if(prepareThrows)throw Error('disk unavailable');if(journal.has(row.requestKey))throw Error('duplicate');journal.set(row.requestKey,{...row})},
  finish:async(key,state)=>{events.push('finish:'+state);if(finishThrows)throw Error('disk unavailable');journal.get(key).state=state}
 };
 const lock={runExclusive:async fn=>{events.push('lock');return fn()}};
 const authorize=async()=>{events.push('auth');if(denied)throw Error('FORBIDDEN')};
 const applyEffect=async()=>{events.push('effect');effects++;if(effectThrows)throw Error('partial failure')};
 return {tx:createTransactionCoordinator({authorize,lock,store,applyEffect}),events,journal,get effects(){return effects}};
};
test('authorized transaction persists PREPARED before effect and COMMITTED afterwards',async()=>{
 const s=setup();const result=await s.tx.execute({actor:{role:'Owner'},intent});
 assert.deepEqual(result,{status:'COMMITTED',replayed:false,requestKey:'payment-001'});
 assert.deepEqual(s.events,['auth','lock','auth','get','prepare','effect','finish:COMMITTED']);
 assert.equal(s.journal.get('payment-001').state,'COMMITTED');
});
test('same request key and payload returns replay without a second effect',async()=>{
 const s=setup();await s.tx.execute({actor:'owner',intent});
 const r=await s.tx.execute({actor:'owner',intent});
 assert.equal(r.replayed,true);assert.equal(s.effects,1);
});
test('same key with different money rejects instead of double charging',async()=>{
 const s=setup();await s.tx.execute({actor:'owner',intent});
 await assert.rejects(s.tx.execute({actor:'owner',intent:{...intent,amountVnd:200000}}),/IDEMPOTENCY_CONFLICT/);
 assert.equal(s.effects,1);
});
test('unauthorized actor never reads or modifies ledger',async()=>{
 const s=setup({denied:true});
 await assert.rejects(s.tx.execute({actor:'staff',intent}),/FORBIDDEN/);
 assert.deepEqual(s.events,['auth']);assert.equal(s.effects,0);
});
test('PREPARED persistence failure stops before applying any financial effect',async()=>{
 const s=setup({prepareThrows:true});
 await assert.rejects(s.tx.execute({actor:'owner',intent}),/disk unavailable/);
 assert.equal(s.effects,0);
});
test('partial effect fails closed and blocks retry until manual reconciliation',async()=>{
 const s=setup({effectThrows:true});
 await assert.rejects(s.tx.execute({actor:'owner',intent}),/NEEDS_RECONCILIATION/);
 assert.equal(s.journal.get('payment-001').state,'NEEDS_RECONCILIATION');
 await assert.rejects(s.tx.execute({actor:'owner',intent}),/NEEDS_RECONCILIATION/);
 assert.equal(s.effects,1);
});
test('commit marker failure stops replay even if effect succeeded',async()=>{
 const s=setup({finishThrows:true});
 await assert.rejects(s.tx.execute({actor:'owner',intent}),/NEEDS_RECONCILIATION/);
 assert.equal(s.journal.get('payment-001').state,'PREPARED');
 await assert.rejects(s.tx.execute({actor:'owner',intent}),/NEEDS_RECONCILIATION/);
 assert.equal(s.effects,1);
});
test('journal tampering halts operation',async()=>{
 const s=setup();s.journal.set(intent.requestKey,{fingerprint:JSON.stringify(intent),state:'UNDEFINED'});
 await assert.rejects(s.tx.execute({actor:'owner',intent}),/JOURNAL_CORRUPT/);
 assert.equal(s.effects,0);
});
test('no Apps Script or network writes in pure protocol',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('./transaction-coordinator.mjs',import.meta.url),'utf8');
 assert.ok(!/SpreadsheetApp|LockService|PropertiesService|UrlFetchApp|google\.script\.run|\bfetch\s*\(/.test(source));
});
