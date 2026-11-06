(() => {
  'use strict';
  const model={id:'deepseek_v41',name:'DeepSeek V4.1 Flash',subtitle:'40 层 CED · Engram · mHC · DSpark',summary:'从输入 token 到最终确认 token，沿真实 forward 拆开因果 Encoder / Decoder、条件记忆、稀疏 Attention 和草稿验证。点击组件继续深入；点击算子查看它收到什么、交给谁。',checked:'2026-11-05',revision:'vLLM-Ascend 94e3e25f836d79b5ee5c1aed257999ee61d10875；vLLM 295c062db8a48ea73bbd05d1174cb37d24bf86f9',root:'overview',stats:[{label:'层结构',value:'20 Encoder + 20 Decoder'},{label:'残差',value:'4 × 5120'},{label:'MoE',value:'384 选 6 + 1 shared'},{label:'草稿',value:'3 stages / 5 tokens'}],sources:[
    {id:'config',label:'官方 DeepSeek-V4.1-Flash config',url:'https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json'},
    {id:'card',label:'官方模型说明',url:'https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash'},
    {id:'model',label:'Ascend Model.forward / Layer.forward / MoE',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/deepseek_v41/model.py#L1514',local:'E:/code/vllm-ascend/vllm_ascend/models/deepseek_v41/model.py:1514–1617；Layer:887–928；MoE:264–330'},
    {id:'activation',label:'SwiGLU clamp：gate 上界与 up 双边界',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/model_executor/layers/activation.py#L207',local:'E:/code/vllm/vllm/model_executor/layers/activation.py:207–243；E:/code/vllm-ascend/vllm_ascend/models/deepseek_v41/model.py:106–148、205、253'},
    {id:'engram',label:'prepare_engram：历史哈希与记忆查表',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/deepseek_v41/model.py#L1125',local:'E:/code/vllm-ascend/vllm_ascend/models/deepseek_v41/model.py:1125–1232；1595–1600'},
    {id:'gate',label:'Engram 投影与残差门控',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/deepseek_v41/engram/common.py#L46',local:'engram/layer.py:23–57；engram/common.py:46–82'},
    {id:'attention',label:'Ascend DSA V4.1 Attention',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/attention/dsa_v41.py#L734',local:'E:/code/vllm-ascend/vllm_ascend/attention/dsa_v41.py:734–760 及压缩、索引、共享状态实现'},
    {id:'vision',label:'视觉编码、投影与占位 embedding 合并',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/deepseek_v41/vl_model.py#L117',local:'vl_model.py:117–143、179–209、266'},
    {id:'draft',label:'V4.1 DSpark backbone 与 Markov head',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/models/deepseek_v41/dspark.py#L143',local:'dspark.py:143–174、192–203、248–332、421–441'},
    {id:'speculator',label:'DSpark 顺序采样与草稿概率',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/worker/gpu/spec_decode/dspark/speculator.py#L158',local:'E:/code/vllm/vllm/v1/worker/gpu/spec_decode/dspark/speculator.py:158–197'},
    {id:'runner',label:'MRV2 目标 logits → rejection_sampler → postprocess',url:'https://github.com/vllm-project/vllm-ascend/blob/94e3e25f836d79b5ee5c1aed257999ee61d10875/vllm_ascend/worker/v2/model_runner.py#L1077',local:'worker/v2/model_runner.py:1077–1091、1182–1209；spec_decode/dspark/speculator.py:405–471'},
    {id:'verify',label:'接受前缀、恢复 token 与 bonus token',url:'https://github.com/vllm-project/vllm/blob/295c062db8a48ea73bbd05d1174cb37d24bf86f9/vllm/v1/sample/rejection_sampler.py#L726',local:'vllm/v1/sample/rejection_sampler.py:726–895；Ascend sample/rejection_sampler.py:150、387、729、1124'}
  ],components:{}};
  const C=model.components;
  const n=(id,label,detail,kind,col,row,target,description)=>({id,label,detail,kind,col,row,...target?{target}:{},description});
  const e=(from,to,label,step,optional=false)=>({from,to,label,step,optional});
  function put(id,title,parent,intro,inputs,outputs,nodes,edges,sources,notes=[]){
    const rows=[...new Set(nodes.map(x=>x.row))].sort((a,b)=>a-b);
    const steps=rows.map(r=>({title:nodes.filter(x=>x.row===r).map(x=>x.label).join(' / '),text:nodes.filter(x=>x.row===r).map(x=>x.description).join(' '),focus:nodes.filter(x=>x.row===r).map(x=>x.id)}));
    C[id]={title,parent,intro:[intro],inputs,outputs,nodes,edges,steps,sources,notes};
  }
  put('overview','完整 forward 与生成闭环',null,'两条数据线要分开读：蓝色主干传 hidden states；记忆与缓存支路提供额外输入。主模型 forward 结束后仍需 LM head 和外部采样；启用 DSpark 时，草稿必须经过主模型验证。','Runner 提供 input_ids [T]、positions [T]、请求边界与缓存元数据；可选图像 embedding；checkpoint 提供已加载参数。T 是本轮 token 数。','普通路径提交采样 token；DSpark 路径仅提交连续接受前缀与纠正 / bonus token。更新请求状态后，它们成为下一轮的 token 输入。',[
    n('input','文本与视觉嵌入','IDs / 图像 → h [T,5120]','tokens',0,0,'embedding','来自 tokenizer / runner 的 token IDs 查 embedding 权重；可选视觉向量替换对应图像占位，得到主干输入 h。'),
    n('memory','Engram 备料','IDs + 历史 → 查表向量','hash',1,0,'engram','prepare_engram 使用本轮 IDs、positions、请求边界及历史 lookback 生成 n-gram 哈希，读取 L1/L14 的学习记忆表；结果留给对应层注入。'),
    n('expand','展开四路残差','h → H [T,4,5120]','streams',0,1,'mhc','输入 h 复制到四路 residual，初始 pre_mix=[1,0,0,0]；H 与系数一起交给 L0。'),
    n('encoder','Causal Encoder ×20','L0–19 → Henc','stack',0,2,'encoder','L0–19 顺序更新四路 residual；L1/L14 在 block 前加入门控 Engram。最终 Henc 和 ffn_pre 交给 L20，不是独立双向编码器。'),
    n('decoder','Decoder ×20','L20–39 → Hfinal / aux','stack',0,3,'decoder','L20 用 Encoder 末端残差经 hc_pre / RMSNorm 生成共享全局 KV；后续层读取它和各自 SWA。启用草稿时采集 L37/38/39 的入口残差均值。'),
    n('head','折叠、Norm 与 LM head','Hfinal → hidden → logits','logits',0,4,'head','最后 pre_mix 加权折叠四路残差并 RMSNorm；forward 返回 hidden，runner 再调用 compute_logits 得到目标分布。'),
    n('anchor','上轮已确认请求状态','anchor / positions / 有效长度','state',2,0,'verification','首次起草的 anchor 来自目标模型已采样的 token；后续来自上轮接受前缀末尾的纠正或 bonus token。Runner 保存并对齐这个 ID 与有效位置，分别交给草稿器和目标验证。'),
    n('draft','DSpark 草稿生成','aux + anchor → 5 候选','draft',1,4,'dspark','草稿器把主模型选定层的 aux 与 anchor token 送入独立三阶段网络和 Markov head，产生候选 IDs 与草稿概率；它们尚未获准输出。'),
    n('sampling','普通采样','未启用草稿：logits → ID','sample',0,5,'head','未启用投机解码时，外部 sampler 根据目标 logits 与采样参数得到新 token，交给请求状态更新。'),
    n('verification','主模型验证','候选 → target forward → 接受','verify',1,5,'verification','下一轮目标模型处理草稿位置，目标 logits 与 draft IDs / q 一起进入 rejection sampler；只保留连续接受前缀，并生成纠正或 bonus token。'),
    n('commit','提交与进入下一轮','确认 IDs / 长度 / 有效 KV','state',0,6,'verification','Runner 更新请求的已确认 token、采样 / 拒绝计数及有效缓存长度；被拒绝后缀不成为后续可见上下文。确认 token 再作为下一轮输入。')
  ],[e('input','expand','h [T,5120]',2),e('input','memory','原始 IDs（不是 embedding）',1,true),e('expand','encoder','H [T,4,5120] + pre_mix',3),e('memory','encoder','L1/L14 的查表向量 + mask',3,true),e('encoder','decoder','Henc + 上一层 ffn_pre',4),e('decoder','head','最后 H + ffn_pre',5),e('decoder','draft','L37/38/39 入口 aux',5,true),e('anchor','draft','已确认 anchor + positions / 有效长度',5,true),e('anchor','verification','验证起点与有效历史',6,true),e('commit','anchor','下一轮已确认 anchor / 长度',1,true),e('head','sampling','目标 logits；普通路径',6),e('draft','verification','候选 IDs + draft q',6,true),e('sampling','commit','新 token ID',7),e('verification','commit','accepted IDs + correction / bonus',7,true),e('commit','input','下一轮 IDs / positions / 长度',1)],['config','model','engram','runner','draft','verify'],['以下形状是未切分 TP 的逻辑形状；T=8 仅用于部分图示例。源码静态分析，不代表运行延迟或 NPU 性能。','本地 forward 实际遍历全部 40 层；这里不把论文中的潜在裁剪描述成已执行的 encoder-only 优化。']);
  put('embedding','输入是怎样进入模型的','overview','token IDs 与 embeddings 是不同数据：IDs 还要保留给 Engram 哈希和 MoE 文本 / 图像路由；只有 embeddings 进入残差主干。','Tokenizer / runner 的 input_ids [T]；checkpoint embedding 表；可选视觉处理器输出的图像张量及占位位置。','融合 embedding h [T,5120] → 四路展开；原始 IDs → prepare_engram 和各层 MoE；positions / 请求元数据 → Attention 与哈希。',[
    n('ids','原始 token IDs','input_ids [T]','tokens',0,0,null,'文本经 tokenizer，runner 按本轮请求打包 ID；它既是 embedding 行索引，也是后续 Engram 与路由的原始输入。'),
    n('weight','Embedding 权重','checkpoint → E [V,5120]','cache',1,0,null,'模型加载阶段从 checkpoint 取得 embedding 矩阵 E；forward 只查行，不重新训练或更新该表。'),
    n('lookup','文本查表','E[input_ids] → [T,5120]','gather',0,1,null,'用 IDs 在已加载 E 中逐行 gather 得到文本 embedding；交给可选多模态合并或直接进入主干。'),
    n('vision','可选视觉编码','ViT ×32 → Aligner','vision',1,1,'vision','图像处理器的像素 / patch 输入视觉塔，输出投影到 5120 维的视觉 embedding，供占位替换。'),
    n('merge','按占位合并','文本 + 视觉 → h','sum',0,2,null,'根据原始 ID 中的图像占位位置，把对应文本查表向量替换为视觉向量；纯文本时直接使用文本 embedding。'),
    n('expand','四路 residual','[T,5120] → [T,4,5120]','streams',0,3,'mhc','模型接收 inputs_embeds 或自己查表，然后将 h 展开四路送入 L0；原始 input_ids 仍保留给非 embedding 分支。'),
    n('raw','IDs 的另两位消费者','Engram / MoE modality bias','hash',1,3,'engram','同一份原始 ID 进入 Engram 的 n-gram 哈希；每层 MoE 也用它识别文本 / 图像 token 以选路由偏置。')
  ],[e('ids','lookup','行索引 IDs',2),e('weight','lookup','已加载权重 E',2),e('lookup','merge','text embeddings',3),e('vision','merge','视觉 embeddings + 占位位置',3,true),e('merge','expand','融合 h [T,5120]',4),e('ids','raw','原始 IDs，无需反推 embedding',4)],['model','vision','engram']);
  put('vision','视觉编码与文本合并','embedding','视觉 Encoder 与语言模型中的 Causal Encoder 是两个不同组件。视觉向量在语言主干之前合并，不是直接输出文本。','图像预处理器产生像素 / patch 张量及图像尺寸；checkpoint 的视觉塔 / Aligner 参数；文本 embedding 与图像占位。','对齐的视觉 embeddings → embedding 合并；合并后的 [T,5120] → 语言模型 L0。',[
    n('image','图像处理器输出','像素 / patches + 尺寸','vision',0,0,null,'上游多模态处理器准备图像张量和尺寸元数据，交给 vision encoder。'),
    n('vit','视觉 Transformer ×32','图像 patches → 视觉特征','stack',0,1,null,'视觉塔使用已加载视觉权重处理 patch 序列，输出视觉 hidden features 给 Aligner。'),
    n('align','Aligner','视觉宽度 → 5120','gather',0,2,null,'Aligner 将视觉特征投影到语言 hidden 宽度5120，并按实际图像 span 组织向量。'),
    n('text','文本与占位','IDs + text embeddings','tokens',1,2,null,'文本查表分支提供文本向量；图像占位 ID 与 span 告诉合并函数视觉向量放到哪几个位置。'),
    n('merge','合并输入序列','位置对齐 → inputs_embeds','sum',0,3,'embedding','merge_multimodal_embeddings 在图像占位上写入视觉向量，保持其他文本位置；结果交给语言主干。')
  ],[e('image','vit','pixel / patch tensors',2),e('vit','align','视觉 hidden features',3),e('align','merge','对齐视觉 embeddings',4),e('text','merge','文本 embeddings + 占位 mask',4)],['vision','config']);
  put('encoder','进入 Causal Encoder：L0–19','overview','这是 CED 的前 20 个因果层，仍受因果约束。下图按 KV / TopK 的共享组画出顺序；每一层内部都有 mHC、Attention 和 MoE。','Embedding 展开的 H [T,4,5120] 与初始 pre_mix；positions、原始 IDs；可选 L1/L14 Engram 查表结果；各层历史 SWA。','L19 的 Henc [T,4,5120] 和 ffn_pre → L20 Decoder；Encoder 各自的缓存供所属层后续调用使用。',[
    n('l0','L0：窗口 Attention','仅 SWA → MoE','stack',0,0,'block','L0 接收初始 H/pre_mix，仅使用自己的 SWA，完成 Attention 与 MoE 后，将 H 交给 L1 前的 Engram 注入，ffn_pre 原样传给 L1。'),
    n('memory','预先准备的 Engram','lookups[1/14] + 有效 mask','hash',1,0,'engram','prepare_engram 从本轮与历史 IDs 查训练记忆表，产生两层各自的 lookup 向量及有效 token mask；到达 L1/L14 入口时，与当时的 H 一起消费。'),
    n('eng1','L1 前注入 Engram','lookup[1] + L0 输出 H','hash',1,1,'engram','模型循环在调用 L1 block 前，取 lookup[1] 与 L0 输出 H 计算 gate，将记忆加回 residual 后交给 L1；未启用 Engram 时此处直接透传 H。'),
    n('l1','L1：窗口 Attention','仅 SWA → MoE','stack',0,1,'block','L1 接收经过可选 Engram 更新的 residual，仍只做窗口 Attention；输出交给 L2。'),
    n('g2','L2–7：压缩组一','L2 生产 C2 KV / TopK','stack',0,2,'sharing','L2 从自己的规范化 hidden 生成 C2 长程 KV 与 TopK；L3–7 复用它们，每层保留各自 SWA、Q、mHC 与 MoE。'),
    n('g8','L8–13：压缩组二','L8 生产 C2 KV / TopK','stack',0,3,'sharing','L8 重新从当前 hidden 生成本组 C2 KV / TopK，L9–13 复用；残差仍逐层顺序更新。'),
    n('eng14','L14 前注入 Engram','lookup[14] + L13 输出 H','hash',1,4,'engram','L13 输出 H 与 lookup[14] 参与门控，注入后的 H 再进入 L14 hc_pre；未启用 Engram 时此处直接透传 H，ffn_pre 不由 Engram 修改。'),
    n('g14','L14–19：压缩组三','L14 生产 C2 KV / TopK','stack',0,4,'sharing','L14 产生本组 C2 KV / TopK，L15–19 复用；完成 L19 后交出 Henc 与 ffn_pre。'),
    n('out','交给 Decoder L20','Henc + ffn_pre','streams',0,5,'decoder','Encoder 末端四路残差不会直接当 KV；L20 先做自己的 hc_pre 和 RMSNorm，才生成 Decoder 共享长程 KV。')
  ],[e('l0','eng1','L0 输出 H [T,4,5120]',2),e('memory','eng1','lookup[1] + 有效 mask',2,true),e('l0','l1','原样传递 ffn_pre [T,4]',2),e('eng1','l1','注入后 H；未启用则透传 H',2),e('l1','g2','H1 + ffn_pre',3),e('g2','g8','L7 输出 H + ffn_pre',4),e('g8','eng14','L13 输出 H [T,4,5120]',5),e('memory','eng14','lookup[14] + 有效 mask',5,true),e('g8','g14','原样传递 L13 ffn_pre',5),e('eng14','g14','注入后 H；未启用则透传 H',5),e('g14','out','L19 输出 Henc + ffn_pre',6)],['config','model','attention','engram']);
  put('decoder','进入 Decoder：L20–39','overview','全局 KV 来源与当前 Q 来源不同：L20 创建长期共享 KV；后续层用各自当前 hidden 生成 Q。每 4 层重算一次 TopK，各层 SWA 始终独立。','L19 输出 Henc + ffn_pre；本轮 positions；各层独立 SWA 历史；请求的 L20 长程 KV 历史；采样 / DSpark 配置。','L39 输出 Hfinal + ffn_pre → 最终折叠 / Norm；可选 L37/38/39 入口均值 → DSpark；共享 KV 留待后续轮次读取。',[
    n('l20','L20：建立全局记忆','hc_pre / Norm → C1 KV','stack',0,0,'attention','L20 先混合 Henc 并 RMSNorm，再投影 C1 长程 KV / index K；同时建立全局候选块和本组 Top512，完成本层 Attention / MoE。'),
    n('cache','L20 的共享长期 KV','每 token 一个 latent','cache',1,0,'sharing','L20 当前写入与请求历史组成全局 KV；L20–39 用 TopK 位置读取它，不能把索引位置误当 KV 向量。'),
    n('g20','L21–23：复用组','KV 源20 / TopK 源20','stack',0,1,'block','各层从当前 H 生成自己的 Q 与 SWA，读取 L20 KV 和 TopK，层间继续传递 residual 与 pre_mix。'),
    n('g24','L24–27：重查候选','KV 源20 / TopK 源24','stack',0,2,'sharing','L24 在 L20 候选块内用当前 index Q 重新选 Top512；L25–27 复用这些位置，长期 KV 仍来自 L20。'),
    n('g28','L28–31：重查候选','KV 源20 / TopK 源28','stack',0,3,'sharing','L28 重算 TopK，L29–31 复用；每层的 hidden、Q、SWA 与 MoE 输出独立变化。'),
    n('g32','L32–35：重查候选','KV 源20 / TopK 源32','stack',0,4,'sharing','L32 重算 TopK，L33–35 复用；残差顺序交给后续层。'),
    n('g36','L36–39：最后一组','KV 源20 / TopK 源36','stack',0,5,'block','L36 重算 TopK，L37–39 复用。可选 aux 在选定层的入口记录，即执行该层 block 之前。'),
    n('aux','DSpark 的特征旁路','入口 L37/38/39：mean(H,1)','draft',1,5,'dspark','将三个入口的四路 residual 分别沿 hc 维取均值，得到三个 [T,5120]，拼接后供草稿 main_proj 使用。'),
    n('out','主干最终输出','Hfinal + 最后 ffn_pre','streams',0,6,'head','L39 完成 MoE hc_post 后返回 Hfinal 与最后 ffn_pre，送入加权 collapse 和最终 Norm。')
  ],[e('l20','cache','C1 latent + index K / 候选块',1),e('l20','g20','H20 + ffn_pre',2),e('cache','g20','长程 KV / TopK20',2),e('g20','g24','L23 H + pre_mix',3),e('cache','g24','长程 KV + index K / 候选块',3),e('g24','g28','L27 H + pre_mix',4),e('cache','g28','长程 KV + index K / 候选块',4),e('g28','g32','L31 H + pre_mix',5),e('cache','g32','长程 KV + index K / 候选块',5),e('g32','g36','L35 H + pre_mix',6),e('cache','g36','长程 KV + index K / 候选块',6),e('g36','aux','选定入口 residual 的均值',6,true),e('g36','out','L39 H + ffn_pre',7)],['model','attention','draft'],['aux 表示读取层入口残差，并非 L37/38/39 block 的输出；图中的旁路从层组连接仅表示该组中发生的采集。']);
  // Preserve the checked layer and attention order from the earlier illustration.
  function legacy(id,old,title,parent,intro,inputs,outputs,targets,descriptions,sources){
    const g=window.ARCH_V41_LEGACY[old];
    const kinds={hin:'streams',apre:'gather',attn:'attention',apost:'streams',fpre:'gather',ids:'tokens',route:'router',experts:'experts',shared:'shared',sum:'sum',fpost:'streams',x:'tokens',q:'gather',swa:'cache',comp:'cache',iq:'selection',ik:'cache',top:'selection',sparse:'attention',out:'scatter'};
    C[id]={title,parent,intro:[intro],inputs,outputs,notes:[],sources,nodes:g.nodes.map(v=>n(v.id,v.lines[0].replace(/^[①-⑨]\s*/,''),v.lines.slice(1).join(' · '),kinds[v.id]||'tokens',v.col,v.row,targets[v.id],descriptions[v.id])),edges:g.edges.map(v=>e(v.a,v.b,v.label.replace(/^[①-⑨]\s*/,''),v.step,v.optional)),steps:g.steps.map((s,i)=>({title:`第 ${i+1} 步`,text:s.at(-1),focus:s.slice(0,-1)}))};
  }
  legacy('block','block','一个语言 block 的内部','encoder','L0–39 都经过两次 mHC、一次 Attention 和一次 MoE；Attention 的 KV / 索引来源由层号决定。这里展开通用 block，Attention 子页面以 L20 为具体实例。','上一层 H [T,4,5120] + pre_mix；原始 IDs；positions 与缓存上下文；本层 mHC / Attention / MoE 权重。','更新的 H [T,4,5120] 与 ffn_pre → 下一层；最后一层的 ffn_pre 用于最终 collapse。',{apre:'mhc',attn:'attention',apost:'mhc',fpre:'mhc',route:'moe',experts:'expert',shared:'expert',sum:'moe',fpost:'mhc'}, {
    hin:'上一层产生四路 H 和下一子层所用 pre_mix；它们送入 Attention hc_pre，H 同时保留为 residual 分支。',
    apre:'使用传入 pre_mix 将 H 混为 [T,5120] 并 RMSNorm，交给 Attention；同时从当前 H 生成 post/comb 与延后给 FFN 用的 attn_pre。',
    attn:'归一化 hidden 生成本层 Q；Attention 按层号读取自己的 SWA 和对应源层长程 KV / TopK，投影输出 [T,5120] 给 hc_post。',
    apost:'用本次 post/comb 组合保留的四路 residual，并注入 Attention 输出，得到 H′ 给 FFN hc_pre。',
    fpre:'使用 Attention hc_pre 提前生成的 attn_pre 混合 H′，RMSNorm 准备专家输入及 FP32 router 输入；产生 ffn_pre 给下一层。',
    ids:'模型入口保留的原始 IDs 送到本层 MoE，用来选择文本 / 图像路由偏置；它不是从 hidden 反解出来的。',
    route:'归一化 FP32 hidden 经 router 权重产生384个分数，结合 ID 对应偏置选6个专家；输出专家 IDs 与路由权重给 routed 分支。',
    experts:'选中的6个专家读取同一归一化 hidden 和各自权重，执行 SwiGLU；按路由权重汇总后交给 MoE sum。',
    shared:'共享专家无需 TopK 选择，处理同一归一化 hidden，输出 [T,5120] 给 MoE sum。',
    sum:'routed 加权和乘 routed_scaling_factor，再加 shared output，得到 [T,5120] MoE 输出给 FFN hc_post。',
    fpost:'使用 FFN post/comb 组合 H′ 与 MoE 输出，返回新四路 H；ffn_pre 随 H 传给下一层或最终 collapse。'
  },['model','config']);
  C.block.edges.push(e('apre','apost','Attention post / comb',4),e('fpre','fpost','FFN post / comb；ffn_pre 向下传',9));
  put('mhc','mHC：四路残差怎样读写','block','DeepSeek V4.1 使用跨子层传递的 pre_mix。当前 hc_pre 消费上一子层产生的 pre，而本次生成的 pre 留给下一子层，不能画成同一子层自产自用。','四路 residual H [T,4,5120]；incoming pre_mix；本子层 mHC 权重；Attention 或 MoE 子层权重。','更新四路 residual Hnew；新产生的 next_pre → 下一子层 hc_pre；最后的 next_pre → 模型末端 collapse。',[
    n('residual','保留四路 H','[T,4,5120]','streams',0,0,null,'模型入口把 embedding 展开四路，后续由上一 hc_post 更新；当前 H 一路参与 hc_pre，一路保留供 hc_post 合并。'),
    n('pre','incoming pre_mix','来自上一子层；初始 [1,0,0,0]','gather',1,0,null,'L0 Attention 的 pre_mix 是固定初始值，其后来自上一子层；它是本次将四路 H 混合为单路的系数。'),
    n('mix','hc_pre','混合 H；生成 post / comb / next_pre','gather',0,1,null,'按 incoming pre_mix 加权四路得到单路 x；用当前 H 与 mHC 学习参数算本次 post/comb 和下一子层用的 next_pre。'),
    n('norm','RMSNorm','[T,5120] → normalized x','gather',0,2,null,'混合后的 x 经本子层 RMSNorm 权重缩放，送给 Attention 或 MoE，不归一化整条四路 residual 分支。'),
    n('layer','Attention 或 MoE','normalized x → y [T,5120]','attention',0,3,'block','实际子层读取归一化 x，完成 Attention 或 MoE 运算，返回单路输出 y。'),
    n('post','hc_post','residual × comb + y × post','scatter',0,4,null,'保留的 H 按 comb 组合，子层 y 按 post 写入四路，得到 Hnew；next_pre 不在这里重新生成。'),
    n('next','下一子层 / 最终折叠','Hnew + next_pre','streams',0,5,null,'中间层将 Hnew/next_pre 交给下一 hc_pre；全部40层后按最后 next_pre 折叠四路，再做模型最终 Norm。')
  ],[e('residual','mix','H',2),e('pre','mix','incoming pre_mix',2),e('mix','norm','混合 x [T,5120]',3),e('norm','layer','normalized x',4),e('layer','post','单路 y [T,5120]',5),e('residual','post','保留 residual H',5),e('mix','post','当前 post / comb',5),e('post','next','Hnew [T,4,5120]',6),e('mix','next','next_pre：延后消费',6)],['model']);
  legacy('attention','attention','L20 Attention：逐个张量追踪','decoder','以建立 Decoder 全局 KV 的 L20 为例；别的层是否生产 KV、是否重算 TopK，请进入“共享关系”。positions 决定 RoPE / 因果边界，缓存历史来自此前轮次。','Encoder 末端 H 经 L20 hc_pre / RMSNorm 得到 x [T,5120]；positions；本层 SWA 历史；L20 全局 KV 与 index K 历史；本层投影权重。','Attention 输出 [T,5120] → L20 hc_post；更新后的 SWA / 全局 KV 留在缓存；Top512 与候选块 → 当前及后续共享层。',{comp:'compressor',top:'sharing'}, {
    x:'L19 输出 Henc 先进入 L20 hc_pre，再 RMSNorm，才得到这里的 x [T,5120]；x 是 Q、SWA、压缩器和索引权重的共同来源。',
    q:'x 经 wq_a 与 q_norm 得到低秩 qr，再经 wq_b 展开64个512维头并应用 RoPE；Q 给 Sparse Attention，未展开的 qr 另给 Index Q 投影。',
    swa:'当前 x 经本层 wkv、Norm、RoPE 形成 KV；按 positions 写入本层窗口缓存，与历史窗口拼成 Attention 可见的 SWA。每层缓存独立。',
    comp:'L20 当前 x 经 C1 compressor 生成未旋转 latent；一支 RoPE 后写入全局 KV，一支送 Index K 投影。历史 KV 由以前的 L20 调用保留。',
    iq:'Index Q 从 qr 经专门投影和 RoPE 生成；index 权重从当前 x 投影。二者送 Indexer 给历史 index K 打分。',
    ik:'从 compressor 的未 RoPE latent 经独立 wk、k_norm、RoPE 得到 index K，写入独立索引缓存；它与 Attention 读取的主 KV 不是同一张量。',
    top:'Indexer 用当前 index Q / 权重检索 index K，输出 Top512 位置和最多2048个候选块（每块8位置）；位置索引给 Attention，而不是返回512个输出向量。',
    sparse:'用当前 Q、各层自己的 SWA、按 Top512 从 L20 共享 KV 选取的向量，以及 causal mask / sink 计算 Attention 输出。',
    out:'Attention 输出先 inverse RoPE，再经分组低秩 wo_a / wo_b 映射回5120维，返回给本层 hc_post。'
  },['attention','model','config']);
  C.attention.nodes.find(x=>x.id==='x').detail='L20 hc_pre / RMSNorm 输出 [T,5120]';
  C.attention.notes=['Q 的 q_norm 位于 wq_a 之后；本实现不是在 wq_b 后再额外画一个 QNorm。','图上是当前张量的生产关系；缓存框同时持有之前轮次写入的有效历史，读取受 positions、请求长度和 mask 限制。'];
  put('sharing','哪些层生产 KV，哪些层只拿索引','attention','共享的是两种不同对象：主 Attention 读的 KV 向量，以及决定读哪些位置的 TopK IDs。SWA 不跨层共享；候选块只是后续检索的候选范围。','各层当前 normalized hidden、低秩 qr；对应请求的历史长程缓存；L20 候选块；每层自己的 SWA。','各层获得自己的 Q / SWA，以及所属源层的长程 KV 和 TopK 位置，交给 Sparse Attention。',[
    n('enc','Encoder 分组三个源','L2 / L8 / L14：C2','cache',0,0,'compressor','三个源层各自产生本组压缩 KV 与 TopK；L2–7、L8–13、L14–19 分别复用组内源。L0–1 无长程压缩分支。'),
    n('dec','Decoder 唯一长程 KV 源','L20：C1，给 L20–39','cache',1,0,'attention','L20 normalized hidden 产生 C1 主 KV 和 index K；后续 Decoder 层复用这些缓存，当前 Q 仍由每层自己的 hidden 生成。'),
    n('cand','L20 全局检索候选','最多 2048 blocks × 8','selection',1,1,null,'L20 indexer 在全局历史中检索，输出候选块列表；后续 indexer 源层只在这些候选内重新打分，减少检索范围。'),
    n('top','每四层重算 TopK','源层 20 / 24 / 28 / 32 / 36','selection',1,2,null,'每个源层用自身 index Q / 权重在候选范围选 Top512；该组后续3层复用位置 IDs，所有组仍读 L20 主 KV。'),
    n('local','当前层的 Q 与 SWA','本层 hidden + 本层历史','cache',0,2,null,'每层投影自身 Q 和 SWA KV；SWA 历史不属于共享长程缓存，窗口长度128。'),
    n('attn','Sparse Attention','当前 Q + SWA + selected KV','attention',0,3,'attention','用 TopK 位置从源层主 KV 取向量，再与本层窗口一起供当前 Q 计算 Attention，输出送当前层 hc_post。')
  ],[e('dec','cand','index K + L20 index Q',2),e('cand','top','候选 block IDs',3),e('dec','top','共享 index K；各源层自有 index Q',3),e('enc','attn','所属 Encoder 组的 KV + TopK',4),e('dec','attn','Decoder 共享主 KV 向量',4),e('top','attn','Top512 位置 IDs',4),e('local','attn','当前 Q + 独立 SWA',4)],['attention','config'],['L20–23 用 TopK20，L24–27 用 TopK24，L28–31 用 TopK28，L32–35 用 TopK32，L36–39 用 TopK36。','SharedAttentionState 的本轮 TopK 重置不等于删除请求的持久 KV 缓存。']);
  put('compressor','C2 / C1：长程 KV 从哪里来','attention','压缩器读取 KV 源层的 normalized hidden。C2 是学习的 gated pooling，不是把两个 token 简单求平均；C1 保留每 token 一个 latent。','源层 x [T,5120]；压缩投影 / gate / Norm 参数；positions、压缩组状态；此前已写入的请求缓存。','未 RoPE latent → Index K 投影；RoPE 后 latent → 源层主 KV 缓存，供共享层按位置读取。',[
    n('x','KV 源层 normalized x','L2 / 8 / 14 或 L20','tokens',0,0,null,'Attention 的输入 Norm 产生 x；只有指定源层执行长程 KV 生成，消费者层直接读取源缓存。'),
    n('proj','投影 latent 与 gate','checkpoint 参数 × x','gather',0,1,null,'压缩器学习参数将当前 x 映射为 latent 候选和 pooling 所需权重；它们不是从 SWA cache 再压缩。'),
    n('pool','按配置形成 latent','C2：8→4；C1：8→8','sum',0,2,null,'C2 对完整的2-token组做带 softmax gate 的学习池化，再规范化；C1 为每 token 产生一个 latent。例子8→4/8只描述完整分组。'),
    n('main','主 KV：RoPE 后存储','latent → RoPE → cache','cache',0,3,null,'positions 对齐的 latent 经 RoPE 写入主 KV 缓存，与此前历史合并；Sparse Attention 按 TopK 位置读取该缓存。'),
    n('index','索引 K：独立投影','latent → wk / Norm / RoPE','selection',1,3,null,'从未旋转 latent 投影 index K，经 Norm / RoPE 写入索引缓存；Indexer 用它选位置，不直接把 index K 当主 Attention KV。'),
    n('consumer','共享层的两个消费者','Indexer 选位置，Attention 读向量','attention',0,4,'sharing','Indexer 读取 index K 输出 TopK IDs；Attention 用这些 IDs 读取主 KV，结合当前层 Q / SWA 完成计算。')
  ],[e('x','proj','normalized x [T,5120]',2),e('proj','pool','latent 候选 + gate',3),e('pool','main','未旋转 pooled latent',4),e('pool','index','同一未旋转 latent',4),e('main','consumer','历史 + 当前主 KV 向量',5),e('index','consumer','历史 + 当前 index K',5)],['attention','config'],['S 表示该请求有效压缩历史长度；这里不把某个硬件打包 cache 的字节布局当成所有设备统一格式。']);
  put('engram','Engram：记忆如何真正进入模型','encoder','记忆表是 checkpoint 中学习得到的参数。当前 token 与历史 token 决定查哪几行；当前层的 hidden 决定查到的内容注入多少。哈希地址、记忆向量和 Attention KV 是不同对象。','原始 IDs [T]、positions、请求边界、prompt lookback / 历史；L1/L14 专属记忆表及 wkv / gate 参数；该层入口四路 H；图像 / padding 有效 mask。','Hnew = H + gate[...,None] × value[:,None,:]，形状仍 [T,4,5120]，在 L1 或 L14 的 block 之前送入 hc_pre；token 历史状态供后续 n-gram 哈希。',[
    n('ids','当前原始 IDs','runner → IDs / positions / 边界','tokens',0,0,null,'runner 传入本轮 token IDs、绝对 positions 和 query_start_loc；不能把不同请求或图像占位串成一个 n-gram。'),
    n('history','历史 token 来源','当前 chunk → lookback → slot history','state',1,0,null,'n-gram 优先使用当前 chunk 中前面的 token，再使用 runner 提供的 prompt lookback；适用的 runner 路径还可读 slot history。MRV2 需要设备侧 lookback。'),
    n('hash','构造 2 / 3 / 4-gram','各自 hash → 记忆行地址','hash',0,1,null,'在请求和因果边界内拼成2/3/4元 token 组合，再按 checkpoint 对齐的哈希布局生成各表头行地址；图像和无效 padding 被屏蔽。'),
    n('table','训练得到的记忆表','L1 / L14 各自的参数','cache',1,1,null,'模型加载时读取 Engram embedding tables；本轮 forward 用哈希查行，表本身不会因为生成一个 token 就改写。并行查表可能涉及 DP/TP 汇集。'),
    n('lookup','prepare_engram 查表','hash rows → lookups[layer_id]','gather',0,2,null,'根据地址读取对应层记忆表并汇集表头向量，生成 lookups[1] / lookups[14]；模型先备好它们，执行到对应层入口才消费。'),
    n('weights','该层投影与门控参数','checkpoint → wkv / norm 权重','cache',1,2,null,'checkpoint 提供 L1 或 L14 专属 wkv 与门控归一化参数；wkv 生成 key/value，门控参数与当前 H 和 key 一起计算每路相关性。'),
    n('project','该层 wkv 投影','memory → key [T,4,H] + value [T,H]','gather',0,3,null,'L1 或 L14 的 Engram 层将自己的查表向量投影为四路 key 和共享 value；这里 H=5120，key 用于相关性，value 用于注入。'),
    n('hidden','当前层入口 residual','上一层 H [T,4,5120] / pre_mix','streams',1,3,null,'L1 使用 L0 输出，L14 使用 L13 输出。当前四路 H 与记忆 key 一起决定每路 gate；上一层 pre_mix 原样旁路到接下来的 hc_pre，Engram 不重算它。'),
    n('gate','相关性 → sigmoid gate','normalized hidden · key → [T,4]','selection',0,4,null,'必要时恢复原始旋转基，用归一化 hidden/key 与通道权重计算相似度，经带符号平方根和 sigmoid 得到 gate；图像或无效位置 gate=0。'),
    n('inject','加回四路 residual','Hnew = H + gate × value','sum',0,5,null,'value [T,5120] 沿四路广播，再乘每路 gate 加到原 H；记忆从这里进入语言主干，而不是只停留在查表框。'),
    n('block','接着执行 L1 / L14','Hnew → hc_pre → Attention → MoE','stack',0,6,'block','模型循环把门控后的四路 H 传入对应 decoder layer；之后按普通 mHC、Attention、MoE 路径继续传播这份记忆影响。'),
    n('next','下一轮哈希历史','有效 token 历史 / runner lookback','state',1,6,null,'请求的有效 token 历史或相关 slot 状态为后续轮次提供前缀；这份历史是 token ID 状态，不是对已学习记忆表的在线训练。')
  ],[e('ids','hash','当前 IDs + positions / 请求边界',2),e('history','hash','该请求前序 token IDs',2),e('hash','lookup','2/3/4-gram 的行地址',3),e('table','lookup','checkpoint 记忆表',3),e('lookup','project','lookups[1] 或 lookups[14]',4),e('weights','project','该层 wkv 参数',4),e('project','gate','key [T,4,5120]',5),e('hidden','gate','当前 H [T,4,5120]',5),e('weights','gate','该层门控归一化参数',5),e('ids','gate','原始 IDs / 有效长度决定 mask',5),e('gate','inject','gate [T,4]',6),e('project','inject','value [T,5120]',6),e('hidden','inject','保留原 H [T,4,5120]',6),e('inject','block','门控后的 Hnew',7),e('hidden','block','原样传递 pre_mix [T,4]',7),e('ids','next','按有效请求维护 token 历史',7),e('next','history','后续轮次可读的前缀',1)],['engram','gate','model','config'],['需实际启用 Engram 运行配置；没有有效请求的 dummy 路径使用空哈希 / 掩码参与或跳过相应流程，不能把未初始化记忆注入真实 token。','本图说明逻辑依赖；分片查表的通信与事件同步不等于 Attention KV 读写。']);
  put('moe','MoE：hidden 如何分给专家','block','Router 决定哪些专家处理当前 token；专家输入仍是 normalized hidden，不是 router 分数。共享专家始终处理同一个输入。','FFN hc_pre / RMSNorm 产生 x [T,5120] 及 FP32 router 输入；原始 token IDs；router、384 routed experts 与1 shared expert 权重。','routed_scaling_factor × Σ(weight × expert_output) + shared_output，形状 [T,5120] → FFN hc_post。',[
    n('x','FFN normalized hidden','x [T,5120] / FP32 router x','tokens',0,0,null,'FFN hc_pre 混合四路 H′，RMSNorm 产生专家所需 x 以及 FP32 router 输入；两者送往不同分支。'),
    n('ids','原始 IDs 与参数','modality bias / router 权重','cache',1,0,null,'模型保留的 ID 选择文本或图像路由偏置；checkpoint 提供 router 权重与专家矩阵。'),
    n('router','384 个分数 → Top6','专家 IDs + mixing weights','router',0,1,null,'FP32 hidden 经路由投影打分，加适用的路由偏置选出6个专家，产出 IDs 和组合权重；不要将这一步当成专家计算。'),
    n('routed','选中 6 个 routed experts','相同 x → 各专家 SwiGLU','experts',0,2,'expert','按选中专家分配 token hidden，各专家执行各自 SwiGLU 参数；组合结果按路由权重汇总。'),
    n('shared','1 个 shared expert','相同 x → shared output','shared',1,2,'expert','不经过 Top6 筛选，共享专家始终处理当前 token 的 normalized x，得到独立输出。'),
    n('sum','缩放再相加','scaled routed + shared','sum',0,3,null,'先对 routed 加权和乘配置的缩放系数，再加 shared；返回单路 [T,5120] 给 FFN hc_post。'),
    n('post','写回残差','MoE 输出 → hc_post','scatter',0,4,'mhc','FFN hc_post 把 MoE 输出注入保留的四路 residual，输出 Hnew 与下一层 pre_mix。')
  ],[e('x','router','FP32 normalized hidden',2),e('ids','router','modality bias + router 参数',2),e('router','routed','Top6 IDs + routing weights',3),e('x','routed','专家实际输入 x',3),e('x','shared','共享专家实际输入 x',3),e('routed','sum','Σ weight × routed output',4),e('shared','sum','shared output',4),e('sum','post','MoE output [T,5120]',5)],['model','config']);
  put('expert','一个 SwiGLU 专家的内部','moe','Routed 与 shared 专家都执行这种 MLP；区别在参数、选择方式及汇总方式。图示 H=5120，I 表示该专家配置的中间宽度。配置 swiglu_limit=ℓ 时，激活前先对 gate 与 up 使用不同边界的 clamp。','路由后或共享分支的 x [N,H]，N 是该专家本轮收到的 token 数；checkpoint 的 Wgate、Wup、Wdown 与配置 swiglu_limit。','down_proj(SiLU(clamp(g,max=ℓ)) × clamp(u,−ℓ,ℓ)) [N,H]，g=gate_proj(x)，u=up_proj(x) → routed 加权汇总或 shared 分支。',[
    n('x','本专家的 token hidden','normalized x [N,H]','tokens',0,0,null,'Routed 分支把被该专家选中的 token 送来；shared 分支接收所有本地需处理 token，二者均使用 normalized hidden。'),
    n('weights','本专家的参数','Wgate / Wup / Wdown；limit=ℓ','cache',1,0,null,'checkpoint 提供本专家三组矩阵；配置 swiglu_limit 传给共享专家激活与 routed FusedMoE，在 SiLU 之前裁剪 gate/up。'),
    n('gate','gate_proj','xWgate → [N,I]','gather',0,1,null,'输入 x 与本专家 Wgate 相乘，生成未裁剪的门分支 g；交给 clamp / SiLU。'),
    n('up','up_proj','xWup → [N,I]','gather',1,1,null,'同一 x 与 Wup 相乘生成未裁剪的 u；先裁剪到 [−ℓ,ℓ]，再与另一分支的激活相乘。'),
    n('act','Clamp → SiLU 与乘法','SiLU(min(g,ℓ)) × clip(u,±ℓ)','sum',0,2,null,'gate 只裁上界 ℓ，up 裁到 [−ℓ,ℓ]；之后计算 SiLU(g_clamped) × u_clamped，输出 [N,I] 给 down_proj。未设置 limit 的配置才退化为普通 SwiGLU。'),
    n('down','down_proj','[N,I] × Wdown → [N,H]','scatter',0,3,null,'Wdown 将中间激活映射回 hidden 宽度；输出返回 MoE，按 routed 权重汇总或作为 shared output。')
  ],[e('x','gate','x [N,H]',2),e('weights','gate','Wgate [H,I]',2),e('x','up','x [N,H]',2),e('weights','up','Wup [H,I]',2),e('gate','act','g [N,I]',3),e('up','act','u [N,I]',3),e('weights','act','配置 limit=ℓ',3),e('act','down','裁剪后的门控激活 [N,I]',4),e('weights','down','Wdown [I,H]',4)],['model','activation','config']);
  put('head','从 residual 到下一 token','overview','forward 返回 hidden，不是直接返回词。LM head 和采样是由 runner 接续执行的阶段；有草稿时，目标 logits 交给验证器。','L39 的 H [T,4,5120] 和最后 ffn_pre；最终 RMSNorm / LM head 参数；runner 的 logits 位置选择、采样参数及可选草稿。','目标 logits [选定位置,V] → 普通 sampler 或 rejection sampler；最终确认 token IDs → 请求状态更新。',[
    n('h','L39 返回值','Hfinal + 最后 ffn_pre','streams',0,0,null,'最后一个 FFN hc_post 返回四路 H，ffn_pre 是最后 hc_pre 生成并向外传递的折叠系数。'),
    n('collapse','hc_collapse','加权四路 → [T,5120]','gather',0,1,null,'使用最后 ffn_pre 对 H 的四路加权折叠；不是 DSpark aux 使用的简单均值。'),
    n('norm','最终 RMSNorm','hidden [T,5120]','gather',0,2,null,'模型最终 Norm 对折叠后的 hidden 归一化，forward 返回此 hidden 给 runner。'),
    n('lm','compute_logits','选定 hidden × LM head','logits',0,3,null,'runner 选择需要预测的位置，调用 compute_logits / logits processor 与已加载 LM head 权重得到目标 logits。'),
    n('sampler','普通采样','logits + sampling params → ID','sample',0,4,null,'普通路径由外部 sampler 按温度等参数选择 token；结果交给请求更新，不属于 Transformer block。'),
    n('verify','有草稿则进入验证','目标 p + 候选 IDs / q','verify',1,4,'verification','投机路径的多个目标位置产生 p，与 DSpark 候选和可用的草稿 q 一起进入 rejection sampler，输出连续有效 token。')
  ],[e('h','collapse','Hfinal + ffn_pre',2),e('collapse','norm','折叠 hidden [T,5120]',3),e('norm','lm','forward 返回的 hidden',4),e('lm','sampler','普通路径 target logits',5),e('lm','verify','验证路径 target logits',5,true)],['model','runner','verify']);
  put('dspark','DSpark 内部：起草不等于确认','overview','独立草稿网络先并行计算 block 表征，Markov head 再逐位置依赖刚采样的前一个 token。confidence 只影响候选提交长度；最终正确性由目标模型验证决定。','主模型选定层 L37/38/39 入口均值，各 [T,5120]；上一轮确认 token / anchor；请求上下文、采样参数；独立 DSpark checkpoint 参数与草稿缓存。','最多5个候选 token IDs 与采样所需 q / 可选 confidence → 下一轮 target forward 与 rejection sampler；草稿本身不直接成为最终响应。',[
    n('aux','读取三个主模型入口','mean(H37/38/39, hc 维)','streams',0,0,'decoder','主模型循环在 L37、38、39 调用前各采集四路 residual 均值，得到三份 [T,5120]，提供草稿上下文。'),
    n('anchor','已确认的 anchor','last sampled token + positions','tokens',1,0,null,'runner 提供上一轮已确认 token 和请求位置 / 有效长度；用于本轮草稿起点，不把未通过验证的后缀当可靠历史。'),
    n('proj','拼接 → main_proj / Norm','3H → 草稿 context','gather',0,1,null,'三份主模型 aux 沿 hidden 拼接，经 DSpark main_proj 与 Norm 投影为草稿上下文；之后输入独立草稿 backbone。'),
    n('backbone','3 个 draft stages','SWA + 独立草稿状态','stack',0,2,null,'草稿 backbone 用投影 context、anchor / draft 输入和自身缓存计算块位置表征；这里是 SWA 草稿网络，没有主模型的全局长程 indexer。'),
    n('base','各位置 base logits','块表征 → vocabulary logits','logits',0,3,null,'backbone 的 block hidden 经过草稿 head 产生各位置 base logits，为后续逐位置 Markov 修正准备输入。'),
    n('markov','逐位置 Markov 采样','base logits + prev-token bias','draft',0,4,null,'第i位置将前一采样 token 的 Markov embedding / bias 加入 base logits，按采样模式得到 token_i；token_i 继续作为下一位置的 prev。'),
    n('confidence','可选 confidence','草稿 hidden + prev-token embedding','selection',1,4,null,'confidence head 同时读取每位置草稿 head hidden 与该位置使用的 prev-token Markov embedding，经投影 / sigmoid 输出 confidence；它可裁剪验证候选数，不替代目标验证。'),
    n('candidates','候选块与草稿概率','最多5 IDs + draft q','tokens',0,5,null,'保留候选 IDs；随机采样路径保留对应草稿 logits / q（可能经词表映射）；这些候选被提交给下一轮目标计算。'),
    n('verify','目标模型验证','target forward → rejection sampler','verify',0,6,'verification','目标模型对候选位置计算目标分布 p，随后逐个接受直到首次拒绝；输出确认前缀和纠正或 bonus token，再更新状态。')
  ],[e('aux','proj','concat(aux37, aux38, aux39)',2),e('proj','backbone','投影后的 context',3),e('anchor','backbone','anchor / positions / 有效历史',3),e('backbone','base','每草稿位置 hidden',4),e('base','markov','base logits_i',5),e('anchor','markov','第一个 prev token',5),e('backbone','confidence','每位置草稿 head hidden',5,true),e('markov','confidence','每位置使用的 prev-token embedding',5,true),e('markov','candidates','候选 IDs + 实际采样分布 q',6),e('confidence','candidates','可选候选长度',6,true),e('candidates','verify','下一轮验证输入',7)],['config','model','draft','speculator','runner'],['本图用官方配置的5个候选位置；内部含 anchor 的物理 buffer 长度与对外“候选数”不是同一个数字。','DSpark 参数独立于主模型；图中的 context 与缓存是逻辑关系，不代表各 runner 后端使用完全相同的缓冲布局。']);
  put('verification','DSpark 算完后：验证与状态修正','dspark','这是跨生成轮次的闭环：先有草稿，再让目标模型处理候选位置，随后接受 / 拒绝，最后才更新已确认历史。下面的交互示例采用 greedy 比较，字符只是教学 token。','已确认前缀 / anchor / 有效 KV；DSpark 候选 d [R,K]（K≤5）、实际采样分布 q [R,K,V]（随机路径）；目标模型权重、采样配置及请求 RNG 状态。R 是请求数，V 是目标词表宽度；后端可用等价压缩表示。','连续接受前缀 + 首拒纠正 token，或全接受 + bonus；有效 IDs [R,≤K+1] 及每请求有效 / 拒绝计数 → runner 更新历史、可见缓存范围和下一轮起草输入。',[
    n('draft','草稿候选','d1…d5 + draft q','draft',0,0,'dspark','DSpark 已计算候选 IDs；随机采样还保留草稿 q，greedy 路径可只比较目标 argmax。此时候选没有直接进入用户输出。'),
    n('history','已确认请求状态','prefix / anchor / cache / lengths','state',1,0,null,'Runner 提供已确认前缀、anchor、positions 及有效缓存长度，安排下一次目标模型验证调用。'),
    n('target','目标模型验证 forward','前缀 + 候选位置 → target hidden','stack',0,1,'overview','主模型按因果关系处理草稿位置，利用每个位置之前的候选作为条件，得到用于逐候选预测及末尾 bonus 的 hidden；这是正式目标计算。'),
    n('p','目标 LM head','target hidden → p [R,K+1,V]','logits',0,2,'head','compute_logits 在验证位置产生目标 logits，再按相应采样配置得到 p [R,K+1,V]：前 K 个用于候选接受与拒绝恢复，末尾分布用于全接受后的 bonus。'),
    n('sampling','采样配置与随机状态','params / 每请求 RNG','state',1,2,null,'Runner 提供温度、截断配置和每请求随机状态；目标 logits 按配置变换，随机接受与恢复 / bonus 采样消费相应随机数。Greedy 模式只取 argmax。'),
    n('accept','接受判定直到首次拒绝','greedy 比较 / 随机 p、q 判定','verify',0,3,null,'Greedy 比较候选与目标 argmax；标准随机拒绝采样以 min(1,p(d)/q(d)) 决定接受。只接受连续前缀，后续位置在首次拒绝后不继续提交。'),
    n('recover','拒绝：纠正首个分歧','接受前缀 + recovered token','sample',0,4,null,'首次拒绝处输出目标纠正 token；标准随机路径从归一化 max(p−q,0) 恢复分布采样，greedy 路径用目标 argmax。拒绝点之后草稿全部丢弃。'),
    n('bonus','全接受：多取一个','接受全部候选 + bonus token','sample',1,4,null,'若全部候选通过，用目标模型末尾预测产生额外 bonus token；不需要把已接受候选再逐个算一遍。'),
    n('commit','提交有效 token 与计数','accepted / num_sampled / num_rejected','state',0,5,null,'Sampler 返回有效 token 及计数，runner postprocess 更新请求已确认序列和有效长度；拒绝后缀的 KV 即使已算出，也不能作为后续有效上下文。'),
    n('next','修正状态后继续起草','新 anchor / 有效上下文 / aux','draft',0,6,'dspark','根据接受 / 拒绝计数推进位置与草稿上下文，确认 token 成为新 anchor；需要的纠正 / bonus token 表征由后续计算衔接，开始下一轮提议。')
  ],[e('draft','target','候选 IDs，按验证位置排布',2),e('history','target','确认前缀 + positions / 有效 KV',2),e('target','p','验证位置 hidden',3),e('sampling','p','目标分布的采样变换配置',3),e('p','accept','每候选对应目标 p_i',4),e('draft','accept','候选 d_i + 实际草稿 q_i',4),e('sampling','accept','模式 / 随机接受数 u_i',4),e('accept','recover','首次拒绝位置 + 已接受前缀',5),e('p','recover','拒绝位置的完整目标 p_i',5),e('draft','recover','同位置完整草稿 q_i',5),e('sampling','recover','恢复采样随机数 / greedy 模式',5),e('accept','bonus','全接受判定 + 已接受候选',5),e('p','bonus','末尾位置目标分布 p_bonus',5),e('sampling','bonus','bonus 采样配置 / 随机数',5),e('recover','commit','前缀 + correction',6),e('bonus','commit','全候选 + bonus',6),e('commit','next','有效 IDs / accepted-rejected counts',7),e('next','draft','下一轮候选生成',1)],['runner','speculator','verify'],['随机分布公式说明标准 rejection sampling 语义；p 与 q 必须是对应位置实际采样使用的分布，q 包含草稿侧温度 / 截断效果。Ascend 还存在按配置选择的其他验证模式，本图不声称所有模式都执行同一判定核。','无效后缀的处理关键是有效长度和状态修正，不必把缓存物理内存逐字清零。','confidence head 不能证明草稿正确；只有目标模型分布参与的验证结果决定哪些候选可提交。']);
  C.verification.verificationDemo=true;
  const attentionDetails={x:'normalized x [T,5120]',q:'wq_a → Norm → wq_b → RoPE',swa:'本层 wkv / Norm / RoPE；窗口128',comp:'C1 latent [T,512] → 全局 KV',iq:'qr → index Q；x → weights',ik:'latent → wk / Norm / RoPE',top:'Top512；候选2048块×8',sparse:'Q + SWA + 所选全局 KV',out:'inverse RoPE → wo_a → wo_b'};
  for(const node of C.attention.nodes)node.detail=attentionDetails[node.id]||node.detail;
  for(const [componentId,component] of Object.entries(C))for(const node of component.nodes)if(node.kind==='streams')node.streamCount=componentId==='dspark'&&node.id==='aux'?3:4;
  window.ARCH_MODELS.deepseek_v41=model;
})();
