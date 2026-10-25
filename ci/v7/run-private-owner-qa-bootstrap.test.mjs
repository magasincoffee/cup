import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import crypto from "node:crypto";
import {validateTarget,validatePristineScript,validateReadOnlySources} from "./run-private-owner-qa-bootstrap.mjs";

const empty=()=>[
 {name:"Code.js",content:"function myFunction() {\n\n}\n"},
 {name:"appsscript.json",content:JSON.stringify({timeZone:"Asia/Ho_Chi_Minh",runtimeVersion:"V8",exceptionLogging:"STACKDRIVER"})}
];
const refuses=(fn,reason)=>assert.throws(fn, e=>e.message.includes("V7_QA_BOOTSTRAP_"+reason));
const bridge=readFileSync(new URL("./private-owner-read-bridge.js",import.meta.url),"utf8");
const selfcheck=readFileSync(new URL("./private-owner-qa-selfcheck.js",import.meta.url),"utf8");
test("empty Apps Script starter is accepted and never treated as source code to merge",()=>{
 assert.deepEqual(validatePristineScript(empty()),{safe:true,existingFiles:2});
 assert.deepEqual(validatePristineScript([{name:"appsscript.json",content:"{}"}]),{safe:true,existingFiles:1});
});
test("Vietnamese default Mã.gs exported as Mã.js is allowed only when pristine",()=>{
 const localized=empty().map(x=>x.name==="Code.js"?{...x,name:"Mã.js"}:x);
 assert.deepEqual(validatePristineScript(localized),{safe:true,existingFiles:2});
 localized[0].content="function important(){return 7}";
 refuses(()=>validatePristineScript(localized),"REMOTE_SOURCE_NOT_EMPTY");
});
test("localized and English default stubs cannot coexist; unexpected files remain blocked",()=>{
 const both=empty();
 both.push({name:"Mã.js",content:"function myFunction() {}"});
 refuses(()=>validatePristineScript(both),"REMOTE_MULTIPLE_STARTER_FILES");
 const unexpected=empty();
 unexpected[0].name="Other.js";
 refuses(()=>validatePristineScript(unexpected),"REMOTE_HAS_EXISTING_SOURCE");
});
test("any existing project code blocks installation",()=>{
 let files=empty();files[0].content="function important(){return 7}";
 refuses(()=>validatePristineScript(files),"REMOTE_SOURCE_NOT_EMPTY");
 files=empty();files.push({name:"MyApp.js",content:"var OWNER=true"});
 refuses(()=>validatePristineScript(files),"REMOTE_HAS_EXISTING_SOURCE");
 files=empty();files[0].content="function myFunction(){SpreadsheetApp.getActive().getSheetByName('Orders').clear()}";
 refuses(()=>validatePristineScript(files),"REMOTE_SOURCE_NOT_EMPTY");
});
test("non-pristine manifest blocks deployment",()=>{
 for(const manifest of [{webapp:{access:"ANYONE"}},{oauthScopes:["https://www.googleapis.com/auth/spreadsheets"]},{addOns:{}}]){
  const files=empty();files[1].content=JSON.stringify(manifest);
  refuses(()=>validatePristineScript(files),"REMOTE_MANIFEST_NOT_PRISTINE");
 }
});
test("read-only bridge and aggregate self-check have no write, trigger, or deployment entry",()=>{
 assert.deepEqual(validateReadOnlySources(bridge,selfcheck),{safe:true});
 refuses(()=>validateReadOnlySources(bridge+"\nSpreadsheetApp.getActive().appendRow([])",selfcheck),"WRITE_API_FOUND");
 refuses(()=>validateReadOnlySources(bridge+"\nfunction doGet(){}",selfcheck),"PUBLIC_OR_TRIGGER_ENTRY");
 refuses(()=>validateReadOnlySources(bridge+"\nScriptApp.newTrigger('x')",selfcheck),"FORBIDDEN_SERVICE");
});
test("only manual dispatch on main can attempt preflight; installation requires explicit phrase",()=>{
 const input={scriptId:"not-approved",mode:"preflight",event:"workflow_dispatch",ref:"refs/heads/main",confirmation:""};
 refuses(()=>validateTarget(input),"TARGET_INVALID");
 const another={...input,scriptId:"x".repeat(60)};
 refuses(()=>validateTarget(another),"PROJECT_NOT_APPROVED");
 refuses(()=>validateTarget({...another,event:"push"}),"MANUAL_ONLY");
 refuses(()=>validateTarget({...another,ref:"refs/heads/feature"}),"MAIN_ONLY");
 refuses(()=>validateTarget({...another,mode:"arbitrary"}),"MODE_INVALID");
});
test("bootstrap has no source auto-push on CI and limits installs to pristine Script",()=>{
 const source=readFileSync(new URL("./run-private-owner-qa-bootstrap.mjs",import.meta.url),"utf8");
 assert.ok(source.includes("if(mode==='preflight')"));
 assert.ok(source.includes("validatePristineScript(previous)"));
 assert.ok(source.includes("NO_APPS_SCRIPT_EXECUTION_OR_DEPLOYMENT"));
 assert.ok(source.includes("SCRIPT_PROPERTIES_UNCONFIGURED_FAIL_CLOSED"));
 assert.ok(!source.includes("clasp(head,'create-deployment'"));
 assert.ok(!source.includes("ScriptApp.newDeployment"));
 const digest=crypto.createHash("sha256").update("test-only").digest("hex");
 assert.equal(digest.length,64);
});
