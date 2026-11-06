(() => {
  const SHA = '295c062db8a48ea73bbd05d1174cb37d24bf86f9';
  const source = (path, line) => 'https://github.com/vllm-project/vllm/blob/' + SHA + '/' + path + '#L' + line;
  window.LESSON = {
    title:'异步调度：计划先行，token 稍后回报', subtitle:'用两个执行轮次区分 CPU 已知 token、输出占位、GPU 在途工作与真实完成。', kind:'框架机制',
    controls:[{id:'scenario',label:'执行方式',type:'select',value:'async',options:[{value:'async',label:'异步调度 · 两批在途'},{value:'sync',label:'同步调度 · 先回报再计划'}]}],
    build(params) {
      const scenario = params.scenario || 'async';
      if (!['async','sync'].includes(scenario)) throw new Error('未知执行方式');
      const async = scenario === 'async', prompt = [7,8,9], results = [11,22], counts = [3,1];
      const s = {knownIds:[...prompt],planned:[],acked:[],deviceDone:[],gpuTokens:[],workerCpuOutput:[],placeholders:0,computed:0,inflight:0,kvTokens:0,queue:[],status:'WAITING',released:false};
      const trace = [];
      const copy = () => JSON.parse(JSON.stringify(s));
      function plan(round) { s.planned.push(round); s.computed += counts[round-1]; s.inflight += counts[round-1]; if(async)s.placeholders++; s.status='RUNNING'; }
      function launch(round) { s.queue.push(round); if(async)s.workerCpuOutput.push(-1); }
      function device(round) { s.deviceDone.push(round); s.gpuTokens.push(results[round-1]); s.kvTokens += counts[round-1]; if(!async)s.workerCpuOutput.push(results[round-1]); }
      function accept(round) { s.acked.push(round); s.queue=s.queue.filter(r=>r!==round); s.inflight-=counts[round-1]; if(async)s.placeholders--; s.knownIds.push(results[round-1]); if(s.acked.length===2)s.status='FINISHED_LENGTH_CAPPED'; }
      const definitions = [
        ['请求到达','A 的 prompt 是 [7,8,9]，max_tokens=2。CPU/GPU 都尚未得到任何输出。',()=>{}],
        ['R1：调度3个输入','预记计算游标是资源计划，不等于3个输入已经在设备完成。',()=>plan(1)],
        ['R1：提交执行与采样','执行命令进入设备流；异步 Worker 的 CPU 影子先写 -1，真实 t1 尚未产生。',()=>launch(1)],
        [async?'R2：未回报也可计划1个输入':'等待 R1：尚不能计划 R2',async?'3个已知 token + 1个输出占位 − computed 3 = 1。CPU 只安排位置，不知道 t1 的值。R2 设备依赖必须等 R1 的真实采样值。':'同步配置没有输出占位；CPU 必须先收到 t1，才能知道下一轮的新输入。',()=>{if(async){plan(2);launch(2);}}],
        ['GPU 完成 R1：t1=11','设备此时才实际产生11；GPU 可把它用于下一轮输入。异步 D2H 拷贝尚不代表 Scheduler 已接收。',()=>device(1)],
        [async?'消费 R1 future，回写11':'收到11后，才计划并提交 R2',async?'Host 等待拷贝事件后读取真实 token；Scheduler 追加11，输出占位2→1，在途输入4→1。':'Scheduler 先追加11，随后安排 R2 输入11：computed 3→4；不存在猜测 token。',()=>{accept(1);if(!async){plan(2);launch(2);}}],
        ['GPU 完成 R2：输入11，采样22','R2 处理的是实际 token 11，不是 -1。KV 累计覆盖4个前向输入，22还没有自身 KV。',()=>device(2)],
        ['消费 R2 future，按长度结束','Scheduler 追加22；在途输入归零，异步占位归零。max_tokens=2，不再生成第三个输出。',()=>accept(2)],
        ['完成后清理','结束请求释放其逻辑 KV 占用；后续 Worker 更新消费 finished_req_ids，清除持久请求行。',()=>{s.released=true;s.status='已清理';s.workerCpuOutput=[];}]
      ];
      for (const [title,summary,action] of definitions) { action(); trace.push({title,summary,...copy()}); }
      const val = a => a.length ? '['+a.join(', ')+']' : '无';
      const details = t => ({
        request:'A · prompt '+val(prompt)+' · 已回报输出 '+val(t.knownIds.slice(prompt.length))+' · '+t.status,
        scheduler:'known='+t.knownIds.length+'，computed='+t.computed+'，in_flight='+t.inflight+'，output_placeholders='+t.placeholders,
        queue:'尚待消费的逻辑轮次 '+val(t.queue)+'；容量 '+(async?2:1)+'。未回报不等于设备没采样。',
        worker:'Worker CPU 输出影子 '+val(t.workerCpuOutput)+(async?'；-1 是影子占位，不能当模型输入。':'；同步结果按真实 ID 整理。'),
        gpu:'GPU 已产生输出 '+val(t.gpuTokens)+'；真实 KV 前向位置数='+t.kvTokens+'。尚未产生的 token 不显示数值。',
        copy:'已被 Scheduler 消费的轮次 '+val(t.acked)+'；D2H 完成通过事件同步后才可读 host token。',
        output:t.released?'两次输出 '+val(t.knownIds.slice(3))+' 已交付；请求占用释放。':'面向用户的已回报输出 '+val(t.knownIds.slice(3))
      });
      const table = t => ({title:'当前状态：计划、物理完成和已知输出分开',headers:['量','当前值','含义'],rows:[
        ['已知 token',val(t.knownIds),'只有已回报的真实 token'],['num_computed_tokens',t.computed,'调度预记的计算前沿'],['num_in_flight_tokens',t.inflight,'已计划但尚未回报的输入数'],['num_output_placeholders',t.placeholders,'预期输出数量，不是 token ID'],['已确认输入',t.computed-t.inflight,'已被结果更新消费的输入数'],['设备已完成 KV',t.kvTokens,'教学观察值，不由该计数直接得知'],['等待回报轮次',val(t.queue),async?'真实 batch_queue：oldest result 先消费':'同步逻辑观察：源码不建立 batch_queue'],['占用释放',t.released?'是':'否','物理字节可保留；逻辑引用已归还'] ]});
      const node = (id,title,lane,row,col,readyAt=0) => ({id,title,lane,row,col,readyAt,detail:details(trace[8])[id]});
      const edges = [
        {id:'admit',from:'request',to:'scheduler',label:'① 控制：请求 IDs / token 数 / max_tokens',steps:[1,2]},
        {id:'plan',from:'scheduler',to:'queue',label:'②④ 控制：SchedulerOutput / future',steps:[2,3,4,6]},
        {id:'dispatch',from:'queue',to:'worker',label:'③④ 控制：执行与采样调用',steps:[3,4,6]},
        {id:'input',from:'worker',to:'gpu',label:'③⑦ 数据：真实 input_ids / positions',steps:[3,5,7]},
        {id:'reuse',from:'gpu',to:'worker',label:'⑤⑦ 设备内：prev_sampled_token_ids → 下轮输入',steps:[5,7]},
        {id:'d2h',from:'gpu',to:'copy',label:'⑤⑦ 数据：采样 token D2H + ready event',steps:[5,7]},
        {id:'report',from:'copy',to:'scheduler',label:'⑥⑧ 回报：真实 token + 请求 ID',steps:[6,8]},
        {id:'emit',from:'scheduler',to:'output',label:'⑥⑧⑨ 输出与 finished_req_ids',steps:[6,8,9]}
      ];
      const active = [['request','scheduler'],['scheduler','queue'],['queue','worker','gpu'],async?['scheduler','queue','worker']:['scheduler','copy'],['gpu','worker','copy'],['copy','scheduler','output'],['gpu','copy'],['copy','scheduler','output'],['scheduler','worker','output']];
      return {
        scope:'vLLM '+SHA.slice(0,10)+'；GPU MRV1，TP=PP=DP=1，纯文本、普通全注意力、无推测解码/结构化输出/LoRA，KV充足、无抢占。'+(async?'async_scheduling=True，max_concurrent_batches=2。':'async_scheduling=False，单批同步回报。')+'逻辑观察点不表示等间隔时间；没有硬件测速。',
        nodes:[node('request','请求与已知 token','CPU · API',0,0),node('scheduler','Scheduler 持久计数','CPU · EngineCore',0,1),node('queue','执行 future 队列','CPU · EngineCore',1,0,2),node('worker','输入准备与 CPU 影子','CPU · Worker',1,1,3),node('gpu','前向 / KV / 真实采样','GPU · device stream',2,0,3),node('copy','异步拷贝完成事件','GPU → CPU',2,1,5),node('output','请求输出与清理','CPU · 消费者',3,0,6)], edges,
        steps:trace.map((t,i)=>({title:t.title,summary:t.summary,activeNodes:active[i],activeEdges:edges.filter(e=>e.steps.includes(i+1)).map(e=>e.id),state:details(t),tables:[table(t)],equation:i===3&&async?'next_inputs = known(3) + placeholders(1) − computed(3) = 1':i===7?'有效前向输入 = 3 + 1 = 4；生成输出 = 2；最后输出22没有自身KV。':'',notes:[i===3&&async?'GPU2 可以排队，但在GPU1采样结果可用前不能使用未知 token；这不是并行算同一请求的两个依赖位置。':'Scheduler计数、Worker影子占位和设备真实字节属于不同状态。']})),
        metrics:[{label:'输出上限',value:2},{label:'计划队列容量',value:async?2:1},{label:'观察点',value:9}],tables:[table(trace[0])],plots:[],notes:['两种模式生成同样的教学 token [11,22]。这里不展示性能倍数或真实时间。','Scheduler 的输出占位是计数；Worker CPU 使用 -1 影子；GPU 输入始终必须是实际采样 ID。'],audit:{scenario,prompt,results,counts,trace}
      };
    },
    sources:[{label:'AsyncScheduler 占位与回写',url:source('vllm/v1/core/sched/async_scheduler.py',25)},{label:'EngineCore batch queue',url:source('vllm/v1/engine/core.py',684)},{label:'Worker 设备 token 续接',url:source('vllm/v1/worker/gpu_model_runner.py',1759)},{label:'异步 CPU 拷贝事件',url:source('vllm/v1/worker/gpu_model_runner.py',280)}],
    related:[{label:'Scheduler',href:'../scheduler/index.html'},{label:'请求生命周期',href:'../request-lifecycle/index.html'}]
  };
})();
