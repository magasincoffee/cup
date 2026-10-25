import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {prepareFaultCopy,EXPECTED_FILES} from './disposable-prepare.mjs';

const ORIGINAL_PROJECT='1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF';
const ACTION=process.env.ACTION_MODE||'preflight';
const CONFIRM=process.env.CREATE_CONFIRM||'';
const pass=(ok,msg)=>{if(!ok)throw Error('T015_DISPOSABLE_CI_'+msg)};
pass(process.env.GITHUB_EVENT_NAME==='workflow_dispatch','MANUAL_ONLY');
pass(process.env.GITHUB_REF==='refs/heads/main','MAIN_ONLY');
pass(['preflight','create'].includes(ACTION),'UNEXPECTED_MODE');
if(ACTION==='create')pass(CONFIRM==='CREATE_T015_DISPOSABLE','CREATE_NOT_APPROVED');
const credential=(process.env.CLASPRC_JSON||'').trim();
pass(credential.length>50,'OWNER_CREDENTIAL_MISSING');
try{JSON.parse(credential)}catch(_){throw Error('T015_DISPOSABLE_CI_INVALID_OAUTH_JSON')}
const auth=path.join(os.homedir(),'.clasprc.json');
pass(!fs.existsSync(auth),'AUTH_FILE_ALREADY_PRESENT');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'t015-disposable-'));
const immutable=path.join(root,'immutable-v4');
const head=path.join(root,'original-qa-head');
const prepared=path.join(root,'prepared');
const fresh=path.join(root,'new-isolated-project');
const readback=path.join(root,'created-readback');
const env={...process.env};delete env.CLASPRC_JSON;
const digest=(dir,file)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex');
function clasp(dir,args) {
  const result=spawnSync('clasp',args,{cwd:dir,encoding:'utf8',env,
    stdio:['ignore','pipe','pipe'],timeout:180000});
  pass(result.status===0,'CLASP_'+args[0]+'_FAILED');
  return (result.stdout||'').trim();
}
const list=dir=>fs.readdirSync(dir).filter(x=>/\.(?:js|html|json)$/.test(x)&&x!=='.clasp.json').sort();
function readProject(dir,version) {
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId:ORIGINAL_PROJECT}),{mode:0o600});
  clasp(dir,version?['pull','--versionNumber',version]:['pull']);
  console.log('PASS read-only clasp pull');
}
try {
  fs.writeFileSync(auth,credential,{flag:'wx',mode:0o600});
  readProject(immutable,'4');
  readProject(head,null);
  const a=list(immutable),b=list(head);
  pass(JSON.stringify(a)===JSON.stringify(b),'QA_HEAD_FILESET_DRIFT');
  for(const f of a)pass(digest(immutable,f)===digest(head,f),'QA_HEAD_V4_DRIFT');
  console.log('PASS immutable QA @4 source matches HEAD');
  fs.mkdirSync(prepared);
  const report=prepareFaultCopy(immutable,prepared);
  pass(report.oneShotDisabled&&report.workbookId==='1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI','DISPOSABLE_GUARDS_NOT_SET');
  console.log('PASS disposable source mapping: '+report.files+' files, one-shot disabled');
  if(ACTION==='preflight'){
    console.log('PREFLIGHT_PASS: no Google Script project created, no Google writes');
  }else{
    fs.mkdirSync(fresh);
    const label='T015 DISPOSABLE FAULT QA — '+String(process.env.GITHUB_RUN_ID||'MANUAL');
    clasp(fresh,['create','--type','standalone','--title',label]);
    const newConfig=JSON.parse(fs.readFileSync(path.join(fresh,'.clasp.json'),'utf8'));
    const newId=newConfig.scriptId;
    pass(typeof newId==='string'&&newId.length>25&&newId!==ORIGINAL_PROJECT,'INVALID_NEW_SCRIPT_ID');
    const createdFiles=fs.readdirSync(fresh);
    pass(createdFiles.every(f=>f==='.clasp.json'||f==='appsscript.json'),'UNEXPECTED_NEW_SCRIPT_CONTENT');
    for(const f of EXPECTED_FILES)fs.copyFileSync(path.join(prepared,f),path.join(fresh,f));
    pass(JSON.stringify(list(fresh))===JSON.stringify(EXPECTED_FILES),'NEW_SCRIPT_FILESET_CHANGED');
    clasp(fresh,['push','--force']);
    fs.mkdirSync(readback);
    fs.writeFileSync(path.join(readback,'.clasp.json'),JSON.stringify({scriptId:newId}),{mode:0o600});
    clasp(readback,['pull']);
    pass(JSON.stringify(list(readback))===JSON.stringify(EXPECTED_FILES),'NEW_SCRIPT_READBACK_FILESET_DRIFT');
    for(const f of EXPECTED_FILES)pass(digest(fresh,f)===digest(readback,f),'NEW_SCRIPT_SOURCE_HASH_DRIFT');
    console.log('PASS readback '+EXPECTED_FILES.length+' source files on NEW isolated project');
    console.log('NEW_FAULT_QA_SCRIPT_ID='+newId);
    console.log('NEW_FAULT_QA_SCRIPT_URL=https://script.google.com/d/'+newId+'/edit');
    console.log('STOP: no deployment, no execution, no Script Properties set');
    console.log('WRITE_GATE_IN_NEW_PROJECT=UNCONFIGURED_FAIL_CLOSED');
  }
} finally {
  try{fs.rmSync(auth,{force:true})}catch(_){}
  try{fs.rmSync(root,{force:true,recursive:true})}catch(_){}
}
