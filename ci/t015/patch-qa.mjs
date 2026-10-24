import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const SCRIPT='1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF';
const BOOK='1tot2RNXprYLkoOVXDi5j3yyavHyxI_ayR78KdP1Wzuo';
const BASE=['T015_Core.js','T015_Health.js','T015_Lab.js','T015_ReadOnly.html','T015_Projection.js',
 'InventoryT015.js','InventoryT015.allocations.js','InventoryT015.fulfillment.js',
 'InventoryT015.safe.js','InventoryT015.safe-extra.js','appsscript.json'].sort();
const fail=s=>{throw Error('T015_QA_GATE: '+s)};
const load=(dir,f)=>fs.readFileSync(path.join(dir,f),'utf8');
const sha=s=>crypto.createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const list=dir=>fs.readdirSync(dir).filter(f=>/\.(js|gs|html|json)$/.test(f)&&f!=='.clasp.json').sort();
const once=(text,s,name)=>{if(text.split(s).length!==2)fail(name)};
export function patch(head,v3) {
 if(JSON.parse(load(head,'.clasp.json')).scriptId!==SCRIPT ||
    JSON.parse(load(v3,'.clasp.json')).scriptId!==SCRIPT)fail('WRONG_SCRIPT_ID');
 if(JSON.stringify(list(head))!==JSON.stringify(BASE)||
    JSON.stringify(list(v3))!==JSON.stringify(BASE))fail('SOURCE_FILE_LIST_DRIFT');
 for(const f of BASE)if(sha(load(head,f))!==sha(load(v3,f)))fail('HEAD_NOT_EQUAL_IMMUTABLE_V3: '+f);
 const m=JSON.parse(load(head,'appsscript.json'));
 if(m.webapp?.access!=='MYSELF'||m.webapp?.executeAs!=='USER_DEPLOYING')fail('NOT_OWNER_ONLY_WEBAPP');
 const core=load(head,'T015_Core.js');
 for(const s of [BOOK,'T015_OWNER_EMAIL','T015_WRITES_ENABLED','T015_WRITE_LEASE_UNTIL'])
   if(!core.includes(s))fail('QA_CORE_GUARD_MISSING');
 if(!load(head,'T015_Lab.js').includes('T015_LAB_STATE'))fail('ONE_SHOT_LAB_GUARD_MISSING');
 if(!load(head,'T015_Projection.js').includes('function v7T015StockOrderProjection()'))fail('STOCK_PROJECTION_MISSING');
 const html=load(head,'T015_ReadOnly.html');
 const oldMetric="['Đơn có trạng thái suy ra khác dữ liệu lưu',c.projectedOrderMismatches]";
 const render='renderSummary();renderStocks();renderOrders();';
 once(html,oldMetric,'UI_METRIC_CHANGED');once(html,render,'UI_REFRESH_CHANGED');
 if(!html.includes('v7T015StockOrderProjection()'))fail('STOCK_UI_MISSING');
 if(/v7T015(?:LabRunOnce|IssueSafe|ReserveSafe|ReceiveSafe|ReleaseSafe)\s*\(/.test(html))fail('UNSAFE_UI_WRITE_CALL');
 const metrics='["Cần đồng bộ trạng thái",(data.triageCounts?.actionable ?? "—")],'+
  '["Chờ kiểm kê",(data.triageCounts?.openingUnconfirmed ?? "—")],'+
  '["Đơn nháp",(data.triageCounts?.draft ?? "—")],'+
  '["Cần đối soát",(data.triageCounts?.requiresManualReconciliation ?? "—")]';
 const refresh=[render,
 '  const stockSnapshot = data;',
 '  google.script.run.withSuccessHandler(triage => {',
 '    if(data !== stockSnapshot) return;',
 "    if(!triage || triage.readOnly !== true || triage.environment !== 'T015_OWNER_ONLY_STOCK_PROJECTION_QA'){",
 "      $('error').textContent = 'Không xác minh được trạng thái đơn QA'; return;",
 '    }',
 '    data.triageCounts = triage.counts;',
 '    renderSummary();',
 '  }).withFailureHandler(err => {',
 "    if(data === stockSnapshot) $('error').textContent = 'Không đọc được phân loại đơn QA: ' + (err?.message || String(err));",
 '  }).v7T015OrderTriageQA();'].join('\n');
 fs.writeFileSync(path.join(head,'T015_ReadOnly.html'),html.replace(oldMetric,metrics).replace(render,refresh));
 const src=load(ROOT,'T015_OrderTriage.js');
 if(!src.includes('t12Owner_(false)')||!src.includes('function v7T015OrderTriageQA()'))fail('TRIAGE_OWNER_AUTH_MISSING');
 if(/\b(?:setValues|setValue|appendRow|deleteRow|setProperty)\s*\(/.test(src))fail('TRIAGE_HAS_WRITE');
 fs.writeFileSync(path.join(head,'T015_OrderTriage.js'),src);
 if(JSON.stringify(list(head))!==JSON.stringify([...BASE,'T015_OrderTriage.js'].sort()))fail('PATCH_UNEXPECTED_FILES');
 const changed=BASE.filter(f=>sha(load(head,f))!==sha(load(v3,f)));
 if(JSON.stringify(changed)!==JSON.stringify(['T015_ReadOnly.html']))fail('UNEXPECTED_MUTATIONS');
 return {baselineFiles:11,outputFiles:12,updated:changed,added:['T015_OrderTriage.js'],qaOnly:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==4)fail('Usage: patch-qa.mjs HEAD_DIR V3_DIR');
 console.log(JSON.stringify(patch(process.argv[2],process.argv[3])));
}
