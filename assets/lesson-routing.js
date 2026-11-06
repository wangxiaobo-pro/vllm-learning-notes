/* Orthogonal, obstacle-aware routing. Coordinates and clearances are in SVG pixels. */
(() => {
  const GRID = 12, CLEARANCE = 7;
  const length = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const between = (v,a,b) => v>Math.min(a,b)+0.1&&v<Math.max(a,b)-0.1;
  function intersects(a,b,c,d) {
    if(a.y===b.y&&c.x===d.x)return between(c.x,a.x,b.x)&&between(a.y,c.y,d.y);
    if(a.x===b.x&&c.y===d.y)return between(a.x,c.x,d.x)&&between(c.y,a.y,b.y);
    return false;
  }
  function overlap(a,b,c,d) {
    if(a.y===b.y&&c.y===d.y&&a.y===c.y)return Math.max(0,Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)));
    if(a.x===b.x&&c.x===d.x&&a.x===c.x)return Math.max(0,Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)));
    return 0;
  }
  function simplify(points) {
    const out=[];
    for(const p of points){
      if(out.length&&length(out.at(-1),p)<0.1)continue;
      while(out.length>=2){const a=out.at(-2),b=out.at(-1);if(a.x===b.x&&b.x===p.x||a.y===b.y&&b.y===p.y)out.pop();else break;}
      out.push(p);
    }
    return out;
  }
  function blocked(a,b,rectangles){
    return rectangles.some(n=>a.x===b.x
      ? a.x>n.x-CLEARANCE&&a.x<n.x+n.width+CLEARANCE&&Math.max(a.y,b.y)>n.y-CLEARANCE&&Math.min(a.y,b.y)<n.y+n.height+CLEARANCE
      : a.y>n.y-CLEARANCE&&a.y<n.y+n.height+CLEARANCE&&Math.max(a.x,b.x)>n.x-CLEARANCE&&Math.min(a.x,b.x)<n.x+n.width+CLEARANCE);
  }
  class Heap {
    values=[];
    push(value){let i=this.values.push(value)-1;while(i){const parent=(i-1)>>1;if(this.values[parent].f<=value.f)break;this.values[i]=this.values[parent];i=parent;}this.values[i]=value;}
    pop(){const first=this.values[0],last=this.values.pop();if(this.values.length){let i=0;while(i*2+1<this.values.length){let j=i*2+1;if(j+1<this.values.length&&this.values[j+1].f<this.values[j].f)j++;if(this.values[j].f>=last.f)break;this.values[i]=this.values[j];i=j;}this.values[i]=last;}return first;}
  }
  function route(nodes,edges,width,height){
    const byId=new Map(nodes.map(n=>[n.id,n])),ports=new Map();
    const sideFor=(a,b)=>b.y>=a.y+a.height?'bottom':b.y+b.height<=a.y?'top':b.x>=a.x+a.width?'right':'left';
    const endpoints=edges.map(edge=>({edge,from:byId.get(edge.from),to:byId.get(edge.to)}));
    for(const item of endpoints)for(const role of ['from','to']){
      const n=item[role],other=item[role==='from'?'to':'from'],side=sideFor(n,other),key=n.id+':'+side;
      const list=ports.get(key)||[];list.push({item,role,n,other,side});ports.set(key,list);
    }
    for(const list of ports.values()){
      const vertical=['top','bottom'].includes(list[0].side);
      list.sort((a,b)=>vertical?(a.other.x+a.other.width/2)-(b.other.x+b.other.width/2):(a.other.y+a.other.height/2)-(b.other.y+b.other.height/2));
      list.forEach((entry,i)=>{
        const {n,side,item,role}=entry;
        let point;
        if(vertical){const x=Math.round((n.x+18+(n.width-36)*(i+1)/(list.length+1))/GRID)*GRID;point={x,y:side==='top'?n.y:n.y+n.height};}
        else {const y=Math.round((n.y+18+(n.height-36)*(i+1)/(list.length+1))/GRID)*GRID;point={x:side==='left'?n.x:n.x+n.width,y};}
        item[role+'Port']={...point,side,count:list.length};
      });
    }
    // A one-output source may align with a target input directly; avoid gratuitous doglegs.
    for(const item of endpoints){const a=item.fromPort,b=item.toPort;
      if(['top','bottom'].includes(a.side)&&['top','bottom'].includes(b.side)){
        if(a.count===1&&b.x>item.from.x+16&&b.x<item.from.x+item.from.width-16)a.x=b.x;
        else if(b.count===1&&a.x>item.to.x+16&&a.x<item.to.x+item.to.width-16)b.x=a.x;
      }
    }
    const lead=port=>({x:port.side==='left'?Math.floor((port.x-14)/GRID)*GRID:port.side==='right'?Math.ceil((port.x+14)/GRID)*GRID:port.x,
      y:port.side==='top'?Math.floor((port.y-14)/GRID)*GRID:port.side==='bottom'?Math.ceil((port.y+14)/GRID)*GRID:port.y});
    const nx=Math.floor(width/GRID)+1,ny=Math.floor(height/GRID)+1,blockedGrid=new Set();
    for(let iy=1;iy<ny-1;iy++)for(let ix=1;ix<nx-1;ix++){
      const p={x:ix*GRID,y:iy*GRID};if(nodes.some(n=>p.x>n.x-CLEARANCE&&p.x<n.x+n.width+CLEARANCE&&p.y>n.y-CLEARANCE&&p.y<n.y+n.height+CLEARANCE))blockedGrid.add(iy*nx+ix);
    }
    const segments=[],routes=[],reserved=[];
    const fixed=endpoints.flatMap(item=>[
      {id:item.edge.id,a:item.fromPort,b:lead(item.fromPort)},
      {id:item.edge.id,a:lead(item.toPort),b:item.toPort}
    ]);
    // Preserve direct local edges first; feedback and distant dependencies route around them.
    endpoints.sort((a,b)=>length(a.fromPort,a.toPort)-length(b.fromPort,b.toPort));
    for(const item of endpoints){
      const start=lead(item.fromPort),end=lead(item.toPort),sx=Math.round(start.x/GRID),sy=Math.round(start.y/GRID),tx=Math.round(end.x/GRID),ty=Math.round(end.y/GRID);
      const heap=new Heap(),dist=new Map(),prev=new Map(),key=(x,y,d)=>(y*nx+x)*3+d;
      const initial=key(sx,sy,0);dist.set(initial,0);heap.push({x:sx,y:sy,d:0,g:0,f:length(start,end),key:initial});let last;
      while(heap.values.length){const cur=heap.pop();if(cur.g!==dist.get(cur.key))continue;if(cur.x===tx&&cur.y===ty){last=cur;break;}
        for(const [dx,dy,dir] of [[1,0,1],[-1,0,1],[0,1,2],[0,-1,2]]){
          const x=cur.x+dx,y=cur.y+dy;if(x<1||x>=nx-1||y<1||y>=ny-1||blockedGrid.has(y*nx+x))continue;
          const a={x:cur.x*GRID,y:cur.y*GRID},b={x:x*GRID,y:y*GRID};if(blocked(a,b,nodes)||blocked(a,b,reserved))continue;
          if(fixed.some(s=>s.id!==item.edge.id&&overlap(a,b,s.a,s.b)>0)||segments.some(([u,v])=>overlap(a,b,u,v)>0))continue;
          let penalty=cur.d&&cur.d!==dir?24:0;
          for(const [u,v]of segments){const shared=overlap(a,b,u,v);penalty+=shared*90;
            const crossing=a.y===b.y&&u.x===v.x?u.x>=Math.min(a.x,b.x)&&u.x<=Math.max(a.x,b.x)&&between(a.y,u.y,v.y):a.x===b.x&&u.y===v.y&&u.y>=Math.min(a.y,b.y)&&u.y<=Math.max(a.y,b.y)&&between(a.x,u.x,v.x);
            if(crossing)penalty+=110;
          }
          const g=cur.g+GRID+penalty,k=key(x,y,dir);if(g>=(dist.get(k)??Infinity))continue;
          dist.set(k,g);prev.set(k,cur.key);heap.push({x,y,d:dir,g,f:g+Math.abs(x-tx)*GRID+Math.abs(y-ty)*GRID,key:k});
        }
      }
      if(!last)throw new Error('无法为连线找到清晰路径：'+item.edge.id);
      const path=[];let k=last.key;while(k!==undefined){const cell=Math.floor(k/3);path.push({x:(cell%nx)*GRID,y:Math.floor(cell/nx)*GRID});k=prev.get(k);}path.reverse();
      const points=simplify([{x:item.fromPort.x,y:item.fromPort.y},...path,{x:item.toPort.x,y:item.toPort.y}]);
      for(let i=1;i<points.length;i++)segments.push([points[i-1],points[i]]);
      if(points.length===2&&points[0].y===points[1].y&&length(points[0],points[1])<120){
        reserved.push({x:(points[0].x+points[1].x)/2-23,y:points[0].y-11,width:46,height:22});
      }
      routes.push({id:item.edge.id,points,fromSide:item.fromPort.side,toSide:item.toPort.side});
    }
    return edges.map(edge=>routes.find(r=>r.id===edge.id));
  }
  window.LessonRouting={route,intersects,overlap,blocked,simplify};
})();
