(() => {
  const SHA='295c062db8a48ea73bbd05d1174cb37d24bf86f9',base='https://github.com/vllm-project/vllm/blob/'+SHA+'/';
  window.LESSON={title:'Multi-LoRA：同一批次按行选择适配器',subtitle:'两个 adapter、三个请求、四行 token：从CPU权重和GPU槽位到shrink/expand增量。',kind:'框架机制',
    controls:[{id:'scenario',label:'GPU槽位布局',type:'select',value:'mixed',options:[{value:'mixed',label:'slot0=α，slot1=β'},{value:'slot-swap',label:'交换slot：输出应保持一致'}]}],
    build(params){
      const scenario=params.scenario||'mixed';if(!['mixed','slot-swap'].includes(scenario))throw new Error('未知槽位场景');
      const X=[[1,2],[2,0],[0,1],[1,-1]],W=[[1,0],[0,2]];
      const adapters=[{id:101,name:'α',rank:1,alpha:1,A:[[1,1]],B:[[2],[-1]]},{id:202,name:'β',rank:1,alpha:2,A:[[1,-1]],B:[[1],[2]]}].map(a=>({...a,scale:a.alpha/a.rank,scaledB:a.B.map(row=>row.map(v=>v*a.alpha/a.rank))}));
      const rows=[{request:'R1',position:0,adapter:101},{request:'R1',position:1,adapter:101},{request:'R2',position:0,adapter:202},{request:'R3',position:0,adapter:0}];
      const slots=scenario==='mixed'?[101,202]:[202,101],tokenIds=rows.map(r=>r.adapter),slotIndices=tokenIds.map(id=>id===0?-1:slots.indexOf(id));
      const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),y0=X.map(x=>W.map(w=>dot(x,w)));
      const shrink=X.map((x,i)=>slotIndices[i]<0?0:dot(x,adapters.find(a=>a.id===slots[slotIndices[i]]).A[0]));
      const delta=X.map((x,i)=>slotIndices[i]<0?[0,0]:adapters.find(a=>a.id===slots[slotIndices[i]]).scaledB.map(row=>row[0]*shrink[i]));
      const Y=y0.map((row,i)=>row.map((v,j)=>v+delta[i][j]));
      const m=x=>JSON.stringify(x),slotText=slots.map((id,i)=>'slot'+i+'→'+id).join('；');
      const mappingTable=stage=>({title:'控制映射：请求ID → adapter ID → GPU槽位',headers:['token行','请求/位置','adapter ID','slot index'],rows:rows.map((r,i)=>[i,r.request+'/'+r.position,r.adapter,stage>=4?slotIndices[i]:'待映射'])});
      const weightsTable={title:'有效权重（存储约定：A[r,in]、B[out,r]）',headers:['adapter','A','原 B','α/r','折叠后 B'],rows:adapters.map(a=>[a.name+' / '+a.id,m(a.A),m(a.B),a.scale,m(a.scaledB)])};
      const matrixTable=(stage)=>({title:'逐行算例（尚未执行的结果保持等待）',headers:['请求/行','x','base y0','shrink h','LoRA Δy','最终 y'],rows:rows.map((r,i)=>[r.request+'/'+r.position,m(X[i]),stage>=5?m(y0[i]):'等待',stage>=6?shrink[i]:'等待',stage>=7?m(delta[i]):'等待',stage>=8?m(Y[i]):'等待'])});
      const state=stage=>({
        requests:'R1:2行→α(101)；R2:1行→β(202)；R3:1行→base(0)。token adapter IDs='+m(tokenIds),
        checkpoints:'α A='+m(adapters[0].A)+' B='+m(adapters[0].B)+'；β A='+m(adapters[1].A)+' B='+m(adapters[1].B),
        cpu:stage>=2?'两个adapter已加载至CPU；β缩放2已折叠进B='+m(adapters[1].scaledB):'尚未加载 CPU adapter',
        slots:stage>=3?slotText+'。权重按槽写入，不按token复制一套权重。':'GPU adapter slots 尚未激活',
        mapping:stage>=4?'token_lora_indices='+m(slotIndices)+'；base行=-1。prompt_mapping只含请求采样行，与token mapping长度不同。':'尚未建立 Punica 行映射',
        input:'X='+m(X)+'；W[out,in]='+m(W)+'；bias=0，TP=1。',
        base:stage>=5?'y0=X·Wᵀ='+m(y0):'base linear 尚未执行',
        shrink:stage>=6?'有效低秩贡献 h=x·Aᵀ='+m(shrink)+'；base行跳过LoRA；图中0是数学贡献，不指未使用buffer字节。':'尚未执行 shrink',
        expand:stage>=7?'Δy=h·B_scaledᵀ='+m(delta):'尚未执行 expand',
        output:stage>=8?'y=y0+Δy='+m(Y):'尚未合并最终输出',
        consumer:stage>=9?'R1→'+m(Y.slice(0,2))+'；R2→'+m(Y[2])+'；R3→'+m(Y[3]):'下游层等待本层输出'
      });
      const nd=(id,title,lane,row,col,readyAt=0)=>({id,title,lane,row,col,readyAt,detail:state(9)[id]});
      const edges=[
        {id:'ids',from:'requests',to:'mapping',label:'①④ 控制：token/request → adapter ID',steps:[1,4]},
        {id:'load',from:'checkpoints',to:'cpu',label:'② 数据：LoRA A/B checkpoint → CPU',steps:[2]},
        {id:'activate',from:'cpu',to:'slots',label:'③ 数据：A/B张量 copy_ CPU→GPU',steps:[3]},
        {id:'slots-map',from:'slots',to:'mapping',label:'④ 控制：lora_index_to_id → slot indices',steps:[4]},
        {id:'x-base',from:'input',to:'base',label:'⑤ 数据：X与base权重W',steps:[5]},
        {id:'x-shrink',from:'input',to:'shrink',label:'⑥ 数据：同一X',steps:[6]},
        {id:'map-shrink',from:'mapping',to:'shrink',label:'⑥ 控制：每行选A槽，-1跳过',steps:[6]},
        {id:'a',from:'slots',to:'shrink',label:'⑥ 数据：A[slot,r,in]',steps:[6]},
        {id:'h',from:'shrink',to:'expand',label:'⑦ 数据：低秩h，内部可用FP32缓冲',steps:[7]},
        {id:'b',from:'slots',to:'expand',label:'⑦ 数据：B_scaled[slot,out,r]',steps:[7]},
        {id:'map-expand',from:'mapping',to:'expand',label:'⑦ 控制：每行选同一个adapter槽',steps:[7]},
        {id:'base-out',from:'base',to:'output',label:'⑧ 数据：共享base结果',steps:[8]},
        {id:'delta',from:'expand',to:'output',label:'⑧ 数据：对应行增量，相加一次',steps:[8]},
        {id:'consume',from:'output',to:'consumer',label:'⑨ 数据：保持原请求/行顺序',steps:[9]}
      ];
      const texts=[['请求归属与两套 adapter','同一批中的R1/R2选择不同适配器，R3使用base；共享模型权重W只有一套。'],['CPU加载与缩放折叠','Worker加载本地adapter到CPU。α/r折叠进B；后续Punica scale=1，不能再乘一次。'],['激活 GPU slots','把两套有效A/B写入GPU槽。这里选定合法的槽布局，不声称set遍历或LRU永远给固定槽号。'],['构造 Punica mapping','先按token行展开adapter ID，再映射为当前GPU slot。交换slot布局后indices必须同步改变。'],['共享 base linear','所有行使用同一个W，计算y0；adapter归属不会改变base矩阵。'],['LoRA shrink','按每行slot选择A，把in=2压到r=1；base行不应用LoRA。'],['LoRA expand','同一行使用同一adapter的B_scaled，从r=1扩回out=2。'],['逐行相加得到最终输出','共享base输出加各自adapter增量；R3增量为零。图中分开观察，真实expand可直接原位累加到y0。'],['交给下游层','还原请求分组查看输出。两种GPU槽位布局得到同样数值，adapter身份不等于slot编号。']];
      const active=[['requests','checkpoints'],['checkpoints','cpu'],['cpu','slots'],['requests','slots','mapping'],['input','base'],['input','slots','mapping','shrink'],['shrink','slots','mapping','expand'],['base','expand','output'],['output','consumer']];
      return {scope:'vLLM '+SHA.slice(0,10)+'；GPU MRV1，TP=PP=DP=1，单层ReplicatedLinearWithLoRA、无量化、bias=0、同步调度；enable_lora，max_loras=2，max_cpu_loras≥2。教学rank=1、in=out=2；真实GPU槽可按max_lora_rank补齐，图中只展示有效元素，不把小矩阵尺寸当真实kernel性能或显存占用。',
        nodes:[nd('requests','请求与adapter选择','CPU · Scheduler/Worker',0,0),nd('checkpoints','两个adapter文件','存储',0,1),nd('cpu','CPU adapter缓存','CPU DRAM',1,0,2),nd('slots','GPU adapter slots','GPU HBM',1,1,3),nd('mapping','Punica token/slot mapping','CPU → GPU 控制元数据',2,0,4),nd('input','输入X与共享W','GPU HBM',2,1),nd('base','共享base linear','GPU',3,0,5),nd('shrink','按adapter shrink','GPU',3,1,6),nd('expand','按adapter expand','GPU',4,1,7),nd('output','y0 + Δy','GPU',4,0,8),nd('consumer','下游层/请求行','GPU · 消费者',5,0,9)],edges,
        steps:texts.map(([title,summary],i)=>({title,summary,activeNodes:active[i],activeEdges:edges.filter(e=>e.steps.includes(i+1)).map(e=>e.id),state:state(i+1),tables:[mappingTable(i+1),...(i>=1?[weightsTable]:[]),matrixTable(i+1)],equation:i>=4?'yᵢ = xᵢWᵀ + (xᵢA_adapter(i)ᵀ)B_scaled,adapter(i)ᵀ；base行Δy=0。':'B_scaled = (α/r)·B；运行时scale=1。',notes:['不同adapter的权重和行映射必须配对；只交换slot权重却不更新indices会把增量加错行。','JS矩阵为独立教学演算，未执行GPU/Punica kernel。控制ID传递与权重张量复制分别标注。']})),
        metrics:[{label:'请求',value:3},{label:'token行',value:4},{label:'adapter / GPU槽',value:'2 / 2'}],tables:[mappingTable(9),weightsTable,matrixTable(0)],plots:[],notes:['CPU cache容量与GPU active slots是两层资源；此页不模拟LRU驱逐时序。','实际LoRA路径包含shape补齐、dtype与kernel约束；算例保留有效矩阵语义。'],audit:{scenario,X,W,adapters,rows,slots,tokenIds,slotIndices,y0,shrink,delta,Y}
      };
    },sources:[{label:'Runner激活LoRA与映射',url:base+'vllm/v1/worker/lora_model_runner_mixin.py#L83'},{label:'CPU加载与GPU激活',url:base+'vllm/lora/worker_manager.py#L289'},{label:'adapter到slot',url:base+'vllm/lora/model_manager.py#L350'},{label:'Punica shrink/expand',url:base+'vllm/lora/punica_wrapper/punica_gpu.py#L206'},{label:'缩放折叠到B',url:base+'vllm/lora/lora_weights.py#L37'}],related:[{label:'批处理',href:'../batching/index.html'},{label:'模型架构',href:'../model-architecture/index.html'}]
  };
})();
