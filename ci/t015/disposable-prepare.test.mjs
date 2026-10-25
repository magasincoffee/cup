import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EXPECTED_FILES,prepareFaultCopy} from './disposable-prepare.mjs';
const old='1tot2RNXprYLkoOVXDi5j3yyavHyxI_ayR78KdP1Wzuo';
const replacement='1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI';
function fixture(callback){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cup-fault-fx-'));
  const source=path.join(root,'source'),target=path.join(root,'target');
  fs.mkdirSync(source);fs.mkdirSync(target);
  for(const name of EXPECTED_FILES){
    let content='// source-only';
    if(name==='appsscript.json')content=JSON.stringify({webapp:{access:'MYSELF',executeAs:'USER_DEPLOYING'}});
    if(name==='T015_Core.js')content='T015_WRITES_ENABLED T015_WRITE_LEASE_UNTIL const book="'+old+'";';
    if(name==='T015_Projection.js')content='const qa="'+old+'";';
    if(name==='T015_Lab.js')content='function v7T015LabRunOnce(){return "old";}';
    fs.writeFileSync(path.join(source,name),content);
  }
  try{callback({source,target})}finally{fs.rmSync(root,{force:true,recursive:true})}
}
test('12 allowed files; all original workbook IDs rewritten',()=>fixture(({source,target})=>{
  const summary=prepareFaultCopy(source,target);
  assert.equal(summary.files,12);
  assert.equal(summary.replacedBookReferences,2);
  assert.equal(summary.oneShotDisabled,true);
  assert.equal(summary.projectIdNotYetCreated,true);
  assert.ok(fs.readFileSync(path.join(target,'T015_Core.js'),'utf8').includes(replacement));
}));
test('synthetic one-shot is blocked even if invoked',()=>fixture(({source,target})=>{
  prepareFaultCopy(source,target);
  const script=fs.readFileSync(path.join(target,'T015_Lab.js'),'utf8');
  assert.match(script,/T015_DISPOSABLE_ONE_SHOT_DISABLED/);
  assert.doesNotMatch(script,/const book="1tot2RNX/);
}));
test('public ownerless Web App manifest blocked',()=>fixture(({source,target})=>{
  fs.writeFileSync(path.join(source,'appsscript.json'),JSON.stringify({webapp:{access:'ANYONE',executeAs:'USER_DEPLOYING'}}));
  assert.throws(()=>prepareFaultCopy(source,target),/NOT_OWNER_ONLY/);
}));
test('wrong original workbook blocked',()=>fixture(({source,target})=>{
  fs.writeFileSync(path.join(source,'T015_Core.js'),'T015_WRITES_ENABLED T015_WRITE_LEASE_UNTIL');
  assert.throws(()=>prepareFaultCopy(source,target),/SOURCE_NOT_OLD_QA_BOOK/);
}));
test('missing write lease blocked',()=>fixture(({source,target})=>{
  fs.writeFileSync(path.join(source,'T015_Core.js'),old+' T015_WRITES_ENABLED');
  assert.throws(()=>prepareFaultCopy(source,target),/MISSING_WRITE_GUARDS/);
}));
test('unexpected file inserted blocked',()=>fixture(({source,target})=>{
  fs.writeFileSync(path.join(source,'Injected.js'),'bad');
  assert.throws(()=>prepareFaultCopy(source,target),/IMMUTABLE_V4_FILESET_DRIFT/);
}));
test('target not empty blocked',()=>fixture(({source,target})=>{
  fs.writeFileSync(path.join(target,'Code.js'),'preexisting');
  assert.throws(()=>prepareFaultCopy(source,target),/TARGET_NOT_EMPTY/);
}));
test('unknown one-shot entrypoint blocked',()=>fixture(({source,target})=>{
  fs.writeFileSync(path.join(source,'T015_Lab.js'),'function other(){}');
  assert.throws(()=>prepareFaultCopy(source,target),/ONE_SHOT_ENTRYPOINT_UNEXPECTED/);
}));
test('duplicate one-shot entrypoint blocked',()=>fixture(({source,target})=>{
  fs.writeFileSync(path.join(source,'T015_Lab.js'),'function v7T015LabRunOnce(){} function v7T015LabRunOnce(){}');
  assert.throws(()=>prepareFaultCopy(source,target),/ONE_SHOT_ENTRYPOINT_UNEXPECTED/);
}));
test('legacy source files are never modified by preparation',()=>fixture(({source,target})=>{
  const before=EXPECTED_FILES.map(f=>fs.readFileSync(path.join(source,f),'utf8'));
  prepareFaultCopy(source,target);
  const after=EXPECTED_FILES.map(f=>fs.readFileSync(path.join(source,f),'utf8'));
  assert.deepEqual(after,before);
}));
