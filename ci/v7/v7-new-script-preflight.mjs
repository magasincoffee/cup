/**
 * V7 new standalone Apps Script preflight: READ-ONLY, no deploy/push.
 * Never logs OAuth credential, source contents, sheet cells or private identity.
 * Run only from manual workflow_dispatch on main in protected QA environment.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

export const TARGET_SCRIPT='1DKoSZ3YcLDYqGJ9HoRcZNz8El9cEXDO_IfwBhjKh_wx2BzloJhZafI1V';
export const TARGET_BOOK='1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI';
const OTHER_SCRIPTS=[
 '1OCdXD7vllGyvz0cuV1Ld0hxhv03EF4TLLfHnvhTFMpbLSVj7XD8k2X8H',
 '1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF',
 '1Ywd72VfivnefEJMAZQ42ojw0QlfjyM1CUsbqlOJQnMkebamiZPAwvMM5'
];
export function assertPreflightTarget(id, book){
 if(id!==TARGET_SCRIPT||book!==TARGET_BOOK||OTHER_SCRIPTS.includes(id))
  throw Error('V7_QA_WRONG_TARGET_BLOCKED');
}
export function inspectFreshProject(files){
 if(!files||typeof files!=='object'||Array.isArray(files))
  throw Error('V7_QA_UNEXPECTED_SOURCE_FILESET');
 const keys=Object.keys(files);
 if(keys.length>3||keys.some(k=>!['Code.js','Code.gs','appsscript.json'].includes(k)))
  throw Error('V7_QA_EXISTING_PROJECT_FILES_REVIEW_REQUIRED');
 const content=files['Code.js']??files['Code.gs']??'';
 if(typeof content!=='string')throw Error('V7_QA_UNEXPECTED_SOURCE_FILESET');
 // Initial Apps Script projects normally have the stock myFunction stub.
 // Abort on any other code rather than accidentally overwrite user work.
 const compact=content.replace(/\s+/g,'').replace(/;$/, '');
 if(compact!==''&&compact!=='functionmyFunction(){}')
  throw Error('V7_QA_NONEMPTY_SOURCE_REVIEW_REQUIRED');
 if(files['appsscript.json']!==undefined){
  let manifest;
  try{manifest=JSON.parse(files['appsscript.json'])}
  catch{throw Error('V7_QA_MANIFEST_INVALID')}
  if(typeof manifest!=='object'||manifest===null||
     (manifest.webapp!==undefined||manifest.executionApi!==undefined))
    throw Error('V7_QA_EXISTING_DEPLOYMENT_CONFIG_REVIEW_REQUIRED');
 }
 return {defaultStub:compact!=='',fileCount:keys.length};
}
function gate(ok,label){if(!ok)throw Error('V7_QA_PREFLIGHT_'+label)}
export async function main(){
 gate(process.env.GITHUB_EVENT_NAME==='workflow_dispatch','MANUAL_ONLY');
 gate(process.env.GITHUB_REF==='refs/heads/main','MAIN_ONLY');
 const credential=(process.env.CLASPRC_JSON||'').trim();
 gate(credential.length>50,'OAUTH_SECRET_UNAVAILABLE');
 let parsed;
 try{parsed=JSON.parse(credential)}catch{throw Error('V7_QA_PREFLIGHT_CREDENTIAL_NOT_JSON')}
 const hasAuth=Boolean(parsed?.tokens||parsed?.token||parsed?.refresh_token);
 gate(hasAuth,'OAUTH_TOKEN_UNAVAILABLE');
 assertPreflightTarget(TARGET_SCRIPT,TARGET_BOOK);
 const scriptSource=fs.readFileSync(new URL('./private-owner-read-bridge.js',import.meta.url),'utf8');
 gate(scriptSource.includes(TARGET_BOOK),'BRIDGE_QA_WORKBOOK_MISMATCH');
 gate(!scriptSource.includes(TARGET_SCRIPT),'BRIDGE_EMBEDDED_SCRIPT_ID_DISALLOWED');
 new vm.Script(scriptSource,{filename:'V7OwnerReadBridge.gs'});
 const authPath=path.join(os.homedir(),'.clasprc.json');
 gate(!fs.existsSync(authPath),'AUTH_FILE_ALREADY_EXISTS');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cup-v7-qa-read-only-'));
 const workspace=path.join(dir,'fresh-project');
 const env={...process.env};delete env.CLASPRC_JSON;
 try{
  fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(workspace,'.clasp.json'),JSON.stringify({scriptId:TARGET_SCRIPT}),{mode:0o600});
  fs.writeFileSync(authPath,credential,{mode:0o600,flag:'wx'});
  const result=spawnSync('clasp',['pull'],{
   cwd:workspace,env,encoding:'utf8',timeout:180000,
   stdio:['ignore','pipe','pipe']
  });
  // Never log stdout/stderr; API failures may contain project metadata.
  gate(result.status===0,'CLASP_PULL_FAILED_CHECK_ACCOUNT_OR_APPS_SCRIPT_API');
  const current={};
  for(const file of fs.readdirSync(workspace)){
   if(file==='.clasp.json'||file.startsWith('.'))continue;
   gate(/\.(?:js|gs|json)$/.test(file),'REMOTE_FILE_TYPE_NOT_EXPECTED');
   current[file]=fs.readFileSync(path.join(workspace,file),'utf8');
  }
  const inspected=inspectFreshProject(current);
  console.log('V7_QA_NEW_SCRIPT_OWNER_PREFLIGHT_SOURCE_READ_PASS_NO_WRITES');
  console.log('V7_QA_PREFLIGHT_STATUS '+JSON.stringify({
   targetVerified:true,workbookPinned:true,newScriptReadable:true,
   freshSource:inspected.defaultStub||inspected.fileCount===1,
   remoteFileCount:inspected.fileCount,
   bridgeSyntaxChecked:true,privateSourceNotPublished:true,
   scriptPropertiesChecked:false,ownerIdentityChecked:false,
   authNegativeTestDone:false,sourceUploaded:false,
   appDeployed:false,transactionWritePerformed:false
  }));
 }finally{
  try{fs.rmSync(authPath,{force:true})}catch{}
  try{fs.rmSync(dir,{force:true,recursive:true})}catch{}
 }
}
if(process.argv[1]?.endsWith('v7-new-script-preflight.mjs')){
 main().catch(e=>{
  // Expose only allowlisted status codes, no source contents.
  const reason=String(e?.message||'UNKNOWN');
  const safe=reason.startsWith('V7_QA_')?reason:'V7_QA_PREFLIGHT_UNEXPECTED_ERROR';
  console.error(safe);
  process.exitCode=1;
 });
}
