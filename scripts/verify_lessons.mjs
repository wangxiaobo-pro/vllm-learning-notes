// Validate authored lesson data and source-tree targets without a browser or model runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const topics=fs.readdirSync(root).filter(name=>fs.existsSync(path.join(root,name,'lesson.js')));
let builds=0,targets=0;
for(const topic of topics){
  const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,topic,'lesson.js'),'utf8'),context,{filename:topic+'/lesson.js'});
  const lesson=context.window.LESSON,controls=lesson.controls||[],defaults=Object.fromEntries(controls.map(c=>[c.id,c.value]));
  assert(lesson.title&&lesson.kind,topic+': title/kind');assert.equal(new Set(controls.map(c=>c.id)).size,controls.length);
  function validParams(params){
    for(const key of Object.keys(params))assert(controls.some(c=>c.id===key),topic+': unknown control '+key);
    for(const c of controls){const value=params[c.id];
      if(c.type==='select')assert(c.options.some(o=>String(o.value)===String(value)),topic+': invalid option '+c.id);
      else {assert(Number.isFinite(Number(value))&&value>=c.min&&value<=c.max,topic+': range '+c.id);const tick=(value-c.min)/(c.step||1);assert(Math.abs(tick-Math.round(tick))<1e-7,topic+': non-step value '+c.id);}
    }
  }
  function validate(params){
    validParams(params);const saved=JSON.stringify(params),r=lesson.build(params);assert.equal(JSON.stringify(params),saved,topic+': mutated input');
    assert.equal(JSON.stringify(lesson.build({...params})),JSON.stringify(r),topic+': non-deterministic data');
    const ids=new Set(r.nodes.map(n=>n.id)),edges=new Set(r.edges.map(e=>e.id));assert.equal(ids.size,r.nodes.length);assert.equal(edges.size,r.edges.length);assert(r.steps.length>0);
    for(const n of r.nodes){assert(n.title&&n.lane&&n.detail!==undefined,topic+': node content '+n.id);assert(Number.isInteger(n.readyAt??0)&&(n.readyAt??0)>=0&&(n.readyAt??0)<=r.steps.length,topic+': node readiness');}
    for(const e of r.edges){assert(ids.has(e.from)&&ids.has(e.to),topic+': endpoint '+e.id);assert(e.label&&e.steps.length,topic+': unnamed dependency');for(const s of e.steps)assert(Number.isInteger(s)&&s>0&&s<=r.steps.length,topic+': dependency step');}
    for(const s of r.steps){assert(s.title&&s.summary,topic+': step description');for(const n of s.activeNodes||[])assert(ids.has(n));for(const e of s.activeEdges||[])assert(edges.has(e));for(const n of Object.keys(s.state||{}))assert(ids.has(n));}
    for(const holder of [r,...r.steps])for(const plot of holder.plots||[]){
      assert(['bars','vectors','timeline','stack'].includes(plot.type),topic+': unsupported plot');
      if(plot.type==='bars')for(const s of plot.series){assert.equal(s.values.length,plot.labels.length);assert(s.values.every(Number.isFinite));}
      if(plot.type==='vectors')for(const v of plot.vectors)assert(Number.isFinite(v.x)&&Number.isFinite(v.y));
      if(plot.type==='stack'){assert(Number.isFinite(plot.total)&&plot.total>=0);assert(plot.parts.every(p=>Number.isFinite(p.value)&&p.value>=0));}
      if(plot.type==='timeline')for(const row of plot.rows){for(const s of row.segments||[])assert(Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>=s.start);for(const e of row.events||[])assert(Number.isFinite(e.time));}
    }
    builds++;return r;
  }
  validate({...defaults});
  for(const c of controls)for(const value of c.type==='select'?c.options.map(o=>o.value):[c.min,c.max])validate({...defaults,[c.id]:value});
  for(const link of lesson.related||[])assert(fs.existsSync(path.resolve(root,topic,link.href)),topic+': broken related link '+link.href);
  for(const source of lesson.sources||[])assert(/^https:\/\//.test(source.url),topic+': invalid source');
  const chain=path.join(root,topic,'call-chain.json');
  if(fs.existsSync(chain))for(const variant of JSON.parse(fs.readFileSync(chain,'utf8')).variants)for(const node of variant.nodes)for(const target of node.targets){
    const action=target.action,r=validate({...defaults,...action.params});assert(Number.isInteger(action.step)&&action.step>=0&&action.step<=r.steps.length,topic+': invalid source target '+node.id);targets++;
  }
  console.log(topic+': authored states, control bounds and dependencies passed');
}
console.log(`Validated ${topics.length} lessons / ${builds} data builds / ${targets} source targets.`);
