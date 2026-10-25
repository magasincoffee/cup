import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {QA_SCRIPT_ID,validateTarget,validatePristine,validateBridge} from "./qa-safe-install-guard.mjs";
const src=readFileSync(new URL("./private-owner-read-bridge.js",import.meta.url),"utf8");
const pristine={"Code.js":"function myFunction() {\n\n}\n","appsscript.json":JSON.stringify({timeZone:"Asia/Ho_Chi_Minh",exceptionLogging:"STACKDRIVER",runtimeVersion:"V8"})};
test("only named new V7 QA script can be selected from manual main run",()=>{
 assert.doesNotThrow(()=>validateTarget(QA_SCRIPT_ID,"preflight","","workflow_dispatch","refs/heads/main"));
 assert.doesNotThrow(()=>validateTarget(QA_SCRIPT_ID,"install","INSTALL_V7_QA_READONLY","workflow_dispatch","refs/heads/main"));
 for(const [id,mode,confirm,event,ref] of [
 ["1Ywd72VfivnefEJMAZQ42ojw0QlfjyM1CUsbqlOJQnMkebamiZPAwvMM5","preflight","","workflow_dispatch","refs/heads/main"],
 [QA_SCRIPT_ID,"install","","workflow_dispatch","refs/heads/main"],
 [QA_SCRIPT_ID,"install","INSTALL_V7_QA_READONLY","push","refs/heads/main"],
 [QA_SCRIPT_ID,"install","INSTALL_V7_QA_READONLY","workflow_dispatch","refs/heads/feature"]]){
  assert.throws(()=>validateTarget(id,mode,confirm,event,ref),/V7_QA_INSTALL_GATE_/);
 }
});
test("pristine default Apps Script with Code.js or only manifest is allowed",()=>{
 assert.equal(validatePristine(pristine).isolated,true);
 assert.equal(validatePristine({"appsscript.json":pristine["appsscript.json"]}).fileCount,1);
});
test("existing nondefault code, extra files, webapp or custom OAuth scopes block install",()=>{
 const bad=[
  {...pristine,"Code.js":"function myBusinessLogic(){return 42}"},
  {...pristine,"Other.js":"secret"},
  {...pristine,"appsscript.json":JSON.stringify({runtimeVersion:"V8",webapp:{access:"ANYONE",executeAs:"USER_DEPLOYING"}})},
  {...pristine,"appsscript.json":JSON.stringify({runtimeVersion:"V8",oauthScopes:["https://www.googleapis.com/auth/drive"]})},
  {...pristine,"appsscript.json":JSON.stringify({runtimeVersion:"DEPRECATED_ES5"})},
 ];
 for(const files of bad)assert.throws(()=>validatePristine(files),/V7_QA_INSTALL_GATE_/);
});
test("bridge target references exact disposable workbook, not T015 project or production",()=>{
 assert.equal(validateBridge(src).readOnly,true);
 assert.throws(()=>validateBridge(src.replace("1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI","wrong-book")),/BRIDGE_WRONG_WORKBOOK/);
});
test("missing authorization and API mutation fail closed",()=>{
 assert.throws(()=>validateBridge(src.replace("function v7_qAuthorize()","function unauthorized()")),/BRIDGE_REQUIRED_GUARD_MISSING/);
 assert.throws(()=>validateBridge(src+"\nfunction doPost(e){return '';}"),/BRIDGE_MUTATION_OR_ENDPOINT/);
 assert.throws(()=>validateBridge(src+"\nfunction write(){sheet.setValues([]);}"),/BRIDGE_MUTATION_OR_ENDPOINT/);
});
test("health diagnostic exposes aggregates without names, IDs or account data",()=>{
 assert.ok(src.includes("function v7OwnerReadHealth()"));
 assert.ok(src.includes("priceReviewCount"));
 assert.ok(!/console\.log\(/.test(src));
});
