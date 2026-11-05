// Run with: node model-architecture/validate.mjs
// Validate navigation and data dependencies without a browser or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const context=vm.createContext({window:{ARCH_MODELS:{}}});
for(const [,file] of html.matchAll(/<script src="(data\/[^\"]+\.js)"/g)){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const models=context.window.ARCH_MODELS;
assert.deepEqual(Object.keys(models).sort(),['deepseek_v41','deepseek_v4_pro','glm53','kimi_k3','minimax'].sort());
const kinds=new Set(['tokens','streams','stack','gather','scatter','vision','hash','cache','router','experts','shared','sum','attention','selection','logits','sample','draft','state','verify']);
let count=0,nodeCount=0,edgeCount=0;
for(const [id,model] of Object.entries(models)){
  assert.equal(model.id,id);
  assert(model.components[model.root],`${id}: missing root`);
  const sources=new Set(model.sources.map(s=>s.id));
  assert.equal(sources.size,model.sources.length,`${id}: duplicate source`);
  for(const [key,c] of Object.entries(model.components)){
    const tag=`${id}/${key}`;
    for(const name of ['title','inputs','outputs'])assert(c[name]?.trim(),`${tag}: missing ${name}`);
    assert(c.intro.length&&c.sources.length&&c.steps.length,`${tag}: missing explanation, evidence or steps`);
    const nodes=new Set(c.nodes.map(n=>n.id));
    assert.equal(nodes.size,c.nodes.length,`${tag}: duplicate node`);
    assert(!c.parent||model.components[c.parent],`${tag}: missing parent`);
    c.sources.forEach(s=>assert(sources.has(s),`${tag}: unknown source ${s}`));
    for(const n of c.nodes){
      assert(n.label?.trim()&&n.description?.trim(),`${tag}/${n.id}: missing node explanation`);
      assert(kinds.has(n.kind),`${tag}/${n.id}: unknown illustration ${n.kind}`);
      assert(Number.isInteger(n.row)&&n.row>=0&&Number.isInteger(n.col)&&n.col>=0&&n.col<=2,`${tag}/${n.id}: invalid position`);
      assert(!n.target||model.components[n.target],`${tag}/${n.id}: broken drilldown ${n.target}`);
      if(key===model.root)assert(n.target,`${tag}/${n.id}: overview cannot drill down`);
    }
    for(const e of c.edges){
      assert(nodes.has(e.from)&&nodes.has(e.to),`${tag}: broken dependency ${e.from} → ${e.to}`);
      assert(e.label?.trim(),`${tag}: unnamed dependency`);
      assert(Number.isInteger(e.step)&&e.step>=1&&e.step<=c.steps.length,`${tag}: invalid edge step`);
    }
    for(const s of c.steps){
      assert(s.title?.trim()&&s.text?.trim()&&s.focus.length,`${tag}: incomplete playback step`);
      s.focus.forEach(n=>assert(nodes.has(n),`${tag}: unknown focused node ${n}`));
    }
    const ancestors=new Set([key]);let parent=c.parent;
    while(parent){assert(!ancestors.has(parent),`${tag}: breadcrumb cycle`);ancestors.add(parent);parent=model.components[parent].parent;}
    count++;nodeCount+=c.nodes.length;edgeCount+=c.edges.length;
  }
  console.log(`${model.name}: ${Object.keys(model.components).length} components`);
}
console.log(`PASS: ${Object.keys(models).length} models, ${count} components, ${nodeCount} nodes, ${edgeCount} dependencies.`);
