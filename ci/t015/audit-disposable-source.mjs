/**
 * T015 separate Apps Script read-only provenance audit.
 * No Script execution, deploy, push, property mutation or Google Sheets write.
 * Inspect only immutable Owner QA @4 and new disposable Apps Script HEAD.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {prepareFaultCopy,EXPECTED_FILES} from './disposable-prepare.mjs';

const oldScript='1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF';
const newScript='1Ywd72VfivnefEJMAZQ42ojw0QlfjyM1CUsbqlOJQnMkebamiZPAwvMM5';
const oldWorkbook='1tot2RNXprYLkoOVXDi5j3yyavHyxI_ayR78KdP1Wzuo';
const newWorkbook='1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI';
const gate=(ok,reason)=>{if(!ok)throw Error('T015_DISPOSABLE_SOURCE_AUDIT_'+reason)};
gate(process.env.GITHUB_EVENT_NAME==='workflow_dispatch','MANUAL_ONLY');
gate(process.env.GITHUB_REF==='refs/heads/main','MAIN_ONLY');
const credentials=(process.env.CLASPRC_JSON||'').trim();
gate(credentials.length>50,'OWNER_OAUTH_NOT_CONFIGURED');
try{JSON.parse(credentials)}catch(_){throw Error('T015_DISPOSABLE_SOURCE_AUDIT_INVALID_OAUTH')}
const authFile=path.join(os.homedir(),'.clasprc.json');
gate(!fs.existsSync(authFile),'AUTH_FILE_ALREADY_PRESENT');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'t015-disposable-audit-'));
const immutable=path.join(root,'old-immutable-v4');
const oldHead=path.join(root,'old-head');
const expected=path.join(root,'expected-new');
const actual=path.join(root,'actual-new');
const childEnv={...process.env};delete childEnv.CLASPRC_JSON;
function claspPull(dir,scriptId,version){
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId}),{mode:0o600});
 const argv=version?['pull','--versionNumber',version]:['pull'];
 const r=spawnSync('clasp',argv,{cwd:dir,env:childEnv,encoding:'utf8',
   stdio:['ignore','pipe','pipe'],timeout:180000});
 gate(r.status===0,'CLASP_READ_FAILED');
 console.log('PASS owner-authorized read-only source pull');
}
const filenames=dir=>fs.readdirSync(dir).filter(f=>/\.(?:js|html|json)$/.test(f)&&f!=='.clasp.json').sort();
const digest=(dir,f)=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex');
const matches=(a,b)=>{
 const aa=filenames(a),bb=filenames(b);
 gate(JSON.stringify(aa)===JSON.stringify(bb),'SOURCE_FILESET_CHANGED');
 for(const f of aa)gate(digest(a,f)===digest(b,f),'SOURCE_CONTENT_DRIFT');
 return aa.length;
};
try{
 fs.writeFileSync(authFile,credentials,{flag:'wx',mode:0o600});
 claspPull(immutable,oldScript,'4');
 claspPull(oldHead,oldScript,null);
 gate(matches(immutable,oldHead)===12,'OLD_QA_IMMUTABLE_SOURCE_DRIFT');
 console.log('PASS source immutable QA @4 equals original QA HEAD');
 fs.mkdirSync(expected);
 const report=prepareFaultCopy(immutable,expected);
 gate(report.oneShotDisabled&&report.workbookId===newWorkbook,'FAULT_PROJECT_TRANSFORM_FAILED');
 claspPull(actual,newScript,null);
 gate(matches(expected,actual)===12,'NEW_DISPOSABLE_SOURCE_DRIFT');
 console.log('PASS new script exact 12-file fingerprint matches expected transformed QA');
 const jsFiles=filenames(actual);
 const merged=jsFiles.filter(x=>x!=='appsscript.json').map(x=>fs.readFileSync(path.join(actual,x),'utf8')).join('\n');
 gate(!merged.includes(oldWorkbook)&&merged.includes(newWorkbook),'SOURCE_POINTS_TO_WRONG_WORKBOOK');
 const lab=fs.readFileSync(path.join(actual,'T015_Lab.js'),'utf8');
 gate(lab.includes('T015_DISPOSABLE_ONE_SHOT_DISABLED'),'PREVIOUS_LAB_MAY_RUN');
 const core=fs.readFileSync(path.join(actual,'T015_Core.js'),'utf8');
 gate(core.includes('T015_WRITES_ENABLED')&&core.includes('T015_WRITE_LEASE_UNTIL')&&
 core.includes('T015_OWNER_EMAIL'),'WRITE_OWNER_GUARDS_MISSING');
 const manifest=JSON.parse(fs.readFileSync(path.join(actual,'appsscript.json'),'utf8'));
 gate(manifest.webapp?.access==='MYSELF'&&manifest.webapp?.executeAs==='USER_DEPLOYING',
 'WEBAPP_NOT_OWNER_ONLY');
 console.log('PASS disposable Script source points only to private workbook clone');
 console.log('PASS original one-shot is disabled, Owner/write-lease guards preserved');
 console.log('PASS no source writes; no Script execution; no project deployed');
 console.log('NOTE: Script Properties not inspected, runtime owner/auth/locks untested');
 console.log('T015_DISPOSABLE_PROVENANCE_AUDIT_PASS');
}finally{
 try{fs.rmSync(authFile,{force:true})}catch(_){}
 try{fs.rmSync(root,{force:true,recursive:true})}catch(_){}
}
