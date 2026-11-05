(() => {
  const NS='http://www.w3.org/2000/svg';
  function svgEl(tag,attrs={},parent){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(parent)parent.appendChild(el);return el;}
  function drawObject(parent,node,x,y,width){
    const kind=node.kind||'tokens', scale=width/100;
    const memory=['cache','hash','selection','state'].includes(kind);
    const expert=['router','experts','shared'].includes(kind);
    const ink=`var(--viz-series-${memory?2:expert?3:1})`;
    const g=svgEl('g',{class:'ds-object',transform:`translate(${x},${y}) scale(${scale})`,style:`--ink:${ink}`,'data-object':kind,'aria-hidden':'true'},parent);
    const rect=(a,b,w,h,fill='var(--face)',stroke='var(--line)',r=1)=>svgEl('rect',{x:a,y:b,width:w,height:h,rx:r,fill,stroke,'stroke-width':.8},g);
    const line=(x1,y1,x2,y2,color='var(--rule)',sw=1)=>svgEl('line',{x1,y1,x2,y2,stroke:color,'stroke-width':sw},g);
    const path=(d,fill='none',stroke='var(--line)',sw=.8)=>svgEl('path',{d,fill,stroke,'stroke-width':sw,'stroke-linejoin':'round'},g);
    const tint='color-mix(in srgb,var(--ink) 17%,var(--face))';
    const soft='color-mix(in srgb,var(--foreground) 6%,var(--face))';
    if(kind==='tokens'){
      for(let r=0;r<8;r++){
        rect(3,5+r*9,17,6,'var(--ink)','none',2).setAttribute('data-token-cell','');
        line(22,8+r*9,31,8+r*9);
        for(let c=0;c<6;c++)rect(35+c*9,5+r*9,7,6,(r+c)%3?'var(--ink)':tint,'none');
      }
    }else if(kind==='streams'){
      const count=Math.max(1,Math.min(node.streamCount||1,4)),gap=7,w=(92-gap*(count-1))/count;
      for(let stream=0;stream<count;stream++){
        const xx=4+stream*(w+gap);rect(xx,4,w,72,'var(--face)','var(--rule)',3);
        for(let t=0;t<8;t++)rect(xx+3,7+t*8.4,w-6,5.4,'var(--ink)','none',1);
      }
    }else if(kind==='stack'){
      for(let layer=19;layer>=0;layer--){
        const xx=5+layer*.7,yy=9+layer*2.7;
        path(`M ${xx} ${yy+4} L ${xx+61} ${yy} L ${xx+75} ${yy+10} L ${xx+14} ${yy+14} Z`,layer===0?tint:'var(--face)');
        if(layer%4===0)line(xx+20,yy+7,xx+58,yy+4,'var(--ink)',1.4);
      }
    }else if(kind==='cache'||kind==='hash'){
      path('M 7 13 L 78 7 L 92 18 L 21 24 Z',soft);
      path('M 78 7 L 92 18 L 92 72 L 78 62 Z',soft);
      rect(7,13,71,55);
      for(let row=0;row<5;row++){
        const pulled=kind==='hash'&&row===2;
        rect(pulled?1:11,18+row*9,62,6,row===2?'var(--ink)':tint,'none');
        for(let c=1;c<6;c++)line(11+c*10,18+row*9,11+c*10,24+row*9,'var(--face)');
      }
    }else if(kind==='vision'){
      for(let r=0;r<4;r++)for(let c=0;c<4;c++)rect(3+c*14,10+r*14,12,12,(r+c)%3===0?'var(--ink)':tint,'var(--rule)');
      for(let r=0;r<5;r++){line(62,21+r*9,73,21+r*9);rect(76,18+r*9,18,6,'var(--ink)','none');}
    }else if(kind==='gather'||kind==='scatter'){
      const flip=kind==='scatter';
      for(let i=0;i<4;i++){
        const yy=12+i*18;
        path(flip?`M 28 40 C 48 40 52 ${yy} 74 ${yy}`:`M 24 ${yy} C 47 ${yy} 48 40 74 40`,'none','var(--ink)',1.5);
        for(let j=0;j<3;j++)rect(flip?76+j*6:4+j*6,yy-4,4,8,'var(--ink)','none');
      }
      rect(flip?5:77,28,17,24,tint,'var(--ink)',2);
    }else if(kind==='router'){
      rect(3,29,14,22,tint,'var(--ink)',2);
      for(let i=0;i<6;i++){const yy=7+i*13;path(`M 20 40 C 48 40 47 ${yy} 74 ${yy}`,'none','var(--ink)',1.2);rect(78,yy-4,14,8,'var(--ink)','none',2);}
    }else if(kind==='experts'){
      const count=node.expertCount||384, selectedCount=node.selectedExperts||6;
      const cols=Math.ceil(Math.sqrt(count*1.25)),rows=Math.ceil(count/cols),cw=88/cols,ch=70/rows;
      const selected=new Set(Array.from({length:selectedCount},(_,i)=>Math.floor((i+.5)*count/selectedCount)));
      for(let i=0;i<count;i++)rect(5+(i%cols)*cw,5+Math.floor(i/cols)*ch,cw*.72,ch*.66,selected.has(i)?'var(--ink)':'var(--rule)','none',.2);
    }else if(kind==='shared'){
      rect(13,12,66,55,tint,'var(--ink)',3);
      for(let i=0;i<4;i++){svgEl('circle',{cx:25+i*14,cy:26,r:3,fill:'var(--ink)'},g);svgEl('circle',{cx:25+i*14,cy:52,r:3,fill:'var(--ink)'},g);for(let j=0;j<4;j++)line(25+i*14,29,25+j*14,49);}
    }else if(kind==='sum'){
      for(let i=0;i<6;i++){rect(2,7+i*11,9,6,'var(--ink)','none');line(14,10+i*11,46,40,'var(--ink)');}
      svgEl('circle',{cx:53,cy:40,r:12,fill:'var(--face)',stroke:'var(--line)'},g);
      line(47,40,59,40,'var(--ink)',1.5);line(53,34,53,46,'var(--ink)',1.5);line(66,40,78,40);rect(80,27,14,26,tint,'var(--ink)',2);
    }else if(kind==='attention'){
      for(let r=0;r<8;r++)for(let c=0;c<8;c++)rect(9+c*9,5+r*9,7,7,c>r?soft:(r+c)%3===0?'var(--ink)':tint,'none',.5);
    }else if(kind==='selection'){
      for(let r=0;r<6;r++)for(let c=0;c<10;c++)rect(4+c*9,9+r*10,6.5,7,[2,5,8,11,24,39,46,53].includes(r*10+c)?'var(--ink)':soft,'none',1);
    }else if(kind==='logits'){
      [17,29,39,63,22,47,16,9].forEach((h,i)=>rect(5+i*11,72-h,7,h,i===5?'var(--ink)':tint,'none',1));
    }else if(kind==='sample'){
      for(let i=0;i<3;i++)rect(5+i*12,30,9,20,soft,'none',2);
      line(44,40,57,40,'var(--ink)',1.5);rect(61,17,30,46,tint,'var(--ink)',3);
      for(let i=0;i<4;i++)line(68,27+i*8,84,27+i*8,'var(--ink)',2);
    }else if(kind==='state'){
      for(let r=0;r<6;r++)for(let c=0;c<6;c++)rect(18+c*10,12+r*10,8,8,(r+c)%4===0?'var(--ink)':tint,'none');
      path('M 13 17 C -2 17 -2 68 12 68 M 82 68 C 99 68 99 17 83 17','none','var(--ink)',1.4);
    }else if(kind==='verify'){
      for(let i=0;i<5;i++){rect(3+i*19,15,15,24,tint,'var(--line)',2);line(10+i*19,41,10+i*19,50);rect(3+i*19,53,15,14,i<2?'var(--ink)':soft,'none',2);}
    }else if(kind==='draft'){
      for(let i=0;i<3;i++){rect(4,5+i*12,62,7,tint,'var(--rule)');line(69,8+i*12,89,42);}
      for(let i=0;i<5;i++)rect(5+i*18,54,13,20,tint,'var(--line)',2);
      path('M 5 78 H 90','none','var(--line)').setAttribute('stroke-dasharray','3 3');
    }
  }

  window.ARCH_ART={draw:drawObject};
})();
