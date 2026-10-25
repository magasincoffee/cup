import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {auditSource} from './source-audit.mjs';

const scriptId='1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF';
const requireGate=(ok,code)=>{if(!ok)throw Error('T015_READ_AUDIT_'+code)};
requireGate(process.env.GITHUB_EVENT_NAME==='workflow_dispatch','MANUAL_ONLY');
requireGate(process.env.GITHUB_REF==='refs/heads/main','MAIN_ONLY');
const credential=(process.env.CLASPRC_JSON||'').trim();
requireGate(credential.length>50,'OWNER_CREDENTIAL_MISSING');
try{JSON.parse(credential)}catch(_){throw Error('T015_READ_AUDIT_INVALID_SECRET')}
const auth=path.join(os.homedir(),'.clasprc.json');
requireGate(!fs.existsSync(auth),'CREDENTIAL_ALREADY_PRESENT');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'t015-static-read-'));
const immutable=path.join(root,'immutable-v4'),head=path.join(root,'qa-head');
const env={...process.env};delete env.CLASPRC_JSON;
function pull(dir,args){
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId}),{mode:0o600});
 const r=spawnSync('clasp',['pull',...args],{cwd:dir,env,encoding:'utf8',
  stdio:['ignore','pipe','pipe'],timeout:180000});
 requireGate(r.status===0,'CLASP_PULL_FAILED');
 console.log('PASS read-only clasp pull');
}
const names=d=>fs.readdirSync(d).filter(f=>/\.(?:js|html|json)$/.test(f)&&f!=='.clasp.json').sort();
const digest=(d,f)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(d,f))).digest('hex');
try{
 fs.writeFileSync(auth,credential,{flag:'wx',mode:0o600});
 pull(immutable,['--versionNumber','4']);
 pull(head,[]);
 const a=names(immutable),b=names(head);
 requireGate(JSON.stringify(a)===JSON.stringify(b),'QA_HEAD_FILE_DRIFT');
 for(const f of a)requireGate(digest(immutable,f)===digest(head,f),'QA_HEAD_HASH_DRIFT');
 console.log('PASS current QA HEAD matches immutable @4 ('+a.length+' files)');
 const report=auditSource(immutable);
 for(const [key,ok] of Object.entries(report.checks))console.log((ok?'PASS ':'FAIL ')+key);
 requireGate(report.failures.length===0,'STATIC_INVARIANT_MISSING');
 console.log('STATIC_SOURCE_AUDIT_PASS; runtime recovery NOT verified; no Google writes.');
}finally{
 try{fs.rmSync(auth,{force:true})}catch(_){}
 try{fs.rmSync(root,{force:true,recursive:true})}catch(_){}
}
