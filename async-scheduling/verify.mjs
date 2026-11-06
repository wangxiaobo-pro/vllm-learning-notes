import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window = {};
vm.runInNewContext(fs.readFileSync(new URL('./lesson.js',import.meta.url),'utf8'), {window});
const lesson=window.LESSON, clone=x=>JSON.parse(JSON.stringify(x));
function build(scenario) {
 const params={scenario},before=JSON.stringify(params),data=clone(lesson.build(params));
 assert.equal(JSON.stringify(params),before,'build must not mutate params');
 assert.deepEqual(data,clone(lesson.build(params)),'deterministic build');
 assert.equal(data.steps.length,9);
 const nodes=new Set(data.nodes.map(n=>n.id)),edges=new Set(data.edges.map(e=>e.id));
 assert.equal(nodes.size,data.nodes.length);assert.equal(edges.size,data.edges.length);
 for(const e of data.edges){assert(nodes.has(e.from)&&nodes.has(e.to));for(const s of e.steps)assert(s>=1&&s<=9);}
 for(const step of data.steps){for(const id of step.activeNodes)assert(nodes.has(id));for(const id of step.activeEdges)assert(edges.has(id));for(const table of step.tables||[])for(const row of table.rows){assert.equal(row.length,table.headers.length);for(const v of row)assert(typeof v==='string'||typeof v==='number'&&Number.isFinite(v));}}
 return data;
}

for(const scenario of ['async','sync']) {
 const d=build(scenario),a=d.audit,sum=rs=>rs.reduce((n,r)=>n+a.counts[r-1],0);
 for(const t of a.trace){
  assert.equal(t.computed,sum(t.planned));
  assert.equal(t.inflight,sum(t.planned.filter(r=>!t.acked.includes(r))));
  assert.equal(t.placeholders,scenario==='async'?t.planned.length-t.acked.length:0);
  assert.deepEqual(t.knownIds,a.prompt.concat(t.acked.map(r=>a.results[r-1])),'CPU only knows accepted outputs');
  assert.deepEqual(t.gpuTokens,t.deviceDone.map(r=>a.results[r-1]));
  assert.equal(t.kvTokens,sum(t.deviceDone));assert(t.inflight>=0&&t.placeholders>=0);
  assert(t.queue.length<=(scenario==='async'?2:1));
  for(const round of t.acked)assert(t.deviceDone.includes(round),'host cannot consume unproduced token');
 }
 const before=a.trace[3];assert.equal(before.knownIds.length,3);assert.equal(before.gpuTokens.length,0);
 if(scenario==='async') {assert.deepEqual(before.planned,[1,2]);assert.deepEqual(before.workerCpuOutput,[-1,-1]);assert.equal(before.placeholders,2);assert.equal(before.computed,4);}
 else {assert.deepEqual(before.planned,[1]);assert.equal(a.trace[5].knownIds[3],11);}
 const end=a.trace[8];assert(end.released);assert.equal(end.inflight,0);assert.equal(end.placeholders,0);assert.equal(end.kvTokens,4);assert.equal(end.knownIds.length,5);assert.deepEqual(end.knownIds.slice(3),[11,22]);
 if(scenario==='async'){const t=a.trace[5];assert(t.computed+2-t.placeholders>=a.prompt.length+2,'max_tokens guard suppresses an unnecessary third round');}
}
console.log('PASS async-scheduling: both scenarios, 18 states, conservation, unknown-output ordering, max-token guard');

const chain=JSON.parse(fs.readFileSync(new URL('./call-chain.json',import.meta.url),'utf8'));
let nodeCount=0,targetCount=0;
for(const variant of chain.variants){
 assert.equal(variant.repositories.vllm.commit,'295c062db8a48ea73bbd05d1174cb37d24bf86f9');
 const ids=new Map(variant.nodes.map(n=>[n.id,n]));assert.equal(ids.size,variant.nodes.length);
 for(const n of variant.nodes){
  nodeCount++;assert(n.parent===null||ids.has(n.parent));const seen=new Set([n.id]);let parent=n.parent;
  while(parent!==null){assert(!seen.has(parent),'parent cycle');seen.add(parent);parent=ids.get(parent).parent;}
  for(const key of ['title','summary','input','changes','output','resume'])assert(typeof n[key]==='string'&&n[key].length>0);
  assert(n.evidence.length>0);for(const ev of n.evidence){assert.equal(ev.repo,'vllm');assert(ev.path.startsWith('vllm/'));assert(Number.isInteger(ev.line)&&ev.line>0);if(ev.end)assert(ev.end>=ev.line);}
  for(const target of n.targets){targetCount++;assert(target.action.params.scenario);const data=build(target.action.params.scenario);assert(target.action.step>=1&&target.action.step<=data.steps.length);}
 }
}
console.log(`PASS call-chain: ${chain.variants.length} variants, ${nodeCount} nodes, ${targetCount} scenario/step targets`);
