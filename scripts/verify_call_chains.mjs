// Validate the authored trees and bind every evidence entry to immutable Git objects.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args = process.argv.slice(2), repositories = new Map();
let onlyTopic = null;
for (let i=0;i<args.length;i++) {
  if (args[i] === '--repo') {
    const value = args[++i], separator = value?.indexOf('=');
    assert(separator > 0,'Use --repo key=/path/to/checkout');
    repositories.set(value.slice(0,separator),path.resolve(value.slice(separator+1)));
  } else if (args[i] === '--topic') onlyTopic = args[++i];
}
if (args.includes('--help') || !repositories.size) {
  console.log('node scripts/verify_call_chains.mjs --repo vllm=../vllm --repo ascend=../vllm-ascend --repo sglang=../sglang --repo torch_npu=../torch_npu [--topic name] [--write-lock]');
  console.log('Refresh locks only after reviewing calls and line numbers against the selected commits.');
  process.exit(args.includes('--help') ? 0 : 1);
}
const writeLock = args.includes('--write-lock');
const git = (directory,...parameters) => execFileSync('git',['-C',directory,...parameters],{encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
const normalizeUrl = url => url.replace(/\.git$/,'').replace(/\/$/,'');
const remotes = new Map();
for (const directory of repositories.values()) {
  try { remotes.set(normalizeUrl(git(directory,'remote','get-url','origin').trim()),directory); } catch {}
}
const snapshots = new Map();
let topicCount=0,variantCount=0,nodeCount=0,evidenceCount=0,targetCount=0;
for (const topic of fs.readdirSync(root).sort()) {
  if (onlyTopic && topic !== onlyTopic) continue;
  const directory = path.join(root,topic), dataPath = path.join(directory,'call-chain.json');
  if (!fs.existsSync(dataPath)) continue;
  const data = JSON.parse(fs.readFileSync(dataPath,'utf8').replace(/^\uFEFF/,''));
  assert(data.title && Array.isArray(data.variants) && data.variants.length,topic + ': missing variants');
  assert(fs.existsSync(path.join(directory,'call-chain-adapter.js')),topic + ': missing adapter');
  assert.equal(new Set(data.variants.map(v=>v.id)).size,data.variants.length,topic + ': duplicate variants');
  assert(data.variants.some(v=>v.id===data.defaultVariant),topic + ': invalid default variant');
  const lock = {schemaVersion:1,repositories:{},files:{},bindings:{},ranges:{}};
  for (const variant of data.variants) {
    variantCount++;
    assert(variant.scope && variant.title,topic + '/' + variant.id + ': missing scope');
    assert(variant.nodes.length,topic + '/' + variant.id + ': empty tree');
    const nodeMap = new Map(variant.nodes.map(node=>[node.id,node]));
    assert.equal(nodeMap.size,variant.nodes.length,'Duplicate node IDs: ' + topic + '/' + variant.id);
    assert.equal(new Set(variant.nodes.map(node=>node.number)).size,variant.nodes.length,'Duplicate tree numbers: ' + topic + '/' + variant.id);
    if (variant.entry) assert(nodeMap.has(variant.entry),'Unknown entry');
    const repoMap = new Map();
    const teaching = variant.provenance === 'teaching';
    assert(teaching || Object.keys(variant.repositories).length,'Missing source repositories');
    if (teaching) assert.equal(Object.keys(variant.repositories).length,0,'Teaching-only variants must not claim code evidence');
    for (const [key,repo] of Object.entries(variant.repositories)) {
      assert(/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(repo.url),'Invalid repository URL: ' + repo.url);
      assert(/^[a-f0-9]{40}$/.test(repo.commit),'Expected a full immutable SHA: ' + repo.commit);
      const sourceDirectory = repositories.get(key) || remotes.get(normalizeUrl(repo.url));
      assert(sourceDirectory,'Missing --repo for ' + key + ': ' + repo.url);
      const identity = repo.url + '@' + repo.commit;
      if (!snapshots.has(identity)) {
        assert.equal(git(sourceDirectory,'rev-parse',repo.commit+'^{commit}').trim(),repo.commit);
        snapshots.set(identity,{directory:sourceDirectory,commit:repo.commit,files:new Map()});
      }
      repoMap.set(key,{identity,...snapshots.get(identity)});
      lock.repositories[variant.id+':'+key] = {url:repo.url,commit:repo.commit};
    }
    for (const node of variant.nodes) {
      nodeCount++;
      for (const field of ['id','number','kind','title','summary','input','changes','output','resume']) assert(typeof node[field]==='string' && node[field].trim(),`${topic}/${variant.id}/${node.id}: missing ${field}`);
      assert(node.parent === null || nodeMap.has(node.parent),'Unknown parent of ' + node.id);
      const seen = new Set([node.id]);
      for (let parent=node.parent;parent!==null;parent=nodeMap.get(parent).parent) {
        assert(!seen.has(parent),'Call tree cycle: ' + node.id); seen.add(parent);
      }
      assert(Array.isArray(node.targets) && node.targets.length,'Missing visualization target: ' + node.id);
      for (const target of node.targets) {
        targetCount++;
        assert(target.label && target.action && typeof target.action==='object','Invalid target: ' + node.id);
        if (target.action.page) assert(['index.html','comparison.html'].includes(target.action.page),'Unexpected target page');
        if (target.action.step !== undefined) assert(Number.isInteger(target.action.step) && target.action.step >= 0,'Invalid target step');
      }
      assert(Array.isArray(node.evidence) && (teaching ? node.evidence.length===0 : node.evidence.length>0),'Missing or inappropriate source evidence: ' + node.id);
      for (const [index,evidence] of node.evidence.entries()) {
        evidenceCount++;
        const repo = repoMap.get(evidence.repo), end = evidence.end ?? evidence.line;
        assert(repo,'Unknown evidence repository: ' + evidence.repo);
        assert(evidence.label && typeof evidence.path==='string' && !evidence.path.startsWith('/') && !evidence.path.includes('..'),'Invalid source path');
        assert(Number.isInteger(evidence.line) && Number.isInteger(end) && evidence.line>0 && end>=evidence.line,'Invalid evidence range');
        if (!repo.files.has(evidence.path)) {
          repo.files.set(evidence.path,{
            blob:git(repo.directory,'rev-parse',repo.commit+':'+evidence.path).trim(),
            lines:git(repo.directory,'show',repo.commit+':'+evidence.path).replaceAll('\r\n','\n').split('\n'),
          });
        }
        const file = repo.files.get(evidence.path);
        assert(end<=file.lines.length,'Out-of-bounds reference: ' + evidence.path);
        const excerpt = file.lines.slice(evidence.line-1,end).join('\n');
        assert(excerpt.trim(),'Empty source excerpt');
        const range = repo.identity + '/' + evidence.path + '#L' + evidence.line + '-L' + end;
        lock.files[repo.identity+'/'+evidence.path] = file.blob;
        lock.bindings[variant.id+':'+node.id+':'+index] = range;
        lock.ranges[range] = createHash('sha256').update(excerpt,'utf8').digest('hex');
      }
    }
  }
  const lockPath = path.join(directory,'call-chain.lock.json');
  if (writeLock) fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');
  else assert.deepEqual(lock,JSON.parse(fs.readFileSync(lockPath,'utf8')),topic + ': source identity or evidence binding changed; review before refreshing the lock');
  const expected = {...data,topic};
  for (const filename of ['index.html','comparison.html']) {
    const pagePath = path.join(directory,filename);
    if (!fs.existsSync(pagePath)) continue;
    const page = fs.readFileSync(pagePath,'utf8');
    const inline = page.match(/<script type="application\/json" id="lesson-call-chain-data">([\s\S]*?)<\/script>/);
    if (!writeLock) {
      assert(inline,'Missing built call chain in ' + topic + '/' + filename);
      assert.deepEqual(JSON.parse(inline[1]),expected,'Stale inline data: ' + topic + '/' + filename);
    }
  }
  topicCount++;
}
assert(topicCount,'No matching call-chain data');
console.log(`${writeLock?'Locked reviewed sources for':'Verified'} ${topicCount} topics / ${variantCount} variants / ${nodeCount} nodes / ${evidenceCount} evidence entries / ${targetCount} visualization targets / ${snapshots.size} source snapshots.`);
