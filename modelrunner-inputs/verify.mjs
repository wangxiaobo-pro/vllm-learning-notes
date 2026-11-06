import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(new URL('./lesson.js',import.meta.url),'utf8'),context);
const lesson = context.window.LESSON;
const build = scenario => JSON.parse(JSON.stringify(lesson.build(Object.freeze({scenario}))));
const table = (data,title) => data.tables.find(t=>t.title===title);
const normal=build('normal'),change=build('change');
// Independently enumerated request spans, not a copy of the packing implementation.
assert.deepEqual(table(normal,'逐 token 打包与物理槽').rows,[
  [0,'A/0',13,2,0,2,2,10], [1,'A/0',14,3,0,2,3,11],
  [2,'B/1',25,4,1,7,0,28], [3,'C/2',31,0,0,9,0,36],
  [4,'C/2',32,1,0,9,1,37], [5,'C/2',33,2,0,9,2,38]
]);
assert.deepEqual(table(change,'逐 token 打包与物理槽').rows,[
  [0,'A/0',15,4,1,6,0,24],[1,'C/1',34,3,0,9,3,39]
]);
for (const [data,offsets,logits,computed,lengths] of [
  [normal,[0,2,3,6],[1,2,5],[2,4,0],[5,6,4]],
  [change,[0,1,2],[0,1],[4,3],[6,5]]
]) {
  const meta=Object.fromEntries(table(data,'批次元数据').rows.map(r=>[r[0],r[1]]));
  assert.deepEqual(JSON.parse(meta.query_start_loc),offsets);
  assert.deepEqual(JSON.parse(meta.logits_indices),logits);
  assert.equal(offsets.at(-1),table(data,'逐 token 打包与物理槽').rows.length);
  const output=table(data,'采样后的持久状态').rows;
  assert.deepEqual(output.map(r=>r[3]),computed,'sample writeback must not advance computed');
  assert.deepEqual(output.map(r=>r[2]),lengths);
  const rows=table(data,'逐 token 打包与物理槽').rows;
  assert.equal(new Set(rows.map(r=>r[7])).size,rows.length,'request slots must not alias in this example');
  for(const r of rows){assert.equal(r[7]%4,r[6]);assert.equal(Math.floor(r[7]/4),r[5]);}
}
const old=change.steps[0].tables.find(t=>t.title==='初始持久批次').rows;
assert.deepEqual(old.map(r=>r[3]),[2,4,0],'before update, CPU counters are previous-iteration values');
assert.equal(old[0][4],'[2]','new block6 must not appear before Scheduler increment is applied');
const condensed=change.steps[2].tables[0].rows;
assert.deepEqual(condensed.map(r=>r.slice(0,2)),[[0,'A'],[1,'C']]);
assert.equal(condensed[0][4],'[2, 6]');
assert.equal(condensed[1][4],'[9]');
for(const s of ['normal','change']) {
  const data=build(s);assert.equal(data.steps.length,9);assert.deepEqual(data,build(s));
  const nodeIds=new Set(data.nodes.map(n=>n.id)),edgeIds=new Set(data.edges.map(e=>e.id));
  assert.equal(nodeIds.size,data.nodes.length);assert.equal(edgeIds.size,data.edges.length);
  for(const edge of data.edges){assert(nodeIds.has(edge.from)&&nodeIds.has(edge.to));assert(edge.steps.every(i=>i>=1&&i<=data.steps.length));}
  data.steps.forEach((st,i)=>{for(const id of st.activeNodes)assert(nodeIds.has(id));for(const id of st.activeEdges){assert(edgeIds.has(id));assert(data.edges.find(e=>e.id===id).steps.includes(i+1));}});
  for(const t of [...data.tables,...data.steps.flatMap(s=>s.tables||[])])for(const row of t.rows){assert.equal(row.length,t.headers.length);for(const cell of row)assert(typeof cell==='string'||Number.isFinite(cell));}
}
const chain=JSON.parse(fs.readFileSync(new URL('./call-chain.json',import.meta.url),'utf8'));
let targets=0,depth=0;
for(const variant of chain.variants){
  const ids=new Map(variant.nodes.map(n=>[n.id,n]));
  for(const n of variant.nodes){
    let current=n,d=1,seen=new Set([n.id]);
    while(current.parent){assert(ids.has(current.parent));current=ids.get(current.parent);assert(!seen.has(current.id));seen.add(current.id);d++;}
    depth=Math.max(depth,d);
    for(const t of n.targets){const data=build(t.action.params.scenario);assert(t.action.step>=1&&t.action.step<=data.steps.length);targets++;}
    for(const e of n.evidence){assert.equal(variant.repositories[e.repo].commit,'295c062db8a48ea73bbd05d1174cb37d24bf86f9');assert(e.line>0&&(e.end===undefined||e.end>=e.line));}
  }
}
assert(depth>=6);
console.log(`PASS modelrunner-inputs: 2 scenarios, packing/offset/slot/writeback invariants, depth ${depth}, ${targets} targets`);
