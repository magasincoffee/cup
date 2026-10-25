import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {inspectSource} from './trace-source-topology.mjs';
import {inspectWriterReachability} from './trace-writer-reachability.mjs';
const SCRIPT='1Ywd72VfivnefEJMAZQ42ojw0QlfjyM1CUsbqlOJQnMkebamiZPAwvMM5';
const BOOK='1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI';
const OLD_BOOK='1tot2RNXprYLkoOVXDi5j3yyavHyxI_ayR78KdP1Wzuo';
const OLD_SCRIPT='1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF';
const gate=(ok,msg)=>{if(!ok)throw Error('T015_DISPOSABLE_FLOW_AUDIT_'+msg)};
gate(process.env.GITHUB_EVENT_NAME==='workflow_dispatch','MANUAL_ONLY');
gate(process.env.GITHUB_REF==='refs/heads/main','MAIN_ONLY');
const secret=(process.env.CLASPRC_JSON||'').trim();
gate(secret.length>50,'OWNER_SECRET_MISSING');
try{JSON.parse(secret)}catch(_){throw Error('T015_DISPOSABLE_FLOW_AUDIT_OAUTH_JSON_INVALID')}
const auth=path.join(os.homedir(),'.clasprc.json');
gate(!fs.existsSync(auth),'AUTH_ALREADY_EXISTS');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t015-flow-audit-'));
const target=path.join(dir,'script');
const env={...process.env};delete env.CLASPRC_JSON;
try{
 fs.writeFileSync(auth,secret,{flag:'wx',mode:0o600});
 fs.mkdirSync(target);
 fs.writeFileSync(path.join(target,'.clasp.json'),JSON.stringify({scriptId:SCRIPT}),{mode:0o600});
 const p=spawnSync('clasp',['pull'],{cwd:target,env,encoding:'utf8',
  stdio:['ignore','pipe','pipe'],timeout:180000});
 gate(p.status===0,'CLASP_PULL_FAILED');
 const files=fs.readdirSync(target).filter(x=>/\.(?:js|html|json)$/.test(x)&&x!=='.clasp.json').sort();
 gate(files.length===12,'UNEXPECTED_FILESET');
 const all=files.map(x=>fs.readFileSync(path.join(target,x),'utf8')).join('\n');
 gate(all.includes(BOOK)&&!all.includes(OLD_BOOK),'WRONG_WORKBOOK');
 gate(!all.includes(OLD_SCRIPT),'OLD_SCRIPT_REFERENCED');
 gate(all.includes('T015_DISPOSABLE_ONE_SHOT_DISABLED'),'LAB_GUARD_MISSING');
 const nameHash=crypto.createHash('sha256').update(files.join('|')).digest('hex').slice(0,12);
 const source=Object.fromEntries(files.filter(x=>x.endsWith('.js')).map(x=>[x,fs.readFileSync(path.join(target,x),'utf8')]));
 const scan=inspectSource(source);
 const callGraph=inspectWriterReachability(source);
 // Only fixed filenames and counts are printed: never source or property contents.
 const safe={
  decision:scan.decision,moduleCount:scan.modules.length,totalFunctions:scan.totalFunctions,
  mutatorFunctions:scan.writerFunctions,
  directFunctionWriteOrderCandidate:scan.sameFunctionTransactionSequence,
  writersRequiringManualCallGraphReview:scan.ambiguousWriterFunctions,
  lockServiceReferences:scan.lockReferences,propertiesServiceReferences:scan.scriptPropertyReferences,
  markerCoverage:scan.missingRequired.length===0,scriptPropertiesVerified:false,
  runtimeRecoveryVerified:false,
  perFile:scan.modules.map(m=>({file:m.file,functions:m.functions,mutators:m.mutators,
    locks:m.lockReferences,manualReview:m.manualSequenceReview}))
 };
 console.log('T015_STATIC_DISPOSABLE_TRANSACTION_TRACE '+JSON.stringify(safe));
 console.log('T015_STATIC_CALLER_COVERAGE '+JSON.stringify(callGraph));
 console.log('SOURCE_FILESET_HASH_PREFIX '+nameHash);
 console.log('NOTE: semantic marker order is heuristic; interfunction journal paths need source review');
 gate(scan.decision==='STATIC_TOPOLOGY_ONLY','REQUIRED_MARKERS_MISSING');
 console.log('T015_DISPOSABLE_CONTROL_FLOW_SOURCE_READ_PASS_NO_WRITES');
}finally{
 try{fs.rmSync(auth,{force:true})}catch(_){}
 try{fs.rmSync(dir,{recursive:true,force:true})}catch(_){}
}
