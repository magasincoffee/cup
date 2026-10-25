/**
 * Manual-only, protected installation of a read-only bridge into the NEW V7 QA
 * script. Never targets old T015 scripts, V6.4, sheets or production.
 * No Apps Script execution, deployment or Script Properties changes.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
import {QA_SCRIPT_ID,QA_SOURCE_FILENAME,validateTarget,validatePristine,validateBridge,getFileSet} from "./qa-safe-install-guard.mjs";

const mode=process.env.ACTION_MODE??"preflight";
const confirm=process.env.ACTION_CONFIRM??"";
const gate=(v,code)=>{if(!v)throw Error("V7_QA_INSTALL_"+code)};
validateTarget(QA_SCRIPT_ID,mode,confirm,process.env.GITHUB_EVENT_NAME,process.env.GITHUB_REF);
const secret=(process.env.CLASPRC_JSON??"").trim();
gate(secret.length>50,"OWNER_CREDENTIAL_MISSING");
try{const x=JSON.parse(secret);gate(x&&typeof x==="object"&&!Array.isArray(x),"CREDENTIAL_FORMAT_INVALID")}
catch{throw Error("V7_QA_INSTALL_CREDENTIAL_FORMAT_INVALID")}
const auth=path.join(os.homedir(),".clasprc.json");
gate(!fs.existsSync(auth),"AUTH_ALREADY_EXISTS");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"magasin-v7-new-qa-"));
const original=path.join(root,"original"),readback=path.join(root,"readback");
const bridge=fs.readFileSync(new URL("./private-owner-read-bridge.js",import.meta.url),"utf8");
validateBridge(bridge);
const safeEnv={...process.env};delete safeEnv.CLASPRC_JSON;
function init(dir){
 fs.mkdirSync(dir);
 fs.writeFileSync(path.join(dir,".clasp.json"),JSON.stringify({scriptId:QA_SCRIPT_ID}),{mode:0o600});
}
function clasp(dir,args){
 const r=spawnSync("clasp",args,{cwd:dir,env:safeEnv,encoding:"utf8",
  stdio:["ignore","pipe","pipe"],timeout:180000});
 gate(r.status===0,"CLASP_"+args[0].toUpperCase()+"_FAILED");
}
try{
 fs.writeFileSync(auth,secret,{mode:0o600,flag:"wx"});
 init(original);clasp(original,["pull"]);
 const existing=getFileSet(original);
 const status=validatePristine(existing);
 console.log("V7_QA_SCRIPT_PRISTINE="+status.isolated+"; files="+status.fileCount);
 console.log("V7_READONLY_BRIDGE_VERIFIED=true");
 if(mode==="preflight"){
  console.log("V7_QA_PREFLIGHT_PASS_NO_SCRIPT_WRITES");
 }else{
  fs.writeFileSync(path.join(original,QA_SOURCE_FILENAME),bridge,{flag:"wx",mode:0o600});
  clasp(original,["push","--force"]);
  init(readback);clasp(readback,["pull"]);
  const files=getFileSet(readback);
  const names=Object.keys(files).sort();
  const expected=Object.keys({...existing,[QA_SOURCE_FILENAME]:bridge}).sort();
  gate(JSON.stringify(names)===JSON.stringify(expected),"READBACK_FILESET_MISMATCH");
  const hash=x=>crypto.createHash("sha256").update(x).digest("hex");
  gate(hash(files[QA_SOURCE_FILENAME])===hash(bridge),"READBACK_SOURCE_HASH_MISMATCH");
  gate(JSON.stringify(JSON.parse(files["appsscript.json"]))===
   JSON.stringify(JSON.parse(existing["appsscript.json"])),"MANIFEST_DRIFT");
  if(existing["Code.js"])gate(files["Code.js"]?.trim()===existing["Code.js"].trim(),"DEFAULT_CODE_DRIFT");
  console.log("V7_QA_BRIDGE_INSTALL_PASS_READBACK_VERIFIED");
  console.log("STOP_NO_RUN_NO_DEPLOY_NO_SCRIPT_PROPERTIES_NO_SHEET_WRITES");
 }
}finally{
 try{fs.rmSync(auth,{force:true})}catch{}
 try{fs.rmSync(root,{recursive:true,force:true})}catch{}
}
