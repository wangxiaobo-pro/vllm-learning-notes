(() => {
  'use strict';
  const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
  const models=window.ARCH_MODELS;
  const modelOrder=['llama','deepseek_v2','deepseek_v41','glm53','kimi_k3','deepseek_v4_pro','minimax'];
  let model,component,componentId,step=-1,selected=null,selectedEdge=null,timer=null,frame=null,playing=false,first=true,trail=[];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const svg=(tag,attrs,parent)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);if(parent)parent.appendChild(e);return e;};
  function routeHash(m,c){return '#'+encodeURIComponent(m)+'/'+encodeURIComponent(c);}
  function navigate(m,c){
    const hash=routeHash(m,c);if(location.hash===hash){renderRoute();return;}
    let next=model&&model.id===m?[...trail]:[models[m].root];
    const index=next.indexOf(c);next=index>=0?next.slice(0,index+1):[...next,c];
    history.pushState({archModel:m,archTrail:next},'',hash);renderRoute();
  }
  function stop(){playing=false;clearTimeout(timer);timer=null;if(frame!==null)cancelAnimationFrame(frame);frame=null;$('play').textContent='播放数据流';$('play').setAttribute('aria-pressed','false');document.querySelectorAll('.packet').forEach(p=>p.remove());}
  function readRoute(){
    const [m,c]=location.hash.slice(1).split('/').map(x=>{try{return decodeURIComponent(x);}catch{return '';}});
    const id=models[m]?m:(modelOrder.find(id=>models[id])||Object.keys(models)[0]);
    model=models[id];if(!model)throw new Error('模型数据未加载，请检查 data 目录。');
    componentId=model.components[c]?c:model.root;
    component=model.components[componentId];
    if(!component)throw new Error('模型缺少总览组件。');
  }
  function renderSheets(){
    $('sheets').replaceChildren();
    modelOrder.filter(id=>models[id]).forEach((id,index)=>{
      const m=models[id],button=make('button','sheet');button.type='button';button.dataset.model=id;
      button.append(make('small','',`SHEET ${String(index+1).padStart(2,'0')}`),make('span','',m.name));
      if(model.id===id)button.setAttribute('aria-current','page');
      button.addEventListener('click',()=>navigate(id,m.root));$('sheets').append(button);
    });
  }
  function renderBreadcrumb(){
    const saved=history.state;
    const ids=saved&&saved.archModel===model.id&&saved.archTrail?.at(-1)===componentId?saved.archTrail.filter(id=>model.components[id]):[];
    if(!ids.length){const seen=new Set();let id=componentId;while(id&&model.components[id]&&!seen.has(id)){ids.unshift(id);seen.add(id);id=model.components[id].parent;}}
    if(ids[0]!==model.root)ids.unshift(model.root);trail=ids;
    $('breadcrumb').replaceChildren();
    ids.forEach((id,i)=>{if(i)$('breadcrumb').append(make('span','','/'));if(i===ids.length-1){const current=make('span','',model.components[id].title);current.setAttribute('aria-current','page');$('breadcrumb').append(current);}else{const a=make('a','',i===0?'模型总览':model.components[id].title);a.href=routeHash(model.id,id);a.addEventListener('click',event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();navigate(model.id,id);}});$('breadcrumb').append(a);}});
    $('component-select').replaceChildren();
    Object.entries(model.components).forEach(([id,c])=>{const option=make('option','',c.title);option.value=id;option.selected=id===componentId;$('component-select').append(option);});
  }
  function renderText(){
    document.title=`${model.name} · ${component.title} — 模型架构图谱`;
    $('model-name').textContent=model.name;$('model-summary').textContent=model.summary;
    $('stats').replaceChildren();(model.stats||[]).forEach(s=>{const item=make('span');item.append(make('span','stat-label',s.label),make('span','stat-value',s.value));$('stats').append(item);});
    $('component-title').textContent=component.title;$('component-kicker').textContent=componentId===model.root?'MODEL / 整体数据流':'COMPONENT / 内部计算';
    $('intro').replaceChildren();(component.intro||[]).forEach(p=>$('intro').append(make('p','',p)));
    $('inputs').textContent=component.inputs;$('outputs').textContent=component.outputs;
    $('steps').replaceChildren();component.steps.forEach((s,i)=>{const li=make('li');li.dataset.step=i;const b=make('strong','',s.title+'：');li.append(b,document.createTextNode(s.text));$('steps').append(li);});
    $('edges').replaceChildren();$('edge-select').replaceChildren(make('option','','选择一条连线'));$('edge-select').firstChild.value='';
    component.edges.forEach((e,i)=>{const row=make('button','edge-row',edgeText(i));row.type='button';row.dataset.edgeId=i;row.addEventListener('click',()=>showEdge(i));$('edges').append(row);const option=make('option','',edgeText(i));option.value=i;$('edge-select').append(option);});
    paintEdgeSelection();
    $('notes').replaceChildren();(component.notes||[]).forEach(n=>$('notes').append(make('li','',n)));$('notes-section').hidden=!(component.notes||[]).length;
    $('sources').replaceChildren();const keys=component.sources||[];(model.sources||[]).filter(s=>keys.includes(s.id)).forEach(source=>{const li=make('li');if(source.url){const a=make('a','',source.label);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);}else li.append(document.createTextNode(source.label));if(source.local)li.append(make('span','source-local',source.local));$('sources').append(li);});
    $('baseline').textContent=`核对日期：${model.checked} · ${model.revision||'官方配置与参考实现'} · 图形示意不代表实际张量数值或硬件运行。`;
    $('verification-example').hidden=!component.verificationDemo;
    if(component.verificationDemo)verification('partial');
    $('node-detail').hidden=true;
  }
  const edgeName=index=>'E'+String(index+1).padStart(2,'0');
  function edgeText(index){const e=component.edges[index],from=component.nodes.find(n=>n.id===e.from),to=component.nodes.find(n=>n.id===e.to);return `${edgeName(index)} · 第 ${e.step} 步 · ${from.label} → ${e.label} → ${to.label}${e.optional?'（可选）':''}`;}
  function paintEdgeSelection(){
    $('edge-selection').hidden=selectedEdge===null;$('edge-description').textContent=selectedEdge===null?'':edgeText(selectedEdge);$('edge-select').value=selectedEdge===null?'':String(selectedEdge);
    $('diagram').classList.toggle('edge-pinned',selectedEdge!==null);$('diagram').classList.remove('tracing');
    document.querySelectorAll('[data-edge-id]').forEach(el=>el.classList.toggle('pinned',selectedEdge!==null&&Number(el.dataset.edgeId)===selectedEdge));
  }
  function showEdge(index){stop();selectedEdge=index;paintEdgeSelection();}
  function buildRouter(boxes,W,H){
    const xs=new Set([9,W-9]),ys=new Set([7,H-7]);
    const ports=b=>({top:{p:[b.x+b.w/2,b.y],q:[b.x+b.w/2,b.y-10]},bottom:{p:[b.x+b.w/2,b.y+b.h],q:[b.x+b.w/2,b.y+b.h+10]},left:{p:[b.x,b.y+b.h/2],q:[b.x-10,b.y+b.h/2]},right:{p:[b.x+b.w,b.y+b.h/2],q:[b.x+b.w+10,b.y+b.h/2]}});
    boxes.forEach(b=>Object.values(ports(b)).forEach(p=>{xs.add(p.q[0]);ys.add(p.q[1]);}));
    const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b),cache=new Map();
    const blocked=(a,b)=>{
      const key=a.join(',')+'|'+b.join(',');if(cache.has(key))return cache.get(key);
      const hit=boxes.some(r=>a[0]===b[0]?a[0]>r.x-2&&a[0]<r.x+r.w+2&&Math.max(a[1],b[1])>r.y-2&&Math.min(a[1],b[1])<r.y+r.h+2:a[1]>r.y-2&&a[1]<r.y+r.h+2&&Math.max(a[0],b[0])>r.x-2&&Math.min(a[0],b[0])<r.x+r.w+2);
      cache.set(key,hit);return hit;
    };
    function search(start,end){
      const si=X.indexOf(start[0]),sj=Y.indexOf(start[1]),ei=X.indexOf(end[0]),ej=Y.indexOf(end[1]);
      const key=(x,y)=>x+','+y,begin=key(si,sj),finish=key(ei,ej),open=[{x:si,y:sj,g:0,f:0}],dist=new Map([[begin,0]]),prev=new Map();
      while(open.length){
        open.sort((a,b)=>b.f-a.f);const current=open.pop(),ck=key(current.x,current.y);
        if(current.g!==dist.get(ck))continue;
        if(ck===finish){const result=[];let k=finish;while(k){const [x,y]=k.split(',').map(Number);result.push([X[x],Y[y]]);k=prev.get(k);}return result.reverse();}
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const x=current.x+dx,y=current.y+dy;if(x<0||y<0||x>=X.length||y>=Y.length)continue;
          const a=[X[current.x],Y[current.y]],b=[X[x],Y[y]];if(blocked(a,b))continue;
          const nk=key(x,y),g=current.g+Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+1;
          if(g>=(dist.get(nk)??Infinity))continue;dist.set(nk,g);prev.set(nk,ck);open.push({x,y,g,f:g+Math.abs(b[0]-end[0])+Math.abs(b[1]-end[1])});
        }
      }
      return null;
    }
    return (a,b)=>{
      const ap=ports(a),bp=ports(b),down=b.y>a.y,up=b.y<a.y,right=b.x>a.x;
      const pairs=down?[['bottom','top'],[right?'right':'left',right?'left':'right']]:up?[['top','bottom'],[right?'right':'left',right?'left':'right']]:[[right?'right':'left',right?'left':'right'],['bottom','bottom']];
      for(const [pa,pb] of pairs){const route=search(ap[pa].q,bp[pb].q);if(route){const pts=[ap[pa].p,...route,bp[pb].p];return pts.filter((p,i)=>i===0||i===pts.length-1||!((pts[i-1][0]===p[0]&&p[0]===pts[i+1][0])||(pts[i-1][1]===p[1]&&p[1]===pts[i+1][1])));}}
      return [ap.bottom.p,[ap.bottom.p[0],H-7],[bp.bottom.p[0],H-7],bp.bottom.p];
    };
  }
  function renderGraph(){
    const container=$('diagram'),W=Math.floor(container.getBoundingClientRect().width),narrow=W<620;
    container.replaceChildren();container.classList.remove('tracing');
    function traceNode(id){
      if(selectedEdge!==null)return;
      container.classList.toggle('tracing',!!id);
      container.querySelectorAll('.edge,.edge-label').forEach(el=>el.classList.toggle('trace',!!id&&(el.dataset.from===id||el.dataset.to===id)));
    }
    const maxCol=Math.max(...component.nodes.map(n=>n.col||0)),cols=narrow?1:maxCol+1,pad=narrow?20:28,gap=cols===3?32:64,nodeW=(W-2*pad-(cols-1)*gap)/cols;
    const nodes=[...component.nodes].sort((a,b)=>a.row-b.row||(a.col||0)-(b.col||0));
    const rowHeights=new Map(),buttons=new Map();
    nodes.forEach((n,i)=>{
      const row=narrow?i:n.row,button=make('button','graph-node'+(cols===3&&nodeW<245?' compact-node':''));button.type='button';button.dataset.node=n.id;button.dataset.target=n.target||'';button.style.width=nodeW+'px';button.style.left=(pad+(narrow?0:n.col||0)*(nodeW+gap))+'px';
      const art=svg('svg',{class:'node-art',viewBox:'0 0 100 82','aria-hidden':'true'});window.ARCH_ART.draw(art,n,0,0,100);
      const copy=make('span','node-copy');copy.append(make('span','node-title',n.label),make('span','node-desc',n.detail||''),make('span','node-action',n.target?'进入组件 ↗':'查看输入 / 输出'));
      button.append(art,copy);button.setAttribute('aria-label',`${n.label}，${n.target?'进入内部结构':'查看输入输出'}`);
      button.addEventListener('click',()=>n.target?navigate(model.id,n.target):showNode(n));container.append(button);buttons.set(n.id,button);
      button.addEventListener('pointerenter',()=>traceNode(n.id));button.addEventListener('pointerleave',()=>traceNode(null));
      button.addEventListener('focus',()=>traceNode(n.id));button.addEventListener('blur',()=>traceNode(null));
      rowHeights.set(row,Math.max(rowHeights.get(row)||0,button.getBoundingClientRect().height,104));
    });
    const rows=[...rowHeights.keys()].sort((a,b)=>a-b),rowY=new Map();let y=24;rows.forEach(r=>{rowY.set(r,y);y+=rowHeights.get(r)+88;});const H=y-38;
    container.style.height=H+'px';const boxes=[];
    nodes.forEach((n,i)=>{const row=narrow?i:n.row,b=buttons.get(n.id),box={id:n.id,x:parseFloat(b.style.left),y:rowY.get(row),w:nodeW,h:rowHeights.get(row)};b.style.top=box.y+'px';b.style.height=box.h+'px';boxes.push(box);});
    const wires=svg('svg',{class:'wires',viewBox:`0 0 ${W} ${H}`,role:'group','aria-label':'可选择箭头查看完整数据依赖'}),defs=svg('defs',{},wires),marker=svg('marker',{id:'arrowhead',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto'},defs);svg('path',{d:'M1 1 L9 5 L1 9',fill:'none',stroke:'context-stroke','stroke-width':1.5},marker);
    container.prepend(wires);
    const route=buildRouter(boxes,W,H),labelPositions=[];
    $('edge-overflow-list').replaceChildren();$('edge-overflow').hidden=true;
    component.edges.forEach((e,i)=>{
      const a=boxes.find(b=>b.id===e.from),b=boxes.find(b=>b.id===e.to);if(!a||!b)return;
      const points=route(a,b),d=points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ');
      const attributes={'data-step':e.step,'data-from':e.from,'data-to':e.to,'data-edge-id':i};
      const p=svg('path',{d,class:'edge'+(e.optional?' optional':''),'marker-end':'url(#arrowhead)',...attributes},wires);
      const hit=svg('path',{d,class:'edge-hit',...attributes,tabindex:0,role:'button','aria-label':edgeText(i)},wires);
      hit.addEventListener('click',()=>showEdge(i));hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showEdge(i);}});
      const segments=points.slice(1).map((p,j)=>({a:points[j],b:p,len:Math.abs(p[0]-points[j][0])+Math.abs(p[1]-points[j][1])})).sort((a,b)=>b.len-a.len);
      const t=svg('text',{x:0,y:0,class:'edge-label',...attributes},wires);t.addEventListener('click',()=>showEdge(i));let placed=false,abbreviated=false;
      const overlaps=(a,b)=>a.x<b.x+b.w+4&&a.x+a.w>b.x-4&&a.y<b.y+b.h+4&&a.y+a.h>b.y-4;
      const wrap=label=>{const lines=[];let line='';for(const char of label){t.textContent=line+char;if(t.getComputedTextLength()>(narrow?210:245)&&line){lines.push(line);line=char;}else line+=char;}if(line)lines.push(line);return lines;};
      for(const label of [`${edgeName(i)} · ${e.step} · ${e.label}`,edgeName(i)]){
        abbreviated=label===edgeName(i);const lines=wrap(label);t.replaceChildren();lines.forEach((line,j)=>svg('tspan',{x:0,dy:j?14:0},t).textContent=line);
        for(const segment of segments){
          for(const fraction of [.5,.3,.7,.15,.85]){
            const x=segment.a[0]+(segment.b[0]-segment.a[0])*fraction,yy=segment.a[1]+(segment.b[1]-segment.a[1])*fraction-5;
            t.setAttribute('x',x);t.setAttribute('y',yy);t.querySelectorAll('tspan').forEach(span=>span.setAttribute('x',x));const box=t.getBBox(),r={x:box.x,y:box.y,w:box.width,h:box.height};
            if(r.x<3||r.x+r.w>W-3||r.y<3||r.y+r.h>H-3||boxes.some(box=>overlaps(r,box))||labelPositions.some(box=>overlaps(r,box)))continue;
            labelPositions.push(r);placed=true;break;
          }
          if(placed)break;
        }
        if(placed)break;
      }
      if(!placed)t.remove();
      if(abbreviated||!placed){$('edge-overflow').hidden=false;const reference=make('button','edge-reference',edgeText(i));reference.type='button';reference.dataset.edgeId=i;reference.addEventListener('click',()=>showEdge(i));$('edge-overflow-list').append(reference);}
      svg('title',{},p).textContent=edgeText(i);

    });
    container.prepend(wires);updateStep(false);paintEdgeSelection();
  }
  function showNode(node){
    stop();selected=node.id;$('node-title').textContent=node.label;$('node-description').textContent=node.description||node.detail||'';
    $('node-in').replaceChildren();$('node-out').replaceChildren();
    const incoming=component.edges.filter(e=>e.to===node.id),outgoing=component.edges.filter(e=>e.from===node.id);
    incoming.forEach(e=>{const p=component.nodes.find(n=>n.id===e.from);$('node-in').append(make('li','',`${p.label} → ${e.label}${p.detail?'（'+p.detail+'）':''}`));});
    outgoing.forEach(e=>{const p=component.nodes.find(n=>n.id===e.to);$('node-out').append(make('li','',`${e.label} → ${p.label}${p.detail?'（'+p.detail+'）':''}`));});
    if(!incoming.length)$('node-in').append(make('li','',node.inputs||'外部或初始化来源：见上方本节点的说明。'));
    if(!outgoing.length)$('node-out').append(make('li','',node.outputs||'本图边界之外的消费者或状态写回：见上方本节点的说明。'));
    $('node-detail').hidden=false;document.querySelectorAll('.graph-node').forEach(b=>b.classList.toggle('selected',b.dataset.node===node.id));$('node-detail').scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'nearest'});
  }
  function animate(){
    if(frame!==null)cancelAnimationFrame(frame);document.querySelectorAll('.packet').forEach(p=>p.remove());if(reduced.matches||step<0)return;
    const wires=$('diagram').querySelector('.wires'),packets=[];
    wires.querySelectorAll('.edge.active').forEach(path=>{for(let i=0;i<3;i++){const p=svg('rect',{width:8,height:6,rx:2,fill:'var(--tensor)',class:'packet'},wires);packets.push({p,path,length:path.getTotalLength(),delay:i*100});}});
    const start=performance.now();function tick(now){let more=false;packets.forEach(({p,path,length,delay})=>{const t=(now-start-delay)/1000;if(t<0){p.setAttribute('visibility','hidden');more=true;return;}if(t>=1){p.remove();return;}p.setAttribute('visibility','visible');const point=path.getPointAtLength(t*length);p.setAttribute('x',point.x-4);p.setAttribute('y',point.y-3);more=true;});frame=more?requestAnimationFrame(tick):null;}frame=requestAnimationFrame(tick);
  }
  function updateStep(motion=true){
    const current=component.steps[step];$('counter').textContent=step<0?`${component.steps.length} 步 · 全局关系`:`${step+1} / ${component.steps.length}`;$('prev').disabled=step<0;$('next').disabled=step>=component.steps.length-1;$('all').setAttribute('aria-pressed',String(step<0));
    $('step-caption').textContent=current?`${step+1}. ${current.title}：${current.text}`:'';
    document.querySelectorAll('.graph-node').forEach(b=>b.classList.toggle('active',!!current&&current.focus.includes(b.dataset.node)));
    document.querySelectorAll('.edge').forEach(e=>e.classList.toggle('active',Number(e.dataset.step)===step+1));
    document.querySelectorAll('#steps li').forEach(li=>li.classList.toggle('active',Number(li.dataset.step)===step));if(motion)animate();
  }
  function playNext(){timer=setTimeout(()=>{if(!playing)return;if(step>=component.steps.length-1){stop();return;}step++;updateStep();playNext();},2200);}
  function verification(mode){
    document.querySelectorAll('[data-verification]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.verification===mode)));$('token-verification').replaceChildren();
    const rows=mode==='all'?[['a','接受','accepted'],['b','接受','accepted'],['c','接受','accepted'],['d','接受','accepted'],['e','接受','accepted'],['z','目标 bonus','recovered']]:[['a','接受','accepted'],['b','接受','accepted'],['c','拒绝','rejected'],['d','丢弃',''],['e','丢弃',''],['x','目标纠正','recovered']];
    rows.forEach(([token,label,cls])=>{const cell=make('div','token-result '+cls);cell.append(make('strong','',token),make('small','',label));$('token-verification').append(cell);});
    $('verification-explanation').textContent=mode==='all'?'提交 a、b、c、d、e 与目标模型额外生成的 z；更新有效长度后继续下一轮起草。':'提交 a、b 与纠正 token x；c 及后续 d、e 不进入已确认历史。验证中计算出的拒绝后缀 KV 不成为有效上下文，相关长度与状态需按接受前缀修正。';
  }
  function renderRoute(){stop();step=-1;selected=null;selectedEdge=null;readRoute();renderSheets();renderBreadcrumb();renderText();renderGraph();if(!first)$('component-title').scrollIntoView({block:'start'});first=false;}
  $('edge-select').addEventListener('change',event=>showEdge(event.target.value===''?null:Number(event.target.value)));
  $('close-edge').addEventListener('click',()=>showEdge(null));
  $('component-select').addEventListener('change',e=>navigate(model.id,e.target.value));
  $('all').addEventListener('click',()=>{stop();step=-1;updateStep();});$('prev').addEventListener('click',()=>{stop();step--;updateStep();});$('next').addEventListener('click',()=>{stop();step++;updateStep();});
  $('play').addEventListener('click',()=>{if(playing){stop();return;}if(step<0||step>=component.steps.length-1)step=0;playing=true;$('play').textContent='暂停';$('play').setAttribute('aria-pressed','true');updateStep();playNext();});
  $('close-node').addEventListener('click',()=>{$('node-detail').hidden=true;selected=null;document.querySelectorAll('.graph-node.selected').forEach(b=>b.classList.remove('selected'));});
  $('theme').addEventListener('click',()=>{const dark=document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.dataset.theme=dark?'light':'dark';try{localStorage.setItem('architecture-theme',dark?'light':'dark');}catch{}});
  document.querySelectorAll('[data-verification]').forEach(b=>b.addEventListener('click',()=>verification(b.dataset.verification)));
  try{const saved=localStorage.getItem('architecture-theme');if(['light','dark'].includes(saved))document.documentElement.dataset.theme=saved;}catch{}
  window.addEventListener('hashchange',renderRoute);window.addEventListener('popstate',renderRoute);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  let width=0;new ResizeObserver(entries=>{const next=entries[0].contentRect.width;if(Math.abs(next-width)>1){width=next;if(model)renderGraph();}}).observe($('diagram'));
  try{renderRoute();}catch(error){$('model-summary').textContent=error.message;console.error(error);}
})();
