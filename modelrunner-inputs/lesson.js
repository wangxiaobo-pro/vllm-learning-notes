/* Pure teaching data; fixed GPU MRV1 source, no GPU execution. */
window.LESSON = {
  title: 'ModelRunner：持久批次怎样变成模型输入',
  subtitle: '从请求加入、退出和压紧，到 packed tokens、位置、块表和 slot；再追踪采样回写。',
  kind: '框架机制',
  controls: [{id:'scenario',label:'场景',type:'select',value:'normal',options:[
    {value:'normal',label:'A/B 常驻，C 加入'},
    {value:'change',label:'下一轮 B 结束，C 压紧'}
  ]}],
  build(params) {
    const change = params.scenario === 'change';
    const blockSize = 4;
    const arr = x => '[' + x.map(v => v === null ? '空' : v).join(', ') + ']';
    const base = {
      A:{id:'A',tokens:[11,12,13,14],computed:2,count:2,blocks:[2],sample:15},
      B:{id:'B',tokens:[21,22,23,24,25],computed:4,count:1,blocks:[5,7],sample:26},
      C:{id:'C',tokens:[31,32,33],computed:0,count:3,blocks:[9],sample:34}
    };
    const initial = change ? ['A','B','C'] : ['A','B'];
    if (change) {
      for (const req of Object.values(base)) {
        req.tokens.push(req.sample);
        req.computed += req.count;
        req.count = 1;
      }
      base.A.blocks.push(6);
      base.A.sample = 16;
      base.C.sample = 35;
    }
    const holes = change ? ['A',null,'C'] : ['A','B'];
    const order = change ? ['A','C'] : ['A','B','C'];
    const reqs = order.map(id => base[id]);
    const starts = [0];
    for (const req of reqs) starts.push(starts.at(-1) + req.count);
    const packed = reqs.flatMap((req,row) => Array.from({length:req.count}, (_,local) => {
      const position = req.computed + local;
      const block = req.blocks[Math.floor(position / blockSize)];
      return {index:starts[row]+local,id:req.id,row,local,token:req.tokens[position],position,
        logical:Math.floor(position/blockSize),block,offset:position%blockSize,
        slot:block*blockSize+position%blockSize};
    }));
    const ids = packed.map(x=>x.token), positions = packed.map(x=>x.position);
    const slots = packed.map(x=>x.slot), seqLens = reqs.map(x=>x.computed+x.count);
    const logits = starts.slice(1).map(x=>x-1);
    const samples = reqs.map(x=>x.sample);
    const rowText = ids => ids.map((id,i)=>`${i}:${id === null ? '空' : id}`).join(' · ');
    const rowTable = (title, ids, appended=false, beforeUpdate=false) => ({title,headers:['行','请求','已知 token IDs','CPU computed','块表'],rows:ids.map((id,i)=>id === null ? [i,'空','—','—','—'] : [i,id,arr(appended ? [...base[id].tokens,base[id].sample] : base[id].tokens),beforeUpdate&&change?{A:2,B:4,C:0}[id]:base[id].computed,arr(beforeUpdate&&change&&id==='A'?[2]:base[id].blocks)])});
    const inputTable = {title:'本轮 SchedulerOutput（教学输入）',headers:['请求','scheduled tokens','computed 输入','新分配 block IDs'],rows:reqs.map(r=>[r.id,r.count,r.computed,change && r.id==='A'?'[6]':r.id==='C'&&!change?'[9]':'[]'])};
    const packingTable = {title:'逐 token 打包与物理槽',headers:['packed 下标','请求/行','token ID','position','逻辑块','物理块','块内偏移','slot'],rows:packed.map(x=>[x.index,`${x.id}/${x.row}`,x.token,x.position,x.logical,x.block,x.offset,x.slot])};
    const cpuPackingTable = {title:'CPU gather 结果（slot 尚未计算）',headers:packingTable.headers.slice(0,4),rows:packingTable.rows.map(row=>row.slice(0,4))};
    const offsetTable = {title:'批次元数据',headers:['字段','值','消费者'],rows:[
      ['query_start_loc',arr(starts),'Attention metadata / slot mapping'],
      ['seq_lens',arr(seqLens),'Attention backend'],
      ['logits_indices',arr(logits),'hidden_states → logits'],
      ['input_ids',arr(ids),'模型 embedding'],
      ['positions',arr(positions),'模型位置编码 / slot mapping'],
      ['slot_mapping',arr(slots),'KV cache 写入']
    ]};
    const pendingSlotTable = {...offsetTable,title:'打包元数据（slot 尚未计算）',rows:offsetTable.rows.filter(row=>row[0]!=='slot_mapping')};
    const outputTable = {title:'采样后的持久状态',headers:['请求','采样 ID（给定）','num_tokens_no_spec','num_computed_tokens_cpu','输出 IDs 追加'],rows:reqs.map(r=>[r.id,r.sample,r.tokens.length+1,r.computed,arr([r.sample])])};
    const nodes = [
      {id:'schedule',title:'① SchedulerOutput',lane:'CPU · 调度器→Worker',row:0,col:0,readyAt:0,detail:`顺序待重建；${reqs.map(r=>r.id+':'+r.count).join('、')} tokens`},
      {id:'cache',title:'② CachedRequestState',lane:'CPU · 请求字典',row:0,col:1,readyAt:0,detail:`请求缓存与批次行是两种状态；初始 ${initial.join('/')}`},
      {id:'batch',title:'③ InputBatch 持久行',lane:'CPU · 固定容量缓冲',row:1,col:0,readyAt:0,detail:rowText(initial)},
      {id:'packed',title:'④ 当前迭代的紧凑输入',lane:'CPU · gather',row:1,col:1,readyAt:4,detail:`IDs=${arr(ids)}；positions=${arr(positions)}`},
      {id:'device',title:'⑤ GPU 输入与块表',lane:'GPU · device buffers',row:2,col:0,readyAt:5,detail:`query_start_loc=${arr(starts)}；块表与行序 ${order.join('/')}`},
      {id:'slot',title:'⑥ GPU slot_mapping',lane:'GPU · Triton kernel',row:2,col:1,readyAt:6,detail:arr(slots)},
      {id:'consumer',title:'⑦ 模型与 Attention 消费者',lane:'GPU · eager',row:3,col:0,readyAt:7,detail:'IDs→embedding；positions→位置编码；块表→KV读；slot→KV写'},
      {id:'output',title:'⑧ 采样与持久状态回写',lane:'GPU→CPU · 同步路径',row:3,col:1,readyAt:8,detail:`给定 sample IDs=${arr(samples)}；稍后写回 token 行`}
    ];
    const edges = [
      {id:'s-cache',from:'schedule',to:'cache',label:'① finished / new / cached 请求增量',steps:[1,2]},
      {id:'c-batch',from:'cache',to:'batch',label:'②③ token 行、computed、block IDs',steps:[2,3]},
      {id:'s-pack',from:'schedule',to:'packed',label:'④ 按当前批次行重排 scheduled counts',steps:[4]},
      {id:'b-pack',from:'batch',to:'packed',label:'④ computed+局部下标 → gather token IDs',steps:[4]},
      {id:'b-dev',from:'batch',to:'device',label:'⑤ block table CPU→GPU；不是 KV 张量复制',steps:[5]},
      {id:'p-dev',from:'packed',to:'device',label:'⑤ input IDs / query offsets；positions 在 GPU 重建',steps:[5]},
      {id:'d-slot',from:'device',to:'slot',label:'⑥ query offsets + positions + block table',steps:[6]},
      {id:'d-model',from:'device',to:'consumer',label:'⑦ IDs/positions 与 Attention metadata',steps:[7]},
      {id:'slot-model',from:'slot',to:'consumer',label:'⑦ 每个 token 的 KV 写入地址',steps:[7]},
      {id:'m-out',from:'consumer',to:'output',label:'⑧ logits → sample_tokens；execute 先保存中间状态',steps:[8]},
      {id:'out-batch',from:'output',to:'batch',label:'⑨ sampled ID 追加到 CPU token 行',steps:[9]},
      {id:'out-cache',from:'output',to:'cache',label:'⑨ output_token_ids 追加；computed 等下一轮调度输入',steps:[9]}
    ];
    const persistent = (phase, done=false) => ({
      cache:change?'B 已完成时从 requests 删除；A/C 的缓存保留。':'A/B 缓存保留；C 由新请求元数据构造。',
      batch:rowText(phase)+(done?`；已追加 ${arr(samples)}，computed 仍为 ${arr(reqs.map(r=>r.computed))}`:''),
      ...(done?{output:`回写完成；num_tokens_no_spec=${arr(reqs.map(r=>r.tokens.length+1))}；computed 未在此增加。`}:{})
    });
    const step = (title,summary,activeNodes,activeEdges,state,tables,equation,notes=[]) => ({title,summary,activeNodes,activeEdges,state,tables,equation,notes});
    const steps = [
      step('接收本轮调度增量',change?'前一轮已采样 A=15、B=26、C=34。调度器反馈 computed，并宣布 B 完成；初始 CPU 行还未应用此增量。':'A/B 已在持久批次，C 本轮加入；调度器给出各请求本轮 token 数。',['schedule','cache'],['s-cache'],{batch:rowText(initial),cache:`初始缓存：${initial.join('/')}`},[inputTable,rowTable('初始持久批次',initial,false,true)]),
      step(change?'移除 B，暂留空行':'接收 C，保留 A/B',change?'remove_request 删除 B 的行索引并清空该块表行；物理 KV 块释放属于 Scheduler。':'构造 C 的 CachedRequestState；旧请求保留缓存与行。本场景没有删除请求。',['cache','batch'],['s-cache','c-batch'],persistent(holes),[inputTable,rowTable('加入/移除后的中间行',holes)],undefined,['未被本轮调度的请求也可从 InputBatch 移除，但 requests 缓存仍保留；这与 finished 的删除不同。']),
      step(change?'压紧：C 从行 2 移到行 1':'加入 C，形成连续三行',change?'condense 将最后活动行 C 搬入 B 的空位；tokens、computed 和块表同行移动。A 本轮收到新块 6。':'add_request 把 C 写入行 2；condense 检查后没有空洞。后续 scheduled counts 按这个行序读取。',['cache','batch'],['c-batch'],persistent(order),[rowTable('压紧后的 CPU 批次',order)]),
      step('计算 offsets、positions 并 gather',`本轮共 ${ids.length} 个 token。query_start_loc 的相邻差等于各请求 scheduled counts。`,['schedule','batch','packed'],['s-pack','b-pack'],{...persistent(order),packed:`IDs=${arr(ids)}；positions=${arr(positions)}；query_start_loc=${arr(starts)}`},[cpuPackingTable,pendingSlotTable],`position = computed[row] + local；query_start_loc = [0, cumsum(counts)]`),
      step('提交 GPU 缓冲与块表','commit_block_table 传块号元数据；输入 IDs 复制到 GPU，positions/seq_lens 由已有 GPU 缓冲与本轮计数更新。',['packed','batch','device'],['b-dev','p-dev'],{...persistent(order),device:`IDs=${arr(ids)}；positions=${arr(positions)}；query_start_loc=${arr(starts)}；seq_lens=${arr(seqLens)}`},[pendingSlotTable,rowTable('用于本轮 GPU 块表的行',order)],undefined,['图按数据依赖组织，部分源码语句合并到同一阶段；block_table.commit 位于 _prepare_inputs 开头，_prepare_input_ids 的调用则在 slot mapping 调用之后。']),
      step('把逻辑位置转换成物理 slot','每个请求用自己的块表行；相同 position 并不意味着使用相同物理地址。',['device','slot'],['d-slot'],{...persistent(order),slot:`slot_mapping=${arr(slots)}`},[packingTable],`slot = block_table[row][floor(position/${blockSize})] × ${blockSize} + position % ${blockSize}`),
      step('交给模型与 Attention','模型消费 input_ids/positions；Attention metadata 携带 query offsets、seq_lens、block table 和 slot mapping。读 KV 用块表，写 KV 用 slot。',['device','slot','consumer'],['d-model','slot-model'],{...persistent(order),consumer:`${order.join('/')} 的 metadata 对齐；logits_indices=${arr(logits)} 选每个请求本轮最后一行 hidden state。`},[offsetTable],`logits_indices = query_start_loc[1:] − 1`),
      step('execute 返回续点，再采样','execute_model 保存 ExecuteModelState 并返回 None；独立的 sample_tokens 继续消费 logits。本页采样 ID 是给定教学输出。',['consumer','output'],['m-out'],{...persistent(order),output:`给定 sampled IDs=${arr(samples)}；尚未显示为下一轮已计算 token。`},[{title:'给定采样结果',headers:['请求','sampled ID'],rows:reqs.map(r=>[r.id,r.sample])}],undefined,['未计算模型权重、Attention 数值或真实采样概率。']),
      step('同步 bookkeeping 回写','追加 sampled IDs 和 output_token_ids，更新 num_tokens_no_spec。num_computed_tokens_cpu 此处不前移；下一轮 _update_states 接收调度器的权威值。',['output','batch','cache'],['out-batch','out-cache'],persistent(order,true),[outputTable,rowTable('回写后的 CPU token 行',order,true)])
    ];
    return {scope:'vLLM 295c062db8 · GPU MRV1 · 单卡 TP/PP/CP=1 · eager · 同步调度 · 普通文本与 FullAttention；无推测解码/LoRA/连接器。行序固定为本例未触发后端重排的顺序。block=4 是缩放教学尺寸，不是可直接运行的 GPU backend 配置。',nodes,edges,steps,
      metrics:[{label:'请求行',value:order.join(' → ')},{label:'本轮 token 数',value:ids.length},{label:'query_start_loc',value:arr(starts)},{label:'教学 block size',value:blockSize+' tokens'}],
      tables:[packingTable,offsetTable,outputTable],plots:[],notes:['GPU 块表只含地址元数据；KV tensor 保留在设备缓存中。','InputBatch 行号会改变，请求 ID 才是请求身份。','normal 与 change 是相邻两轮的教学快照；采样 ID 由本页给定，非实测。']};
  },
  sources:[
    {label:'GPUModelRunner：更新、打包与采样回写',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/worker/gpu_model_runner.py#L1195'},
    {label:'InputBatch：行加入、退出与压紧',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/worker/gpu_input_batch.py#L347'},
    {label:'BlockTable：slot mapping kernel',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/worker/block_table.py#L415'}
  ],
  related:[{label:'Scheduler',href:'../scheduler/index.html'},{label:'PagedAttention',href:'../paged-attention/index.html'},{label:'混合 KV 管理',href:'../hybrid-kv-cache/index.html'}]
};
