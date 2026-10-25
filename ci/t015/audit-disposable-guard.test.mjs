import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const file=path.join(import.meta.dirname,'audit-disposable-source.mjs');
const text=fs.readFileSync(file,'utf8');
const has=s=>text.includes(s);
test('targets known new standalone Script not original Owner QA',()=>{
 assert.ok(has('1Ywd72VfivnefEJMAZQ42ojw0QlfjyM1CUsbqlOJQnMkebamiZPAwvMM5'));
 assert.ok(has('1N6gLsSpcfsumKUfnY-VIpy2p1KtfrGI6PE1MZ8HXYIZecDjYcwP72QnF'));
});
test('targets isolated fault workbook and checks old workbook absent',()=>{
 assert.ok(has('1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI'));
 assert.ok(has('1tot2RNXprYLkoOVXDi5j3yyavHyxI_ayR78KdP1Wzuo'));
 assert.ok(has('SOURCE_POINTS_TO_WRONG_WORKBOOK'));
});
test('only clasp pull, no write subcommands in child argv',()=>{
 assert.match(text,/const argv=version\?\['pull','--versionNumber',version\]:\['pull'\]/);
 assert.doesNotMatch(text,/spawnSync\('clasp',\['(?:push|deploy|create|delete|undeploy)/);
});
test('source provenance derives from immutable @4 and checks HEAD',()=>{
 assert.ok(has("claspPull(immutable,oldScript,'4')"));
 assert.ok(has('matches(immutable,oldHead)'));
 assert.ok(has('matches(expected,actual)'));
});
test('one-shot, owner and lock checks remain mandatory',()=>{
 assert.ok(has('T015_DISPOSABLE_ONE_SHOT_DISABLED'));
 assert.ok(has('T015_WRITES_ENABLED'));
 assert.ok(has('T015_WRITE_LEASE_UNTIL'));
 assert.ok(has('T015_OWNER_EMAIL'));
});
test('OAuth never emitted to logger',()=>{
 assert.doesNotMatch(text,/console\.log\(\s*(credentials|authFile|process\.env\.CLASPRC_JSON)/);
 assert.ok(has('delete childEnv.CLASPRC_JSON'));
});
test('job refuses nonmanual triggers or nonmain branches',()=>{
 assert.ok(has("GITHUB_EVENT_NAME==='workflow_dispatch'"));
 assert.ok(has("GITHUB_REF==='refs/heads/main'"));
});
test('auditor explicitly denies runtime recovery claim',()=>{
 assert.ok(has('Script Properties not inspected'));
 assert.ok(has('runtime owner/auth/locks untested'));
});
