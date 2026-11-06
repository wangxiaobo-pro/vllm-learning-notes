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

for(const scenario of ['prefer-a','prefer-b']){
 const d=build(scenario),a=d.audit;
 for(const round of a.rounds){
  const bits=[];for(let i=0;i<a.vocab.length;i++)if((round.word>>>i)&1)bits.push(i);
  assert.deepEqual(bits,a.allowedByState[round.q]);
  const legal=a.allowedByState[round.q],expected=legal.reduce((best,i)=>a.logits[i]>a.logits[best]?i:best,legal[0]);
  assert.equal(round.pick,expected);assert(legal.includes(round.pick));assert.equal(round.probs[3],0);
  assert(Math.abs(round.probs.reduce((s,p)=>s+p,0)-1)<1e-12);
  for(let i=0;i<a.vocab.length;i++){assert.equal(round.masked[i],legal.includes(i)?a.logits[i]:null);if(!legal.includes(i))assert.equal(round.probs[i],0);}
 }
 assert.equal(a.rounds[1].word,6);assert.equal(a.logits[3],Math.max(...a.logits));
 assert.equal(a.rounds[1].pick,scenario==='prefer-a'?1:2);
 assert.equal(a.snapshots[3].gpuPick,null);assert.equal(a.snapshots[5].q,1);assert.equal(a.snapshots[5].accepted.length,1);assert.equal(a.snapshots[6].q,2);
 const last=a.snapshots[8];assert.equal(last.q,4);assert.equal(last.accepted.at(-1),5);assert.equal(JSON.parse(last.text),scenario==='prefer-a'?'A':'B');assert(!last.text.includes('eos'));
 let q=0;for(const id of last.accepted){assert(a.allowedByState[q].includes(id));q++;}assert.equal(q,4);
 assert.equal(d.steps[0].tables[0].rows[0][1],'等待前向');
}
console.log('PASS structured-output: masks, legal greedy, normalized probabilities, GPU/CPU state boundary, JSON termination');

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
