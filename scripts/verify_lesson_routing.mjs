import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../assets/lesson-routing.js',import.meta.url),'utf8'),context);
const routing=context.window.LessonRouting;
const node=(id,x,y,width=216,height=120)=>({id,x,y,width,height});
function check(nodes,edges,width,height){
  const before=JSON.stringify({nodes,edges}),routes=routing.route(nodes,edges,width,height);
  assert.equal(JSON.stringify({nodes,edges}),before,'routing must not change authored data');
  assert.equal(JSON.stringify(routes),JSON.stringify(routing.route(nodes,edges,width,height)),'deterministic routes');
  for(const route of routes){const edge=edges.find(e=>e.id===route.id),source=nodes.find(n=>n.id===edge.from),target=nodes.find(n=>n.id===edge.to);
    const onBoundary=(p,n)=>(p.x===n.x||p.x===n.x+n.width)&&p.y>=n.y&&p.y<=n.y+n.height||(p.y===n.y||p.y===n.y+n.height)&&p.x>=n.x&&p.x<=n.x+n.width;
    assert(onBoundary(route.points[0],source),'producer port');assert(onBoundary(route.points.at(-1),target),'consumer port');
    for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];assert(a.x===b.x||a.y===b.y,'orthogonal segment');assert(!routing.blocked(a,b,nodes.filter(n=>n!==source&&n!==target)),'no unrelated card crossing');}
  }
  for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)for(let a=1;a<routes[i].points.length;a++)for(let b=1;b<routes[j].points.length;b++)assert.equal(routing.overlap(routes[i].points[a-1],routes[i].points[a],routes[j].points[b-1],routes[j].points[b]),0,'independent edges must not look like a shared bus');
  return routes;
}
const ropeNodes=[node('q',48,48),node('p',336,48),node('k',624,48),node('angle',336,288),node('qr',48,528),node('kr',624,528),node('dot',336,768),node('out',336,1008)];
const ropeEdges=[['p','angle'],['q','qr'],['angle','qr'],['k','kr'],['angle','kr'],['qr','dot'],['kr','dot'],['dot','out']].map(([from,to],i)=>({id:String(i),from,to}));
const rope=check(ropeNodes,ropeEdges,900,1212);
for(const id of ['1','3']){const points=rope.find(r=>r.id===id).points;assert.equal(points.length,2,'Q and K each use a direct vertical path');assert.equal(points[0].x,points[1].x);}
const feedbackNodes=[node('scheduler',48,48,300),node('worker',456,48,300),node('device',48,312,300),node('result',456,312,300)];
check(feedbackNodes,[['scheduler','worker'],['worker','device'],['device','result'],['result','scheduler']].map(([from,to],i)=>({id:String(i),from,to})),816,552);
const phoneNodes=[node('a',60,48,192),node('b',60,288,192),node('c',60,528,192),node('d',60,768,192)];
check(phoneNodes,[['a','c'],['b','c'],['c','d'],['d','b']].map(([from,to],i)=>({id:String(i),from,to})),324,984);
console.log('Lesson routing: direct Q/K branches, distinct input ports, no shared buses, feedback, narrow layout and deterministic geometry passed.');
