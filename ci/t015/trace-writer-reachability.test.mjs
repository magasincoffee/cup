import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectWriterReachability} from './trace-writer-reachability.mjs';
const inspect=code=>inspectWriterReachability({'T015_Core.js':code});
test('a named upstream wrapper with lock and Owner/lease literals is counted as reachable, not verified',()=>{
 const r=inspect(`function guarded(){LockService.getScriptLock();const a='T015_OWNER_EMAIL';
 const b='T015_WRITES_ENABLED';const c='T015_WRITE_LEASE_UNTIL';writeRow();}
 function writeRow(){sheet.appendRow(['fixture']);}`);
 assert.equal(r.writerFunctions,1);
 assert.equal(r.writersReachableFromAllThreeMarkerTypes,1);
 assert.equal(r.writersWithoutStaticLockCaller,0);
 assert.equal(r.decision,'STATIC_CALL_GRAPH_TRIAGE_ONLY');
 assert.equal(r.runtimeRecoveryVerified,false);
});
test('a direct write without a caller stays manual-review candidate',()=>{
 const r=inspect('function rawWrite(){sheet.setValues([[1]])}');
 assert.equal(r.writerFunctions,1);
 assert.equal(r.writersWithoutStaticLockCaller,1);
 assert.equal(r.writersWithoutStaticOwnerMarkerCaller,1);
 assert.equal(r.writersWithoutStaticLeaseMarkerCaller,1);
});
test('a separate unrelated guard function cannot protect a writer',()=>{
 const r=inspect(`function guard(){LockService.getScriptLock(); const x='T015_OWNER_EMAIL';
 const y='T015_WRITES_ENABLED'} function risky(){s.appendRow([1])}`);
 assert.equal(r.writersReachableFromAllThreeMarkerTypes,0);
});
test('guard function called by writer is not upstream authorization proof',()=>{
 const r=inspect(`function guard(){LockService.getScriptLock(); const x='T015_OWNER_EMAIL';
 const y='T015_WRITES_ENABLED'} function risky(){guard();s.appendRow([1])}`);
 assert.equal(r.writersReachableFromAllThreeMarkerTypes,0);
});
test('cross-file named callers are conservatively linked',()=>{
 const r=inspectWriterReachability({
  'A.js':"function wrapper(){LockService.getScriptLock();const a='T015_OWNER_EMAIL';const b='T015_WRITES_ENABLED';perform()}",
  'B.js':'function perform(){sheet.appendRow([1])}'});
 assert.equal(r.writersReachableFromAllThreeMarkerTypes,1);
});
test('duplicate function names do not create invented call paths',()=>{
 const r=inspectWriterReachability({
  'A.js':"function foo(){LockService.getScriptLock();const a='T015_OWNER_EMAIL';const b='T015_WRITES_ENABLED';foo()}",
  'B.js':'function foo(){sheet.appendRow([1])}'});
 assert.equal(r.ambiguousFunctionNames,1);
 assert.equal(r.writersWithoutStaticLockCaller,1);
 assert.ok(r.ambiguousDirectCallSites>0);
});
test('anonymous nested writers cannot be treated as authorized callers',()=>{
 const r=inspect(`function safe(){LockService.getScriptLock(); const x='T015_OWNER_EMAIL';
 const y='T015_WRITES_ENABLED';return function(){sheet.appendRow([1])}}`);
 assert.equal(r.writerFunctions,1);
 assert.equal(r.unnamedWriterFunctions,1);
 assert.equal(r.writersWithoutStaticLockCaller,1);
});
test('arrow assigned to a variable is counted',()=>{
 const r=inspect('const save = ()=>sheet.appendRow([1]);');
 assert.equal(r.writerFunctions,1);
 assert.equal(r.unnamedWriterFunctions,0);
});
test('only aggregate counts and fixed statuses are emitted',()=>{
 const r=inspect(`function privateCustomerSecret(){const token='DO_NOT_LOG';
 sheet.appendRow([token])}`);
 const out=JSON.stringify(r);
 assert.equal(out.includes('DO_NOT_LOG'),false);
 assert.equal(out.includes('privateCustomerSecret'),false);
 assert.equal(out.includes('OAuth'),false);
 assert.equal(r.scriptPropertiesVerified,false);
});
