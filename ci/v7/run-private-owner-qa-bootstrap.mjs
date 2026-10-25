/**
 * MAGASIN CUP V7 private QA script bootstrap.
 * - Only the SHA-256 digest of the approved Script ID is checked in public CI.
 * - Manual protected workflow, preflight by default, install requires explicit phrase.
 * - Installs read-only bridge ONLY to a demonstrably pristine Apps Script project.
 * - Does NOT configure Owner secrets, run Apps Script, deploy or access any workbook.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const APPROVED_SHA256='a52b18dbc14f39d0fcf8dbee74c40446180d13cdc2b08504fa2372925b5beca1';
const MAX_SOURCE_FILES=3;
// Apps Script creates `Mã.gs` under Vietnamese locales; clasp pulls it as `Mã.js`.
const STARTER_FILES=new Set(['Code.js','Mã.js']);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BRIDGE=path.join(ROOT,'ci/v7/private-owner-read-bridge.js');
const DIAGNOSTIC=path.join(ROOT,'ci/v7/private-owner-qa-selfcheck.js');
const gate=(condition,code)=>{if(!condition)throw new Error('V7_QA_BOOTSTRAP_'+code)};
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
export function validateTarget({scriptId,mode,event,ref,confirmation}){
 gate(event==='workflow_dispatch','MANUAL_ONLY');
 gate(ref==='refs/heads/main','MAIN_ONLY');
 gate(['preflight','install'].includes(mode),'MODE_INVALID');
 gate(typeof scriptId==='string'&&scriptId.length>45&&scriptId.length<100,
  'TARGET_INVALID');
 gate(sha256(scriptId)===APPROVED_SHA256,'PROJECT_NOT_APPROVED');
 if(mode==='install')gate(confirmation==='INSTALL_V7_QA_READ_ONLY','INSTALL_NOT_APPROVED');
 return {mode,approved:true};
}
export function validatePristineScript(files){
 gate(Array.isArray(files)&&files.length>=1&&files.length<=MAX_SOURCE_FILES,
  'REMOTE_FILE_COUNT');
 const names=files.map(x=>x.name).sort();
 gate(names.includes('appsscript.json'),'MANIFEST_MISSING');
 gate(names.every(x=>x==='appsscript.json'||STARTER_FILES.has(x)),'REMOTE_HAS_EXISTING_SOURCE');
 const starters=names.filter(x=>STARTER_FILES.has(x));
 gate(starters.length<=1,'REMOTE_MULTIPLE_STARTER_FILES');
 const code=files.find(x=>x.name===starters[0])?.content||'';
 gate(/^\s*(?:function\s+myFunction\s*\(\s*\)\s*\{\s*\}\s*;?\s*)?$/.test(code),
  'REMOTE_SOURCE_NOT_EMPTY');
 let manifest;
 try{manifest=JSON.parse(files.find(x=>x.name==='appsscript.json').content)}
 catch{gate(false,'REMOTE_MANIFEST_INVALID')}
 gate(manifest&&typeof manifest==='object'&&!Array.isArray(manifest),
  'REMOTE_MANIFEST_INVALID');
 gate(!manifest.webapp&&!manifest.executionApi&&!manifest.addOns&&!manifest.oauthScopes,
  'REMOTE_MANIFEST_NOT_PRISTINE');
 return {safe:true,existingFiles:names.length};
}
export function validateReadOnlySources(bridge,diagnostic){
 for(const code of [bridge,diagnostic]){
  gate(typeof code==='string'&&code.length>200,'LOCAL_SOURCE_MISSING');
  gate(!/\b(?:doGet|doPost|onOpen|onEdit)\s*\(/.test(code),'PUBLIC_OR_TRIGGER_ENTRY');
  gate(!/\b(?:DriveApp|UrlFetchApp|MailApp|GmailApp|ScriptApp)\b/.test(code),
   'FORBIDDEN_SERVICE');
  gate(!/\.\s*(?:setValue|setValues|appendRow|clearContent|insertRows|deleteRows|setProperty|setProperties|deleteProperty)\s*\(/.test(code),
   'WRITE_API_FOUND');
 }
 gate(bridge.includes('v7OwnerReadSnapshot')&&
      bridge.includes("OWNER_ONLY_READ")&&
      diagnostic.includes('v7OwnerQaSelfCheck'),'REQUIRED_GUARD_MISSING');
 return {safe:true};
}
function listProject(dir){
 return fs.readdirSync(dir).filter(x=>/\.(?:js|html|json)$/.test(x)&&x!=='.clasp.json')
  .sort().map(name=>({name,content:fs.readFileSync(path.join(dir,name),'utf8')}));
}
function clasp(dir,env,args){
 const p=spawnSync('clasp',args,{cwd:dir,env,encoding:'utf8',
  stdio:['ignore','pipe','pipe'],timeout:180000});
 gate(p.status===0,'CLASP_'+args[0].toUpperCase()+'_FAILED');
}
function execute(){
 const scriptId=(process.env.V7_SCRIPT_ID||'').trim();
 const mode=(process.env.V7_MODE||'preflight').trim();
 validateTarget({scriptId,mode,event:process.env.GITHUB_EVENT_NAME,
  ref:process.env.GITHUB_REF,confirmation:process.env.V7_INSTALL_CONFIRM||''});
 const token=(process.env.CLASPRC_JSON||'').trim();
 gate(token.length>50,'OWNER_OAUTH_MISSING');
 let authObject;
 try{authObject=JSON.parse(token)}catch{gate(false,'OWNER_OAUTH_JSON_INVALID')}
 gate(authObject&&typeof authObject==='object','OWNER_OAUTH_JSON_INVALID');
 const auth=path.join(os.homedir(),'.clasprc.json');
 gate(!fs.existsSync(auth),'LOCAL_AUTH_ALREADY_EXISTS');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cup-v7-owner-qa-'));
 const remote=path.join(root,'inspect');
 const readback=path.join(root,'readback');
 const env={...process.env};
 delete env.CLASPRC_JSON;
 delete env.V7_SCRIPT_ID;
 delete env.V7_INSTALL_CONFIRM;
 try{
  fs.writeFileSync(auth,token,{flag:'wx',mode:0o600});
  for(const dir of [remote,readback]){
   fs.mkdirSync(dir);
   fs.writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId}),
    {mode:0o600});
  }
  clasp(remote,env,['pull']);
  const previous=listProject(remote);
  validatePristineScript(previous);
  console.log('V7_QA_PRISTINE_PROJECT_CONFIRMED; SOURCE_WRITE=false');
  const bridge=fs.readFileSync(BRIDGE,'utf8');
  const diagnostic=fs.readFileSync(DIAGNOSTIC,'utf8');
  validateReadOnlySources(bridge,diagnostic);
  console.log('V7_QA_READ_ONLY_SOURCE_VALIDATED');
  if(mode==='preflight'){
   console.log('V7_QA_PREFLIGHT_PASS_NO_WRITES');
   return;
  }
  // Preserve the native manifest; replace only the verified default empty stub.
  const existingStub=previous.find(x=>STARTER_FILES.has(x.name));
  if(existingStub)fs.unlinkSync(path.join(remote,existingStub.name));
  const newFiles=[
   ['V7_QA_ReadBridge.js',bridge],
   ['V7_QA_SelfCheck.js',diagnostic]
  ];
  for(const [name,text] of newFiles)fs.writeFileSync(path.join(remote,name),text);
  clasp(remote,env,['push','--force']);
  clasp(readback,env,['pull']);
  const after=listProject(readback);
  const expectedNames=['V7_QA_ReadBridge.js','V7_QA_SelfCheck.js','appsscript.json'].sort();
  gate(JSON.stringify(after.map(x=>x.name).sort())===JSON.stringify(expectedNames),
   'READBACK_FILESET_CHANGED');
  for(const [name,text] of newFiles)
   gate(sha256(after.find(x=>x.name===name).content)===sha256(text),
    'READBACK_SOURCE_HASH_DRIFT');
  console.log('V7_QA_PRIVATE_READ_SOURCE_INSTALL_PASS');
  console.log('NO_APPS_SCRIPT_EXECUTION_OR_DEPLOYMENT');
  console.log('SCRIPT_PROPERTIES_UNCONFIGURED_FAIL_CLOSED');
 }finally{
  try{fs.rmSync(auth,{force:true})}catch{}
  try{fs.rmSync(root,{recursive:true,force:true})}catch{}
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 execute();
