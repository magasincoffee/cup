import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectScriptPropertyGuards as inspect} from './trace-script-property-guards.mjs';

test('literal Script Properties accesses are counted without reading values',()=>{
 const report=inspect({'A.js':"function gate(){ const p=PropertiesService.getScriptProperties(); const a=p.getProperty('T015_OWNER_EMAIL'); const b=p.getProperty('T015_WRITES_ENABLED'); const c=p.getProperty('T015_WRITE_LEASE_UNTIL'); const ms=Number(c); if(!Number.isFinite(ms))return false; return Date.now()<ms;}"});
 assert.equal(report.ownerKeyReadSites,1);
 assert.equal(report.writeEnabledKeyReadSites,1);
 assert.equal(report.leaseKeyReadSites,1);
 assert.equal(report.leaseNumericConversionCandidateFunctions,1);
 assert.equal(report.leaseFiniteValidationCandidateFunctions,1);
 assert.equal(report.leaseConditionalCandidateFunctions,1);
 assert.equal(report.leaseTextValueFailClosedVerified,false);
 assert.equal(report.actualScriptPropertiesRead,false);
});
test('unprotected Number() conversion is never certified as fail-closed',()=>{
 const r=inspect({'A.js':"function gate(){let v=props.getProperty('T015_WRITE_LEASE_UNTIL');return !(Date.now()>Number(v))}"});
 assert.equal(r.leaseNumericConversionCandidateFunctions,1);
 assert.equal(r.leaseFiniteValidationCandidateFunctions,0);
 assert.equal(r.decision,'MANUAL_GUARD_SOURCE_REVIEW_REQUIRED');
 assert.equal(r.leaseTextValueFailClosedVerified,false);
});
test('literal alias reads are recognized',()=>{
 const r=inspect({'A.js':"const LEASE='T015_WRITE_LEASE_UNTIL';function gate(){const x=props.getProperty(LEASE);return !!x}"});
 assert.equal(r.leaseKeyReadSites,1);
});
test('dynamic property-key reads remain unresolved',()=>{
 const r=inspect({'A.js':'function gate(k){return props.getProperty(k)}'});
 assert.equal(r.leaseKeyReadSites,0);
 assert.equal(r.propertyReadSitesWithDynamicKey,1);
});
test('unrelated methods and string-only constants are not property reads',()=>{
 const r=inspect({'A.js':"const LEASE='T015_WRITE_LEASE_UNTIL';function noop(){return LEASE}"});
 assert.equal(r.leaseKeyReadSites,0);
 assert.equal(r.leaseReferencingFunctions,0);
});
test('Date.parse and new Date are only date-conversion candidates',()=>{
 const r=inspect({'A.js':"function a(){const x=p.getProperty('T015_WRITE_LEASE_UNTIL');return Date.parse(x)}function b(){const x=p.getProperty('T015_WRITE_LEASE_UNTIL');return new Date(x).getTime()}"});
 assert.equal(r.leaseDateConversionCandidateFunctions,2);
 assert.equal(r.leaseTextValueFailClosedVerified,false);
});
test('nested functions cannot double count the same property key access',()=>{
 const r=inspect({'A.js':"function outer(){function inner(){return p.getProperty('T015_WRITE_LEASE_UNTIL')}return inner()}"});
 assert.equal(r.leaseKeyReadSites,1);
});
test('private values, customer data, function names never appear in report',()=>{
 const r=inspect({'Private.js':"function privateOwnerEmail(){const secret='PRIVATE_QA_VALUE';return p.getProperty('T015_OWNER_EMAIL')}"});
 const s=JSON.stringify(r);
 assert.ok(!s.includes('PRIVATE_QA_VALUE'));
 assert.ok(!s.includes('privateOwnerEmail'));
 assert.equal(r.ownerMatchVerified,false);
});
test('empty source and wrong input fail without attesting runtime',()=>{
 assert.throws(()=>inspect({'x.js':null}),/SOURCE_EXPECTED/);
 const r=inspect({});
 assert.equal(r.filesInspected,0);
 assert.equal(r.runtimeRecoveryVerified,false);
 assert.equal(r.decision,'MANUAL_GUARD_SOURCE_REVIEW_REQUIRED');
});
