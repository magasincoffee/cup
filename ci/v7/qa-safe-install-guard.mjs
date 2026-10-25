import fs from "node:fs";
const ID="1DKoSZ3YcLDYqGJ9HoRcZNz8El9cEXDO_IfwBhjKh_wx2BzloJhZafI1V";
const BOOK="1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI";
export const QA_SCRIPT_ID=ID;
export const QA_SOURCE_FILENAME="V7_OwnerReadQA.js";
const fail=code=>{throw Error("V7_QA_INSTALL_GATE_"+code)};
export function validateTarget(scriptId,mode,confirm,event,ref){
 if(scriptId!==ID)fail("WRONG_SCRIPT_ID");
 if(event!=="workflow_dispatch"||ref!=="refs/heads/main")fail("MANUAL_MAIN_ONLY");
 if(!["preflight","install"].includes(mode))fail("UNKNOWN_MODE");
 if(mode==="install"&&confirm!=="INSTALL_V7_QA_READONLY")fail("CONFIRM_REQUIRED");
}
export function validatePristine(files){
 const keys=Object.keys(files).sort();
 if(JSON.stringify(keys)!==JSON.stringify(["Code.js","appsscript.json"])&&
  JSON.stringify(keys)!==JSON.stringify(["appsscript.json"]))fail("TARGET_NOT_PRISTINE");
 if("Code.js" in files&&!/^\s*function\s+myFunction\s*\(\s*\)\s*\{\s*\}\s*$/.test(files["Code.js"]))
  fail("TARGET_DEFAULT_CODE_MODIFIED");
 let manifest;
 try{manifest=JSON.parse(files["appsscript.json"])}catch{fail("MANIFEST_INVALID")}
 if(!manifest||typeof manifest!=="object"||Array.isArray(manifest))fail("MANIFEST_INVALID");
 if(manifest.webapp||manifest.executionApi||manifest.addOns||manifest.sheets||manifest.slides||manifest.docs)
  fail("NON_STANDALONE_MANIFEST");
 if(manifest.runtimeVersion&&manifest.runtimeVersion!=="V8")fail("NOT_V8");
 if(manifest.oauthScopes?.length||manifest.dependencies&&Object.keys(manifest.dependencies).length)
  fail("CUSTOM_SCOPES_OR_DEPENDENCIES");
 return {fileCount:keys.length,isolated:true};
}
export function validateBridge(src){
 if(typeof src!=="string"||!src.includes("var V7_QA_EXPECTED_BOOK = '"+BOOK+"'"))
  fail("BRIDGE_WRONG_WORKBOOK");
 for(const mark of ["function v7_qAuthorize()","function v7OwnerReadSnapshot(","function v7OwnerReadHealth()",
   "OWNER_ONLY_READ","getActiveUser().getEmail()","getEffectiveUser().getEmail()"]){
  if(!src.includes(mark))fail("BRIDGE_REQUIRED_GUARD_MISSING");
 }
 if(/\.\s*(?:appendRow|setValue|setValues|setProperty|setProperties|deleteRow|clearContent|insertRowAfter|createFile)\s*\(/.test(src)||
  /\b(?:doGet|doPost|UrlFetchApp|MailApp|DriveApp)\b/.test(src))fail("BRIDGE_MUTATION_OR_ENDPOINT");
 return {readOnly:true,sourceBytes:Buffer.byteLength(src)};
}
export function getFileSet(directory){
 const files={};
 for(const name of fs.readdirSync(directory)){
  if(name===".clasp.json")continue;
  if(!/\.(?:js|json|gs)$/.test(name))fail("UNEXPECTED_PROJECT_FILE");
  files[name]=fs.readFileSync(directory+"/"+name,"utf8");
 }
 return files;
}
