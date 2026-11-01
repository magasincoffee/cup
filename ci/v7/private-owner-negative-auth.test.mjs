import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./private-owner-read-bridge.js',import.meta.url),'utf8');
const expectedBook='1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI';
function denied({active='owner@example.invalid',effective='owner@example.invalid',mode='OWNER_ONLY_READ',owner='owner@example.invalid',book=expectedBook}={}){
 let access=0;
 const props={V7_QA_READ_MODE:mode,V7_QA_READ_OWNER_EMAIL:owner,V7_QA_READ_BOOK_ID:book};
 const sandbox={
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]??null})},
  Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>effective})},
  SpreadsheetApp:{openById:()=>{access++;throw Error('WORKBOOK_MUST_NOT_BE_OPENED')}}
 };
 vm.createContext(sandbox);
 vm.runInContext(source,sandbox,{timeout:1000});
 const response=sandbox.v7OwnerReadSnapshot({schema:'magasin-cup.v7.read.v1',operation:'READ_SNAPSHOT_V1'});
 return {response:JSON.parse(JSON.stringify(response)),access};
}
test('missing identity is rejected before any workbook operation',()=>{
 const r=denied({active:''});
 assert.deepEqual(r.response,{ok:false,error:'AUTH_REQUIRED'});
 assert.equal(r.access,0);
});
test('non-Owner active and effective identities receive no payload',()=>{
 for(const options of [{active:'staff@example.invalid'},{active:'manager@example.invalid'},{effective:'staff@example.invalid'},{owner:'different@example.invalid'}]){
  const r=denied(options);
  assert.deepEqual(r.response,{ok:false,error:'FORBIDDEN'});
  assert.equal(r.access,0);
  assert.equal('envelope' in r.response,false);
 }
});
test('disabled configuration and different workbook deny before access',()=>{
 for(const options of [{mode:'DISABLED'},{owner:''},{book:'other-workbook'}]){
  const r=denied(options);
  assert.deepEqual(r.response,{ok:false,error:'FORBIDDEN'});
  assert.equal(r.access,0);
 }
});
