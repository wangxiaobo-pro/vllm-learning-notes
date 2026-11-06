/* Shared offline renderer. Lesson definitions own the calculations and state transitions. */
(() => {
  function mount() {
    const root = document.getElementById('lesson-workbench'), lesson = window.LESSON;
    if (!root || !lesson || window.lessonController) return;
    const topic = root.dataset.topic, key = 'lesson-workbench:' + topic;
    const controls = lesson.controls || [], defaults = Object.fromEntries(controls.map(c => [c.id,c.value]));
    let params = {...defaults}, step = 0, result, resizeFrame, routeCache, edgeFocus = null;
    const make = (tag,text,cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = String(text); if (cls) e.className = cls; return e; };
    const svg = (tag,attrs = {},text) => { const e = document.createElementNS('http://www.w3.org/2000/svg',tag); for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,String(v)); if (text !== undefined) e.textContent=String(text); return e; };
    const context = document.createElement('canvas').getContext('2d');
    function wrap(text,width,size=12) {
      context.font = size + 'px system-ui,"Microsoft YaHei",sans-serif';
      const lines = [];
      for (const paragraph of String(text ?? '').split('\n')) {
        let line = '';
        for (const token of paragraph.match(/[A-Za-z0-9_.+-]+|./gu)||[]) {
          const pieces=context.measureText(token).width>width?[...token]:[token];
          for(const piece of pieces){
            if (line && context.measureText(line+piece).width > width) { lines.push(line); line = piece; }
            else line += piece;
          }
        }
        lines.push(line);
      }
      return lines;
    }
    function textLines(parent,lines,x,y,size=12,color,anchor='start') {
      const t = svg('text',{x,y,'font-size':size,fill:color,'text-anchor':anchor});
      lines.forEach((line,i)=>t.append(svg('tspan',{x,dy:i ? size*1.5 : 0},line))); parent.append(t); return t;
    }
    const fmt = value => typeof value !== 'number' ? String(value) : !Number.isFinite(value) ? '—' : Math.abs(value)>=10000 || Math.abs(value)>0 && Math.abs(value)<.001 ? value.toExponential(2) : Number(value.toFixed(4)).toString();
    function colors() {
      const style = getComputedStyle(document.documentElement), get = name => style.getPropertyValue('--lesson-'+name).trim();
      return {ink:get('ink'),muted:get('muted'),panel:get('panel'),line:get('line'),green:get('green'),mint:get('mint'),shade:get('shade'),sand:get('sand'),amber:get('amber'),series:[get('green'),get('amber'),'#568aad','#ad7099','#89954e','#856eb3'],flowSeries:get('bg')==='#141c19'?[get('green'),'#f0bf84','#9ec6f2','#e4a8d7','#c3d684','#c2b4ff']:[get('green'),get('amber'),'#286090','#8b416d','#546a1f','#6950a0']};
    }
    root.innerHTML = `<header class="lw-header"><a href="../index.html">← 学习流程目录</a><p class="lw-kicker"></p><h1></h1><p class="lw-subtitle"></p></header>
      <p class="lw-scope"></p><form class="lw-controls" aria-label="教学参数"></form>
      <nav class="lw-toolbar" aria-label="流程步骤"><button type="button" data-lw-global>全局关系</button><button type="button" data-lw-prev>上一步</button><button type="button" data-lw-next>下一步</button><button type="button" data-lw-reset>重置参数</button><span class="lw-counter"></span></nav>
      <div class="lw-current" aria-live="polite"><h2></h2><p></p></div><div class="lw-metrics"></div>
      <figure class="lw-figure"><div class="lw-trace"><p aria-live="polite">点按连线可单独追踪输入与去向。</p><button type="button" data-lw-clear-edge hidden>显示全部连线</button></div><svg role="img" aria-label="端到端数据流程"></svg><figcaption>箭头编号对应执行步骤，a/b 区分同一步的多条路径；卡片圈号仅标识组件。跨线留有间隔，不表示合流。可点按连线或下方关系单独追踪。</figcaption><details class="lw-connections"><summary>逐条查看数据来源与去向</summary><div></div></details></figure>
      <div class="lw-equation" hidden></div><div class="lw-details"></div><aside class="lw-notes"></aside>
      <section class="lw-steps"><h2>完整编号流程</h2><ol></ol></section><details class="lw-sources"><summary>依据与适用范围</summary><div></div></details><nav class="lw-related" aria-label="相关学习主题"></nav><p class="lw-status" role="status"></p>`;
    const $ = q => root.querySelector(q);
    document.title = lesson.title + ' · vLLM 学习笔记';
    $('.lw-header h1').textContent=lesson.title; $('.lw-kicker').textContent=lesson.kind || '交互学习'; $('.lw-subtitle').textContent=lesson.subtitle || '';
    function validated(values,strict=false) {
      const out={...defaults};
      if (strict) for (const key of Object.keys(values)) if (!controls.some(c=>c.id===key)) throw new Error('未知参数：'+key);
      for (const control of controls) {
        const value=values[control.id] ?? control.value;
        if (control.type==='select') {
          if ((control.options||[]).some(o=>String(o.value)===String(value))) out[control.id]=String(value);
          else if(strict) throw new Error('无效场景或选项：'+control.id);
        } else {
          const number=Number(value);
          const ticks=(number-(control.min??0))/(Number(control.step)||1);
          if (!Number.isFinite(number) || number<control.min || number>control.max || Math.abs(ticks-Math.round(ticks))>1e-7) {
            if(strict) throw new Error('参数超出范围：'+control.id);
          } else out[control.id]=number;
        }
      }
      return out;
    }
    try { const saved=JSON.parse(localStorage.getItem(key)); if(saved) { params=validated(saved.params || {}); step=Number.isInteger(saved.step)?saved.step:0; } } catch {}
    for (const control of controls) {
      const field=make('label',undefined,'lw-field');field.dataset.control=control.id;
      field.append(make('span',control.label));
      const input=make(control.type==='select'?'select':'input'); input.name=control.id; input.setAttribute('aria-label',control.label);
      if (control.type==='select') for(const option of control.options||[]) { const el=make('option',option.label);el.value=String(option.value);input.append(el); }
      else {input.type=control.type || 'number'; for(const attr of ['min','max','step']) if(control[attr]!==undefined) input[attr]=control[attr];}
      field.append(input);if(control.type==='range')field.append(make('output'));
      input.addEventListener('change',()=>{
        try {params=validated({...params,[control.id]:input.value},true);step=0;$('.lw-status').textContent='';compute();}
        catch(error){$('.lw-status').textContent=error.message;input.value=params[control.id];}
      });
      $('.lw-controls').append(field);
    }
    $('.lw-controls').addEventListener('submit',event=>event.preventDefault());
    function verifyResult(model) {
      if(!model || !Array.isArray(model.nodes) || !Array.isArray(model.steps) || !model.steps.length)throw new Error('教学流程缺少节点或步骤');
      const ids=new Set(model.nodes.map(n=>n.id));if(ids.size!==model.nodes.length)throw new Error('流程节点重复');
      const edges=new Set();
      for(const edge of model.edges||[]) {
        if(edges.has(edge.id) || !ids.has(edge.from) || !ids.has(edge.to))throw new Error('流程边引用错误：'+edge.id);
        edges.add(edge.id);
        for(const n of edge.steps||[])if(!Number.isInteger(n)||n<1||n>model.steps.length)throw new Error('边的步骤编号错误');
      }
      for(const node of model.nodes)if(node.readyAt!==undefined&&(!Number.isInteger(node.readyAt)||node.readyAt<0||node.readyAt>model.steps.length))throw new Error('节点就绪步骤错误：'+node.id);
      for(const item of model.steps){
        for(const id of item.activeNodes||[])if(!ids.has(id))throw new Error('步骤引用未知节点：'+id);
        for(const id of item.activeEdges||[])if(!edges.has(id))throw new Error('步骤引用未知边：'+id);
        for(const id of Object.keys(item.state||{}))if(!ids.has(id))throw new Error('状态引用未知节点：'+id);
      }
    }
    function remember(){try{localStorage.setItem(key,JSON.stringify({params,step}));}catch{}}
    function compute(){edgeFocus=null;result=lesson.build({...params});verifyResult(result);step=Math.max(0,Math.min(step,result.steps.length));render();}
    function drawFlow(){
      if(!root.getBoundingClientRect().width)return;
      const drawing=$('.lw-figure svg'),c=colors(),width=Math.floor($('.lw-figure').clientWidth-20);
      const current=step?result.steps[step-1]:null,edges=result.edges||[];
      const edgeText=edge=>String(edge.label).replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]+\s*/u,'');
      const edgeTag=edge=>{const peers=edges.filter(e=>e.steps[0]===edge.steps[0]),suffix=peers.length>1?String.fromCharCode(97+peers.indexOf(edge)):'';return edge.steps.join('·')+suffix;};
      if(!routeCache||routeCache.result!==result||routeCache.width!==width){
        const nodes=[...result.nodes].sort((a,b)=>(a.row??result.nodes.indexOf(a))-(b.row??result.nodes.indexOf(b))||(a.col||0)-(b.col||0));
        const desired=Math.min(3,Math.max(...nodes.map(n=>(n.col||0)+1)));
        const gap=72,columns=(width-96-(desired-1)*gap)/desired>=200?desired:1;
        const cardWidth=Math.floor((width-96-gap*(columns-1))/columns/12)*12;
        const margin=(width-(cardWidth*columns+gap*(columns-1)))/2;
        const positions=new Map(),rows=new Map();
        nodes.forEach((n,i)=>{
          const row=columns===1?i:(n.row??i),col=columns===1?0:(n.col||0);
          const titleLines=wrap(n.title,cardWidth-24,14),laneLines=wrap(n.lane||'数据 / 计算',cardWidth-24,10);
          const maxLines=Math.max(...[n.detail,'等待上游产出',...result.steps.map(s=>s.state?.[n.id]).filter(v=>v!==undefined)].map(t=>wrap(t,cardWidth-24,12).length));
          const titleY=24+laneLines.length*15,detailY=titleY+4+titleLines.length*21,height=Math.ceil((detailY+maxLines*18+10)/12)*12;
          const record={...n,row,col,titleLines,laneLines,titleY,detailY,height,x:margin+col*(cardWidth+gap),width:cardWidth};
          positions.set(n.id,record);rows.set(row,Math.max(rows.get(row)||0,height));
        });
        let y=48;for(const row of [...rows.keys()].sort((a,b)=>a-b)){
          for(const n of positions.values())if(n.row===row)n.y=y;
          const outgoing=edges.filter(e=>positions.get(e.from).row===row).length;
          y+=rows.get(row)+Math.max(120,Math.min(5,outgoing)*30);
        }
        const height=Math.max(...[...positions.values()].map(n=>n.y+n.height))+72,routes=window.LessonRouting.route([...positions.values()],edges,width,height);
        const occupied=[],labels=new Map(),rectHit=(a,b,pad=5)=>a.x<b.x+b.width+pad&&a.x+a.width>b.x-pad&&a.y<b.y+b.height+pad&&a.y+a.height>b.y-pad;
        for(const [index,edge]of edges.entries()){
          const route=routes[index],number=edgeTag(edge),full=number+' '+edgeText(edge),source=positions.get(edge.from);
          const candidates=[];
          for(let j=1;j<route.points.length;j++){
            const a=route.points[j-1],b=route.points[j],vertical=a.x===b.x,span=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);
            if(span<18)continue;
            for(const compact of [false,true]){
              const maxWidth=compact?46:Math.min(230,cardWidth-8,vertical?cardWidth-8:span-16);
              if((maxWidth<40||!vertical&&span<120)&&!compact)continue;
              const text=compact?number:full,lines=wrap(text,maxWidth,11);
              context.font='11px system-ui,"Microsoft YaHei",sans-serif';
              const w=Math.max(...lines.map(t=>context.measureText(t).width))+12,h=lines.length*16.5+7;
              const ratios=[.5,.28,.72,...Array.from({length:Math.max(0,Math.floor(span/12)-2)},(_,i)=>(i+1)*12/span)];
              for(const ratio of ratios)for(const offset of compact?[0,-1,1]:[0]){
                const anchor={x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio};
                const cx=anchor.x+(vertical?offset*(w/2+7):0),cy=anchor.y+(vertical?0:offset*(h/2+7));
                const box={x:cx-w/2,y:cy-h/2,width:w,height:h,lines,compact,edge:edge.id};
                if(offset)box.leader={from:anchor,to:{x:vertical?cx-offset*w/2:cx,y:vertical?cy:cy-offset*h/2}};
                if(box.x<8||box.x+w>width-8||box.y<8||box.y+h>height-8)continue;
                if([...positions.values(),...occupied].some(n=>rectHit(box,n)))continue;
                let collisions=0;
                for(const other of routes)if(other.id!==edge.id)for(let k=1;k<other.points.length;k++){
                  const u=other.points[k-1],v=other.points[k],r={x:Math.min(u.x,v.x),y:Math.min(u.y,v.y),width:Math.abs(u.x-v.x)||1,height:Math.abs(u.y-v.y)||1};if(rectHit(box,r,2))collisions++;
                }
                if(collisions)continue;
                candidates.push({...box,score:(compact?10000:0)+Math.abs(cx-(source.x+source.width/2))*.1-span*.1+Math.abs(ratio-.5)*20+Math.abs(offset)*50});
              }
            }
          }
          candidates.sort((a,b)=>a.score-b.score);
          if(candidates.length){const label=candidates[0];labels.set(edge.id,label);occupied.push(label);}
        }
        routeCache={result,width,positions,routes,height,labels};
        $('.lw-connections').open=columns===1;
      }
      const {positions,routes,height,labels}=routeCache;
      drawing.replaceChildren();drawing.setAttribute('viewBox',`0 0 ${width} ${height}`);
      drawing.setAttribute('aria-label',lesson.title+'：'+(current?.title||'全局输入、处理和消费者'));
      const defs=svg('defs');drawing.append(defs);
      const focusEdge=edges.find(e=>e.id===edgeFocus);
      $('.lw-trace p').textContent=focusEdge?positions.get(focusEdge.from).title+' → '+positions.get(focusEdge.to).title+'：'+edgeText(focusEdge):'点按连线可单独追踪输入与去向；按 Esc 或“显示全部连线”恢复。';
      $('[data-lw-clear-edge]').hidden=!focusEdge;
      const groupKeys=[...new Set(edges.map(e=>e.group||e.from))];
      const colorFor=edge=>c.flowSeries[groupKeys.indexOf(edge.group||edge.from)%c.flowSeries.length];
      const visible=edge=>focusEdge?edge.id===edgeFocus:!current||(current.activeEdges||[]).includes(edge.id)||(edge.steps||[]).includes(step);
      // Later paths cross earlier ones with a contrasting halo, never a junction dot.
      const ordered=[...routes].sort((a,b)=>Number(a.id===edgeFocus)-Number(b.id===edgeFocus));
      for(const route of ordered){
        const edge=edges.find(e=>e.id===route.id),active=visible(edge),color=colorFor(edge),d=route.points.map((p,i)=>(i?'L':'M')+' '+p.x+' '+p.y).join(' '),group=svg('g',{'data-lw-route':edge.id,opacity:active?1:.16});
        const marker=svg('marker',{id:'lw-arrow-'+edge.id,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:color}));defs.append(marker);
        group.append(svg('path',{d,fill:'none',stroke:c.panel,'stroke-width':7,'stroke-linejoin':'round','pointer-events':'none'}));
        const path=svg('path',{d,fill:'none',stroke:color,'stroke-width':edge.id===edgeFocus?3:2,'stroke-dasharray':edge.kind==='control'?'6 4':'none','marker-end':'url(#lw-arrow-'+edge.id+')','stroke-linejoin':'round','data-lw-edge':edge.id});group.append(path);
        const description=edgeTag(edge)+' · '+positions.get(edge.from).title+' → '+positions.get(edge.to).title+'：'+edgeText(edge);
        const hit=svg('path',{d,fill:'none',stroke:'transparent','stroke-width':12,tabindex:0,role:'button','aria-label':description,'aria-pressed':String(edge.id===edgeFocus),'data-lw-edge-select':edge.id});hit.append(svg('title',{},description));group.append(hit);drawing.append(group);
      }
      for(const n of positions.values()){
        const active=current&&(current.activeNodes||[]).includes(n.id),related=!focusEdge||focusEdge.from===n.id||focusEdge.to===n.id;
        const group=svg('g',{opacity:related?1:.4});drawing.append(group);
        group.append(svg('rect',{x:n.x,y:n.y,width:n.width,height:n.height,rx:9,fill:active?c.mint:c.panel,stroke:active?c.green:c.line,'stroke-width':active?2:1,'data-lw-node':n.id}));
        textLines(group,n.laneLines,n.x+12,n.y+18,10,c.muted);
        textLines(group,n.titleLines,n.x+12,n.y+n.titleY,14,c.ink).setAttribute('font-weight','650');
        const detail=current?.state&&Object.hasOwn(current.state,n.id)?current.state[n.id]:step&&step<(n.readyAt||0)?'等待上游产出':n.detail;
        textLines(group,wrap(detail,n.width-24,12),n.x+12,n.y+n.detailY,12,c.muted);
      }
      for(const edge of edges){const label=labels.get(edge.id);if(!label)continue;
        const active=visible(edge),color=colorFor(edge),group=svg('g',{opacity:active?1:.22,'data-lw-edge-select':edge.id,style:'cursor:pointer'});
        if(label.leader)group.append(svg('line',{x1:label.leader.from.x,y1:label.leader.from.y,x2:label.leader.to.x,y2:label.leader.to.y,stroke:color,'stroke-width':1}));
        group.append(svg('rect',{x:label.x,y:label.y,width:label.width,height:label.height,rx:4,fill:c.panel,stroke:color,'stroke-width':.6,'data-lw-edge-label':edge.id}));
        const lines=wrap(edgeTag(edge)+(label.compact?'':' '+edgeText(edge)),label.width-12,11);
        textLines(group,lines,label.x+label.width/2,label.y+14,11,color,'middle');drawing.append(group);
      }
      const holder=$('.lw-connections>div');holder.replaceChildren();
      for(const edge of edges){const button=make('button',undefined,'lw-connection');button.type='button';button.dataset.lwEdgeSelect=edge.id;button.setAttribute('aria-pressed',String(edge.id===edgeFocus));button.style.setProperty('--edge-color',colorFor(edge));button.append(make('b',edgeTag(edge)),make('strong',positions.get(edge.from).title+' → '+positions.get(edge.to).title),make('span',edgeText(edge)));holder.append(button);}
    }
    function focusEdge(id){edgeFocus=edgeFocus===id?null:id;drawFlow();}
    $('.lw-figure').addEventListener('click',event=>{const target=event.target.closest('[data-lw-edge-select]');if(target){const keepFocus=target.matches('button')&&target===document.activeElement;focusEdge(target.dataset.lwEdgeSelect);if(keepFocus)$('.lw-connections').querySelector('[data-lw-edge-select="'+target.dataset.lwEdgeSelect+'"]').focus();}if(event.target.closest('[data-lw-clear-edge]')){edgeFocus=null;drawFlow();}});
    $('.lw-figure').addEventListener('keydown',event=>{const target=event.target.closest('path[data-lw-edge-select]');if(event.key==='Escape'){edgeFocus=null;drawFlow();if(target)drawingFocus(target.dataset.lwEdgeSelect);return;}if(target&&['Enter',' '].includes(event.key)){event.preventDefault();focusEdge(target.dataset.lwEdgeSelect);drawingFocus(target.dataset.lwEdgeSelect);}});
    function drawingFocus(id){$('.lw-figure').querySelector('path[data-lw-edge-select="'+id+'"]').focus();}
    function drawPlot(box,plot,index){
      const c=colors(),width=Math.max(210,box.clientWidth-28),drawing=svg('svg',{role:'img','aria-label':plot.title||plot.type});box.append(drawing);
      let height=210;
      const legend=(labels)=>{const el=make('div',undefined,'lw-legend');labels.forEach((entry,i)=>{const item=make('span',typeof entry==='string'?entry:entry.label);item.style.setProperty('--swatch',entry.color||c.series[i%c.series.length]);el.append(item);});box.append(el);};
      if(plot.type==='bars'){
        const labels=plot.labels||[],series=plot.series||[],values=series.flatMap(s=>s.values).filter(Number.isFinite),low=Math.min(0,...values),high=Math.max(0,...values),span=high-low||1;
        const left=Math.min(110,width*.32),right=65,usable=Math.max(60,width-left-right),x=v=>left+(v-low)/span*usable,rowHeight=Math.max(45,series.length*18+20);height=labels.length*rowHeight+35;
        drawing.append(svg('line',{x1:x(0),x2:x(0),y1:8,y2:height-20,stroke:c.line}));
        labels.forEach((label,row)=>{const y=17+row*rowHeight;textLines(drawing,wrap(label,left-9,11),3,y+9,11,c.ink);series.forEach((s,col)=>{const value=s.values[row];if(!Number.isFinite(value))return;const py=y+col*18;drawing.append(svg('rect',{x:Math.min(x(0),x(value)),y:py,width:Math.max(1,Math.abs(x(value)-x(0))),height:12,rx:2,fill:c.series[col%c.series.length]}));textLines(drawing,[fmt(value)],width-right+6,py+10,10,c.muted);});});legend(series.map(s=>s.label));
      }else if(plot.type==='vectors'){
        height=Math.min(370,width+45);const cx=width/2,cy=(height-25)/2,r=Math.min(width,height-25)*.32,vectors=plot.vectors||[],bound=Math.max(1,...vectors.map(v=>Math.hypot(v.x,v.y)))*1.18,scale=r/bound;
        drawing.append(svg('circle',{cx,cy,r:scale,fill:'none',stroke:c.line,'stroke-dasharray':'4 4'}));
        drawing.append(svg('path',{d:`M 15 ${cy} H ${width-15} M ${cx} 12 V ${height-35}`,stroke:c.line,fill:'none'}));textLines(drawing,['x'],width-12,cy-6,11,c.muted);textLines(drawing,['y'],cx+6,15,11,c.muted);
        vectors.forEach((v,i)=>{const x=cx+v.x*scale,y=cy-v.y*scale,color=c.series[i%c.series.length],angle=Math.atan2(y-cy,x-cx),tip=6;drawing.append(svg('line',{x1:cx,y1:cy,x2:x,y2:y,stroke:color,'stroke-width':2}));drawing.append(svg('path',{d:`M ${x-tip*Math.cos(angle-.45)} ${y-tip*Math.sin(angle-.45)} L ${x} ${y} L ${x-tip*Math.cos(angle+.45)} ${y-tip*Math.sin(angle+.45)}`,stroke:color,fill:'none','stroke-width':2}));textLines(drawing,[String(i+1)],Math.max(12,Math.min(width-18,x+6)),Math.max(14,Math.min(height-30,y-7+i%2*18)),12,color);});legend(vectors.map((v,i)=>(i+1)+'. '+v.label+' ['+fmt(v.x)+', '+fmt(v.y)+']'));
      }else if(plot.type==='timeline'){
        const rows=plot.rows||[],max=Math.max(1,...rows.flatMap(r=>[...(r.segments||[]).map(s=>s.end),...(r.events||[]).map(e=>e.time)])),left=45,usable=width-left-16,x=v=>left+v/max*usable; height=rows.length*94+45;
        rows.forEach((row,i)=>{const y=25+i*94;textLines(drawing,wrap(row.label,39,11),2,y+13,11,c.ink);drawing.append(svg('line',{x1:left,x2:width-15,y1:y+17,y2:y+17,stroke:c.line}));(row.segments||[]).forEach((s,j)=>{drawing.append(svg('rect',{x:x(s.start),y,width:Math.max(1,x(s.end)-x(s.start)),height:24,fill:c.series[j%c.series.length],opacity:.65}));});(row.events||[]).forEach((e,j)=>{drawing.append(svg('circle',{cx:x(e.time),cy:y+12,r:4,fill:c.green,stroke:c.panel}));textLines(drawing,[String(j+1)],x(e.time),y+43+(j%2)*15,10,c.muted,'middle');});});textLines(drawing,['0'],left,height-8,11,c.muted);textLines(drawing,[fmt(max)+' '+(plot.unit||'ms')],width-12,height-8,11,c.muted,'end');
        legend(rows.flatMap(row=>(row.segments||[]).map((s,i)=>({label:row.label+' · '+s.label+' '+fmt(s.start)+'–'+fmt(s.end)+' '+(plot.unit||'ms'),color:c.series[i%c.series.length]}))));
        for(const row of rows){const caption=make('p',row.label+' 输出事件：'+(row.events||[]).map((e,i)=>(i+1)+'. '+e.label+' @ '+fmt(e.time)+' '+(plot.unit||'ms')).join('；'),'lw-plot-caption');box.append(caption);}
      }else if(plot.type==='stack'){
        const parts=plot.parts||[],sum=parts.reduce((a,p)=>a+p.value,0),limit=Math.max(plot.total||0,sum,1),left=6,usable=width-12; height=90;
        drawing.append(svg('rect',{x:left,y:23,width:usable,height:26,fill:c.shade,rx:4}));let used=0;parts.forEach((p,i)=>{drawing.append(svg('rect',{x:left+used/limit*usable,y:23,width:p.value/limit*usable,height:26,fill:c.series[i%c.series.length]}));used+=p.value;});const capacity=left+(plot.total||0)/limit*usable;drawing.append(svg('line',{x1:capacity,x2:capacity,y1:14,y2:60,stroke:c.amber,'stroke-width':2}));const capacityLabel='容量 '+fmt(plot.total)+' '+(plot.unit||'');context.font='11px system-ui,"Microsoft YaHei",sans-serif';textLines(drawing,[capacityLabel],Math.max(context.measureText(capacityLabel).width+5,Math.min(width-5,capacity)),12,11,c.amber,'end');textLines(drawing,['合计 '+fmt(sum)+' '+(plot.unit||'')],6,77,12,c.ink);legend(parts.map(p=>p.label+' '+fmt(p.value)+' '+(plot.unit||'')));
      }else {textLines(drawing,['此图表类型尚未实现：'+plot.type],5,25,12,c.amber);}
      drawing.setAttribute('viewBox',`0 0 ${width} ${height}`);
    }
    function renderDetails(){
      const current=step?result.steps[step-1]:null,holder=$('.lw-details');holder.replaceChildren();
      for(const table of current?.tables ?? result.tables ?? []){
        const card=make('section',undefined,'lw-table-card');card.append(make('h3',table.title||'数据变化'));const scroll=make('div',undefined,'lw-table-scroll'),el=make('table'),head=make('thead'),row=make('tr');
        for(const value of table.headers||[])row.append(make('th',value));head.append(row);el.append(head);const body=make('tbody');
        for(const values of table.rows||[]){const row=make('tr');for(const value of values)row.append(make('td',fmt(value)));body.append(row);}el.append(body);scroll.append(el);card.append(scroll);holder.append(card);
      }
      for(const [i,plot]of(current?.plots ?? result.plots ?? []).entries()){const box=make('section',undefined,'lw-plot');box.append(make('h3',plot.title||'数值视图'));holder.append(box);drawPlot(box,plot,i);}
      const equation=current?.equation ?? result.equation;$('.lw-equation').hidden=!equation;$('.lw-equation').textContent=equation||'';
      const notes=[...(result.notes||[]),...(current?.notes||[])];$('.lw-notes').replaceChildren(...notes.map(note=>make('p',note)));$('.lw-notes').hidden=!notes.length;
    }
    function render(){
      root.dataset.step=String(step);root.dataset.ready='true';
      $('.lw-scope').textContent=result.scope||'';
      for(const control of controls){const field=root.querySelector('[data-control="'+control.id+'"]'),input=field.querySelector('input,select');input.value=params[control.id];field.hidden=control.showIf?!control.showIf(params):false;if(field.querySelector('output'))field.querySelector('output').textContent=fmt(params[control.id]);}
      const current=step?result.steps[step-1]:null;
      $('.lw-current h2').textContent=current?'第 '+step+' 步 · '+current.title:'全局关系 · 输入、计算与消费者';
      $('.lw-current p').textContent=current?.summary || lesson.subtitle || '';
      $('[data-lw-global]').setAttribute('aria-pressed',String(step===0));$('[data-lw-prev]').disabled=step===0;$('[data-lw-next]').disabled=step===result.steps.length;
      $('.lw-counter').textContent=step+' / '+result.steps.length+' · 0 为全局';
      $('.lw-metrics').replaceChildren(...(result.metrics||[]).map(metric=>{const e=make('div',undefined,'lw-metric');e.append(make('span',metric.label),make('strong',metric.value));return e;}));
      const list=$('.lw-steps ol');list.replaceChildren();result.steps.forEach((item,i)=>{const li=make('li'),button=make('button',undefined,'lw-step-button');button.type='button';button.dataset.lwStep=String(i+1);if(step===i+1)button.setAttribute('aria-current','true');const text=make('span');text.append(make('strong',item.title),make('small',item.summary));button.append(make('b',String(i+1).padStart(2,'0')),text);li.append(button);list.append(li);});
      drawFlow();renderDetails();remember();
    }
    function select(next){if(!Number.isInteger(next)||next<0||next>result.steps.length)throw new Error('无效步骤：'+next);step=next;edgeFocus=null;render();}
    root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-lw-global'))select(0);if(button.hasAttribute('data-lw-prev'))select(Math.max(0,step-1));if(button.hasAttribute('data-lw-next'))select(Math.min(result.steps.length,step+1));if(button.hasAttribute('data-lw-reset')){params={...defaults};step=0;compute();}if(button.dataset.lwStep)select(Number(button.dataset.lwStep));});
    for(const source of lesson.sources||[]){const a=make('a',source.label);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';$('.lw-sources>div').append(a);}
    for(const related of lesson.related||[]){const a=make('a',related.label+' →');a.href=related.href;$('.lw-related').append(a);}
    function redraw(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(root.getBoundingClientRect().width){drawFlow();renderDetails();}});}
    window.addEventListener('resize',redraw);matchMedia('(prefers-color-scheme:dark)').addEventListener('change',redraw);
    window.lessonController={
      getState:()=>({params:{...params},step,result}),
      setParams:values=>{const next=validated({...params,...values},true),built=lesson.build({...next});verifyResult(built);params=next;result=built;step=0;edgeFocus=null;render();},
      openTarget:async action=>{
        if(!action||!Number.isInteger(action.step))throw new Error('目标缺少有效步骤');
        const next=validated({...defaults,...(action.params||{})},true),built=lesson.build({...next});verifyResult(built);
        if(action.step<0||action.step>built.steps.length)throw new Error('无效步骤：'+action.step);
        params=next;result=built;step=action.step;edgeFocus=null;render();
        await new Promise(resolve=>requestAnimationFrame(resolve));drawFlow();
        return {label:action.step?'第 '+action.step+' 步 · '+result.steps[action.step-1].title:'全局关系'};
      }
    };
    compute();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
