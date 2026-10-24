/**
 * T015 isolated QA GitHub-hosted clasp driver. Never commits or uploads source.
 * Entry is manual workflow_dispatch on main after protected Environment approval.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {patch} from './patch-qa.mjs';
const SCRIPT='1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF';
const MODE=process.env.MODE,CONFIRM=process.env.CONFIRM;
function gate(test,msg){if(!test)throw Error('T015_QA_CI_GATE: '+msg)}
gate(process.env.GITHUB_EVENT_NAME==='workflow_dispatch','MANUAL_TRIGGER_ONLY');
gate(process.env.GITHUB_REF==='refs/heads/main','MAIN_ONLY');
gate(['preflight','deploy'].includes(MODE),'INVALID_MODE');
if(MODE==='deploy')gate(CONFIRM==='T015_QA_APPROVED','DEPLOY_NOT_APPROVED');
const credential=process.env.CLASPRC_JSON||'';
gate(credential.trim().length>50,'CLASPRC_JSON_NOT_SET');
JSON.parse(credential);
const auth=path.join(os.homedir(),'.clasprc.json');
gate(!fs.existsSync(auth),'AUTH_FILE_ALREADY_EXISTS');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'magasin-cup-t015-'));
const v3=path.join(root,'immutable-v3'),head=path.join(root,'current-head');
const readback=path.join(root,'pushed-readback');
for(const folder of [v3,head,readback]){
 fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'.clasp.json'),JSON.stringify({scriptId:SCRIPT}),{mode:0o600});
}
const safeEnv={...process.env};delete safeEnv.CLASPRC_JSON;
function clasp(folder,...args){
 const r=spawnSync('clasp',args,{cwd:folder,env:safeEnv,encoding:'utf8',timeout:180000,
  stdio:['ignore','pipe','pipe']});
 gate(r.status===0,'CLASP_COMMAND_FAILED_'+args[0]+(r.error?'_PROCESS_ERROR':''));
 if(args[0]==='create-deployment')console.log((r.stdout||'').trim());
 else console.log('PASS clasp '+args[0]+(args.includes('3')?' immutable-v3':' QA'));
}
function list(folder){return fs.readdirSync(folder).filter(f=>/\.(?:js|html|json)$/.test(f)&&f!=='.clasp.json').sort()}
function hash(folder,file){return crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,file))).digest('hex')}
try{
 fs.writeFileSync(auth,credential,{mode:0o600,flag:'wx'});
 clasp(v3,'pull','--versionNumber','3');
 clasp(head,'pull');
 const summary=patch(head,v3);
 gate(summary.qaOnly&&summary.outputFiles===12,'UNEXPECTED_QA_PATCH');
 for(const name of list(head).filter(x=>x.endsWith('.js'))){
  new vm.Script(fs.readFileSync(path.join(head,name),'utf8'),{filename:name});
 }
 const html=fs.readFileSync(path.join(head,'T015_ReadOnly.html'),'utf8');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 gate(scripts.length===1,'HTML_SCRIPT_COUNT_CHANGED');
 new vm.Script(scripts[0][1]);
 gate(html.includes('v7T015OrderTriageQA()'),'TRIAGE_NOT_LINKED');
 console.log('PASS Owner-only QA source and patch: '+summary.outputFiles+' files');
 if(MODE==='preflight'){
  console.log('PASS PREFLIGHT_ONLY: NO GOOGLE SOURCE WRITE, NO NEW DEPLOYMENT');
 }else{
  clasp(head,'push','--force');
  clasp(readback,'pull');
  gate(JSON.stringify(list(head))===JSON.stringify(list(readback)),'REMOTE_FILE_LIST_CHANGED');
  for(const f of list(head))gate(hash(head,f)===hash(readback,f),'REMOTE_READBACK_MISMATCH_'+f);
  console.log('PASS QA readback '+list(head).length+' files');
  clasp(head,'create-deployment','--description','T015 Owner-only QA triage via GitHub Actions (not production)');
  console.log('QA_DEPLOY_COMPLETE — signed-in UI acceptance remains required');
 }
}finally{
 try{fs.rmSync(auth,{force:true})}catch(_){}
 try{fs.rmSync(root,{recursive:true,force:true})}catch(_){}
}
