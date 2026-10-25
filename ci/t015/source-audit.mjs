import fs from 'node:fs';
import path from 'node:path';

export function auditSource(dir) {
  const names = fs.readdirSync(dir).filter(f => /\.(js|html|json)$/.test(f) && f !== '.clasp.json').sort();
  const get = name => fs.readFileSync(path.join(dir, name), 'utf8');
  const scripts = names.filter(f => f.endsWith('.js')).map(get).join('\n');
  const core = names.includes('T015_Core.js') ? get('T015_Core.js') : '';
  const lab = names.includes('T015_Lab.js') ? get('T015_Lab.js') : '';
  const projection = names.includes('T015_Projection.js') ? get('T015_Projection.js') : '';
  const triage = names.includes('T015_OrderTriage.js') ? get('T015_OrderTriage.js') : '';
  const html = names.includes('T015_ReadOnly.html') ? get('T015_ReadOnly.html') : '';
  const manifest = names.includes('appsscript.json') ? JSON.parse(get('appsscript.json')) : {};
  const checks = {
    expectedFileCount: names.length === 12,
    ownerOnlyManifest: manifest.webapp?.access === 'MYSELF' && manifest.webapp?.executeAs === 'USER_DEPLOYING',
    ownerGate: core.includes('T015_OWNER_EMAIL') && core.includes('t12Owner_'),
    writeGate: core.includes('T015_WRITES_ENABLED'),
    lease: core.includes('T015_WRITE_LEASE_UNTIL'),
    lockService: scripts.includes('LockService'),
    journal: scripts.includes('V7_IDEMPOTENCY'),
    auditLedger: scripts.includes('V7_AUDIT_EVENTS'),
    preparedMarker: scripts.includes('PREPARED'),
    committedMarker: scripts.includes('COMMITTED'),
    unresolvedMarker: scripts.includes('NEEDS_RECONCILIATION'),
    recoveryEntrypoint: /\bfunction\s+v7T015Recover\w*\s*\(/.test(scripts),
    oneShotState: lab.includes('T015_LAB_STATE'),
    stockProjection: projection.includes('function v7T015StockOrderProjection()'),
    orderProjection: triage.includes('function v7T015OrderTriageQA()'),
    noProjectionWriteCalls: !/\b(?:setValues|setValue|appendRow|deleteRow|setProperty)\s*\(/.test(projection + triage),
    noLabRestartButton: !html.includes('v7T015LabRunOnce()')
  };
  const failures = Object.entries(checks).filter(([,ok]) => !ok).map(([key]) => key);
  return {kind:'STATIC_SOURCE_INVENTORY_ONLY',checks,failures,files:names.length,
    liveRuntimeFaultVerified:false,readyForStockWrites:false};
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const dir = process.argv[2];
  if (!dir) throw Error('T015_SOURCE_DIR_REQUIRED');
  const result = auditSource(dir);
  for (const [name,ok] of Object.entries(result.checks))
    console.log((ok?'PASS ':'FAIL ') + name);
  console.log('Static inventory only: no runtime recovery approval.');
  if (result.failures.length) process.exitCode = 1;
}
