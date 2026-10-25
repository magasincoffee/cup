import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSource} from './trace-source-topology.mjs';
const names=['T015_Core.js','T015_Lab.js','T015_Projection.js','T015_OrderTriage.js',
 'InventoryT015.js','InventoryT015.allocations.js','InventoryT015.fulfillment.js',
 'InventoryT015.safe.js','InventoryT015.safe-extra.js'];
function fixture(){
 const m=Object.fromEntries(names.map(n=>[n,'function empty(){}']));
 m['T015_Core.js']=`const T015_OWNER_EMAIL='owner'; const T015_WRITES_ENABLED='FALSE';
 const T015_WRITE_LEASE_UNTIL='0';
 function runStock(){
 LockService.getScriptLock().waitLock(50);
 PropertiesService.getScriptProperties().getProperty('T015_WRITES_ENABLED');
 sheet.appendRow(['V7_IDEMPOTENCY','PREPARED']);
 sheet.appendRow(['V7_AUDIT_EVENTS','COMMITTED']);
 sheet.appendRow(['NEEDS_RECONCILIATION']);
 }`;
 return m;
}
test('source scan recognizes JS code shapes but does not assert runtime',()=>{
 const r=inspectSource(fixture());
 assert.equal(r.decision,'STATIC_TOPOLOGY_ONLY');
 assert.equal(r.scriptPropertiesVerified,false);
 assert.equal(r.runtimeRecoveryVerified,false);
 assert.ok(r.writerFunctions>=1);
 assert.ok(r.lockReferences>=1);
 assert.ok(r.missingRequired.length===0);
});
test('numeric summary does not contain OAuth data',()=>{
 const r=inspectSource(fixture());
 assert.ok(!JSON.stringify(r).includes('Bearer'));
 assert.ok(!JSON.stringify(r).includes('owner'));
});
test('missing journal COMMITTED marker blocks static gate',()=>{
 const m=fixture();m['T015_Core.js']=m['T015_Core.js'].replace('COMMITTED','OTHER');
 assert.ok(inspectSource(m).missingRequired.includes('COMMITTED'));
});
test('missing lease key blocks static gate',()=>{
 const m=fixture();m['T015_Core.js']=m['T015_Core.js'].replaceAll('T015_WRITE_LEASE_UNTIL','OTHER');
 assert.equal(inspectSource(m).decision,'BLOCK_STATIC_GUARD_MARKERS_MISSING');
});
test('write calls outside explicit direct sequence stay manual review',()=>{
 const m=fixture();
 m['T015_Health.js']='function write(){x.appendRow([1])}';
 const r=inspectSource(m);
 assert.ok(r.ambiguousWriterFunctions>=1);
});
test('file omission is never accepted',()=>{
 const m=fixture();delete m['InventoryT015.safe-extra.js'];
 assert.throws(()=>inspectSource(m),/T015_SOURCE_TRACE_MISSING_FILE/);
});
test('comments alone do not prove required markers',()=>{
 const m=Object.fromEntries(names.map(n=>[n,'// PREPARED COMMITTED V7_IDEMPOTENCY V7_AUDIT_EVENTS T015_WRITES_ENABLED T015_WRITE_LEASE_UNTIL T015_OWNER_EMAIL']));
 const r=inspectSource(m);
 assert.equal(r.decision,'BLOCK_STATIC_GUARD_MARKERS_MISSING');
});
