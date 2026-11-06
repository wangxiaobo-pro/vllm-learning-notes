// Verify source locations against the pinned Git objects, never working-tree line numbers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const repoIndex = args.indexOf('--repo');
const writeLock = args.includes('--write-lock');
if (repoIndex < 0 || !args[repoIndex + 1] || args.includes('--help')) {
  console.log('Usage: node scheduler/verify-source.mjs --repo <vllm-checkout> [--write-lock]');
  console.log('--write-lock: only after reviewing every source location against the selected commit.');
  process.exit(args.includes('--help') ? 0 : 1);
}
const repositoryPath = resolve(args[repoIndex + 1]);
const git = (...parameters) => execFileSync('git', ['-C', repositoryPath, ...parameters], {
  encoding:'utf8', maxBuffer:16 * 1024 * 1024, stdio:['ignore','pipe','pipe'],
});
const html = readFileSync(resolve(directory,'index.html'),'utf8').replaceAll('\r\n','\n');
const readme = readFileSync(resolve(directory,'README.md'),'utf8').replaceAll('\r\n','\n');
function jsonConstant(name) {
  const match = html.match(new RegExp('const ' + name + ' = ([\\s\\S]*?\\n[}\\]]);'));
  assert(match, `Missing JSON constant: ${name}`);
  return JSON.parse(match[1]);
}

const snapshot = jsonConstant('sourceSnapshot');
const nodes = jsonConstant('chainNodes');
const scenarios = jsonConstant('scenarios');
assert(/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(snapshot.repository), 'Invalid repository URL');
assert(/^[a-f0-9]{40}$/.test(snapshot.commit), 'Source commit must be a full immutable SHA');
assert.equal(git('rev-parse', snapshot.commit + '^{commit}').trim(), snapshot.commit);
const references = new Map();
const bindings = {};
function addReference(path, line, end = line, origin) {
  assert(!path.startsWith('/') && !path.split('/').includes('..'), `Invalid source path: ${path}`);
  assert(Number.isInteger(line) && Number.isInteger(end) && line > 0 && end >= line, `Invalid range: ${path}:${line}-${end}`);
  const key = `${path}#L${line}-L${end}`;
  references.set(key, {path,line,end});
  assert(origin && !Object.hasOwn(bindings,origin), `Missing or duplicate reference identity: ${origin}`);
  bindings[origin] = key;
}
let evidenceCount = 0;
for (const node of nodes) {
  for (const [index,source] of node.evidence.entries()) {
    addReference(source.path, source.line, source.end, `node:${node.id}:${index}`);
    evidenceCount++;
  }
}
let stepCount = 0;
for (const [name,scenario] of Object.entries(scenarios)) {
  for (const [stepIndex,step] of scenario.steps.entries()) {
    for (const [refIndex,range] of step.ref.split(/,\s*/).entries()) {
      const match = range.match(/^(\d+)(?:–(\d+))?$/);
      assert(match, `Malformed step reference: ${range}`);
      addReference('vllm/v1/core/sched/scheduler.py', Number(match[1]), Number(match[2] || match[1]), `step:${name}:${stepIndex + 1}:${refIndex}`);
    }
    stepCount++;
  }
}
// Include literal links in the page and README, checking the identity before the range.
for (const [filename,text] of [['index.html',html],['README.md',readme]]) {
  let index = 0;
  const urls = text.match(/https:\/\/github\.com\/[^\s"'<>`)]+/g) || [];
  for (const url of urls) {
    const match = url.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/(?:blob|tree|commit)\/([^/#]+)(?:\/([^#]+))?(?:#L(\d+)(?:-L(\d+))?)?$/);
    if (!/\/github\.com\/[^/]+\/[^/]+\/(?:blob|tree|commit)\//.test(url)) continue;
    assert(match, `Malformed source link: ${url}`);
    assert.equal(match[1], snapshot.repository, `Repository mismatch: ${url}`);
    assert.equal(match[2], snapshot.commit, `Commit mismatch: ${url}`);
    if (match[4]) addReference(match[3],Number(match[4]),Number(match[5] || match[4]), `${filename}:link:${index++}`);
  }
  for (const label of text.matchAll(/vLLM\s+`?([a-f0-9]{10,40})/g)) {
    assert(snapshot.commit.startsWith(label[1]), `Displayed commit mismatch: ${label[1]}`);
  }
}
// Generated links with a fixed range (currently the EngineCore reference).
let fixedLinkIndex = 0;
for (const match of html.matchAll(/sourceLink\('([^']+)',\s*(\d+)(?:,\s*(\d+))?\)/g)) {
  addReference(match[1],Number(match[2]),Number(match[3] || match[2]), `generated-link:${fixedLinkIndex++}`);
}

const files = {};
const contents = new Map();
for (const path of [...new Set([...references.values()].map(source => source.path))].sort()) {
  files[path] = git('rev-parse', snapshot.commit + ':' + path).trim();
  contents.set(path, git('show', snapshot.commit + ':' + path).replaceAll('\r\n','\n').split('\n'));
}
const ranges = {};
for (const key of [...references.keys()].sort()) {
  const {path,line,end} = references.get(key);
  const lines = contents.get(path);
  assert(end <= lines.length, `Out-of-bounds source range: ${key}`);
  const excerpt = lines.slice(line - 1,end).join('\n');
  assert(excerpt.trim(), `Empty source range: ${key}`);
  ranges[key] = createHash('sha256').update(excerpt,'utf8').digest('hex');
}
const actual = {schemaVersion:1, ...snapshot, files, bindings, ranges};
const lockPath = resolve(directory,'source-lock.json');
if (writeLock) {
  writeFileSync(lockPath, JSON.stringify(actual,null,2) + '\n','utf8');
  console.log('Wrote fingerprints for reviewed source ranges. Run again without --write-lock to verify.');
} else {
  const locked = JSON.parse(readFileSync(lockPath,'utf8'));
  assert.deepEqual(actual, locked, 'Source identity, locations, or content changed; review the pinned commit before refreshing source-lock.json');
  console.log(`Verified ${nodes.length} nodes / ${evidenceCount} evidence entries / ${stepCount} steps / ${Object.keys(ranges).length} unique ranges in ${contents.size} files.`);
}
console.log(`Source: ${snapshot.repository}@${snapshot.commit}`);
const head = git('rev-parse','HEAD').trim();
console.log(head === snapshot.commit ? 'Local HEAD matches the source commit.' : `Local HEAD is ${head}; verified the pinned Git objects, not this checkout's line numbers.`);
const dirty = git('status','--porcelain','--',...contents.keys()).trim();
if (dirty) console.log('Referenced working-tree files have local changes; only committed source objects were verified.');
