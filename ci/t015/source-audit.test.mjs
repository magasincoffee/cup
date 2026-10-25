import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {auditSource} from './source-audit.mjs';

const names=['T015_Core.js','T015_Health.js','T015_Lab.js','T015_ReadOnly.html',
'T015_Projection.js','T015_OrderTriage.js','InventoryT015.js',
'InventoryT015.allocations.js','InventoryT015.fulfillment.js',
'InventoryT015.safe.js','InventoryT015.safe-extra.js','appsscript.json'];
function fixture(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t015-src-check-'));
 const initial={
  'appsscript.json':JSON.stringify({webapp:{access:'MYSELF',executeAs:'USER_DEPLOYING'}}),
  'T015_Core.js':'T015_OWNER_EMAIL t12Owner_ T015_WRITES_ENABLED T015_WRITE_LEASE_UNTIL LockService V7_IDEMPOTENCY V7_AUDIT_EVENTS PREPARED COMMITTED NEEDS_RECONCILIATION function v7T015RecoverExtra(){}',
  'T015_Lab.js':'T015_LAB_STATE',
  'T015_Projection.js':'function v7T015StockOrderProjection(){}',
  'T015_OrderTriage.js':'function v7T015OrderTriageQA(){}',
  'T015_ReadOnly.html':'Owner QA T015'
 };
 for(const f of names)fs.writeFileSync(path.join(dir,f),initial[f]||'// test');
 try{fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}
}
test('all source markers report present for fixture',()=>fixture(dir=>{
 const result=auditSource(dir);
 assert.deepEqual(result.failures,[]);
 assert.equal(result.liveRuntimeFaultVerified,false);
 assert.equal(result.readyForStockWrites,false);
}));
test('Owner public webapp is denied',()=>fixture(dir=>{
 fs.writeFileSync(path.join(dir,'appsscript.json'),JSON.stringify({webapp:{access:'ANYONE',executeAs:'USER_DEPLOYING'}}));
 assert.ok(auditSource(dir).failures.includes('ownerOnlyManifest'));
}));
test('lost lease guard is denied',()=>fixture(dir=>{
 const f=path.join(dir,'T015_Core.js');
 fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('T015_WRITE_LEASE_UNTIL',''));
 assert.ok(auditSource(dir).failures.includes('lease'));
}));
test('missing recovery function is denied',()=>fixture(dir=>{
 const f=path.join(dir,'T015_Core.js');
 fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('function v7T015RecoverExtra(){}',''));
 assert.ok(auditSource(dir).failures.includes('recoveryEntrypoint'));
}));
test('read-only view cannot use Sheet writes',()=>fixture(dir=>{
 fs.appendFileSync(path.join(dir,'T015_Projection.js'),'appendRow()');
 assert.ok(auditSource(dir).failures.includes('noProjectionWriteCalls'));
}));
test('read-only UI cannot rerun completed lab',()=>fixture(dir=>{
 fs.appendFileSync(path.join(dir,'T015_ReadOnly.html'),'v7T015LabRunOnce()');
 assert.ok(auditSource(dir).failures.includes('noLabRestartButton'));
}));
