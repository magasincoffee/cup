import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {patch} from './patch-qa.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'cup-t015-'));
const scriptId='1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF';
const files=['T015_Core.js','T015_Health.js','T015_Lab.js','T015_ReadOnly.html','T015_Projection.js',
'InventoryT015.js','InventoryT015.allocations.js','InventoryT015.fulfillment.js',
'InventoryT015.safe.js','InventoryT015.safe-extra.js','appsscript.json'];
function setup(){
 const base=fs.mkdtempSync(path.join(root,'base-')),head=fs.mkdtempSync(path.join(root,'head-'));
 const templates={
  'T015_Core.js':'T015_OWNER_EMAIL T015_WRITES_ENABLED T015_WRITE_LEASE_UNTIL 1tot2RNXprYLkoOVXDi5j3yyavHyxI_ayR78KdP1Wzuo',
  'T015_Lab.js':'T015_LAB_STATE',
  'T015_Projection.js':'function v7T015StockOrderProjection(){}',
  'T015_ReadOnly.html':"<script>function renderSummary(){const entries=[['Đơn có trạng thái suy ra khác dữ liệu lưu',c.projectedOrderMismatches]];} renderSummary();renderStocks();renderOrders(); foo.v7T015StockOrderProjection();</script>",
  'appsscript.json':JSON.stringify({webapp:{access:'MYSELF',executeAs:'USER_DEPLOYING'}}),
 };
 for(const dir of [base,head]){
  fs.writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId}));
  for(const f of files)fs.writeFileSync(path.join(dir,f),templates[f]||'// QA fixture');
 }
 return {base,head};
}
let n=0;
function test(label,fn){fn();n++;console.log('PASS '+label)}
test('strict QA baseline patched',()=>{const {base,head}=setup(),r=patch(head,base);
 assert.equal(r.outputFiles,12);
 assert.deepEqual(r.updated,['T015_ReadOnly.html']);
 assert.match(fs.readFileSync(path.join(head,'T015_ReadOnly.html'),'utf8'),/v7T015OrderTriageQA/);
});
test('changed HEAD rejected',()=>{const {base,head}=setup();fs.appendFileSync(path.join(head,'T015_Core.js'),'modified');assert.throws(()=>patch(head,base),/HEAD_NOT_EQUAL/)});
test('wrong script id rejected',()=>{const {base,head}=setup();fs.writeFileSync(path.join(head,'.clasp.json'),'{}');assert.throws(()=>patch(head,base),/WRONG_SCRIPT_ID/)});
test('open access rejected',()=>{const {base,head}=setup();for(const d of [base,head])fs.writeFileSync(path.join(d,'appsscript.json'),JSON.stringify({webapp:{access:'ANYONE',executeAs:'USER_DEPLOYING'}}));assert.throws(()=>patch(head,base),/NOT_OWNER_ONLY/)});
test('unexpected source rejected',()=>{const {base,head}=setup();fs.writeFileSync(path.join(head,'Other.js'),'untracked');assert.throws(()=>patch(head,base),/SOURCE_FILE_LIST_DRIFT/)});
test('missing write lease rejected',()=>{const {base,head}=setup();for(const d of [base,head])fs.writeFileSync(path.join(d,'T015_Core.js'),'T015_OWNER_EMAIL T015_WRITES_ENABLED 1tot2RNXprYLkoOVXDi5j3yyavHyxI_ayR78KdP1Wzuo');assert.throws(()=>patch(head,base),/QA_CORE_GUARD_MISSING/)});
test('changed HTML rejected',()=>{const {base,head}=setup();for(const d of [base,head])fs.writeFileSync(path.join(d,'T015_ReadOnly.html'),'unexpected source');assert.throws(()=>patch(head,base),/UI_METRIC_CHANGED/)});
test('old UI writing API rejected',()=>{const {base,head}=setup();for(const d of [base,head])fs.appendFileSync(path.join(d,'T015_ReadOnly.html'),'v7T015LabRunOnce()');assert.throws(()=>patch(head,base),/UNSAFE_UI_WRITE_CALL/)});
fs.rmSync(root,{recursive:true,force:true});
console.log('TOTAL '+n+'/8 PASS');
