import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPrivateOwnerQaView} from './private-owner-ui-controller.mjs';
import {READ_SCHEMA,READ_OPERATION,createDemoEnvelope} from '../../v7-preview/read-contract.js';
const empty={products:[],orders:[],customers:[]};
const qa=()=>({ok:true,envelope:{schema:READ_SCHEMA,source:'OWNER_QA',readOnly:true,revision:'qa-r1',issuedAt:new Date().toISOString(),payload:empty}});
test('private controller requests read-only snapshot and accepts a valid QA envelope',async()=>{
 let request;
 const data=await loadPrivateOwnerQaView(async input=>{request=input;return qa()});
 assert.deepEqual(request,{schema:READ_SCHEMA,operation:READ_OPERATION});
 assert.equal(data.readOnly,true);
 assert.equal(data.source,undefined);
 assert.equal(data.products.length,0);
});
test('private controller refuses synthetic public data despite valid contract',async()=>{
 await assert.rejects(loadPrivateOwnerQaView(async()=>({ok:true,envelope:createDemoEnvelope(empty)})),/PRIVATE_QA_SOURCE_REQUIRED/);
});
test('denials never create a partial private view',async()=>{
 for(const error of ['FORBIDDEN','AUTH_REQUIRED','READ_FAILED']){
  await assert.rejects(loadPrivateOwnerQaView(async()=>({ok:false,error})));
 }
 await assert.rejects(loadPrivateOwnerQaView(async()=>{throw Error('private token')}),/READ_TRANSPORT_FAILED/);
});
test('private controller never accepts a transport URL instead of a function',async()=>{
 await assert.rejects(loadPrivateOwnerQaView('https://example.invalid/secret'),/READ_TRANSPORT_REQUIRED/);
});
